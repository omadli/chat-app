# chat/consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message, Conversation
from django.contrib.auth import get_user_model
from .serializers import MessageSerializer
from django.db.models.functions import Now

CustomUser = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.conversation_group_name = f"conversation_{self.conversation_id}"
        self.user = self.scope.get("user")

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        is_participant = await self.check_user_is_participant(
            self.user, self.conversation_id
        )
        if not is_participant:
            logging.warning(
                f"User {self.user.id} attempted to connect to conversation {self.conversation_id} but is not a participant."
            )
            await self.close()
            return

        await self.channel_layer.group_add(
            self.conversation_group_name, self.channel_name
        )
        await self.accept()
        logging.info(
            f"User {self.user.id} connected to chat {self.conversation_id}, channel {self.channel_name}"
        )

    async def disconnect(self, close_code):
        if (
            hasattr(self, "conversation_group_name")
            and self.user
            and self.user.is_authenticated
        ):
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    "type": "user_typing_stopped_event",
                    "user_id": self.user.id,
                    "username": self.user.get_full_name() or self.user.username,
                    "sender_channel_name": self.channel_name,
                },
            )
            await self.channel_layer.group_discard(
                self.conversation_group_name, self.channel_name
            )
            logging.info(
                f"User {self.user.id} disconnected from chat {self.conversation_id}, channel {self.channel_name}"
            )

    async def receive(self, text_data):
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get("type")

            client_conversation_id_raw = text_data_json.get("conversation_id")
            client_conversation_id = (
                str(client_conversation_id_raw)
                if client_conversation_id_raw is not None
                else None
            )

            if (
                client_conversation_id is None
                or client_conversation_id != self.conversation_id
            ):
                logging.warning(
                    f"User {self.user.id} (channel: {self.channel_name}) sent event with "
                    f"mismatched or missing conversation_id. Socket for: '{self.conversation_id}', "
                    f"Client sent: '{client_conversation_id_raw}' (type: {type(client_conversation_id_raw)}). "
                    f"Event type: '{message_type}'. Discarding event."
                )
                return

            if message_type == "chat_message_new":
                message_content = text_data_json.get("content")
                # image_base64_data = text_data_json.get('image') # TODO: Add if handling images via WS

                if message_content:
                    logging.info(
                        f"User {self.user.id} sent new chat message via WebSocket for convo {self.conversation_id}: {message_content[:30]}"
                    )

                    message_db = await self.save_message_to_db(
                        self.conversation_id, self.user, message_content
                    )
                    if not message_db:
                        await self.send(
                            text_data=json.dumps(
                                {"error": "Failed to save message sent via WebSocket."}
                            )
                        )
                        return

                    await self.update_conversation_timestamp(self.conversation_id)
                    serialized_message = await self.serialize_db_message(message_db)

                    await self.channel_layer.group_send(
                        self.conversation_group_name,
                        {"type": "chat.message", "message": serialized_message},
                    )

            elif message_type == "typing_started":
                await self.channel_layer.group_send(
                    self.conversation_group_name,
                    {
                        "type": "user_typing_started_event",
                        "user_id": self.user.id,
                        "username": self.user.get_full_name() or self.user.username,
                        "sender_channel_name": self.channel_name,
                    },
                )

            elif message_type == "typing_stopped":
                await self.channel_layer.group_send(
                    self.conversation_group_name,
                    {
                        "type": "user_typing_stopped_event",
                        "user_id": self.user.id,
                        "username": self.user.get_full_name() or self.user.username,
                        "sender_channel_name": self.channel_name,
                    },
                )
            else:
                logging.debug(
                    f"ChatConsumer: Received unhandled message_type '{message_type}' for conversation {self.conversation_id}"
                )

        except json.JSONDecodeError:
            logging.error(
                f"ChatConsumer: Invalid JSON from user {self.user.id if self.user else 'Unknown'}"
            )
        except Exception as e:
            logging.error(
                f"ChatConsumer: Error in receive for user {self.user.id if self.user else 'Unknown'}: {e}",
                exc_info=True,
            )

    async def chat_message(self, event):
        message_data = event["message"]
        await self.send(
            text_data=json.dumps({"type": "chat_message", "message": message_data})
        )

    async def message_updated(self, event):
        updated_message_data = event["message"]
        await self.send(
            text_data=json.dumps(
                {"type": "message_updated", "message": updated_message_data}
            )
        )

    async def message_deleted(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "message_deleted",
                    "message_id": event["message_id"],
                    "conversation_id": event["conversation_id"],
                    "message": event.get("message"),
                }
            )
        )

    async def user_typing_started_event(self, event):
        if self.channel_name != event.get("sender_channel_name"):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "user_typing_started",
                        "user_id": event["user_id"],
                        "username": event["username"],
                        "conversation_id": self.conversation_id,
                    }
                )
            )

    async def user_typing_stopped_event(self, event):
        if self.channel_name != event.get("sender_channel_name"):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "user_typing_stopped",
                        "user_id": event["user_id"],
                        "username": event["username"],
                        "conversation_id": self.conversation_id,
                    }
                )
            )

    @database_sync_to_async
    def check_user_is_participant(self, user_obj, conv_id_str):
        try:
            conv_id = int(conv_id_str)
            return Conversation.objects.filter(
                id=conv_id, participants=user_obj
            ).exists()
        except ValueError:
            logging.error(
                f"Invalid conversation_id format for check_user_is_participant: {conv_id_str}"
            )
            return False

    @database_sync_to_async
    def save_message_to_db(self, conv_id_str, sender_obj, content_text, image_obj=None):
        try:
            conv_id = int(conv_id_str)
            conv = Conversation.objects.get(id=conv_id)
            msg = Message.objects.create(
                conversation=conv,
                sender=sender_obj,
                content=content_text,
                image=image_obj,
            )
            return msg
        except Conversation.DoesNotExist:
            logging.error(
                f"Conversation with id {conv_id_str} not found for saving message."
            )
            return None
        except ValueError:
            logging.error(
                f"Invalid conversation_id format for save_message_to_db: {conv_id_str}"
            )
            return None
        except Exception as e:
            logging.error(f"Error saving WS message to DB: {e}", exc_info=True)
            return None

    @database_sync_to_async
    def update_conversation_timestamp(self, conv_id_str):
        try:
            conv_id = int(conv_id_str)
            Conversation.objects.filter(id=conv_id).update(updated_at=Now())
        except ValueError:
            logging.error(
                f"Invalid conversation_id format for update_conversation_timestamp: {conv_id_str}"
            )

    @database_sync_to_async
    def serialize_db_message(self, message_obj):
        if message_obj:
            return MessageSerializer(message_obj, context={"request": None}).data
        return None

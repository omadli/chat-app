# chat/presence_consumers.py
import json
import redis
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

_online_users_registry_in_memory = set()
_redis_client = None

if getattr(settings, "USE_REDIS_FOR_PRESENCE", False):
    try:
        if hasattr(settings, "REDIS_URL"):
            _redis_client = redis.Redis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
        elif hasattr(settings, "REDIS_HOST") and hasattr(settings, "REDIS_PORT"):
            _redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=getattr(settings, "REDIS_DB", 0),
                decode_responses=True,
            )

        if _redis_client:
            _redis_client.ping()
            print("PresenceConsumer: Successfully connected to Redis.")
    except redis.exceptions.ConnectionError as e:
        print(
            f"PresenceConsumer: Could not connect to Redis: {e}. Falling back to in-memory presence."
        )
        _redis_client = None
    except Exception as e:
        print(
            f"PresenceConsumer: Error initializing Redis client: {e}. Falling back to in-memory presence."
        )
        _redis_client = None

REDIS_ONLINE_USERS_KEY = "chat_app:online_users"


class PresenceConsumer(AsyncWebsocketConsumer):

    async def add_user_to_online_set(self, user_id_str):
        if _redis_client:
            await sync_to_async(_redis_client.sadd)(REDIS_ONLINE_USERS_KEY, user_id_str)
        else:
            _online_users_registry_in_memory.add(user_id_str)

    async def remove_user_from_online_set(self, user_id_str):
        if _redis_client:
            await sync_to_async(_redis_client.srem)(REDIS_ONLINE_USERS_KEY, user_id_str)
        else:
            _online_users_registry_in_memory.discard(user_id_str)

    async def get_all_online_users(self):
        if _redis_client:
            user_ids = await sync_to_async(_redis_client.smembers)(
                REDIS_ONLINE_USERS_KEY
            )
            return list(user_ids)
        else:
            return list(_online_users_registry_in_memory)

    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        await self.accept()
        self.user_id_str = str(self.user.id)

        await self.add_user_to_online_set(self.user_id_str)
        current_online_users = await self.get_all_online_users()
        print(
            f"PresenceConsumer: User {self.user_id_str} connected. Online: {current_online_users}"
        )

        await self.channel_layer.group_add(
            "global_presence_notifications", self.channel_name
        )

        await self.send_current_online_list_to_self()
        await self.broadcast_online_users_to_group()

    async def disconnect(self, close_code):
        if hasattr(self, "user_id_str"):
            await self.remove_user_from_online_set(self.user_id_str)
            current_online_users = await self.get_all_online_users()
            print(
                f"PresenceConsumer: User {self.user_id_str} disconnected. Online: {current_online_users}"
            )

            await self.channel_layer.group_discard(
                "global_presence_notifications", self.channel_name
            )
            await self.broadcast_online_users_to_group()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            if message_type == "get_online_users_request":
                print(
                    f"PresenceConsumer: Received 'get_online_users_request' from {self.user_id_str}"
                )
                await self.send_current_online_list_to_self()
        except json.JSONDecodeError:
            print("PresenceConsumer: Received invalid JSON from client")
        except Exception as e:
            print(f"PresenceConsumer: Error in receive method: {e}")

    async def send_current_online_list_to_self(self):
        online_users = await self.get_all_online_users()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "online_users_list",
                    "users": online_users,
                }
            )
        )

    async def broadcast_online_users_to_group(self):
        online_users = await self.get_all_online_users()
        await self.channel_layer.group_send(
            "global_presence_notifications",
            {
                "type": "online_users_event",
                "users": online_users,
            },
        )

    async def online_users_event(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "online_users_list",
                    "users": event["users"],
                }
            )
        )

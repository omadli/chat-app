# chat/views.py
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from rest_framework import generics, status, permissions, serializers
from rest_framework.response import Response
from .models import Conversation, Message
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db.models import Count, OuterRef, Subquery
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    MessageEditSerializer,
)


CustomUser = get_user_model()


# URL: /api/messages/user/<int:user_id>/ (GET - Gets messages for a 1-on-1 chat with user_id)
class GetMessagesWithUserView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_to_chat_with_id = self.kwargs.get("user_id")
        current_user = self.request.user

        if not user_to_chat_with_id:
            return Message.objects.none()

        try:
            CustomUser.objects.get(id=user_to_chat_with_id)
        except CustomUser.DoesNotExist:
            return Message.objects.none()

        if current_user.id == user_to_chat_with_id:
            return Message.objects.none()

        conversation = (
            Conversation.objects.annotate(num_participants=Count("participants"))
            .filter(participants=current_user)
            .filter(participants__id=user_to_chat_with_id)
            .filter(num_participants=2)
            .first()
        )

        if conversation:
            return (
                conversation.messages.all()
                .select_related("sender", "sender__profile")
                .order_by("timestamp")
            )

        return Message.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# URL: /api/messages/send/<int:receiver_id>/ (POST - Initiates a chat or sends to existing 1-on-1)
class SendMessageToUserView(generics.CreateAPIView):
    serializer_class = MessageCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        create_serializer = self.get_serializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        sender = request.user
        receiver_id = self.kwargs.get("receiver_id")
        reply_to_message_id = create_serializer.validated_data.get(
            "reply_to_message_id"
        )

        try:
            receiver = CustomUser.objects.get(id=receiver_id)
        except CustomUser.DoesNotExist:
            return Response(
                {"detail": "Receiver not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if sender == receiver:
            return Response(
                {"detail": "Cannot send messages to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participants_ids = sorted([sender.id, receiver.id])
        conversation = (
            Conversation.objects.annotate(num_participants=Count("participants"))
            .filter(participants__id=participants_ids[0])
            .filter(participants__id=participants_ids[1])
            .filter(num_participants=2)
            .first()
        )

        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.add(sender, receiver)

        conversation.save()

        reply_to_instance = None
        if reply_to_message_id:
            try:
                reply_to_instance = Message.objects.get(
                    id=reply_to_message_id, conversation=conversation, is_deleted=False
                )
            except Message.DoesNotExist:
                return Response(
                    {
                        "detail": "Message being replied to not found in this conversation or has been deleted."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        message_instance = Message.objects.create(
            sender=sender,
            conversation=conversation,
            content=create_serializer.validated_data.get("content"),
            image=create_serializer.validated_data.get("image"),
            reply_to_message=reply_to_instance,
        )

        response_serializer = MessageSerializer(
            message_instance, context={"request": request}
        )
        broadcast_data = response_serializer.data

        channel_layer = get_channel_layer()
        group_name = f"conversation_{conversation.id}"
        async_to_sync(channel_layer.group_send)(
            group_name, {"type": "chat.message.event", "message": broadcast_data}
        )
        async_to_sync(channel_layer.group_send)(
            f"user_{receiver.id}",
            {
                "type": "new.message.notification",
                "message": broadcast_data,
                "conversation_id": conversation.id,
                "sender_id": sender.id,
                "sender_username": sender.get_full_name() or sender.username,
            },
        )

        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


# URL: /api/messages/conversations/ (GET, POST)
class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        latest_message_subquery = (
            Message.objects.filter(conversation=OuterRef("pk"))
            .order_by("-timestamp")
            .values("timestamp")[:1]
        )

        conversations = (
            user.conversations.annotate(
                last_message_timestamp_annotated=Subquery(latest_message_subquery)
            )
            .prefetch_related(
                "participants",
                "participants__profile",
            )
            .order_by("-updated_at", "-last_message_timestamp_annotated")
        )

        return conversations

    def perform_create(self, serializer):
        request_user = self.request.user
        participant_ids_from_request = self.request.data.get("participant_ids", [])

        try:
            participant_ids = list(
                set(int(pid) for pid in participant_ids_from_request)
            )
        except ValueError:
            raise serializers.ValidationError(
                {"participant_ids": "Invalid user ID provided."}
            )

        all_participant_ids = list(set(participant_ids + [request_user.id]))

        if len(all_participant_ids) < 2:
            raise serializers.ValidationError(
                {"participant_ids": "A conversation needs at least two participants."}
            )

        participants_qs = CustomUser.objects.filter(id__in=all_participant_ids)
        if participants_qs.count() != len(all_participant_ids):
            raise serializers.ValidationError(
                {"participant_ids": "One or more participant IDs are invalid."}
            )
        if len(all_participant_ids) == 2:
            existing_convo = (
                Conversation.objects.annotate(num_participants=Count("participants"))
                .filter(participants__id=all_participant_ids[0])
                .filter(participants__id=all_participant_ids[1])
                .filter(num_participants=2)
                .first()
            )
            if existing_convo:
                pass

        conversation = serializer.save(
            participants_qs=participants_qs, request_user=request_user
        )

        for p_user in participants_qs:
            if p_user != request_user:
                async_to_sync(get_channel_layer().group_send)(
                    f"user_{p_user.id}",
                    {
                        "type": "user.notification",
                        "data": {
                            "event_type": "new_conversation_added",
                            "conversation_id": conversation.id,
                            "conversation_data": ConversationSerializer(
                                conversation, context={"request": self.request}
                            ).data,
                            "created_by": request_user.username,
                        },
                    },
                )


# URL: /api/messages/conversations/<int:conversation_pk>/messages/ (GET, POST)
class MessageListInConversationView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MessageCreateSerializer
        return MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs.get("conversation_pk")
        if not Conversation.objects.filter(
            id=conversation_id, participants=self.request.user
        ).exists():
            return Message.objects.none()

        return (
            Message.objects.filter(conversation_id=conversation_id)
            .select_related("sender", "sender__profile")
            .order_by("timestamp")
        )

    def create(self, request, *args, **kwargs):
        conversation_id = self.kwargs.get("conversation_pk")
        try:
            conversation = Conversation.objects.get(
                id=conversation_id, participants=request.user
            )
        except Conversation.DoesNotExist:
            return Response(
                {"detail": "Conversation not found or you are not a participant."},
                status=status.HTTP_404_NOT_FOUND,
            )

        create_serializer = self.get_serializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        reply_to_message_id = create_serializer.validated_data.get(
            "reply_to_message_id"
        )
        reply_to_instance = None
        if reply_to_message_id:
            try:
                reply_to_instance = Message.objects.get(
                    id=reply_to_message_id, conversation=conversation, is_deleted=False
                )
            except Message.DoesNotExist:
                return Response(
                    {
                        "detail": "Message being replied to not found in this conversation or has been deleted."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        message_instance = Message.objects.create(
            sender=request.user,
            conversation=conversation,
            content=create_serializer.validated_data.get("content"),
            image=create_serializer.validated_data.get("image"),
            reply_to_message=reply_to_instance,
        )
        conversation.save()

        response_serializer = MessageSerializer(
            message_instance, context={"request": request}
        )
        broadcast_data = response_serializer.data

        channel_layer = get_channel_layer()
        group_name = f"conversation_{conversation.id}"
        async_to_sync(channel_layer.group_send)(
            group_name, {"type": "chat.message", "message": broadcast_data}
        )

        for participant in conversation.participants.all():
            if participant != request.user:
                async_to_sync(channel_layer.group_send)(
                    f"user_{participant.id}",
                    {
                        "type": "new.message.notification",
                        "message": broadcast_data,
                        "conversation_id": conversation.id,
                        "sender_id": request.user.id,
                        "sender_username": request.user.get_full_name()
                        or request.user.username,
                    },
                )

        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class MessageDetailUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Message.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "PUT" or self.request.method == "PATCH":
            return MessageEditSerializer
        return MessageSerializer

    def get_object(self):
        message_id = self.kwargs.get("message_pk")
        message = get_object_or_404(Message, id=message_id)

        if message.sender != self.request.user:
            raise serializers.PermissionDenied(
                "You are not the sender of this message."
            )
        if message.is_deleted:
            raise serializers.ValidationError(
                {"detail": "Cannot modify a deleted message."}
            )

        #  Time limit for editing (24 hours)
        time_since_sent = timezone.now() - message.timestamp
        if time_since_sent.total_seconds() > 24 * 60 * 60:
            raise serializers.PermissionDenied("Edit time limit exceeded.")

        return message

    def perform_update(self, serializer):
        instance = serializer.save(is_edited=True)
        conversation = instance.conversation
        response_serializer = MessageSerializer(
            instance, context={"request": self.request}
        )

        channel_layer = get_channel_layer()
        group_name = f"conversation_{conversation.id}"
        async_to_sync(channel_layer.group_send)(
            group_name, {"type": "message.updated", "message": response_serializer.data}
        )

    def perform_destroy(self, instance):
        if instance.is_deleted:
            return

        instance.is_deleted = True
        instance.content = None
        instance.image = None
        instance.save()

        conversation = instance.conversation
        deleted_message_data = MessageSerializer(
            instance, context={"request": self.request}
        ).data

        channel_layer = get_channel_layer()
        group_name = f"conversation_{conversation.id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "message.deleted",
                "message_id": instance.id,
                "deleted_message_data": deleted_message_data,
                "conversation_id": conversation.id,
            },
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

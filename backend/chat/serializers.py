# chat/serializers.py
from rest_framework import serializers
from .models import Conversation, Message
from users.serializers import UserSerializer, LightUserSerializer


class BasicMessageInfoSerializer(serializers.ModelSerializer):
    """A light serializer for displaying replied-to message info."""

    sender = LightUserSerializer(read_only=True)
    image_url = serializers.ImageField(
        source="image", read_only=True, use_url=True, required=False
    )

    class Meta:
        model = Message
        fields = ["id", "content", "sender", "image_url", "is_deleted"]


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    image_url = serializers.ImageField(
        source="image", read_only=True, use_url=True, required=False
    )
    reply_to_message_details = BasicMessageInfoSerializer(
        source="reply_to_message", read_only=True, allow_null=True
    )

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "image_url",
            "timestamp",
            "updated_at",
            "is_edited",
            "is_deleted",
            "reply_to_message",
            "reply_to_message_details",
        ]
        read_only_fields = [
            "id",
            "sender",
            "timestamp",
            "updated_at",
            "is_edited",
            "is_deleted",
            "conversation",
            "reply_to_message_details",
        ]


class MessageCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(allow_blank=True, required=False)
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    reply_to_message_id = serializers.IntegerField(
        required=False, allow_null=True, write_only=True
    )

    class Meta:
        model = Message
        fields = ["content", "image", "reply_to_message_id"]

    def validate_reply_to_message_id(self, value):
        if value is not None:
            try:
                Message.objects.get(id=value, is_deleted=False)
            except Message.DoesNotExist:
                raise serializers.ValidationError(
                    "Message being replied to does not exist or has been deleted."
                )
        return value

    def validate(self, attrs):
        if not attrs.get("content") and not attrs.get("image"):
            raise serializers.ValidationError(
                "A message must have either text content or an image."
            )
        return attrs


class MessageEditSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = Message
        fields = ["content"]


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "participants",
            "participant_ids",
            "created_at",
            "updated_at",
            "last_message",
            "unread_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "participants",
            "last_message",
            "unread_count",
        ]

    def get_last_message(self, obj):
        latest_msg = (
            obj.messages.filter(is_deleted=False).order_by("-timestamp").first()
        )
        if latest_msg:
            return MessageSerializer(latest_msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            if hasattr(obj, f'unread_for_{user.id}'):
                 return getattr(obj, f'unread_for_{user.id}')

            return obj.unread_messages_for_user(user) if hasattr(obj, 'unread_messages_for_user') else 0
        return 0
    
    def create(self, validated_data):
        participants_qs = validated_data.pop("participants_qs", None)
        conversation = Conversation.objects.create()
        if participants_qs:
            conversation.participants.set(participants_qs)
        return conversation

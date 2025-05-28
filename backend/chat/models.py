# chat/models.py
from django.db import models
from django.conf import settings
from django.utils.html import escape


class Conversation(models.Model):
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="conversations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        participant_names = []
        for p in self.participants.all()[:3]:
            name = p.username or p.email or f"User ID {p.id}"
            participant_names.append(str(name))

        names_str = ", ".join(participant_names)
        if self.participants.count() > 3:
            names_str += "..."

        return f"Conversation ({self.id}) with: {names_str if names_str else 'No Participants'}"

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    content = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="message_images/", blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_edited = models.BooleanField(default=False)
    reply_to_message = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replies"
    )

    is_deleted = models.BooleanField(default=False)

    def __str__(self):
        sender_name = "Unknown Sender"
        if self.sender:
            sender_name = (
                self.sender.username or self.sender.email or f"User ID {self.sender.id}"
            )

        content_preview = ""
        if self.content:
            content_preview = (
                (self.content[:30] + "...") if len(self.content) > 30 else self.content
            )
        elif self.image:
            content_preview = "[Image]"
        else:
            content_preview = "[Empty Message]"

        return f"Msg by {escape(str(sender_name))} in Conv {self.conversation_id}: '{escape(content_preview)}'"

    class Meta:
        ordering = ["timestamp"]

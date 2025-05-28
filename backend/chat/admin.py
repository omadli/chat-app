# chat/admin.py
from django.contrib import admin
from django.utils.html import format_html, escape, conditional_escape
from django.urls import reverse
from django.template.defaultfilters import truncatechars, linebreaksbr
from django.db import models
from django.utils.safestring import mark_safe
from django.conf import settings
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = (
        "sender_display",
        "content_preview_inline",
        "image_thumbnail_inline",
        "timestamp",
        "is_edited",
        "reply_to_message_link_inline",
        "is_deleted",
    )
    readonly_fields = (
        "timestamp",
        "updated_at",
        "sender_display",
        "content_preview_inline",
        "image_thumbnail_inline",
        "reply_to_message_link_inline",
    )
    raw_id_fields = ("sender", "reply_to_message")
    ordering = ("timestamp",)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("sender", "reply_to_message__sender")
        )

    def sender_display(self, obj):
        if obj.sender:
            return escape(
                obj.sender.username or obj.sender.email or f"User ID {obj.sender.id}"
            )
        return "N/A"

    sender_display.short_description = "Sender"

    def content_preview_inline(self, obj):
        if obj.content:
            return truncatechars(str(obj.content), 30)
        return "Image/Empty"

    content_preview_inline.short_description = "Content"

    def image_thumbnail_inline(self, obj):
        if obj.image and hasattr(obj.image, "url") and obj.image.url:
            return format_html(
                '<img src="{}" width="30" height="30" style="object-fit: cover;" />',
                obj.image.url,
            )
        return "No"

    image_thumbnail_inline.short_description = "Img"

    def reply_to_message_link_inline(self, obj):
        if obj.reply_to_message:
            return f"Msg #{obj.reply_to_message.id}"
        return "N/A"

    reply_to_message_link_inline.short_description = "Reply To"


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "get_participants_display",
        "message_count",
        "created_at",
        "updated_at",
    )
    filter_horizontal = ("participants",)
    search_fields = ("participants__username", "participants__email", "id")
    list_filter = ("created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("participants",)}),
        ("Conversation Details", {"fields": ("created_at", "updated_at")}),
        ("Chat Messages", {"fields": ("display_chat_messages",)}),
    )
    readonly_fields = ("created_at", "updated_at", "display_chat_messages")

    class Media:
        css = {"all": ("admin/css/chat_styles.css",)}

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related("participants")
            .annotate(num_messages=models.Count("messages"))
        )

    def get_participants_display(self, obj):
        participants = obj.participants.all()
        if not participants:
            return "No participants"
        participant_names = [
            escape(p.username or p.email or f"User ID {p.id}") for p in participants[:5]
        ]
        names_str = ", ".join(participant_names)
        if participants.count() > 5:
            names_str += "..."
        return names_str

    get_participants_display.short_description = "Participants"

    def message_count(self, obj):
        return obj.num_messages

    message_count.short_description = "Messages"
    message_count.admin_order_field = "num_messages"

    def display_chat_messages(self, obj):
        messages = (
            obj.messages.all()
            .order_by("timestamp")
            .select_related("sender", "reply_to_message__sender")
        )

        participants = list(obj.participants.all()[:2])
        user_a_id = participants[0].id if len(participants) > 0 else None

        messages_html_parts = [
            f'<div class="admin-chat-container" id="conv-{obj.id}-chat-container">'
        ]

        if not messages:
            messages_html_parts.append(
                "<p style='text-align:center; color:#777;'>No messages in this conversation yet.</p>"
            )
        else:
            for msg in messages:
                sender_display_name = "Unknown Sender"
                is_user_a = False

                if msg.sender:
                    sender_display_name = escape(
                        msg.sender.username
                        or msg.sender.email
                        or f"User ID {msg.sender.id}"
                    )
                    if msg.sender.id == user_a_id:
                        is_user_a = True

                wrapper_class = "user-a" if is_user_a else "user-b"
                bubble_class = "user-a" if is_user_a else "user-b"

                messages_html_parts.append(
                    f'<div class="admin-chat-message-wrapper {wrapper_class}">'
                )
                messages_html_parts.append(
                    f'<div class="admin-chat-message {bubble_class}">'
                )

                if msg.reply_to_message:
                    reply_sender_name = "Unknown"
                    if msg.reply_to_message.sender:
                        reply_sender_name = escape(
                            msg.reply_to_message.sender.username
                            or msg.reply_to_message.sender.email
                            or f"User ID {msg.reply_to_message.sender.id}"
                        )
                    reply_content_preview = "Message"
                    if msg.reply_to_message.content:
                        reply_content_preview = truncatechars(
                            str(msg.reply_to_message.content), 40
                        )
                    elif msg.reply_to_message.image:
                        reply_content_preview = "[Image]"
                    messages_html_parts.append(
                        f'<div class="admin-message-reply-info">'
                        f'<span class="reply-sender">{reply_sender_name}:</span> '
                        f'<span class="reply-content">"{escape(reply_content_preview)}"</span>'
                        f"</div>"
                    )

                if msg.content:
                    escaped_content = escape(msg.content)
                    messages_html_parts.append(
                        f'<div class="admin-message-content"><p>{escaped_content}</p></div>'
                    )

                if msg.image and hasattr(msg.image, "url") and msg.image.url:
                    img_url_safe = escape(msg.image.url)
                    image_only_class = "image-only" if not msg.content else ""
                    messages_html_parts.append(
                        f'<div class="admin-message-image {image_only_class}"><a href="{img_url_safe}" target="_blank"><img src="{img_url_safe}" alt="Chat image"></a></div>'
                    )

                meta_parts = [msg.timestamp.strftime("%b %d, %H:%M")]
                if msg.is_edited:
                    meta_parts.append("Edited")
                meta_info_str = " • ".join(meta_parts)
                messages_html_parts.append(
                    f'<div class="admin-message-meta">{meta_info_str}</div>'
                )

                messages_html_parts.append("</div>")
                messages_html_parts.append("</div>")

        messages_html_parts.append("</div>")

        return mark_safe("".join(messages_html_parts))

    display_chat_messages.short_description = "Chat History"


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sender_link",
        "conversation_link",
        "content_preview",
        "image_thumbnail",
        "timestamp",
        "updated_at",
        "is_edited",
        "reply_to_message_link",
        "is_deleted",
    )
    list_filter = (
        "timestamp",
        "is_edited",
        "is_deleted",
        "sender",
        ("conversation", admin.RelatedOnlyFieldListFilter),
    )
    search_fields = ("content", "sender__username", "sender__email", "conversation__id")
    raw_id_fields = ("conversation", "sender", "reply_to_message")
    readonly_fields = ("timestamp", "updated_at", "image_display_detail")
    list_select_related = (
        "sender",
        "conversation",
        "reply_to_message",
        "reply_to_message__sender",
    )

    fieldsets = (
        (None, {"fields": ("conversation", "sender", "content")}),
        ("Media", {"fields": ("image", "image_display_detail")}),
        (
            "Status & Relations",
            {"fields": ("is_edited", "reply_to_message", "is_deleted")},
        ),
        (
            "Timestamps",
            {"fields": ("timestamp", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "sender", "conversation", "reply_to_message", "reply_to_message__sender"
            )
        )

    def sender_link(self, obj):
        if obj.sender:
            link = reverse("admin:users_customuser_change", args=[obj.sender.id])
            display_name = (
                obj.sender.username or obj.sender.email or f"User ID: {obj.sender.id}"
            )
            return format_html('<a href="{}">{}</a>', link, escape(str(display_name)))
        return "N/A"

    sender_link.short_description = "Sender"
    sender_link.admin_order_field = "sender__username"

    def conversation_link(self, obj):
        if obj.conversation:
            link = reverse("admin:chat_conversation_change", args=[obj.conversation.id])
            return format_html('<a href="{}">Conv. #{}</a>', link, obj.conversation.id)
        return "N/A"

    conversation_link.short_description = "Conversation"
    conversation_link.admin_order_field = "conversation__id"

    def content_preview(self, obj):
        content_text = obj.content
        if content_text:
            return truncatechars(str(content_text), 50)
        elif obj.image and hasattr(obj.image, "url") and obj.image.url:
            return "Image (No Text)"
        return "N/A"

    content_preview.short_description = "Content Preview"

    def image_thumbnail(self, obj):
        if obj.image and hasattr(obj.image, "url") and obj.image.url:
            return format_html(
                '<a href="{0}" target="_blank"><img src="{0}" width="50" height="50" style="object-fit: cover;" /></a>',
                obj.image.url,
            )
        return "No Image"

    image_thumbnail.short_description = "Image"

    def image_display_detail(self, obj):
        if obj.image and hasattr(obj.image, "url") and obj.image.url:
            return format_html(
                '<a href="{0}" target="_blank"><img src="{0}" style="max-width: 300px; max-height: 300px;" /></a>',
                obj.image.url,
            )
        return "No Image"

    image_display_detail.short_description = "Image Preview"

    def reply_to_message_link(self, obj):
        if obj.reply_to_message:
            link = reverse("admin:chat_message_change", args=[obj.reply_to_message.id])
            replied_sender_display = "Unknown"
            if obj.reply_to_message.sender:
                replied_sender_display = (
                    obj.reply_to_message.sender.username
                    or obj.reply_to_message.sender.email
                    or f"User ID: {obj.reply_to_message.sender.id}"
                )
            return format_html(
                '<a href="{}">Msg #{} (by {})</a>',
                link,
                obj.reply_to_message.id,
                escape(str(replied_sender_display)),
            )
        return "N/A"

    reply_to_message_link.short_description = "Reply To"
    reply_to_message_link.admin_order_field = "reply_to_message__id"

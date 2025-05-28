# chat/urls.py
from django.urls import path
from .views import (
    GetMessagesWithUserView,
    SendMessageToUserView,
    ConversationListCreateView,
    MessageListInConversationView,
    MessageDetailUpdateDeleteView,
)

urlpatterns = [
    path(
        "user/<int:user_id>/",
        GetMessagesWithUserView.as_view(),
        name="messages-with-user",
    ),
    path(
        "send/<int:receiver_id>/",
        SendMessageToUserView.as_view(),
        name="messages-send-to-user",
    ),
    path(
        "conversations/",
        ConversationListCreateView.as_view(),
        name="conversation-list-create",
    ),
    path(
        "conversations/<int:conversation_pk>/messages/",
        MessageListInConversationView.as_view(),
        name="conversation-messages-list-create",
    ),
    path(
        "<int:message_pk>/",
        MessageDetailUpdateDeleteView.as_view(),
        name="message-detail-update-delete",
    ),
]

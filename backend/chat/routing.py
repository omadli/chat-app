# chat/routing.py
from django.urls import re_path
from . import consumers as chat_consumers
from . import presence_consumers

websocket_urlpatterns = [
    re_path(
        r"^ws/chat/(?P<conversation_id>\w+)/$", chat_consumers.ChatConsumer.as_asgi()
    ),
    re_path(r"^ws/presence/$", presence_consumers.PresenceConsumer.as_asgi()),
]

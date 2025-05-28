import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "src.settings")


from django.core.asgi import get_asgi_application  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.auth import AuthMiddlewareStack  # noqa: E402


django_asgi_app = get_asgi_application()

import chat.routing  # noqa: E402
from users.middleware import JWTAuthMiddleware  # noqa: E402


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            AuthMiddlewareStack(URLRouter(chat.routing.websocket_urlpatterns))
        ),
    }
)

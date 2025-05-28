import jwt
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


User = get_user_model()


@database_sync_to_async
def get_user_from_jwt_token(token_key):
    try:
        token = AccessToken(token_key)
        user_id = token.get("user_id")
        if user_id:
            return User.objects.get(id=user_id)
        return AnonymousUser()
    except (
        InvalidToken,
        TokenError,
        User.DoesNotExist,
        jwt.ExpiredSignatureError,
        jwt.DecodeError,
    ):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token_key = query_params.get("token", [None])[0]

        if token_key:
            scope["user"] = await get_user_from_jwt_token(token_key)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

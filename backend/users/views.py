from django.db.models import Q
from django.conf import settings
from rest_framework.response import Response
from rest_framework import generics, status, views, permissions
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


from .models import CustomUser
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserProfileUpdateSerializer,
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


# URL: /api/auth/signup
class SignupView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={"request": request}).data

        response_data = {
            "message": "User registered successfully.",
            "user": user_data,
        }
        response_data.update(tokens)

        return Response(response_data, status=status.HTTP_201_CREATED)


# URL: /api/auth/login
@method_decorator(csrf_exempt, name="dispatch")
class LoginUserView(views.APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={"request": request}).data

        response_data = {
            "message": "Login successful.",
            "user": user_data,
        }
        response_data.update(tokens)
        return Response(response_data, status=status.HTTP_200_OK)


# URL: /api/auth/logout
class LogoutUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if "rest_framework_simplejwt.token_blacklist" in settings.INSTALLED_APPS:
            try:
                refresh_token = request.data.get("refresh")
                if refresh_token:
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                    message = "Refresh token blacklisted. Logged out successfully."
                else:
                    message = "Logged out (no refresh token provided to blacklist)."
            except Exception as e:
                message = f"Logout successful (error blacklisting token: {str(e)})."
        else:
            message = "Logged out successfully (token blacklisting not enabled)."

        return Response({"message": message}, status=status.HTTP_200_OK)


# URL: /api/auth/token/refresh/ (if you want a dedicated endpoint)
class TokenRefreshView(BaseTokenRefreshView):
    def post(self, request, *args, **kwargs):

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


# URL: /api/auth/check (GET) -> Renamed to /api/auth/me for consistency with prior Django code
class CheckAuthView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# URL: /api/users/update-profile (PUT)
class UpdateProfileView(generics.UpdateAPIView):
    serializer_class = UserProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        profile_pic_file = request.FILES.get("profile_pic")

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        if profile_pic_file:
            user.profile.profile_pic = profile_pic_file
            user.profile.save()

        return Response(UserSerializer(user, context={"request": request}).data)


# URL: /api/users (GET)
class GetUsersForSidebarView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            CustomUser.objects.exclude(id=self.request.user.id)
            .select_related("profile")
            .order_by("username")
        )

        search_query = self.request.query_params.get("search", None)

        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )
        return queryset

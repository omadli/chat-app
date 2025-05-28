from django.urls import path
from .views import (
    SignupView,
    LoginUserView,
    LogoutUserView,
    CheckAuthView,
    UpdateProfileView,
    GetUsersForSidebarView,
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

app_name = "users"

auth_urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginUserView.as_view(), name="login"),
    path("logout/", LogoutUserView.as_view(), name="logout"),
    path("check/", CheckAuthView.as_view(), name="check"),
]

user_urlpatterns = [
    path("update-profile/", UpdateProfileView.as_view(), name="update-profile"),
    path("", GetUsersForSidebarView.as_view(), name="list-sidebar"),
]

urlpatterns = auth_urlpatterns + user_urlpatterns

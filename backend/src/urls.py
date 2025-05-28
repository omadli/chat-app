from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from debug_toolbar.toolbar import debug_toolbar_urls
import users.urls


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include(users.urls.auth_urlpatterns)),
    path("api/users/", include(users.urls.user_urlpatterns)),
    path("api/messages/", include("chat.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += debug_toolbar_urls()

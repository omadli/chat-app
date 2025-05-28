from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html, escape
from django.urls import reverse
from django import forms
from django.db import models
from django.utils.translation import gettext_lazy as _
from .models import CustomUser, UserProfile


class UserProfileInlineForm(forms.ModelForm):
    bio = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3}), required=False, max_length=255
    )

    class Meta:
        model = UserProfile
        fields = ("profile_pic", "phone_number", "bio")


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    form = UserProfileInlineForm
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"
    fields = ("profile_pic", "get_profile_pic_preview_inline", "phone_number", "bio")
    readonly_fields = ("get_profile_pic_preview_inline",)

    def get_profile_pic_preview_inline(self, obj):
        if obj.pk and obj.profile_pic and hasattr(obj.profile_pic, "url"):
            return format_html(
                '<img src="{}" style="max-height: 100px; max-width: 100px; margin-top: 5px;" />',
                obj.profile_pic.url,
            )
        return "No image"

    get_profile_pic_preview_inline.short_description = "Current Picture"


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = (
        "email",
        "username",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
        "get_profile_pic_thumbnail",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("email", "username", "first_name", "last_name")
    ordering = ("email",)

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (_("Personal info"), {"fields": ("first_name", "last_name", "username")}),
    )
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name", "username")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    def get_profile_pic_thumbnail(self, obj):
        if (
            hasattr(obj, "profile")
            and obj.profile.profile_pic
            and hasattr(obj.profile.profile_pic, "url")
        ):
            return format_html(
                '<img src="{}" width="40" height="40" style="border-radius: 50%; object-fit: cover;" />',
                obj.profile.profile_pic.url,
            )
        return "No Pic"

    get_profile_pic_thumbnail.short_description = "Avatar"

    def get_inline_instances(self, request, obj=None):
        if not obj:
            return []
        return super().get_inline_instances(request, obj)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user_link", "profile_pic_thumbnail", "phone_number", "bio_summary")
    search_fields = ("user__email", "user__username", "phone_number", "bio")
    raw_id_fields = ("user",)
    readonly_fields = ("user_link_readonly", "profile_pic_display")

    fieldsets = (
        ("User Information", {"fields": ("user_link_readonly",)}),
        (
            "Profile Details",
            {"fields": ("profile_pic", "profile_pic_display", "phone_number", "bio")},
        ),
    )

    formfield_overrides = {
        models.CharField: {"widget": forms.Textarea(attrs={"rows": 4, "cols": 40})},
    }

    def user_link(self, obj):
        if obj.user:
            link = reverse("admin:users_customuser_change", args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', link, escape(obj.user.email))
        return "N/A"

    user_link.short_description = "User"
    user_link.admin_order_field = "user__email"

    def user_link_readonly(self, obj):
        return self.user_link(obj)

    user_link_readonly.short_description = "User"

    def profile_pic_thumbnail(self, obj):
        if obj.profile_pic and hasattr(obj.profile_pic, "url"):
            return format_html(
                '<img src="{0}" width="50" height="50" style="object-fit: cover;" />',
                obj.profile_pic.url,
            )
        return "No Image"

    profile_pic_thumbnail.short_description = "Avatar"

    def profile_pic_display(self, obj):
        if obj.profile_pic and hasattr(obj.profile_pic, "url"):
            return format_html(
                '<a href="{0}" target="_blank"><img src="{0}" style="max-width: 300px; max-height: 300px;" /></a>',
                obj.profile_pic.url,
            )
        return "No Image"

    profile_pic_display.short_description = "Image Preview"

    def bio_summary(self, obj):
        if obj.bio:
            return obj.bio[:50] + "..." if len(obj.bio) > 50 else obj.bio
        return "(No Bio)"

    bio_summary.short_description = "Bio Preview"

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj:
            if "user" in form.base_fields:
                form.base_fields["user"].disabled = True
                form.base_fields["user"].widget.can_add_related = False
                form.base_fields["user"].widget.can_change_related = False
                form.base_fields["user"].widget.can_delete_related = False
        return form

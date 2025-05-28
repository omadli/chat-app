from .models import CustomUser, UserProfile
from django.contrib.auth import authenticate, password_validation
from rest_framework import serializers
from django.conf import settings


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["profile_pic", "phone_number", "bio"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    profile_pic_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "profile",
            "profile_pic_url",
            "is_active",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "profile_pic_url",
            "full_name",
            "is_active",
            "date_joined",
        ]
        extra_kwargs = {
            "username": {"required": False, "allow_null": True, "allow_blank": True}
        }

    def get_profile_pic_url(self, obj):
        request = self.context.get("request")
        if (
            obj.profile
            and obj.profile.profile_pic
            and hasattr(obj.profile.profile_pic, "url")
        ):
            if request:
                return request.build_absolute_uri(obj.profile.profile_pic.url)
            return obj.profile.profile_pic.url
        default_pic_path = "profile_pics/default_avatar.png"
        if request:
            return request.build_absolute_uri(f"/media/{default_pic_path}")
        return f"/media/{default_pic_path}"

    def get_full_name(self, obj):
        return obj.get_full_name()


class LightUserSerializer(serializers.ModelSerializer):
    profile_pic_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["id", "username", "full_name", "profile_pic_url"]

    def get_profile_pic_url(self, obj):
        request = self.context.get("request")
        profile_pic = None
        if (
            hasattr(obj, "profile")
            and obj.profile
            and obj.profile.profile_pic
            and hasattr(obj.profile.profile_pic, "url")
        ):
            profile_pic = obj.profile.profile_pic.url

        if profile_pic:
            if request:
                return request.build_absolute_uri(profile_pic)
            return profile_pic
        default_pic_path = "profile_pics/default_avatar.png"
        if request:
            return request.build_absolute_uri(
                f'{settings.MEDIA_URL.rstrip("/")}/{default_pic_path.lstrip("/")}'
            )
        return f'{settings.MEDIA_URL.rstrip("/")}/{default_pic_path.lstrip("/")}'

    def get_full_name(self, obj):
        return obj.get_full_name()


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=True, max_length=150)
    last_name = serializers.CharField(required=True, max_length=150)
    password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        label="Confirm password",
    )
    username = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=150
    )

    phone_number = serializers.CharField(
        required=False, allow_blank=True, source="profile.phone_number"
    )
    bio = serializers.CharField(required=False, allow_blank=True, source="profile.bio")

    class Meta:
        model = CustomUser
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "password",
            "password2",
            "phone_number",
            "bio",
        ]

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return value

    def validate_username(self, value):
        if value and CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        try:
            password_validation.validate_password(attrs["password"])
        except serializers.ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs

    def create(self, validated_data):
        profile_phone_number = validated_data.pop("profile.phone_number", None)
        profile_bio = validated_data.pop("profile.bio", None)
        password = validated_data.pop("password")
        validated_data.pop("password2")

        user = CustomUser.objects.create_user(
            email=validated_data.get("email"),
            password=password,
            username=validated_data.get("username", None),
            first_name=validated_data.get("first_name"),
            last_name=validated_data.get("last_name"),
        )

        if user.profile:
            if profile_phone_number is not None:
                user.profile.phone_number = profile_phone_number
            if profile_bio is not None:
                user.profile.bio = profile_bio
            user.profile.save()

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        if email and password:
            user = authenticate(
                request=self.context.get("request"), email=email, password=password
            )
            if not user:
                raise serializers.ValidationError(
                    "Incorrect credentials. Please check your email and password.",
                    code="authorization",
                )
            if not user.is_active:
                raise serializers.ValidationError(
                    "User account is disabled.", code="authorization"
                )
        else:
            raise serializers.ValidationError(
                "Must include 'email' and 'password'.", code="authorization"
            )

        data["user"] = user
        return data


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(required=False, max_length=150, allow_blank=True)
    last_name = serializers.CharField(required=False, max_length=150, allow_blank=True)
    username = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=150
    )

    phone_number = serializers.CharField(
        source="profile.phone_number", required=False, allow_blank=True
    )
    bio = serializers.CharField(required=False, allow_blank=True, max_length=255)
    profile_pic = serializers.ImageField(source="profile.profile_pic", required=False)

    new_profile_pic = serializers.ImageField(required=False, write_only=True)

    current_password = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
        allow_blank=True,
    )
    new_password = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
        allow_blank=True,
    )
    confirm_new_password = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
        allow_blank=True,
    )

    class Meta:
        model = CustomUser
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "bio",
            "profile_pic",
            "new_profile_pic",
            "current_password",
            "new_password",
            "confirm_new_password",
        ]
        extra_kwargs = {
            "username": {"required": False, "allow_null": True, "allow_blank": True}
        }

    def validate_email(self, value):
        user = self.context["request"].user
        if CustomUser.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate_username(self, value):
        user = self.context["request"].user
        if (
            value
            and CustomUser.objects.exclude(pk=user.pk).filter(username=value).exists()
        ):
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        confirm_new_password = attrs.get("confirm_new_password")
        current_password = attrs.get("current_password")
        user = self.context["request"].user

        if new_password or confirm_new_password:
            if not current_password:
                raise serializers.ValidationError(
                    {
                        "current_password": "Current password is required to change password."
                    }
                )
            if not user.check_password(current_password):
                raise serializers.ValidationError(
                    {"current_password": "Current password is not correct."}
                )
            if not new_password:
                raise serializers.ValidationError(
                    {
                        "new_password": "New password cannot be empty if attempting change."
                    }
                )
            if new_password != confirm_new_password:
                raise serializers.ValidationError(
                    {"new_password": "New passwords do not match."}
                )
            try:
                password_validation.validate_password(new_password, user=user)
            except serializers.ValidationError as e:
                raise serializers.ValidationError({"new_password": list(e.messages)})
        elif current_password and not (new_password or confirm_new_password):
            pass
        return attrs

    def update(self, instance, validated_data):
        instance.username = validated_data.get("username", instance.username)
        if "username" in validated_data and validated_data["username"] == "":
            instance.username = None
        instance.email = validated_data.get("email", instance.email)
        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)

        new_password = validated_data.get("new_password")
        if new_password:
            instance.set_password(new_password)
        instance.save()

        profile = instance.profile
        profile_fields_updated = False

        profile.bio = validated_data.get("bio", profile.bio)

        if "profile.phone_number" in validated_data:
            profile.phone_number = validated_data.get("profile.phone_number")
            profile_fields_updated = True

        if "profile.bio" in validated_data:
            profile.bio = validated_data.get("profile.bio")
            profile_fields_updated = True

        new_pic = validated_data.get("new_profile_pic")
        if new_pic:
            profile.profile_pic = new_pic
            profile_fields_updated = True

        if profile_fields_updated:
            profile.save()

        return instance

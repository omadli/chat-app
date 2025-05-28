# users/tests.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
from .models import UserProfile

CustomUser = get_user_model()


class CustomUserModelTests(TestCase):

    def test_create_user(self):
        """Test creating a regular user with email and password."""
        user = CustomUser.objects.create_user(
            email="normal@user.com",
            password="foo",
            first_name="Normal",
            last_name="User",
            username="normaluser",
        )
        self.assertEqual(user.email, "normal@user.com")
        self.assertEqual(user.first_name, "Normal")
        self.assertEqual(user.username, "normaluser")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("foo"))
        self.assertIsNotNone(user.profile)

    def test_create_user_without_email_raises_value_error(self):
        """Test that creating a user without an email raises a ValueError."""
        with self.assertRaises(ValueError):
            CustomUser.objects.create_user(email="", password="foo")

    def test_create_superuser(self):
        """Test creating a superuser."""
        admin_user = CustomUser.objects.create_superuser(
            email="super@user.com",
            password="foo",
            first_name="Super",
        )
        self.assertEqual(admin_user.email, "super@user.com")
        self.assertEqual(admin_user.first_name, "Super")
        self.assertTrue(admin_user.is_active)
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)
        self.assertTrue(admin_user.check_password("foo"))
        if not hasattr(admin_user, "username") or not admin_user.username:
            self.assertEqual(admin_user.username, "super_admin")
        self.assertIsNotNone(admin_user.profile)

    def test_create_superuser_without_is_staff_raises_value_error(self):
        """Test that superuser must have is_staff=True."""
        with self.assertRaises(ValueError):
            CustomUser.objects.create_superuser(
                email="super2@user.com", password="foo", is_staff=False
            )

    def test_create_superuser_without_is_superuser_raises_value_error(self):
        """Test that superuser must have is_superuser=True."""
        with self.assertRaises(ValueError):
            CustomUser.objects.create_superuser(
                email="super3@user.com", password="foo", is_superuser=False
            )

    def test_user_email_is_unique(self):
        """Test that email addresses must be unique."""
        CustomUser.objects.create_user(email="unique@test.com", password="password123")
        with self.assertRaises(IntegrityError):
            CustomUser.objects.create_user(
                email="unique@test.com", password="password456"
            )

    def test_user_str_representation(self):
        """Test the string representation of the CustomUser model."""
        user = CustomUser.objects.create_user(
            email="strrep@test.com", password="password123"
        )
        self.assertEqual(str(user), "strrep@test.com")

    def test_username_can_be_null(self):
        """Test if username field can be null if allowed by model."""
        user = CustomUser.objects.create_user(
            email="no_username@test.com",
            password="password123",
            first_name="NoUsername",
            username=None,
        )
        self.assertIsNone(user.username)
        self.assertEqual(user.email, "no_username@test.com")


class UserProfileModelTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = CustomUser.objects.create_user(
            email="profiletest@user.com", password="password123", first_name="Profile"
        )
        # UserProfile should be created by the signal

    def test_profile_created_on_user_creation(self):
        """Test that a UserProfile is automatically created when a CustomUser is created."""
        self.assertTrue(hasattr(self.user, "profile"))
        self.assertIsInstance(self.user.profile, UserProfile)
        self.assertEqual(self.user.profile.user, self.user)

    def test_profile_default_pic(self):
        """Test the default profile picture."""
        self.assertEqual(
            self.user.profile.profile_pic.name, "profile_pics/default_avatar.png"
        )

    def test_profile_fields_can_be_updated(self):
        """Test updating UserProfile fields."""
        profile = self.user.profile
        profile.phone_number = "123-456-7890"
        profile.bio = "This is a test bio."
        profile.save()

        updated_profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(updated_profile.phone_number, "123-456-7890")
        self.assertEqual(updated_profile.bio, "This is a test bio.")

    def test_profile_bio_shortened(self):
        """Test the bio_shortened method."""
        profile = self.user.profile
        profile.bio = (
            "This is a very long bio designed to test the shortening functionality."
        )
        profile.save()
        expected_short_bio = "This is a very long bio design" + "..."
        self.assertEqual(profile.bio_shortened(), expected_short_bio)

        profile.bio = "Short bio."
        profile.save()
        self.assertEqual(profile.bio_shortened(), "Short bio.")

        profile.bio = None
        profile.save()
        self.assertEqual(profile.bio_shortened(), "No bio")

    def test_profile_str_representation(self):
        """Test the string representation of the UserProfile model."""
        self.assertEqual(str(self.user.profile), f"Profile_for_User_ID_{self.user.id}")

    def test_profile_user_on_delete_cascade(self):
        """Test that deleting a user also deletes their profile."""
        user_id = self.user.id
        profile_id = self.user.profile.id

        self.assertTrue(CustomUser.objects.filter(id=user_id).exists())
        self.assertTrue(UserProfile.objects.filter(id=profile_id).exists())

        self.user.delete()

        self.assertFalse(CustomUser.objects.filter(id=user_id).exists())
        self.assertFalse(UserProfile.objects.filter(id=profile_id).exists())

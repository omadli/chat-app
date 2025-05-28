# chat/tests.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from freezegun import freeze_time
from .models import Conversation, Message

CustomUser = get_user_model()


class ChatModelTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user1 = CustomUser.objects.create_user(
            email="user1@chat.com", password="pw1", first_name="UserA", username="usera"
        )
        cls.user2 = CustomUser.objects.create_user(
            email="user2@chat.com", password="pw2", first_name="UserB", username="userb"
        )
        cls.user3 = CustomUser.objects.create_user(
            email="user3@chat.com", password="pw3", first_name="UserC", username="userc"
        )

    def setUp(self):
        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.user1, self.user2)

    def test_create_conversation(self):
        """Test creating a conversation and adding participants."""
        self.assertEqual(self.conversation.participants.count(), 2)
        self.assertIn(self.user1, self.conversation.participants.all())
        self.assertIn(self.user2, self.conversation.participants.all())
        self.assertIsNotNone(self.conversation.created_at)
        self.assertIsNotNone(self.conversation.updated_at)

    def test_conversation_str_representation(self):
        """Test the string representation of the Conversation model."""
        expected_str_part1 = f"Conversation ({self.conversation.id}) with: "
        str_repr = str(self.conversation)
        self.assertTrue(expected_str_part1 in str_repr)
        self.assertTrue(self.user1.username in str_repr or self.user1.email in str_repr)
        self.assertTrue(self.user2.username in str_repr or self.user2.email in str_repr)

        conv_no_participants = Conversation.objects.create()
        self.assertIn("No Participants", str(conv_no_participants))

    def test_conversation_ordering(self):
        """Test that conversations are ordered by 'updated_at' descending."""
        conv1 = Conversation.objects.create()
        conv1.participants.add(self.user1)
        conv1.save()

        self.conversation.save()

        conversations = Conversation.objects.all()
        self.assertEqual(conversations.first().id, self.conversation.id)

    def test_create_message(self):
        """Test creating a message in a conversation."""
        message = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Hello User2!"
        )
        self.assertEqual(message.conversation, self.conversation)
        self.assertEqual(message.sender, self.user1)
        self.assertEqual(message.content, "Hello User2!")
        self.assertIsNone(message.image.name)
        self.assertIsNotNone(message.timestamp)
        self.assertIsNotNone(message.updated_at)
        self.assertFalse(message.is_edited)
        self.assertFalse(message.is_deleted)
        self.assertIsNone(message.reply_to_message)

    def test_create_message_with_image(self):
        """Test creating a message with an image (mocking image file)."""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            image="message_images/test_image.jpg",
        )
        self.assertEqual(message.image.name, "message_images/test_image.jpg")

    def test_message_str_representation(self):
        """Test the string representation of the Message model."""
        message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content="Test str representation",
        )
        expected_str_part = f"Msg by {self.user1.username} in Conv {self.conversation.id}: '{message.content[:30]}"
        self.assertTrue(expected_str_part in str(message))

        message_img = Message.objects.create(
            conversation=self.conversation, sender=self.user1, image="img.jpg"
        )
        self.assertIn("[Image]", str(message_img))

    def test_message_reply(self):
        """Test replying to a message."""
        original_message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content="This is the original message.",
        )
        reply_message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user2,
            content="This is a reply.",
            reply_to_message=original_message,
        )
        self.assertEqual(reply_message.reply_to_message, original_message)
        self.assertIn(reply_message, original_message.replies.all())

    def test_message_editing_and_deletion_flags(self):
        """Test is_edited and is_deleted flags."""
        message = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Initial content"
        )
        self.assertFalse(message.is_edited)
        self.assertFalse(message.is_deleted)

        message.content = "Edited content"
        message.is_edited = True
        message.save()
        self.assertTrue(message.is_edited)

        message.is_deleted = True
        message.save()
        self.assertTrue(message.is_deleted)

    @freeze_time("2024-01-01 12:00:00")
    def test_message_ordering(self):
        """Test that messages are ordered by 'timestamp' ascending."""
        msg1 = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="First"
        )

        with freeze_time("2024-01-01 12:00:01"):
            msg2 = Message.objects.create(
                conversation=self.conversation, sender=self.user2, content="Second"
            )

        messages_in_conv = self.conversation.messages.all().order_by("timestamp")

        self.assertEqual(messages_in_conv.first(), msg1)
        self.assertEqual(messages_in_conv.last(), msg2)

    def test_message_on_delete_sender_cascade(self):
        """Test that if a sender is deleted, their messages are also deleted (CASCADE)."""
        temp_user = CustomUser.objects.create_user(email="temp@del.com", password="pw")
        message = Message.objects.create(
            conversation=self.conversation, sender=temp_user, content="To be deleted"
        )
        message_id = message.id

        self.assertTrue(Message.objects.filter(id=message_id).exists())
        temp_user.delete()
        self.assertFalse(Message.objects.filter(id=message_id).exists())

    def test_message_on_delete_conversation_cascade(self):
        """Test that if a conversation is deleted, its messages are also deleted (CASCADE)."""
        message = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Part of conv"
        )
        message_id = message.id

        self.assertTrue(Message.objects.filter(id=message_id).exists())
        self.conversation.delete()
        self.assertFalse(Message.objects.filter(id=message_id).exists())

    def test_reply_to_message_on_delete_set_null(self):
        """Test that if a replied-to message is deleted, reply_to_message field becomes NULL."""
        original_msg = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Original"
        )
        reply_msg = Message.objects.create(
            conversation=self.conversation,
            sender=self.user2,
            content="Reply to original",
            reply_to_message=original_msg,
        )
        self.assertEqual(reply_msg.reply_to_message, original_msg)

        original_msg.delete()
        reply_msg.refresh_from_db()

        self.assertIsNone(reply_msg.reply_to_message)

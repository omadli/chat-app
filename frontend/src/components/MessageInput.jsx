import { useEffect, useRef, useState } from "react";
import {
  Check,
  CornerUpLeft,
  Edit3,
  Image,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    selectedConversation,
    pendingChatUser,
    sendMessage,
    editMessage,
    isSendingMessage,
    replyingToMessage,
    clearReplyingTo,
    editingMessage,
    clearEditingMessage,
  } = useChatStore();
  const { authUser, sendTypingStatus } = useAuthStore();

  const canInteract = !!(selectedConversation || pendingChatUser);
  const activeConversationIdForTyping = selectedConversation?.id || null;

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || "");
      setImageFile(null);
      setImagePreview(null);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (!editingMessage && !replyingToMessage) {
      setText("");
      removeImage();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [
    selectedConversation,
    pendingChatUser,
    editingMessage,
    replyingToMessage,
  ]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    if (canInteract && activeConversationIdForTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (newText.trim() !== "") {
        sendTypingStatus(activeConversationIdForTyping, true);
        typingTimeoutRef.current = setTimeout(() => {
          if (activeConversationIdForTyping) {
            sendTypingStatus(activeConversationIdForTyping, false);
          }
        }, 2500);
      } else {
        if (activeConversationIdForTyping) {
          sendTypingStatus(activeConversationIdForTyping, false);
        }
      }
    }
  };

  const handleImageChange = (e) => {
    if (editingMessage) {
      toast.error("Cannot change image while editing a message.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const file = e.target.files[0];
    if (!file) {
      removeImage();
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      removeImage();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB.");
      removeImage();
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!authUser || !canInteract) return;

    if (activeConversationIdForTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingStatus(activeConversationIdForTyping, false);
    }

    if (editingMessage) {
      if (!text.trim()) {
        toast.error("Edited message cannot be empty.");
        return;
      }
      await editMessage(editingMessage.id, text);
      setText("");
    } else {
      if (!text.trim() && !imageFile && !replyingToMessage?.id) {
        toast.error("Message cannot be empty.");
        return;
      }
      await sendMessage(text, imageFile);
      setText("");
      removeImage();
    }
  };

  const cancelReplyOrEdit = () => {
    clearReplyingTo();
    clearEditingMessage();
    setText("");
    removeImage();
  };

  return (
    <div className="p-3 sm:p-4 border-t border-base-300 bg-base-100">
      {(replyingToMessage || editingMessage) && (
        <div className="mb-2 p-2 pr-8 bg-base-200 rounded-lg text-sm relative animate-fade-in-fast">
          <div className="flex items-center gap-2">
            {editingMessage ? (
              <Edit3 className="w-4 h-4 text-secondary flex-shrink-0" />
            ) : (
              <CornerUpLeft className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-xs">
                {editingMessage
                  ? "Editing message"
                  : `Replying to ${
                      replyingToMessage?.sender?.id === authUser?.id
                        ? "yourself"
                        : replyingToMessage?.sender?.full_name ||
                          replyingToMessage?.sender?.username ||
                          "User"
                    }`}
              </p>
              <p className="text-xs text-base-content/70 line-clamp-1">
                {editingMessage
                  ? editingMessage.content
                  : replyingToMessage?.content ||
                    (replyingToMessage?.image_url
                      ? "Image"
                      : "[Original message]")}
              </p>
            </div>
          </div>
          <button
            onClick={cancelReplyOrEdit}
            className="absolute top-1 right-1 btn btn-ghost btn-xs btn-circle"
            title={editingMessage ? "Cancel edit" : "Cancel reply"}
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      {imagePreview && !editingMessage && (
        <div className="mb-2 p-2 bg-base-200 rounded-lg inline-block relative">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-[100px] max-h-[100px] object-cover rounded border border-base-300"
          />
          <button
            onClick={removeImage}
            type="button"
            title="Remove image"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-error-content flex items-center justify-center shadow-md hover:bg-error-focus"
          >
            <XCircle className="size-3" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleFormSubmit}
        className="flex items-center gap-2 sm:gap-3"
      >
        <button
          type="button"
          title="Attach image"
          className={`btn btn-ghost btn-circle btn-sm sm:btn-md ${
            imagePreview ? "text-primary" : "text-base-content/70"
          }`}
          onClick={() => fileInputRef.current?.click()}
          disabled={!canInteract || isSendingMessage || !!editingMessage}
        >
          <Image size={20} />
        </button>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageChange}
          disabled={!!editingMessage}
        />

        <input
          type="text"
          placeholder={
            canInteract
              ? editingMessage
                ? "Edit your message..."
                : "Type a message..."
              : "Select a chat to type"
          }
          className="flex-1 input input-bordered rounded-lg input-sm sm:input-md focus:ring-primary focus:border-primary"
          value={text}
          onChange={handleTextChange}
          disabled={!canInteract || isSendingMessage}
        />
        <button
          type="submit"
          title={editingMessage ? "Save changes" : "Send message"}
          className="btn btn-primary btn-sm sm:btn-md btn-circle"
          disabled={
            (!text.trim() && !imageFile && !editingMessage) ||
            !canInteract ||
            isSendingMessage
          }
        >
          {isSendingMessage ? (
            <Loader2 className="animate-spin size-5" />
          ) : editingMessage ? (
            <Check size={20} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
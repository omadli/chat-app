// src/components/MessageItem.jsx
import { useEffect, useRef, useState } from "react";
import {
  CornerDownLeft,
  CornerUpLeft,
  Edit2,
  Image as ImageIcon,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { formatMessageTime } from "../lib/utils";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const MessageItem = ({ message, onImageClick }) => {
  const { authUser } = useAuthStore();
  const { setReplyingTo, setEditingMessage, deleteMessage } = useChatStore();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const contextMenuRef = useRef(null);
  const messageItemRef = useRef(null);
  const moreOptionsButtonRef = useRef(null);

  // For debugging:
  // if (message && message.content) {
  //   console.log(`Message ID: ${message.id}, Content: "${message.content}"`);
  // }


  if (!message || !message.sender) {
    return (
      <div className="chat chat-start">
        <div className="chat-bubble bg-error/20 text-error-content p-2">
          Error: Message data incomplete.
        </div>
      </div>
    );
  }

  const isSenderAuthUser = message.sender.id === authUser?.id;
  const canEditOrDelete = isSenderAuthUser && !message.is_deleted;

  const openContextMenu = (e) => {
    if (e) e.preventDefault();
    if (!message.is_deleted) {
      setIsContextMenuOpen(true);
    }
  };

  const handleMoreOptionsButtonClick = (e) => {
    e.stopPropagation();
    if (!message.is_deleted) {
      setIsContextMenuOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isContextMenuOpen &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target) &&
        moreOptionsButtonRef.current &&
        !moreOptionsButtonRef.current.contains(event.target)
      ) {
        setIsContextMenuOpen(false);
      }
    };

    if (isContextMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isContextMenuOpen]);

  const handleReply = () => {
    if (message.is_deleted) {
      toast.error("Cannot reply to a deleted message.");
      setIsContextMenuOpen(false);
      return;
    }
    setReplyingTo(message);
    setIsContextMenuOpen(false);
  };

  const handleEdit = () => {
    if (!canEditOrDelete) {
      toast.error("You can only edit your own messages.");
      setIsContextMenuOpen(false);
      return;
    }
    setEditingMessage(message);
    setIsContextMenuOpen(false);
  };

  const handleDelete = () => {
    if (!canEditOrDelete) {
      toast.error("You can only delete your own messages.");
      setIsContextMenuOpen(false);
      return;
    }
    if (window.confirm("Are you sure you want to delete this message?")) {
      deleteMessage(message.id);
    }
    setIsContextMenuOpen(false);
  };

  const handleDoubleClick = () => {
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    } else if (document.selection) {
      document.selection.empty();
    }
    if (!message.is_deleted) {
      handleReply();
    }
  };

  const scrollToRepliedMessage = (messageId) => {
    const element = document.getElementById(`message-item-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlight-message");
      setTimeout(() => element.classList.remove("highlight-message"), 2000);
    } else {
      toast.error(
        "Original message not found in current view. It might be further up."
      );
    }
  };

  const getRepliedMessageContentPreview = (repliedMsg) => {
    if (!repliedMsg) return "[Error: Replied message data missing]";
    if (repliedMsg.is_deleted) return "[Original message was deleted]";
    if (repliedMsg.content) return repliedMsg.content;
    if (repliedMsg.image_url) return "Sent an image";
    return "[Original message content]";
  };

  return (
    <div
      ref={messageItemRef}
      id={`message-item-${message.id}`}
      className={`chat ${
        isSenderAuthUser ? "chat-end" : "chat-start"
      } group relative py-1.5 px-2 sm:px-0`}
      onContextMenu={openContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div className="chat-image avatar">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-base-300">
          <img
            src={message.sender.profile_pic_url || "/avatar.png"}
            alt="profile pic"
          />
        </div>
      </div>
      <div className="flex flex-col max-w-[calc(100%-3rem)] sm:max-w-[calc(100%-3.5rem)] relative">
        <div className="chat-header text-xs opacity-70 mb-0.5 flex items-center gap-1.5">
          {!isSenderAuthUser && (
            <span className="font-medium truncate">
              {message.sender.full_name || message.sender.username || "User"}
            </span>
          )}
          <time className="text-base-content/60 flex-shrink-0">
            {formatMessageTime(message.timestamp)}
          </time>
          {message.is_edited && !message.is_deleted && (
            <span className="italic text-xs text-base-content/50">
              (edited)
            </span>
          )}
        </div>

        <div
          className={`chat-bubble ${
            isSenderAuthUser ? "chat-bubble-primary" : "bg-base-200 text-base-content"
          } flex flex-col relative shadow-sm`}
        >
          {message.reply_to_message_details && (
            <div
              className={`mb-1.5 p-1.5 sm:p-2 border-l-2 rounded-sm
                        ${isSenderAuthUser ? "border-primary-content/50 bg-primary/10" : "border-base-content/30 bg-base-300/30"}
                        ${message.reply_to_message_details.is_deleted ? "opacity-70" : "cursor-pointer hover:bg-opacity-50"}`}
              onClick={() =>
                !message.reply_to_message_details.is_deleted &&
                scrollToRepliedMessage(message.reply_to_message_details.id)
              }
              title={
                message.reply_to_message_details.is_deleted
                  ? "Original message deleted"
                  : "Go to original message"
              }
            >
              <div className="flex items-center gap-1 mb-0.5">
                <CornerDownLeft
                  className={`w-3 h-3 flex-shrink-0 ${isSenderAuthUser ? "text-primary-content/70" : "text-base-content/70"}`}
                />
                <span
                  className={`text-xs font-semibold truncate ${isSenderAuthUser ? "text-primary-content/90" : "text-base-content/90"}`}
                >
                  {message.reply_to_message_details.sender?.id === authUser?.id
                    ? "You"
                    : message.reply_to_message_details.sender?.full_name ||
                      message.reply_to_message_details.sender?.username ||
                      "User"}
                </span>
              </div>
              {message.reply_to_message_details.image_url &&
                !message.reply_to_message_details.is_deleted && (
                  <div
                    className={`flex items-center gap-1 text-xs italic my-0.5 ${isSenderAuthUser ? "text-primary-content/70" : "text-base-content/70"}`}
                  >
                    <ImageIcon size={12} className="flex-shrink-0" />
                    Image
                  </div>
                )}
              <p
                className={`text-xs line-clamp-2 ${
                  message.reply_to_message_details.is_deleted ? "italic" : ""
                }`}
              >
                {getRepliedMessageContentPreview(
                  message.reply_to_message_details
                )}
              </p>
            </div>
          )}

          {message.is_deleted ? (
            <p className="italic text-sm text-base-content/70 p-2">
              [Message deleted]
            </p>
          ) : (
            <div className="p-2"> {/* Inner padding for content */}
              {message.image_url && (
                <img
                  src={message.image_url}
                  alt="Attachment"
                  className="w-full max-w-[200px] sm:max-w-[250px] rounded-md mb-1 cursor-pointer"
                  onClick={() =>
                    onImageClick && onImageClick(message.image_url)
                  }
                />
              )}
              {((message.content !== null &&
                message.content !== undefined) ||
              !message.image_url) ? (
                <p className="whitespace-normal text-sm">
                  {message.content}
                </p>
              ) : null}
            </div>
          )}

          {!message.is_deleted && (
            <button
              ref={moreOptionsButtonRef}
              onClick={handleMoreOptionsButtonClick}
              className={`absolute -top-2 p-1 rounded-full bg-base-300 text-base-content/60 hover:bg-base-content/20
                           opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150
                           z-10
                           ${isSenderAuthUser ? " -right-2 " : " -left-2 "}`}
              aria-label="Message options"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>

        {isContextMenuOpen && !message.is_deleted && (
          <div
            ref={contextMenuRef}
            className={`absolute z-30 w-44 bg-base-100 rounded-lg shadow-xl border border-base-300 py-1.5 text-sm
                       ${isSenderAuthUser ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}
            style={
              isSenderAuthUser
                ? { top: "0.5rem", right: "calc(100% + 0.25rem)" }
                : { top: "0.5rem", left: "calc(100% + 0.25rem)" }
            }
          >
            <button
              onClick={handleReply}
              className="w-full text-left px-3.5 py-2 hover:bg-base-200 flex items-center gap-2.5 transition-colors rounded-md"
            >
              <CornerUpLeft size={15} className="text-base-content/70" /> Reply
            </button>
            {canEditOrDelete && (
              <>
                <button
                  onClick={handleEdit}
                  className="w-full text-left px-3.5 py-2 hover:bg-base-200 flex items-center gap-2.5 transition-colors rounded-md"
                >
                  <Edit2 size={15} className="text-base-content/70" /> Edit
                </button>
                <div className="my-1 border-t border-base-300/70"></div>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3.5 py-2 hover:bg-error/10 text-error flex items-center gap-2.5 transition-colors rounded-md"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
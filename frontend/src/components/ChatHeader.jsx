import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

import Modal from "./Modal";
import UserProfileModal from "./UserProfileModal";

const ChatHeader = () => {
  const {
    selectedConversation,
    pendingChatUser,
    clearChatContext,
    typingUsersByConversation,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const [typingDisplay, setTypingDisplay] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  let displayUser = null;
  let isPending = false;
  let currentConvoIdForTypingDisplay = null;

  if (pendingChatUser && !selectedConversation) {
    displayUser = pendingChatUser;
    isPending = true;
  } else if (selectedConversation) {
    displayUser = selectedConversation.participants?.find(
      (p) => p.id !== authUser?.id
    );
    isPending = false;
    currentConvoIdForTypingDisplay = String(selectedConversation.id);
  }

  useEffect(() => {
    if (
      currentConvoIdForTypingDisplay &&
      typingUsersByConversation[currentConvoIdForTypingDisplay] &&
      authUser
    ) {
      const typersInCurrentConvo =
        typingUsersByConversation[currentConvoIdForTypingDisplay];

      const otherUserTypingUsernames = Object.entries(typersInCurrentConvo)
        .filter(([userId, _]) => Number(userId) !== authUser.id)
        .map(([_, username]) => username);

      if (otherUserTypingUsernames.length === 1) {
        setTypingDisplay(`${otherUserTypingUsernames[0]} is typing...`);
      } else if (otherUserTypingUsernames.length > 1) {
        const displayNames = otherUserTypingUsernames.slice(0, 2).join(" and ");
        if (otherUserTypingUsernames.length > 2) {
          setTypingDisplay(`${displayNames} and others are typing...`);
        } else {
          setTypingDisplay(`${displayNames} are typing...`);
        }
      } else {
        setTypingDisplay("");
      }
    } else {
      setTypingDisplay("");
    }
  }, [typingUsersByConversation, currentConvoIdForTypingDisplay, authUser]);

  if (!displayUser) {
    return null;
  }

  const handleCloseChat = () => clearChatContext();
  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  const safeOnlineUsers = Array.isArray(onlineUsers)
    ? onlineUsers.map((id) => Number(id))
    : [];
  const isUserOnline = displayUser?.id
    ? safeOnlineUsers.includes(Number(displayUser.id))
    : false;

  return (
    <>
      <div className="p-2.5 border-b border-base-300 bg-base-100">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 min-w-0 cursor-pointer group"
            onClick={openProfileModal}
            title={`View profile of ${
              displayUser.full_name || displayUser.username
            }`}
          >
            <div className="avatar relative flex-shrink-0">
              <div className="w-10 rounded-full ring-1 ring-base-300 ring-offset-base-100 ring-offset-1 group-hover:ring-primary transition-all">
                <img
                  src={displayUser.profile_pic_url || "/avatar.png"}
                  alt={displayUser.full_name || displayUser.username}
                />
              </div>
              {isUserOnline && (
                <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-success ring-2 ring-base-100" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-base-content truncate group-hover:text-primary transition-colors">
                {displayUser.full_name || displayUser.username}
              </h3>
              {typingDisplay ? (
                <p className="text-sm text-primary animate-pulse truncate">
                  {typingDisplay}
                </p>
              ) : isPending ? (
                <p className="text-sm text-warning">Starting new chat...</p>
              ) : (
                <p
                  className={`text-sm truncate ${
                    isUserOnline ? "text-success" : "text-base-content/70"
                  }`}
                >
                  {isUserOnline ? "Online" : "Offline"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleCloseChat}
            className="btn btn-ghost btn-sm btn-circle flex-shrink-0"
            title="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        title={`${
          displayUser.full_name || displayUser.username
        }'s Profile`}
        size="md"
      >
        <UserProfileModal user={displayUser} />
      </Modal>
    </>
  );
};

export default ChatHeader;
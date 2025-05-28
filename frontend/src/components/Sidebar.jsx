// frontend/src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import {
  Users,
  MessageSquareText,
  MessageCircleMore,
  Search,
} from "lucide-react";

import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";

const Sidebar = () => {
  const {
    usersForNewChat,
    getUsersForNewChat,
    conversations,
    getConversations,
    selectedConversation,
    pendingChatUser,
    selectUserForPendingChat,
    selectAndFetchMessagesForConversation,
    isUsersLoading,
    isConversationsLoading,
  } = useChatStore();

  const { authUser, onlineUsers: rawOnlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const safeOnlineUsers = Array.isArray(rawOnlineUsers)
    ? rawOnlineUsers.map((id) => Number(id))
    : [];

  useEffect(() => {
    if (authUser) {
      getUsersForNewChat();
      getConversations();
    }
  }, [authUser, getUsersForNewChat, getConversations]);

  const filteredConversations = (
    Array.isArray(conversations) ? conversations : []
  ).filter((convo) => {
    if (!searchTerm) return true;
    const otherParticipant = convo.participants?.find(
      (p) => p.id !== authUser?.id
    );
    if (!otherParticipant) return false;
    const name = otherParticipant.full_name || otherParticipant.username || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const usersAvailableForNewChat = (
    Array.isArray(usersForNewChat) ? usersForNewChat : []
  )
    .filter((user) => user.id !== authUser?.id)
    .filter((userToFilter) => {
      if (!authUser) return true;
      return !(Array.isArray(conversations) ? conversations : []).some(
        (convo) =>
          convo.participants.length === 2 &&
          convo.participants.some((p) => p.id === userToFilter.id) &&
          convo.participants.some((p) => p.id === authUser.id)
      );
    })
    .filter((user) => (showOnlineOnly ? safeOnlineUsers.includes(user.id) : true))
    .filter((user) => {
      if (!searchTerm) return true;
      const name = user.full_name || user.username || "";
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

  const isLoadingUI =
    (isConversationsLoading && conversations.length === 0) ||
    (isUsersLoading && usersForNewChat.length === 0);

  if (isLoadingUI && !authUser) {
    return (
      <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100 p-4 items-center justify-center">
        <p className="text-sm text-base-content/60 hidden lg:block">
          Login to see chats.
        </p>
        <Users className="size-8 text-base-content/30 lg:hidden" />
      </aside>
    );
  }
  if (isLoadingUI && authUser) {
    return <SidebarSkeleton />;
  }

  const onlineCountDisplay = usersForNewChat.filter(
    (u) => u.id !== authUser?.id && safeOnlineUsers.includes(u.id)
  ).length;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200 bg-base-100">
      <div className="p-3 lg:p-4 border-b border-base-300">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats or users..."
            className="input input-sm lg:input-md input-bordered w-full pl-8 lg:pl-10 text-xs lg:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-2 lg:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-base-content/40" />
        </div>
      </div>

      <div className="border-b border-base-300 w-full p-3 lg:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-5 lg:size-6 text-primary" />
            <span className="font-semibold text-sm lg:text-base hidden lg:block">
              Chats
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-y-auto flex-grow py-1.5 lg:py-2 space-y-0.5">
        {isConversationsLoading && filteredConversations.length === 0 && (
          <div className="p-3 text-center text-xs hidden lg:block">
            Loading chats...
          </div>
        )}
        {!isConversationsLoading && filteredConversations.length === 0 && (
          <p className="text-xs lg:text-sm text-base-content/60 text-center p-4 hidden lg:block">
            {searchTerm ? "No chats match your search." : "No active chats."}
          </p>
        )}
        {filteredConversations.map((convo) => {
          const otherParticipant = convo.participants?.find(
            (p) => p.id !== authUser?.id
          );
          if (!otherParticipant) return null;
          const displayName =
            otherParticipant.full_name || otherParticipant.username || "User";
          const profilePic =
            otherParticipant.profile_pic_url || "/avatar.png";
          const lastMsg = convo.last_message;
          let truncatedMessage = "No messages yet";

          if (lastMsg?.content) {
            truncatedMessage =
              lastMsg.content.length > 25
                ? lastMsg.content.substring(0, 22) + "..."
                : lastMsg.content;
          } else if (lastMsg?.image_url) {
            truncatedMessage = "Sent an image";
          }

          if (lastMsg?.sender?.id === authUser?.id) {
            truncatedMessage = `You: ${truncatedMessage}`;
          }

          const isActive = selectedConversation?.id === convo.id;
          const isUnread = (convo.unread_count || 0) > 0;

          return (
            <button
              key={convo.id}
              onClick={() => selectAndFetchMessagesForConversation(convo)}
              className={`w-full p-2 lg:p-3 flex items-center gap-2.5 lg:gap-3 hover:bg-base-200 dark:hover:bg-base-300/40 transition-colors rounded-md lg:rounded-lg ${
                isActive
                  ? "bg-primary text-primary-content hover:bg-primary-focus"
                  : ""
              }`}
              title={displayName}
            >
              <div className="avatar relative mx-auto lg:mx-0">
                <div
                  className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full ring-1 ring-offset-base-100 ring-offset-1 ${
                    isActive
                      ? "ring-primary-content/50"
                      : isUnread
                        ? "ring-secondary"
                        : "ring-transparent"
                  }`}
                >
                  <img src={profilePic} alt={displayName} />
                </div>
                {safeOnlineUsers.includes(otherParticipant.id) && (
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-full bg-success ring-2 ring-base-100" />
                )}
              </div>
              <div className="hidden lg:block text-left min-w-0 flex-1">
                <div className="flex justify-between items-center">
                  <h3
                    className={`font-semibold text-sm truncate ${
                      isActive
                        ? ""
                        : isUnread
                          ? "text-base-content font-bold"
                          : "text-base-content"
                    }`}
                  >
                    {displayName}
                  </h3>
                  {lastMsg?.timestamp && (
                    <span
                      className={`text-xs ml-2 ${
                        isActive
                          ? "text-primary-content/70"
                          : "text-base-content/60"
                      }`}
                    >
                      {new Date(lastMsg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs truncate ${
                    isActive
                      ? "text-primary-content/80"
                      : isUnread
                        ? "text-base-content/90 font-medium"
                        : "text-base-content/70"
                  }`}
                >
                  {truncatedMessage}
                </p>
              </div>
              {isUnread && !isActive && (
                <span className="bg-secondary text-secondary-content text-xs font-bold px-1.5 py-0.5 rounded-full hidden lg:inline-block ml-auto">
                  {convo.unread_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-base-300 w-full p-3 lg:p-4 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleMore className="size-5 lg:size-6 text-secondary" />
            <span className="font-semibold text-sm lg:text-base hidden lg:block">
              Start New Chat
            </span>
          </div>
        </div>
        <div className="mt-2 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-xs lg:checkbox-sm"
            />
            <span className="text-xs lg:text-sm">Online only</span>
          </label>
          <span className="text-xs text-base-content/60">
            ({onlineCountDisplay} available)
          </span>
        </div>
      </div>
      <div className="overflow-y-auto flex-grow py-1.5 lg:py-2 space-y-0.5 max-h-40 lg:max-h-48">
        {isUsersLoading && usersAvailableForNewChat.length === 0 && (
          <div className="p-3 text-center text-xs hidden lg:block">
            Loading users...
          </div>
        )}
        {!isUsersLoading && usersAvailableForNewChat.length === 0 && (
          <p className="text-xs lg:text-sm text-base-content/70 text-center p-4 hidden lg:block">
            {searchTerm
              ? "No users match your search."
              : showOnlineOnly
                ? "No other online users."
                : "No new users to chat with."}
          </p>
        )}
        {usersAvailableForNewChat.map((user) => {
          const isPending =
            pendingChatUser?.id === user.id && !selectedConversation;
          return (
            <button
              key={user.id}
              onClick={() => selectUserForPendingChat(user)}
              className={`w-full p-2 lg:p-3 flex items-center gap-2.5 lg:gap-3 hover:bg-base-200 dark:hover:bg-base-300/40 transition-colors rounded-md lg:rounded-lg ${
                isPending
                  ? "bg-secondary text-secondary-content hover:bg-secondary-focus"
                  : ""
              }`}
              title={`Start chat with ${user.full_name || user.username}`}
            >
              <div className="avatar relative mx-auto lg:mx-0">
                <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full">
                  <img
                    src={user.profile_pic_url || "/avatar.png"}
                    alt={user.username}
                  />
                </div>
                {safeOnlineUsers.includes(user.id) && (
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 lg:h-3 lg:w-3 rounded-full bg-success ring-2 ring-base-100" />
                )}
              </div>
              <div className="hidden lg:block text-left min-w-0 flex-1">
                <p
                  className={`font-medium text-sm truncate ${
                    isPending ? "" : "text-base-content"
                  }`}
                >
                  {user.full_name || user.username}
                </p>
                <p
                  className={`text-xs ${
                    isPending
                      ? "text-secondary-content/80"
                      : safeOnlineUsers.includes(user.id)
                        ? "text-success"
                        : "text-base-content/60"
                  }`}
                >
                  {safeOnlineUsers.includes(user.id) ? "Online" : "Offline"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
export default Sidebar;
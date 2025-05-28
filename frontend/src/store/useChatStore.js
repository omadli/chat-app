// frontend/src/store/useChatStore.js
import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  conversations: [],
  selectedConversation: null,
  pendingChatUser: null,
  usersForNewChat: [],
  isConversationsLoading: false,
  isMessagesLoading: false,
  isUsersLoading: false,
  isSendingMessage: false,
  typingUsersByConversation: {},
  replyingToMessage: null,
  editingMessage: null,

  handleWebSocketMessage: (wsData, currentOpenConversationId) => {
    const parsedEventData = wsData;
    if (
      !parsedEventData ||
      typeof parsedEventData !== "object" ||
      !parsedEventData.type
    ) {
      if (
        parsedEventData &&
        parsedEventData.id &&
        parsedEventData.sender &&
        parsedEventData.conversation &&
        parsedEventData.timestamp
      ) {
        get()._handleNewChatMessage(
          { message: parsedEventData },
          currentOpenConversationId
        );
      } else if (parsedEventData && parsedEventData.type === "online_users_list") {
        return;
      } else {
        console.warn(
          "ChatStore (handleWebSocketMessage - ROUTER): WS data malformed/type missing. Data:",
          parsedEventData
        );
        return;
      }
    } else {
      switch (parsedEventData.type) {
        case "chat_message":
          if (parsedEventData.message)
            get()._handleNewChatMessage(
              parsedEventData,
              currentOpenConversationId
            );
          else
            console.warn(
              "ChatStore (ROUTER): 'chat_message' missing 'message' payload. Data:",
              parsedEventData
            );
          break;
        case "message_updated":
          if (parsedEventData.message)
            get().handleMessageUpdated(parsedEventData.message);
          else
            console.warn(
              "ChatStore (ROUTER): 'message_updated' missing 'message' payload. Data:",
              parsedEventData
            );
          break;
        case "message_deleted":
          if (parsedEventData.message_id && parsedEventData.conversation_id)
            get().handleMessageDeleted(
              parsedEventData.message_id,
              parsedEventData.conversation_id,
              parsedEventData.message
            );
          else
            console.warn(
              "ChatStore (ROUTER): 'message_deleted' missing 'message_id' or 'conversation_id'. Data:",
              parsedEventData
            );
          break;
        default:
          break;
      }
    }
  },

  _handleNewChatMessage: (eventData, currentOpenConversationId) => {
    const actualMessage = eventData.message;
    const { selectedConversation } = get();
    if (
      !actualMessage ||
      typeof actualMessage !== "object" ||
      !actualMessage.id ||
      !actualMessage.sender ||
      !actualMessage.conversation ||
      !actualMessage.timestamp
    ) {
      console.warn(
        "ChatStore (_handleNewChatMessage): Actual message malformed:",
        actualMessage
      );
      return;
    }
    const messageConversationId = actualMessage.conversation;
    const authUserId = useAuthStore.getState().authUser?.id;

    if (selectedConversation && messageConversationId === selectedConversation.id) {
      set((state) => {
        const messageExists = state.messages.some(
          (m) => m.id === actualMessage.id
        );
        if (!messageExists)
          return {
            messages: [...state.messages, actualMessage].sort(
              (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
            ),
          };
        return {};
      });
    }
    set((state) => {
      let conversationInList = state.conversations.find(
        (c) => c.id === messageConversationId
      );
      let newConversationsArray;
      if (conversationInList) {
        newConversationsArray = state.conversations.map((convo) => {
          if (convo.id === messageConversationId) {
            let unreadCount = convo.unread_count || 0;
            if (
              (!selectedConversation ||
                messageConversationId !== selectedConversation.id ||
                document.visibilityState !== "visible") &&
              actualMessage.sender.id !== authUserId
            ) {
              unreadCount += 1;
            } else if (
              selectedConversation &&
              messageConversationId === selectedConversation.id &&
              document.visibilityState === "visible"
            ) {
              unreadCount = 0;
            }
            return {
              ...convo,
              last_message: actualMessage,
              unread_count: unreadCount,
              updated_at: actualMessage.timestamp,
            };
          }
          return convo;
        });
      } else {
        if (actualMessage.sender.id !== authUserId) {
          const otherParticipant = actualMessage.sender;
          const currentUser = useAuthStore.getState().authUser;
          if (!currentUser) return { conversations: state.conversations };
          const newConversationStub = {
            id: messageConversationId,
            participants: [currentUser, otherParticipant].sort(
              (a, b) => a.id - b.id
            ),
            last_message: actualMessage,
            unread_count:
              !selectedConversation ||
              selectedConversation.id !== messageConversationId
                ? 1
                : 0,
            created_at: actualMessage.timestamp,
            updated_at: actualMessage.timestamp,
          };
          newConversationsArray = [newConversationStub, ...state.conversations];
          if (
            !selectedConversation ||
            selectedConversation.id !== messageConversationId
          )
            toast(
              `New message from ${
                otherParticipant.full_name || otherParticipant.username
              }`
            );
        } else {
          const pendingChatUser = get().pendingChatUser;
          const otherUser =
            pendingChatUser ||
            state.usersForNewChat.find(
              (u) =>
                u.id !== authUserId &&
                actualMessage.conversation_participants?.includes(u.id)
            );
          if (actualMessage.sender && otherUser) {
            const newConversationStub = {
              id: messageConversationId,
              participants: [actualMessage.sender, otherUser].sort(
                (a, b) => a.id - b.id
              ),
              last_message: actualMessage,
              unread_count: 0,
              created_at: actualMessage.timestamp,
              updated_at: actualMessage.timestamp,
            };
            newConversationsArray = [
              newConversationStub,
              ...state.conversations.filter(
                (c) => c.id !== newConversationStub.id
              ),
            ];
          } else {
            newConversationsArray = state.conversations;
          }
        }
      }
      return {
        conversations: newConversationsArray.sort(
          (a, b) =>
            new Date(b.last_message?.timestamp || b.updated_at || 0) -
            new Date(a.last_message?.timestamp || a.updated_at || 0)
        ),
      };
    });
  },

  getConversations: async () => {
    if (get().isConversationsLoading) return;
    set({ isConversationsLoading: true });
    try {
      const res = await axiosInstance.get("/messages/conversations/");
      const sortedConversations = (Array.isArray(res.data) ? res.data : [])
        .map((convo) => ({ ...convo, unread_count: convo.unread_count || 0 }))
        .sort(
          (a, b) =>
            new Date(b.last_message?.timestamp || b.updated_at || 0) -
            new Date(a.last_message?.timestamp || a.updated_at || 0)
        );
      set({ conversations: sortedConversations });
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to fetch conversations"
      );
      set({ conversations: [] });
    } finally {
      set({ isConversationsLoading: false });
    }
  },

  getUsersForNewChat: async () => {
    if (get().isUsersLoading) return;
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/users/");
      set({ usersForNewChat: Array.isArray(res.data) ? res.data : [] });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to fetch users");
      set({ usersForNewChat: [] });
    } finally {
      set({ isUsersLoading: false });
    }
  },

  selectAndFetchMessagesForConversation: async (conversationToSelect) => {
    if (!conversationToSelect || !conversationToSelect.id) {
      get().clearChatContext();
      return;
    }
    const { selectedConversation: oldSelectedConvo, isMessagesLoading } = get();
    if (
      oldSelectedConvo?.id === conversationToSelect.id &&
      !isMessagesLoading
    ) {
      if (useAuthStore.getState().accessToken)
        useAuthStore.getState().connectConversationSocket(conversationToSelect.id);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationToSelect.id ? { ...c, unread_count: 0 } : c
        ),
      }));
      return;
    }
    if (isMessagesLoading && oldSelectedConvo?.id === conversationToSelect.id)
      return;
    set({
      selectedConversation: conversationToSelect,
      pendingChatUser: null,
      isMessagesLoading: true,
      messages: [],
    });
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationToSelect.id ? { ...c, unread_count: 0 } : c
      ),
    }));
    try {
      const res = await axiosInstance.get(
        `/messages/conversations/${conversationToSelect.id}/messages/`
      );
      set({
        messages: (Array.isArray(res.data) ? res.data : []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        ),
      });
      if (useAuthStore.getState().accessToken)
        useAuthStore.getState().connectConversationSocket(conversationToSelect.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to fetch messages");
      set({ messages: [] });
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  selectUserForPendingChat: (userToChatWith) => {
    if (!userToChatWith || !userToChatWith.id) return;
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) {
      toast.error("Please log in to start a chat.");
      return;
    }
    const existingConvo = get().conversations.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.id === userToChatWith.id) &&
        c.participants.some((p) => p.id === authUser.id)
    );
    if (existingConvo) {
      get().selectAndFetchMessagesForConversation(existingConvo);
    } else {
      set({
        selectedConversation: null,
        messages: [],
        pendingChatUser: userToChatWith,
      });
      useAuthStore.getState().disconnectConversationSocket();
    }
  },

  sendMessage: async (content, imageFile = null) => {
    const { selectedConversation, pendingChatUser, replyingToMessage } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) {
      toast.error("Authentication error.");
      set({ isSendingMessage: false });
      return;
    }
    if ((!content || !content.trim()) && !imageFile && !replyingToMessage?.id) {
      toast.error("Message cannot be empty.");
      set({ isSendingMessage: false });
      return;
    }
    set({ isSendingMessage: true });
    const requestData = new FormData();
    if (content !== null && content !== undefined)
      requestData.append("content", content.trim());
    else if (!imageFile && !replyingToMessage?.id)
      requestData.append("content", "");
    if (imageFile) requestData.append("image", imageFile);
    if (replyingToMessage?.id)
      requestData.append("reply_to_message_id", replyingToMessage.id);

    let endpoint = "";
    let isNewConversationAttempt = false;
    if (selectedConversation?.id)
      endpoint = `/messages/conversations/${selectedConversation.id}/messages/`;
    else if (pendingChatUser?.id) {
      endpoint = `/messages/send/${pendingChatUser.id}/`;
      isNewConversationAttempt = true;
    } else {
      toast.error("No recipient selected.");
      set({ isSendingMessage: false });
      return;
    }

    try {
      const res = await axiosInstance.post(endpoint, requestData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const sentMessage = res.data;
      if (
        !sentMessage ||
        !sentMessage.id ||
        !sentMessage.sender ||
        !sentMessage.conversation ||
        !sentMessage.timestamp
      ) {
        toast.error("Error processing server response for sent message.");
        set({ isSendingMessage: false });
        return;
      }
      get().clearReplyingTo();
      if (isNewConversationAttempt && pendingChatUser) {
        const newConversationObject = {
          id: sentMessage.conversation,
          participants: [authUser, pendingChatUser].sort((a, b) => a.id - b.id),
          last_message: sentMessage,
          unread_count: 0,
          created_at: sentMessage.timestamp,
          updated_at: sentMessage.timestamp,
        };
        set((state) => ({
          pendingChatUser: null,
          selectedConversation: newConversationObject,
          messages: [sentMessage],
          conversations: [
            newConversationObject,
            ...state.conversations.filter(
              (c) => c.id !== newConversationObject.id
            ),
          ].sort(
            (a, b) =>
              new Date(b.last_message?.timestamp || b.updated_at || 0) -
              new Date(a.last_message?.timestamp || a.updated_at || 0)
          ),
        }));
        if (useAuthStore.getState().accessToken && newConversationObject.id)
          useAuthStore.getState().connectConversationSocket(newConversationObject.id);
      } else if (selectedConversation) {
        set((state) => ({
          conversations: state.conversations
            .map((c) =>
              c.id === selectedConversation.id
                ? {
                    ...c,
                    last_message: sentMessage,
                    unread_count: 0,
                    updated_at: sentMessage.timestamp,
                  }
                : c
            )
            .sort(
              (a, b) =>
                new Date(b.last_message?.timestamp || b.updated_at || 0) -
                new Date(a.last_message?.timestamp || a.updated_at || 0)
            ),
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send message.");
    } finally {
      set({ isSendingMessage: false });
    }
  },

  editMessage: async (messageId, newContent) => {
    if (!newContent || !newContent.trim()) {
      toast.error("Edited message cannot be empty.");
      return;
    }
    const { selectedConversation } = get();
    if (!selectedConversation || !messageId) {
      toast.error("Cannot edit message: Context unclear.");
      return;
    }
    set({ isSendingMessage: true });
    try {
      await axiosInstance.put(`/messages/${messageId}/`, {
        content: newContent.trim(),
      });
      get().clearEditingMessage();
      toast.success("Message edited!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to edit message.");
    } finally {
      set({ isSendingMessage: false });
    }
  },

  deleteMessage: async (messageId) => {
    const { selectedConversation } = get();
    if (!selectedConversation || !messageId) {
      toast.error("Cannot delete message: Context unclear.");
      return;
    }
    try {
      await axiosInstance.delete(`/messages/${messageId}/`);
      toast.success("Message delete request sent!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete message.");
    }
  },

  handleMessageUpdated: (updatedMessage) => {
    if (!updatedMessage || !updatedMessage.id) return;
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      ),
      conversations: state.conversations
        .map((convo) => {
          if (
            convo.id === updatedMessage.conversation &&
            convo.last_message?.id === updatedMessage.id
          ) {
            return {
              ...convo,
              last_message: { ...convo.last_message, ...updatedMessage },
              updated_at:
                updatedMessage.updated_at || updatedMessage.timestamp,
            };
          }
          return convo;
        })
        .sort(
          (a, b) =>
            new Date(b.last_message?.timestamp || b.updated_at || 0) -
            new Date(a.last_message?.timestamp || a.updated_at || 0)
        ),
    }));
  },

  handleMessageDeleted: (
    deletedMessageId,
    conversationIdOfDeletedMessage,
    messageObjectFromWS = null
  ) => {
    console.log(
      `ChatStore: Handling message_deleted event for message ID ${deletedMessageId} in convo ${conversationIdOfDeletedMessage}`
    );
    set((state) => {
      let updatedMessages = state.messages;
      let messageWasInSelectedConversation = false;

      if (
        state.selectedConversation &&
        String(state.selectedConversation.id) ===
          String(conversationIdOfDeletedMessage)
      ) {
        const originalLength = state.messages.length;
        updatedMessages = state.messages.filter(
          (msg) => msg.id !== deletedMessageId
        );
        if (updatedMessages.length < originalLength) {
          messageWasInSelectedConversation = true;
        }
      }

      const updatedConversations = state.conversations
        .map((convo) => {
          if (
            String(convo.id) === String(conversationIdOfDeletedMessage) &&
            convo.last_message?.id === deletedMessageId
          ) {
            let newLastMessageForConvo = null;
            if (messageWasInSelectedConversation && updatedMessages.length > 0) {
              newLastMessageForConvo =
                updatedMessages[updatedMessages.length - 1];
            }
            return {
              ...convo,
              last_message: newLastMessageForConvo,
              updated_at: new Date().toISOString(),
            };
          }
          return convo;
        })
        .sort(
          (a, b) =>
            new Date(b.last_message?.timestamp || b.updated_at || 0) -
            new Date(a.last_message?.timestamp || a.updated_at || 0)
        );

      return { messages: updatedMessages, conversations: updatedConversations };
    });
  },

  setReplyingTo: (message) =>
    set({ replyingToMessage: message, editingMessage: null }),
  clearReplyingTo: () => set({ replyingToMessage: null }),
  setEditingMessage: (message) =>
    set({
      editingMessage: { id: message.id, content: message.content },
      replyingToMessage: null,
    }),
  clearEditingMessage: () => set({ editingMessage: null }),

  setUserTyping: (userId, username, conversationId, isTyping) => {
    const convoIdStr = String(conversationId);
    set((state) => {
      const updatedTypingUsers = { ...state.typingUsersByConversation };
      const currentTypersInConvo = {
        ...(updatedTypingUsers[convoIdStr] || {}),
      };
      if (isTyping) currentTypersInConvo[userId] = username;
      else delete currentTypersInConvo[userId];
      if (Object.keys(currentTypersInConvo).length > 0)
        updatedTypingUsers[convoIdStr] = currentTypersInConvo;
      else delete updatedTypingUsers[convoIdStr];
      return { typingUsersByConversation: updatedTypingUsers };
    });
  },
  clearTypingForConversation: (conversationId) => {
    const convoIdStr = String(conversationId);
    set((state) => {
      const updatedTypingUsers = { ...state.typingUsersByConversation };
      delete updatedTypingUsers[convoIdStr];
      return { typingUsersByConversation: updatedTypingUsers };
    });
  },

  clearChatContext: () => {
    const { selectedConversation } = get();
    if (selectedConversation?.id) {
      get().clearTypingForConversation(selectedConversation.id);
    }
    set({
      selectedConversation: null,
      messages: [],
      pendingChatUser: null,
      replyingToMessage: null,
      editingMessage: null,
    });
    useAuthStore.getState().disconnectConversationSocket();
  },
}));
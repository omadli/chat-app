// frontend/src/store/useAuthStore.js
import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance, setAuthHeader } from "../lib/axios.js";
import { useChatStore } from "./useChatStore";

const getWebSocketBaseUrl = (path = "/ws/chat") => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const backendPort = "5001";
  const host =
    import.meta.env.MODE === "development"
      ? `${window.location.hostname}:${backendPort}`
      : window.location.host;
  return `${protocol}//${host}${path}`;
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  accessToken: localStorage.getItem("accessToken") || null,
  refreshToken: localStorage.getItem("refreshToken") || null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,

  socket: null,
  _socketMessageCallback: null,
  presenceSocket: null,
  onlineUsers: [],

  handleLogoutDueToAuthFailure: (reason) => {
    console.log(`AuthStore: Logging out due to auth failure: ${reason}`);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setAuthHeader(null);
    get().disconnectConversationSocket();
    set({
      authUser: null,
      accessToken: null,
      refreshToken: null,
      socket: null,
      isCheckingAuth: false,
    });
  },

  setSocketMessageCallback: (callback) => {
    set({ _socketMessageCallback: callback });
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    const currentAccessToken = get().accessToken;
    if (!currentAccessToken) {
      set({
        authUser: null,
        isCheckingAuth: false,
        accessToken: null,
        refreshToken: null,
      });
      setAuthHeader(null);
      return;
    }
    setAuthHeader(currentAccessToken);
    try {
      const res = await axiosInstance.get("/auth/check/");
      set({ authUser: res.data, isCheckingAuth: false });
    } catch (error) {
      console.log(
        "AuthStore: Error in checkAuth (token likely invalid/expired):",
        error.message
      );
      if (error.response?.status !== 401) {
        get().handleLogoutDueToAuthFailure("checkAuth-non-401");
      }
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup/", data);
      localStorage.setItem("accessToken", res.data.access);
      localStorage.setItem("refreshToken", res.data.refresh);
      setAuthHeader(res.data.access);
      set({
        authUser: res.data.user,
        accessToken: res.data.access,
        refreshToken: res.data.refresh,
      });
      toast.success(res.data.message || "Account created successfully");
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        (typeof error.response?.data === "object"
          ? Object.values(error.response.data).flat().join(" ")
          : "Signup failed");
      toast.error(errorMessage);
      throw error;
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login/", data);
      localStorage.setItem("accessToken", res.data.access);
      localStorage.setItem("refreshToken", res.data.refresh);
      setAuthHeader(res.data.access);
      set({
        authUser: res.data.user,
        accessToken: res.data.access,
        refreshToken: res.data.refresh,
      });
      toast.success(res.data.message || "Logged in successfully");
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        (typeof error.response?.data === "object"
          ? Object.values(error.response.data).flat().join(" ")
          : "Login failed");
      toast.error(errorMessage);
      throw error;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    const currentRefreshToken = get().refreshToken;
    try {
      if (currentRefreshToken) {
        await axiosInstance.post("/auth/logout/", {
          refresh: currentRefreshToken,
        });
      }
    } catch (error) {
      console.error("AuthStore: Backend logout call failed:", error.message);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setAuthHeader(null);
      get().disconnectConversationSocket();
      set({
        authUser: null,
        accessToken: null,
        refreshToken: null,
        socket: null,
      });
      toast.success("Logged out successfully");
    }
  },

  updateProfile: async (formData) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/users/update-profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set({ authUser: res.data });
      toast.success("Profile updated successfully!");
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        (typeof error.response?.data === "object"
          ? Object.values(error.response.data).flat().join(" ")
          : "Profile update failed");
      toast.error(errorMessage);
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectConversationSocket: (conversationId) => {
    if (!conversationId) {
      console.warn(
        "AuthStore (connectConversationSocket): conversationId is missing."
      );
      get().disconnectConversationSocket();
      return;
    }
    const { authUser, accessToken, socket: currentSocket } = get();

    if (!authUser || !accessToken) {
      console.error(
        "AuthStore: Cannot connect Conversation WebSocket - No auth user or access token."
      );
      return;
    }

    const targetSocketUrlPart = `/ws/chat/${conversationId}/`;
    if (
      currentSocket &&
      currentSocket.url?.includes(targetSocketUrlPart) &&
      currentSocket.readyState === WebSocket.OPEN
    ) {
      console.log(
        `AuthStore: Already connected to conversation ${conversationId}.`
      );
      return;
    }

    get().disconnectConversationSocket();

    const baseUrl = getWebSocketBaseUrl("/ws/chat");
    const socketUrl = `${baseUrl}/${conversationId}/?token=${accessToken}`;
    console.log(
      "AuthStore: Attempting Conversation WebSocket connection to:",
      socketUrl
    );

    try {
      const newSocket = new WebSocket(socketUrl);
      newSocket.onopen = () => {
        console.log(
          `AuthStore: Conversation WebSocket connected for ${conversationId}.`
        );
        set({ socket: newSocket });
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(
            "AuthStore (ConversationSocket onmessage): Parsed data:",
            data
          );

          if (data.type === "chat_message" && data.message) {
            useChatStore
              .getState()
              .handleWebSocketMessage(data, conversationId);
          } else if (data.type === "message_updated" && data.message) {
            useChatStore.getState().handleMessageUpdated(data.message);
          } else if (data.type === "message_deleted" && data.message_id) {
            useChatStore
              .getState()
              .handleMessageDeleted(
                data.message_id,
                data.conversation_id,
                data.message
              );
          } else if (data.type === "user_typing_started") {
            useChatStore
              .getState()
              .setUserTyping(
                data.user_id,
                data.username,
                conversationId,
                true
              );
          } else if (data.type === "user_typing_stopped") {
            useChatStore
              .getState()
              .setUserTyping(
                data.user_id,
                data.username,
                conversationId,
                false
              );
          } else {
            console.warn(
              "AuthStore (ConversationSocket onmessage): Received unhandled message type:",
              data.type,
              data
            );
          }
        } catch (e) {
          console.error(
            "AuthStore: Error parsing Conversation WebSocket message:",
            e,
            "Raw data:",
            event.data
          );
        }
      };
      newSocket.onclose = (event) => {
        console.log(
          `AuthStore: Conversation WebSocket for ${conversationId} closed. Code: ${event.code}, Reason: '${event.reason}'`
        );
        if (get().socket === newSocket) {
          set({ socket: null });
          if (conversationId) {
            useChatStore.getState().clearTypingForConversation(conversationId);
          }
        }
      };
      newSocket.onerror = (error) => {
        console.error(
          `AuthStore: Conversation WebSocket error for ${conversationId}:`,
          error
        );
      };
    } catch (error) {
      console.error("AuthStore: Failed to create WebSocket object:", error);
    }
  },

  disconnectConversationSocket: () => {
    const { socket } = get();
    if (socket) {
      console.log("AuthStore: Initiating Conversation WebSocket disconnect.");
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "User action or new conversation selected");
      }
    }
    set({ socket: null });
  },

  sendTypingStatus: (conversationId, isTyping) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN && conversationId) {
      const type = isTyping ? "typing_started" : "typing_stopped";
      console.log(
        `AuthStore (sendTypingStatus): Sending ${type} for conversation ${conversationId}`
      );
      socket.send(JSON.stringify({ type, conversation_id: conversationId }));
    }
  },

  setOnlineUsers: (userIds) => {
    set({
      onlineUsers: Array.isArray(userIds)
        ? userIds.map((id) => Number(id))
        : [],
    });
  },

  connectPresenceSocket: () => {
    const { accessToken, presenceSocket: currentPresenceSocket } = get();
    if (!accessToken) {
      return;
    }
    if (
      currentPresenceSocket &&
      currentPresenceSocket.readyState === WebSocket.OPEN
    ) {
      return;
    }

    get().disconnectPresenceSocket();

    const presenceWsUrl =
      getWebSocketBaseUrl("/ws/presence/") + `?token=${accessToken}`;
    console.log(
      "AuthStore: Attempting Presence WebSocket connection to:",
      presenceWsUrl
    );
    const newPresenceSocket = new WebSocket(presenceWsUrl);

    newPresenceSocket.onopen = () => {
      console.log("AuthStore: Presence WebSocket connected.");
      set({ presenceSocket: newPresenceSocket });
    };

    newPresenceSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "online_users_list" && data.users) {
          get().setOnlineUsers(data.users);
        }
      } catch (e) {
        console.error(
          "AuthStore: Error parsing Presence WebSocket message:",
          e,
          "Raw data:",
          event.data
        );
      }
    };

    newPresenceSocket.onclose = (event) => {
      console.log(
        `AuthStore: Presence WebSocket closed. Code: ${event.code}, Reason: '${event.reason}'`
      );
      set((state) =>
        state.presenceSocket === newPresenceSocket
          ? { presenceSocket: null }
          : {}
      );
    };

    newPresenceSocket.onerror = (error) => {
      console.error("AuthStore: Presence WebSocket error:", error);
    };
  },

  disconnectPresenceSocket: () => {
    const { presenceSocket } = get();
    if (presenceSocket) {
      if (
        presenceSocket.readyState === WebSocket.OPEN ||
        presenceSocket.readyState === WebSocket.CONNECTING
      ) {
        presenceSocket.close(1000, "User logout or app closing");
      }
    }
    set({ presenceSocket: null });
  },
}));

window.addEventListener("auth-logout-event", (event) => {
  useAuthStore
    .getState()
    .handleLogoutDueToAuthFailure(
      event.detail?.reason || "auth_interceptor_logout"
    );
});
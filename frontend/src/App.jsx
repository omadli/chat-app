// frontend/src/App.jsx
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useThemeStore } from "./store/useThemeStore";

function GlobalStoreInitializer() {
  const setSocketMessageCallback = useAuthStore(
    (state) => state.setSocketMessageCallback
  );
  const handleChatMessageFromChatStore =
    useChatStore.getState().handleWebSocketMessage;

  useEffect(() => {
    if (setSocketMessageCallback && handleChatMessageFromChatStore) {
      setSocketMessageCallback(handleChatMessageFromChatStore);
      return () => {
        setSocketMessageCallback(null);
      };
    }
  }, [setSocketMessageCallback, handleChatMessageFromChatStore]);
  return null;
}

const App = () => {
  const { theme } = useThemeStore();
  const {
    authUser,
    accessToken,
    checkAuth,
    isCheckingAuth,
    handleLogoutDueToAuthFailure,
    connectConversationSocket,
    disconnectConversationSocket,
    connectPresenceSocket,
    disconnectPresenceSocket,
  } = useAuthStore();

  const selectedConversation = useChatStore(
    (state) => state.selectedConversation
  );

  useEffect(() => {
    checkAuth();
    const handleAuthFailureEvent = (event) => {
      handleLogoutDueToAuthFailure(event.detail?.reason || "unknown_reason");
    };
    window.addEventListener("auth-logout-event", handleAuthFailureEvent);
    return () => {
      window.removeEventListener("auth-logout-event", handleAuthFailureEvent);
    };
  }, [checkAuth, handleLogoutDueToAuthFailure]);

  useEffect(() => {
    if (selectedConversation && selectedConversation.id && accessToken) {
      connectConversationSocket(selectedConversation.id);
    } else {
      disconnectConversationSocket();
    }
  }, [
    selectedConversation,
    accessToken,
    connectConversationSocket,
    disconnectConversationSocket,
  ]);

  useEffect(() => {
    if (authUser && accessToken) {
      connectPresenceSocket();
    } else {
      disconnectPresenceSocket();
    }
    return () => {
      disconnectPresenceSocket();
    };
  }, [authUser, accessToken, connectPresenceSocket, disconnectPresenceSocket]);

  if (isCheckingAuth) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        data-theme={theme || "light"}
      >
        <Loader className="size-10 animate-spin" />
      </div>
    );
  }

  return (
    <div data-theme={theme || "light"} className="min-h-screen flex flex-col">
      <GlobalStoreInitializer />
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route
            path="/"
            element={authUser ? <HomePage /> : <Navigate to="/login" />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignUpPage /> : <Navigate to="/" />}
          />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/settings"
            element={authUser ? <SettingsPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={authUser ? <ProfilePage /> : <Navigate to="/login" />}
          />
        </Routes>
      </main>
      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
};
export default App;
// frontend/src/pages/HomePage.jsx
import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedConversation, pendingChatUser, getConversations, conversations } =
    useChatStore();
  const { authUser } = useAuthStore();

  useEffect(() => {
    if (authUser && conversations.length === 0) {
      getConversations();
    }
  }, [authUser, getConversations, conversations.length]);

  const showChatInterface = selectedConversation || pendingChatUser;

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-16 px-4 h-full">
        <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-6xl h-[calc(100vh-4rem)]">
          <div className="flex h-full rounded-lg overflow-hidden">
            <Sidebar />
            {showChatInterface ? <ChatContainer /> : <NoChatSelected />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
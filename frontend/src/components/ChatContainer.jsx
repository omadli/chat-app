import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MessageItem from "./MessageItem";
import { useAuthStore } from "../store/useAuthStore";
import { X } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    selectAndFetchMessagesForConversation,
    isMessagesLoading,
    selectedConversation,
    pendingChatUser,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);

  const [zoomedImageUrl, setZoomedImageUrl] = useState(null);

  const handleImageClick = (url) => setZoomedImageUrl(url);
  const closeImageZoom = () => setZoomedImageUrl(null);

  const displayTargetUser =
    pendingChatUser ||
    selectedConversation?.participants.find((p) => p.id !== authUser?.id);

  useEffect(() => {
    if (chatBodyRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (atBottom || messages.length <= 10) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  useEffect(() => {
    if (
      selectedConversation?.id &&
      (messages.length === 0 ||
        (messages.length > 0 &&
          messages[0].conversation !== selectedConversation.id))
    ) {
      if (!isMessagesLoading) {
        selectAndFetchMessagesForConversation(selectedConversation);
      }
    }
  }, [
    selectedConversation,
    messages,
    isMessagesLoading,
    selectAndFetchMessagesForConversation,
  ]);

  if (
    !displayTargetUser &&
    !isMessagesLoading &&
    !pendingChatUser &&
    !selectedConversation
  ) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p>Select a chat to start messaging.</p>
      </div>
    );
  }

  const isLoadingDisplay =
    isMessagesLoading && selectedConversation && messages.length === 0;

  let messageAreaContent;
  if (isLoadingDisplay) {
    messageAreaContent = <MessageSkeleton />;
  } else if (selectedConversation && messages.length > 0) {
    messageAreaContent = messages.map((message) => (
      <MessageItem
        key={message.id || message.tempId}
        message={message}
        onImageClick={handleImageClick}
      />
    ));
  } else if (pendingChatUser && !selectedConversation) {
    messageAreaContent = (
      <div className="text-center text-base-content/70 py-10 px-4">
        Type your first message to start a conversation with{" "}
        {displayTargetUser?.full_name ||
          displayTargetUser?.username ||
          "this user"}
        .
      </div>
    );
  } else if (selectedConversation && messages.length === 0) {
    messageAreaContent = (
      <div className="text-center text-base-content/70 py-10 px-4">
        No messages in this conversation yet. Say hello!
      </div>
    );
  } else if (isMessagesLoading) {
    messageAreaContent = <MessageSkeleton />;
  } else {
    messageAreaContent = (
      <div className="text-center text-base-content/70 py-10 px-4">
        Loading chat or select one...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
      <ChatHeader />
      <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {messageAreaContent}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput />

      {zoomedImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4 transition-opacity duration-150 ease-in-out"
          onClick={closeImageZoom}
          role="dialog"
          aria-modal="true"
          aria-labelledby="zoomed-image-description"
        >
          <div
            className="relative max-w-3xl max-h-[90vh] animate-modal-appear"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImageUrl}
              alt="Zoomed attachment"
              id="zoomed-image-description"
              className="object-contain w-full h-full rounded-lg shadow-2xl"
            />
            <button
              onClick={closeImageZoom}
              className="absolute -top-3 -right-3 sm:top-2 sm:right-2 btn btn-circle btn-sm bg-base-100/80 text-base-content hover:bg-base-200 shadow-lg"
              aria-label="Close image preview"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatContainer;
import { useState, useEffect } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import WelcomeScreen from "../components/WelcomeScreen";
import MatchingScreen from "../components/MatchingScreen";
import ChatScreen from "../components/ChatScreen";
import ReportModal from "../components/ReportModal";
import { ScreenState, MatchData, ChatMessage, ReportFormData } from "../types";
import { Interest } from "@shared/schema";

const HomePage = () => {
  const { connected, userId, sendMessage, wsRef } = useWebSocket();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>("welcome");
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [hasVideo, setHasVideo] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Event handlers for WebSocket messages
  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent) => {
      try {
        // Get the data from the custom event's detail
        if (event.detail && event.detail.data) {
          const message = JSON.parse(event.detail.data);
          console.log("Received message:", message);
          
          switch (message.type) {
            case 'matching':
              setCurrentScreen("matching");
              break;
              
            case 'matched':
              setMatchData(message.data);
              setMessages([]); // Clear previous chat messages
              setCurrentScreen("chat");
              break;
              
            case 'chat-message':
              // When receiving a message, mark the 'read' property as false initially
              const newMessage = {
                ...message.data,
                read: false
              };
              setMessages(prevMessages => [...prevMessages, newMessage]);
              
              // Send a read receipt after a short delay
              setTimeout(() => {
                sendMessage({
                  type: 'message-read',
                  data: {
                    messageId: message.data.id
                  }
                });
              }, 2000);
              break;
              
            case 'message-read':
              // Update message read status
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === message.data.messageId ? { ...msg, read: true } : msg
                )
              );
              break;
              
            case 'chat-ended':
              setCurrentScreen("welcome");
              setIsPartnerTyping(false);
              break;
              
            case 'typing-status':
              setIsPartnerTyping(message.data.isTyping);
              break;
          }
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    // Listen to our custom event on the window object
    window.addEventListener('websocketMessage', handleWebSocketMessage as EventListener);

    return () => {
      window.removeEventListener('websocketMessage', handleWebSocketMessage as EventListener);
    };
  }, []);

  // Start the matching process
  const startMatching = () => {
    if (!connected || !userId) return;
    
    sendMessage({
      type: 'start-matching',
      data: {
        interests: selectedInterests,
        hasVideo
      }
    });
    
    setCurrentScreen("matching");
  };

  // Cancel the matching process
  const cancelMatching = () => {
    if (!connected || !userId) return;
    
    sendMessage({
      type: 'cancel-matching',
      data: {}
    });
    
    setCurrentScreen("welcome");
  };

  // End the current chat
  const endChat = () => {
    if (!connected || !userId || !matchData) return;
    
    sendMessage({
      type: 'end-chat',
      data: {}
    });
    
    setCurrentScreen("welcome");
    setMatchData(null);
    setMessages([]);
    setIsPartnerTyping(false);
  };

  // Find a new chat partner
  const findNewChat = () => {
    if (!connected || !userId) return;
    
    sendMessage({
      type: 'find-new-chat',
      data: {}
    });
    
    setCurrentScreen("matching");
    setMatchData(null);
    setMessages([]);
    setIsPartnerTyping(false);
  };

  // Send a text message
  const sendChatMessage = (content: string) => {
    if (!connected || !userId || !matchData) return;
    
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: userId,
      content,
      timestamp: Date.now()
    };
    
    sendMessage({
      type: 'chat-message',
      data: {
        content
      }
    });
    
    // Add message to local state
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  // Report a user
  const reportUser = () => {
    setIsReportModalOpen(true);
  };

  // Submit a report
  const submitReport = (data: ReportFormData) => {
    if (!connected || !userId || !matchData) return;
    
    sendMessage({
      type: 'report-user',
      data: {
        reason: data.reason,
        details: data.details
      }
    });
    
    setIsReportModalOpen(false);
    setCurrentScreen("welcome");
    setMatchData(null);
    setMessages([]);
    setIsPartnerTyping(false);
  };
  
  // Handle typing status changes
  const handleTypingStatusChange = (isTyping: boolean) => {
    if (!connected || !userId || !matchData) return;
    
    sendMessage({
      type: 'typing-status',
      data: {
        isTyping
      }
    });
  };

  // Render the appropriate screen based on current state
  if (!connected) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Connecting to chat server...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {currentScreen === "welcome" && (
        <WelcomeScreen
          selectedInterests={selectedInterests}
          setSelectedInterests={setSelectedInterests}
          hasVideo={hasVideo}
          setHasVideo={setHasVideo}
          onStartChat={startMatching}
        />
      )}
      
      {currentScreen === "matching" && (
        <MatchingScreen
          interests={selectedInterests}
          onCancel={cancelMatching}
        />
      )}
      
      {currentScreen === "chat" && matchData && (
        <ChatScreen
          matchData={matchData}
          messages={messages}
          onSendMessage={sendChatMessage}
          onEndChat={endChat}
          onFindNewChat={findNewChat}
          onReportUser={reportUser}
          isPartnerTyping={isPartnerTyping}
          onTypingStatusChange={handleTypingStatusChange}
        />
      )}
      
      {isReportModalOpen && (
        <ReportModal
          onClose={() => setIsReportModalOpen(false)}
          onSubmit={submitReport}
        />
      )}
    </div>
  );
};

export default HomePage;

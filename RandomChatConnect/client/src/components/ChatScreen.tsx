import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, User, MessageSquare, RotateCcw, X, Mic, Video, Pencil, Smile, Ban } from "lucide-react";
import { ChatMessage, MatchData } from "../types";
import { formatTime, formatTimeAgo } from "../utils/time";
import { useWebRTC } from "../hooks/useWebRTC";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useToast } from "../hooks/use-toast";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface ChatScreenProps {
  matchData: MatchData;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onEndChat: () => void;
  onFindNewChat: () => void;
  onReportUser: () => void;
  isPartnerTyping?: boolean;
  onTypingStatusChange?: (isTyping: boolean) => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  matchData,
  messages,
  onSendMessage,
  onEndChat,
  onFindNewChat,
  onReportUser,
  isPartnerTyping = false,
  onTypingStatusChange
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const { wsRef } = useWebSocket();
  const { toast } = useToast();
  
  const { 
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    toggleMic,
    toggleCamera 
  } = useWebRTC({
    partnerId: matchData.partnerId,
    hasVideo: matchData.hasVideo
  });

  // Set video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  // Focus input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Handle typing indicator
  useEffect(() => {
    // Clean up typing timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle input changes and notify about typing status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Notify that user is typing
    if (onTypingStatusChange && newValue.length > 0) {
      onTypingStatusChange(true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set a new timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (onTypingStatusChange) {
          onTypingStatusChange(false);
        }
      }, 2000);
    } else if (onTypingStatusChange && newValue.length === 0) {
      // If input is cleared, immediately stop typing indicator
      onTypingStatusChange(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
      setShowEmojiPicker(false);
    }
  };
  
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputValue(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen" data-screen="chat">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-3 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
              <User className="h-6 w-6" />
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 bg-success rounded-full border-2 border-white"></span>
          </div>
          <div>
            <h2 className="font-medium">Anonymous User</h2>
            <div className="flex items-center text-sm text-success">
              <span className="h-2 w-2 bg-success rounded-full mr-2"></span>
              Online
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            onClick={onReportUser}
            title="Report User"
          >
            <AlertCircle className="h-5 w-5" />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-red-600 transition-colors"
            onClick={() => {
              // Using the WebSocket context to send block request
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'block-user',
                  data: { userId: matchData.partnerId }
                }));
                
                // Show a notification
                toast({
                  title: "User Blocked",
                  description: "This user has been blocked and you won't be matched with them again.",
                  variant: "destructive"
                });
              }
            }}
            title="Block User"
          >
            <Ban className="h-5 w-5" />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            onClick={onFindNewChat}
            title="Find New Chat"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            onClick={onEndChat}
            title="End Chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Video Section */}
        {matchData.hasVideo && (
          <div className="md:w-1/2 bg-gray-900 relative">
            <div className="h-full flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Remote Video */}
                <div className="absolute inset-0 bg-gray-800 video-container overflow-hidden">
                  {remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white text-opacity-70">
                      <div className="text-center">
                        <Video className="h-16 w-16 mx-auto mb-4" />
                        <p>Waiting for video connection...</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Local Video (Small PiP) */}
                <div className="absolute bottom-4 right-4 w-1/4 max-w-[180px] aspect-video rounded-lg overflow-hidden border-2 border-white shadow-lg bg-gray-700">
                  {localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white text-opacity-70 text-sm">
                      <Video className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex justify-center space-x-4">
              <button 
                className={`rounded-full p-3 transition-colors ${
                  isMicMuted 
                    ? "bg-red-600 text-white" 
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
                onClick={toggleMic}
                title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
              >
                <Mic className="h-5 w-5" />
                {isMicMuted && <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-0.5 h-6 bg-white transform rotate-45 rounded-full"></span>
                </span>}
              </button>
              <button 
                className={`rounded-full p-3 transition-colors ${
                  isCameraOff 
                    ? "bg-red-600 text-white" 
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
                onClick={toggleCamera}
                title={isCameraOff ? "Turn on camera" : "Turn off camera"}
              >
                <Video className="h-5 w-5" />
                {isCameraOff && <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-0.5 h-6 bg-white transform rotate-45 rounded-full"></span>
                </span>}
              </button>
              <button 
                className="rounded-full p-3 transition-colors bg-white text-gray-800 hover:bg-gray-100"
                title="Flip camera view"
                onClick={() => {
                  if (remoteVideoRef.current && localVideoRef.current) {
                    const pipClasses = "absolute bottom-4 right-4 w-1/4 max-w-[180px] aspect-video rounded-lg overflow-hidden border-2 border-white shadow-lg";
                    const fullClasses = "h-full w-full object-cover";
                    
                    // Simply update UI to show which view is prominent without actually swapping streams
                    remoteVideoRef.current.classList.toggle('pip-view');
                    localVideoRef.current.classList.toggle('full-view');
                  }
                }}
              >
                <span className="transform rotate-90">⇅</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Chat Section */}
        <div className={`${matchData.hasVideo ? 'md:w-1/2' : 'w-full'} flex flex-col bg-white border-l border-gray-200`}>
          {/* Shared Interests */}
          {matchData.sharedInterests.length > 0 && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Shared Interests:</h3>
              <div className="flex flex-wrap gap-2">
                {matchData.sharedInterests.map(interest => (
                  <span 
                    key={interest}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Messages */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4" id="chat-messages">
            {/* System Message */}
            <div className="text-center my-4">
              <span className="bg-gray-100 text-gray-600 rounded-full px-4 py-1 text-sm">
                You are now chatting with a random stranger
              </span>
            </div>
            
            {messages.map(message => (
              <div 
                key={message.id}
                className={`flex items-end ${message.senderId === matchData.partnerId ? '' : 'justify-end'} space-x-2`}
              >
                <div 
                  className={`chat-bubble ${
                    message.senderId === matchData.partnerId 
                      ? 'bg-gray-100 text-gray-800 rounded-lg rounded-bl-none' 
                      : 'bg-primary text-white rounded-lg rounded-br-none'
                  } p-3 max-w-[80%] break-words`}
                >
                  <p>{message.content}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-xs ${
                      message.senderId === matchData.partnerId 
                        ? 'text-gray-500' 
                        : 'text-white/70'
                    }`}
                      title={formatTime(message.timestamp)}
                    >
                      {formatTimeAgo(message.timestamp)}
                    </p>
                    {message.senderId !== matchData.partnerId && (
                      <span className={`text-xs ml-2 ${
                        message.read ? 'text-white/70' : 'text-white/40'
                      }`}>
                        {message.read ? 'Read' : 'Sent'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isPartnerTyping && (
              <div className="flex items-start space-x-2 mt-2 animate-pulse">
                <div className="bg-gray-100 text-gray-800 rounded-lg rounded-bl-none p-3 max-w-[80%]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Text Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  className="absolute bottom-16 left-0 z-10"
                >
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </div>
              )}
              <form className="flex items-center space-x-2" onSubmit={handleSendMessage}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none p-2"
                  title="Insert Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <Input 
                  ref={inputRef}
                  type="text" 
                  value={inputValue}
                  onChange={handleInputChange}
                  className="flex-grow rounded-full px-4 py-2"
                  placeholder="Type a message..."
                />
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center"
                  disabled={!inputValue.trim()}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { WebSocketMessage } from "../types";
import { useToast } from "@/hooks/use-toast";

interface WebSocketContextType {
  connected: boolean;
  userId: string | null;
  sendMessage: (message: WebSocketMessage) => void;
  wsRef: React.RefObject<WebSocket | null>;
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  userId: null,
  sendMessage: () => {},
  wsRef: { current: null }
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Determine the WebSocket URL based on the current protocol
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket connected");
        setConnected(true);
        
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // Handle connection message to set userId
          if (message.type === 'connection') {
            setUserId(message.data.userId);
            console.log("Connected with user ID:", message.data.userId);
          }
          
          // Dispatch event for other components to listen to
          // This ensures all components can receive WebSocket messages
          // Use CustomEvent instead of MessageEvent for better compatibility
          const customEvent = new CustomEvent('websocketMessage', {
            detail: { data: event.data }
          });
          window.dispatchEvent(customEvent);
          
          // Other message types are handled by individual components
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
      
      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setConnected(false);
        
        // Set up a reconnection after a delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 3000);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to chat server. Retrying...",
          variant: "destructive"
        });
      };
      
      wsRef.current = socket;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [toast]);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Function to send messages over the WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error("Cannot send message: WebSocket is not connected");
      toast({
        title: "Connection Lost",
        description: "Reconnecting to the chat server...",
        variant: "destructive"
      });
      connectWebSocket();
    }
  }, [connectWebSocket, toast]);

  return (
    <WebSocketContext.Provider value={{ connected, userId, sendMessage, wsRef }}>
      {children}
    </WebSocketContext.Provider>
  );
};

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import * as crypto from "crypto";
import { Interest, Report, ReportReason } from "@shared/schema";

interface ChatUser {
  id: string;
  socket: any;
  interests: Interest[];
  hasVideo: boolean;
  partnerId: string | null;
  waitingSince: number;
  blockedUsers: string[];
}

interface WebSocketMessage {
  type: string;
  data: any;
}

// Typing status tracking
const typingUsers = new Map<string, boolean>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Define the HTTP server for both Express and WebSocket
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Track online users and waiting queue
  const onlineUsers = new Map<string, ChatUser>();
  const waitingUsers = new Set<string>();
  
  // Report tracking
  const userReports = new Map<string, number>();
  const REPORT_THRESHOLD = 3; // Number of reports before a user is flagged

  wss.on('connection', (socket) => {
    // Generate a unique user ID
    const userId = crypto.randomUUID();
    
    // Setup socket event handlers
    socket.on('message', (message) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(message.toString());
        handleMessage(userId, parsedMessage);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    socket.on('close', () => {
      // Handle user disconnect
      handleDisconnect(userId);
    });

    // Initial setup for the user
    onlineUsers.set(userId, {
      id: userId,
      socket,
      interests: [],
      hasVideo: false,
      partnerId: null,
      waitingSince: 0,
      blockedUsers: []
    });

    // Send the user their ID
    sendToUser(userId, {
      type: 'connection',
      data: { userId }
    });
  });

  function handleMessage(userId: string, message: WebSocketMessage) {
    const user = onlineUsers.get(userId);
    
    if (!user) return;
    
    console.log(`Received message from ${userId}:`, message.type);

    switch (message.type) {
      case 'start-matching':
        // Save user preferences and start matching
        user.interests = message.data.interests || [];
        user.hasVideo = message.data.hasVideo || false;
        startMatching(userId);
        break;

      case 'cancel-matching':
        // Remove from waiting queue
        if (waitingUsers.has(userId)) {
          waitingUsers.delete(userId);
        }
        break;

      case 'chat-message':
        // Forward message to partner if exists
        if (user.partnerId) {
          const partnerId = user.partnerId;
          
          // Check if this is a test bot partner
          if (partnerId.startsWith('test-bot-')) {
            // Simulate a response from the test bot after a short delay
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith('test-bot-')) {
                sendToUser(userId, {
                  type: 'chat-message',
                  data: {
                    id: crypto.randomUUID(),
                    senderId: partnerId,
                    content: `You said: "${message.data.content}". This is a test bot response to help you test the chat functionality.`,
                    timestamp: Date.now()
                  }
                });
              }
            }, 1000);
          } else {
            // Regular message forwarding to a real user
            sendToUser(partnerId, {
              type: 'chat-message',
              data: {
                id: crypto.randomUUID(),
                senderId: userId,
                content: message.data.content,
                timestamp: Date.now()
              }
            });
          }
        }
        break;

      case 'end-chat':
        // End the current chat
        endChat(userId);
        break;

      case 'find-new-chat':
        // End current chat and find a new one
        endChat(userId);
        startMatching(userId);
        break;

      case 'report-user':
        // Handle user report
        if (user.partnerId) {
          handleReport(userId, user.partnerId, message.data.reason, message.data.details);
        }
        break;

      // WebRTC signaling messages
      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'webrtc-ice-candidate':
        // Forward WebRTC signaling messages to partner
        if (user.partnerId) {
          // Only forward to real users, not test bots
          if (!user.partnerId.startsWith('test-bot-')) {
            sendToUser(user.partnerId, message);
          }
        }
        break;
        
      case 'typing-status':
        // Handle typing status updates
        if (user.partnerId) {
          // Update typing status
          typingUsers.set(userId, message.data.isTyping);
          
          // Forward to partner if not a test bot
          if (!user.partnerId.startsWith('test-bot-')) {
            sendToUser(user.partnerId, {
              type: 'typing-status',
              data: { isTyping: message.data.isTyping }
            });
          }
          // For test bot, simulate typing response
          else if (message.data.isTyping) {
            // Only start typing indicator if the message says the user is typing
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith('test-bot-')) {
                // Bot starts typing
                sendToUser(userId, {
                  type: 'typing-status',
                  data: { isTyping: true }
                });
                
                // After a delay, bot stops typing and sends a message
                setTimeout(() => {
                  if (user.partnerId && user.partnerId.startsWith('test-bot-')) {
                    // Bot stops typing
                    sendToUser(userId, {
                      type: 'typing-status',
                      data: { isTyping: false }
                    });
                    
                    // Bot sends a message
                    sendToUser(userId, {
                      type: 'chat-message',
                      data: {
                        id: crypto.randomUUID(),
                        senderId: user.partnerId,
                        content: "I see you're typing something! I'm a test bot that can respond to typing indicators.",
                        timestamp: Date.now()
                      }
                    });
                  }
                }, 2000);
              }
            }, 1000);
          }
        }
        break;
        
      case 'message-read':
        // Handle read receipts
        if (user.partnerId) {
          const messageId = message.data.messageId;
          
          // If this is a test bot, simulate message read
          if (user.partnerId.startsWith('test-bot-')) {
            // Test bot immediately sends a read receipt
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith('test-bot-')) {
                sendToUser(userId, {
                  type: 'message-read',
                  data: { messageId }
                });
              }
            }, 1000);
          } else {
            // Forward the read receipt to the real partner
            sendToUser(user.partnerId, {
              type: 'message-read',
              data: { messageId }
            });
          }
        }
        break;
        
      case 'block-user':
        // Handle user blocking
        if (user.partnerId) {
          const partnerIdToBlock = user.partnerId;
          
          // Don't allow blocking test bots
          if (!partnerIdToBlock.startsWith('test-bot-')) {
            // Add to blocked users list
            if (!user.blockedUsers.includes(partnerIdToBlock)) {
              user.blockedUsers.push(partnerIdToBlock);
            }
            
            // Notify user that blocking was successful
            sendToUser(userId, {
              type: 'block-success',
              data: { blockedUserId: partnerIdToBlock }
            });
            
            // End the current chat
            endChat(userId);
          }
        }
        break;
    }
  }

  function startMatching(userId: string) {
    const user = onlineUsers.get(userId);
    if (!user) return;

    // Already in a chat, end that first
    if (user.partnerId) {
      endChat(userId);
    }

    // Add to waiting queue
    waitingUsers.add(userId);
    user.waitingSince = Date.now();

    // Try to find a match
    findMatch(userId);

    // Notify user they're in the matching queue
    sendToUser(userId, {
      type: 'matching',
      data: { status: 'searching' }
    });
    
    // For testing in single-user mode: Create a bot partner after 3 seconds
    // This allows us to test the chat functionality without needing a second user
    setTimeout(() => {
      // If still waiting after timeout, create a test bot partner
      if (waitingUsers.has(userId)) {
        createTestPartner(userId);
      }
    }, 3000);
  }
  
  // Create a test bot user for single-user testing
  function createTestPartner(userId: string) {
    const user = onlineUsers.get(userId);
    if (!user || !waitingUsers.has(userId)) return;
    
    // Create a test partner ID
    const testPartnerId = "test-bot-" + crypto.randomUUID();
    
    // Connect the user with the test partner
    // Remove user from waiting queue
    waitingUsers.delete(userId);
    
    // Set up the partnership (one-way only since bot isn't real)
    user.partnerId = testPartnerId;
    
    // Find some shared interests to display
    const sharedInterests = user.interests.length > 0 
      ? [user.interests[0]] 
      : ["movies", "music"];
      
    // Notify user they've been matched with test bot
    sendToUser(userId, {
      type: 'matched',
      data: {
        partnerId: testPartnerId,
        sharedInterests,
        hasVideo: user.hasVideo
      }
    });
    
    // If video is enabled, send a test signal to trigger WebRTC
    if (user.hasVideo) {
      setTimeout(() => {
        if (user.partnerId === testPartnerId) {
          sendToUser(userId, {
            type: 'webrtc-offer',
            data: {
              partnerId: testPartnerId,
              offer: {
                type: "offer",
                sdp: "test sdp" // Dummy SDP data
              }
            }
          });
        }
      }, 1000);
    }
    
    // Send a welcome message from the test bot
    setTimeout(() => {
      if (user.partnerId === testPartnerId) {
        sendToUser(userId, {
          type: 'chat-message',
          data: {
            id: crypto.randomUUID(),
            senderId: testPartnerId,
            content: "Hi there! I'm a test bot to help you see how the chat works. Try sending me a message!",
            timestamp: Date.now()
          }
        });
      }
    }, 1500);
  }

  function findMatch(userId: string) {
    const user = onlineUsers.get(userId);
    if (!user || !waitingUsers.has(userId)) return;

    // Find the best match based on waiting time and shared interests
    let bestMatchId = null;
    let bestMatchScore = -1;

    // Convert Set to array before iterating
    Array.from(waitingUsers).forEach(waitingUserId => {
      // Skip the user themselves
      if (waitingUserId === userId) return;

      const potentialMatch = onlineUsers.get(waitingUserId);
      if (!potentialMatch) return;

      // Skip if video preferences don't match
      if (user.hasVideo !== potentialMatch.hasVideo) return;
      
      // Skip if either user has blocked the other
      if (user.blockedUsers.includes(waitingUserId) || 
          potentialMatch.blockedUsers.includes(userId)) return;

      // Calculate match score based on shared interests and waiting time
      const sharedInterests = user.interests.filter(interest => 
        potentialMatch.interests.includes(interest)
      );
      
      const waitingTimeScore = Math.min(
        (Date.now() - potentialMatch.waitingSince) / 10000, 
        5
      ); // Max 5 points for waiting (after 50 seconds)
      
      const interestScore = sharedInterests.length * 2; // 2 points per shared interest
      const score = waitingTimeScore + interestScore;

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchId = waitingUserId;
      }
    });

    // If a match is found, connect them
    if (bestMatchId) {
      connectUsers(userId, bestMatchId);
    }
  }

  function connectUsers(user1Id: string, user2Id: string) {
    const user1 = onlineUsers.get(user1Id);
    const user2 = onlineUsers.get(user2Id);

    if (!user1 || !user2) return;

    // Remove both from waiting queue
    waitingUsers.delete(user1Id);
    waitingUsers.delete(user2Id);

    // Set up the partnership
    user1.partnerId = user2Id;
    user2.partnerId = user1Id;

    // Find shared interests
    const sharedInterests = user1.interests.filter(interest => 
      user2.interests.includes(interest)
    );

    // Notify both users they've been matched
    sendToUser(user1Id, {
      type: 'matched',
      data: {
        partnerId: user2Id,
        sharedInterests,
        hasVideo: user1.hasVideo
      }
    });

    sendToUser(user2Id, {
      type: 'matched',
      data: {
        partnerId: user1Id,
        sharedInterests,
        hasVideo: user2.hasVideo
      }
    });
  }

  function endChat(userId: string) {
    const user = onlineUsers.get(userId);
    if (!user || !user.partnerId) return;

    const partnerId = user.partnerId;
    const partner = onlineUsers.get(partnerId);

    // Reset the user's partner
    user.partnerId = null;
    
    // Clear any typing indicators
    typingUsers.delete(userId);

    // Notify the user the chat has ended
    sendToUser(userId, {
      type: 'chat-ended',
      data: {}
    });

    // Notify partner if they're still connected
    if (partner) {
      partner.partnerId = null;
      typingUsers.delete(partnerId);
      sendToUser(partnerId, {
        type: 'chat-ended',
        data: {}
      });
    }
  }

  function handleDisconnect(userId: string) {
    const user = onlineUsers.get(userId);
    if (!user) return;

    // End any active chat
    if (user.partnerId) {
      endChat(userId);
    }

    // Remove from waiting queue
    waitingUsers.delete(userId);

    // Remove from online users
    onlineUsers.delete(userId);
  }

  function handleReport(reporterId: string, reportedId: string, reason: ReportReason, details?: string) {
    const report: Report = {
      userId: reporterId,
      reportedUserId: reportedId,
      reason,
      details,
      timestamp: Date.now()
    };

    // Store the report in memory
    storage.createReport(report);

    // Track reports for automatic moderation
    const reportCount = userReports.get(reportedId) || 0;
    userReports.set(reportedId, reportCount + 1);

    // Check if the user has been reported too many times
    if (reportCount + 1 >= REPORT_THRESHOLD) {
      // Disconnect and ban the user
      const reportedUser = onlineUsers.get(reportedId);
      if (reportedUser && reportedUser.socket) {
        reportedUser.socket.close();
      }
      onlineUsers.delete(reportedId);
    }

    // End the chat between the users
    endChat(reporterId);
  }

  function sendToUser(userId: string, message: any) {
    const user = onlineUsers.get(userId);
    if (!user || !user.socket) return;
    
    // Check if the socket is open before sending (readyState 1 = OPEN)
    if (user.socket.readyState === 1) {
      user.socket.send(JSON.stringify(message));
    }
  }

  // API route to get statistics
  app.get('/api/stats', (req, res) => {
    // Count active chats by converting to array first
    let activeChatsCount = 0;
    Array.from(onlineUsers.values()).forEach(user => {
      if (user.partnerId) activeChatsCount++;
    });
    
    res.json({
      onlineUsers: onlineUsers.size,
      waitingUsers: waitingUsers.size,
      activeChats: Math.floor(activeChatsCount / 2)
    });
  });

  return httpServer;
}

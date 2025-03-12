// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer } from "ws";

// server/storage.ts
var MemStorage = class {
  users;
  reports;
  currentId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.reports = [];
    this.currentId = 1;
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async createReport(report) {
    this.reports.push(report);
  }
  async getReports() {
    return this.reports;
  }
};
var storage = new MemStorage();

// server/routes.ts
import * as crypto from "crypto";
var typingUsers = /* @__PURE__ */ new Map();
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const onlineUsers = /* @__PURE__ */ new Map();
  const waitingUsers = /* @__PURE__ */ new Set();
  const userReports = /* @__PURE__ */ new Map();
  const REPORT_THRESHOLD = 3;
  wss.on("connection", (socket) => {
    const userId = crypto.randomUUID();
    socket.on("message", (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        handleMessage(userId, parsedMessage);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });
    socket.on("close", () => {
      handleDisconnect(userId);
    });
    onlineUsers.set(userId, {
      id: userId,
      socket,
      interests: [],
      hasVideo: false,
      partnerId: null,
      waitingSince: 0,
      blockedUsers: []
    });
    sendToUser(userId, {
      type: "connection",
      data: { userId }
    });
  });
  function handleMessage(userId, message) {
    const user = onlineUsers.get(userId);
    if (!user) return;
    console.log(`Received message from ${userId}:`, message.type);
    switch (message.type) {
      case "start-matching":
        user.interests = message.data.interests || [];
        user.hasVideo = message.data.hasVideo || false;
        startMatching(userId);
        break;
      case "cancel-matching":
        if (waitingUsers.has(userId)) {
          waitingUsers.delete(userId);
        }
        break;
      case "chat-message":
        if (user.partnerId) {
          const partnerId = user.partnerId;
          if (partnerId.startsWith("test-bot-")) {
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith("test-bot-")) {
                sendToUser(userId, {
                  type: "chat-message",
                  data: {
                    id: crypto.randomUUID(),
                    senderId: partnerId,
                    content: `You said: "${message.data.content}". This is a test bot response to help you test the chat functionality.`,
                    timestamp: Date.now()
                  }
                });
              }
            }, 1e3);
          } else {
            sendToUser(partnerId, {
              type: "chat-message",
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
      case "end-chat":
        endChat(userId);
        break;
      case "find-new-chat":
        endChat(userId);
        startMatching(userId);
        break;
      case "report-user":
        if (user.partnerId) {
          handleReport(userId, user.partnerId, message.data.reason, message.data.details);
        }
        break;
      // WebRTC signaling messages
      case "webrtc-offer":
      case "webrtc-answer":
      case "webrtc-ice-candidate":
        if (user.partnerId) {
          if (!user.partnerId.startsWith("test-bot-")) {
            sendToUser(user.partnerId, message);
          }
        }
        break;
      case "typing-status":
        if (user.partnerId) {
          typingUsers.set(userId, message.data.isTyping);
          if (!user.partnerId.startsWith("test-bot-")) {
            sendToUser(user.partnerId, {
              type: "typing-status",
              data: { isTyping: message.data.isTyping }
            });
          } else if (message.data.isTyping) {
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith("test-bot-")) {
                sendToUser(userId, {
                  type: "typing-status",
                  data: { isTyping: true }
                });
                setTimeout(() => {
                  if (user.partnerId && user.partnerId.startsWith("test-bot-")) {
                    sendToUser(userId, {
                      type: "typing-status",
                      data: { isTyping: false }
                    });
                    sendToUser(userId, {
                      type: "chat-message",
                      data: {
                        id: crypto.randomUUID(),
                        senderId: user.partnerId,
                        content: "I see you're typing something! I'm a test bot that can respond to typing indicators.",
                        timestamp: Date.now()
                      }
                    });
                  }
                }, 2e3);
              }
            }, 1e3);
          }
        }
        break;
      case "message-read":
        if (user.partnerId) {
          const messageId = message.data.messageId;
          if (user.partnerId.startsWith("test-bot-")) {
            setTimeout(() => {
              if (user.partnerId && user.partnerId.startsWith("test-bot-")) {
                sendToUser(userId, {
                  type: "message-read",
                  data: { messageId }
                });
              }
            }, 1e3);
          } else {
            sendToUser(user.partnerId, {
              type: "message-read",
              data: { messageId }
            });
          }
        }
        break;
      case "block-user":
        if (user.partnerId) {
          const partnerIdToBlock = user.partnerId;
          if (!partnerIdToBlock.startsWith("test-bot-")) {
            if (!user.blockedUsers.includes(partnerIdToBlock)) {
              user.blockedUsers.push(partnerIdToBlock);
            }
            sendToUser(userId, {
              type: "block-success",
              data: { blockedUserId: partnerIdToBlock }
            });
            endChat(userId);
          }
        }
        break;
    }
  }
  function startMatching(userId) {
    const user = onlineUsers.get(userId);
    if (!user) return;
    if (user.partnerId) {
      endChat(userId);
    }
    waitingUsers.add(userId);
    user.waitingSince = Date.now();
    findMatch(userId);
    sendToUser(userId, {
      type: "matching",
      data: { status: "searching" }
    });
    setTimeout(() => {
      if (waitingUsers.has(userId)) {
        createTestPartner(userId);
      }
    }, 3e3);
  }
  function createTestPartner(userId) {
    const user = onlineUsers.get(userId);
    if (!user || !waitingUsers.has(userId)) return;
    const testPartnerId = "test-bot-" + crypto.randomUUID();
    waitingUsers.delete(userId);
    user.partnerId = testPartnerId;
    const sharedInterests = user.interests.length > 0 ? [user.interests[0]] : ["movies", "music"];
    sendToUser(userId, {
      type: "matched",
      data: {
        partnerId: testPartnerId,
        sharedInterests,
        hasVideo: user.hasVideo
      }
    });
    if (user.hasVideo) {
      setTimeout(() => {
        if (user.partnerId === testPartnerId) {
          sendToUser(userId, {
            type: "webrtc-offer",
            data: {
              partnerId: testPartnerId,
              offer: {
                type: "offer",
                sdp: "test sdp"
                // Dummy SDP data
              }
            }
          });
        }
      }, 1e3);
    }
    setTimeout(() => {
      if (user.partnerId === testPartnerId) {
        sendToUser(userId, {
          type: "chat-message",
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
  function findMatch(userId) {
    const user = onlineUsers.get(userId);
    if (!user || !waitingUsers.has(userId)) return;
    let bestMatchId = null;
    let bestMatchScore = -1;
    Array.from(waitingUsers).forEach((waitingUserId) => {
      if (waitingUserId === userId) return;
      const potentialMatch = onlineUsers.get(waitingUserId);
      if (!potentialMatch) return;
      if (user.hasVideo !== potentialMatch.hasVideo) return;
      if (user.blockedUsers.includes(waitingUserId) || potentialMatch.blockedUsers.includes(userId)) return;
      const sharedInterests = user.interests.filter(
        (interest) => potentialMatch.interests.includes(interest)
      );
      const waitingTimeScore = Math.min(
        (Date.now() - potentialMatch.waitingSince) / 1e4,
        5
      );
      const interestScore = sharedInterests.length * 2;
      const score = waitingTimeScore + interestScore;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchId = waitingUserId;
      }
    });
    if (bestMatchId) {
      connectUsers(userId, bestMatchId);
    }
  }
  function connectUsers(user1Id, user2Id) {
    const user1 = onlineUsers.get(user1Id);
    const user2 = onlineUsers.get(user2Id);
    if (!user1 || !user2) return;
    waitingUsers.delete(user1Id);
    waitingUsers.delete(user2Id);
    user1.partnerId = user2Id;
    user2.partnerId = user1Id;
    const sharedInterests = user1.interests.filter(
      (interest) => user2.interests.includes(interest)
    );
    sendToUser(user1Id, {
      type: "matched",
      data: {
        partnerId: user2Id,
        sharedInterests,
        hasVideo: user1.hasVideo
      }
    });
    sendToUser(user2Id, {
      type: "matched",
      data: {
        partnerId: user1Id,
        sharedInterests,
        hasVideo: user2.hasVideo
      }
    });
  }
  function endChat(userId) {
    const user = onlineUsers.get(userId);
    if (!user || !user.partnerId) return;
    const partnerId = user.partnerId;
    const partner = onlineUsers.get(partnerId);
    user.partnerId = null;
    typingUsers.delete(userId);
    sendToUser(userId, {
      type: "chat-ended",
      data: {}
    });
    if (partner) {
      partner.partnerId = null;
      typingUsers.delete(partnerId);
      sendToUser(partnerId, {
        type: "chat-ended",
        data: {}
      });
    }
  }
  function handleDisconnect(userId) {
    const user = onlineUsers.get(userId);
    if (!user) return;
    if (user.partnerId) {
      endChat(userId);
    }
    waitingUsers.delete(userId);
    onlineUsers.delete(userId);
  }
  function handleReport(reporterId, reportedId, reason, details) {
    const report = {
      userId: reporterId,
      reportedUserId: reportedId,
      reason,
      details,
      timestamp: Date.now()
    };
    storage.createReport(report);
    const reportCount = userReports.get(reportedId) || 0;
    userReports.set(reportedId, reportCount + 1);
    if (reportCount + 1 >= REPORT_THRESHOLD) {
      const reportedUser = onlineUsers.get(reportedId);
      if (reportedUser && reportedUser.socket) {
        reportedUser.socket.close();
      }
      onlineUsers.delete(reportedId);
    }
    endChat(reporterId);
  }
  function sendToUser(userId, message) {
    const user = onlineUsers.get(userId);
    if (!user || !user.socket) return;
    if (user.socket.readyState === 1) {
      user.socket.send(JSON.stringify(message));
    }
  }
  app2.get("/api/stats", (req, res) => {
    let activeChatsCount = 0;
    Array.from(onlineUsers.values()).forEach((user) => {
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

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.PORT || 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  }).on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      log(`Port ${port} is already in use. Trying to close existing process...`);
      setTimeout(() => {
        log(`Attempting to restart on port ${port}...`);
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true
        });
      }, 3e3);
    } else {
      log(`Server error: ${error.message}`);
      throw error;
    }
  });
})();

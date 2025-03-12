import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const reportReasons = [
  "inappropriate",
  "spam",
  "offensive",
  "other",
] as const;

export const interests = [
  "Music",
  "Movies",
  "Sports",
  "Gaming",
  "Technology",
  "Art",
  "Travel",
  "Food",
  "Fashion",
  "Books",
  "Science",
  "Photography",
  "History",
  "Fitness",
  "Politics",
  "Languages",
  "Dance",
  "Writing",
  "Cooking",
  "Pets",
  "Nature",
  "Programming",
  "Education",
  "Design",
  "Cars",
] as const;

export type Interest = typeof interests[number];
export type ReportReason = typeof reportReasons[number];

export interface ChatUser {
  id: string;
  interests: Interest[];
  hasVideo: boolean;
  blockedUsers?: string[]; // List of blocked user IDs
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  read?: boolean;
}

export interface Report {
  userId: string;
  reportedUserId: string;
  reason: ReportReason;
  details?: string;
  timestamp: number;
}

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

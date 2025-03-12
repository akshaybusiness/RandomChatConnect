import { Interest, ReportReason } from "@shared/schema";

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  read?: boolean;
}

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface WebRTCSignal {
  type: string;
  sdp?: string;
  candidate?: RTCIceCandidate;
}

export type ScreenState = "welcome" | "matching" | "chat";

export interface UserPreferences {
  interests: Interest[];
  hasVideo: boolean;
}

export interface MatchData {
  partnerId: string;
  sharedInterests: Interest[];
  hasVideo: boolean;
}

export interface ReportFormData {
  reason: ReportReason;
  details: string;
}

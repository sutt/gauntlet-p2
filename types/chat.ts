// Minimal types for Milestone 1: "Hello Chat"
// We'll expand these as needed in later milestones

// Milestone 7: Message status for optimistic UI
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string; // Will add in Milestone 3
  timestamp: Date;
  conversationId: string;

  // Milestone 9: Read receipts - map of userId -> timestamp when they read it
  readBy?: Record<string, Date>;

  // Milestone 7: Optimistic UI fields (client-only, not stored in Firestore)
  status?: MessageStatus; // 'sending' | 'sent' | 'failed'
  tempId?: string; // Temporary ID for pending messages
}

// Milestone 10: Conversation types
export type ConversationType = 'direct' | 'group';

export interface Conversation {
  id: string;
  participants: string[]; // Array of user IDs
  type?: ConversationType; // Milestone 10: 'direct' or 'group'
  groupName?: string; // Milestone 10: Auto-generated or custom name for groups
  lastMessage?: string; // Milestone 5: Preview text
  lastMessageTime?: Date; // Milestone 5: For sorting
  lastMessageSenderId?: string; // Milestone 5: Who sent it
  createdAt?: Date; // Milestone 5: Conversation creation time
  createdBy?: string; // Milestone 5: Conversation creator
}

// User interface (will expand in Milestone 3)
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt?: Date;
  // Milestone 8: Online status tracking
  lastSeen?: Date;
  online?: boolean; // Computed client-side: lastSeen < 2 minutes ago
  pushTokens?: string[]; // For future push notifications
}

// Minimal types for Milestone 1: "Hello Chat"
// We'll expand these as needed in later milestones

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string; // Will add in Milestone 3
  timestamp: Date;
  conversationId: string;
}

export interface Conversation {
  id: string;
  participants: string[]; // Array of user IDs
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
}

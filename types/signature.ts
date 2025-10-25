import type { Timestamp } from 'firebase/firestore';

/**
 * Signed payload structure - the data that gets signed
 * Version 2.0: Server-side crypto implementation
 */
export interface SignedPayload {
  // Version and metadata
  version: string;                 // "2.0"
  timestamp: number;               // Unix timestamp (ms) - set by server
  signedAt: string;                // ISO 8601 date string - set by server
  nonce: string;                   // Random value for replay protection - set by server

  // Signer identity
  signerId: string;                // User email

  // Conversation context
  conversationId: string;
  participants: {
    email: string;
    displayName: string;
  }[];

  // Messages (client-provided, trusted for POC)
  messages: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    sentAt: string;                // ISO 8601
  }[];

  // User-provided metadata
  purpose?: string;                // "approval", "attestation", etc.
  notes?: string;                  // Free-form user notes
}

/**
 * Signature document (client-side representation)
 * Fetched from: users/{uid}/signatures/{signatureId}
 */
export interface Signature {
  signatureId: string;             // Document ID
  signedPayload: SignedPayload;    // The payload that was signed
  pgpSignature: string;            // Armored PGP signature
  createdAt: Date;                 // When signature was created (converted from Timestamp)
  conversationId: string;          // Parent conversation
  messageIds: string[];            // Message IDs included in signature
  purpose?: string;                // Purpose

  // Verification status
  verified: boolean;               // True if signature is cryptographically valid
  verifiedAt?: Date;               // When verification happened (converted from Timestamp)
  verifiedBy?: string;             // "ai-agent-verification"
  verificationError?: string;      // Error message if verification failed
}

/**
 * Response from generateKeysForUser Cloud Function
 */
export interface GenerateKeysResponse {
  success: boolean;
  publicKey?: string;
  fingerprint?: string;
  message?: string;                // Error message if success = false
}

/**
 * Response from signMessages Cloud Function
 */
export interface SignMessagesResponse {
  success: boolean;
  signatureId?: string;
  pgpSignature?: string;
  message?: string;                // Error message if success = false
  timings?: {
    signing: number;               // Time spent signing (ms)
    total: number;                 // Total time (ms)
  };
}

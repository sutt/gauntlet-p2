import type { Timestamp } from 'firebase-admin/firestore';

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
 * Signature document stored in Firestore
 * Location: users/{uid}/signatures/{signatureId}
 */
export interface SignatureDocument {
  signatureId: string;             // Document ID
  signedPayload: SignedPayload;    // The payload that was signed
  pgpSignature: string;            // Armored PGP signature
  createdAt: Timestamp;            // When signature was created
  conversationId: string;          // Parent conversation
  messageIds: string[];            // Message IDs included in signature
  purpose?: string;                // Purpose (duplicated from payload for queries)

  // Verification status (set by AI agent trigger)
  verified: boolean;               // True if signature is cryptographically valid
  verifiedAt?: Timestamp;          // When verification happened
  verifiedBy?: string;             // "ai-agent-verification"
  verificationError?: string;      // Error message if verification failed
}

/**
 * User document with signature keys
 * Location: users/{uid}
 */
export interface UserSignatureFields {
  publicKey?: string;              // PGP public key (armored, unencrypted)
  privateKey?: string;             // PGP private key (armored, unencrypted - POC only)
  publicKeyFingerprint?: string;   // 40-character hex fingerprint
  publicKeyCreatedAt?: Timestamp;  // When keys were generated
  signatureKeysVersion?: string;   // "2.0"
}

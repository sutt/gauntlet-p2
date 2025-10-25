# Digital Signatures v2 - Architecture (Server-Side Crypto)

## Document Overview
**Version**: 2.0
**Date**: 2025-10-25
**Status**: Planning Phase
**Based on**: Confirmed architectural decisions in architecture-decisions.md

This document outlines the system architecture for server-side digital signatures implementation.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Model](#data-model)
3. [API Design](#api-design)
4. [Security Architecture](#security-architecture)
5. [Performance Considerations](#performance-considerations)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                                │
│                  (React Native + Expo)                           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐       │
│  │  UI Screens  │  │  Services    │  │  State Mgmt     │       │
│  │              │  │              │  │                 │       │
│  │ - Settings   │  │ - signatures │  │ - React Context │       │
│  │ - Chat       │  │ - firebase   │  │ - Local State   │       │
│  │ - Drawer     │  │              │  │                 │       │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────┘       │
│         │                 │                                      │
│         └─────────────────┴──────────────────────────────────────│
│                           │                                      │
│              NO CRYPTO LIBRARIES ON CLIENT                       │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
              Firebase SDK (HTTPS Callable Functions)
                            │
┌───────────────────────────┼──────────────────────────────────────┐
│                    BACKEND LAYER                                  │
│          (Firebase Cloud Functions - Node.js 20)                  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Cloud Functions (Callable)                     │  │
│  │                                                              │  │
│  │  ├─ generateKeysForUser()  - Generate ECC key pair         │  │
│  │  ├─ signMessages()          - Sign message payload          │  │
│  │  └─ getPublicKey()          - Lookup public key by email    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│  ┌────────────────────────┴───────────────────────────────────┐  │
│  │              Cloud Functions (Triggers)                     │  │
│  │                                                              │  │
│  │  └─ onSignatureCreated()    - Verify & process signatures   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│  ┌────────────────────────┴───────────────────────────────────┐  │
│  │              Crypto Services                                │  │
│  │              (OpenPGP.js)                                   │  │
│  │                                                              │  │
│  │  ├─ generateECCKeys()      - ECC Curve25519 generation     │  │
│  │  ├─ signPayload()          - PGP sign JSON payload          │  │
│  │  └─ verifySignature()      - PGP verify signature           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────────┐
│                   Firebase Services                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Firestore                                                │    │
│  │                                                            │    │
│  │  ├─ users/{uid}                                           │    │
│  │  │   ├─ publicKey (string)                                │    │
│  │  │   ├─ privateKey (string, unencrypted)                  │    │
│  │  │   └─ publicKeyFingerprint (string)                     │    │
│  │  │                                                         │    │
│  │  ├─ users/{uid}/signatures/{sigId}                        │    │
│  │  │   ├─ signedPayload (object)                            │    │
│  │  │   ├─ pgpSignature (string)                             │    │
│  │  │   ├─ verified (boolean)                                │    │
│  │  │   └─ ... metadata                                      │    │
│  │  │                                                         │    │
│  │  └─ conversations/{convId}/messages/{msgId}               │    │
│  │      ├─ signatureIds (array)                              │    │
│  │      └─ signatureCount (number)                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Authentication                                           │    │
│  │  - Firebase Auth (used for authorization)                │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Firestore Collections

#### `users/{userId}`

User profile with PGP keys:

```typescript
interface UserDocument {
  // Existing fields
  id: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;

  // Digital signature fields (POC)
  publicKey?: string;              // PGP public key (armored, unencrypted)
  privateKey?: string;             // PGP private key (armored, unencrypted)
  publicKeyFingerprint?: string;   // 40-character hex fingerprint
  publicKeyCreatedAt?: Timestamp;  // When keys were generated
  signatureKeysVersion?: string;   // "2.0"
}
```

**Security Note (POC)**: Private keys stored unencrypted. Trust server model. Anyone with Firestore admin access can forge signatures. Production should encrypt or use HSM.

**Indexes**:
- `email` (for public key lookup by email)

---

#### `users/{userId}/signatures/{signatureId}`

Signatures created by user:

```typescript
interface SignatureDocument {
  signatureId: string;             // Auto-generated ID

  // Signed payload (the content that was signed)
  signedPayload: SignedPayload;    // See below

  // PGP signature
  pgpSignature: string;            // Armored PGP signature

  // Metadata
  createdAt: Timestamp;
  conversationId: string;
  messageIds: string[];            // Messages included in signature
  purpose?: string;                // e.g., "approval", "attestation"

  // Verification (set by AI agent)
  verified: boolean;               // True if signature is cryptographically valid
  verifiedAt?: Timestamp;          // When verification happened
  verifiedBy?: string;             // "ai-agent-verification"
}
```

**Indexes**:
- `createdAt DESC` (for drawer list)
- `conversationId` (for conversation queries)
- `verified` (for agent queries)

---

#### `SignedPayload` Structure

The payload that gets signed:

```typescript
interface SignedPayload {
  // Version and metadata
  version: string;                 // "2.0"
  timestamp: number;               // Unix timestamp (ms)
  signedAt: string;                // ISO 8601 date string
  nonce: string;                   // Random value for replay protection

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
```

**Security Note (POC)**: Client provides message data, server trusts it. Malicious client could inject fake messages. Production should re-fetch from Firestore.

---

#### `conversations/{convId}/messages/{msgId}`

Enhanced message document with signature references:

```typescript
interface MessageDocument {
  // Existing fields...
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;

  // Signature fields
  signatureIds?: string[];         // Array of signature IDs referencing this message
  signatureCount?: number;         // Quick count for UI badge
}
```

**Indexes**:
- `signatureCount` (for queries)

---

## API Design

### Cloud Functions (Callable)

#### `generateKeysForUser`

Generate ECC key pair for authenticated user.

**Request**:
```typescript
// No parameters needed - uses authenticated user from context
{}
```

**Response**:
```typescript
{
  success: boolean;
  publicKey: string;        // Armored public key
  fingerprint: string;      // 40-character hex
  message?: string;         // Error message if success = false
}
```

**Implementation**:
```typescript
export const generateKeysForUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    // 1. Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email!;

    // 2. Check if keys already exist
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (userDoc.data()?.publicKey) {
      throw new HttpsError('already-exists', 'Keys already generated');
    }

    // 3. Generate ECC Curve25519 key pair
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'ecc',
      curve: 'curve25519',
      userIDs: [{ email: userEmail }],
      format: 'armored'
      // No passphrase
    });

    // 4. Get fingerprint
    const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
    const fingerprint = publicKeyObj.getFingerprint();

    // 5. Store in Firestore (unencrypted)
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update({
        publicKey,
        privateKey,  // Stored unencrypted for POC
        publicKeyFingerprint: fingerprint,
        publicKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        signatureKeysVersion: '2.0'
      });

    return {
      success: true,
      publicKey,
      fingerprint
    };
  }
);
```

**Performance**: ~300-500ms (key generation + network)

---

#### `signMessages`

Sign a set of messages with user's private key.

**Request**:
```typescript
{
  conversationId: string;
  payload: SignedPayload;      // Client-built payload (trusted for POC)
}
```

**Response**:
```typescript
{
  success: boolean;
  signatureId: string;
  pgpSignature: string;        // Armored signature
  message?: string;            // Error if success = false
}
```

**Implementation**:
```typescript
export const signMessages = onCall(
  { region: 'us-central1' },
  async (request) => {
    // 1. Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const userId = request.auth.uid;
    const { conversationId, payload } = request.data;

    // 2. Validate input
    if (!conversationId || !payload) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // 3. Validate user is participant in conversation
    const conv = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!conv.exists || !conv.data()!.participants.includes(userId)) {
      throw new HttpsError('permission-denied', 'Not a conversation participant');
    }

    // 4. Fetch user's private key
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const privateKeyArmored = userDoc.data()?.privateKey;
    if (!privateKeyArmored) {
      throw new HttpsError('failed-precondition', 'No keys found. Generate keys first.');
    }

    // 5. Add server metadata to payload
    payload.timestamp = Date.now();
    payload.signedAt = new Date().toISOString();
    payload.nonce = generateNonce();
    payload.version = '2.0';

    // 6. Serialize payload
    const payloadText = JSON.stringify(payload, null, 2);

    // 7. Sign payload
    const privateKey = await openpgp.readPrivateKey({
      armoredKey: privateKeyArmored
      // No passphrase to decrypt
    });

    const message = await openpgp.createMessage({ text: payloadText });
    const signature = await openpgp.sign({
      message,
      signingKeys: privateKey,
      format: 'armored',
      detached: false
    });

    // 8. Create signature document
    const signatureId = admin.firestore().collection('_').doc().id;
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('signatures')
      .doc(signatureId)
      .set({
        signatureId,
        signedPayload: payload,
        pgpSignature: signature,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        conversationId,
        messageIds: payload.messages.map(m => m.messageId),
        purpose: payload.purpose,
        verified: false  // Will be set by trigger
      });

    // 9. Update message documents (batch)
    const batch = admin.firestore().batch();
    payload.messages.forEach(msg => {
      const msgRef = admin.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(msg.messageId);

      batch.update(msgRef, {
        signatureIds: admin.firestore.FieldValue.arrayUnion(signatureId),
        signatureCount: admin.firestore.FieldValue.increment(1)
      });
    });
    await batch.commit();

    return {
      success: true,
      signatureId,
      pgpSignature: signature
    };
  }
);

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
```

**Performance**: ~200-400ms (signing + Firestore writes + network)

---

#### `getPublicKey`

Lookup user's public key by email (for verification).

**Request**:
```typescript
{
  email: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  publicKey?: string;
  fingerprint?: string;
  message?: string;
}
```

**Implementation**:
```typescript
export const getPublicKey = onCall(
  { region: 'us-central1' },
  async (request) => {
    const { email } = request.data;

    if (!email) {
      throw new HttpsError('invalid-argument', 'Email required');
    }

    // Query users by email
    const userQuery = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const userData = userQuery.docs[0].data();

    if (!userData.publicKey) {
      return {
        success: false,
        message: 'User has not generated keys'
      };
    }

    return {
      success: true,
      publicKey: userData.publicKey,
      fingerprint: userData.publicKeyFingerprint
    };
  }
);
```

**Performance**: ~50-100ms

---

### Cloud Functions (Triggers)

#### `onSignatureCreated`

Automatically verify signatures when created, make payload available to AI agents.

**Trigger**: `onCreate` on `users/{userId}/signatures/{signatureId}`

**Implementation**:
```typescript
export const onSignatureCreated = onDocumentCreated(
  'users/{userId}/signatures/{signatureId}',
  async (event) => {
    const signature = event.data?.data();
    if (!signature) return;

    const signatureId = event.params.signatureId;
    const userId = event.params.userId;

    console.log(`[SIG-VERIFY] Processing signature ${signatureId}`);

    // 1. Fetch signer's public key
    const signerEmail = signature.signedPayload.signerId;

    const userQuery = await admin.firestore()
      .collection('users')
      .where('email', '==', signerEmail)
      .limit(1)
      .get();

    if (userQuery.empty) {
      console.error('[SIG-VERIFY] Signer not found:', signerEmail);
      await event.data.ref.update({
        verified: false,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationError: 'Signer not found'
      });
      return;
    }

    const publicKey = userQuery.docs[0].data().publicKey;

    if (!publicKey) {
      console.error('[SIG-VERIFY] Signer has no public key');
      await event.data.ref.update({
        verified: false,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationError: 'No public key'
      });
      return;
    }

    // 2. Verify signature
    try {
      const payloadText = JSON.stringify(signature.signedPayload, null, 2);

      const message = await openpgp.readMessage({
        armoredMessage: signature.pgpSignature
      });

      const publicKeyObj = await openpgp.readKey({
        armoredKey: publicKey
      });

      const verificationResult = await openpgp.verify({
        message,
        verificationKeys: publicKeyObj
      });

      const verified = await verificationResult.signatures[0].verified;

      console.log(`[SIG-VERIFY] Signature ${signatureId} verified:`, verified);

      // 3. Update verification status
      await event.data.ref.update({
        verified,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedBy: 'ai-agent-verification'
      });

      // 4. If verified, make payload available to AI agent
      if (verified) {
        await processVerifiedSignature(signature, signatureId, userId);
      }

    } catch (error) {
      console.error('[SIG-VERIFY] Verification failed:', error);
      await event.data.ref.update({
        verified: false,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verificationError: error.message
      });
    }
  }
);

async function processVerifiedSignature(
  signature: any,
  signatureId: string,
  userId: string
) {
  console.log('[AI-AGENT] Processing verified signature:', signatureId);

  // Extract payload
  const payload = signature.signedPayload;

  console.log('[AI-AGENT] Payload:', {
    signer: payload.signerId,
    conversationId: payload.conversationId,
    messageCount: payload.messages.length,
    purpose: payload.purpose,
    timestamp: payload.timestamp
  });

  console.log('[AI-AGENT] Messages in signature:');
  payload.messages.forEach((msg: any, i: number) => {
    console.log(`  ${i + 1}. [${msg.senderName}]: ${msg.text}`);
  });

  // AI agent can now use this payload in decision making
  // For POC: Just log it
  // Future: Extract approval details, create action items, etc.

  console.log('[AI-AGENT] ✓ Signature verified and payload extracted');
  console.log('[AI-AGENT] Payload is now available for agent decision-making context');
}
```

**Performance**: ~100-200ms

---

## Security Architecture

### Threat Model (POC)

**Threats Mitigated**:
- ✅ **Signature forgery after signing**: Valid signatures cannot be forged by anyone without private key
- ✅ **Tamper detection**: Modified signatures fail verification
- ✅ **Replay detection**: Nonce in payload prevents replay attacks

**Accepted Risks (POC)**:
- ⚠️ **Server compromise**: Server has unencrypted private keys, can forge signatures
- ⚠️ **Firestore access**: Anyone with admin access can forge signatures
- ⚠️ **Client tampering**: Client can inject fake messages into payload
- ⚠️ **No passphrase**: User doesn't control key encryption
- ⚠️ **No key rotation**: Keys are permanent once generated
- ⚠️ **No revocation**: No way to revoke compromised keys

**Production Path**:
- Encrypt private keys with user passphrase or HSM
- Server validates payload by re-fetching from Firestore
- Implement key rotation and revocation
- Add biometric authorization for signing
- Use Cloud KMS or HSM for key storage

---

### Authentication & Authorization

**User Authentication**:
- Firebase Authentication (email/password, OAuth, etc.)
- Auth token passed automatically by Firebase SDK

**Authorization Model**:

| Operation | Authorization Check |
|-----------|---------------------|
| Generate keys | Authenticated user only, once per user |
| Sign messages | Authenticated user + conversation participant |
| View own signatures | Authenticated user (Firestore rules) |
| Verify signatures | AI agent (server-side, admin access) |
| Get public key | Anyone (public keys are public) |

**Firestore Security Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own signature documents
    match /users/{userId}/signatures/{signatureId} {
      allow read: if request.auth.uid == userId;
      allow create: if false;  // Only server can create
      allow update, delete: if false;  // Immutable
    }

    // Messages can be updated with signatureIds by server
    match /conversations/{convId}/messages/{msgId} {
      // Existing message rules...
      allow update: if /* existing rules + server can add signatureIds */;
    }
  }
}
```

---

## Performance Considerations

### Latency Targets

| Operation | Client Latency | Server Execution | Target |
|-----------|----------------|------------------|--------|
| Generate keys | 300-800ms | 200-500ms | < 1s |
| Sign messages | 200-500ms | 100-300ms | < 1s |
| Verify signature | N/A (server-only) | 50-100ms | < 200ms |
| Get public key | 100-200ms | 20-50ms | < 300ms |

**Notes**:
- Client latency includes network round-trip
- ECC Curve25519 is fast (~100ms signing on server)
- Most latency is network + Firestore reads/writes
- POC target: < 1 second for all user-facing operations

---

### Optimization Strategies (Future)

**Caching**:
- Cache public keys in memory (rarely change)
- Cache user's decrypted private key for session (if adding passphrases)

**Batching**:
- Batch message document updates (already implemented)
- Consider batching multiple signature verifications

**Connection Pooling**:
- OpenPGP.js operations are CPU-bound, not I/O
- No connection pooling needed

---

### Cost Estimates

**POC Scale** (10 users, 100 signatures/month):
- Cloud Functions: $0 (free tier)
- Firestore: $0 (free tier)
- **Total: $0/month**

**Production Scale** (1,000 users, 10K signatures/month):
- Cloud Functions: ~$0.15/month
- Firestore: ~$0.50/month
- **Total: ~$0.65/month**

Signatures are extremely cheap at scale.

---

## Technology Stack

### Server-Side

| Package | Version | Purpose |
|---------|---------|---------|
| `openpgp` | ^5.11.0 | PGP key generation, signing, verification |
| `firebase-functions` | ^5.0.0 | Cloud Functions framework |
| `firebase-admin` | ^12.0.0 | Firestore access |

### Client-Side

| Package | Purpose |
|---------|---------|
| `firebase` | Firestore, Auth, callable functions |
| **No crypto libraries** | All crypto happens server-side |

---

## Summary

This architecture provides:

✅ **Simple POC Implementation**
- No client-side crypto complexity
- Works around React Native/Expo package issues
- Focuses on proving signature workflow

✅ **Working Signatures**
- Cryptographically valid PGP signatures
- Tamper detection
- Replay protection (nonce)

✅ **AI Agent Integration**
- Agent verifies signatures automatically
- Extracts payload from verified signatures
- Uses payload as context for decisions

⚠️ **Known POC Limitations**
- Trust the server security model
- Trust client-provided payload
- No passphrases or key encryption
- No key rotation or revocation

📝 **Clear Production Path**
- Add passphrase/HSM for keys
- Server-side payload validation
- Key rotation and revocation
- Biometric authorization

---

**Document Version**: 2.0
**Status**: Ready for Implementation
**Next Document**: workflows-sig2.md

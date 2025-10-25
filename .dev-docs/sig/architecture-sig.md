# Digital Signatures - Architecture

## Document Overview
**Version**: 1.0
**Date**: 2025-10-23
**Status**: Planning Phase

This document outlines the system architecture, package structure, and technical infrastructure for digital signatures integration.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Package Structure](#package-structure)
3. [Technology Stack](#technology-stack)
4. [Data Flow](#data-flow)
5. [Infrastructure Components](#infrastructure-components)
6. [Security Architecture](#security-architecture)
7. [Scalability Considerations](#scalability-considerations)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                   (React Native + Expo)                              │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   UI Components  │  │  Signature Svc   │  │   State Mgmt     │  │
│  │                  │  │                  │  │                  │  │
│  │ - SignatureModal │  │ - generateKeys() │  │ - React Context  │  │
│  │ - SignatureCard  │  │ - createSign()   │  │ - Selection State│  │
│  │ - DrawerTab      │  │ - verifySign()   │  │                  │  │
│  │ - ProposalReview │  │ - OpenPGP.js     │  │                  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘  │
│           │                     │                                    │
│           └─────────────────────┼────────────────────────────────────│
│                                 │                                    │
│                      Client-side signing (ECC Curve25519)            │
│                      OpenPGP.js (~10-20ms signing)                   │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                    Firebase SDK (Firestore + Callable Functions)
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                      BACKEND LAYER                                    │
│                (Firebase Cloud Functions - Node.js 20)                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway Layer                          │   │
│  │  (Cloud Functions - Callable & Triggers)                      │   │
│  │                                                                │   │
│  │  ├─ verifySignatureForAgent (callable) - Manual verification │   │
│  │  ├─ onSignatureCreated (trigger) - Auto verify new sigs      │   │
│  │  └─ getPublicKey (callable) - Lookup user's public key       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                    │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │                     Agent Layer                               │   │
│  │  (Business Logic - Signature Agents)                          │   │
│  │                                                                │   │
│  │  ├─ approvalAgent.ts      - Process approval signatures      │   │
│  │  ├─ decisionAgent.ts      - Track multi-party decisions      │   │
│  │  ├─ attestationAgent.ts   - Record verified statements       │   │
│  │  └─ delegationAgent.ts    - Manage authorization chains      │   │
│  └────────────────────────────────────────────────────────────┘     │
│                                 │                                    │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │                   Service Layer                               │   │
│  │  (Shared Utilities)                                           │   │
│  │                                                                │   │
│  │  ├─ signatureVerification.ts - Verify PGP signatures         │   │
│  │  ├─ publicKeyLookup.ts       - Query user by email           │   │
│  │  ├─ payloadExtraction.ts     - Parse signed payloads         │   │
│  │  └─ actionItemService.ts     - Create action items           │   │
│  └────────────────────────────────────────────────────────────┘     │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
            ┌─────────────────────┴──────────────────────┐
            │                                             │
┌───────────┴──────────┐                    ┌────────────┴──────────┐
│   Crypto Library     │                    │  Firebase Services     │
│                      │                    │                        │
│  ┌────────────────┐  │                    │  ┌──────────────────┐ │
│  │  OpenPGP.js    │  │                    │  │  Firestore       │ │
│  │                │  │                    │  │                  │ │
│  │ - ECC Curve25519│ │                    │  │  users/{uid}/    │ │
│  │ - Key Gen      │  │                    │  │  ├─ signatures/  │ │
│  │ - Sign/Verify  │  │                    │  │  └─ collected_   │ │
│  │ - RFC 4880     │  │                    │  │     signatures/  │ │
│  └────────────────┘  │                    │  │                  │ │
│                      │                    │  │  conversations/  │ │
└──────────────────────┘                    │  │  └─ messages/    │ │
                                            │  │                  │ │
                                            │  │  actionItems/    │ │
                                            │  │  signature_      │ │
                                            │  │  proposals/      │ │
                                            │  └──────────────────┘ │
                                            │                        │
                                            │  ┌──────────────────┐ │
                                            │  │  Authentication  │ │
                                            │  │  - Firebase Auth │ │
                                            │  └──────────────────┘ │
                                            └────────────────────────┘
```

---

## Package Structure

### Project Directory Layout

```
hello-expo/                              # Root project directory
├── app/                                  # Expo Router screens (existing)
│   ├── (tabs)/
│   │   ├── chats.tsx                    # Enhanced with signature options
│   │   └── signatures.tsx               # NEW: Signature drawer tab
│   ├── chat/
│   │   └── [id].tsx                     # Enhanced: long-press menu
│   ├── signatures/
│   │   └── [id].tsx                     # NEW: Signature detail view
│   ├── proposals/
│   │   └── [id].tsx                     # NEW: Proposal review screen
│   └── settings/
│       └── signature-setup.tsx          # NEW: Key generation screen
│
├── components/                           # Reusable UI components
│   ├── signatures/                       # NEW: Signature components
│   │   ├── SignatureModal.tsx           # Create signature modal
│   │   ├── SignatureCard.tsx            # Signature list item
│   │   ├── SignatureDetailView.tsx      # Detail view component
│   │   ├── SignatureProposal.tsx        # Proposal UI
│   │   ├── MessageSignatureBadge.tsx    # Badge on messages
│   │   └── SelectionOverlay.tsx         # Message selection UI
│   └── MessageBubble.tsx                # Modified: add signature badge
│
├── services/                             # Business logic services
│   └── signatures.ts                     # NEW: Signature operations
│       ├─ generateKeys()
│       ├─ createSignature()
│       ├─ verifySignature()
│       ├─ hasKeys()
│       └─ getPublicKey()
│
├── hooks/                                # Custom React hooks
│   ├── useMessageSelection.ts            # NEW: Contiguous selection
│   ├── useSignatures.ts                  # NEW: Signature CRUD
│   └── useProposals.ts                   # NEW: Proposal management
│
├── types/
│   └── signature.ts                      # NEW: TypeScript types
│       ├─ PGPKeyPair
│       ├─ SignedPayload
│       ├─ Signature
│       └─ SignatureProposal
│
├── utils/
│   └── crypto.ts                         # NEW: Crypto utilities
│       ├─ generateNonce()
│       └─ formatFingerprint()
│
└── functions/                            # Firebase Cloud Functions
    ├── src/
    │   ├── index.ts                      # Entry point
    │   ├── triggers/
    │   │   └── onSignatureCreated.ts     # NEW: Signature verification
    │   ├── agents/
    │   │   ├── approvalAgent.ts          # NEW: Approval processing
    │   │   ├── decisionAgent.ts          # Future
    │   │   ├── attestationAgent.ts       # Future
    │   │   └── delegationAgent.ts        # Future
    │   ├── services/
    │   │   ├── signatureVerification.ts  # NEW: PGP verification
    │   │   ├── publicKeyLookup.ts        # NEW: Query users
    │   │   ├── payloadExtraction.ts      # NEW: Parse payloads
    │   │   └── actionItemService.ts      # NEW: Create action items
    │   └── types/
    │       └── signature.ts              # Shared types
    └── package.json                      # Add openpgp dependency

```

---

## Technology Stack

### Client (React Native + Expo)

**Core Framework**:
- React Native (Expo Router for navigation)
- TypeScript
- Expo SDK

**Cryptography**:
- **OpenPGP.js** v5.11.0
  - ECC Curve25519 (lightweight, fast)
  - Client-side key generation
  - Client-side signing
  - Client-side verification (for UX)

**State Management**:
- React Context (signature state)
- React Hooks (selection, proposals)

**Firebase SDK**:
- Firestore (signature storage)
- Auth (user identity)
- Functions (callable)

---

### Server (Firebase Cloud Functions)

**Runtime**:
- Node.js 20
- TypeScript

**Cryptography**:
- **OpenPGP.js** v5.11.0
  - Server-side signature verification
  - Public key validation

**AI Integration**:
- **Vercel AI SDK** (existing)
- OpenAI GPT-4-turbo (approval extraction)

**Firebase Admin SDK**:
- Firestore (database operations)
- Auth (user lookup)
- Functions (triggers)

---

## Data Flow

### Signature Creation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
         User long-presses message, selects "Sign messages"
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MESSAGE SELECTION (Client)                                        │
│                                                                       │
│  ├─ User taps messages to select                                    │
│  ├─ useMessageSelection validates contiguous selection              │
│  ├─ Visual feedback on selected messages                            │
│  └─ "Sign" button enabled when valid selection                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SIGNATURE MODAL (Client)                                          │
│                                                                       │
│  ├─ Shows preview of selected messages                              │
│  ├─ User adds purpose (e.g., "approval")                            │
│  ├─ User adds notes (optional)                                      │
│  └─ User taps "Sign"                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. BUILD PAYLOAD (Client - services/signatures.ts)                   │
│                                                                       │
│  const payload: SignedPayload = {                                    │
│    version: "1.0",                                                   │
│    timestamp: Date.now(),                                            │
│    signerId: user.email,                                             │
│    conversationId: "conv123",                                        │
│    participants: [...],                                              │
│    messages: [{messageId, text, senderId, ...}],                     │
│    purpose: "approval",                                              │
│    notes: "...",                                                     │
│    nonce: generateNonce()                                            │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. SIGN PAYLOAD (Client - OpenPGP.js, ~10-20ms)                      │
│                                                                       │
│  ├─ Fetch encrypted private key from Firestore                      │
│  ├─ Decrypt with passphrase (cached for session)                    │
│  ├─ Sign JSON payload with OpenPGP.js                               │
│  ├─ Generate armored signature                                      │
│  └─ Verify signature immediately (client-side check)                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. SAVE SIGNATURE (Client → Firestore)                               │
│                                                                       │
│  Firestore: users/{uid}/signatures/{sigId}                           │
│  {                                                                   │
│    signatureId: "sig123",                                            │
│    signedPayload: payload,                                           │
│    pgpSignature: "-----BEGIN PGP SIGNATURE-----...",                │
│    publicKey: "-----BEGIN PGP PUBLIC KEY-----...",                  │
│    createdAt: serverTimestamp(),                                     │
│    conversationId: "conv123",                                        │
│    messageIds: ["msg1", "msg2"],                                     │
│    purpose: "approval",                                              │
│    verified: true,                                                   │
│    verifiedAt: serverTimestamp()                                     │
│  }                                                                   │
│                                                                       │
│  ├─ Batch update: Add signatureId to each message doc               │
│  └─ Update message.signatureCount                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. FIRESTORE TRIGGER (Cloud Functions)                               │
│                                                                       │
│  onDocumentCreated('users/{uid}/signatures/{sigId}')                 │
│                                                                       │
│  ├─ Fetch signature document                                        │
│  ├─ Fetch user's public key                                         │
│  ├─ Re-verify signature server-side (security)                      │
│  ├─ Update verification status in Firestore                         │
│  └─ If verified + purpose="approval" → Call approval agent          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. APPROVAL AGENT (Cloud Functions - approvalAgent.ts)               │
│                                                                       │
│  ├─ Extract message text from signed payload                        │
│  ├─ Call OpenAI GPT-4-turbo to extract approval details             │
│  │   - Approver: alice@company.com                                  │
│  │   - Approved item: "Q4 marketing budget"                         │
│  │   - Amount: $50,000                                              │
│  ├─ Create action item in Firestore                                 │
│  └─ Post confirmation message to conversation                       │
│      "✅ Approval verified: Alice approved Q4 marketing budget"      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. UI UPDATE (Client)                                                │
│                                                                       │
│  ├─ Signature badge appears on messages (🔏 1)                       │
│  ├─ Signature appears in drawer tab                                 │
│  ├─ Agent confirmation message appears in chat                      │
│  └─ Action item created                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Signature Verification Flow (AI Agent)

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Agent needs to verify signature                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. FETCH SIGNATURE (Cloud Functions)                                 │
│                                                                       │
│  const signature = await db                                          │
│    .collection('users').doc(userId)                                  │
│    .collection('signatures').doc(signatureId)                        │
│    .get();                                                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. LOOKUP PUBLIC KEY (Cloud Functions - publicKeyLookup.ts)          │
│                                                                       │
│  const userQuery = await db.collection('users')                      │
│    .where('email', '==', signature.signedPayload.signerId)           │
│    .limit(1)                                                         │
│    .get();                                                           │
│                                                                       │
│  const publicKey = userQuery.docs[0]?.data()?.publicKey;             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. VERIFY SIGNATURE (Cloud Functions - OpenPGP.js)                   │
│                                                                       │
│  const verification = await verifyPGPSignature({                     │
│    signature: signature.pgpSignature,                                │
│    payload: JSON.stringify(signature.signedPayload),                 │
│    publicKey: publicKey                                              │
│  });                                                                 │
│                                                                       │
│  return {                                                            │
│    valid: verification.valid,                                        │
│    signer: signature.signedPayload.signerId,                         │
│    fingerprint: verification.fingerprint,                            │
│    payload: signature.signedPayload                                  │
│  };                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. AGENT ACTS ON VERIFIED SIGNATURE                                  │
│                                                                       │
│  if (verified && purpose === "approval") {                           │
│    await createActionItem(...);                                      │
│    await postConfirmationMessage(...);                               │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Components

### Firestore Collections

#### `users/{userId}`

User profile with public key:
```typescript
{
  uid: string,
  email: string,
  displayName: string,

  // Digital signature fields
  publicKey?: string,              // PGP public key (armored)
  publicKeyFingerprint?: string,   // Key fingerprint
  publicKeyCreatedAt?: timestamp,  // When keys were generated
  privateKeyEncrypted?: string     // Encrypted private key
}
```

**Indexes**:
- `email` (for public key lookup by email)

---

#### `users/{userId}/signatures/{signatureId}`

Signatures created by user:
```typescript
{
  signatureId: string,
  signedPayload: SignedPayload,
  pgpSignature: string,   // Armored signature
  publicKey: string,
  createdAt: timestamp,
  conversationId: string,
  messageIds: string[],
  purpose?: string,
  verified: boolean,
  verifiedAt?: timestamp,
  exported?: boolean,
  exportedAt?: timestamp
}
```

**Indexes**:
- `createdAt DESC` (for drawer list)
- `conversationId` (for conversation queries)
- `purpose` (for agent queries)

---

#### `users/{userId}/collected_signatures/{signatureId}`

Signatures saved from others:
```typescript
{
  // Same structure as signatures, plus:
  collectedFrom: string,   // Email of original signer
  collectedAt: timestamp,
  source: 'conversation' | 'import'
}
```

**Indexes**:
- `createdAt DESC`
- `collectedFrom`

---

#### `conversations/{convId}/messages/{msgId}`

Enhanced with signature references:
```typescript
{
  // ... existing fields
  signatureIds?: string[],    // Array of signature IDs
  signatureCount?: number     // Quick display count
}
```

**Indexes**:
- `signatureCount` (for queries)

---

#### `conversations/{convId}`

Enhanced with AI agent config:
```typescript
{
  // ... existing fields
  aiAgents?: {
    'ai-agent-approval': {
      type: 'approval-agent',
      permissions: string[],
      enabled: boolean
    }
  }
}
```

---

#### `signature_proposals/{proposalId}`

Temporary proposals:
```typescript
{
  proposalId: string,
  proposerId: string,
  proposerEmail: string,
  recipientId: string,
  conversationId: string,
  messageIds: string[],
  purpose?: string,
  notes?: string,
  createdAt: timestamp,
  status: 'pending' | 'accepted' | 'declined'
}
```

**Indexes**:
- `recipientId` (for user queries)
- `status`

**TTL**: Auto-delete after 7 days

---

#### `actionItems/{itemId}`

Action items created by approval agent:
```typescript
{
  type: 'approval',
  approver: string,        // Email
  description: string,
  amount?: number,
  signatureId: string,     // Link to signature
  conversationId: string,
  verifiedBy: string,      // 'ai-agent-approval'
  verifiedAt: timestamp,
  status: 'approved',
  createdAt: timestamp
}
```

**Indexes**:
- `signatureId` (for lookup)
- `conversationId`
- `createdAt DESC`

---

### Cloud Functions

#### `verifySignatureForAgent` (Callable)

Manual signature verification for AI agents:
```typescript
export const verifySignatureForAgent = onCall(
  async (request) => {
    const { signatureId, signerEmail } = request.data;

    // Fetch signature
    // Lookup public key by email
    // Verify with OpenPGP.js
    // Return verification result
  }
);
```

**Triggers**: Manual call from AI agents
**Response time**: ~50-100ms

---

#### `onSignatureCreated` (Firestore Trigger)

Auto-verify new signatures:
```typescript
export const onSignatureCreated = onDocumentCreated(
  'users/{userId}/signatures/{signatureId}',
  async (event) => {
    // Re-verify signature server-side
    // Update verification status
    // If verified + approved → trigger approval agent
  }
);
```

**Triggers**: onCreate (Firestore)
**Response time**: ~100-200ms

---

#### `getPublicKey` (Callable)

Lookup user's public key by email:
```typescript
export const getPublicKey = onCall(
  async (request) => {
    const { email } = request.data;

    const userQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    return userQuery.docs[0]?.data()?.publicKey;
  }
);
```

**Triggers**: Manual call
**Response time**: ~20-50ms

---

## Security Architecture

### Threat Model

**Threats Mitigated**:
1. ✅ **Context manipulation**: Contiguous selection prevents cherry-picking
2. ✅ **Replay attacks**: Nonce + conversationId in payload
3. ✅ **Client spoofing**: Server re-verifies all signatures
4. ✅ **Key substitution**: Public key included in signature doc
5. ✅ **Partial signatures**: All messages in payload

**Accepted Risks** (MVP):
- Private keys stored in cloud (encrypted)
- Trust based on Firebase Auth (centralized)
- No key revocation mechanism
- No defense against compromised Firebase account

---

### Security Layers

#### Layer 1: Client-Side Security
- Private keys encrypted with passphrase
- Keys cached in memory only (not persisted)
- Client-side verification for UX (not trusted for security)

#### Layer 2: Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own signatures
    match /users/{userId}/signatures/{signatureId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId;
      allow update, delete: if request.auth.uid == userId;
    }

    // Users can only read/write their own collected signatures
    match /users/{userId}/collected_signatures/{signatureId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId;
      allow delete: if request.auth.uid == userId;
    }

    // Proposals: recipient can read/update, proposer can read
    match /signature_proposals/{proposalId} {
      allow read: if request.auth.uid == resource.data.recipientId
                  || request.auth.uid == resource.data.proposerId;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.recipientId;
    }
  }
}
```

#### Layer 3: Server-Side Verification
- All signatures re-verified server-side before AI agents act
- Public key lookup by email (authenticated identity)
- Signature verification using OpenPGP.js
- Verification results cached in Firestore

---

## Scalability Considerations

### Performance Targets

**Client Operations**:
- Key generation: < 500ms (ECC Curve25519)
- Signing: < 100ms
- Verification: < 50ms
- Drawer load: < 1s

**Server Operations**:
- Firestore trigger: < 200ms
- Signature verification: < 100ms
- Approval agent: < 2s (includes LLM call)

---

### Storage Scaling

**Signature Size Estimation**:
- Public key: ~1KB (ECC)
- Private key: ~2KB (encrypted ECC)
- Signature: ~64 bytes (ECC)
- Payload: Variable (~1-10KB depending on messages)
- Total per signature: ~2-12KB

**Scale Projections**:
- 100 users × 50 signatures = 5,000 signatures
- Storage: 5,000 × 5KB = 25MB
- **Cost**: Negligible at MVP scale

---

### Query Optimization

**Firestore Queries**:
- Signatures drawer: Simple `orderBy('createdAt', 'desc')` with limit
- Agent queries: Indexed by `purpose` and `conversationId`
- No complex joins or aggregations needed

**Caching Strategy**:
- Verification results cached in signature document
- Public keys cached in user documents
- No additional caching layer needed for MVP

---

### Future Scaling Considerations

**When to optimize** (100+ users, 10K+ signatures):
- Add Cloud Storage for signature archives
- Implement pagination in drawer
- Add search indexing (Algolia, Typesense)
- Batch verification for AI agents
- Add Redis cache for public keys

---

## Technology Decisions Summary

### Why OpenPGP.js?
- ✅ Cross-platform (works on iOS, Android, Web, Node.js)
- ✅ Pure JavaScript (no native dependencies)
- ✅ RFC 4880 compliant (standard PGP)
- ✅ Well-maintained and popular
- ❌ Slower than native implementations (acceptable for MVP)

### Why ECC Curve25519?
- ✅ 5-10x faster than RSA 2048
- ✅ Smaller signatures (64 bytes vs 256 bytes)
- ✅ Modern cryptography (equivalent to RSA 3072)
- ✅ Better mobile performance
- ❌ Less universal compatibility (acceptable since app-specific)

### Why Client-Side Signing?
- ✅ User controls private key (more secure)
- ✅ Instant UX (~10-20ms)
- ✅ Reduces server costs
- ✅ Server re-verifies for AI agents (best of both worlds)

### Why Firestore for Storage?
- ✅ Already using Firestore for app
- ✅ Real-time updates (signatures appear instantly)
- ✅ Security rules for access control
- ✅ No additional infrastructure needed
- ✅ Negligible storage costs at MVP scale

---

## Deployment Architecture

### Environments

**Development**:
- Firebase Emulator Suite (local)
- Test users with test keys
- Mock AI agent responses

**Staging** (Future):
- Firebase project: `gauntlet-staging`
- Limited OpenAI quota
- Test with small user group

**Production**:
- Firebase project: `gauntlet-prod`
- Full OpenAI quota
- Monitoring and alerts

---

### Monitoring & Observability

**Metrics to Track**:
- Signature creation rate
- Verification success rate
- Approval agent success rate
- Key generation failures
- Average signing time
- Cloud Function execution time

**Logging**:
- Signature creation events
- Verification failures
- Agent processing events
- Error logs with context

**Alerts** (Future):
- High verification failure rate
- Slow signature operations
- Agent processing failures

---

## Document Status

**Version**: 1.0
**Status**: Complete - Ready for Implementation
**Next Steps**: Begin Phase 1 (Foundation) implementation

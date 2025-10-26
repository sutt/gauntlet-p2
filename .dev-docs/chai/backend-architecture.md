# CHAI Backend Architecture - Signature Reference Flow

**Date**: 2025-10-26
**Status**: Design Specification
**Decision**: Option B - Attachment UI with DB-based signature lookup

---

## Core Question Answered

**Question**: When a user supplies BuyBot with a signature via the attachment UI, does the signature object get:
- **A) Copied to the agent's signature collection in Firestore?**
- **B) Uploaded in the message request payload?**
- **C) Referenced by ID only, agent fetches from user's collection?**

**Answer**: **Option C** (with enhancements) - Reference by ID only, agent fetches from existing DB storage.

---

## Existing Signature Distribution System

### How Signatures Are Currently Stored

Based on the existing `signMessages` Cloud Function (lines 509-532):

```typescript
// When ash signs messages in conversation with will:

// 1. Signature created in ash's collection
await db
  .collection('users')
  .doc('ash_uid')
  .collection('signatures')
  .doc(signatureId)
  .set(signatureDocData);

// 2. Signature COPIED to will's collection (1-on-1 only)
if (isDirect) {
  for (const participantId of otherParticipants) {
    await db
      .collection('users')
      .doc('will_uid')  // ← will gets a copy
      .collection('signatures')
      .doc(signatureId)  // ← same ID
      .set(signatureDocData);  // ← full copy
  }
}
```

**Key Insight**: Signatures are **already copied** to conversation participants' collections!

**Structure**:
```
users/
  ash_uid/
    signatures/
      sig123/  ← Original
        signedPayload: {...}
        pgpSignature: "..."
        signerId: "ash@example.com"

  will_uid/
    signatures/
      sig123/  ← Exact copy (same doc ID)
        signedPayload: {...}
        pgpSignature: "..."
        signerId: "ash@example.com"
```

---

## Existing Agent Verification Pattern

From `verifySignatureForAgent()` function (lines 632-696):

```typescript
export async function verifySignatureForAgent(
  userId: string,      // ← User requesting verification (e.g., will)
  signatureId: string  // ← Signature ID to verify
): Promise<{ verified: boolean; payload: any; error?: string }> {

  // 1. Fetch signature from USER'S collection
  const sigDoc = await db
    .collection('users')
    .doc(userId)  // ← will's collection
    .collection('signatures')
    .doc(signatureId)
    .get();

  // 2. Extract signer email from payload
  const signerEmail = signature.signedPayload.signerId;

  // 3. Fetch signer's public key
  const userQuery = await db
    .collection('users')
    .where('email', '==', signerEmail)
    .limit(1)
    .get();

  const publicKey = userQuery.docs[0]?.data()?.publicKey;

  // 4. Verify cryptographically using OpenPGP
  const verification = await verifySignatureInternal(
    signature.signedPayload,
    signature.pgpSignature,
    publicKey
  );

  return {
    verified: verification.verified,
    payload: signature.signedPayload,
    error: verification.error
  };
}
```

**Agent fetches from the requesting user's own signature collection!**

---

## Proposed Architecture for BuyBot Signature Reference

### Option Analysis

#### ❌ Option A: Copy Signature to Agent's Collection
**Idea**: Create agent as user, copy signatures to `users/buybot_uid/signatures/`

**Problems**:
1. Agent is dummy user without real signature collection
2. Would need to copy EVERY signature from EVERY user who chats with agent
3. Signature proliferation (thousands of copies)
4. Violates principle of signatures being user-scoped

**Verdict**: Not recommended

---

#### ❌ Option B: Upload Full Signature in Message Payload
**Idea**: Message includes full signature object in request

**Example**:
```typescript
{
  text: "buy this quadcopter",
  attachedSignature: {
    signatureId: "sig123",
    signedPayload: { /* full payload */ },
    pgpSignature: "-----BEGIN PGP SIGNATURE-----...",
    // ... entire signature doc
  }
}
```

**Problems**:
1. Message documents become huge (signatures can be 5-10KB+)
2. Redundant storage (signature already in Firestore)
3. Security risk (client could modify signature data before sending)
4. Violates single-source-of-truth principle

**Verdict**: Not recommended

---

#### ✅ Option C: Reference by ID, Agent Fetches from User's Collection (RECOMMENDED)
**Idea**: Message includes only signature ID, agent fetches full signature from user's collection

**Flow**:
```typescript
// 1. Will attaches signature in UI
// Message created with:
{
  text: "buy this quadcopter",
  senderId: "will_uid",
  attachedSignatureId: "sig123"  // ← Just the ID
}

// 2. BuyBot's Cloud Function triggers on new message
export const onBuyBotMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const signatureId = message.attachedSignatureId;

    if (signatureId) {
      // 3. Agent fetches signature from WILL'S collection
      const verification = await verifySignatureForAgent(
        message.senderId,  // ← will_uid
        signatureId
      );

      // Signature exists in will's collection because:
      // - If ash signed it, it was copied to will's collection
      // - If will signed it, it's in his collection natively

      if (verification.verified) {
        // 4. Agent analyzes payload
        const relevance = await analyzeSignatureRelevance(
          verification.payload,
          message.text
        );
        // ...
      }
    }
  }
);
```

**Why This Works**:
- ✅ Signature already exists in user's collection (copied during creation)
- ✅ Minimal message size (just ID reference)
- ✅ Reuses existing `verifySignatureForAgent()` function
- ✅ Single source of truth (Firestore)
- ✅ Cryptographically verified by agent
- ✅ No data duplication

---

## Detailed Implementation Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Signature Creation (Existing System)            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ash signs 2 messages in conversation with will         │
│         ↓                                                │
│  signMessages() Cloud Function                          │
│         ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Firestore Write (Batch):                         │  │
│  │                                                   │  │
│  │ users/ash_uid/signatures/sig123                  │  │
│  │   signedPayload: { messages: [...] }             │  │
│  │   pgpSignature: "-----BEGIN PGP..."              │  │
│  │   signerId: "ash@example.com"                    │  │
│  │                                                   │  │
│  │ users/will_uid/signatures/sig123  ← COPY         │  │
│  │   (exact same data)                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Step 2: Will Chats with BuyBot (New Flow)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  will: "buy this quadcopter"                            │
│  buybot: "I need authorization from a power user"       │
│         ↓                                                │
│  will taps 📎 attachment button                         │
│         ↓                                                │
│  SignatureAttachmentModal appears                       │
│         ↓                                                │
│  Fetches: users/will_uid/signatures/*                   │
│  Shows: ash's signature (sig123) + others               │
│         ↓                                                │
│  will selects ash's signature                           │
│         ↓                                                │
│  Message created:                                        │
│  {                                                       │
│    text: "here's ash's approval",                       │
│    senderId: "will_uid",                                │
│    attachedSignatureId: "sig123"  ← NEW FIELD           │
│  }                                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Step 3: BuyBot Processes Message (Cloud Function)       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Firestore Trigger: onMessageCreated                    │
│    conversations/{conversationId}/messages/{messageId}  │
│         ↓                                                │
│  Check: Is conversation with BuyBot agent?              │
│         ↓ YES                                            │
│  Extract: message.attachedSignatureId = "sig123"        │
│         ↓                                                │
│  Call: verifySignatureForAgent(                         │
│    userId: "will_uid",                                  │
│    signatureId: "sig123"                                │
│  )                                                       │
│         ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ verifySignatureForAgent() logic:                 │  │
│  │                                                   │  │
│  │ 1. Fetch from will's collection:                 │  │
│  │    users/will_uid/signatures/sig123              │  │
│  │         ↓                                         │  │
│  │ 2. Extract signerId: "ash@example.com"           │  │
│  │         ↓                                         │  │
│  │ 3. Query users by email for ash's public key     │  │
│  │    users.where('email', '==', 'ash@...')         │  │
│  │         ↓                                         │  │
│  │ 4. Cryptographic verification (OpenPGP.js):      │  │
│  │    verify(payload, signature, publicKey)         │  │
│  │         ↓                                         │  │
│  │ 5. Return { verified: true, payload: {...} }     │  │
│  └──────────────────────────────────────────────────┘  │
│         ↓                                                │
│  Agent has verified payload with messages                │
│         ↓                                                │
│  Check: Is ash a power user?                            │
│    isPowerUser("ash_uid") → true                        │
│         ↓                                                │
│  Analyze: Does payload authorize this purchase?         │
│    LLM analysis of:                                     │
│      - Payload messages: "can i buy $400 quadcopter?"  │
│      - Current request: "buy this quadcopter"           │
│         ↓                                                │
│  LLM returns: { relevant: true, reasoning: "..." }      │
│         ↓                                                │
│  BuyBot responds: "Approved! ✓"                         │
└─────────────────────────────────────────────────────────┘
```

---

## Message Schema Changes

### Extended Message Interface

```typescript
// types/chat.ts
export interface Message {
  // ... existing fields
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  conversationId: string;

  // NEW FIELD for signature attachment
  attachedSignatureId?: string;  // Reference to signature in user's collection

  // Client-only (optimistic UI)
  status?: MessageStatus;
  tempId?: string;
}
```

### Firestore Document Example

```json
// conversations/conv123/messages/msg456
{
  "id": "msg456",
  "text": "here's the approval",
  "senderId": "will_uid",
  "senderName": "Will",
  "timestamp": "2025-10-26T14:30:00Z",
  "conversationId": "conv123",
  "attachedSignatureId": "sig123",  // ← NEW: Reference to signature
  "readBy": {
    "will_uid": "2025-10-26T14:30:00Z"
  }
}
```

---

## Security & Validation

### Firestore Security Rules Update

```javascript
// firestore.rules

match /conversations/{conversationId}/messages/{messageId} {
  // Allow creating messages with optional signature attachment
  allow create: if request.auth.uid in getConversation(conversationId).participants
                && request.auth.uid == request.resource.data.senderId
                && (
                  // Either no signature attached
                  !request.resource.data.keys().hasAny(['attachedSignatureId'])
                  // Or signature ID is a valid string
                  || (request.resource.data.attachedSignatureId is string
                      && request.resource.data.attachedSignatureId.size() > 0)
                );
}
```

**Security Properties**:
- ✅ User can only attach signature IDs (strings), not full objects
- ✅ Agent validates signature exists and is cryptographically valid
- ✅ Agent verifies signer's identity via public key lookup
- ✅ Client cannot tamper with signature data (fetched from Firestore)

---

### Agent-Side Validation

```typescript
// In BuyBot Cloud Function
export const onBuyBotMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data() as Message;

    // Validate this is a conversation with BuyBot
    const conversation = await db
      .collection('conversations')
      .doc(message.conversationId)
      .get();

    const participants = conversation.data()?.participants || [];
    const hasBuyBot = participants.includes(BUYBOT_USER_ID);

    if (!hasBuyBot) {
      return; // Not a BuyBot conversation, ignore
    }

    // Check for attached signature
    const signatureId = message.attachedSignatureId;

    if (signatureId) {
      // 1. Verify signature exists and is valid
      const verification = await verifySignatureForAgent(
        message.senderId,  // ← User's collection
        signatureId
      );

      if (!verification.verified) {
        await sendAgentMessage(
          message.conversationId,
          `❌ Signature verification failed: ${verification.error}`
        );
        return;
      }

      // 2. Check if signer is a power user
      const signerEmail = verification.payload.signerId;
      const signerUser = await getUserByEmail(signerEmail);

      if (!isPowerUser(signerUser.id)) {
        await sendAgentMessage(
          message.conversationId,
          `❌ Signature is from ${signerEmail}, but they are not a power user.`
        );
        return;
      }

      // 3. Analyze payload relevance
      const relevance = await analyzeSignatureRelevance(
        verification.payload,
        message.text
      );

      if (!relevance.relevant) {
        await sendAgentMessage(
          message.conversationId,
          `❌ Signature not relevant: ${relevance.reasoning}`
        );
        return;
      }

      // 4. Approve!
      await sendAgentMessage(
        message.conversationId,
        `✅ Approved! Signature verified from ${signerEmail}. ${relevance.reasoning}`
      );
    } else {
      // No signature attached - handle normally
      // ... existing agent logic
    }
  }
);
```

---

## Edge Cases & Error Handling

### Edge Case 1: Signature Doesn't Exist
**Scenario**: User attaches signature ID that doesn't exist in their collection

**Handling**:
```typescript
const sigDoc = await db
  .collection('users')
  .doc(userId)
  .collection('signatures')
  .doc(signatureId)
  .get();

if (!sigDoc.exists) {
  return {
    verified: false,
    payload: null,
    error: 'Signature not found in your collection'
  };
}
```

**Agent Response**: "❌ The signature you referenced doesn't exist. Please check and try again."

---

### Edge Case 2: User Manually Types Wrong Signature ID
**Scenario**: User types random string as signature ID

**Handling**: Same as above - signature not found

**Prevention**: UI attachment flow makes this unlikely (picker only shows valid signatures)

---

### Edge Case 3: Signature Valid but from Non-Power-User
**Scenario**: User attaches signature from bob, who isn't a power user

**Handling**:
```typescript
const signerUser = await getUserByEmail(verification.payload.signerId);

if (!isPowerUser(signerUser.id)) {
  await sendAgentMessage(
    conversationId,
    `❌ I cannot accept this signature. ${verification.payload.signerId} is not authorized to approve purchases. Please get approval from: ${POWER_USER_NAMES.join(', ')}`
  );
}
```

---

### Edge Case 4: Signature Valid but Content Irrelevant
**Scenario**: Signature about sandwiches, not quadcopters

**Handling**:
```typescript
// LLM analyzes payload
const relevance = await analyzeSignatureRelevance(payload, request);

if (!relevance.relevant) {
  await sendAgentMessage(
    conversationId,
    `❌ I cannot use this signature because: ${relevance.reasoning}\n\nThe signed conversation was about: "${getPayloadSummary(payload)}", but you're asking me to: "${request}"`
  );
}
```

---

### Edge Case 5: Signature Expired (Future Enhancement)
**Scenario**: Signature is older than acceptable threshold

**Handling** (not in POC, but easy to add):
```typescript
const signatureAge = Date.now() - verification.payload.timestamp;
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

if (signatureAge > MAX_AGE) {
  await sendAgentMessage(
    conversationId,
    `⚠️ This signature is ${Math.floor(signatureAge / 3600000)} hours old. Please get a fresh approval from a power user.`
  );
}
```

---

## Performance Considerations

### Network Calls Required

**Per signature verification**:
1. Fetch signature from Firestore: `users/{userId}/signatures/{signatureId}` (~50ms)
2. Query user by email: `users.where('email', '==', ...)` (~100ms with index)
3. Cryptographic verification: OpenPGP.js (~50-100ms)
4. LLM analysis: OpenAI API (~500-2000ms depending on model)

**Total**: ~700-2250ms

**Optimization Opportunities**:
- Cache power user public keys (rarely change)
- Parallelize Firestore queries with `Promise.all()`
- Use GPT-3.5-turbo for relevance analysis (faster, cheaper than GPT-4)

---

### Firestore Read Costs

**Per verification**:
- 1 document read (signature)
- 1 collection query (user lookup)

**Total**: 2 reads = $0.0000012 at scale (negligible)

**Monthly estimate** (100 verifications):
- 200 reads = $0.00012 (~free)

---

## Advantages of This Architecture

1. **✅ Minimal Client Changes**: Just add one field to message schema
2. **✅ Reuses Existing Infrastructure**: No new Cloud Functions needed
3. **✅ Single Source of Truth**: Signature data comes from Firestore, not client
4. **✅ Security**: Client cannot tamper with signature data
5. **✅ Scalability**: No data duplication, efficient queries
6. **✅ Extensibility**: Easy to add features (expiration, multi-signature, etc.)
7. **✅ Consistency**: Same verification logic for all agents
8. **✅ Debugging**: Full signature audit trail in Firestore

---

## Alternative Considered: Hybrid Approach

**Idea**: Client sends minimal signature metadata for validation

```typescript
{
  text: "buy this quadcopter",
  attachedSignatureId: "sig123",
  attachedSignaturePreview: {  // ← Optional optimization
    signerId: "ash@example.com",
    createdAt: "2025-10-26T14:00:00Z"
  }
}
```

**Purpose**: Agent can do basic checks before full fetch

**Verdict**: Not worth complexity - full verification needed anyway

---

## Summary: Recommended Implementation

### Message Structure
```typescript
interface Message {
  // ... existing fields
  attachedSignatureId?: string;  // NEW: Reference to signature in sender's collection
}
```

### Agent Logic
```typescript
if (message.attachedSignatureId) {
  // 1. Fetch from sender's collection
  const verification = await verifySignatureForAgent(
    message.senderId,
    message.attachedSignatureId
  );

  // 2. Validate signer is power user
  // 3. Analyze payload relevance
  // 4. Approve or reject with reasoning
}
```

### No Copying Needed
Signatures already exist in user's collection via existing distribution system.

---

**Document Status**: ✅ Architecture Finalized
**Decision**: Reference-based approach (Option C)
**Next Steps**: Update signature-reference-ui.md with this backend architecture

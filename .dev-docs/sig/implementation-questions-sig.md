# Digital Signatures - Implementation Questions & Planning

## Document Overview
**Version**: 1.1
**Date**: 2025-10-23
**Status**: Planning Phase - Decision Making
**Purpose**: Outline critical questions and tradeoffs for implementing digital signature functionality in the chat application

---

## 📋 Decision Log & Rationale

This section tracks decisions made during collaborative planning. Each decision includes the rationale and any tradeoffs accepted.

**Legend**: ✅ Decided | 🤔 Under Consideration | ⏸️ Deferred | ❌ Rejected

---

### Question 1: Cryptographic Implementation Strategy

#### 1.1 Cryptographic Library Choice
**Status**: ✅ Decided
**Decision**: **OpenPGP.js** (Pure JavaScript implementation)
**Rationale**:
- Cross-platform compatibility (iOS, Android, Web) is critical for React Native + Expo app
- True PGP standard ensures interoperability and future flexibility
- ~300KB bundle size is acceptable for this core feature
- Well-maintained library with active community support
**Tradeoffs Accepted**:
- Slower performance than native implementations (~1-2s key generation, ~100-200ms signing)
- Larger bundle size impact (~300KB minified)
- No hardware acceleration available
**Alternatives Considered**:
- ❌ React Native Crypto (rejected: web compatibility issues, build complexity)
- ❌ Hybrid Cloud Functions (rejected: security concern with server-side keys)

#### 1.2 Private Key Storage
**Status**: ✅ Decided (MVP), 🔄 Planned Migration
**Decision**:
- **MVP**: Encrypted cloud storage (Firestore)
- **Future**: Migrate to device-only storage (iOS Keychain/Android KeyStore)
**Rationale**:
- MVP prioritizes faster implementation and multi-device access
- Cloud storage enables easier testing and user recovery flows
- Device-only storage will be added later for enhanced security
- Phased approach allows validating signature workflows before adding storage complexity
**Tradeoffs Accepted** (MVP):
- Keys stored in Firestore (encrypted with user passphrase)
- Requires strong passphrase from users
- Potential cloud storage compromise risk
- Firebase security becomes critical
**Migration Path**:
1. MVP: Implement encrypted cloud storage with OpenPGP.js
2. Phase 2: Add device-only storage option (opt-in)
3. Phase 3: Migrate existing users to device storage
4. Phase 4: Deprecate cloud storage
**Multi-device Support**: Yes in MVP (cloud-based), will require key export/import after migration

#### 1.3 Key Strength and Algorithm
**Status**: ✅ Decided (REVISED)
**Decision**: **ECC Curve25519** (lightweight, modern algorithm)
**Rationale**:
- **Lightweight**: 5-10x faster than RSA (~100-200ms key generation vs 1-2s)
- **Modern cryptography**: Equivalent security to RSA 3072-bit
- **Smaller signatures**: ~64 bytes vs ~256 bytes for RSA
- **Better mobile performance**: Critical for on-device signing
- **OpenPGP.js support**: Full support in chosen library
- **Future-proof**: Recommended by modern cryptographers
**Tradeoffs Accepted**:
- Less universal compatibility than RSA (some older PGP tools don't support ECC)
- For MVP (app-specific, no export), compatibility is not critical
- Can add RSA support later if cross-platform becomes important
**Performance Targets** (ECC):
- Key generation: ~100-200ms
- Signing: ~10-20ms
- Verification: ~5-10ms
**Signature Format**: OpenPGP RFC 4880 compliant (Curve25519/EdDSA)

---

### Question 2: Data Model & Storage Architecture

#### 2.1 Firestore Structure for Signatures
**Status**: ✅ Decided
**Decision**: **Hybrid structure - User-owned collections with message references**
**Firestore Schema**:
```typescript
// Primary: Signatures created by user
users/{userId}/signatures/{signatureId}
{
  signatureId: string,
  signedPayload: SignedPayload,     // Full payload structure from 2.2
  pgpSignature: string,             // PGP armored signature
  publicKey: string,                // Signer's public key (for verification)
  createdAt: timestamp,
  conversationId: string,           // Quick filter by conversation
  messageIds: string[],             // Quick lookup of signed messages
  purpose?: string,                 // Optional: why signed
  verified: boolean,                // Pre-computed verification status
  verifiedAt?: timestamp,
  exported?: boolean,               // Tracking if ever exported
  exportedAt?: timestamp
}

// Secondary: Signatures manually saved from others
users/{userId}/collected_signatures/{signatureId}
{
  // Same structure as above, plus:
  collectedFrom: string,            // Email of original signer
  collectedAt: timestamp,
  source: 'conversation' | 'import' // How it was collected
}

// Reference: Quick lookup from messages
conversations/{convId}/messages/{msgId}
{
  // ... existing message fields ...
  signatureIds?: string[],          // Array of signature IDs
  signatureCount?: number           // For quick display
}
```
**Rationale**:
- **User ownership**: Each user controls their own signature collection
- **Manual collection**: Users explicitly save signatures to their drawer (not automatic)
- **Signature drawer**: Simple query of `users/{userId}/signatures` and `users/{userId}/collected_signatures`
- **Message lookup**: Reference array enables "show signatures on this message" feature
- **AI agent access**: Can query by user, conversation, or message efficiently
- **Export/import**: Easy to export all user's signatures in one operation
- **Security**: Firestore rules enforce users can only write to their own collections
**Tradeoffs Accepted**:
- Slight data duplication (signature IDs stored in message references)
- User must manually save signatures they want to keep
- Need to update message.signatureIds when signature is created
**Collection Flow**:
1. User views signature in conversation
2. User taps "Save to Drawer"
3. Signature copied to their `collected_signatures` collection
4. User can export/view later from drawer

#### 2.2 Signed Payload Structure
**Status**: ✅ Decided
**Decision**: **Rich payload with participant identifiers, dates, and full message content**
**Payload Schema**:
```typescript
interface SignedPayload {
  version: string;              // Signature schema version (e.g., "1.0")
  timestamp: number;            // Unix timestamp when signed
  signedAt: string;            // ISO 8601 datetime
  signerId: string;            // User's email (NOT uid for privacy)

  // Conversation context
  conversationId: string;       // Which conversation
  participants: {               // All participants
    email: string;              // Email (NOT uid)
    displayName: string;        // Display name at time of signing
  }[];

  // Message content
  messages: {
    messageId: string;          // Message ID for reference
    text: string;               // Actual message text
    senderId: string;           // Sender's email (NOT uid)
    senderName: string;         // Sender's display name
    timestamp: number;          // Message timestamp
    sentAt: string;             // ISO 8601 datetime
  }[];

  // Optional metadata
  purpose?: string;             // Why signed (e.g., "approval", "attestation")
  notes?: string;               // User-provided notes
  expiresAt?: number;           // Optional expiration
  nonce?: string;               // Prevent replay attacks
}
```
**Rationale**:
- **Email instead of UID**: Better privacy, human-readable, portable outside app
- **Full message text**: Enables verification without accessing original database
- **Dates included**: Both Unix timestamps (for programmatic use) and ISO 8601 (human-readable)
- **Participant context**: Shows who was in conversation at time of signing
- **Self-contained**: Signature payload can be verified independently
**Tradeoffs Accepted**:
- Larger signature files (includes full message text)
- Email addresses visible in exported signatures (privacy consideration)
- Signature remains valid even if user changes display name
**Privacy Note**: Users will be warned that emails are included in signatures and exported files

#### 2.3 Verification Result Caching
**Status**: ✅ Decided
**Decision**: **Hybrid - Pre-verify and cache, with on-demand re-verification**
**Implementation**:
```typescript
// Cache verification result in signature document
{
  verified: boolean,              // Cached result
  verifiedAt: timestamp,          // When last verified
  verificationError?: string      // If verification failed, why
}

// Re-verify when:
// - User explicitly requests (button in signature details)
// - Public key changes (rare)
// - On import (verify before saving)
```
**Rationale**:
- Signatures are not frequently queried (only order by date DESC)
- Pre-verification provides fast UX in signature drawer
- Re-verification available on-demand for critical checks
- Simple caching strategy for MVP
**Query Pattern**: Simple `orderBy('createdAt', 'desc')` - no complex filtering needed
**Multi-signature**: Not supported in MVP (one signer per signature)

#### 2.4 Additional Simplifications
**Status**: ✅ Decided
**Decisions**:
- **No multi-signature support**: Each signature has exactly one signer
- **Simple query pattern**: Signatures ordered by date saved (DESC) only
- **No complex filtering**: MVP doesn't need to filter by purpose, conversation, etc. in drawer UI
- **Future enhancement**: Can add filters/search later if needed

---

### Question 3: User Experience & Signature Workflows

#### 3.1 Key Generation/Onboarding Flow
**Status**: ✅ Decided
**Decision**: **Optional feature with explicit key generation option**
**Implementation**:
```
Onboarding Flow:
1. User can generate keys from Settings/Profile
   → "Set up Digital Signatures" option
   → Explains feature: "Create cryptographic signatures for messages"
   → User creates passphrase (to encrypt private key)
   → Generate keys (~1-2s with progress indicator)
   → Success: Show public key fingerprint
   → "Keys ready! You can now sign messages"

First Use (if no keys):
1. User attempts to sign → Redirected to key generation
2. After generating keys → Returns to signature flow
```
**Rationale**:
- Optional feature (not all users need signatures)
- Can set up proactively in settings OR just-in-time on first use
- Passphrase required for cloud storage encryption
- Show fingerprint for manual verification if needed

#### 3.2 Message Signing Workflow
**Status**: ✅ Decided
**Decision**: **Long-press menu with multi-message selection and signature proposals**
**User Flow**:
```
Step 1: Long-press message
→ Context menu appears with options:
  - "Select message(s) for signature"
  - "Propose signature for <counterparty_name>"
  - [other existing options: translate, copy, etc.]

Step 2a: "Select message(s) for signature"
→ Enter selection mode
→ User taps messages to add to selection
→ ⚠️ CONSTRAINT: Must select contiguous range (no gaps)
→ Visual feedback: Selected messages highlighted
→ If user tries to select non-contiguous → Warning: "Select continuous messages only"
→ Bottom bar shows: "X messages selected | Sign"

Step 2b: "Propose signature for <counterparty_name>"
→ Same selection mode as 2a
→ After selection → Creates proposal sent to counterparty
→ Counterparty can accept/reject signature request

Step 3: Tap "Sign" button
→ Modal appears:
  - Preview: Shows all selected messages
  - Optional fields:
    * Purpose (dropdown: approval, attestation, agreement, custom)
    * Notes (free text)
    * Expiration (optional date)
  - "Create Signature" button

Step 4: Signature created
→ Visual indicator appears on all signed messages
→ Signature saved to user's drawer automatically
→ Optional: "Share signature" prompt
```
**Rationale**:
- **Contiguous messages only**: Prevents context manipulation, maintains integrity
- **Dual triggers**: Self-signing OR propose to others
- **Proposal feature**: Enables collaborative signature workflows
- **Visual feedback**: Clear indication of what's being signed
- **Optional metadata**: Purpose/notes for context, but not required

#### 3.3 Signature Drawer UI
**Status**: ✅ Decided
**Decision**: **Dedicated tab with list and detail views**
**Structure**:
```
Signature Drawer Tab (whole tab in navigation)

Default View (List):
┌─────────────────────────────────────┐
│ Signatures                     [+]  │ ← Import button
├─────────────────────────────────────┤
│                                     │
│ [Signature Card]                    │
│ ┌─────────────────────────────────┐ │
│ │ 🔏 Signed by: alice@email.com   │ │
│ │ 📅 Oct 23, 2025 2:30 PM         │ │
│ │ 💬 3 messages from "Project X"  │ │
│ │ Preview: "Approve the budget..." │ │
│ │ ✓ Verified                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Signature Card]                    │
│ ┌─────────────────────────────────┐ │
│ │ 🔏 Signed by: bob@email.com     │ │
│ │ 📅 Oct 22, 2025 4:15 PM         │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

Sorting: DESC by date collected (most recent first)
```

**Detail View** (tap on signature card):
```
┌─────────────────────────────────────┐
│ ← Signature Details                 │
├─────────────────────────────────────┤
│ Signed by: alice@email.com          │
│ Public Key: ABC123...               │
│ Signed at: Oct 23, 2025 2:30 PM     │
│ Status: ✓ Verified                  │
│                                     │
│ Purpose: Approval                   │
│ Notes: "Approved budget for Q4"     │
│ Expires: Dec 31, 2025              │
│                                     │
│ Conversation: Project X             │
│ Participants:                       │
│ - alice@email.com                   │
│ - bob@email.com                     │
│                                     │
│ Messages (3):                       │
│ ┌─────────────────────────────────┐ │
│ │ [1] Alice: "I approve this..."  │ │
│ │     Oct 23, 2025 2:00 PM        │ │
│ ├─────────────────────────────────┤ │
│ │ [2] Bob: "Sounds good to me"    │ │
│ │     Oct 23, 2025 2:15 PM        │ │
│ ├─────────────────────────────────┤ │
│ │ [3] Alice: "Let's proceed"      │ │
│ │     Oct 23, 2025 2:30 PM        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Actions:                            │
│ [Export] [Verify] [Delete]          │
└─────────────────────────────────────┘
```

**Rationale**:
- **Dedicated tab**: Signatures are important enough for top-level navigation
- **List view**: Quick scanning of all collected signatures
- **Preview**: Shows enough info without opening detail
- **Detail view**: Full payload and metadata for verification
- **Actions**: Export (download), re-verify, delete

#### 3.4 Message Visualization
**Status**: ✅ Decided
**Decision**: **Subtle badge indicator with signature count**
**Visual Design**:
```
In Chat View:
┌────────────────────────────────┐
│ Alice                     2:30 │
│ ┌────────────────────────────┐ │
│ │ I approve this budget      │ │
│ │ proposal for Q4.           │ │
│ │                      [🔏 1] │ │ ← Signature badge
│ └────────────────────────────┘ │
└────────────────────────────────┘

Tap badge → Shows signatures on this message
Long-press → Context menu (includes signing options)
```
**Rationale**:
- **Non-intrusive**: Small badge doesn't clutter chat
- **Informative**: Shows signature count
- **Discoverable**: Tap to see details
- **Consistent**: Works with existing long-press menu

#### 3.5 Signature Proposals (Counterparty Feature)
**Status**: ✅ Decided
**Decision**: **"Propose signature" sends request to other participant**
**Flow**:
```
Proposer Side:
1. Long-press → "Propose signature for Bob"
2. Select contiguous messages
3. Add purpose/notes
4. Send proposal
5. Bob gets notification

Recipient (Bob) Side:
1. Notification: "Alice proposed a signature"
2. Opens proposal:
   - Shows messages to be signed
   - Shows Alice's purpose/notes
   - Preview of what signature would contain
3. Options:
   - "Sign" → Bob creates his own signature
   - "Decline" → Rejects proposal
   - "Counter-propose" → Suggests different message range
```
**Rationale**:
- **Collaborative**: Both parties can initiate signatures
- **Transparent**: Recipient sees exactly what they're signing
- **Flexible**: Can accept, decline, or counter-propose
- **Use case**: Agreements, approvals, attestations

#### 3.6 Contiguous Message Selection
**Status**: ✅ Decided
**Decision**: **Enforce contiguous range selection (no gaps allowed)**
**Implementation**:
```typescript
// Selection logic
let selectedMessages = [];
let selectionRange = { start: null, end: null };

onMessageTap(messageId) {
  if (selectionMode) {
    // Check if message is contiguous with existing selection
    if (isContiguousWithSelection(messageId)) {
      toggleSelection(messageId);
      updateRange();
    } else {
      showWarning("Please select continuous messages only");
    }
  }
}

isContiguousWithSelection(messageId) {
  // Messages must be adjacent (no gaps in between)
  // e.g., can select messages 5-10, but not 5,7,9
  return checkMessagesAreAdjacent(selectedMessages, messageId);
}
```
**Rationale**:
- **Prevents cherry-picking**: Can't skip messages to change meaning
- **Context integrity**: Full context preserved in signature
- **Prevents manipulation**: Harder to misrepresent conversation
- **Clear UX**: Simple rule for users to understand

**Visual Feedback**:
- Attempting to select non-contiguous → Red flash + toast message
- Valid selection → Messages highlight in sequence
- Show range indicator: "Messages 5-10 selected"

---

### Question 4: AI Agent Integration & Authorization

#### 4.1 Signature Verification by AI Agents
**Status**: ✅ Decided
**Decision**: **Server-side verification in Cloud Functions with public key lookup**
**Implementation**:
```typescript
// Cloud Function: AI agent verifies signature
export const verifySignatureForAgent = onCall(async (request) => {
  const { signatureId, signerEmail } = request.data;

  // 1. Fetch signature document from Firestore
  const signatureDoc = await db
    .collection('users').doc(userId)
    .collection('signatures').doc(signatureId)
    .get();

  // 2. Query user by email to get public key
  const userQuery = await db
    .collection('users')
    .where('email', '==', signerEmail)
    .limit(1)
    .get();

  const publicKey = userQuery.docs[0]?.data()?.publicKey;

  // 3. Verify signature using OpenPGP.js
  const verification = await verifyPGPSignature({
    signature: signatureDoc.data().pgpSignature,
    payload: signatureDoc.data().signedPayload,
    publicKey: publicKey
  });

  return {
    valid: verification.valid,
    signer: signerEmail,
    signedAt: signatureDoc.data().createdAt,
    payload: signatureDoc.data().signedPayload,
    publicKeyFingerprint: verification.fingerprint
  };
});

// Helper function for PGP verification
async function verifyPGPSignature({ signature, payload, publicKey }) {
  const message = await openpgp.readMessage({
    armoredMessage: signature
  });

  const publicKeyObj = await openpgp.readKey({
    armoredKey: publicKey
  });

  const verification = await openpgp.verify({
    message,
    verificationKeys: publicKeyObj
  });

  return {
    valid: verification.signatures[0].verified,
    fingerprint: publicKeyObj.getFingerprint()
  };
}
```
**Rationale**:
- **Server-side**: AI agents run in Cloud Functions, verification must be server-side
- **Public key lookup**: Query by email (username) to get associated public key
- **Can't be spoofed**: Client cannot fake verification results
- **Consistent**: All AI agents use same verification logic
- **Cached results**: Pre-verification in signature document speeds up agent queries

**User Profile Schema Update**:
```typescript
users/{userId}
{
  // ... existing fields
  email: string,              // Used for signature lookup
  publicKey?: string,         // PGP public key (armored)
  publicKeyFingerprint?: string,
  publicKeyCreatedAt?: timestamp
}
```

#### 4.2 AI Agents as Chat Participants
**Status**: ✅ Decided
**Decision**: **AI agents participate in conversations and can validate/act on signatures**
**Architecture**:
```typescript
// AI Agent in conversation
conversations/{convId}
{
  participants: [
    'user123',           // Human user
    'user456',           // Human user
    'ai-agent-approval'  // AI agent participant
  ],
  aiAgents: {
    'ai-agent-approval': {
      type: 'approval-agent',
      permissions: ['validate-signatures', 'create-action-items'],
      enabled: true
    }
  }
}

// Agent monitors conversation for signatures
export const onSignatureCreated = functions.firestore
  .document('users/{userId}/signatures/{signatureId}')
  .onCreate(async (snapshot, context) => {
    const signature = snapshot.data();
    const conversationId = signature.conversationId;

    // Check if AI agent is in this conversation
    const conv = await db.collection('conversations').doc(conversationId).get();
    const aiAgents = conv.data()?.aiAgents || {};

    // If approval agent is enabled, process signature
    if (aiAgents['ai-agent-approval']?.enabled) {
      await processApprovalSignature(signature);
    }
  });
```
**Rationale**:
- **Agents as participants**: AI agents are members of conversations
- **Explicit enablement**: Users control which AI agents are active
- **Event-driven**: Agents react to signature creation
- **Scoped permissions**: Each agent type has specific capabilities

#### 4.3 MVP Use Case: Approval Agent
**Status**: ✅ Decided
**Decision**: **Approval agent validates signatures and creates action items**
**Use Case Flow**:
```
Step 1: User signs message
- User: "I approve the Q4 marketing budget of $50,000"
- User long-presses → signs message
- Adds purpose: "approval"
- Creates signature

Step 2: Approval agent detects signature
- Firestore trigger fires
- Agent validates signature (server-side)
- Agent checks purpose === "approval"

Step 3: Agent extracts approval details
- Uses LLM to parse message content
- Extracts: {
    approver: "alice@company.com",
    approvedItem: "Q4 marketing budget",
    amount: "$50,000",
    timestamp: "2025-10-23T14:30:00Z"
  }

Step 4: Agent takes action
- Creates verified action item in Firestore
- Posts confirmation message to chat:
  "✅ Approval verified: Alice approved Q4 marketing budget ($50k)"
- Links to signature for audit trail

Step 5: Action item created
actionItems/{itemId}
{
  type: 'approval',
  approver: 'alice@company.com',
  description: 'Q4 marketing budget',
  amount: 50000,
  signatureId: 'sig123',  // Links to signature
  verifiedBy: 'ai-agent-approval',
  verifiedAt: timestamp,
  status: 'approved'
}
```

**Agent Implementation** (`functions/src/agents/approvalAgent.ts`):
```typescript
export async function processApprovalSignature(signature: Signature) {
  // 1. Verify signature
  const verification = await verifyPGPSignature({
    signature: signature.pgpSignature,
    payload: signature.signedPayload,
    publicKey: await getPublicKey(signature.signedPayload.signerId)
  });

  if (!verification.valid) {
    console.error('Invalid signature, ignoring');
    return;
  }

  // 2. Check if this is an approval
  if (signature.purpose !== 'approval') {
    return; // Not an approval, ignore
  }

  // 3. Extract approval details using LLM
  const approvalDetails = await extractApprovalDetails(
    signature.signedPayload.messages
  );

  // 4. Create action item
  await db.collection('actionItems').add({
    type: 'approval',
    approver: signature.signedPayload.signerId,
    description: approvalDetails.description,
    amount: approvalDetails.amount,
    signatureId: signature.signatureId,
    conversationId: signature.conversationId,
    verifiedBy: 'ai-agent-approval',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'approved'
  });

  // 5. Post confirmation to chat
  await db
    .collection('conversations').doc(signature.conversationId)
    .collection('messages').add({
      text: `✅ Approval verified: ${signature.signedPayload.signerId} approved "${approvalDetails.description}"`,
      senderId: 'ai-agent-approval',
      senderName: 'Approval Agent',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'agent-notification',
      metadata: {
        signatureId: signature.signatureId,
        actionItemId: actionItemId
      }
    });
}

async function extractApprovalDetails(messages: Message[]) {
  // Use existing AI SDK (from your translation agent pattern)
  const { text } = await generateText({
    model: openai('gpt-4-turbo'),
    messages: [
      {
        role: 'system',
        content: 'Extract approval details from messages. Return JSON.'
      },
      {
        role: 'user',
        content: `Messages: ${JSON.stringify(messages)}`
      }
    ]
  });

  return JSON.parse(text);
}
```

**Rationale**:
- **MVP focused**: Single use case (approvals) to validate pattern
- **Verifiable**: Signature provides cryptographic proof of approval
- **Automated**: Agent acts automatically when signature detected
- **Auditable**: Links action item back to signature
- **Extensible**: Pattern works for other agent types (decision, attestation, etc.)

#### 4.4 Agent Query Patterns
**Status**: ✅ Decided
**Decision**: **Agents query signatures by email/purpose to validate actions**
**Query Examples**:
```typescript
// Query 1: Get all approval signatures by user
async function getUserApprovals(userEmail: string) {
  const usersQuery = await db.collection('users')
    .where('email', '==', userEmail)
    .limit(1)
    .get();

  const userId = usersQuery.docs[0]?.id;

  const approvals = await db
    .collection('users').doc(userId)
    .collection('signatures')
    .where('purpose', '==', 'approval')
    .where('verified', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  return approvals.docs.map(doc => doc.data());
}

// Query 2: Verify specific user signed specific messages
async function verifyUserSignedMessages(
  userEmail: string,
  messageIds: string[]
) {
  const approvals = await getUserApprovals(userEmail);

  return approvals.find(sig =>
    sig.messageIds.every(id => messageIds.includes(id))
  );
}

// Query 3: Get all signatures in conversation
async function getConversationSignatures(conversationId: string) {
  // This requires composite query across all users
  // Alternative: Store signature references in conversation doc
  const conv = await db.collection('conversations')
    .doc(conversationId)
    .get();

  return conv.data()?.signatureRefs || [];
}
```

#### 4.5 Future Agent Types
**Status**: 🔄 Planned
**Future Implementations**:
- **Decision Agent**: Tracks multi-party decisions (multiple signatures on same messages)
- **Attestation Agent**: Records verified statements/claims
- **Delegation Agent**: Manages authorization chains (A authorizes B to act)
- **Compliance Agent**: Ensures required signatures exist before actions
- **Audit Agent**: Generates reports of signature activity

**Pattern established by Approval Agent enables rapid expansion**

---

### Question 5: Security & Trust Model

#### 5.1 Public Key Trust Model
**Status**: ✅ Decided
**Decision**: **Centralized trust via Firebase Auth - Simple and straightforward**
**Implementation**:
```typescript
// Public keys stored in user profiles
users/{userId}
{
  email: string,              // Verified via Firebase Auth
  publicKey: string,          // PGP public key (armored)
  publicKeyFingerprint: string,
  publicKeyCreatedAt: timestamp
}

// Trust model: "This key belongs to the authenticated user with this email"
// No Web of Trust, no manual key signing, no complex verification
```
**Rationale**:
- **MVP simplicity**: Leverage existing Firebase Auth infrastructure
- **Good enough**: Email verification provides baseline trust
- **Centralized**: Keys tied to authenticated accounts in Firestore
- **Visual verification**: Users can compare fingerprints manually if needed
- **No complexity**: No Web of Trust, no key signing parties, no PGP keyservers
**Tradeoffs Accepted**:
- Trust relies on Firebase Auth security
- Not fully decentralized (acceptable for MVP)
- If Firebase account compromised, keys compromised

#### 5.2 Replay Attack Prevention
**Status**: ✅ Decided
**Decision**: **Contiguous message selection prevents context manipulation**
**How It Works**:
```
Replay Attack Prevention:
✅ Contiguous messages only → Can't cherry-pick messages
✅ conversationId in payload → Can't reuse signature in different conversation
✅ Full message text in payload → Can't swap out messages later
✅ Timestamp in payload → Records when signature was created
✅ nonce in payload → Prevents duplicate signatures

Context Manipulation Prevention:
✅ Must select continuous range → Can't skip messages in middle
✅ Proposal review → Recipient sees exactly what they're signing
✅ Full payload visible → Both parties see complete context
```
**Rationale**:
- **Contiguous selection** (already decided in UX) is the primary defense
- **Proposal review** ensures recipient knows what they're signing
- **Simple**: No complex cryptographic anti-replay mechanisms needed
- **Effective**: Prevents most attack vectors for MVP use case

#### 5.3 Signature Proposals Review
**Status**: ✅ Decided
**Decision**: **Recipients review full payload before signing proposals**
**Review Flow** (already designed in Q3):
```
1. Alice proposes signature to Bob
2. Bob receives notification
3. Bob opens proposal → sees:
   - All messages to be signed (full text)
   - Conversation participants
   - Alice's stated purpose
   - Preview of what signature payload will contain
4. Bob reviews → understands what he's signing
5. Bob signs (creates his own signature) OR declines
```
**Rationale**:
- **Transparency**: Recipient sees everything before committing
- **Informed consent**: No hidden content in signatures
- **User control**: Can decline or counter-propose
- **Prevents tricks**: Can't trick someone into signing something they didn't intend

#### 5.4 Privacy & Non-Repudiation
**Status**: ✅ Decided
**Decision**: **No special privacy concerns - signatures are intentionally permanent**
**Approach**:
- **Non-repudiation accepted**: Signatures are proof you signed something (that's the point)
- **Email visibility accepted**: Emails included in signatures (necessary for verification)
- **No anonymity**: Signatures are inherently non-anonymous (by design)
- **User warning**: Show one-time warning when generating keys about permanence
**Warning Text**:
```
"Digital signatures are permanent, cryptographic proof that you
signed a message. They cannot be revoked or denied. Only sign
messages you intend to be permanently associated with."

[I Understand] [Cancel]
```

#### 5.5 Simplified Security Posture
**Status**: ✅ Decided
**Decision**: **"Lax" security appropriate for MVP - trust Firebase/Firestore**
**What We're NOT Doing** (acceptable for MVP):
- ❌ Key revocation mechanisms
- ❌ Key expiration / rotation
- ❌ Hardware security module (HSM) integration
- ❌ Multi-signature / threshold signatures
- ❌ Zero-knowledge proofs
- ❌ Blockchain / distributed ledger
- ❌ Complex privacy-preserving cryptography

**What We ARE Doing** (sufficient for MVP):
- ✅ PGP signatures (industry standard)
- ✅ Firebase Auth for identity
- ✅ Firestore for key storage (encrypted private keys)
- ✅ Server-side verification by AI agents
- ✅ Contiguous message selection
- ✅ Proposal review flow

**Rationale**: Get MVP working with simple, proven patterns, then enhance security based on real-world usage

---

### Question 6: Portability & Interoperability

#### 6.1 Export/Import Functionality
**Status**: ⏸️ Deferred (Low Priority for MVP)
**Decision**: **Minimal or no export/import in MVP**
**Rationale**:
- **Low priority**: Focus on core signature creation and AI agent validation
- **App-specific**: Signatures live in Firestore, accessed via app
- **Future enhancement**: Can add export/download later if users request it
**MVP Scope**:
- ❌ No export button (deferred)
- ❌ No import functionality (deferred)
- ❌ No cross-platform verification (deferred)
- ✅ Signatures viewable in Signature Drawer (in-app only)
**Post-MVP** (if needed):
- Add JSON export option
- Add import from file
- Support standard PGP format for external verification

#### 6.2 Interoperability
**Status**: ⏸️ Deferred
**Decision**: **App-specific format only for MVP**
**Rationale**: Signatures are primarily for in-app AI agent use, not external sharing

---

### Question 7: Performance & Scalability

#### 7.1 Performance Targets & Signing Location
**Status**: ✅ Decided
**Decision**: **Client-side (on-device) signing with lightweight ECC algorithm**
**Implementation**:
- **All signing operations on device** using OpenPGP.js in React Native
- **ECC Curve25519** for lightweight, fast performance
- **Client generates signatures** and uploads to Firestore
- **Server verifies signatures** for AI agent actions (security)

**Performance Benchmarks** (ECC Curve25519):
- **Key generation**: ~100-200ms (fast enough, no progress bar needed)
- **Signing**: ~10-20ms (instant UX)
- **Verification** (client): ~5-10ms (instant)
- **Verification** (server): ~10-20ms (acceptable for AI agents)

**Rationale**:
- **On-device signing**: User controls private key, more secure
- **Lightweight algo**: ECC chosen specifically for mobile performance
- **Server verification**: AI agents re-verify to prevent spoofing
- **Best of both**: Fast client UX + secure server validation

**Client Signing Flow**:
```typescript
// Client-side (React Native)
1. User selects messages and taps "Sign"
2. Fetch encrypted private key from Firestore
3. Decrypt with passphrase
4. Sign payload with OpenPGP.js (~10-20ms)
5. Upload signature to Firestore
6. Update message docs with signatureId
```

**Server Verification Flow** (for AI agents):
```typescript
// Server-side (Cloud Functions)
1. Firestore trigger fires on signature creation
2. Fetch signature and public key
3. Re-verify using OpenPGP.js (~10-20ms)
4. Update verified status
5. If valid + purpose=approval → trigger approval agent
```

#### 7.2 Scalability Considerations
**Status**: ✅ Decided
**Decision**: **Simple architecture sufficient for MVP scale**
**MVP Scale Assumptions**:
- 10-100 users
- ~10-50 signatures per user
- AI agents verify ~100-500 signatures/month
- Storage: ~50-500KB total signature data (ECC signatures are small)

**Storage Costs** (negligible):
- Firestore: ~$0.01/month at MVP scale
- Cloud Functions: Within free tier
- ECC signatures are 1/4 size of RSA (saves storage)

**Performance Optimizations**:
- ✅ Cached verification results (Q2.3)
- ✅ Pre-verification on signature creation
- ✅ Simple query patterns (date DESC only)
- ✅ Lightweight ECC algorithm

**No performance concerns for MVP**

---

### Question 8: Privacy & Compliance

#### 8.1 Legal & Compliance
**Status**: ✅ Decided
**Decision**: **No privacy concerns for MVP - keep it simple**
**Approach**:
- **No legal disclaimers**
- **No eSignature compliance**
- **No audit logs** (simple timestamps only)
- **No privacy features** (accepted for MVP)
- **Informational/workflow use only**

**User Warning** (minimal):
```
"Digital signatures provide cryptographic proof you signed a message."

[OK]
```

#### 8.2 Data Privacy
**Status**: ✅ Decided
**Decision**: **No special privacy considerations for MVP**
**Implementation**:
- **Email visibility**: Accepted (emails in signed payloads, not a concern)
- **Signature permanence**: Accepted (users understand signatures are proof)
- **User control**: Users can delete their own signatures if desired
- **Simple model**: No anonymization, no complex privacy features

**Data Retention**:
- User-controlled (can delete anytime)
- No automatic expiration
- No GDPR compliance needed (internal tool for MVP)

#### 8.3 Simplified Compliance Posture
**Status**: ✅ Decided
**Decision**: **Zero compliance overhead for MVP**
**What We're NOT Doing**:
- ❌ Legal eSignature compliance (eIDAS, ESIGN Act)
- ❌ Privacy features (anonymization, encryption beyond PGP)
- ❌ Audit trails / tamper-proof logging
- ❌ Retention policies
- ❌ GDPR compliance features
- ❌ Consent management

**What We ARE Doing**:
- ✅ Basic digital signatures (cryptographic proof only)
- ✅ User can delete signatures
- ✅ Simple, transparent system

**Rationale**: MVP is for internal workflow coordination, not regulated use cases. Focus on functionality, add compliance later if needed.

---

## Executive Summary

This document identifies key architectural, security, and UX questions that must be answered before implementing a digital signature system for chat messages. The system will enable users to cryptographically sign messages, verify signatures, and allow AI agents to use signatures for authentication and authorization.

**Core Requirements**:
- Users can sign one or multiple messages/conversation segments
- Signatures are portable (download/upload)
- PGP-based cryptographic signatures
- Each user manages their own public/private key pair
- AI agents can validate signatures and perform authorized actions
- Signature drawer/collection interface for users

---

## High-Level Question Categories

1. **Cryptographic Architecture & Key Management**
2. **Data Model & Storage Strategy**
3. **User Experience & Signature Workflows**
4. **AI Agent Integration & Authorization**
5. **Security & Trust Model**
6. **Portability & Interoperability**
7. **Performance & Scalability**
8. **Privacy & Compliance**

---

## Question 1: Cryptographic Implementation Strategy

### Context
PGP/GPG provides strong cryptographic signatures, but there are multiple implementation approaches for a mobile/web React Native application.

### Key Questions

**1.1 Which cryptographic library should we use?**

Options:
- **OpenPGP.js** (JavaScript/TypeScript)
  - ✅ Pure JS, works in React Native and web
  - ✅ Actively maintained, RFC 4880 compliant
  - ✅ No native dependencies
  - ❌ Larger bundle size (~300KB minified)
  - ❌ Slower than native implementations

- **React Native Crypto** (Native bindings)
  - ✅ Faster performance
  - ✅ Smaller bundle size
  - ❌ Platform-specific implementation required
  - ❌ More complex build process
  - ❌ May not work on web

- **Hybrid Approach** (Cloud Functions for signing)
  - ✅ Centralized key management possible
  - ✅ Consistent across platforms
  - ❌ Keys stored server-side (security concern)
  - ❌ Requires network for every signature
  - ❌ Not truly "user-controlled" keys

**Recommendation Needed**: Which approach balances security, performance, and cross-platform compatibility?

---

**1.2 How should private keys be stored?**

Options:
- **Device-only (Keychain/KeyStore)**
  - ✅ Maximum security (keys never leave device)
  - ✅ Platform secure storage (iOS Keychain, Android KeyStore)
  - ❌ Lost if device is lost (unless backed up)
  - ❌ No multi-device sync

- **Encrypted cloud backup**
  - ✅ Multi-device access
  - ✅ Recovery if device lost
  - ❌ Requires strong passphrase
  - ❌ Risk of cloud storage compromise
  - ❌ Complex key derivation for encryption

- **Hardware security (future)**
  - ✅ Most secure (TPM, Secure Enclave)
  - ❌ Not available on all devices
  - ❌ Complex implementation

**Questions to Answer**:
- Is multi-device support required in MVP?
- What is the user recovery flow if keys are lost?
- Do we support key export/import?

---

**1.3 What key strength and algorithm should we use?**

Options:
- **RSA 2048-bit**
  - ✅ Widely compatible
  - ✅ Well-tested
  - ❌ Larger signatures
  - ❌ Slower generation

- **RSA 4096-bit**
  - ✅ Stronger security
  - ❌ Much slower
  - ❌ Very large signatures

- **ECC (Curve25519)**
  - ✅ Smaller keys and signatures
  - ✅ Faster operations
  - ❌ Less universal support
  - ❌ Some PGP implementations don't support

**Tradeoff**: Security vs. performance vs. compatibility

---

## Question 2: Data Model & Storage Architecture

### Context
Signatures need to reference messages, be queryable, and be portable. How we structure this data impacts performance, storage costs, and UX.

### Key Questions

**2.1 How do we structure signature documents in Firestore?**

Option A: **Signatures as subcollection of messages**
```typescript
conversations/{convId}/messages/{msgId}/signatures/{sigId}
{
  signerId: string,
  signature: string, // PGP signature blob
  publicKey: string,
  signedAt: timestamp,
  payload: {
    messageIds: string[],
    messageTexts: string[],
    conversationId: string
  }
}
```
- ✅ Natural hierarchy (signature belongs to message)
- ✅ Easy to query "all signatures for this message"
- ❌ Complex for multi-message signatures
- ❌ Harder to query "all signatures by user X"

Option B: **Signatures as top-level collection**
```typescript
signatures/{sigId}
{
  signerId: string,
  conversationId: string,
  messageIds: string[],
  signature: string,
  publicKey: string,
  payload: SignedPayload,
  createdAt: timestamp
}
```
- ✅ Easier to query across conversations
- ✅ Better for multi-message signatures
- ✅ Natural for "signature drawer" feature
- ❌ Less clear ownership (who can delete?)

Option C: **Signatures stored in user's profile collection**
```typescript
users/{userId}/signatures/{sigId}
{
  // User's signature collection (signatures they created)
}

users/{userId}/collected_signatures/{sigId}
{
  // Signatures collected from others
}
```
- ✅ Clear ownership model
- ✅ Perfect for "signature drawer"
- ✅ User controls their own signatures
- ❌ Harder to query "all signatures on message X"
- ❌ Data duplication if multiple users collect same signature

**Question**: Which model best supports:
1. Quick verification (given a message, find signatures)
2. User's signature drawer (all signatures I've collected)
3. AI agent queries (find all signatures by user X with property Y)
4. Export/import functionality

---

**2.2 What data should be included in the signed payload?**

Minimum requirements:
```typescript
interface SignedPayload {
  version: string,          // Signature schema version
  timestamp: number,        // When signed
  signerId: string,         // Who signed
  messageIds: string[],     // What was signed
  messageTexts: string[],   // Actual content (for verification)
  conversationId: string,   // Context

  // Optional metadata
  purpose?: string,         // Why was this signed? ("approval", "attestation", etc.)
  expiresAt?: number,       // Signature expiration
  nonce?: string,           // Prevent replay attacks
}
```

**Questions**:
- Should we include conversation metadata (participants, topic)?
- Should we include hashes of messages instead of full text (smaller, but requires original messages for verification)?
- How do we handle message edits after signing?
- Should signatures support arbitrary metadata (user-defined purpose, tags)?

---

**2.3 How do we handle signature verification results?**

Options:
- **Verify on-demand** (when user views)
  - ✅ Always up-to-date
  - ❌ Slower UX (verification takes time)
  - ❌ More computation

- **Pre-verify and cache** (Cloud Function trigger)
  - ✅ Fast UX
  - ✅ Can show verification status in list
  - ❌ Stale if keys are revoked
  - ❌ More storage

- **Hybrid** (cache + re-verify periodically)
  - ✅ Fast UX most of the time
  - ✅ Reasonably up-to-date
  - ❌ Complex implementation

**Storage for verification results**:
```typescript
signatures/{sigId}/verification
{
  isValid: boolean,
  verifiedAt: timestamp,
  verifiedBy: string, // Cloud Function or client
  errors?: string[],
  publicKeyFingerprint: string
}
```

---

## Question 3: User Experience & Signature Workflows

### Context
Digital signatures are unfamiliar to most users. How do we make this intuitive while maintaining security?

### Key Questions

**3.1 What is the key generation/onboarding flow?**

Options:
- **Auto-generate on first use**
  - User sees "Generate Keys" prompt
  - Explain briefly what keys do
  - Generate in background
  - Show success + public key fingerprint
  - **Tradeoff**: Simple but less transparent

- **Explicit setup wizard**
  - Multi-step guide explaining keys
  - Let user choose key strength
  - Show recovery phrase/backup options
  - **Tradeoff**: More informed but slower onboarding

- **Optional feature** (don't require keys)
  - Users can use app without signatures
  - Generate keys only when first signing
  - **Tradeoff**: Simpler for non-users, but fragmented experience

**Questions**:
- Is signature functionality core or optional?
- Do we support importing existing PGP keys?
- How do we explain key concepts to non-technical users?

---

**3.2 How do users sign messages?**

Workflow options:

**Option A: Long-press message menu**
```
User long-presses message
  → "Sign this message" option appears
  → Modal shows: "Sign message?" with preview
  → User confirms (optional: enter purpose, expiration)
  → Signature created
  → Visual indicator appears on message
```

**Option B: Multi-select mode**
```
User enters "selection mode"
  → Taps multiple messages to select
  → "Sign selected" button appears
  → Confirmation modal
  → Signature created for batch
  → Visual indicator on all signed messages
```

**Option C: Conversation-level signing**
```
Conversation header has "Sign conversation" button
  → User selects date range or message range
  → Preview of what will be signed
  → Confirmation
  → Signature created
```

**Questions**:
- Do we support all three modes or start with one?
- How do we handle partial conversation signatures (messages 5-10 of 50)?
- Can users sign messages from other users, or only their own?
- Should there be a "signature reason" field (approval, attestation, agreement)?

---

**3.3 What is the "Signature Drawer" UX?**

Requirements:
- Tab or screen showing all collected signatures
- Organized by: date, conversation, signer, purpose?
- Download individual or bulk signatures
- Upload signatures from external source
- Verify signatures on demand

**Questions**:
- How do users "collect" a signature (auto-collect all they see, or manual save)?
- Can users organize signatures (folders, tags, labels)?
- What export format (JSON, PGP armored text, ZIP archive)?
- Should signatures be shareable outside the app (email, AirDrop)?

---

**3.4 How do we visualize signatures on messages?**

Options:
- **Badge/icon on message bubble**
  - 🔏 icon with signature count
  - Tap to see signature details

- **Signature ribbon below message**
  - Shows "Signed by Alice, Bob"
  - Color-coded by verification status (green=valid, red=invalid, yellow=unverified)

- **Signatures section in message details**
  - Long-press → "View Signatures"
  - Shows all signatures on that message

**Questions**:
- How do we avoid cluttering the chat UI?
- Should unverified signatures be shown prominently or hidden?
- How do we indicate who signed vs. who authored the message?

---

## Question 4: AI Agent Integration & Authorization

### Context
AI agents need to validate signatures and use them to authorize actions. This is a novel use case requiring careful design.

### Key Questions

**4.1 How do AI agents verify signatures?**

Implementation options:

**Option A: Client-side verification only**
- Mobile app verifies signatures
- Sends verified claims to Cloud Functions
- AI trusts client verification
- ❌ **Security Risk**: Client could lie about verification

**Option B: Server-side verification (Cloud Functions)**
- Cloud Function receives signature + payload
- Verifies using OpenPGP.js in Node.js
- AI uses verified result
- ✅ **More secure**
- ❌ More latency, more compute costs

**Option C: Hybrid verification**
- Client verifies for UX (fast feedback)
- Server re-verifies before authorizing actions
- Best of both worlds
- ❌ More complex

**Questions**:
- Can we trust client-side verification for high-stakes actions?
- How do we prevent replay attacks (user signs once, AI uses signature multiple times)?
- Should signatures include scope/permissions ("allowed to approve expenses < $1000")?

---

**4.2 What actions should AI agents support based on signatures?**

Examples:
- **Approval workflows**
  - "Alice signs a message approving Bob's expense report"
  - AI extracts approval, creates action item

- **Attestations**
  - "Team signs summary of meeting decisions"
  - AI stores as verified decision record

- **Delegation**
  - "Manager signs delegation: 'Bob can approve up to $500'"
  - AI enforces delegation in future actions

- **Identity verification**
  - "User signs message proving identity"
  - AI can reference this for future actions

**Questions**:
- What is the full list of signature-enabled AI actions?
- How do we express permissions/scope in signatures?
- Do signatures need semantic structure (e.g., "action: approve, object: expense-report-123")?
- How do we prevent signature misuse (signing one thing, AI interpreting as another)?

---

**4.3 How do we structure signature metadata for AI parsing?**

Option A: **Free-form purpose field**
```typescript
{
  purpose: "Approving the Q4 budget proposal discussed in messages 45-67"
}
```
- ✅ Flexible
- ❌ Hard for AI to parse reliably

Option B: **Structured metadata**
```typescript
{
  purpose: "approval",
  action: "approve",
  object: {
    type: "budget-proposal",
    id: "q4-2025",
    messageRange: { start: 45, end: 67 }
  },
  constraints: {
    validUntil: "2025-12-31",
    maxAmount: 50000
  }
}
```
- ✅ AI can reliably parse
- ✅ Clear semantics
- ❌ Less flexible
- ❌ Requires predefined schemas

**Questions**:
- Should we support both free-form and structured?
- How do we version signature metadata schemas?
- Can users create custom signature types?

---

## Question 5: Security & Trust Model

### Context
Cryptographic signatures are only as good as the trust model around public keys and verification.

### Key Questions

**5.1 How do we establish trust in public keys?**

Options:
- **Web of Trust** (PGP standard)
  - Users sign each other's keys
  - Trust is transitive
  - ❌ Complex for average users
  - ❌ Requires critical mass of users

- **Trust on First Use (TOFU)**
  - First time you see a key, trust it
  - Warn if key changes
  - ✅ Simple for users
  - ❌ Vulnerable to MITM on first connection

- **Centralized verification** (Firebase Auth)
  - Public key stored in user profile
  - Verified via Firebase Auth
  - ✅ Simple
  - ✅ Tied to authenticated user
  - ❌ Relies on Firebase security
  - ❌ Not truly decentralized

- **Hybrid** (TOFU + optional verification)
  - Default to TOFU
  - Allow users to manually verify keys (QR code, fingerprint comparison)
  - Mark verified keys with indicator

**Questions**:
- How critical is decentralized trust for MVP?
- Do we support key revocation? How?
- What happens if a user's key is compromised?
- Should we support multiple keys per user (work key, personal key)?

---

**5.2 How do we prevent signature misuse?**

Threats:
- **Replay attacks**: User signs message once, attacker re-uses signature
  - **Mitigation**: Include nonce + timestamp in payload

- **Context manipulation**: Signature from one conversation used in another
  - **Mitigation**: Include conversationId in signed payload

- **Partial signature**: Attacker removes some messages from multi-message signature
  - **Mitigation**: Include hash of all messages, verify all are present

- **Key substitution**: Attacker claims someone else's signature as their own
  - **Mitigation**: Verify signature matches claimed public key

**Questions**:
- Do signatures need expiration dates?
- Should we support signature revocation (user can revoke a signature after creating)?
- How do we handle clock skew (timestamp validation)?

---

**5.3 What are the privacy implications?**

Concerns:
- **Public keys are public** (deanonymization)
  - Public keys can be linked across contexts
  - Fingerprints are permanent identifiers

- **Signatures are permanent** (non-repudiation)
  - User cannot deny signing something
  - Could be used against them

- **Message content in signatures** (data leakage)
  - Signed payload includes message text
  - Signature files contain sensitive data

**Questions**:
- Should users be warned about non-repudiation?
- Can users delete signatures they created?
- Should we support anonymous/pseudonymous signatures?
- How do we comply with GDPR "right to be forgotten"?

---

## Question 6: Portability & Interoperability

### Context
Signatures should be portable outside the app for maximum utility and to avoid lock-in.

### Key Questions

**6.1 What export format should we use?**

Options:
- **PGP Armored Text** (RFC 4880)
  ```
  -----BEGIN PGP SIGNED MESSAGE-----
  Hash: SHA256

  [payload]
  -----BEGIN PGP SIGNATURE-----
  [signature]
  -----END PGP SIGNATURE-----
  ```
  - ✅ Standard, universally verifiable
  - ✅ Works with gpg command-line tools
  - ❌ Doesn't include app-specific metadata

- **JSON with embedded PGP**
  ```json
  {
    "version": "1.0",
    "payload": { ... },
    "signature": "-----BEGIN PGP SIGNATURE-----...",
    "metadata": {
      "app": "gauntlet-chat",
      "purpose": "approval",
      ...
    }
  }
  ```
  - ✅ Includes all metadata
  - ✅ Easy to parse
  - ❌ Not standard PGP format

- **Both** (export in both formats)
  - User chooses based on use case
  - ❌ More implementation work

**Questions**:
- Do we prioritize interoperability or rich metadata?
- Should exported signatures be human-readable?
- Do we support batch export (multiple signatures in one file)?

---

**6.2 How do we handle signature imports?**

Scenarios:
- User exports signature from desktop app, imports to mobile
- User receives signature via email, imports to app
- User imports signatures from another messaging app

**Questions**:
- Do we validate imported signatures before accepting?
- How do we handle conflicts (duplicate signatures, different versions)?
- Can imported signatures reference messages not in our database?
- Should we support importing third-party signatures (non-Gauntlet Chat)?

---

**6.3 Should we support cross-platform signature verification?**

Use cases:
- User signs in Gauntlet Chat, signature verified on website
- User signs in email (PGP), signature imported to Gauntlet Chat
- Third-party app verifies Gauntlet Chat signatures

**Questions**:
- Do we provide a public verification API/endpoint?
- Should signatures be verifiable without the app (using standard PGP tools)?
- How do we handle app-specific metadata in cross-platform scenarios?

---

## Question 7: Performance & Scalability

### Context
Cryptographic operations are expensive. Large-scale signature operations could impact performance and costs.

### Key Questions

**7.1 What are the performance bottlenecks?**

Operations to benchmark:
- **Key generation**: RSA 2048 ~500ms, RSA 4096 ~5s, ECC ~100ms
- **Signing**: RSA ~50ms, ECC ~10ms
- **Verification**: RSA ~10ms, ECC ~5ms
- **Bulk operations**: Signing 100 messages, verifying 100 signatures

**Questions**:
- Are these acceptable for mobile devices?
- Should we offload heavy operations to Cloud Functions?
- Do we need progress indicators for batch operations?
- Can we parallelize verification (Worker threads)?

---

**7.2 How do we scale verification for AI agents?**

Scenario: AI agent needs to verify 1000 signatures across 100 conversations

Options:
- **Sequential verification**
  - Simple
  - ❌ Very slow (1000 × 10ms = 10 seconds minimum)

- **Batch verification in Cloud Functions**
  - Verify many signatures in parallel
  - ✅ Much faster
  - ❌ Higher Cloud Function costs

- **Cached verification results**
  - Pre-verify signatures, store results
  - AI reads cached results
  - ✅ Very fast for AI
  - ❌ Stale if keys are revoked

**Questions**:
- What is the expected volume of signatures?
- How often do AI agents need to verify signatures?
- Can we use probabilistic/sampling verification for low-stakes actions?

---

**7.3 What are the storage costs?**

Estimates:
- **Public key**: ~2KB (RSA 2048)
- **Private key**: ~4KB (encrypted)
- **Signature**: ~256 bytes (RSA) to ~1KB (with metadata)
- **Signed payload**: Variable (message text + metadata)

Example: 100 users, each signs 50 messages/month = 5000 signatures/month
- Storage: 5000 × 1KB = 5MB/month
- Firestore reads (verification): 5000 × $0.06/100K = $0.003/month
- ✅ Very cheap at small scale

Questions:
- What is the expected signature volume at scale (1000 users, 10K users)?
- Should we archive old signatures (move to cheaper storage)?
- Do we need to limit signatures per user (rate limiting)?

---

## Question 8: Privacy & Compliance

### Context
Digital signatures have legal and compliance implications, especially with GDPR and other privacy laws.

### Key Questions

**8.1 What are the legal implications of digital signatures?**

Considerations:
- **Non-repudiation**: Legally binding in some jurisdictions
- **eSignature laws**: Different standards (EU eIDAS, US ESIGN Act)
- **Liability**: Who is responsible if signature is misused?

**Questions**:
- Do we need legal disclaimers about signature validity?
- Should we support different signature levels (informal vs. legally binding)?
- Do we need audit logs for signature operations?

---

**8.2 How do we comply with data privacy regulations?**

GDPR concerns:
- **Right to be forgotten**: Can user delete all their signatures?
- **Data portability**: Export all signature data in machine-readable format
- **Consent**: Do we need explicit consent for signature features?
- **Data minimization**: Do we store only necessary data in signed payloads?

**Questions**:
- What happens to signatures if user deletes account?
- Can other users keep signatures from deleted users?
- How do we handle signature data in backups?

---

**8.3 What data retention policies should we implement?**

Options:
- **Indefinite retention** (default)
  - Signatures never expire
  - ❌ Privacy concern
  - ❌ Storage costs grow

- **User-controlled retention**
  - User sets expiration on each signature
  - ✅ User control
  - ❌ Complex UX

- **Automatic expiration**
  - All signatures expire after X months
  - ✅ Simple
  - ❌ May lose important signatures

**Questions**:
- Should expired signatures be deleted or archived?
- Can users extend expiration before it expires?
- Do AI agents need access to expired signatures?

---

## 📊 MVP Decisions Summary

This section provides a quick reference of all decisions made during planning.

### ✅ Decided for MVP

**Cryptography (Q1)**
- Library: OpenPGP.js (JavaScript/TypeScript)
- Key Storage: Encrypted cloud storage in Firestore (MVP), migrate to device-only later
- Algorithm: ECC Curve25519 (lightweight, fast)
- Signing Location: Client-side (on-device)
- Key Management: User generates keys with passphrase encryption

**Data Model (Q2)**
- Structure: User-owned collections (`users/{userId}/signatures/`, `users/{userId}/collected_signatures/`)
- Payload: Rich payload with emails, timestamps, full message text, participants
- Verification: Pre-verify and cache results, re-verify on-demand
- Queries: Simple date DESC ordering, no complex filtering in MVP

**User Experience (Q3)**
- Onboarding: Optional key generation in settings or on first use
- Signing: Long-press → "Select messages" or "Propose signature to X"
- Selection: Contiguous messages only (no gaps)
- Signature Drawer: Dedicated tab, list view with detail view
- Visualization: Badge on messages with signature count
- Proposals: Send request to counterparty for review and signing

**AI Agents (Q4)**
- Verification: Server-side in Cloud Functions
- Lookup: Query by email to get public key
- Agents as Participants: AI agents join conversations
- MVP Use Case: Approval agent validates signatures, creates action items
- Trigger: Firestore onCreate trigger when signature created

**Security (Q5)**
- Trust Model: Centralized via Firebase Auth (simple)
- Replay Prevention: Contiguous selection + conversationId in payload
- Privacy: No concerns for MVP, emails visible, signatures permanent
- Security Posture: "Lax" for MVP - trust Firebase/Firestore

**Performance (Q7)**
- Signing: Client-side (on-device) with OpenPGP.js
- Algorithm: ECC Curve25519 (lightweight, ~10-20ms signing)
- Verification: Server-side re-verification for AI agents
- Performance: No concerns with ECC

**Privacy & Compliance (Q8)**
- No privacy features needed for MVP
- No compliance requirements (internal tool)
- Simple deletion by users
- Zero overhead approach

### ⏸️ Deferred (Post-MVP)

**Portability (Q6)**
- Export/import functionality (low priority)
- Cross-platform verification
- Standard PGP format support

**Advanced Features**
- Multi-signature support
- Key revocation/rotation
- Hardware security modules
- Complex privacy features
- Legal/compliance features

### 🎯 MVP Scope

**Core Features**:
1. ✅ Generate PGP key pairs (ECC Curve25519)
2. ✅ Sign contiguous message ranges (client-side)
3. ✅ Propose signatures to counterparties
4. ✅ Signature drawer (view, manage signatures)
5. ✅ AI approval agent (validates signatures, creates action items)
6. ✅ Server-side verification for AI agents

**Not in MVP**:
- ❌ Export/import signatures
- ❌ Multi-signature (multiple signers on same payload)
- ❌ Complex filtering/search in drawer
- ❌ Key revocation
- ❌ Legal compliance features

---

## 🛠️ Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Basic cryptography and key management

**Tasks**:
1. Install OpenPGP.js in React Native
2. Implement key generation flow (with passphrase)
3. Store encrypted keys in Firestore (`users/{userId}` profile)
4. Create settings screen for key management
5. Show public key fingerprint for verification

**Deliverables**:
- Users can generate PGP keys
- Keys stored securely in Firestore
- Basic key management UI

---

### Phase 2: Signature Creation (Week 3-4)
**Goal**: Users can sign messages

**Tasks**:
1. Implement contiguous message selection logic
2. Add long-press menu with signature options
3. Create signature modal (purpose, notes, preview)
4. Implement signing logic (OpenPGP.js)
5. Create SignedPayload structure
6. Save signatures to Firestore (`users/{userId}/signatures/`)
7. Add signature badge to message bubbles
8. Update message docs with `signatureIds` array

**Deliverables**:
- Users can select and sign contiguous messages
- Signatures stored in Firestore
- Visual indicators on signed messages

---

### Phase 3: Signature Drawer (Week 5)
**Goal**: Users can view and manage signatures

**Tasks**:
1. Create Signatures tab in navigation
2. Implement list view (DESC by date)
3. Create signature card component
4. Implement detail view (full payload + metadata)
5. Add delete functionality
6. Add "Save to Drawer" for collecting others' signatures

**Deliverables**:
- Signature Drawer tab working
- Users can view, manage, delete signatures
- Can collect signatures from others

---

### Phase 4: Signature Proposals (Week 6)
**Goal**: Users can propose signatures to others

**Tasks**:
1. Add "Propose signature to X" menu option
2. Create proposal notification system
3. Implement proposal review UI
4. Allow accept/decline/counter-propose
5. Store proposals in Firestore (temp collection)

**Deliverables**:
- Users can propose signatures
- Recipients can review and respond
- Collaborative signing workflow

---

### Phase 5: AI Agent Integration (Week 7-8)
**Goal**: Approval agent validates signatures

**Tasks**:
1. Implement server-side verification (Cloud Function)
2. Create `verifySignatureForAgent` function
3. Implement Firestore trigger (`onSignatureCreated`)
4. Create approval agent logic
5. Integrate LLM for approval extraction (reuse AI SDK from translation agent)
6. Create action items from approved signatures
7. Post confirmation messages to chat
8. Add AI agent as conversation participant

**Deliverables**:
- Approval agent working end-to-end
- Signatures trigger AI actions
- Action items created automatically
- Agent posts confirmations to chat

---

### Phase 6: Testing & Refinement (Week 9)
**Goal**: Polish and test MVP

**Tasks**:
1. End-to-end testing of all flows
2. Performance optimization
3. Error handling improvements
4. UI/UX polish
5. Documentation

**Deliverables**:
- Stable, tested MVP
- Documentation for users and developers

---

## 📋 Technical Implementation Checklist

### Client (React Native + Expo)

**Dependencies**:
```json
{
  "openpgp": "^5.11.0"
}
```

**New Files**:
```
components/signatures/
  ├── SignatureModal.tsx           // Create signature
  ├── SignatureDrawer.tsx          // List view
  ├── SignatureDetailView.tsx      // Detail view
  ├── SignatureProposal.tsx        // Proposal UI
  └── MessageSignatureBadge.tsx    // Badge on messages

services/
  └── signatures.ts                // Signature operations

types/
  └── signature.ts                 // TypeScript types

app/
  └── (tabs)/signatures.tsx        // Signatures tab
```

**Modified Files**:
```
app/chat/[id].tsx                  // Add long-press signature options
types/chat.ts                      // Add signatureIds to Message
```

---

### Backend (Cloud Functions)

**Dependencies** (add to `functions/package.json`):
```json
{
  "openpgp": "^5.11.0"
}
```

**New Files**:
```
functions/src/
  ├── agents/
  │   └── approvalAgent.ts         // Approval agent logic
  ├── services/
  │   └── signatureVerification.ts // Verify PGP signatures
  ├── triggers/
  │   └── onSignatureCreated.ts    // Firestore trigger
  └── types/
      └── signature.ts             // Signature types
```

**New Cloud Functions**:
- `verifySignatureForAgent` (callable)
- `onSignatureCreated` (Firestore trigger)

---

### Firestore Schema Changes

**User Profile** (`users/{userId}`):
```typescript
{
  // ... existing fields
  publicKey?: string,              // NEW
  publicKeyFingerprint?: string,   // NEW
  publicKeyCreatedAt?: timestamp,  // NEW
  privateKeyEncrypted?: string     // NEW (encrypted with passphrase)
}
```

**User Signatures** (`users/{userId}/signatures/{signatureId}`):
```typescript
{
  signatureId: string,
  signedPayload: SignedPayload,
  pgpSignature: string,
  publicKey: string,
  createdAt: timestamp,
  conversationId: string,
  messageIds: string[],
  purpose?: string,
  verified: boolean,
  verifiedAt?: timestamp
}
```

**Collected Signatures** (`users/{userId}/collected_signatures/{signatureId}`):
```typescript
{
  // Same as signatures, plus:
  collectedFrom: string,
  collectedAt: timestamp,
  source: 'conversation' | 'import'
}
```

**Messages** (`conversations/{convId}/messages/{msgId}`):
```typescript
{
  // ... existing fields
  signatureIds?: string[],         // NEW
  signatureCount?: number          // NEW
}
```

**Conversations** (`conversations/{convId}`):
```typescript
{
  // ... existing fields
  aiAgents?: {                     // NEW
    'ai-agent-approval': {
      type: 'approval-agent',
      permissions: string[],
      enabled: boolean
    }
  }
}
```

---

## 🚀 Ready to Implement

All major architectural decisions have been made. The specification is complete and ready for implementation.

**Next Steps**:
1. Create feature branch: `feature/digital-signatures`
2. Start with Phase 1 (Foundation)
3. Follow implementation roadmap
4. Use existing AI agent pattern (translation agent) as template for approval agent

---

## Document Version Control

- **v1.0** (2025-10-23): Initial draft - comprehensive question mapping
- **v1.1** (2025-10-23): All decisions finalized - ready for implementation

---

**Status**: ✅ Specification Complete - Ready for Development

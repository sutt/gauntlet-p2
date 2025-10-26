# Digital Signatures v2 (sig2) - Implementation Summary for Developers

**Version:** 1.0
**Date:** 2025-10-26
**Status:** Implemented (POC Complete)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [How to Interface with the Signature System](#how-to-interface-with-the-signature-system)
4. [Limitations and Workarounds](#limitations-and-workarounds)
5. [Design Constraints to Respect](#design-constraints-to-respect)
6. [Known Bugs, Patterns, and Problems](#known-bugs-patterns-and-problems)
7. [Unimplemented Features](#unimplemented-features)
8. [File Structure Reference](#file-structure-reference)

---

## Executive Summary

The sig2 feature provides **server-side digital signatures** for chat messages using PGP cryptography. This implementation enables users to cryptographically sign messages and allows AI agents to verify signature authenticity and extract payload data for trusted decision-making.

### Key Design Decision
All cryptographic operations (key generation, signing, verification) occur **server-side** in Firebase Cloud Functions using OpenPGP.js, due to React Native/Expo compatibility limitations with crypto libraries.

### Implementation Phases Completed
- ✅ **Phase 1:** Server-side key generation (ECC Curve25519)
- ✅ **Phase 2:** Server-side message signing with client UI
- ✅ **Phase 3:** Signature drawer/tab for viewing signatures
- ✅ **Phase 4.1:** Manual verification callable function + AI agent helper

### What Works
- Users can generate PGP key pairs server-side
- Users can sign one or more contiguous messages in chat
- Signatures are cryptographically valid (PGP/GPG)
- Signatures appear in dedicated drawer with "My Signatures" and "Received" tabs
- Signature distribution to counterparties in 1-on-1 conversations
- Manual signature verification via UI
- AI agents can verify signatures and extract trusted payload data

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT (React Native/Expo)            │
│                                                         │
│  • Message selection UI                                │
│  • Signature modal (purpose/notes)                     │
│  • Signature drawer (My / Received)                    │
│  • Signature detail view                               │
│  • NO crypto libraries                                 │
└─────────────────────────────────────────────────────────┘
                           │
                    HTTPS Callable Functions
                           │
┌─────────────────────────────────────────────────────────┐
│            SERVER (Firebase Cloud Functions)            │
│                                                         │
│  Cloud Functions:                                       │
│  • generateKeysForUser() - ECC Curve25519 generation   │
│  • signMessages() - PGP signing with private key       │
│  • verifySignature() - User-callable verification      │
│  • verifySignatureForAgent() - AI agent helper         │
│                                                         │
│  Crypto Library: OpenPGP.js v5.11.3                    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│              STORAGE (Firestore)                        │
│                                                         │
│  users/{uid}                                            │
│    • publicKey (armored PGP)                           │
│    • privateKey (armored PGP, unencrypted - POC)      │
│    • publicKeyFingerprint                              │
│                                                         │
│  users/{uid}/signatures/{signatureId}                  │
│    • signedPayload (JSON object)                       │
│    • pgpSignature (armored)                            │
│    • verified (boolean)                                │
│    • createdAt, conversationId, messageIds             │
└─────────────────────────────────────────────────────────┘
```

### Data Model

#### User Document (`users/{uid}`)
```typescript
{
  // Existing user fields...
  publicKey?: string;              // Armored PGP public key
  privateKey?: string;             // Armored PGP private key (UNENCRYPTED)
  publicKeyFingerprint?: string;   // 40-char hex fingerprint
  publicKeyCreatedAt?: Timestamp;
  signatureKeysVersion?: string;   // "2.0"
}
```

#### Signature Document (`users/{uid}/signatures/{signatureId}`)
```typescript
{
  signatureId: string;
  signedPayload: SignedPayload;    // See below
  pgpSignature: string;            // Armored PGP signature
  createdAt: Timestamp;
  conversationId: string;
  messageIds: string[];
  purpose?: string;                // e.g., "approval"
  verified: boolean;
  verifiedAt?: Timestamp;
  verifiedBy?: string;
  verificationError?: string;
}
```

#### SignedPayload Structure
```typescript
{
  version: "2.0";
  timestamp: number;               // Server-generated
  signedAt: string;                // ISO 8601
  nonce: string;                   // Replay protection
  signerId: string;                // User email
  conversationId: string;
  participants: Array<{
    email: string;
    displayName: string;
  }>;
  messages: Array<{
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    sentAt: string;
  }>;
  purpose?: string;
  notes?: string;
}
```

#### Message Document (Enhanced)
```typescript
{
  // Existing message fields...
  signatureIds?: string[];         // Signatures that include this message
  signatureCount?: number;         // Badge count
}
```

---

## How to Interface with the Signature System

### For Client-Side Developers

#### 1. Generate Keys for a User

**When:** User visits profile or signature setup for the first time.

**Code:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const generateKeys = httpsCallable(functions, 'generateKeysForUser');

try {
  const result = await generateKeys();
  console.log('Keys generated:', result.data);
  // result.data: { success: true, publicKey: string, fingerprint: string }
} catch (error) {
  console.error('Key generation failed:', error);
}
```

**What happens:**
- Server generates ECC Curve25519 key pair
- Keys stored in `users/{uid}` document
- Returns public key and fingerprint
- Takes ~300-800ms including network latency

#### 2. Sign Messages

**When:** User selects messages in chat and taps "Sign".

**Code:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/services/firebase';
import type { SignedPayload } from '@/types/signature';

// Build payload (client provides message data)
const payload: Partial<SignedPayload> = {
  signerId: auth.currentUser!.email!,
  conversationId: 'conv123',
  participants: [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' }
  ],
  messages: selectedMessages.map(m => ({
    messageId: m.id,
    text: m.text,
    senderId: m.senderId,
    senderName: m.senderName,
    timestamp: m.timestamp.getTime(),
    sentAt: new Date(m.timestamp).toISOString()
  })),
  purpose: 'approval',  // Optional
  notes: 'Q4 budget approved'  // Optional
};

const signMessages = httpsCallable(functions, 'signMessages');

try {
  const result = await signMessages({ conversationId: 'conv123', payload });
  console.log('Signature created:', result.data.signatureId);
  // result.data: { success: true, signatureId: string, pgpSignature: string }
} catch (error) {
  console.error('Signing failed:', error);
}
```

**What happens:**
- Server validates user is conversation participant
- Server fetches user's private key
- Server adds metadata (timestamp, nonce, version)
- Server signs payload with OpenPGP
- Signature document created in `users/{uid}/signatures/{signatureId}`
- Signature distributed to other participants (1-on-1 only)
- Message documents updated with `signatureIds` and `signatureCount`
- Takes ~200-500ms including network latency

#### 3. Query Signatures

**My Signatures:**
```typescript
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

const q = query(
  collection(db, 'users', auth.currentUser!.uid, 'signatures'),
  where('signerId', '==', auth.currentUser!.uid),
  orderBy('createdAt', 'desc')
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const mySignatures = snapshot.docs.map(doc => doc.data());
  console.log('My signatures:', mySignatures);
});
```

**Received Signatures:**
```typescript
const q = query(
  collection(db, 'users', auth.currentUser!.uid, 'signatures'),
  where('signerId', '!=', auth.currentUser!.uid),
  orderBy('createdAt', 'desc')
);
```

#### 4. Verify a Signature

**Manual verification from UI:**
```typescript
const verifyFunc = httpsCallable(functions, 'verifySignature');

try {
  const result = await verifyFunc({ signatureId: 'sig_abc123' });
  console.log('Verified:', result.data.verified);
  // result.data: { success: true, verified: boolean, signatureId: string }
} catch (error) {
  console.error('Verification failed:', error);
}
```

### For Server-Side/AI Agent Developers

#### 1. Verify Signature and Extract Trusted Payload

**Use Case:** AI agent needs to verify a signature's authenticity before trusting the payload.

**Code:**
```typescript
// In Cloud Function or agent code
import { verifySignatureForAgent } from './index';

const result = await verifySignatureForAgent(userId, signatureId);

if (result.verified) {
  console.log('[AI-AGENT] Signature verified, payload can be trusted');
  console.log('[AI-AGENT] Signed by:', result.payload.signerId);
  console.log('[AI-AGENT] Purpose:', result.payload.purpose);
  console.log('[AI-AGENT] Messages:', result.payload.messages);

  // Use payload for decision-making
  if (result.payload.purpose === 'approval') {
    // Extract approval details and create action items
  }
} else {
  console.error('[AI-AGENT] Signature verification failed:', result.error);
  // Do NOT trust the payload
}
```

**Important:**
- `verifySignatureForAgent()` NEVER trusts the `verified` field in Firestore
- It always performs fresh cryptographic verification
- Returns trusted payload only if signature is valid
- This is the ONLY way AI agents should verify signatures

#### 2. Access Verified Signature Data in Agent Context

**Pattern:**
```typescript
// Inside an agent function
async function processSignatureForAgent(userId: string, signatureId: string) {
  // Step 1: Verify signature
  const verificationResult = await verifySignatureForAgent(userId, signatureId);

  if (!verificationResult.verified) {
    console.error('[AGENT] Signature invalid or tampered');
    return { success: false, reason: 'Invalid signature' };
  }

  // Step 2: Extract data from trusted payload
  const payload = verificationResult.payload;
  const approvalText = payload.messages.map(m => m.text).join(' ');
  const approver = payload.signerId;
  const purpose = payload.purpose;

  // Step 3: Use data for decisions
  console.log(`[AGENT] Processing ${purpose} from ${approver}`);

  // Example: Create action item
  if (purpose === 'approval') {
    await createActionItem({
      approvedBy: approver,
      content: approvalText,
      timestamp: payload.timestamp,
      verified: true
    });
  }

  return { success: true };
}
```

---

## Limitations and Workarounds

### 1. Trust-the-Server Security Model (POC)

**Limitation:**
- Private keys stored **unencrypted** in Firestore
- Anyone with Firestore admin access can forge signatures
- Server compromise = all keys compromised

**Why:**
- This is a POC to prove the signature workflow
- Production-grade key security (HSM, Cloud KMS) deferred

**Workaround:**
- Accept this limitation for POC
- Document clearly in user-facing features
- Plan for production: encrypt keys with user passphrase or move to HSM

**Production Path:**
```
POC: keys stored unencrypted in Firestore
  ↓
V1: keys encrypted with server-managed key in Cloud Secret Manager
  ↓
V2: keys encrypted with user passphrase
  ↓
V3: keys stored in Cloud KMS or HSM
```

### 2. Client-Provided Payload (Trusted)

**Limitation:**
- Client builds the signed payload and sends to server
- Server **does not** re-fetch messages from Firestore to validate
- Malicious client could inject fake messages into payload

**Why:**
- Simpler POC implementation
- Focus on proving signature creation/verification workflow
- Re-fetching adds 100-200ms latency and extra Firestore costs

**Workaround:**
- Accept for POC with clear documentation
- For production: implement server-side payload validation

**Production Enhancement:**
```typescript
// Server-side in signMessages()
const messageIds = request.data.messageIds;

// Re-fetch messages from Firestore
const messageDocs = await admin.firestore()
  .collection('conversations').doc(conversationId)
  .collection('messages')
  .where('id', 'in', messageIds)
  .get();

// Validate client payload matches Firestore data
const actualMessages = messageDocs.docs.map(doc => doc.data());
if (!validatePayloadMatchesFirestore(payload.messages, actualMessages)) {
  throw new HttpsError('invalid-argument', 'Payload tampering detected');
}
```

### 3. 1-on-1 Conversations Only (Signature Distribution)

**Limitation:**
- Signature distribution (Phase 3.3) only works in **direct (1-on-1) conversations**
- Group chats: signature NOT copied to other participants
- Only the signer gets the signature in their collection

**Why:**
- Simplifies POC implementation
- Avoids handling N-1 copies for N participants
- Group chat logic more complex (who should get copies?)

**Workaround:**
- For POC: only use signatures in 1-on-1 conversations
- Document this limitation clearly
- For group chats: signer can still create signatures, but others won't see them in their "Received" tab

**Production Enhancement:**
```typescript
// In signMessages() Cloud Function
if (conversation.participants.length > 2) {
  // Group chat: distribute to all participants except signer
  for (const participantId of conversation.participants) {
    if (participantId !== userId) {
      await admin.firestore()
        .collection('users').doc(participantId)
        .collection('signatures').doc(signatureId)
        .set(signatureDoc);
    }
  }
}
```

### 4. Performance: 200-500ms Latency

**Limitation:**
- Server-side crypto adds network latency
- Client-side signing would be ~10-20ms (but not possible with Expo)
- Current latency: 200-500ms for signing operation

**Why:**
- Network round-trip to Cloud Function
- OpenPGP operations take ~100-200ms
- Firestore writes take ~50-100ms

**Workaround:**
- Accept for POC (< 1 second is acceptable)
- Use loading indicators in UI
- For production: optimize with caching and batching

**Optimization Strategies:**
- Cache decrypted private key in memory (for session)
- Batch multiple signature operations
- Use Cloud Function regional deployment closer to users

### 5. No Automatic Verification Trigger

**Limitation:**
- Signatures are NOT automatically verified on creation
- `verified` field remains `false` until manually verified
- Original plan had Firestore trigger for auto-verification

**Why:**
- Simplified implementation for POC
- Manual verification via UI button is sufficient for testing

**Workaround:**
- Users must click "Verify Now" button in signature detail view
- AI agents use `verifySignatureForAgent()` which always verifies fresh

**Production Enhancement:**
Implement Firestore trigger from original spec (see tasks-sig2.md Phase 4.1b):
```typescript
export const onSignatureCreated = onDocumentCreated(
  'users/{userId}/signatures/{signatureId}',
  async (event) => {
    // Auto-verify on creation
    const result = await verifySignatureInternal(...);
    await event.data.ref.update({ verified: result.verified });
  }
);
```

---

## Design Constraints to Respect

### 1. Server-Side Crypto Only

**Constraint:** ALL cryptographic operations MUST happen server-side.

**Why:** React Native/Expo incompatible with OpenPGP.js and other PGP libraries.

**What This Means:**
- Never install crypto packages in client (`package.json`)
- Never attempt to sign/verify client-side
- Always use Cloud Functions for key generation, signing, verification

**Files to Check:**
- `/functions/package.json` - OpenPGP.js installed here ✓
- `/package.json` (root) - NO OpenPGP.js ✓

### 2. ECC Curve25519 Algorithm

**Constraint:** Use ECC Curve25519 for all key generation.

**Why:** Fast, modern, secure. Signing takes ~100ms vs RSA ~500ms.

**Code:**
```typescript
const { privateKey, publicKey } = await openpgp.generateKey({
  type: 'ecc',
  curve: 'curve25519',  // REQUIRED
  userIDs: [{ email: userEmail }],
  format: 'armored'
});
```

**Do NOT:**
- Use RSA (too slow for server-side signing)
- Use other curves without testing performance

### 3. Nonce for Replay Protection

**Constraint:** Every signature MUST include a unique `nonce` in the payload.

**Why:** Prevents replay attacks (same signature used twice).

**Implementation:**
```typescript
payload.nonce = generateNonce();  // Random 20+ character string
```

**Server adds this:** Client does NOT generate nonce.

### 4. Version Field

**Constraint:** All signatures MUST have `version: "2.0"` in payload.

**Why:** Distinguishes server-side signatures (v2) from abandoned client-side plan (v1).

**Check:**
```typescript
if (payload.version !== '2.0') {
  throw new Error('Invalid signature version');
}
```

### 5. Immutable Signatures

**Constraint:** Signature documents MUST be immutable after creation.

**Why:** Tampering detection - any modification invalidates cryptographic signature.

**Firestore Rules:**
```javascript
match /users/{userId}/signatures/{signatureId} {
  allow read: if request.auth.uid == userId;
  allow create: if false;  // Only server creates
  allow update: if false;  // Immutable (except verified field by server)
  allow delete: if false;  // Cannot delete
}
```

**Exception:** Server can update `verified`, `verifiedAt`, `verifiedBy` fields.

### 6. Contiguous Message Selection

**Constraint:** Users can ONLY sign contiguous (consecutive) messages.

**Why:** Prevents cherry-picking messages out of context.

**Implementation:**
```typescript
function isContiguous(selectedIds: string[], allMessages: Message[]): boolean {
  const indices = selectedIds
    .map(id => allMessages.findIndex(m => m.id === id))
    .sort((a, b) => a - b);

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      return false;
    }
  }
  return true;
}
```

**UI Behavior:** Reject non-contiguous selections with alert.

---

## Known Bugs, Patterns, and Problems

### 1. Web Platform Compatibility (Modal Issues)

**Problem:**
Custom modals (like SignatureModal) had rendering issues on web platform.

**Manifestation:**
- Modals not appearing
- Overlays not dismissing
- Z-index issues with other UI elements

**Solution:**
Created custom modal wrapper components that handle platform-specific rendering:
- `components/CustomModal.tsx` - Base modal wrapper
- Uses conditional rendering based on platform
- Consistent API across iOS, Android, and web

**Pattern to Follow:**
```typescript
import { Platform } from 'react-native';

const CustomModal = ({ visible, onClose, children }) => {
  if (Platform.OS === 'web') {
    // Web-specific modal rendering
  } else {
    // Native modal rendering
  }
};
```

**Reference Commit:** `4e3d565 fix: custom modals for profile edit actions (fixes web)`

### 2. Firestore Security Rules for Signatures

**Problem:**
Initial Firestore rules didn't allow signature document creation by server.

**Manifestation:**
- `signMessages()` Cloud Function failed with permission denied
- Signature documents couldn't be written to `users/{uid}/signatures/`

**Solution:**
Updated `firestore.rules`:
```javascript
match /users/{userId}/signatures/{signatureId} {
  allow read: if request.auth.uid == userId;
  allow create: if request.auth.token.admin == true;  // Server only
  allow update: if request.auth.token.admin == true;  // Server updates verified
  allow delete: if false;
}
```

**Pattern:** Server operations need admin privileges in Firestore rules.

**Reference Commit:** `faeb121 fix: sig2-3.1 | querying signatures works`

### 3. Empty Data Bug (Early Signing)

**Problem:**
Signing messages before conversation context was fully loaded resulted in incomplete payloads.

**Manifestation:**
- `participants` array was empty
- Missing sender names in signed messages

**Solution:**
Added data validation and loading checks:
```typescript
if (!conversationContext.participants || conversationContext.participants.length === 0) {
  throw new Error('Conversation context not loaded');
}
```

**Pattern:** Always validate data completeness before allowing user actions.

**Reference Commit:** `23ab40f fix: 2.2 | empty data bug`

### 4. AI Agent Verification Pattern

**Problem:**
How should AI agents verify signatures without trusting client-provided verification status?

**Solution:**
Created dedicated `verifySignatureForAgent()` helper function:
- NEVER trusts `verified` field in database
- Always performs fresh cryptographic verification
- Returns trusted payload only if valid

**Anti-Pattern (DO NOT DO THIS):**
```typescript
// BAD: Trusting database verified field
const sig = await getSignatureFromFirestore(signatureId);
if (sig.verified) {  // NEVER TRUST THIS
  processPayload(sig.signedPayload);
}
```

**Correct Pattern:**
```typescript
// GOOD: Fresh verification
const result = await verifySignatureForAgent(userId, signatureId);
if (result.verified) {
  processPayload(result.payload);  // Trusted payload
}
```

**Reference Commit:** `71e8332 impl: sig2 4.1 | helper func for checkSig callable by agent`

### 5. Relative Date Formatting

**Pattern:** Use relative dates in list views, absolute in detail views.

**Implementation:**
```typescript
// List view (signatures tab)
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Detail view
function formatAbsoluteDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
}
```

### 6. Signature Badge Navigation

**Pattern:** Message signature badges should navigate to signature detail view.

**Implementation:**
```typescript
// In MessageBubble component
{message.signatureCount > 0 && (
  <TouchableOpacity
    onPress={() => {
      const signatureId = message.signatureIds[0];
      router.push(`/signatures/${signatureId}`);
    }}
  >
    <Text>🔏 {message.signatureCount}</Text>
  </TouchableOpacity>
)}
```

### 7. Selection Mode Toggle Pattern

**Problem:** How to allow users to switch between translation and signing modes?

**Solution:** Toggle button that switches `longPressMode` state:
```typescript
const [longPressMode, setLongPressMode] = useState<'translate' | 'sign'>('translate');

// Toggle button in header
<TouchableOpacity onPress={() => {
  setLongPressMode(mode => mode === 'translate' ? 'sign' : 'translate');
}}>
  <Text>{longPressMode === 'translate' ? '🌐' : '✍️'}</Text>
</TouchableOpacity>
```

**Reference Commit:** `39d05b5 impl: sig2 2.1 | message select + toggle translate/sign button`

---

## Unimplemented Features

### 1. Automatic Signature Verification Trigger

**Status:** Not implemented (Phase 4.1b)

**Description:**
Original spec included Firestore trigger to automatically verify signatures on creation.

**Impact:**
- Signatures remain `verified: false` until manually verified
- Users must click "Verify Now" button
- AI agents must use `verifySignatureForAgent()` (which does fresh verification)

**Workaround:**
Manual verification via UI or AI agent helper function.

**Implementation Path:**
See `tasks-sig2.md` Phase 4.1b for full code example.

**Effort:** 2-3 hours (low complexity)

### 2. Group Chat Signature Distribution

**Status:** Not implemented (Phase 3 limitation)

**Description:**
Signatures in group chats (3+ participants) are not distributed to other participants.

**Impact:**
- In group chats, only the signer sees the signature in their drawer
- Other participants don't see the signature in their "Received" tab
- Limits usefulness of signatures in group contexts

**Workaround:**
Only use signatures in 1-on-1 (direct) conversations.

**Implementation Path:**
```typescript
// In signMessages() Cloud Function
const participants = conversationData.participants;

if (participants.length === 2) {
  // Current: 1-on-1 distribution works
} else {
  // TODO: Distribute to all N-1 participants
  for (const participantId of participants) {
    if (participantId !== userId) {
      await admin.firestore()
        .collection('users').doc(participantId)
        .collection('signatures').doc(signatureId)
        .set(signatureDocCopy);
    }
  }
}
```

**Effort:** 4-6 hours (medium complexity)

### 3. Signature Revocation/Deletion

**Status:** Not implemented

**Description:**
No way to revoke or delete signatures after creation.

**Impact:**
- Immutable signatures (good for integrity)
- Cannot remove mistaken or outdated signatures
- Database accumulates all signatures

**Workaround:**
Accept immutability for POC. Production can add "revoked" status.

**Implementation Path:**
1. Add `revoked: boolean` field to signature documents
2. Add `revokeSignature()` Cloud Function
3. Update UI to show revoked status
4. Verification checks revocation status

**Effort:** 6-8 hours (medium complexity)

### 4. Signature Export (JSON/PDF)

**Status:** Not implemented

**Description:**
No way to export signatures for external use or archival.

**Impact:**
- Signatures locked in Firestore
- Cannot share signatures outside the app
- No portable format for legal/compliance use

**Workaround:**
Users can view in app, copy PGP signature manually.

**Implementation Path:**
1. Add export button in signature detail view
2. Generate JSON file with payload + signature
3. (Optional) Generate PDF with formatted signature details
4. Use expo-sharing to export file

**Effort:** 8-12 hours (medium-high complexity)

### 5. Signature Search and Filtering

**Status:** Not implemented

**Description:**
No way to search signatures by content, purpose, or date range.

**Impact:**
- Only chronological browsing
- Difficult to find specific signatures in large lists
- No filtering by conversation or participant

**Workaround:**
Scroll through list manually.

**Implementation Path:**
1. Add search bar to signatures tab
2. Add filter options (purpose, date range, participant)
3. Query Firestore with filters
4. Update UI to show filtered results

**Effort:** 10-15 hours (high complexity due to Firestore query limitations)

### 6. Signature Notifications

**Status:** Not implemented

**Description:**
No notification when receiving a signature from another user.

**Impact:**
- Users must manually check "Received" tab
- May miss important signatures
- No real-time awareness

**Workaround:**
Check "Received" tab periodically.

**Implementation Path:**
1. Add Firestore trigger on signature creation
2. Send push notification to recipient(s)
3. Update badge count on signatures tab
4. Add in-app notification UI

**Effort:** 12-16 hours (high complexity due to push notification setup)

### 7. Multi-Signature Support (Same Messages)

**Status:** Not implemented (by design)

**Description:**
If user signs the same messages multiple times, multiple signature documents are created with no deduplication.

**Impact:**
- Duplicate signatures possible
- No "already signed" warning
- Database bloat if user repeatedly signs same messages

**Workaround:**
User awareness (don't sign same messages twice).

**Implementation Path:**
1. Before creating signature, check if messageIds already signed
2. Show warning: "These messages are already signed. Create new signature?"
3. (Optional) Allow users to view existing signatures for these messages

**Effort:** 4-6 hours (medium complexity)

### 8. Batch Signature Operations

**Status:** Not implemented

**Description:**
No way to verify, export, or delete multiple signatures at once.

**Impact:**
- Must interact with signatures one at a time
- Time-consuming for bulk operations

**Workaround:**
Process signatures individually.

**Implementation Path:**
1. Add selection mode to signatures list
2. Add batch action buttons (verify all, export all, etc.)
3. Implement batch Cloud Functions
4. Update UI with progress indicators

**Effort:** 15-20 hours (high complexity)

### 9. AI Agent Action Item Creation

**Status:** Not implemented (Phase 4 future work)

**Description:**
AI agents can verify signatures and extract payload, but don't automatically create action items or perform approval processing.

**Impact:**
- Manual interpretation of signature payloads needed
- No automated workflow from signature to action
- Limited AI agent integration

**Workaround:**
AI agents log payload data for manual review.

**Implementation Path:**
See original spec in `architecture-decisions.md` Q5 for details on approval extraction and action item creation.

**Effort:** 20-30 hours (high complexity, requires AI agent integration)

---

## File Structure Reference

### Client-Side Files

```
/types/
  signature.ts              - SignedPayload, Signature interfaces
  chat.ts                   - Message interface with signature fields

/components/
  SignatureModal.tsx        - Modal for signing messages (purpose/notes)
  SignatureCard.tsx         - Card component for signature list

/app/
  settings/
    signature-setup.tsx     - Key generation setup screen

  (tabs)/
    signatures.tsx          - Main signatures tab (My / Received)
    profile.tsx             - Profile with signature setup button
    _layout.tsx             - Tab navigation with signatures tab

  chat/
    [id].tsx                - Chat screen with signature selection

  signatures/
    [id].tsx                - Signature detail view with verification

/services/
  messages.ts               - Message data conversion with signature fields
```

### Server-Side Files

```
/functions/
  src/
    index.ts                - All Cloud Functions:
                              • generateKeysForUser()
                              • signMessages()
                              • verifySignature()
                              • verifySignatureForAgent()
                              • verifySignatureInternal()

    types/
      signature.ts          - Server-side type definitions

    services/
      contextRetrieval.ts   - Helper functions for conversation context

    config.ts               - Environment and secret configuration

  package.json              - Dependencies (includes openpgp@5.11.3)
  tsconfig.json             - TypeScript configuration
```

### Documentation Files

```
/.dev-docs/sig2/
  README.md                        - Overview and planning documents index
  architecture-sig2.md             - Detailed technical architecture
  architecture-decisions.md        - Critical architectural questions and decisions
  workflows-sig2.md                - Developer workflows and testing
  tasks-sig2.md                    - Phased implementation plan (4 phases)
  phase3-qa.md                     - Phase 3 Q&A and design decisions
  initial-notes.md                 - Initial planning notes
  IMPLEMENTATION-SUMMARY.md        - This document
```

### Implementation Commits

Key commits in chronological order:
```
ac05614  plan: initial sig2 + bring in old sig planning docs
1809780  plan: sig2 docs
e4c645e  impl: sig2 1.1 | gen keys
8d79d6d  impl: sig2 1.3 | ui displays keys
39d05b5  impl: sig2 2.1 | message select + toggle translate/sign button
b6d6f41  impl: sig2 2.2 + 2.3 | sign client modal and sign cloud function
23ab40f  fix: 2.2 | empty data bug
1de39cb  impl: sig2 3.1 | sig drawer (buggy)
4e3d565  fix: custom modals for profile edit actions (fixes web)
faeb121  fix: sig2-3.1 | querying signatures works
b0a0286  impl: sig2 3.2 | signature drawer detail view
1395663  impl: sig2 3.3 | distribute sig to counterpartys drawer
ef7efff  impl: sig2 4.1a | verifySignature + ui to call it
71e8332  impl: sig2 4.1 | helper func for checkSig callable by agent
```

---

## Quick Reference: Common Tasks

### Generate test signature
```bash
# 1. Start emulator
npm run functions:dev

# 2. Open app in simulator
npm start

# 3. Navigate to profile → Digital Signatures → Generate Keys
# 4. Navigate to chat → Long-press message → Select for signature
# 5. Select messages → Sign → Add purpose → Confirm
```

### Verify signature works
```bash
# Check Firestore emulator UI
open http://localhost:4000/firestore

# Navigate to users/{uid}/signatures/{signatureId}
# Check fields:
# - signedPayload (object)
# - pgpSignature (string starting with -----BEGIN PGP SIGNATURE-----)
# - verified (boolean)
```

### Test AI agent verification
```typescript
// In Cloud Function or agent code
import { verifySignatureForAgent } from './index';

const result = await verifySignatureForAgent('user_id', 'signature_id');
console.log('Verified:', result.verified);
console.log('Payload:', result.payload);
```

### Debug signature issues
1. Check Cloud Function logs in emulator terminal
2. Look for log prefixes: `[KEYGEN]`, `[SIGN]`, `[VERIFY]`, `[VERIFY-AGENT]`
3. Check Firestore rules allow signature document creation
4. Verify user has keys generated (`publicKey` field exists)
5. Verify user is conversation participant

---

## Support and Questions

For questions about the sig2 implementation:
1. Read this document first
2. Check planning docs in `.dev-docs/sig2/`
3. Review code comments in implementation files
4. Check commit history for context on specific features

**Key Contacts:**
- Original implementation: See git blame for specific files
- Architecture decisions: See `architecture-decisions.md`
- Task breakdown: See `tasks-sig2.md`

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Status:** Complete - POC Implementation

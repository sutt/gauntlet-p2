# Phase 3: Signature Drawer - Q&A and Design Decisions

## Overview
Phase 3 implements a signature drawer/tab where users can view and manage their digital signatures, both signatures they created ("Mine") and signatures they collected from others in conversations.

---

## Design Decisions

### 1. Signature Collection Logic

**Question**: When Alice signs messages in a conversation with Bob, how should Bob get access to the signature?

**Answer**: **Copy signature to Bob's collection**

When Alice signs messages in a conversation with Bob:
1. Alice's signature is stored in `users/alice_uid/signatures/{sigId}` (current implementation)
2. The Cloud Function **also creates a copy** in `users/bob_uid/signatures/{sigId}`
3. Both documents have the same `signatureId` but exist in separate user collections

**Implementation**:
- Modify `signMessages` Cloud Function
- For each participant in the conversation (except the signer):
  - Create a copy of the signature document in their signatures collection
  - This allows easy querying: "get all signatures in my collection"

---

### 2. Drawer Tab Organization

**Question**: How should "Mine" vs "Collected from others" be displayed?

**Answer**: **Two separate tabs/sections within the signatures drawer**

- Tab 1: "My Signatures" - Signatures created by this user
- Tab 2: "Received" - Signatures collected from other users in conversations

**UI Pattern**:
```
┌─────────────────────────────────┐
│  My Signatures  │  Received     │  ← Segmented control or tabs
├─────────────────────────────────┤
│                                 │
│  [Signature Card]               │
│  [Signature Card]               │
│  [Signature Card]               │
│                                 │
└─────────────────────────────────┘
```

---

### 3. Multi-party Conversations

**Question**: In a group chat with Alice, Bob, and Charlie, who gets the signature?

**Answer**: **Ignore multi-party conversations for now**

**Current Scope**: Only support 1-on-1 (direct) conversations
- If Alice signs in a direct chat with Bob → Bob gets a copy
- Group chats: **NOT SUPPORTED** (Phase 3 limitation)

**Limitation to Document**:
> ⚠️ **Known Limitation**: Signature collection only works in direct (1-on-1) conversations. Group chat signatures are not distributed to other participants in Phase 3.

**Future Enhancement**:
- Phase 4 or later can add support for distributing signatures to all participants in group chats
- Would need to handle N-1 copies for N participants

---

### 4. Signature Card Display

**Question**: What should the signature card show in the list view?

**Answer**: Show participants and date

**"My Signatures" Card**:
```
┌────────────────────────────────┐
│ 🔏  You signed 3 messages       │
│     with Bob Johnson           │
│     2 hours ago                │  ← Delta from now (English style)
│                                │
│     Purpose: Approval          │  ← If present
└────────────────────────────────┘
```

**"Received" Card**:
```
┌────────────────────────────────┐
│ 🔏  Alice Smith signed 5 msgs  │
│     in conversation with you   │
│     3 days ago                 │  ← Delta from now
│                                │
│     Purpose: Authorization     │  ← If present
└────────────────────────────────┘
```

**Display Elements**:
- Icon (🔏 or pen icon)
- Signer name (for "Mine": "You", for "Received": other user's name)
- Participant names (conversation context)
- Message count
- Relative date/time (e.g., "2 hours ago", "3 days ago")
- Purpose (optional, if provided)

---

### 5. Navigation from Badge

**Question**: What happens when clicking the "Signed" badge on a message in chat?

**Answer**: **Navigate to the signature detail screen**

**Behavior**:
1. User sees "Signed" badge on message in chat
2. User taps the badge
3. App navigates to signature detail screen: `/signatures/{signatureId}`
4. Detail screen shows:
   - Full signature information
   - All signed messages
   - PGP signature (collapsible)
   - Timestamp (full date/time, not relative)
   - Participants
   - Purpose/notes

**Implementation**:
- Make the signature badge in `chat/[id].tsx` a `TouchableOpacity`
- Call `router.push(/signatures/${signatureId})` on press
- Need to add `signatureIds` to message to know which signature to navigate to

---

### 6. Performance/Indexing

**Question**: How to efficiently query signatures by conversation participants?

**Answer**: **Add participants array to signature documents**

**Signature Document Schema Update**:
```typescript
{
  signatureId: string,
  signedPayload: SignedPayload,
  pgpSignature: string,
  createdAt: Timestamp,
  conversationId: string,
  messageIds: string[],
  purpose?: string,
  verified: boolean,

  // NEW FIELDS FOR PHASE 3:
  participants: string[],        // Array of user IDs in the conversation
  signerId: string,              // User ID of the person who signed
}
```

**Query Patterns**:

**"My Signatures"**:
```typescript
query(
  collection(db, 'users', currentUserId, 'signatures'),
  where('signerId', '==', currentUserId),
  orderBy('createdAt', 'desc')
)
```

**"Received Signatures"**:
```typescript
query(
  collection(db, 'users', currentUserId, 'signatures'),
  where('signerId', '!=', currentUserId),
  orderBy('createdAt', 'desc')
)
```

**Benefits**:
- No need to query conversations separately
- Efficient filtering with indexed fields
- Self-contained signature documents

---

## Implementation Phases

### Phase 3.1: Signatures Tab & List
- Add signatures tab to navigation (emoji icon 🔏)
- Create signatures list screen with two tabs ("My Signatures" / "Received")
- Create SignatureCard component
- Implement relative date formatting for list view

### Phase 3.2: Signature Detail Screen
- Create detail screen at `/signatures/[id]`
- Show full signature information
- Display all signed messages
- Use absolute timestamps (not relative)
- Make PGP signature viewable (collapsible)

### Phase 3.3: Cloud Function Updates
- Modify `signMessages` to copy signatures to other participants
- Add `participants` and `signerId` fields to signature documents
- Handle 1-on-1 conversation detection
- Skip distribution for group chats (with warning log)

### Phase 3.4: Navigation Integration
- Make signature badge in chat clickable
- Navigate to signature detail on badge press
- Handle navigation from signature list to detail

---

## Date Formatting Rules

### List View (Signatures Tab)
Use **relative/delta format** (English style):
- "Just now"
- "5 minutes ago"
- "2 hours ago"
- "3 days ago"
- "2 weeks ago"
- "Jan 15, 2025" (for older dates)

Similar to user presence in chat ("Active now", "Active 5m ago")

### Detail View (Signature Detail Screen)
Use **absolute timestamps**:
- "January 15, 2025 at 3:42 PM"
- "10/25/2024, 2:15:30 PM"

Full date and time for precise record-keeping.

---

## Known Limitations (Phase 3)

1. **No Group Chat Support**: Signature collection only works in direct (1-on-1) conversations. In group chats, only the signer gets the signature in their collection.

2. **No Signature Revocation**: Once created, signatures cannot be deleted or revoked in this phase.

3. **No Verification UI**: The `verified` field exists but verification is not implemented. All signatures show as "Pending verification".

4. **Single Signature Per Message Set**: If the same messages are signed multiple times, multiple signature documents are created. No deduplication.

---

## Future Enhancements (Post-Phase 3)

- **Group Chat Distribution**: Copy signatures to all N-1 participants in group conversations
- **Signature Verification**: Implement cryptographic verification and update `verified` field
- **Export Functionality**: Allow users to export signatures (JSON, PDF)
- **Search & Filter**: Search signatures by purpose, date range, conversation
- **Bulk Actions**: Select multiple signatures for export or deletion
- **Signature Notifications**: Notify users when they receive a new signature from a conversation partner

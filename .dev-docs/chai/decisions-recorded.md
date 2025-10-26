# CHAI - Product Owner Decisions Recorded

**Date**: 2025-10-26
**Status**: Approved
**Source**: Product owner feedback on outline-questions.md

---

## Decision Summary

The product owner has made the following decisions for the CHAI (Chats with AI Agents) POC:

### 1. Agent Identity & User Model
**Decision**: **Agent-as-User (Dummy Firebase Auth Accounts)**

- AI agents will be represented as dummy Firebase Authentication accounts
- Agents will appear in the People tab like regular users
- Agents will always show as "available" (online status)
- Agents are searchable like regular users
- No special "agent directory" UI needed for POC

**Implementation Notes**:
- Create Firebase Auth accounts manually for each agent (e.g., `buybot@agent.internal`)
- User profile includes `isAgent: true` flag to distinguish from real users
- Agent presence tracking disabled (always `online: true`)

---

### 2. Agent Message Triggering Pattern
**Decision**: **Conversation-Based Only (Option C)**

- Agents only respond to direct messages in dedicated agent conversations
- Agents do NOT monitor or participate in conversations between people
- The only way to interact with an agent is to start a 1-on-1 chat with that agent
- Agents are NOT added to group chats
- No @mentions or command syntax needed

**Implementation Notes**:
- Cloud Function trigger: `onMessageCreated` for conversations where one participant has `isAgent: true`
- Agent responds to every user message in these conversations
- No need for keyword detection or intent recognition

---

### 3. Authorization Model
**Decision**: **Hardcoded Power User UIDs (Option A)**

- Power users identified by hardcoded list of Firebase user IDs
- No role-based system or Firestore-based authorization for POC
- Configuration stored in Cloud Function code or environment variables

**Implementation Notes**:
```typescript
// In agent config or Cloud Function
const POWER_USERS = [
  'ash_firebase_uid_here',
  // Add more as needed
];

function isPowerUser(userId: string): boolean {
  return POWER_USERS.includes(userId);
}
```

**Limitation**: Adding/removing power users requires code deployment

---

### 4. Signature Payload Relevance Analysis
**Decision**: **LLM Semantic Reasoning (Option A)**

- Use GPT-4 to analyze signature payload relevance to current request
- Not very strict for POC - focus on rejecting obvious fraud
- Agent must explain why it rejected a signature (transparency)
- No audit log needed for POC

**Implementation Notes**:
- Agent prompt includes: "Analyze if this signed conversation authorizes the current request"
- LLM returns: `{ relevant: boolean, confidence: number, reasoning: string }`
- Agent shares reasoning with user when rejecting
- Example rejection: "I cannot approve this because the signature discusses sandwiches, not quadcopter purchases."

---

### 5. Multi-Agent Architecture
**Decision**: **Single Agent POC/MVP (Option A)**

- Build for single agent use case only
- No agent-to-agent communication
- No multi-agent conversations
- Focus on proving the concept with BuyBot

**Implementation Notes**:
- Simple architecture, no agent registry needed
- Can extend to multiple agents later by following same pattern
- Marked as limitation in documentation

---

### 6. Agent Discovery & Initiation
**Decision**: **People Tab Search (Option A)**

- Agents appear in People tab alongside regular users
- Agents are searchable by name (e.g., "BuyBot")
- No special agent directory, onboarding, or favorites for POC
- Users start conversations with agents same as with people

**Implementation Notes**:
- Agent user profiles visible in People tab query
- Optional: Add badge/icon to distinguish agents (e.g., "🤖" prefix in display name)
- Agent profiles have descriptive display names: "BuyBot - Purchasing Assistant"

---

### 7. Development & Testing Strategy
**Decision**: **Test Mode Flag (Hybrid Approach)**

- Add `TEST_MODE` environment variable for development
- Extensive manual testing to evaluate agent behavior
- No automated testing infrastructure for POC

**Implementation Notes**:
```typescript
// Cloud Function
const TEST_MODE = process.env.TEST_MODE === 'true';

if (TEST_MODE) {
  // Bypass OpenAI, return deterministic responses
  return getMockResponse(userMessage);
} else {
  // Production: Real GPT-4 call
  return await callOpenAI(prompt);
}
```

- Use `TEST_MODE=true` in local `.env.local` for faster iteration
- Production always uses real LLM

---

### 8. Cost & Safety Controls
**Decision**: **No Rate Limiting (Documented Limitation)**

- No rate limiting or cost controls for POC
- Marked as known limitation in documentation
- Trust development team to use responsibly

**Implementation Notes**:
- Document in limitations: "No rate limiting implemented - POC only"
- Monitor OpenAI usage manually via dashboard
- Future: Add per-user daily message limits

---

### 9. Agent Memory & Context
**Decision**: **Last 10 Messages (Stateless with Context Window)**

- Agent receives last 10 messages from conversation as context
- No persistent memory across sessions
- Context fetched fresh on every agent response

**Implementation Notes**:
```typescript
// Fetch context for agent
const recentMessages = await getConversationContext(conversationId, 10);

// Pass to agent prompt
const prompt = buildPrompt({
  userMessage: currentMessage,
  conversationHistory: recentMessages,
  // ...
});
```

- 10 messages = ~2-3 back-and-forth exchanges
- Good balance between context and token costs

---

## Additional Decision: Signature Reference UI

**Question**: How does a user supply BuyBot with a specific signature they've collected?

**Scenario:**
```
will: buy this quadcopter for me
buybot: give me proof this is authorized
will: here's ash's signature, "eef7f9d"  ← How?
```

**Decision**: **Attachment Button UI (Option B) with Reference-Based Backend**

### UI Approach: Signature Attachment Button

**User Flow**:
1. User taps 📎 attachment button in chat input
2. Modal shows user's signature collection (both "My" and "Received")
3. User selects signature from list with preview
4. Message input shows chip: "📋 Signature: abc123..."
5. Message sent with `attachedSignatureId` field containing only the signature ID

### Backend Architecture: Reference-Based (Not Upload-Based)

**Critical Decision**: The signature object is **NOT copied to agent's collection** or **uploaded in message payload**. Instead:

**How It Works**:
1. **Signature already exists** in user's Firestore collection
   - When ash signs messages with will, signature is automatically copied to both collections
   - `users/ash_uid/signatures/sig123` (original)
   - `users/will_uid/signatures/sig123` (exact copy with same ID)

2. **Message includes only ID reference** (not full object)
   ```typescript
   {
     text: "here's the approval",
     senderId: "will_uid",
     attachedSignatureId: "sig123"  // ← Just the ID string
   }
   ```

3. **Agent fetches from user's collection** when processing message
   ```typescript
   // BuyBot Cloud Function
   const verification = await verifySignatureForAgent(
     message.senderId,           // will_uid
     message.attachedSignatureId // sig123
   );
   // Internally fetches: users/will_uid/signatures/sig123
   ```

**Why Reference-Based**:
- ✅ Minimal message size (just string ID, not 5-10KB signature object)
- ✅ No data duplication (signature already exists in user's collection)
- ✅ Single source of truth (Firestore, not message payload)
- ✅ Client cannot tamper with signature data (fetched server-side)
- ✅ Reuses existing `verifySignatureForAgent()` function perfectly
- ✅ Signature distribution system already handles copying to participants

**Alternatives Rejected**:
- ❌ Copy to agent's collection: Signature proliferation, violates user-scoped principle
- ❌ Upload in message payload: Bloated messages, redundant storage, security risk

**See**: `backend-architecture.md` for complete data flow diagrams and implementation details

### Implementation

**Message Schema**:
```typescript
interface Message {
  // ... existing fields
  attachedSignatureId?: string;  // NEW: Reference to signature in sender's collection
}
```

**Component to Build**:
- `<SignatureAttachmentModal>` - Signature picker with search
- Chat input: Add 📎 attachment button
- Message rendering: Show signature chip if attached
- Agent Cloud Function: Extract and verify attached signature

**Firestore Operations**:
- **Client**: Write message with `attachedSignatureId` field
- **Agent**: Read signature from `users/{senderId}/signatures/{signatureId}`
- **No copying needed**: Signatures already distributed via existing system

---

## Implementation Priority

**Phase 1 (POC) - 2-3 weeks**:
1. Create dummy Firebase user for BuyBot ✓
2. Cloud Function: Agent responds to messages in conversations ✓
3. Hardcoded power user list ✓
4. LLM-based signature verification ✓
5. Last 10 messages context ✓
6. **Text-based signature reference** (manual copy/paste) ✓
7. Test mode flag ✓

**Phase 2 (MVP) - 1-2 weeks**:
8. Signature attachment button UI
9. Signature picker modal
10. Embedded signature references in messages

---

## Known Limitations (POC)

Documented limitations for the POC:

1. **No rate limiting** - Uncontrolled OpenAI costs
2. **Hardcoded power users** - Requires code deployment to add/remove
3. **Manual signature referencing** - Users must copy/paste signature IDs
4. **Single agent only** - No multi-agent support
5. **No agent memory** - Stateless beyond 10-message context window
6. **1-on-1 only** - Agents cannot participate in group chats
7. **No audit logs** - Signature verifications not tracked
8. **Development-only** - Not production-ready (trust-the-server security model)

---

**Document Status**: ✅ Decisions Finalized
**Next Steps**: Create detailed technical specification (specs-chai.md)

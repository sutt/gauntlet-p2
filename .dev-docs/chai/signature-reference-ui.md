# Signature Reference UI - Design Specification

**Date**: 2025-10-26
**Status**: Planning
**Context**: How users supply signature IDs to AI agents in chat

---

## Problem Statement

In the BuyBot purchasing agent scenario, users need to prove authorization by referencing signatures they've collected from power users. The current signature system has NO UI for referencing existing signatures within a chat context.

**Scenario:**
```
will: buy this quadcopter for me
buybot: I need authorization from a power user
will: here's ash's signature, "eef7f9d"  ← Missing: How does Will do this?
```

**Current Gap:**
- Users can VIEW signatures in the Signatures tab
- Users can CREATE signatures from message selection
- Users CANNOT reference/attach existing signatures in chat messages

---

## Two-Phase Approach

### Phase 1: POC - Text-Based Reference (Manual)
**Timeline**: Include in POC
**Effort**: ~1 hour (agent-side only, no UI work)

Users manually copy signature IDs and paste into chat messages.

#### User Flow
```
1. User is chatting with BuyBot
2. BuyBot asks for authorization proof
3. User switches to Signatures tab
4. User taps signature to view details
5. User copies signature ID from detail screen
   (Long-press on monospace signature ID → Copy)
6. User switches back to chat with BuyBot
7. User types message: "signature: abc123def456"
8. Agent extracts signature ID from message text
9. Agent verifies signature and analyzes payload
```

#### Implementation

**Client-Side (UI Enhancement)**:
Make signature ID selectable in detail screen:

```tsx
// In app/signatures/[id].tsx
<ThemedText style={styles.monospace} selectable>
  {signature.signatureId}
</ThemedText>
```

No other UI changes needed.

**Agent-Side (Cloud Function)**:
Extract signature ID from user message text:

```typescript
// In buybot agent logic
function extractSignatureId(messageText: string): string | null {
  // Pattern 1: "signature: <id>"
  const match1 = messageText.match(/signature:\s*([a-zA-Z0-9]+)/i);
  if (match1) return match1[1];

  // Pattern 2: Bare hash-like string (fallback)
  const match2 = messageText.match(/\b([a-f0-9]{20,})\b/i);
  if (match2) return match2[1];

  // Or use LLM to extract
  return null;
}

// In agent response logic
const signatureId = extractSignatureId(userMessage.text);
if (signatureId) {
  const verification = await verifySignatureForAgent(userId, signatureId);
  // ... analyze payload relevance
}
```

#### Pros & Cons

**Pros:**
- Zero UI work
- Works immediately
- Good for POC validation

**Cons:**
- Terrible UX (lots of context switching)
- Error-prone (typos, wrong signature)
- Users must find and copy long hash strings
- Not discoverable

---

### Phase 2: MVP - Signature Attachment Button
**Timeline**: Post-POC, before production launch
**Effort**: ~1-2 days

Add attachment button to chat input with signature picker modal.

#### User Flow
```
1. User is chatting with BuyBot
2. BuyBot asks for authorization proof
3. User taps attachment button (📎) next to message input
4. Modal appears: "Attach Signature"
5. Modal shows list of user's collected signatures:
   ┌──────────────────────────────────────────┐
   │ Search signatures...            [Cancel] │
   ├──────────────────────────────────────────┤
   │ 🔏 ash@example.com (Power User)          │
   │    Signed 2 messages                     │
   │    "can i buy a $400 quadcopter..."      │
   │    2 hours ago                           │
   │    Purpose: approval                     │
   ├──────────────────────────────────────────┤
   │ 🔏 bob@example.com                       │
   │    Signed 1 message                      │
   │    "sure, go ahead"                      │
   │    1 day ago                             │
   └──────────────────────────────────────────┘
6. User taps signature (ash's approval)
7. Message input shows chip/bubble: "📋 Signature: abc123..."
8. User can still type additional text
9. User sends message
10. Agent receives message with embedded signature reference
```

#### UI Components

**A. Attachment Button in Chat Input**

Location: `app/chat/[id].tsx`

Add button next to send button:

```tsx
// In message input area
<View style={styles.inputContainer}>
  <TextInput
    style={styles.input}
    value={inputText}
    onChangeText={setInputText}
    placeholder="Type a message..."
  />

  {/* NEW: Attachment button */}
  <TouchableOpacity
    onPress={() => setShowSignatureModal(true)}
    style={styles.attachButton}
  >
    <Ionicons name="attach" size={24} color={tintColor} />
  </TouchableOpacity>

  <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
    <Ionicons name="send" size={24} color={tintColor} />
  </TouchableOpacity>
</View>
```

**B. Signature Attachment Modal**

New component: `components/SignatureAttachmentModal.tsx`

```tsx
interface SignatureAttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSignature: (signature: Signature) => void;
  userId: string;
}

export function SignatureAttachmentModal({
  visible,
  onClose,
  onSelectSignature,
  userId
}: SignatureAttachmentModalProps) {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch user's signature collection (both "My" and "Received")
  useEffect(() => {
    if (!visible) return;

    const unsubscribe = subscribeToUserSignatures(userId, (sigs) => {
      setSignatures(sigs);
      setLoading(false);
    });

    return unsubscribe;
  }, [visible, userId]);

  // Filter signatures by search query
  const filteredSignatures = useMemo(() => {
    if (!searchQuery) return signatures;

    const query = searchQuery.toLowerCase();
    return signatures.filter(sig =>
      sig.signedPayload.signerId.toLowerCase().includes(query) ||
      sig.purpose?.toLowerCase().includes(query) ||
      sig.signedPayload.messages.some(m =>
        m.text.toLowerCase().includes(query)
      )
    );
  }, [signatures, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title">Attach Signature</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search signatures..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Signature List */}
          {loading ? (
            <ActivityIndicator />
          ) : filteredSignatures.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              No signatures found
            </ThemedText>
          ) : (
            <FlatList
              data={filteredSignatures}
              keyExtractor={item => item.signatureId}
              renderItem={({ item }) => (
                <SignatureAttachmentCard
                  signature={item}
                  onSelect={() => {
                    onSelectSignature(item);
                    onClose();
                  }}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
```

**C. Signature Attachment Card**

Simplified version of SignatureCard for selection:

```tsx
interface SignatureAttachmentCardProps {
  signature: Signature;
  onSelect: () => void;
}

function SignatureAttachmentCard({ signature, onSelect }: SignatureAttachmentCardProps) {
  const signer = signature.signedPayload.signerId;
  const messageCount = signature.signedPayload.messages.length;
  const preview = signature.signedPayload.messages[0]?.text.substring(0, 80) + '...';
  const timestamp = formatRelativeTime(signature.createdAt);

  return (
    <TouchableOpacity onPress={onSelect} style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="create-outline" size={20} color={tintColor} />
        <ThemedText type="defaultSemiBold">{signer}</ThemedText>
        {signature.verified && (
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
        )}
      </View>

      <ThemedText style={styles.messageCount}>
        Signed {messageCount} message{messageCount !== 1 ? 's' : ''}
      </ThemedText>

      <ThemedText style={styles.preview} numberOfLines={2}>
        "{preview}"
      </ThemedText>

      <View style={styles.cardFooter}>
        <ThemedText style={styles.timestamp}>{timestamp}</ThemedText>
        {signature.purpose && (
          <ThemedText style={styles.purpose}>
            Purpose: {signature.purpose}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}
```

**D. Signature Chip in Message Input**

Show attached signature as removable chip:

```tsx
// In chat input area
{attachedSignature && (
  <View style={styles.signatureChip}>
    <Ionicons name="document-text" size={16} color={tintColor} />
    <ThemedText style={styles.chipText}>
      Signature: {attachedSignature.signatureId.substring(0, 8)}...
    </ThemedText>
    <TouchableOpacity onPress={() => setAttachedSignature(null)}>
      <Ionicons name="close-circle" size={18} color="#999" />
    </TouchableOpacity>
  </View>
)}
```

#### Data Structure

**✅ DECISION: Separate Message Field (Reference-Based)**

```typescript
// Extended Message interface
interface Message {
  // ... existing fields
  attachedSignatureId?: string;  // Signature ID reference (not full object)
}
```

**Why Reference-Based (See backend-architecture.md for full details)**:

The signature object is **NOT uploaded** in the message. Instead:

1. **Signature already exists** in user's Firestore collection
   - When ash signs messages with will, signature is copied to both collections
   - `users/ash_uid/signatures/sig123` (original)
   - `users/will_uid/signatures/sig123` (copy)

2. **Message includes only ID reference**
   ```typescript
   {
     text: "here's the approval",
     senderId: "will_uid",
     attachedSignatureId: "sig123"  // ← Just the ID
   }
   ```

3. **Agent fetches from user's collection**
   ```typescript
   // BuyBot Cloud Function
   const verification = await verifySignatureForAgent(
     message.senderId,      // will_uid
     message.attachedSignatureId  // sig123
   );
   // Fetches from: users/will_uid/signatures/sig123
   ```

**Advantages**:
- ✅ Minimal message size (just string ID)
- ✅ No data duplication
- ✅ Single source of truth (Firestore)
- ✅ Client cannot tamper with signature data
- ✅ Reuses existing `verifySignatureForAgent()` function

**Alternative Rejected**: Uploading full signature object in message payload
- ❌ Would bloat message documents (5-10KB per signature)
- ❌ Redundant storage
- ❌ Security risk (client could modify data)
- ❌ Violates DRY principle

#### Backend Changes

**Firestore Schema Update**:

```typescript
// conversations/{id}/messages/{msgId}
{
  // ... existing message fields
  attachedSignatureId?: string;  // NEW FIELD
}
```

**Security Rules Update**:

```javascript
// Allow users to add attachedSignatureId when creating messages
match /messages/{messageId} {
  allow create: if request.auth.uid in getConversation(conversationId).participants
                && request.auth.uid == request.resource.data.senderId
                && (!request.resource.data.keys().hasAny(['attachedSignatureId'])
                    || request.resource.data.attachedSignatureId is string);
}
```

**Agent Function Update**:

```typescript
// In buybot Cloud Function
export const onBuyBotMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data() as Message;

    // Check if message has attached signature
    const signatureId = message.attachedSignatureId;

    if (signatureId) {
      // Verify signature
      const verification = await verifySignatureForAgent(
        message.senderId,
        signatureId
      );

      if (verification.valid) {
        // Analyze payload relevance
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

---

## Comparison: Phase 1 vs Phase 2

| Aspect | Phase 1 (Text-Based) | Phase 2 (Attachment UI) |
|--------|---------------------|------------------------|
| **UX Quality** | Poor (manual copy/paste) | Excellent (native picker) |
| **Error Rate** | High (typos, wrong sig) | Low (visual selection) |
| **Discoverability** | None (users must know) | High (visible button) |
| **Context Switching** | Heavy (tab switching) | Minimal (modal overlay) |
| **Development Effort** | ~1 hour | ~1-2 days |
| **Good for** | POC validation | Production use |
| **Maintenance** | None | Ongoing UI updates |

---

## Implementation Timeline

**POC (Phase 1)**:
- [ ] Make signature ID selectable in detail screen (5 min)
- [ ] Agent: Extract signature ID from text (30 min)
- [ ] Test manually with copy/paste flow (15 min)
- [ ] Document as limitation in planning docs (10 min)

**MVP (Phase 2)**:
- [ ] Design signature attachment modal UI (2 hours)
- [ ] Build `SignatureAttachmentModal` component (4 hours)
- [ ] Add attachment button to chat input (1 hour)
- [ ] Implement signature chip display (1 hour)
- [ ] Update Message type and Firestore schema (30 min)
- [ ] Update agent to check `attachedSignatureId` field (30 min)
- [ ] Update security rules (15 min)
- [ ] Test full flow (1 hour)

**Total Effort**: Phase 1 = 1 hour, Phase 2 = 1-2 days

---

## Testing Plan

### Phase 1 Testing
1. Create test signature in Signatures tab
2. Navigate to signature detail
3. Long-press and copy signature ID
4. Chat with BuyBot
5. Paste signature ID in message: `"signature: <id>"`
6. Verify agent extracts ID correctly
7. Verify agent verifies signature
8. Verify agent analyzes payload relevance

### Phase 2 Testing
1. Chat with BuyBot
2. Tap attachment button (📎)
3. Verify signature list appears
4. Search for specific signature
5. Select signature from list
6. Verify chip appears in input
7. Send message with attached signature
8. Verify agent receives `attachedSignatureId`
9. Verify agent processes attached signature
10. Test removing chip before sending
11. Test with no signatures collected (empty state)
12. Test with many signatures (scrolling)

---

## Future Enhancements (Post-MVP)

1. **Smart Signature Suggestions**
   - Agent suggests relevant signatures based on conversation context
   - "I found ash's approval from 2 hours ago. Use this?"

2. **Signature Expiration Warnings**
   - Show age of signature in picker
   - Warn if signature is old (e.g., "> 24 hours")

3. **Multi-Signature Attachment**
   - Allow attaching multiple signatures to one message
   - Use case: "I have approvals from both ash and bob"

4. **Signature Preview in Chat**
   - Show signature details inline when message with attachment is viewed
   - Expandable card showing signed messages

5. **Signature Request Flow**
   - BuyBot: "I need ash's approval for this"
   - User taps "Request Signature" → navigates to conversation with ash
   - Context pre-filled for signing

---

**Document Status**: ✅ Specification Complete
**Implementation**: Phase 1 (POC), Phase 2 (MVP)
**Owner**: Development Team

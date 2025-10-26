# CHAI (Chats with AI Agents) - Implementation Tasks

**Date**: 2025-10-26
**Status**: Ready for Implementation
**Feature**: BuyBot Purchasing Agent POC

---

## Overview

This document breaks down the implementation of the CHAI feature into phases and specific tasks. The initial use case is BuyBot, a purchasing agent that accepts requests from users and verifies authorization via digital signatures from power users.

**Timeline Estimate**: 2-3 weeks for POC

---

## Phase 1: Agent Infrastructure (Week 1)

### 1.1: Create BuyBot User Account
**Effort**: 30 minutes
**Dependencies**: None

**Tasks**:
- [ ] Create dummy Firebase Auth account for BuyBot
  - Email: `buybot@agent.internal`
  - Password: Generate secure password, store in team secrets
- [ ] Create user profile document in Firestore: `users/buybot_uid`
  ```typescript
  {
    uid: "buybot_uid",
    email: "buybot@agent.internal",
    displayName: "BuyBot - Purchasing Assistant",
    isAgent: true,  // NEW FLAG
    online: true,   // Always online
    createdAt: Timestamp.now(),
    lastSeen: Timestamp.now()
  }
  ```
- [ ] Document BuyBot UID in environment config for Cloud Functions

**Acceptance Criteria**:
- BuyBot appears in People tab search results
- BuyBot shows as "always online"
- Users can start 1-on-1 conversation with BuyBot

---

### 1.2: Agent Configuration & Constants
**Effort**: 1 hour
**Dependencies**: 1.1

**Tasks**:
- [ ] Create agent config file: `functions/src/config/agents.ts`
  ```typescript
  // Agent user IDs
  export const BUYBOT_USER_ID = 'buybot_uid_from_firestore';

  // Power users who can authorize purchases
  export const POWER_USERS = [
    'ash_firebase_uid',  // Replace with actual UIDs
    // Add more as needed
  ];

  // Helper function
  export function isPowerUser(userId: string): boolean {
    return POWER_USERS.includes(userId);
  }

  // Helper function
  export function isAgentUser(userId: string): boolean {
    return userId === BUYBOT_USER_ID;
  }
  ```
- [ ] Create test mode flag in `functions/.env.local`
  ```
  TEST_MODE=true  # For development
  ```
- [ ] Add test mode check in agent logic
  ```typescript
  const TEST_MODE = process.env.TEST_MODE === 'true';
  ```

**Acceptance Criteria**:
- Power user list accessible in Cloud Functions
- Test mode can be toggled for development
- Agent user ID centralized and documented

---

### 1.3: Message Trigger Cloud Function (Skeleton)
**Effort**: 2 hours
**Dependencies**: 1.2

**Tasks**:
- [ ] Create Cloud Function: `functions/src/agents/buyBotAgent.ts`
  ```typescript
  import { onDocumentCreated } from 'firebase-functions/v2/firestore';
  import { getFirestore } from 'firebase-admin/firestore';
  import { BUYBOT_USER_ID, isPowerUser } from '../config/agents';

  export const onBuyBotMessage = onDocumentCreated(
    'conversations/{conversationId}/messages/{messageId}',
    async (event) => {
      const message = event.data.data();
      const conversationId = event.params.conversationId;

      // Check if this conversation includes BuyBot
      const db = getFirestore();
      const convDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .get();

      const participants = convDoc.data()?.participants || [];

      // Only respond in conversations where BuyBot is a participant
      if (!participants.includes(BUYBOT_USER_ID)) {
        return;
      }

      // Don't respond to own messages
      if (message.senderId === BUYBOT_USER_ID) {
        return;
      }

      // TODO: Process user message and respond
      console.log('[BUYBOT] Received message:', message.text);
    }
  );
  ```
- [ ] Export function in `functions/src/index.ts`
  ```typescript
  export { onBuyBotMessage } from './agents/buyBotAgent';
  ```
- [ ] Deploy and test trigger fires on new messages

**Acceptance Criteria**:
- Function triggers when message created in BuyBot conversation
- Function ignores messages in non-BuyBot conversations
- Function ignores BuyBot's own messages
- Logs appear in Firebase Functions console

---

### 1.4: Agent Response Helper
**Effort**: 1 hour
**Dependencies**: 1.3

**Tasks**:
- [ ] Create helper function to send agent messages
  ```typescript
  // In functions/src/agents/buyBotAgent.ts
  async function sendAgentMessage(
    conversationId: string,
    text: string
  ): Promise<void> {
    const db = getFirestore();

    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc();

    await messageRef.set({
      id: messageRef.id,
      text,
      senderId: BUYBOT_USER_ID,
      senderName: 'BuyBot',
      timestamp: new Date(),
      conversationId,
      readBy: {}
    });

    // Update conversation lastMessage
    await db.collection('conversations').doc(conversationId).update({
      lastMessage: text,
      lastMessageTimestamp: new Date(),
      [`unreadCount.${conversationId}`]: 0  // Agent doesn't have unread
    });
  }
  ```
- [ ] Test sending simple echo response

**Acceptance Criteria**:
- Agent can successfully post messages to conversation
- Messages appear in chat UI
- Conversation lastMessage updates correctly

---

## Phase 2: Basic Agent Logic (Week 1-2)

### 2.1: Conversation Context Retrieval
**Effort**: 1 hour
**Dependencies**: 1.4

**Tasks**:
- [ ] Add function to fetch last N messages from conversation
  ```typescript
  async function getConversationContext(
    conversationId: string,
    messageCount: number = 10
  ): Promise<Message[]> {
    const db = getFirestore();

    const messagesSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(messageCount)
      .get();

    return messagesSnapshot.docs
      .map(doc => doc.data() as Message)
      .reverse(); // Chronological order
  }
  ```
- [ ] Pass context to agent processing logic

**Acceptance Criteria**:
- Agent can fetch last 10 messages
- Messages returned in chronological order
- Context includes message text, sender, timestamp

---

### 2.2: LLM Integration for Agent Responses
**Effort**: 3 hours
**Dependencies**: 2.1

**Tasks**:
- [ ] Create BuyBot agent prompt template
  ```typescript
  function buildBuyBotPrompt(
    userMessage: string,
    conversationHistory: Message[]
  ): string {
    const historyText = conversationHistory
      .map(m => `${m.senderName}: ${m.text}`)
      .join('\n');

    return `You are BuyBot, a purchasing assistant. You help users make purchases, but you require authorization from power users for any purchase requests.

  Power users who can authorize purchases:
  - ash@example.com

  Conversation history:
  ${historyText}

  Current user message: ${userMessage}

  Instructions:
  1. If the user is requesting a purchase, ask for authorization from a power user
  2. If the user provides a signature ID, you'll verify it separately (respond with "checking signature...")
  3. Be helpful and concise
  4. If you don't understand, ask for clarification

  Respond naturally as BuyBot:`;
  }
  ```
- [ ] Integrate with OpenAI using existing AI SDK pattern
  ```typescript
  import { generateText } from 'ai';
  import { createOpenAI } from '@ai-sdk/openai';
  import { getOpenAIKey } from '../config';

  async function generateBuyBotResponse(
    userMessage: string,
    context: Message[]
  ): Promise<string> {
    const TEST_MODE = process.env.TEST_MODE === 'true';

    if (TEST_MODE) {
      // Return deterministic response for testing
      return getMockResponse(userMessage);
    }

    const apiKey = getOpenAIKey();
    const openai = createOpenAI({ apiKey });

    const prompt = buildBuyBotPrompt(userMessage, context);

    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
    });

    return text;
  }
  ```
- [ ] Add mock response helper for TEST_MODE
  ```typescript
  function getMockResponse(userMessage: string): string {
    if (userMessage.toLowerCase().includes('buy')) {
      return "I can help with that purchase. Please provide authorization from a power user (ash).";
    }
    return "I'm BuyBot. How can I help you today?";
  }
  ```
- [ ] Update `onBuyBotMessage` to call LLM and respond

**Acceptance Criteria**:
- Agent responds naturally to user messages
- TEST_MODE returns deterministic responses
- Production mode uses GPT-4
- Agent asks for authorization on purchase requests

---

### 2.3: Power User Detection
**Effort**: 30 minutes
**Dependencies**: 1.2

**Tasks**:
- [ ] Add function to check if message sender is power user
  ```typescript
  async function checkDirectPowerUserRequest(
    senderId: string,
    messageText: string
  ): Promise<boolean> {
    // If sender is power user AND requesting purchase
    return isPowerUser(senderId)
           && messageText.toLowerCase().includes('buy');
  }
  ```
- [ ] Implement immediate approval for power user direct requests
  ```typescript
  // In onBuyBotMessage
  if (await checkDirectPowerUserRequest(message.senderId, message.text)) {
    await sendAgentMessage(
      conversationId,
      "✅ Approved! (You're a power user, no additional authorization needed)"
    );
    return;
  }
  ```

**Acceptance Criteria**:
- Power users get immediate approval for their own requests
- Non-power-users are asked for authorization

---

## Phase 3: Signature Attachment UI (Week 2)

### 3.1: Extend Message Type
**Effort**: 15 minutes
**Dependencies**: None

**Tasks**:
- [ ] Update `types/chat.ts` to add signature attachment field
  ```typescript
  export interface Message {
    // ... existing fields
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    conversationId: string;
    readBy: { [userId: string]: string };

    // NEW: Signature attachment
    attachedSignatureId?: string;
  }
  ```

**Acceptance Criteria**:
- TypeScript types updated
- No compilation errors

---

### 3.2: Attachment Button in Chat Input
**Effort**: 1 hour
**Dependencies**: 3.1

**Tasks**:
- [ ] Add state for signature attachment modal in `app/chat/[id].tsx`
  ```typescript
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [attachedSignature, setAttachedSignature] = useState<Signature | null>(null);
  ```
- [ ] Add attachment button next to send button in chat input
  ```tsx
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
- [ ] Add styling for attachment button

**Acceptance Criteria**:
- Attachment button visible in chat input
- Tapping button shows signature modal (placeholder)
- Button styled consistently with send button

---

### 3.3: Signature Attachment Modal Component
**Effort**: 4 hours
**Dependencies**: 3.2

**Tasks**:
- [ ] Create `components/SignatureAttachmentModal.tsx`
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

    // Fetch user's signatures (both "My" and "Received")
    useEffect(() => {
      if (!visible) return;

      const unsubscribe = onSnapshot(
        query(
          collection(db, 'users', userId, 'signatures'),
          orderBy('createdAt', 'desc')
        ),
        (snapshot) => {
          const sigs = snapshot.docs.map(doc => ({
            ...doc.data(),
            signatureId: doc.id
          } as Signature));
          setSignatures(sigs);
          setLoading(false);
        }
      );

      return unsubscribe;
    }, [visible, userId]);

    // Filter by search
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
        {/* Modal UI with header, search, signature list */}
      </Modal>
    );
  }
  ```
- [ ] Create `SignatureAttachmentCard` component for list items
  ```tsx
  function SignatureAttachmentCard({
    signature,
    onSelect
  }: {
    signature: Signature;
    onSelect: () => void;
  }) {
    // Similar to SignatureCard but optimized for selection
    // Shows: signer, message preview, timestamp, purpose
  }
  ```
- [ ] Add search functionality
- [ ] Add empty state when no signatures
- [ ] Style modal to match app theme

**Acceptance Criteria**:
- Modal displays user's signature collection
- Search filters signatures by signer, purpose, or content
- Tapping signature closes modal and returns selection
- Empty state shows when no signatures exist
- Loading state while fetching signatures

---

### 3.4: Signature Chip Display
**Effort**: 1 hour
**Dependencies**: 3.3

**Tasks**:
- [ ] Add signature chip display above input when signature attached
  ```tsx
  {attachedSignature && (
    <View style={styles.signatureChip}>
      <Ionicons name="document-text" size={16} color={tintColor} />
      <ThemedText style={styles.chipText}>
        Signature: {attachedSignature.signatureId.substring(0, 8)}...
      </ThemedText>
      <ThemedText style={styles.chipSubtext}>
        from {attachedSignature.signedPayload.signerId}
      </ThemedText>
      <TouchableOpacity onPress={() => setAttachedSignature(null)}>
        <Ionicons name="close-circle" size={18} color="#999" />
      </TouchableOpacity>
    </View>
  )}
  ```
- [ ] Style chip as removable badge
- [ ] Clear attachment when message sent

**Acceptance Criteria**:
- Chip appears when signature selected
- Shows truncated signature ID and signer
- X button removes attachment
- Chip clears after sending message

---

### 3.5: Include Signature ID in Message
**Effort**: 30 minutes
**Dependencies**: 3.4

**Tasks**:
- [ ] Update `handleSend` to include `attachedSignatureId`
  ```typescript
  const handleSend = async () => {
    if (!inputText.trim() && !attachedSignature) return;

    const messageData: Partial<Message> = {
      text: inputText.trim(),
      senderId: user.uid,
      senderName: user.displayName,
      timestamp: new Date(),
      conversationId: conversationId,
      readBy: { [user.uid]: new Date().toISOString() },
    };

    // Add signature reference if attached
    if (attachedSignature) {
      messageData.attachedSignatureId = attachedSignature.signatureId;
    }

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    setInputText('');
    setAttachedSignature(null);
  };
  ```

**Acceptance Criteria**:
- Messages with attached signatures include `attachedSignatureId` field
- Field is string (signature ID only)
- Field omitted when no signature attached

---

### 3.6: Update Firestore Security Rules
**Effort**: 15 minutes
**Dependencies**: 3.5

**Tasks**:
- [ ] Update `firestore.rules` to allow `attachedSignatureId` field
  ```javascript
  // In conversations/{conversationId}/messages/{messageId}
  allow create: if isSignedIn()
                && isParticipant(conversationId)
                && request.auth.uid == request.resource.data.senderId
                && (
                  // Validate attachedSignatureId if present
                  !request.resource.data.keys().hasAny(['attachedSignatureId'])
                  || (request.resource.data.attachedSignatureId is string
                      && request.resource.data.attachedSignatureId.size() > 0)
                );
  ```
- [ ] Deploy updated rules
- [ ] Test message creation with and without signature

**Acceptance Criteria**:
- Messages with valid `attachedSignatureId` allowed
- Messages without field allowed
- Invalid types rejected by rules

---

## Phase 4: Signature Verification Logic (Week 2)

### 4.1: Detect Signature Attachment in Agent
**Effort**: 30 minutes
**Dependencies**: 3.5, 1.3

**Tasks**:
- [ ] Update `onBuyBotMessage` to check for `attachedSignatureId`
  ```typescript
  export const onBuyBotMessage = onDocumentCreated(
    'conversations/{conversationId}/messages/{messageId}',
    async (event) => {
      const message = event.data.data();

      // ... existing checks (is BuyBot conversation, not own message)

      // Check for signature attachment
      if (message.attachedSignatureId) {
        console.log('[BUYBOT] Signature attached:', message.attachedSignatureId);
        await handleSignatureVerification(
          event.params.conversationId,
          message.senderId,
          message.attachedSignatureId,
          message.text
        );
        return;
      }

      // ... existing LLM response logic
    }
  );
  ```

**Acceptance Criteria**:
- Agent detects when signature is attached
- Different code path for signature verification
- Logs signature ID for debugging

---

### 4.2: Verify Signature Cryptographically
**Effort**: 1 hour
**Dependencies**: 4.1

**Tasks**:
- [ ] Import existing `verifySignatureForAgent` function
  ```typescript
  import { verifySignatureForAgent } from '../index';

  async function handleSignatureVerification(
    conversationId: string,
    userId: string,
    signatureId: string,
    requestText: string
  ): Promise<void> {
    // 1. Verify signature exists and is cryptographically valid
    const verification = await verifySignatureForAgent(userId, signatureId);

    if (!verification.verified) {
      await sendAgentMessage(
        conversationId,
        `❌ Signature verification failed: ${verification.error || 'Invalid signature'}`
      );
      return;
    }

    console.log('[BUYBOT] Signature verified, payload:', verification.payload);

    // TODO: Check signer is power user
    // TODO: Analyze payload relevance
  }
  ```

**Acceptance Criteria**:
- Agent calls `verifySignatureForAgent` with user ID and signature ID
- Invalid signatures rejected with error message
- Valid signatures proceed to authorization check
- Verification errors logged

---

### 4.3: Check Signer is Power User
**Effort**: 30 minutes
**Dependencies**: 4.2

**Tasks**:
- [ ] Add power user check to signature handler
  ```typescript
  // In handleSignatureVerification, after verification success

  // 2. Check if signer is a power user
  const signerEmail = verification.payload.signerId;

  // Query user by email
  const userQuery = await db
    .collection('users')
    .where('email', '==', signerEmail)
    .limit(1)
    .get();

  if (userQuery.empty) {
    await sendAgentMessage(
      conversationId,
      `❌ Could not find user with email: ${signerEmail}`
    );
    return;
  }

  const signerUserId = userQuery.docs[0].id;

  if (!isPowerUser(signerUserId)) {
    await sendAgentMessage(
      conversationId,
      `❌ This signature is from ${signerEmail}, but they are not authorized to approve purchases. Only power users (ash) can provide authorization.`
    );
    return;
  }

  console.log('[BUYBOT] Signer is power user:', signerEmail);

  // TODO: Analyze payload relevance
  ```

**Acceptance Criteria**:
- Agent looks up signer by email
- Non-power-user signatures rejected with helpful message
- Power user signatures proceed to relevance analysis

---

### 4.4: LLM Payload Relevance Analysis
**Effort**: 2 hours
**Dependencies**: 4.3

**Tasks**:
- [ ] Create LLM prompt for relevance analysis
  ```typescript
  function buildRelevancePrompt(
    signedPayload: SignedPayload,
    currentRequest: string
  ): string {
    const conversationText = signedPayload.messages
      .map(m => `${m.senderName}: ${m.text}`)
      .join('\n');

    return `You are analyzing whether a digitally signed conversation authorizes a purchase request.

  SIGNED CONVERSATION (verified authentic):
  ${conversationText}

  Purpose: ${signedPayload.purpose || 'Not specified'}
  Signed by: ${signedPayload.signerId}
  Signed at: ${signedPayload.signedAt}

  CURRENT PURCHASE REQUEST:
  ${currentRequest}

  TASK:
  Determine if the signed conversation clearly authorizes this specific purchase request.

  Be suspicious of roundabout tricks:
  - "yes" to "do you like sandwiches?" does NOT authorize a quadcopter purchase
  - Approval must be contextually relevant to the request

  Respond in JSON format:
  {
    "relevant": boolean,
    "confidence": number (0-1),
    "reasoning": string (explain your decision)
  }`;
  }
  ```
- [ ] Implement relevance analysis function
  ```typescript
  async function analyzeSignatureRelevance(
    payload: SignedPayload,
    requestText: string
  ): Promise<{ relevant: boolean; confidence: number; reasoning: string }> {
    const TEST_MODE = process.env.TEST_MODE === 'true';

    if (TEST_MODE) {
      // Mock response for testing
      return {
        relevant: true,
        confidence: 0.9,
        reasoning: 'Test mode: signature accepted'
      };
    }

    const apiKey = getOpenAIKey();
    const openai = createOpenAI({ apiKey });

    const prompt = buildRelevancePrompt(payload, requestText);

    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        { role: 'system', content: 'You are a security-focused authorization analyzer.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,  // Lower temperature for consistent analysis
    });

    try {
      const result = JSON.parse(text);
      return result;
    } catch (error) {
      console.error('[BUYBOT] Failed to parse LLM response:', text);
      return {
        relevant: false,
        confidence: 0,
        reasoning: 'Error analyzing signature relevance'
      };
    }
  }
  ```
- [ ] Integrate into signature handler
  ```typescript
  // In handleSignatureVerification, after power user check

  // 3. Analyze if signature payload is relevant to request
  const relevance = await analyzeSignatureRelevance(
    verification.payload,
    requestText
  );

  console.log('[BUYBOT] Relevance analysis:', relevance);

  if (!relevance.relevant) {
    await sendAgentMessage(
      conversationId,
      `❌ I cannot accept this signature. ${relevance.reasoning}\n\nThe signed conversation does not authorize your current request.`
    );
    return;
  }

  // 4. Approved!
  await sendAgentMessage(
    conversationId,
    `✅ Purchase approved!\n\n**Authorization**: ${signerEmail} (power user)\n**Confidence**: ${(relevance.confidence * 100).toFixed(0)}%\n**Reasoning**: ${relevance.reasoning}`
  );
  ```

**Acceptance Criteria**:
- LLM analyzes signature content vs. purchase request
- Irrelevant signatures rejected with reasoning
- Relevant signatures approved with confidence score
- Agent explains decision to user
- Test mode returns deterministic results

---

## Phase 5: Testing & Polish (Week 3)

### 5.1: End-to-End Testing
**Effort**: 4 hours
**Dependencies**: All previous tasks

**Test Scenarios**:
- [ ] **Happy Path**: Non-power-user requests purchase → attaches power user signature → approved
- [ ] **Direct Power User**: Power user requests purchase directly → immediate approval
- [ ] **Invalid Signature**: User attaches non-existent signature ID → error
- [ ] **Wrong Signer**: User attaches signature from non-power-user → rejection
- [ ] **Irrelevant Signature**: User attaches signature about sandwiches for quadcopter → rejection with reasoning
- [ ] **No Signature**: User chats normally with BuyBot → normal conversation
- [ ] **Multiple Conversations**: Verify agent only responds in BuyBot conversations
- [ ] **Agent Presence**: BuyBot shows as online, searchable, in People tab
- [ ] **Test Mode**: Verify TEST_MODE flag works for development

**Acceptance Criteria**:
- All test scenarios pass
- No false positives or false negatives
- Error messages are helpful and clear

---

### 5.2: Error Handling & Edge Cases
**Effort**: 2 hours
**Dependencies**: 5.1

**Tasks**:
- [ ] Handle signature not found in user's collection
- [ ] Handle malformed signature data
- [ ] Handle OpenAI API failures (timeout, rate limit)
- [ ] Handle Firestore connection issues
- [ ] Add retry logic for transient failures
- [ ] Add timeouts for LLM calls (max 10 seconds)
- [ ] Log all errors with context

**Acceptance Criteria**:
- Graceful error messages to user
- No crashes or unhandled exceptions
- Errors logged with sufficient context for debugging

---

### 5.3: UI Polish
**Effort**: 2 hours
**Dependencies**: 3.1-3.6

**Tasks**:
- [ ] Add loading indicators when agent is processing
- [ ] Show "BuyBot is typing..." indicator
- [ ] Ensure signature chip is visually distinct
- [ ] Add haptic feedback on signature selection
- [ ] Verify dark mode support for all new UI
- [ ] Test on iOS, Android, and Web platforms
- [ ] Add empty state illustrations to signature modal

**Acceptance Criteria**:
- UI feels polished and responsive
- No visual glitches or layout issues
- Consistent with existing app design
- Works across all platforms

---

### 5.4: Documentation
**Effort**: 2 hours
**Dependencies**: 5.1-5.3

**Tasks**:
- [ ] Document BuyBot setup in `.dev-docs/chai/setup.md`
  - How to create agent user
  - How to configure power users
  - How to enable/disable test mode
- [ ] Document testing procedures
- [ ] Document known limitations
- [ ] Update README with CHAI feature description
- [ ] Create user guide (how to use signature attachments)

**Acceptance Criteria**:
- Clear setup instructions for other developers
- Known limitations documented
- User-facing documentation complete

---

### 5.5: Performance Optimization
**Effort**: 1 hour
**Dependencies**: 5.1

**Tasks**:
- [ ] Parallelize Firestore queries where possible
  ```typescript
  // Fetch signature and signer info in parallel
  const [verification, signerDocs] = await Promise.all([
    verifySignatureForAgent(userId, signatureId),
    db.collection('users').where('email', '==', signerEmail).get()
  ]);
  ```
- [ ] Add caching for power user public keys (if needed)
- [ ] Monitor LLM response times
- [ ] Set appropriate function timeouts (60 seconds)

**Acceptance Criteria**:
- Signature verification completes in < 3 seconds
- LLM response time acceptable (< 5 seconds)
- No unnecessary sequential operations

---

## Phase 6: Deployment & Monitoring (Week 3)

### 6.1: Deploy to Staging
**Effort**: 1 hour
**Dependencies**: 5.1-5.5

**Tasks**:
- [ ] Deploy Cloud Functions to staging environment
- [ ] Create BuyBot user in staging Firebase
- [ ] Add staging power user UIDs to config
- [ ] Set `TEST_MODE=false` in staging
- [ ] Test full flow in staging

**Acceptance Criteria**:
- All functions deployed successfully
- BuyBot accessible in staging app
- End-to-end flow works in staging

---

### 6.2: Production Deployment
**Effort**: 30 minutes
**Dependencies**: 6.1

**Tasks**:
- [ ] Deploy Cloud Functions to production
- [ ] Create BuyBot user in production Firebase
- [ ] Add production power user UIDs to config
- [ ] Set `TEST_MODE=false` in production
- [ ] Verify OpenAI API key in production secrets

**Acceptance Criteria**:
- Functions deployed to production
- BuyBot user created
- No test mode in production

---

### 6.3: Monitoring & Logging
**Effort**: 1 hour
**Dependencies**: 6.2

**Tasks**:
- [ ] Set up Firebase Functions logging
- [ ] Monitor OpenAI API costs
- [ ] Set up alerts for function errors
- [ ] Create dashboard for agent usage metrics
  - Messages processed
  - Signatures verified
  - Approvals granted/denied
  - LLM costs

**Acceptance Criteria**:
- Logging captures all important events
- Cost monitoring in place
- Alerts configured for errors

---

## Summary

### Total Effort Estimate
- **Phase 1 (Infrastructure)**: ~5 hours
- **Phase 2 (Agent Logic)**: ~5.5 hours
- **Phase 3 (UI)**: ~7.5 hours
- **Phase 4 (Verification)**: ~4 hours
- **Phase 5 (Testing & Polish)**: ~11 hours
- **Phase 6 (Deployment)**: ~2.5 hours

**Total**: ~35.5 hours (~1 week for single developer, 2-3 weeks with testing/iterations)

### Critical Path
1. Create BuyBot user (1.1)
2. Message trigger function (1.3)
3. LLM integration (2.2)
4. Signature UI (3.1-3.6)
5. Verification logic (4.1-4.4)
6. Testing (5.1-5.2)

### Dependencies on Existing Systems
- ✅ Digital signatures (sig2) - fully implemented
- ✅ AI service infrastructure - translation agent pattern reusable
- ✅ Firestore schema - minimal changes needed
- ✅ Chat UI - just add attachment button

### Known Limitations (POC)
- Single agent only (BuyBot)
- Hardcoded power users
- No rate limiting
- No audit logs
- No signature expiration
- 1-on-1 agent conversations only

---

**Document Status**: ✅ Ready for Implementation
**Next Step**: Begin Phase 1 - Agent Infrastructure

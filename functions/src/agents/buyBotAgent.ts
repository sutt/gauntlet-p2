/**
 * BuyBot Agent - Purchasing Assistant
 *
 * Cloud Function that triggers on new messages in conversations with BuyBot.
 * Responds to user messages and handles purchase authorization via signatures.
 *
 * Phase 1.3 & 1.4: Basic message trigger and response
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { BUYBOT_USER_ID } from '../config/agents';

const db = getFirestore();

/**
 * Firestore Trigger: Responds to new messages in BuyBot conversations
 *
 * Triggers when a new message is created in any conversation.
 * Only processes messages in conversations where BuyBot is a participant.
 */
export const onBuyBotMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    // Check if document exists
    if (!event.data) {
      console.log('[BUYBOT] No data in event, ignoring');
      return;
    }

    const message = event.data.data();
    const conversationId = event.params.conversationId;
    const messageId = event.params.messageId;

    console.log('[BUYBOT] Message trigger fired:', {
      conversationId,
      messageId,
      senderId: message.senderId,
      text: message.text?.substring(0, 50),
    });

    try {
      // 1. Check if this conversation includes BuyBot
      const convDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .get();

      if (!convDoc.exists) {
        console.log('[BUYBOT] Conversation not found, ignoring');
        return;
      }

      const participants = convDoc.data()?.participants || [];

      // Only respond in conversations where BuyBot is a participant
      if (!participants.includes(BUYBOT_USER_ID)) {
        console.log('[BUYBOT] Not a BuyBot conversation, ignoring');
        return;
      }

      console.log('[BUYBOT] ✓ BuyBot is in this conversation');

      // 2. Don't respond to own messages (prevent infinite loop)
      if (message.senderId === BUYBOT_USER_ID) {
        console.log('[BUYBOT] Ignoring own message');
        return;
      }

      console.log('[BUYBOT] ✓ Message is from user, processing...');

      // 3. Process the user's message and respond
      await processUserMessage(conversationId, message);

    } catch (error: any) {
      console.error('[BUYBOT] Error processing message:', error);
      // Don't throw - we don't want to retry on errors
      // Just log and move on
    }
  }
);

/**
 * Process a user message and generate a response
 * Phase 1: Simple echo/acknowledgment
 * Phase 2+: LLM integration, signature verification, etc.
 */
async function processUserMessage(
  conversationId: string,
  message: any
): Promise<void> {
  console.log('[BUYBOT] Processing message from:', message.senderName);
  console.log('[BUYBOT] Message text:', message.text);

  // For now, send a simple acknowledgment
  // In Phase 2, we'll add LLM integration here
  const responseText = `Hello! I'm BuyBot, your purchasing assistant. I received your message: "${message.text}"

I'm currently in test mode. Once fully configured, I can help you with:
- Purchase requests
- Authorization verification
- Signature validation

Try sending me a purchase request!`;

  await sendAgentMessage(conversationId, responseText);
}

/**
 * Send a message as BuyBot to a conversation
 *
 * Creates a new message document in Firestore with BuyBot as the sender.
 * Also updates the conversation's lastMessage field.
 */
async function sendAgentMessage(
  conversationId: string,
  text: string
): Promise<void> {
  console.log('[BUYBOT] Sending response to conversation:', conversationId);

  try {
    // 1. Create message document
    const messageRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc();

    const timestamp = new Date();

    await messageRef.set({
      id: messageRef.id,
      text,
      senderId: BUYBOT_USER_ID,
      senderName: 'BuyBot',
      timestamp,
      conversationId,
      readBy: {
        // BuyBot has already "read" its own message
        [BUYBOT_USER_ID]: timestamp.toISOString(),
      },
    });

    console.log('[BUYBOT] ✓ Message created:', messageRef.id);

    // 2. Update conversation lastMessage
    await db
      .collection('conversations')
      .doc(conversationId)
      .update({
        lastMessage: text,
        lastMessageTimestamp: timestamp,
        // Don't update unreadCount for the agent itself
      });

    console.log('[BUYBOT] ✓ Conversation updated');

  } catch (error: any) {
    console.error('[BUYBOT] Error sending message:', error);
    throw error;
  }
}

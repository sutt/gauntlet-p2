/**
 * BuyBot Agent - Purchasing Assistant
 *
 * Cloud Function that triggers on new messages in conversations with BuyBot.
 * Responds to user messages and handles purchase authorization via signatures.
 *
 * Phase 1.3 & 1.4: Basic message trigger and response
 * Phase 2.1: Conversation context retrieval
 * Phase 2.2: LLM integration for intelligent responses
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { BUYBOT_USER_ID, getPowerUserIds, isPowerUser } from '../config/agents';
import { getConversationContext } from '../services/contextRetrieval';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIKey } from '../config';

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

      // 3. Check if this is a power user making a direct purchase request
      if (await checkDirectPowerUserRequest(message.senderId, message.text)) {
        console.log('[BUYBOT] ✅ Power user auto-approval triggered');
        await sendAgentMessage(
          conversationId,
          "✅ Approved! As a power user, your purchase request has been automatically authorized. No additional signatures needed."
        );
        return;
      }

      // 4. Process the user's message and respond normally
      await processUserMessage(conversationId, message);

    } catch (error: any) {
      console.error('[BUYBOT] Error processing message:', error);
      // Don't throw - we don't want to retry on errors
      // Just log and move on
    }
  }
);

/**
 * Analyze if a message is a purchase request using LLM semantic analysis
 * Returns true if the message represents a purchase intent
 */
async function isPurchaseRequest(messageText: string): Promise<boolean> {
  console.log('[BUYBOT] 🔍 Analyzing message for purchase intent:', messageText);

  try {
    const apiKey = getOpenAIKey();
    const openai = createOpenAI({ apiKey });

    const prompt = `Analyze if the following message represents a purchase request or intent to buy something.

Message: "${messageText}"

Return ONLY a JSON object with this exact structure:
{
  "isPurchaseRequest": true or false,
  "reasoning": "brief explanation"
}

A purchase request includes:
- Direct requests to buy/purchase something (e.g., "I need to buy a laptop")
- Intent to acquire/order items (e.g., "Can we get new office chairs?")
- Spending requests (e.g., "We should invest in new software")

NOT a purchase request:
- General questions (e.g., "What can you do?")
- Greetings (e.g., "Hi", "Hello")
- Unrelated conversation (e.g., "How's the weather?")
- Past tense about buying (e.g., "I already bought this")`;

    const { text: responseText } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        {
          role: 'system',
          content: 'You are a semantic analysis assistant. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    // Parse the response
    const result = JSON.parse(responseText);

    console.log('[BUYBOT] 📊 PURCHASE_INTENT_ANALYSIS:', {
      message: messageText.substring(0, 50),
      isPurchaseRequest: result.isPurchaseRequest,
      reasoning: result.reasoning,
    });

    return result.isPurchaseRequest === true;

  } catch (error: any) {
    console.error('[BUYBOT] Error analyzing purchase intent:', error);
    // On error, default to false (don't auto-approve)
    console.log('[BUYBOT] 📊 PURCHASE_INTENT_ANALYSIS: ERROR - defaulting to false');
    return false;
  }
}

/**
 * Check if message is from a power user making a direct purchase request
 * Power users can approve their own purchases without additional authorization
 */
async function checkDirectPowerUserRequest(
  senderId: string,
  messageText: string
): Promise<boolean> {
  // First check if sender is a power user
  if (!isPowerUser(senderId)) {
    console.log('[BUYBOT] Sender is not a power user, skipping auto-approval');
    return false;
  }

  console.log('[BUYBOT] ⭐ Sender is a power user, checking for purchase intent...');

  // Use LLM to semantically detect purchase request
  const isPurchase = await isPurchaseRequest(messageText);

  console.log('[BUYBOT] 🎯 POWER_USER_AUTO_APPROVAL:', {
    senderId,
    isPowerUser: true,
    isPurchaseRequest: isPurchase,
    willAutoApprove: isPurchase,
  });

  return isPurchase;
}

/**
 * Fetch email addresses for power users
 * Used to inform BuyBot which users can authorize purchases
 */
async function getPowerUserEmails(): Promise<string[]> {
  const powerUserIds = getPowerUserIds();
  const emails: string[] = [];

  console.log('[BUYBOT] Fetching emails for power users:', powerUserIds);

  for (const userId of powerUserIds) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const email = userDoc.data()?.email;
        if (email) {
          emails.push(email);
          console.log('[BUYBOT] Found power user email:', email);
        }
      }
    } catch (error: any) {
      console.error('[BUYBOT] Error fetching user email for', userId, error);
    }
  }

  return emails;
}

/**
 * Build the system prompt for BuyBot
 * Includes power user list and agent capabilities
 */
async function buildBuyBotPrompt(): Promise<string> {
  const powerUserEmails = await getPowerUserEmails();
  const powerUserList = powerUserEmails.length > 0
    ? powerUserEmails.join(', ')
    : 'None configured';

  return `You are BuyBot, a purchasing assistant AI agent integrated into a messaging app.

Your role:
- Help users with purchase requests
- Verify that purchases are authorized by power users via digital signatures
- Provide friendly, professional assistance

Power users (who can authorize purchases):
${powerUserList}

Key capabilities:
- You can see conversation history to understand context
- Users can attach digital signatures to messages for authorization
- You validate signatures to ensure purchases are properly authorized
- You are helpful, concise, and professional

Guidelines:
- Be friendly but professional
- Ask clarifying questions when purchase requests are unclear
- Explain the signature authorization process when needed
- Keep responses concise (2-3 sentences usually)
- If a purchase needs authorization, explain who can approve it

Do NOT:
- Approve purchases without proper signature verification
- Make purchasing decisions yourself
- Share sensitive information
- Provide financial advice`;
}

/**
 * Generate a mock response for TEST_MODE
 * Simple acknowledgment without calling OpenAI
 */
function getMockResponse(userMessage: string, conversationHistory: string[]): string {
  const contextNote = conversationHistory.length > 0
    ? ` I can see we've exchanged ${conversationHistory.length} messages.`
    : '';

  return `[TEST MODE] Thanks for your message: "${userMessage}"${contextNote} I'm BuyBot, ready to help with purchases. In production, I'll use AI to provide intelligent responses!`;
}

/**
 * Generate an intelligent response using OpenAI GPT-4
 * Falls back to mock response if TEST_MODE is enabled
 */
async function generateBuyBotResponse(
  userMessage: string,
  conversationHistory: string[]
): Promise<string> {
  // Check if TEST_MODE is enabled
  const testMode = process.env.TEST_MODE === 'true';

  console.log('[BUYBOT] TEST_MODE check:', {
    raw: process.env.TEST_MODE,
    parsed: testMode,
  });

  if (testMode) {
    console.log('[BUYBOT] TEST_MODE enabled, using mock response');
    return getMockResponse(userMessage, conversationHistory);
  }

  console.log('[BUYBOT] TEST_MODE disabled, calling OpenAI...');

  // Build the system prompt
  const systemPrompt = await buildBuyBotPrompt();

  // Format conversation history for the LLM
  const historyContext = conversationHistory.length > 0
    ? `\n\nConversation history:\n${conversationHistory.join('\n')}`
    : '\n\n(This is the first message in the conversation)';

  console.log('[BUYBOT] Calling OpenAI GPT-4...');

  try {
    const apiKey = getOpenAIKey();
    const openai = createOpenAI({ apiKey });

    const { text: responseText } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `${historyContext}\n\nLatest message: ${userMessage}`,
        },
      ],
      temperature: 0.7,
    });

    console.log('[BUYBOT] ✓ OpenAI response generated');
    return responseText;

  } catch (error: any) {
    console.error('[BUYBOT] Error calling OpenAI:', error);
    return 'I apologize, I encountered an error processing your message. Please try again in a moment.';
  }
}

/**
 * Process a user message and generate a response
 * Phase 2.1: Fetch conversation context (last 10 messages)
 * Phase 2.2: LLM integration for intelligent responses
 */
async function processUserMessage(
  conversationId: string,
  message: any
): Promise<void> {
  console.log('[BUYBOT] Processing message from:', message.senderName);
  console.log('[BUYBOT] Message text:', message.text);

  // Phase 2.1: Fetch conversation context (last 10 messages)
  console.log('[BUYBOT] Fetching conversation context...');
  const conversationHistory = await getConversationContext(conversationId, 10);

  console.log('[BUYBOT] Conversation context retrieved:');
  console.log('[BUYBOT] - Message count:', conversationHistory.length);
  if (conversationHistory.length > 0) {
    console.log('[BUYBOT] - Recent messages:');
    conversationHistory.forEach((msg, i) => {
      console.log(`[BUYBOT]   ${i + 1}. ${msg}`);
    });
  }

  // Phase 2.2: Generate intelligent response using LLM
  const responseText = await generateBuyBotResponse(message.text, conversationHistory);

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

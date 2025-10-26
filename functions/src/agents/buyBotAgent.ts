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
import { getOpenAIKey, openaiApiKey } from '../config';
import { verifySignatureForAgent } from '../index';

const db = getFirestore();

/**
 * Firestore Trigger: Responds to new messages in BuyBot conversations
 *
 * Triggers when a new message is created in any conversation.
 * Only processes messages in conversations where BuyBot is a participant.
 */
export const onBuyBotMessage = onDocumentCreated(
  {
    document: 'conversations/{conversationId}/messages/{messageId}',
    secrets: [openaiApiKey], // Declare secret dependencies for OpenAI access
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
  },
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
      hasAttachedSignature: !!message.attachedSignatureId,
      attachedSignatureId: message.attachedSignatureId || null,
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

      // 4. Check for signature attachment
      if (message.attachedSignatureId) {
        console.log('[BUYBOT] 📝 Signature attached, starting verification...');
        await handleSignatureVerification(
          conversationId,
          message.senderId,
          message.attachedSignatureId,
          message.text || ''
        );
        return;
      }

      // 5. Process the user's message and respond normally
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
 * Build LLM prompt for signature relevance analysis
 * Phase 4.4: Determine if signed conversation authorizes the purchase request
 */
function buildRelevancePrompt(
  signedPayload: any,
  currentRequest: string
): string {
  const conversationText = signedPayload.messages
    .map((m: any) => `${m.senderName}: ${m.text}`)
    .join('\n');

  return `You are analyzing whether a digitally signed conversation authorizes a purchase request.

SIGNED CONVERSATION (verified authentic):
${conversationText}

Purpose: ${signedPayload.purpose || 'Not specified'}
Signed by: ${signedPayload.signerId}
Signed at: ${new Date(signedPayload.signedAt).toLocaleString()}

CURRENT PURCHASE REQUEST:
${currentRequest || '(No specific request text - considering broader conversation context)'}

TASK:
Determine if the signed conversation clearly authorizes this specific purchase request.

Be suspicious of roundabout tricks:
- "yes" to "do you like sandwiches?" does NOT authorize a quadcopter purchase
- Approval must be contextually relevant to the request
- Generic agreements without specific context are NOT sufficient
- The signed conversation should show clear intent to authorize THIS purchase

Respond in JSON format:
{
  "relevant": boolean,
  "confidence": number (0-1),
  "reasoning": string (explain your decision in 1-2 sentences)
}`;
}

/**
 * Analyze signature payload relevance using LLM
 * Phase 4.4: Semantic analysis to prevent authorization tricks
 */
async function analyzeSignatureRelevance(
  payload: any,
  requestText: string
): Promise<{ relevant: boolean; confidence: number; reasoning: string }> {
  console.log('[BUYBOT] 🤖 Analyzing signature relevance with LLM...');

  const TEST_MODE = process.env.TEST_MODE === 'true';

  if (TEST_MODE) {
    console.log('[BUYBOT] TEST_MODE enabled, returning mock relevance result');
    // Mock response for testing
    return {
      relevant: true,
      confidence: 0.9,
      reasoning: 'Test mode: signature accepted for development testing'
    };
  }

  try {
    const apiKey = getOpenAIKey();
    const openai = createOpenAI({ apiKey });

    const prompt = buildRelevancePrompt(payload, requestText);

    const { text: responseText } = await generateText({
      model: openai('gpt-4-turbo'),
      messages: [
        {
          role: 'system',
          content: 'You are a security-focused authorization analyzer. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent security analysis
    });

    const result = JSON.parse(responseText);

    console.log('[BUYBOT] 📊 RELEVANCE_ANALYSIS:', {
      relevant: result.relevant,
      confidence: result.confidence,
      reasoning: result.reasoning.substring(0, 100),
    });

    return result;

  } catch (error: any) {
    console.error('[BUYBOT] Error analyzing signature relevance:', error);
    // On error, default to rejecting (fail secure)
    return {
      relevant: false,
      confidence: 0,
      reasoning: 'Error analyzing signature relevance - defaulting to rejection for security'
    };
  }
}

/**
 * Handle signature verification for purchase authorization
 * Phase 4.1 & 4.2: Verify signature cryptographically and check authorization
 */
async function handleSignatureVerification(
  conversationId: string,
  userId: string,
  signatureId: string,
  requestText: string
): Promise<void> {
  console.log('[BUYBOT] 🔐 Starting signature verification:', {
    signatureId: signatureId.substring(0, 12) + '...',
    hasRequestText: !!requestText,
  });

  try {
    // Phase 4.2: Verify signature cryptographically
    const verification = await verifySignatureForAgent(userId, signatureId);

    if (!verification.verified) {
      const errorMsg = verification.error || 'Invalid signature';
      console.log('[BUYBOT] ❌ Signature verification failed:', errorMsg);

      await sendAgentMessage(
        conversationId,
        `❌ I cannot accept this signature. Verification failed: ${errorMsg}\n\n` +
        `I'm cancelling this request. Please ensure you're attaching a valid signature from an authorized user.`
      );
      return;
    }

    // Verification succeeded
    console.log('[BUYBOT] ✅ Signature verified successfully');

    // Phase 4.3: Check if signer is a power user
    const signerEmail = verification.payload.signerId;
    console.log('[BUYBOT] 🔍 Checking if signer is power user:', signerEmail);

    // Query user by email to get their UID
    const userQuery = await db
      .collection('users')
      .where('email', '==', signerEmail)
      .limit(1)
      .get();

    if (userQuery.empty) {
      console.log('[BUYBOT] ❌ Signer not found:', signerEmail);
      await sendAgentMessage(
        conversationId,
        `❌ I cannot verify the authorization. Could not find user with email: ${signerEmail}\n\n` +
        `I'm cancelling this request. The signature may be from an external or deleted user.`
      );
      return;
    }

    const signerUserId = userQuery.docs[0].id;
    const signerData = userQuery.docs[0].data();
    const signerName = signerData.displayName || signerEmail;

    if (!isPowerUser(signerUserId)) {
      console.log('[BUYBOT] ❌ Signer is not a power user:', {
        email: signerEmail,
        uid: signerUserId,
      });

      const powerUserEmails = await getPowerUserEmails();
      const powerUserList = powerUserEmails.length > 0
        ? powerUserEmails.join(', ')
        : 'None configured';

      await sendAgentMessage(
        conversationId,
        `❌ This signature is from ${signerName} (${signerEmail}), but they are not authorized to approve purchases.\n\n` +
        `Only power users can provide authorization. Current power users: ${powerUserList}\n\n` +
        `I'm cancelling this request. Please obtain a signature from an authorized power user.`
      );
      return;
    }

    console.log('[BUYBOT] ✅ Signer is a power user:', {
      email: signerEmail,
      name: signerName,
      uid: signerUserId,
    });

    // Phase 4.4: Analyze signature payload relevance to request
    const relevance = await analyzeSignatureRelevance(
      verification.payload,
      requestText
    );

    if (!relevance.relevant || relevance.confidence < 0.5) {
      console.log('[BUYBOT] ❌ Signature not relevant:', {
        relevant: relevance.relevant,
        confidence: relevance.confidence,
      });

      await sendAgentMessage(
        conversationId,
        `❌ I cannot accept this signature for your request.\n\n` +
        `**Analysis**: ${relevance.reasoning}\n\n` +
        `The signed conversation does not clearly authorize your current request. ` +
        `Please obtain a signature that specifically addresses this purchase.`
      );
      return;
    }

    // All checks passed - Purchase approved!
    console.log('[BUYBOT] ✅ PURCHASE APPROVED:', {
      signer: signerName,
      confidence: relevance.confidence,
    });

    await sendAgentMessage(
      conversationId,
      `✅ **Purchase Approved!**\n\n` +
      `**Authorization**: ${signerName} (${signerEmail})\n` +
      `**Status**: Power user signature verified\n` +
      `**Confidence**: ${(relevance.confidence * 100).toFixed(0)}%\n` +
      `**Reasoning**: ${relevance.reasoning}\n\n` +
      `Your request has been authorized. Proceeding with purchase.`
    );

  } catch (error: any) {
    console.log('[BUYBOT] ❌ Signature verification error:', {
      error: error.message,
      signatureId: signatureId.substring(0, 12) + '...',
    });

    await sendAgentMessage(
      conversationId,
      `❌ I encountered an error while verifying the signature: ${error.message}\n\n` +
      `I'm cancelling this request. Please try again or contact support if the problem persists.`
    );
  }
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

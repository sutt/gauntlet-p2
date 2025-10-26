import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { openaiApiKey, getOpenAIKey } from './config';
import { translateText, TranslationRequestSchema } from './agents/translationAgent';
import {
  getConversationContext,
  getParticipantNames,
  getSenderName,
} from './services/contextRetrieval';
import * as openpgp from 'openpgp';

// Initialize Firebase Admin SDK
// Required because we use Firestore at module level (in this file and contextRetrieval.ts)
// In production, this auto-configures from the environment
// In Functions shell, this must be explicit
initializeApp();

const db = getFirestore();

/**
 * Hello World AI Function
 *
 * This is a simple callable function that demonstrates:
 * 1. Callable function pattern
 * 2. Authentication check
 * 3. Secret usage (OpenAI API key)
 * 4. Error handling
 * 5. TypeScript types
 *
 * Usage from client:
 * const result = await httpsCallable(functions, 'helloWorldAI')({ message: 'Hello!' });
 */
export const helloWorldAI = onCall(
  {
    secrets: [openaiApiKey], // Declare secret dependencies
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    // Allow public invocation (authentication is handled by Firebase SDK)
    invoker: 'public',
    // Enable CORS for web development
    cors: [
      'http://localhost:8081',  // Expo web dev server
      'http://localhost:19006', // Alternative Expo web port
      /^https:\/\/.*\.vercel\.app$/, // Vercel deployments (if you deploy later)
    ],
  },
  async (request) => {
    // 1. Authentication check
    // Can be disabled for local shell testing via DISABLE_AUTH_CHECK env var
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';

    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to call this function.'
      );
    }

    const { message } = request.data;

    // 2. Input validation
    if (!message || typeof message !== 'string') {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a "message" field.'
      );
    }

    try {
      // 3. Get OpenAI API key from secrets
      const apiKey = getOpenAIKey();

      if (!apiKey) {
        throw new HttpsError(
          'failed-precondition',
          'OpenAI API key not configured'
        );
      }

      // 4. Make a simple OpenAI API call (completion test)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Respond briefly.',
            },
            {
              role: 'user',
              content: message,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('OpenAI API error:', error);
        throw new HttpsError(
          'internal',
          `OpenAI API error: ${error.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'No response';

      // 5. Return structured response
      return {
        success: true,
        input: message,
        output: aiResponse,
        timestamp: new Date().toISOString(),
        userId: request.auth?.uid || 'shell-test-user',
        model: 'gpt-3.5-turbo',
      };
    } catch (error: any) {
      console.error('Error in helloWorldAI:', error);

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError('internal', `Function error: ${error.message}`);
    }
  }
);

/**
 * Translation Cloud Function
 *
 * Translates text with conversation context awareness.
 * Uses AI SDK for intelligent translation with cultural understanding.
 *
 * Features:
 * - Auto-detects source language
 * - Provides alternative translations
 * - Explains idioms and cultural references
 * - Uses conversation context for better accuracy
 */
export const translateMessage = onCall(
  {
    secrets: [openaiApiKey],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    cors: [
      'http://localhost:8081',
      'http://localhost:19006',
      /^https:\/\/.*\.vercel\.app$/,
    ],
  },
  async (request) => {
    const startTime = Date.now();

    // Authentication check
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth?.uid || 'shell-test-user';

    try {
      // Validate input
      const validationResult = TranslationRequestSchema.safeParse(request.data);
      if (!validationResult.success) {
        throw new HttpsError(
          'invalid-argument',
          `Invalid request: ${validationResult.error.message}`
        );
      }

      const translationRequest = validationResult.data;

      // If conversation context provided, fetch it
      if (translationRequest.context?.conversationId) {
        const conversationId = translationRequest.context.conversationId;

        // Verify user has access to this conversation
        const convDoc = await db.collection('conversations').doc(conversationId).get();

        if (!convDoc.exists) {
          throw new HttpsError('not-found', 'Conversation not found');
        }

        const participants = convDoc.data()?.participants || [];
        if (!disableAuthCheck && !participants.includes(userId)) {
          throw new HttpsError('permission-denied', 'Not a participant in this conversation');
        }

        // Fetch context
        const recentMessages = await getConversationContext(conversationId, 5);
        const participantNames = await getParticipantNames(conversationId);

        // Enhance request with context
        translationRequest.context = {
          ...translationRequest.context,
          recentMessages,
          recipientNames: participantNames.filter((name) => name !== 'Unknown'),
        };
      }

      // Get sender name
      if (!translationRequest.context?.senderName && !disableAuthCheck) {
        const senderName = await getSenderName(userId);
        if (!translationRequest.context) {
          translationRequest.context = {};
        }
        translationRequest.context.senderName = senderName;
      }

      // Perform translation
      const result = await translateText(translationRequest);

      console.log(`Translation completed in ${Date.now() - startTime}ms for user ${userId}`);

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Error in translateMessage:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Translation error: ${error.message}`);
    }
  }
);

/**
 * Generate PGP Keys for User (Digital Signatures v2)
 *
 * Generates ECC Curve25519 key pair for authenticated user on server-side.
 * Keys are stored unencrypted in Firestore (POC trust-the-server model).
 *
 * Features:
 * - Fast ECC Curve25519 generation (~200-500ms)
 * - No passphrase required (POC limitation)
 * - Keys stored in users/{uid} document
 * - Returns public key and fingerprint
 *
 * Security (POC):
 * - Private keys stored unencrypted in Firestore
 * - Anyone with Firestore admin access can forge signatures
 * - Documented limitation: production should use HSM or encryption
 */
export const generateKeysForUser = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    cors: [
      'http://localhost:8081',
      'http://localhost:19006',
      /^https:\/\/.*\.vercel\.app$/,
    ],
  },
  async (request) => {
    const startTime = Date.now();

    // Authentication check
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to generate keys');
    }

    const userId = request.auth?.uid || 'shell-test-user';
    const userEmail = request.auth?.token.email || 'test@example.com';

    console.log('[KEYGEN] Generating keys for user:', userEmail);

    try {
      // Check if keys already exist
      const userDoc = await db.collection('users').doc(userId).get();

      if (userDoc.data()?.publicKey) {
        throw new HttpsError(
          'already-exists',
          'Keys already generated for this user. Each user can only generate keys once.'
        );
      }

      // Generate ECC Curve25519 key pair
      console.log('[KEYGEN] Generating ECC Curve25519 key pair...');
      const keygenStartTime = Date.now();

      const { privateKey, publicKey } = await openpgp.generateKey({
        type: 'ecc',
        curve: 'curve25519',
        userIDs: [{ email: userEmail }],
        format: 'armored'
        // No passphrase - keys stored unencrypted (POC limitation)
      });

      const keygenTime = Date.now() - keygenStartTime;
      console.log('[KEYGEN] Key generation took:', keygenTime, 'ms');

      // Get fingerprint
      const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
      const fingerprint = publicKeyObj.getFingerprint();

      console.log('[KEYGEN] Fingerprint:', fingerprint);

      // Store in Firestore (unencrypted for POC)
      const updateStartTime = Date.now();

      await db.collection('users').doc(userId).update({
        publicKey,
        privateKey,  // Stored unencrypted - POC limitation
        publicKeyFingerprint: fingerprint,
        publicKeyCreatedAt: new Date(),
        signatureKeysVersion: '2.0'
      });

      const updateTime = Date.now() - updateStartTime;
      console.log('[KEYGEN] Firestore update took:', updateTime, 'ms');

      const totalTime = Date.now() - startTime;
      console.log('[KEYGEN] ✓ Keys stored successfully. Total time:', totalTime, 'ms');

      return {
        success: true,
        publicKey,
        fingerprint,
        timings: {
          keyGeneration: keygenTime,
          firestoreUpdate: updateTime,
          total: totalTime
        }
      };
    } catch (error: any) {
      console.error('[KEYGEN] Error generating keys:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Key generation error: ${error.message}`);
    }
  }
);

/**
 * Sign Messages Cloud Function (Digital Signatures v2)
 *
 * Signs selected messages with user's private key stored on server.
 * Creates a signature document in users/{uid}/signatures/{signatureId}.
 *
 * Features:
 * - Server-side signing with OpenPGP.js
 * - Adds server metadata (timestamp, nonce)
 * - Stores signature in Firestore
 * - Updates message documents with signature reference
 * - Validates conversation access
 *
 * Security (POC):
 * - Trusts client-provided payload (conversation/messages)
 * - Private keys stored unencrypted in Firestore
 */
export const signMessages = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    cors: [
      'http://localhost:8081',
      'http://localhost:19006',
      /^https:\/\/.*\.vercel\.app$/,
    ],
  },
  async (request) => {
    const startTime = Date.now();

    // 1. Check authentication
    const disableAuthCheck = process.env.DISABLE_AUTH_CHECK === 'true';
    if (!disableAuthCheck && !request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to sign messages');
    }

    const userId = request.auth?.uid || 'shell-test-user';
    const { conversationId, payload } = request.data;

    console.log('[SIGN] Signing messages for user:', userId);
    console.log('[SIGN] Conversation:', conversationId);
    console.log('[SIGN] Message count:', payload?.messages?.length || 0);

    // 2. Validate input
    if (!conversationId || !payload) {
      throw new HttpsError('invalid-argument', 'Missing required fields: conversationId and payload');
    }

    if (!payload.messages || payload.messages.length === 0) {
      throw new HttpsError('invalid-argument', 'No messages to sign');
    }

    try {
      // 3. Validate conversation access
      const convDoc = await db.collection('conversations').doc(conversationId).get();

      if (!convDoc.exists) {
        throw new HttpsError('not-found', 'Conversation not found');
      }

      const participants = convDoc.data()?.participants || [];
      if (!disableAuthCheck && !participants.includes(userId)) {
        throw new HttpsError('permission-denied', 'Not a participant in this conversation');
      }

      // 4. Fetch private key
      const userDoc = await db.collection('users').doc(userId).get();
      const privateKeyArmored = userDoc.data()?.privateKey;

      if (!privateKeyArmored) {
        throw new HttpsError(
          'failed-precondition',
          'No signature keys found. Please generate keys first in Settings > Digital Signatures.'
        );
      }

      // 5. Add server metadata to payload
      payload.timestamp = Date.now();
      payload.signedAt = new Date().toISOString();
      payload.nonce = generateNonce();
      payload.version = '2.0';

      console.log('[SIGN] Payload prepared:', {
        signer: payload.signerId,
        timestamp: payload.timestamp,
        nonce: payload.nonce,
        messageCount: payload.messages.length,
      });

      // 6. Serialize payload
      const payloadText = JSON.stringify(payload, null, 2);
      console.log('[SIGN] Payload size:', payloadText.length, 'bytes');

      // 7. Sign payload with OpenPGP
      console.log('[SIGN] Signing with OpenPGP...');
      const signStartTime = Date.now();

      const privateKey = await openpgp.readPrivateKey({
        armoredKey: privateKeyArmored,
      });

      const message = await openpgp.createMessage({ text: payloadText });
      const signatureResult = await openpgp.sign({
        message,
        signingKeys: privateKey,
        format: 'armored',
        detached: false,
      });

      // Convert to string if needed
      const signature = typeof signatureResult === 'string' ? signatureResult : String(signatureResult);

      const signTime = Date.now() - signStartTime;
      console.log('[SIGN] Signing took:', signTime, 'ms');
      console.log('[SIGN] Signature length:', signature.length, 'characters');

      // 8. Create signature document
      const signatureId = db.collection('_').doc().id;

      // Build signature document data - only include purpose if it exists
      const signatureDocData: any = {
        signatureId,
        signedPayload: payload,
        pgpSignature: signature,
        createdAt: new Date(),
        conversationId,
        messageIds: payload.messages.map((m: any) => m.messageId),
        signerId: userId, // Top-level field for easier querying
        verified: false, // Will be set by AI agent verification (future)
      };

      // Only add purpose if it exists in the payload
      if (payload.purpose) {
        signatureDocData.purpose = payload.purpose;
      }

      await db
        .collection('users')
        .doc(userId)
        .collection('signatures')
        .doc(signatureId)
        .set(signatureDocData);

      console.log('[SIGN] Signature document created:', signatureId);

      // Phase 3.3: Copy signature to other participants' collections
      const otherParticipants = participants.filter((p: string) => p !== userId);
      console.log('[SIGN] Copying signature to', otherParticipants.length, 'other participants');

      if (otherParticipants.length > 0) {
        // Check if this is a direct (1-on-1) conversation
        const isDirect = participants.length === 2;

        if (isDirect) {
          // Copy signature to the other participant
          for (const participantId of otherParticipants) {
            await db
              .collection('users')
              .doc(participantId)
              .collection('signatures')
              .doc(signatureId)
              .set(signatureDocData);
            console.log('[SIGN] Copied signature to participant:', participantId);
          }
        } else {
          // Group chat - log warning as per Phase 3 limitation
          console.warn('[SIGN] ⚠️ Group chat signature distribution not supported yet. Participants:', participants.length);
        }
      }

      // 9. Update message documents with signature reference (batch)
      const batch = db.batch();

      payload.messages.forEach((msg: any) => {
        const msgRef = db
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .doc(msg.messageId);

        console.log('[SIGN] Adding signature reference to message:', msg.messageId);

        // Note: Using set with merge to avoid issues if message doesn't have these fields yet
        batch.set(
          msgRef,
          {
            signatureIds: [signatureId], // Array of signature IDs
            signatureCount: 1,
          },
          { merge: true }
        );
      });

      await batch.commit();
      console.log('[SIGN] ✓ Message documents updated with signature reference. Updated', payload.messages.length, 'messages');

      const totalTime = Date.now() - startTime;
      console.log('[SIGN] ✓ Signing completed successfully. Total time:', totalTime, 'ms');

      return {
        success: true,
        signatureId,
        pgpSignature: signature,
        timings: {
          signing: signTime,
          total: totalTime,
        },
      };
    } catch (error: any) {
      console.error('[SIGN] Error signing messages:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Signing error: ${error.message}`);
    }
  }
);

/**
 * V2 Phase 4: Verify a signature
 * Allows users to manually verify signatures from the app
 */
export const verifySignature = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 30,
    invoker: 'public',
    cors: [
      'http://localhost:8081',
      'http://localhost:19006',
      /\.exp\.direct$/,
      /\.expo\.dev$/,
    ],
  },
  async (request) => {
    const startTime = Date.now();
    const userId = request.auth?.uid || 'shell-test-user';
    const { signatureId } = request.data;

    console.log('[VERIFY] Verifying signature:', signatureId, 'for user:', userId);

    // 1. Validate input
    if (!signatureId) {
      throw new HttpsError('invalid-argument', 'Missing signatureId');
    }

    try {
      // 2. Fetch signature document
      const sigDoc = await db
        .collection('users')
        .doc(userId)
        .collection('signatures')
        .doc(signatureId)
        .get();

      if (!sigDoc.exists) {
        throw new HttpsError('not-found', 'Signature not found');
      }

      const signature = sigDoc.data();
      if (!signature) {
        throw new HttpsError('not-found', 'Signature data missing');
      }

      console.log('[VERIFY] Found signature, signer:', signature.signedPayload?.signerId);

      // 3. Fetch signer's public key
      const signerEmail = signature.signedPayload.signerId;

      const userQuery = await db
        .collection('users')
        .where('email', '==', signerEmail)
        .limit(1)
        .get();

      if (userQuery.empty) {
        throw new HttpsError('not-found', 'Signer not found: ' + signerEmail);
      }

      const signerData = userQuery.docs[0].data();
      const publicKey = signerData.publicKey;

      if (!publicKey) {
        throw new HttpsError('failed-precondition', 'Signer has no public key');
      }

      console.log('[VERIFY] Fetched signer public key');

      // 4. Verify signature using OpenPGP
      const startVerify = Date.now();
      const payloadText = JSON.stringify(signature.signedPayload, null, 2);

      console.log('[VERIFY] Payload size:', payloadText.length, 'bytes');
      console.log('[VERIFY] Verifying with OpenPGP...');

      const message = await openpgp.readMessage({
        armoredMessage: signature.pgpSignature,
      });

      const publicKeyObj = await openpgp.readKey({
        armoredKey: publicKey,
      });

      const verificationResult = await openpgp.verify({
        message,
        verificationKeys: publicKeyObj,
      });

      const verified = await verificationResult.signatures[0].verified;
      const verifyTime = Date.now() - startVerify;

      console.log('[VERIFY] Verification result:', verified);
      console.log('[VERIFY] Verification took:', verifyTime, 'ms');

      // 5. Update verification status in Firestore
      await sigDoc.ref.update({
        verified,
        verifiedAt: new Date(),
        verifiedBy: userId,
      });

      console.log('[VERIFY] ✓ Verification status updated in Firestore');

      const totalTime = Date.now() - startTime;
      console.log('[VERIFY] ✓ Verification completed. Total time:', totalTime, 'ms');

      return {
        success: true,
        verified,
        signatureId,
        verifiedAt: new Date().toISOString(),
        timings: {
          verification: verifyTime,
          total: totalTime,
        },
      };
    } catch (error: any) {
      console.error('[VERIFY] Error:', error);

      // Try to update signature with error
      try {
        await db
          .collection('users')
          .doc(userId)
          .collection('signatures')
          .doc(signatureId)
          .update({
            verified: false,
            verifiedAt: new Date(),
            verificationError: error.message,
          });
      } catch (updateError) {
        console.error('[VERIFY] Failed to update error status:', updateError);
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Verification failed: ${error.message}`);
    }
  }
);

/**
 * Generate a random nonce for replay protection
 */
function generateNonce(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

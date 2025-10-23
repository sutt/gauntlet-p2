import { getFirestore } from 'firebase-admin/firestore';

/**
 * Retrieve recent messages from a conversation for context
 *
 * @param conversationId - The conversation ID
 * @param messageCount - Number of recent messages to fetch (default: 5)
 * @returns Array of message strings in chronological order
 */
export async function getConversationContext(
  conversationId: string,
  messageCount: number = 5
): Promise<string[]> {
  const db = getFirestore();

  try {
    const messagesRef = db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(messageCount);

    const snapshot = await messagesRef.get();

    if (snapshot.empty) {
      return [];
    }

    // Return messages in chronological order (oldest first)
    return snapshot.docs
      .reverse()
      .map((doc) => {
        const data = doc.data();
        // Format: "SenderName: message text"
        return `${data.senderName || 'Unknown'}: ${data.text}`;
      });
  } catch (error) {
    console.error('Error fetching conversation context:', error);
    return [];
  }
}

/**
 * Get participant names from conversation
 *
 * @param conversationId - The conversation ID
 * @returns Array of participant display names
 */
export async function getParticipantNames(
  conversationId: string
): Promise<string[]> {
  const db = getFirestore();

  try {
    const convDoc = await db.collection('conversations').doc(conversationId).get();

    if (!convDoc.exists) {
      return [];
    }

    const participantIds = convDoc.data()?.participants || [];

    // Fetch user names
    const userPromises = participantIds.map((userId: string) =>
      db.collection('users').doc(userId).get()
    );

    const userDocs = await Promise.all(userPromises);

    return userDocs
      .filter((doc) => doc.exists)
      .map((doc) => doc.data()?.displayName || 'Unknown');
  } catch (error) {
    console.error('Error fetching participant names:', error);
    return [];
  }
}

/**
 * Get sender name from user ID
 *
 * @param userId - The user ID
 * @returns Display name of the user
 */
export async function getSenderName(userId: string): Promise<string> {
  const db = getFirestore();

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data()?.displayName || 'Unknown' : 'Unknown';
  } catch (error) {
    console.error('Error fetching sender name:', error);
    return 'Unknown';
  }
}

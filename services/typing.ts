import { ref, set, onValue, off, DatabaseReference } from 'firebase/database';
import { database } from '@/config/firebase';

/**
 * V1: Typing Indicator Service
 * Uses Firebase Realtime Database for real-time typing indicators
 *
 * Structure in RTDB:
 * /typing/{conversationId}/{userId} = timestamp | null
 */

export interface TypingUser {
  userId: string;
  timestamp: number;
}

/**
 * Set user typing state in a conversation
 *
 * @param conversationId - The conversation ID
 * @param userId - The user ID who is typing
 * @param isTyping - True to set typing, false to clear
 */
export const setTypingState = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  try {
    const typingRef = ref(database, `typing/${conversationId}/${userId}`);

    if (isTyping) {
      // Set timestamp when user starts typing
      await set(typingRef, Date.now());
    } else {
      // Remove entry when user stops typing
      await set(typingRef, null);
    }
  } catch (error) {
    console.error('Error setting typing state:', error);
    // Fail silently - typing indicators are not critical
  }
};

/**
 * Subscribe to typing state changes in a conversation
 * Returns a cleanup function to unsubscribe
 *
 * @param conversationId - The conversation ID
 * @param callback - Called with array of users currently typing
 * @returns Cleanup function to unsubscribe
 */
export const subscribeToTypingState = (
  conversationId: string,
  callback: (typingUsers: TypingUser[]) => void
): (() => void) => {
  const typingRef = ref(database, `typing/${conversationId}`);

  const handleValue = (snapshot: any) => {
    const data = snapshot.val();

    if (!data) {
      callback([]);
      return;
    }

    // Convert to array of typing users
    const typingUsers: TypingUser[] = [];
    const now = Date.now();
    const TYPING_TIMEOUT = 5000; // 5 seconds timeout

    Object.keys(data).forEach((userId) => {
      const timestamp = data[userId];

      // Only include if timestamp is recent (within 5 seconds)
      if (timestamp && (now - timestamp) < TYPING_TIMEOUT) {
        typingUsers.push({ userId, timestamp });
      }
    });

    callback(typingUsers);
  };

  // Subscribe to value changes
  onValue(typingRef, handleValue);

  // Return cleanup function
  return () => {
    off(typingRef, 'value', handleValue);
  };
};

/**
 * Clear typing state for a user (call when user leaves chat)
 *
 * @param conversationId - The conversation ID
 * @param userId - The user ID
 */
export const clearTypingState = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  await setTypingState(conversationId, userId, false);
};

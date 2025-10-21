import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Message } from '@/types/chat';

/**
 * Convert Firestore timestamp to Date
 */
const timestampToDate = (timestamp: any): Date => {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date();
};

/**
 * Convert Firestore readBy map to Record<string, Date>
 * MILESTONE 9: Parse readBy field with timestamps
 */
const convertReadBy = (readByData: any): Record<string, Date> | undefined => {
  if (!readByData || typeof readByData !== 'object') {
    return undefined;
  }

  const readBy: Record<string, Date> = {};
  Object.keys(readByData).forEach((userId) => {
    readBy[userId] = timestampToDate(readByData[userId]);
  });

  return readBy;
};

/**
 * Convert Firestore document to Message object
 */
const convertDocToMessage = (doc: any): Message => {
  const data = doc.data();
  return {
    id: doc.id,
    text: data.text,
    senderId: data.senderId,
    senderName: data.senderName || 'Unknown',
    timestamp: timestampToDate(data.timestamp),
    conversationId: data.conversationId,
    // Milestone 9: Read receipts
    readBy: convertReadBy(data.readBy),
  };
};

/**
 * Send a message to a conversation
 * MANUAL: Ensure Firestore security rules allow authenticated users to write to conversations/{conversationId}/messages
 */
export const sendMessage = async (
  conversationId: string,
  text: string,
  userId: string,
  userName: string = 'Unknown'
): Promise<string> => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageData = {
      conversationId,
      senderId: userId,
      senderName: userName,
      text,
      timestamp: Timestamp.now(),
      // Milestone 9: Mark as read by sender immediately
      readBy: {
        [userId]: Timestamp.now(),
      },
    };

    const batch = writeBatch(db);

    // Add message
    const messageRef = doc(messagesRef);
    batch.set(messageRef, messageData);

    // Milestone 5: Update conversation metadata for last message preview
    const convRef = doc(db, 'conversations', conversationId);
    batch.set(
      convRef,
      {
        lastMessage: text.substring(0, 100),
        lastMessageTime: Timestamp.now(),
        lastMessageSenderId: userId,
      },
      { merge: true }
    );

    await batch.commit();
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Subscribe to messages in a conversation (real-time updates)
 * MANUAL: Ensure Firestore security rules allow authenticated users to read conversations/{conversationId}/messages
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void,
  messageLimit: number = 50
): (() => void) => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(messageLimit)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const messages = querySnapshot.docs
          .map(convertDocToMessage)
          .reverse(); // Oldest first for display
        callback(messages);
      },
      (error) => {
        console.error('Error in messages subscription:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up subscription:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return () => {};
  }
};

/**
 * MILESTONE 9: Mark messages as read
 * Adds current user to the readBy map for each message
 * MANUAL: Ensure Firestore security rules allow users to update readBy field
 */
export const markMessagesAsRead = async (
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> => {
  try {
    if (messageIds.length === 0) {
      return; // Nothing to mark
    }

    const batch = writeBatch(db);

    // Update each message to add user to readBy map
    messageIds.forEach((messageId) => {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      batch.update(messageRef, {
        [`readBy.${userId}`]: Timestamp.now(),
      });
    });

    await batch.commit();
    console.log(`Marked ${messageIds.length} messages as read for user ${userId}`);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

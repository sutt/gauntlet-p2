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
    };

    const batch = writeBatch(db);

    // Add message
    const messageRef = doc(messagesRef);
    batch.set(messageRef, messageData);

    // Update conversation metadata (we'll add this in Milestone 5)
    // For now, just send the message
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

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
  getDoc,
  increment,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
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
    text: data.text || '',
    senderId: data.senderId,
    senderName: data.senderName || 'Unknown',
    timestamp: timestampToDate(data.timestamp),
    conversationId: data.conversationId,
    // Milestone 9: Read receipts
    readBy: convertReadBy(data.readBy),
    // V1: Image support
    mediaType: data.mediaType,
    mediaUrl: data.mediaUrl,
    mediaPath: data.mediaPath,
    mediaMetadata: data.mediaMetadata,
  };
};

/**
 * V1: Message data interface (supports both text and image messages)
 */
export interface SendMessageData {
  text?: string; // Optional when image is present
  mediaUrl?: string;
  mediaPath?: string;
  mediaMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
  };
}

/**
 * Send a message to a conversation
 * V1: Now supports both text and image messages
 * MANUAL: Ensure Firestore security rules allow authenticated users to write to conversations/{conversationId}/messages
 */
export const sendMessage = async (
  conversationId: string,
  messageData: SendMessageData,
  userId: string,
  userName: string = 'Unknown'
): Promise<string> => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const firestoreMessageData: any = {
      conversationId,
      senderId: userId,
      senderName: userName,
      text: messageData.text || '',
      timestamp: Timestamp.now(),
      // Milestone 9: Mark as read by sender immediately
      readBy: {
        [userId]: Timestamp.now(),
      },
    };

    // V1: Add image data if present
    if (messageData.mediaUrl) {
      firestoreMessageData.mediaType = 'image';
      firestoreMessageData.mediaUrl = messageData.mediaUrl;
      firestoreMessageData.mediaPath = messageData.mediaPath;
      firestoreMessageData.mediaMetadata = messageData.mediaMetadata;
    }

    const batch = writeBatch(db);

    // Add message
    const messageRef = doc(messagesRef);
    batch.set(messageRef, firestoreMessageData);

    // Milestone 5: Update conversation metadata for last message preview
    // Milestone 11: Increment unread count for all participants except sender
    const convRef = doc(db, 'conversations', conversationId);

    // First, get the conversation to find all participants
    const convSnap = await getDoc(convRef);
    const participants = convSnap.exists() ? (convSnap.data().participants || []) : [];

    // Build the update object to increment unread count for all participants except sender
    const unreadUpdates: Record<string, any> = {};
    participants.forEach((participantId: string) => {
      if (participantId !== userId) {
        unreadUpdates[`unreadCount.${participantId}`] = increment(1);
      }
    });

    console.log(`📨 Sending message - Participants:`, participants, `Unread updates:`, Object.keys(unreadUpdates));

    // Determine last message preview
    let lastMessagePreview: string;
    if (messageData.mediaUrl) {
      lastMessagePreview = messageData.text ? `📷 ${messageData.text}` : '📷 Photo';
    } else {
      lastMessagePreview = (messageData.text || '').substring(0, 100);
    }

    // Use update() instead of set() to properly handle nested field paths
    batch.update(convRef, {
      lastMessage: lastMessagePreview,
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: userId,
      ...unreadUpdates,
    });

    await batch.commit();
    console.log(`✅ Sent message and incremented unread count for ${participants.length - 1} participants`);
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Subscribe to messages in a conversation (real-time updates)
 * MILESTONE 12: Enhanced to return last snapshot for pagination
 * MANUAL: Ensure Firestore security rules allow authenticated users to read conversations/{conversationId}/messages
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[], lastSnapshot: QueryDocumentSnapshot | null) => void,
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

        // Get the last document snapshot for pagination
        const lastSnapshot = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

        callback(messages, lastSnapshot);
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
 * MILESTONE 11: Reset unread count to 0 for current user
 * MANUAL: Ensure Firestore security rules allow users to update readBy field and conversation unreadCount
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

    // Milestone 11: Reset unread count to 0 for this user
    const convRef = doc(db, 'conversations', conversationId);
    batch.update(convRef, {
      [`unreadCount.${userId}`]: 0,
    });

    await batch.commit();
    console.log(`Marked ${messageIds.length} messages as read and reset unread count for user ${userId}`);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

/**
 * MILESTONE 12: Load more messages with pagination
 * Loads older messages using cursor-based pagination
 * MANUAL: Ensure Firestore security rules allow authenticated users to read conversations/{conversationId}/messages
 *
 * @param conversationId - The conversation ID
 * @param lastMessageSnapshot - The last message document snapshot from previous load
 * @param limitCount - Number of messages to load (default: 50)
 * @returns Array of older messages and the new last message snapshot for next pagination
 */
export const loadMoreMessages = async (
  conversationId: string,
  lastMessageSnapshot: QueryDocumentSnapshot | null,
  limitCount: number = 50
): Promise<{ messages: Message[]; lastSnapshot: QueryDocumentSnapshot | null }> => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Build query with cursor pagination
    let q;
    if (lastMessageSnapshot) {
      q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastMessageSnapshot),
        limit(limitCount)
      );
    } else {
      // Initial load - just get the first batch
      q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('No more messages to load');
      return { messages: [], lastSnapshot: null };
    }

    const messages = snapshot.docs
      .map(convertDocToMessage)
      .reverse(); // Reverse to show oldest first

    const newLastSnapshot = snapshot.docs[snapshot.docs.length - 1] || null;

    console.log(`Loaded ${messages.length} older messages`);
    return { messages, lastSnapshot: newLastSnapshot };
  } catch (error) {
    console.error('Error loading more messages:', error);
    throw error;
  }
};

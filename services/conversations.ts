import {
  collection,
  doc,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Conversation } from '@/types/chat';

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
 * Convert Firestore document to Conversation object
 */
const convertDocToConversation = (doc: any): Conversation => {
  const data = doc.data();
  return {
    id: doc.id,
    participants: data.participants || [],
  };
};

/**
 * Create a new conversation
 * MANUAL: Ensure Firestore security rules allow authenticated users to create conversations
 * The conversation must include the creator's user ID in the participants array
 */
export const createConversation = async (
  participants: string[],
  creatorId: string
): Promise<string> => {
  try {
    // Ensure creator is in participants
    const uniqueParticipants = Array.from(new Set([...participants, creatorId]));

    // Require at least 2 participants (creator + at least one other)
    if (uniqueParticipants.length < 2) {
      throw new Error('A conversation requires at least 2 participants');
    }

    const conversationData = {
      participants: uniqueParticipants,
      lastMessage: '',
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: '',
      createdAt: Timestamp.now(),
      createdBy: creatorId,
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

/**
 * Find existing direct conversation between two users
 * Useful to prevent duplicate conversations
 */
export const findDirectConversation = async (
  user1Id: string,
  user2Id: string
): Promise<Conversation | null> => {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user1Id)
    );

    const snapshot = await getDocs(q);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const participants = data.participants || [];

      // Check if this is a 1-on-1 conversation with exactly these two users
      if (
        participants.length === 2 &&
        participants.includes(user1Id) &&
        participants.includes(user2Id)
      ) {
        return convertDocToConversation(doc);
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding direct conversation:', error);
    return null;
  }
};

/**
 * Subscribe to user's conversations (real-time updates)
 * MANUAL: Ensure Firestore security rules allow authenticated users to read their conversations
 * Users can only read conversations where they are in the participants array
 */
export const subscribeToConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const conversations = snapshot.docs.map(convertDocToConversation);
        callback(conversations);
      },
      (error) => {
        console.error('Error in conversations subscription:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up conversations subscription:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return () => {};
  }
};

/**
 * Get a single conversation by ID
 */
export const getConversation = async (
  conversationId: string
): Promise<Conversation | null> => {
  try {
    const docRef = doc(db, 'conversations', conversationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return convertDocToConversation(docSnap);
    }

    return null;
  } catch (error) {
    console.error('Error getting conversation:', error);
    return null;
  }
};

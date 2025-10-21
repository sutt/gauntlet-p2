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
import { Conversation, ConversationType } from '@/types/chat';
import { getUsers } from './users';

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
 * Milestone 5: Added last message fields
 * Milestone 10: Added type and groupName fields
 * Milestone 11: Added unreadCount field
 */
const convertDocToConversation = (doc: any): Conversation => {
  const data = doc.data();
  return {
    id: doc.id,
    participants: data.participants || [],
    type: data.type || undefined,
    groupName: data.groupName || undefined,
    lastMessage: data.lastMessage || undefined,
    lastMessageTime: data.lastMessageTime ? timestampToDate(data.lastMessageTime) : undefined,
    lastMessageSenderId: data.lastMessageSenderId || undefined,
    createdAt: data.createdAt ? timestampToDate(data.createdAt) : undefined,
    createdBy: data.createdBy || undefined,
    // Milestone 11: Unread counts
    unreadCount: data.unreadCount || {},
  };
};

/**
 * Generate a group name from participant display names
 * Milestone 10: Auto-generate group names like "Alice, Bob, Charlie"
 */
const generateGroupName = async (participantIds: string[]): Promise<string> => {
  try {
    const users = await getUsers(participantIds);

    if (users.length === 0) {
      return 'New Group';
    }

    // Show first 3 names, then "+ X more" if there are more
    const displayNames = users.slice(0, 3).map(u => u.displayName);
    const remainingCount = users.length - 3;

    let groupName = displayNames.join(', ');
    if (remainingCount > 0) {
      groupName += ` +${remainingCount} more`;
    }

    return groupName;
  } catch (error) {
    console.error('Error generating group name:', error);
    return 'New Group';
  }
};

/**
 * Create a new conversation
 * MANUAL: Ensure Firestore security rules allow authenticated users to create conversations
 * The conversation must include the creator's user ID in the participants array
 *
 * Milestone 10: Now supports both direct and group conversations with auto-generated names
 */
export const createConversation = async (
  participants: string[],
  creatorId: string,
  type?: ConversationType,
  customGroupName?: string
): Promise<string> => {
  try {
    // Ensure creator is in participants
    const uniqueParticipants = Array.from(new Set([...participants, creatorId]));

    // Require at least 2 participants (creator + at least one other)
    if (uniqueParticipants.length < 2) {
      throw new Error('A conversation requires at least 2 participants');
    }

    // Determine conversation type based on participant count if not specified
    const conversationType: ConversationType = type || (uniqueParticipants.length === 2 ? 'direct' : 'group');

    // Generate group name if needed (for groups and no custom name provided)
    let groupName: string | undefined;
    if (conversationType === 'group') {
      groupName = customGroupName || await generateGroupName(uniqueParticipants);
    }

    const conversationData: any = {
      participants: uniqueParticipants,
      type: conversationType,
      lastMessage: '',
      lastMessageTime: Timestamp.now(),
      lastMessageSenderId: '',
      createdAt: Timestamp.now(),
      createdBy: creatorId,
      // Milestone 11: Initialize unreadCount to 0 for all participants
      unreadCount: Object.fromEntries(uniqueParticipants.map(id => [id, 0])),
    };

    // Only include groupName if it's defined (for group chats)
    if (groupName) {
      conversationData.groupName = groupName;
    }

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    console.log(`Created ${conversationType} conversation:`, docRef.id, groupName ? `(${groupName})` : '');
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

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User } from '@/types/chat';

// MANUAL: Ensure Firestore security rules allow:
//   - All authenticated users can READ users/{userId}
//   - Users can only CREATE/UPDATE their own user document
// See firestore.rules for the complete rules configuration
const USERS_COLLECTION = 'users';

/**
 * Create user profile after signup
 *
 * @param userId - Firebase Auth UID
 * @param email - User's email
 * @param displayName - User's display name (defaults to email prefix if empty)
 */
export const createUserProfile = async (
  userId: string,
  email: string,
  displayName?: string
): Promise<void> => {
  // Default to email prefix if no display name provided
  const name = displayName || email.split('@')[0];

  const userRef = doc(db, USERS_COLLECTION, userId);
  const userData = {
    id: userId,
    email,
    displayName: name,
    createdAt: Timestamp.now(),
    lastSeen: Timestamp.now(),
    online: true,
  };

  await setDoc(userRef, userData);
};

/**
 * Get user by ID
 *
 * @param userId - Firebase Auth UID
 * @returns User document or null if not found
 */
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      id: userSnap.id,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastSeen: data.lastSeen?.toDate() || new Date(),
      online: data.online || false,
      pushTokens: data.pushTokens,
      // V1: Profile image fields
      profileImageUrl: data.profileImageUrl,
      profileImagePath: data.profileImagePath,
      profileImageUpdatedAt: data.profileImageUpdatedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Get multiple users by IDs
 *
 * @param userIds - Array of Firebase Auth UIDs
 * @returns Array of User documents
 */
export const getUsers = async (userIds: string[]): Promise<User[]> => {
  const users: User[] = [];

  // Fetch each user individually
  // For better performance with large batches, consider using a batch query
  for (const userId of userIds) {
    const user = await getUser(userId);
    if (user) {
      users.push(user);
    }
  }

  return users;
};

/**
 * Find user by email (for creating new chats)
 *
 * @param email - User's email address
 * @returns User document or null if not found
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      id: doc.id,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastSeen: data.lastSeen?.toDate() || new Date(),
      online: data.online || false,
      pushTokens: data.pushTokens,
      // V1: Profile image fields
      profileImageUrl: data.profileImageUrl,
      profileImagePath: data.profileImagePath,
      profileImageUpdatedAt: data.profileImageUpdatedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};

/**
 * Update user's last seen timestamp
 * Called periodically while app is active for presence tracking
 *
 * @param userId - Firebase Auth UID
 */
export const updateLastSeen = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      lastSeen: Timestamp.now(),
      online: true,
    });
  } catch (error) {
    console.error('Error updating last seen:', error);
  }
};

/**
 * Get all users
 * V1: Used for People tab to show all registered users
 *
 * @returns Array of all User documents
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('displayName', '!=', null) // Only users with display names
    );

    const snapshot = await getDocs(q);

    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastSeen: data.lastSeen?.toDate() || new Date(),
        online: data.online || false,
        pushTokens: data.pushTokens,
        profileImageUrl: data.profileImageUrl,
        profileImagePath: data.profileImagePath,
        profileImageUpdatedAt: data.profileImageUpdatedAt?.toDate(),
      };
    });

    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
};

/**
 * Update user profile fields
 * V1: Now supports profile image fields
 *
 * @param userId - Firebase Auth UID
 * @param updates - Partial user data to update
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<Pick<User, 'displayName' | 'pushTokens' | 'profileImageUrl' | 'profileImagePath'>>
): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const updateData: any = { ...updates };

    // V1: Add profileImageUpdatedAt if updating profile image
    if (updates.profileImageUrl) {
      updateData.profileImageUpdatedAt = Timestamp.now();
    }

    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

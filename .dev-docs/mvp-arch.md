# MVP Architecture - Chat Application

## Overview

This document defines the lean, focused architecture to implement the MVP requirements while keeping the existing infrastructure stable. The approach is to extend the current todo app patterns to support real-time chat with minimal architectural changes.

## Design Principles

1. **Extend, Don't Replace**: Build on existing auth, routing, and Firestore patterns
2. **Firestore-First**: Leverage Firestore's real-time capabilities, no custom backend yet
3. **Simple State**: Use React Context for global state, avoid heavy state management libraries initially
4. **Type-Safe**: Comprehensive TypeScript types from the start
5. **Secure by Default**: Implement Firestore Security Rules before any chat features

---

## Data Model

### Firestore Collections Schema

```typescript
// Collection: users/{userId}
interface UserDocument {
  id: string;                    // Firebase Auth UID
  email: string;                 // From Firebase Auth
  displayName: string;           // User-set name
  createdAt: Timestamp;
  lastSeen: Timestamp;           // For online/offline status
  online: boolean;               // Computed: lastSeen < 2 minutes ago
  pushTokens?: string[];         // For future push notifications
}

// Collection: conversations/{conversationId}
interface ConversationDocument {
  id: string;                    // Auto-generated
  participants: string[];        // Array of user IDs
  type: 'direct' | 'group';      // Conversation type
  lastMessage: string;           // Preview text
  lastMessageTime: Timestamp;    // For sorting
  lastMessageSenderId: string;   // Who sent last message
  createdAt: Timestamp;
  createdBy: string;             // User ID of creator

  // For group chats only
  groupName?: string;            // Auto-generated: "User1, User2, User3"

  // Unread tracking (map of userId -> count)
  unreadCount: {
    [userId: string]: number;
  };
}

// Subcollection: conversations/{conversationId}/messages/{messageId}
interface MessageDocument {
  id: string;                    // Auto-generated
  conversationId: string;        // Parent conversation
  senderId: string;              // User ID of sender
  senderName: string;            // Display name (denormalized for perf)
  text: string;                  // Message content
  timestamp: Timestamp;          // When sent

  // Read receipts
  readBy: {
    [userId: string]: Timestamp; // userId -> when they read it
  };

  // For optimistic UI
  status?: 'sending' | 'sent';   // Client-only field, not in Firestore
  tempId?: string;               // Client-only field for pending messages
}
```

### Key Design Decisions

**Why subcollections for messages?**
- Efficient querying (only load messages for specific conversation)
- Automatic cleanup with conversation deletion (future)
- Scales to millions of messages per conversation

**Why denormalize senderName?**
- Avoid joins/lookups when rendering messages
- Accept slight staleness if user changes display name
- Trade-off: Extra storage for faster reads

**Why unreadCount map in conversation?**
- Fast "unread badge" rendering without counting messages
- Single document read instead of aggregation query
- Updated via transaction when marking messages as read

**Why simple online boolean + lastSeen?**
- No need for Firebase Realtime Database for MVP
- Client updates `lastSeen` every 30 seconds while active
- "Online" computed as `lastSeen < 2 minutes ago`
- Good enough for MVP, can enhance later

---

## Firestore Security Rules

**Priority**: Implement BEFORE any chat features

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Helper function: Check if user is participant in conversation
    function isParticipant(conversationId) {
      return request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    }

    // Users collection: Users can read all users (for search/display names)
    // but can only write their own document
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if false; // No deletion for MVP
    }

    // Conversations: Users can only read conversations they're part of
    match /conversations/{conversationId} {
      allow read: if isSignedIn() && request.auth.uid in resource.data.participants;
      allow create: if isSignedIn()
                    && request.auth.uid in request.resource.data.participants
                    && request.resource.data.participants.size() >= 2; // Minimum 2 users
      allow update: if isSignedIn() && request.auth.uid in resource.data.participants;
      allow delete: if false; // No deletion for MVP

      // Messages subcollection
      match /messages/{messageId} {
        // Can read if you're in the parent conversation
        allow read: if isSignedIn() && isParticipant(conversationId);

        // Can create if you're in conversation AND you're the sender
        allow create: if isSignedIn()
                      && isParticipant(conversationId)
                      && request.auth.uid == request.resource.data.senderId;

        // Can update only to add yourself to readBy map
        allow update: if isSignedIn()
                      && isParticipant(conversationId)
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readBy'])
                      && request.auth.uid in request.resource.data.readBy;

        allow delete: if false; // No deletion for MVP
      }
    }
  }
}
```

**Testing Security Rules**:
- Use Firebase Emulator Suite for local testing
- Write unit tests for security rules (see Testing section)

---

## TypeScript Types

Create comprehensive types before implementation.

**File**: `types/chat.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

// User types
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastSeen: Date;
  online: boolean;
  pushTokens?: string[];
}

export interface UserInput {
  displayName: string;
}

// Conversation types
export type ConversationType = 'direct' | 'group';

export interface Conversation {
  id: string;
  participants: string[];
  participantDetails?: User[]; // Populated client-side for display
  type: ConversationType;
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageSenderId: string;
  createdAt: Date;
  createdBy: string;
  groupName?: string;
  unreadCount: Record<string, number>;
}

export interface ConversationInput {
  participants: string[]; // User IDs
  type: ConversationType;
  groupName?: string;
}

// Message types
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  readBy: Record<string, Date>;

  // Client-only fields (not in Firestore)
  status?: MessageStatus;
  tempId?: string;
}

export interface MessageInput {
  conversationId: string;
  text: string;
}

// UI-specific types
export interface ConversationPreview extends Conversation {
  unreadCountForCurrentUser: number;
  otherUser?: User; // For direct chats
}

// API result types
export interface ChatResult {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}
```

**Firestore Converters** (for type safety):

```typescript
// types/converters.ts
import {
  FirestoreDataConverter,
  Timestamp
} from 'firebase/firestore';
import { User, Conversation, Message } from './chat';

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore: (user: User) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: Timestamp.fromDate(user.createdAt),
    lastSeen: Timestamp.fromDate(user.lastSeen),
    online: user.online,
    pushTokens: user.pushTokens || [],
  }),
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastSeen: data.lastSeen?.toDate() || new Date(),
      online: data.online || false,
      pushTokens: data.pushTokens,
    };
  },
};

// Similar converters for Conversation and Message...
```

---

## Project Structure (Additions)

```
/hello-expo
├── app/
│   ├── _layout.tsx                    # [EXISTING] Root layout
│   ├── login.tsx                      # [EXISTING] Login screen
│   ├── onboarding.tsx                 # [NEW] Display name setup
│   └── (tabs)/
│       ├── _layout.tsx                # [MODIFY] Update tabs
│       ├── index.tsx                  # [EXISTING] Home/explore
│       ├── chats.tsx                  # [NEW] Chat list screen
│       ├── profile.tsx                # [EXISTING] Profile/logout
│       └── todos.tsx                  # [KEEP] Keep for reference
│   └── chat/
│       └── [id].tsx                   # [NEW] Individual chat screen
│
├── components/
│   ├── [existing themed components]   # [KEEP] Use for consistency
│   └── chat/                          # [NEW] Chat-specific components
│       ├── conversation-list-item.tsx # Preview in chat list
│       ├── message-bubble.tsx         # Individual message
│       ├── message-input.tsx          # Text input with send button
│       ├── chat-header.tsx            # Chat screen header with status
│       ├── online-indicator.tsx       # Green dot for online status
│       ├── read-receipt.tsx           # Checkmark indicators
│       └── create-chat-modal.tsx      # Modal to start new chat
│
├── services/
│   ├── firestore.ts                   # [KEEP] Todo operations (reference)
│   ├── users.ts                       # [NEW] User CRUD operations
│   ├── conversations.ts               # [NEW] Conversation operations
│   ├── messages.ts                    # [NEW] Message operations
│   └── presence.ts                    # [NEW] Online/offline tracking
│
├── context/
│   ├── auth.tsx                       # [EXISTING] Auth context
│   ├── chat.tsx                       # [NEW] Global chat state
│   └── presence.tsx                   # [NEW] Presence tracking
│
├── hooks/
│   ├── [existing hooks]               # [KEEP] Theme hooks, etc.
│   ├── use-conversations.ts           # [NEW] Subscribe to chat list
│   ├── use-messages.ts                # [NEW] Subscribe to messages
│   ├── use-unread-count.ts            # [NEW] Total unread messages
│   └── use-user.ts                    # [NEW] Get user by ID
│
├── types/
│   ├── todo.ts                        # [KEEP] Existing
│   ├── chat.ts                        # [NEW] Chat types
│   └── converters.ts                  # [NEW] Firestore converters
│
├── utils/                             # [NEW] Helper functions
│   ├── date-format.ts                 # Format timestamps
│   ├── conversation-helpers.ts        # Get other user, group name
│   └── optimistic-updates.ts          # Generate temp IDs
│
└── config/
    ├── firebase.ts                    # [EXISTING] Firebase init
    └── firestore-rules.rules          # [NEW] Security rules file
```

---

## Service Layer Implementation

### 1. User Service (`services/users.ts`)

```typescript
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, UserInput } from '@/types/chat';
import { userConverter } from '@/types/converters';

const USERS_COLLECTION = 'users';

// Create user profile (called after signup)
export const createUserProfile = async (
  userId: string,
  email: string,
  displayName: string
): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, userId).withConverter(userConverter);
  await setDoc(userRef, {
    id: userId,
    email,
    displayName,
    createdAt: new Date(),
    lastSeen: new Date(),
    online: true,
  });
};

// Get user by ID
export const getUser = async (userId: string): Promise<User | null> => {
  const userRef = doc(db, USERS_COLLECTION, userId).withConverter(userConverter);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
};

// Get multiple users by IDs
export const getUsers = async (userIds: string[]): Promise<User[]> => {
  const users: User[] = [];
  for (const userId of userIds) {
    const user = await getUser(userId);
    if (user) users.push(user);
  }
  return users;
};

// Find user by email (for creating new chats)
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const q = query(
    collection(db, USERS_COLLECTION),
    where('email', '==', email)
  ).withConverter(userConverter);

  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].data();
};

// Update last seen timestamp (called every 30s while app is active)
export const updateLastSeen = async (userId: string): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userRef, {
    lastSeen: Timestamp.now(),
    online: true,
  });
};
```

### 2. Conversations Service (`services/conversations.ts`)

```typescript
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Conversation, ConversationInput } from '@/types/chat';
import { conversationConverter } from '@/types/converters';

const CONVERSATIONS_COLLECTION = 'conversations';

// Create new conversation
export const createConversation = async (
  input: ConversationInput,
  creatorId: string
): Promise<string> => {
  const conversationData = {
    participants: input.participants,
    type: input.type,
    lastMessage: '',
    lastMessageTime: Timestamp.now(),
    lastMessageSenderId: '',
    createdAt: Timestamp.now(),
    createdBy: creatorId,
    groupName: input.groupName,
    unreadCount: {},
  };

  const docRef = await addDoc(
    collection(db, CONVERSATIONS_COLLECTION),
    conversationData
  );

  return docRef.id;
};

// Find existing direct conversation between two users
export const findDirectConversation = async (
  user1Id: string,
  user2Id: string
): Promise<Conversation | null> => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('type', '==', 'direct'),
    where('participants', 'array-contains', user1Id)
  ).withConverter(conversationConverter);

  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs) {
    const conv = doc.data();
    if (conv.participants.includes(user2Id)) {
      return conv;
    }
  }

  return null;
};

// Subscribe to user's conversations
export const subscribeToConversations = (
  userId: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc')
  ).withConverter(conversationConverter);

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations = snapshot.docs.map(doc => doc.data());
      onUpdate(conversations);
    },
    onError
  );
};

// Get single conversation
export const getConversation = async (
  conversationId: string
): Promise<Conversation | null> => {
  const docRef = doc(db, CONVERSATIONS_COLLECTION, conversationId)
    .withConverter(conversationConverter);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};
```

### 3. Messages Service (`services/messages.ts`)

```typescript
import {
  collection,
  doc,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  updateDoc,
  increment,
  writeBatch,
  startAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Message, MessageInput } from '@/types/chat';
import { messageConverter } from '@/types/converters';

// Send message
export const sendMessage = async (
  input: MessageInput,
  senderId: string,
  senderName: string
): Promise<string> => {
  const messagesRef = collection(
    db,
    'conversations',
    input.conversationId,
    'messages'
  );

  const messageData = {
    conversationId: input.conversationId,
    senderId,
    senderName,
    text: input.text,
    timestamp: Timestamp.now(),
    readBy: { [senderId]: Timestamp.now() }, // Mark as read by sender
  };

  const batch = writeBatch(db);

  // Add message
  const messageRef = doc(messagesRef);
  batch.set(messageRef, messageData);

  // Update conversation metadata
  const convRef = doc(db, 'conversations', input.conversationId);
  batch.update(convRef, {
    lastMessage: input.text.substring(0, 100),
    lastMessageTime: Timestamp.now(),
    lastMessageSenderId: senderId,
  });

  await batch.commit();
  return messageRef.id;
};

// Subscribe to messages in conversation
export const subscribeToMessages = (
  conversationId: string,
  messageLimit: number = 50,
  onUpdate: (messages: Message[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'desc'),
    limit(messageLimit)
  ).withConverter(messageConverter);

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs
        .map(doc => doc.data())
        .reverse(); // Oldest first for display
      onUpdate(messages);
    },
    onError
  );
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  messageIds: string[],
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);

  messageIds.forEach(messageId => {
    const messageRef = doc(
      db,
      'conversations',
      conversationId,
      'messages',
      messageId
    );
    batch.update(messageRef, {
      [`readBy.${userId}`]: Timestamp.now(),
    });
  });

  // Reset unread count for this user
  const convRef = doc(db, 'conversations', conversationId);
  batch.update(convRef, {
    [`unreadCount.${userId}`]: 0,
  });

  await batch.commit();
};

// Load more messages (pagination)
export const loadMoreMessages = async (
  conversationId: string,
  lastMessage: Message,
  limitCount: number = 50
): Promise<Message[]> => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'desc'),
    startAfter(Timestamp.fromDate(lastMessage.timestamp)),
    limit(limitCount)
  ).withConverter(messageConverter);

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data()).reverse();
};
```

### 4. Presence Service (`services/presence.ts`)

```typescript
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AppState } from 'react-native';

let presenceInterval: NodeJS.Timeout | null = null;

// Start updating presence while app is active
export const startPresenceTracking = (userId: string): void => {
  // Update immediately
  updatePresence(userId);

  // Update every 30 seconds
  presenceInterval = setInterval(() => {
    if (AppState.currentState === 'active') {
      updatePresence(userId);
    }
  }, 30000);

  // Listen for app state changes
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      updatePresence(userId);
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      stopPresenceTracking(userId);
    }
  });
};

// Stop presence tracking
export const stopPresenceTracking = async (userId: string): Promise<void> => {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }

  // Update to offline
  await updatePresence(userId, false);
};

// Update presence timestamp
const updatePresence = async (userId: string, online: boolean = true): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastSeen: Timestamp.now(),
      online,
    });
  } catch (error) {
    console.error('Error updating presence:', error);
  }
};

// Compute if user is online (client-side helper)
export const isUserOnline = (lastSeen: Date): boolean => {
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
  return diffMinutes < 2; // Online if last seen < 2 minutes ago
};
```

---

## Context Providers (Global State)

### Chat Context (`context/chat.tsx`)

Simple global state for chat list and unread counts.

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Conversation } from '@/types/chat';
import { subscribeToConversations } from '@/services/conversations';
import { useAuth } from './auth';

interface ChatContextType {
  conversations: Conversation[];
  loading: boolean;
  totalUnreadCount: number;
}

const ChatContext = createContext<ChatContextType>({
  conversations: [],
  loading: true,
  totalUnreadCount: 0,
});

export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToConversations(
      user.uid,
      (convs) => {
        setConversations(convs);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to conversations:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  // Calculate total unread count
  const totalUnreadCount = conversations.reduce((total, conv) => {
    return total + (conv.unreadCount[user?.uid || ''] || 0);
  }, 0);

  return (
    <ChatContext.Provider value={{ conversations, loading, totalUnreadCount }}>
      {children}
    </ChatContext.Provider>
  );
}
```

### Presence Context (`context/presence.tsx`)

```typescript
import React, { createContext, useContext, useEffect } from 'react';
import { startPresenceTracking, stopPresenceTracking } from '@/services/presence';
import { useAuth } from './auth';

const PresenceContext = createContext({});

export const usePresence = () => useContext(PresenceContext);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    startPresenceTracking(user.uid);

    return () => {
      stopPresenceTracking(user.uid);
    };
  }, [user]);

  return (
    <PresenceContext.Provider value={{}}>
      {children}
    </PresenceContext.Provider>
  );
}
```

---

## Screens Implementation

### 1. Chat List Screen (`app/(tabs)/chats.tsx`)

**Purpose**: Show all conversations

**Key Features**:
- Real-time list via `useChat()` hook
- Unread badge on each conversation
- Online indicator for direct chats
- Pull to refresh
- Floating action button to create new chat

**Implementation Notes**:
- Use `FlatList` for performance
- Subscribe to conversations via context (already loaded)
- For each conversation, fetch participant user details
- Show loading state while initial load

### 2. Chat Screen (`app/chat/[id].tsx`)

**Purpose**: View and send messages in a conversation

**Key Features**:
- Real-time messages via `useMessages()` hook
- Optimistic UI for sending
- Auto-scroll to bottom on new message
- Mark messages as read when viewing
- Show online status in header
- Load more messages on scroll to top

**Implementation Notes**:
- Use `FlatList` inverted for chat UI
- Local state for pending messages (optimistic updates)
- Debounced "mark as read" when messages visible
- Generate temp ID for pending messages: `temp-${Date.now()}-${Math.random()}`

### 3. Onboarding Screen (`app/onboarding.tsx`)

**Purpose**: Collect display name after signup

**Key Features**:
- Simple form with single text input
- Validate display name (min 2 chars, max 50 chars)
- Create user document in Firestore
- Redirect to chat list after submission

**Implementation Notes**:
- Show immediately after signup if no user document exists
- Block access to app until display name is set

---

## Custom Hooks

### `use-conversations.ts`

```typescript
// Wrapper around ChatContext for convenience
export const useConversations = () => {
  const { conversations, loading } = useChat();
  return { conversations, loading };
};
```

### `use-messages.ts`

```typescript
import { useEffect, useState } from 'react';
import { Message } from '@/types/chat';
import { subscribeToMessages } from '@/services/messages';

export const useMessages = (conversationId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(
      conversationId,
      50,
      (msgs) => {
        setMessages(msgs);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to messages:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [conversationId]);

  return { messages, loading, setMessages };
};
```

### `use-user.ts`

```typescript
import { useEffect, useState } from 'react';
import { User } from '@/types/chat';
import { getUser } from '@/services/users';

export const useUser = (userId: string | null) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    getUser(userId)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading };
};
```

---

## Optimistic UI Pattern

**Goal**: Make sending messages feel instant

**Implementation**:

```typescript
// In chat screen component
const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
const { messages: serverMessages } = useMessages(conversationId);

// Combine server messages with pending messages
const allMessages = [...serverMessages, ...pendingMessages];

const handleSendMessage = async (text: string) => {
  // Generate temp ID
  const tempId = `temp-${Date.now()}-${Math.random()}`;

  // Create pending message
  const pendingMessage: Message = {
    id: tempId,
    conversationId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    text,
    timestamp: new Date(),
    readBy: {},
    status: 'sending',
    tempId,
  };

  // Add to pending messages immediately
  setPendingMessages(prev => [...prev, pendingMessage]);

  try {
    // Send to Firestore
    await sendMessage(
      { conversationId, text },
      currentUser.uid,
      currentUser.displayName
    );

    // Remove from pending (will appear in serverMessages)
    setPendingMessages(prev => prev.filter(m => m.tempId !== tempId));
  } catch (error) {
    // Mark as failed
    setPendingMessages(prev =>
      prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'failed' as MessageStatus } : m
      )
    );
  }
};
```

---

## UI Components

### Message Bubble (`components/chat/message-bubble.tsx`)

**Props**:
- `message: Message`
- `isOwnMessage: boolean`
- `showSenderName: boolean` (for group chats)

**Features**:
- Different styling for own vs. other messages
- Show sender name if group chat
- Show timestamp
- Show read receipt if own message
- Show "sending" indicator if pending

### Conversation List Item (`components/chat/conversation-list-item.tsx`)

**Props**:
- `conversation: Conversation`
- `currentUserId: string`

**Features**:
- Display other user's name (or group name)
- Last message preview
- Timestamp
- Unread badge
- Online indicator (for direct chats)

### Message Input (`components/chat/message-input.tsx`)

**Props**:
- `onSend: (text: string) => void`
- `disabled?: boolean`

**Features**:
- Text input that grows with content (max 4 lines)
- Send button (disabled when empty)
- Keyboard dismissal on send

---

## Routing Updates

### Update Tab Navigator (`app/(tabs)/_layout.tsx`)

**Changes**:
- Replace "todos" tab with "chats" tab
- Add unread badge to chats tab icon
- Keep: home, chats, profile

### Chat Screen Route (`app/chat/[id].tsx`)

**Route**: `/chat/:id`
- Parameter: `id` = conversationId
- Not in tab navigator (full screen)
- Back button returns to chat list

---

## Error Handling

### Network Errors
- Display toast/snackbar for failed operations
- Retry button for failed messages
- Offline indicator at top of screen

### Validation Errors
- Empty message validation (disable send button)
- Display name validation (min 2 chars)
- Invalid email when starting chat

### Auth Errors
- Redirect to login if session expires
- Show friendly error messages for auth failures

---

## Performance Optimizations

### Message Pagination
- Load 50 messages initially
- "Load More" button at top of chat
- Limit Firestore reads to reduce costs

### Conversation List
- Use `FlatList` with `keyExtractor`
- Memoize conversation list items
- Debounce search input if added

### Image/Avatar Optimization
- Use placeholder initials instead of photos for MVP
- If photos added later, use Expo Image with caching

---

## Testing Strategy

### Unit Tests
**Priority**: Service layer

- `services/users.ts` - CRUD operations
- `services/conversations.ts` - Query logic
- `services/messages.ts` - Send/read logic
- `utils/` - Date formatting, helpers

### Integration Tests
**Priority**: Firestore Security Rules

- Use Firebase Emulator Suite
- Test all security rule scenarios:
  - ✅ User can read own conversations
  - ❌ User cannot read other's conversations
  - ✅ User can send message to conversation they're in
  - ❌ User cannot send message to conversation they're not in

### E2E Tests (Optional for MVP)
**Priority**: Low (manual testing sufficient)

- Login flow
- Send message flow
- Create conversation flow

---

## Migration Plan

### Phase 1: Setup (Week 1)
1. Create Firestore Security Rules file
2. Deploy security rules to Firebase Console
3. Create all TypeScript types in `types/chat.ts`
4. Test security rules with Firebase Emulator

### Phase 2: Backend Services (Week 1-2)
5. Implement `services/users.ts`
6. Implement `services/conversations.ts`
7. Implement `services/messages.ts`
8. Implement `services/presence.ts`
9. Write unit tests for services

### Phase 3: Context & Hooks (Week 2)
10. Create `context/chat.tsx`
11. Create `context/presence.tsx`
12. Create custom hooks (`use-messages`, etc.)
13. Update `app/_layout.tsx` to wrap with new providers

### Phase 4: UI Components (Week 2-3)
14. Build `message-bubble.tsx`
15. Build `conversation-list-item.tsx`
16. Build `message-input.tsx`
17. Build `chat-header.tsx`
18. Build `online-indicator.tsx`
19. Build `read-receipt.tsx`

### Phase 5: Screens (Week 3-4)
20. Create `app/onboarding.tsx` (display name)
21. Create `app/(tabs)/chats.tsx` (chat list)
22. Create `app/chat/[id].tsx` (chat screen)
23. Update `app/(tabs)/_layout.tsx` (tab navigation)
24. Implement optimistic UI in chat screen

### Phase 6: Features (Week 4-5)
25. Implement online/offline status
26. Implement read receipts
27. Implement message pagination
28. Implement group chat UI
29. Add create chat modal

### Phase 7: Polish & Testing (Week 5-6)
30. Error handling and retry logic
31. Loading states and empty states
32. Foreground notifications (basic)
33. Manual testing on all platforms
34. Fix bugs and UX issues

---

## Dependencies to Add

```json
{
  "dependencies": {
    // Notifications (for foreground notifications)
    "expo-notifications": "~0.28.0",

    // Optional: Better list performance
    "@shopify/flash-list": "^1.6.0"
  }
}
```

Install:
```bash
npx expo install expo-notifications
npm install @shopify/flash-list
```

---

## Configuration Files

### Firebase Rules Deployment

Create `firestore.rules` in project root, then deploy:

```bash
firebase deploy --only firestore:rules
```

Or use Firebase Console to paste rules manually.

### Environment Variables

Already configured in `.env.local`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
# etc.
```

No additional environment variables needed for MVP.

---

## Potential Challenges & Solutions

### Challenge 1: Firestore Security Rules Complexity
**Solution**: Start with Firebase Emulator and write test cases before deploying

### Challenge 2: Real-time Listener Memory Leaks
**Solution**: Always unsubscribe in `useEffect` cleanup functions

### Challenge 3: Optimistic UI State Management
**Solution**: Keep pending messages in separate state array, merge with server messages

### Challenge 4: Online Status Accuracy
**Solution**: Accept "good enough" with 30s polling for MVP, enhance later with RTDB

### Challenge 5: Unread Count Synchronization
**Solution**: Use Firestore transactions when marking as read to ensure consistency

### Challenge 6: Group Chat Complexity
**Solution**: Reuse 95% of one-on-one chat code, just show sender names

---

## What We're NOT Changing

To keep implementation lean, these stay as-is:

✅ **Auth System**: No changes to `context/auth.tsx` or `app/login.tsx`
✅ **Theme System**: Reuse existing themed components
✅ **Navigation**: Keep Expo Router, just add new routes
✅ **Firebase Config**: No changes to `config/firebase.ts`
✅ **Todo App**: Keep `app/(tabs)/todos.tsx` as reference, can be removed later

---

## Success Criteria

### MVP is complete when:

1. ✅ User can set display name on signup
2. ✅ User sees list of conversations
3. ✅ User can create 1-on-1 chat by entering email
4. ✅ User can create group chat with 3+ users
5. ✅ User can send text message
6. ✅ Messages appear in real-time for all participants
7. ✅ Messages persist across app restarts
8. ✅ User sees online/offline status
9. ✅ User sees read receipts (checkmarks)
10. ✅ User sees timestamps on messages
11. ✅ Messages appear instantly (optimistic UI)
12. ✅ User receives foreground notifications
13. ✅ Firestore Security Rules prevent unauthorized access
14. ✅ Works on iOS, Android, and Web

### Performance Benchmarks:
- Chat list loads in < 1 second
- Sending message shows in UI < 100ms
- Real-time message delivery < 2 seconds
- No memory leaks during 10-minute conversation

---

## Next Steps After MVP

Once MVP is validated, consider these enhancements:

1. **Background Push Notifications**: Implement Cloud Functions + Expo Push Service
2. **Media Messages**: Add Firebase Storage for images/videos
3. **Message Search**: Integrate Algolia or build simple text search
4. **Profile Photos**: Add Firebase Storage + image upload
5. **Group Management**: Add/remove members, leave group
6. **Message Actions**: Edit, delete, forward, reply
7. **Typing Indicators**: Use Firebase Realtime Database
8. **Better Presence**: Switch to RTDB for accurate online status
9. **End-to-End Encryption**: Research E2EE libraries
10. **Analytics**: Add Firebase Analytics for usage tracking

---

## Conclusion

This architecture provides a clear path from the current todo app to a functional chat MVP. Key principles:

- **Minimal Changes**: Extend existing patterns rather than rewrite
- **Firestore-Centric**: Leverage Firebase's real-time and security features
- **Type-Safe**: Comprehensive TypeScript types from day one
- **Secure**: Security rules implemented before any features
- **Performant**: Pagination and optimistic UI for good UX
- **Maintainable**: Clear separation of concerns (services, hooks, components)

The implementation can be done in 5-6 weeks following the migration plan, delivering a working chat app that can be iteratively enhanced based on user feedback.

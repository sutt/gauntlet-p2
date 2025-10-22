# Existing Architecture Documentation

## Overview

This is an Expo-based React Native application with Firebase backend integration. The app currently implements a simple todo list feature with user authentication, demonstrating basic CRUD operations and real-time data synchronization.

## Technology Stack

### Frontend
- **Framework**: React Native 0.81.4 with React 19.1.0
- **Navigation**: Expo Router 6.0.11 with React Navigation
- **Platform Support**: iOS, Android, and Web (via react-native-web)
- **State Management**: React Context API (for auth state)
- **UI Components**: Custom themed components with dark/light mode support
- **Build Tool**: Expo ~54.0.13

### Backend
- **Backend-as-a-Service**: Firebase
  - **Authentication**: Firebase Auth (Email/Password)
  - **Database**: Cloud Firestore (NoSQL document database)
  - **Real-time**: Firestore real-time listeners (onSnapshot)
- **No custom backend server**: All backend logic runs through Firebase SDKs

### Key Dependencies
- `firebase`: v12.4.0 - Firebase SDK
- `@react-native-async-storage/async-storage`: v1.24.0 - Local persistence
- `expo-router`: File-based routing system
- `react-native-gesture-handler`, `react-native-reanimated`: Animation and gesture support

## Architecture Components

### 1. Project Structure

```
/hello-expo
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with auth protection
│   ├── login.tsx          # Login/signup screen
│   └── (tabs)/            # Tab-based navigation
│       ├── _layout.tsx    # Tab layout
│       ├── index.tsx      # Home screen
│       ├── todos.tsx      # Todo list screen
│       ├── explore.tsx    # Explore screen
│       └── profile.tsx    # Profile/logout screen
├── components/            # Reusable UI components
├── config/                # Configuration files
│   └── firebase.ts        # Firebase initialization
├── context/               # React Context providers
│   └── auth.tsx          # Authentication context
├── services/             # Business logic & API calls
│   └── firestore.ts      # Firestore CRUD operations
├── types/                # TypeScript type definitions
│   └── todo.ts          # Todo-related types
├── constants/            # App constants (theme, colors)
└── hooks/               # Custom React hooks
```

### 2. Authentication Flow

**Implementation**: `context/auth.tsx`, `app/login.tsx`, `app/_layout.tsx`

- **Provider**: `AuthProvider` wraps the entire app (app/_layout.tsx:56)
- **Auth State**: Managed via Firebase `onAuthStateChanged` listener (context/auth.tsx:22)
- **Persistence**: Firebase Auth automatically persists sessions using AsyncStorage
- **Route Protection**: `RootLayoutNav` component (app/_layout.tsx:16) checks auth state and redirects:
  - Unauthenticated users → `/login`
  - Authenticated users → `/(tabs)`
- **Methods**: Email/password sign-in and sign-up (app/login.tsx:27-53)

**How it works for developers**:
1. User opens app → `AuthProvider` initializes and checks Firebase Auth state
2. If no user session → Redirect to `/login`
3. User signs in/up → Firebase Auth creates session → Auto-redirect to main app
4. Auth state accessible via `useAuth()` hook anywhere in the app

### 3. Data Layer (Firestore)

**Implementation**: `services/firestore.ts`, `config/firebase.ts`

#### Firebase Configuration
- Environment variables stored in `.env.local` (config/firebase.ts:7-15)
- Single Firebase app instance initialized at startup
- Two services initialized: Auth and Firestore

#### Firestore Data Model
Current schema is very simple:

```
Collection: sample_todos
└── Document (auto-generated ID)
    ├── title: string
    ├── description: string
    ├── completed: boolean
    ├── createdAt: Timestamp
    └── updatedAt: Timestamp
```

**Key Operations** (services/firestore.ts):
- `createTodo()` - Adds document to Firestore (line 48)
- `getTodos()` - One-time fetch of all todos (line 76)
- `subscribeTodos()` - Real-time listener for todo updates (line 91)
- `updateTodoStatus()` - Updates completed field (line 125)
- `deleteTodo()` - Deletes document (line 153)

**Real-time Sync**:
- Uses Firestore's `onSnapshot` for live updates (services/firestore.ts:98)
- Any change to the `sample_todos` collection automatically updates all connected clients
- No polling required - push-based updates

### 4. Frontend Components & State

**Implementation**: `app/(tabs)/todos.tsx`

#### Local State Management
- Form inputs: `title`, `description` (useState)
- Todos list: `todos` array (useState)
- Loading states: `loading`, `uploadStatus` (useState)

#### Real-time Updates Flow
1. Component mounts → Subscribe to Firestore (app/(tabs)/todos.tsx:36)
2. Firestore sends initial data + any updates → `setTodos()` called
3. UI automatically re-renders with new data
4. Component unmounts → Unsubscribe to prevent memory leaks

#### Optimistic UI
**Current state**: Not implemented
- User actions trigger API calls, then wait for server response
- No instant UI feedback before server confirmation
- Upload status shows "Creating todo..." during API call (app/(tabs)/todos.tsx:124)

### 5. Routing & Navigation

**Implementation**: Expo Router (file-based routing)

```
Route Structure:
/                    → Redirect based on auth state
/login              → Login/signup screen
/(tabs)             → Tab navigator (authenticated users only)
  ├── /            → Home/index
  ├── /todos       → Todo list
  ├── /explore     → Explore screen
  └── /profile     → Profile/logout
/modal             → Example modal screen
```

**Navigation Protection**:
- `_layout.tsx` uses `useSegments()` and `useAuth()` to control access (app/_layout.tsx:21-33)
- All routes except `/login` require authentication

### 6. Platform Support

#### Cross-Platform Compatibility
- **Shared codebase**: 95%+ code shared across iOS, Android, Web
- **Platform-specific files**: Some components have `.web.ts` variants
- **Platform checks**: Used for Alert dialogs (app/(tabs)/todos.tsx:87-105)
  - Native: Uses React Native `Alert.alert`
  - Web: Uses `window.confirm`

#### Firebase on Web
- Firebase SDK has web support built-in
- Same API surface across all platforms
- Auth persistence uses browser storage (web) or AsyncStorage (native)

## Developer Workflow for Building Chat Requirements

To build the chat features outlined in `requirements-raw.md`, developers would:

### Current Capabilities
1. **User Authentication** ✅ - Already implemented
2. **Real-time Data Sync** ✅ - Firestore real-time listeners work
3. **Data Persistence** ✅ - Firestore provides cloud persistence
4. **Cross-platform** ✅ - React Native + Expo supports all platforms

### How to Extend for Chat
1. **Create new Firestore collections**:
   ```typescript
   // Similar to services/firestore.ts
   collections:
     - conversations (metadata)
     - messages (actual messages)
     - users (user profiles with online status)
   ```

2. **Add new screens** in `app/`:
   ```
   app/(tabs)/chats.tsx      → Chat list
   app/chat/[id].tsx         → Individual chat screen
   ```

3. **Create new services** in `services/`:
   ```typescript
   services/chat.ts          → Chat operations
   services/messages.ts      → Message CRUD
   services/presence.ts      → Online/offline status
   ```

4. **Add message components** in `components/`:
   ```
   components/message-bubble.tsx
   components/chat-input.tsx
   components/user-status.tsx
   ```

5. **Real-time listeners** (same pattern as todos):
   ```typescript
   // Subscribe to messages in a conversation
   useEffect(() => {
     const unsubscribe = onSnapshot(
       query(collection(db, `conversations/${id}/messages`), orderBy('timestamp'))
       (snapshot) => setMessages(snapshot.docs.map(...))
     );
     return unsubscribe;
   }, [id]);
   ```

## Missing Key Pieces & Scaling Challenges

This section identifies critical gaps that will prevent scaling this hello-world app to an alpha version that implements the chat requirements.

### 1. Data Model & Schema Design

**Current State**: Single flat collection (`sample_todos`) with no user association

**Missing**:
- **User-scoped data**: Todos are global, not per-user
  - No `userId` field in documents
  - No Firestore security rules to enforce ownership
- **Relational data**: No support for multi-user conversations
  - Need conversation participants tracking
  - Need message → conversation → user relationships
- **Indexes**: No custom indexes for complex queries
  - Chat list needs: "conversations where user is participant, ordered by last message"
  - This requires composite indexes

**Scaling Impact**:
- Without user scoping, all users see all data (privacy issue)
- Complex queries will fail without proper indexes
- No way to model group chats or multi-user conversations

**What's needed**:
```typescript
// Example data model for chat
conversations/
  {conversationId}/
    participants: string[]        // User IDs
    lastMessage: string
    lastMessageTime: Timestamp
    type: 'direct' | 'group'

    messages/
      {messageId}/
        senderId: string
        text: string
        timestamp: Timestamp
        status: 'sent' | 'delivered' | 'read'
        readBy: { [userId]: Timestamp }

users/
  {userId}/
    email: string
    displayName: string
    photoURL: string
    online: boolean
    lastSeen: Timestamp
```

### 2. Security & Permissions

**Current State**: No Firestore Security Rules implemented

**Missing**:
- **Firestore Security Rules**: Currently anyone can read/write any document
  - Need rules to restrict users to their own conversations
  - Need rules to prevent message tampering
  - Need rules to enforce conversation participant validation
- **API key exposure**: Firebase config in code (acceptable for Firebase, but good practice is to use environment variables)
- **Input validation**: No server-side validation of message content
- **Rate limiting**: No protection against spam or abuse

**Scaling Impact**:
- Critical security vulnerability - any user can access any data
- No protection against malicious users
- Cannot deploy to production without proper security rules

**What's needed**:
```javascript
// Example Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Users can only access conversations they're part of
    match /conversations/{conversationId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth.uid in request.resource.data.participants;

      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants
                      && request.auth.uid == request.resource.data.senderId;
      }
    }
  }
}
```

### 3. Presence & Online Status

**Current State**: No presence tracking

**Missing**:
- **Online/offline detection**: Firebase Realtime Database or custom solution needed
  - Firestore doesn't natively handle presence
  - Need to detect when users connect/disconnect
- **Last seen timestamps**: Not tracked
- **Typing indicators**: No infrastructure for ephemeral state
- **Connection state management**: No handling of network disconnections

**Scaling Impact**:
- Cannot implement online/offline status indicators
- No way to show "User is typing..." feature
- Poor UX without presence awareness

**What's needed**:
- Firebase Realtime Database for presence (Firestore + RTDB hybrid)
- Or Cloud Functions with Firestore timestamps
- Connection state listeners in app
- Heartbeat mechanism for online status

### 4. Push Notifications

**Current State**: `expo-push-notifications` not installed or configured

**Missing**:
- **Expo notifications setup**: Not integrated
- **Push tokens**: No storage of device push tokens per user
- **Notification triggers**: No Cloud Functions to send notifications on new messages
- **Notification permissions**: No request flow in app
- **Badge counts**: No unread message tracking

**Scaling Impact**:
- Users won't know about new messages when app is backgrounded
- Core feature for chat apps - non-negotiable for production

**What's needed**:
- Install `expo-notifications`
- Get and store push tokens per user/device
- Firebase Cloud Functions to trigger notifications on new messages:
  ```typescript
  // Example Cloud Function
  export const onMessageCreated = functions.firestore
    .document('conversations/{convId}/messages/{msgId}')
    .onCreate(async (snap, context) => {
      // Get conversation participants
      // Send push notification to all except sender
    });
  ```
- Handle notification taps to navigate to specific chat

### 5. Message Features

**Current State**: Basic CRUD operations only

**Missing**:
- **Read receipts**: No tracking of who has read which messages
  - Need `readBy` map in message documents
  - Need UI to show read status (checkmarks)
- **Message status**: No "sent/delivered/read" states
- **Optimistic UI**: Messages don't appear instantly before server confirmation
  - Current implementation waits for Firestore response
  - Need local state management for pending messages
- **Message pagination**: `subscribeTodos()` loads ALL documents
  - Won't scale beyond ~100 messages
  - Need cursor-based pagination (Firestore `startAfter`)
- **Message search**: No search functionality
- **Media messages**: No support for images, videos, voice messages
  - Need Firebase Storage integration
  - Need different message types
- **Message editing/deletion**: Not implemented
- **Reactions/emojis**: Not implemented

**Scaling Impact**:
- Poor UX without optimistic updates (perceived lag)
- App will crash or freeze loading thousands of messages
- Limited feature set compared to modern chat apps

**What's needed**:
- Optimistic UI pattern:
  ```typescript
  const sendMessage = async (text: string) => {
    const tempId = generateTempId();
    // Add to local state immediately
    setMessages(prev => [...prev, { id: tempId, text, status: 'pending' }]);

    // Send to server
    const result = await addMessage(text);

    // Replace temp message with server version
    setMessages(prev => prev.map(m => m.id === tempId ? result : m));
  };
  ```
- Pagination with `limit()` and `startAfter()`:
  ```typescript
  const loadMoreMessages = async () => {
    const q = query(
      collection(db, `conversations/${id}/messages`),
      orderBy('timestamp', 'desc'),
      startAfter(lastVisible),
      limit(20)
    );
  };
  ```
- Read receipt tracking in Firestore
- Firebase Storage for media uploads

### 6. State Management & Performance

**Current State**: Local component state + React Context for auth

**Missing**:
- **Global state management**: No Redux, Zustand, or similar
  - Chat list, active conversation, unread counts all in separate component states
  - Difficult to sync state across screens
- **Caching strategy**: No offline cache beyond Firestore's built-in cache
  - Firestore cache is automatic but limited control
- **Query optimization**: No query result caching or deduplication
- **Memory management**: No cleanup of old messages from memory
  - Keeping all messages in state will cause memory issues
- **Background sync**: No handling of background message fetching

**Scaling Impact**:
- Poor performance with multiple chat screens
- Difficult to implement unread counts, badges across app
- Memory leaks in long conversations
- Poor offline experience

**What's needed**:
- Global state library (Zustand recommended for React Native)
- Message windowing (virtualized lists with `@shopify/flash-list`)
- Smart caching strategy
- Background task handling for message sync

### 7. Error Handling & Resilience

**Current State**: Basic try/catch with console.error

**Missing**:
- **Retry logic**: Failed operations don't retry
  - Network failures lose messages permanently
- **Offline queue**: No message queuing when offline
- **Error boundaries**: No React error boundaries
- **Logging/monitoring**: No error tracking (Sentry, etc.)
- **User feedback**: Generic error messages only
- **Network state detection**: No handling of intermittent connectivity

**Scaling Impact**:
- Lost messages in poor network conditions
- Poor debugging in production
- Frustrated users with no actionable error messages

**What's needed**:
- Offline message queue with retry logic
- Error tracking service integration
- Network state listener (`@react-native-community/netinfo`)
- Graceful degradation for offline mode
- User-friendly error messages

### 8. Type Safety & Code Organization

**Current State**: Basic TypeScript types for Todo model

**Missing**:
- **Comprehensive types**: Only `Todo` type defined
  - Need types for: User, Message, Conversation, Presence, Notification
- **API type safety**: Firestore queries return `any`
  - Should use typed converters
- **Validation**: No runtime validation (Zod, Yup)
- **Shared types**: If backend functions needed, no shared type definitions

**Scaling Impact**:
- Type errors slip through to runtime
- Difficult to refactor without comprehensive types
- Poor developer experience

**What's needed**:
```typescript
// types/chat.ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  online: boolean;
  lastSeen: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy: Record<string, Date>;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  type: 'direct' | 'group';
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: Record<string, number>;
  groupName?: string;
  groupPhoto?: string;
}

// Firestore converter for type safety
const messageConverter: FirestoreDataConverter<Message> = {
  toFirestore: (message: Message) => ({...}),
  fromFirestore: (snapshot, options) => ({...})
};
```

### 9. Testing Infrastructure

**Current State**: No tests

**Missing**:
- **Unit tests**: No Jest tests for services/utilities
- **Component tests**: No React Testing Library tests
- **Integration tests**: No Firestore rules testing
- **E2E tests**: No Detox or Maestro tests
- **Test data**: No mock Firebase setup

**Scaling Impact**:
- High risk of regression bugs
- Difficult to refactor with confidence
- Slow development velocity as app grows

**What's needed**:
- Jest + React Native Testing Library setup
- Firebase emulator for testing
- Firestore rules unit tests
- E2E test suite for critical flows

### 10. Developer Experience & Tooling

**Current State**: Basic Expo setup with ESLint

**Missing**:
- **Code formatting**: No Prettier configured
- **Git hooks**: No pre-commit hooks (Husky)
- **CI/CD**: No automated testing/deployment
- **Environment management**: Manual `.env.local` file
  - No staging/production environment separation
- **Documentation**: No API documentation, no component documentation
- **Development tools**: No Storybook for component development

**Scaling Impact**:
- Inconsistent code style across team
- Easy to commit broken code
- Manual deployment errors
- Difficult for new developers to onboard

**What's needed**:
- Prettier + ESLint integration
- Husky for pre-commit hooks
- GitHub Actions or similar CI/CD
- Multiple environment configs (dev/staging/prod)
- Component documentation with Storybook
- Developer onboarding guide

### 11. Scalability & Performance Concerns

**Current State**: Direct client-to-Firestore communication

**Missing**:
- **Backend logic**: No Cloud Functions for complex operations
  - Can't validate messages server-side
  - Can't implement complex business logic
  - Can't integrate with third-party services
- **Search functionality**: Firestore has limited text search
  - No full-text search for messages
  - Would need Algolia or Elastic integration
- **Analytics**: No usage tracking or analytics
- **Rate limiting**: No protection against spam
- **Firestore limits**:
  - 1 write/second per document (could hit with high-traffic conversations)
  - 10,000 writes/day on free tier
  - Need to understand billing implications

**Scaling Impact**:
- Cannot implement advanced features without backend
- Costs will balloon without rate limiting
- No insights into user behavior

**What's needed**:
- Firebase Cloud Functions for:
  - Message validation and moderation
  - Push notification triggers
  - User search indexing
  - Analytics event processing
- Search service integration (Algolia)
- Analytics integration (Firebase Analytics)
- Cost monitoring and alerts

## Summary

### What Works Well
✅ Basic architecture is solid (React Native + Expo + Firebase)
✅ Authentication flow is implemented correctly
✅ Real-time data sync pattern established
✅ Cross-platform support built-in
✅ Good TypeScript foundation

### Critical Gaps for Alpha Release
🚨 **Blockers** (Must have):
1. Firestore Security Rules (security vulnerability)
2. User-scoped data model with proper schema
3. Push notifications infrastructure
4. Message pagination (performance issue)

⚠️ **High Priority** (Core features):
5. Presence/online status tracking
6. Read receipts and message status
7. Optimistic UI for better UX
8. Global state management
9. Error handling and offline queue

📋 **Medium Priority** (Quality):
10. Comprehensive testing
11. Cloud Functions for backend logic
12. Proper error tracking
13. Type safety improvements

🎯 **Nice to Have** (Polish):
14. Media message support
15. Message search
16. Developer tooling improvements
17. Analytics and monitoring

### Development Effort Estimate
- **Current complexity**: ~1-2 day hello-world project
- **Alpha chat app**: ~6-8 weeks with 1-2 developers
  - Week 1-2: Data model, security rules, push notifications
  - Week 3-4: Chat UI, real-time messaging, optimistic updates
  - Week 5-6: Presence, read receipts, pagination, error handling
  - Week 7-8: Testing, polish, deployment setup

This architecture review provides a realistic assessment of what exists and what's needed to build a production-ready chat application based on this foundation.

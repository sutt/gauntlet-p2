# MVP Development Tasks

## Overview

This document breaks down the MVP implementation into **incremental, checkpointable tasks** designed to build momentum through early wins. Tasks are ordered to achieve working features quickly rather than doing all setup upfront.

**Philosophy**:
- ✅ Working > Perfect
- ✅ Proof of concept first, refine later
- ✅ Early visual progress over infrastructure
- ✅ Each task should result in visible or testable progress

---

## Task Prioritization Strategy

### 🚀 Momentum Building (Do First)
Get something visible and working ASAP to validate approach and build confidence.

### 🔧 Infrastructure (Do When Needed)
Add types, security, optimization only when required for next feature.

### 💎 Polish (Do Last)
Error handling, loading states, edge cases after core functionality works.

---

## Milestone 1: "Hello Chat" - Proof of Concept
**Goal**: Send a message between two users. No polish, just working.
**Time Estimate**: 2-3 days

### Task 1.1: Create Basic Chat Types
**Priority**: 🚀 Momentum (Required for next tasks)
**Time**: 30 minutes

Create minimal types to get started. We'll expand these later.

**Files to Create**:
- `types/chat.ts`

**What to Include**:
```typescript
// Just enough to start
export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  participants: string[];
}
```

**Why Minimal?**: Get coding faster. Add fields as we need them.

**Checkpoint**: Types compile, no errors.

---

### Task 1.2: Create Hardcoded Chat Screen
**Priority**: 🚀 Momentum (Visual progress!)
**Time**: 1-2 hours

Build a chat UI with fake data before connecting to Firebase.

**Files to Create**:
- `app/chat/[id].tsx` (new file)

**What to Build**:
- Simple FlatList with hardcoded messages
- Basic message bubbles (left vs right alignment)
- Text input at bottom
- Send button (doesn't do anything yet)

**Hardcoded Data**:
```typescript
const FAKE_MESSAGES = [
  { id: '1', text: 'Hey!', senderId: 'user1', timestamp: new Date() },
  { id: '2', text: 'Hi there!', senderId: 'currentUser', timestamp: new Date() },
];
```

**Checkpoint**: Navigate to `/chat/test` and see messages displayed.

**Why This First?**: Validates UI approach before dealing with Firebase complexity.

---

### Task 1.3: Create Message Service (Minimal)
**Priority**: 🚀 Momentum
**Time**: 1 hour

Wire up Firebase to send and receive messages. Start with simplest possible implementation.

**Files to Create**:
- `services/messages.ts`

**What to Implement**:
```typescript
// Just two functions to start
export const sendMessage = async (conversationId: string, text: string, userId: string) => {
  // Add to Firestore conversations/{id}/messages
};

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  // Real-time listener
  // Return unsubscribe function
};
```

**Checkpoint**: Can manually send message in code and see it in Firebase Console.

---

### Task 1.4: Connect Chat Screen to Firebase
**Priority**: 🚀 Momentum
**Time**: 1 hour

Replace fake data with real Firebase data.

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Remove hardcoded messages
- Add `useEffect` to subscribe to messages
- Wire up send button to call `sendMessage()`
- Use real conversation ID from URL params

**Test**:
1. Manually create a conversation document in Firebase Console:
   ```
   Collection: conversations
   Document ID: test-chat-1
   Fields: { participants: ['user1', 'user2'] }
   ```
2. Open app, navigate to `/chat/test-chat-1`
3. Send a message
4. See it appear in real-time

**Checkpoint**: ✅ **FIRST MILESTONE** - Can send and receive messages in real-time!

**🎉 Celebrate**: You now have a working chat! Everything else is building on this.

---

## Milestone 2: "Chat List" - Multiple Conversations
**Goal**: See list of conversations and tap to open
**Time Estimate**: 2-3 days

### Task 2.1: Create Conversation Service
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Create**:
- `services/conversations.ts`

**What to Implement**:
```typescript
export const createConversation = async (participants: string[]) => {
  // Create conversation document
  // Return conversation ID
};

export const subscribeToConversations = (userId: string, callback) => {
  // Listen to conversations where participants contains userId
};
```

**Test**: Manually create a conversation in console, verify subscription picks it up.

**Checkpoint**: Can create and fetch conversations.

---

### Task 2.2: Build Chat List Screen (Minimal)
**Priority**: 🚀 Momentum
**Time**: 2 hours

**Files to Create**:
- `app/(tabs)/chats.tsx`

**What to Build**:
- FlatList of conversations
- Simple list item: Show conversation ID for now (we'll add names later)
- Tap to navigate to `/chat/[id]`
- Floating "+" button to create new chat

**Start with Fake Data**:
```typescript
const FAKE_CONVERSATIONS = [
  { id: 'conv-1', participants: ['user1', 'user2'] },
  { id: 'conv-2', participants: ['user1', 'user3'] },
];
```

**Checkpoint**: Can see list and tap to open chat screen.

---

### Task 2.3: Connect Chat List to Firebase
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- Replace fake data with `subscribeToConversations()`
- Use current user's ID from auth context

**Test**:
1. Create 2-3 conversations in Firebase Console with current user in participants
2. Open app, see them in list
3. Tap one, see chat screen open

**Checkpoint**: ✅ **SECOND MILESTONE** - Can see and navigate between multiple chats!

---

### Task 2.4: Add "Create Conversation" Button
**Priority**: 🚀 Momentum
**Time**: 1-2 hours

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**What to Build**:
- Simple modal/dialog with text input
- Enter another user's ID (hardcode a test user ID)
- Button to create conversation
- On create, navigate to new chat

**For MVP**: Just hardcode a test user ID like "test-user-2". We'll add user lookup later.

**Checkpoint**: Can create new conversation and start chatting.

---

## Milestone 3: "User Profiles" - Display Names
**Goal**: Show names instead of user IDs
**Time Estimate**: 2-3 days

### Task 3.1: Create User Service
**Priority**: 🔧 Infrastructure (Now we need it)
**Time**: 1 hour

**Files to Create**:
- `services/users.ts`

**What to Implement**:
```typescript
export const createUserProfile = async (userId: string, email: string, displayName: string) => {
  // Create user document in users collection
};

export const getUser = async (userId: string) => {
  // Fetch user by ID
};

export const getUsersByIds = async (userIds: string[]) => {
  // Batch fetch users
};
```

**Checkpoint**: Can create and fetch user documents.

---

### Task 3.2: Auto-Create User Profile on Login
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `context/auth.tsx`

**Changes**:
- After successful login/signup, check if user document exists
- If not, create one with email and default display name (email username)

**For MVP**: Skip the "set display name" onboarding screen. Just use email prefix.

**Example**: `john@example.com` → display name = "john"

**Checkpoint**: New users automatically get user documents created.

---

### Task 3.3: Store Sender Name in Messages
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `services/messages.ts`
- `types/chat.ts` (add `senderName: string` to Message)

**Changes**:
- When sending message, include sender's display name
- Store in message document (denormalized)

**Why Denormalize**: Fast reads, no lookups when rendering messages.

**Checkpoint**: New messages include sender name.

---

### Task 3.4: Display Sender Names in Chat
**Priority**: 🚀 Momentum
**Time**: 30 minutes

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Show sender name above each message bubble
- For current user's messages, can show "You" or just omit name

**Checkpoint**: See names in chat instead of "Unknown User".

---

### Task 3.5: Show Names in Chat List
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- For each conversation, fetch participant users
- Show display names instead of "Conversation abc123"
- For 1-on-1: Show other user's name
- For group: Show "User1, User2, User3"

**Checkpoint**: ✅ **THIRD MILESTONE** - Chat list shows real user names!

---

## Milestone 4: "Security" - Firestore Rules
**Goal**: Lock down data access
**Time Estimate**: 1-2 days

### Task 4.1: Write Security Rules (Development Mode)
**Priority**: 🔧 Infrastructure (Critical before production)
**Time**: 1 hour

**Files to Create**:
- `firestore.rules` (project root)

**What to Include**:
Start with permissive rules for testing, then tighten:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORARY - For development only
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Deploy**:
```bash
firebase deploy --only firestore:rules
```

**Checkpoint**: Rules deployed, app still works.

---

### Task 4.2: Add Proper Security Rules
**Priority**: 🔧 Infrastructure
**Time**: 2 hours

**Files to Modify**:
- `firestore.rules`

**What to Add**:
- Users can only read their own conversations
- Users can only send messages to conversations they're in
- Users can read all user profiles (for display names)

**See mvp-arch.md for full rules.**

**Test**: Try to access another user's conversation (should fail).

**Checkpoint**: Security rules prevent unauthorized access.

---

## Milestone 5: "Last Message Preview" - Better Chat List
**Goal**: Show last message and timestamp in list
**Time Estimate**: 1-2 days

### Task 5.1: Update Conversation Schema
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `types/chat.ts`

**Add to Conversation**:
```typescript
interface Conversation {
  // ... existing fields
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageSenderId: string;
}
```

---

### Task 5.2: Update Last Message When Sending
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `services/messages.ts`

**Changes**:
- When sending message, also update parent conversation document
- Set `lastMessage`, `lastMessageTime`, `lastMessageSenderId`
- Use Firestore batch write to do both atomically

**Checkpoint**: Conversations update when messages are sent.

---

### Task 5.3: Display Last Message in Chat List
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- Show last message text (truncate to 1 line)
- Show timestamp (relative: "2m ago")
- Sort conversations by `lastMessageTime` (descending)

**Checkpoint**: ✅ **FOURTH MILESTONE** - Chat list looks like a real messaging app!

---

## Milestone 6: "Timestamps" - Message Times
**Goal**: Show when messages were sent
**Time Estimate**: 1 day

### Task 6.1: Add Timestamp to Message Type
**Priority**: 🔧 Infrastructure
**Time**: 15 minutes

**Files to Modify**:
- `types/chat.ts`

**Add**: `timestamp: Date` to Message interface (if not already there)

---

### Task 6.2: Create Date Formatting Utility
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Create**:
- `utils/date-format.ts`

**What to Implement**:
```typescript
export const formatMessageTime = (date: Date): string => {
  // Same day: "3:45 PM"
  // Yesterday: "Yesterday"
  // Older: "Dec 15"
};

export const formatRelativeTime = (date: Date): string => {
  // "2m ago", "5h ago", "Yesterday", "Dec 15"
};
```

**Checkpoint**: Functions work in isolation (test with console.log).

---

### Task 6.3: Display Timestamps in Chat
**Priority**: 🚀 Momentum
**Time**: 30 minutes

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Show timestamp below each message
- Use `formatMessageTime()` helper

**Checkpoint**: Messages show times.

---

### Task 6.4: Add Date Dividers (Optional)
**Priority**: 💎 Polish
**Time**: 1 hour

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Group messages by date
- Add dividers: "Today", "Yesterday", "Dec 15"

**Checkpoint**: Easy to see when conversation jumped to different day.

---

## Milestone 7: "Optimistic UI" - Instant Feedback
**Goal**: Messages appear instantly when sent
**Time Estimate**: 2 days

### Task 7.1: Add Optimistic State to Chat Screen
**Priority**: 🚀 Momentum
**Time**: 2 hours

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
1. Add local state for pending messages:
   ```typescript
   const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
   ```
2. When user taps send:
   - Generate temp ID: `temp-${Date.now()}`
   - Add to `pendingMessages` immediately
   - Call `sendMessage()` in background
   - Remove from pending when Firebase confirms

**Visual Indicator**: Show gray text or spinner for pending messages.

**Checkpoint**: Messages appear instantly, then "commit" when sent.

---

### Task 7.2: Handle Send Failures
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- If `sendMessage()` throws error, mark message as failed
- Show red indicator or "Retry" button
- Keep failed message in list (don't remove)

**Checkpoint**: Failed messages don't disappear, user can retry.

---

## Milestone 8: "Online Status" - Presence Tracking
**Goal**: Show who's online
**Time Estimate**: 2-3 days

### Task 8.1: Add Presence Fields to User
**Priority**: 🔧 Infrastructure
**Time**: 15 minutes

**Files to Modify**:
- `types/chat.ts`

**Add to User**:
```typescript
interface User {
  // ... existing
  lastSeen: Date;
  online: boolean; // Computed client-side
}
```

---

### Task 8.2: Create Presence Service
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Create**:
- `services/presence.ts`

**What to Implement**:
```typescript
export const startPresenceTracking = (userId: string) => {
  // Update lastSeen every 30 seconds while app is active
  // Stop when app goes to background
};

export const isUserOnline = (lastSeen: Date): boolean => {
  // Return true if lastSeen < 2 minutes ago
};
```

**Checkpoint**: User's `lastSeen` updates while app is open.

---

### Task 8.3: Start Presence Tracking on Login
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `context/auth.tsx` or create `context/presence.tsx`

**Changes**:
- When user logs in, start presence tracking
- When user logs out, stop tracking

**Checkpoint**: User document updates every 30 seconds.

---

### Task 8.4: Show Online Indicator in Chat List
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- For each conversation, fetch other user's status
- Show green dot if `isUserOnline(user.lastSeen)`
- Show "Last seen 5m ago" if offline

**Checkpoint**: Can see who's online in chat list.

---

### Task 8.5: Show Online Status in Chat Screen
**Priority**: 🚀 Momentum
**Time**: 30 minutes

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Show "Online" or "Last seen X ago" in chat header
- Update in real-time

**Checkpoint**: ✅ **FIFTH MILESTONE** - Online status working!

---

## Milestone 9: "Read Receipts" - Message Status
**Goal**: Show when messages are read
**Time Estimate**: 2-3 days

### Task 9.1: Add readBy Field to Messages
**Priority**: 🔧 Infrastructure
**Time**: 15 minutes

**Files to Modify**:
- `types/chat.ts`

**Add to Message**:
```typescript
interface Message {
  // ... existing
  readBy: Record<string, Date>; // userId -> timestamp
}
```

---

### Task 9.2: Mark Messages as Read
**Priority**: 🔧 Infrastructure
**Time**: 1-2 hours

**Files to Create**:
- `services/messages.ts` (add function)

**What to Implement**:
```typescript
export const markMessagesAsRead = async (
  conversationId: string,
  messageIds: string[],
  userId: string
) => {
  // Batch update all messages
  // Add userId to readBy map
};
```

**When to Call**:
- When user opens conversation
- When new message arrives while conversation is open

**Checkpoint**: Messages get marked as read in Firebase.

---

### Task 9.3: Display Read Receipts
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- For sent messages (current user), show checkmarks:
  - Single ✓ if not read
  - Double ✓✓ if read
- Only show for current user's messages

**Checkpoint**: Can see when other user reads your message.

---

### Task 9.4: Auto-Mark Messages as Read
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- When conversation opens, mark all messages as read
- Debounce to avoid too many writes
- Only mark messages not already read by current user

**Checkpoint**: Messages auto-mark as read when viewing conversation.

---

## Milestone 10: "Group Chat" - Multiple Participants
**Goal**: Support 3+ users in one conversation
**Time Estimate**: 2-3 days

### Task 10.1: Add Conversation Type
**Priority**: 🔧 Infrastructure
**Time**: 15 minutes

**Files to Modify**:
- `types/chat.ts`

**Add to Conversation**:
```typescript
interface Conversation {
  // ... existing
  type: 'direct' | 'group';
  groupName?: string;
}
```

---

### Task 10.2: Support Creating Group Conversations
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `services/conversations.ts`

**Changes**:
- Allow creating conversation with 3+ participants
- Auto-generate group name: "User1, User2, User3"

**Checkpoint**: Can create group in code.

---

### Task 10.3: Add "Create Group" Button
**Priority**: 🚀 Momentum
**Time**: 2 hours

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- Add "Create Group" option
- Modal with multiple user ID inputs
- Create group conversation

**Checkpoint**: Can create groups from UI.

---

### Task 10.4: Show Sender Names in Groups
**Priority**: 🚀 Momentum
**Time**: 30 minutes

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Always show sender name in group chats
- In 1-on-1, can hide sender name for clarity

**Checkpoint**: ✅ **SIXTH MILESTONE** - Group chat working!

---

## Milestone 11: "Unread Counts" - Notification Badges
**Goal**: Show unread message counts
**Time Estimate**: 2 days

### Task 11.1: Add Unread Count to Conversations
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `types/chat.ts`

**Add to Conversation**:
```typescript
interface Conversation {
  // ... existing
  unreadCount: Record<string, number>; // userId -> count
}
```

---

### Task 11.2: Increment Unread on New Message
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `services/messages.ts`

**Changes**:
- When sending message, increment unread count for all participants except sender
- Use Firestore increment: `unreadCount.userId: increment(1)`

**Checkpoint**: Unread counts increase when messages are sent.

---

### Task 11.3: Reset Unread When Reading
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `services/messages.ts` (in `markMessagesAsRead`)

**Changes**:
- When marking messages as read, reset unread count to 0 for current user

**Checkpoint**: Unread count goes to 0 when opening conversation.

---

### Task 11.4: Display Unread Badges
**Priority**: 🚀 Momentum
**Time**: 1 hour

**Files to Modify**:
- `app/(tabs)/chats.tsx`

**Changes**:
- Show unread count badge on each conversation
- Show total unread count on tab icon (optional)

**Checkpoint**: Can see unread counts in chat list.

---

## Milestone 12: "Pagination" - Performance
**Goal**: Load messages efficiently
**Time Estimate**: 2 days

### Task 12.1: Limit Initial Message Load
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Files to Modify**:
- `services/messages.ts`

**Changes**:
- Add `limit(50)` to message query
- Only load last 50 messages

**Checkpoint**: Fast initial load even with thousands of messages.

---

### Task 12.2: Implement Load More
**Priority**: 🔧 Infrastructure
**Time**: 2 hours

**Files to Create/Modify**:
- `services/messages.ts` (add `loadMoreMessages` function)
- `app/chat/[id].tsx`

**Changes**:
- "Load More" button at top of chat
- Use Firestore `startAfter` cursor
- Load previous 50 messages

**Checkpoint**: Can load older messages on demand.

---

## Milestone 13: "Polish" - UX Improvements
**Goal**: Make it feel polished
**Time Estimate**: 2-3 days

### Task 13.1: Add Loading States
**Priority**: 💎 Polish
**Time**: 1 hour

**Files to Modify**:
- All screens

**What to Add**:
- Spinner while loading conversations
- Skeleton screens (optional)
- "Sending..." indicator

**Checkpoint**: App never feels frozen or broken.

---

### Task 13.2: Add Empty States
**Priority**: 💎 Polish
**Time**: 1 hour

**What to Add**:
- "No conversations yet" in chat list
- "Start chatting" prompt in empty conversation

**Checkpoint**: App guides user when empty.

---

### Task 13.3: Add Error Handling
**Priority**: 💎 Polish
**Time**: 2 hours

**What to Add**:
- Toast notifications for errors
- Retry buttons for failed actions
- Friendly error messages

**Checkpoint**: Errors don't crash app, user can recover.

---

### Task 13.4: Auto-scroll to Bottom
**Priority**: 💎 Polish
**Time**: 30 minutes

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Auto-scroll to bottom when new message arrives
- Auto-scroll when user sends message
- Don't auto-scroll if user is scrolled up (reading old messages)

**Checkpoint**: New messages automatically visible.

---

### Task 13.5: Keyboard Handling
**Priority**: 💎 Polish
**Time**: 1 hour

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Use `KeyboardAvoidingView` to prevent keyboard covering input
- Dismiss keyboard when scrolling (optional)

**Checkpoint**: Keyboard doesn't cover messages.

---

## Milestone 14: "Notifications" - Foreground Alerts
**Goal**: Alert user to new messages
**Time Estimate**: 2-3 days

### Task 14.1: Install Expo Notifications
**Priority**: 🔧 Infrastructure
**Time**: 30 minutes

**Commands**:
```bash
npx expo install expo-notifications
```

**Checkpoint**: Package installed, app still builds.

---

### Task 14.2: Request Notification Permissions
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Create**:
- `services/notifications.ts`

**What to Implement**:
```typescript
export const requestNotificationPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};
```

**When to Call**: On app launch or first message.

**Checkpoint**: Permission dialog appears.

---

### Task 14.3: Show Foreground Notification
**Priority**: 🚀 Momentum
**Time**: 2 hours

**Files to Modify**:
- `app/chat/[id].tsx` or create listener in root layout

**Changes**:
- Listen for new messages across all conversations
- If message arrives and conversation is not currently open, show notification
- Use `Notifications.scheduleNotificationAsync()`

**Checkpoint**: Notification banner appears for new messages.

---

### Task 14.4: Handle Notification Taps
**Priority**: 🔧 Infrastructure
**Time**: 1 hour

**Files to Modify**:
- `app/_layout.tsx`

**Changes**:
- Listen for notification taps
- Navigate to relevant conversation

**Checkpoint**: Tapping notification opens chat.

---

## Optional: Advanced Features (Post-MVP)

These can be added after MVP is working:

### Task X.1: Find User by Email
**Priority**: 💎 Nice-to-have
**Time**: 2 hours

Instead of hardcoding user IDs, let users search by email.

**Files to Create**:
- Add function to `services/users.ts`

**Changes**:
- Add text input for email in "Create Chat" modal
- Search for user by email
- Show error if not found

---

### Task X.2: Display Name Editing
**Priority**: 💎 Nice-to-have
**Time**: 1-2 hours

Let users change their display name.

**Files to Modify**:
- `app/(tabs)/profile.tsx`

**Changes**:
- Add "Edit Name" button
- Simple text input
- Update user document

---

### Task X.3: Message Pagination with Infinite Scroll
**Priority**: 💎 Nice-to-have
**Time**: 2-3 hours

Replace "Load More" button with automatic loading.

**Files to Modify**:
- `app/chat/[id].tsx`

**Changes**:
- Detect when user scrolls near top
- Automatically load more messages

---

### Task X.4: Typing Indicators
**Priority**: 💎 Nice-to-have
**Time**: 3-4 hours

Show "User is typing..." indicator.

**Requires**: Firebase Realtime Database (Firestore too slow for this)

---

## Development Tips

### Momentum Killers to Avoid
❌ Don't write tests until core features work
❌ Don't obsess over TypeScript perfection early
❌ Don't implement all error handling upfront
❌ Don't add loading states before things load
❌ Don't optimize before measuring performance

### Momentum Builders
✅ Hardcode data initially, connect Firebase later
✅ Use `console.log` liberally for debugging
✅ Test in web first (faster refresh)
✅ Take screenshots of progress (motivating!)
✅ Commit after each working task

### When Stuck
1. **Simplify**: What's the absolute minimum to move forward?
2. **Fake it**: Use hardcoded data to validate UI
3. **Skip it**: Mark as TODO and come back later
4. **Ask**: Firebase docs, Stack Overflow, ChatGPT

### Testing Strategy
For MVP, manual testing is fine:
1. Test each task before moving on
2. Keep a checklist of scenarios
3. Test on one platform (web or iOS/Android)
4. Test other platforms at milestones

### Git Workflow
**Commit often**:
- After each completed task
- Before making risky changes
- When something works (even if ugly)

**Branch Strategy** (optional for solo dev):
- `main` = stable
- `feature/chat-list` = working branch
- Merge to main at each milestone

---

## Task Checklist

Copy this to track progress:

```
Milestone 1: "Hello Chat" ⬜
  ⬜ 1.1 Create basic chat types
  ⬜ 1.2 Hardcoded chat screen
  ⬜ 1.3 Message service (minimal)
  ⬜ 1.4 Connect to Firebase

Milestone 2: "Chat List" ⬜
  ⬜ 2.1 Conversation service
  ⬜ 2.2 Chat list screen (minimal)
  ⬜ 2.3 Connect to Firebase
  ⬜ 2.4 Create conversation button

Milestone 3: "User Profiles" ⬜
  ⬜ 3.1 User service
  ⬜ 3.2 Auto-create profile
  ⬜ 3.3 Store sender name
  ⬜ 3.4 Display in chat
  ⬜ 3.5 Display in list

Milestone 4: "Security" ⬜
  ⬜ 4.1 Dev mode rules
  ⬜ 4.2 Proper security rules

Milestone 5: "Last Message Preview" ⬜
  ⬜ 5.1 Update schema
  ⬜ 5.2 Update on send
  ⬜ 5.3 Display in list

Milestone 6: "Timestamps" ⬜
  ⬜ 6.1 Add to type
  ⬜ 6.2 Format utility
  ⬜ 6.3 Display in chat
  ⬜ 6.4 Date dividers (optional)

Milestone 7: "Optimistic UI" ⬜
  ⬜ 7.1 Optimistic state
  ⬜ 7.2 Handle failures

Milestone 8: "Online Status" ⬜
  ⬜ 8.1 Presence fields
  ⬜ 8.2 Presence service
  ⬜ 8.3 Start tracking
  ⬜ 8.4 Show in list
  ⬜ 8.5 Show in chat

Milestone 9: "Read Receipts" ⬜
  ⬜ 9.1 Add readBy field
  ⬜ 9.2 Mark as read function
  ⬜ 9.3 Display receipts
  ⬜ 9.4 Auto-mark

Milestone 10: "Group Chat" ⬜
  ⬜ 10.1 Add type
  ⬜ 10.2 Create groups
  ⬜ 10.3 Create group button
  ⬜ 10.4 Show sender names

Milestone 11: "Unread Counts" ⬜
  ⬜ 11.1 Add to schema
  ⬜ 11.2 Increment on send
  ⬜ 11.3 Reset on read
  ⬜ 11.4 Display badges

Milestone 12: "Pagination" ⬜
  ⬜ 12.1 Limit initial load
  ⬜ 12.2 Load more

Milestone 13: "Polish" ⬜
  ⬜ 13.1 Loading states
  ⬜ 13.2 Empty states
  ⬜ 13.3 Error handling
  ⬜ 13.4 Auto-scroll
  ⬜ 13.5 Keyboard handling

Milestone 14: "Notifications" ⬜
  ⬜ 14.1 Install package
  ⬜ 14.2 Request permissions
  ⬜ 14.3 Show foreground
  ⬜ 14.4 Handle taps
```

---

## Summary

**Total Time Estimate**: 4-6 weeks for solo developer

**Key to Success**:
1. Build proof of concept first (Milestone 1)
2. Add features incrementally
3. Don't optimize prematurely
4. Manual testing is fine for MVP
5. Commit frequently
6. Celebrate each milestone 🎉

**First Day Goal**: Complete Milestone 1 - send your first message!

**First Week Goal**: Complete Milestones 1-3 - working chat with names

**First Month Goal**: Complete Milestones 1-10 - full MVP features

Good luck! 🚀

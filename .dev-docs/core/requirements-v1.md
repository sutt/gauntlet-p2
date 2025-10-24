# V1 Requirements - Detailed Elaboration

**Version**: 1.0
**Date**: 2025-10-24
**Status**: Requirements Analysis

## Overview

This document elaborates on each item from the v1 backlog, providing context, technical considerations, open questions, and implementation notes. Items are tagged with [v1] and organized by type (feature/bug).

---

## Table of Contents

1. [Features](#features)
   - [1.1 Image Support in Chats](#11-image-support-in-chats-v1-feat)
   - [1.2 Profile Image Upload](#12-profile-image-upload-v1-feat)
   - [1.3 Profile Edit Field](#13-profile-edit-field-v1-feat)
   - [1.4 People Tab with Search](#14-people-tab-with-search-v1-feat)
   - [1.5 New Conversation Direct Chat](#15-new-conversation-direct-chat-v1-feat)
   - [1.6 Typing Indicator](#16-typing-indicator-v1-feat)
2. [Bugs](#bugs)
   - [2.1 Premature Conversation Visibility](#21-premature-conversation-visibility-v1-bug)
   - [2.2 Keyboard Layout Handling](#22-keyboard-layout-handling-v1-bug)
   - [2.3 Presence Permission Error](#23-presence-permission-error-v1-bug)

---

## Features

### 1.1 Image Support in Chats [v1-feat]

**Original Item**: "feat: adding images to chats, storing them in backend"

#### Description
Add ability for users to attach and send images within conversations. Images should be stored persistently in the backend (Firebase Storage) and displayed inline in message threads.

#### User Story
```
As a user
I want to send images in my conversations
So that I can share visual content with my contacts
```

#### Technical Requirements

**Client-Side**:
- Image picker UI (camera roll access + camera)
- Image preview before sending
- Thumbnail generation (optional, could be done server-side)
- Image upload progress indicator
- Display images in message bubbles
- Image tap → full-screen view

**Backend (Firebase Storage)**:
- File structure: `/conversations/{conversationId}/images/{imageId}.{ext}`
- Accepted formats: JPEG, PNG, WebP, GIF (static)
- File size limits: 10MB per image
- Security rules: Only conversation participants can upload/read
- Metadata storage in Firestore

**Message Schema Changes**:
```typescript
interface MessageDocument {
  // Existing fields...
  text: string;                    // Make optional when image present

  // New fields
  mediaType?: 'image' | 'video' | 'file';  // For future expansion
  mediaUrl?: string;               // Firebase Storage download URL
  mediaPath?: string;              // Storage path for deletion
  mediaThumbnailUrl?: string;      // Optional thumbnail
  mediaMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
  };
}
```

#### Open Questions

1. **Image Compression**:
   - Q: Should we compress images on client before upload?
   - Options:
     - A) Yes, to save storage/bandwidth (recommended)
     - B) No, preserve original quality
   - **Recommendation**: Compress to max 1920x1920, quality 80%, ~200-500KB target

2. **Multiple Images**:
   - Q: Can users send multiple images in one message?
   - Options:
     - A) Yes, array of images per message
     - B) No, one image per message (simpler for v1)
   - **Recommendation**: Start with single image per message for v1

3. **Storage Costs**:
   - Q: What's our storage budget?
   - Firebase Storage pricing: $0.026/GB/month
   - Estimate: 100 users × 10 images/user × 500KB = 0.5GB = $0.013/month
   - **Acceptable for v1**

4. **Image Loading Strategy**:
   - Q: How to handle slow connections?
   - Options:
     - A) Show placeholder while loading (blur hash)
     - B) Simple spinner
     - C) Progressive loading
   - **Recommendation**: Start with spinner for v1, add blur hash in v2

5. **Image Deletion**:
   - Q: Can users delete sent images?
   - For v1: No deletion (keep simple)
   - For v2: Add message deletion feature

#### Dependencies
- Expo Image Picker: `expo-image-picker` (already in Expo)
- Expo Image Manipulator: `expo-image-manipulator` (for compression)
- Firebase Storage SDK: Already installed
- Image viewer: Consider `react-native-image-viewing` or `expo-image`

#### Implementation Phases

**Phase 1: Basic Upload & Display** (3-4 days)
1. Add image picker button in message input
2. Upload image to Firebase Storage
3. Save message with mediaUrl
4. Display images in message bubbles
5. Tap image → full screen view

**Phase 2: Compression & Progress** (1-2 days)
6. Add image compression before upload
7. Show upload progress bar
8. Handle upload errors/retry

**Phase 3: Security & Rules** (1 day)
9. Update Firebase Storage security rules
10. Update Firestore security rules for media messages

#### Testing Checklist
- [ ] Pick image from gallery
- [ ] Take photo with camera
- [ ] Upload progress shows
- [ ] Image displays correctly in chat
- [ ] Full-screen view works
- [ ] Works on poor network (timeout/retry)
- [ ] Security rules prevent unauthorized access
- [ ] Storage costs within budget

#### Risks & Mitigations
- **Risk**: Large files cause slow uploads
  - **Mitigation**: Compress before upload, show progress
- **Risk**: Storage costs escalate
  - **Mitigation**: Implement size limits, monitor usage
- **Risk**: Inappropriate images uploaded
  - **Mitigation**: Not addressing in v1, add moderation in v2

---

### 1.2 Profile Image Upload [v1-feat]

**Original Item**: "feat: adding optional upload image to user profile - allow them to upload in the profile"

#### Description
Allow users to upload a profile picture that displays in conversation lists, chat headers, and eventually the people tab. This is separate from chat images and stored in a user-specific location.

#### User Story
```
As a user
I want to set a profile picture
So that my contacts can recognize me visually
```

#### Technical Requirements

**Client-Side**:
- Profile screen: Add "Change Photo" button
- Image picker (gallery or camera)
- Circular crop UI (optional but recommended)
- Preview before saving
- Default avatar if no image (initials or icon)

**Backend (Firebase Storage)**:
- File structure: `/users/{userId}/profile.jpg`
- Single file per user (overwrite on update)
- Accepted formats: JPEG, PNG
- Size limit: 5MB original, compress to 500x500px, ~50-100KB

**User Schema Changes**:
```typescript
interface UserDocument {
  // Existing fields...
  displayName: string;

  // New fields
  profileImageUrl?: string;        // Download URL from Storage
  profileImagePath?: string;       // Storage path
  profileImageUpdatedAt?: Timestamp;
}
```

#### Open Questions

1. **Image Aspect Ratio**:
   - Q: Should we enforce square aspect ratio?
   - Options:
     - A) Yes, crop to square (1:1) - recommended for avatars
     - B) Allow any ratio, center-crop in UI
   - **Recommendation**: Crop to square 500x500px

2. **Default Avatars**:
   - Q: What to show if user has no profile image?
   - Options:
     - A) Initials in colored circle (like Gmail)
     - B) Generic silhouette icon
     - C) Random avatar generator (boring avatars, dicebear)
   - **Recommendation**: Initials with color based on userId hash

3. **Caching**:
   - Q: How to handle image caching?
   - Expo Image has built-in caching
   - **Recommendation**: Use Expo Image with default caching

4. **Old Image Cleanup**:
   - Q: Delete old profile image when user uploads new one?
   - **Recommendation**: Yes, overwrite file to save storage

5. **Privacy**:
   - Q: Can users hide their profile image?
   - For v1: No, if uploaded it's always visible
   - For v2: Add privacy setting

#### Dependencies
- Expo Image Picker: `expo-image-picker`
- Expo Image Manipulator: `expo-image-manipulator` (for crop/resize)
- Expo Image: `expo-image` (for caching/display)

#### Implementation Phases

**Phase 1: Upload Functionality** (2-3 days)
1. Add "Change Photo" UI in profile screen
2. Image picker + crop to square
3. Upload to Firebase Storage
4. Update user document with URL
5. Display in profile screen

**Phase 2: Display Everywhere** (1-2 days)
6. Show profile image in chat list items
7. Show in chat header
8. Show in message bubbles (optional for v1)
9. Implement default avatar (initials)

**Phase 3: Optimization** (1 day)
10. Compress images before upload
11. Delete old image when updating
12. Add loading states

#### Testing Checklist
- [ ] Upload new profile image
- [ ] Image crops to square correctly
- [ ] Profile image shows in profile screen
- [ ] Profile image shows in chat list
- [ ] Profile image shows in chat header
- [ ] Default avatar (initials) shows when no image
- [ ] Updating image deletes old one
- [ ] Security rules work correctly

#### Risks & Mitigations
- **Risk**: Users upload inappropriate images
  - **Mitigation**: Not addressing in v1, add reporting in v2
- **Risk**: Image quality poor after compression
  - **Mitigation**: Test compression settings, find balance

---

### 1.3 Profile Edit Field [v1-feat]

**Original Item**: "feat: adding edit field for user profile"

#### Description
Currently, users set their display name once during onboarding (or it's auto-generated from email). Add ability to edit display name and potentially other profile fields from the profile screen.

#### User Story
```
As a user
I want to change my display name
So that I can update how others see me
```

#### Technical Requirements

**Editable Fields**:
- Display name (text, 2-50 characters)
- Status message (optional, text, max 150 characters) - nice to have
- Email (display only, not editable)

**Client-Side**:
- Profile screen: Add "Edit Profile" button or inline edit
- Modal or separate screen for editing
- Validation: Display name required, min 2 chars
- Save button (disabled until valid changes)
- Cancel button (discard changes)

**Backend**:
- Update user document in Firestore
- Validation in security rules (name length, no empty)
- No additional storage needed

**User Schema Changes**:
```typescript
interface UserDocument {
  // Existing
  displayName: string;              // Make editable

  // Optional additions
  statusMessage?: string;           // Optional status text
  profileUpdatedAt?: Timestamp;     // Track last edit
}
```

#### Open Questions

1. **Name Change Propagation**:
   - Q: When user changes name, update existing messages?
   - Current: Display name is denormalized in messages (for performance)
   - Options:
     - A) Don't update old messages (accept slight staleness)
     - B) Update all messages (expensive, complex)
   - **Recommendation**: Don't update old messages for v1
   - **Note**: Add warning "Name will appear on new messages only"

2. **Name Change Frequency**:
   - Q: Limit how often users can change name?
   - Options:
     - A) No limit
     - B) Limit to 1 change per day/week
   - **Recommendation**: No limit for v1, monitor abuse

3. **Name Validation**:
   - Q: What characters allowed? Length limits?
   - **Recommendation**:
     - Min: 2 characters
     - Max: 50 characters
     - Allow: letters, numbers, spaces, basic punctuation
     - Disallow: Only spaces/special chars, profanity (basic filter)

4. **Additional Fields**:
   - Q: Add bio/about field?
   - **Recommendation**: Skip for v1, display name is enough

5. **Status Message**:
   - Q: Add WhatsApp-style status message?
   - Examples: "Available", "Busy", "At work", custom text
   - **Recommendation**: Nice to have if time allows, not critical

#### Dependencies
- None (pure client + Firestore update)

#### Implementation Phases

**Phase 1: Basic Edit** (1-2 days)
1. Add "Edit Profile" button in profile screen
2. Modal/screen with text input for display name
3. Validation (min 2 chars, max 50)
4. Save → update Firestore
5. Update local state/context

**Phase 2: Polish** (0.5-1 day)
6. Add loading state while saving
7. Error handling (network error, validation)
8. Success message
9. Character counter (50 remaining)

**Phase 3: Status Message** (1 day, optional)
10. Add status message field
11. Display in profile screen
12. Display in chat list/header (small text)

#### Testing Checklist
- [ ] Edit display name
- [ ] Validation works (too short, too long)
- [ ] Save persists to Firestore
- [ ] Updated name shows in profile screen
- [ ] Updated name shows in new messages
- [ ] Updated name shows in chat list
- [ ] Error handling works (network failure)

#### Risks & Mitigations
- **Risk**: Users change name to impersonate others
  - **Mitigation**: Not addressing in v1, add reporting in v2
- **Risk**: Offensive names
  - **Mitigation**: Basic profanity filter, reporting system in v2

---

### 1.4 People Tab with Search [v1-feat]

**Original Item**: "feat: people tab: display all users available with a search - implement pagination"

#### Description
Add a new "People" tab to browse all registered users, search by name/email, and start new conversations. This is essential for user discovery since currently users need to know email addresses to start chats.

#### User Story
```
As a user
I want to see all available users
So that I can find and chat with people without knowing their email
```

#### Technical Requirements

**Client-Side**:
- New tab in bottom navigation: "People"
- List of all users (FlatList)
- Search bar at top (filter by display name or email)
- Tap user → view mini profile or start chat
- Pagination: Load 20 users at a time

**Backend**:
- Query users collection
- Implement pagination (Firestore cursor-based)
- Security rules: Allow all authenticated users to read user list
- Consider: Index on displayName for search

**Firestore Query**:
```typescript
// Initial load
const usersQuery = query(
  collection(db, 'users'),
  orderBy('displayName'),
  limit(20)
);

// Search
const searchQuery = query(
  collection(db, 'users'),
  where('displayName', '>=', searchTerm),
  where('displayName', '<=', searchTerm + '\uf8ff'),
  limit(20)
);

// Pagination (load more)
const nextPageQuery = query(
  collection(db, 'users'),
  orderBy('displayName'),
  startAfter(lastUser),
  limit(20)
);
```

#### Open Questions

1. **User List Scope**:
   - Q: Show all users or only those with profiles set up?
   - **Recommendation**: Show all authenticated users who have displayName set

2. **Search Implementation**:
   - Q: Which search method to use?
   - Options:
     - A) Firestore query with `>=` and `<=` (basic, works for prefixes)
     - B) Client-side filter (load all users, filter locally)
     - C) Algolia or other search service (overkill for v1)
   - **Recommendation**:
     - If < 100 users: Load all, filter client-side
     - If 100-1000 users: Firestore prefix query
     - If > 1000 users: Consider Algolia in v2

3. **What to Display**:
   - Q: What info to show in user list?
   - **Recommendation**:
     - Profile image (or initials)
     - Display name (bold)
     - Email (small, gray)
     - Online status (green dot) - if presence implemented

4. **Pagination Strategy**:
   - Q: Load more button or infinite scroll?
   - **Recommendation**: Infinite scroll (detect near end, load more)

5. **Start Chat Action**:
   - Q: When tapping user, what happens?
   - Options:
     - A) Show mini profile with "Message" button
     - B) Directly create/open chat
     - C) Show modal: "Start chat with {name}?"
   - **Recommendation**: Option C (confirmation modal) to avoid accidental chats

6. **Performance**:
   - Q: With 1000+ users, will list be slow?
   - **Recommendation**: Virtualized list (FlatList handles this), pagination helps

#### Dependencies
- None (pure Firestore query + FlatList)

#### Implementation Phases

**Phase 1: Basic List** (2-3 days)
1. Add "People" tab to navigation
2. Fetch first 20 users, sorted by name
3. Display in FlatList with profile images
4. Tap user → confirmation modal
5. Confirm → create/open direct conversation

**Phase 2: Search** (1-2 days)
6. Add search bar
7. Implement search query (prefix match on displayName)
8. Debounce search input (300ms)
9. Show "No results" state

**Phase 3: Pagination** (1-2 days)
10. Detect scroll near end
11. Load next 20 users
12. Show loading indicator at bottom
13. Handle end of list (no more users)

**Phase 4: Polish** (1 day)
14. Add loading states
15. Add empty state ("No users yet")
16. Add online status indicators
17. Optimize performance

#### UI/UX Considerations

**Search Bar**:
```
┌──────────────────────────────┐
│  🔍 Search people...         │
└──────────────────────────────┘
```

**User List Item**:
```
┌──────────────────────────────┐
│  [👤] John Doe              │
│       john@example.com       │
│       🟢 Online              │
└──────────────────────────────┘
```

**Tap → Modal**:
```
┌──────────────────────────────┐
│         John Doe             │
│    john@example.com          │
│                              │
│  [Cancel]  [Start Chat]      │
└──────────────────────────────┘
```

#### Testing Checklist
- [ ] People tab appears in navigation
- [ ] User list loads (first 20 users)
- [ ] Profile images/initials show correctly
- [ ] Search filters users by name
- [ ] Search works with partial names
- [ ] Pagination loads more users on scroll
- [ ] Tap user → shows modal
- [ ] "Start Chat" creates conversation
- [ ] "Start Chat" navigates to chat screen
- [ ] Performance good with 100+ users

#### Security Considerations
- Update Firestore rules to allow all authenticated users to read users collection
- Ensure only displayName, email, profileImageUrl are exposed (not sensitive fields)

#### Risks & Mitigations
- **Risk**: Privacy - users may not want to be listed
  - **Mitigation**: Not addressing in v1, add "Hide from search" setting in v2
- **Risk**: Search performance poor with many users
  - **Mitigation**: Pagination + consider Algolia if growth exceeds 1000 users

---

### 1.5 New Conversation Direct Chat [v1-feat]

**Original Item**: "feat: new conversation: direct chat uses" (incomplete in backlog)

#### Description
Currently, starting a new conversation may require knowing a user's email or ID. With the People tab, users can now easily start direct (1-on-1) chats. This item ensures the "new conversation" flow is smooth and uses the direct chat type correctly.

#### Inferred Requirements
Based on context from MVP architecture docs:

**Current Behavior** (as of MVP):
- Create conversation manually (possibly hardcoded)
- Conversation type: 'direct' or 'group'
- Participants array

**Desired Behavior**:
- User selects another user from People tab
- System checks if direct conversation already exists between them
- If exists: Open existing conversation
- If not: Create new direct conversation, navigate to it
- Conversation should appear in both users' chat lists

#### Technical Requirements

**Client-Side**:
- "Start Chat" action from People tab
- Check for existing direct conversation
- Create new conversation if needed
- Navigate to chat screen

**Backend**:
- `findDirectConversation(user1Id, user2Id)` - already in MVP
- `createConversation(participants, type)` - already in MVP
- Ensure conversation appears in both users' chat lists immediately

#### Open Questions

1. **Conversation Creation Timing**:
   - Q: When to create conversation document?
   - Current issue (from backlog): "new conversation appears in counter-party's chats list before the first message is sent"
   - Options:
     - A) Create conversation when user taps "Start Chat"
     - B) Create conversation when first message is sent (lazy creation)
   - **Recommendation**: Option B (lazy creation) to avoid empty conversations
   - **Note**: This addresses bug 2.1 (see below)

2. **Empty Conversation State**:
   - Q: If conversation created but no messages, what to show?
   - **Recommendation**: Show placeholder "Send a message to start the conversation"

3. **Duplicate Prevention**:
   - Q: Ensure no duplicate direct conversations?
   - **Recommendation**: Always check `findDirectConversation` before creating

#### Dependencies
- People tab (1.4) should be implemented first
- Conversation service methods (already in MVP)

#### Implementation Phases

**Phase 1: Integration with People Tab** (1 day)
1. Wire "Start Chat" button to check existing conversation
2. If exists: Navigate to chat
3. If not: Navigate to chat with "pending" state

**Phase 2: Lazy Conversation Creation** (1-2 days)
4. Chat screen detects "pending" conversation (no ID yet)
5. When user types first message, create conversation
6. Send message in new conversation
7. Update UI with real conversation ID

#### Testing Checklist
- [ ] Tap "Start Chat" with user who has existing conversation → opens existing
- [ ] Tap "Start Chat" with new user → opens empty chat
- [ ] Send first message in new chat → creates conversation
- [ ] Conversation appears in recipient's chat list after first message
- [ ] No duplicate conversations created

#### Risks & Mitigations
- **Risk**: Race condition - both users start chat simultaneously
  - **Mitigation**: Check for existing conversation before creating, handle duplicate error

---

### 1.6 Typing Indicator [v1-feat]

**Original Item**: "feat: add a 'is typing' indicator"

#### Description
Show "User is typing..." indicator in chat screen when the other person is actively typing a message. This provides real-time feedback and makes conversations feel more dynamic.

#### User Story
```
As a user
I want to see when someone is typing
So that I know they're actively responding
```

#### Technical Requirements

**Client-Side**:
- Detect when user is typing (text input onChange)
- Send "typing" event when user starts typing
- Send "stopped typing" event when user stops (debounced)
- Display "{Name} is typing..." below chat header or above input

**Backend**:
- **Challenge**: Firestore is too slow for real-time typing indicators
- **Solution**: Use Firebase Realtime Database (RTDB) for presence/typing
- Store typing state: `/typing/{conversationId}/{userId}` = timestamp

**Typing State Structure (RTDB)**:
```json
{
  "typing": {
    "conv-123": {
      "user-456": 1698765432000,  // timestamp when started typing
      "user-789": null             // stopped typing
    }
  }
}
```

**Client Logic**:
```typescript
// When user types
onTextChange = (text: string) => {
  if (text.length > 0 && !isTyping) {
    setTypingState(conversationId, userId, true);
    setIsTyping(true);
  }

  // Debounce: Stop typing after 2 seconds of inactivity
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    setTypingState(conversationId, userId, false);
    setIsTyping(false);
  }, 2000);
};

// When user sends message
onSend = () => {
  setTypingState(conversationId, userId, false);
  setIsTyping(false);
  // ... send message
};
```

**Display Logic**:
```typescript
// Subscribe to typing state
const typingUsers = useTypingState(conversationId);

// Filter out current user
const othersTyping = typingUsers.filter(u => u.id !== currentUserId);

// Display
if (othersTyping.length === 1) {
  return `${othersTyping[0].name} is typing...`;
} else if (othersTyping.length === 2) {
  return `${othersTyping[0].name} and ${othersTyping[1].name} are typing...`;
} else if (othersTyping.length > 2) {
  return `${othersTyping.length} people are typing...`;
}
```

#### Open Questions

1. **Infrastructure Choice**:
   - Q: Use Firestore or Realtime Database?
   - Firestore: Too slow for typing indicators (>100ms latency)
   - Realtime Database: Designed for real-time, <50ms latency
   - **Recommendation**: Use Firebase Realtime Database (RTDB)
   - **Note**: Requires additional Firebase service setup

2. **RTDB Setup**:
   - Q: Do we already have RTDB enabled?
   - **Action**: Check Firebase console, enable if not already
   - Cost: Free tier 1GB stored, 10GB downloaded/month
   - Typing indicators are lightweight, well within free tier

3. **Typing Timeout**:
   - Q: How long until "stopped typing"?
   - **Recommendation**: 2-3 seconds of no typing activity

4. **Group Chat Typing**:
   - Q: Show typing in group chats?
   - **Recommendation**: Yes, show up to 3 names, then "X people are typing"

5. **Fallback**:
   - Q: What if RTDB connection fails?
   - **Recommendation**: Gracefully degrade - no typing indicator, but chat still works

#### Dependencies
- Firebase Realtime Database (new dependency)
  - Install: `npm install firebase` (already installed, just enable RTDB)
- RTDB Security Rules

#### Implementation Phases

**Phase 1: RTDB Setup** (1 day)
1. Enable Realtime Database in Firebase console
2. Configure security rules
3. Add RTDB initialization to Firebase config

**Phase 2: Client Logic** (2-3 days)
4. Add typing detection in message input
5. Send typing state to RTDB (set/clear)
6. Subscribe to typing state in chat screen
7. Display typing indicator UI

**Phase 3: Polish** (1 day)
8. Handle group chat (multiple typers)
9. Cleanup typing state on disconnect (RTDB presence)
10. Debouncing and performance optimization

#### RTDB Security Rules
```json
{
  "rules": {
    "typing": {
      "$conversationId": {
        "$userId": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid == $userId"
        }
      }
    }
  }
}
```

#### UI Design
```
┌──────────────────────────────┐
│  < John Doe                  │
│    🟢 Online                 │
│    ✍️ typing...              │  ← Indicator here
└──────────────────────────────┘
│                              │
│  Message bubbles...          │
│                              │
└──────────────────────────────┘
│  [Type a message...]  [Send] │
└──────────────────────────────┘
```

#### Testing Checklist
- [ ] RTDB enabled and connected
- [ ] Typing indicator appears when other user types
- [ ] Indicator disappears after 2s of no typing
- [ ] Indicator disappears when message sent
- [ ] Works in 1-on-1 chats
- [ ] Works in group chats (multiple typers)
- [ ] Cleans up on disconnect
- [ ] Graceful degradation if RTDB unavailable

#### Risks & Mitigations
- **Risk**: RTDB adds complexity
  - **Mitigation**: Well-documented, simple use case
- **Risk**: Privacy concern (users know when you're typing)
  - **Mitigation**: Standard feature, expected behavior
- **Risk**: Performance impact
  - **Mitigation**: RTDB is lightweight, designed for this

---

## Bugs

### 2.1 Premature Conversation Visibility [v1-bug]

**Original Item**: "bug: new conversation appears in counter-party's chats list before the first message is sent"

#### Description
When User A starts a new conversation with User B (without sending a message yet), the empty conversation appears in User B's chat list. This creates confusion and clutter. Conversations should only appear in the recipient's list after the first message is sent.

#### Current Behavior
1. User A taps "Start Chat" with User B
2. System creates conversation document immediately
3. Conversation appears in both users' chat lists
4. User B sees empty conversation before User A sends anything

#### Expected Behavior
1. User A taps "Start Chat" with User B
2. Chat screen opens in "pending" state (no conversation ID yet)
3. Conversation document NOT created yet
4. User A types and sends first message
5. NOW conversation is created
6. Conversation appears in both users' chat lists

#### Root Cause
Conversation document is created too early in the flow, likely in the `createConversation` service call when user taps "Start Chat" button.

#### Technical Solution

**Option 1: Lazy Conversation Creation (Recommended)**
- Don't create conversation until first message is sent
- Chat screen operates in "draft" mode with pending state
- On first message send:
  1. Create conversation document
  2. Send first message
  3. Update UI with real conversation ID

**Option 2: Hidden Flag**
- Create conversation immediately but add `visible: false`
- Set `visible: true` when first message is sent
- Filter conversations in chat list query by `visible === true`
- **Drawback**: More complex, adds field to schema

**Recommendation**: Option 1 (lazy creation) is cleaner

#### Implementation

**Changes Needed**:

1. **People Tab / Start Chat Flow**:
```typescript
// Before (problematic)
const handleStartChat = async (otherUserId: string) => {
  const conversationId = await createConversation({
    participants: [currentUserId, otherUserId],
    type: 'direct',
  });
  router.push(`/chat/${conversationId}`);
};

// After (fixed)
const handleStartChat = async (otherUserId: string) => {
  // Check if conversation already exists
  const existing = await findDirectConversation(currentUserId, otherUserId);

  if (existing) {
    router.push(`/chat/${existing.id}`);
  } else {
    // Navigate with "pending" param
    router.push(`/chat/new?with=${otherUserId}`);
  }
};
```

2. **Chat Screen**:
```typescript
// Detect pending conversation
const { id } = useLocalSearchParams();
const isPending = id === 'new';
const otherUserId = useSearchParams().get('with');

const handleSendMessage = async (text: string) => {
  if (isPending) {
    // Create conversation first
    const conversationId = await createConversation({
      participants: [currentUserId, otherUserId],
      type: 'direct',
    });

    // Send message
    await sendMessage({
      conversationId,
      text,
    }, currentUserId, currentUserName);

    // Update URL to real conversation ID
    router.replace(`/chat/${conversationId}`);
  } else {
    // Normal message send
    await sendMessage({ conversationId: id, text }, ...);
  }
};
```

3. **Services - Remove Premature Creation**:
- Remove any code that creates conversations before first message

#### Testing Checklist
- [ ] Start chat with new user → no conversation in their list yet
- [ ] Send first message → conversation appears in both lists
- [ ] Start chat with existing user → opens existing conversation
- [ ] Recipient receives notification only when first message sent

#### Acceptance Criteria
- Empty conversations do not appear in chat lists
- Conversations only appear after first message is sent
- Existing conversations still open normally

---

### 2.2 Keyboard Layout Handling [v1-bug]

**Original Item**: "bug: chat/[id] screen input box doesn't handle lower keyboard layout correctly"

#### Description
The message input box at the bottom of the chat screen doesn't adjust correctly when the keyboard appears, especially on Android. The input may be covered by the keyboard, or the chat messages may not scroll properly to keep the latest message visible.

#### Current Behavior
- Keyboard appears and covers the input box, or
- Input moves up but messages don't scroll to show latest, or
- Layout shifts incorrectly leaving gaps

#### Expected Behavior
- When keyboard appears, input box moves up smoothly
- Latest message remains visible (chat scrolls up with keyboard)
- No gap between keyboard and input box
- Works on both iOS and Android

#### Root Cause
Likely using incorrect `KeyboardAvoidingView` behavior or missing proper configuration for Android vs iOS.

#### Technical Solution

**Use `KeyboardAvoidingView` with correct settings**:
```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // Adjust based on header height
>
  <FlatList
    data={messages}
    renderItem={renderMessage}
    contentContainerStyle={{ flexGrow: 1 }}
    keyboardDismissMode="interactive"
    keyboardShouldPersistTaps="handled"
  />

  <MessageInput onSend={handleSend} />
</KeyboardAvoidingView>
```

**Alternative: Use `react-native-keyboard-controller`**
- More advanced keyboard handling
- Smooth animations
- Better Android support

#### Implementation Steps

**Phase 1: Basic Fix** (0.5-1 day)
1. Wrap chat screen in `KeyboardAvoidingView`
2. Set correct behavior for iOS vs Android
3. Adjust vertical offset to account for header
4. Test on both platforms

**Phase 2: Scroll Behavior** (0.5 day)
5. Auto-scroll to bottom when keyboard opens
6. Scroll to bottom when new message arrives
7. Don't auto-scroll if user is scrolled up (reading history)

**Phase 3: Advanced** (1 day, optional)
8. Install `react-native-keyboard-controller` if issues persist
9. Smooth keyboard animations
10. Handle keyboard dismiss on scroll

#### Testing Checklist
- [ ] Open keyboard → input visible (not covered)
- [ ] Latest message visible when keyboard opens
- [ ] Type message → input expands correctly
- [ ] Send message → keyboard can stay open (doesn't dismiss)
- [ ] Tap outside input → keyboard dismisses
- [ ] Scroll up in messages → keyboard dismisses (optional)
- [ ] Test on iOS physical device
- [ ] Test on Android physical device
- [ ] Test on various screen sizes

#### Platform-Specific Notes

**iOS**:
- Use `behavior="padding"`
- Usually works well with default settings

**Android**:
- Use `behavior="height"` or no behavior
- May need `android:windowSoftInputMode="adjustResize"` in AndroidManifest.xml
- Consider `react-native-keyboard-controller` for better control

#### Risks & Mitigations
- **Risk**: Fix works on one platform, breaks on other
  - **Mitigation**: Test on both platforms, use Platform-specific code
- **Risk**: Keyboard animations janky
  - **Mitigation**: Use `react-native-keyboard-controller` for smooth animations

---

### 2.3 Presence Permission Error [v1-bug]

**Original Item**: "bug: permission err on login screen for presence"

#### Description
When user logs in, there is a permission error related to presence tracking (online/offline status). This may prevent users from updating their lastSeen timestamp or cause errors in the console.

#### Current Behavior
- User logs in
- Presence service tries to update lastSeen
- Permission denied error (Firestore security rules)
- Error appears in console or visible to user

#### Expected Behavior
- User logs in
- Presence service successfully updates lastSeen
- No errors

#### Root Cause
Likely one of:
1. Firestore security rules don't allow users to update their own `users/{userId}` document
2. User document doesn't exist yet when presence tracking starts
3. Presence service runs before authentication is fully complete

#### Technical Investigation

**Check Security Rules**:
```javascript
// Current rules (from MVP architecture)
match /users/{userId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn() && request.auth.uid == userId;
  allow update: if isSignedIn() && request.auth.uid == userId;
  allow delete: if false;
}
```

**Rules look correct**, so issue is likely:
- User document not created yet, OR
- Presence tracking starts before auth completes

#### Technical Solution

**Option 1: Ensure User Document Exists**
```typescript
// In auth context, after login
const handleLogin = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;

  // Check if user document exists
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    // Create user document (should happen on signup, but safety check)
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email: userCredential.user.email,
      displayName: email.split('@')[0], // Default
      createdAt: Timestamp.now(),
      lastSeen: Timestamp.now(),
      online: true,
    });
  }

  // NOW start presence tracking
  startPresenceTracking(userId);
};
```

**Option 2: Add Error Handling in Presence Service**
```typescript
// In services/presence.ts
export const updatePresence = async (userId: string, online: boolean = true): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastSeen: Timestamp.now(),
      online,
    });
  } catch (error: any) {
    if (error.code === 'not-found') {
      // User document doesn't exist, create it
      await setDoc(userRef, {
        id: userId,
        lastSeen: Timestamp.now(),
        online,
      }, { merge: true });
    } else if (error.code === 'permission-denied') {
      console.error('Permission denied updating presence:', error);
      // Don't throw, just log - graceful degradation
    } else {
      console.error('Error updating presence:', error);
    }
  }
};
```

**Option 3: Wait for Auth State**
```typescript
// In presence context
export function PresenceProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return; // Wait until user is defined

    // Small delay to ensure user document exists
    const timer = setTimeout(() => {
      startPresenceTracking(user.uid);
    }, 500);

    return () => {
      clearTimeout(timer);
      stopPresenceTracking(user.uid);
    };
  }, [user]);

  return <PresenceContext.Provider value={{}}>{children}</PresenceContext.Provider>;
}
```

#### Implementation Steps

**Phase 1: Investigation** (0.5 day)
1. Reproduce the error
2. Check Firestore security rules
3. Check if user document exists after login
4. Check timing of presence tracking vs auth complete

**Phase 2: Fix** (0.5-1 day)
5. Implement chosen solution (likely Option 1 + Option 2)
6. Add error handling in presence service
7. Ensure user document creation is robust
8. Add delay if needed

**Phase 3: Validation** (0.5 day)
9. Test login flow (new user)
10. Test login flow (existing user)
11. Verify no permission errors
12. Check Firestore logs

#### Testing Checklist
- [ ] New user signup → no permission error
- [ ] Existing user login → no permission error
- [ ] User document created if missing
- [ ] Presence tracking starts successfully
- [ ] lastSeen updates every 30 seconds
- [ ] No errors in console
- [ ] Security rules still secure (users can only update own)

#### Acceptance Criteria
- No permission errors on login
- Presence tracking works correctly
- User documents always exist after login
- Graceful error handling if issues occur

---

## Summary & Prioritization

### Estimated Timeline

| Item | Type | Estimated Effort | Priority |
|------|------|-----------------|----------|
| 1.1 Image Support | Feature | 5-7 days | High |
| 1.2 Profile Image | Feature | 4-5 days | High |
| 1.3 Profile Edit | Feature | 2-3 days | Medium |
| 1.4 People Tab | Feature | 5-7 days | High |
| 1.5 Direct Chat Fix | Feature | 1-2 days | High (prerequisite for 1.4) |
| 1.6 Typing Indicator | Feature | 4-5 days | Medium |
| 2.1 Conversation Visibility Bug | Bug | 1-2 days | High |
| 2.2 Keyboard Bug | Bug | 1-2 days | High |
| 2.3 Presence Permission Bug | Bug | 1-2 days | High |

**Total Estimated Effort**: 24-35 days

### Recommended Implementation Order

**Sprint 1: Critical Bugs (1 week)**
1. Fix presence permission error (2.3) - 1-2 days
2. Fix keyboard handling (2.2) - 1-2 days
3. Fix conversation visibility (2.1) - 1-2 days
4. Fix direct chat flow (1.5) - 1-2 days

**Sprint 2: User Discovery (1-2 weeks)**
5. People tab with search and pagination (1.4) - 5-7 days
6. Profile edit field (1.3) - 2-3 days

**Sprint 3: Media & Polish (2 weeks)**
7. Profile image upload (1.2) - 4-5 days
8. Image support in chats (1.1) - 5-7 days

**Sprint 4: Real-time Features (1 week)**
9. Typing indicator (1.6) - 4-5 days

### Dependencies Map

```
2.3 (presence bug) → 1.6 (typing indicator)
2.1 (conversation bug) → 1.4 (people tab)
1.5 (direct chat) → 1.4 (people tab)
1.4 (people tab) → 1.2 (profile images)
1.3 (profile edit) → 1.2 (profile images)
```

### Risk Assessment

**High Risk**:
- 1.1 Image support (storage costs, complexity)
- 1.6 Typing indicator (new infrastructure - RTDB)

**Medium Risk**:
- 1.4 People tab (search performance with scale)

**Low Risk**:
- All bugs (straightforward fixes)
- 1.2 Profile images (similar to chat images)
- 1.3 Profile edit (simple CRUD)

---

## Next Steps

1. Review this requirements document with team
2. Answer open questions for each item
3. Create detailed task breakdown for Sprint 1
4. Begin implementation in recommended order
5. Update backlog with completed items

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Status**: Ready for Review

# MVP Requirements - Chat Application

## Overview
This document elaborates on the raw requirements to build a lean, focused MVP chat application. The goal is to deliver core messaging functionality while keeping the implementation simple and maintainable.

## Design Principles
- **Lean First**: Implement only what's necessary for a working chat app
- **Iterate Fast**: Get to a usable product quickly, then enhance
- **Stable Foundation**: Leverage existing architecture (Firebase, Expo, React Native)
- **Security from Day 1**: No compromises on data protection
- **Real-time Core**: All messaging should feel instant

---

## 1. User Authentication & Profiles

### 1.1 Authentication (Already Implemented ✅)
**Status**: Working implementation exists

**Current Features**:
- Email/password signup
- Email/password login
- Session persistence across app restarts
- Automatic route protection

**MVP Additions**: None required - existing implementation is sufficient

### 1.2 User Profiles (New)
**Purpose**: Enable users to identify each other in conversations

**Requirements**:
- **Display Name**: User-set name (defaults to email username)
- **User ID**: Firebase Auth UID (already available)
- **Email**: From Firebase Auth (read-only in profile)
- **Profile Creation**: Auto-create on first login

**Out of Scope for MVP**:
- Profile photos/avatars (use initials instead)
- Bio or status messages
- Profile editing (display name set once on signup)
- Custom usernames (use email)

**Acceptance Criteria**:
- New users are prompted to set display name after signup
- Display names are shown in chat lists and message bubbles
- User can view their own profile (read-only for MVP)

---

## 2. One-on-One Chat

### 2.1 Chat List Screen
**Purpose**: Show all conversations the user is participating in

**Requirements**:
- **List View**: Scrollable list of conversations
- **Conversation Preview**:
  - Other user's display name
  - Last message text (truncated to 1 line)
  - Timestamp of last message (relative: "2m ago", "Yesterday", "Dec 15")
  - Unread indicator (dot or badge)
- **Sorting**: Most recent conversation at top
- **Create New Chat**: Button/action to start conversation with another user
- **Tap to Open**: Tapping a conversation opens the chat screen

**Out of Scope for MVP**:
- Search/filter conversations
- Swipe actions (delete, archive, mute)
- Conversation pinning
- Typing indicators in list
- Profile pictures

**Acceptance Criteria**:
- User sees list of all their conversations on app launch
- List updates in real-time when new messages arrive
- User can start new conversation by entering another user's email
- Tapping conversation navigates to chat screen

### 2.2 Chat Screen (Individual Conversation)
**Purpose**: Send and receive messages in real-time

**Requirements**:
- **Message Display**:
  - Messages in chronological order (oldest at top, newest at bottom)
  - Sender's display name above each message bubble
  - Message text in bubble (left-aligned for other user, right-aligned for current user)
  - Timestamp below each message (or grouped by time)
  - Distinct visual styling for sent vs received messages
- **Message Input**:
  - Text input field at bottom of screen
  - Send button (only enabled when text is non-empty)
  - Auto-scroll to bottom when new message arrives
- **Real-time Updates**: New messages appear instantly for both users
- **Message Pagination**: Load last 50 messages initially, with "Load More" at top

**Out of Scope for MVP**:
- Message editing or deletion
- Reply/thread features
- Reactions/emoji responses
- Media messages (images, videos, voice)
- Message forwarding
- Copy/select text functionality

**Acceptance Criteria**:
- User can type and send text messages
- Messages appear in conversation for both sender and recipient
- Messages persist across app restarts
- Conversation scrolls smoothly with good performance
- User can load older messages by scrolling to top

---

## 3. Group Chat (Basic)

### 3.1 Group Conversations
**Purpose**: Enable 3+ users to chat together

**Requirements**:
- **Group Creation**:
  - Create group by entering multiple user emails
  - Auto-generated group name: "User1, User2, User3" (first 3 names + count)
  - Creator is automatically added as participant
- **Group Chat UI**: Same as one-on-one chat with these additions:
  - Group name shown in header
  - Sender name shown above each message (since multiple senders)
- **Participant List**: Simple view showing all group members
- **Same Features**: All one-on-one chat features apply to groups

**Out of Scope for MVP**:
- Custom group names or descriptions
- Group photos/icons
- Admin roles or permissions
- Add/remove participants after creation
- Leave group functionality
- Group settings or management

**Acceptance Criteria**:
- User can create group with 2+ other users
- All participants see the group in their chat list
- Messages sent to group appear for all members
- User can see who is in the group

---

## 4. Real-time Message Delivery

### 4.1 Message Synchronization
**Purpose**: Ensure messages are delivered and synced across all devices

**Requirements**:
- **Push-based Updates**: Use Firestore real-time listeners (no polling)
- **Instant Delivery**: Message appears in recipient's chat within 1-2 seconds
- **Multi-device Sync**: If user is logged in on multiple devices, all devices receive messages
- **Firestore Persistence**: All messages stored permanently in Firestore

**Out of Scope for MVP**:
- Message delivery acknowledgments from server
- Network status indicators
- Retry logic for failed sends (rely on Firestore built-in retry)

**Acceptance Criteria**:
- Messages appear in real-time for all conversation participants
- Messages survive app restarts and device changes
- No manual refresh needed to see new messages

---

## 5. Optimistic UI Updates

### 5.1 Instant Message Feedback
**Purpose**: Make messaging feel fast and responsive

**Requirements**:
- **Immediate Display**: When user sends message, it appears in chat instantly
- **Local State**: Message added to local state before Firestore confirms
- **Pending Indicator**: Show subtle indicator that message is sending (gray text or spinner)
- **Update on Confirm**: Replace temp message with server version when Firestore confirms
- **Error Handling**: If send fails after 5 seconds, show error state and allow retry

**Implementation Notes**:
- Generate temporary local ID for pending messages
- Add to local message array immediately
- Send to Firestore in background
- Replace temp message when real message ID returns

**Out of Scope for MVP**:
- Optimistic updates for read receipts
- Optimistic conversation creation
- Complex conflict resolution

**Acceptance Criteria**:
- User sees their message appear instantly when they tap send
- Message shows "sending" state briefly
- If network is slow, user still sees message immediately
- Failed messages are marked visibly and can be retried

---

## 6. Online/Offline Status

### 6.1 User Presence Indicators
**Purpose**: Show when other users are online/available

**Requirements**:
- **Status Display**:
  - Online indicator (green dot) next to user name in chat list
  - "Online" or "Last seen X ago" in chat screen header
- **Presence Tracking**:
  - Mark user online when app is active
  - Mark user offline when app closes or goes to background
  - Update last seen timestamp on disconnect
- **Real-time Updates**: Status changes appear immediately

**Implementation Notes**:
- Use simple Firestore timestamp approach (update `lastSeen` every 30 seconds while active)
- User is "online" if `lastSeen` is within last 2 minutes
- Use app state listeners to detect background/foreground

**Out of Scope for MVP**:
- Typing indicators
- "Away" or custom statuses
- Privacy controls (hide last seen)
- Presence for group chats (too complex to show all statuses)

**Acceptance Criteria**:
- User sees green dot when another user is online
- User sees "Last seen 5m ago" when other user is offline
- Status updates in real-time without page refresh
- User's own status is updated automatically

---

## 7. Message Timestamps

### 7.1 Timestamp Display
**Purpose**: Show when messages were sent

**Requirements**:
- **Message-level Timestamps**: Each message has a timestamp
- **Display Format**:
  - Same day: "3:45 PM"
  - Yesterday: "Yesterday 3:45 PM"
  - Older: "Dec 15, 3:45 PM"
- **Grouping**: Optionally group messages by date with dividers ("Today", "Yesterday", "Dec 15")

**Out of Scope for MVP**:
- Timezone conversion (use device local time)
- Custom timestamp formats
- Edit timestamps ("edited 2m ago")

**Acceptance Criteria**:
- Every message displays a readable timestamp
- Timestamps are accurate and in local time
- Date dividers help organize long conversations

---

## 8. Message Read Receipts

### 8.1 Read Status Tracking
**Purpose**: Show when messages have been read

**Requirements**:
- **Read Tracking**:
  - Mark messages as read when user opens conversation
  - Store read status per message per user
- **Visual Indicators**:
  - Single checkmark: Message sent ✓
  - Double checkmark: Message read ✓✓
  - Show read status on sender's side only
- **Auto-mark as Read**: When user views conversation, all messages marked as read

**Implementation Notes**:
- Use `readBy` map in message document: `{ userId: timestamp }`
- Update `readBy` when user opens conversation or when new message arrives while conversation is open
- For group chats: Show "Read by 2/5" count instead of individual checkmarks

**Out of Scope for MVP**:
- Granular "seen by X, Y, Z" details in groups
- Read receipt privacy settings
- Delivered status (vs. read status)

**Acceptance Criteria**:
- In 1-on-1 chat, sender sees checkmark change when recipient reads message
- In group chat, sender sees count of how many members have read
- Messages are auto-marked as read when conversation is open

---

## 9. Push Notifications (Foreground Only for MVP)

### 9.1 Notification System
**Purpose**: Alert users to new messages when app is open

**Requirements**:
- **Foreground Notifications**: Show notification banner when app is open but user is in different screen
- **Notification Content**:
  - Sender name
  - Message preview (first 50 characters)
  - Tap to open conversation
- **Permission Request**: Request notification permission on first app launch

**Scope**:
- **MVP (Phase 1)**: Foreground/in-app notifications only
  - Easier to implement (no Cloud Functions needed)
  - No external push service required
  - Works while app is active

**Out of Scope for MVP**:
- Background push notifications (when app is closed)
- Lock screen notifications
- Notification badges (unread counts)
- Notification sounds (use default system sound)
- Notification actions (reply from notification)

**Future Enhancement** (Post-MVP):
- Full background push notifications via Cloud Functions + Expo Push Notification Service
- This requires significant additional infrastructure

**Acceptance Criteria**:
- User sees in-app notification banner when receiving message in background screen
- Tapping notification navigates to relevant chat
- User can grant notification permissions

---

## 10. Message Persistence

### 10.1 Data Durability
**Purpose**: Ensure messages are never lost

**Requirements**:
- **Cloud Storage**: All messages stored in Firestore (already satisfied by Firebase)
- **Offline Support**: Messages sent while offline are queued and sent when online
- **Cache**: Recent messages cached locally for fast loading

**Implementation Notes**:
- Firestore provides offline persistence automatically
- Enable Firestore offline persistence on initialization
- No additional implementation needed beyond Firestore SDK configuration

**Out of Scope for MVP**:
- Local database (SQLite) - rely on Firestore cache
- Message export/backup features
- Message deletion (server-side)

**Acceptance Criteria**:
- User can access recent messages without internet
- Messages sent offline are delivered when connection restores
- Conversation history loads quickly from cache

---

## Non-Functional Requirements

### Performance
- **Message Load Time**: Initial load of conversation < 1 second
- **Send Latency**: Message appears in sender's UI < 100ms (optimistic)
- **Real-time Latency**: Message appears for recipient < 2 seconds
- **Pagination**: Load 50 messages at a time to avoid memory issues

### Security
- **Authentication Required**: All features require logged-in user
- **Firestore Security Rules**: Users can only read/write their own conversations
- **No Public Data**: All conversations and messages are private to participants

### Scalability (MVP Targets)
- **Conversation Size**: Support up to 50 messages per conversation initially (with pagination for more)
- **Group Size**: Support up to 10 participants per group
- **User Load**: Handle 100 concurrent users (realistic for MVP)
- **Message Size**: Text messages up to 5000 characters

### Platform Support
- **iOS**: Full support (iPhone, iPad)
- **Android**: Full support
- **Web**: Full support (responsive design, works in browser)

---

## Feature Prioritization (Implementation Order)

### Phase 1: Foundation (Week 1-2)
1. User profiles with display names
2. Data model and Firestore collections
3. Firestore Security Rules
4. TypeScript types for all entities

### Phase 2: Core Messaging (Week 2-3)
5. Chat list screen with conversations
6. One-on-one chat screen with real-time messages
7. Message input and send functionality
8. Message pagination

### Phase 3: Enhanced UX (Week 3-4)
9. Optimistic UI for sending messages
10. Online/offline status indicators
11. Message timestamps with date grouping
12. Message read receipts

### Phase 4: Group Chat (Week 4-5)
13. Create group conversations
14. Group chat UI (sender names, participant list)
15. Group read receipt counts

### Phase 5: Notifications & Polish (Week 5-6)
16. Foreground push notifications
17. Notification permissions flow
18. Error handling and retry logic
19. Loading states and empty states
20. UI polish and testing

---

## Out of Scope (Future Enhancements)

These features are explicitly **NOT** part of MVP:

### User Features
- Profile photos/avatars
- User search by name
- User blocking
- Status messages or bios
- Custom themes

### Messaging Features
- Media messages (images, videos, audio)
- Voice messages
- File attachments
- Message editing
- Message deletion
- Message search
- Message forwarding
- Reactions/emoji responses
- Mentions (@user)
- Replies/threads

### Group Features
- Custom group names and descriptions
- Group photos
- Add/remove members after creation
- Leave group
- Admin/moderator roles
- Group permissions

### Advanced Features
- End-to-end encryption
- Message scheduling
- Disappearing messages
- Message translation
- Chatbots or automation
- Video/voice calls
- Screen sharing
- Location sharing

### Notifications
- Background/killed app push notifications (requires Cloud Functions)
- Notification badges
- Custom notification sounds
- Notification grouping
- Rich notifications with images

### Technical
- Message analytics
- User analytics
- A/B testing
- Performance monitoring
- Crash reporting
- CI/CD pipeline
- Automated testing
- Multi-language support
- Accessibility features (screen reader, etc.)

---

## Success Metrics

### MVP Launch Criteria
The MVP is ready to launch when:
1. ✅ User can create account and login
2. ✅ User can start 1-on-1 chat by entering email
3. ✅ User can send and receive text messages in real-time
4. ✅ User can create and participate in group chats
5. ✅ Messages persist across app restarts
6. ✅ User sees online/offline status
7. ✅ User sees read receipts
8. ✅ User sees timestamps on messages
9. ✅ Messages appear instantly (optimistic UI)
10. ✅ User receives foreground notifications
11. ✅ All data is secured with Firestore rules
12. ✅ App works on iOS, Android, and Web

### Key Performance Indicators (Post-Launch)
- **User Engagement**: Average messages sent per user per day
- **Retention**: Day 1, Day 7, Day 30 retention rates
- **Performance**: 95th percentile message send time < 3 seconds
- **Reliability**: < 1% message failure rate
- **Crash Rate**: < 0.5% session crash rate

---

## Risk Mitigation

### Technical Risks
- **Firestore Costs**: Monitor usage, implement pagination early
- **Real-time Performance**: Test with 10+ message/sec load
- **Offline Sync Conflicts**: Rely on Firestore's conflict resolution
- **Web Platform Issues**: Test thoroughly on web due to Firebase SDK differences

### Product Risks
- **Feature Creep**: Stick to this document, resist adding features
- **User Confusion**: Provide onboarding tooltips for first-time users
- **Missing Features**: Be clear MVP is limited, gather feedback for next iteration

---

## Timeline Estimate

**Total MVP Development Time**: 5-6 weeks (1 full-time developer)

This assumes:
- Existing foundation (auth, Firebase setup) is stable
- Developer is familiar with React Native and Firebase
- No major blockers or technical unknowns
- Focus on functionality over pixel-perfect design

---

## Conclusion

This MVP is designed to be the simplest viable version of a working chat application. It includes all core features needed for real-time messaging while deferring advanced features to future iterations. The focus is on:

1. **Shipping quickly** - Get to a working product in 5-6 weeks
2. **Learning from users** - Launch lean and gather feedback
3. **Building on a solid foundation** - Architecture that can scale with enhancements
4. **Security first** - No compromises on data protection

Once this MVP is validated, the roadmap can expand based on user feedback and priorities.

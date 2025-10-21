# MVP Development Workflows & Tips

## Overview

This document provides practical workflows, commands, and tips for working with the tech stack. Use these as quick references during development—no need to follow rigidly, but helpful to know what's available.

---

## Development Environment Setup

### Initial Setup (One Time)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your Firebase config to .env.local
# Get these from Firebase Console > Project Settings
```

### Starting Development Server

```bash
# Start Expo dev server (pick platform after)
npm start

# Or start specific platform directly:
npm run web       # Browser (fastest for development)
npm run ios       # iOS simulator (needs Xcode)
npm run android   # Android emulator (needs Android Studio)
```

**Tip**: Use web for fastest iteration, test native platforms at milestones.

---

## Firebase Workflows

### Firebase Console Access

**URL**: https://console.firebase.google.com

**Common Tasks**:
1. **View data**: Firestore Database > Data tab
2. **Check auth users**: Authentication > Users tab
3. **Edit security rules**: Firestore Database > Rules tab
4. **Monitor usage**: Firestore Database > Usage tab

### Viewing Firestore Data

**Manual inspection** (while developing):
1. Open Firebase Console
2. Go to Firestore Database
3. Browse collections: `users`, `conversations`, `conversations/{id}/messages`

**Tip**: Keep this tab open while developing to see data changes in real-time.

### Creating Test Data Manually

Sometimes easier to create test data in console than through app:

**Create a test user**:
```
Collection: users
Document ID: test-user-1
Fields:
  - email: "test@example.com"
  - displayName: "Test User"
  - createdAt: (timestamp) now
  - lastSeen: (timestamp) now
  - online: true
```

**Create a test conversation**:
```
Collection: conversations
Document ID: (auto-generated)
Fields:
  - participants: ["user-id-1", "user-id-2"] (array)
  - type: "direct"
  - createdAt: (timestamp) now
  - lastMessage: ""
  - lastMessageTime: (timestamp) now
  - unreadCount: {} (map)
```

**Create test messages**:
```
Collection: conversations/[conv-id]/messages
Document ID: (auto-generated)
Fields:
  - text: "Hello!"
  - senderId: "user-id-1"
  - senderName: "Test User"
  - timestamp: (timestamp) now
  - readBy: {} (map)
```

### Deploying Security Rules

**Option 1: Firebase CLI** (recommended)
```bash
# Install Firebase CLI (one time)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize (if not already done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

**Option 2: Firebase Console**
1. Go to Firestore Database > Rules tab
2. Copy/paste rules from `firestore.rules` file
3. Click "Publish"

**Tip**: Console is faster for quick iterations, CLI is better for version control.

### Checking Security Rules

**Test in Firebase Console**:
1. Firestore Database > Rules tab
2. Click "Rules Playground"
3. Simulate read/write operations with different auth states

**Test in app**:
- Try accessing data you shouldn't be able to
- Check browser/app console for permission errors

### Resetting Firestore Data

**Clear all data** (use with caution):
1. Firebase Console > Firestore Database
2. Click on collection (e.g., `conversations`)
3. Click "..." menu > Delete collection
4. Repeat for other collections

**Or use Firebase CLI**:
```bash
firebase firestore:delete --all-collections
```

**Tip**: Useful when schema changes and you want fresh start.

---

## Expo Workflows

### Platform-Specific Development

**Web** (fastest):
```bash
npm run web
```
- Opens in browser
- Fast refresh (~1 second)
- Full debugging in Chrome DevTools
- Best for UI iteration

**iOS Simulator**:
```bash
npm run ios
```
- Requires Xcode (Mac only)
- Slower refresh (~5-10 seconds)
- Test native features (push notifications, etc.)

**Android Emulator**:
```bash
npm run android
```
- Requires Android Studio
- Similar speed to iOS
- Test Android-specific behavior

**Physical Device**:
- Scan QR code from `npm start`
- Use Expo Go app
- Test real-world performance

### Clearing Cache

When things get weird (stale data, broken hot reload):

```bash
# Clear Expo cache
npx expo start --clear

# Or more aggressive:
rm -rf node_modules
rm -rf .expo
npm install
npx expo start --clear
```

### Debugging

**Console Logs**:
```typescript
console.log('Debug:', variable);
console.warn('Warning:', issue);
console.error('Error:', error);
```
- Shows in terminal and browser console
- Use liberally during development

**React DevTools**:
```bash
# Install (one time)
npm install -g react-devtools

# Run in separate terminal
react-devtools
```
- Inspect React component tree
- View props and state
- Helpful for debugging state issues

**Flipper** (advanced):
- Network inspector
- Firestore queries
- Performance profiling
- More setup required, skip for MVP

### Expo Router Navigation

**File-based routing**:
```
app/
  login.tsx           → /login
  (tabs)/
    chats.tsx         → /(tabs)/chats
    profile.tsx       → /(tabs)/profile
  chat/[id].tsx       → /chat/:id
```

**Navigating programmatically**:
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Navigate to route
router.push('/chat/abc123');

// Go back
router.back();

// Replace (no back navigation)
router.replace('/login');
```

**Getting route params**:
```typescript
import { useLocalSearchParams } from 'expo-router';

const { id } = useLocalSearchParams<{ id: string }>();
```

**Tip**: Test navigation by manually typing URLs in web browser.

---

## Firestore Patterns

### Real-time Listeners (Subscribe Pattern)

**Standard pattern** used throughout app:
```typescript
useEffect(() => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setData(data);
  });

  // IMPORTANT: Always cleanup
  return () => unsubscribe();
}, [userId]);
```

**Common mistakes**:
- ❌ Forgetting to return unsubscribe function → memory leaks
- ❌ Not handling loading states → flickering UI
- ❌ Not handling errors → silent failures

### Querying Data

**Get all documents** (one-time fetch):
```typescript
const snapshot = await getDocs(collection(db, 'users'));
const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**Get single document**:
```typescript
const docRef = doc(db, 'users', userId);
const docSnap = await getDoc(docRef);
if (docSnap.exists()) {
  const user = docSnap.data();
}
```

**Query with filters**:
```typescript
const q = query(
  collection(db, 'conversations'),
  where('participants', 'array-contains', userId),
  orderBy('lastMessageTime', 'desc'),
  limit(50)
);
```

**Pagination**:
```typescript
// First page
const firstPage = await getDocs(
  query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50))
);

// Next page
const lastVisible = firstPage.docs[firstPage.docs.length - 1];
const nextPage = await getDocs(
  query(
    collection(db, 'messages'),
    orderBy('timestamp', 'desc'),
    startAfter(lastVisible),
    limit(50)
  )
);
```

### Writing Data

**Add document** (auto-generated ID):
```typescript
const docRef = await addDoc(collection(db, 'messages'), {
  text: 'Hello',
  timestamp: Timestamp.now(),
  senderId: userId
});
const newId = docRef.id;
```

**Set document** (specific ID):
```typescript
await setDoc(doc(db, 'users', userId), {
  displayName: 'John',
  email: 'john@example.com'
});
```

**Update document** (partial):
```typescript
const docRef = doc(db, 'users', userId);
await updateDoc(docRef, {
  lastSeen: Timestamp.now(),
  online: true
});
```

**Batch writes** (atomic):
```typescript
const batch = writeBatch(db);

// Add message
const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
batch.set(msgRef, messageData);

// Update conversation
const convRef = doc(db, 'conversations', convId);
batch.update(convRef, { lastMessage: text });

await batch.commit(); // All or nothing
```

### Handling Timestamps

**Create timestamp**:
```typescript
import { Timestamp } from 'firebase/firestore';

const now = Timestamp.now();
```

**Convert to Date**:
```typescript
const date = timestamp.toDate();
```

**Store Date as Timestamp**:
```typescript
const timestamp = Timestamp.fromDate(new Date());
```

**Tip**: Always use Firestore Timestamps, not JavaScript Dates, for consistency.

### Array Operations

**Add to array**:
```typescript
import { arrayUnion } from 'firebase/firestore';

await updateDoc(docRef, {
  participants: arrayUnion('new-user-id')
});
```

**Remove from array**:
```typescript
import { arrayRemove } from 'firebase/firestore';

await updateDoc(docRef, {
  participants: arrayRemove('user-id-to-remove')
});
```

### Increment Operations

**Atomic increment**:
```typescript
import { increment } from 'firebase/firestore';

await updateDoc(docRef, {
  'unreadCount.userId': increment(1) // Increment by 1
});

await updateDoc(docRef, {
  'unreadCount.userId': increment(-1) // Decrement by 1
});
```

### Type Safety with Converters

**Define converter**:
```typescript
import { FirestoreDataConverter } from 'firebase/firestore';

const messageConverter: FirestoreDataConverter<Message> = {
  toFirestore: (message: Message) => ({
    text: message.text,
    senderId: message.senderId,
    timestamp: Timestamp.fromDate(message.timestamp),
    // ... other fields
  }),
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      text: data.text,
      senderId: data.senderId,
      timestamp: data.timestamp?.toDate() || new Date(),
      // ... other fields
    };
  },
};
```

**Use converter**:
```typescript
const q = query(
  collection(db, 'messages').withConverter(messageConverter)
);

const snapshot = await getDocs(q);
const messages: Message[] = snapshot.docs.map(doc => doc.data()); // Fully typed!
```

**Tip**: Converters are great for type safety, but optional for MVP. Add when types get complex.

---

## React Native / Expo Patterns

### FlatList for Performance

**Basic usage**:
```typescript
<FlatList
  data={messages}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <MessageBubble message={item} />}
  inverted // For chat (newest at bottom)
/>
```

**Performance optimizations**:
```typescript
<FlatList
  data={messages}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <MessageBubble message={item} />}

  // Performance props
  initialNumToRender={20}
  maxToRenderPerBatch={10}
  windowSize={10}
  removeClippedSubviews={true}

  // Pull to refresh
  onRefresh={handleRefresh}
  refreshing={isRefreshing}
/>
```

**Tip**: FlatList is much more performant than ScrollView for long lists.

### Keyboard Handling

**Avoid keyboard covering input**:
```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  keyboardVerticalOffset={100} // Adjust as needed
>
  {/* Your chat UI */}
</KeyboardAvoidingView>
```

**Dismiss keyboard when tapping outside**:
```typescript
import { TouchableWithoutFeedback, Keyboard } from 'react-native';

<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
  <View>
    {/* Content */}
  </View>
</TouchableWithoutFeedback>
```

### TextInput Best Practices

**Growing text input**:
```typescript
<TextInput
  multiline
  value={text}
  onChangeText={setText}
  placeholder="Type a message..."
  style={{ maxHeight: 100 }} // Prevent infinite growth
  onContentSizeChange={(e) => {
    // Optionally track height
  }}
/>
```

**Auto-focus on mount**:
```typescript
const inputRef = useRef<TextInput>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);

<TextInput ref={inputRef} />
```

### Image Handling (Future)

**When adding profile photos/media later**:
```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  style={{ width: 40, height: 40, borderRadius: 20 }}
  placeholder={blurhash} // Optional blur placeholder
  contentFit="cover"
  transition={200}
/>
```

**Tip**: `expo-image` is much better than React Native's default Image component.

---

## State Management Patterns

### Component State (useState)

**For local UI state**:
```typescript
const [text, setText] = useState('');
const [loading, setLoading] = useState(false);
const [messages, setMessages] = useState<Message[]>([]);
```

**When to use**: Form inputs, local toggles, component-specific data.

### Context (useContext)

**For global app state**:
```typescript
// context/chat.tsx
const ChatContext = createContext<ChatContextType>(defaultValue);

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);

  // Subscribe to Firestore here

  return (
    <ChatContext.Provider value={{ conversations }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);

// Usage in components
const { conversations } = useChat();
```

**When to use**: Auth state, current user, global data that many components need.

**Tip**: Don't over-use Context. It's fine to prop drill for 1-2 levels.

### Optimistic Updates Pattern

**Standard pattern for instant feedback**:
```typescript
const [pendingItems, setPendingItems] = useState([]);
const [serverItems, setServerItems] = useState([]);

// Combine for display
const allItems = [...serverItems, ...pendingItems];

const addItem = async (item) => {
  const tempId = `temp-${Date.now()}`;
  const pendingItem = { ...item, id: tempId, status: 'pending' };

  // Add to pending immediately
  setPendingItems(prev => [...prev, pendingItem]);

  try {
    // Send to server
    const result = await saveToFirestore(item);

    // Remove from pending (will appear in serverItems)
    setPendingItems(prev => prev.filter(p => p.id !== tempId));
  } catch (error) {
    // Mark as failed
    setPendingItems(prev =>
      prev.map(p => p.id === tempId ? { ...p, status: 'failed' } : p)
    );
  }
};
```

---

## Common Debugging Scenarios

### "No data showing up"

**Checklist**:
1. ✅ Check Firebase Console - is data there?
2. ✅ Check auth state - are you logged in?
3. ✅ Check Firestore rules - do you have read permission?
4. ✅ Check query filters - are they too restrictive?
5. ✅ Check console for errors - any Firestore errors?
6. ✅ Add console.log to listener - is it being called?

**Quick test**:
```typescript
onSnapshot(q,
  (snapshot) => {
    console.log('Got data:', snapshot.docs.length, 'docs');
    console.log('First doc:', snapshot.docs[0]?.data());
  },
  (error) => {
    console.error('Snapshot error:', error);
  }
);
```

### "Data not updating in real-time"

**Checklist**:
1. ✅ Using `onSnapshot`, not `getDocs`?
2. ✅ Unsubscribe function returned in useEffect?
3. ✅ Dependencies array in useEffect correct?
4. ✅ Not creating new listener on every render?

**Pattern check**:
```typescript
// ✅ Correct
useEffect(() => {
  const unsubscribe = onSnapshot(q, callback);
  return () => unsubscribe();
}, [userId]); // Only re-subscribe if userId changes

// ❌ Wrong
useEffect(() => {
  onSnapshot(q, callback); // No cleanup!
}, []); // Missing dependencies
```

### "Permission denied" errors

**Check**:
1. Security rules deployed? (`firebase deploy --only firestore:rules`)
2. User logged in? (Check `auth.currentUser`)
3. Rules logic correct? (Test in Rules Playground)

**Temporary workaround** (dev only):
```javascript
// In firestore.rules - INSECURE, dev only!
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

### "App is slow/freezing"

**Common causes**:
1. Loading too much data (add pagination)
2. Too many listeners (check useEffect cleanups)
3. Not using FlatList for long lists
4. Re-rendering too often (use React.memo)

**Quick check**:
```typescript
// Add to component
useEffect(() => {
  console.log('Component rendered');
});
```
If this logs constantly, you have unnecessary re-renders.

### "Type errors"

**Quick fixes**:
```typescript
// ❌ Type error: data might be undefined
const userName = user.displayName;

// ✅ Optional chaining
const userName = user?.displayName;

// ✅ Fallback
const userName = user?.displayName || 'Anonymous';

// ❌ Type error: timestamp.toDate not a function
const date = data.timestamp.toDate();

// ✅ Check type first
const date = data.timestamp?.toDate?.() || new Date();
```

---

## Testing Workflows

### Manual Testing Checklist

**After each feature**:
- ✅ Works on web
- ✅ Works on iOS or Android
- ✅ Works when offline (if applicable)
- ✅ Handles empty states
- ✅ Handles errors (disconnect internet, invalid data)

**Before each milestone**:
- ✅ Test full user flow end-to-end
- ✅ Test with multiple users (use incognito/different devices)
- ✅ Check Firestore Console for correct data structure
- ✅ Verify security rules (try accessing other user's data)

### Testing with Multiple Users

**Option 1: Multiple browsers**
- Normal browser: User A
- Incognito window: User B
- Different browser: User C

**Option 2: Multiple devices**
- Phone + computer
- Phone + simulator

**Option 3: Multiple accounts**
- Create test emails: test1@example.com, test2@example.com
- Use Firebase Auth to create accounts

**Quick test flow**:
1. User A sends message
2. Check User B sees it in real-time
3. User B replies
4. Check User A sees reply
5. Check conversation appears in both users' chat lists

### Simulating Errors

**Network error**:
- Disconnect wifi/mobile data
- Try sending message
- Reconnect
- Verify message sends

**Slow network**:
- Chrome DevTools > Network tab > Throttling > Slow 3G
- Test loading states

**Empty states**:
- Fresh user account (no conversations)
- Conversation with no messages
- Verify UI handles gracefully

---

## Git Workflows

### Commit Strategy

**Commit after each task**:
```bash
git add .
git commit -m "feat: add basic message sending"
```

**Commit message format** (optional):
```
feat: add new feature
fix: bug fix
chore: maintenance task
docs: documentation
style: formatting
refactor: code restructure
test: add tests
```

**Before risky changes**:
```bash
git add .
git commit -m "checkpoint: working state before refactor"
```

### Branch Strategy (Optional for Solo)

**Simple flow**:
```bash
# Create feature branch
git checkout -b feature/chat-list

# Work on feature
git add .
git commit -m "feat: add chat list"

# Merge back to main
git checkout main
git merge feature/chat-list
```

**Tip**: Overkill for solo MVP. Just commit to main frequently.

### Undo Changes

**Undo uncommitted changes**:
```bash
git checkout -- filename.tsx  # Single file
git checkout -- .              # All files
```

**Undo last commit** (keep changes):
```bash
git reset HEAD~1
```

**Go back to previous commit** (lose changes):
```bash
git reset --hard HEAD~1  # BE CAREFUL!
```

---

## Environment Variables

### Managing Secrets

**File**: `.env.local` (not committed to git)

```bash
# Firebase config
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=myapp.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=myapp
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=myapp.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Usage**:
```typescript
const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
```

**Tip**: Variables must be prefixed with `EXPO_PUBLIC_` to be accessible.

### Multiple Environments (Future)

When you need dev/staging/prod:

**.env.development**:
```bash
EXPO_PUBLIC_FIREBASE_PROJECT_ID=myapp-dev
```

**.env.production**:
```bash
EXPO_PUBLIC_FIREBASE_PROJECT_ID=myapp-prod
```

**Tip**: Not needed for MVP. Single Firebase project is fine.

---

## Performance Monitoring

### Firebase Performance (Future)

When you need to monitor performance:

```bash
npx expo install expo-firebase-performance
```

**But for MVP**: Not necessary. Manual testing is sufficient.

### Checking Bundle Size

```bash
npx expo export --platform web
# Check dist folder size
```

**Tip**: Don't worry about this for MVP unless web bundle is >5MB.

---

## Useful Resources

### Official Docs
- **Expo**: https://docs.expo.dev
- **Expo Router**: https://docs.expo.dev/router/introduction/
- **Firebase**: https://firebase.google.com/docs
- **Firestore**: https://firebase.google.com/docs/firestore
- **React Native**: https://reactnative.dev/docs/getting-started

### When Stuck
1. Check official docs (usually best source)
2. Search Stack Overflow
3. Check Firebase samples: https://github.com/firebase/quickstart-js
4. Expo forums: https://forums.expo.dev

### Firebase Limits (Good to Know)

**Firestore free tier**:
- 50K reads/day
- 20K writes/day
- 1GB storage
- 10GB/month network

**Realistically**: Fine for 50-100 active users in MVP.

**Watch out for**:
- Real-time listeners count as 1 read per document per open connection
- Querying ALL messages = expensive (use pagination!)

---

## Quick Reference Commands

### Expo Commands
```bash
npm start              # Start dev server
npm run web            # Start web
npm run ios            # Start iOS
npm run android        # Start Android
npx expo install       # Install expo-compatible packages
npx expo start --clear # Clear cache
npx expo doctor        # Diagnose issues
```

### Firebase Commands
```bash
firebase login
firebase init
firebase deploy --only firestore:rules
firebase firestore:delete --all-collections  # Delete all data
firebase emulators:start                     # Start local emulators
```

### Git Commands
```bash
git status
git add .
git commit -m "message"
git push
git log --oneline
git diff
```

### NPM Commands
```bash
npm install
npm install package-name
npm uninstall package-name
npm outdated                    # Check for updates
npm run lint                    # Run linter
```

---

## Pro Tips

### Development Speed
- ✅ Use web platform for fastest iteration
- ✅ Keep Firebase Console open in separate tab
- ✅ Use `console.log` liberally
- ✅ Test native features only when needed
- ✅ Commit after each working task

### Avoiding Bugs
- ✅ Always return unsubscribe function in useEffect
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Validate user input before sending to Firestore
- ✅ Handle loading and error states
- ✅ Test with multiple users

### Staying Focused
- ✅ Follow task list in order
- ✅ Finish current task before starting next
- ✅ Resist urge to add features not in MVP
- ✅ Hardcode first, generalize later
- ✅ Manual testing is fine, automated tests can wait

### When Overwhelmed
1. Take a break
2. Review what's already working
3. Pick the smallest next task
4. Ask for help (Stack Overflow, forums)
5. Remember: MVP doesn't need to be perfect

---

## Conclusion

These workflows are here to help, not constrain you. Use what's useful, ignore what's not. The goal is to ship a working MVP, not to follow every best practice perfectly.

**Most important**:
- Commit often
- Test as you go
- Celebrate milestones
- Keep moving forward

Good luck! 🚀

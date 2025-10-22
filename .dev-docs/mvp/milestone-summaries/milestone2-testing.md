# Milestone 2: "Chat List" - Testing Guide

## 🎯 What to Test

Milestone 2 adds:
- Conversation list screen
- Create conversation functionality
- Tab navigation to Chats
- Real-time conversation updates

## ✅ Prerequisites

Before testing Milestone 2, ensure Milestone 1 is working:
- ✅ Firestore security rules deployed
- ✅ Can send and receive messages
- ✅ User is logged in

## 🧪 Test Scenarios

### Test 1: View Empty Conversation List

**Goal**: Verify empty state displays correctly

**Steps**:
1. Log in with a new account (no conversations yet)
2. Navigate to Chats tab (second tab)

**Expected**:
- ✅ See "No conversations yet" message
- ✅ See "Tap the + button to start a new chat" message
- ✅ See floating "+" button in bottom-right

**If it fails**:
- Check you're logged in
- Verify Chats tab is visible in navigation
- Check browser console for errors

---

### Test 2: Create New Conversation

**Goal**: Create a conversation from the UI

**Steps**:
1. Navigate to Chats tab
2. Tap the "+" button
3. Modal should appear
4. Enter another user's Firebase UID in the input
   - Get this from Firebase Console → Authentication → Users
   - Copy the User UID (not email)
5. Tap "Create" button

**Expected**:
- ✅ Modal appears with input field
- ✅ Can type in the input
- ✅ Tapping "Create" shows loading spinner
- ✅ Modal closes
- ✅ Navigated to the chat screen for new conversation
- ✅ Can send messages in the new chat

**If it fails**:
- **"Permission denied"**: Deploy Firestore security rules
- **"User not found"**: Verify the user ID exists in Firebase Auth
- **"Failed to create"**: Check browser console for error details

---

### Test 3: View Conversation List

**Goal**: Verify conversations appear in list

**Steps**:
1. Create 2-3 conversations using Test 2
2. Navigate back to Chats tab (tap back or use tab navigation)

**Expected**:
- ✅ See all created conversations in list
- ✅ Each conversation shows user ID(s) of other participant(s)
- ✅ Avatar placeholder shows first letter of user ID
- ✅ "Tap to open conversation" preview text

**If it fails**:
- Verify conversations exist in Firestore Console
- Check your user ID is in participants array
- Ensure Firestore security rules are deployed

---

### Test 4: Navigate to Chat

**Goal**: Verify tapping conversation opens chat

**Steps**:
1. View conversation list (should have at least 1 conversation)
2. Tap on a conversation

**Expected**:
- ✅ Navigate to chat screen
- ✅ See messages from that conversation
- ✅ Can send new messages
- ✅ Can navigate back to list

**If it fails**:
- Check conversation ID is valid
- Verify chat screen from Milestone 1 is working
- Check browser console for navigation errors

---

### Test 5: Real-time Conversation Updates

**Goal**: Verify new conversations appear instantly

**Setup**: Need two devices/browsers with different accounts

**Steps**:
1. **Device A**: Log in as User A, view Chats tab
2. **Device B**: Log in as User B
3. **Device B**: Create conversation with User A
4. **Device A**: Watch the Chats tab

**Expected**:
- ✅ New conversation appears on Device A instantly (within 1-2 seconds)
- ✅ No page refresh needed
- ✅ Conversation is clickable on Device A

**If it fails**:
- Verify both users are in participants array
- Check Firestore real-time listener is working
- Ensure no errors in console

---

### Test 6: Duplicate Conversation Prevention

**Goal**: Verify can't create duplicate conversations

**Steps**:
1. Create conversation with User B
2. Note the conversation ID
3. Try to create another conversation with same User B
4. Tap "Create"

**Expected**:
- ✅ See alert: "Conversation already exists"
- ✅ Modal closes
- ✅ Navigated to existing conversation (not new one)
- ✅ Can verify it's the same conversation by ID in URL

**If it fails**:
- Check `findDirectConversation()` function logic
- Verify participants array comparison
- Check browser console for errors

---

### Test 7: Cancel Create Conversation

**Goal**: Verify can cancel without creating

**Steps**:
1. Tap "+" button
2. Enter some text in input
3. Tap "Cancel" button

**Expected**:
- ✅ Modal closes
- ✅ No conversation created
- ✅ Input is cleared for next time
- ✅ Still on Chats tab

---

### Test 8: Loading States

**Goal**: Verify loading indicators appear

**Steps**:
1. Log out and log in (or refresh page)
2. Navigate to Chats tab
3. Observe loading state

**Expected**:
- ✅ See spinner with "Loading conversations..." text
- ✅ Loading state disappears when conversations load
- ✅ List appears or empty state shows

**Also test**:
4. Tap "+" button and create conversation
5. Observe "Create" button

**Expected**:
- ✅ "Create" button shows spinner while creating
- ✅ Button is disabled during creation
- ✅ Spinner disappears when done

---

### Test 9: Multiple Participants

**Goal**: Verify conversations with 3+ participants

**Steps**:
1. Manually create conversation in Firestore Console
2. Add 3+ user IDs to participants array
3. View conversation in Chats tab

**Expected**:
- ✅ Conversation appears in list
- ✅ Shows all participant IDs (comma-separated)
- ✅ Can tap to open
- ✅ All participants can see and send messages

**Note**: UI for creating group chats from app will be added in Milestone 10

---

### Test 10: Persistence

**Goal**: Verify conversations persist across sessions

**Steps**:
1. Create 2-3 conversations
2. Send messages in each
3. Close app/browser tab
4. Open app again and log in
5. Navigate to Chats tab

**Expected**:
- ✅ All conversations are still there
- ✅ Can open each conversation
- ✅ Messages are still there
- ✅ No data loss

---

## 🐛 Common Issues and Solutions

### Issue: Tab navigation doesn't show Chats tab

**Cause**: App needs rebuild after adding new tab

**Solution**:
```bash
# Stop the dev server
# Restart it
npm start
```

---

### Issue: "Permission denied" when loading conversations

**Cause**: Security rules not deployed or incorrect

**Solution**:
1. Deploy rules: `firebase deploy --only firestore:rules`
2. Verify rules in Firebase Console
3. Check participants array includes your user ID

---

### Issue: Conversations don't update in real-time

**Cause**: Listener not properly subscribed

**Solution**:
1. Check browser console for subscription errors
2. Verify Firestore connection is active
3. Test with manual refresh to see if data loads
4. Check `useEffect` cleanup is working

---

### Issue: Create conversation fails silently

**Cause**: Error not properly displayed or caught

**Solution**:
1. Open browser console
2. Look for error messages
3. Common errors:
   - Permission denied → Deploy security rules
   - Invalid user ID → Check user exists in Firebase Auth
   - Network error → Check internet connection

---

### Issue: Duplicate conversations not detected

**Cause**: Participant comparison not working

**Solution**:
1. Check both user IDs are in participants array
2. Verify `findDirectConversation()` logic
3. Ensure conversation has exactly 2 participants

---

## 📊 Success Metrics

### Milestone 2 is working if:

- ✅ Can create conversations from UI
- ✅ Conversations appear in list
- ✅ Can navigate to chat by tapping conversation
- ✅ Real-time updates work
- ✅ Duplicate prevention works
- ✅ Loading states appear
- ✅ Empty state shows when appropriate
- ✅ No errors in console
- ✅ Works on iOS, Android, and Web

### Performance Targets:

- Conversation list loads in < 2 seconds
- Create conversation completes in < 1 second
- Real-time updates appear in < 2 seconds
- No lag when scrolling list

---

## 🎓 Testing Tips

### Tip 1: Create Test Users

Create multiple test accounts for thorough testing:

1. Firebase Console → Authentication → Add User
2. Create users: test1@test.com, test2@test.com, etc.
3. Copy their UIDs for creating conversations
4. Keep a text file with UIDs for quick reference

### Tip 2: Use Chrome DevTools

- Open Console tab to see errors
- Use Network tab to monitor Firestore requests
- Check Application tab → IndexedDB for cached data

### Tip 3: Test on Multiple Devices

- Test on web browser
- Test on physical mobile device via Expo Go
- Test on two devices simultaneously for real-time features

### Tip 4: Clear Cache if Needed

If seeing stale data:
1. Clear browser cache and reload
2. Or use incognito/private window
3. Or uninstall/reinstall Expo Go app

---

## 📝 Test Results Template

Copy and fill out after testing:

```
Milestone 2 Testing - [Date]

✅ Test 1: Empty conversation list
✅ Test 2: Create new conversation
✅ Test 3: View conversation list
✅ Test 4: Navigate to chat
✅ Test 5: Real-time updates
✅ Test 6: Duplicate prevention
✅ Test 7: Cancel create
✅ Test 8: Loading states
✅ Test 9: Multiple participants
✅ Test 10: Persistence

Issues Found:
- [List any issues here]

Overall Status: ✅ PASS / ❌ FAIL

Notes:
- [Add any notes]
```

---

## 🚀 Ready for Milestone 3?

Once all tests pass, you're ready to proceed to:

**Milestone 3: "User Profiles"**
- Create user documents on signup
- Show display names instead of user IDs
- Store sender names in messages
- Much better UX!

See `.dev-docs/tasks-mvp.md` for details.

---

**Happy Testing!** 🎉

If you encounter issues not covered here, check:
- Browser console for errors
- Firebase Console → Firestore for data
- `.dev-docs/milestone2-summary.md` for implementation details

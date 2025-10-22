# Testing Milestone 14: Notifications

## Prerequisites

### Android Emulator Setup
1. **Install Android Studio** (if not already installed)
2. **Create an Android Virtual Device (AVD)**:
   - Open Android Studio → Tools → Device Manager
   - Create Device → Select Pixel 5 or similar
   - System Image: API 33 (Android 13) or higher
   - Finish setup

3. **Start the emulator**:
   ```bash
   # In Android Studio: Click "Play" button on your AVD
   # Or from terminal:
   emulator -avd <your_avd_name>
   ```

4. **Start Expo dev server**:
   ```bash
   npm start
   # Then press 'a' to open on Android
   ```

### Physical Android Device Setup
1. **Enable Developer Mode**:
   - Settings → About Phone → Tap "Build Number" 7 times
   
2. **Enable USB Debugging**:
   - Settings → Developer Options → USB Debugging → ON

3. **Connect device via USB**

4. **Start Expo**:
   ```bash
   npm start
   # Scan QR code with Expo Go app
   ```

## Test Scenarios

### Test 1: Permission Request ✅
**What to test**: Notification permission dialog appears

**Steps**:
1. Uninstall app (or clear app data)
2. Launch app
3. Login with your account
4. **Wait 1 second after login**
5. Permission dialog should appear

**Expected Result**:
- Dialog asks: "Allow notifications?"
- Options: "Allow" / "Don't Allow"

**Tap "Allow"**

---

### Test 2: Foreground Notification (Basic) ✅
**What to test**: Notification appears for new message

**Setup**:
- You need TWO user accounts
- Device A (you): Logged in as user1@test.com
- Device B (test partner): Logged in as user2@test.com
- Both users have a conversation together

**Steps**:
1. **Device A**: Open app, go to Chats tab (NOT inside conversation)
2. **Device B**: Open the conversation with Device A
3. **Device B**: Send a message: "Test notification!"
4. **Device A**: Look for notification banner at top of screen

**Expected Result**:
```
┌────────────────────────────────────┐
│  hello-expo                    now │
│  user2                             │
│  Test notification!                │
└────────────────────────────────────┘
```

**Check Console Logs**:
Look for:
```
🔔 NotificationsProvider: Showing notification for new message
Notification received: ...
```

---

### Test 3: NO Notification When Viewing Conversation ✅
**What to test**: Notification does NOT appear when viewing the conversation

**Steps**:
1. **Device A**: Open the conversation with Device B
2. **Device B**: Send a message
3. **Device A**: Should NOT see notification (you're already viewing it)

**Expected Result**:
- ❌ No notification banner
- ✅ Message appears in conversation normally

**Check Console Logs**:
```
🔔 ChatScreen: Setting current conversation to: <id>
```

---

### Test 4: Notification Tap Navigation ✅
**What to test**: Tapping notification opens the conversation

**Steps**:
1. **Device A**: Go to Chats tab (or Profile tab)
2. **Device B**: Send a message
3. **Device A**: Notification appears → TAP IT
4. **Device A**: Should navigate to the conversation

**Expected Result**:
- Conversation screen opens
- Message is visible
- Can reply immediately

**Check Console Logs**:
```
Notification tapped: ...
🔔 ChatScreen: Setting current conversation to: <id>
```

---

### Test 5: Multiple Conversations ✅
**What to test**: Notifications work for multiple conversations

**Setup**:
- Device A (you): Logged in as user1@test.com
- Device B: Logged in as user2@test.com
- Device C: Logged in as user3@test.com
- All users have conversations with Device A

**Steps**:
1. **Device A**: Stay on Chats tab
2. **Device B**: Send message in conversation B-A
3. **Device A**: See notification from user2
4. **Device C**: Send message in conversation C-A
5. **Device A**: See notification from user3

**Expected Result**:
- Two separate notifications
- Each shows correct sender name
- Each shows correct message preview

---

### Test 6: NO Notification for Own Messages ✅
**What to test**: Don't notify yourself

**Steps**:
1. **Device A**: Open any conversation
2. **Device A**: Send a message
3. **Device A**: Should NOT see notification

**Expected Result**:
- ❌ No notification
- ✅ Message appears with optimistic UI

---

### Test 7: Notification While in Different Tab ✅
**What to test**: Notifications work when in Profile or other tabs

**Steps**:
1. **Device A**: Go to Profile tab
2. **Device B**: Send a message
3. **Device A**: Notification should appear

**Expected Result**:
- ✅ Notification banner appears
- Tap to navigate to conversation

---

## Troubleshooting

### No Notification Appearing?

**Check 1: Permissions**
```bash
# In app, check console for:
"No notification permission granted, skipping notification"
```
→ Solution: Uninstall app, reinstall, grant permissions

**Check 2: App State**
```bash
# Check console for:
"App state: active"
```
→ Notifications only work when app is in foreground (active)

**Check 3: Current Conversation**
```bash
# Check if you're viewing the conversation:
"🔔 ChatScreen: Setting current conversation to: <id>"
```
→ Solution: Go to Chats tab, not inside conversation

**Check 4: Firestore Listeners**
```bash
# Check console for:
"🔔 NotificationsProvider: Monitoring X conversations"
```
→ If 0 conversations, check Firestore rules and data

**Check 5: Message Timestamp**
```bash
# Notification only shows for NEW messages after app starts
```
→ Solution: Send a message AFTER opening the app

### Notification Permission Denied?

**Android**:
1. Long press app icon
2. App Info → Notifications → Enable
3. Restart app

**Or**: Uninstall and reinstall app

### Console Debugging

Enable detailed logging:
```bash
# Check these logs in order:
1. "🔔 NotificationsProvider: Setting up notification listeners"
2. "🔔 NotificationsProvider: Monitoring X conversations"
3. "🔔 NotificationsProvider: Showing notification for new message"
4. "Notification received: ..."
```

If any step is missing, that's where the issue is.

---

## Quick Test Script

**30-Second Test**:
1. ✅ Open app on Android → Grant notification permission
2. ✅ Go to Chats tab
3. ✅ Have someone send you a message
4. ✅ See notification appear
5. ✅ Tap notification
6. ✅ Conversation opens

**If all 6 steps work → Milestone 14 is working! 🎉**

---

## Settings to Check

### Android Emulator Settings
- **Notifications Enabled**: Settings → Apps → hello-expo → Notifications → ON
- **Do Not Disturb**: OFF
- **Battery Optimization**: Settings → Apps → hello-expo → Battery → Unrestricted

### Expo Go Settings (if using)
- Make sure you're using **Expo Go 2.28+**
- Older versions may have notification bugs

---

## Known Limitations (Expected Behavior)

✅ **These are CORRECT and expected**:

1. **No notifications when app is closed**: This is MVP scope
   - Only foreground notifications implemented
   - Background push requires Cloud Functions (future)

2. **No notifications on web**: Web platform not supported
   - Use Android or iOS only

3. **No notification sound on first launch**: Permission needed first
   - Grant permission, then sounds work

4. **Notifications clear when opening conversation**: This is correct
   - Prevents notification spam

---

## Testing Checklist

Copy this checklist for your testing:

```
□ Permission dialog appears after login
□ Permission granted successfully
□ Notification appears for new message (on Chats tab)
□ Notification shows correct sender name
□ Notification shows message preview (truncated)
□ NO notification when viewing that conversation
□ NO notification for own messages
□ Tap notification opens conversation
□ Multiple conversation notifications work
□ Notifications work from Profile tab
□ Console logs show correct flow
□ No crashes or errors
```

**All checked? Milestone 14 is complete! ✅**

---

## Need Help?

Check console logs for these key indicators:

**✅ Working**:
```
🔔 NotificationsProvider: Setting up notification listeners
🔔 NotificationsProvider: Monitoring 3 conversations
🔔 NotificationsProvider: Showing notification for new message
Notification received: ...
```

**❌ Not Working**:
```
No notification permission granted, skipping notification
Error subscribing to conversations: ...
```


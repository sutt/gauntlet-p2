# Setup Development Build for Notifications Testing

## Why You Need This

Expo SDK 53+ removed notification support from Expo Go. You need a **Development Build** to test notifications.

**Development Build** = Expo Go + Your Native Modules (like notifications)

---

## Option 1: Build for Android (Easiest)

### Prerequisites
- Android Studio installed
- Android SDK configured
- Android Emulator or physical device

### Steps

**1. Install EAS CLI** (if not already installed):
```bash
npm install -g eas-cli
```

**2. Login to Expo**:
```bash
eas login
```

**3. Configure EAS Build**:
```bash
eas build:configure
```

**4. Create Development Build for Android**:
```bash
# For Android Emulator (x86_64)
eas build --profile development --platform android

# For Physical Device (arm64)
eas build --profile development --platform android --local
```

This will take **10-15 minutes** to build.

**5. Install the Build**:
```bash
# After build completes, download the .apk file
# Install on emulator:
adb install path/to/your-app.apk

# Or for physical device:
# Download the .apk from EAS dashboard
# Transfer to phone and install
```

**6. Start Development Server**:
```bash
npx expo start --dev-client
```

**7. Open app on device** → Notifications will work! ✅

---

## Option 2: Local Development Build (Faster)

If you have Android Studio set up properly:

**1. Generate native Android project**:
```bash
npx expo prebuild --platform android
```

**2. Run on Android**:
```bash
npx expo run:android
```

This builds and installs automatically. **Takes 5-10 minutes first time.**

**3. Test notifications** → Should work! ✅

---

## Option 3: Use Older Expo SDK (Quick Workaround)

**MANUAL: Not recommended, but if you need quick testing:**

Downgrade to SDK 52 where Expo Go still supports notifications:

```bash
# CAUTION: This may break other features
npm install expo@~52.0.0
npx expo install --fix
```

Then Expo Go will work for notifications.

**⚠️ Warning**: May cause compatibility issues with React 19.

---

## Recommended: Option 2 (Local Build)

**Why?**
- ✅ Fastest setup (5-10 min first time, instant after)
- ✅ Full native module support
- ✅ Easy to test notifications
- ✅ No EAS account needed
- ✅ Works offline

**How to do it:**

```bash
# 1. Generate native code
npx expo prebuild --platform android

# 2. Run on Android emulator or device
npx expo run:android

# 3. App installs and opens automatically
# 4. Test notifications - they work! 🎉
```

**After first build**, just use:
```bash
npx expo run:android
# Fast refresh works like Expo Go!
```

---

## What You'll See

### With Development Build (Working):
```
✅ Permission dialog appears
✅ Notifications display correctly
✅ Tap navigation works
✅ All features functional
```

### With Expo Go SDK 54 (Not Working):
```
⚠️ WARN: expo-notifications not fully supported
❌ ERROR: Android Push notifications removed from Expo Go
❌ Notifications won't appear
```

---

## Testing After Setup

Once you have development build:

**Terminal:**
```bash
npx expo run:android
# Or if using EAS build: npx expo start --dev-client
```

**On Device:**
1. App opens automatically
2. Login → Grant notification permission
3. Stay on Chats tab
4. Have someone send message
5. **Notification appears!** 🔔

All the test scenarios from `TESTING-NOTIFICATIONS.md` will work perfectly.

---

## Troubleshooting

### "Command not found: eas"
```bash
npm install -g eas-cli
```

### "Android build failed"
**Check:**
- Android Studio installed
- ANDROID_HOME environment variable set
- Android SDK 33+ installed

### "Can't connect to development build"
```bash
# Make sure you're using dev-client flag:
npx expo start --dev-client

# And device is on same network
```

---

## Time Estimates

| Method | First Time | After Setup |
|--------|-----------|-------------|
| EAS Build (Cloud) | 15-20 min | 5 min |
| Local Build | 5-10 min | 30 sec |
| Expo Go (SDK 52) | 1 min | 1 min |

**Recommended**: Local Build (Option 2)

---

## Summary

**Current Situation:**
- You're on Expo SDK 54
- Expo Go doesn't support notifications anymore
- You need a development build

**Solution:**
```bash
# Fastest way:
npx expo prebuild --platform android
npx expo run:android

# Wait 5-10 minutes first time
# Then notifications work! ✅
```

**Alternative:**
- Use EAS Build (cloud build, takes longer)
- Or downgrade to SDK 52 (not recommended)

---

## Next Steps

1. **Choose Option 2** (Local Build) for fastest setup
2. Run: `npx expo run:android`
3. Wait for build and install
4. Test notifications using scenarios from `TESTING-NOTIFICATIONS.md`
5. Everything should work! 🎉

The notification implementation is correct - you just need the proper build environment to test it.

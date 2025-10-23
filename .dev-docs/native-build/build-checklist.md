# Android Native Build Checklist

Quick reference checklist for building Android native app with EAS Build.

---

## Pre-Build Checklist

### Account Setup
- [ ] Expo account created
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into EAS (`eas login`)
- [ ] Verified account (`eas whoami`)

### Project Configuration
- [ ] `app.json` has unique package name (e.g., `com.yourname.hellomsg`)
- [ ] Version number set in `app.json` (e.g., "1.0.0")
- [ ] Version code set in `app.json` (e.g., 1)
- [ ] App icon exists at `./assets/icon.png` (1024x1024)
- [ ] Splash screen exists at `./assets/splash.png`
- [ ] Android permissions configured in `app.json`

### Firebase Configuration
- [ ] `google-services.json` downloaded from Firebase Console
- [ ] `google-services.json` placed in project root
- [ ] Firebase project matches package name
- [ ] Production environment variables configured

### EAS Configuration
- [ ] Run `eas build:configure`
- [ ] `eas.json` created and reviewed
- [ ] Build profiles configured (development, preview, production)

---

## First Build Checklist

### Development Build
- [ ] Run: `eas build --platform android --profile development`
- [ ] Build completes successfully
- [ ] Download APK from EAS dashboard
- [ ] Install on test device
- [ ] Test: Login/Signup
- [ ] Test: Messaging
- [ ] Test: Push notifications
- [ ] Test: AI features
- [ ] Test: All critical features work

### Preview Build
- [ ] Run: `eas build --platform android --profile preview`
- [ ] Build completes successfully
- [ ] Test on multiple devices
- [ ] Collect feedback from testers
- [ ] Fix any issues found

### Production Build
- [ ] All features tested and working
- [ ] Version numbers updated in `app.json`
- [ ] Run: `eas build --platform android --profile production`
- [ ] AAB file generated
- [ ] Backup keystore credentials
- [ ] Store keystore securely

---

## Credentials Checklist

### App Signing
- [ ] Keystore generated (by EAS or provided)
- [ ] Keystore backed up to secure location
- [ ] Keystore password documented
- [ ] Key alias documented

### Push Notifications
- [ ] FCM Server Key generated from Firebase Console
- [ ] FCM credentials added to EAS:
  ```bash
  eas credentials
  # Select Android > Push Notifications > FCM Server Key
  ```
- [ ] Test notifications in production build

---

## Google Play Store Checklist (Optional)

### Account Setup
- [ ] Google Play Console account created
- [ ] $25 registration fee paid
- [ ] Account verified

### App Listing
- [ ] App name finalized
- [ ] Short description written (80 chars max)
- [ ] Full description written (4000 chars max)
- [ ] Screenshots prepared (various sizes)
- [ ] Feature graphic created (1024x500)
- [ ] App icon uploaded (512x512)
- [ ] Category selected
- [ ] Content rating completed
- [ ] Privacy policy URL provided
- [ ] Pricing & distribution configured

### First Release
- [ ] Internal testing track created
- [ ] AAB uploaded from EAS Build
- [ ] Release notes written
- [ ] Submitted for review
- [ ] Monitoring review status

---

## Troubleshooting Checklist

### Build Fails
- [ ] Check EAS build logs for errors
- [ ] Verify all dependencies are compatible
- [ ] Check `app.json` for syntax errors
- [ ] Ensure Firebase config is correct
- [ ] Try clearing cache: `eas build --clear-cache`

### App Crashes
- [ ] Check production logs
- [ ] Test on different Android versions
- [ ] Verify all native modules are configured
- [ ] Check for missing permissions
- [ ] Review Firebase Rules for auth/Firestore access

### Push Notifications Not Working
- [ ] Verify `google-services.json` is correct
- [ ] Check FCM credentials in EAS
- [ ] Confirm notification permissions granted
- [ ] Test with Firebase Console → Cloud Messaging
- [ ] Check device has Google Play Services

---

## Version Bump Checklist

For each new release:

- [ ] Increment `versionCode` in `app.json` (always!)
- [ ] Update `version` in `app.json` (semantic versioning)
- [ ] Update release notes
- [ ] Test all changes
- [ ] Build and deploy
- [ ] Tag release in git: `git tag v1.0.0`

---

## Quick Commands Reference

```bash
# Login to EAS
eas login

# Configure project
eas build:configure

# Build for Android
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production

# View build status
eas build:list

# Manage credentials
eas credentials

# Submit to Play Store (after setup)
eas submit --platform android

# Publish OTA update
eas update --branch production --message "Fix: bug fix"
```

---

## Important Notes

⚠️ **CRITICAL:**
- **NEVER lose your keystore** - you cannot update the app without it
- **ALWAYS increment versionCode** for each Play Store submission
- **BACKUP credentials** immediately after first production build

💡 **TIPS:**
- Use `preview` profile for QA/testing before production
- Test on multiple devices and Android versions
- Start with internal testing before public release
- Use OTA updates for quick fixes, Play Store for major updates

📝 **DOCUMENTATION:**
- Document all credentials securely
- Keep track of version numbers
- Maintain release notes
- Document any build configuration changes

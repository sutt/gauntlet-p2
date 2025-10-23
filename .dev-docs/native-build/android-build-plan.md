# Android Native Build Plan - EAS Build

**Created:** 2025-10-23
**Target Platform:** Android
**Build Service:** EAS Build (Expo Application Services)
**Status:** Planning

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Task List](#task-list)
4. [Build Profiles](#build-profiles)
5. [Configuration Details](#configuration-details)
6. [Questions & Uncertainties](#questions--uncertainties)
7. [Resources](#resources)

---

## Overview

### Goals

- Build production-ready Android APK/AAB using EAS Build
- Set up development, preview, and production build profiles
- Configure app signing and credentials
- Prepare for Google Play Store distribution
- Establish CI/CD pipeline for automated builds

### Why EAS Build?

- **Cloud-based**: No need for local Android Studio/SDK setup
- **Managed credentials**: Automatic keystore generation and management
- **Free tier**: 30 builds/month for personal accounts
- **CI/CD ready**: Integrates with GitHub Actions
- **OTA updates**: Supports Expo Updates for rapid iterations

---

## Prerequisites

### Required Accounts

- [x] Expo account (already have - using Expo Go)
- [ ] EAS Build account (likely same as Expo)
- [ ] Google Play Console account (for store distribution)
  - Cost: $25 one-time registration fee
  - Required for: Publishing to Play Store

### Required Tools

- [x] Node.js & npm (already installed)
- [x] Expo CLI (already using)
- [ ] EAS CLI (`npm install -g eas-cli`)
- [ ] Git (for version control and CI/CD)

### Current Project Status

✅ **Working Features:**
- User authentication (Firebase Auth)
- Real-time messaging (Firestore)
- Push notifications (Expo Notifications)
- AI features (Translation, Firebase Functions)
- Works in Expo Go

⚠️ **Potential Issues:**
- Push notifications credentials (need production FCM setup)
- Environment variables (production Firebase config)
- App permissions (notifications, network state)
- App signing (need to generate or provide keystore)

---

## Task List

### Phase 1: EAS Setup & Configuration

#### 1.1 Install & Authenticate EAS CLI
- [ ] Install EAS CLI globally: `npm install -g eas-cli`
- [ ] Login to EAS: `eas login`
- [ ] Verify account: `eas whoami`

**Estimated Time:** 10 minutes

---

#### 1.2 Configure Project for EAS
- [ ] Run `eas build:configure`
  - This creates `eas.json` with build profiles
  - Prompts for project setup
- [ ] Review and update `eas.json` configuration
- [ ] Add EAS project ID to `app.json` (if needed)

**Estimated Time:** 15 minutes

**Files Modified:**
- `eas.json` (created)
- `app.json` (possibly updated)

---

#### 1.3 Update app.json for Production
- [ ] Set unique `package` name: `com.yourname.hellomsg` (or similar)
- [ ] Set `version` (e.g., "1.0.0")
- [ ] Set `versionCode` (e.g., 1)
- [ ] Configure app icon (if not already done)
- [ ] Configure splash screen (if not already done)
- [ ] Add Android permissions:
  ```json
  "android": {
    "permissions": [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE"
    ]
  }
  ```

**Estimated Time:** 20 minutes

**Files Modified:**
- `app.json`

---

### Phase 2: Environment & Secrets Management

#### 2.1 Production Environment Variables
- [ ] Create production Firebase config (separate project or use existing?)
- [ ] Decision: Use same Firebase project or create new production project?
  - **Option A:** Same project (simpler, costs less)
  - **Option B:** Separate prod/dev projects (cleaner separation)
- [ ] Update `.env.production` with production values
- [ ] Configure EAS Secrets for sensitive values:
  ```bash
  eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
  eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "..."
  # ... etc for all Firebase config
  ```

**Estimated Time:** 30 minutes

**Questions:**
- Should we use the same Firebase project for dev and prod?
- Do we need separate Firestore databases (dev/prod)?
- How do we handle OpenAI API costs in production?

---

#### 2.2 Push Notification Configuration
- [ ] Generate Firebase Cloud Messaging (FCM) server key
- [ ] Add FCM credentials to Expo:
  ```bash
  eas credentials
  # Select Android > Push Notifications > FCM Server Key
  ```
- [ ] Verify `google-services.json` is properly configured
- [ ] Test push notifications in production build

**Estimated Time:** 30 minutes

**Questions:**
- Do we have `google-services.json` generated from Firebase Console?
- Is it already in the project or do we need to download it?

---

### Phase 3: Build Profiles & Credentials

#### 3.1 Configure Build Profiles
- [ ] Review default `eas.json` profiles:
  - `development`: For internal testing (development client)
  - `preview`: For testing full app (installable APK)
  - `production`: For store distribution (AAB)
- [ ] Customize profiles as needed (see [Build Profiles](#build-profiles) section)

**Estimated Time:** 15 minutes

---

#### 3.2 App Signing & Credentials
- [ ] Decide on keystore strategy:
  - **Option A:** Let EAS generate and manage keystore (recommended)
  - **Option B:** Provide existing keystore (if you have one)
- [ ] For new keystore (Option A):
  ```bash
  eas credentials
  # Select Android > Keystore > Generate new keystore
  ```
- [ ] Backup credentials:
  ```bash
  eas credentials
  # Select Android > Keystore > Download
  ```
  - Store securely (needed for future updates!)

**Estimated Time:** 20 minutes

**⚠️ CRITICAL:**
- If you lose the keystore, you CANNOT update the app on Play Store
- Must publish as new app with new package name
- Always backup keystore in secure location

---

### Phase 4: First Build

#### 4.1 Development Build (Internal Testing)
- [ ] Run first development build:
  ```bash
  eas build --platform android --profile development
  ```
- [ ] Wait for build to complete (~10-20 minutes)
- [ ] Download APK from EAS dashboard or CLI
- [ ] Install on physical device or emulator
- [ ] Test all features:
  - [ ] Login/Signup
  - [ ] Messaging
  - [ ] Push notifications
  - [ ] AI translation
  - [ ] Presence/online status

**Estimated Time:** 1-2 hours (including build time + testing)

---

#### 4.2 Preview Build (Beta Testing)
- [ ] Run preview build:
  ```bash
  eas build --platform android --profile preview
  ```
- [ ] Test APK thoroughly
- [ ] Share with beta testers (optional)
- [ ] Collect feedback on any issues

**Estimated Time:** 1-2 hours

---

#### 4.3 Production Build (Store Ready)
- [ ] Ensure all features tested and working
- [ ] Update version numbers in `app.json`
- [ ] Run production build:
  ```bash
  eas build --platform android --profile production
  ```
- [ ] This generates an AAB (Android App Bundle) for Play Store

**Estimated Time:** 1 hour + build time

---

### Phase 5: Google Play Store Setup (Optional)

#### 5.1 Create Play Console Account
- [ ] Sign up at https://play.google.com/console
- [ ] Pay $25 registration fee
- [ ] Complete account verification

**Estimated Time:** 30 minutes

---

#### 5.2 Create App Listing
- [ ] Create new application
- [ ] Fill in app details:
  - App name
  - Short description
  - Full description
  - Screenshots (various sizes)
  - Feature graphic
  - App icon
  - Category
  - Content rating questionnaire
  - Privacy policy URL
- [ ] Set up pricing & distribution

**Estimated Time:** 2-3 hours

---

#### 5.3 Upload First Release
- [ ] Create internal testing track (recommended first)
- [ ] Upload AAB file from EAS Build
- [ ] Fill in release notes
- [ ] Submit for review
- [ ] Wait for approval (1-7 days typically)

**Estimated Time:** 30 minutes + review wait time

---

### Phase 6: OTA Updates Setup (Optional but Recommended)

#### 6.1 Configure Expo Updates
- [ ] Install `expo-updates` (likely already installed)
- [ ] Configure `eas.json` for updates:
  ```json
  {
    "build": {
      "production": {
        "channel": "production"
      }
    }
  }
  ```
- [ ] Set up update channels (production, staging, etc.)

**Estimated Time:** 30 minutes

---

#### 6.2 Publish First Update
- [ ] Make a small code change (e.g., fix typo)
- [ ] Publish update:
  ```bash
  eas update --branch production --message "Fix: typo in chat screen"
  ```
- [ ] Verify update appears in app

**Estimated Time:** 15 minutes

---

### Phase 7: CI/CD Pipeline (Advanced - Optional)

#### 7.1 GitHub Actions Integration
- [ ] Create `.github/workflows/eas-build.yml`
- [ ] Configure automated builds on:
  - Push to `main` branch → production build
  - Push to `develop` branch → preview build
  - Pull requests → development build
- [ ] Set up EAS secrets in GitHub

**Estimated Time:** 1-2 hours

---

## Build Profiles

### Recommended `eas.json` Configuration

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug",
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_USE_EMULATOR": "false"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_USE_EMULATOR": "false"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Profile Breakdown

**Development:**
- Development client build (like Expo Go but for your app)
- Faster iterations during development
- Includes debug tools
- APK format (can install directly)

**Preview:**
- Full production-like build
- For internal testing and QA
- APK format (easier to distribute to testers)
- Same code as production but different signing

**Production:**
- Optimized for release
- AAB format (required for Play Store)
- Smaller download size
- No debug tools

---

## Configuration Details

### App.json Critical Fields

```json
{
  "expo": {
    "name": "HelloMsg",
    "slug": "hello-msg",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "com.willharrison.hellomsg",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK"
      ],
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": []
        }
      ]
    ]
  }
}
```

### Google Services File

**Location:** Root of project (`./google-services.json`)

**How to get:**
1. Go to Firebase Console
2. Project Settings → General
3. Scroll to "Your apps" section
4. Click Android app (or add if not exists)
5. Download `google-services.json`

---

## Questions & Uncertainties

### 1. Firebase Project Strategy

**Question:** Should we use the same Firebase project for dev and production builds?

**Options:**
- **A) Single Project** (Current approach)
  - ✅ Simpler setup
  - ✅ Lower costs
  - ❌ Dev/test data mixed with prod data
  - ❌ Can't easily test Firestore rules changes

- **B) Separate Projects**
  - ✅ Clean separation
  - ✅ Can test rule changes safely
  - ✅ Better for team development
  - ❌ More complex setup
  - ❌ Higher costs (2x Cloud Functions, Storage, etc.)

**Recommendation:** Start with single project (Option A), migrate to separate projects later if needed.

---

### 2. Environment Variables Management

**Question:** How should we handle environment switching between dev/prod?

**Current Approach:**
- `.env.local` for local development (emulators)
- `EXPO_PUBLIC_USE_EMULATOR` flag to switch

**For Native Builds:**
- Need production Firebase config
- Can't use `.env.local` (not included in builds)
- Options:
  - **A) EAS Secrets** (recommended)
  - **B) Build-time env files** (`.env.production`)
  - **C) Runtime config** (fetch from server)

**Recommendation:** Use EAS Secrets for sensitive values, `.env.production` for non-sensitive config.

---

### 3. Push Notifications Setup

**Question:** Do we have all the Firebase credentials needed for production push notifications?

**Need to verify:**
- [ ] `google-services.json` downloaded and in project
- [ ] FCM Server Key generated
- [ ] Expo push token registration working
- [ ] Notification permissions configured

**Potential Issues:**
- FCM credentials might be different for production package name
- May need to regenerate `google-services.json` after finalizing package name

---

### 4. App Signing & Keystore

**Question:** Do we want EAS to manage our keystore, or provide our own?

**Recommendation:** Let EAS generate and manage (easier, more secure).

**Critical Actions:**
- [ ] Download and backup keystore after first build
- [ ] Store in secure location (1Password, encrypted drive, etc.)
- [ ] Document keystore password and alias

---

### 5. Google Play Store Readiness

**Question:** Are we ready for Play Store distribution now, or build for internal testing first?

**Recommendation:** Build preview/internal testing APKs first, then Play Store later.

**Reasons:**
- Test all features in production build first
- Gather feedback from small group
- Iterate quickly without store review delays
- Play Store setup takes time (app listing, screenshots, etc.)

---

### 6. OTA Updates Strategy

**Question:** How should we handle app updates?

**Options:**
- **A) Only Play Store updates** (traditional)
  - Users get updates via Play Store
  - Slower rollout
  - Requires review for each update

- **B) Expo Updates (OTA)** (recommended)
  - Push JS/asset updates instantly
  - No store review needed
  - Can revert bad updates quickly
  - Native code changes still need store update

**Recommendation:** Use both - OTA for quick fixes, Play Store for major versions.

---

### 7. Build Costs & Limits

**Question:** What are the costs and limits for EAS Build?

**Free Tier:**
- 30 builds/month for personal accounts
- Unlimited for priority builds (paid)

**If we exceed:**
- Option A: Upgrade to paid plan ($29/month)
- Option B: Build locally with `eas build --local`
- Option C: Use GitHub Actions + EAS (counts against limit)

**Current Estimate:**
- Phase 1-4: ~10-15 builds
- Should stay within free tier for initial setup

---

### 8. App Icon & Splash Screen

**Question:** Do we have production-ready app icon and splash screen assets?

**Required:**
- App icon: 1024x1024 PNG
- Adaptive icon (Android): Foreground layer
- Splash screen: 2048x2048 PNG (centered on background)
- Notification icon: White on transparent, 96x96

**Action Items:**
- [ ] Check existing assets in `assets/` folder
- [ ] Design or source final app icon
- [ ] Generate all required sizes (can use Expo tools)

---

### 9. Testing Device Availability

**Question:** Do we have physical Android devices for testing?

**Current Status:** You have tested on Android device (from earlier work)

**Recommendations:**
- Test on multiple Android versions (8.0+)
- Test on different screen sizes
- Test on low-end and high-end devices
- Consider Firebase Test Lab for automated testing

---

### 10. Version Management

**Question:** How should we manage version numbers?

**Recommendation:**
```json
{
  "version": "1.0.0",      // Human-readable (major.minor.patch)
  "versionCode": 1         // Integer, increment for each release
}
```

**Strategy:**
- Increment `versionCode` for every build submitted to Play Store
- Increment `version` following semver:
  - Major: Breaking changes
  - Minor: New features
  - Patch: Bug fixes

---

## Resources

### Official Documentation
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android App Signing](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo Application Services](https://expo.dev/eas)
- [Google Play Console](https://play.google.com/console)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

### Helpful Guides
- [Publishing to Google Play Store](https://docs.expo.dev/submit/android/)
- [Managing Credentials](https://docs.expo.dev/app-signing/managed-credentials/)
- [Expo Updates](https://docs.expo.dev/eas-update/introduction/)
- [Environment Variables in EAS](https://docs.expo.dev/build-reference/variables/)

### Tools
- [EAS CLI](https://www.npmjs.com/package/eas-cli)
- [Expo Application Services Dashboard](https://expo.dev/)
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) (for icons)

---

## Next Steps

**Immediate Actions:**
1. Review this plan and ask any clarifying questions
2. Make decisions on open questions (Firebase project strategy, etc.)
3. Install EAS CLI and authenticate
4. Run `eas build:configure` to generate initial `eas.json`
5. Review and finalize `app.json` configuration

**Ready to start?** Let me know which questions you'd like to discuss first, or if you'd like to proceed with Phase 1!

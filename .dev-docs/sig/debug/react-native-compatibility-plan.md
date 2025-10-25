# React Native / Expo Compatibility Plan for OpenPGP.js

**Date**: 2025-10-24
**Status**: Planning
**Current State**: Working on Web, Untested on iOS/Android

---

## Current Situation

### What We've Built (Phase 1)
- ✅ Key generation (Curve25519)
- ✅ Key storage in Firestore
- ✅ UI for signature setup
- ✅ Profile page with key status
- ✅ **Working on Web platform** (tested in browser)

### The Problem
OpenPGP.js v6.2.2 is **not officially supported** in React Native. It depends on Node.js/Web APIs that don't exist in React Native:
- `crypto.getRandomValues()`
- `buffer`
- `stream`
- Web Crypto API

### What We Don't Know Yet
- ❓ Will it crash when building for Android/iOS?
- ❓ Will it run but fail at runtime?
- ❓ Will polyfills be sufficient?

---

## Option 1: Try Polyfills First (Quick Test)

**Approach**: Add React Native polyfills and see if OpenPGP.js works

### Implementation Steps

```bash
# Install polyfills
npm install react-native-get-random-values
npm install react-native-quick-crypto
npm install buffer stream-browserify
```

**Add to `services/signatures.ts` (top of file)**:
```typescript
// Polyfills for React Native
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
```

**Add to `app.json` or `app.config.js`**:
```json
{
  "expo": {
    "plugins": [
      ["react-native-quick-crypto", {}]
    ]
  }
}
```

### Pros
- ✅ Minimal code changes
- ✅ Keep existing OpenPGP.js implementation
- ✅ Fast to test (~1 hour)
- ✅ If it works, no need for other options

### Cons
- ❌ Not officially supported
- ❌ May fail on native build
- ❌ May have performance issues
- ❌ Possible runtime crashes
- ❌ Might work on iOS but fail on Android (or vice versa)

### Testing Plan
1. Add polyfills
2. Build for Android: `eas build --platform android --profile development`
3. Build for iOS: `eas build --platform ios --profile development`
4. Test key generation on both platforms
5. If works: ship it. If fails: move to Option 2

### Risk Level
🟡 **Medium** - May work, may not. Won't know until we build.

---

## Option 2: Switch to react-native-fast-openpgp (Native Implementation)

**Approach**: Replace OpenPGP.js with a native Go-based implementation

### What is react-native-fast-openpgp?
- OpenPGP implementation using **Go (Golang)** compiled to native modules
- **10x faster** than pure JS implementations
- **Officially supports React Native**
- Last updated: **2 months ago** (active maintenance)
- Requires Expo config plugin

### Implementation Steps

```bash
# Remove OpenPGP.js
npm uninstall openpgp

# Install react-native-fast-openpgp
npm install react-native-fast-openpgp
```

**Add to `app.json` config plugin**:
```json
{
  "expo": {
    "plugins": [
      "react-native-fast-openpgp"
    ]
  }
}
```

**Rewrite `services/signatures.ts`**:
```typescript
import RNOpenPGP from 'react-native-fast-openpgp';

export async function generateKeys(passphrase: string): Promise<PGPKeyPair> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  // Different API than OpenPGP.js
  const keyPair = await RNOpenPGP.generate({
    keyType: "curve25519",
    userIds: [{ name: user.displayName || 'User', email: user.email! }],
    passphrase: passphrase,
  });

  const fingerprint = await RNOpenPGP.getFingerprint(keyPair.publicKey);

  const pgpKeyPair: PGPKeyPair = {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    fingerprint,
    createdAt: new Date()
  };

  // Store in Firestore (same as before)
  await setDoc(doc(db, 'users', user.uid), {
    publicKey: keyPair.publicKey,
    privateKeyEncrypted: keyPair.privateKey,
    publicKeyFingerprint: fingerprint,
    publicKeyCreatedAt: new Date(),
  }, { merge: true });

  return pgpKeyPair;
}
```

### Pros
- ✅ **Native performance** (~10x faster)
- ✅ **Officially supports React Native**
- ✅ **Actively maintained** (updated 2 months ago)
- ✅ Works on iOS and Android
- ✅ More reliable than polyfills

### Cons
- ❌ Requires rewriting `services/signatures.ts` (API is different)
- ❌ Increases app size (native Go modules)
- ❌ Requires Expo config plugin (may complicate builds)
- ❌ Different API means learning new library
- ❌ Need to update Cloud Functions to match (or keep OpenPGP.js on server)

### API Differences
| Operation | OpenPGP.js | react-native-fast-openpgp |
|-----------|-----------|---------------------------|
| Generate | `openpgp.generateKey()` | `RNOpenPGP.generate()` |
| Sign | `openpgp.sign()` | `RNOpenPGP.sign()` |
| Verify | `openpgp.verify()` | `RNOpenPGP.verify()` |
| Encrypt | `openpgp.encrypt()` | `RNOpenPGP.encrypt()` |

### Effort Estimate
- Rewrite signatures service: **2-3 hours**
- Test on both platforms: **1-2 hours**
- Total: **3-5 hours**

### Risk Level
🟢 **Low** - This will definitely work, but requires more effort.

---

## Option 3: Hybrid Approach (Web = OpenPGP.js, Native = react-native-fast-openpgp)

**Approach**: Detect platform and use different libraries

### Implementation

**Create platform abstraction**: `services/signatures-adapter.ts`
```typescript
import { Platform } from 'react-native';

// Dynamically import based on platform
const cryptoService = Platform.OS === 'web'
  ? require('./signatures-web').default
  : require('./signatures-native').default;

export const generateKeys = cryptoService.generateKeys;
export const hasKeys = cryptoService.hasKeys;
export const getKeyInfo = cryptoService.getKeyInfo;
```

**Create separate implementations**:
- `services/signatures-web.ts` → Uses OpenPGP.js
- `services/signatures-native.ts` → Uses react-native-fast-openpgp

### Pros
- ✅ Best of both worlds
- ✅ Can optimize for each platform
- ✅ Web keeps working as-is

### Cons
- ❌ Maintain two implementations
- ❌ More complex codebase
- ❌ Potential for divergence
- ❌ More testing required

### Effort Estimate
**4-6 hours** (duplicate implementations + abstraction layer)

### Risk Level
🟡 **Medium** - More moving parts = more to maintain

---

## Option 4: Server-Side Signing Only (Architecture Change)

**Approach**: Move all key generation and signing to Cloud Functions

### How It Works
1. User requests key generation via Cloud Function
2. Server generates keys, stores private key encrypted
3. Client only stores public key
4. Signing happens server-side (call Cloud Function)
5. Client can verify signatures locally

### Implementation
**Client**:
```typescript
// Call Cloud Function instead of local signing
export async function generateKeys(passphrase: string) {
  const generateKeysFunction = httpsCallable(functions, 'generateKeys');
  const result = await generateKeysFunction({ passphrase });
  return result.data;
}

export async function signMessages(messageIds: string[], passphrase: string) {
  const signFunction = httpsCallable(functions, 'signMessages');
  const result = await signFunction({ messageIds, passphrase });
  return result.data;
}
```

**Server (Cloud Functions)**:
```typescript
export const generateKeys = onCall(async (request) => {
  const { passphrase } = request.data;
  const user = request.auth;

  // Generate keys using OpenPGP.js (Node.js)
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'curve25519',
    userIDs: [{ email: user.token.email }],
    passphrase,
  });

  // Store in Firestore...
  return { success: true, fingerprint };
});
```

### Pros
- ✅ No React Native compatibility issues
- ✅ OpenPGP.js works perfectly on server
- ✅ Simpler client code
- ✅ Centralized key management

### Cons
- ❌ **Defeats the security purpose** (private keys on server)
- ❌ Requires network for signing (offline won't work)
- ❌ Higher server costs (more function calls)
- ❌ Slower UX (network latency)
- ❌ Not aligned with original architecture goals

### Risk Level
🔴 **High** - Changes security model significantly

### Recommendation
**❌ Don't use this option** unless absolutely necessary. Client-side signing is more secure and aligns with the original plan.

---

## Option 5: Wait and See (Test Native Build First)

**Approach**: Do nothing, build for native, see what happens

### Steps
1. Build for Android: `eas build --platform android --profile preview`
2. Build for iOS: `eas build --platform ios --profile preview`
3. Install on device
4. Try to generate keys
5. If works → celebrate. If fails → implement Option 1 or 2

### Pros
- ✅ Zero effort right now
- ✅ Might just work (OpenPGP.js v6 improved compatibility)
- ✅ Delayed decision until we know for sure

### Cons
- ❌ Wastes time if it fails (need to rebuild after adding polyfills)
- ❌ Unknown risk
- ❌ Could fail late in development

### Risk Level
🟡 **Medium** - Could work, but might waste time

---

## Recommended Approach

### Phase A: Quick Test (Today - 1 hour)
1. ✅ **Try Option 1 (Polyfills)** first
   - Add `react-native-get-random-values`
   - Add `react-native-quick-crypto`
   - Test in Expo Go if possible
   - Build development preview for Android

### Phase B: Native Build Test (Tomorrow - 2 hours)
2. 🔄 **Build for Android with polyfills**
   - Run `eas build --platform android --profile preview`
   - Test key generation on physical device or emulator
   - Document any crashes or errors

### Phase C: Fallback Plan (If polyfills fail - 3-5 hours)
3. 🔄 **Switch to Option 2 (react-native-fast-openpgp)**
   - Replace OpenPGP.js in client
   - Keep OpenPGP.js in Cloud Functions (for server-side verification)
   - Rewrite `services/signatures.ts`
   - Test Phase 2 (signing) implementation

---

## Decision Matrix

| Option | Time | Complexity | Reliability | Performance | Recommendation |
|--------|------|------------|-------------|-------------|----------------|
| 1. Polyfills | 1h | Low | Unknown | Good | ✅ **Try First** |
| 2. react-native-fast-openpgp | 3-5h | Medium | High | Excellent | ✅ **Fallback** |
| 3. Hybrid | 4-6h | High | High | Best | ⚠️ Only if needed |
| 4. Server-side | 2-3h | Low | High | Poor | ❌ Avoid |
| 5. Wait | 0h | None | Unknown | Unknown | ⚠️ Risky |

---

## Testing Checklist

### Web (Already Working)
- [x] Key generation
- [x] Key storage
- [x] UI displays fingerprint
- [x] Profile shows key status

### Android (To Test)
- [ ] App builds successfully
- [ ] App launches without crash
- [ ] Can navigate to signature setup
- [ ] Key generation completes
- [ ] Keys stored in Firestore
- [ ] Fingerprint displays correctly
- [ ] No runtime errors in logs

### iOS (To Test)
- [ ] App builds successfully
- [ ] App launches without crash
- [ ] Can navigate to signature setup
- [ ] Key generation completes
- [ ] Keys stored in Firestore
- [ ] Fingerprint displays correctly
- [ ] No runtime errors in logs

---

## Action Items

### Immediate (Today)
1. [ ] Implement Option 1 polyfills
2. [ ] Test in Expo Go (if possible)
3. [ ] Document any warnings/errors

### Next (Tomorrow)
4. [ ] Build Android preview with EAS
5. [ ] Test on Android device/emulator
6. [ ] If fails → Document specific error messages
7. [ ] If fails → Begin Option 2 implementation

### Future (Phase 2 Development)
8. [ ] Test signing functionality on native
9. [ ] Test verification on native
10. [ ] Performance benchmarks (key gen, sign, verify)

---

## Notes & Observations

### What We Know
- ✅ OpenPGP.js v6.2.2 installed and working on web
- ✅ Curve25519 key generation works (~100-200ms on web)
- ✅ Firestore storage working
- ✅ No build errors in Metro bundler

### What We Don't Know
- ❓ Does it work on Android?
- ❓ Does it work on iOS?
- ❓ Performance on mobile vs web?
- ❓ Battery impact of crypto operations?

### Research Links
- OpenPGP.js React Native Issue: https://github.com/openpgpjs/openpgpjs/discussions/1211
- react-native-fast-openpgp: https://github.com/jerson/react-native-fast-openpgp
- react-native-get-random-values: https://www.npmjs.com/package/react-native-get-random-values
- react-native-quick-crypto: https://github.com/margelo/react-native-quick-crypto

---

## Update Log

| Date | Update | Result |
|------|--------|--------|
| 2025-10-24 | Initial planning document created | N/A |
| 2025-10-24 | **Implemented Option 1 (Polyfills)** | ✅ Completed |
| 2025-10-24 | Installed react-native-get-random-values | ✅ v1.11.0 |
| 2025-10-24 | Installed react-native-quick-crypto | ✅ v0.9.1 |
| 2025-10-24 | Installed buffer polyfill | ✅ v6.0.3 |
| 2025-10-24 | Added polyfills to services/signatures.ts | ✅ Done |
| 2025-10-24 | Added react-native-quick-crypto to app.json plugins | ✅ Done |
| 2025-10-24 | TypeScript compilation passes | ✅ No errors |
| TBD | Test on Web (still working?) | ⏳ Pending |
| TBD | Test native build (Android) | ⏳ Pending |
| TBD | Test native build (iOS) | ⏳ Pending |
| TBD | Final decision made | TBD |

---

## Polyfills Installed

### What Was Added

**Packages**:
```json
{
  "react-native-get-random-values": "^1.11.0",
  "react-native-quick-crypto": "^0.9.1",
  "buffer": "^6.0.3"
}
```

**Code Changes**:
- `services/signatures.ts`: Added polyfill imports at the top
- `app.json`: Added `react-native-quick-crypto` plugin

**Polyfill Imports** (in `services/signatures.ts`):
```typescript
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
```

### Next Steps

1. **Test on Web**: Verify key generation still works on web with polyfills
2. **Build for Android**: Run `eas build --platform android --profile preview`
3. **Test on Device**: Install on Android device/emulator and test key generation
4. **Build for iOS**: Run `eas build --platform ios --profile preview` (if Android succeeds)
5. **Test on Device**: Install on iOS device/simulator and test key generation

---

**Next Review**: After web testing
**Owner**: Development Team
**Priority**: High (Blocking Phase 2)

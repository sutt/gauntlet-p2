# Digital Signatures v2 - Developer Workflows

## Document Overview
**Version**: 2.0
**Date**: 2025-10-25
**Status**: Planning Phase

This document provides practical workflows for developing and testing the server-side digital signatures feature.

---

## Table of Contents
1. [Development Setup](#development-setup)
2. [Testing Workflows](#testing-workflows)
3. [Debugging Guide](#debugging-guide)
4. [Common Patterns](#common-patterns)

---

## Development Setup

### Prerequisites

```bash
# Ensure you're in the project root
cd /home/user/gauntlet/pkgs/p2/hello-expo

# Ensure dependencies are installed
npm install

# Ensure functions dependencies are installed
cd functions
npm install
cd ..
```

### Install OpenPGP.js (Server-Side Only)

```bash
# In functions directory
cd functions
npm install openpgp@^5.11.0
cd ..
```

**Important**: DO NOT install OpenPGP.js in the client. All crypto happens server-side.

---

### Terminal Setup (Recommended)

Run these in 3 separate terminals:

**Terminal 1: Firebase Emulator**
```bash
cd /home/user/gauntlet/pkgs/p2/hello-expo
npm run functions:dev  # or: firebase emulators:start

# Emulator UI will be available at:
# http://localhost:4000
```

**Terminal 2: Mobile App**
```bash
cd /home/user/gauntlet/pkgs/p2/hello-expo
npm start

# Choose platform:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Press 'w' for web
```

**Terminal 3: Functions Build Watch**
```bash
cd /home/user/gauntlet/pkgs/p2/hello-expo/functions
npm run build:watch

# Auto-rebuilds TypeScript on file changes
```

---

### Verify Setup

**Check emulator is running**:
```bash
# Open emulator UI
open http://localhost:4000

# You should see:
# - Firestore emulator
# - Authentication emulator
# - Functions emulator
```

**Check client connects to emulator**:
```typescript
// In your firebase config (should already be set up)
if (__DEV__) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

---

## Testing Workflows

### Workflow 1: Test Key Generation

**Goal**: Generate server-side keys for a user

**Steps**:

1. **Create test user** (if not exists):
```bash
# In Emulator UI: Authentication tab
# Add user: test@example.com / password123
```

2. **Sign in to app**:
```
- Open app in simulator/emulator
- Sign in with test@example.com / password123
```

3. **Navigate to key generation**:
```
- Go to Settings (or wherever you place the setup screen)
- Tap "Set Up Digital Signatures"
- Tap "Generate Keys" button
```

4. **Verify in Firestore**:
```bash
# Open Emulator UI: http://localhost:4000/firestore
# Navigate to: users/{userId}
# Check fields exist:
# - publicKey (starts with -----BEGIN PGP PUBLIC KEY BLOCK-----)
# - privateKey (starts with -----BEGIN PGP PRIVATE KEY BLOCK-----)
# - publicKeyFingerprint (40 character hex string)
# - publicKeyCreatedAt (timestamp)
```

5. **Check function logs**:
```bash
# In Terminal 1 (emulator logs):
# Should see:
# > [generateKeysForUser] Generating keys for user: test@example.com
# > [generateKeysForUser] Keys generated: fingerprint ABC123...
```

**Expected Results**:
- ✅ Keys generated in < 1 second
- ✅ Public/private keys stored in Firestore
- ✅ Fingerprint is 40 characters
- ✅ UI shows "Keys configured ✓"

---

### Workflow 2: Test Message Signing

**Goal**: Sign one or more messages

**Steps**:

1. **Create test conversation** (if not exists):
```bash
# Use app to create conversation with another test user
# Or manually create in Firestore emulator
```

2. **Send test messages**:
```
- Send 2-3 test messages in conversation
- Message examples:
  - "I approve the Q4 budget of $50,000"
  - "This looks good to me"
  - "Let's proceed with the plan"
```

3. **Sign messages**:
```
- Long-press a message
- Select "Sign message(s)"
- Tap additional messages (contiguous)
- Tap "Sign" button
- (Optional) Add purpose: "approval"
- (Optional) Add notes: "Test signature"
- Confirm
```

4. **Verify signature created**:
```bash
# Emulator UI: Firestore
# Navigate to: users/{userId}/signatures/{signatureId}
# Check fields:
# - signedPayload (object with messages)
# - pgpSignature (armored signature)
# - verified: false (will be set to true by trigger)
# - createdAt (timestamp)
```

5. **Verify trigger fired**:
```bash
# Terminal 1 logs should show:
# > [SIG-VERIFY] Processing signature sig123...
# > [SIG-VERIFY] Signature sig123 verified: true
# > [AI-AGENT] Processing verified signature: sig123
# > [AI-AGENT] Payload: {...}
# > [AI-AGENT] Messages in signature:
# >   1. [Alice]: I approve the Q4 budget of $50,000
# >   2. [Alice]: This looks good to me
# > [AI-AGENT] ✓ Signature verified and payload extracted
```

6. **Verify message badges**:
```
- Messages should show signature badge: 🔏 1
- Tapping badge should show signature details (future)
```

7. **Verify in signature drawer**:
```
- Navigate to Signatures tab
- Signature should appear in list
- Shows: signer email, date, message count, verified ✓
```

**Expected Results**:
- ✅ Signing completes in < 1 second
- ✅ Signature document created
- ✅ Trigger fires and verifies signature
- ✅ Agent extracts payload and logs it
- ✅ Message badges appear
- ✅ Signature appears in drawer

---

### Workflow 3: Test Signature Verification (Tamper Detection)

**Goal**: Verify that modified signatures fail verification

**Steps**:

1. **Create a valid signature** (follow Workflow 2)

2. **Manually tamper with signature**:
```bash
# Emulator UI: Firestore
# Navigate to signature document
# Edit: signedPayload.messages[0].text
# Change text to: "TAMPERED MESSAGE"
# Save
```

3. **Manually trigger verification**:
```bash
# Option A: Delete and re-create signature doc (trigger fires again)
# Option B: Call verification function directly

# For testing, you can create a manual trigger:
# In functions shell:
firebase functions:shell

# Then call:
onSignatureCreated({ data: { ref: '...', data: () => signatureDoc } })
```

4. **Verify detection**:
```bash
# Terminal logs should show:
# > [SIG-VERIFY] Processing signature sig123...
# > [SIG-VERIFY] Signature sig123 verified: false
# > [SIG-VERIFY] Verification failed: ...

# Firestore should show:
# - verified: false
# - verificationError: "..."
```

**Expected Results**:
- ✅ Tampered signatures fail verification
- ✅ AI agent does NOT process invalid signatures
- ✅ Error logged correctly

---

### Workflow 4: Test AI Agent Context Extraction

**Goal**: Verify agent can extract and use signature payload

**Steps**:

1. **Create approval signature**:
```
- Send message: "I approve the marketing budget of $100,000"
- Sign message with purpose: "approval"
```

2. **Check agent logs**:
```bash
# Terminal 1 should show:
# > [AI-AGENT] Processing verified signature: sig456
# > [AI-AGENT] Payload: {
# >   signer: "alice@example.com",
# >   conversationId: "conv789",
# >   messageCount: 1,
# >   purpose: "approval",
# >   timestamp: 1234567890
# > }
# > [AI-AGENT] Messages in signature:
# >   1. [Alice]: I approve the marketing budget of $100,000
# > [AI-AGENT] ✓ Signature verified and payload extracted
# > [AI-AGENT] Payload is now available for agent decision-making context
```

3. **(Future) Verify action item created**:
```bash
# Not implemented in POC, but logs confirm payload is accessible
# Future: Check actionItems collection for created item
```

**Expected Results**:
- ✅ Agent receives signature payload
- ✅ Agent logs all relevant data
- ✅ Payload structure is correct
- ✅ Agent confirms payload available for decisions

---

## Debugging Guide

### Debug Key Generation

**Add detailed logging**:

```typescript
// functions/src/index.ts (generateKeysForUser)

export const generateKeysForUser = onCall(async (request) => {
  console.log('[KEYGEN] Starting key generation...');
  console.time('keygen-total');

  const userId = request.auth.uid;
  const userEmail = request.auth.token.email!;

  console.log('[KEYGEN] User:', { userId, userEmail });

  // Check existing keys
  console.time('keygen-check-existing');
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .get();
  console.timeEnd('keygen-check-existing');

  if (userDoc.data()?.publicKey) {
    console.log('[KEYGEN] Keys already exist');
    throw new HttpsError('already-exists', 'Keys already generated');
  }

  // Generate keys
  console.log('[KEYGEN] Generating ECC Curve25519 key pair...');
  console.time('keygen-generate');

  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ email: userEmail }],
    format: 'armored'
  });

  console.timeEnd('keygen-generate');
  console.log('[KEYGEN] Keys generated:', {
    publicKeyLength: publicKey.length,
    privateKeyLength: privateKey.length
  });

  // Get fingerprint
  console.time('keygen-fingerprint');
  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = publicKeyObj.getFingerprint();
  console.timeEnd('keygen-fingerprint');

  console.log('[KEYGEN] Fingerprint:', fingerprint);

  // Store
  console.time('keygen-store');
  await admin.firestore()
    .collection('users')
    .doc(userId)
    .update({
      publicKey,
      privateKey,
      publicKeyFingerprint: fingerprint,
      publicKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      signatureKeysVersion: '2.0'
    });
  console.timeEnd('keygen-store');

  console.timeEnd('keygen-total');
  console.log('[KEYGEN] ✓ Keys generated successfully');

  return { success: true, publicKey, fingerprint };
});
```

**Expected log output**:
```
[KEYGEN] Starting key generation...
[KEYGEN] User: { userId: 'abc123', userEmail: 'test@example.com' }
keygen-check-existing: 45ms
[KEYGEN] Generating ECC Curve25519 key pair...
keygen-generate: 287ms
[KEYGEN] Keys generated: { publicKeyLength: 1024, privateKeyLength: 2048 }
keygen-fingerprint: 12ms
[KEYGEN] Fingerprint: A1B2C3D4E5F6789012345678901234567890ABCD
keygen-store: 67ms
keygen-total: 421ms
[KEYGEN] ✓ Keys generated successfully
```

---

### Debug Signing

**Add detailed logging**:

```typescript
// functions/src/index.ts (signMessages)

console.log('[SIGN] Starting signature creation...');
console.log('[SIGN] Request:', {
  userId,
  conversationId,
  messageCount: payload.messages.length,
  purpose: payload.purpose
});

console.time('sign-total');

// ... fetch private key ...

console.log('[SIGN] Building payload...');
payload.timestamp = Date.now();
payload.signedAt = new Date().toISOString();
payload.nonce = generateNonce();
payload.version = '2.0';

const payloadText = JSON.stringify(payload, null, 2);
console.log('[SIGN] Payload size:', payloadText.length, 'bytes');

console.log('[SIGN] Signing payload...');
console.time('sign-crypto');

const privateKey = await openpgp.readPrivateKey({
  armoredKey: privateKeyArmored
});

const message = await openpgp.createMessage({ text: payloadText });
const signature = await openpgp.sign({
  message,
  signingKeys: privateKey,
  format: 'armored'
});

console.timeEnd('sign-crypto');
console.log('[SIGN] Signature length:', signature.length);

// ... store signature ...

console.timeEnd('sign-total');
console.log('[SIGN] ✓ Signature created:', signatureId);
```

---

### Debug Verification

**Add detailed logging**:

```typescript
// functions/src/triggers/onSignatureCreated.ts

export const onSignatureCreated = onDocumentCreated(..., async (event) => {
  console.log('[VERIFY] Signature created:', event.params.signatureId);

  const signature = event.data?.data();

  console.log('[VERIFY] Signature data:', {
    signerId: signature.signedPayload.signerId,
    conversationId: signature.conversationId,
    messageCount: signature.messageIds.length,
    purpose: signature.purpose
  });

  console.time('verify-total');

  // Fetch public key
  console.time('verify-fetch-key');
  const userQuery = await admin.firestore()
    .collection('users')
    .where('email', '==', signature.signedPayload.signerId)
    .limit(1)
    .get();
  console.timeEnd('verify-fetch-key');

  if (userQuery.empty) {
    console.error('[VERIFY] ✗ Signer not found');
    return;
  }

  const publicKey = userQuery.docs[0].data().publicKey;

  // Verify
  console.time('verify-crypto');
  const payloadText = JSON.stringify(signature.signedPayload, null, 2);

  const message = await openpgp.readMessage({
    armoredMessage: signature.pgpSignature
  });

  const publicKeyObj = await openpgp.readKey({
    armoredKey: publicKey
  });

  const verificationResult = await openpgp.verify({
    message,
    verificationKeys: publicKeyObj
  });

  const verified = await verificationResult.signatures[0].verified;
  console.timeEnd('verify-crypto');

  console.log('[VERIFY] Verification result:', verified);

  await event.data.ref.update({
    verified,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.timeEnd('verify-total');

  if (verified) {
    await processVerifiedSignature(signature, event.params.signatureId, event.params.userId);
  }
});
```

---

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Keys already generated" | User trying to generate keys twice | Clear keys in Firestore or handle gracefully |
| "No keys found" | User didn't generate keys | Check key generation completed successfully |
| "Not a conversation participant" | User not in conversation | Verify user ID in participants array |
| "Signature verification failed" | Payload was modified | Check payload serialization is identical |
| "Signer not found" | Email mismatch | Verify signerId matches user email exactly |
| Function timeout | Operation taking > 60s | Check OpenPGP.js version, optimize queries |

---

## Common Patterns

### Pattern 1: Testing Signature Creation Locally

```typescript
// Create test helper function
async function createTestSignature(userId: string, conversationId: string) {
  const testPayload = {
    version: '2.0',
    timestamp: Date.now(),
    signedAt: new Date().toISOString(),
    nonce: Math.random().toString(36),
    signerId: 'test@example.com',
    conversationId,
    participants: [
      { email: 'test@example.com', displayName: 'Test User' },
      { email: 'other@example.com', displayName: 'Other User' }
    ],
    messages: [
      {
        messageId: 'msg1',
        text: 'I approve the budget',
        senderId: userId,
        senderName: 'Test User',
        timestamp: Date.now(),
        sentAt: new Date().toISOString()
      }
    ],
    purpose: 'approval'
  };

  // Call Cloud Function
  const signMessages = httpsCallable(functions, 'signMessages');
  const result = await signMessages({
    conversationId,
    payload: testPayload
  });

  console.log('Signature created:', result.data.signatureId);
  return result.data.signatureId;
}
```

---

### Pattern 2: Manual Verification Test

```typescript
// Test verification manually (in functions shell)
async function testVerification(signatureId: string, userId: string) {
  const sigDoc = await admin.firestore()
    .collection('users')
    .doc(userId)
    .collection('signatures')
    .doc(signatureId)
    .get();

  const signature = sigDoc.data();

  // Get public key
  const userQuery = await admin.firestore()
    .collection('users')
    .where('email', '==', signature.signedPayload.signerId)
    .limit(1)
    .get();

  const publicKey = userQuery.docs[0].data().publicKey;

  // Verify
  const payloadText = JSON.stringify(signature.signedPayload, null, 2);

  const message = await openpgp.readMessage({
    armoredMessage: signature.pgpSignature
  });

  const publicKeyObj = await openpgp.readKey({
    armoredKey: publicKey
  });

  const verificationResult = await openpgp.verify({
    message,
    verificationKeys: publicKeyObj
  });

  const verified = await verificationResult.signatures[0].verified;

  console.log('Signature valid:', verified);
  return verified;
}
```

---

### Pattern 3: Batch Create Test Signatures

```bash
# Create multiple test signatures for testing drawer
# In app or via script:

for (let i = 0; i < 5; i++) {
  await createTestSignature(userId, conversationId);
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

---

## Performance Benchmarking

### Measure Key Generation

```typescript
console.time('keygen');
await generateKeys();
console.timeEnd('keygen');
// Target: < 500ms
```

### Measure Signing

```typescript
console.time('sign');
await signMessages({ conversationId, payload });
console.timeEnd('sign');
// Target: < 400ms (server-side)
// Total with network: < 1s
```

### Measure Verification

```typescript
console.time('verify');
// Trigger fires automatically, check logs
// Target: < 200ms
```

---

## Quick Reference

### Emulator URLs
- **Emulator UI**: http://localhost:4000
- **Firestore**: http://localhost:4000/firestore
- **Auth**: http://localhost:4000/auth
- **Functions**: http://localhost:4000/functions

### Firebase Commands
```bash
# Start emulators
firebase emulators:start

# Start with data import
firebase emulators:start --import ./emulator-data

# Export data
firebase emulators:export ./emulator-data

# Functions shell (for testing)
firebase functions:shell
```

### Key Locations in Firestore
```
users/{uid}
  - publicKey
  - privateKey
  - publicKeyFingerprint

users/{uid}/signatures/{sigId}
  - signedPayload
  - pgpSignature
  - verified
  - verifiedAt

conversations/{convId}/messages/{msgId}
  - signatureIds[]
  - signatureCount
```

---

## Next Steps

After confirming these workflows work:
1. Move to implementation (tasks-sig2.md)
2. Build Phase 1: Server-side key generation
3. Build Phase 2: Message signing
4. Build Phase 3: Signature drawer UI
5. Test with real users

---

**Document Version**: 2.0
**Status**: Ready for Development
**Next Document**: tasks-sig2.md

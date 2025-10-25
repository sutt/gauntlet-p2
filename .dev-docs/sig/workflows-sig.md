# Digital Signatures - Developer Workflows

## Document Overview
**Version**: 1.0
**Date**: 2025-10-23
**Status**: Living Document

This document provides practical workflows, development tips, and best practices for implementing and debugging digital signatures. It assumes developers may not always follow exact guidelines, so it focuses on useful patterns, common pitfalls, and troubleshooting advice.

---

## Table of Contents
1. [Daily Development Workflow](#daily-development-workflow)
2. [Testing Signatures Locally](#testing-signatures-locally)
3. [Debugging Cryptography](#debugging-cryptography)
4. [Working with OpenPGP.js](#working-with-openpgpjs)
5. [Testing AI Agents](#testing-ai-agents)
6. [Common Pitfalls](#common-pitfalls)
7. [Performance Tips](#performance-tips)
8. [Useful Commands](#useful-commands)

---

## Daily Development Workflow

### Starting Your Day

**Terminal Setup** (recommended 3 terminals):

```bash
# Terminal 1: Emulator
cd /home/user/gauntlet/pkgs/p2/hello-expo
npm run functions:dev
# Starts: Functions, Firestore, Auth emulators
# URL: http://localhost:4000 (Emulator UI)

# Terminal 2: Mobile App
npm start
# Choose: iOS simulator, Android emulator, or web

# Terminal 3: Function logs (optional but helpful)
cd functions
npm run build:watch
# Auto-rebuilds on file changes
```

**Quick Start Checklist**:
- [ ] Check emulators are running (visit http://localhost:4000)
- [ ] Check mobile app connects to emulator
- [ ] Generate test keys (if needed)
- [ ] Test signature creation to verify setup

---

### Making Changes

**Typical development cycle**:

1. **Edit signature code** in `services/signatures.ts` or components
2. Save file (auto-reload in dev mode)
3. Test in mobile app
4. Check Firestore for signature documents
5. Verify Cloud Function trigger fires

**If things break**:
```bash
# Restart emulators
Ctrl+C (stop emulator)
npm run functions:dev

# Clear Firestore data (start fresh)
# In Emulator UI: http://localhost:4000/firestore → Clear all data

# Rebuild functions
cd functions && npm run build && cd ..
```

---

## Testing Signatures Locally

### Test User Setup

**Create test users with keys**:

```typescript
// Quick script to create test users
// Run in Firebase functions shell: npm run functions:shell

const testUsers = [
  { email: 'alice@test.com', password: 'password123', name: 'Alice' },
  { email: 'bob@test.com', password: 'password123', name: 'Bob' }
];

for (const user of testUsers) {
  await admin.auth().createUser({
    email: user.email,
    password: user.password,
    displayName: user.name
  });
}
```

**Generate keys for test users**:

```bash
# In app:
1. Sign in as alice@test.com
2. Go to Settings → Set Up Signatures
3. Enter passphrase: "test123"
4. Verify keys saved in Firestore

# Repeat for bob@test.com
```

---

### Testing Key Generation

**Manual test flow**:

```bash
1. Sign in to app
2. Navigate to Settings
3. Tap "Set Up Signatures"
4. Enter passphrase (min 8 chars): "testpass123"
5. Tap "Generate Keys"
6. Should complete in < 500ms
7. Success message appears
```

**Verify in Firestore**:
- Navigate to: http://localhost:4000/firestore
- Find: `users/{userId}`
- Check fields:
  - `publicKey` (starts with `-----BEGIN PGP PUBLIC KEY BLOCK-----`)
  - `privateKeyEncrypted` (starts with `-----BEGIN PGP PRIVATE KEY BLOCK-----`)
  - `publicKeyFingerprint` (40 character hex string)

**Common issues**:
- ❌ **"Passphrase too short"**: Must be 8+ characters
- ❌ **Keys not saved**: Check Firestore rules, check auth state
- ❌ **Slow generation**: ECC should be < 500ms, check OpenPGP.js version

---

### Testing Signature Creation

**Manual test flow**:

```bash
1. Open conversation with test messages
2. Long-press a message
3. Select "Sign message(s)"
4. Tap 2-3 more messages (contiguous)
5. Bottom bar shows "3 messages selected"
6. Tap "Sign"
7. Add purpose: "approval"
8. Add notes: "Test signature"
9. Tap "Sign"
10. Should complete in < 100ms
11. Badge appears on messages (🔏 1)
```

**Verify in Firestore**:
```bash
# Check signature document
users/{userId}/signatures/{signatureId}
{
  signatureId: "...",
  signedPayload: { ... },
  pgpSignature: "-----BEGIN PGP SIGNATURE-----...",
  verified: true,
  createdAt: Timestamp(...)
}

# Check message updates
conversations/{convId}/messages/{msgId}
{
  signatureIds: ["sig123"],
  signatureCount: 1
}
```

**Common issues**:
- ❌ **Non-contiguous selection rejected**: Expected behavior
- ❌ **"No keys found"**: Generate keys first
- ❌ **Slow signing**: Should be < 100ms with ECC
- ❌ **Signature not verified**: Check public key matches

---

### Testing Signature Drawer

**Manual test flow**:

```bash
1. Create 2-3 test signatures
2. Navigate to Signatures tab
3. Verify signatures appear in DESC order
4. Tap a signature card
5. Verify detail view shows:
   - Signer email
   - Date signed
   - Full message list
   - Purpose and notes
   - Verified status (✓)
6. Tap "Delete"
7. Signature removed from list
```

**Quick test script**:
```typescript
// Create multiple test signatures quickly
async function createTestSignatures() {
  const messages = [
    { id: '1', text: 'Test message 1', ... },
    { id: '2', text: 'Test message 2', ... },
    { id: '3', text: 'Test message 3', ... }
  ];

  // Create 5 test signatures
  for (let i = 0; i < 5; i++) {
    await createSignature({
      messages: messages.slice(0, 2),
      conversationId: 'test-conv',
      purpose: i % 2 === 0 ? 'approval' : 'attestation',
      notes: `Test signature ${i + 1}`
    });
  }
}
```

---

### Testing Proposals

**Two-device test flow**:

```bash
# Device 1 (Alice):
1. Sign in as alice@test.com
2. Open conversation with Bob
3. Long-press message
4. Select "Propose signature for Bob"
5. Select messages
6. Add purpose: "approval"
7. Tap "Send Proposal"

# Device 2 (Bob):
1. Sign in as bob@test.com
2. Receive notification
3. Open proposal
4. Review messages (verify they're correct)
5. Tap "Sign" to accept
6. Signature created in Bob's collection

# Verify:
- Proposal deleted after acceptance
- Bob has signature in his drawer
- Alice sees Bob's signature (if shared)
```

**Single-device testing** (emulator):
```bash
# Use two browser tabs or multiple emulator instances
# Tab 1: Alice
# Tab 2: Bob
```

---

## Debugging Cryptography

### Debug Key Generation

**Add detailed logging**:

```typescript
// In services/signatures.ts
export async function generateKeys(passphrase: string) {
  console.log('[SIG] Starting key generation...');
  console.time('keygen');

  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ email: user.email }],
    passphrase
  });

  console.timeEnd('keygen');
  console.log('[SIG] Public key length:', publicKey.length);
  console.log('[SIG] Private key length:', privateKey.length);

  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = publicKeyObj.getFingerprint();
  console.log('[SIG] Fingerprint:', fingerprint);

  // ... rest of function
}
```

**Expected output**:
```
[SIG] Starting key generation...
keygen: 234ms
[SIG] Public key length: 1024
[SIG] Private key length: 2048
[SIG] Fingerprint: A1B2C3D4E5F6...
```

**Troubleshooting**:
- **Slow keygen (> 1s)**: Check OpenPGP.js version, ensure using ECC not RSA
- **Invalid fingerprint**: Check public key format
- **Keys not saving**: Check Firestore connection, auth state

---

### Debug Signature Creation

**Add detailed logging**:

```typescript
export async function createSignature({ messages, ... }) {
  console.log('[SIG] Creating signature...');
  console.log('[SIG] Messages:', messages.length);
  console.log('[SIG] Payload size:', JSON.stringify(payload).length, 'bytes');

  console.time('sign');
  const signature = await openpgp.sign({
    message,
    signingKeys: privateKey,
  });
  console.timeEnd('sign');

  console.log('[SIG] Signature length:', signature.length);

  // Verify immediately
  console.time('verify');
  const verification = await openpgp.verify({ ... });
  console.timeEnd('verify');

  console.log('[SIG] Verified:', await verification.signatures[0].verified);

  // ... rest
}
```

**Expected output**:
```
[SIG] Creating signature...
[SIG] Messages: 3
[SIG] Payload size: 1234 bytes
sign: 15ms
[SIG] Signature length: 512
verify: 8ms
[SIG] Verified: true
```

---

### Debug Signature Verification

**Test verification separately**:

```typescript
// Test function to verify signature manually
async function testVerification(signatureId: string) {
  const sigDoc = await getDoc(doc(db, 'users', userId, 'signatures', signatureId));
  const sig = sigDoc.data();

  const message = await openpgp.readMessage({
    armoredMessage: sig.pgpSignature
  });

  const publicKey = await openpgp.readKey({
    armoredKey: sig.publicKey
  });

  const verification = await openpgp.verify({
    message,
    verificationKeys: publicKey
  });

  const valid = await verification.signatures[0].verified;
  console.log('Signature valid:', valid);

  return valid;
}
```

**Common verification failures**:
- ❌ **Invalid signature**: Check payload wasn't modified
- ❌ **Wrong public key**: Ensure using correct signer's key
- ❌ **Format mismatch**: Check armored format correct

---

## Working with OpenPGP.js

### Common Patterns

**Generate keys**:
```typescript
const { privateKey, publicKey } = await openpgp.generateKey({
  type: 'ecc',
  curve: 'curve25519',
  userIDs: [{ name: 'User Name', email: 'user@example.com' }],
  passphrase: 'secret',
  format: 'armored' // Returns ASCII armored keys
});
```

**Sign message**:
```typescript
// Decrypt private key first
const privateKeyObj = await openpgp.decryptKey({
  privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
  passphrase: 'secret'
});

// Create message
const message = await openpgp.createMessage({ text: 'Hello world' });

// Sign
const signature = await openpgp.sign({
  message,
  signingKeys: privateKeyObj,
  format: 'armored'
});
```

**Verify signature**:
```typescript
const message = await openpgp.readMessage({ armoredMessage: signature });
const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

const verification = await openpgp.verify({
  message,
  verificationKeys: publicKey
});

const valid = await verification.signatures[0].verified;
```

**Get fingerprint**:
```typescript
const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
const fingerprint = publicKey.getFingerprint();
// Returns: "A1B2C3D4E5F6789012345678901234567890ABCD"
```

---

### OpenPGP.js Gotchas

**1. Armored vs Binary Format**

```typescript
// ✅ GOOD: Use armored format (ASCII)
const { privateKey, publicKey } = await openpgp.generateKey({
  format: 'armored'
});
// Stores/transmits easily as strings

// ❌ BAD: Binary format
const { privateKey, publicKey } = await openpgp.generateKey({
  format: 'binary'
});
// Uint8Array - harder to store in Firestore
```

**2. Always Decrypt Before Signing**

```typescript
// ❌ BAD: Try to sign with encrypted key
const signature = await openpgp.sign({
  message,
  signingKeys: encryptedPrivateKey // This will fail!
});

// ✅ GOOD: Decrypt first
const decryptedKey = await openpgp.decryptKey({
  privateKey: encryptedPrivateKey,
  passphrase: 'secret'
});
const signature = await openpgp.sign({
  message,
  signingKeys: decryptedKey
});
```

**3. Verification Returns Promise**

```typescript
// ❌ BAD: Forget to await
const valid = verification.signatures[0].verified;
// This is a Promise<boolean>, not boolean!

// ✅ GOOD: Await verification
const valid = await verification.signatures[0].verified;
```

---

## Testing AI Agents

### Test Approval Agent Locally

**Create test approval signature**:

```bash
# In chat:
1. Send message: "I approve the Q4 marketing budget of $50,000"
2. Sign the message with purpose: "approval"
3. Check Firestore trigger fires
4. Check approval agent processes signature
```

**Monitor in Firebase Emulator**:
```bash
# Terminal with function logs:
[SIG-TRIGGER] Signature created: sig123
[SIG-TRIGGER] Re-verifying signature...
[SIG-TRIGGER] Verified: true
[APPROVAL-AGENT] Processing approval...
[APPROVAL-AGENT] Calling OpenAI to extract details...
[APPROVAL-AGENT] Approver: alice@test.com
[APPROVAL-AGENT] Item: Q4 marketing budget
[APPROVAL-AGENT] Amount: 50000
[APPROVAL-AGENT] Creating action item...
[APPROVAL-AGENT] Posting confirmation message...
```

**Verify action item created**:
```bash
# Firestore: actionItems/{itemId}
{
  type: 'approval',
  approver: 'alice@test.com',
  description: 'Q4 marketing budget',
  amount: 50000,
  signatureId: 'sig123',
  verifiedBy: 'ai-agent-approval',
  status: 'approved'
}
```

---

### Mock OpenAI During Testing

**To avoid API costs during dev**:

```typescript
// functions/src/agents/approvalAgent.ts

const MOCK_MODE = process.env.FUNCTIONS_EMULATOR === 'true';

export async function processApprovalSignature(signature: any) {
  let approvalDetails;

  if (MOCK_MODE) {
    // Mock response for testing
    console.log('[APPROVAL-AGENT] MOCK MODE - Using fake extraction');
    approvalDetails = {
      approver: signature.signedPayload.signerId,
      description: 'Mock approval item',
      amount: 1000
    };
  } else {
    // Real OpenAI call
    const { text } = await generateText({ ... });
    approvalDetails = JSON.parse(text);
  }

  // ... rest of function
}
```

---

### Test Agent Queries

**Test querying signatures by purpose**:

```typescript
// In Firebase functions shell
async function testAgentQuery() {
  const approvals = await admin.firestore()
    .collectionGroup('signatures')
    .where('purpose', '==', 'approval')
    .where('verified', '==', true)
    .get();

  console.log('Found approvals:', approvals.size);
  approvals.forEach(doc => {
    console.log('- ', doc.data().signedPayload.signerId);
  });
}

testAgentQuery();
```

---

## Common Pitfalls

### 1. Forgetting to Decrypt Private Key

```typescript
// ❌ COMMON MISTAKE
async function createSignature() {
  const privateKeyEncrypted = await getPrivateKey();

  // This will fail! Private key is encrypted
  const signature = await openpgp.sign({
    message,
    signingKeys: await openpgp.readPrivateKey({
      armoredKey: privateKeyEncrypted
    })
  });
}

// ✅ CORRECT
async function createSignature() {
  const privateKeyEncrypted = await getPrivateKey();
  const passphrase = await promptForPassphrase();

  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({
      armoredKey: privateKeyEncrypted
    }),
    passphrase
  });

  const signature = await openpgp.sign({
    message,
    signingKeys: privateKey
  });
}
```

---

### 2. Not Serializing Payload Correctly

```typescript
// ❌ BAD: Inconsistent serialization
const payload = { ... };
const payloadText = JSON.stringify(payload); // No spacing
// Later...
const payloadText2 = JSON.stringify(payload, null, 2); // With spacing
// Signatures won't match! JSON serialization must be identical

// ✅ GOOD: Consistent serialization
function serializePayload(payload: SignedPayload): string {
  return JSON.stringify(payload, null, 2); // Always use same format
}
```

---

### 3. Signature Verification Timing

```typescript
// ❌ BAD: Check before promise resolves
const verification = await openpgp.verify({ ... });
const valid = verification.signatures[0].verified; // This is a Promise!
if (valid) { ... } // Always true (Promise is truthy)

// ✅ GOOD: Await the verification promise
const verification = await openpgp.verify({ ... });
const valid = await verification.signatures[0].verified; // Await!
if (valid) { ... }
```

---

### 4. Not Handling Contiguous Selection Edge Cases

```typescript
// ❌ BAD: Simple array check
function isContiguous(ids: string[]): boolean {
  // This doesn't check actual message order!
  return ids.length > 0;
}

// ✅ GOOD: Check message indices
function isContiguous(selectedIds: string[], allMessages: Message[]): boolean {
  const indices = selectedIds
    .map(id => allMessages.findIndex(m => m.id === id))
    .sort((a, b) => a - b);

  // Check consecutive indices
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      return false;
    }
  }
  return true;
}
```

---

### 5. Firestore Timestamp Issues

```typescript
// ❌ BAD: Use Date.now() in payload
const payload = {
  timestamp: Date.now(), // Number
  signedAt: new Date().toISOString() // String
};

// ❌ BAD: Use Firestore timestamp in signature doc
await setDoc(doc(...), {
  createdAt: serverTimestamp() // This is a FieldValue, not serializable!
});

// ✅ GOOD: Separate payload (serializable) from doc (Firestore)
const payload = {
  timestamp: Date.now(),
  signedAt: new Date().toISOString()
};

await setDoc(doc(...), {
  signedPayload: payload,
  createdAt: serverTimestamp() // OK in doc, not in payload
});
```

---

## Performance Tips

### 1. Cache Decrypted Private Key

```typescript
// ❌ SLOW: Decrypt on every signature
let decryptedKey: openpgp.PrivateKey | null = null;

async function createSignature() {
  // Decrypt every time - SLOW!
  const privateKey = await openpgp.decryptKey({ ... });
  await openpgp.sign({ signingKeys: privateKey });
}

// ✅ FAST: Cache for session
let cachedPrivateKey: openpgp.PrivateKey | null = null;

async function ensurePrivateKey() {
  if (!cachedPrivateKey) {
    const passphrase = await promptForPassphrase();
    cachedPrivateKey = await openpgp.decryptKey({ ..., passphrase });
  }
  return cachedPrivateKey;
}

async function createSignature() {
  const privateKey = await ensurePrivateKey();
  await openpgp.sign({ signingKeys: privateKey });
}
```

---

### 2. Batch Firestore Updates

```typescript
// ❌ SLOW: Update each message individually
for (const message of messages) {
  await updateDoc(doc(db, 'conversations', convId, 'messages', message.id), {
    signatureIds: arrayUnion(signatureId),
    signatureCount: increment(1)
  });
}

// ✅ FAST: Use batch write
const batch = writeBatch(db);
for (const message of messages) {
  const ref = doc(db, 'conversations', convId, 'messages', message.id);
  batch.update(ref, {
    signatureIds: arrayUnion(signatureId),
    signatureCount: increment(1)
  });
}
await batch.commit(); // Single network round-trip
```

---

### 3. Lazy Load Signature Details

```typescript
// ❌ SLOW: Load all signature payloads upfront
const signatures = await getDocs(query(...));
const allSignatures = signatures.docs.map(doc => doc.data());
// This loads ALL data, including large payloads

// ✅ FAST: Load minimal data for list, full data on demand
// List view: Load only metadata
const signatures = await getDocs(query(
  collection(db, 'users', uid, 'signatures'),
  orderBy('createdAt', 'desc'),
  limit(20)
));

const cards = signatures.docs.map(doc => ({
  id: doc.id,
  signerId: doc.data().signedPayload.signerId,
  createdAt: doc.data().createdAt,
  purpose: doc.data().purpose,
  messageCount: doc.data().messageIds.length
}));

// Detail view: Load full payload only when user taps
async function loadSignatureDetail(id: string) {
  const doc = await getDoc(doc(db, 'users', uid, 'signatures', id));
  return doc.data(); // Full payload loaded here
}
```

---

## Useful Commands

### Firebase Emulator

```bash
# Start emulator with UI
npm run functions:dev

# Start with data import
firebase emulators:start --import ./emulator-data

# Export data
firebase emulators:export ./emulator-data

# View emulator UI
open http://localhost:4000
```

---

### Test Signature Creation

```bash
# In Firebase functions shell
firebase functions:shell

# Create test signature
> testCreateSignature()

# Verify signature
> testVerifySignature('sig123')

# List user's signatures
> admin.firestore().collection('users').doc('userId').collection('signatures').get()
```

---

### Debug OpenPGP

```javascript
// In browser console or Node.js REPL
const openpgp = require('openpgp');

// Test key generation
const { publicKey, privateKey } = await openpgp.generateKey({
  type: 'ecc',
  curve: 'curve25519',
  userIDs: [{ email: 'test@example.com' }],
  passphrase: 'test'
});

console.log('Public key:', publicKey);
console.log('Private key:', privateKey);

// Test signing
const message = await openpgp.createMessage({ text: 'Hello' });
const signature = await openpgp.sign({
  message,
  signingKeys: await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
    passphrase: 'test'
  })
});

console.log('Signature:', signature);
```

---

### Monitor Cloud Functions

```bash
# Watch function logs in real-time
firebase functions:log --only onSignatureCreated

# Check recent logs
firebase functions:log --limit 50

# Filter by severity
firebase functions:log --only onSignatureCreated --severity ERROR
```

---

### Firestore Queries

```bash
# In Emulator UI or Firebase Console

# Find all approval signatures
users/{userId}/signatures
  .where('purpose', '==', 'approval')
  .where('verified', '==', true)
  .orderBy('createdAt', 'desc')

# Find signatures for specific conversation
users/{userId}/signatures
  .where('conversationId', '==', 'conv123')
  .orderBy('createdAt', 'desc')

# Find action items by signature
actionItems
  .where('signatureId', '==', 'sig123')
```

---

## Quick Reference

### Performance Targets
- Key generation: < 500ms
- Signing: < 100ms
- Verification: < 50ms
- Drawer load: < 1s

### Key Sizes (ECC Curve25519)
- Public key: ~1KB
- Private key: ~2KB (encrypted)
- Signature: ~64 bytes
- Payload: ~1-10KB (depends on messages)

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "No keys found" | User hasn't generated keys | Navigate to Settings → Generate Keys |
| "Invalid passphrase" | Wrong passphrase entered | Re-enter correct passphrase |
| "Signature verification failed" | Payload modified or wrong key | Check payload serialization, verify public key |
| "Non-contiguous selection" | User selected non-adjacent messages | Select only adjacent messages |
| "Private key decryption failed" | Encrypted key can't be decrypted | Check passphrase, check key format |

---

## Best Practices Summary

1. ✅ **Always decrypt private key before signing**
2. ✅ **Cache decrypted key for session (don't persist)**
3. ✅ **Use consistent JSON serialization for payloads**
4. ✅ **Batch Firestore updates when possible**
5. ✅ **Add detailed logging for crypto operations**
6. ✅ **Test with emulator before deploying**
7. ✅ **Verify signatures server-side for AI agents**
8. ✅ **Use ECC Curve25519 for performance**
9. ✅ **Handle errors gracefully (show user-friendly messages)**
10. ✅ **Monitor performance in production**

---

**Document Version**: 1.0
**Status**: Living Document - Update as you discover new patterns!

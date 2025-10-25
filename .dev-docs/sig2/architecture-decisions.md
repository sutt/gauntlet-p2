# Digital Signatures v2 - Architecture Decisions & Critical Questions

## Document Overview
**Version**: 1.0
**Date**: 2025-10-25
**Status**: Planning Phase - Awaiting Decisions

This document captures the critical architectural questions and decisions for the server-side crypto implementation of digital signatures (sig2). The major change from sig/ is that **all cryptographic operations move to server-side** due to React Native/Expo package compatibility issues.

---

## Major Architectural Change

**Original Plan (sig/)**: Client-side cryptography using OpenPGP.js in React Native
- Private keys stored encrypted in Firestore
- Client decrypts and signs locally (~10-20ms)
- Server only verifies signatures for AI agents

**New Plan (sig2/)**: Server-side cryptography using OpenPGP.js in Cloud Functions
- Private keys stored and managed server-side
- Client triggers signing operations via Cloud Functions
- All crypto operations happen on server (~100-200ms + network)

**Reason for Change**: OpenPGP.js and other PGP libraries are not compatible with React Native/Expo framework

---

## Proof-of-Concept Scope

### POC Goal
Demonstrate that server-side digital signatures can be used by AI agents to verify authenticity and detect tampering of chat messages, enabling trusted automated actions.

### Feature Scope

**MUST HAVE** (P0 - Core POC):
- ✅ Server-side key generation
- ✅ Server-side message signing
- ✅ Server-side signature verification
- ✅ Signature storage in Firestore
- ✅ Basic signature drawer UI (view/manage signatures)
- ✅ Message badges showing signature status
- ✅ AI agent that can receive and verify signatures

**SHOULD HAVE** (P1 - Enhanced POC):
- ⚠️ Approval agent that extracts details from verified signatures
- ⚠️ Action item creation from approved signatures
- ⚠️ Agent confirmation messages in chat

**COULD HAVE** (P2 - Nice to have):
- ⏸️ Signature proposals (request counterparty to sign)
- ⏸️ Multiple signature types (approval, attestation, delegation)
- ⏸️ Signature export/import
- ⏸️ Key rotation

**WON'T HAVE** (Deferred):
- ❌ Production-grade key security (HSM, etc.)
- ❌ End-to-end encryption
- ❌ Client-side verification UI
- ❌ Advanced agent orchestration
- ❌ Multi-region deployment

### Success Criteria

The POC is successful when:
1. ✅ User can generate keys (server-side)
2. ✅ User can sign one or more contiguous messages
3. ✅ Signature is cryptographically valid
4. ✅ Signature appears in drawer with correct metadata
5. ✅ AI agent can fetch signature
6. ✅ AI agent can verify signature authenticity
7. ✅ AI agent can detect tampered signatures (fails verification)
8. ✅ Total signing operation completes in < 1 second
9. ✅ All operations work in Firebase Emulator (local dev)

---

## Critical Questions & Decisions

### 1. Private Key Storage & Security Model

**Question**: Where and how will private keys be stored on the server-side, and what authentication/authorization model will prevent unauthorized signing operations?

**Context**:
- Original plan stored encrypted private keys in Firestore with client-side decryption
- Moving to server-side creates fundamental security question: if the server can sign on behalf of users, how do we prevent unauthorized signatures?
- This is a trust model decision that affects the entire architecture

**Options**:
1. **Store encrypted keys in Firestore with user passphrase** (most secure)
   - Pros: User controls decryption, server can't forge signatures
   - Cons: User enters passphrase on every sign operation (poor UX)

2. **Store encrypted keys with server-managed encryption** (balanced)
   - Pros: Reasonable security, better UX
   - Cons: Server compromise = all keys compromised

3. **Store unencrypted keys in Firestore** (least secure)
   - Pros: Simplest implementation, best UX
   - Cons: Anyone with Firestore access can forge signatures

4. **Hardware Security Module (HSM) / Cloud KMS** (production-grade)
   - Pros: Industry standard, very secure
   - Cons: Complex, expensive, overkill for POC

**DECISION NEEDED**:
- [ ] Choose security model for POC
- [ ] Define if/how passphrases are used
- [ ] Define threat model we're protecting against

**RECOMMENDATION FOR POC**: Option 2 or 3
- For POC, accept "trust the server" model
- Store keys encrypted with a server-managed key in Cloud Secret Manager
- Document this as a POC limitation, plan for HSM in production
- Focus on proving the signing/verification workflow works

---

### 2. User Experience for Signing Operations

**Question**: How will users authenticate/authorize individual signing operations if the server holds their private keys?

**Context**:
- Client-side signing was instant (~10-20ms)
- Server-side introduces network latency (~100-500ms)
- Need mechanism for user to prove intent to sign
- Risk of replay attacks if not designed carefully

**UX Flow Options**:

**Option A: Session-based authorization (recommended for POC)**
```
1. User selects messages in chat
2. User taps "Sign" button
3. Client calls Cloud Function with Firebase Auth token
4. Server validates user is authenticated
5. Server signs with user's key
6. Returns signature to client
7. Total time: ~200-500ms
```
- Pros: Simple, no additional user interaction
- Cons: Auth token could be stolen and used to forge signatures

**Option B: Passphrase-per-signature (most secure)**
```
1. User selects messages
2. User taps "Sign"
3. Modal prompts for passphrase
4. Client sends passphrase (over HTTPS) to server
5. Server decrypts key with passphrase
6. Server signs and returns signature
7. Total time: ~500ms-1s (plus user input time)
```
- Pros: User explicitly authorizes each signature
- Cons: Poor UX, passphrase sent over network (even if encrypted)

**Option C: Biometric + session token (production-grade)**
```
1. User authenticates with biometric (Face ID, fingerprint)
2. Client gets short-lived signing token
3. Token used to authorize signing operation
4. Token expires after use or timeout
```
- Pros: Great UX, secure
- Cons: Complex, requires native biometric integration

**DECISION NEEDED**:
- [ ] Choose UX flow for POC
- [ ] Define how user authorizes signing
- [ ] Define session token lifetime/scope
- [ ] Define replay attack prevention mechanism

**RECOMMENDATION FOR POC**: Option A (session-based)
- Use Firebase Auth token as authorization
- Add nonce to payload to prevent replay attacks
- Add short-lived rate limiting (e.g., max 10 signatures per minute)
- Document as POC limitation, plan for biometric in production

---

### 3. Key Generation Trigger & Onboarding

**Question**: When and how are server-side keys generated for users, and how do we handle the initial key generation flow?

**Context**:
- Original plan had users generate keys in dedicated settings screen
- With server-side generation, need to trigger Cloud Function
- Key generation has network latency
- Need to handle failures gracefully

**Key Generation Flow Options**:

**Option A: Explicit setup screen (recommended)**
```
1. User navigates to Settings > Digital Signatures
2. Taps "Generate Keys" button
3. (Optional) Enters passphrase
4. Client calls Cloud Function: generateKeys()
5. Server generates ECC Curve25519 key pair
6. Server stores keys in Firestore
7. Returns success to client
8. UI shows "Keys configured ✓"
```
- Pros: User aware of feature, explicit opt-in
- Cons: Extra step before using signatures

**Option B: Auto-generate on first signature attempt (lazy)**
```
1. User tries to sign messages
2. Client checks if keys exist
3. If not, automatically call generateKeys()
4. Then proceed with signing
5. Total time: ~500ms-1s for first signature
```
- Pros: No extra setup step, seamless UX
- Cons: User unaware keys were created, slower first signature

**Option C: Auto-generate on user account creation**
```
1. User signs up / first login
2. Cloud Function trigger auto-generates keys
3. Keys ready before user accesses chat
```
- Pros: No user interaction needed, keys always available
- Cons: Generates keys for users who may never use signatures

**DECISION NEEDED**:
- [ ] Choose key generation trigger
- [ ] Decide if passphrase is required
- [ ] Define key generation Cloud Function interface
- [ ] Define error handling for failed generation

**RECOMMENDATION FOR POC**: Option A (explicit setup)
- Create simple settings screen with "Generate Keys" button
- No passphrase required for POC (use server-managed encryption)
- Cloud Function: `generateKeysForUser` (callable)
- Store keys in `users/{uid}` document
- Clear success/error feedback to user

---

### 4. Performance & Cost at Scale

**Question**: What are the performance and cost implications of server-side crypto operations for a POC with limited users vs. production scale?

**Context**:
- Client-side signing: ~10-20ms
- Server-side signing: ~100ms + network latency (~200-500ms total)
- Every signature requires Cloud Function invocation
- Need to estimate costs and acceptable latency

**Performance Estimates**:

| Operation | Client-side (original) | Server-side (sig2) | Delta |
|-----------|------------------------|---------------------|-------|
| Key generation | 200-500ms | 300-800ms | +100-300ms (network) |
| Signing | 10-20ms | 200-500ms | +190-480ms (network + server) |
| Verification | 8-15ms | 50-100ms (server only) | Varies by location |

**Cost Estimates (POC with 10 users, 100 signatures/month)**:

| Resource | Usage | Cost (monthly) |
|----------|-------|----------------|
| Cloud Functions (invocations) | ~200 calls | $0 (free tier: 2M/month) |
| Cloud Functions (compute) | 200 × 100ms = 20s | $0 (free tier) |
| Firestore reads | ~500 reads | $0 (free tier: 50K/day) |
| Firestore writes | ~200 writes | $0 (free tier: 20K/day) |
| **Total** | | **$0** |

**Cost Estimates (Production with 1,000 users, 10K signatures/month)**:

| Resource | Usage | Cost (monthly) |
|----------|-------|----------------|
| Cloud Functions (invocations) | ~20K calls | $0.08 |
| Cloud Functions (compute) | 20K × 100ms = 2,000s | $0.05 |
| Firestore reads | ~50K reads | $0.06 |
| Firestore writes | ~20K writes | $0.36 |
| **Total** | | **~$0.55/month** |

**DECISION NEEDED**:
- [ ] Is 200-500ms acceptable latency for POC?
- [ ] What's the performance target for production?
- [ ] Do we need optimization strategies (caching, batching)?

**RECOMMENDATION FOR POC**:
- ✅ Accept 200-500ms latency for POC (document as known limitation)
- ✅ Costs are negligible for POC and reasonable for production scale
- ⏸️ Defer optimization until after POC validation
- 📝 Document performance in testing phase
- 🎯 Target: < 1 second total time for signing operation

---

### 5. AI Agent Verification Flow

**Question**: How do AI agents verify signatures and access public keys when keys are managed server-side?

**Context**:
- AI agents need to verify signature authenticity
- Need to fetch public keys by email
- Verification happens in same Cloud Function environment
- Need to define permission model

**AI Agent Verification Flow**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Signature Created                                         │
│    - User signs messages via Cloud Function                 │
│    - Signature stored in Firestore                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Firestore Trigger: onSignatureCreated                    │
│    - Detects new signature document                         │
│    - Extracts signatureId, userId, conversationId           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Fetch Signature Data                                      │
│    - Read signature document from Firestore                 │
│    - Extract: signedPayload, pgpSignature, signerId (email) │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Lookup Public Key                                         │
│    - Query users collection by email                        │
│    - Fetch signer's public key                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Verify Signature (Server-side OpenPGP.js)                │
│    - Deserialize payload                                    │
│    - Verify PGP signature with public key                   │
│    - Return: { valid: true/false, fingerprint }            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Update Verification Status                                │
│    - Update signature doc: verified = true/false            │
│    - Add verifiedAt timestamp                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. AI Agent Action (if verified)                            │
│    - Check signature purpose (e.g., "approval")             │
│    - Log verification result                                │
│    - (Future) Extract details, create action items          │
└─────────────────────────────────────────────────────────────┘
```

**Agent Permission Model**:
- Agents run as Cloud Functions with Admin SDK access
- No additional authentication needed (inherently trusted)
- Agents can read all signatures (via admin access)
- Agents cannot create signatures on behalf of users
- (Future) Agent-to-agent signatures may be needed

**DECISION NEEDED**:
- [ ] Confirm agent verification flow above
- [ ] Define what agent does after verification (for POC)
- [ ] Define agent logging/monitoring strategy

**RECOMMENDATION FOR POC**:
- ✅ Use Firestore trigger: `onDocumentCreated('users/{uid}/signatures/{sigId}')`
- ✅ Agent re-verifies all signatures server-side (security layer)
- ✅ Update verification status in Firestore
- ✅ For POC: Agent logs verification result (console + Firestore)
- ⏸️ Defer: Agent extracts approval details, creates action items (phase 2)

---

### 6. Payload Integrity & Replay Protection

**Question**: With server-side signing, how do we ensure the client hasn't tampered with the payload before sending it to the server for signing?

**Context**:
- Client builds payload (message IDs, text, metadata)
- Client sends payload to server for signing
- **Attack vector**: Malicious client could modify payload
- Need to balance security with performance

**Payload Building Options**:

**Option A: Server re-fetches messages (most secure)**
```typescript
// Client sends only message IDs
await signMessages({
  conversationId: 'conv123',
  messageIds: ['msg1', 'msg2', 'msg3']
});

// Server re-fetches from Firestore
const messages = await fetchMessages(conversationId, messageIds);
const payload = buildPayload(messages, metadata);
const signature = await signPayload(payload, privateKey);
```
- Pros: Server has source of truth, client can't tamper
- Cons: Extra Firestore reads (~100-200ms), higher cost

**Option B: Trust client-provided payload (least secure)**
```typescript
// Client sends full payload
const payload = buildPayloadLocally(messages);
await signMessages({ payload });

// Server signs directly
const signature = await signPayload(payload, privateKey);
```
- Pros: Fast, no extra Firestore reads
- Cons: Client could inject fake messages, modify text

**Option C: Hybrid - client sends payload, server validates (balanced)**
```typescript
// Client sends payload + message IDs
const payload = buildPayloadLocally(messages);
await signMessages({
  payload,
  messageIds: ['msg1', 'msg2', 'msg3']
});

// Server validates
const actualMessages = await fetchMessages(conversationId, messageIds);
if (!validatePayload(payload, actualMessages)) {
  throw new Error('Payload tampering detected');
}
const signature = await signPayload(payload, privateKey);
```
- Pros: Catches tampering, reasonable performance
- Cons: Still requires Firestore reads (but can be optimized)

**Replay Protection Mechanisms**:
1. **Nonce**: Random value included in payload
2. **Timestamp**: Creation timestamp in payload
3. **ConversationId**: Binds signature to specific conversation
4. **Message sequence**: Validate messages are contiguous

**DECISION NEEDED**:
- [ ] Choose payload building strategy
- [ ] Define validation rules
- [ ] Define replay protection mechanisms
- [ ] Define what happens if tampering detected

**RECOMMENDATION FOR POC**: Option C (hybrid validation)
- Client sends: `{ conversationId, messageIds, purpose, notes }`
- Server re-fetches messages from Firestore
- Server validates messageIds are contiguous
- Server builds canonical payload
- Server signs payload
- Add nonce (random) and timestamp to payload
- Document limitation: Server-side validation adds ~100-200ms

---

### 7. Migration Path & Backward Compatibility

**Question**: Are we building sig2 as a complete replacement, or do we need to support both client-side and server-side signatures during transition?

**Context**:
- Original sig/ plan is well-developed
- Code may already exist (unclear)
- Need to decide on migration strategy

**Migration Options**:

**Option A: Clean slate (recommended for POC)**
- Build sig2 from scratch in new directory
- No backward compatibility with sig/
- Fresh start, no technical debt
- Can reference sig/ docs for design patterns

**Option B: Gradual migration**
- Implement server-side alongside client-side
- Support both signature types
- Add version field to signature documents
- Complex, requires dual implementation

**Option C: Fork and adapt**
- Copy sig/ code to sig2/
- Modify to use server-side crypto
- Maintain similar structure
- Risk of carrying over incompatible assumptions

**DECISION NEEDED**:
- [ ] Is any sig/ code already implemented?
- [ ] Do we need to support old signatures?
- [ ] Should sig2 file structure match sig/?

**RECOMMENDATION FOR POC**: Option A (clean slate)
- ✅ Build sig2 as new implementation
- ✅ No backward compatibility needed for POC
- ✅ Use sig/ docs as design reference, not code base
- ✅ Signature payload should include `version: "2.0"` field
- 📝 Document migration path as future work if POC succeeds

---

### 8. Passphrase Handling (if used)

**Question**: If passphrases are used for key encryption, how are they securely transmitted and managed?

**Context**:
- Passphrases add security but complexity
- Need to transmit from client to server
- Need to decide on storage/caching strategy

**Passphrase Options**:

**Option A: No passphrase for POC (recommended)**
- Keys encrypted with server-managed key in Secret Manager
- Simpler implementation
- Focus on proving signature workflow
- Document as POC limitation

**Option B: Passphrase per signature**
- User enters passphrase every time
- Transmitted over HTTPS to server
- Server uses passphrase to decrypt key
- Never stored, only used in-memory
- Poor UX but most secure

**Option C: Passphrase cached in session**
- User enters passphrase once per session
- Client stores in secure memory (not persisted)
- Sent with each signing request
- Clears on logout/timeout
- Better UX, reasonable security

**DECISION NEEDED**:
- [ ] Use passphrases in POC or defer?
- [ ] If used, how are they transmitted?
- [ ] How long are they cached?

**RECOMMENDATION FOR POC**: Option A (no passphrase)
- ✅ Keys encrypted with server-managed key (Cloud Secret Manager)
- ✅ Focus POC on signature workflow, not key security
- ✅ Document as limitation: "Trust the server" model
- 📝 Plan for passphrase support in production
- 🎯 This simplifies POC significantly

---

## Summary of Recommendations for POC

Based on the analysis above, here are the recommended decisions for moving forward with the POC:

### Security Model (Question 1 & 8)
- **Accept "trust the server" model for POC**
- Store private keys encrypted with server-managed key (Cloud Secret Manager)
- No user passphrases required
- Document this as POC limitation

### UX Flow (Question 2)
- **Session-based authorization**
- Use Firebase Auth token to authorize signing
- Add nonce to payload for replay protection
- Rate limit: max 10 signatures per minute per user
- Target latency: < 1 second total

### Key Generation (Question 3)
- **Explicit setup screen in Settings**
- User taps "Generate Keys" button
- Callable Cloud Function: `generateKeysForUser()`
- Keys stored in `users/{uid}` document
- No passphrase required for POC

### Performance (Question 4)
- **Accept 200-500ms latency for POC**
- Costs negligible for POC scale
- Defer optimization until after validation
- Document performance metrics during testing

### AI Agent Flow (Question 5)
- **Firestore trigger on signature creation**
- Agent re-verifies signature server-side
- Updates verification status in Firestore
- For POC: Logs verification result only
- Defer: Approval extraction, action item creation

### Payload Integrity (Question 6)
- **Hybrid approach: server validates payload**
- Client sends: conversationId, messageIds, purpose, notes
- Server re-fetches messages from Firestore
- Server validates contiguity and builds canonical payload
- Server signs payload

### Migration (Question 7)
- **Clean slate implementation**
- No backward compatibility with sig/
- Use sig/ docs as reference only
- Add `version: "2.0"` to signature payload format

---

## Next Steps

After these decisions are confirmed:

1. ✅ Create detailed architecture document (architecture-sig2.md)
2. ✅ Create task breakdown document (tasks-sig2.md)
3. ✅ Create workflows document (workflows-sig2.md)
4. ✅ Update POC scope in all documents
5. ✅ Begin Phase 1 implementation: Server-side key generation

---

## Confirmed Decisions

✅ **Q1: Security Model**
- **Decision**: Trust the server model, keys stored in Firestore (unencrypted)
- **Rationale**: Simplest POC implementation, no Cloud Secret Manager complexity
- **Limitation**: Anyone with Firestore admin access can forge signatures
- **Future**: Add encryption layer or move to HSM for production

✅ **Q2: User Authorization**
- **Decision**: Session-based authorization using Firebase Auth token
- **Implementation**: Client sends auth token + message IDs, server validates and signs
- **Security**: Add nonce to payload, rate limiting (10 signatures/min)
- **UX**: No additional user interaction beyond "Sign" button

✅ **Q3: Key Generation Flow**
- **Decision**: Explicit setup screen with user confirmation
- **Flow**: User navigates to Settings → "Set Up Signatures" → Confirms → Server auto-generates keys
- **UX**: Clear opt-in, user aware of feature before keys created
- **Implementation**: Callable Cloud Function triggered after user confirmation

✅ **Q4: Performance Target**
- **Decision**: Target < 1 second total latency for POC
- **Crypto**: Use ECC Curve25519 (fast, ~100ms server-side)
- **Priority**: Not critical to optimize further for POC
- **Measurement**: Document actual performance during testing

✅ **Q5: AI Agent Behavior**
- **Decision**: Agent verifies signature AND extracts payload for decision making
- **Flow**:
  1. Agent receives signature (Firestore trigger)
  2. Agent verifies signature authenticity
  3. If valid: Extract payload and use as context in decision loop
  4. If invalid: Log tampering detection, no action taken
- **Scope**: This is more than "just logging" - agent actively uses verified payload
- **Future**: Add specific approval extraction, action item creation

✅ **Q6: Payload Integrity**
- **Decision**: Trust client-provided payload (least secure)
- **Rationale**: Simpler implementation, focus POC on signing workflow
- **Limitation**: Malicious client could inject fake messages into payload
- **Documentation**: Call out as known POC limitation
- **Future**: Implement server-side validation (re-fetch from Firestore)

✅ **Q7: Migration Strategy**
- **Decision**: Clean slate implementation, no backward compatibility
- **Approach**: Reference sig/ docs for design patterns, but write fresh code
- **Context**: Some sig/ code exists but will be discarded
- **Version**: Signature format includes `version: "2.0"` field

✅ **Q8: Passphrase Handling**
- **Decision**: No passphrases for POC
- **Implementation**: Keys generated and stored server-side without user passphrase
- **Security**: Relies on Firebase Auth + server trust model
- **Future**: Add passphrase support for production

---

## Implementation Summary

Based on confirmed decisions, the POC will implement:

### Architecture
- **Client**: React Native/Expo app (no crypto libraries needed)
- **Server**: Cloud Functions with OpenPGP.js for all crypto operations
- **Storage**: Firestore for keys (unencrypted), signatures, and metadata
- **Auth**: Firebase Authentication tokens for authorization

### Crypto Approach
- **Algorithm**: ECC Curve25519 (fast, modern)
- **Key Storage**: Firestore, unencrypted, per-user
- **Signing**: Server-side, authorized by Firebase Auth token
- **Verification**: Server-side, triggered on signature creation

### Security Posture (POC)
- ⚠️ **Trust the server**: Server can forge signatures
- ⚠️ **Trust the client**: Client can inject fake messages into payload
- ⚠️ **No passphrases**: User doesn't control key encryption
- ✅ **Valid signatures are cryptographically sound**: PGP verification works
- ✅ **Tamper detection**: Modified signatures fail verification
- 📝 **All limitations documented**: Clear path to production security

### AI Agent Capability
- ✅ Verify signature authenticity
- ✅ Extract payload from verified signatures
- ✅ Use payload as context in decision making
- ⏸️ Approval detail extraction (post-POC)
- ⏸️ Action item creation (post-POC)

---

**Document Status**: ✅ Decisions Confirmed
**Next Steps**: Generate detailed planning documents
**Next Document**: architecture-sig2.md

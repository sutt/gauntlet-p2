# Digital Signatures v2 - Planning Documents

## Overview

This directory contains the complete planning documentation for implementing server-side digital signatures (sig2). The major change from the original plan (sig/) is that **all cryptographic operations have been moved to the server-side** due to React Native/Expo package compatibility issues with PGP libraries.

---

## Documents

### 1. [architecture-decisions.md](./architecture-decisions.md)
**Status**: ✅ Decisions Confirmed

Critical architectural questions and confirmed decisions:
- Security model: Trust the server, keys in Firestore (unencrypted)
- Authorization: Session-based (Firebase Auth tokens)
- Key generation: Explicit setup screen
- Performance: Target < 1 second
- AI agent: Verifies signatures and extracts payload
- Payload integrity: Trust client (POC limitation)
- Migration: Clean slate implementation
- Passphrases: None for POC

### 2. [architecture-sig2.md](./architecture-sig2.md)
**Status**: ✅ Complete

Detailed technical architecture:
- System architecture diagrams
- Data model (Firestore collections)
- API design (Cloud Functions)
- Security architecture
- Performance considerations
- Technology stack

### 3. [workflows-sig2.md](./workflows-sig2.md)
**Status**: ✅ Complete

Developer workflows and testing:
- Development setup
- Testing workflows (key gen, signing, verification)
- Debugging guide with detailed logging
- Common patterns and examples
- Quick reference

### 4. [tasks-sig2.md](./tasks-sig2.md)
**Status**: ✅ Complete

Phased implementation plan (4-5 weeks):
- Phase 1: Server-side key generation (1 week)
- Phase 2: Server-side message signing (1.5 weeks)
- Phase 3: Signature drawer & UI (1 week)
- Phase 4: AI agent integration (0.5 weeks)

Each phase includes detailed task breakdowns with code examples.

---

## POC Scope

### Must Have (P0)
- ✅ Server-side key generation
- ✅ Server-side message signing
- ✅ Server-side signature verification
- ✅ Signature storage in Firestore
- ✅ Signature drawer UI (view/manage signatures)
- ✅ Message badges showing signature status
- ✅ AI agent that verifies signatures and extracts payload

### Should Have (P1)
- ⚠️ Approval agent that extracts details (post-POC)
- ⚠️ Action item creation (post-POC)
- ⚠️ Agent confirmation messages (post-POC)

### Won't Have (Deferred)
- ❌ Production-grade key security (HSM, etc.)
- ❌ End-to-end encryption
- ❌ Client-side verification UI
- ❌ Signature proposals
- ❌ Multiple signature types
- ❌ Key rotation/revocation

---

## Success Criteria

The POC is successful when:
1. ✅ User can generate keys (server-side)
2. ✅ User can sign one or more contiguous messages
3. ✅ Signature is cryptographically valid
4. ✅ Signature appears in drawer with correct metadata
5. ✅ AI agent can fetch signature
6. ✅ AI agent can verify signature authenticity
7. ✅ AI agent can detect tampered signatures (fails verification)
8. ✅ AI agent can extract payload and use in decision-making
9. ✅ Total signing operation completes in < 1 second
10. ✅ All operations work in Firebase Emulator (local dev)

---

## Key Decisions Summary

### Security (POC)
- **Trust the server model**: Server has access to unencrypted private keys
- **No passphrases**: Keys stored in Firestore without user passphrase
- **Trust client payload**: Client-provided message data trusted (not re-fetched)
- **Limitations documented**: Clear path to production security

### Architecture
- **Client**: React Native/Expo (NO crypto libraries)
- **Server**: Cloud Functions + OpenPGP.js (all crypto operations)
- **Storage**: Firestore (keys, signatures, metadata)
- **Auth**: Firebase Authentication tokens

### Crypto
- **Algorithm**: ECC Curve25519 (fast, modern)
- **Key storage**: Firestore, unencrypted
- **Signing**: Server-side, ~100ms
- **Verification**: Server-side trigger, ~50-100ms

### AI Agent
- **Trigger**: Firestore onCreate for signatures
- **Verifies**: All signatures server-side
- **Extracts**: Payload from verified signatures
- **Uses**: Payload as context in decision-making
- **Future**: Approval extraction, action items

---

## Timeline

**Total**: 4-5 weeks

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | 1 week | Server-side key generation working |
| Phase 2 | 1.5 weeks | Message signing working, badges showing |
| Phase 3 | 1 week | Signature drawer UI complete |
| Phase 4 | 0.5 weeks | AI agent verification working |
| Buffer | 0.5-1 week | Testing, polish, documentation |

---

## Next Steps

1. ✅ Review all planning documents
2. ✅ Confirm architectural decisions
3. 🎯 **BEGIN PHASE 1**: Server-side key generation
   - Install OpenPGP.js in functions/
   - Create type definitions
   - Implement `generateKeysForUser` Cloud Function
   - Build key setup UI screen
   - Test in Firebase Emulator

---

## Reference Documents

For design patterns and context (not for code reuse):
- `.dev-docs/sig/architecture-sig.md` - Original client-side plan
- `.dev-docs/sig/workflows-sig.md` - Original workflows
- `.dev-docs/sig/tasks-sig.md` - Original task breakdown

**Note**: sig/ was designed for client-side crypto. Do NOT copy code from sig/, only reference for design patterns.

---

## Quick Start Commands

```bash
# Install OpenPGP.js (server-side only)
cd functions
npm install openpgp@^5.11.0

# Start Firebase Emulator
cd ..
npm run functions:dev

# In another terminal: Start app
npm start

# In another terminal: Watch functions build
cd functions
npm run build:watch
```

---

**Document Status**: ✅ Planning Complete
**Ready for**: Implementation Phase 1
**Date**: 2025-10-25

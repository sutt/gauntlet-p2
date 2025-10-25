# Digital Signatures - Task Breakdown

## Document Overview
**Version**: 1.0
**Date**: 2025-10-23
**Status**: Planning Phase
**Timeline**: 9 weeks (6 phases)

This document outlines the phased implementation plan for digital signatures, starting with key management and progressing to AI agent integration.

---

## Table of Contents
1. [Phase 1: Foundation - Key Management](#phase-1-foundation---key-management)
2. [Phase 2: Signature Creation](#phase-2-signature-creation)
3. [Phase 3: Signature Drawer](#phase-3-signature-drawer)
4. [Phase 4: Signature Proposals](#phase-4-signature-proposals)
5. [Phase 5: AI Agent Integration](#phase-5-ai-agent-integration)
6. [Phase 6: Testing & Refinement](#phase-6-testing--refinement)
7. [Development Workflow](#development-workflow)
8. [Testing Strategy](#testing-strategy)

---

## Phase 1: Foundation - Key Management

**Goal**: Users can generate and manage PGP key pairs

**Duration**: 1-2 weeks

**Priority**: P0 (Blocking for all other work)

---

### Task 1.1: Install OpenPGP.js

#### 1.1.1 Add Dependencies

**Client (React Native)**:
```bash
cd /home/user/gauntlet/pkgs/p2/hello-expo
npm install openpgp@^5.11.0
```

**Server (Cloud Functions)**:
```bash
cd functions
npm install openpgp@^5.11.0
```

**Verify Installation**:
```typescript
// Test in functions/src/index.ts
import * as openpgp from 'openpgp';
console.log('OpenPGP version:', openpgp.config.versionString);
```

**Deliverable**: OpenPGP.js installed and working in both client and server

---

#### 1.1.2 Create Type Definitions

**File**: `types/signature.ts`
```typescript
export interface PGPKeyPair {
  publicKey: string;      // Armored public key
  privateKey: string;     // Armored private key (encrypted)
  fingerprint: string;    // Key fingerprint
  createdAt: Date;
}

export interface SignedPayload {
  version: string;
  timestamp: number;
  signedAt: string;
  signerId: string;       // User email

  conversationId: string;
  participants: {
    email: string;
    displayName: string;
  }[];

  messages: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    sentAt: string;
  }[];

  purpose?: string;
  notes?: string;
  expiresAt?: number;
  nonce?: string;
}

export interface Signature {
  signatureId: string;
  signedPayload: SignedPayload;
  pgpSignature: string;   // Armored PGP signature
  publicKey: string;
  createdAt: Date;
  conversationId: string;
  messageIds: string[];
  purpose?: string;
  verified: boolean;
  verifiedAt?: Date;
}
```

**Deliverable**: Type definitions created

---

### Task 1.2: Key Generation UI

#### 1.2.1 Create Key Generation Screen

**File**: `app/settings/signature-setup.tsx`
```typescript
import { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { generateKeys } from '../../services/signatures';

export default function SignatureSetupScreen() {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateKeys = async () => {
    // Validate passphrase
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await generateKeys(passphrase);
      // Navigate to success screen
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Digital Signatures</Text>

      <Text style={styles.description}>
        Digital signatures provide cryptographic proof you signed a message.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter passphrase (min 8 characters)"
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm passphrase"
        value={confirmPassphrase}
        onChangeText={setConfirmPassphrase}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={loading ? 'Generating...' : 'Generate Keys'}
        onPress={handleGenerateKeys}
        disabled={loading}
      />

      {loading && <ActivityIndicator style={styles.loader} />}
    </View>
  );
}
```

**Deliverable**: Key generation UI screen

---

#### 1.2.2 Implement Key Generation Service

**File**: `services/signatures.ts`
```typescript
import * as openpgp from 'openpgp';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { PGPKeyPair } from '../types/signature';

/**
 * Generate ECC Curve25519 key pair
 * ~100-200ms on mobile devices
 */
export async function generateKeys(passphrase: string): Promise<PGPKeyPair> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  // Generate ECC key pair
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: user.displayName || 'User', email: user.email! }],
    passphrase: passphrase,
    format: 'armored'
  });

  // Get fingerprint
  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = publicKeyObj.getFingerprint();

  const keyPair: PGPKeyPair = {
    publicKey,
    privateKey,
    fingerprint,
    createdAt: new Date()
  };

  // Store in Firestore
  await setDoc(doc(db, 'users', user.uid), {
    publicKey,
    privateKeyEncrypted: privateKey,
    publicKeyFingerprint: fingerprint,
    publicKeyCreatedAt: new Date(),
  }, { merge: true });

  return keyPair;
}

/**
 * Check if user has keys
 */
export async function hasKeys(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  return userDoc.exists() && !!userDoc.data()?.publicKey;
}
```

**Deliverable**: Key generation service implemented

---

#### 1.2.3 Test Key Generation

**Manual Test Checklist**:
- [ ] Navigate to signature setup screen
- [ ] Enter passphrase (8+ characters)
- [ ] Confirm passphrase matches
- [ ] Click "Generate Keys"
- [ ] See loading indicator (~100-200ms)
- [ ] Keys saved to Firestore
- [ ] Public key visible in user document
- [ ] Fingerprint displayed correctly

**Performance Test**:
- [ ] Key generation completes in < 500ms
- [ ] No UI blocking during generation

**Deliverable**: Key generation tested and working

---

### Task 1.3: Key Management UI

#### 1.3.1 Add Key Status to Settings

**File**: `app/settings/index.tsx` (add section)
```typescript
import { hasKeys } from '../../services/signatures';

export default function SettingsScreen() {
  const [keysExist, setKeysExist] = useState(false);

  useEffect(() => {
    checkKeys();
  }, []);

  const checkKeys = async () => {
    const exists = await hasKeys();
    setKeysExist(exists);
  };

  return (
    <View>
      {/* Existing settings */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Digital Signatures</Text>
        {keysExist ? (
          <>
            <Text style={styles.status}>✓ Keys configured</Text>
            <Button title="View Public Key" onPress={showPublicKey} />
            <Button title="Change Passphrase" onPress={changePassphrase} />
          </>
        ) : (
          <Button title="Set Up Signatures" onPress={navigateToSetup} />
        )}
      </View>
    </View>
  );
}
```

**Deliverable**: Settings UI shows key status

---

### Phase 1 Acceptance Criteria

- [ ] OpenPGP.js installed (client + server)
- [ ] Type definitions created
- [ ] Key generation UI implemented
- [ ] ECC Curve25519 keys generated successfully
- [ ] Keys stored encrypted in Firestore
- [ ] Public key fingerprint displayed
- [ ] Settings shows key status
- [ ] Performance: < 500ms key generation

**Estimated Completion**: Week 1-2

---

## Phase 2: Signature Creation

**Goal**: Users can sign contiguous message ranges

**Duration**: 1-2 weeks

**Priority**: P0

---

### Task 2.1: Message Selection Logic

#### 2.1.1 Implement Contiguous Selection

**File**: `hooks/useMessageSelection.ts`
```typescript
import { useState, useCallback } from 'react';

export function useMessageSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleMessage = useCallback((messageId: string, allMessages: Message[]) => {
    setSelectedIds(current => {
      if (current.includes(messageId)) {
        // Deselect
        return current.filter(id => id !== messageId);
      } else {
        // Select - check if contiguous
        const newSelection = [...current, messageId];
        if (!isContiguous(newSelection, allMessages)) {
          // Show warning
          Alert.alert('Invalid Selection', 'Please select continuous messages only');
          return current;
        }
        return newSelection;
      }
    });
  }, []);

  const isContiguous = (selectedIds: string[], allMessages: Message[]): boolean => {
    if (selectedIds.length <= 1) return true;

    // Get indices of selected messages
    const indices = selectedIds
      .map(id => allMessages.findIndex(m => m.id === id))
      .sort((a, b) => a - b);

    // Check if consecutive
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) {
        return false;
      }
    }

    return true;
  };

  return {
    selectedIds,
    selectionMode,
    setSelectionMode,
    toggleMessage,
    clearSelection: () => setSelectedIds([]),
  };
}
```

**Deliverable**: Contiguous message selection logic

---

#### 2.1.2 Add Long-Press Menu

**File**: `app/chat/[id].tsx` (modify)
```typescript
import { useMessageSelection } from '../../hooks/useMessageSelection';

export default function ChatScreen() {
  const { selectedIds, selectionMode, setSelectionMode, toggleMessage } = useMessageSelection();

  const handleMessageLongPress = (message: Message) => {
    if (selectionMode) {
      toggleMessage(message.id, messages);
    } else {
      // Show menu
      Alert.alert('Message Options', '', [
        {
          text: 'Select message(s) for signature',
          onPress: () => {
            setSelectionMode(true);
            toggleMessage(message.id, messages);
          }
        },
        {
          text: 'Propose signature for ' + otherParticipant.displayName,
          onPress: () => handleProposeSignature(message)
        },
        // ... other options
      ]);
    }
  };

  return (
    <View>
      {/* Messages list */}

      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text>{selectedIds.length} messages selected</Text>
          <Button title="Sign" onPress={handleSign} />
          <Button title="Cancel" onPress={() => setSelectionMode(false)} />
        </View>
      )}
    </View>
  );
}
```

**Deliverable**: Long-press menu with signature options

---

### Task 2.2: Signature Creation Flow

#### 2.2.1 Create Signature Modal

**File**: `components/signatures/SignatureModal.tsx`
```typescript
import { useState } from 'react';
import { Modal, View, Text, TextInput, Button } from 'react-native';
import { createSignature } from '../../services/signatures';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  conversationId: string;
}

export default function SignatureModal({
  visible,
  onClose,
  messages,
  conversationId
}: SignatureModalProps) {
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    setLoading(true);
    try {
      await createSignature({
        messages,
        conversationId,
        purpose,
        notes
      });
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Sign Messages</Text>

        <View style={styles.preview}>
          <Text style={styles.label}>Messages to sign:</Text>
          {messages.map(m => (
            <Text key={m.id} style={styles.message}>
              {m.senderName}: {m.text}
            </Text>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Purpose (optional): approval, attestation, etc."
          value={purpose}
          onChangeText={setPurpose}
        />

        <TextInput
          style={styles.input}
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Button
          title={loading ? 'Signing...' : 'Sign'}
          onPress={handleSign}
          disabled={loading}
        />
        <Button title="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
```

**Deliverable**: Signature modal UI

---

#### 2.2.2 Implement Signature Service

**File**: `services/signatures.ts` (extend)
```typescript
/**
 * Create signature for selected messages
 */
export async function createSignature({
  messages,
  conversationId,
  purpose,
  notes
}: {
  messages: Message[];
  conversationId: string;
  purpose?: string;
  notes?: string;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  // Fetch encrypted private key
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const privateKeyEncrypted = userDoc.data()?.privateKeyEncrypted;
  if (!privateKeyEncrypted) throw new Error('No keys found');

  // Prompt for passphrase (simplified - in real app, cache this)
  const passphrase = await promptForPassphrase();

  // Build payload
  const payload: SignedPayload = {
    version: '1.0',
    timestamp: Date.now(),
    signedAt: new Date().toISOString(),
    signerId: user.email!,
    conversationId,
    participants: await getParticipants(conversationId),
    messages: messages.map(m => ({
      messageId: m.id,
      text: m.text,
      senderId: m.senderId,
      senderName: m.senderName,
      timestamp: m.timestamp,
      sentAt: new Date(m.timestamp).toISOString()
    })),
    purpose,
    notes,
    nonce: generateNonce()
  };

  // Sign payload
  const payloadText = JSON.stringify(payload, null, 2);

  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyEncrypted }),
    passphrase
  });

  const message = await openpgp.createMessage({ text: payloadText });
  const signature = await openpgp.sign({
    message,
    signingKeys: privateKey,
    format: 'armored'
  });

  // Verify signature immediately
  const publicKey = await openpgp.readKey({ armoredKey: userDoc.data()!.publicKey });
  const verificationResult = await openpgp.verify({
    message: await openpgp.readMessage({ armoredMessage: signature }),
    verificationKeys: publicKey
  });
  const verified = await verificationResult.signatures[0].verified;

  // Save to Firestore
  const signatureId = generateId();
  await setDoc(doc(db, 'users', user.uid, 'signatures', signatureId), {
    signatureId,
    signedPayload: payload,
    pgpSignature: signature,
    publicKey: userDoc.data()!.publicKey,
    createdAt: new Date(),
    conversationId,
    messageIds: messages.map(m => m.id),
    purpose,
    verified,
    verifiedAt: new Date()
  });

  // Update message documents with signature reference
  for (const msg of messages) {
    await updateDoc(doc(db, 'conversations', conversationId, 'messages', msg.id), {
      signatureIds: arrayUnion(signatureId),
      signatureCount: increment(1)
    });
  }

  return signatureId;
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}
```

**Deliverable**: Signature creation service

---

### Task 2.3: Visual Indicators

#### 2.3.1 Add Signature Badge to Messages

**File**: `components/MessageBubble.tsx` (modify)
```typescript
export function MessageBubble({ message }: { message: Message }) {
  return (
    <View style={styles.bubble}>
      <Text>{message.text}</Text>

      {message.signatureCount > 0 && (
        <TouchableOpacity
          style={styles.signatureBadge}
          onPress={() => showSignatures(message.id)}
        >
          <Text style={styles.badgeText}>🔏 {message.signatureCount}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Deliverable**: Signature badge on messages

---

### Phase 2 Acceptance Criteria

- [ ] Contiguous message selection working
- [ ] Long-press menu shows signature options
- [ ] Signature modal displays selected messages
- [ ] Can add purpose and notes
- [ ] Signature created successfully (~10-20ms)
- [ ] Signature saved to Firestore
- [ ] Message documents updated with signatureIds
- [ ] Signature badge appears on signed messages
- [ ] Badge shows correct signature count

**Estimated Completion**: Week 3-4

---

## Phase 3: Signature Drawer

**Goal**: Users can view and manage signatures

**Duration**: 1 week

**Priority**: P1

---

### Task 3.1: Signature Drawer Tab

#### 3.1.1 Create Signatures Tab

**File**: `app/(tabs)/signatures.tsx`
```typescript
import { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import SignatureCard from '../../components/signatures/SignatureCard';

export default function SignaturesTab() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to user's signatures
    const q = query(
      collection(db, 'users', user.uid, 'signatures'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sigs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate()
      })) as Signature[];
      setSignatures(sigs);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signatures</Text>

      <FlatList
        data={signatures}
        keyExtractor={item => item.signatureId}
        renderItem={({ item }) => (
          <SignatureCard signature={item} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No signatures yet</Text>
        }
      />
    </View>
  );
}
```

**Deliverable**: Signatures tab

---

#### 3.1.2 Create Signature Card Component

**File**: `components/signatures/SignatureCard.tsx`
```typescript
export function SignatureCard({ signature }: { signature: Signature }) {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/signatures/${signature.signatureId}`);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.header}>
        <Text style={styles.icon}>🔏</Text>
        <View style={styles.info}>
          <Text style={styles.signer}>
            Signed by: {signature.signedPayload.signerId}
          </Text>
          <Text style={styles.date}>
            {formatDate(signature.createdAt)}
          </Text>
        </View>
        {signature.verified && (
          <Text style={styles.verified}>✓ Verified</Text>
        )}
      </View>

      <Text style={styles.preview}>
        💬 {signature.messageIds.length} messages from "{getConversationName(signature.conversationId)}"
      </Text>

      {signature.purpose && (
        <Text style={styles.purpose}>
          Purpose: {signature.purpose}
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

**Deliverable**: Signature card component

---

### Task 3.2: Signature Detail View

#### 3.2.1 Create Detail Screen

**File**: `app/signatures/[id].tsx`
```typescript
export default function SignatureDetailScreen() {
  const { id } = useLocalSearchParams();
  const [signature, setSignature] = useState<Signature | null>(null);

  useEffect(() => {
    loadSignature();
  }, [id]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Signature Details</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Signed by:</Text>
        <Text style={styles.value}>{signature.signedPayload.signerId}</Text>

        <Text style={styles.label}>Public Key:</Text>
        <Text style={styles.mono}>{signature.publicKeyFingerprint}</Text>

        <Text style={styles.label}>Signed at:</Text>
        <Text style={styles.value}>{signature.signedPayload.signedAt}</Text>

        <Text style={styles.label}>Status:</Text>
        <Text style={signature.verified ? styles.verified : styles.unverified}>
          {signature.verified ? '✓ Verified' : '✗ Unverified'}
        </Text>
      </View>

      {signature.purpose && (
        <View style={styles.section}>
          <Text style={styles.label}>Purpose:</Text>
          <Text style={styles.value}>{signature.purpose}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Messages ({signature.messages.length}):</Text>
        {signature.signedPayload.messages.map((msg, i) => (
          <View key={i} style={styles.message}>
            <Text style={styles.messageSender}>{msg.senderName}:</Text>
            <Text style={styles.messageText}>{msg.text}</Text>
            <Text style={styles.messageTime}>{msg.sentAt}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Verify Again" onPress={handleVerify} />
        <Button title="Delete" onPress={handleDelete} color="red" />
      </View>
    </ScrollView>
  );
}
```

**Deliverable**: Signature detail screen

---

### Phase 3 Acceptance Criteria

- [ ] Signatures tab in navigation
- [ ] Signatures list ordered by date (DESC)
- [ ] Signature cards show signer, date, message count
- [ ] Verified indicator shows correctly
- [ ] Tap card to see detail view
- [ ] Detail view shows full payload
- [ ] Can delete signatures
- [ ] Can re-verify signatures

**Estimated Completion**: Week 5

---

## Phase 4: Signature Proposals

**Goal**: Users can propose signatures to others

**Duration**: 1 week

**Priority**: P2

---

### Task 4.1: Proposal Flow

#### 4.1.1 Add "Propose Signature" Menu Option

**File**: `app/chat/[id].tsx` (modify handleMessageLongPress)
```typescript
const handleProposeSignature = async (message: Message) => {
  // Enter selection mode
  setSelectionMode(true);
  toggleMessage(message.id, messages);
  setProposalMode(true);
};

const handleSendProposal = async () => {
  const proposal = {
    proposerId: auth.currentUser!.uid,
    proposerEmail: auth.currentUser!.email,
    recipientId: otherParticipant.id,
    conversationId,
    messageIds: selectedIds,
    purpose,
    notes,
    createdAt: new Date()
  };

  await addDoc(collection(db, 'signature_proposals'), proposal);

  // Send notification to recipient
  await sendNotification(otherParticipant.id, {
    title: 'Signature Proposal',
    body: `${auth.currentUser!.displayName} proposed a signature`
  });

  setProposalMode(false);
  setSelectionMode(false);
  clearSelection();
};
```

**Deliverable**: Proposal creation

---

#### 4.1.2 Create Proposal Review Screen

**File**: `app/proposals/[id].tsx`
```typescript
export default function ProposalReviewScreen() {
  const { id } = useLocalSearchParams();
  const [proposal, setProposal] = useState(null);
  const [messages, setMessages] = useState([]);

  const handleAccept = async () => {
    // Create signature with proposed messages
    await createSignature({
      messages,
      conversationId: proposal.conversationId,
      purpose: proposal.purpose,
      notes: `In response to proposal from ${proposal.proposerEmail}`
    });

    // Delete proposal
    await deleteDoc(doc(db, 'signature_proposals', id));

    router.back();
  };

  const handleDecline = async () => {
    await deleteDoc(doc(db, 'signature_proposals', id));
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signature Proposal</Text>

      <Text>From: {proposal.proposerEmail}</Text>

      <View style={styles.messages}>
        <Text style={styles.label}>Messages to sign:</Text>
        {messages.map(m => (
          <View key={m.id} style={styles.message}>
            <Text>{m.senderName}: {m.text}</Text>
          </View>
        ))}
      </View>

      {proposal.purpose && (
        <Text>Purpose: {proposal.purpose}</Text>
      )}

      <View style={styles.actions}>
        <Button title="Sign" onPress={handleAccept} />
        <Button title="Decline" onPress={handleDecline} />
      </View>
    </View>
  );
}
```

**Deliverable**: Proposal review UI

---

### Phase 4 Acceptance Criteria

- [ ] "Propose signature" in long-press menu
- [ ] Can select messages for proposal
- [ ] Proposal sent to counterparty
- [ ] Recipient gets notification
- [ ] Recipient can review proposal
- [ ] Shows exact messages to be signed
- [ ] Can accept (creates signature)
- [ ] Can decline (deletes proposal)

**Estimated Completion**: Week 6

---

## Phase 5: AI Agent Integration

**Goal**: Approval agent validates signatures and creates action items

**Duration**: 2 weeks

**Priority**: P0

---

### Task 5.1: Server-Side Verification

#### 5.1.1 Create Verification Service

**File**: `functions/src/services/signatureVerification.ts`
```typescript
import * as openpgp from 'openpgp';

export async function verifyPGPSignature({
  signature,
  payload,
  publicKey
}: {
  signature: string;
  payload: string;
  publicKey: string;
}): Promise<{ valid: boolean; fingerprint: string }> {
  try {
    const message = await openpgp.readMessage({
      armoredMessage: signature
    });

    const publicKeyObj = await openpgp.readKey({
      armoredKey: publicKey
    });

    const verification = await openpgp.verify({
      message,
      verificationKeys: publicKeyObj
    });

    const valid = await verification.signatures[0].verified;
    const fingerprint = publicKeyObj.getFingerprint();

    return { valid, fingerprint };
  } catch (error) {
    console.error('Verification error:', error);
    return { valid: false, fingerprint: '' };
  }
}
```

**Deliverable**: Signature verification service

---

#### 5.1.2 Create Firestore Trigger

**File**: `functions/src/triggers/onSignatureCreated.ts`
```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { verifyPGPSignature } from '../services/signatureVerification';
import { processApprovalSignature } from '../agents/approvalAgent';

export const onSignatureCreated = onDocumentCreated(
  'users/{userId}/signatures/{signatureId}',
  async (event) => {
    const signature = event.data?.data();
    if (!signature) return;

    const conversationId = signature.conversationId;

    // Re-verify signature server-side
    const verification = await verifyPGPSignature({
      signature: signature.pgpSignature,
      payload: JSON.stringify(signature.signedPayload, null, 2),
      publicKey: signature.publicKey
    });

    // Update verification status
    await event.data.ref.update({
      verified: verification.valid,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (!verification.valid) {
      console.error('Invalid signature detected:', signature.signatureId);
      return;
    }

    // Check if AI agent is enabled in conversation
    const conv = await admin.firestore()
      .collection('conversations')
      .doc(conversationId)
      .get();

    const aiAgents = conv.data()?.aiAgents || {};

    if (aiAgents['ai-agent-approval']?.enabled) {
      await processApprovalSignature(signature);
    }
  }
);
```

**Deliverable**: Firestore trigger for signature verification

---

### Task 5.2: Approval Agent

#### 5.2.1 Create Approval Agent

**File**: `functions/src/agents/approvalAgent.ts`
```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function processApprovalSignature(signature: any) {
  // Only process if purpose is "approval"
  if (signature.purpose !== 'approval') {
    return;
  }

  // Extract approval details using LLM
  const messages = signature.signedPayload.messages;
  const messageText = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');

  const { text } = await generateText({
    model: openai('gpt-4-turbo'),
    messages: [
      {
        role: 'system',
        content: 'Extract approval details from the conversation. Return JSON with: approver, approvedItem, amount (if applicable), and description.'
      },
      {
        role: 'user',
        content: messageText
      }
    ]
  });

  const approvalDetails = JSON.parse(text);

  // Create action item
  const actionItemRef = await admin.firestore().collection('actionItems').add({
    type: 'approval',
    approver: signature.signedPayload.signerId,
    description: approvalDetails.description,
    amount: approvalDetails.amount,
    signatureId: signature.signatureId,
    conversationId: signature.conversationId,
    verifiedBy: 'ai-agent-approval',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'approved',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Post confirmation to chat
  await admin.firestore()
    .collection('conversations')
    .doc(signature.conversationId)
    .collection('messages')
    .add({
      text: `✅ Approval verified: ${signature.signedPayload.signerId} approved "${approvalDetails.description}"`,
      senderId: 'ai-agent-approval',
      senderName: 'Approval Agent',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'agent-notification',
      metadata: {
        signatureId: signature.signatureId,
        actionItemId: actionItemRef.id
      }
    });
}
```

**Deliverable**: Approval agent implementation

---

### Phase 5 Acceptance Criteria

- [ ] Server-side signature verification working
- [ ] Firestore trigger fires on signature creation
- [ ] Verification status updated correctly
- [ ] Approval agent detects approval signatures
- [ ] LLM extracts approval details
- [ ] Action item created in Firestore
- [ ] Confirmation message posted to chat
- [ ] Agent appears as participant

**Estimated Completion**: Week 7-8

---

## Phase 6: Testing & Refinement

**Goal**: Polish and stabilize MVP

**Duration**: 1 week

**Priority**: P0

---

### Task 6.1: End-to-End Testing

**Test Scenarios**:

1. **Key Generation**
   - [ ] Generate keys with valid passphrase
   - [ ] Reject weak passphrases (< 8 chars)
   - [ ] Keys saved to Firestore
   - [ ] Fingerprint correct

2. **Signature Creation**
   - [ ] Select single message
   - [ ] Select multiple contiguous messages
   - [ ] Reject non-contiguous selection
   - [ ] Add purpose and notes
   - [ ] Signature created successfully
   - [ ] Badge appears on messages

3. **Signature Drawer**
   - [ ] Signatures listed in DESC order
   - [ ] Signature cards display correctly
   - [ ] Detail view shows full payload
   - [ ] Delete signature
   - [ ] Re-verify signature

4. **Proposals**
   - [ ] Send proposal to counterparty
   - [ ] Receive notification
   - [ ] Review proposal
   - [ ] Accept proposal (creates signature)
   - [ ] Decline proposal (deletes)

5. **AI Agent**
   - [ ] Sign approval message
   - [ ] Agent detects signature
   - [ ] Agent verifies signature
   - [ ] Agent extracts details
   - [ ] Action item created
   - [ ] Confirmation posted to chat

**Deliverable**: All test scenarios passing

---

### Task 6.2: Performance Optimization

**Targets**:
- [ ] Key generation: < 500ms
- [ ] Signing: < 100ms
- [ ] Verification: < 50ms
- [ ] Drawer loads: < 1s

**Optimizations**:
- Cache decrypted private key for session
- Batch Firestore updates
- Optimize signature card rendering

**Deliverable**: Performance targets met

---

### Task 6.3: Documentation

**Documents to create**:
- [ ] User guide (how to use signatures)
- [ ] Developer guide (how to add new agent types)
- [ ] Troubleshooting guide

**Deliverable**: Documentation complete

---

### Phase 6 Acceptance Criteria

- [ ] All E2E tests passing
- [ ] Performance targets met
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Ready for user testing

**Estimated Completion**: Week 9

---

## Development Workflow

### Daily Development

**Terminal Setup**:
```bash
# Terminal 1: Emulator
npm run functions:dev

# Terminal 2: Mobile App
npm start

# Terminal 3: Function logs
cd functions && npm run build:watch
```

### Testing Locally

**Test key generation**:
```bash
# In app
1. Go to Settings
2. Tap "Set Up Signatures"
3. Enter passphrase
4. Verify keys in Firestore
```

**Test signing**:
```bash
# In chat
1. Long-press message
2. Select "Sign message(s)"
3. Select more messages (contiguous)
4. Add purpose: "approval"
5. Tap "Sign"
6. Check signature in drawer
```

**Test AI agent**:
```bash
# In Firebase emulator
1. Check Firestore trigger fired
2. Check verification status updated
3. Check action item created
4. Check message posted to chat
```

---

## Testing Strategy

### Unit Tests

**Client**:
```bash
# Test signature service
jest services/signatures.test.ts

# Test selection logic
jest hooks/useMessageSelection.test.ts
```

**Server**:
```bash
# Test verification
jest functions/src/services/signatureVerification.test.ts

# Test approval agent
jest functions/src/agents/approvalAgent.test.ts
```

### Integration Tests

**Manual test checklist** in `docs/testing/signature-tests.md`

### Performance Tests

**Benchmark cryptographic operations**:
```typescript
// Benchmark key generation
console.time('keygen');
await generateKeys(passphrase);
console.timeEnd('keygen');
// Target: < 500ms

// Benchmark signing
console.time('sign');
await createSignature({ ... });
console.timeEnd('sign');
// Target: < 100ms
```

---

## Summary

**Total Timeline**: 9 weeks (6 phases)

**Phase Breakdown**:
- Phase 1: Foundation (2 weeks)
- Phase 2: Signature Creation (2 weeks)
- Phase 3: Signature Drawer (1 week)
- Phase 4: Proposals (1 week)
- Phase 5: AI Agent (2 weeks)
- Phase 6: Testing (1 week)

**Key Milestones**:
- Week 2: Users can generate keys ✓
- Week 4: Users can sign messages ✓
- Week 5: Signature drawer working ✓
- Week 6: Proposals working ✓
- Week 8: AI agent working ✓
- Week 9: MVP complete ✓

**Next Steps**:
1. Review and approve this plan
2. Create feature branch: `feature/digital-signatures`
3. Start Phase 1: Foundation

---

**Document Version**: 1.0
**Status**: Ready for Review

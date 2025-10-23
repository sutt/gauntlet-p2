# AI Tools Integration - Architecture

## Document Overview
**Version**: 1.0
**Date**: 2025-10-22
**Status**: Planning Phase

This document outlines the package structure, system architecture, and technical infrastructure for the AI Tools integration.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Package Structure](#package-structure)
3. [Technology Stack](#technology-stack)
4. [Data Flow](#data-flow)
5. [Infrastructure Components](#infrastructure-components)
6. [Security Architecture](#security-architecture)
7. [Scalability Considerations](#scalability-considerations)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                   (React Native + Expo)                              │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   UI Components  │  │   AI Services    │  │   State Mgmt     │  │
│  │                  │  │                  │  │                  │  │
│  │ - TranslationUI  │  │ - translateMsg   │  │ - React Context  │  │
│  │ - SummaryModal   │  │ - summarize      │  │ - Local State    │  │
│  │ - ActionItems    │  │ - extractActions │  │                  │  │
│  │ - AIAssistant    │  │ - smartSearch    │  │                  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘  │
│           │                     │                                    │
│           └─────────────────────┼────────────────────────────────────│
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                    Firebase SDK (HTTPS Callable Functions)
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                      BACKEND LAYER                                    │
│                (Firebase Cloud Functions - Node.js 20)                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Gateway Layer                          │   │
│  │  (Cloud Functions - HTTPS Callable & Triggers)                │   │
│  │                                                                │   │
│  │  ├─ helloWorldAI (callable)                                   │   │
│  │  ├─ translateMessage (callable)                               │   │
│  │  ├─ summarizeThread (callable)                                │   │
│  │  ├─ extractActionItems (callable)                             │   │
│  │  ├─ extractDecisions (callable)                               │   │
│  │  ├─ smartSearch (callable)                                    │   │
│  │  ├─ onMessageCreated (trigger - embeddings)                   │   │
│  │  ├─ onMessageCreatedPriority (trigger - classification)       │   │
│  │  └─ proactiveAgentScheduled (scheduled)                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                    │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │                     Agent Layer                               │   │
│  │  (Business Logic - AI Agents)                                 │   │
│  │                                                                │   │
│  │  ├─ translationAgent.ts                                       │   │
│  │  ├─ summarizationAgent.ts                                     │   │
│  │  ├─ actionItemAgent.ts                                        │   │
│  │  ├─ decisionAgent.ts                                          │   │
│  │  ├─ searchAgent.ts                                            │   │
│  │  ├─ priorityAgent.ts                                          │   │
│  │  └─ proactive/                                                │   │
│  │      ├─ schedulingAgent.ts                                    │   │
│  │      ├─ reminderAgent.ts                                      │   │
│  │      ├─ insightAgent.ts                                       │   │
│  │      └─ orchestrator.ts                                       │   │
│  └────────────────────────────────────────────────────────────┘     │
│                                 │                                    │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │                   Service Layer                               │   │
│  │  (Shared Utilities)                                           │   │
│  │                                                                │   │
│  │  ├─ contextRetrieval.ts    - Fetch conversation context      │   │
│  │  ├─ embeddingService.ts    - Generate/search embeddings      │   │
│  │  ├─ cacheService.ts        - Result caching                  │   │
│  │  └─ notificationService.ts - Send notifications              │   │
│  └────────────────────────────────────────────────────────────┘     │
│                                 │                                    │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │                   Utility Layer                               │   │
│  │  (Cross-cutting Concerns)                                     │   │
│  │                                                                │   │
│  │  ├─ rateLimit.ts           - Rate limiting logic             │   │
│  │  ├─ logger.ts              - Logging & metrics               │   │
│  │  ├─ errorHandler.ts        - Centralized error handling      │   │
│  │  ├─ validator.ts           - Input validation (Zod)          │   │
│  │  └─ tokenCounter.ts        - Token counting & cost calc      │   │
│  └────────────────────────────────────────────────────────────┘     │
│                                 │                                    │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
            ┌─────────────────────┴──────────────────────┐
            │                                             │
┌───────────┴──────────┐                    ┌────────────┴──────────┐
│   External Services  │                    │  Firebase Services     │
│                      │                    │                        │
│  ┌────────────────┐  │                    │  ┌──────────────────┐ │
│  │  OpenAI API    │  │                    │  │  Firestore       │ │
│  │                │  │                    │  │  - users/        │ │
│  │ - GPT-4-turbo  │  │                    │  │  - conversations/│ │
│  │ - GPT-3.5      │  │                    │  │  - actionItems/  │ │
│  │ - Embeddings   │  │                    │  │  - decisions/    │ │
│  └────────────────┘  │                    │  │  - ai_cache/     │ │
│                      │                    │  │  - rate_limits/  │ │
│  ┌────────────────┐  │                    │  └──────────────────┘ │
│  │  Anthropic API │  │                    │                        │
│  │  (Future)      │  │                    │  ┌──────────────────┐ │
│  │                │  │                    │  │  Authentication  │ │
│  │ - Claude       │  │                    │  │  - Firebase Auth │ │
│  └────────────────┘  │                    │  └──────────────────┘ │
│                      │                    │                        │
└──────────────────────┘                    │  ┌──────────────────┐ │
                                            │  │  Secret Manager  │ │
                                            │  │  - OPENAI_API_KEY│ │
                                            │  └──────────────────┘ │
                                            │                        │
                                            │  ┌──────────────────┐ │
                                            │  │  Cloud Scheduler │ │
                                            │  │  - Pub/Sub Topics│ │
                                            │  └──────────────────┘ │
                                            └────────────────────────┘
```

---

## Package Structure

### Project Directory Layout

```
hello-expo/                              # Root project directory
├── app/                                  # Expo Router screens (existing)
│   ├── (tabs)/
│   │   ├── chats.tsx                    # Enhanced with AI features
│   │   └── ai-test.tsx                  # NEW: AI testing screen (dev only)
│   ├── chat/
│   │   └── [id].tsx                     # Enhanced with translation, summary
│   ├── ai-assistant.tsx                 # NEW: AI assistant chat
│   ├── action-items.tsx                 # NEW: Action items view
│   ├── decisions.tsx                    # NEW: Decisions view
│   └── ai-settings.tsx                  # NEW: AI preferences
│
├── components/                           # React components (existing + new)
│   ├── ai/                              # NEW: AI-specific components
│   │   ├── TranslationModal.tsx
│   │   ├── SummaryModal.tsx
│   │   ├── ActionItemCard.tsx
│   │   ├── DecisionCard.tsx
│   │   ├── ProactiveSuggestion.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── SmartSearchBar.tsx
│   └── ... (existing components)
│
├── services/                             # Business logic (existing + new)
│   ├── ai.ts                            # NEW: AI service functions
│   ├── messages.ts                      # Existing (enhanced)
│   ├── conversations.ts                 # Existing (enhanced)
│   └── ... (existing services)
│
├── types/                                # TypeScript types
│   ├── ai.ts                            # NEW: AI-specific types
│   ├── chat.ts                          # Existing (enhanced)
│   └── ... (existing types)
│
├── context/                              # React Context providers
│   ├── auth.tsx                         # Existing
│   └── ai-preferences.tsx               # NEW: AI settings context
│
├── functions/                            # NEW: Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                     # Main entry - exports all functions
│   │   │
│   │   ├── config.ts                    # Configuration & secrets
│   │   │
│   │   ├── agents/                      # AI Agent implementations
│   │   │   ├── translationAgent.ts      # Translation logic
│   │   │   ├── summarizationAgent.ts    # Summarization logic
│   │   │   ├── actionItemAgent.ts       # Action extraction logic
│   │   │   ├── decisionAgent.ts         # Decision extraction logic
│   │   │   ├── searchAgent.ts           # Smart search logic
│   │   │   ├── priorityAgent.ts         # Priority classification
│   │   │   └── proactive/               # Multi-agent system
│   │   │       ├── schedulingAgent.ts
│   │   │       ├── reminderAgent.ts
│   │   │       ├── insightAgent.ts
│   │   │       ├── recommendationAgent.ts
│   │   │       └── orchestrator.ts      # Agent coordination
│   │   │
│   │   ├── services/                    # Shared services
│   │   │   ├── contextRetrieval.ts      # Fetch conversation context
│   │   │   ├── embeddingService.ts      # Embedding generation/search
│   │   │   ├── cacheService.ts          # Result caching
│   │   │   └── notificationService.ts   # Send notifications
│   │   │
│   │   ├── utils/                       # Utility functions
│   │   │   ├── rateLimit.ts             # Rate limiting
│   │   │   ├── logger.ts                # Logging & metrics
│   │   │   ├── errorHandler.ts          # Error handling
│   │   │   ├── validator.ts             # Input validation
│   │   │   └── tokenCounter.ts          # Token counting
│   │   │
│   │   ├── triggers/                    # Firestore triggers
│   │   │   ├── onMessageCreated.ts      # Generate embeddings
│   │   │   └── onPriorityDetect.ts      # Detect priority
│   │   │
│   │   └── scheduled/                   # Scheduled functions
│   │       └── proactiveAgent.ts        # Hourly proactive checks
│   │
│   ├── test/                            # Function tests
│   │   ├── translationAgent.test.ts
│   │   ├── summarizationAgent.test.ts
│   │   └── ... (other tests)
│   │
│   ├── docs/                            # Function documentation
│   │   ├── agent-template.md            # Agent development guide
│   │   └── api-reference.md             # API documentation
│   │
│   ├── package.json                     # Functions dependencies
│   ├── tsconfig.json                    # TypeScript config
│   └── .env                             # Local secrets (gitignored)
│
├── .dev-docs/                            # Development documentation
│   ├── ait/                             # AI Tools documentation
│   │   ├── intent.md
│   │   ├── requirements-basic.md
│   │   ├── requirements-full.md
│   │   ├── requirements-technical.md
│   │   ├── tasks-ait.md
│   │   ├── architecture-ait.md          # This file
│   │   └── workflows-ait.md
│   └── mvp-implementation.md            # Existing MVP docs
│
├── firebase.json                         # Firebase config (updated)
├── .firebaserc                          # Firebase project config
├── firestore.rules                      # Security rules (enhanced)
├── package.json                         # Root dependencies
└── .env.local                           # Client environment variables
```

---

## Technology Stack

### Client-Side (Existing + Enhanced)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.4 | Mobile framework |
| **Expo** | ~54.0 | Build toolchain |
| **TypeScript** | ~5.9.2 | Type safety |
| **Expo Router** | ~6.0.13 | Navigation |
| **Firebase SDK** | ^12.4.0 | Backend integration |

**No new client dependencies needed** - all AI functionality accessed via Cloud Functions.

---

### Backend (Cloud Functions)

| Package | Version | Purpose |
|---------|---------|---------|
| **firebase-functions** | ^5.0.0 | Cloud Functions framework |
| **firebase-admin** | ^12.0.0 | Admin SDK (Firestore access) |
| **ai** | ^3.0.0 | Vercel AI SDK |
| **@ai-sdk/openai** | ^0.0.20 | OpenAI provider for AI SDK |
| **openai** | ^4.0.0 | Direct OpenAI API (fallback) |
| **zod** | ^3.22.0 | Schema validation |
| **tiktoken** | ^1.0.0 | Token counting |
| **dotenv** | ^16.0.0 | Local environment variables |

**Functions package.json**:
```json
{
  "name": "functions",
  "engines": {
    "node": "20"
  },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "firebase-functions": "^5.0.0",
    "firebase-admin": "^12.0.0",
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.20",
    "openai": "^4.0.0",
    "zod": "^3.22.0",
    "tiktoken": "^1.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "typescript": "^5.2.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

---

### External APIs

| Service | Pricing | Purpose |
|---------|---------|---------|
| **OpenAI API** | Pay-as-you-go | LLM completions, embeddings |
| **Anthropic API** | Pay-as-you-go | Future: Claude for specialized tasks |

**OpenAI Models Used**:
- `gpt-4-turbo` - Complex tasks (summarization, extraction)
- `gpt-3.5-turbo` - Simple tasks (priority classification)
- `text-embedding-3-small` - Embeddings for search

---

### Firebase Services

| Service | Usage | Cost |
|---------|-------|------|
| **Firestore** | Data storage, real-time sync | Free tier: 50K reads/day, 20K writes/day |
| **Authentication** | User auth | Free tier: 10K monthly active users |
| **Cloud Functions** | Backend logic | Free tier: 2M invocations/month |
| **Secret Manager** | API key storage | $0.06 per secret per month |
| **Cloud Scheduler** | Scheduled jobs | Free tier: 3 jobs |

---

## Data Flow

### Example: Translation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User Action                                                  │
│  - Long-press message in chat                                    │
│  - Tap "Translate"                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Client: TranslationModal                                     │
│  - Open modal with message text                                  │
│  - User selects target language                                  │
│  - Tap "Translate"                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Client: services/ai.ts                                       │
│  - Call translateMessage(request)                                │
│  - Show loading state                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS Callable (Firebase SDK)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Cloud Function: translateMessage                             │
│  - Authenticate user                                             │
│  - Check rate limit                                              │
│  - Validate input (Zod)                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Service: contextRetrieval.ts                                 │
│  - Fetch recent messages from conversation                       │
│  - Get participant names                                         │
│  - Build context object                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Agent: translationAgent.ts                                   │
│  - Build translation prompt with context                         │
│  - Call OpenAI API (via AI SDK)                                  │
│  - Parse JSON response                                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Utility: logger.ts                                           │
│  - Log metrics (tokens, cost, duration)                          │
│  - Return to client                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS Response
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Client: TranslationModal                                     │
│  - Display translated text                                       │
│  - Show alternatives, cultural notes                             │
│  - User can copy or send translated version                      │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points**:
- Client → Function: HTTPS Callable (Firebase SDK handles auth)
- Function → Firestore: Admin SDK (read conversation context)
- Function → OpenAI: HTTPS POST (AI SDK wrapper)
- Function → Client: JSON response

**Timing**:
- Client → Function: ~50ms
- Context retrieval: ~200ms
- OpenAI API call: ~2000ms
- Total: ~2250ms

---

## Infrastructure Components

### 1. Cloud Functions (Callable)

**Purpose**: Handle user-initiated AI requests

**Pattern**:
```typescript
export const functionName = onCall(
  {
    secrets: [openaiApiKey],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    cors: true,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) throw new HttpsError('unauthenticated', '...');

    // 2. Rate limit
    await checkRateLimit(request.auth.uid, 'functionName');

    // 3. Validate input
    const validated = schema.parse(request.data);

    // 4. Business logic
    const result = await agent.process(validated);

    // 5. Log metrics
    logFunctionCall({ ... });

    // 6. Return
    return { success: true, ...result };
  }
);
```

**Deployed Functions**:
- `helloWorldAI` - Test function
- `translateMessage` - Translation
- `summarizeThread` - Summarization
- `extractActionItems` - Action extraction
- `extractDecisions` - Decision extraction
- `smartSearch` - Semantic search

---

### 2. Cloud Functions (Triggers)

**Purpose**: Automatic background processing

**Firestore Trigger Pattern**:
```typescript
export const onMessageCreated = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();

    // Process message
    const result = await processMessage(message);

    // Update document
    await snapshot.ref.update(result);
  });
```

**Deployed Triggers**:
- `onMessageCreatedEmbedding` - Generate embeddings for search
- `onMessageCreatedPriority` - Classify message priority

---

### 3. Cloud Functions (Scheduled)

**Purpose**: Proactive background jobs

**Scheduled Function Pattern**:
```typescript
export const proactiveAgentHourly = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('America/New_York')
  .onRun(async () => {
    const users = await getActiveUsers();

    for (const user of users) {
      await runProactiveAgents(user.id);
    }
  });
```

**Deployed Scheduled Functions**:
- `proactiveAgentHourly` - Run proactive agents every hour
- `dailyInsights` - Generate daily insights (8am daily)

---

### 4. Firestore Collections (New)

**AI-specific collections**:

```typescript
// Rate limiting
rate_limits/{userId}_{functionName}
{
  calls: number;
  windowStart: timestamp;
  lastCall: timestamp;
}

// AI cache (global)
ai_cache/{cacheKey}
{
  cacheKey: string;
  type: 'summary' | 'embedding' | 'classification';
  result: any;
  createdAt: timestamp;
  expiresAt: timestamp;
  conversationId?: string;
}

// Action items (per conversation)
conversations/{id}/actionItems/{itemId}
{
  description: string;
  assignee?: string;
  dueDate?: timestamp;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  sourceMessageId: string;
  confidence: number;
  createdBy: 'ai' | 'manual';
}

// Decisions (per conversation)
conversations/{id}/decisions/{decisionId}
{
  summary: string;
  description: string;
  decisionType: string;
  participants: string[];
  sourceMessageIds: string[];
  decidedAt: timestamp;
}

// AI preferences (per user)
users/{userId}/ai_preferences
{
  enabledFeatures: {
    summarization: boolean;
    actionExtraction: boolean;
    // ... etc
  };
  proactiveSettings: {
    schedulingSuggestions: boolean;
    // ... etc
  };
}

// AI assistant conversations (per user)
ai_assistant_conversations/{userId}
{
  userId: string;
  messages: AIAssistantMessage[];
  lastMessageAt: timestamp;
}
```

**Enhanced existing collections**:

```typescript
// Messages - add AI fields
conversations/{id}/messages/{messageId}
{
  // ... existing fields
  embedding?: number[];              // For search
  embeddingModel?: string;
  priority?: 'low' | 'medium' | 'high';
  priorityReason?: string;
  aiProcessed?: boolean;
}

// Conversations - add AI metadata
conversations/{id}
{
  // ... existing fields
  actionItemCount?: number;
  decisionCount?: number;
  priorityMessageCount?: number;
}
```

---

### 5. Secret Management

**Firebase Secret Manager**:

```bash
# Set secrets
firebase functions:secrets:set OPENAI_API_KEY

# Access in code
import { defineSecret } from 'firebase-functions/params';
export const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Use in function
export const myFunction = onCall(
  { secrets: [openaiApiKey] },
  async (request) => {
    const key = openaiApiKey.value();
  }
);
```

**Local Development**:
```bash
# functions/.env
OPENAI_API_KEY=sk-...
```

---

## Security Architecture

### Authentication Flow

```
┌───────────────┐
│  Client App   │
│  (Logged in)  │
└───────┬───────┘
        │
        │ Firebase Auth Token (JWT)
        │
        ▼
┌─────────────────────────────────────┐
│  Firebase SDK (Client)              │
│  - Attaches auth token to request   │
└───────┬─────────────────────────────┘
        │
        │ HTTPS Callable Request
        │ (includes auth context)
        │
        ▼
┌─────────────────────────────────────┐
│  Cloud Function                     │
│  - Firebase validates token         │
│  - Provides request.auth.uid        │
│  - Checks if user authenticated     │
└───────┬─────────────────────────────┘
        │
        │ If authenticated
        │
        ▼
┌─────────────────────────────────────┐
│  Business Logic                     │
│  - Check permissions                │
│  - Verify conversation access       │
│  - Process request                  │
└─────────────────────────────────────┘
```

### Permission Checks

**Every callable function**:
```typescript
// 1. Check authenticated
if (!request.auth) {
  throw new HttpsError('unauthenticated', 'Must be logged in');
}

// 2. Check conversation access (if applicable)
const conversationId = request.data.conversationId;
const conv = await db.collection('conversations').doc(conversationId).get();

if (!conv.exists) {
  throw new HttpsError('not-found', 'Conversation not found');
}

const participants = conv.data().participants;
if (!participants.includes(request.auth.uid)) {
  throw new HttpsError('permission-denied', 'Not a participant');
}

// 3. Proceed with business logic
```

### Rate Limiting

**Per-user, per-function**:
- Free tier: 20 calls/hour
- Stored in Firestore: `rate_limits/{userId}_{functionName}`
- Reset window: 1 hour rolling

### Data Privacy

**Conversation Data**:
- Only sent to LLM when user explicitly requests AI feature
- Anonymized when possible (user IDs replaced with placeholders)
- Not stored by OpenAI (zero retention policy)

**User Control**:
- Can disable AI features per conversation
- Can delete AI assistant history
- Can export/delete all AI data

---

## Scalability Considerations

### Current Architecture Limits

| Metric | Limit | Reason |
|--------|-------|--------|
| **Concurrent Functions** | 1000 | Cloud Functions default |
| **Function Memory** | 512MB | Per-function allocation |
| **Function Timeout** | 60s | HTTPS callable max |
| **Firestore Reads** | 50K/day (free) | Free tier limit |
| **Firestore Writes** | 20K/day (free) | Free tier limit |
| **Cloud Function Invocations** | 2M/month (free) | Free tier limit |

### Scaling Strategy

**0-100 users** (MVP Phase):
- ✅ Current architecture sufficient
- ✅ Free tier adequate
- No changes needed

**100-1,000 users**:
- Upgrade to Blaze plan (pay-as-you-go)
- Add caching layer (reduce LLM calls)
- Optimize Firestore queries
- Cost: ~$50-200/month

**1,000-10,000 users**:
- Implement aggressive caching (Redis)
- Use Cloud Run for long-running tasks
- Add load balancing
- Consider vector database (Pinecone)
- Cost: ~$500-2,000/month

**10,000+ users**:
- Dedicated backend (Node.js + PostgreSQL)
- Message queue (Cloud Tasks, Pub/Sub)
- CDN for static assets
- Multi-region deployment
- Cost: $5,000+/month

### Performance Optimization

**Caching**:
```typescript
// Cache summary results
const cacheKey = `summary_${conversationId}_${startMsgId}_${endMsgId}`;
const cached = await getCachedResult(cacheKey);

if (cached && cached.expiresAt > Date.now()) {
  return cached.result;
}

// Generate fresh result
const result = await generateSummary(...);

// Cache for 1 hour
await cacheResult(cacheKey, result, 3600000);
```

**Batching**:
```typescript
// Batch embed messages instead of one-by-one
const embeddings = await batchGenerateEmbeddings(messages);
// Save all at once (Firestore batch write)
```

**Streaming** (future):
```typescript
// Stream LLM responses for better UX
const stream = await streamText({
  model: openai('gpt-4-turbo'),
  messages: [...]
});

for await (const chunk of stream) {
  // Send chunk to client via websocket
}
```

---

## Monitoring & Observability

### Metrics to Track

**Function Performance**:
- Invocation count
- Average execution time
- Error rate
- Cold start frequency

**AI Usage**:
- Total LLM API calls
- Token usage (input + output)
- Cost per user
- Cost per function

**User Engagement**:
- Feature adoption rate
- Active AI users
- Most-used features
- User feedback

### Logging Strategy

**Structured Logging**:
```typescript
import { logger } from 'firebase-functions/v2';

logger.info('Function executed', {
  functionName: 'translateMessage',
  userId: request.auth.uid,
  duration: executionTime,
  inputTokens: 50,
  outputTokens: 100,
  cost: 0.001,
  success: true,
});
```

**View Logs**:
```bash
# Real-time
firebase functions:log

# Filter by function
firebase functions:log --only translateMessage

# View in Cloud Console
https://console.firebase.google.com/project/YOUR_PROJECT/functions/logs
```

---

## Deployment Architecture

### Development Environment

```
┌──────────────────────────────────────────┐
│  Local Machine                            │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │  Mobile App (Expo)                  │ │
│  │  - Connected to emulator            │ │
│  │  - Hot reload enabled               │ │
│  └─────────────────────────────────────┘ │
│                   │                       │
│                   ▼                       │
│  ┌─────────────────────────────────────┐ │
│  │  Firebase Emulator Suite            │ │
│  │  - Functions: localhost:5001        │ │
│  │  - Firestore: localhost:8080        │ │
│  │  - Auth: localhost:9099             │ │
│  └─────────────────────────────────────┘ │
│                   │                       │
│                   ▼                       │
│  ┌─────────────────────────────────────┐ │
│  │  Cloud Functions (Local)            │ │
│  │  - TypeScript compiled              │ │
│  │  - .env for secrets                 │ │
│  │  - Calls real OpenAI API            │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Production Environment

```
┌──────────────────────────────────────────┐
│  User Devices                             │
│  - iOS / Android / Web                    │
└───────────────┬──────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  Firebase Services (us-central1)         │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │  Cloud Functions                    │ │
│  │  - Node.js 20 runtime               │ │
│  │  - Secrets from Secret Manager      │ │
│  │  - Auto-scaling (0-1000 instances)  │ │
│  └─────────────────────────────────────┘ │
│                   │                       │
│                   ▼                       │
│  ┌─────────────────────────────────────┐ │
│  │  Firestore                          │ │
│  │  - Multi-region replication         │ │
│  │  - Automatic backups                │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  OpenAI API (api.openai.com)             │
│  - GPT-4-turbo                            │
│  - GPT-3.5-turbo                          │
│  - text-embedding-3-small                 │
└──────────────────────────────────────────┘
```

### CI/CD Pipeline (Future)

```
┌─────────────┐
│  Git Push   │
│  (main)     │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  GitHub Actions      │
│  1. Lint             │
│  2. Test             │
│  3. Build            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Deploy to Firebase  │
│  - Functions         │
│  - Rules             │
└──────────────────────┘
```

---

## Summary

This architecture provides:

✅ **Modular**: Clear separation of concerns (agents, services, utils)
✅ **Scalable**: Can handle 0-1000 users on free tier, scales beyond
✅ **Maintainable**: Consistent patterns, well-documented
✅ **Secure**: Auth, rate limiting, permission checks
✅ **Cost-effective**: Aggressive caching, right-sized resources
✅ **Observable**: Comprehensive logging and metrics

**Next Steps**:
1. Set up functions/ directory
2. Install dependencies
3. Implement Tier 1 (Hello World)
4. Expand to Tier 2 (Translation Agent)
5. Scale to Tier 3 (All Features)

---

**Document Version**: 1.0
**Date**: 2025-10-22
**Status**: Ready for Implementation

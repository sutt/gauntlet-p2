# AI Tools Integration - Technical Requirements

## Document Overview
**Version**: 1.0
**Date**: 2025-10-22
**Target Persona**: Remote Team Professional
**Status**: Planning Phase

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Feature Requirements](#feature-requirements)
3. [Backend Infrastructure](#backend-infrastructure)
4. [Framework Analysis](#framework-analysis)
5. [Data Model Extensions](#data-model-extensions)
6. [Integration Points](#integration-points)
7. [Security & Privacy](#security--privacy)
8. [Performance Targets](#performance-targets)
9. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING MVP LAYER                            │
│              (React Native + Expo + Firestore)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─── AI Context Layer (New)
                         │    - Message hooks
                         │    - Contextual actions
                         │    - AI Assistant UI
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                     AI BACKEND LAYER (New)                       │
│              (Firebase Cloud Functions + LLM APIs)               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  AI Agent Core  │  │   RAG Pipeline   │  │  Tool Registry │ │
│  │                 │  │                  │  │                │ │
│  │ - Swarm/AI SDK  │  │ - Vector Search  │  │ - Firestore    │ │
│  │ - Function Call │  │ - Embeddings     │  │ - Calendar     │ │
│  │ - Context Mgmt  │  │ - Retrieval      │  │ - Notifications│ │
│  └─────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              LLM Provider Layer                              ││
│  │  - OpenAI GPT-4 (primary)                                    ││
│  │  - Anthropic Claude (fallback/specialized)                   ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

### Design Principles
1. **Augment, Don't Replace**: AI features enhance existing chat, don't fundamentally change it
2. **Async-First**: All AI operations are non-blocking with loading states
3. **Graceful Degradation**: App works fully without AI if services are down
4. **Privacy-Preserving**: Users control what data AI accesses
5. **Cost-Conscious**: Intelligent caching and batching to minimize API costs

---

## Feature Requirements

### 1. Thread Summarization

#### User Story
As a remote team professional, I want to get a quick summary of a long conversation thread so I can catch up without reading hundreds of messages.

#### Technical Specifications

**Client-Side**:
- Long-press message → Context menu → "Summarize from here"
- Button in chat header → "Summarize conversation"
- Display summary in modal with expandable sections

**Backend Function**: `summarizeThread`
```typescript
interface SummarizeThreadRequest {
  conversationId: string;
  messageIdStart?: string;  // Optional: summarize from this message
  messageIdEnd?: string;    // Optional: summarize to this message
  summaryLength: 'brief' | 'detailed'; // 2-3 sentences vs 1-2 paragraphs
}

interface SummarizeThreadResponse {
  summary: string;
  keyPoints: string[];      // Bullet points of main topics
  participantInsights: {    // Who said what
    [userId: string]: string;
  };
  timeframe: {
    start: Date;
    end: Date;
    messageCount: number;
  };
}
```

**LLM Prompt Template**:
```
You are summarizing a conversation thread for a remote team professional.

Context:
- Conversation Type: {type}
- Participants: {participants}
- Time Range: {timeRange}
- Message Count: {count}

Messages:
{messages}

Task: Create a {summaryLength} summary that:
1. Captures the main discussion points
2. Highlights key decisions or action items
3. Notes any unresolved questions
4. Attributes important points to specific people

Format your response as JSON with fields: summary, keyPoints, participantInsights
```

**Performance Requirements**:
- Response time: < 5 seconds for 100 messages
- Response time: < 15 seconds for 500 messages
- Cost target: $0.01 per summary (assuming GPT-4-turbo at $10/1M tokens)

**RAG Pipeline**:
- Fetch messages from Firestore (already optimized via pagination)
- Token budget: ~4000 tokens for context (roughly 200-300 messages)
- If conversation exceeds token limit: Use sliding window with overlap

**Caching Strategy**:
- Cache summaries in Firestore under `conversations/{id}/ai_cache/summaries`
- Invalidate when new messages arrive
- Cache key: `{startMessageId}_{endMessageId}_{summaryLength}`

---

### 2. Action Item Extraction

#### User Story
As a remote team professional, I want to automatically identify tasks and commitments from conversations so I don't miss important action items.

#### Technical Specifications

**Client-Side**:
- "Extract Actions" button in chat header
- Badge indicator showing X detected action items
- Dedicated "Action Items" tab/screen listing all tasks
- Tap action item → Navigate to source message

**Backend Function**: `extractActionItems`
```typescript
interface ExtractActionItemsRequest {
  conversationId: string;
  messageIdStart?: string;
  messageIdEnd?: string;
  sinceDatetime?: Date;     // Only extract from recent messages
}

interface ActionItem {
  id: string;               // Auto-generated
  description: string;      // What needs to be done
  assignee?: string;        // User ID if mentioned
  assigneeName?: string;    // Display name
  dueDate?: Date;          // If deadline mentioned
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  sourceMessageId: string;  // Link to original message
  extractedAt: Date;
  confidence: number;       // 0-1 score of extraction confidence
}

interface ExtractActionItemsResponse {
  actionItems: ActionItem[];
  totalFound: number;
}
```

**LLM Prompt Template**:
```
You are an AI assistant extracting action items from a team conversation.

Context:
- Participants: {participants}
- Time Range: {timeRange}

Messages:
{messages}

Task: Identify all action items, tasks, commitments, and TODOs mentioned in the conversation.

For each action item, extract:
1. Clear description of the task
2. Who is responsible (if mentioned)
3. Deadline or due date (if mentioned)
4. Priority level based on urgency keywords
5. Confidence score (0-1) of your extraction accuracy

Include action items that are:
- Explicit tasks ("I'll do X", "Can you Y", "We need to Z")
- Decisions requiring follow-up ("Let's decide by Friday")
- Commitments ("I'll get back to you on this")

Exclude:
- Questions without commitment
- Completed past actions
- Vague statements without clear task

Return as JSON array of ActionItem objects.
```

**Data Storage**:
```typescript
// New Firestore collection
conversations/{id}/actionItems/{actionItemId}
{
  ...ActionItem fields,
  conversationId: string,
  createdBy: 'ai' | 'manual',  // Allow manual additions
}
```

**Performance Requirements**:
- Response time: < 3 seconds for 50 messages
- Response time: < 10 seconds for 200 messages
- Accuracy target: >85% precision (users confirm AI is correct)

**Integration with Existing App**:
- Update conversation metadata to include `actionItemCount`
- Show badge on chat list item
- Send notification when high-priority action item extracted

---

### 3. Smart Search

#### User Story
As a remote team professional, I want to search my conversations using natural language and find semantically relevant messages, not just keyword matches.

#### Technical Specifications

**Client-Side**:
- Enhanced search bar in chats list screen
- "Smart Search" toggle switch (vs. basic search)
- Search results show preview + context
- Grouped by conversation
- Highlight matching text

**Backend Function**: `smartSearch`
```typescript
interface SmartSearchRequest {
  userId: string;
  query: string;            // Natural language query
  conversationIds?: string[]; // Optionally scope to specific conversations
  limit?: number;           // Max results (default 20)
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    senderIds?: string[];
    messageTypes?: string[];
  };
}

interface SmartSearchResult {
  messageId: string;
  conversationId: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  relevanceScore: number;   // 0-1 similarity score
  matchReason: string;      // Why this matched (for user transparency)
  context: {                // Surrounding messages for context
    before: Message[];
    after: Message[];
  };
}

interface SmartSearchResponse {
  results: SmartSearchResult[];
  totalResults: number;
  searchIntent: string;     // AI's interpretation of query
  suggestedFilters?: {      // AI-suggested refinements
    conversations?: string[];
    timeRanges?: string[];
  };
}
```

**RAG Pipeline Architecture**:

**Vector Database Options**:
1. **Pinecone** (SaaS, easiest)
   - Pros: Managed, fast, great DX
   - Cons: $70/month for 1M vectors

2. **pgvector (PostgreSQL extension)** (Self-hosted)
   - Pros: Free, control, integrates with existing DB
   - Cons: Requires separate PostgreSQL instance

3. **Firestore + Cloud Functions** (Native)
   - Pros: No additional services, already using Firestore
   - Cons: Manual implementation, slower than specialized DBs

**Recommendation**: Start with **Firestore + in-memory embeddings** for MVP (< 10K messages), migrate to Pinecone when scaling (> 100K messages).

**Embedding Strategy**:
```typescript
// On message send (via Cloud Function trigger)
1. Generate embedding: OpenAI text-embedding-3-small ($0.02 / 1M tokens)
2. Store in Firestore: conversations/{id}/messages/{id}/embedding (array of 1536 floats)
3. Index in vector DB (if using Pinecone)

// On search query
1. Generate query embedding
2. Compute cosine similarity with all message embeddings
3. Rank by similarity score
4. Apply filters (date, sender, etc.)
5. Fetch top N results
6. LLM reranking for better relevance (optional, costs more)
```

**Firestore Data Structure**:
```typescript
// Extend message document
interface Message {
  // ... existing fields
  embedding?: number[];     // 1536-dimensional vector (OpenAI)
  embeddingModel?: string;  // 'text-embedding-3-small'
  embeddingGeneratedAt?: Date;
}
```

**LLM Prompt for Query Understanding**:
```
You are helping a user search their chat conversations.

User Query: "{query}"

Task: Interpret the user's search intent and expand it to improve matching.

1. Identify key concepts and synonyms
2. Determine time constraints (e.g., "last week", "yesterday")
3. Identify person constraints (e.g., "from Alice")
4. Suggest related search terms

Return JSON:
{
  "expandedQuery": "string",
  "filters": {...},
  "intent": "string"
}
```

**Performance Requirements**:
- Response time: < 2 seconds for 1K messages
- Response time: < 5 seconds for 10K messages
- Accuracy: Relevant result in top 5 for 90% of queries

**Cost Optimization**:
- Batch embed messages (process 100 at once)
- Cache embeddings (never regenerate)
- Use smallest embedding model (text-embedding-3-small: 1536 dims)
- Estimated cost: $0.02 per 1000 messages embedded (one-time)

---

### 4. Priority Message Detection

#### User Story
As a remote team professional, I want urgent messages automatically flagged so I can respond quickly to time-sensitive requests.

#### Technical Specifications

**Client-Side**:
- Priority badge on message bubbles (⚡ high, ⚠️ medium)
- Filter chat list by "Priority Messages"
- Push notification for high-priority messages (even if app open)
- "Mark as Priority" manual override option

**Backend Function**: `detectMessagePriority` (Real-time Cloud Function Trigger)
```typescript
// Triggered automatically on message create
export const detectMessagePriority = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();

    // Call LLM to classify priority
    const priority = await classifyMessagePriority(message);

    // Update message document
    await snapshot.ref.update({
      priority: priority.level,
      priorityReason: priority.reason,
      priorityConfidence: priority.confidence,
    });

    // If high priority, send notification to all participants
    if (priority.level === 'high') {
      await sendPriorityNotification(message, priority.reason);
    }
  });

interface PriorityClassification {
  level: 'low' | 'medium' | 'high';
  reason: string;           // Why it's prioritized
  confidence: number;       // 0-1
  urgencyKeywords: string[]; // Detected keywords
}
```

**LLM Prompt Template**:
```
You are classifying the urgency/priority of a team message.

Message Context:
- Sender: {senderName}
- Timestamp: {timestamp}
- Conversation Type: {conversationType}

Message:
"{messageText}"

Task: Classify the priority level (low/medium/high) based on:

HIGH Priority Indicators:
- Explicit urgency ("ASAP", "urgent", "immediate", "by EOD")
- Time-sensitive deadlines within 24 hours
- Blocking issues affecting others
- Critical decisions needed
- Direct questions requiring response
- Emergency situations

MEDIUM Priority Indicators:
- Questions directed at someone
- Deadlines within 48-72 hours
- Important updates
- Meeting requests
- Action items with near-term deadlines

LOW Priority:
- General updates
- FYI messages
- Non-urgent questions
- Social messages
- Acknowledgments

Return JSON:
{
  "level": "low" | "medium" | "high",
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "urgencyKeywords": ["keyword1", "keyword2"]
}
```

**Firestore Data Structure**:
```typescript
// Extend message document
interface Message {
  // ... existing fields
  priority?: 'low' | 'medium' | 'high';
  priorityReason?: string;
  priorityConfidence?: number;
  priorityDetectedAt?: Date;
  priorityOverride?: boolean;  // User manually changed priority
}
```

**Performance Requirements**:
- Classification time: < 1 second (real-time)
- Accuracy: >80% match with user judgment
- False positive rate: <10% (don't over-flag)

**Cost Optimization**:
- Use lightweight model: GPT-3.5-turbo or GPT-4-mini ($0.15 / 1M tokens)
- Short messages only need ~100 tokens
- Estimated cost: $0.0001 per message classification

**Integration**:
- Update message UI to show priority badge
- Filter/sort conversations by priority message count
- Add "Priority Inbox" tab in main navigation

---

### 5. Decision Tracking

#### User Story
As a remote team professional, I want to track key decisions made in conversations so I can refer back to what was agreed upon.

#### Technical Specifications

**Client-Side**:
- "Decisions" tab in conversation info screen
- Manual "Mark as Decision" option on messages
- Decision timeline view (chronological)
- Link decisions to action items (if related)
- Export decisions as Markdown/PDF

**Backend Function**: `extractDecisions`
```typescript
interface ExtractDecisionsRequest {
  conversationId: string;
  messageIdStart?: string;
  messageIdEnd?: string;
  sinceDatetime?: Date;
}

interface Decision {
  id: string;
  summary: string;          // What was decided
  description: string;      // Details/context
  decisionType: 'agreement' | 'choice' | 'plan' | 'policy' | 'rejection';
  participants: string[];   // Who was involved
  sourceMessageIds: string[]; // Multiple messages may form one decision
  context: string;          // Why this decision was made
  alternatives?: string[];  // Other options considered
  implications?: string[];  // Expected outcomes
  relatedActionItems?: string[]; // IDs of related action items
  decidedAt: Date;
  extractedAt: Date;
  confidence: number;
}

interface ExtractDecisionsResponse {
  decisions: Decision[];
  totalFound: number;
}
```

**LLM Prompt Template**:
```
You are extracting key decisions from a team conversation.

Context:
- Participants: {participants}
- Time Range: {timeRange}

Messages:
{messages}

Task: Identify all significant decisions, agreements, and conclusions made in the conversation.

A decision is:
- An explicit agreement ("Let's go with option A")
- A choice between alternatives ("We'll use Firebase instead of AWS")
- A plan or strategy ("Our approach will be...")
- A policy or rule ("From now on, we'll...")
- A rejection or cancellation ("We're not doing X")

For each decision, extract:
1. Clear summary (1 sentence)
2. Full description (2-3 sentences)
3. Type of decision
4. Who participated in the decision
5. Alternatives considered (if mentioned)
6. Expected implications or outcomes
7. Context/reasoning for the decision

Exclude:
- Tentative suggestions without resolution
- Questions without answers
- Opinions without consensus

Return as JSON array of Decision objects.
```

**Data Storage**:
```typescript
// New Firestore collection
conversations/{id}/decisions/{decisionId}
{
  ...Decision fields,
  conversationId: string,
  createdBy: 'ai' | 'manual',
}

// Conversation metadata
interface Conversation {
  // ... existing fields
  decisionCount?: number;
  lastDecisionAt?: Date;
}
```

**Performance Requirements**:
- Extraction time: < 5 seconds for 100 messages
- Accuracy: >75% precision (decisions are genuinely decisions)
- Recall: >60% (find most important decisions)

**Integration with Action Items**:
- AI automatically links decisions to related action items
- Show related actions when viewing decision
- Update action item if parent decision changes

---

### 6. Proactive Assistant (Advanced Feature)

#### User Story
As a remote team professional, I want an AI assistant that proactively suggests meeting times, detects scheduling needs, and provides contextual recommendations without me asking.

#### Technical Specifications

**Architecture**: Multi-agent system with specialized sub-agents

**Client-Side**:
- Dedicated "AI Assistant" chat (special conversation)
- Proactive suggestions appear as inline notifications
- User can accept/reject/modify suggestions
- Assistant learns from user preferences

**Backend Agent System**:
```typescript
interface ProactiveAgent {
  id: string;
  type: 'scheduling' | 'reminder' | 'insight' | 'recommendation';
  enabled: boolean;
  lastRun: Date;
  runFrequency: 'realtime' | 'hourly' | 'daily';
}

// Agent implementations
class SchedulingAgent {
  // Detects scheduling conversations
  async detectSchedulingIntent(messages: Message[]): Promise<SchedulingSuggestion | null>;

  // Analyzes user calendar (future integration)
  async findAvailableSlots(participants: string[]): Promise<TimeSlot[]>;

  // Generates meeting proposal
  async proposeMeetingTime(context: SchedulingContext): Promise<MeetingProposal>;
}

class ReminderAgent {
  // Monitors action items and deadlines
  async checkUpcomingDeadlines(userId: string): Promise<Reminder[]>;

  // Sends proactive reminders
  async sendReminder(actionItem: ActionItem, timing: 'now' | '1hour' | '1day'): Promise<void>;
}

class InsightAgent {
  // Analyzes conversation patterns
  async generateWeeklyInsights(userId: string): Promise<Insight[]>;

  // Detects anomalies (e.g., unusually long threads)
  async detectAnomalies(conversations: Conversation[]): Promise<Anomaly[]>;
}

class RecommendationAgent {
  // Suggests actions based on conversation
  async suggestNextActions(conversationId: string): Promise<Recommendation[]>;

  // Learning from user behavior
  async updatePreferences(userId: string, feedback: Feedback): Promise<void>;
}
```

**Proactive Suggestion Types**:

1. **Meeting Time Suggestions**
```typescript
interface MeetingProposal {
  type: 'meeting_suggestion';
  title: string;             // "Team Sync Meeting"
  participants: string[];    // Who should attend
  suggestedTimes: TimeSlot[]; // Top 3 options
  duration: number;          // Minutes
  reasoning: string;         // Why now is a good time
  conversationContext: string; // What triggered this
  priority: 'low' | 'medium' | 'high';
}
```

2. **Action Item Reminders**
```typescript
interface ProactiveReminder {
  type: 'action_reminder';
  actionItem: ActionItem;
  reminderTiming: 'approaching' | 'overdue';
  suggestion: string;        // "It's been 3 days since you said you'd..."
}
```

3. **Conversation Insights**
```typescript
interface ConversationInsight {
  type: 'insight';
  insightType: 'long_thread' | 'unresolved_question' | 'blocked_decision';
  summary: string;
  recommendation: string;    // What user should do
  affectedConversations: string[];
}
```

4. **Smart Recommendations**
```typescript
interface SmartRecommendation {
  type: 'recommendation';
  recommendationType: 'followup' | 'delegate' | 'summarize' | 'close';
  title: string;
  description: string;
  action: string;            // Actionable step
  confidence: number;
}
```

**LLM Prompt for Scheduling Detection**:
```
You are a proactive scheduling assistant monitoring team conversations.

Context:
- Participants: {participants}
- Recent messages: {messages}

Task: Detect if the conversation indicates a need to schedule a meeting or event.

Look for indicators:
- Explicit requests ("Let's meet", "We should sync", "Can we schedule")
- Implicit needs ("This is getting complex", "Too much back-and-forth")
- Pending decisions requiring discussion
- Multiple participants coordinating

If scheduling need detected, extract:
1. Type of meeting (sync, planning, decision, social)
2. Who should attend
3. Urgency (ASAP, this week, next week, flexible)
4. Estimated duration
5. Suggested times (if mentioned)
6. Reason/agenda

Return JSON:
{
  "needsScheduling": boolean,
  "proposal": MeetingProposal | null,
  "confidence": 0.0-1.0
}
```

**Background Job System**:
```typescript
// Cloud Functions scheduled jobs
export const hourlyProactiveCheck = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    // For all active users
    const users = await getActiveUsers();

    for (const user of users) {
      // Run each agent
      const schedulingSuggestions = await schedulingAgent.run(user.id);
      const reminders = await reminderAgent.run(user.id);
      const insights = await insightAgent.run(user.id);

      // Send suggestions to user's AI Assistant chat
      if (schedulingSuggestions.length > 0) {
        await sendToAIAssistant(user.id, schedulingSuggestions);
      }
    }
  });
```

**AI Assistant Chat Interface**:
```typescript
// Special conversation with AI
interface AIAssistantMessage {
  id: string;
  type: 'user_message' | 'ai_response' | 'proactive_suggestion';
  content: string;
  metadata?: {
    suggestionType?: string;
    actionable?: boolean;
    actions?: Action[];      // Interactive buttons
  };
  timestamp: Date;
}

// User can interact with suggestions
interface Action {
  type: 'accept' | 'reject' | 'modify' | 'snooze';
  label: string;
  handler: string;           // Cloud Function to call
  parameters?: any;
}
```

**Performance Requirements**:
- Suggestion generation: < 5 seconds
- Background job duration: < 30 seconds per user
- Proactive suggestions: 1-3 per day per user (not overwhelming)

**Learning & Personalization**:
```typescript
// User preference model (stored in Firestore)
interface UserPreferences {
  userId: string;
  proactiveSettings: {
    enableSchedulingSuggestions: boolean;
    enableReminders: boolean;
    enableInsights: boolean;
    reminderTiming: 'aggressive' | 'moderate' | 'gentle';
  };
  learnedPatterns: {
    preferredMeetingTimes: string[];     // ["2pm-4pm", "mornings"]
    responseTimePatterns: Record<string, number>; // How quickly user responds
    frequentCollaborators: string[];     // User IDs
    topicPreferences: string[];          // What topics user cares about
  };
  feedbackHistory: {
    acceptedSuggestions: number;
    rejectedSuggestions: number;
    lastUpdated: Date;
  };
}
```

**Privacy Controls**:
- User can enable/disable each agent type
- User can set "Do Not Disturb" hours
- User can review all proactive suggestions before they're sent
- User can delete AI assistant chat history

---

## Backend Infrastructure

### Firebase Cloud Functions Architecture

**Deployment Options**:

#### Option A: TypeScript (Recommended)
**Pros**:
- ✅ Same language as client (TypeScript)
- ✅ Strong typing end-to-end
- ✅ Easier code sharing (types, utilities)
- ✅ Better DX for frontend developers
- ✅ Smaller learning curve for team

**Cons**:
- ❌ Slightly slower cold starts (~1-2s)
- ❌ Limited ML/data science libraries compared to Python
- ❌ LangChain has better Python support

**Libraries**:
```json
{
  "dependencies": {
    "firebase-functions": "^5.0.0",
    "firebase-admin": "^12.0.0",
    "@openai/openai": "^4.0.0",
    "ai": "^3.0.0",  // Vercel AI SDK
    "zod": "^3.22.0",  // Schema validation
    "tiktoken": "^1.0.0"  // Token counting
  }
}
```

#### Option B: Python
**Pros**:
- ✅ Rich AI/ML ecosystem (LangChain, LlamaIndex, transformers)
- ✅ Better for complex RAG pipelines
- ✅ Faster execution for data-heavy operations
- ✅ More AI examples and tutorials available

**Cons**:
- ❌ Different language from client (context switching)
- ❌ Harder to share types between client and backend
- ❌ Fewer Firebase/Firestore examples in Python
- ❌ Separate deployment pipeline

**Libraries**:
```python
dependencies = [
    "firebase-functions==0.4.0",
    "firebase-admin==6.2.0",
    "openai==1.3.0",
    "langchain==0.1.0",
    "pydantic==2.5.0",
    "numpy==1.26.0",
]
```

### Recommendation: **TypeScript with AI SDK**

**Rationale**:
1. Team consistency (same language everywhere)
2. Easier type sharing (Request/Response interfaces)
3. AI SDK (Vercel) provides good abstractions for LLM usage
4. Can always migrate specific functions to Python later if needed

**AI SDK provides**:
- Unified API for OpenAI, Anthropic, Cohere
- Streaming responses
- Tool/function calling abstractions
- Token counting and cost tracking
- Retry logic and error handling

---

### Framework Analysis

#### 1. OpenAI Swarm (Python)

**Overview**: Lightweight multi-agent orchestration framework by OpenAI.

**Pros**:
- ✅ Simple and minimal (educational framework)
- ✅ Good for handoffs between specialized agents
- ✅ Direct from OpenAI (good examples)
- ✅ Easy to understand and customize

**Cons**:
- ❌ Very new (released Oct 2024, not production-tested)
- ❌ Limited features (no built-in memory, state management)
- ❌ Python-only (would require Python Cloud Functions)
- ❌ Not actively maintained (experimental project)
- ❌ Requires custom RAG implementation

**Use Case Fit**: **Medium** - Good for multi-agent proactive assistant, but immature for production.

**Example**:
```python
from swarm import Swarm, Agent

def transfer_to_scheduling_agent():
    return scheduling_agent

triage_agent = Agent(
    name="Triage Agent",
    instructions="You triage user requests to specialized agents",
    functions=[transfer_to_scheduling_agent]
)

scheduling_agent = Agent(
    name="Scheduling Agent",
    instructions="You help users schedule meetings",
)

client = Swarm()
response = client.run(
    agent=triage_agent,
    messages=[{"role": "user", "content": "Help me schedule a meeting"}]
)
```

---

#### 2. Vercel AI SDK (TypeScript)

**Overview**: TypeScript framework for building AI applications with focus on streaming and function calling.

**Pros**:
- ✅ TypeScript-native (perfect match for our stack)
- ✅ Excellent DX (type-safe, modern API)
- ✅ Built-in streaming support
- ✅ Multi-provider (OpenAI, Anthropic, Google, local)
- ✅ Function calling with Zod schema validation
- ✅ Active development and community
- ✅ Great documentation
- ✅ Built by Vercel (reliable long-term)

**Cons**:
- ❌ No built-in multi-agent orchestration (need custom)
- ❌ No built-in RAG pipeline (need custom)
- ❌ Fewer AI-specific utilities than LangChain

**Use Case Fit**: **Very High** - Best fit for our TypeScript stack with Firebase.

**Example**:
```typescript
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4-turbo'),
  messages: [{ role: 'user', content: 'Summarize this conversation' }],
  tools: {
    extractActionItems: tool({
      description: 'Extract action items from conversation',
      parameters: z.object({
        conversationId: z.string(),
      }),
      execute: async ({ conversationId }) => {
        // Implementation
        return { actionItems: [...] };
      },
    }),
  },
  maxTokens: 2000,
});
```

---

#### 3. LangChain (Python/TypeScript)

**Overview**: Comprehensive framework for LLM application development.

**Pros**:
- ✅ Feature-rich (agents, tools, memory, RAG, chains)
- ✅ Built-in RAG pipeline components
- ✅ Large ecosystem and community
- ✅ Both Python and TypeScript versions
- ✅ Many integrations (vector DBs, tools)
- ✅ Production-tested

**Cons**:
- ❌ Complex and heavyweight (steep learning curve)
- ❌ Over-engineered for simple use cases
- ❌ TypeScript version lags behind Python
- ❌ Frequent breaking changes
- ❌ Performance overhead
- ❌ Harder to customize

**Use Case Fit**: **Medium** - Feature-complete but overkill for MVP.

**Example**:
```typescript
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';

const model = new ChatOpenAI({ temperature: 0.9 });
const memory = new BufferMemory();

const chain = new ConversationChain({ llm: model, memory });

const res = await chain.call({ input: 'Summarize this conversation' });
```

---

### Framework Recommendation: **Vercel AI SDK**

**Justification**:
1. **Type Safety**: End-to-end TypeScript with Zod schemas
2. **Simplicity**: Minimal abstraction, easy to understand
3. **Flexibility**: Can build custom multi-agent on top
4. **Performance**: Lightweight, fast cold starts
5. **Maintenance**: Actively developed by Vercel
6. **Firebase Integration**: Works seamlessly with Cloud Functions

**For Proactive Assistant Multi-Agent**:
- Build custom orchestration using AI SDK primitives
- Each agent is a separate function with shared context
- Use Firestore for agent state management
- Use AI SDK's tool calling for agent handoffs

---

## Data Model Extensions

### New Firestore Collections

#### 1. `ai_cache/{cacheKey}` (Global)
```typescript
interface AICache {
  cacheKey: string;          // Hash of request params
  type: 'summary' | 'embedding' | 'classification';
  result: any;               // Cached LLM response
  createdAt: Date;
  expiresAt: Date;
  conversationId?: string;
  invalidatedBy?: string[];  // Message IDs that invalidate this cache
}
```

#### 2. `conversations/{id}/actionItems/{itemId}`
```typescript
interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  assigneeName?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  sourceMessageId: string;
  extractedAt: Date;
  confidence: number;
  createdBy: 'ai' | 'manual';
  conversationId: string;
}
```

#### 3. `conversations/{id}/decisions/{decisionId}`
```typescript
interface Decision {
  id: string;
  summary: string;
  description: string;
  decisionType: 'agreement' | 'choice' | 'plan' | 'policy' | 'rejection';
  participants: string[];
  sourceMessageIds: string[];
  context: string;
  alternatives?: string[];
  implications?: string[];
  relatedActionItems?: string[];
  decidedAt: Date;
  extractedAt: Date;
  confidence: number;
  createdBy: 'ai' | 'manual';
  conversationId: string;
}
```

#### 4. `users/{userId}/ai_preferences`
```typescript
interface UserAIPreferences {
  userId: string;
  enabledFeatures: {
    summarization: boolean;
    actionExtraction: boolean;
    smartSearch: boolean;
    priorityDetection: boolean;
    decisionTracking: boolean;
    proactiveAssistant: boolean;
  };
  proactiveSettings: {
    schedulingSuggestions: boolean;
    reminders: boolean;
    insights: boolean;
    reminderTiming: 'aggressive' | 'moderate' | 'gentle';
    doNotDisturbHours?: {
      start: string;         // "22:00"
      end: string;           // "08:00"
    };
  };
  learnedPatterns: {
    preferredMeetingTimes: string[];
    responseTimePatterns: Record<string, number>;
    frequentCollaborators: string[];
    topicPreferences: string[];
  };
  feedbackHistory: {
    acceptedSuggestions: number;
    rejectedSuggestions: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. `ai_assistant_conversations/{userId}`
```typescript
interface AIAssistantConversation {
  id: string;                // userId (one per user)
  userId: string;
  messages: AIAssistantMessage[];
  createdAt: Date;
  lastMessageAt: Date;
}

interface AIAssistantMessage {
  id: string;
  type: 'user_message' | 'ai_response' | 'proactive_suggestion';
  content: string;
  metadata?: {
    suggestionType?: string;
    actionable?: boolean;
    actions?: Action[];
  };
  timestamp: Date;
}
```

### Extended Existing Collections

#### Update `Message` interface:
```typescript
interface Message {
  // ... existing fields

  // AI additions
  embedding?: number[];                    // 1536-dim vector for search
  embeddingModel?: string;                 // 'text-embedding-3-small'
  embeddingGeneratedAt?: Date;

  priority?: 'low' | 'medium' | 'high';   // Auto-detected priority
  priorityReason?: string;
  priorityConfidence?: number;
  priorityDetectedAt?: Date;
  priorityOverride?: boolean;              // User manually changed

  aiProcessed?: boolean;                   // Has AI analyzed this message?
  aiProcessedAt?: Date;
}
```

#### Update `Conversation` interface:
```typescript
interface Conversation {
  // ... existing fields

  // AI additions
  actionItemCount?: number;
  decisionCount?: number;
  priorityMessageCount?: number;
  lastAISummaryAt?: Date;
  lastActionExtractedAt?: Date;
  lastDecisionExtractedAt?: Date;
}
```

---

## Integration Points

### 1. Client → Cloud Functions

**HTTP Callable Functions** (for user-initiated actions):
```typescript
// Firebase Functions
export const summarizeThread = functions.https.onCall(async (data, context) => {
  // Verify authenticated
  if (!context.auth) throw new Error('Unauthenticated');

  // Validate request
  const { conversationId, messageIdStart, summaryLength } = data;

  // Check permissions (user is participant)
  const hasAccess = await verifyParticipant(conversationId, context.auth.uid);
  if (!hasAccess) throw new Error('Unauthorized');

  // Check cache
  const cached = await checkCache(conversationId, messageIdStart);
  if (cached) return cached;

  // Fetch messages
  const messages = await fetchMessages(conversationId, messageIdStart);

  // Call LLM
  const summary = await generateSummary(messages, summaryLength);

  // Cache result
  await cacheResult(conversationId, messageIdStart, summary);

  return summary;
});

// Client usage
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const summarizeThread = httpsCallable(functions, 'summarizeThread');

const result = await summarizeThread({
  conversationId: 'conv-123',
  summaryLength: 'brief',
});
```

### 2. Cloud Functions → Firestore (Triggers)

**Firestore Triggers** (for automatic processing):
```typescript
// Auto-detect priority on message create
export const onMessageCreated = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();

    // Classify priority
    const priority = await classifyPriority(message.text);

    // Update message
    await snapshot.ref.update({
      priority: priority.level,
      priorityReason: priority.reason,
      priorityConfidence: priority.confidence,
      aiProcessed: true,
      aiProcessedAt: new Date(),
    });

    // If high priority, notify participants
    if (priority.level === 'high') {
      await notifyHighPriority(message, priority.reason);
    }
  });

// Generate embedding for search
export const onMessageCreatedEmbedding = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();

    // Generate embedding
    const embedding = await generateEmbedding(message.text);

    // Update message
    await snapshot.ref.update({
      embedding: embedding.vector,
      embeddingModel: 'text-embedding-3-small',
      embeddingGeneratedAt: new Date(),
    });
  });
```

### 3. Scheduled Jobs (Proactive Features)

```typescript
// Hourly proactive assistant checks
export const proactiveAssistantHourly = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const users = await getActiveUsers();

    for (const user of users) {
      const prefs = await getUserAIPreferences(user.id);

      if (!prefs.enabledFeatures.proactiveAssistant) continue;

      // Run scheduling agent
      if (prefs.proactiveSettings.schedulingSuggestions) {
        const suggestions = await schedulingAgent.run(user.id);
        await sendSuggestionsToAIAssistant(user.id, suggestions);
      }

      // Run reminder agent
      if (prefs.proactiveSettings.reminders) {
        const reminders = await reminderAgent.run(user.id);
        await sendRemindersToUser(user.id, reminders);
      }
    }
  });

// Daily insights generation
export const dailyInsights = functions.pubsub
  .schedule('every day 08:00')
  .timeZone('America/New_York')
  .onRun(async () => {
    const users = await getActiveUsers();

    for (const user of users) {
      const insights = await insightAgent.generateDailyInsights(user.id);
      await sendInsightsToAIAssistant(user.id, insights);
    }
  });
```

### 4. Client UI Integration

**New Screens**:
- `app/ai-assistant.tsx` - Dedicated AI chat
- `app/action-items.tsx` - All action items across conversations
- `app/decisions.tsx` - Decision log
- `app/ai-settings.tsx` - AI preferences

**Enhanced Existing Screens**:
- `app/chat/[id].tsx`:
  - Long-press menu → "Summarize", "Extract Actions"
  - Priority badges on messages
  - "Decisions" tab in conversation info

- `app/(tabs)/chats.tsx`:
  - Smart search toggle
  - Priority message filter
  - Action item badge count

**New Components**:
- `components/ai/SummaryModal.tsx`
- `components/ai/ActionItemCard.tsx`
- `components/ai/DecisionCard.tsx`
- `components/ai/ProactiveSuggestion.tsx`
- `components/ai/PriorityBadge.tsx`

---

## Security & Privacy

### Firestore Security Rules

#### AI Cache Collection
```javascript
match /ai_cache/{cacheKey} {
  // Only Cloud Functions can write
  allow read, write: if false;
}
```

#### Action Items
```javascript
match /conversations/{conversationId}/actionItems/{itemId} {
  // Same permissions as parent conversation
  allow read: if isSignedIn() && isParticipant(conversationId);

  // Participants can create/update
  allow create, update: if isSignedIn() && isParticipant(conversationId);

  // Can delete own action items
  allow delete: if isSignedIn()
                && isParticipant(conversationId)
                && resource.data.assignee == request.auth.uid;
}
```

#### Decisions
```javascript
match /conversations/{conversationId}/decisions/{decisionId} {
  // Same permissions as parent conversation
  allow read: if isSignedIn() && isParticipant(conversationId);

  // Participants can create
  allow create: if isSignedIn() && isParticipant(conversationId);

  // No updates or deletes (immutable decisions)
  allow update, delete: if false;
}
```

#### AI Preferences
```javascript
match /users/{userId}/ai_preferences/{document=**} {
  // Users can only access their own preferences
  allow read, write: if isSignedIn() && request.auth.uid == userId;
}
```

#### AI Assistant Conversations
```javascript
match /ai_assistant_conversations/{userId} {
  // Users can only access their own AI assistant
  allow read, write: if isSignedIn() && request.auth.uid == userId;
}
```

### Data Privacy

**User Controls**:
1. **Opt-in/Opt-out**: All AI features can be individually disabled
2. **Data Retention**: Users can delete AI assistant history
3. **Transparency**: Show why AI made a decision (priority reason, etc.)
4. **Manual Override**: Users can correct AI classifications

**LLM Provider Privacy**:
- **OpenAI**: Zero data retention policy for API calls (opt-in)
- **Claude**: Does not train on API data
- **Data Minimization**: Only send necessary message context to LLM
- **Anonymization**: Strip user emails/IDs before sending to LLM (use placeholders)

**Example Anonymization**:
```typescript
function anonymizeMessages(messages: Message[]): string {
  return messages.map(msg => {
    return `[User ${msg.senderId.slice(0, 4)}]: ${msg.text}`;
  }).join('\n');
}
```

---

## Performance Targets

### Response Time Targets

| Operation | Target | Max Acceptable | Strategy |
|-----------|--------|----------------|----------|
| Thread Summarization (100 msgs) | < 3s | < 10s | Streaming, cache |
| Action Extraction (50 msgs) | < 2s | < 5s | Batch processing |
| Smart Search | < 1s | < 3s | Embeddings pre-computed |
| Priority Detection | < 0.5s | < 2s | Lightweight model, async |
| Decision Extraction | < 3s | < 10s | Background job |
| Proactive Suggestions | N/A | < 5s | Scheduled jobs |

### Cost Targets (per user per month)

| Feature | Usage Estimate | Cost per Operation | Monthly Cost |
|---------|----------------|-------------------|--------------|
| Thread Summarization | 30 summaries | $0.01 | $0.30 |
| Action Extraction | 50 extractions | $0.005 | $0.25 |
| Smart Search | 100 searches | $0.001 | $0.10 |
| Priority Detection | 300 messages | $0.0001 | $0.03 |
| Embeddings (one-time) | 300 messages | $0.00002 | $0.006 |
| Proactive Assistant | 60 suggestions | $0.01 | $0.60 |
| **Total** | | | **~$1.30/user/month** |

**Scaling Costs**:
- 100 users: **~$130/month**
- 1,000 users: **~$1,300/month**
- 10,000 users: **~$13,000/month**

**Cost Optimization Strategies**:
1. **Aggressive Caching**: Cache summaries, embeddings (never regenerate)
2. **Batch Processing**: Group operations to reduce API calls
3. **Lightweight Models**: Use GPT-3.5-turbo for simple tasks
4. **Smart Invalidation**: Only regenerate when necessary
5. **User Limits**: Cap free tier usage (e.g., 10 summaries/day)

### Firestore Usage

**Additional Reads**:
- Action items: ~10 reads/day/user
- Decisions: ~5 reads/day/user
- AI cache: ~20 reads/day/user

**Additional Writes**:
- Action items: ~5 writes/day/user
- Decisions: ~2 writes/day/user
- AI cache: ~10 writes/day/user
- Embeddings: ~50 writes/day/user (one-time per message)
- Priority updates: ~50 writes/day/user

**Impact**: ~2x increase in Firestore operations (still within free tier for <100 users)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up infrastructure and basic AI integration

**Tasks**:
1. Set up Firebase Cloud Functions (TypeScript)
2. Install Vercel AI SDK and OpenAI client
3. Create basic callable function architecture
4. Implement authentication and permission checks
5. Add AI preferences collection to Firestore
6. Create AI settings screen in client
7. Set up error handling and logging

**Deliverables**:
- Working Cloud Functions deployment
- AI settings screen
- Basic callable function (test endpoint)

---

### Phase 2: Core Features - Summarization & Actions (Week 3-4)
**Goal**: Implement thread summarization and action item extraction

**Tasks**:
1. Implement `summarizeThread` function
2. Build RAG pipeline for conversation context
3. Add caching layer for summaries
4. Create summary UI modal
5. Implement `extractActionItems` function
6. Create action items collection and UI
7. Add action item badges to conversations
8. Link action items to source messages

**Deliverables**:
- Working thread summarization
- Action item extraction and tracking
- UI for viewing and managing action items

---

### Phase 3: Search & Priority (Week 5-6)
**Goal**: Implement smart search and priority detection

**Tasks**:
1. Implement embedding generation on message create
2. Build vector similarity search (Firestore-based MVP)
3. Create `smartSearch` function with query expansion
4. Add smart search toggle to client
5. Implement `detectMessagePriority` trigger
6. Add priority badges to message UI
7. Create priority message filter
8. Implement high-priority notifications

**Deliverables**:
- Smart semantic search
- Automatic priority detection
- Priority-based filtering and notifications

---

### Phase 4: Decisions (Week 7)
**Goal**: Implement decision tracking

**Tasks**:
1. Implement `extractDecisions` function
2. Create decisions collection and data model
3. Build decision timeline UI
4. Link decisions to action items
5. Add "Mark as Decision" manual option
6. Implement decision export (Markdown)

**Deliverables**:
- Decision extraction and tracking
- Decision timeline view
- Export functionality

---

### Phase 5: Proactive Assistant (Week 8-10)
**Goal**: Implement multi-agent proactive system

**Tasks**:
1. Create AI assistant chat interface
2. Implement agent orchestration system
3. Build scheduling agent
4. Build reminder agent
5. Build insight agent
6. Build recommendation agent
7. Implement scheduled background jobs
8. Add user preference controls
9. Implement learning/personalization system
10. Add feedback collection

**Deliverables**:
- Working AI assistant chat
- Proactive suggestions for scheduling, reminders, insights
- Personalization based on user feedback

---

### Phase 6: Polish & Optimization (Week 11-12)
**Goal**: Production readiness

**Tasks**:
1. Performance optimization (caching, batching)
2. Cost optimization (model selection, prompts)
3. Error handling and edge cases
4. User onboarding flow for AI features
5. Documentation for users
6. Analytics and monitoring
7. A/B testing setup
8. Feedback collection UI

**Deliverables**:
- Production-ready AI features
- Monitoring and analytics
- User documentation

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM API downtime | Medium | High | Implement fallbacks, queue failed requests |
| Slow response times | Medium | High | Aggressive caching, streaming, async |
| High costs | High | High | Usage limits, cost monitoring, lighter models |
| Inaccurate extractions | High | Medium | Confidence scores, user feedback loop |
| Cold start latency | High | Medium | Keep functions warm, minimize dependencies |
| Firestore query limits | Low | Medium | Pagination, cursor-based queries |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users don't trust AI | Medium | High | Transparency, manual overrides, explainability |
| Too many proactive suggestions | Medium | High | Smart throttling, user preference controls |
| Privacy concerns | Low | Critical | Clear privacy policy, opt-in, data controls |
| Feature complexity | High | Medium | Gradual rollout, good onboarding |
| Users ignore AI features | High | High | Smart defaults, contextual prompts |

---

## Success Metrics

### Adoption Metrics
- **AI Feature Activation Rate**: >60% of users enable at least one AI feature
- **Active AI Users**: >40% of users use AI features weekly
- **Proactive Assistant Adoption**: >20% of users engage with proactive suggestions

### Engagement Metrics
- **Summaries Generated**: 5+ per active user per week
- **Action Items Created**: 10+ per active user per week
- **Smart Searches**: 3+ per active user per week
- **Priority Message Interactions**: 80% of high-priority messages viewed within 1 hour

### Quality Metrics
- **Accuracy** (user confirms AI is correct): >80%
- **Suggestion Acceptance Rate**: >30%
- **False Positive Rate** (priority): <15%
- **User Satisfaction**: >4.0/5.0 for AI features

### Performance Metrics
- **Response Time**: 90th percentile < target
- **Error Rate**: <1% of AI operations
- **Cost per User**: <$1.50/month

---

## Open Questions

1. **Vector Database**: Should we start with Firestore or invest in Pinecone early?
   - **Recommendation**: Start with Firestore, migrate at 10K+ messages

2. **LLM Provider**: OpenAI only or multi-provider?
   - **Recommendation**: OpenAI primary, add Claude for specialized tasks later

3. **Embedding Model**: text-embedding-3-small (1536) vs text-embedding-3-large (3072)?
   - **Recommendation**: Small for MVP, evaluate accuracy and upgrade if needed

4. **Proactive Frequency**: How often should proactive suggestions be sent?
   - **Recommendation**: Max 3 suggestions per day, user-configurable

5. **Action Item Persistence**: Should action items sync to external task managers?
   - **Recommendation**: Phase 2 feature (post-MVP)

6. **Calendar Integration**: Should we integrate with Google Calendar for scheduling?
   - **Recommendation**: Yes, but Phase 5 (after core features)

7. **Conversation Privacy**: Should users opt-in per conversation or globally?
   - **Recommendation**: Global setting with per-conversation overrides

8. **Model Selection**: Should we use GPT-4 for everything or mix models?
   - **Recommendation**: GPT-3.5-turbo for priority/classification, GPT-4 for summarization/extraction

---

## Appendix A: Cost Breakdown

### OpenAI API Pricing (as of Jan 2025)

| Model | Input | Output | Use Case |
|-------|-------|--------|----------|
| GPT-4-turbo | $10/1M tokens | $30/1M tokens | Summarization, Extraction |
| GPT-3.5-turbo | $0.50/1M tokens | $1.50/1M tokens | Priority, Classification |
| text-embedding-3-small | $0.02/1M tokens | N/A | Embeddings |

### Example Cost Calculation (1 User, 1 Month)

**Thread Summarization** (30 summaries):
- Input: 300 messages avg × 100 tokens × 30 = 900K tokens → $9.00
- Output: 500 tokens × 30 = 15K tokens → $0.45
- **Total**: $9.45 (without caching)
- **With 80% cache hit**: $1.89

**Action Item Extraction** (50 extractions):
- Input: 100 messages avg × 100 tokens × 50 = 500K tokens → $5.00
- Output: 200 tokens × 50 = 10K tokens → $0.30
- **Total**: $5.30 (without caching)
- **With 50% cache hit**: $2.65

**Smart Search** (100 searches):
- Embeddings (one-time): 300 messages × 100 tokens = 30K tokens → $0.0006
- Query embeddings: 100 queries × 20 tokens = 2K tokens → $0.00004
- **Total**: ~$0.001

**Priority Detection** (300 messages):
- Input: 300 messages × 100 tokens = 30K tokens → $0.015
- Output: 300 × 50 tokens = 15K tokens → $0.023
- **Total**: $0.038

**Grand Total (with caching)**: ~$4.60/user/month (higher than target)

**Optimization to hit $1.30 target**:
1. More aggressive caching (90% hit rate)
2. Use GPT-3.5-turbo for more operations
3. Reduce token usage with shorter prompts
4. Batch operations
5. User limits on free tier

---

## Appendix B: Example Prompts

### Thread Summarization Prompt
```
You are an AI assistant helping a remote team professional quickly understand a conversation thread.

Conversation Context:
- Type: Group chat
- Participants: Alice (PM), Bob (Engineer), Charlie (Designer)
- Date Range: Oct 18-20, 2025
- Messages: 87

Messages:
[timestamp: 2025-10-18 10:23] Alice: Hey team, we need to finalize the homepage redesign by end of week
[timestamp: 2025-10-18 10:25] Bob: I can have the new navigation component ready by tomorrow
[timestamp: 2025-10-18 10:27] Charlie: I'll send over the final mockups today
... (more messages)

Your Task:
Create a brief summary (2-3 sentences) that captures:
1. The main topic and goal of the conversation
2. Key decisions or agreements made
3. Any outstanding action items or questions
4. The current status

Then provide:
- 3-5 key points as bullet points
- Participant insights: What did each person contribute?

Format your response as JSON:
{
  "summary": "string",
  "keyPoints": ["point1", "point2", ...],
  "participantInsights": {
    "Alice": "string",
    "Bob": "string",
    "Charlie": "string"
  }
}
```

### Action Item Extraction Prompt
```
You are extracting action items from a team conversation. Be precise and only extract genuine tasks, not vague suggestions.

Conversation:
[timestamp: 2025-10-18 14:30] Alice: Bob, can you review the PR by tomorrow?
[timestamp: 2025-10-18 14:32] Bob: Sure, I'll take a look tonight
[timestamp: 2025-10-18 14:35] Charlie: I'll update the design docs this week
[timestamp: 2025-10-18 14:40] Alice: We need to decide on the color scheme by Friday
... (more messages)

Extract action items following these rules:

INCLUDE:
- Explicit commitments ("I'll do X")
- Direct requests with acceptance ("Can you Y?" → "Yes")
- Decisions requiring follow-up ("We need to Z by [date]")

EXCLUDE:
- Questions without commitment
- Vague suggestions ("Maybe we should...")
- Completed past actions ("I did X yesterday")

For each action item, extract:
{
  "description": "Clear, actionable task description",
  "assignee": "userId (if identifiable from context)",
  "assigneeName": "display name",
  "dueDate": "ISO 8601 date (if deadline mentioned)",
  "priority": "low | medium | high",
  "sourceMessageId": "message ID",
  "confidence": 0.0-1.0
}

Return array of ActionItem objects.
```

---

## Conclusion

This technical requirements document provides a comprehensive blueprint for integrating AI tools into the existing chat application. The recommended approach:

1. **Framework**: Vercel AI SDK (TypeScript)
2. **Backend**: Firebase Cloud Functions
3. **LLM**: OpenAI GPT-4-turbo (primary)
4. **Vector DB**: Firestore (MVP), Pinecone (scale)
5. **Timeline**: 12 weeks to full implementation

The architecture is designed to be:
- **Extensible**: Easy to add new AI features
- **Cost-effective**: Aggressive caching and optimization
- **User-centric**: Privacy controls and manual overrides
- **Production-ready**: Error handling, monitoring, scalability

**Next Steps**:
1. Review and approve requirements
2. Set up development environment
3. Begin Phase 1 implementation
4. Iterate based on user feedback

---

**Document Version**: 1.0
**Date**: 2025-10-22
**Authors**: Development Team
**Status**: Ready for Review

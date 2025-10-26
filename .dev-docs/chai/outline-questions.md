# CHAI (Chats with AI Agents) - High-Level Outline Questions

**Date**: 2025-10-26
**Status**: Planning - Awaiting Product Owner Decisions
**Context**: Implementing AI purchasing agent ("buybot") as first agent-in-chat use case

---

## Purpose

This document presents critical architectural and product questions that must be answered before creating detailed specifications for the "chai" (Chats with AI Agents) feature. The initial use case is a purchasing agent that:

1. Operates as a user in a chat conversation
2. Accepts purchase requests from authorized users
3. Verifies authorization via digital signatures from power users
4. Makes intelligent decisions about signature relevance and authenticity

---

## Background Context

### Existing Infrastructure
- **Chat System**: Fully functional 1-on-1 and group chat with real-time messaging
- **Digital Signatures (sig2)**: Server-side PGP signature system with verification capabilities
- **AI Service**: Cloud Functions-based AI agents (currently translation-only) using OpenAI GPT-4
- **Firebase Architecture**: Firestore for data, Cloud Functions for backend logic

### Key Constraint
Must minimize changes to existing chat infrastructure and piggyback on existing patterns.

---

## High-Level Questions for Product Owner

### Question 1: Agent Identity & User Model

**Question**: Should AI agents be represented as actual Firebase users in the system, or as a separate entity type?

**Options**:

**A) Agent-as-User (Recommended)**
- Create dummy Firebase Auth accounts for each AI agent (e.g., buybot@agent.internal)
- Agent appears in conversations as a regular participant
- Uses existing conversation/message infrastructure unchanged
- Agent has a user profile with `displayName: "BuyBot"`, `isAgent: true` flag

**B) Separate Agent Entity**
- New `agents` Firestore collection parallel to `users`
- Modify conversation model to support mixed participants (users + agents)
- Modify message model to support `agentId` alongside `senderId`
- Requires changes to existing chat infrastructure

**C) Virtual Agent (No Persistence)**
- Agent messages generated on-the-fly, not stored as regular messages
- Agent responses appear in UI but exist differently in data model
- Significant changes to message rendering logic

**Trade-offs**:
- **Option A**: Minimal code changes, but "fake users" feel hacky; simpler to implement
- **Option B**: Cleaner architecture, but requires significant refactoring; harder to maintain
- **Option C**: Most complex, breaks existing patterns; not recommended

**Questions to Clarify**:
1. Do we need to support multiple agent instances (e.g., BuyBot-US, BuyBot-EU)?
2. Should agents show up in the People tab when browsing users?
3. Should agents have online/offline status, or always appear available?
4. Can users block/mute AI agents like they can with regular users?

---

### Question 2: Agent Message Triggering & Response Pattern

**Question**: How should the agent know when to respond to messages, and what is the expected interaction pattern?

**Options**:

**A) Cloud Function Trigger on All Messages**
- Firestore trigger: `onMessageCreated` for conversations with agents
- Agent evaluates every message, decides whether to respond
- Responses posted as new messages via Cloud Function

**B) Explicit Agent Mentions/Commands**
- Agent only responds when explicitly mentioned (e.g., "@BuyBot buy X")
- Client sends direct request to Cloud Function when user invokes agent
- More controlled, less noisy

**C) Conversation-Type Based**
- Direct 1-on-1 chats with agents: Respond to every message
- Group chats with agents: Only respond when mentioned or when detecting relevant keywords
- Hybrid approach based on conversation context

**Trade-offs**:
- **Option A**: Most autonomous, but could spam conversations; higher costs
- **Option B**: Predictable, controlled, but less natural; requires UI for mentions
- **Option C**: Balanced, but more complex logic; recommended for MVP

**Questions to Clarify**:
1. In the buybot scenario, should the agent acknowledge every message or only actionable ones?
2. How do we prevent agent spam in group conversations?
3. Should there be a "mute agent" feature for users?
4. What happens if agent is in a conversation but offline/unavailable?

---

### Question 3: Signature Verification & Authorization Model

**Question**: How should the agent verify that a user is authorized to make purchases, and how should signature verification work in practice?

**Options**:

**A) Power User List in Agent Config (Simple)**
- Agent has a hardcoded/config list of power user IDs (e.g., ["ash_uid"])
- Direct requests from power users: Approved immediately
- Requests from others: Require signature from someone on the list
- Signature verification: Use existing `verifySignatureForAgent()` from sig2

**B) Role-Based Authorization in Firestore**
- New field: `users/{userId}/roles: ["power_user", "purchaser"]`
- Agent queries user roles dynamically
- More flexible, supports role changes without redeploying agent
- Requires user management UI to assign roles

**C) External Authorization Service**
- Agent calls separate authorization microservice/API
- Supports complex permission models (department budgets, approval chains)
- Overkill for POC, but production-ready

**Trade-offs**:
- **Option A**: Fastest to implement, good for POC, hard to scale
- **Option B**: More maintainable, supports growth, requires more upfront work
- **Option C**: Enterprise-grade, but excessive complexity for initial use case

**Implementation Details for Signature Verification** (All Options):
```typescript
// Agent logic pseudo-code
if (isDirectRequest && isPowerUser(senderId)) {
  return "approved";
} else if (signatureId) {
  const verification = await verifySignatureForAgent(userId, signatureId);
  if (verification.valid && verification.payload.signerId === powerUserId) {
    // Check payload relevance (Question 4)
    return analyzePayloadRelevance(verification.payload);
  }
}
return "denied - need authorization";
```

**Questions to Clarify**:
1. Should power users be able to delegate authority (e.g., "ash approves will for this week")?
2. Do we need spending limits per user or per signature?
3. Should signature expirations be enforced (e.g., approval only valid for 24 hours)?
4. What happens if a power user's status is revoked while outstanding signatures exist?

---

### Question 4: Signature Payload Relevance Analysis

**Question**: How should the agent determine if a signed conversation payload is relevant to the current purchase request?

**Context**: The agent must be "suspicious of roundabout tricks" and ensure a signature from ash saying "yes" to "do you like sandwiches" doesn't authorize a purchase.

**Options**:

**A) LLM-Based Semantic Analysis (Recommended)**
- Pass signature payload and current request to GPT-4
- Prompt: "Does this signed conversation authorize the following purchase?"
- Agent returns confidence score + reasoning
- Example:
  ```
  Payload: "will: can i buy a $400 quadcopter? | ash: sure"
  Request: "buy this quadcopter for me"
  → RELEVANT (high confidence)

  Payload: "will: do you like sandwiches? | ash: yes"
  Request: "buy this quadcopter for me"
  → NOT RELEVANT (unrelated topic)
  ```

**B) Keyword/Pattern Matching**
- Extract entities from signature (dollar amounts, item names, action verbs)
- Match against current request entities
- Simple, fast, but brittle and easy to trick

**C) Structured Signature Metadata**
- Require signatures to include explicit metadata fields:
  ```json
  {
    "purpose": "purchase_authorization",
    "itemDescription": "quadcopter",
    "maxAmount": 400,
    "approver": "ash",
    "requester": "will"
  }
  ```
- Agent validates metadata directly
- Most reliable, but requires UI changes for signature creation

**Trade-offs**:
- **Option A**: Most intelligent, handles informal language, but costs per verification
- **Option B**: Fast and free, but easily circumvented; not recommended
- **Option C**: Most secure, but inflexible and requires structured input

**Questions to Clarify**:
1. How strict should relevance matching be (exact item vs. category match)?
2. Should the agent explain why it rejected a signature (transparency)?
3. Do we need a human-in-the-loop approval for edge cases?
4. Should there be an audit log of all signature verifications?

---

### Question 5: Agent-to-Agent Communication & Future Extensibility

**Question**: How should the architecture support multiple agents in the future, and should agents be able to communicate with each other?

**Options**:

**A) Single Agent Per Conversation (MVP)**
- Limit: One agent per conversation (e.g., only BuyBot)
- No inter-agent communication
- Simple, focused on single use case

**B) Multi-Agent Conversations**
- Allow multiple agents in same conversation (e.g., BuyBot + ApprovalBot)
- Agents can see each other's messages, potentially coordinate
- More complex orchestration logic needed

**C) Agent Registry with Routing**
- Central agent registry: Maps agent capabilities/intents
- User messages routed to appropriate agent(s)
- Agents can invoke other agents via internal API
- Example: BuyBot detects translation need → calls TranslationAgent

**Trade-offs**:
- **Option A**: Fastest to build, good for POC, limited scalability
- **Option B**: More powerful, but needs conflict resolution (two agents responding to same message)
- **Option C**: Most flexible, production-ready, but high complexity for initial implementation

**Questions to Clarify**:
1. Do we foresee needing multiple agents in the same conversation soon?
2. Should agents be able to invoke other agents (e.g., BuyBot asks TranslationAgent for help)?
3. How do we prevent agent loops (Agent A asks Agent B asks Agent A...)?
4. Should there be a "primary agent" concept in conversations?

---

### Question 6: Conversation Initiation & Agent Discovery

**Question**: How do users start conversations with agents, and how do they discover what agents are available?

**Options**:

**A) Manual Agent Addition (Like Users)**
- Agents appear in People tab with special badge (e.g., "🤖 BuyBot")
- Users manually start conversations with agents
- Simple, uses existing UI patterns

**B) Agent Directory/Marketplace**
- New screen: "Agents" tab showing available agents
- Each agent has description, capabilities, example commands
- Users tap agent → auto-create conversation
- More discoverable, but requires new UI

**C) Contextual Agent Suggestions**
- App suggests agents based on context (e.g., "Detected purchase intent, talk to BuyBot?")
- Proactive, but requires intent detection logic
- Could be annoying if over-triggered

**D) Command-Based Invocation**
- Type `/agents` or `/buybot` in any chat to invoke agent
- Agent joins conversation temporarily or creates new thread
- Slack-like pattern, requires command parser

**Trade-offs**:
- **Option A**: Minimal work, good for MVP, low discoverability
- **Option B**: Best UX, clear capabilities, more upfront UI work
- **Option C**: Advanced, but high risk of false positives
- **Option D**: Power-user friendly, but not intuitive for casual users

**Questions to Clarify**:
1. Should agents be searchable like users (by name/email)?
2. Do we want agent onboarding/tutorials?
3. Should there be agent usage analytics (which agents are most popular)?
4. Can users "favorite" agents for quick access?

---

### Question 7: Development & Testing Strategy

**Question**: How should we develop and test agent behavior given the inherent non-determinism of LLMs and the need for signature verification?

**Options**:

**A) Deterministic Test Mode**
- Agent has `TEST_MODE` flag that bypasses LLM calls
- Returns hardcoded responses for known inputs
- Allows traditional unit testing
- Separate "production mode" with real GPT-4

**B) LLM-Based Testing with Snapshots**
- Run agent with real GPT-4, save responses as "golden snapshots"
- Future tests compare against snapshots (with fuzzy matching)
- Detect regressions when responses drift significantly
- More realistic, but flaky tests

**C) Hybrid: Mocked LLM for Unit Tests, Real LLM for Integration Tests**
- Unit tests: Mock OpenAI API, test agent logic in isolation
- Integration tests: Real API calls, test full signature verification flow
- E2E tests: Real conversations in test environment

**Development Workflow**:
1. Can we manually create dummy users and signatures for testing?
2. Do we need a test Firebase project separate from production?
3. Should there be a "debug mode" where agent explains its reasoning?
4. How do we handle flaky LLM responses during development?

**Questions to Clarify**:
1. What's the acceptable level of non-determinism in agent responses?
2. Should agent responses be logged for debugging/audit?
3. Do we need a way to replay failed agent interactions?
4. Should there be automated tests for signature verification logic?

---

### Question 8: Cost, Safety, & Rate Limiting

**Question**: How do we control costs and prevent abuse given that each agent message requires GPT-4 API calls?

**Options**:

**A) Per-User Rate Limits**
- Limit: X agent messages per user per day (e.g., 100/day)
- Tracked in Firestore: `users/{userId}/agentUsage/{date}`
- Agent returns error when limit exceeded
- Fair, but can be bypassed with multiple accounts

**B) Per-Conversation Limits**
- Limit: Y agent messages per conversation per hour (e.g., 50/hour)
- Prevents runaway agent loops
- Applies to all participants equally

**C) Cost-Based Budgets**
- Track actual OpenAI token costs per user
- Set monthly budget (e.g., $5/user/month)
- More accurate, but requires token counting and cost calculation

**D) Manual Approval for High-Cost Actions**
- Agent flags certain operations (e.g., "spending > $500") for manual review
- Admin approves/denies via dashboard
- Adds friction, but increases safety

**Safety Considerations**:
1. Should there be a kill switch to disable all agents instantly?
2. How do we prevent prompt injection attacks (user tricks agent into ignoring rules)?
3. Should agent responses be filtered for sensitive info (API keys, passwords)?
4. What happens if OpenAI API is down (graceful degradation)?

**Questions to Clarify**:
1. What's an acceptable OpenAI spend per user per month?
2. Should power users have higher limits than regular users?
3. Do we need real-time cost monitoring dashboards?
4. Should there be warnings when approaching limits?

---

### Question 9: Agent State & Memory

**Question**: Should agents maintain memory of past interactions, or treat each message independently?

**Options**:

**A) Stateless Agent (Every Message is Isolated)**
- Agent receives current message + recent conversation history (e.g., last 10 messages)
- No persistent memory across conversations or sessions
- Simple, but limited contextual understanding

**B) Conversation-Scoped Memory**
- Agent remembers context within a single conversation
- Stored in Firestore: `conversations/{id}/agentMemory`
- Example: BuyBot remembers "will mentioned quadcopter in message 5"
- Better UX, but requires state management

**C) Global User Memory**
- Agent remembers interactions across all conversations with a user
- Stored in: `users/{userId}/agentInteractions/{agentId}`
- Example: "Will previously asked about drones 3 times"
- Most powerful, but privacy concerns and data retention issues

**Trade-offs**:
- **Option A**: Simplest, but agent seems "forgetful"
- **Option B**: Good balance for MVP, natural conversation flow
- **Option C**: Advanced personalization, but complex and potential privacy issues

**Questions to Clarify**:
1. Should agent memory be user-deletable (privacy)?
2. How long should memory be retained (forever vs. 30 days)?
3. Should agents disclose what they remember ("I recall you asked about X last week")?
4. Do we need GDPR/privacy compliance for agent memory?

---

## Summary of Decisions Needed

Before moving to detailed specification, the product owner must decide:

1. **Agent Identity Model**: Agent-as-user vs. separate entity? (Recommendation: Agent-as-user for MVP)
2. **Response Triggering**: Respond to all messages vs. mentions only vs. hybrid? (Recommendation: Hybrid - direct=all, group=mentions)
3. **Authorization Model**: Hardcoded power users vs. role-based? (Recommendation: Config-based for POC, migrate to roles)
4. **Signature Relevance**: LLM semantic analysis vs. structured metadata? (Recommendation: LLM for MVP, add structure later)
5. **Multi-Agent Support**: Single agent MVP vs. design for multiple? (Recommendation: Single for MVP, design extensibility)
6. **Agent Discovery**: People tab vs. dedicated agent directory? (Recommendation: People tab with badge for MVP)
7. **Testing Strategy**: Mock vs. real LLM in tests? (Recommendation: Hybrid - mocked for unit, real for integration)
8. **Cost Controls**: Rate limits, budgets, or manual approvals? (Recommendation: Per-user daily message limits + flagging)
9. **Agent Memory**: Stateless vs. conversation-scoped vs. global? (Recommendation: Conversation-scoped for MVP)

---

## Next Steps

Once these questions are answered:

1. Create detailed technical specification (`specs-chai.md`)
2. Break down into implementation tasks (`tasks-chai.md`)
3. Define data models and API contracts
4. Create prototype with minimal functionality
5. Iterate based on testing and feedback

---

**Document Status**: Ready for Product Owner Review
**Owner**: Product Team
**Next Review**: TBD

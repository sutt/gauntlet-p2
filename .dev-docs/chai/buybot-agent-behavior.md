# BuyBot Agent - Behavior & Configuration

**Status**: Phase 2.2 Complete - LLM Integration Working
**Date**: 2025-10-26
**Focus**: MVP Implementation - Core functionality only

---

## Overview

BuyBot is an AI purchasing assistant that helps users make purchase requests and manages authorization via digital signatures. The agent uses OpenAI GPT-4 Turbo to provide intelligent, context-aware responses.

---

## Expected Behavior

### Conversational Capabilities

BuyBot can:
- **Acknowledge purchase requests** and explain the authorization process
- **Maintain conversation context** using the last 10 messages
- **Reference power users** who can approve purchases
- **Ask clarifying questions** when requests are unclear
- **Provide professional, concise responses** (typically 2-3 sentences)

### Response Characteristics

- **Tone**: Friendly but professional
- **Length**: Concise, typically 2-3 sentences
- **Context-aware**: References previous messages in the conversation
- **Helpful**: Guides users through the purchase authorization process

### Example Interactions

**Purchase Request:**
```
User: "I need to buy a new laptop for $2000"
BuyBot: "I can help you with that purchase request. To proceed, you'll need
authorization from one of our power users via a digital signature. Would you
like me to explain how the signature process works?"
```

**Power User Question:**
```
User: "Who can approve my purchases?"
BuyBot: "Currently, your_email@example.com can authorize purchases. They'll
need to provide a digital signature to approve the request."
```

**Context Awareness:**
```
User: "I need a laptop"
User: "What specs do you recommend?"
BuyBot: "For your laptop purchase, I'd recommend discussing the specific
requirements with your team. Once you've decided, I can help facilitate
the authorization process."
```

---

## Configuration & Control Knobs

### Environment Variables (`.env.local`)

Located in `functions/.env.local`:

```bash
# Agent Configuration
BUYBOT_USER_ID=<firebase_auth_uid>        # BuyBot's Firebase Auth UID
POWER_USER_IDS=<uid1>,<uid2>              # Comma-separated power user UIDs

# Development Controls
TEST_MODE=false                            # true = mock responses, false = GPT-4

# OpenAI Configuration
OPENAI_API_KEY=<your_key>                 # Required for GPT-4 responses
```

### LLM Parameters

Located in `functions/src/agents/buyBotAgent.ts`:

```typescript
// generateBuyBotResponse() function
{
  model: openai('gpt-4-turbo'),    // Model: gpt-4-turbo
  temperature: 0.7,                 // Creativity: 0.0-1.0 (0.7 = balanced)
  // No maxTokens set (uses model default)
}
```

**Tunable Parameters:**

| Parameter | Current Value | Purpose | Adjustment Guide |
|-----------|---------------|---------|------------------|
| `model` | `gpt-4-turbo` | OpenAI model | Use `gpt-4` for more accuracy, `gpt-3.5-turbo` for speed/cost |
| `temperature` | `0.7` | Response creativity | Lower (0.3) = more consistent, Higher (0.9) = more creative |
| `maxTokens` | Not set | Response length limit | Add if responses too long (e.g., `maxTokens: 150`) |

### Conversation Context

Located in `functions/src/agents/buyBotAgent.ts`:

```typescript
// processUserMessage() function
const conversationHistory = await getConversationContext(conversationId, 10);
```

**Context Size**: Last 10 messages (configurable)

**To Adjust:**
- **Increase** for more context (e.g., `15`) → Better memory, higher costs
- **Decrease** for less context (e.g., `5`) → Lower costs, less memory

### System Prompt

Located in `buildBuyBotPrompt()` function.

**Current Guidelines:**
- Be friendly but professional
- Ask clarifying questions when unclear
- Keep responses concise (2-3 sentences usually)
- Explain signature authorization process when needed
- Inform about power users who can approve

**To Modify**: Edit the prompt string in `buildBuyBotPrompt()` to adjust behavior, tone, or capabilities.

---

## Development Mode: TEST_MODE

### Purpose
Allows testing without calling OpenAI API (saves costs during development).

### Behavior

**When `TEST_MODE=true`:**
```typescript
// Returns simple mock response
`[TEST MODE] Thanks for your message: "${userMessage}" I can see we've
exchanged ${conversationHistory.length} messages. I'm BuyBot, ready to
help with purchases. In production, I'll use AI to provide intelligent
responses!`
```

**When `TEST_MODE=false`:**
- Calls OpenAI GPT-4 Turbo for real responses
- Incurs API costs (~$0.01-0.03 per conversation)

### How to Toggle

1. Edit `functions/.env.local`:
   ```bash
   TEST_MODE=false  # or true
   ```

2. Restart Firebase emulators:
   ```bash
   # Ctrl+C to stop, then:
   firebase emulators:start
   ```

**Note**: No rebuild needed for `.env.local` changes, only restart.

---

## Known Limitations & Constraints

### Current MVP Scope

✅ **Implemented:**
- Conversation-based triggering (BuyBot responds to messages)
- Intelligent GPT-4 responses with conversation context
- Power user awareness (fetches emails dynamically)
- TEST_MODE for development

❌ **Not Yet Implemented:**
- Signature attachment UI (Phase 3)
- Signature verification logic (Phase 4)
- Power user detection in messages (Phase 2.3)
- Multi-agent support (future)
- Rate limiting (documented limitation)
- Advanced memory/state management

### Technical Constraints

**No Rate Limiting:**
- Users can spam messages to BuyBot
- No cost controls on OpenAI API calls
- Mitigation: TEST_MODE during development

**Hardcoded Power Users:**
- Power user list is configured via environment variables
- No UI for managing power users
- Must redeploy to update power user list

**Context Window:**
- Limited to last 10 messages
- Older conversation history not available
- No persistent agent memory across sessions

**Signature Verification:**
- Not yet connected to actual signature validation
- Agent can discuss signatures but can't verify them yet
- Coming in Phase 4

### Cost Considerations

**Per Message Costs (Approximate):**
- GPT-4 Turbo: ~$0.01-0.03 per message (depending on context length)
- Firestore reads: Minimal (context retrieval)
- Firestore writes: 1 write per response

**Daily Usage Example:**
- 100 messages/day × $0.02 = $2.00/day
- Monthly: ~$60/month (for active testing)

**Cost Controls:**
- Use TEST_MODE during development
- Monitor OpenAI usage dashboard
- Consider switching to `gpt-3.5-turbo` for lower costs (~10x cheaper)

---

## Implementation Files

### Core Agent Logic
- `functions/src/agents/buyBotAgent.ts` - Main agent implementation
  - `onBuyBotMessage` - Firestore trigger
  - `processUserMessage` - Message processing
  - `generateBuyBotResponse` - LLM integration
  - `buildBuyBotPrompt` - System prompt builder
  - `getPowerUserEmails` - Power user lookup

### Configuration
- `functions/src/config/agents.ts` - Agent configuration helpers
- `functions/.env.local` - Environment variables (development)
- Firebase config - Environment variables (production)

### Utilities
- `functions/src/services/contextRetrieval.ts` - Conversation context fetching

---

## Testing

### Manual Testing Checklist

- [ ] BuyBot responds to messages intelligently (TEST_MODE=false)
- [ ] Mock responses work (TEST_MODE=true)
- [ ] Conversation context is maintained across messages
- [ ] Power user emails appear in responses when relevant
- [ ] Tone is professional and concise
- [ ] BuyBot doesn't respond to own messages (no infinite loop)
- [ ] BuyBot only responds in conversations where it's a participant

### Test Scenarios

**1. Purchase Request:**
```
"I need to buy a new laptop for $2000"
Expected: Acknowledges request, mentions authorization needed
```

**2. Power User Query:**
```
"Who can approve my purchases?"
Expected: Lists power user email(s)
```

**3. Context Awareness:**
```
Message 1: "I need a laptop"
Message 2: "What's the approval process?"
Expected: References laptop from first message
```

**4. Edge Cases:**
```
"Hi" → Should introduce itself
"xyz" → Should ask for clarification
Empty message → Should handle gracefully
```

---

## Next Steps (Post-MVP)

### Phase 2.3: Power User Detection
- Detect when power user joins conversation
- Adjust agent behavior accordingly

### Phase 3: Signature Attachment UI
- Allow users to attach signature IDs to messages
- UI for browsing available signatures

### Phase 4: Signature Verification
- Verify signatures are valid
- Check signature authorizes the specific request
- Semantic matching using LLM

### Phase 5: Testing & Polish
- Comprehensive test coverage
- Error handling improvements
- Cost optimization

### Phase 6: Deployment
- Production environment configuration
- Firebase config for environment variables
- Monitoring and logging setup

---

## Troubleshooting

### BuyBot not responding

**Check:**
1. Is BuyBot a participant in the conversation?
2. Are the Firebase emulators running?
3. Check logs for errors: Look in emulator terminal

**Solution:**
```bash
# Restart emulators
firebase emulators:start
```

### Getting mock responses instead of GPT-4

**Check:**
1. `TEST_MODE=false` in `.env.local`?
2. Did you restart emulators after changing?
3. Is `OPENAI_API_KEY` set in `.env.local`?

**Solution:**
```bash
# Verify config
node test-agent-config.js

# Check for TEST_MODE
cat functions/.env.local | grep TEST_MODE
```

### Responses not context-aware

**Check:**
1. Are there previous messages in the conversation?
2. Check logs to see if context is being fetched

**Debug:**
Look for `[BUYBOT] Conversation context retrieved:` in logs

### OpenAI errors

**Common Issues:**
- Invalid API key → Check `OPENAI_API_KEY` in `.env.local`
- Rate limit exceeded → Wait or upgrade OpenAI plan
- Network error → Check internet connection

**Solution:**
Switch to TEST_MODE temporarily while debugging:
```bash
TEST_MODE=true
```

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-26
**Phase**: 2.2 - LLM Integration Complete

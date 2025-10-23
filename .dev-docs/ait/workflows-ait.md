# AI Tools Integration - Developer Workflows

## Document Overview
**Version**: 1.0
**Date**: 2025-10-22
**Status**: Living Document

This document provides practical tips, workflows, and best practices for developing AI features. It assumes developers may not always follow exact guidelines, so it focuses on useful patterns, common pitfalls, and troubleshooting advice.

---

## Table of Contents
1. [Daily Development Workflow](#daily-development-workflow)
2. [Working with Firebase Emulator](#working-with-firebase-emulator)
3. [Developing AI Agents](#developing-ai-agents)
4. [Testing Strategies](#testing-strategies)
5. [Debugging Tips](#debugging-tips)
6. [Cost Management](#cost-management)
7. [Common Pitfalls](#common-pitfalls)
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
- [ ] Check `.env` has `OPENAI_API_KEY` (functions/.env)
- [ ] Check emulators are running (visit http://localhost:4000)
- [ ] Check mobile app connects to emulator (see "🔧 Connected to emulator" log)
- [ ] Test a simple function call to verify connection

### Making Changes

**Typical development cycle**:
1. Edit function code in `functions/src/`
2. Save file (TypeScript auto-compiles if using `build:watch`)
3. Function auto-reloads in emulator (hot reload)
4. Test from mobile app or Functions shell
5. Check logs in Terminal 3 or Emulator UI

**If hot reload doesn't work**:
```bash
# Stop emulator (Ctrl+C)
cd functions
npm run build
cd ..
npm run functions:dev
```

---

## Working with Firebase Emulator

### Emulator UI (http://localhost:4000)

**Most useful tabs**:
- **Functions**: See all deployed functions, invocation history
- **Firestore**: Browse/edit data, test queries
- **Logs**: Real-time function logs with filtering
- **Auth**: Manage test users

### Testing Functions Directly

**Option 1: Functions Shell (Interactive REPL)**
```bash
firebase functions:shell

# In shell:
> helloWorldAI({ message: "Hello!" })
# Returns promise with result

> translateMessage({ text: "Hello", targetLanguage: "Spanish" })

# Access Firestore
> admin.firestore().collection('users').get()
```

**Option 2: HTTP Requests (curl/Postman)**
```bash
# Get auth token first (from mobile app or emulator)
TOKEN="your-test-token"

curl -X POST \
  http://localhost:5001/YOUR_PROJECT_ID/us-central1/helloWorldAI \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"message": "Hello"}}'
```

**Option 3: Mobile App (Best for integration testing)**
- Long-press message → Translate
- Check emulator logs for function call
- Verify result in app

### Emulator Data Persistence

**Data is ephemeral by default** (cleared on restart).

To persist data between restarts:
```bash
# Export data
firebase emulators:export ./emulator-data

# Import on next start
firebase emulators:start --import ./emulator-data

# Auto-import and export
firebase emulators:start --import ./emulator-data --export-on-exit
```

**Tip**: Add to `.gitignore`:
```
emulator-data/
```

### Testing with Real Users

**Create test users in emulator**:
```typescript
// In functions shell or test script
admin.auth().createUser({
  uid: 'test-user-1',
  email: 'test1@example.com',
  password: 'password123',
});
```

**Or use Auth Emulator UI**:
1. Go to http://localhost:4000/auth
2. Click "Add User"
3. Enter email/password
4. Use in mobile app

---

## Developing AI Agents

### Agent Development Pattern

**1. Start with prompt engineering** (fastest iteration):
```typescript
// Test prompts in OpenAI Playground first
// https://platform.openai.com/playground

// Once satisfied, copy to agent code
const prompt = `You are a translation assistant...`;
```

**2. Implement agent function**:
```typescript
// functions/src/agents/myAgent.ts
export async function myAgent(request: MyRequest): Promise<MyResponse> {
  const prompt = buildPrompt(request);

  const result = await generateText({
    model: openai('gpt-4-turbo'),
    messages: [{ role: 'user', content: prompt }],
  });

  return parseResponse(result.text);
}
```

**3. Create Cloud Function wrapper**:
```typescript
// functions/src/index.ts
export const myFunction = onCall(
  { secrets: [openaiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '...');
    await checkRateLimit(request.auth.uid, 'myFunction');
    const result = await myAgent(request.data);
    return { success: true, ...result };
  }
);
```

**4. Test locally**:
```bash
# Functions shell
myFunction({ /* test data */ })

# Or from mobile app
```

**5. Deploy**:
```bash
firebase deploy --only functions:myFunction
```

### Prompt Engineering Tips

**Start simple, iterate**:
```typescript
// ❌ Too complex to start
const prompt = `You are an expert translation assistant with deep knowledge
of cultural nuances, idioms, and regional dialects. Analyze the following
conversation context, participant relationships, and message sentiment to
provide a culturally-aware translation that maintains tone, formality, and
implicit meanings while...`;

// ✅ Start here
const prompt = `Translate this text to ${targetLang}:
"${text}"

Return JSON: { "translatedText": "..." }`;

// ✅ Then iterate
const prompt = `Translate this text to ${targetLang}:
"${text}"

Conversation context:
${recentMessages.join('\n')}

Return JSON: {
  "translatedText": "...",
  "confidence": 0.0-1.0
}`;
```

**JSON Mode** (enforce structured output):
```typescript
const result = await generateText({
  model: openai('gpt-4-turbo'),
  messages: [...],
  response_format: { type: 'json_object' }, // Forces valid JSON
});

const parsed = JSON.parse(result.text);
```

**Token Management**:
```typescript
import { encoding_for_model } from 'tiktoken';

const encoding = encoding_for_model('gpt-4-turbo');
const tokens = encoding.encode(prompt);
console.log(`Prompt tokens: ${tokens.length}`);

// If too long, truncate context
if (tokens.length > 3000) {
  recentMessages = recentMessages.slice(-5); // Keep only last 5
}
```

### Testing AI Agents Locally

**Without real API calls** (for rapid iteration):
```typescript
// agents/myAgent.ts
const USE_MOCK = process.env.USE_MOCK_AI === 'true';

export async function myAgent(request: MyRequest): Promise<MyResponse> {
  if (USE_MOCK) {
    // Return mock data for testing
    return {
      translatedText: 'Hola (mocked)',
      confidence: 0.95,
    };
  }

  // Real API call
  const result = await generateText({...});
  return parseResponse(result.text);
}
```

```bash
# In functions/.env
USE_MOCK_AI=true
```

**With real API calls** (use cheap model):
```typescript
// For testing, use gpt-3.5-turbo instead of gpt-4-turbo
const model = process.env.NODE_ENV === 'production'
  ? openai('gpt-4-turbo')
  : openai('gpt-3.5-turbo');
```

---

## Testing Strategies

### Unit Tests (Agents)

**Setup Jest** (`functions/package.json`):
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/*.test.ts"]
  }
}
```

**Example test** (`functions/test/translationAgent.test.ts`):
```typescript
import { translateText } from '../src/agents/translationAgent';

// Mock OpenAI API
jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: JSON.stringify({
      translatedText: 'Hola',
      sourceLanguage: 'English',
      confidence: 0.95,
    }),
    usage: { promptTokens: 50, completionTokens: 20 },
  }),
}));

describe('Translation Agent', () => {
  it('translates text correctly', async () => {
    const result = await translateText({
      text: 'Hello',
      targetLanguage: 'Spanish',
    });

    expect(result.translatedText).toBe('Hola');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('handles errors gracefully', async () => {
    // Mock API error
    jest.mock('ai').mockRejectedValueOnce(new Error('API error'));

    await expect(translateText({
      text: 'Hello',
      targetLanguage: 'Spanish',
    })).rejects.toThrow();
  });
});
```

**Run tests**:
```bash
cd functions
npm test

# Watch mode (reruns on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Integration Tests (E2E)

**Manual test checklist** (`functions/test/manual-checklist.md`):
```markdown
## Translation Function
- [ ] Call from mobile app
- [ ] Verify emulator logs show function invocation
- [ ] Check rate limiting (make 21 calls quickly)
- [ ] Test without auth (should fail)
- [ ] Test with invalid input (should fail with clear error)
- [ ] Test with conversation context (fetch recent messages)
- [ ] Verify cost logging (check emulator logs for token usage)

## Performance
- [ ] Response time < 5 seconds for simple translation
- [ ] Response time < 10 seconds with conversation context
- [ ] No crashes with large messages (5000 chars)
```

### Load Testing

**Simple load test** (`functions/test/load-test.ts`):
```typescript
async function loadTest() {
  const startTime = Date.now();
  const promises = [];

  // 50 concurrent requests
  for (let i = 0; i < 50; i++) {
    promises.push(
      translateMessage({
        text: `Hello ${i}`,
        targetLanguage: 'Spanish',
      }).catch((err) => console.error(`Request ${i} failed:`, err))
    );
  }

  await Promise.all(promises);

  const duration = Date.now() - startTime;
  console.log(`Completed 50 requests in ${duration}ms`);
  console.log(`Average: ${duration / 50}ms per request`);
}

loadTest();
```

**Check**:
- Error rate (should be 0% or near 0%)
- Rate limiting kicks in (should see errors after 20 calls)
- Response times (should not degrade significantly)

---

## Debugging Tips

### Function Not Found Error

**Error**: `Function translateMessage not found`

**Causes**:
1. Function not exported in `functions/src/index.ts`
2. TypeScript compilation error
3. Emulator not restarted after adding function
4. Function name mismatch (client vs server)

**Fix**:
```bash
# 1. Check exports
cat functions/src/index.ts
# Should have: export const translateMessage = onCall(...)

# 2. Check for compilation errors
cd functions
npm run build
# Fix any TypeScript errors

# 3. Restart emulator
cd ..
npm run functions:dev
```

### Authentication Errors

**Error**: `Unauthenticated` or `request.auth is undefined`

**Causes**:
1. Mobile app not logged in
2. Emulator not connected (using production instead)
3. Auth token expired

**Fix**:
```typescript
// Check client connection to emulator
// services/ai.ts
const functions = getFunctions();
if (__DEV__) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('🔧 Connected to Functions Emulator');
}

// Check auth status
import { useAuth } from '../context/auth';
const { user } = useAuth();
console.log('Current user:', user?.uid);
```

### Rate Limit Errors

**Error**: `Resource exhausted`

**Causes**:
1. Exceeded rate limit (20 calls/hour in testing)
2. Rate limit document not clearing

**Fix**:
```bash
# Option 1: Reset rate limit in Firestore
# Go to http://localhost:4000/firestore
# Delete: rate_limits/{userId}_{functionName}

# Option 2: Increase limit for testing
# functions/src/utils/rateLimit.ts
export const RATE_LIMITS = {
  AI_FUNCTION_FREE_TIER: {
    maxCalls: 999, // Increase for testing
    windowMs: 60 * 60 * 1000,
  },
};
```

### OpenAI API Errors

**Error**: `OpenAI API error: 401 Unauthorized`

**Causes**:
1. Invalid API key
2. API key not loaded from secrets

**Fix**:
```bash
# Check .env file
cat functions/.env
# Should have: OPENAI_API_KEY=sk-...

# Verify key is valid
# Test at: https://platform.openai.com/api-keys

# Check emulator is loading .env
# functions/src/config.ts should have:
if (process.env.FUNCTIONS_EMULATOR) {
  require('dotenv').config();
}
```

**Error**: `OpenAI API error: 429 Rate Limit Exceeded`

**Cause**: Too many API calls (OpenAI has rate limits)

**Fix**:
```typescript
// Add retry logic with exponential backoff
async function callOpenAIWithRetry(params: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateText(params);
    } catch (error: any) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Slow Function Performance

**Symptoms**: Functions taking > 10 seconds

**Debug steps**:
```typescript
// Add timing logs
export const translateMessage = onCall(async (request) => {
  const startTime = Date.now();

  // Step 1
  console.log('1. Auth check');
  if (!request.auth) throw new HttpsError(...);
  console.log(`   took ${Date.now() - startTime}ms`);

  // Step 2
  console.log('2. Rate limit');
  await checkRateLimit(...);
  console.log(`   took ${Date.now() - startTime}ms`);

  // Step 3
  console.log('3. Context retrieval');
  const context = await getConversationContext(...);
  console.log(`   took ${Date.now() - startTime}ms`);

  // Step 4
  console.log('4. AI call');
  const result = await translateText(...);
  console.log(`   took ${Date.now() - startTime}ms`);

  return result;
});
```

**Common bottlenecks**:
- Context retrieval (Firestore queries): Should be < 500ms
- OpenAI API call: 2-5 seconds for GPT-4, 1-2s for GPT-3.5
- Large messages: Use GPT-3.5-turbo instead of GPT-4

**Optimization**:
```typescript
// Parallel operations where possible
const [context, userPrefs] = await Promise.all([
  getConversationContext(conversationId),
  getUserPreferences(userId),
]);
```

### Memory Issues

**Error**: `Function invocation was interrupted. Error: memory limit exceeded.`

**Causes**:
1. Loading too much data from Firestore
2. Large embeddings arrays
3. Memory leaks (not clearing variables)

**Fix**:
```typescript
// Increase memory allocation
export const myFunction = onCall(
  {
    secrets: [openaiApiKey],
    memory: '1GiB', // Increase from default 256MiB
  },
  async (request) => {
    // ...
  }
);

// Limit data fetching
const messages = await messagesRef
  .orderBy('timestamp', 'desc')
  .limit(50) // Don't fetch all messages
  .get();

// Clear large variables
let largeData = await fetchLargeData();
// ... process largeData
largeData = null; // Help GC
```

---

## Cost Management

### Monitoring Costs

**Daily cost check**:
```bash
# Check function logs for token usage
npm run functions:logs

# Look for lines like:
# "inputTokens": 150, "outputTokens": 50, "cost": 0.0025
```

**Calculate weekly costs**:
```typescript
// functions/src/utils/costCalculator.ts
export function calculateWeeklyCosts(logs: FunctionMetrics[]) {
  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const avgCostPerCall = totalCost / logs.length;
  const totalCalls = logs.length;

  console.log(`Weekly Report:
    Total Cost: $${totalCost.toFixed(2)}
    Total Calls: ${totalCalls}
    Avg Cost/Call: $${avgCostPerCall.toFixed(4)}
  `);

  return { totalCost, avgCostPerCall, totalCalls };
}
```

### Cost Optimization Strategies

**1. Use cheaper models for simple tasks**:
```typescript
// Priority detection (simple classification)
const model = openai('gpt-3.5-turbo'); // $0.0005/1K vs $0.01/1K

// Translation (complex with context)
const model = openai('gpt-4-turbo'); // Higher quality needed
```

**2. Aggressive caching**:
```typescript
// Check cache first
const cacheKey = `summary_${conversationId}_${lastMessageId}`;
const cached = await getCached(cacheKey);
if (cached) return cached; // Save $0.01

// Generate and cache
const summary = await generateSummary(...);
await cache(cacheKey, summary, 3600000); // 1 hour TTL
```

**3. Reduce prompt size**:
```typescript
// ❌ Sending entire conversation (1000 messages = 50K tokens = $0.50)
const messages = await getAllMessages(conversationId);

// ✅ Send only recent context (50 messages = 2.5K tokens = $0.025)
const messages = await getRecentMessages(conversationId, 50);
```

**4. Token limits**:
```typescript
const result = await generateText({
  model: openai('gpt-4-turbo'),
  messages: [...],
  max_tokens: 500, // Limit output tokens (costs 3x input)
});
```

**5. Batching**:
```typescript
// ❌ Embed messages one-by-one (100 API calls)
for (const msg of messages) {
  await generateEmbedding(msg.text);
}

// ✅ Batch embed (1 API call)
await batchGenerateEmbeddings(messages.map(m => m.text));
```

### Budget Alerts

**Set up alerts** (manual monitoring for MVP):
```typescript
// functions/src/utils/budgetAlert.ts
const DAILY_BUDGET = 5.00; // $5/day
let dailyCost = 0;

export function trackCost(cost: number) {
  dailyCost += cost;

  if (dailyCost > DAILY_BUDGET * 0.8) {
    console.error(`⚠️ WARNING: 80% of daily budget used ($${dailyCost.toFixed(2)})`);
  }

  if (dailyCost > DAILY_BUDGET) {
    console.error(`🚨 ALERT: Daily budget exceeded ($${dailyCost.toFixed(2)})`);
    // Could disable functions or send email
  }
}
```

---

## Common Pitfalls

### 1. Forgetting to Export Function

**Symptom**: "Function not found" error

**Problem**:
```typescript
// functions/src/myAgent.ts
export const myFunction = onCall(...); // Defined but not exported from index.ts
```

**Fix**:
```typescript
// functions/src/index.ts
export { myFunction } from './myAgent';

// Or
export const myFunction = require('./myAgent').myFunction;
```

### 2. Not Handling Async Errors

**Problem**:
```typescript
export const myFunction = onCall(async (request) => {
  const result = await callOpenAI(); // If this fails, no error handling
  return result;
});
```

**Fix**:
```typescript
export const myFunction = onCall(async (request) => {
  try {
    const result = await callOpenAI();
    return { success: true, ...result };
  } catch (error: any) {
    console.error('Error:', error);
    throw new HttpsError('internal', error.message);
  }
});
```

### 3. Circular Dependencies

**Problem**:
```typescript
// contextRetrieval.ts imports agents/translationAgent.ts
// translationAgent.ts imports contextRetrieval.ts
// Result: Import error
```

**Fix**: Organize imports hierarchically
```
utils/          (no imports from other layers)
  ↓
services/       (can import utils)
  ↓
agents/         (can import services + utils)
  ↓
index.ts        (can import agents + services + utils)
```

### 4. Not Testing Locally Before Deploy

**Problem**: Deploy broken function to production

**Always**:
1. Test in emulator
2. Check logs for errors
3. Test from mobile app
4. Deploy

### 5. Hardcoding User IDs or Conversation IDs

**Problem**:
```typescript
// ❌ Hardcoded test data left in production
const conversationId = 'test-conv-123';
```

**Fix**: Always use request data
```typescript
const conversationId = request.data.conversationId;
```

### 6. Not Validating Input

**Problem**:
```typescript
const text = request.data.text;
// What if text is undefined, null, or 10,000 characters?
```

**Fix**: Use Zod
```typescript
const schema = z.object({
  text: z.string().min(1).max(5000),
  targetLanguage: z.string().min(2).max(50),
});

const validated = schema.parse(request.data);
```

### 7. Forgetting Rate Limits

**Problem**: Users can spam expensive AI calls

**Always**: Add rate limiting
```typescript
await checkRateLimit(request.auth.uid, 'functionName');
```

### 8. Not Logging Metrics

**Problem**: No visibility into costs, performance, errors

**Always**: Log important metrics
```typescript
logFunctionCall({
  functionName: 'myFunction',
  userId: request.auth.uid,
  inputTokens: result.usage.promptTokens,
  outputTokens: result.usage.completionTokens,
  cost: calculateCost(...),
  duration: Date.now() - startTime,
  success: true,
});
```

---

## Useful Commands

### Firebase Functions

```bash
# Initialize functions
firebase init functions

# Start emulator with functions
firebase emulators:start --only functions

# Start all emulators
firebase emulators:start

# Functions shell (interactive REPL)
firebase functions:shell

# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:myFunction

# View logs (real-time)
firebase functions:log

# View logs (filtered)
firebase functions:log --only myFunction

# Delete a function
firebase functions:delete myFunction

# Set secret
firebase functions:secrets:set SECRET_NAME

# View secrets
firebase functions:secrets:access SECRET_NAME
```

### Development

```bash
# Build functions (TypeScript → JavaScript)
cd functions && npm run build

# Watch mode (auto-rebuild on changes)
cd functions && npm run build:watch

# Run tests
cd functions && npm test

# Test coverage
cd functions && npm run test:coverage

# Lint
cd functions && npm run lint

# Type check
cd functions && npx tsc --noEmit
```

### Debugging

```bash
# View emulator logs
firebase emulators:logs

# Tail logs
firebase emulators:logs --only functions

# Export emulator data
firebase emulators:export ./emulator-data

# Import emulator data
firebase emulators:start --import ./emulator-data

# Check function memory usage (in logs)
grep "memory" firebase-debug.log

# Check function execution time (in logs)
grep "execution took" firebase-debug.log
```

### Git

```bash
# Commit functions changes
git add functions/
git commit -m "feat: add translation agent"

# Create feature branch
git checkout -b feature/translation-agent

# Merge to main
git checkout main
git merge feature/translation-agent
git push
```

---

## Best Practices Checklist

**Before committing**:
- [ ] Code compiles (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Function tested in emulator
- [ ] Function tested from mobile app
- [ ] Error handling comprehensive
- [ ] Logging added (metrics, errors)
- [ ] Rate limiting applied
- [ ] Input validation added (Zod)
- [ ] Documentation updated

**Before deploying**:
- [ ] All tests pass
- [ ] Tested with real data in emulator
- [ ] Checked logs for errors
- [ ] Cost estimate reasonable
- [ ] Rate limits appropriate
- [ ] Secrets configured in production
- [ ] Backup plan (can rollback if needed)

**After deploying**:
- [ ] Test in production (from mobile app)
- [ ] Monitor logs for errors
- [ ] Check performance metrics
- [ ] Verify costs are as expected
- [ ] Update documentation

---

## Troubleshooting Guide

### Quick Diagnosis

**Problem**: Function not working

**Check in order**:
1. Is emulator running? → `firebase emulators:start`
2. Is function exported? → Check `functions/src/index.ts`
3. Any TypeScript errors? → `cd functions && npm run build`
4. Is client connected to emulator? → Check console logs
5. Is user authenticated? → Check `request.auth` in logs
6. Any runtime errors? → Check function logs

**Problem**: Slow performance

**Check**:
1. How long is OpenAI API call taking? → Add timing logs
2. Is Firestore query slow? → Add indexes
3. Is context too large? → Limit message count
4. Wrong model? → Use GPT-3.5 for simple tasks

**Problem**: High costs

**Check**:
1. Token usage per call? → Check logs
2. Caching working? → Check cache hit rate
3. Using right model? → GPT-3.5 vs GPT-4
4. Prompt too long? → Reduce context

---

## Resources

### Official Documentation

- **Firebase Functions**: https://firebase.google.com/docs/functions
- **Vercel AI SDK**: https://sdk.vercel.ai/docs
- **OpenAI API**: https://platform.openai.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

### Community

- **Firebase Discord**: https://discord.gg/firebase
- **Stack Overflow**: Tag `firebase-functions`, `openai-api`

### Tools

- **OpenAI Playground**: https://platform.openai.com/playground
- **Token Counter**: https://platform.openai.com/tokenizer
- **Firebase Console**: https://console.firebase.google.com

---

## Conclusion

This document is a **living guide** - add your own tips, gotchas, and shortcuts as you develop. The goal is to make development faster and catch issues early.

**Key Takeaways**:
- ✅ Always test locally with emulator first
- ✅ Use structured logging for debugging
- ✅ Monitor costs continuously
- ✅ Start simple, iterate
- ✅ Don't trust yourself - validate everything
- ✅ When stuck, check logs first

**Happy coding!** 🚀

---

**Document Version**: 1.0
**Date**: 2025-10-22
**Status**: Living Document (update as you learn)

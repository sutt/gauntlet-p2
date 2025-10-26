# CHAI Environment Variables - Quick Reference

**Date**: 2025-10-26
**Purpose**: Quick command reference for managing BuyBot configuration

---

## Local Development (.env.local)

Your current configuration:

```bash
# functions/.env.local
TEST_MODE=true
BUYBOT_USER_ID=3SGngjhy3VGk15JY2uRgrtSpg9BI
POWER_USER_IDS=Nr2ne28sZJShTzemvhA0J47tVaUO
```

**No action needed** - already configured! ✅

---

## Production Deployment

### Quick Deploy Commands

```bash
# 1. Create BuyBot user in production (manual via Firebase Console)
#    Copy the production UID

# 2. Set environment config
firebase functions:config:set \
  chai.buybot_uid="PRODUCTION_BUYBOT_UID" \
  chai.power_user_ids="PRODUCTION_POWER_UID1,PRODUCTION_POWER_UID2"

# 3. Verify config
firebase functions:config:get

# 4. Deploy
npm run functions:deploy
```

### Example with Real Values

```bash
firebase functions:config:set \
  chai.buybot_uid="xK9mP2nQ4rS5tU6vW7xY8zA1B" \
  chai.power_user_ids="aB1cD2eF3gH4iJ5kL6mN7oP8qR,zY9xW8vU7tS6rQ5pO4nM3lK2"
```

---

## Common Tasks

### View Current Config

```bash
# Local
cat functions/.env.local

# Production
firebase functions:config:get
```

### Add a Power User

```bash
# Get current list
firebase functions:config:get chai.power_user_ids

# Update with new UID added
firebase functions:config:set chai.power_user_ids="UID1,UID2,NEW_UID"

# Redeploy
firebase deploy --only functions
```

### Change BuyBot UID

```bash
firebase functions:config:set chai.buybot_uid="NEW_UID"
firebase deploy --only functions
```

### Remove Configuration

```bash
# Remove specific config
firebase functions:config:unset chai.buybot_uid

# Remove all chai config
firebase functions:config:unset chai
```

---

## Configuration Hierarchy

The code checks for configuration in this order:

1. **Environment Variable** (`process.env.*`) - Used in local development
2. **Firebase Config** (`functions.config().chai.*`) - Used in production
3. **Not Found** - Logs warning, returns empty value

This means:
- Local: Uses `.env.local` values
- Production: Uses Firebase config values
- No conflicts between environments

---

## Environment Variables Reference

| Variable | Local (.env.local) | Production (Firebase Config) |
|----------|-------------------|------------------------------|
| **BuyBot UID** | `BUYBOT_USER_ID=...` | `firebase functions:config:set chai.buybot_uid="..."` |
| **Power Users** | `POWER_USER_IDS=uid1,uid2` | `firebase functions:config:set chai.power_user_ids="uid1,uid2"` |
| **Test Mode** | `TEST_MODE=true` | (don't set - defaults to false) |

---

## Verification

### Test Local Config

```bash
# Start functions
npm run functions:dev

# Check logs for warnings
# Should NOT see: "BUYBOT_USER_ID not configured"
```

### Test Production Config

```bash
# After deploying
firebase functions:log --only onBuyBotMessage

# Look for startup logs showing configuration loaded
# Should NOT see warnings about missing config
```

---

## Troubleshooting

### "BUYBOT_USER_ID not configured" warning

**Local:**
```bash
# Check .env.local exists and has the variable
cat functions/.env.local | grep BUYBOT_USER_ID

# Restart emulator
npm run functions:dev
```

**Production:**
```bash
# Check Firebase config
firebase functions:config:get chai.buybot_uid

# If missing, set it
firebase functions:config:set chai.buybot_uid="YOUR_UID"
firebase deploy --only functions
```

### "POWER_USER_IDS not configured" warning

**Local:**
```bash
# Check .env.local
cat functions/.env.local | grep POWER_USER_IDS
```

**Production:**
```bash
# Check Firebase config
firebase functions:config:get chai.power_user_ids

# If missing, set it
firebase functions:config:set chai.power_user_ids="UID1,UID2"
firebase deploy --only functions
```

---

## Complete Deployment Checklist

- [ ] BuyBot user created in production Firebase Auth
- [ ] BuyBot UID copied
- [ ] Power user UIDs identified
- [ ] Firebase config set:
  ```bash
  firebase functions:config:set chai.buybot_uid="..."
  firebase functions:config:set chai.power_user_ids="..."
  ```
- [ ] Config verified: `firebase functions:config:get`
- [ ] Functions deployed: `firebase deploy --only functions`
- [ ] Logs checked: No configuration warnings
- [ ] BuyBot tested in production app
- [ ] Power users verified to work

---

**Document Status**: ✅ Ready to Use
**See Also**: production-deployment.md for detailed deployment guide

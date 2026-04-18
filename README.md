# English Worklife Agent

A mobile-first English learning agent for overseas work and daily life communication.

Phase 2 is now included:
- Account system (register/login/JWT auth)
- Optional PostgreSQL persistence
- Text + voice conversation practice
- Real-time correction + post-message coaching
- Daily loop dashboard (streak + checklist + reflection)
- Weekly report (trends + strengths + risks + next-week plan)

## Quick Start (Persistent Mode)

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:init
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

- `PORT`: server port, default `3000`
- `OPENAI_API_KEY`: optional, for model-based roleplay replies
- `OPENAI_MODEL`: optional, default `gpt-4.1-mini`
- `DEFAULT_LEVEL`: default learner level, default `A2`
- `APP_TIMEZONE`: daily plan timezone, default `Asia/Shanghai`
- `USE_POSTGRES`: `true` or `false` (recommended `true` for persistence)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRES_IN`: JWT expiry, default `7d`
- `QQBOT_BRIDGE_SECRET`: shared secret for QQ bot bridge endpoint (optional but recommended)
- `QQBOT_BRIDGE_PASSWORD`: bootstrap password used for auto-created QQ bridge users

## Docker PostgreSQL (Recommended)

```bash
npm run db:up
npm run db:init
```

To stop DB:

```bash
npm run db:down
```

If PostgreSQL is disabled, the app falls back to in-memory mode and data is lost after restart.

## Verify Persistence

After startup, call:

```bash
curl http://localhost:3000/api/health
```

Expected: `"storage":"postgres"`.

Then create an account, send a few messages, restart app (`npm run start` again), and login with the same account.
Your progress should remain unchanged.

## Scripts

- `npm run dev`: run server with watch mode
- `npm run start`: run server normally
- `npm run db:up`: start postgres container
- `npm run db:down`: stop postgres container
- `npm run db:logs`: view postgres logs
- `npm run db:init`: initialize PostgreSQL tables
- `npm run dev:persistent`: one command for db up + init + dev
- `npm run test`: run unit tests

## API Summary

Public:
- `GET /api/health`
- `GET /api/v1/scenarios`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Auth required (`Authorization: Bearer <token>`):
- `GET /api/v1/auth/me`
- `POST /api/v1/session/init`
- `POST /api/v1/chat`
- `GET /api/v1/progress/me`
- `POST /api/v1/progress/record`
- `GET /api/v1/daily/dashboard`
- `POST /api/v1/daily/checkin`
- `GET /api/v1/weekly/report`

Integration:
- `POST /api/v1/integrations/qqbot/message` (`x-bot-secret` required when `QQBOT_BRIDGE_SECRET` is set)

## Daily Self-Use Method

Use the built-in loop every day:
1. `Warm-up voice` (3 min): speak 5 simple sentences
2. `Core scenario` (8 min): focus on one practical scenario
3. `Weakness repair` (3 min): repeat corrected sentences
4. `Reflection note` (1 min): write one improvement + one next fix

The system tracks streak and suggests focus scenario based on your recent mistakes.

## Weekly Self-Review

Open the weekly panel to generate:
1. weekly totals (practice count, active days, estimated minutes)
2. fluency and accuracy trend vs previous week
3. strengths and risk alerts
4. next-week action plan tailored to your top error tags

## QQBot + Skill Integration

Skill files in this repo:

```text
openclaw-skills/qq-english-learning-loop
```

Install skill into your running OpenClaw container:

```powershell
pwsh ./tools/install_openclaw_skill.ps1
```

Bridge script usage (inside OpenClaw/container):

```bash
bash /root/.openclaw/workspace/skills/qq-english-learning-loop/scripts/qq_learning_bridge.sh \
  --user "qq-user-001" \
  --text "/learn plan"
```

Supported commands:
- `/learn goal <text>`
- `/learn content <focus>`
- `/learn preference <style>`
- `/learn plan`
- `/learn do <english sentence>` (or direct English sentence)
- `/learn checkin task1,task2|note`
- `/learn review win|blocker|nextAction`
- `/learn week`
- `/learn status`
- `/learn improve`

Chinese aliases are also supported, for example:
- `学习目标 ...`
- `学习内容 ...`
- `计划偏好 ...`
- `今日计划`
- `打卡 task1,task2|备注`
- `复盘 收获|阻碍|下一步`
- `改进建议`

## Project Structure

```text
docs/
public/
src/
  config.js
  server.js
  middleware/
  data/
  services/
  scripts/
  utils/
tests/
```

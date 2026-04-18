# English Worklife Agent

A mobile-first English learning agent for overseas work and daily life communication.

Phase 2 is now included:
- Account system (register/login/JWT auth)
- Optional PostgreSQL persistence
- Text + voice conversation practice
- Real-time correction + post-message coaching
- Daily loop dashboard (streak + checklist + reflection)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

- `PORT`: server port, default `3000`
- `OPENAI_API_KEY`: optional, for model-based roleplay replies
- `OPENAI_MODEL`: optional, default `gpt-4.1-mini`
- `DEFAULT_LEVEL`: default learner level, default `A2`
- `APP_TIMEZONE`: daily plan timezone, default `Asia/Shanghai`
- `USE_POSTGRES`: `true` or `false`
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRES_IN`: JWT expiry, default `7d`

## Optional PostgreSQL Setup

```bash
# set USE_POSTGRES=true and DATABASE_URL first
npm run db:init
```

If PostgreSQL is not enabled, the app runs with in-memory storage.

## Scripts

- `npm run dev`: run server with watch mode
- `npm run start`: run server normally
- `npm run db:init`: initialize PostgreSQL tables
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

## Daily Self-Use Method

Use the built-in loop every day:
1. `Warm-up voice` (3 min): speak 5 simple sentences
2. `Core scenario` (8 min): focus on one practical scenario
3. `Weakness repair` (3 min): repeat corrected sentences
4. `Reflection note` (1 min): write one improvement + one next fix

The system tracks streak and suggests focus scenario based on your recent mistakes.

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

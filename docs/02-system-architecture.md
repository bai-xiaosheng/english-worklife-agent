# System Architecture v2

## 1. High-level

```text
Mobile Web/PWA
  -> Express API Server
     -> Auth Service (register/login/JWT)
     -> Conversation Service (LLM + fallback)
     -> Feedback Service (rule-based coaching)
     -> Progress Service (scores + error tags)
     -> Repository Layer
        -> PostgreSQL (optional, USE_POSTGRES=true)
        -> In-memory fallback
```

## 2. Core Modules

1. Frontend (`public/`)
- Auth panel (register/login/logout)
- Scenario practice UI
- Voice input (`SpeechRecognition`)
- Voice output (`speechSynthesis`)
- Progress dashboard

2. Backend (`src/server.js`)
- Public routes: health, scenarios, auth register/login
- Protected routes: profile/session/chat/progress
- JWT middleware for request authorization

3. Data layer (`src/data/repository.js`)
- Unified repository interface
- In-memory implementation for fast local run
- PostgreSQL implementation with table bootstrap

4. Services
- `authService.js`: password hashing and JWT
- `agentService.js`: roleplay reply generation
- `feedbackService.js`: correction, rewrite, scores
- `progressService.js`: summary aggregation

## 3. Data Model

`users`
- `id`, `email`, `password_hash`, `display_name`, `created_at`

`profiles`
- `user_id`, `goal`, `level`, `daily_minutes`, `preferred_locale`, `updated_at`

`sessions`
- `user_id`, `history(jsonb)`, `updated_at`

`practice_records`
- `id`, `user_id`, `scenario_id`, `fluency_score`, `accuracy_score`, `error_tags(jsonb)`, `source`, `created_at`

## 4. API Design

Public:
1. `GET /api/health`
2. `GET /api/v1/scenarios`
3. `POST /api/v1/auth/register`
4. `POST /api/v1/auth/login`

Protected:
1. `GET /api/v1/auth/me`
2. `POST /api/v1/session/init`
3. `POST /api/v1/chat`
4. `GET /api/v1/progress/me`
5. `POST /api/v1/progress/record`


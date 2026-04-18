# PRD v2 - English Worklife Agent

## 1. Product Goal

Help Chinese learners become functional in real overseas work-life conversations:
- Understand intent quickly
- Respond clearly
- Keep conversation moving when communication friction appears

## 2. Target Users

- English level: A1 to B1
- Main goal: work and daily life communication abroad
- Device priority: mobile browser (short daily sessions)

## 3. Core Scenarios

1. Work: standups, 1:1 updates, risk communication, meeting alignment
2. Daily life: renting, shopping, doctor appointments, banking, telecom support
3. Social: small talk, invitations, polite disagreement

## 4. MVP + Phase 2 Scope

1. User account and profile
- Register/login with email + password
- Profile fields: level, daily minutes, preferred locale

2. Scenario roleplay
- AI acts as the counterpart
- User replies by text or voice

3. Hybrid correction
- During conversation: light coaching
- After each turn: rewrite and short explanation

4. Learning tracking
- Practice count, fluency/accuracy trend, top error tags
- User-level progress tied to account identity

5. Storage strategy
- In-memory fallback for quick local runs
- PostgreSQL for persistent records

6. Daily self-use loop
- System generates daily checklist from weakness + recent activity
- User checks completed tasks and writes 1-line reflection
- System tracks streak days and 7-day active trend

7. Weekly self-review
- System generates a weekly report with trend comparison vs previous week
- Report includes strengths, risks, and next-week action plan

## 5. Non-functional Requirements

- Mobile-first responsive UX
- App works without model key via local fallback reply strategy
- Auth-protected data APIs
- Optional PostgreSQL deployment without changing app code

## 6. Success Metrics

- D7 retention >= 20%
- Daily average practice >= 10 minutes
- 3-scenario completion rate >= 40%
- User rating for practical usefulness >= 4/5

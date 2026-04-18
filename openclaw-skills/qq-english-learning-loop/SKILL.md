---
name: qq-english-learning-loop
description: Run a personal English learning loop through QQ chat with backend bridge commands for goal, content focus, daily plan, execution practice, reflection, and weekly improvement. Use when a user asks for English study planning, daily tasks, speaking practice feedback, check-in, review, or progress optimization in QQ.
metadata:
  {
    "openclaw":
      {
        "emoji": "book",
        "requires": { "bins": ["curl"] }
      },
  }
---

# QQ English Learning Loop Skill

Execute the full learning loop for a self-study user in QQ.

## Core loop

1. Set target:
- Update goal with `/learn goal ...`

2. Define content:
- Set focus with `/learn content ...`
- Set style preference with `/learn preference ...`

3. Plan today:
- Fetch plan using `/learn plan`

4. Execute practice:
- Run one turn using `/learn do ...` or direct English text

5. Reflect:
- Save completion with `/learn checkin task1,task2|note`
- Save review with `/learn review win|blocker|nextAction`

6. Improve:
- Get status via `/learn status`
- Get optimization advice via `/learn improve`
- Run weekly review via `/learn week`

## Trigger hints

Use this skill when the user sends:
- `/learn ...`
- `goal` / `study goal` / `learning goal`
- `daily plan` / `today plan`
- `check-in` / `review`
- Chinese equivalents such as `学习目标`, `今日计划`, `打卡`, `复盘`, `改进建议`

## Bridge command

Call the backend bridge script:

```bash
bash openclaw-skills/qq-english-learning-loop/scripts/qq_learning_bridge.sh \
  --user "<qq_user_id>" \
  --name "<display_name>" \
  --text "/learn plan"
```

## Output rules

- Keep replies short and action-oriented.
- Always include one clear next step.
- Prioritize practice feedback over theory.

## References

- `references/learning-loop-framework.md`

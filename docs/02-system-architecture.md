# 系统架构设计 v1

## 1. 总体架构

```text
Mobile Web/PWA
  -> API Server (Express)
     -> Conversation Service (Prompt + Context)
     -> Feedback Service (Rule-based + LLM assist)
     -> Progress Service (Score + Error tags)
     -> Storage (In-memory for MVP)
     -> Optional LLM Provider (OpenAI Responses API)
```

## 2. 核心模块

1. Frontend（`public/`）
- 聊天交互界面
- 场景选择与用户档案设置
- 语音输入（Web Speech API）
- 语音播报（SpeechSynthesis）
- PWA 离线壳（manifest + service worker）

2. API Server（`src/server.js`）
- 会话初始化
- 场景列表获取
- 对话请求处理
- 进度查询与记录

3. Conversation Service（`src/services/agentService.js`）
- 构造系统提示词
- 结合历史消息生成回复
- 优先调用模型；失败时回退本地策略

4. Feedback Service（`src/services/feedbackService.js`）
- 语法/表达启发式检测
- 输出纠错建议、改写句、词汇建议
- 产出评分（流畅度、准确度）

5. Progress Service（`src/services/progressService.js`）
- 记录练习次数、累计分数、错误标签
- 返回按用户维度的统计摘要

## 3. 数据模型（MVP）

`UserProfile`
- `userId`
- `goal`（固定为海外工作生活，可扩展）
- `level`（A1/A2/B1/B2）
- `dailyMinutes`（默认 15）
- `preferredLocale`（zh-CN）

`Session`
- `sessionId`
- `userId`
- `scenarioId`
- `history[]`（role + text + ts）

`PracticeRecord`
- `userId`
- `scenarioId`
- `fluencyScore`
- `accuracyScore`
- `errorTags[]`
- `createdAt`

## 4. API 设计

1. `GET /api/v1/scenarios`
- 返回场景列表与建议用语

2. `POST /api/v1/session/init`
- 入参：`userId`, `profile`
- 出参：已初始化的用户与可练习场景

3. `POST /api/v1/chat`
- 入参：`userId`, `scenarioId`, `message`, `useChineseHint`
- 出参：`roleplayReply`, `coachTip`, `rewrite`, `scores`, `errorTags`

4. `GET /api/v1/progress/:userId`
- 返回累计练习数据与最近练习记录

## 5. 关键技术决策

1. 渠道策略
- 核心能力做成独立 Web/PWA，保证跨平台和海外可用性
- IM Bot（如 QQ）作为后续渠道适配器，不作为核心依赖

2. 语音策略
- MVP 使用浏览器原生能力，减少接入成本
- 下一阶段可替换为服务端 ASR/TTS（更稳定可控）

3. 模型策略
- 有 Key：调用外部模型提供自然对话
- 无 Key：本地规则回退确保服务不中断

## 6. 扩展路线

1. 数据持久化：PostgreSQL + Redis
2. 任务系统：SRS 间隔复习与错题回放
3. 评测系统：口语发音评分与 CEFR 维度报告
4. 多渠道接入：Telegram/WhatsApp/Slack


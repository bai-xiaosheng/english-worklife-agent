# English Worklife Agent

面向“国外工作与生活”场景的英语学习智能体。  
用户可以通过文字和语音进行角色扮演练习，获得即时纠错、表达优化和学习进度跟踪。

## MVP 目标

- 支持移动端 Web/PWA 使用
- 支持文本对话与语音输入输出
- 支持场景化角色扮演（职场 + 生活）
- 支持混合纠错（对话中轻纠错 + 对话后总结）
- 支持基础学习轨迹统计（练习次数、错误类型、分数变化）

## 快速启动

```bash
npm install
cp .env.example .env
npm run dev
```

浏览器访问 `http://localhost:3000`。

## 环境变量

- `PORT`: 服务端口，默认 `3000`
- `OPENAI_API_KEY`: 可选，配置后会使用大模型生成更自然对话
- `OPENAI_MODEL`: 可选，默认 `gpt-4.1-mini`
- `DEFAULT_LEVEL`: 默认英语级别，默认 `A2`

## 项目结构

```text
docs/
  01-product-requirements.md
  02-system-architecture.md
  03-milestones.md
public/
  index.html
  app.js
  styles.css
  sw.js
  manifest.webmanifest
src/
  server.js
  config.js
  data/
  services/
  utils/
tests/
  feedbackService.test.js
```

## API 概览

- `GET /api/health`: 健康检查
- `GET /api/v1/scenarios`: 获取练习场景
- `POST /api/v1/session/init`: 初始化用户会话
- `POST /api/v1/chat`: 发送用户输入并获取智能体回复 + 纠错
- `GET /api/v1/progress/:userId`: 获取学习进度
- `POST /api/v1/progress/record`: 手动记录练习数据

## 说明

1. MVP 默认使用内存存储，重启服务后进度会重置。
2. 前端语音基于浏览器 Web Speech API，不同浏览器支持度不同，推荐手机 Chrome 或 Edge。
3. 若未配置 `OPENAI_API_KEY`，服务会自动使用本地回退策略生成对话。


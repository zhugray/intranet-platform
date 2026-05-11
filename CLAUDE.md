# 企业内部知识管理平台 · CLAUDE.md

> 这是 Claude Code 的项目上下文文件。每次开始新任务时请先阅读本文件全文。

---

## 项目概述

**项目名称**：企业内部知识管理平台 (Company Intranet Knowledge Platform)
**技术架构**：Monorepo，前后端分离
**核心功能**：员工门户 + 分部门内容管理后台 + RAG 智能知识问答

---

## Monorepo 目录结构

```
intranet-platform/
├── CLAUDE.md                  ← 本文件（Claude Code 项目说明）
├── docker-compose.yml         ← 本地开发一键启动
├── .env.example               ← 环境变量模板
│
├── apps/
│   ├── web/                   ← 前台：员工门户 (Next.js 14 App Router)
│   └── admin/                 ← 后台：管理上传平台 (Next.js 14 App Router)
│
├── packages/
│   ├── api/                   ← 后端 API 服务 (NestJS)
│   ├── ai-engine/             ← AI 知识引擎 (Python FastAPI + LangChain)
│   ├── ui/                    ← 共享 UI 组件库
│   └── types/                 ← 共享 TypeScript 类型定义
│
└── infra/
    ├── nginx/                 ← 反向代理配置
    └── scripts/               ← 初始化、迁移脚本
```

---

## 技术栈总览

| 层级 | 技术选型 |
|------|---------|
| 前台/后台前端 | Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui |
| 状态管理 | Zustand + React Query (TanStack Query v5) |
| 后端 API | NestJS (Node.js), TypeScript, Prisma ORM |
| AI 引擎 | Python 3.11, FastAPI, LangChain, LlamaIndex |
| 关系数据库 | PostgreSQL 16 |
| 向量数据库 | Qdrant |
| 缓存/队列 | Redis 7 (BullMQ 消息队列) |
| 对象存储 | MinIO (本地开发) / 阿里云 OSS (生产) |
| 邮件服务 | Nodemailer + SMTP / SendGrid |
| 认证 | JWT (Access Token 15min + Refresh Token 7d) |
| 容器化 | Docker + Docker Compose |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) |
| Embedding | text-embedding-3-small (OpenAI) 或 BGE-M3 (本地) |

---

## 核心业务模块

### 1. 认证模块 (Auth)
- 仅允许企业域名邮箱注册（域名可在 `.env` 配置）
- 注册流程：填写邮箱 → 发送 6 位 OTP（5 分钟有效，存 Redis）→ 验证 OTP → 设置密码
- 登录：邮箱 + 密码 → 返回 JWT AccessToken + RefreshToken（HttpOnly Cookie）
- 忘记密码：邮箱 OTP 验证 → 重置密码
- 密码规则：最少 8 位，至少含 1 大写 + 1 数字

### 2. RBAC 权限模块
角色层级（从低到高）：
- `EMPLOYEE`：普通员工，只读访问前台所有内容，可使用 AI 问答
- `DEPT_EDITOR`：部门编辑，可在本部门上传/编辑/删除文档
- `DEPT_ADMIN`：部门管理员，审核本部门文档，管理部门成员权限
- `SUPER_ADMIN`：超级管理员，全平台所有权限

### 3. 前台模块 (apps/web)
页面路由：
- `/` → 首页（公告轮播 + 快捷入口）
- `/login` → 登录页
- `/register` → 注册页（邮箱 OTP 流程）
- `/policies` → 制度查询（可按分类筛选）
- `/org` → 组织架构（树状图展示）
- `/notices` → 活动通知（列表 + 详情）
- `/library` → 图书馆（文档浏览）
- `/knowledge` → 知识库 + AI 问答（核心页面）
- `/profile` → 个人设置

### 4. 后台模块 (apps/admin)
页面路由：
- `/admin/login` → 管理员登录
- `/admin/dashboard` → 数据看板
- `/admin/departments` → 部门管理
- `/admin/[deptId]/upload` → 文档上传
- `/admin/[deptId]/docs` → 部门文档列表（含审核状态）
- `/admin/[deptId]/review` → 审核队列（DEPT_ADMIN 以上）
- `/admin/notices` → 通知发布管理
- `/admin/org` → 组织架构编辑
- `/admin/users` → 用户管理（SUPER_ADMIN）

### 5. AI 知识引擎 (packages/ai-engine)
RAG 流程：
1. **文档处理**：上传文件 → 格式解析（PDF/DOCX/TXT）→ 文本清洗 → 按 512 token 切片（重叠 64）
2. **向量化**：调用 Embedding API → 生成向量 → 存入 Qdrant（含元数据：doc_id, dept_id, chunk_index）
3. **检索**：用户提问 → Query Embedding → Qdrant 语义搜索 TopK=10 → BM25 关键词补充 → Rerank 取 Top5
4. **生成**：组装 System Prompt + 检索到的 5 个 Chunk → 调用 Claude API → 返回回答 + 引用来源列表
5. **权限过滤**：检索时按 dept_id 过滤，员工只能查到其有权限部门的文档

---

## 数据库 Schema（Prisma）

```prisma
// packages/api/prisma/schema.prisma

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  role         Role     @default(EMPLOYEE)
  deptId       String?
  department   Department? @relation(fields: [deptId], references: [id])
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Role {
  EMPLOYEE
  DEPT_EDITOR
  DEPT_ADMIN
  SUPER_ADMIN
}

model Department {
  id          String     @id @default(cuid())
  name        String
  parentId    String?
  parent      Department?  @relation("DeptTree", fields: [parentId], references: [id])
  children    Department[] @relation("DeptTree")
  users       User[]
  documents   Document[]
  order       Int        @default(0)
  createdAt   DateTime   @default(now())
}

model Document {
  id           String         @id @default(cuid())
  title        String
  description  String?
  fileUrl      String         // OSS/MinIO 存储路径
  fileType     String         // pdf | docx | txt | xlsx
  fileSize     Int
  category     DocCategory
  status       DocStatus      @default(PENDING)
  deptId       String
  department   Department     @relation(fields: [deptId], references: [id])
  uploadedById String
  reviewedById String?
  tags         String[]
  vectorized   Boolean        @default(false)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

enum DocCategory {
  POLICY        // 制度政策
  PROCEDURE     // 流程规范
  ANNOUNCEMENT  // 通知公告
  KNOWLEDGE     // 知识资料
  LIBRARY       // 图书馆
}

enum DocStatus {
  PENDING       // 待审核
  APPROVED      // 已审核
  REJECTED      // 已拒绝
  ARCHIVED      // 已归档
}

model Notice {
  id          String   @id @default(cuid())
  title       String
  content     String   @db.Text
  authorId    String
  pinned      Boolean  @default(false)
  publishedAt DateTime @default(now())
  expiresAt   DateTime?
}

model OtpCode {
  id        String   @id @default(cuid())
  email     String
  code      String
  purpose   String   // register | reset_password
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model ChatHistory {
  id        String   @id @default(cuid())
  userId    String
  question  String   @db.Text
  answer    String   @db.Text
  sources   Json     // 引用的文档列表
  createdAt DateTime @default(now())
}
```

---

## API 接口规范

**Base URL**：`/api/v1`
**认证**：Bearer Token（AccessToken）放 Authorization Header
**响应格式**：
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2026-05-09T10:00:00Z"
}
```

### 核心接口列表

```
# Auth
POST   /api/v1/auth/send-otp          发送验证码 { email, purpose }
POST   /api/v1/auth/verify-otp        验证 OTP { email, code, purpose }
POST   /api/v1/auth/register          注册 { email, code, password, name }
POST   /api/v1/auth/login             登录 { email, password }
POST   /api/v1/auth/refresh           刷新 Token
POST   /api/v1/auth/logout            登出
POST   /api/v1/auth/forgot-password   发重置 OTP
POST   /api/v1/auth/reset-password    重置密码

# 用户
GET    /api/v1/users/me               当前用户信息
PATCH  /api/v1/users/me               更新个人信息
GET    /api/v1/users                  用户列表（SUPER_ADMIN）

# 部门
GET    /api/v1/departments            部门树
POST   /api/v1/departments            创建部门（SUPER_ADMIN）
PATCH  /api/v1/departments/:id        编辑部门
DELETE /api/v1/departments/:id        删除部门

# 文档
GET    /api/v1/documents              文档列表（支持 ?category=&deptId=&status=&q=）
POST   /api/v1/documents              上传文档（multipart/form-data）
GET    /api/v1/documents/:id          文档详情
PATCH  /api/v1/documents/:id/review   审核文档 { status: APPROVED | REJECTED }
DELETE /api/v1/documents/:id          删除文档

# 通知
GET    /api/v1/notices                通知列表
POST   /api/v1/notices                发布通知（SUPER_ADMIN）
GET    /api/v1/notices/:id            通知详情

# AI 问答
POST   /api/v1/ai/chat                提问 { question, sessionId? }
GET    /api/v1/ai/history             历史对话记录
```

---

## 环境变量说明

```bash
# .env （参考 .env.example）

# 应用
NODE_ENV=development
APP_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
API_URL=http://localhost:4000
AI_ENGINE_URL=http://localhost:8000

# 数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/intranet
REDIS_URL=redis://localhost:6379

# 对象存储 (MinIO)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=intranet-docs

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 邮件
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@company.com
SMTP_PASS=your-smtp-password
EMAIL_FROM="企业内网 <noreply@company.com>"

# 企业邮箱域名白名单（逗号分隔）
ALLOWED_EMAIL_DOMAINS=company.com,corp.company.com

# AI
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key   # 用于 Embedding
AI_MODEL=claude-sonnet-4-20250514
EMBEDDING_MODEL=text-embedding-3-small

# 向量数据库
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=intranet_docs
```

---

## 开发规范

### 代码风格
- TypeScript 严格模式（`strict: true`）
- ESLint + Prettier，提交前自动格式化
- 组件命名：PascalCase；工具函数：camelCase；常量：UPPER_SNAKE_CASE
- API 路由用 kebab-case；数据库字段用 snake_case（Prisma 映射）

### Git 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 重构
style: 样式调整
test: 测试
chore: 构建/依赖
```

### 错误处理
- API 统一通过 NestJS 全局 ExceptionFilter 处理
- 前端用 React Query 的 `onError` + Toast 提示
- AI 引擎错误：降级返回"暂时无法回答，请稍后重试"

### 安全要求
- 所有 API 必须经过 JwtAuthGuard + RolesGuard
- 文件上传：限制类型（pdf/docx/txt/xlsx）、大小（≤50MB）
- OTP：Redis 存储，5 分钟 TTL，同邮件 1 分钟内不重复发送
- 密码：bcrypt salt rounds = 12
- SQL：全部通过 Prisma，禁止原生 SQL 拼接

---

## 本地开发启动

```bash
# 1. 复制环境变量
cp .env.example .env
# 编辑 .env 填写必要配置

# 2. 启动基础设施
docker-compose up -d postgres redis minio qdrant

# 3. 初始化数据库
cd packages/api && npx prisma migrate dev && npx prisma db seed

# 4. 启动所有服务
# 终端 1：后端 API
cd packages/api && npm run start:dev

# 终端 2：AI 引擎
cd packages/ai-engine && uvicorn main:app --reload --port 8000

# 终端 3：前台
cd apps/web && npm run dev

# 终端 4：后台
cd apps/admin && npm run dev -- -p 3001
```

访问地址：
- 员工前台：http://localhost:3000
- 管理后台：http://localhost:3001
- API 文档：http://localhost:4000/api/docs（Swagger）
- AI 引擎：http://localhost:8000/docs
- MinIO 控制台：http://localhost:9001

---

## 当前开发优先级

按以下顺序实现，每完成一个模块请更新此列表：

- [ ] **P0** `packages/api` - Auth 模块（OTP + 注册 + 登录）
- [ ] **P0** `packages/api` - User / Department / Document CRUD
- [ ] **P0** `apps/web` - 登录/注册页面
- [ ] **P1** `apps/web` - 制度/通知/组织架构/图书馆页面
- [ ] **P1** `apps/admin` - 后台上传 + 审核流程
- [ ] **P2** `packages/ai-engine` - 文档处理 + 向量化管线
- [ ] **P2** `packages/ai-engine` - RAG 检索 + Claude API 集成
- [ ] **P2** `apps/web` - AI 知识问答页面
- [ ] **P3** 安全加固、性能优化、监控接入

---

## 注意事项

1. AI 引擎（Python）和 API 服务（Node.js）通过 HTTP 内部通信，不直接共享数据库连接
2. 文档审核通过后，后台自动触发向量化任务（通过 Redis BullMQ 队列）
3. 向量化失败不影响文档正常显示，只影响 AI 问答中的可检索性
4. 生产环境 MinIO 替换为阿里云 OSS，修改 `packages/api/src/storage/storage.service.ts` 的 provider 即可
5. 支持私有化部署，所有服务均可在内网运行，无需公网访问

# Cloudflare 部署步骤

本文档说明如何把 CapyMeet 部署到 Cloudflare，并配置 D1 数据库、管理员账号、预订链接、Pad 设备和可选邮件通知。

## 1. 前置准备

需要准备：

- 一个 Cloudflare 账号。
- 本机已安装 Node.js 和 npm。
- 项目依赖已安装：

```bash
npm install
```

登录 Cloudflare：

```bash
npx wrangler login
```

确认本地测试和构建可用：

```bash
npm test
npm run build
```

## 2. 创建 Cloudflare D1 数据库

创建生产数据库：

```bash
npx wrangler d1 create capymeet
```

命令会输出类似：

```text
[[d1_databases]]
binding = "DB"
database_name = "capymeet"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

复制示例配置文件，并把输出中的 `database_id` 填入本地 `wrangler.toml`：

```bash
cp wrangler.example.toml wrangler.toml
```

```toml
[[d1_databases]]
binding = "DB"
database_name = "capymeet"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

`wrangler.toml` 会包含真实环境配置，不应提交到 Git；仓库中只保留 `wrangler.example.toml`。

本地迁移测试：

```bash
npm run db:migrate:local
```

应用远程 D1 迁移：

```bash
npm run db:migrate:remote
```

## 3. 创建 Cloudflare Pages 项目

先构建前端：

```bash
npm run build
```

创建并部署 Pages 项目：

```bash
npx wrangler pages project create capymeet --production-branch=main
npx wrangler pages deploy dist --project-name capymeet
```

部署后，Cloudflare 会返回一个 Pages 访问地址，例如：

```text
https://your-project.pages.dev
```

这个地址后面会作为 `PUBLIC_BASE_URL`。

## 4. 配置环境变量和密钥

系统需要以下配置：

- `JWT_SECRET`：管理员登录令牌密钥，至少 32 个字符。
- `PUBLIC_BASE_URL`：部署后的访问地址。
- `EMAIL_API_KEY`：可选，邮件服务 API Key。
- `EMAIL_FROM`：可选，发件人地址。

生成一个 `JWT_SECRET` 示例：

```bash
openssl rand -base64 48
```

示例值：

```text
JWT_SECRET=<generated-jwt-secret>
PUBLIC_BASE_URL=https://your-project.pages.dev
```

推荐在 Cloudflare Dashboard 中配置：

1. 打开 Cloudflare Dashboard。
2. 进入 Workers & Pages。
3. 选择 `capymeet` Pages 项目。
4. 进入 Settings。
5. 找到 Environment variables。
6. 添加 Production 变量。

也可以用 Wrangler 配置 secret：

```bash
npx wrangler pages secret put JWT_SECRET --project-name capymeet
npx wrangler pages secret put EMAIL_API_KEY --project-name capymeet
```

`PUBLIC_BASE_URL` 和 `EMAIL_FROM` 不是强敏感值，可以在 Dashboard 的普通环境变量里配置。

配置完成后重新部署：

```bash
npm run build
npx wrangler pages deploy dist --project-name capymeet
```

## 5. 配置 D1 绑定

确认 `wrangler.toml` 中 D1 binding 名称是：

```toml
binding = "DB"
```

代码里使用的也是 `DB`，不要改成其他名称，除非同步修改代码。

如果使用 Cloudflare Dashboard 配置 Pages D1 绑定：

1. 进入 Pages 项目。
2. 打开 Settings。
3. 进入 Functions。
4. 找到 D1 database bindings。
5. 添加 binding：
   - Variable name: `DB`
   - D1 database: `capymeet`

## 6. 初始化管理员账号

当前版本没有内置管理员创建页面，需要先手动写入一个管理员账号。

生成密码 hash：

```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.argv[1], 12));" "<temporary-admin-password>"
```

输出示例：

```text
$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

把 hash 写入远程 D1：

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO admins (id, email, name, password_hash, is_enabled, created_at, updated_at)
VALUES (
  'admin-1',
  'admin@your-domain.example',
  'Admin',
  '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  1,
  datetime('now'),
  datetime('now')
);
"
```

之后可访问：

```text
https://your-project.pages.dev/admin/login
```

使用：

```text
邮箱：admin@your-domain.example
密码：<temporary-admin-password>
```

生产环境请换成强密码。

## 7. 初始化会议室

插入一个会议室示例：

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO rooms (
  id,
  name,
  location,
  capacity,
  equipment_notes,
  is_enabled,
  opening_hours,
  min_duration_minutes,
  max_duration_minutes,
  max_advance_days,
  requires_approval,
  created_at,
  updated_at
) VALUES (
  'room-1',
  '大会议室',
  '2F',
  12,
  '电视、白板、视频会议设备',
  1,
  '{\"days\":[1,2,3,4,5],\"start\":\"09:00\",\"end\":\"18:00\"}',
  30,
  240,
  30,
  0,
  datetime('now'),
  datetime('now')
);
"
```

字段说明：

- `requires_approval = 0`：预订自动确认。
- `requires_approval = 1`：预订进入待审核，并占用时段。
- `min_duration_minutes` / `max_duration_minutes`：最短和最长会议时长。

## 8. 初始化 Pad 设备

为门口 Pad 创建设备码：

```bash
npx wrangler d1 execute capymeet --remote --command "
INSERT INTO devices (
  id,
  device_code,
  name,
  default_room_id,
  is_enabled,
  created_at,
  updated_at
) VALUES (
  'device-1',
  'PAD-ROOM-1',
  '大会议室门口 Pad',
  'room-1',
  1,
  datetime('now'),
  datetime('now')
);
"
```

Pad 访问地址：

```text
https://your-project.pages.dev/pad/PAD-ROOM-1
```

## 9. 创建预订链接和二维码

管理员登录后访问：

```text
https://your-project.pages.dev/admin/links
```

点击 `Create global link` 创建全局预订链接。

也可以直接调用 API 创建：

```bash
curl -X POST "https://your-project.pages.dev/api/admin/links" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"global"}'
```

返回示例：

```json
{
  "id": "link-id",
  "token": "abc123",
  "url": "https://your-project.pages.dev/book/abc123",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

## 10. 邮件 API Key 从哪里获得

当前代码默认使用 Resend：

```ts
fetch("https://api.resend.com/emails", ...)
```

因此不改代码时，推荐使用 Resend。

### 10.1 Resend

平台：

```text
https://resend.com
```

获取步骤：

1. 注册并登录 Resend。
2. 进入 Domains。
3. 添加你的发信域名，例如 `example.com`。
4. 按 Resend 提示在 DNS 中添加 SPF / DKIM / 验证记录。
5. 域名验证通过后，进入 API Keys。
6. 点击 Create API Key。
7. 复制以 `re_` 开头的 key。

Cloudflare 环境变量示例：

```text
EMAIL_API_KEY=<resend-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

注意：

- `EMAIL_FROM` 的域名必须是 Resend 已验证域名。
- 如果只用 Resend 测试域名，收件人可能有限制。

### 10.2 SendGrid

平台：

```text
https://sendgrid.com
```

获取位置：

```text
Settings -> API Keys -> Create API Key
```

示例：

```text
EMAIL_API_KEY=<sendgrid-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

注意：当前代码不是 SendGrid API 格式。如果要用 SendGrid，需要把 `src/server/services/emailService.ts` 中的接口地址和请求体改成 SendGrid 的 `https://api.sendgrid.com/v3/mail/send` 格式。

### 10.3 Mailgun

平台：

```text
https://www.mailgun.com
```

获取位置：

```text
Sending -> Domains -> 选择域名 -> API Keys / SMTP credentials
```

示例：

```text
EMAIL_API_KEY=<mailgun-api-key>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

注意：当前代码不是 Mailgun API 格式，需要改 `emailService.ts`。

### 10.4 Postmark

平台：

```text
https://postmarkapp.com
```

获取位置：

```text
Servers -> 选择 Server -> API Tokens
```

示例：

```text
EMAIL_API_KEY=<postmark-server-token>
EMAIL_FROM=Meeting Rooms <noreply@example.com>
```

注意：当前代码不是 Postmark API 格式，需要改 `emailService.ts`。

### 10.5 Cloudflare Email Routing

Cloudflare Email Routing 主要用于接收邮件并转发到你的邮箱，不是本项目当前代码可直接使用的事务邮件发送服务。

如果你想完全使用 Cloudflare 生态发送邮件，需要另行接入 Cloudflare Workers 支持的邮件发送方案或第三方 API。

## 11. 完整部署检查清单

部署前确认：

- `npm test` 通过。
- `npm run build` 通过。
- 本地 `wrangler.toml` 里 D1 `database_id` 已替换，且没有提交到 Git。
- 已执行 `npm run db:migrate:remote`。
- Pages 项目已绑定 D1，binding 名称为 `DB`。
- 已配置 `JWT_SECRET`，长度至少 32 个字符。
- 已配置 `PUBLIC_BASE_URL`。
- 如需邮件，已配置 `EMAIL_API_KEY` 和 `EMAIL_FROM`。
- 已手动初始化至少一个管理员账号。
- 已手动初始化至少一个会议室。
- 如使用 Pad，已手动初始化对应设备码。

## 12. 常见部署问题

### 登录后台提示服务器配置错误

通常是 `JWT_SECRET` 未配置，或长度少于 32 个字符。

### 预订链接生成失败

检查 `PUBLIC_BASE_URL` 是否配置。该值用于生成 `/book/<token>` 链接和二维码。

### 页面能打开，但 API 报错

检查 Pages Functions 是否启用，并确认 `functions/api/[[path]].ts` 已随项目部署。

### API 访问 D1 失败

检查 D1 binding：

- binding 名称必须是 `DB`。
- Pages 项目必须绑定正确的 D1 数据库。
- 远程 migration 必须已执行。

### 邮件不发送

按顺序检查：

1. 用户预订时是否填写邮箱。
2. 是否配置 `EMAIL_API_KEY`。
3. 是否配置 `EMAIL_FROM`。
4. Resend 域名是否已验证。
5. `EMAIL_FROM` 是否使用已验证域名。

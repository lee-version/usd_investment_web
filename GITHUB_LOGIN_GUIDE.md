# GitHub 登录集成指南（Supabase）

## 📋 目录
- [第一步：在 GitHub 创建 OAuth App](#第一步在-github-创建-oauth-app)
- [第二步：在 Supabase 启用 GitHub Provider](#第二步在-supabase-启用-github-provider)
- [第三步：配置站点 URL](#第三步配置站点-url)
- [第四步：执行数据库初始化 SQL](#第四步执行数据库初始化-sql)
- [第五步：配置环境变量](#第五步配置环境变量)
- [第六步：测试登录流程](#第六步测试登录流程)

---

## 第一步：在 GitHub 创建 OAuth App

### 1.1 访问 GitHub Developer Settings
1. 打开浏览器访问：https://github.com/settings/developers
2. 点击 **"New OAuth App"** 按钮

### 1.2 填写 OAuth App 信息

| 字段 | 值 | 说明 |
|------|-----|------|
| **Application name** | `USD Revenue Tracker` | 应用名称，可自定义 |
| **Homepage URL** | `https://lee-version.github.io/usd_investment_web` | GitHub Pages 生产地址 |
| **Application description** | `美元理财收益追踪系统` | 可选描述 |
| **Authorization callback URL** | `https://lee-version.github.io/usd_investment_web/auth/callback` | ⚠️ **重要：必须与 Supabase 一致** |

### 1.3 获取 Client ID 和 Client Secret
1. 创建成功后，复制 **Client ID**
2. 点击 **"Generate a new client secret"** 生成密钥
3. **立即保存** Client Secret（只显示一次！）

> 💡 **提示**：将这两个值记录下来，后续配置 Supabase 时需要用到

---

## 第二步：在 Supabase 启用 GitHub Provider

### 2.1 创建 Supabase 项目
1. 访问 https://supabase.com
2. 登录/注册账号
3. 点击 **"New Project"** 创建新项目
4. 填写项目信息：
   - **Name**: `usd-tracker`
   - **Database Password**: 设置强密码（记住它！）
   - **Region**: 选择离你最近的区域（推荐 Northeast Asia (Tokyo)）
5. 点击 **"Create new project"**（等待 2 分钟初始化完成）

### 2.2 配置 GitHub 认证
1. 进入项目后，点击左侧菜单 **Authentication** → **Providers**
2. 找到 **GitHub** provider，点击展开
3. 开启 **Enable toggle switch**
4. 填写从 GitHub 获取的凭证：
   ```
   Client ID: [你的GitHub Client ID]
   Client Secret: [你的GitHub Client Secret]
   ```
5. 点击 **Save**

### 2.3 配置 Site URL 和 Redirect URLs
1. 在同一页面，找到 **URL Configuration** 部分
2. 设置：
   ```
   Site URL: https://lee-version.github.io/usd_investment_web
   
   Redirect URLs (添加以下两个):
   - https://lee-version.github.io/usd_investment_web
   - https://lee-version.github.io/usd_investment_web/auth/callback
   ```
3. 点击 **Save**

> ⚠️ **重要**：Redirect URLs 必须包含完整路径，否则登录后会报错！

---

## 第三步：配置站点 URL

### 3.1 获取 Supabase API 密钥
1. 在 Supabase 项目中，点击 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: （保密，不要泄露到前端）

### 3.2 验证连接
确保你的 Supabase 项目状态为 **Active**（不是 Paused）

---

## 第四步：执行数据库初始化 SQL

### 4.1 打开 Supabase SQL Editor
1. 在 Supabase 项目中，点击左侧菜单 **SQL Editor**
2. 点击 **New Query**

### 4.2 执行初始化脚本
复制文件 [`init-supabase.sql`](./init-supabase.sql) 的内容粘贴到编辑器中
点击 **Run** 执行

该脚本会创建：
- ✅ `users` 表（存储用户信息）
- ✅ `profiles` 表（用户扩展资料）
- ✅ Row Level Security (RLS) 策略
- ✅ 必要的索引

---

## 第五步：配置环境变量

### 5.1 创建 `.env` 文件
在项目根目录创建 `.env` 文件：

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Server Configuration
PORT=3000
NODE_ENV=production

# Site Configuration (GitHub Pages)
SITE_URL=https://lee-version.github.io/usd_investment_web

# Database (如果继续使用 MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=usd_invest
```

### 5.2 安装依赖
```bash
npm install @supabase/supabase-js dotenv
```

---

## 第六步：测试登录流程

### 6.1 部署到 GitHub Pages
由于使用 GitHub Pages，需要将静态文件部署：

```bash
# 方式一：手动部署（推荐用于静态前端）
git add .
git commit -m "Add GitHub login feature"
git push origin main

# 然后在 GitHub 仓库设置中启用 Pages：
# Settings → Pages → Source 选择 main 分支 → Save
```

### 6.2 测试步骤
1. 打开浏览器访问 https://lee-version.github.io/usd_investment_web
2. 点击页面右上角的 **"GitHub 登录"** 按钮
3. 跳转到 GitHub 授权页面
4. 点击 **Authorize application**
5. 自动跳转回应用并显示登录成功

### 6.3 验证功能
- ✅ 用户头像和用户名显示正确
- ✅ 刷新页面后保持登录状态
- ✅ 可以正常登出
- ✅ API 请求携带认证 token

---

## 🎯 下一步操作

完成以上步骤后，项目已具备完整的 GitHub 登录功能！

### 可选优化：
- [x] ✅ 已配置为 GitHub Pages 生产环境地址
- [ ] 添加更多 OAuth 提供商（Google、微信等）
- [ ] 实现权限控制（管理员/普通用户）
- [ ] 添加邮箱验证功能
- [ ] 配置自定义域名

---

## ❓ 常见问题

### Q1: 登录后跳转回来报错 "Invalid callback URL"
**A**: 检查 Supabase 的 Redirect URLs 是否包含 `https://lee-version.github.io/usd_investment_web/auth/callback`

### Q2: GitHub 授权页面显示 "App not found"
**A**: 检查 GitHub OAuth App 的 Authorization callback URL 是否为 `https://lee-version.github.io/usd_investment_web/auth/callback`

### Q3: Supabase 项目显示 "Paused"
**A**: 免费版项目 7 天不使用会自动暂停，去 Dashboard 点击 Resume 即可

### Q4: 如何获取新的 Client Secret？
**A**: GitHub Settings → Developer settings → OAuth Apps → 你的应用 → Regenerate secret

### Q5: GitHub Pages 部署后无法访问 API？
**A**: GitHub Pages 只能托管静态文件。如果你的应用需要 Node.js 后端 API，你需要：
- **方案 A**：使用 Supabase Edge Functions 或 Cloudflare Workers 作为 BFF 层
- **方案 B**：将后端部署到 Railway/Render/Vercel 等平台
- **方案 C**：完全使用 Supabase 的客户端 SDK（推荐，无需自建后端）

---

## 🔗 有用链接

- [GitHub OAuth 文档](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app)
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Supabase GitHub Provider](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [GitHub Pages 文档](https://pages.github.com/)

---

**最后更新**: 2026-05-21  
**适用版本**: v2.0.0+ (支持 Supabase Auth)  
**部署环境**: GitHub Pages (Production)

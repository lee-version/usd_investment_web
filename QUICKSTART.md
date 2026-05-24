# 🚀 快速开始指南 - GitHub 登录集成

## ✅ 已完成的工作

我已经为你的项目完整集成了 **GitHub 登录功能（基于 Supabase）**！

### 📦 新增文件：
- ✅ `GITHUB_LOGIN_GUIDE.md` - 详细的配置指南文档
- ✅ `init-supabase.sql` - Supabase 数据库初始化脚本
- ✅ `supabase.js` - Supabase 客户端配置
- ✅ `auth.js` - 后端认证中间件
- ✅ `js/auth.js` - 前端认证管理器
- ✅ `.env.example` / `.env` - 环境变量配置

### 🔧 修改的文件：
- ✅ `server.js` - 添加了 6 个认证 API 端点
- ✅ `index.html` - 添加了登录/用户信息组件
- ✅ `css/style.css` - 添加了认证 UI 样式
- ✅ `package.json` - 添加了 supabase 和 dotenv 依赖

---

## 🌐 部署环境：GitHub Pages

**生产地址**: https://lee-version.github.io/usd_investment_web

---

## 📋 接下来你需要做的步骤：

### 第一步：配置 GitHub OAuth App（5 分钟）

1. 访问 https://github.com/settings/developers
2. 点击 **"New OAuth App"**
3. 填写信息：
   ```
   Application name: USD Revenue Tracker
   Homepage URL: https://lee-version.github.io/usd_investment_web
   Authorization callback URL: https://lee-version.github.io/usd_investment_web/auth/callback
   ```
4. 复制 **Client ID** 和 **Client Secret**

### 第二步：创建 Supabase 项目（3 分钟）

1. 访问 https://supabase.com 并登录
2. 创建新项目（选择免费版即可）
3. 进入 **Authentication** → **Providers**
4. 启用 **GitHub** 并填入 Client ID 和 Secret
5. 在 **URL Configuration** 中添加：
   ```
   Site URL: https://lee-version.github.io/usd_investment_web
   Redirect URLs:
   - https://lee-version.github.io/usd_investment_web
   - https://lee-version.github.io/usd_investment_web/auth/callback
   ```

### 第三步：执行数据库初始化（2 分钟）

1. 在 Supabase 项目中打开 **SQL Editor**
2. 复制 [`init-supabase.sql`](./init-supabase.sql) 的全部内容
3. 点击 **Run** 执行

### 第四步：获取 Supabase API 密钥（1 分钟）

1. 进入 **Settings** → **API**
2. 复制以下两个值：
   - **URL**: `https://xxxxx.supabase.co`
   - **anon (public) key**: 以 `eyJ...` 开头的长字符串

### 第五步：配置环境变量（1 分钟）

编辑项目根目录的 [`.env`](./.env) 文件：

```env
# 替换这两行！
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# 改成你实际的值
SUPABASE_URL=https://abcdefg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxx...

# 站点地址（已自动设置为 GitHub Pages）
SITE_URL=https://lee-version.github.io/usd_investment_web
```

### 第六步：部署到 GitHub Pages（2 分钟）

由于使用 GitHub Pages，需要将代码推送到 GitHub：

```bash
# 初始化 Git 仓库（如果还没有）
git init
git add .
git commit -m "Add GitHub login with Supabase auth"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/lee-version/usd_investment_web.git
git push -u origin main
```

然后在 GitHub 仓库中启用 Pages：
1. 打开仓库页面
2. 点击 **Settings** → 左侧菜单 **Pages**
3. **Source**: 选择 **Deploy from a branch**
4. **Branch**: 选择 **main**，目录选择 **/ (root)**
5. 点击 **Save**

等待 1-2 分钟后，你的应用就可以通过以下地址访问：
```
https://lee-version.github.io/usd_investment_web
```

---

## 🎯 功能特性

### 已实现的认证功能：
- ✅ **GitHub OAuth 登录** - 一键授权登录
- ✅ **会话管理** - 自动保持登录状态（7天）
- ✅ **用户资料显示** - 显示头像和用户名
- ✅ **安全登出** - 清除本地存储和服务端会话
- ✅ **Token 自动刷新** - 使用 Supabase 内置机制
- ✅ **响应式设计** - 移动端适配
- ✅ **错误处理** - 完善的错误提示

### 新增的 API 端点：
```
GET    /api/auth/user      - 获取当前用户信息
GET    /api/auth/github    - GitHub OAuth 登录入口
POST   /api/auth/logout    - 登出
PUT    /api/auth/profile   - 更新用户资料
GET    /auth/callback      - OAuth 回调处理
```

---

## 🔒 安全特性

1. **Row Level Security (RLS)** - 数据库级别的行级权限控制
2. **JWT Token 验证** - 所有 API 请求都经过身份验证
3. **自动 Token 刷新** - 无缝续期，用户体验流畅
4. **HTTPS 支持** - GitHub Pages 强制使用加密连接
5. **CORS 配置** - 跨域请求严格限制

---

## 📚 详细文档

完整的配置说明请查看：[`GITHUB_LOGIN_GUIDE.md`](./GITHUB_LOGIN_GUIDE.md)

包含：
- GitHub OAuth App 创建详细截图说明
- Supabase 配置每一步操作指南
- 常见问题解答 (FAQ)
- 故障排查方法
- 生产环境部署建议

---

## 💡 重要提示：GitHub Pages 部署架构

### ⚠️ 关键说明

**GitHub Pages 只能托管静态文件**（HTML/CSS/JS），无法运行 Node.js 后端服务器。

因此，当前的实现有两种方案可选：

#### 方案 A：纯前端 + Supabase（推荐✨）

**优点**：
- ✅ 免费托管在 GitHub Pages
- ✅ 无需维护服务器
- ✅ 自动 HTTPS 和 CDN
- ✅ Supabase 处理所有后端逻辑

**适用场景**：
- 你的应用主要在前端运行
- 数据库操作都通过 Supabase Client SDK 完成
- 不需要自定义 Node.js API 端点

**如何切换到此方案**：
1. 在前端直接使用 `@supabase/supabase-js` 客户端库
2. 所有数据操作调用 Supabase REST API 或 Client SDK
3. 删除或注释掉 `server.js` 中的 Express 路由
4. 将 MySQL 数据迁移到 Supabase PostgreSQL

#### 方案 B：前后端分离部署

**架构**：
```
前端: GitHub Pages (https://lee-version.github.io/usd_investment_web)
后端: Railway / Render / Vercel (https://your-api.herokuapp.com)
数据库: Supabase PostgreSQL (替换现有 MySQL)
```

**步骤**：
1. 前端部署到 GitHub Pages
2. 后端部署到 Railway/Railway/Vercel（免费套餐）
3. 更新前端的 API 地址指向后端服务
4. 使用 Supabase 替代 MySQL 作为主数据库

---

## 🎨 UI 效果预览

访问 https://lee-version.github.io/usd_investment_web 你会看到：

### 未登录状态：
```
[USD 收益追踪] [购买记录] [收益计算] [计算记录] [数据可视] [🔑 GitHub 登录]
```

### 已登录状态：
```
[USD 收益追踪] [购买记录] [收益计算] [计算记录] [数据可视] [👤 用户名头像 ⏻]
```

---

## 📊 URL 配置清单

确保以下位置都已更新为 GitHub Pages 地址：

| 配置项 | 正确值 | 文件位置 |
|--------|--------|---------|
| GitHub OAuth Homepage | `https://lee-version.github.io/usd_investment_web` | GitHub Developer Settings |
| GitHub OAuth Callback | `https://lee-version.github.io/usd_investment_web/auth/callback` | GitHub Developer Settings |
| Supabase Site URL | `https://lee-version.github.io/usd_investment_web` | Supabase Dashboard |
| Supabase Redirect URLs | `https://lee-version.github.io/usd_investment_web/*` | Supabase Dashboard |
| .env SITE_URL | `https://lee-version.github.io/usd_investment_web` | 项目根目录 |

---

## ❓ 需要帮助？

如果遇到问题：
1. 查看 [`GITHUB_LOGIN_GUIDE.md`](./GITHUB_LOGIN_GUIDE.md) 的 FAQ 部分
2. 检查浏览器控制台是否有错误
3. 确认所有环境变量已正确填写
4. 验证 GitHub Pages 是否成功部署（查看 Actions 日志）

---

## 🔄 本地开发 vs 生产环境

| 环境 | 地址 | 用途 |
|------|------|------|
| **本地开发** | `http://localhost:3000` | 开发调试时使用 |
| **生产环境** | `https://lee-version.github.io/usd_investment_web` | 用户实际访问 |

> 💡 **提示**：如果你需要在本地测试，可以临时改回 localhost:3000，但记得部署前再改回来。

---

## ✨ 可选优化方向

完成基本配置后，你可以考虑：

- [ ] **完全迁移到 Supabase** - 移除 MySQL 依赖，统一使用 Supabase
- [ ] **添加 Google 登录** - 扩展更多 OAuth 提供商
- [ ] **配置自定义域名** - 例如 `usd-tracker.com`
- [ ] **实现管理员权限** - 区分管理员和普通用户
- [ ] **添加邮箱验证** - 增强安全性
- [ ] **集成多语言支持** - i18n 国际化
- [ ] **PWA 支持** - 让应用可离线使用

---

**🎉 恭喜！你的项目现在已配置为 GitHub Pages 生产环境！**

按照上述步骤配置后，就可以在全球范围内访问你的美元理财追踪系统了！🌍

**最后更新**: 2026-05-21  
**部署目标**: GitHub Pages (Production)  
**访问地址**: https://lee-version.github.io/usd_investment_web

# 🚀 GitHub Pages 完整部署指南

> **目标**: 将 USD Revenue Tracker 项目部署到 `https://lee-version.github.io/usd_investment_web`

---

## 📋 目录

1. [前置准备](#1-前置准备)
2. [创建 GitHub 仓库](#2-创建-github-仓库)
3. [配置 GitHub Pages](#3-配置-github-pages)
4. [上传项目文件](#4-上传项目文件)
5. [配置 Supabase](#5-配置-supabase)
6. [数据迁移（可选）](#6-数据迁移可选)
7. [验证部署](#7-验证部署)
8. [常见问题](#8-常见问题)

---

## 1. 前置准备

### ✅ 检查清单
- [ ] 已有 GitHub 账号 (用户名: `lee-version`)
- [ ] 已有 Supabase 项目和 API 密钥
- [ ] 本地项目代码已准备就绪
- [ ] Git 已安装并配置好用户信息

### 🔧 安装 Git（如果未安装）

**Windows:**
```bash
# 下载地址: https://git-scm.com/downloads
# 安装时选择默认选项即可
```

**配置 Git 用户信息:**
```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

---

## 2. 创建 GitHub 仓库

### 步骤 1: 登录 GitHub
1. 打开浏览器访问: https://github.com
2. 使用你的账号登录 (`lee-version`)

### 步骤 2: 创建新仓库
1. 点击右上角 **"+"** 按钮 → 选择 **"New repository"**
2. 填写仓库信息:

| 字段 | 值 | 说明 |
|------|-----|------|
| **Repository name** | `usd_investment_web` | ⚠️ 必须与目标 URL 匹配 |
| **Description** | `USD Investment Tracker - 美元投资收益计算器` | 可选 |
| **Visibility** | ☑️ Public | 公开仓库才能使用免费 Pages |
| **其他选项** | ❌ 全部不勾选 | 不需要 README、.gitignore 等 |

3. 点击 **"Create repository"**

### ✅ 创建成功后
你会看到类似这样的页面:
```
https://github.com/lee-version/usd_investment_web
```

---

## 3. 配置 GitHub Pages

### 方法 A: 使用 Settings 配置（推荐）

1. 进入刚创建的仓库: https://github.com/lee-version/usd_investment_web
2. 点击 **Settings** 标签页（在顶部导航栏）
3. 在左侧菜单找到 **Pages** 选项，点击进入
4. 在 **Source** 部分:
   - 选择 **Deploy from a branch**
   - **Branch**: 选择 `main` (或 `master`)
   - **Folder**: 选择 `/` (root)
5. 点击 **Save**

### 📌 等待部署生效
- 首次配置后，GitHub 需要 1-5 分钟生成站点
- 页面会显示: **"Your site is ready to be published at https://lee-version.github.io/usd_investment_web"**
- 如果显示错误信息，请查看[常见问题](#8-常见问题)部分

---

## 4. 上传项目文件

### 方式一: 使用 Git 命令行（推荐）

#### 4.1 初始化本地 Git 仓库

打开命令提示符或 PowerShell，进入项目目录:

```bash
cd c:\Users\10563\PycharmProjects\自定义项目\财务
```

#### 4.2 初始化 Git 并添加远程仓库

```bash
# 初始化 Git 仓库
git init

# 添加所有文件到暂存区
git add .

# 提交更改
git commit -m "Initial commit: USD Investment Tracker v2.0"

# 添加远程仓库地址
git remote add origin https://github.com/lee-version/usd_investment_web.git

# 推送到 GitHub（首次推送需要设置上游分支）
git push -u origin main
```

⚠️ **如果遇到错误:**
- `error: src refspec main does not match any` → 使用 `git push -u origin master`
- `fatal: remote origin already exists` → 运行 `git remote remove origin` 后重新添加

#### 4.3 输入 GitHub 凭证

当执行 `git push` 时，Git 会要求输入凭证:

**方式 1: 使用 Personal Access Token (推荐)**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → 勾选 `repo` 权限 → 复制 token
3. 用户名填: `lee-version`
4. 密码填: 复制的 token（不是 GitHub 密码！）

**方式 2: 使用 Git Credential Manager**
- 如果你安装了 Git for Windows，会自动弹出登录窗口
- 直接用浏览器登录 GitHub 即可

### 方式二: 使用 GitHub Desktop（图形界面）

1. 下载安装: https://desktop.github.com/
2. 打开 GitHub Desktop → File → Add local repository
3. 选择你的项目文件夹
4. 点击 **Publish repository** → 选择 Public
5. 填写仓库名称: `usd_investment_web`
6. 点击 **Publish repository**

### 方式三: 手动上传（最简单但不够灵活）

1. 打开 https://github.com/lee-version/usd_investment_web
2. 点击 **uploading an existing file** 链接
3. 将整个项目文件夹拖拽到上传区域
4. 勾选 **Commit directly to the main branch**
5. 点击 **Commit changes**

---

## 5. 配置 Supabase

### 5.1 获取 Supabase 凭证

登录 Supabase Dashboard (https://supabase.com/dashboard):

1. 选择你的项目
2. 左侧菜单 → **Settings** → **API**
3. 复制以下信息:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5.2 执行数据库初始化脚本

1. 在 Supabase Dashboard 左侧菜单点击 **SQL Editor**
2. 点击 **New query**
3. 复制 [init-supabase.sql](./init-supabase.sql) 的全部内容粘贴进去
4. 点击 **Run** 执行

✅ 成功后会看到输出: "初始化完成！" 和所有表创建成功的消息

### 5.3 配置前端连接

编辑项目中的 `index.html` 或创建 `config.js` 文件:

```javascript
// 在 <head> 中或在 js/config.js 中添加
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key-here';
```

或者直接修改 [js/storage.js](./js/storage.js) 第 29-30 行的默认值。

---

## 6. 数据迁移（可选）

如果你之前使用 MySQL 存储了数据，可以迁移到 Supabase:

### 6.1 运行迁移脚本

确保 MySQL 服务正在运行，然后执行:

```bash
# 安装依赖（如果尚未安装）
npm install mysql2 pg

# 运行迁移脚本
node migrate-to-supabase.js
```

这会生成以下文件:
- `migration_buy_records.sql`
- `migration_history_records.sql`
- `migration_config.sql`
- `migration_output.sql` (合并后的完整脚本)

### 6.2 导入数据到 Supabase

1. 打开 `migration_output.sql` 文件
2. 复制全部内容
3. 在 Supabase SQL Editor 中新建查询
4. 粘贴并运行

✅ 数据迁移完成！

---

## 7. 验证部署

### 7.1 访问网站

等待 1-5 分钟后，访问:

```
https://lee-version.github.io/usd_investment_web
```

### 7.2 功能检查清单

- [ ] 页面正常加载，无 404 错误
- [ ] 可以正常添加买入记录
- [ ] 可以正常查询汇率并计算收益
- [ ] 数据保存到 localStorage（刷新页面数据仍在）
- [ ] （可选）如果配置了 Supabase，检查浏览器控制台是否有同步日志

### 7.3 测试 localStorage 存储

打开浏览器开发者工具 (F12):
1. 切换到 **Application** 标签
2. 左侧选择 **Local Storage** → 你的域名
3. 应该能看到以 `usd_tracker_` 开头的键值对

### 7.4 测试云同步（如果已配置）

1. 打开浏览器控制台 (F12 → Console)
2. 输入: `window.storageManager.getSyncStatus()`
3. 应该看到类似输出:
```javascript
{
  lastSync: "2026-05-24T...",
  isSyncing: false,
  pendingChanges: false,
  hasSupabase: true,
  localRecordCount: {
    buyRecords: 0,
    historyRecords: 0
  }
}
```

---

## 8. 常见问题

### Q1: 访问网站显示 404 Page not found

**原因:** GitHub Pages 还未完成构建，或分支名称不匹配

**解决方案:**
1. 等待 2-5 分钟后刷新
2. 检查 Settings → Pages 是否正确配置了分支
3. 确保仓库中确实有 `index.html` 文件

### Q2: CSS/JS 文件加载失败（404）

**原因:** 路径使用了绝对路径（如 `/css/style.css`），但在子目录下应为相对路径

**解决方案:**
- 将所有资源引用改为相对路径:
  ```html
  <!-- 错误 -->
  <link rel="stylesheet" href="/css/style.css">
  
  <!-- 正确 -->
  <link rel="stylesheet" href="./css/style.css">
  ```

### Q3: 数据无法保存

**可能原因:**
1. localStorage 被禁用（浏览器隐私模式）
2. 存储空间已满（通常限制 5MB）
3. Supabase 连接失败（检查控制台错误日志）

**解决方案:**
1. 使用普通浏览模式（非隐私模式）
2. 清理不必要的本地存储数据
3. 检查 Supabase URL 和 Key 是否正确

### Q4: 推送代码时提示 "Authentication failed"

**解决方案:**
1. 使用 Personal Access Token 替代密码
2. 或启用两步验证后使用专用密码
3. 或使用 SSH key（更安全但配置复杂）

### Q5: 如何更新网站？

**每次更新流程:**
```bash
cd c:\Users\10563\PycharmProjects\自定义项目\财务

# 查看更改状态
git status

# 添加所有更改
git add .

# 提交更改
git commit -m "更新说明：xxx"

# 推送到 GitHub
git push
```

GitHub Pages 会自动重新部署（通常 1-2 分钟生效）。

### Q6: 如何绑定自定义域名？

1. 在仓库 Settings → Pages → Custom domain
2. 输入域名如: `www.yourdomain.com`
3. 按照提示在 DNS 服务商处添加 CNAME 记录
4. 等待 DNS 生效（最长 48 小时）

---

## 🎯 快速参考卡

### 常用 Git 命令

```bash
# 初始化
git init
git remote add origin https://github.com/lee-version/usd_investment_web.git

# 日常操作
git status          # 查看状态
git add .           # 添加所有更改
git commit -m "msg" # 提交
git push            # 推送

# 强制推送（谨慎使用）
git push -f origin main
```

### 重要链接

| 用途 | 链接 |
|------|------|
| GitHub 仓库 | https://github.com/lee-version/usd_investment_web |
| GitHub Pages | https://lee-version.github.io/usd_investment_web |
| Supabase Dashboard | https://supabase.com/dashboard |

### 项目架构图

```
┌─────────────────────────────────────┐
│     GitHub Pages (静态托管)         │
│     https://lee-version.github.io   │
│     /usd_investment_web             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│     浏览器 (localStorage 主存储)    │
│     - 即时读写                      │
│     - 离线可用                      │
│     - 无需服务器                    │
└──────────────┬──────────────────────┘
               │ (后台异步同步)
               ▼
┌─────────────────────────────────────┐
│     Supabase PostgreSQL (云备份)    │
│     - 数据持久化                    │
│     - 多设备同步                    │
│     - RESTful API                  │
└─────────────────────────────────────┘
```

---

## 📞 技术支持

如果遇到问题：

1. **检查浏览器控制台** (F12 → Console) 查看具体错误
2. **查看 GitHub Actions 日志**: 仓库主页 → Actions 标签
3. **检查 Supabase Logs**: Dashboard → Logs
4. **查阅官方文档**:
   - GitHub Pages: https://docs.github.com/pages
   - Supabase: https://supabase.com/docs

---

## ✅ 部署成功标志

当你看到以下内容时，说明部署完全成功：

✅ 访问 `https://lee-version.github.io/usd_investment_web` 正常显示  
✅ 所有功能正常工作  
✅ 数据能保存到 localStorage  
✅ （可选）Supabase 云同步正常运行  

🎉 **恭喜！你的 USD Investment Tracker 已经上线啦！**

---

**最后更新**: 2026-05-24  
**版本**: v2.0 (localStorage + Supabase 架构)

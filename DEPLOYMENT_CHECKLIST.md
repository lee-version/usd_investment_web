# ✅ GitHub Pages 部署检查清单

> **使用说明**: 按照以下步骤逐一完成，每完成一项打勾 ✓

---

## 📦 第一阶段: 准备工作 (预计 10 分钟)

### 1.1 Git 环境准备
- [ ] 已安装 Git（https://git-scm.com/downloads）
- [ ] 已配置 Git 用户名: `git config --global user.name "你的名字"`
- [ ] 已配置 Git 邮箱: `git config --global user.email "你的邮箱"`
- [ ] 验证安装成功: `git --version`

### 1.2 GitHub 账号确认
- [ ] 可以正常登录 https://github.com
- [ ] 用户名为 `lee-version`（或你实际的用户名）
- [ ] 已准备好 Personal Access Token（用于推送代码）

### 1.3 项目文件检查
- [ ] 项目目录存在: `c:\Users\10563\PycharmProjects\自定义项目\财务`
- [ ] 主文件 `index.html` 存在
- [ ] CSS 文件夹和文件完整
- [ ] JS 文件夹和文件完整
- [ ] `.gitignore` 文件已创建（排除 node_modules 等）

---

## 🔧 第二阶段: 创建仓库 (预计 5 分钟)

### 2.1 在 GitHub 创建仓库
- [ ] 访问 https://github.com/new
- [ ] Repository name 填写: **usd_investment_web**
- [ ] 选择 **Public**（公开仓库）
- [ ] ❌ 不勾选 "Add a README file"
- [ ] ❌ 不勾选 "Add .gitignore"
- [ ] ❌ 不勾选 "Choose a license"
- [ ] 点击 **Create repository**

### 2.2 配置 GitHub Pages
- [ ] 进入仓库 Settings → Pages
- [ ] Source 选择: **Deploy from a branch**
- [ ] Branch 选择: **main** (或 master)
- [ ] Folder 选择: **/ (root)**
- [ ] 点击 **Save**
- [ ] 等待显示站点 URL: https://lee-version.github.io/usd_investment_web

---

## 📤 第三阶段: 上传代码 (预计 15 分钟)

### 3.1 初始化本地 Git
```bash
cd c:\Users\10563\PycharmProjects\自定义项目\财务
```
- [ ] 执行: `git init`
- [ ] 执行: `git add .`
- [ ] 执行: `git commit -m "Initial commit: USD Investment Tracker v2.0"`

### 3.2 连接远程仓库
- [ ] 执行: `git remote add origin https://github.com/lee-version/usd_investment_web.git`
- [ ] 验证远程地址: `git remote -v`

### 3.3 推送代码到 GitHub
- [ ] 执行: `git push -u origin main` （或 `master`）
- [ ] 输入 GitHub 用户名: `lee-version`
- [ ] 输入 Personal Access Token（不是密码！）
- [ ] 推送成功，无错误信息

### 3.4 验证文件上传
- [ ] 访问: https://github.com/lee-version/usd_investment_web
- [ ] 能看到所有项目文件（index.html, css/, js/ 等）
- [ ] 文件大小和内容正确

---

## ☁️ 第四阶段: 配置 Supabase (预计 20 分钟)

### 4.1 获取凭证
- [ ] 登录 Supabase Dashboard: https://supabase.com/dashboard
- [ ] 选择你的项目
- [ ] 进入 Settings → API
- [ ] 复制 **Project URL**
- [ ] 复制 **anon public key**

### 4.2 更新前端配置
- [ ] 编辑文件: `js/config.js`
- [ ] 替换 `SUPABASE_URL` 为你的项目 URL
- [ ] 替换 `SUPABASE_ANON_KEY` 为你的 anon key
- [ ] 保存文件

### 4.3 初始化数据库
- [ ] 打开 Supabase SQL Editor
- [ ] 新建查询
- [ ] 复制 `init-supabase.sql` 全部内容
- [ ] 粘贴并执行
- [ ] 控制台显示: "✅ 初始化完成！"
- [ ] 左侧 Table Viewer 能看到新创建的表:
  - [ ] users
  - [ ] profiles
  - [ ] buy_records
  - [ ] history_records
  - [ ] config

### 4.4 数据迁移（可选，如果有旧数据）
- [ ] MySQL 服务正在运行
- [ ] 安装依赖: `npm install mysql2 pg`
- [ ] 运行迁移: `node migrate-to-supabase.js`
- [ ] 生成了 `migration_output.sql` 文件
- [ ] 在 Supabase SQL Editor 中执行该文件
- [ ] 验证数据已导入（查看表中的记录数）

---

## 🚀 第五阶段: 测试验证 (预计 10 分钟)

### 5.1 访问网站
- [ ] 等待 2-5 分钟（GitHub Pages 构建时间）
- [ ] 访问: https://lee-version.github.io/usd_investment_web
- [ ] 页面正常加载，无 404 错误
- [ ] 样式正常显示（CSS 加载成功）

### 5.2 功能测试
- [ ] **购买记录**: 能添加新的买入记录
- [ ] **收益计算**: 能输入汇率并计算收益
- [ ] **计算记录**: 能看到历史计算结果
- [ ] **数据可视化**: 图表正常渲染

### 5.3 数据持久化测试
- [ ] 添加一条买入记录
- [ ] 刷新页面（F5）
- [ ] 记录仍然存在（localStorage 正常工作）
- [ ] 打开浏览器开发者工具 (F12)
- [ ] Application → Local Storage → 有 `usd_tracker_` 开头的键值对

### 5.4 云同步测试（如果配置了 Supabase）
- [ ] 打开浏览器控制台 (F12 → Console)
- [ ] 输入: `window.storageManager.getSyncStatus()`
- [ ] 返回结果中 `hasSupabase: true`
- [ ] 等待几秒后再次执行，`lastSync` 应有更新时间戳
- [ ] 检查 Supabase Dashboard → Table Viewer → 数据已同步

---

## 🎯 第六阶段: 后续维护

### 6.1 日常更新流程
每次修改代码后:
1. ```bash
   git add .
   git commit -m "更新描述"
   git push
   ```
2. 等待 1-2 分钟自动部署
3. 访问网站验证更新

### 6.2 监控与日志
- [ ] 定期检查 GitHub Pages 是否正常运行
- [ ] 关注 Actions 页面是否有构建失败
- [ ] 查看 Supabase 使用量是否接近免费额度

---

## ⚠️ 常见问题快速排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 页面 404 | 分支未正确配置 | 检查 Settings → Pages |
| CSS/JS 404 | 路径错误 | 改用相对路径 `./css/style.css` |
| 推送认证失败 | 凭证过期 | 使用 Personal Access Token |
| 数据不保存 | localStorage 禁用 | 使用普通浏览模式 |
| Supabase 连接失败 | URL/Key 错误 | 检查 config.js 配置 |

---

## 📊 完成度统计

**当前进度**: 
- 第一阶段: [ ] / 3 项
- 第二阶段: [ ] / 2 项  
- 第三阶段: [ ] / 4 项
- 第四阶段: [ ] / 4 项
- 第五阶段: [ ] / 4 项
- 第六阶段: [ ] / 2 项

**总完成度**: __ / 19 项

---

## 🎉 完成标志

当你看到以下所有内容时，恭喜你部署成功！

✅ 网站 URL 可访问: https://lee-version.github.io/usd_investment_web  
✅ 所有功能正常工作  
✅ 数据能保存到 localStorage  
✅ （可选）Supabase 云同步正常  

🎊 **你的 USD Revenue Tracker 已经上线啦！快分享给朋友们吧！**

---

**提示**: 如果遇到任何问题，请查阅 [GITHUB_PAGES_DEPLOYMENT_GUIDE.md](./GITHUB_PAGES_DEPLOYMENT_GUIDE.md) 获取详细解决方案。

**最后更新**: 2026-05-24

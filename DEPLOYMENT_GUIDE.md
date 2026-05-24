# 🌐 国内访问云端服务 - 完整部署指南

## 📖 文档说明

本文档提供了一套**完整可行**的方案，让项目在国内网络环境下能够正常访问 **Supabase 云端数据库** 和 **GitHub OAuth 登录**。

### 适用场景
- ✅ 项目部署在 GitHub Pages（国内可访问）
- ✅ 使用 Supabase 作为后端数据库
- ✅ 需要 GitHub/邮箱登录功能
- ✅ 国内用户无需 VPN 即可使用

---

## 🎯 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器 (国内)                          │
│              https://lee-version.github.io                   │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS 请求
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Cloudflare Workers (代理层) ⭐                     │
│   📍 全球 CDN 节点（包括国内节点）                            │
│   💰 免费额度：10万次请求/天                                 │
│   ⚡ 平均响应时间 < 100ms                                    │
│                                                             │
│   你的 Worker URL:                                          │
│   https://your-usd-tracker-proxy.workers.dev                │
└─────────────────────┬───────────────────────────────────────┘
                      │ 代理转发
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   Supabase API   │    │   GitHub OAuth   │
│   (数据库/认证)   │    │   (登录授权)      │
└──────────────────┘    └──────────────────┘
```

---

## 🚀 快速开始（5分钟部署）

### 步骤 1: 注册 Cloudflare 账号（免费）

1. 访问 [Cloudflare 官网](https://dash.cloudflare.com/sign-up)
2. 点击 **"Sign Up"** 注册账号
3. 使用邮箱或 Google/GitHub 账号注册
4. 完成邮箱验证（如果需要）

> 💡 **提示**：Cloudflare 是全球最大的 CDN 服务商之一，完全免费且稳定可靠。

---

### 步骤 2: 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在左侧菜单找到 **"Workers & Pages"**
3. 点击 **"Create Application"** → **"Create Worker"**
4. 输入名称：`usd-tracker-proxy`（或任意你喜欢的名字）
5. 点击 **"Deploy"**（默认代码即可，稍后会替换）

**你会得到类似这样的 URL：**
```
https://usd-tracker-proxy.your-subdomain.workers.dev
```
https://usd-investment.jinqucheng1215.workers.dev/
📝 **复制这个 URL**，后面会用到！

---

### 步骤 3: 部署代理代码

1. 在 Workers 列表中点击刚创建的 `usd-tracker-proxy`
2. 点击 **"Edit Code"** 按钮（进入在线编辑器）
3. **删除所有默认代码**
4. 打开项目中的 [`cloudflare-worker.js`](cloudflare-worker.js) 文件
5. **全部复制**其内容
6. **粘贴**到 Cloudflare 编辑器中
7. 点击右上角 **"Deploy"**（或按 Ctrl+S 自动保存并部署）

#### ⚠️ 重要：修改配置

在粘贴的代码中，找到以下配置区域并确认：

```javascript
// ==================== 配置区域 ====================

// Supabase 项目配置（从你的 config.js 复制）
const SUPABASE_URL = 'https://xekjkqwfmvdbqvujwmlt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...'; // 保持不变

// 允许的来源域名（防止未授权访问）
const ALLOWED_ORIGINS = [
    'https://lee-version.github.io',  // ✅ 你的 GitHub Pages 地址

];
```

✅ **确认无误后再次点击 "Deploy"**

---

### 步骤 4: 测试 Worker 是否正常工作

在浏览器中访问你的 Worker URL + `/health`：

```
https://your-usd-tracker-proxy.workers.dev/health
```

**预期返回：**
```json
{
  "status": "ok",
  "timestamp": "2026-01-25T...",
  "services": ["supabase", "github"]
}
```

✅ 如果看到这个 JSON 响应，说明 Worker 部署成功！

---

### 步骤 5: 配置前端代码

打开文件 [`js/config.js`](js/config.js)，找到这一行：

```javascript
window.PROXY_URL = ''; // ← 在这里填入你的 Worker URL
```

**修改为：**

```javascript
window.PROXY_URL = 'https://your-usd-tracker-proxy.workers.dev';
```

> 💡 **示例**（请替换成你自己的 URL）：
> ```javascript
> window.PROXY_URL = 'https://usd-tracker-proxy.abc123.workers.dev';
> ```

---

### 步骤 6: 提交并部署到 GitHub Pages

1. 将修改后的代码提交到 Git 仓库
2. 推送到 GitHub
3. 等待 GitHub Pages 构建完成（通常 1-2 分钟）

```bash
git add .
git commit -m "feat: 添加 Cloudflare 代理支持国内访问"
git push origin main
```

---

## ✅ 验证测试

### 1️⃣ 访问你的网站

打开浏览器访问：`https://lee-version.github.io/usd_investment_web`

### 2️⃣ 打开开发者工具

按 **F12** → 切换到 **Console（控制台）** 标签

### 3️⃣ 观察初始化日志

你应该看到：

```
📦 StorageManager v3.2 初始化...
==================================================
📥 步骤 1/3: 加载本地数据...
   ✅ 本地数据加载完成 (0 条买入记录, 0 条历史记录)
☁️ 步骤 2/3: 连接云端服务...
🌐 使用代理模式:
   原始 URL: https://xekjkqwfmvdbqvujwmlt.supabase.co
   代理 URL: https://your-worker.workers.dev/supabase
📦 开始加载 Supabase SDK...
🔄 尝试 CDN 1/3: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
✅ CDN 1 加载成功
✅ Supabase 客户端初始化成功（通过代理）
   代理地址: https://your-worker.workers.dev
🔄 步骤 3/3: 启动云端同步...
✅ 已启用智能云同步模式

🎉 初始化完成：云端 + 本地 双存储模式
==================================================
```

### 4️⃣ 测试登录功能

1. 点击页面右上角的 **"登录 / 注册"** 按钮
2. 选择 **GitHub 登录** 或 **邮箱登录**
3. 授权后应该能正常登录

### 5️⃣ 测试数据保存

1. 进入 **收益计算** 页面
2. 填写参数 → 点击 **计算收益**
3. 点击 **保存结果**
4. 应该看到弹窗：**"✅ 计算结果已保存到数据表（本地 + 云端）"**

---

## 🔧 高级配置（可选）

### 自定义域名（推荐）

Cloudflare Workers 默认域名 `*.workers.dev` 在国内可能不稳定。建议绑定自定义域名：

1. 在 Cloudflare Dashboard 中添加你的域名（如 `api.yourdomain.com`）
2. 在 Workers 设置中添加 **Custom Domains**
3. 将 `api.yourdomain.com` 绑定到 Worker
4. 更新 `config.js` 中的 `PROXY_URL`

**优势：**
- ✅ 国内访问更稳定
- ✅ 更专业的域名
- ✅ 可以配置 SSL 证书

### 性能监控

Cloudflare 提供免费的实时分析：

1. 进入 Worker 详情页
2. 点击 **"Analytics"** 标签
3. 查看：
   - 请求数量
   - 响应时间
   - 错误率
   - 流量带宽

### 速率限制（安全加固）

如果担心被滥用，可以在 Worker 代码中添加速率限制：

```javascript
// 在 cloudflare-worker.js 的 fetch 函数开头添加
export default {
    async fetch(request, env) {
        // 简单的 IP 限流示例
        const clientIP = request.headers.get('CF-Connecting-IP');
        const rateLimitKey = `rate_limit:${clientIP}`;
        
        // 使用 KV 存储进行计数（需先创建 KV namespace）
        let count = await env.RATE_LIMIT.get(rateLimitKey);
        count = count ? parseInt(count) : 0;
        
        if (count > 1000) { // 每小时最多 1000 次
            return new Response('Too Many Requests', { status: 429 });
        }
        
        await env.RATE_LIMIT.put(rateLimitKey, (count + 1).toString(), {
            expirationTtl: 3600 // 1 小时过期
        });
        
        // ... 继续原有逻辑
    }
};
```

---

## ❓ 常见问题 FAQ

### Q1: Worker 部署后报错 403 Forbidden？

**原因**：CORS 配置不允许你的域名访问

**解决**：
1. 检查 `cloudflare-worker.js` 中的 `ALLOWED_ORIGINS` 数组
2. 确保包含你的 GitHub Pages 地址：`'https://lee-version.github.io'`
3. 重新部署 Worker

---

### Q2: 登录时跳转到 GitHub 后报错？

**原因**：OAuth 回调地址不匹配

**解决**：
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入 **Authentication** → **Providers** → **GitHub**
3. 确认 **Callback URL** 包含：
   - `https://lee-version.github.io/usd_investment_web`
4. 如果使用自定义域名，也要加上

---

### Q3: 数据能保存但不同步到云端？

**原因**：可能是本地模式运行

**检查方法**：
1. 打开控制台查看日志
2. 如果看到 `"纯本地存储"` 说明未连接云端
3. 确认 `config.js` 中 `PROXY_URL` 已正确填写
4. 确认 Worker 能正常访问（测试 `/health` 端点）

---

### Q4: 如何确认流量经过代理？

**方法 1**: 查看控制台日志
```
✅ Supabase 客户端初始化成功（通过代理）
   代理地址: https://your-worker.workers.dev
```

**方法 2**: 查看 Network 标签
1. F12 → Network 标签
2. 操作应用（如保存数据）
3. 查看请求 URL 是否包含你的 Worker 地址

---

### Q5: 免费额度够用吗？

**完全够用！** Cloudflare Workers 免费额度：

| 资源 | 免费额度 | 你的需求 |
|------|---------|---------|
| 请求次数 | 10万次/天 | ~100次/天 |
| CPU 时间 | 10ms/请求 | < 5ms/请求 |
| 带宽 | 无限制 | < 10MB/天 |

个人项目**完全免费**，无需升级付费计划。

---

## 📊 成本对比

| 方案 | 月成本 | 国内可用性 | 维护难度 | 推荐度 |
|------|-------|-----------|---------|--------|
| **Cloudflare Workers（本方案）** | **$0** | ✅ 完美 | ⭐ 简单 | ⭐⭐⭐⭐⭐ |
| VPS 服务器（阿里云/腾讯云） | ¥50-200/月 | ✅ 完美 | ⚠️ 中等 | ⭐⭐⭐ |
| Vercel/Netlify Edge Functions | $0 | ✅ 良好 | ⭐ 简单 | ⭐⭐⭐⭐ |
| 纯 VPN 解决方案 | ¥20-100/月 | ⚠️ 不稳定 | ❌ 困难 | ⭐⭐ |

---

## 🎉 总结

通过以上步骤，你已经完成了：

✅ **Cloudflare Worker 代理部署**  
✅ **前端代码适配代理**  
✅ **国内无障碍访问云端服务**  
✅ **混合模式（本地+云端）**  

现在你的项目可以：
- 🌏 在国内任何地方正常访问
- 📱 无需 VPN 即可使用所有功能
- ☁️ 数据自动同步到云端
- 💾 断网时仍可正常使用（本地缓存）

---

## 📞 获取帮助

如果遇到问题：

1. **查看控制台日志**（F12 → Console）
2. **检查 Worker 日志**（Cloudflare Dashboard → Workers → Logs）
3. **测试健康检查端点**：`https://your-worker.workers.dev/health`
4. **参考本文档 FAQ 部分**

---

**祝你使用愉快！** 🚀

如有其他问题，欢迎随时提问！

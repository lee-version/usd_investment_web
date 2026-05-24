/**
 * Supabase 配置文件
 * 
 * 使用方法:
 * 1. 复制此文件为 config.local.js
 * 2. 填入你的 Supabase 凭证
 * 3. 在 index.html 中引入: <script src="js/config.local.js"></script>
 * 
 * 或者直接修改下面的值
 */

// ==================== Supabase 项目信息 ====================
// 从 Supabase Dashboard → Settings → API 获取
window.SUPABASE_URL = 'https://xekjkqwfmvdbqvujwmlt.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla2prcXdmbXZkYnF2dWp3bWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDI1NTQsImV4cCI6MjA5NTE3ODU1NH0.ZHwgFkKUKo_FJXpbQ-5U7rBgiKp8QxIoov7AojDk_cc';

// ==================== Cloudflare Worker 代理（国内访问必需）⭐ ====================
// 
// 📖 为什么需要代理？
// 国内网络无法直接访问 Supabase 和 GitHub API
// 通过 Cloudflare Workers 代理可以：
// ✅ 绕过 GFW 防火墙限制
// ✅ 全球 CDN 加速（国内节点）
// ✅ 免费 10万次/天请求额度
//
// 🚀 如何获取代理 URL？
// 1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up（免费）
// 2. 创建 Worker：Workers & Pages → Create Application → Create Worker
// 3. 粘贴 cloudflare-worker.js 的代码
// 4. 部署后获得 URL：https://your-worker.workers.dev
// 5. 填入下方 PROXY_URL
//
// ⚠️ 重要提示：
// - 如果不填或留空，将尝试直连 Supabase（可能在国内无法访问）
// - 建议始终配置代理以确保国内可用性

window.PROXY_URL = 'https://usd-investment.jinqucheng1215.workers.dev'; // ✅ 已配置你的 Worker 地址

// ==================== CDN 加载策略 ====================
// 
// 🔄 多 CDN 容错机制：
// 当主 CDN 无法访问时，自动切换到备用源
// 支持的 CDN 源：
//   1. jsDelivr (全球最快)
//   2. unpkg (备用1)
//   3. cdnjs (备用2)

window.CDN_FALLBACK_LIST = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/supabase-js/2.39.0/umd/supabase.js'
];

// ==================== 网站基础 URL ====================
// 用于 OAuth 回调等
// ⚠️ 必须使用固定的生产环境地址，避免登录后跳转到 localhost
window.SITE_URL = 'https://lee-version.github.io/usd_investment_web';

console.log('🔧 配置文件已加载');
console.log(`   Site URL: ${window.SITE_URL}`);
console.log(`   当前位置: ${window.location.origin}`);
console.log(`   Supabase: ${window.SUPABASE_URL ? '已配置' : '未配置'}`);
console.log(`   代理服务: ${window.PROXY_URL ? `✅ 已启用 (${window.PROXY_URL})` : '❌ 未配置（将尝试直连）'}`);

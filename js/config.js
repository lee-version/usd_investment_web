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

// Supabase 项目信息（从 Supabase Dashboard → Settings → API 获取）
window.SUPABASE_URL = 'https://xekjkqwfmvdbqvujwmlt.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla2prcXdmbXZkYnF2dWp3bWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDI1NTQsImV4cCI6MjA5NTE3ODU1NH0.ZHwgFkKUKo_FJXpbQ-5U7rBgiKp8QxIoov7AojDk_cc';

// 网站基础 URL（用于 OAuth 回调等）
window.SITE_URL = window.location.origin;

console.log('🔧 配置文件已加载');
console.log(`   Site URL: ${window.SITE_URL}`);
console.log(`   Supabase: ${window.SUPABASE_URL ? '已配置' : '未配置'}`);

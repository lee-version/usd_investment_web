/**
 * Cloudflare Worker - Supabase & GitHub API 代理
 * 
 * 功能：
 * 1. 代理 Supabase REST API（数据库 CRUD 操作）
 * 2. 代理 Supabase Auth API（登录认证）
 * 3. 代理 GitHub OAuth 授权流程
 * 
 * 使用方法：
 * 1. 注册 Cloudflare 账号（免费）
 * 2. 创建 Worker，粘贴此代码
 * 3. 部署后获得 URL：https://your-worker.workers.dev
 * 4. 在前端 config.js 中配置 PROXY_URL
 */

// ==================== 配置区域 ====================

// Supabase 项目配置（从你的 config.js 复制）
const SUPABASE_URL = 'https://xekjkqwfmvdbqvujwmlt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla2prcXdmbXZkYnF2dWp3bWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDI1NTQsImV4cCI6MjA5NTE3ODU1NH0.ZHwgFkKUKo_FJXpbQ-5U7rBgiKp8QxIoov7AojDk_cc';

// GitHub OAuth 配置（从 Supabase Dashboard → Authentication → Providers 获取）
// 如果没有配置 GitHub Provider，可以忽略此部分
const GITHUB_CLIENT_ID = ''; // 可选：GitHub OAuth Client ID

// 允许的来源域名（防止未授权访问）
const ALLOWED_ORIGINS = [
    'https://lee-version.github.io',  // 你的 GitHub Pages 地址
    'http://localhost:3000',          // 本地开发
    'http://127.0.0.1:3000'          // 本地开发（备用）
];

// ==================== 主处理函数 ====================

export default {
    async fetch(request, env) {
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return handleCORS(request);
        }

        const url = new URL(request.url);
        const path = url.pathname;

        console.log(`📥 [Worker] 收到请求: ${request.method} ${path}`);

        try {
            // 路由分发
            if (path.startsWith('/supabase/')) {
                // 代理 Supabase REST API
                return await proxySupabaseAPI(request, path, url);
            } else if (path.startsWith('/auth/')) {
                // 代理 Supabase Auth API
                return await proxySupabaseAuth(request, path, url);
            } else if (path.startsWith('/github/')) {
                // 代理 GitHub OAuth
                return await proxyGitHubOAuth(request, path, url, env);
            } else if (path === '/health') {
                // 健康检查
                return new Response(JSON.stringify({ 
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    services: ['supabase', 'github']
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // 默认响应
                return new Response(JSON.stringify({
                    error: 'Not Found',
                    message: '请使用 /supabase/, /auth/, /github/ 路径',
                    endpoints: {
                        supabase: '/supabase/rest/v1/*',
                        auth: '/auth/*',
                        github: '/github/*'
                    }
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (error) {
            console.error('❌ [Worker] 错误:', error);
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error.message
            }), {
                status: 500,
                headers: getCORSHeaders(request)
            });
        }
    }
};

// ==================== Supabase REST API 代理 ====================

async function proxySupabaseAPI(request, path, url) {
    // 移除 /supabase 前缀，得到真实路径
    const targetPath = path.replace('/supabase', '');
    const targetUrl = `${SUPABASE_URL}${targetPath}${url.search}`;

    console.log(`🔄 [Supabase] 代理请求: ${request.method} ${targetUrl}`);

    // 构建新的请求头
    const headers = new Headers(request.headers);
    
    // 设置必要的认证头
    headers.set('apikey', SUPABASE_ANON_KEY);
    
    // 如果客户端传了 Authorization，保留它
    if (!headers.get('Authorization')) {
        headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    }

    // 发送请求到 Supabase
    const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });

    // 返回响应（透传状态码和响应体）
    const responseData = await response.text();
    
    return new Response(responseData, {
        status: response.status,
        statusText: response.statusText,
        headers: {
            ...getCORSHeaders(request),
            'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
    });
}

// ==================== Supabase Auth API 代理 ====================

async function proxySupabaseAuth(request, path, url) {
    const targetPath = path.replace('/auth', '');
    const targetUrl = `${SUPABASE_URL}/auth/v1${targetPath}${url.search}`;

    console.log(`🔐 [Auth] 代理请求: ${request.method} ${targetUrl}`);

    const headers = new Headers(request.headers);
    headers.set('apikey', SUPABASE_ANON_KEY);

    const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body
    });

    const responseData = await response.text();

    return new Response(responseData, {
        status: response.status,
        statusText: response.statusText,
        headers: {
            ...getCORSHeaders(request),
            'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
    });
}

// ==================== GitHub OAuth 代理 ====================

async function proxyGitHubOAuth(request, path, url, env) {
    // GitHub OAuth 重定向
    if (path === '/github/authorize') {
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${url.origin}/github/callback`)}`;
        
        return Response.redirect(githubAuthUrl, 302);
    }

    // GitHub OAuth 回调
    if (path === '/github/callback') {
        const code = url.searchParams.get('code');
        
        if (!code) {
            return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
                status: 400,
                headers: getCORSHeaders(request)
            });
        }

        // 用 code 换取 access_token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: code
            })
        });

        const tokenData = await tokenResponse.json();

        return new Response(JSON.stringify(tokenData), {
            headers: getCORSHeaders(request)
        });
    }

    return new Response(JSON.stringify({ error: 'Invalid GitHub endpoint' }), {
        status: 404,
        headers: getCORSHeaders(request)
    });
}

// ==================== 工具函数 ====================

function handleCORS(request) {
    return new Response(null, {
        status: 204,
        headers: getCORSHeaders(request)
    });
}

function getCORSHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    
    // 检查是否在允许列表中
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

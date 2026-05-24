/**
 * AuthManager v2.0 - 基于 Supabase Auth 的认证管理器
 * 
 * 架构变更：
 * - 旧版: 前端 → Node.js 后端 → GitHub OAuth → 返回 token
 * - 新版: 前端 → Supabase Auth (客户端) → GitHub OAuth → 直接获取 session
 * 
 * 优势：
 * - 无需后端服务器
 * - 完全适配 GitHub Pages 静态部署
 * - 更安全（token 由 Supabase 管理）
 */

class AuthManager {
    constructor() {
        this.user = null;
        this.session = null;
        this.supabaseClient = null;
        this.listeners = [];
        this.init();
    }

    async init() {
        console.log('🔐 AuthManager 初始化...');
        
        try {
            await this.initSupabaseClient();
            await this.checkSession();
            this.handleCallback();
        } catch (error) {
            console.warn('⚠️ 认证初始化失败，使用访客模式:', error.message);
            this.setUser(null);
        }
    }

    /**
     * 初始化 Supabase 客户端（用于认证）
     */
    async initSupabaseClient() {
        if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
            throw new Error('Supabase 配置未找到');
        }

        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            this.supabaseClient = window.supabase.createClient(
                window.SUPABASE_URL,
                window.SUPABASE_ANON_KEY,
                {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true,
                        detectSessionInUrl: true
                    }
                }
            );
            
            console.log('✅ Supabase Auth 客户端初始化成功');
            return true;
        }

        return false;
    }

    /**
     * 处理 OAuth 回调
     */
    handleCallback() {
        // Supabase 会自动处理 URL 中的 hash fragment (#access_token=...)
        // 我们只需要检查 session 即可
    }

    /**
     * 检查当前会话状态
     */
    async checkSession() {
        try {
            if (!this.supabaseClient) {
                this.setUser(null);
                return;
            }

            const { data: { session }, error } = await this.supabaseClient.auth.getSession();
            
            if (error) throw error;
            
            if (session) {
                this.session = session;
                this.user = {
                    id: session.user.id,
                    email: session.user.email,
                    username: session.user.user_metadata?.user_name || 
                             session.user.user_metadata?.full_name ||
                             session.user.email?.split('@')[0] || '用户',
                    avatarUrl: session.user.user_metadata?.avatar_url ||
                              session.user.user_metadata?.picture,
                    provider: session.app_metadata?.provider
                };
                
                console.log(`✅ 用户已登录: ${this.user.username}`);
                this.notifyListeners();
                this.updateUI();
            } else {
                this.setUser(null);
            }
        } catch (error) {
            console.error('❌ 检查会话失败:', error);
            this.setUser(null);
        }
    }

    /**
     * 使用 GitHub 登录
     */
    async loginWithGitHub() {
        try {
            if (!this.supabaseClient) {
                throw new Error('Supabase 客户端未初始化');
            }

            console.log('🔑 开始 GitHub 登录...');

            const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}${window.location.pathname}`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    }
                }
            });

            if (error) throw error;

            // 重定向到 GitHub 授权页面
            if (data.url) {
                console.log('🔄 重定向到 GitHub 授权...');
                window.location.href = data.url;
            }

        } catch (error) {
            console.error('❌ GitHub 登录错误:', error);
            
            let errorMessage = '登录失败';
            
            if (error.message?.includes('Supabase')) {
                errorMessage = 'Supabase 服务不可用，请稍后重试';
            } else if (error.message?.includes('provider')) {
                errorMessage = 'GitHub 登录未配置，请联系管理员';
            } else {
                errorMessage = error.message || '未知错误';
            }
            
            alert(`登录失败: ${errorMessage}\n\n提示：即使不登录，你也可以正常使用所有功能！数据将保存在浏览器本地。`);
        }
    }

    /**
     * 登出
     */
    async logout() {
        try {
            if (this.supabaseClient) {
                const { error } = await this.supabaseClient.auth.signOut();
                if (error) throw error;
            }
        } catch (error) {
            console.error('⚠️ 登出请求失败:', error);
        } finally {
            this.session = null;
            this.setUser(null);
            console.log('👋 已登出');
        }
    }

    /**
     * 设置用户信息并通知监听器
     */
    setUser(user) {
        this.user = user;
        if (!user) this.session = null;
        this.notifyListeners();
        this.updateUI();
    }

    /**
     * 获取认证头（用于 API 请求）
     */
    getAuthHeaders() {
        if (this.session?.access_token) {
            return {
                'Authorization': `Bearer ${this.session.access_token}`,
                'Content-Type': 'application/json'
            };
        }
        return { 'Content-Type': 'application/json' };
    }

    /**
     * 检查是否已认证
     */
    isAuthenticated() {
        return !!this.user && !!this.session;
    }

    /**
     * 添加状态变化监听器
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * 移除监听器
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    /**
     * 通知所有监听器
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.user);
            } catch (e) {
                console.error('监听器执行错误:', e);
            }
        });
    }

    /**
     * 更新 UI 显示
     */
    updateUI() {
        const authContainer = document.getElementById('auth-container');
        
        if (!authContainer) return;

        if (this.isAuthenticated()) {
            authContainer.innerHTML = `
                <div class="user-info">
                    <img src="${this.user.avatarUrl || 'https://via.placeholder.com/32'}" 
                         alt="${this.user.username}" 
                         class="user-avatar"
                         onerror="this.src='https://via.placeholder.com/32'">
                    <span class="user-name">${this.user.username || this.user.email}</span>
                    <button onclick="authManager.logout()" class="btn-logout" title="退出登录">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                    </button>
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button onclick="authManager.loginWithGitHub()" class="btn-github-login">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub 登录
                </button>
            `;
        }
    }
}

// 全局实例
const authManager = new AuthManager();

// 导出到全局作用域
window.authManager = authManager;

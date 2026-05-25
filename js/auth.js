/**
 * AuthManager v3.0 - 基于 Supabase Auth 的认证管理器（支持邮箱验证）
 * 
 * 功能：
 * - GitHub OAuth 登录
 * - 邮箱+密码注册/登录
 * - 邮箱验证流程
 * - 验证状态管理
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
        console.log('🔐 AuthManager v3.0 初始化...');
        
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
                    avatarUrl: this._getValidAvatarUrl(
                        session.user.user_metadata?.avatar_url ||
                        session.user.user_metadata?.picture
                    ),
                    provider: session.app_metadata?.provider
                };
                
                console.log(`✅ 用户已登录: ${this.user.username}`);
                this.notifyListeners();
                this.updateUI();
                
                // 通知 StorageManager 从云端拉取数据
                if (window.storageManager?.onUserLogin) {
                    window.storageManager.onUserLogin(this.user.id);
                }
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

            // ✅ 直接使用 SITE_URL，避免路径重复
            const redirectUrl = window.SITE_URL || 'https://lee-version.github.io/usd_investment_web';
            
            console.log(`📍 登录回调地址: ${redirectUrl}`);

            const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: redirectUrl,
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
     * 验证并返回有效的头像 URL
     * 过滤掉无法访问的占位图服务（如 placeholder.com）
     * 
     * @param {string} url - 原始头像 URL
     * @returns {string|null} 有效的 URL 或 null（使用默认头像）
     */
    _getValidAvatarUrl(url) {
        if (!url) return null;
        
        const invalidPatterns = [
            'placeholder.com',
            'via.placeholder.com',
            'avatars0.githubusercontent.com',
            'avatars1.githubusercontent.com',
            'avatars2.githubusercontent.com',
            'avatars3.githubusercontent.com',
            'github.com/identicons'
        ];
        
        const isInvalid = invalidPatterns.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isInvalid) {
            console.log('🖼️ 过滤无效头像URL:', url, '→ 使用默认头像');
            return null;
        }
        
        return url;
    }

    // ==================== 邮箱认证功能 ====================

    /**
     * 使用邮箱和密码注册
     */
    async signUpWithEmail(email, password) {
        try {
            if (!this.supabaseClient) {
                throw new Error('Supabase 客户端未初始化');
            }

            console.log('📧 开始邮箱注册...');

            const { data, error } = await this.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.SITE_URL || window.location.origin
                }
            });

            if (error) throw error;

            console.log('✅ 注册成功:', data);

            if (data.user && !data.session) {
                return {
                    success: true,
                    needsVerification: true,
                    message: '注册成功！验证邮件已发送到您的邮箱，请点击邮件中的链接完成验证。'
                };
            }

            return {
                success: true,
                needsVerification: false,
                message: '注册成功！'
            };

        } catch (error) {
            console.error('❌ 邮箱注册错误:', error);
            
            let errorMessage = this._translateSupabaseError(error);
            throw new Error(errorMessage);
        }
    }

    /**
     * 使用邮箱和密码登录
     */
    async signInWithEmail(email, password) {
        try {
            if (!this.supabaseClient) {
                throw new Error('Supabase 客户端未初始化');
            }

            console.log('📧 开始邮箱登录...');

            const { data, error } = await this.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            if (data.user) {
                await this.checkSession();
                
                const isVerified = data.user.email_confirmed_at !== null;
                
                if (!isVerified) {
                    return {
                        success: true,
                        needsVerification: true,
                        message: '登录成功！但您的邮箱尚未验证，部分功能可能受限。'
                    };
                }

                return {
                    success: true,
                    needsVerification: false,
                    message: '登录成功！'
                };
            }

        } catch (error) {
            console.error('❌ 邮箱登录错误:', error);
            
            let errorMessage = this._translateSupabaseError(error);
            throw new Error(errorMessage);
        }
    }

    /**
     * 重新发送验证邮件
     */
    async resendVerificationEmail() {
        try {
            if (!this.supabaseClient || !this.user?.email) {
                throw new Error('用户信息不完整');
            }

            console.log('📤 重新发送验证邮件...');

            const { error } = await this.supabaseClient.auth.resend({
                type: 'signup',
                email: this.user.email,
                options: {
                    emailRedirectTo: window.SITE_URL || window.location.origin
                }
            });

            if (error) throw error;

            console.log('✅ 验证邮件已重新发送');
            alert('验证邮件已重新发送！请检查您的收件箱（包括垃圾邮件文件夹）。');

        } catch (error) {
            console.error('❌ 发送验证邮件失败:', error);
            alert(`发送失败: ${error.message}`);
        }
    }

    /**
     * 检查邮箱是否已验证
     */
    isEmailVerified() {
        return this.user?.emailConfirmedAt !== null || 
               this.user?.email_confirmed_at !== null;
    }

    /**
     * 翻译 Supabase 错误消息为中文
     */
    _translateSupabaseError(error) {
        const errorMap = {
            'Invalid login credentials': '邮箱或密码错误',
            'Email not confirmed': '邮箱尚未验证，请先查收验证邮件',
            'User already registered': '该邮箱已被注册',
            'Password should be at least 6 characters': '密码至少需要6个字符',
            'Unable to validate email address: invalid format': '邮箱格式无效',
            'signups disabled for new users': '注册功能已禁用',
            'Invalid API key': 'API 密钥无效',
            'Network request failed': '网络连接失败，请检查网络',
            'timeout': '请求超时，请稍后重试'
        };

        for (const [key, value] of Object.entries(errorMap)) {
            if (error.message?.includes(key)) {
                return value;
            }
        }

        return error.message || '未知错误';
    }

    /**
     * 登出
     */
    async logout() {
        if (!confirm('确定要退出登录吗？')) return;

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
            alert('已退出登录');
        }
    }

    /**
     * 设置用户信息并通知监听器
     */
    setUser(user) {
        this.user = user;
        if (!user) this.session = null;
        
        // 通知 StorageManager 登出
        if (!user && window.storageManager?.onUserLogout) {
            window.storageManager.onUserLogout();
        }
        
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
            const isVerified = this.isEmailVerified();
            const verificationBadge = isVerified 
                ? '<span class="verification-badge verified" title="邮箱已验证">✓ 已验证</span>'
                : `<span class="verification-badge unverified" title="邮箱未验证 - 点击重新发送验证邮件">
                     <button onclick="event.stopPropagation(); authManager.resendVerificationEmail()" 
                             class="btn-resend-verify">未验证</button>
                   </span>`;
            
            authContainer.innerHTML = `
                <div class="user-menu">
                    <button class="user-avatar-btn" title="${this.user.username || this.user.email}">
                        <img src="${this.user.avatarUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+'}" 
                             alt="${this.user.username}" 
                             class="user-avatar"
                             onerror="if(!this.dataset.errorHandled){this.dataset.errorHandled='true';this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yMCAyMXYtMmE0IDQgMCAwIDAtNC00SDhhNCA0IDAgMCAwLTQgNHYyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';}">
                    </button>
                    <div class="user-dropdown">
                        <div class="user-dropdown-header">
                            <span class="user-dropdown-name">${this.user.username || this.user.email}</span>
                            ${this.user.email ? verificationBadge : ''}
                        </div>
                        ${this.user.email ? `<div class="user-dropdown-email">${this.user.email}</div>` : ''}
                        <div class="user-dropdown-divider"></div>
                        <button onclick="authManager.logout()" class="user-dropdown-logout">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            退出登录
                        </button>
                    </div>
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button onclick="authManager.showLoginModal()" class="btn-login-trigger" title="登录 / 注册">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </button>
            `;
        }
    }

    /**
     * 显示登录模态框
     */
    showLoginModal() {
        const modalHtml = `
            <div id="auth-modal" class="modal-overlay" onclick="if(event.target === this) authManager.closeModal()">
                <div class="modal-content auth-modal-content">
                    <button class="modal-close" onclick="authManager.closeModal()">×</button>
                    
                    <h2>欢迎使用 USD 投资追踪器</h2>
                    <p class="auth-subtitle">登录后可同步数据到云端，多设备访问更便捷</p>
                    
                    <!-- GitHub 登录 -->
                    <button onclick="authManager.loginWithGitHub(); authManager.closeModal();" 
                            class="btn-github-login btn-full-width">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        使用 GitHub 登录
                    </button>

                    <div class="divider">
                        <span>或</span>
                    </div>

                    <!-- 邮箱登录表单 -->
                    <form id="email-auth-form" onsubmit="return false;">
                        <div class="tab-buttons">
                            <button type="button" id="tab-login" class="active" 
                                    onclick="authManager.switchAuthTab('login')">登录</button>
                            <button type="button" id="tab-signup"
                                    onclick="authManager.switchAuthTab('signup')">注册</button>
                        </div>

                        <!-- 登录表单 -->
                        <div id="login-form-section" class="auth-form-section active">
                            <div class="form-group">
                                <label for="login-email">邮箱地址</label>
                                <input type="email" id="login-email" required placeholder="your@email.com">
                            </div>
                            <div class="form-group">
                                <label for="login-password">密码</label>
                                <input type="password" id="login-password" required placeholder="输入密码（至少6位）">
                            </div>
                            <button type="button" onclick="authManager.handleEmailLogin()" 
                                    class="btn-primary btn-full-width">
                                邮箱登录
                            </button>
                        </div>

                        <!-- 注册表单 -->
                        <div id="signup-form-section" class="auth-form-section">
                            <div class="form-group">
                                <label for="signup-email">邮箱地址</label>
                                <input type="email" id="signup-email" required placeholder="your@email.com">
                            </div>
                            <div class="form-group">
                                <label for="signup-password">设置密码</label>
                                <input type="password" id="signup-password" required placeholder="至少6个字符">
                            </div>
                            <div class="form-group">
                                <label for="signup-confirm-password">确认密码</label>
                                <input type="password" id="signup-confirm-password" required placeholder="再次输入密码">
                            </div>
                            <button type="button" onclick="authManager.handleEmailSignup()" 
                                    class="btn-primary btn-full-width">
                                创建账户
                            </button>
                            <p class="auth-hint">注册后需要验证邮箱才能使用完整功能</p>
                        </div>
                    </form>

                    <div id="auth-message" class="auth-message hidden"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        setTimeout(() => {
            const modal = document.getElementById('auth-modal');
            if (modal) modal.classList.add('show');
        }, 10);
    }

    /**
     * 关闭登录模态框
     */
    closeModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * 切换登录/注册标签
     */
    switchAuthTab(tab) {
        const loginSection = document.getElementById('login-form-section');
        const signupSection = document.getElementById('signup-form-section');
        const loginTab = document.getElementById('tab-login');
        const signupTab = document.getElementById('tab-signup');

        if (tab === 'login') {
            loginSection.classList.add('active');
            signupSection.classList.remove('active');
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
        } else {
            signupSection.classList.add('active');
            loginSection.classList.remove('active');
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
        }

        this.clearAuthMessage();
    }

    /**
     * 处理邮箱登录
     */
    async handleEmailLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showAuthMessage('请填写所有字段', 'error');
            return;
        }

        try {
            const result = await this.signInWithEmail(email, password);
            
            if (result.success) {
                this.closeModal();
                
                if (result.needsVerification) {
                    setTimeout(() => {
                        alert(result.message + '\n\n是否立即重新发送验证邮件？');
                        this.resendVerificationEmail();
                    }, 500);
                }
            }

        } catch (error) {
            this.showAuthMessage(error.message, 'error');
        }
    }

    /**
     * 处理邮箱注册
     */
    async handleEmailSignup() {
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (!email || !password || !confirmPassword) {
            this.showAuthMessage('请填写所有字段', 'error');
            return;
        }

        if (password.length < 6) {
            this.showAuthMessage('密码至少需要6个字符', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showAuthMessage('两次输入的密码不一致', 'error');
            return;
        }

        try {
            const result = await this.signUpWithEmail(email, password);
            
            if (result.success) {
                this.showAuthMessage(result.message, 'success');
                
                if (result.needsVerification) {
                    setTimeout(() => {
                        this.switchAuthTab('login');
                        document.getElementById('login-email').value = email;
                    }, 2000);
                }
            }

        } catch (error) {
            this.showAuthMessage(error.message, 'error');
        }
    }

    /**
     * 显示认证消息
     */
    showAuthMessage(message, type = 'info') {
        const messageEl = document.getElementById('auth-message');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = `auth-message ${type}`;
            messageEl.classList.remove('hidden');
            
            if (type === 'success' || type === 'info') {
                setTimeout(() => this.clearAuthMessage(), 5000);
            }
        }
    }

    /**
     * 清除认证消息
     */
    clearAuthMessage() {
        const messageEl = document.getElementById('auth-message');
        if (messageEl) {
            messageEl.textContent = '';
            messageEl.className = 'auth-message hidden';
        }
    }
}

// 全局实例
const authManager = new AuthManager();

// 导出到全局作用域
window.authManager = authManager;

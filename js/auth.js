class AuthManager {
    constructor() {
        this.user = null;
        this.token = null;
        this.listeners = [];
        this.init();
    }

    async init() {
        await this.checkSession();
        this.handleCallback();
    }

    handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            localStorage.setItem('auth_token', token);
            window.history.replaceState({}, document.title, window.location.pathname);
            this.checkSession();
        }
    }

    async checkSession() {
        try {
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                this.setUser(null);
                return;
            }

            const response = await fetch('/api/auth/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success && data.authenticated) {
                this.token = token;
                this.setUser(data.data);
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('检查会话失败:', error);
            this.logout();
        }
    }

    async loginWithGitHub() {
        try {
            const response = await fetch('/api/auth/github');
            const data = await response.json();

            if (data.success) {
                window.location.href = data.data.url;
            } else {
                throw new Error(data.message || 'GitHub 登录初始化失败');
            }
        } catch (error) {
            console.error('GitHub 登录错误:', error);
            alert('登录失败: ' + error.message);
        }
    }

    async logout() {
        try {
            const token = localStorage.getItem('auth_token');
            
            if (token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('登出请求失败:', error);
        } finally {
            localStorage.removeItem('auth_token');
            this.token = null;
            this.setUser(null);
        }
    }

    setUser(user) {
        this.user = user;
        this.notifyListeners();
        this.updateUI();
    }

    getAuthHeaders() {
        const token = localStorage.getItem('auth_token') || this.token;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    isAuthenticated() {
        return !!this.user && !!this.token;
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.user));
    }

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

const authManager = new AuthManager();

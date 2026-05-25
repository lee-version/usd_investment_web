/**
 * StorageManager v3.2 - 云端优先混合存储架构（支持国内代理）
 * 
 * ✅ 核心设计原则：
 * - Supabase PostgreSQL = 主数据源（云端数据库）
 * - localStorage = 本地缓存（离线时使用）
 * 
 * 🌐 国内访问优化：
 * - 支持 Cloudflare Workers 代理（绕过 GFW）
 * - 多 CDN 容错机制
 * - 智能降级到纯本地模式
 * 
 * 🔄 同步策略（云端优先）：
 * 1. 登录后 → 从云端下载最新数据 → 覆盖本地缓存
 * 2. 本地新增/修改 → 上传到云端备份
 * 3. 离线模式 → 使用 localStorage 缓存数据
 */

class StorageManager {
    constructor() {
        // Supabase 原始配置
        this.supabaseOriginalUrl = window.SUPABASE_URL || 'https://your-project.supabase.co';
        this.supabaseAnonKey = window.SUPABASE_ANON_KEY || 'your-anon-key';
        
        // Cloudflare Worker 代理配置
        this.proxyUrl = window.PROXY_URL || '';
        
        // 实际使用的 Supabase URL（可能经过代理）
        this.supabaseUrl = this._getEffectiveSupabaseUrl();
        
        // localStorage 键名前缀
        this.STORAGE_PREFIX = 'usd_tracker_';
        
        // 表名映射
        this.TABLES = {
            BUY_RECORDS: 'buy_records',
            HISTORY_RECORDS: 'history_records',
            CONFIG: 'config'
        };
        
        // 同步状态
        this.syncStatus = {
            lastSync: null,
            isSyncing: false,
            pendingChanges: false,
            conflictCount: 0
        };
        
        // 用户登录时间戳（用于区分登录前后的数据）
        this.loginTimestamp = null;
        
        // Supabase 客户端实例
        this.supabaseClient = null;
        
        // 数据存储
        this.buyRecords = [];
        this.historyRecords = [];
        this.config = {
            id: 1,
            currentHoldUSD: 0,
            currentRate: 0,
            lastUpdate: null
        };
        
        // 初始化
        this.init();
    }

    /**
     * 计算实际使用的 Supabase URL
     * 如果配置了代理，使用代理 URL + /supabase 前缀
     */
    _getEffectiveSupabaseUrl() {
        if (this.proxyUrl) {
            const effectiveUrl = `${this.proxyUrl.replace(/\/$/, '')}/supabase`;
            console.log(`🌐 使用代理模式:`);
            console.log(`   原始 URL: ${this.supabaseOriginalUrl}`);
            console.log(`   代理 URL: ${effectiveUrl}`);
            return effectiveUrl;
        } else {
            console.log(`⚠️ 未配置代理，将直连 Supabase (可能在国内无法访问)`);
            return this.supabaseOriginalUrl;
        }
    }

    /**
     * 初始化存储管理器
     */
    async init() {
        console.log('📦 StorageManager v3.1 初始化...');
        console.log('=' .repeat(50));
        
        try {
            // 1. 从 localStorage 加载数据
            console.log('📥 步骤 1/3: 加载本地数据...');
            this._loadFromLocalStorage();
            console.log(`   ✅ 本地数据加载完成 (${this.buyRecords.length} 条买入记录, ${this.historyRecords.length} 条历史记录)`);
            
            // 2. 初始化 Supabase 客户端
            console.log('☁️ 步骤 2/3: 连接云端服务...');
            const cloudConnected = await this._initSupabaseClient();
            
            // 3. 启动智能同步或使用纯本地模式
            if (cloudConnected) {
                console.log('🔄 步骤 3/3: 启动云端同步...');
                await this._startSmartSync();
                console.log('✅ 已启用智能云同步模式');
                console.log('');
                console.log('🎉 初始化完成：云端 + 本地 双存储模式');
            } else {
                console.log('💾 步骤 3/3: 使用纯本地存储模式');
                console.log('');
                console.log('⚠️ 初始化完成：纯本地模式（离线可用）');
                console.log('💡 提示：数据保存在浏览器 localStorage 中');
                console.log('🔧 如需云端同步，请：');
                console.log('   1. 确认 VPN/代理已开启并代理系统流量');
                console.log('   2. 尝试切换 DNS 为 8.8.8.8 或 1.1.1.1');
                console.log('   3. 刷新页面重试');
            }
            
            console.log('=' .repeat(50));
            
        } catch (error) {
            console.error('❌ 初始化失败:', error);
            console.error('⚠️ 将使用纯本地模式运行');
        }
        
        // 触发 UI 更新事件（无论成功失败都触发）
        window.dispatchEvent(new CustomEvent('dataLoaded', { 
            detail: {
                buyRecordsCount: this.buyRecords.length,
                historyRecordsCount: this.historyRecords.length,
                dataSource: this.supabaseClient ? 'cloud' : 'local',
                cloudConnected: !!this.supabaseClient
            }
        }));
    }

    /**
     * 从 localStorage 加载数据
     */
    _loadFromLocalStorage() {
        try {
            const buyData = localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.BUY_RECORDS);
            const historyData = localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.HISTORY_RECORDS);
            const configData = localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.CONFIG);
            
            this.buyRecords = buyData ? JSON.parse(buyData) : [];
            this.historyRecords = historyData ? JSON.parse(historyData) : [];
            this.config = configData ? JSON.parse(configData) : {
                id: 1,
                currentHoldUSD: 0,
                currentRate: 0,
                lastUpdate: null
            };
            
            console.log(`📥 本地数据加载完成:`);
            console.log(`   - 买入记录: ${this.buyRecords.length} 条`);
            console.log(`   - 历史记录: ${this.historyRecords.length} 条`);
            
        } catch (error) {
            console.error('❌ 加载本地数据失败:', error);
            this.buyRecords = [];
            this.historyRecords = [];
        }
    }

    /**
     * 保存数据到 localStorage
     */
    _saveToLocalStorage() {
        try {
            localStorage.setItem(
                this.STORAGE_PREFIX + this.TABLES.BUY_RECORDS, 
                JSON.stringify(this.buyRecords)
            );
            localStorage.setItem(
                this.STORAGE_PREFIX + this.TABLES.HISTORY_RECORDS, 
                JSON.stringify(this.historyRecords)
            );
            localStorage.setItem(
                this.STORAGE_PREFIX + this.TABLES.CONFIG, 
                JSON.stringify(this.config)
            );
        } catch (error) {
            console.error('❌ 保存到本地失败:', error);
        }
    }

    /**
     * 初始化 Supabase 客户端
     * 支持多 CDN 容错 + 超时控制 + 代理模式
     */
    async _initSupabaseClient() {
        try {
            if (typeof window.supabase === 'undefined' && typeof window.createClient === 'undefined') {
                console.log('📦 开始加载 Supabase SDK...');
                
                // 优先使用 config.js 中配置的 CDN 列表，否则使用默认列表
                const cdnList = window.CDN_FALLBACK_LIST || [
                    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
                    'https://unpkg.com/@supabase/supabase-js@2',
                    'https://cdnjs.cloudflare.com/ajax/libs/supabase-js/2.39.0/umd/supabase.js'
                ];
                
                let loaded = false;
                
                for (let i = 0; i < cdnList.length; i++) {
                    try {
                        console.log(`🔄 尝试 CDN ${i + 1}/${cdnList.length}: ${cdnList[i]}`);
                        await this._loadScriptWithTimeout(cdnList[i], 8000);
                        loaded = true;
                        console.log(`✅ CDN ${i + 1} 加载成功`);
                        break;
                    } catch (error) {
                        console.warn(`⚠️ CDN ${i + 1} 加载失败:`, error.message);
                        if (i < cdnList.length - 1) {
                            console.log(`🔄 切换到下一个 CDN...`);
                        }
                    }
                }
                
                if (!loaded) {
                    throw new Error('所有 CDN 源均无法访问，请检查网络或配置代理');
                }
            }
            
            if (window.supabase && window.supabase.createClient) {
                // 使用代理后的 URL（如果有代理）或原始 URL
                const effectiveUrl = this.supabaseUrl;
                
                // ⭐ 创建带超时和重试的 fetch 包装器
                const enhancedFetch = this._createEnhancedFetch();
                
                this.supabaseClient = window.supabase.createClient(
                    effectiveUrl, 
                    this.supabaseAnonKey,
                    {
                        auth: {
                            autoRefreshToken: true,
                            persistSession: true,
                            detectSessionInUrl: true
                        },
                        fetch: enhancedFetch  // 使用增强版 fetch
                    }
                );
                
                if (this.proxyUrl) {
                    console.log('✅ Supabase 客户端初始化成功（通过代理）');
                    console.log(`   代理地址: ${this.proxyUrl}`);
                    
                    // ⭐ 测试代理连接是否可用
                    const proxyConnected = await this._testProxyConnection();
                    if (!proxyConnected) {
                        console.warn('⚠️ 代理连接测试失败，尝试直连模式...');
                        
                        // 尝试切换到直连模式
                        this.proxyUrl = '';
                        this.supabaseUrl = this.supabaseOriginalUrl;
                        
                        try {
                            this.supabaseClient = window.supabase.createClient(
                                this.supabaseUrl,
                                this.supabaseAnonKey,
                                {
                                    auth: {
                                        autoRefreshToken: true,
                                        persistSession: true,
                                        detectSessionInUrl: true
                                    },
                                    fetch: this._createEnhancedFetch()
                                }
                            );
                            console.log('✅ 已切换到直连模式（需要 VPN/代理）');
                        } catch (directError) {
                            console.error('❌ 直连模式也失败:', directError.message);
                            console.warn('⚠️ 将使用纯本地模式运行');
                            this.supabaseClient = null;
                            return false;
                        }
                    }
                } else {
                    console.log('✅ Supabase 客户端初始化成功（直连模式）');
                }
                
                return true;
            } else {
                throw new Error('Supabase SDK 加载完成但 API 不可用');
            }
        } catch (error) {
            console.error('❌ Supabase 初始化失败:', error.message);
            console.error('💡 可能的原因:');
            
            if (!this.proxyUrl) {
                console.error('   1. 未配置 Cloudflare Worker 代理（国内必需）');
                console.error('      → 请在 config.js 中设置 PROXY_URL');
                console.error('      → 参考文档：cloudflare-worker.js');
            } else {
                console.error('   1. 网络无法访问代理服务器');
                console.error('      → 检查 PROXY_URL 是否正确');
                console.error('      → 确认 Worker 已部署并正常运行');
            }
            
            console.error('   2. 所有 CDN 源均无法访问');
            console.error('      → 尝试开启 VPN/代理');
            console.error('      → 或切换 DNS 为 8.8.8.8');
            console.error('');
            console.error('📌 当前模式：纯本地存储（数据保存在浏览器中）');
        }
        
        return false;
    }

    /**
     * 带超时的脚本加载器
     */
    _loadScriptWithTimeout(src, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            
            const timer = setTimeout(() => {
                reject(new Error(`加载超时 (${timeoutMs}ms): ${src}`));
                script.remove();
            }, timeoutMs);
            
            script.onload = () => {
                clearTimeout(timer);
                resolve();
            };
            
            script.onerror = (e) => {
                clearTimeout(timer);
                reject(new Error(`脚本加载错误: ${src} - ${e.type}`));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * 创建增强版 fetch（带超时、重试和错误处理）
     * 
     * 解决问题：
     * 1. Worker 代理连接不稳定导致 ERR_CONNECTION_CLOSED
     * 2. Supabase 响应慢导致请求挂起
     * 3. 网络波动导致的临时性失败
     */
    _createEnhancedFetch() {
        const self = this;
        const TIMEOUT_MS = 15000;  // 15秒超时
        const MAX_RETRIES = 2;     // 最大重试次数
        
        return async function enhancedFetch(url, options = {}) {
            let lastError = null;
            
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    // ⏱️ 添加超时控制
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
                    
                    console.log(`🌐 [API] 请求 ${attempt + 1}/${MAX_RETRIES + 1}: ${url}`);
                    
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // ✅ 成功响应
                    if (response.ok) {
                        console.log(`✅ [API] 请求成功: ${response.status}`);
                        return response;
                    }
                    
                    // ❌ HTTP 错误（但不重试 4xx 客户端错误）
                    if (response.status >= 400 && response.status < 500) {
                        console.warn(`⚠️ [API] 客户端错误 ${response.status}: ${url}`);
                        return response;
                    }
                    
                    // ⚠️ 5xx 服务器错误，可以重试
                    console.warn(`⚠️ [API] 服务器错误 ${response.status}，准备重试...`);
                    lastError = new Error(`HTTP ${response.status}`);
                    
                } catch (error) {
                    clearTimeout(timeoutId);
                    lastError = error;
                    
                    // 🔄 判断是否可重试
                    const isRetryable = 
                        error.name === 'AbortError' ||           // 超时
                        error.message?.includes('Failed to fetch') ||  // 连接失败
                        error.message?.includes('NetworkError') ||    // 网络错误
                        error.message?.includes('ERR_CONNECTION');    // 连接关闭
                    
                    if (!isRetryable) {
                        console.error('❌ [API] 不可重试的错误:', error.message);
                        throw error;
                    }
                    
                    if (attempt < MAX_RETRIES) {
                        console.warn(`⚠️ [API] 请求失败 (${error.message})，${1}s 后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            // 💥 所有重试都失败
            console.error('❌ [API] 所有重试均失败:', lastError?.message);
            throw lastError || new Error('请求失败');
        };
    }

    /**
     * 测试代理连接是否可用
     * 通过发送一个简单的健康检查请求来验证 Worker 代理是否正常工作
     * 
     * @returns {Promise<boolean>} 连接是否成功
     */
    async _testProxyConnection() {
        if (!this.supabaseClient) return false;
        
        console.log('🔍 测试代理连接...');
        
        try {
            // 发送一个简单的查询（只查表结构，不查数据）
            const { error } = await this.supabaseClient
                .from(this.TABLES.BUY_RECORDS)
                .select('id')
                .limit(1);
            
            if (error) {
                console.warn('⚠️ 代理连接测试失败:', error.message);
                return false;
            }
            
            console.log('✅ 代理连接测试通过');
            return true;
            
        } catch (error) {
            console.warn('⚠️ 代理连接异常:', error.message);
            return false;
        }
    }

    /**
     * 启动智能同步（云端优先策略）
     * 
     * 核心逻辑：
     * - 登录后 → 从云端下载最新数据 → 覆盖 localStorage
     * - 本地新增/修改 → 上传到云端备份
     */
    async _startSmartSync() {
        console.log('🔄 启动云端同步...');
        
        try {
            // ⭐ 检查用户是否已登录（统一使用 _isUserLoggedIn 方法）
            const isLoggedIn = await this._isUserLoggedIn();
            
            if (isLoggedIn) {
                // 获取用户信息用于日志
                let userInfo = '已登录用户';
                if (window.authManager && window.authManager.user) {
                    userInfo = window.authManager.user.email || window.authManager.user.username || window.authManager.user.id;
                }
                
                console.log(`✅ 用户已登录: ${userInfo}`);
                
                // 记录登录时间戳（用于区分登录前后的数据）
                if (!this.loginTimestamp) {
                    this.loginTimestamp = new Date().toISOString();
                    localStorage.setItem(this.STORAGE_PREFIX + 'login_timestamp', this.loginTimestamp);
                    console.log(`🕐 登录时间已记录: ${this.loginTimestamp}`);
                }
                    
                    // 1️⃣ 检查是否有本地数据需要覆盖
                    const hasLocalData = this.buyRecords.length > 0 || this.historyRecords.length > 0;
                    
                    let shouldDownloadFromCloud = true;
                    
                    if (hasLocalData) {
                        console.log('⚠️ 检测到本地数据，需要用户确认是否使用云端数据覆盖');
                        
                        shouldDownloadFromCloud = await new Promise((resolve) => {
                            const message = `检测到本地数据：\n` +
                                `• 买入记录：${this.buyRecords.length} 条\n` +
                                `• 计算记录：${this.historyRecords.length} 条\n\n` +
                                `登录后将从云端下载数据，本地未登录时添加的数据将被清除。\n\n` +
                                `是否继续？`;
                            
                            if (confirm(message)) {
                                console.log('✅ 用户同意使用云端数据覆盖本地数据');
                                resolve(true);
                            } else {
                                console.log('❌ 用户取消，保留本地数据');
                                resolve(false);
                            }
                        });
                    }
                    
                    // 2️⃣ 从云端下载最新数据（覆盖模式）
                    if (shouldDownloadFromCloud) {
                        console.log('📥 从云端加载最新数据...');
                        await this._downloadFromCloud();
                        console.log(`✅ 云端数据已覆盖:`);
                        console.log(`   - 买入记录: ${this.buyRecords.length} 条`);
                        console.log(`   - 历史记录: ${this.historyRecords.length} 条`);
                        
                        // 保存到 localStorage（更新本地缓存）
                        this._saveToLocalStorage();
                        console.log('💾 云端数据已保存到本地缓存');
                    }
                    
                    // 3️⃣ 启动定时同步（后续变更自动同步）
                    this._startPeriodicSync();
                } else {
                    console.log('⚠️ 用户未登录 - 仅使用本地缓存数据');
                    console.log('💡 登录后可启用云同步功能');
                    console.log('📝 本地数据不会同步到云端');
                }
                
                if (!this.supabaseClient) {
                    console.log('⚠️ 未连接到云端，使用本地数据');
                }
            
            // 触发 UI 更新事件
            window.dispatchEvent(new CustomEvent('dataLoaded', { 
                detail: {
                    buyRecordsCount: this.buyRecords.length,
                    historyRecordsCount: this.historyRecords.length,
                    dataSource: this.supabaseClient ? 'cloud' : 'local'
                }
            }));
            
        } catch (error) {
            console.error('❌ 云端同步失败:', error);
            console.log('⚠️ 使用本地缓存数据');
        }
    }

    /**
     * 检查用户是否已登录
     * @returns {Promise<boolean>} 是否已登录
     */
    async _isUserLoggedIn() {
        if (!this.supabaseClient) return false;
        
        try {
            // ⭐ 优先检查 AuthManager 的登录状态（解决双客户端 Session 不共享问题）
            if (window.authManager && window.authManager.isAuthenticated && window.authManager.isAuthenticated()) {
                console.log('✅ 通过 AuthManager 确认用户已登录');
                return true;
            }
            
            // 备用：通过自己的客户端检查 session
            const { data: { session } } = await this.supabaseClient.auth.getSession();
            
            if (session?.user) {
                console.log('✅ 通过 StorageManager Session 确认用户已登录');
                return true;
            }
            
            console.log('⚠️ 用户未登录（两个客户端均未检测到有效 Session）');
            return false;
        } catch (error) {
            console.warn('检查登录状态失败:', error.message);
            return false;
        }
    }

    /**
     * 启动定时同步（仅已登录用户）
     */
    _startPeriodicSync() {
        // 定时上传本地变更到云端（每5分钟）
        setInterval(() => {
            if (this.syncStatus.pendingChanges) {
                this._incrementalUploadToCloud();
            }
        }, 5 * 60 * 1000);
        
        // 页面关闭前最后同步
        window.addEventListener('beforeunload', () => {
            if (this.syncStatus.pendingChanges && navigator.sendBeacon) {
                this._incrementalUploadToCloud(true);
            }
        });
    }

    /**
     * 从云端下载数据（完全覆盖模式）
     * 
     * 登录后使用云端数据完全覆盖本地数据
     * 本地未登录时的数据将被清除
     */
    async _downloadFromCloud() {
        if (!this.supabaseClient) {
            console.warn('⚠️ Supabase 未连接');
            return;
        }
        
        console.log('☁️ 开始从云端下载（覆盖模式）...');
        
        try {
            const [buyRes, historyRes, configRes] = await Promise.all([
                this.supabaseClient.from(this.TABLES.BUY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.HISTORY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.CONFIG)
                    .select('*').eq('id', 1).single()
            ]);
            
            // ===== 完全覆盖买入记录 =====
            if (buyRes.data?.length > 0) {
                const cloudBuyRecords = buyRes.data.map(r => ({
                    id: r.id,
                    date: r.buy_time,
                    usdAmount: parseFloat(r.usd_amount),
                    buyRate: parseFloat(r.buy_rate),
                    costCNY: parseFloat(r.cost_cny || (r.usd_amount * r.buy_rate)),
                    createdAt: r.created_at,
                    updatedAt: r.updated_at
                }));
                
                this.buyRecords = cloudBuyRecords;
                console.log(`📥 云端买入记录已加载（${this.buyRecords.length} 条）`);
            } else {
                this.buyRecords = [];
                console.log('📥 云端无买入记录，本地记录已清空');
            }
            
            // ===== 完全覆盖历史记录 =====
            if (historyRes.data?.length > 0) {
                const cloudHistoryRecords = historyRes.data.map(r => ({
                    id: r.id,
                    queryTime: r.query_time,
                    financeROI: parseFloat(r.finance_roi),
                    financeProfitUSD: parseFloat(r.finance_profit_usd),
                    totalProfitCNY: parseFloat(r.total_profit_cny),
                    totalROI: parseFloat(r.total_roi),
                    currentRate: parseFloat(r.current_rate),
                    rateProfitCNY: parseFloat(r.rate_profit_cny),
                    currentHoldUSD: parseFloat(r.current_hold_usd),
                    createdAt: r.created_at
                }));
                
                this.historyRecords = cloudHistoryRecords;
                console.log(`📥 云端历史记录已加载（${this.historyRecords.length} 条）`);
            } else {
                this.historyRecords = [];
                console.log('📥 云端无历史记录，本地记录已清空');
            }
            
            // 下载配置（配置直接覆盖即可）
            if (configRes.data) {
                this.config = {
                    id: configRes.data.id,
                    currentHoldUSD: parseFloat(configRes.data.current_hold_usd),
                    currentRate: parseFloat(configRes.data.current_rate),
                    lastUpdate: configRes.data.last_update
                };
                console.log('📥 下载系统配置');
            }
            
            // 保存到 localStorage
            this._saveToLocalStorage();
            
            console.log('✅ 云端数据智能合并完成');
            
        } catch (error) {
            console.error('❌ 下载/合并失败:', error);
            throw error;
        }
    }

    /**
     * 智能合并两条记录列表
     * @param {Array} localRecords - 本地记录
     * @param {Array} cloudRecords - 云端记录  
     * @param {string} timeField - 用于比较更新时间的字段名
     * @returns {Array} 合并后的记录列表
     */
    _mergeRecords(localRecords, cloudRecords, timeField = 'createdAt') {
        const mergedMap = new Map();
        
        // 先添加所有云端记录
        cloudRecords.forEach(record => {
            mergedMap.set(record.id, record);
        });
        
        // 再用本地记录覆盖（如果本地更新的话）
        localRecords.forEach(localRecord => {
            const cloudRecord = mergedMap.get(localRecord.id);
            
            if (!cloudRecord) {
                // 本地独有的记录，添加到结果中
                mergedMap.set(localRecord.id, localRecord);
            } else {
                // 两边都有，比较时间戳，保留更新的
                const localTime = new Date(localRecord[timeField] || localRecord.createdAt).getTime();
                const cloudTime = new Date(cloudRecord[timeField] || cloudRecord.createdAt).getTime();
                
                if (localTime >= cloudTime) {
                    mergedMap.set(localRecord.id, localRecord);
                } else {
                    mergedMap.set(cloudRecord.id, cloudRecord);
                }
            }
        });
        
        return Array.from(mergedMap.values());
    }

    /**
     * 增量上传到云端（只上传本地数据）
     * 使用 upsert 确保幂等性
     */
    async _incrementalUploadToCloud(force = false) {
        if (!this.supabaseClient) {
            return;
        }
        
        if (this.syncStatus.isSyncing && !force) {
            return;
        }
        
        this.syncStatus.isSyncing = true;
        console.log('📤 增量同步到云端（仅登录后的新数据）...');
        
        try {
            // 只同步登录后的新数据到云端
            await this._syncNewRecordsToCloud();
            
            // 上传配置
            await this._uploadConfig();
            
            this.syncStatus.lastSync = new Date().toISOString();
            console.log('✅ 增量同步完成');
            
        } catch (error) {
            console.error('❌ 同步失败:', error);
        } finally {
            this.syncStatus.isSyncing = false;
        }
    }

    /**
     * 只同步登录后的新数据到云端（排除登录前的本地数据）
     */
    async _syncNewRecordsToCloud() {
        if (!this.supabaseClient || !this.loginTimestamp) {
            console.log('⏭️ 跳过同步：未登录或无登录时间戳');
            return;
        }
        
        const loginTime = new Date(this.loginTimestamp).getTime();
        
        // 筛选登录后新增的买入记录
        const newBuyRecords = this.buyRecords.filter(r => {
            const recordTime = new Date(r.createdAt).getTime();
            return recordTime >= loginTime;
        });
        
        // 筛选登录后新增的历史记录
        const newHistoryRecords = this.historyRecords.filter(r => {
            const recordTime = new Date(r.createdAt).getTime();
            return recordTime >= loginTime;
        });
        
        if (newBuyRecords.length === 0 && newHistoryRecords.length === 0) {
            console.log('⏭️ 没有需要同步的新数据（登录后未添加新记录）');
            return;
        }
        
        console.log(`📤 准备同步登录后的新数据:`);
        console.log(`   - 新增买入记录: ${newBuyRecords.length} 条`);
        console.log(`   - 新增历史记录: ${newHistoryRecords.length} 条`);
        
        try {
            if (newBuyRecords.length > 0) {
                await this._uploadSpecificBuyRecords(newBuyRecords);
            }
            if (newHistoryRecords.length > 0) {
                await this._uploadSpecificHistoryRecords(newHistoryRecords);
            }
            
            console.log('✅ 登录后的新数据已同步到云端');
            this.syncStatus.pendingChanges = false;
            this.syncStatus.lastSync = new Date().toISOString();
        } catch (error) {
            console.warn('⚠️ 新数据同步失败:', error.message);
            this.syncStatus.pendingChanges = true;
        }
    }

    /**
     * 上传指定的买入记录到云端
     */
    async _uploadSpecificBuyRecords(records) {
        if (!this.supabaseClient || records.length === 0) return;
        
        try {
            const recordsForDB = records.map(r => ({
                id: r.id,
                buy_time: r.date,
                usd_amount: r.usdAmount,
                buy_rate: r.buyRate,
                created_at: r.createdAt,
                updated_at: r.updatedAt
            }));
            
            const { error } = await this.supabaseClient
                .from(this.TABLES.BUY_RECORDS)
                .upsert(recordsForDB, { onConflict: 'id' });
            
            if (error) throw error;
            console.log(`📤 买入记录已同步 (${recordsForDB.length} 条)`);
            
        } catch (error) {
            console.warn('⚠️ 买入记录同步失败:', error.message);
        }
    }

    /**
     * 上传指定的历史记录到云端
     */
    async _uploadSpecificHistoryRecords(records) {
        if (!this.supabaseClient || records.length === 0) return;
        
        try {
            const recordsForDB = records.map(r => ({
                id: r.id,
                query_time: r.queryTime,
                finance_roi: r.financeROI,
                finance_profit_usd: r.financeProfitUSD,
                total_profit_cny: r.totalProfitCNY,
                total_roi: r.totalROI,
                current_rate: r.currentRate,
                rate_profit_cny: r.rateProfitCNY,
                current_hold_usd: r.currentHoldUSD,
                created_at: r.createdAt
            }));
            
            const { error } = await this.supabaseClient
                .from(this.TABLES.HISTORY_RECORDS)
                .upsert(recordsForDB, { onConflict: 'id' });
            
            if (error) throw error;
            console.log(`📤 历史记录已同步 (${recordsForDB.length} 条)`);
            
        } catch (error) {
            console.warn('⚠️ 历史记录同步失败:', error.message);
        }
    }

    /**
     * 上传配置到云端
     */
    async _uploadConfig() {
        if (!this.supabaseClient || !this.config) return;
        
        try {
            const configForDB = {
                id: this.config.id || 1,
                current_hold_usd: this.config.currentHoldUSD,
                current_rate: this.config.currentRate,
                last_update: this.config.lastUpdate || new Date().toISOString()
            };
            
            const { error } = await this.supabaseClient
                .from(this.TABLES.CONFIG)
                .upsert(configForDB, { onConflict: 'id' });
            
            if (error) throw error;
            console.log('📤 配置已同步');
            
        } catch (error) {
            console.warn('⚠️ 配置同步失败:', error.message);
        }
    }

    // ==================== 买入记录操作 ====================

    /**
     * 添加买入记录
     */
    async addBuyRecord(record) {
        const newRecord = {
            id: Date.now(),
            date: record.date,
            usdAmount: parseFloat(record.usdAmount),
            buyRate: parseFloat(record.buyRate),
            costCNY: parseFloat((record.usdAmount * record.buyRate).toFixed(2)),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 保存到 localStorage（立即生效）
        this.buyRecords.unshift(newRecord);
        this._saveToLocalStorage();
        
        // 标记需要同步
        this.syncStatus.pendingChanges = true;
        
        console.log('✅ 添加买入记录:', newRecord);
        
        // 立即同步到云端（仅已登录用户）
        if (this.supabaseClient && await this._isUserLoggedIn()) {
            try {
                await this._incrementalUploadToCloud(true);
                console.log('📤 买入记录已立即同步到云端');
            } catch (error) {
                console.warn('⚠️ 立即同步失败，将在后台重试:', error.message);
            }
        }
        
        return newRecord;
    }

    /**
     * 获取所有买入记录
     */
    getBuyRecords() {
        return [...this.buyRecords].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }

    /**
     * 删除买入记录
     */
    async deleteBuyRecords(ids) {
        this.buyRecords = this.buyRecords.filter(record => !ids.includes(record.id));
        this._saveToLocalStorage();
        this.syncStatus.pendingChanges = true;
        
        console.log(`🗑️ 删除 ${ids.length} 条买入记录`);
        return true;
    }

    /**
     * 获取统计信息
     */
    getBuyStats() {
        const totalUSD = this.buyRecords.reduce((sum, r) => sum + r.usdAmount, 0);
        const totalCNY = this.buyRecords.reduce((sum, r) => sum + r.costCNY, 0);
        const avgRate = totalUSD > 0 ? totalCNY / totalUSD : null;
        
        return {
            totalHoldingUSD: parseFloat(totalUSD.toFixed(2)),
            totalCostCNY: parseFloat(totalCNY.toFixed(2)),
            avgCostRate: avgRate ? parseFloat(avgRate.toFixed(4)) : null
        };
    }

    // ==================== 历史记录操作 ====================

    /**
     * 添加历史记录
     */
    async addHistoryRecord(record) {
        const newRecord = {
            id: Date.now(),
            queryTime: record.queryTime,
            financeROI: parseFloat(record.financeROI),
            financeProfitUSD: parseFloat(record.financeProfitUSD),
            totalProfitCNY: parseFloat(record.totalProfitCNY),
            totalROI: parseFloat(record.totalROI),
            currentRate: parseFloat(record.currentRate),
            rateProfitCNY: parseFloat(record.rateProfitCNY),
            currentHoldUSD: parseFloat(record.currentHoldUSD),
            createdAt: new Date().toISOString()
        };
        
        this.historyRecords.unshift(newRecord);
        this._saveToLocalStorage();
        this.syncStatus.pendingChanges = true;
        
        console.log('✅ 添加历史记录:', newRecord);
        console.log('🔍 开始云端同步诊断...');
        console.log(`   - Supabase 客户端状态: ${this.supabaseClient ? '✅ 已初始化' : '❌ 未初始化'}`);
        
        const isLoggedIn = await this._isUserLoggedIn();
        console.log(`   - 用户登录状态: ${isLoggedIn ? '✅ 已登录' : '❌ 未登录'}`);
        console.log(`   - 登录时间戳: ${this.loginTimestamp || '❌ 未记录'}`);
        
        if (this.supabaseClient && isLoggedIn) {
            try {
                console.log('📤 开始上传到云端...');
                await this._incrementalUploadToCloud(true);
                console.log('✅ 历史记录已立即同步到云端');
            } catch (error) {
                console.error('❌ 云端同步失败详情:', error);
                console.error('   - 错误代码:', error.code);
                console.error('   - 错误消息:', error.message);
                console.error('   - 错误详情:', error.details);
                throw error;
            }
        } else {
            const reason = !this.supabaseClient ? 'Supabase 客户端未初始化' : '用户未登录';
            console.warn(`⚠️ 跳过云端同步: ${reason}`);
            console.warn('💡 数据仅保存在本地浏览器中');
            
            throw new Error(`云端同步失败: ${reason}。数据已保存到本地。`);
        }
        
        return newRecord;
    }

    /**
     * 获取所有历史记录
     */
    getHistoryRecords() {
        return [...this.historyRecords].sort((a, b) => 
            new Date(b.queryTime) - new Date(a.queryTime)
        );
    }

    /**
     * 删除历史记录
     */
    async deleteHistoryRecords(ids) {
        this.historyRecords = this.historyRecords.filter(record => !ids.includes(record.id));
        this._saveToLocalStorage();
        this.syncStatus.pendingChanges = true;
        
        console.log(`🗑️ 删除 ${ids.length} 条历史记录`);
        return true;
    }

    // ==================== 配置操作 ====================

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig,
            lastUpdate: new Date().toISOString()
        };
        this._saveToLocalStorage();
        this.syncStatus.pendingChanges = true;
        
        console.log('✅ 配置已更新:', this.config);
        return this.config;
    }

    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }

    // ==================== 公共方法 ====================

    /**
     * 获取同步状态
     */
    getSyncStatus() {
        return {
            ...this.syncStatus,
            hasSupabase: !!this.supabaseClient,
            localDataCount: {
                buyRecords: this.buyRecords.length,
                historyRecords: this.historyRecords.length
            }
        };
    }

    /**
     * 手动触发同步
     */
    async forceSync() {
        console.log('🔄 手动触发同步...');
        await this._incrementalUploadToCloud(true);
    }

    /**
     * 清除所有本地数据（危险操作）
     */
    clearAllLocalData() {
        this.buyRecords = [];
        this.historyRecords = [];
        this.config = {
            id: 1,
            currentHoldUSD: 0,
            currentRate: 0,
            lastUpdate: null
        };
        
        localStorage.removeItem(this.STORAGE_PREFIX + this.TABLES.BUY_RECORDS);
        localStorage.removeItem(this.STORAGE_PREFIX + this.TABLES.HISTORY_RECORDS);
        localStorage.removeItem(this.STORAGE_PREFIX + this.TABLES.CONFIG);
        
        console.log('⚠️ 所有本地数据已清除');
    }
}

// 全局实例
const storageManager = new StorageManager();

// 导出到全局作用域
window.storageManager = storageManager;

/**
 * StorageManager v4.0 - 离线优先 + 防抖批量同步
 * 
 * 核心设计：
 * 1. 离线优先：所有操作先写 localStorage，UI 瞬间响应 (<10ms)
 * 2. 防抖批量同步：2秒内多次操作合并为1次 HTTP 请求
 * 3. 新设备首次登录：从云端拉取数据覆盖本地
 * 4. 直连 Supabase：不再通过 Cloudflare Worker 代理
 */

class StorageManager {
    constructor() {
        this.supabaseUrl = window.SUPABASE_URL;
        this.supabaseAnonKey = window.SUPABASE_ANON_KEY;
        this.supabaseClient = null;

        // localStorage 键名
        this.STORAGE_PREFIX = 'usd_tracker_';
        this.KEYS = {
            BUY_RECORDS: this.STORAGE_PREFIX + 'buy_records',
            HISTORY_RECORDS: this.STORAGE_PREFIX + 'history_records',
            CONFIG: this.STORAGE_PREFIX + 'config',
            SYNC_META: this.STORAGE_PREFIX + 'sync_meta'
        };

        // 数据
        this.buyRecords = [];
        this.historyRecords = [];
        this.config = { currentHoldUSD: 0, currentRate: 0, lastUpdate: null };

        // 防抖同步
        this._syncTimer = null;
        this._syncDelay = 2000; // 2秒防抖
        this._isSyncing = false;

        // 初始化
        this.init();
    }

    // ==================== 初始化 ====================

    async init() {
        console.log('📦 StorageManager v4.0 初始化（离线优先）...');

        // 1. 从 localStorage 加载数据（瞬间完成）
        this._loadFromLocalStorage();
        console.log(`📥 本地数据已加载: ${this.buyRecords.length} 条买入, ${this.historyRecords.length} 条历史`);

        // 2. 初始化 Supabase 客户端（复用 AuthManager 的实例）
        await this._initSupabase();

        // 3. 如果已登录，从云端拉取最新数据
        if (this.supabaseClient) {
            const userId = await this._getUserIdAsync();
            if (userId) {
                await this._fetchCloudConfig(userId);
            }
        }

        // 4. 通知 UI
        window.dispatchEvent(new CustomEvent('dataLoaded', {
            detail: {
                buyRecordsCount: this.buyRecords.length,
                historyRecordsCount: this.historyRecords.length,
                cloudConnected: !!this.supabaseClient
            }
        }));

        console.log('✅ StorageManager 初始化完成');
    }

    /**
     * 初始化 Supabase 客户端
     * 优先复用 AuthManager 的客户端，避免双客户端 session 不共享
     */
    async _initSupabase() {
        // 复用 AuthManager 的客户端
        if (window.authManager?.supabaseClient) {
            this.supabaseClient = window.authManager.supabaseClient;
            console.log('✅ 复用 AuthManager 的 Supabase 客户端');
            return;
        }

        // 如果 AuthManager 还没初始化，自己创建
        if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
            console.warn('⚠️ Supabase 配置缺失，使用纯本地模式');
            return;
        }

        // 等待 SDK 加载
        if (typeof window.supabase === 'undefined') {
            console.log('📦 等待 Supabase SDK 加载...');
            await this._waitForSDK();
        }

        if (window.supabase?.createClient) {
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
            console.log('✅ Supabase 客户端初始化成功（直连模式）');
        } else {
            console.warn('⚠️ Supabase SDK 不可用，使用纯本地模式');
        }
    }

    /**
     * 等待 Supabase SDK 加载（最多等 5 秒）
     */
    _waitForSDK() {
        return new Promise((resolve) => {
            let elapsed = 0;
            const interval = setInterval(() => {
                elapsed += 200;
                if (window.supabase?.createClient || elapsed >= 5000) {
                    clearInterval(interval);
                    resolve();
                }
            }, 200);
        });
    }

    // ==================== localStorage 读写 ====================

    _loadFromLocalStorage() {
        try {
            const buyData = localStorage.getItem(this.KEYS.BUY_RECORDS);
            const historyData = localStorage.getItem(this.KEYS.HISTORY_RECORDS);
            const configData = localStorage.getItem(this.KEYS.CONFIG);

            this.buyRecords = buyData ? JSON.parse(buyData) : [];
            this.historyRecords = historyData ? JSON.parse(historyData) : [];
            this.config = configData ? JSON.parse(configData) : { currentHoldUSD: 0, currentRate: 0, lastUpdate: null };
        } catch (e) {
            console.error('❌ 加载本地数据失败:', e);
            this.buyRecords = [];
            this.historyRecords = [];
        }
    }

    _saveToLocalStorage() {
        try {
            localStorage.setItem(this.KEYS.BUY_RECORDS, JSON.stringify(this.buyRecords));
            localStorage.setItem(this.KEYS.HISTORY_RECORDS, JSON.stringify(this.historyRecords));
            localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(this.config));
        } catch (e) {
            console.error('❌ 保存本地数据失败:', e);
        }
    }

    // ==================== 防抖批量同步 ====================

    /**
     * 标记脏数据，2秒防抖后统一同步
     * 核心优化：多次操作合并为1次 HTTP 请求
     */
    _markDirty() {
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
        }
        this._syncTimer = setTimeout(() => {
            this._syncToCloud();
        }, this._syncDelay);
    }

    /**
     * 将本地全量数据一次性同步到 Supabase
     * 使用 RPC 函数 update_user_config_full，1次 HTTP 请求完成
     */
    async _syncToCloud() {
        const userId = await this._getUserIdAsync();
        if (!userId || !this.supabaseClient) {
            console.log('⏭️ 跳过同步：未登录或无客户端');
            return;
        }

        if (this._isSyncing) {
            // 正在同步，延迟重试
            this._markDirty();
            return;
        }

        this._isSyncing = true;
        console.log('📤 开始同步到云端（防抖批量）...');

        try {
            const { data, error } = await this.supabaseClient.rpc('update_user_config_full', {
                p_user_id: userId,
                p_buy_records: this.buyRecords.map(r => ({
                    date: r.date,
                    usdAmount: r.usdAmount,
                    buyRate: r.buyRate,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt
                })),
                p_history_records: this.historyRecords.map(r => ({
                    queryTime: r.queryTime,
                    financeROI: r.financeROI,
                    financeProfitUSD: r.financeProfitUSD,
                    totalProfitCNY: r.totalProfitCNY,
                    totalROI: r.totalROI,
                    currentRate: r.currentRate,
                    rateProfitCNY: r.rateProfitCNY,
                    currentHoldUSD: r.currentHoldUSD,
                    createdAt: r.createdAt
                })),
                p_config: {
                    currentHoldUSD: this.config.currentHoldUSD,
                    currentRate: this.config.currentRate,
                    lastUpdate: this.config.lastUpdate || new Date().toISOString()
                }
            });

            if (error) throw error;

            // 标记已同步
            this._updateSyncMeta('synced');
            console.log('✅ 同步成功:', data);

        } catch (error) {
            console.warn('⚠️ 同步失败（静默，下次再试）:', error.message);
            this._updateSyncMeta('failed');
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * 更新同步元数据
     */
    _updateSyncMeta(status) {
        try {
            const meta = JSON.parse(localStorage.getItem(this.KEYS.SYNC_META) || '{}');
            meta.lastSyncStatus = status;
            meta.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.SYNC_META, JSON.stringify(meta));
        } catch (e) { /* ignore */ }
    }

    // ==================== 新设备首次登录：从云端拉取 ====================

    /**
     * 从 Supabase 拉取用户数据，覆盖本地 localStorage
     * 仅在首次登录或手动刷新时调用
     */
    async _fetchCloudConfig(userId) {
        if (!userId || !this.supabaseClient) return;

        console.log('☁️ 从云端拉取用户数据...');

        try {
            const [buyRes, historyRes, configRes] = await Promise.all([
                this.supabaseClient
                    .from('buy_records')
                    .select('*')
                    .eq('user_id', userId)
                    .order('id', { ascending: true }),
                this.supabaseClient
                    .from('history_records')
                    .select('*')
                    .eq('user_id', userId)
                    .order('id', { ascending: true }),
                this.supabaseClient
                    .from('config')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle()
            ]);

            // 合并策略：云端有数据则覆盖本地，云端无数据则保留本地并上传
            const hasCloudData = (buyRes.data?.length > 0) || (historyRes.data?.length > 0) || configRes.data;

            if (hasCloudData) {
                // 云端有数据 → 覆盖本地（新设备首次登录场景）
                if (buyRes.data?.length > 0) {
                    this.buyRecords = buyRes.data.map(r => ({
                        id: r.id,
                        date: r.buy_time,
                        usdAmount: parseFloat(r.usd_amount),
                        buyRate: parseFloat(r.buy_rate),
                        costCNY: parseFloat(r.cost_cny || (r.usd_amount * r.buy_rate)),
                        createdAt: r.created_at,
                        updatedAt: r.updated_at
                    }));
                    console.log(`📥 云端买入记录: ${this.buyRecords.length} 条`);
                } else {
                    this.buyRecords = [];
                }

                if (historyRes.data?.length > 0) {
                    this.historyRecords = historyRes.data.map(r => ({
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
                    console.log(`📥 云端历史记录: ${this.historyRecords.length} 条`);
                } else {
                    this.historyRecords = [];
                }

                if (configRes.data) {
                    this.config = {
                        currentHoldUSD: parseFloat(configRes.data.current_hold_usd),
                        currentRate: parseFloat(configRes.data.current_rate),
                        lastUpdate: configRes.data.last_update
                    };
                    console.log('📥 云端配置已加载');
                } else {
                    this.config = { currentHoldUSD: 0, currentRate: 0, lastUpdate: null };
                }

                console.log('✅ 云端数据已覆盖本地');
            } else {
                // 云端无数据 → 保留本地数据，并上传到云端
                console.log('📥 云端无数据，保留本地数据并上传');
                this._markDirty();
            }

            // 保存到 localStorage
            this._saveToLocalStorage();

        } catch (error) {
            console.warn('⚠️ 云端数据拉取失败（使用本地数据）:', error.message);
        }
    }

    /**
     * 手动从云端刷新数据（用户主动触发）
     */
    async refreshFromCloud() {
        const userId = await this._getUserIdAsync();
        if (!userId) {
            console.warn('⚠️ 未登录，无法从云端刷新');
            return;
        }
        await this._fetchCloudConfig(userId);
        // 通知 UI 刷新
        window.dispatchEvent(new CustomEvent('dataLoaded', {
            detail: {
                buyRecordsCount: this.buyRecords.length,
                historyRecordsCount: this.historyRecords.length,
                cloudConnected: !!this.supabaseClient
            }
        }));
    }

    // ==================== 用户登录/登出回调 ====================

    /**
     * 用户登录后调用：从云端拉取数据
     */
    async onUserLogin(userId) {
        console.log(`🔐 用户登录，拉取云端数据: ${userId}`);
        await this._fetchCloudConfig(userId);
    }

    /**
     * 用户登出后调用：清除云端关联，保留本地数据
     */
    onUserLogout() {
        console.log('👋 用户登出，保留本地数据');
        // 取消待执行的同步
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
            this._syncTimer = null;
        }
    }

    // ==================== 获取当前用户 ID ====================

    async _getUserIdAsync() {
        // 优先从 AuthManager 获取
        if (window.authManager?.isAuthenticated?.()) {
            return window.authManager.user?.id || null;
        }
        // 备用：从 Supabase session 异步获取
        if (this.supabaseClient) {
            try {
                const { data } = await this.supabaseClient.auth.getSession();
                return data?.session?.user?.id || null;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    _getUserId() {
        // 同步版本：仅从 AuthManager 获取
        if (window.authManager?.isAuthenticated?.()) {
            return window.authManager.user?.id || null;
        }
        return null;
    }

    // ==================== 买入记录操作 ====================

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

        // 1. 立即写入 localStorage
        this.buyRecords.unshift(newRecord);
        this._saveToLocalStorage();

        // 2. 标记脏数据，2秒防抖后同步
        this._markDirty();

        console.log('✅ 买入记录已添加（本地即时，云端防抖）');
        return newRecord;
    }

    getBuyRecords() {
        return [...this.buyRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async deleteBuyRecords(ids) {
        this.buyRecords = this.buyRecords.filter(r => !ids.includes(r.id));
        this._saveToLocalStorage();
        this._markDirty();
        console.log(`🗑️ 删除 ${ids.length} 条买入记录`);
        return true;
    }

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

        // 1. 立即写入 localStorage
        this.historyRecords.unshift(newRecord);
        this._saveToLocalStorage();

        // 2. 标记脏数据，2秒防抖后同步
        this._markDirty();

        console.log('✅ 历史记录已添加（本地即时，云端防抖）');
        return newRecord;
    }

    getHistoryRecords() {
        return [...this.historyRecords].sort((a, b) => new Date(b.queryTime) - new Date(a.queryTime));
    }

    async deleteHistoryRecords(ids) {
        this.historyRecords = this.historyRecords.filter(r => !ids.includes(r.id));
        this._saveToLocalStorage();
        this._markDirty();
        console.log(`🗑️ 删除 ${ids.length} 条历史记录`);
        return true;
    }

    // ==================== 配置操作 ====================

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig, lastUpdate: new Date().toISOString() };
        this._saveToLocalStorage();
        this._markDirty();
        return this.config;
    }

    getConfig() {
        return { ...this.config };
    }

    // ==================== 公共方法 ====================

    getSyncStatus() {
        const meta = JSON.parse(localStorage.getItem(this.KEYS.SYNC_META) || '{}');
        return {
            isSyncing: this._isSyncing,
            hasPendingSync: !!this._syncTimer,
            lastSyncTime: meta.lastSyncTime,
            lastSyncStatus: meta.lastSyncStatus,
            hasSupabase: !!this.supabaseClient,
            localDataCount: {
                buyRecords: this.buyRecords.length,
                historyRecords: this.historyRecords.length
            }
        };
    }

    /**
     * 手动触发同步（立即执行，不等防抖）
     */
    async forceSync() {
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
            this._syncTimer = null;
        }
        await this._syncToCloud();
    }

    /**
     * 清除所有本地数据
     */
    clearAllLocalData() {
        this.buyRecords = [];
        this.historyRecords = [];
        this.config = { currentHoldUSD: 0, currentRate: 0, lastUpdate: null };

        localStorage.removeItem(this.KEYS.BUY_RECORDS);
        localStorage.removeItem(this.KEYS.HISTORY_RECORDS);
        localStorage.removeItem(this.KEYS.CONFIG);

        console.log('⚠️ 所有本地数据已清除');
    }
}

// 全局实例
const storageManager = new StorageManager();
window.storageManager = storageManager;

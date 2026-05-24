/**
 * StorageManager v3.1 - 云端优先混合存储架构
 * 
 * ✅ 核心设计原则：
 * - Supabase PostgreSQL = 主数据源（云端数据库）
 * - localStorage = 本地缓存（离线时使用）
 * 
 * 🔄 同步策略（云端优先）：
 * 1. 登录后 → 从云端下载最新数据 → 覆盖本地缓存
 * 2. 本地新增/修改 → 上传到云端备份
 * 3. 离线模式 → 使用 localStorage 缓存数据
 */

class StorageManager {
    constructor() {
        // Supabase 配置
        this.supabaseUrl = window.SUPABASE_URL || 'https://your-project.supabase.co';
        this.supabaseAnonKey = window.SUPABASE_ANON_KEY || 'your-anon-key';
        
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
     * 初始化存储管理器
     */
    async init() {
        console.log('📦 StorageManager v3.0 初始化...');
        
        try {
            // 1. 从 localStorage 加载数据
            this._loadFromLocalStorage();
            
            // 2. 初始化 Supabase 客户端
            await this._initSupabaseClient();
            
            // 3. 启动智能同步
            if (this.supabaseClient) {
                await this._startSmartSync();
                console.log('✅ 已启用智能云同步');
            } else {
                console.log('⚠️ 使用纯本地模式（未检测到 Supabase 配置）');
            }
        } catch (error) {
            console.error('❌ 初始化失败:', error);
        }
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
     */
    async _initSupabaseClient() {
        try {
            if (typeof window.supabase === 'undefined' && typeof window.createClient === 'undefined') {
                await this._loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
            }
            
            if (window.supabase && window.supabase.createClient) {
                this.supabaseClient = window.supabase.createClient(
                    this.supabaseUrl, 
                    this.supabaseAnonKey,
                    {
                        auth: {
                            autoRefreshToken: true,
                            persistSession: true,
                            detectSessionInUrl: true
                        }
                    }
                );
                
                console.log('✅ Supabase 客户端初始化成功');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Supabase 初始化失败:', error.message);
        }
        
        return false;
    }

    /**
     * 动态加载脚本
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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
            // ⭐ 检查用户是否已登录
            if (this.supabaseClient) {
                const { data: { session } } = await this.supabaseClient.auth.getSession();
                
                if (session?.user) {
                    console.log(`✅ 用户已登录: ${session.user.email || session.user.id}`);
                    
                    // 1️⃣ 先从云端下载最新数据并合并
                    console.log('📥 从云端加载最新数据...');
                    await this._downloadFromCloud();
                    console.log(`✅ 云端数据已合并:`);
                    console.log(`   - 买入记录: ${this.buyRecords.length} 条`);
                    console.log(`   - 历史记录: ${this.historyRecords.length} 条`);
                    
                    // 2️⃣ 将本地数据同步到云端（确保一致性）
                    if (this.syncStatus.pendingChanges || this.buyRecords.length > 0 || this.historyRecords.length > 0) {
                        console.log('📤 同步本地数据到云端...');
                        try {
                            await this._incrementalUploadToCloud(true);
                            console.log('✅ 本地数据已同步到云端');
                        } catch (error) {
                            console.warn('⚠️ 初次同步失败，将在后台重试:', error.message);
                            this.syncStatus.pendingChanges = true;
                        }
                    }
                    
                    // 3️⃣ 启动定时同步（后续变更自动同步）
                    this._startPeriodicSync();
                } else {
                    console.log('⚠️ 用户未登录 - 仅使用本地缓存数据');
                    console.log('💡 登录后可启用云同步功能');
                    console.log('📝 本地数据不会同步到云端');
                }
            } else {
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
            const { data: { session } } = await this.supabaseClient.auth.getSession();
            return !!session?.user;
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
     * 从云端下载数据（智能合并策略）
     * 
     * 修复：不再简单覆盖本地数据
     * 而是采用"最新优先"的合并策略：
     * - 本地独有的记录 → 保留
     * - 云端独有的记录 → 添加
     * - 两边都有的记录 → 保留更新时间较新的
     */
    async _downloadFromCloud() {
        if (!this.supabaseClient) {
            console.warn('⚠️ Supabase 未连接');
            return;
        }
        
        console.log('☁️ 开始从云端下载（智能合并模式）...');
        
        try {
            const [buyRes, historyRes, configRes] = await Promise.all([
                this.supabaseClient.from(this.TABLES.BUY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.HISTORY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.CONFIG)
                    .select('*').eq('id', 1).single()
            ]);
            
            // ===== 智能合并买入记录 =====
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
                
                this.buyRecords = this._mergeRecords(
                    this.buyRecords, 
                    cloudBuyRecords, 
                    'updatedAt'
                );
                console.log(`📥 合并后买入记录: ${this.buyRecords.length} 条`);
            }
            
            // ===== 智能合并历史记录 =====
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
                
                this.historyRecords = this._mergeRecords(
                    this.historyRecords, 
                    cloudHistoryRecords, 
                    'createdAt'
                );
                console.log(`📥 合并后历史记录: ${this.historyRecords.length} 条`);
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
        console.log('📤 增量同步到云端...');
        
        try {
            // 并行上传所有表
            await Promise.all([
                this._uploadBuyRecords(),
                this._uploadHistoryRecords(),
                this._uploadConfig()
            ]);
            
            this.syncStatus.lastSync = new Date().toISOString();
            this.syncStatus.pendingChanges = false;
            console.log('✅ 增量同步完成');
            
        } catch (error) {
            console.error('❌ 同步失败:', error);
        } finally {
            this.syncStatus.isSyncing = false;
        }
    }

    /**
     * 上传买入记录到云端
     */
    async _uploadBuyRecords() {
        if (!this.supabaseClient || this.buyRecords.length === 0) return;
        
        try {
            const recordsForDB = this.buyRecords.map(r => ({
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
     * 上传历史记录到云端
     */
    async _uploadHistoryRecords() {
        if (!this.supabaseClient || this.historyRecords.length === 0) return;
        
        try {
            const recordsForDB = this.historyRecords.map(r => ({
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
        
        // 立即同步到云端（仅已登录用户）
        if (this.supabaseClient && await this._isUserLoggedIn()) {
            try {
                await this._incrementalUploadToCloud(true);
                console.log('📤 历史记录已立即同步到云端');
            } catch (error) {
                console.warn('⚠️ 立即同步失败，将在后台重试:', error.message);
            }
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

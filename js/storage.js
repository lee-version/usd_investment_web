/**
 * StorageManager v2.0 - 混合存储架构
 * 
 * 架构设计：
 * ┌─────────────────────────────────────┐
 * │         用户操作 (UI)               │
 * └──────────────┬──────────────────────┘
 *                │
 *                ▼
 * ┌─────────────────────────────────────┐
 * │     localStorage (主存储)           │  ← 读写操作主要在这里
 * │     - 即时响应                       │
 * │     - 离线可用                       │
 * │     - 无需网络                       │
 * └──────────────┬──────────────────────┘
 *                │ (后台同步)
 *                ▼
 * ┌─────────────────────────────────────┐
 * │   Supabase PostgreSQL (云备份)      │  ← 异步同步到这里
 * │   - 数据持久化                      │
 * │   - 多设备同步                      │
 * │   - 灾难恢复                        │
 * └─────────────────────────────────────┘
 */

class StorageManager {
    constructor() {
        // Supabase 配置（从环境变量或全局配置获取）
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
        
        // Supabase 客户端实例（延迟初始化）
        this.supabaseClient = null;
        
        // 初始化
        this.init();
    }

    /**
     * 初始化存储管理器
     */
    async init() {
        console.log('📦 StorageManager 初始化...');
        
        // 从 localStorage 加载数据到内存缓存
        this._loadFromLocalStorage();
        
        // 尝试初始化 Supabase 客户端
        await this._initSupabaseClient();
        
        // 如果 Supabase 可用，启动自动同步
        if (this.supabaseClient) {
            this._startAutoSync();
            console.log('✅ 已启用云同步功能');
        } else {
            console.log('⚠️ 使用纯本地模式（未检测到 Supabase 配置）');
        }
    }

    /**
     * 初始化 Supabase 客户端
     */
    async _initSupabaseClient() {
        try {
            // 动态加载 Supabase 库（如果尚未加载）
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
            console.warn('⚠️ Supabase 初始化失败，将使用本地模式:', error.message);
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
     * 从 localStorage 加载数据
     */
    _loadFromLocalStorage() {
        try {
            this.buyRecords = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.BUY_RECORDS)) || [];
            this.historyRecords = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.HISTORY_RECORDS)) || [];
            this.config = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + this.TABLES.CONFIG)) || {
                id: 1,
                currentHoldUSD: 0,
                currentRate: 0,
                lastUpdate: null
            };
            
            console.log(`📥 从本地加载数据:`);
            console.log(`   - 买入记录: ${this.buyRecords.length} 条`);
            console.log(`   - 历史记录: ${this.historyRecords.length} 条`);
            console.log(`   - 系统配置: ${JSON.stringify(this.config)}`);
        } catch (error) {
            console.error('❌ 加载本地数据失败:', error);
            this.buyRecords = [];
            this.historyRecords = [];
            this.config = { id: 1, currentHoldUSD: 0, currentRate: 0, lastUpdate: null };
        }
    }

    /**
     * 保存数据到 localStorage
     */
    _saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_PREFIX + this.TABLES.BUY_RECORDS, JSON.stringify(this.buyRecords));
            localStorage.setItem(this.STORAGE_PREFIX + this.TABLES.HISTORY_RECORDS, JSON.stringify(this.historyRecords));
            localStorage.setItem(this.STORAGE_PREFIX + this.TABLES.CONFIG, JSON.stringify(this.config));
            
            // 标记有待同步的更改
            this.syncStatus.pendingChanges = true;
        } catch (error) {
            console.error('❌ 保存到本地失败:', error);
            throw error;
        }
    }

    /**
     * 启动自动同步（每5分钟同步一次）
     */
    async _startAutoSync() {
        console.log('🔄 启动自动同步...');
        
        // ⭐ 首次加载：从云端下载数据到本地（关键修复）
        try {
            await this.syncFromCloud();
            console.log('✅ 初始数据同步完成');
            
            // 触发UI更新事件
            window.dispatchEvent(new CustomEvent('dataLoaded', { 
                detail: {
                    buyRecordsCount: this.buyRecords.length,
                    historyRecordsCount: this.historyRecords.length
                }
            }));
        } catch (error) {
            console.error('❌ 初始数据同步失败:', error);
        }
        
        // 延迟上传（等待用户操作后）
        setTimeout(() => this.syncToCloud(), 5000);
        
        // 定时同步（5分钟）- 只在有变更时上传
        setInterval(() => {
            if (this.syncStatus.pendingChanges) {
                this.syncToCloud();
            }
        }, 5 * 60 * 1000);
        
        // 页面关闭前同步
        window.addEventListener('beforeunload', () => {
            if (this.syncStatus.pendingChanges && navigator.sendBeacon) {
                this.syncToCloud(true);
            }
        });
    }

    // ==================== 买入记录 (buy_records) ====================

    /**
     * 添加买入记录
     * @param {Object} record - { date, usdAmount, buyRate }
     * @returns {Promise<Object>} 新创建的记录
     */
    async addBuyRecord(record) {
        const newRecord = {
            id: Date.now(), // 使用时间戳作为临时ID
            date: record.date,
            usdAmount: parseFloat(record.usdAmount),
            buyRate: parseFloat(record.buyRate),
            costCNY: parseFloat((record.usdAmount * record.buyRate).toFixed(2)),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 保存到 localStorage（立即生效）
        this.buyRecords.unshift(newRecord); // 新记录插入到开头
        this._saveToLocalStorage();
        
        // 后台同步到云端（异步）
        this._syncBuyRecordsToCloud();
        
        console.log('✅ 添加买入记录:', newRecord);
        return newRecord;
    }

    /**
     * 获取所有买入记录
     * @returns {Array} 买入记录数组（按日期降序）
     */
    getBuyRecords() {
        return [...this.buyRecords].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }

    /**
     * 批量删除买入记录
     * @param {Array<number>} ids - 要删除的ID数组
     */
    async deleteBuyRecords(ids) {
        // 从本地删除
        this.buyRecords = this.buyRecords.filter(record => !ids.includes(record.id));
        this._saveToLocalStorage();
        
        // 同步删除到云端
        this._deleteBuyRecordsFromCloud(ids);
        
        console.log(`🗑️ 删除 ${ids.length} 条买入记录`);
        return true;
    }

    /**
     * 获取买入统计信息
     * @returns {Object} 统计数据
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

    // ==================== 历史记录 (history_records) ====================

    /**
     * 添加历史计算记录
     * @param {Object} record - 记录对象
     * @returns {Promise<Object>} 新创建的记录
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
        
        // 保存到本地
        this.historyRecords.unshift(newRecord);
        this._saveToLocalStorage();
        
        // 同步到云端
        this._syncHistoryRecordsToCloud();
        
        console.log('✅ 添加历史记录:', newRecord);
        return newRecord;
    }

    /**
     * 获取所有历史记录
     * @returns {Array} 历史记录数组
     */
    getHistoryRecords() {
        return [...this.historyRecords];
    }

    /**
     * 批量删除历史记录
     * @param {Array<number>} ids - 要删除的ID数组
     */
    async deleteHistoryRecords(ids) {
        this.historyRecords = this.historyRecords.filter(record => !ids.includes(record.id));
        this._saveToLocalStorage();
        
        this._deleteHistoryRecordsFromCloud(ids);
        
        console.log(`🗑️ 删除 ${ids.length} 条历史记录`);
        return true;
    }

    // ==================== 系统配置 (config) ====================

    /**
     * 获取系统配置
     * @returns {Object} 配置对象
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * 更新系统配置
     * @param {Object} configData - { currentHoldUSD, currentRate }
     * @returns {Promise<Object>} 更新后的配置
     */
    async updateConfig(configData) {
        this.config = {
            ...this.config,
            currentHoldUSD: parseFloat(configData.currentHoldUSD),
            currentRate: parseFloat(configData.currentRate),
            lastUpdate: new Date().toISOString()
        };
        
        this._saveToLocalStorage();
        this._syncConfigToCloud();
        
        console.log('⚙️ 更新配置:', this.config);
        return this.getConfig();
    }

    // ==================== 云同步方法 ====================

    /**
     * 同步所有数据到云端
     * @param {boolean} force - 是否强制同步
     */
    async syncToCloud(force = false) {
        if (!this.supabaseClient) {
            console.log('⏭️ 跳过同步：Supabase 未配置');
            return;
        }
        
        if (this.syncStatus.isSyncing && !force) {
            console.log('⏭️ 跳过同步：正在同步中');
            return;
        }
        
        this.syncStatus.isSyncing = true;
        console.log('☁️ 开始同步到云端...');
        
        try {
            await Promise.all([
                this._syncBuyRecordsToCloud(),
                this._syncHistoryRecordsToCloud(),
                this._syncConfigToCloud()
            ]);
            
            this.syncStatus.lastSync = new Date().toISOString();
            this.syncStatus.pendingChanges = false;
            console.log('✅ 云同步完成');
        } catch (error) {
            console.error('❌ 云同步失败:', error);
        } finally {
            this.syncStatus.isSyncing = false;
        }
    }

    /**
     * 从云端拉取数据（合并策略）
     */
    async syncFromCloud() {
        if (!this.supabaseClient) return;
        
        console.log('☁️ 从云端拉取数据...');
        
        try {
            // 并行获取所有表数据
            const [buyRes, historyRes, configRes] = await Promise.all([
                this.supabaseClient.from(this.TABLES.BUY_RECORDS).select('*').order('id', { ascending: false }),
                this.supabaseClient.from(this.TABLES.HISTORY_RECORDS).select('*').order('id', { ascending: false }),
                this.supabaseClient.from(this.TABLES.CONFIG).select('*').eq('id', 1).single()
            ]);
            
            // 合并策略：如果本地为空或云端数据更多，使用云端数据
            if (buyRes.data && buyRes.data.length > 0) {
                // 转换数据库字段名为前端格式
                const cloudDataFormatted = buyRes.data.map(r => ({
                    id: r.id,
                    date: r.buy_time,
                    usdAmount: parseFloat(r.usd_amount),
                    buyRate: parseFloat(r.buy_rate),
                    costCNY: parseFloat(r.cost_cny || (r.usd_amount * r.buy_rate)),
                    createdAt: r.created_at,
                    updatedAt: r.updated_at
                }));
                
                // 如果本地没有数据，直接使用云端数据；否则合并
                if (this.buyRecords.length === 0) {
                    this.buyRecords = cloudDataFormatted;
                    console.log(`📥 从云端加载 ${cloudDataFormatted.length} 条买入记录`);
                } else {
                    const localIds = new Set(this.buyRecords.map(r => r.id));
                    const newFromCloud = cloudDataFormatted.filter(r => !localIds.has(r.id));
                    if (newFromCloud.length > 0) {
                        this.buyRecords = [...newFromCloud, ...this.buyRecords];
                        console.log(`📥 从云端获取 ${newFromCloud.length} 条新买入记录`);
                    }
                }
            }
            
            if (historyRes.data && historyRes.data.length > 0) {
                // 转换数据库字段名为前端格式
                const cloudDataFormatted = historyRes.data.map(r => ({
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
                
                if (this.historyRecords.length === 0) {
                    this.historyRecords = cloudDataFormatted;
                    console.log(`📥 从云端加载 ${cloudDataFormatted.length} 条历史记录`);
                } else {
                    const localIds = new Set(this.historyRecords.map(r => r.id));
                    const newFromCloud = cloudDataFormatted.filter(r => !localIds.has(r.id));
                    if (newFromCloud.length > 0) {
                        this.historyRecords = [...newFromCloud, ...this.historyRecords];
                        console.log(`📥 从云端获取 ${newFromCloud.length} 条新历史记录`);
                    }
                }
            }
            
            if (configRes.data) {
                if (!this.config.lastUpdate || 
                    new Date(configRes.data.last_update) > new Date(this.config.lastUpdate)) {
                    this.config = {
                        id: configRes.data.id,
                        currentHoldUSD: parseFloat(configRes.data.current_hold_usd),
                        currentRate: parseFloat(configRes.data.current_rate),
                        lastUpdate: configRes.data.last_update
                    };
                    console.log('📥 从云端更新配置');
                }
            }
            
            // 保存合并后的数据到 localStorage
            this._saveToLocalStorage();
            
            console.log(`✅ 云端同步完成 - 买入:${this.buyRecords.length}条, 历史:${this.historyRecords.length}条`);
            
        } catch (error) {
            console.error('❌ 从云端拉取失败:', error);
            throw error;  // 向上抛出错误，让调用者知道失败
        }
    }

    /**
     * 同步买入记录到云端
     */
    async _syncBuyRecordsToCloud() {
        if (!this.supabaseClient || this.buyRecords.length === 0) return;
        
        try {
            // 转换字段名为数据库格式
            const recordsForDB = this.buyRecords.map(r => ({
                buy_time: r.date,
                usd_amount: r.usdAmount,
                buy_rate: r.buyRate
            }));
            
            // 使用 upsert（存在则更新，不存在则插入）
            const { error } = await this.supabaseClient
                .from(this.TABLES.BUY_RECORDS)
                .upsert(recordsForDB, { onConflict: 'id' });
            
            if (error) throw error;
        } catch (error) {
            console.warn('⚠️ 买入记录同步失败:', error.message);
        }
    }

    /**
     * 从云端删除买入记录
     */
    async _deleteBuyRecordsFromCloud(ids) {
        if (!this.supabaseClient || ids.length === 0) return;
        
        try {
            const { error } = await this.supabaseClient
                .from(this.TABLES.BUY_RECORDS)
                .delete()
                .in('id', ids);
            
            if (error) throw error;
        } catch (error) {
            console.warn('⚠️ 删除买入记录失败:', error.message);
        }
    }

    /**
     * 同步历史记录到云端
     */
    async _syncHistoryRecordsToCloud() {
        if (!this.supabaseClient || this.historyRecords.length === 0) return;
        
        try {
            const recordsForDB = this.historyRecords.map(r => ({
                query_time: r.queryTime,
                finance_roi: r.financeROI,
                finance_profit_usd: r.financeProfitUSD,
                total_profit_cny: r.totalProfitCNY,
                total_roi: r.totalROI,
                current_rate: r.currentRate,
                rate_profit_cny: r.rateProfitCNY,
                current_hold_usd: r.currentHoldUSD
            }));
            
            const { error } = await this.supabaseClient
                .from(this.TABLES.HISTORY_RECORDS)
                .upsert(recordsForDB, { onConflict: 'id' });
            
            if (error) throw error;
        } catch (error) {
            console.warn('⚠️ 历史记录同步失败:', error.message);
        }
    }

    /**
     * 从云端删除历史记录
     */
    async _deleteHistoryRecordsFromCloud(ids) {
        if (!this.supabaseClient || ids.length === 0) return;
        
        try {
            const { error } = await this.supabaseClient
                .from(this.TABLES.HISTORY_RECORDS)
                .delete()
                .in('id', ids);
            
            if (error) throw error;
        } catch (error) {
            console.warn('⚠️ 删除历史记录失败:', error.message);
        }
    }

    /**
     * 同步配置到云端
     */
    async _syncConfigToCloud() {
        if (!this.supabaseClient) return;
        
        try {
            const { error } = await this.supabaseClient
                .from(this.TABLES.CONFIG)
                .upsert({
                    id: 1,
                    current_hold_usd: this.config.currentHoldUSD,
                    current_rate: this.config.currentRate,
                    last_update: this.config.lastUpdate
                }, { onConflict: 'id' });
            
            if (error) throw error;
        } catch (error) {
            console.warn('⚠️ 配置同步失败:', error.message);
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 清除所有本地数据
     */
    clearAllData() {
        this.buyRecords = [];
        this.historyRecords = [];
        this.config = { id: 1, currentHoldUSD: 0, currentRate: 0, lastUpdate: null };
        this._saveToLocalStorage();
        console.log('🗑️ 已清除所有本地数据');
    }

    /**
     * 导出数据为JSON（用于备份）
     * @returns {string} JSON字符串
     */
    exportData() {
        return JSON.stringify({
            version: '2.0',
            exportDate: new Date().toISOString(),
            buyRecords: this.buyRecords,
            historyRecords: this.historyRecords,
            config: this.config
        }, null, 2);
    }

    /**
     * 从JSON导入数据（用于恢复）
     * @param {string} jsonStr - JSON字符串
     */
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            
            if (data.buyRecords) this.buyRecords = data.buyRecords;
            if (data.historyRecords) this.historyRecords = data.historyRecords;
            if (data.config) this.config = data.config;
            
            this._saveToLocalStorage();
            console.log('✅ 数据导入成功');
            
            // 导入后同步到云端
            this.syncToCloud();
            
            return true;
        } catch (error) {
            console.error('❌ 数据导入失败:', error);
            return false;
        }
    }

    /**
     * 获取同步状态
     * @returns {Object} 同步状态对象
     */
    getSyncStatus() {
        return {
            ...this.syncStatus,
            hasSupabase: !!this.supabaseClient,
            localRecordCount: {
                buyRecords: this.buyRecords.length,
                historyRecords: this.historyRecords.length
            }
        };
    }
}

// 全局实例
const storage = new StorageManager();

// 导出到全局作用域（方便调试）
window.storageManager = storage;

/**
 * StorageManager v3.0 - 智能混合存储架构
 * 
 * ✅ 核心设计原则：
 * - localStorage = 主存储（用户的真实数据源）
 * - Supabase PostgreSQL = 云备份（只用于备份和恢复）
 * 
 * 🔄 同步策略：
 * 1. 首次使用（localStorage 为空）→ 从云端下载初始数据
 * 2. 后续使用（localStorage 有数据）→ 以本地为准，跳过下载
 * 3. 增量上传 → 只将本地新增/修改的数据上传到云端
 * 4. 绝不用云端数据覆盖 localStorage！
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
     * 启动智能同步
     * 
     * 核心逻辑：
     * - 首次使用（本地为空）→ 从云端下载
     * - 后续使用（本地有数据）→ 以本地为准，只做增量上传
     */
    async _startSmartSync() {
        console.log('🔄 启动智能同步...');
        
        try {
            // 检查是否首次使用
            const isFirstTimeUse = this.buyRecords.length === 0 && 
                                   this.historyRecords.length === 0;
            
            if (isFirstTimeUse) {
                // ⭐ 首次使用：从云端下载初始数据
                console.log('📥 首次使用：从云端加载初始数据...');
                await this._downloadFromCloud();
            } else {
                // ✅ 后续使用：以 localStorage 为主
                console.log(`✅ 使用本地数据为主:`);
                console.log(`   - 买入记录: ${this.buyRecords.length} 条`);
                console.log(`   - 历史记录: ${this.historyRecords.length} 条`);
                console.log('   - 跳过云端下载，保持本地数据不变');
            }
            
            // 触发 UI 更新事件
            window.dispatchEvent(new CustomEvent('dataLoaded', { 
                detail: {
                    buyRecordsCount: this.buyRecords.length,
                    historyRecordsCount: this.historyRecords.length,
                    dataSource: isFirstTimeUse ? 'cloud' : 'local'
                }
            }));
            
        } catch (error) {
            console.error('❌ 初始同步失败:', error);
            console.log('⚠️ 将继续使用本地模式');
        }
        
        // 延迟执行增量上传（5秒后）
        setTimeout(() => this._incrementalUploadToCloud(), 5000);
        
        // 定时增量同步（每5分钟）
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
     * 首次使用：从云端下载数据
     * 只在 localStorage 完全为空时调用
     */
    async _downloadFromCloud() {
        if (!this.supabaseClient) {
            console.warn('⚠️ Supabase 未连接');
            return;
        }
        
        console.log('☁️ 开始从云端下载...');
        
        try {
            const [buyRes, historyRes, configRes] = await Promise.all([
                this.supabaseClient.from(this.TABLES.BUY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.HISTORY_RECORDS)
                    .select('*').order('id', { ascending: true }),
                this.supabaseClient.from(this.TABLES.CONFIG)
                    .select('*').eq('id', 1).single()
            ]);
            
            // 下载买入记录
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
                console.log(`📥 下载 ${this.buyRecords.length} 条买入记录`);
            }
            
            // 下载历史记录
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
                console.log(`📥 下载 ${this.historyRecords.length} 条历史记录`);
            }
            
            // 下载配置
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
            
            console.log('✅ 云端数据下载完成');
            
        } catch (error) {
            console.error('❌ 下载失败:', error);
            throw error;
        }
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
        return newRecord;
    }

    /**
     * 获取所有历史记录
     */
    getHistoryRecords() {
        return [...this.historyRecords];
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

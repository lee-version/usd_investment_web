/**
 * StorageManager - 管理MySQL数据库数据持久化
 * 通过API与Node.js后端交互，使用 buy_records / history_records / config 三张表
 */
class StorageManager {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
    }

    async _request(method, endpoint, data = null) {
        const url = `${this.API_BASE}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || '请求失败');
            }
            
            return result;
        } catch (error) {
            console.error(`API请求失败 [${method} ${endpoint}]:`, error);
            throw error;
        }
    }

    // ==================== 买入记录 (buy_records) ====================
    
    async addBuyRecord(record) {
        const result = await this._request('POST', '/buy-records', {
            date: record.date,
            usdAmount: record.usdAmount,
            buyRate: record.buyRate
        });
        
        return result.data;
    }

    async getBuyRecords() {
        const result = await this._request('GET', '/buy-records');
        return result.data;
    }

    async deleteBuyRecords(ids) {
        await this._request('DELETE', '/buy-records', { ids });
        return true;
    }

    async getBuyStats() {
        const result = await this._request('GET', '/buy-records/stats');
        return result.data;
    }

    // ==================== 历史记录 (history_records) ====================
    
    async addHistoryRecord(record) {
        const result = await this._request('POST', '/history-records', {
            queryTime: record.queryTime,
            financeROI: record.financeROI,
            financeProfitUSD: record.financeProfitUSD,
            totalProfitCNY: record.totalProfitCNY,
            totalROI: record.totalROI,
            currentRate: record.currentRate,
            rateProfitCNY: record.rateProfitCNY,
            currentHoldUSD: record.currentHoldUSD
        });
        
        return result.data;
    }

    async getHistoryRecords() {
        const result = await this._request('GET', '/history-records');
        return result.data;
    }

    async deleteHistoryRecords(ids) {
        await this._request('DELETE', '/history-records', { ids });
        return true;
    }

    // ==================== 系统配置 (config) ====================
    
    async getConfig() {
        const result = await this._request('GET', '/config');
        return result.data;
    }

    async updateConfig(configData) {
        const result = await this._request('PUT', '/config', {
            currentHoldUSD: configData.currentHoldUSD,
            currentRate: configData.currentRate
        });
        
        return result.data;
    }
}

// 全局实例
const storage = new StorageManager();

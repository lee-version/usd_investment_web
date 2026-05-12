const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, getPool } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供前端页面
app.use(express.static(path.join(__dirname)));

// 默认路由 - 访问根路径时返回 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
    try {
        await initDB();

        // ==================== 买入记录 API (buy_records) ====================
        
        // 获取所有买入记录
        app.get('/api/buy-records', async (req, res) => {
            try {
                const pool = getPool();
                const [rows] = await pool.execute(
                    'SELECT * FROM buy_records ORDER BY buy_time DESC'
                );
                
                const records = rows.map(row => ({
                    id: row.id,
                    date: row.buy_time.toISOString().split('T')[0],
                    usdAmount: parseFloat(row.usd_amount),
                    buyRate: parseFloat(row.buy_rate),
                    costCNY: parseFloat(row.cost_cny),
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
                
                res.json({ success: true, data: records });
            } catch (error) {
                console.error('获取买入记录失败:', error);
                res.status(500).json({ success: false, message: '获取买入记录失败' });
            }
        });

        // 添加买入记录
        app.post('/api/buy-records', async (req, res) => {
            try {
                const { date, usdAmount, buyRate } = req.body;
                const pool = getPool();
                
                const [result] = await pool.execute(
                    'INSERT INTO buy_records (buy_time, usd_amount, buy_rate) VALUES (?, ?, ?)',
                    [date, usdAmount, buyRate]
                );
                
                // 获取插入的记录（包含自动计算的 cost_cny）
                const [newRows] = await pool.execute(
                    'SELECT * FROM buy_records WHERE id = ?',
                    [result.insertId]
                );
                
                const newRow = newRows[0];
                const newRecord = {
                    id: newRow.id,
                    date: newRow.buy_time.toISOString().split('T')[0],
                    usdAmount: parseFloat(newRow.usd_amount),
                    buyRate: parseFloat(newRow.buy_rate),
                    costCNY: parseFloat(newRow.cost_cny)
                };
                
                res.json({ success: true, data: newRecord });
            } catch (error) {
                console.error('添加买入记录失败:', error);
                res.status(500).json({ success: false, message: '添加买入记录失败' });
            }
        });

        // 删除买入记录（批量）
        app.delete('/api/buy-records', async (req, res) => {
            try {
                const { ids } = req.body;
                if (!ids || ids.length === 0) {
                    return res.status(400).json({ success: false, message: '请选择要删除的记录' });
                }
                
                const pool = getPool();
                await pool.execute(
                    `DELETE FROM buy_records WHERE id IN (${ids.map(() => '?').join(',')})`,
                    ids
                );
                
                res.json({ success: true, message: `成功删除 ${ids.length} 条记录` });
            } catch (error) {
                console.error('删除买入记录失败:', error);
                res.status(500).json({ success: false, message: '删除买入记录失败' });
            }
        });

        // 获取买入记录统计
        app.get('/api/buy-records/stats', async (req, res) => {
            try {
                const pool = getPool();
                const [rows] = await pool.execute(
                    'SELECT SUM(usd_amount) as total_usd, SUM(cost_cny) as total_cny FROM buy_records'
                );
                
                const totalUSD = parseFloat(rows[0].total_usd) || 0;
                const totalCNY = parseFloat(rows[0].total_cny) || 0;
                const avgRate = totalUSD > 0 ? totalCNY / totalUSD : null;
                
                res.json({ 
                    success: true, 
                    data: {
                        totalHoldingUSD: parseFloat(totalUSD.toFixed(2)),
                        totalCostCNY: parseFloat(totalCNY.toFixed(2)),
                        avgCostRate: avgRate ? parseFloat(avgRate.toFixed(4)) : null
                    }
                });
            } catch (error) {
                console.error('获取统计数据失败:', error);
                res.status(500).json({ success: false, message: '获取统计数据失败' });
            }
        });

        // ==================== 历史记录 API (history_records) ====================
        
        // 获取所有历史计算记录
        app.get('/api/history-records', async (req, res) => {
            try {
                const pool = getPool();
                const [rows] = await pool.execute(
                    'SELECT * FROM history_records ORDER BY query_time DESC'
                );
                
                const records = rows.map(row => ({
                    id: row.id,
                    queryTime: row.query_time.toISOString().replace('T', ' ').substring(0, 19),
                    financeROI: parseFloat(row.finance_roi),
                    financeProfitUSD: parseFloat(row.finance_profit_usd),
                    totalProfitCNY: parseFloat(row.total_profit_cny),
                    totalROI: parseFloat(row.total_roi),
                    currentRate: parseFloat(row.current_rate),
                    rateProfitCNY: parseFloat(row.rate_profit_cny),
                    currentHoldUSD: parseFloat(row.current_hold_usd),
                    createdAt: row.created_at
                }));
                
                res.json({ success: true, data: records });
            } catch (error) {
                console.error('获取历史记录失败:', error);
                res.status(500).json({ success: false, message: '获取历史记录失败' });
            }
        });

        // 添加历史计算记录
        app.post('/api/history-records', async (req, res) => {
            try {
                const { 
                    queryTime, financeROI, financeProfitUSD,
                    totalProfitCNY, totalROI, currentRate,
                    rateProfitCNY, currentHoldUSD
                } = req.body;
                
                const pool = getPool();
                const [result] = await pool.execute(
                    `INSERT INTO history_records (
                        query_time, finance_roi, finance_profit_usd,
                        total_profit_cny, total_roi, current_rate,
                        rate_profit_cny, current_hold_usd
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [queryTime, financeROI, financeProfitUSD,
                     totalProfitCNY, totalROI, currentRate,
                     rateProfitCNY, currentHoldUSD]
                );
                
                const newRecord = {
                    id: result.insertId,
                    queryTime,
                    financeROI: parseFloat(financeROI),
                    financeProfitUSD: parseFloat(financeProfitUSD),
                    totalProfitCNY: parseFloat(totalProfitCNY),
                    totalROI: parseFloat(totalROI),
                    currentRate: parseFloat(currentRate),
                    rateProfitCNY: parseFloat(rateProfitCNY),
                    currentHoldUSD: parseFloat(currentHoldUSD)
                };
                
                res.json({ success: true, data: newRecord });
            } catch (error) {
                console.error('添加历史记录失败:', error);
                res.status(500).json({ success: false, message: '添加历史记录失败' });
            }
        });

        // 删除历史记录（批量）
        app.delete('/api/history-records', async (req, res) => {
            try {
                const { ids } = req.body;
                if (!ids || ids.length === 0) {
                    return res.status(400).json({ success: false, message: '请选择要删除的记录' });
                }
                
                const pool = getPool();
                await pool.execute(
                    `DELETE FROM history_records WHERE id IN (${ids.map(() => '?').join(',')})`,
                    ids
                );
                
                res.json({ success: true, message: `成功删除 ${ids.length} 条记录` });
            } catch (error) {
                console.error('删除历史记录失败:', error);
                res.status(500).json({ success: false, message: '删除历史记录失败' });
            }
        });

        // ==================== 配置 API (config) ====================
        
        // 获取系统配置（当前持仓和汇率）
        app.get('/api/config', async (req, res) => {
            try {
                const pool = getPool();
                const [rows] = await pool.execute(
                    'SELECT * FROM config WHERE id = 1'
                );
                
                if (rows.length === 0) {
                    return res.json({ 
                        success: true, 
                        data: { id: 1, currentHoldUSD: 0, currentRate: 0, lastUpdate: null }
                    });
                }
                
                const config = rows[0];
                res.json({
                    success: true,
                    data: {
                        id: config.id,
                        currentHoldUSD: parseFloat(config.current_hold_usd),
                        currentRate: parseFloat(config.current_rate),
                        lastUpdate: config.last_update ? config.last_update.toISOString() : null
                    }
                });
            } catch (error) {
                console.error('获取配置失败:', error);
                res.status(500).json({ success: false, message: '获取配置失败' });
            }
        });

        // 更新系统配置
        app.put('/api/config', async (req, res) => {
            try {
                const { currentHoldUSD, currentRate } = req.body;
                const pool = getPool();
                
                // 检查是否存在配置记录
                const [existing] = await pool.execute(
                    'SELECT id FROM config WHERE id = 1'
                );
                
                if (existing.length > 0) {
                    // 更新现有配置
                    await pool.execute(
                        'UPDATE config SET current_hold_usd = ?, current_rate = ? WHERE id = 1',
                        [currentHoldUSD, currentRate]
                    );
                } else {
                    // 插入新配置
                    await pool.execute(
                        'INSERT INTO config (id, current_hold_usd, current_rate) VALUES (1, ?, ?)',
                        [currentHoldUSD, currentRate]
                    );
                }
                
                res.json({ 
                    success: true, 
                    data: { currentHoldUSD: parseFloat(currentHoldUSD), currentRate: parseFloat(currentRate) }
                });
            } catch (error) {
                console.error('更新配置失败:', error);
                res.status(500).json({ success: false, message: '更新配置失败' });
            }
        });

        app.listen(PORT, () => {
            console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
            console.log('\n📡 API 端点:');
            console.log('   📥 买入记录 (buy_records):');
            console.log('      GET    /api/buy-records      - 获取所有买入记录');
            console.log('      POST   /api/buy-records      - 添加买入记录');
            console.log('      DELETE /api/buy-records      - 批量删除买入记录');
            console.log('      GET    /api/buy-records/stats - 获取买入统计');
            console.log('   📊 历史记录 (history_records):');
            console.log('      GET    /api/history-records   - 获取所有历史记录');
            console.log('      POST   /api/history-records   - 添加历史记录');
            console.log('      DELETE /api/history-records   - 批量删除历史记录');
            console.log('   ⚙️  系统配置 (config):');
            console.log('      GET    /api/config             - 获取系统配置');
            console.log('      PUT    /api/config             - 更新系统配置');
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();

/**
 * App - 主应用逻辑
 * 视图切换、表单处理、数据渲染、事件绑定
 * 所有数据操作通过API异步完成，使用 buy_records / history_records / config 三张表
 */
class App {
    constructor() {
        this.currentView = 'purchase';
        this.lastResult = null;
        this.init();
    }

    async init() {
        this.bindNavigation();
        this.bindPurchaseView();
        this.bindCalculatorView();
        this.bindRecordsView();
        this.bindChartsView();
        
        try {
            await this.renderBuyRecords();
            await this.renderHistoryRecords();
        } catch (error) {
            console.error('初始化数据加载失败', error);
        }

        // 窗口大小改变时重绘图表
        window.addEventListener('resize', () => {
            if (this.currentView === 'charts') {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => charts.resizeAll(), 200);
            }
        });
    }

    // ==================== 视图切换 ====================
    bindNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.switchView(view);
            });
        });
    }

    async switchView(view) {
        this.currentView = view;

        // 更新导航状态
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.view === view);
        });

        // 更新视图显示
        document.querySelectorAll('.view-section').forEach(s => {
            s.classList.toggle('active', s.id === `view-${view}`);
        });

        // 切换视图时刷新对应数据
        if (view === 'purchase') {
            await this.renderBuyRecords();
        } else if (view === 'calculator') {
            await this.updateCalculatorInfo();
        } else if (view === 'records') {
            await this.renderHistoryRecords();
        } else if (view === 'charts') {
            setTimeout(() => charts.refreshAll(), 100);
        }
    }

    // ==================== 视图1: 买入记录 ====================
    bindPurchaseView() {
        const form = document.getElementById('purchase-form');
        const selectAll = document.getElementById('purchase-select-all');
        const deleteBtn = document.getElementById('purchase-delete-btn');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleBuySubmit();
            });
        }

        if (selectAll) {
            selectAll.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.purchase-checkbox');
                checkboxes.forEach(cb => cb.checked = selectAll.checked);
                this.updatePurchaseDeleteButton();
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedPurchases());
        }
    }

    async handleBuySubmit() {
        const dateInput = document.getElementById('purchase-date');
        const rateInput = document.getElementById('purchase-rate');
        const amountInput = document.getElementById('purchase-amount');

        const record = {
            date: dateInput.value,
            buyRate: parseFloat(rateInput.value),
            usdAmount: parseFloat(amountInput.value)
        };

        if (!record.date || isNaN(record.buyRate) || isNaN(record.usdAmount)) {
            alert('请填写完整且有效的信息');
            return;
        }

        try {
            await storageManager.addBuyRecord(record);

            // 清空表单
            dateInput.value = '';
            rateInput.value = '';
            amountInput.value = '';

            await this.renderBuyRecords();
        } catch (error) {
            console.error('添加买入记录失败:', error);
            alert('添加记录失败，请检查网络连接');
        }
    }

    async renderBuyRecords() {
        const tbody = document.getElementById('purchase-list');
        const selectAll = document.getElementById('purchase-select-all');
        if (!tbody) return;

        let records;
        try {
            records = await storageManager.getBuyRecords();
        } catch (error) {
            console.error('获取买入记录失败:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <p>加载数据失败，请检查网络连接</p>
                    </td>
                </tr>
            `;
            return;
        }

        const countEl = document.getElementById('purchase-count');
        if (countEl) countEl.textContent = records.length;

        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <p>暂无购买记录，请在上方添加</p>
                    </td>
                </tr>
            `;
            if (selectAll) selectAll.checked = false;
            this.updatePurchaseDeleteButton();
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td><input type="checkbox" class="custom-checkbox purchase-checkbox" value="${r.id}"></td>
                <td>${r.date}</td>
                <td class="number">${Calculator.formatRate(r.buyRate)}</td>
                <td class="number">$${Calculator.formatCurrency(r.usdAmount)}</td>
                <td class="number">¥${Calculator.formatCurrency(r.costCNY)}</td>
            </tr>
        `).join('');

        // 绑定复选框事件
        tbody.querySelectorAll('.purchase-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                this.updatePurchaseDeleteButton();
                this.updateSelectAllState('purchase');
            });
        });

        this.updatePurchaseDeleteButton();
    }

    updatePurchaseDeleteButton() {
        const btn = document.getElementById('purchase-delete-btn');
        const checked = document.querySelectorAll('.purchase-checkbox:checked');
        if (btn) {
            btn.disabled = checked.length === 0;
            btn.textContent = checked.length > 0 ? `删除选中 (${checked.length})` : '删除选中';
        }
    }

    async deleteSelectedPurchases() {
        const checked = document.querySelectorAll('.purchase-checkbox:checked');
        if (checked.length === 0) return;

        if (!confirm(`确定要删除选中的 ${checked.length} 条记录吗？`)) return;

        const ids = Array.from(checked).map(cb => cb.value);
        
        try {
            await storageManager.deleteBuyRecords(ids);
            await this.renderBuyRecords();
            // 刷新核心指标
            if (typeof charts !== 'undefined') {
                await charts.renderCoreMetrics();
            }
        } catch (error) {
            console.error('删除买入记录失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }

    // ==================== 视图2: 收益计算 ====================
    bindCalculatorView() {
        const form = document.getElementById('calculator-form');
        const saveBtn = document.getElementById('calc-save-btn');

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCalculate();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCalculation());
        }
    }

    async updateCalculatorInfo() {
        const avgRateEl = document.getElementById('calc-avg-rate');
        const totalHoldEl = document.getElementById('calc-total-holding');
        const holdingInput = document.getElementById('calc-holding');
        const rateInput = document.getElementById('calc-current-rate');
        const dateInput = document.getElementById('calc-date');

        try {
            // 从 buy_records 获取统计数据
            const stats = await storageManager.getBuyStats();
            
            // 优先从 history_records 获取最新记录的当前汇率
            let latestRateFromHistory = null;
            try {
                const historyRecords = await storageManager.getHistoryRecords();
                if (historyRecords && historyRecords.length > 0) {
                    // history_records 已经是倒序（最新在前），取第一条
                    latestRateFromHistory = historyRecords[0].currentRate;
                }
            } catch (e) {
                console.log('获取历史记录失败:', e);
            }

            // 从 config 表获取上次保存的配置（作为备选）
            let config = null;
            try {
                config = await storageManager.getConfig();
            } catch (e) {
                console.log('获取配置失败:', e);
            }

            if (avgRateEl) {
                avgRateEl.textContent = stats.avgCostRate ? Calculator.formatRate(stats.avgCostRate) : '-';
            }
            if (totalHoldEl) {
                totalHoldEl.textContent = stats.totalHoldingUSD ? `$${Calculator.formatCurrency(stats.totalHoldingUSD)}` : '-';
            }

            // 自动填入配置中的值或统计数据
            if (holdingInput && !holdingInput.value) {
                holdingInput.value = config && config.currentHoldUSD > 0 
                    ? config.currentHoldUSD 
                    : (stats.totalHoldingUSD || '');
            }
            
            // 当前汇率：优先使用历史记录的最新汇率，其次使用 config，最后为空
            if (rateInput && !rateInput.value) {
                if (latestRateFromHistory && latestRateFromHistory > 0) {
                    rateInput.value = latestRateFromHistory;
                } else if (config && config.currentRate > 0) {
                    rateInput.value = config.currentRate;
                } else {
                    rateInput.value = '';
                }
            }
            
            if (dateInput && !dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        } catch (error) {
            console.error('更新计算器信息失败', error);
            if (avgRateEl) avgRateEl.textContent = '-';
            if (totalHoldEl) totalHoldEl.textContent = '-';
        }
    }

    async handleCalculate() {
        const dateInput = document.getElementById('calc-date');
        const holdingInput = document.getElementById('calc-holding');
        const currentRateInput = document.getElementById('calc-current-rate');

        const calcDate = dateInput.value;
        const holdingAmount = parseFloat(holdingInput.value);
        const currentRate = parseFloat(currentRateInput.value);
        
        let stats;
        try {
            stats = await storageManager.getBuyStats();
        } catch (error) {
            console.error('获取统计数据失败:', error);
            alert('获取数据失败，请检查网络连接');
            return;
        }

        if (!calcDate || isNaN(holdingAmount) || isNaN(currentRate)) {
            alert('请填写完整信息');
            return;
        }

        if (!stats.avgCostRate) {
            alert('暂无购买记录，请先添加购买记录');
            this.switchView('purchase');
            return;
        }

        try {
            // 计算各项指标（基于新的数据模型）
            const originalCost = stats.totalCostCNY; // 原始成本
            const currentValue = holdingAmount * currentRate; // 当前价值
            
            // 汇率盈亏 = 总持有量 × 当前汇率 - 原始成本
            const exchangeValue = stats.totalHoldingUSD * currentRate;
            const exchangeProfit = exchangeValue - originalCost;
            const exchangeYield = originalCost > 0 ? (exchangeProfit / originalCost) * 100 : 0;
            
            // 理财收益倒算：当前总价值 - 原始成本 - 汇率盈亏
            const financialIncome = currentValue - originalCost - exchangeProfit;
            const financialYield = originalCost > 0 ? (financialIncome / originalCost) * 100 : 0;
            
            // 总盈亏和收益率
            const totalProfit = currentValue - originalCost;
            const totalYield = originalCost > 0 ? (totalProfit / originalCost) * 100 : 0;

            this.lastResult = {
                queryTime: new Date().toISOString().substring(0, 10),
                holdingAmount,
                currentRate,
                avgCostRate: stats.avgCostRate,
                originalCost: parseFloat(originalCost.toFixed(2)),
                currentValue: parseFloat(currentValue.toFixed(2)),
                financialIncome: parseFloat(financialIncome.toFixed(2)),
                financialYield: parseFloat(financialYield.toFixed(2)),
                exchangeProfit: parseFloat(exchangeProfit.toFixed(2)),
                exchangeYield: parseFloat(exchangeYield.toFixed(2)),
                totalProfit: parseFloat(totalProfit.toFixed(2)),
                totalYield: parseFloat(totalYield.toFixed(2)),
                totalHoldingUSD: stats.totalHoldingUSD,
                totalCostCNY: stats.totalCostCNY
            };
            
            this.displayResult(this.lastResult);

            // 同时更新 config 表
            try {
                await storageManager.updateConfig({
                    currentHoldUSD: holdingAmount,
                    currentRate: currentRate
                });
            } catch (e) {
                console.warn('更新配置失败:', e);
            }
        } catch (e) {
            alert(e.message);
        }
    }

    displayResult(result) {
        const container = document.getElementById('calc-result');
        if (!container) return;

        container.innerHTML = `
            <div class="result-grid">
                <div class="result-item">
                    <div class="label">原始成本</div>
                    <div class="value">¥${Calculator.formatCurrency(result.originalCost)}</div>
                    <div class="sub-value">$${Calculator.formatCurrency(result.totalHoldingUSD)}</div>
                </div>
                <div class="result-item">
                    <div class="label">当前价值</div>
                    <div class="value">¥${Calculator.formatCurrency(result.currentValue)}</div>
                    <div class="sub-value">$${Calculator.formatCurrency(result.holdingAmount)}</div>
                </div>
                <div class="result-item">
                    <div class="label">理财收益</div>
                    <div class="value ${result.financialIncome >= 0 ? 'positive' : 'negative'}">
                        ${result.financialIncome >= 0 ? '+' : ''}¥${Calculator.formatCurrency(result.financialIncome)}
                    </div>
                    <div class="sub-value">收益率: ${Calculator.formatPercent(result.financialYield)}</div>
                </div>
                <div class="result-item">
                    <div class="label">汇率盈亏</div>
                    <div class="value ${result.exchangeProfit >= 0 ? 'positive' : 'negative'}">
                        ${result.exchangeProfit >= 0 ? '+' : ''}¥${Calculator.formatCurrency(result.exchangeProfit)}
                    </div>
                    <div class="sub-value">收益率: ${Calculator.formatPercent(result.exchangeYield)}</div>
                </div>
                <div class="result-item" style="grid-column: 1 / -1;">
                    <div class="label">总盈亏</div>
                    <div class="value ${result.totalProfit >= 0 ? 'positive' : 'negative'}" style="font-size: 1.8rem;">
                        ${result.totalProfit >= 0 ? '+' : ''}¥${Calculator.formatCurrency(result.totalProfit)}
                    </div>
                    <div class="sub-value">总收益率: ${Calculator.formatPercent(result.totalYield)}</div>
                </div>
            </div>
        `;
        container.style.display = 'block';

        const saveBtn = document.getElementById('calc-save-btn');
        if (saveBtn) saveBtn.disabled = false;
    }

    async saveCalculation() {
        if (!this.lastResult) {
            alert('请先进行计算');
            return;
        }

        const r = this.lastResult;
        
        try {
            await storageManager.addHistoryRecord({
                queryTime: r.queryTime,
                financeROI: r.financialYield,
                financeProfitUSD: r.financialIncome / r.currentRate, // 转换为美元维度
                totalProfitCNY: r.totalProfit,
                totalROI: r.totalYield,
                currentRate: r.currentRate,
                rateProfitCNY: r.exchangeProfit,
                currentHoldUSD: r.holdingAmount
            });
            
            alert('✅ 计算结果已保存');
            
            const saveBtn = document.getElementById('calc-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '✓ 已保存';
                setTimeout(() => {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '保存结果';
                }, 2000);
            }
        } catch (error) {
            console.error('❌ 保存计算结果失败:', error);
            alert(`❌ 保存失败: ${error.message}`);
        }
    }

    // ==================== 视图3: 历史记录 ====================
    bindRecordsView() {
        const selectAll = document.getElementById('records-select-all');
        const deleteBtn = document.getElementById('records-delete-btn');

        if (selectAll) {
            selectAll.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.record-checkbox');
                checkboxes.forEach(cb => cb.checked = selectAll.checked);
                this.updateRecordsDeleteButton();
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedRecords());
        }
    }

    async renderHistoryRecords() {
        const tbody = document.getElementById('records-list');
        const selectAll = document.getElementById('records-select-all');
        if (!tbody) return;

        let records;
        try {
            records = await storageManager.getHistoryRecords();
        } catch (error) {
            console.error('获取历史记录失败:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <p>加载数据失败，请检查网络连接</p>
                    </td>
                </tr>
            `;
            return;
        }

        const countEl = document.getElementById('records-count');
        if (countEl) countEl.textContent = records.length;

        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        <p>暂无计算记录，请在计算器页面保存结果</p>
                    </td>
                </tr>
            `;
            if (selectAll) selectAll.checked = false;
            this.updateRecordsDeleteButton();
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td><input type="checkbox" class="custom-checkbox record-checkbox" value="${r.id}"></td>
                <td>${r.queryTime}</td>
                <td class="number">$${Calculator.formatCurrency(r.currentHoldUSD)}</td>
                <td class="number">${Calculator.formatRate(r.currentRate)}</td>
                <td class="number ${r.financeProfitUSD >= 0 ? 'positive' : 'negative'}">
                    $${r.financeProfitUSD >= 0 ? '+' : ''}${Calculator.formatCurrency(r.financeProfitUSD)}
                </td>
                <td class="number ${r.financeROI >= 0 ? 'positive' : 'negative'}">
                    ${Calculator.formatPercent(r.financeROI)}
                </td>
                <td class="number ${r.rateProfitCNY >= 0 ? 'positive' : 'negative'}">
                    ¥${r.rateProfitCNY >= 0 ? '+' : ''}${Calculator.formatCurrency(r.rateProfitCNY)}
                </td>
                <td class="number ${(r.rateProfitCNY / (r.currentHoldUSD * r.currentRate) * 100) >= 0 ? 'positive' : 'negative'}">
                    ${r.currentHoldUSD > 0 && r.currentRate > 0 ? Calculator.formatPercent(r.rateProfitCNY / (r.currentHoldUSD * r.currentRate) * 100) : '-'}
                </td>
                <td class="number ${r.totalProfitCNY >= 0 ? 'positive' : 'negative'}">
                    ¥${r.totalProfitCNY >= 0 ? '+' : ''}${Calculator.formatCurrency(r.totalProfitCNY)}
                </td>
                <td class="number ${r.totalROI >= 0 ? 'positive' : 'negative'}">
                    ${Calculator.formatPercent(r.totalROI)}
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.record-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateRecordsDeleteButton();
                this.updateSelectAllState('records');
            });
        });

        this.updateRecordsDeleteButton();
    }

    updateRecordsDeleteButton() {
        const btn = document.getElementById('records-delete-btn');
        const checked = document.querySelectorAll('.record-checkbox:checked');
        if (btn) {
            btn.disabled = checked.length === 0;
            btn.textContent = checked.length > 0 ? `删除选中 (${checked.length})` : '删除选中';
        }
    }

    async deleteSelectedRecords() {
        const checked = document.querySelectorAll('.record-checkbox:checked');
        if (checked.length === 0) return;

        if (!confirm(`确定要删除选中的 ${checked.length} 条记录吗？`)) return;

        const ids = Array.from(checked).map(cb => cb.value);
        
        try {
            await storageManager.deleteHistoryRecords(ids);
            await this.renderHistoryRecords();
            // 刷新核心指标和图表
            if (typeof charts !== 'undefined') {
                await charts.renderCoreMetrics();
            }
        } catch (error) {
            console.error('删除历史记录失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }

    updateSelectAllState(type) {
        const selectAll = document.getElementById(`${type}-select-all`);
        const checkboxes = document.querySelectorAll(`.${type}-checkbox`);
        if (!selectAll || checkboxes.length === 0) return;
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;
    }

    // ==================== 视图4: 图表 ====================
    bindChartsView() {
        // 绑定核心指标刷新按钮
        const refreshBtn = document.getElementById('refresh-metrics-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '⏳ 刷新中...';
                
                try {
                    await charts.renderCoreMetrics();
                    await charts.refreshAll();
                    refreshBtn.textContent = '✅ 已刷新';
                } catch (error) {
                    console.error('从云端刷新数据失败:', error);
                    refreshBtn.textContent = '❌ 刷新失败';
                } finally {
                    refreshBtn.disabled = false;
                }
            });
        }
    }

    // 启动应用
    async start() {
        try {
            await this.init();
            console.log('✅ 应用初始化完成');
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
        }
    }
}

// 初始化应用
const app = new App();

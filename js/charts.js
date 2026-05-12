/**
 * Charts - Plotly 图表可视化
 * 日式简约风格：留白、简洁、低饱和度配色
 * 适配 buy_records / history_records / config 数据模型
 */
class Charts {
    constructor() {
        this.colors = {
            primary: '#2D5016',
            primaryLight: 'rgba(45, 80, 22, 0.15)',
            secondary: '#4A6FA5',
            secondaryLight: 'rgba(74, 111, 165, 0.15)',
            accent: '#C4A35A',
            accentLight: 'rgba(196, 163, 90, 0.15)',
            negative: '#8B3A3A',
            negativeLight: 'rgba(139, 58, 58, 0.15)',
            text: '#333333',
            grid: '#F0F0F0',
            bg: '#FAF9F6'
        };

        this.commonLayout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
                color: '#333333',
                size: 12
            },
            margin: { t: 40, r: 20, b: 50, l: 60 },
            hoverlabel: {
                bgcolor: '#fff',
                bordercolor: '#E8E8E8',
                font: { color: '#333', size: 12 }
            }
        };

        this.commonConfig = {
            responsive: true,
            displayModeBar: false
        };
    }

    /**
     * 汇率走势折线图（基于 history_records 的 current_rate）
     */
    renderExchangeTrend(containerId, historyRecords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!historyRecords || historyRecords.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无计算记录</p></div>';
            return;
        }

        // 按日期排序（升序，用于图表展示）
        const sortedRecords = [...historyRecords].sort((a, b) => new Date(a.queryTime) - new Date(b.queryTime));
        const dates = sortedRecords.map(r => r.queryTime);
        const rates = sortedRecords.map(r => r.currentRate);

        // 计算Y轴范围：基于数据动态调整，但保持在合理区间
        const minRate = Math.min(...rates);
        const maxRate = Math.max(...rates);
        const padding = Math.max((maxRate - minRate) * 0.2, 0.1); // 至少 10% 的边距
        const yMin = (minRate - padding).toFixed(2);
        const yMax = (maxRate + padding).toFixed(2);

        const trace = {
            x: dates,
            y: rates,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: this.colors.primary,
                width: 2,
                shape: 'spline'
            },
            marker: {
                size: 6,
                color: this.colors.primary,
                line: { color: '#fff', width: 2 }
            },
            fill: 'tozeroy',
            fillcolor: this.colors.primaryLight,
            hovertemplate: '<b>%{x}</b><br>汇率: %{y:.4f}<extra></extra>'
        };

        const layout = {
            ...this.commonLayout,
            xaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 },
                tickformat: '.4f',
                range: [yMin, yMax]
            },
            annotations: [{
                x: dates[dates.length - 1],
                y: rates[rates.length - 1],
                xref: 'x',
                yref: 'y',
                text: rates[rates.length - 1].toFixed(4),
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 1,
                arrowcolor: this.colors.primary,
                ax: 20,
                ay: -30,
                font: { size: 11, color: this.colors.primary }
            }]
        };

        Plotly.newPlot(containerId, [trace], layout, this.commonConfig);
    }

    /**
     * 收益率趋势三线折线图（基于 history_records）
     */
    renderYieldTrend(containerId, historyRecords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!historyRecords || historyRecords.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无计算记录</p></div>';
            return;
        }

        const dates = historyRecords.map(r => r.queryTime ? r.queryTime.split(' ')[0] : '');

        // 理财收益率 (finance_roi)
        const trace1 = {
            x: dates,
            y: historyRecords.map(r => r.financeROI),
            name: '理财收益率',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: this.colors.accent, width: 2, shape: 'spline' },
            marker: { size: 5, color: this.colors.accent, line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>理财收益率: %{y:.2f}%<extra></extra>'
        };

        // 汇率收益率（计算得出）
        const trace2 = {
            x: dates,
            y: historyRecords.map(r => {
                // 汇率收益率 = rate_profit_cny / (current_hold_usd * current_rate) * 100
                const baseValue = (r.currentHoldUSD || 0) * (r.currentRate || 1);
                return baseValue > 0 ? (r.rateProfitCNY / baseValue) * 100 : 0;
            }),
            name: '汇率收益率',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: this.colors.secondary, width: 2, shape: 'spline' },
            marker: { size: 5, color: this.colors.secondary, line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>汇率收益率: %{y:.2f}%<extra></extra>'
        };

        // 总收益率 (total_roi)
        const trace3 = {
            x: dates,
            y: historyRecords.map(r => r.totalROI),
            name: '总收益率',
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: this.colors.primary, width: 2.5, shape: 'spline' },
            marker: { size: 6, color: this.colors.primary, line: { color: '#fff', width: 2 } },
            hovertemplate: '<b>%{x}</b><br>总收益率: %{y:.2f}%<extra></extra>'
        };

        const layout = {
            ...this.commonLayout,
            legend: {
                orientation: 'h',
                yanchor: 'bottom',
                y: 1.02,
                xanchor: 'right',
                x: 1
            },
            xaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: true,
                zerolinecolor: '#E8E8E8',
                zerolinewidth: 1.5,
                tickfont: { size: 11 },
                ticksuffix: '%'
            }
        };

        Plotly.newPlot(containerId, [trace1, trace2, trace3], layout, this.commonConfig);
    }

    /**
     * 总盈亏趋势面积图（基于 history_records）
     */
    renderTotalProfitTrend(containerId, historyRecords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!historyRecords || historyRecords.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
            return;
        }

        const dates = historyRecords.map(r => r.queryTime ? r.queryTime.split(' ')[0] : '');
        const profits = historyRecords.map(r => r.totalProfitCNY);

        const color = profits[profits.length - 1] >= 0 ? this.colors.primary : this.colors.negative;
        const lightColor = profits[profits.length - 1] >= 0 ? this.colors.primaryLight : this.colors.negativeLight;

        const trace = {
            x: dates,
            y: profits,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: color,
                width: 2.5,
                shape: 'spline'
            },
            marker: {
                size: 5,
                color: color,
                line: { color: '#fff', width: 2 }
            },
            fill: 'tozeroy',
            fillcolor: lightColor,
            hovertemplate: '<b>%{x}</b><br>总盈亏: ¥%{y:,.2f}<extra></extra>'
        };

        const layout = {
            ...this.commonLayout,
            xaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: true,
                zerolinecolor: '#E8E8E8',
                zerolinewidth: 1.5,
                tickfont: { size: 11 },
                tickprefix: '¥'
            },
            shapes: [{
                type: 'line',
                x0: dates[0],
                x1: dates[dates.length - 1],
                y0: 0,
                y1: 0,
                line: {
                    color: '#E8E8E8',
                    width: 1,
                    dash: 'dot'
                }
            }]
        };

        Plotly.newPlot(containerId, [trace], layout, this.commonConfig);
    }

    /**
     * 汇率盈亏折线图（基于 history_records 的 rate_profit_cny）
     */
    renderExchangeProfitTrend(containerId, historyRecords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!historyRecords || historyRecords.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
            return;
        }

        const dates = historyRecords.map(r => r.queryTime ? r.queryTime.split(' ')[0] : '');
        const profits = historyRecords.map(r => r.rateProfitCNY);

        const color = profits[profits.length - 1] >= 0 ? this.colors.secondary : this.colors.negative;
        const lightColor = profits[profits.length - 1] >= 0 ? this.colors.secondaryLight : this.colors.negativeLight;

        const trace = {
            x: dates,
            y: profits,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: color,
                width: 2.5,
                shape: 'spline'
            },
            marker: {
                size: 5,
                color: color,
                line: { color: '#fff', width: 2 }
            },
            fill: 'tozeroy',
            fillcolor: lightColor,
            hovertemplate: '<b>%{x}</b><br>汇率盈亏: ¥%{y:,.2f}<extra></extra>'
        };

        const layout = {
            ...this.commonLayout,
            xaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: true,
                zerolinecolor: '#E8E8E8',
                zerolinewidth: 1.5,
                tickfont: { size: 11 },
                tickprefix: '¥'
            },
            shapes: [{
                type: 'line',
                x0: dates[0],
                x1: dates[dates.length - 1],
                y0: 0,
                y1: 0,
                line: {
                    color: '#E8E8E8',
                    width: 1,
                    dash: 'dot'
                }
            }]
        };

        Plotly.newPlot(containerId, [trace], layout, this.commonConfig);
    }

    /**
     * 理财收益折线图（基于 history_records 的 finance_profit_usd 转换为 CNY）
     */
    renderFinancialIncomeTrend(containerId, historyRecords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!historyRecords || historyRecords.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
            return;
        }

        const dates = historyRecords.map(r => r.queryTime ? r.queryTime.split(' ')[0] : '');
        // 将美元收益转换为人民币显示
        const incomes = historyRecords.map(r => r.financeProfitUSD * r.currentRate);

        const hasData = incomes.some(v => v !== 0);
        if (!hasData) {
            container.innerHTML = '<div class="empty-state"><p>暂无理财收益数据</p><p style="font-size:0.8rem;margin-top:4px;">请进行计算后查看</p></div>';
            return;
        }

        const color = incomes[incomes.length - 1] >= 0 ? this.colors.accent : this.colors.negative;
        const lightColor = incomes[incomes.length - 1] >= 0 ? this.colors.accentLight : this.colors.negativeLight;

        const trace = {
            x: dates,
            y: incomes,
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: color,
                width: 2.5,
                shape: 'spline'
            },
            marker: {
                size: 5,
                color: color,
                line: { color: '#fff', width: 2 }
            },
            fill: 'tozeroy',
            fillcolor: lightColor,
            hovertemplate: '<b>%{x}</b><br>理财收益: ¥%{y:,.2f}<extra></extra>'
        };

        const layout = {
            ...this.commonLayout,
            xaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: false,
                tickfont: { size: 11 }
            },
            yaxis: {
                title: '',
                gridcolor: this.colors.grid,
                showgrid: true,
                zeroline: true,
                zerolinecolor: '#E8E8E8',
                zerolinewidth: 1.5,
                tickfont: { size: 11 },
                tickprefix: '¥'
            },
            shapes: [{
                type: 'line',
                x0: dates[0],
                x1: dates[dates.length - 1],
                y0: 0,
                y1: 0,
                line: {
                    color: '#E8E8E8',
                    width: 1,
                    dash: 'dot'
                }
            }]
        };

        Plotly.newPlot(containerId, [trace], layout, this.commonConfig);
    }

    /**
     * 渲染核心指标卡片（基于 history_records 和 config）
     */
    async renderCoreMetrics() {
        const container = document.getElementById('core-metrics-grid');
        if (!container) return;

        try {
            const [historyRecords, config] = await Promise.all([
                storage.getHistoryRecords(),
                storage.getConfig()
            ]);

            // 计算核心指标
            let currentTotalProfit = 0;
            let maxTotalROI = -Infinity;
            let minTotalROI = Infinity;
            let currentRate = config && config.currentRate ? config.currentRate : 0;

            if (historyRecords.length > 0) {
                // 取最新一条记录的累计收益（history_records 已按 query_time DESC 排序，第一条就是最新的）
                const latestRecord = historyRecords[0];
                currentTotalProfit = latestRecord.totalProfitCNY || 0;
                
                // 当前汇率也优先使用最新记录的汇率
                if (latestRecord.currentRate && latestRecord.currentRate > 0) {
                    currentRate = latestRecord.currentRate;
                }

                // 计算最高和最低总收益率
                historyRecords.forEach(r => {
                    if (r.totalROI > maxTotalROI) maxTotalROI = r.totalROI;
                    if (r.totalROI < minTotalROI) minTotalROI = r.totalROI;
                });
            }

            // 格式化显示值
            const formatCurrency = (value) => {
                return value >= 0 ? `+¥${value.toFixed(2)}` : `¥${value.toFixed(2)}`;
            };

            const formatPercent = (value) => {
                const sign = value >= 0 ? '+' : '';
                return `${sign}${value.toFixed(2)}%`;
            };

            const formatRate = (value) => {
                return value.toFixed(4);
            };

            // 判断正负颜色
            const getClassName = (value) => {
                if (value > 0) return 'positive';
                if (value < 0) return 'negative';
                return 'neutral';
            };

            container.innerHTML = `
                <div class="metric-card">
                    <div class="metric-label">
                        <span class="icon">💰</span>
                        当前累计收益
                    </div>
                    <div class="metric-value ${getClassName(currentTotalProfit)}">
                        ${formatCurrency(currentTotalProfit)}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">
                        <span class="icon">📈</span>
                        最高总收益率
                    </div>
                    <div class="metric-value positive">
                        ${maxTotalROI !== -Infinity ? formatPercent(maxTotalROI) : '--'}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">
                        <span class="icon">📉</span>
                        最低总收益率
                    </div>
                    <div class="metric-value negative">
                        ${minTotalROI !== Infinity ? formatPercent(minTotalROI) : '--'}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">
                        <span class="icon">💱</span>
                        当前汇率
                    </div>
                    <div class="metric-value neutral">
                        ${currentRate > 0 ? formatRate(currentRate) : '--'}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('渲染核心指标失败:', error);
            container.innerHTML = '<p style="color: #999; text-align: center;">加载指标数据失败</p>';
        }
    }

    /**
     * 刷新所有图表（异步版本）
     */
    async refreshAll() {
        try {
            const [buyRecords, historyRecords] = await Promise.all([
                storage.getBuyRecords(),
                storage.getHistoryRecords()
            ]);

            // 渲染核心指标
            await this.renderCoreMetrics();

            this.renderExchangeTrend('chart-exchange-trend', historyRecords);
            this.renderExchangeProfitTrend('chart-exchange-profit-trend', historyRecords);
            this.renderFinancialIncomeTrend('chart-financial-income-trend', historyRecords);
            this.renderYieldTrend('chart-yield-trend', historyRecords);
            this.renderTotalProfitTrend('chart-profit-trend', historyRecords);
        } catch (error) {
            console.error('刷新图表失败:', error);
            ['chart-exchange-trend', 'chart-exchange-profit-trend', 'chart-financial-income-trend',
             'chart-yield-trend', 'chart-profit-trend'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = '<div class="empty-state"><p>加载图表数据失败</p></div>';
                }
            });
        }
    }

    /**
     * 窗口大小改变时重绘
     */
    resizeAll() {
        ['chart-exchange-trend', 'chart-exchange-profit-trend', 'chart-financial-income-trend',
         'chart-yield-trend', 'chart-profit-trend'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.data) {
                Plotly.Plots.resize(el);
            }
        });
    }
}

// 全局实例
const charts = new Charts();

/**
 * Calculator - 收益计算引擎
 * 支持理财收益、汇率盈亏、总盈亏及对应收益率计算
 */
class Calculator {
    /**
     * 计算收益
     * 理财收益倒算：当前价值 = 理财收益 + 汇率盈亏 + 原始成本
     * 当持有数量 ≠ 累计持仓时，差额体现为理财收益
     * @param {number} holdingAmount - 持有美元数量
     * @param {number} currentRate - 当前汇率
     * @param {number} avgCostRate - 平均买入成本汇率
     * @param {number} totalPurchasedUSD - 购买记录累计美元数量
     * @param {number} totalPurchasedCNY - 购买记录累计人民币金额
     */
    static calculate(holdingAmount, currentRate, avgCostRate, totalPurchasedUSD, totalPurchasedCNY) {
        if (!holdingAmount || !currentRate || !avgCostRate) {
            throw new Error('缺少必要的计算参数');
        }

        holdingAmount = parseFloat(holdingAmount);
        currentRate = parseFloat(currentRate);
        avgCostRate = parseFloat(avgCostRate);
        totalPurchasedUSD = parseFloat(totalPurchasedUSD) || 0;
        totalPurchasedCNY = parseFloat(totalPurchasedCNY) || 0;

        // 原始成本 = 购买记录统计的人民币总额
        const originalCost = totalPurchasedCNY > 0 ? totalPurchasedCNY : holdingAmount * avgCostRate;

        // 汇率价值 = 累计持仓美元 × 当前汇率（仅已购买部分的价值）
        const exchangeValue = totalPurchasedUSD > 0 ? totalPurchasedUSD * currentRate : holdingAmount * currentRate;

        // 汇率盈亏 = 汇率价值 - 原始成本
        const exchangeProfit = exchangeValue - originalCost;

        // 汇率收益率 = 汇率盈亏 / 原始成本 * 100
        const exchangeYield = originalCost > 0 ? (exchangeProfit / originalCost) * 100 : 0;

        // 当前总价值 = 持有数量 × 当前汇率
        const currentTotalValue = holdingAmount * currentRate;

        // 理财收益倒算：当前总价值 - 原始成本 - 汇率盈亏
        // 即：currentTotalValue = originalCost + exchangeProfit + financialIncome
        const financialIncome = currentTotalValue - originalCost - exchangeProfit;

        // 理财收益率 = 理财收益 / 原始成本 * 100
        const financialYield = originalCost > 0 ? (financialIncome / originalCost) * 100 : 0;

        // 总盈亏 = 当前总价值 - 原始成本
        const totalProfit = currentTotalValue - originalCost;

        // 总收益率 = 总盈亏 / 原始成本 * 100
        const totalYield = originalCost > 0 ? (totalProfit / originalCost) * 100 : 0;

        return {
            holdingAmount,
            currentRate,
            avgCostRate,
            originalCost: Calculator._round(originalCost),
            currentValue: Calculator._round(currentTotalValue),
            exchangeValue: Calculator._round(exchangeValue),
            financialIncome: Calculator._round(financialIncome),
            financialYield: Calculator._round(financialYield),
            exchangeProfit: Calculator._round(exchangeProfit),
            exchangeYield: Calculator._round(exchangeYield),
            totalProfit: Calculator._round(totalProfit),
            totalYield: Calculator._round(totalYield),
            totalPurchasedUSD: Calculator._round(totalPurchasedUSD),
            totalPurchasedCNY: Calculator._round(totalPurchasedCNY)
        };
    }

    /**
     * 格式化数字为人民币显示
     */
    static formatCurrency(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        const absVal = Math.abs(num);
        if (absVal >= 1000000) {
            return (num / 10000).toFixed(2) + ' 万';
        }
        return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * 格式化百分比
     */
    static formatPercent(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        const sign = num >= 0 ? '+' : '';
        return sign + num.toFixed(2) + '%';
    }

    /**
     * 格式化汇率
     */
    static formatRate(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return '—';
        return num.toFixed(4);
    }

    /**
     * 四舍五入到2位小数
     */
    static _round(value) {
        return Math.round(value * 100) / 100;
    }
}

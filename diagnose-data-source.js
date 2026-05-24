/**
 * 数据源诊断工具 - 检查数据来源
 * 在浏览器 Console 中运行此脚本
 */

async function diagnoseDataSource() {
    console.log('=== 📊 数据源诊断开始 ===\n');
    
    // 1. 检查 localStorage 数据
    console.log('1️⃣ localStorage 本地缓存:');
    const buyData = localStorage.getItem('usd_tracker_buy_records');
    const historyData = localStorage.getItem('usd_tracker_history_records');
    
    const localBuyRecords = buyData ? JSON.parse(buyData) : [];
    const localHistoryRecords = historyData ? JSON.parse(historyData) : [];
    
    console.log(`   📦 买入记录: ${localBuyRecords.length} 条`);
    if (localBuyRecords.length > 0) {
        console.log(`      最新记录: ${localBuyRecords[0].date}`);
        console.log(`      记录IDs: ${localBuyRecords.map(r => r.id).join(', ')}`);
    }
    
    console.log(`   📜 计算记录: ${localHistoryRecords.length} 条`);
    if (localHistoryRecords.length > 0) {
        console.log(`      最新记录: ${localHistoryRecords[0].queryTime}`);
        console.log(`      记录IDs: ${localHistoryRecords.map(r => r.id).join(', ')}`);
    }
    
    // 2. 检查 Supabase 连接状态
    console.log('\n2️⃣ Supabase 连接状态:');
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        console.log('   ⚠️ Supabase 未配置 - 数据仅来自 localStorage');
        return;
    }
    
    console.log(`   ✅ Supabase URL: ${window.SUPABASE_URL}`);
    console.log(`   🔑 Anon Key: ${window.SUPABASE_ANON_KEY.substring(0, 20)}...`);
    
    // 3. 尝试从云端获取数据（模拟未登录状态）
    console.log('\n3️⃣ 云端数据检查（匿名访问）:');
    try {
        const { createClient } = window.supabase || {};
        
        if (!createClient) {
            console.log('   ⚠️ Supabase 客户端库未加载');
            return;
        }
        
        const tempClient = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        
        // 检查买入记录
        const { data: cloudBuyData, error: buyError } = await tempClient
            .from('buy_records')
            .select('id, buy_time')
            .limit(5);
        
        if (buyError) {
            console.log(`   ❌ 买入记录表错误: ${buyError.message}`);
        } else {
            console.log(`   📦 云端买入记录: ${cloudBuyData?.length || 0} 条`);
            if (cloudBuyData?.length > 0) {
                console.log(`      示例数据:`, cloudBuyData);
            }
        }
        
        // 检查历史记录
        const { data: cloudHistoryData, error: historyError } = await tempClient
            .from('history_records')
            .select('id, query_time')
            .limit(5)
            .order('id', { ascending: false });
        
        if (historyError) {
            console.log(`   ❌ 历史记录表错误: ${historyError.message}`);
        } else {
            console.log(`   📜 云端计算记录: ${cloudHistoryData?.length || 0} 条`);
            if (cloudHistoryData?.length > 0) {
                console.log(`      示例数据:`, cloudHistoryData);
                console.log(`      ⚠️ 这就是未登录时看到的数据来源！`);
            }
        }
        
        // 4. 检查认证状态
        console.log('\n4️⃣ 认证状态:');
        const { data: { session } } = await tempClient.auth.getSession();
        if (session) {
            console.log(`   ✅ 已登录用户: ${session.user?.email || session.user?.id}`);
        } else {
            console.log(`   ⚠️ 未登录状态（匿名访问）`);
            console.log(`   💡 但仍能读取数据是因为 RLS 策略设置为 USING (true)`);
        }
        
    } catch (error) {
        console.error('   ❌ 检查失败:', error.message);
    }
    
    // 5. 总结诊断结果
    console.log('\n=== 📋 诊断总结 ===');
    console.log('如果看到"云端计算记录 > 0"且"未登录状态"，说明：');
    console.log('✅ RLS 策略允许匿名读取 history_records 表');
    console.log('✅ 你的数据保存在 Supabase 云端，而非 localStorage');
    console.log('💡 解决方案：修改 RLS 策略或清理云端数据\n');
}

// 自动执行
diagnoseDataSource();
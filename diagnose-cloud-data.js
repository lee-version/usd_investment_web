/**
 * 云端数据诊断工具
 * 
 * 使用方法：
 * 1. 在浏览器控制台（F12）中粘贴此代码并回车
 * 2. 会显示云端和本地的数据情况
 * 3. 帮助定位数据同步问题
 */

(async function diagnoseCloudData() {
    console.log('🔍 开始诊断云端数据...');
    console.log('='.repeat(60));
    
    try {
        // 1️⃣ 检查 StorageManager 状态
        console.log('\n📦 步骤 1/4: 检查存储管理器状态');
        
        if (!window.storageManager) {
            console.error('❌ storageManager 未初始化');
            return;
        }
        
        const sm = window.storageManager;
        console.log(`   ✅ StorageManager 版本: v3.x`);
        console.log(`   📍 代理模式: ${sm.proxyUrl ? '✅ 已启用' : '❌ 未启用'}`);
        console.log(`   ☁️ 客户端状态: ${sm.supabaseClient ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`   🔑 登录时间戳: ${sm.loginTimestamp || '❌ 未登录'}`);
        
        // 2️⃣ 检查本地数据
        console.log('\n💾 步骤 2/4: 检查本地数据 (localStorage)');
        console.log(`   📊 买入记录: ${sm.buyRecords.length} 条`);
        console.log(`   📈 历史记录: ${sm.historyRecords.length} 条`);
        
        if (sm.buyRecords.length > 0) {
            console.log('   📝 最近 3 条买入记录:');
            sm.buyRecords.slice(0, 3).forEach((r, i) => {
                console.log(`      ${i + 1}. ${r.date} | $${r.usdAmount} @ ${r.buyRate}`);
            });
        }
        
        if (sm.historyRecords.length > 0) {
            console.log('   📝 最近 3 条历史记录:');
            sm.historyRecords.slice(0, 3).forEach((r, i) => {
                console.log(`      ${i + 1}. ${r.queryTime} | 总收益: ¥${r.totalProfitCNY}`);
            });
        }
        
        // 3️⃣ 检查登录状态
        console.log('\n🔐 步骤 3/4: 检查登录状态');
        
        const isLoggedIn = await sm._isUserLoggedIn();
        console.log(`   登录状态: ${isLoggedIn ? '✅ 已登录' : '❌ 未登录'}`);
        
        if (!isLoggedIn) {
            console.warn('\n⚠️ 警告：未登录状态下无法访问云端数据！');
            console.log('💡 请先登录账户，然后重新运行此诊断脚本');
            return;
        }
        
        // 4️⃣ 查询云端数据
        console.log('\n☁️ 步骤 4/4: 查询云端数据库');
        
        if (!sm.supabaseClient) {
            console.error('❌ Supabase 客户端未初始化，无法查询云端');
            return;
        }
        
        console.log('   正在查询 buy_records 表...');
        const { data: cloudBuy, error: buyError } = await sm.supabaseClient
            .from(sm.TABLES.BUY_RECORDS)
            .select('*')
            .order('id', { ascending: true });
        
        if (buyError) {
            console.error('   ❌ 查询买入记录失败:', buyError.message);
        } else {
            console.log(`   ✅ 云端买入记录: ${cloudBuy?.length || 0} 条`);
            
            if (cloudBuy && cloudBuy.length > 0) {
                console.log('   📝 云端最近 3 条:');
                cloudBuy.slice(-3).forEach((r, i) => {
                    console.log(`      ${i + 1}. ID:${r.id} | ${r.buy_time} | $${r.usd_amount} @ ${r.buy_rate}`);
                });
            }
        }
        
        console.log('   正在查询 history_records 表...');
        const { data: cloudHistory, error: historyError } = await sm.supabaseClient
            .from(sm.TABLES.HISTORY_RECORDS)
            .select('*')
            .order('id', { ascending: true });
        
        if (historyError) {
            console.error('   ❌ 查询历史记录失败:', historyError.message);
        } else {
            console.log(`   ✅ 云端历史记录: ${cloudHistory?.length || 0} 条`);
            
            if (cloudHistory && cloudHistory.length > 0) {
                console.log('   📝 云端最近 3 条:');
                cloudHistory.slice(-3).forEach((r, i) => {
                    console.log(`      ${i + 1}. ID:${r.id} | ${r.query_time} | ¥${r.total_profit_cny}`);
                });
            }
        }
        
        // 5️⃣ 总结诊断结果
        console.log('\n' + '='.repeat(60));
        console.log('📋 诊断总结:');
        console.log('='.repeat(60));
        
        const localCount = sm.buyRecords.length + sm.historyRecords.length;
        const cloudCount = (cloudBuy?.length || 0) + (cloudHistory?.length || 0);
        
        console.log(`\n📊 数据统计:`);
        console.log(`   本地数据: ${localCount} 条 (${sm.buyRecords.length} 买入 + ${sm.historyRecords.length} 历史)`);
        console.log(`   云端数据: ${cloudCount} 条 (${cloudBuy?.length || 0} 买入 + ${cloudHistory?.length || 0} 历史)`);
        
        if (localCount > 0 && cloudCount === 0) {
            console.log('\n🎯 诊断结论: 云端数据库为空');
            console.log('');
            console.log('💡 原因分析:');
            console.log('   之前由于网络问题（ERR_CONNECTION_CLOSED），无法连接 Supabase');
            console.log('   所有保存的数据都只在浏览器本地（localStorage）');
            console.log('   现在代理已配置好，但云端还没有任何数据');
            console.log('');
            console.log('🔧 解决方案:');
            console.log('   方案 A: 手动将本地数据上传到云端（推荐）');
            console.log('   方案 B: 清空本地数据，重新开始录入（不推荐）');
            console.log('');
            console.log('📌 执行方案 A 的命令:');
            console.log('   在控制台运行: uploadLocalToCloud()');
        } else if (localCount === 0 && cloudCount === 0) {
            console.log('\n🎯 诊断结论: 本地和云端都没有数据');
            console.log('💡 这是正常的，如果你还没开始使用的话');
        } else if (cloudCount > 0) {
            console.log('\n🎯 诊断结论: 云端有数据但没有加载到本地');
            console.log('💡 可能原因:');
            console.log('   1. 登录后同步逻辑有问题');
            console.log('   2. 弹出的确认框被取消了');
            console.log('');
            console.log('🔧 尝试手动触发同步:');
            console.log('   在控制台运行: forceSyncFromCloud()');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ 诊断完成');
        
        // 提供辅助函数
        window.uploadLocalToCloud = async function() {
            console.log('\n🚀 开始上传本地数据到云端...\n');
            
            let uploaded = 0;
            let failed = 0;
            
            // 上传买入记录
            if (sm.buyRecords.length > 0) {
                console.log(`📤 上传 ${sm.buyRecords.length} 条买入记录...`);
                
                for (const record of sm.buyRecords) {
                    try {
                        const { error } = await sm.supabaseClient
                            .from(sm.TABLES.BUY_RECORDS)
                            .upsert({
                                id: record.id,
                                buy_time: record.date,
                                usd_amount: record.usdAmount,
                                buy_rate: record.buyRate,
                                cost_cny: record.costCNY,
                                created_at: record.createdAt,
                                updated_at: record.updatedAt
                            }, { onConflict: 'id' });
                        
                        if (error) throw error;
                        uploaded++;
                        console.log(`   ✅ ID:${record.id} ${record.date}`);
                    } catch (e) {
                        failed++;
                        console.error(`   ❌ ID:${record.id} 失败:`, e.message);
                    }
                }
            }
            
            // 上传历史记录
            if (sm.historyRecords.length > 0) {
                console.log(`\n📤 上传 ${sm.historyRecords.length} 条历史记录...`);
                
                for (const record of sm.historyRecords) {
                    try {
                        const { error } = await sm.supabaseClient
                            .from(sm.TABLES.HISTORY_RECORDS)
                            .upsert({
                                id: record.id,
                                query_time: record.queryTime,
                                finance_roi: record.financeROI,
                                finance_profit_usd: record.financeProfitUSD,
                                total_profit_cny: record.totalProfitCNY,
                                total_roi: record.totalROI,
                                current_rate: record.currentRate,
                                rate_profit_cny: record.rateProfitCNY,
                                current_hold_usd: record.currentHoldUSD,
                                created_at: record.createdAt
                            }, { onConflict: 'id' });
                        
                        if (error) throw error;
                        uploaded++;
                        console.log(`   ✅ ID:${record.id} ${record.queryTime}`);
                    } catch (e) {
                        failed++;
                        console.error(`   ❌ ID:${record.id} 失败:`, e.message);
                    }
                }
            }
            
            console.log(`\n✅ 上传完成！成功: ${uploaded} 条, 失败: ${failed} 条`);
            console.log('💡 刷新页面后即可看到云端数据');
        };
        
        window.forceSyncFromCloud = async function() {
            console.log('\n🔄 强制从云端同步数据...\n');
            
            try {
                await sm._downloadFromCloud();
                sm._saveToLocalStorage();
                
                console.log('✅ 同步完成！');
                console.log(`   买入记录: ${sm.buyRecords.length} 条`);
                console.log(`   历史记录: ${sm.historyRecords.length} 条`);
                console.log('\n💡 刷新页面以更新界面显示');
            } catch (e) {
                console.error('❌ 同步失败:', e);
            }
        };
        
    } catch (error) {
        console.error('❌ 诊断过程出错:', error);
    }
})();

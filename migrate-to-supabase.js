/**
 * MySQL → PostgreSQL 数据迁移工具
 * 
 * 使用方法：
 * 1. 确保 MySQL 服务正在运行
 * 2. 安装依赖: npm install mysql2 pg
 * 3. 运行: node migrate-to-supabase.js
 * 
 * 功能：
 * - 从 MySQL 导出 buy_records, history_records, config 表数据
 * - 转换为 PostgreSQL 格式
 * - 生成可直接在 Supabase SQL Editor 执行的 INSERT 语句
 */

const mysql = require('mysql2/promise');
const fs = require('fs');

// MySQL 配置（现有数据库）
const mysqlConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'usd_invest'
};

async function migrateData() {
    console.log('🚀 开始数据迁移: MySQL → PostgreSQL\n');
    
    let mysqlConnection;
    
    try {
        // 连接 MySQL
        console.log('📦 连接 MySQL 数据库...');
        mysqlConnection = await mysql.createConnection(mysqlConfig);
        console.log('✅ MySQL 连接成功\n');
        
        // 迁移 buy_records 表
        await migrateTable(mysqlConnection, 'buy_records', `
            SELECT 
                id,
                DATE_FORMAT(buy_time, '%Y-%m-%d') as buy_time,
                usd_amount,
                buy_rate,
                cost_cny,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
            FROM buy_records 
            ORDER BY id
        `);
        
        // 迁移 history_records 表
        await migrateTable(mysqlConnection, 'history_records', `
            SELECT
                id,
                DATE_FORMAT(query_time, '%Y-%m-%d') as query_time,
                finance_roi,
                finance_profit_usd,
                total_profit_cny,
                total_roi,
                current_rate,
                rate_profit_cny,
                current_hold_usd,
                DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
            FROM history_records
            ORDER BY id
        `);
        
        // 迁移 config 表
        await migrateTable(mysqlConnection, 'config', `
            SELECT 
                id,
                current_hold_usd,
                current_rate,
                CASE WHEN last_update IS NOT NULL 
                    THEN DATE_FORMAT(last_update, '%Y-%m-%d %H:%i:%s') 
                    ELSE NULL 
                END as last_update
            FROM config 
            WHERE id = 1
        `);
        
        console.log('\n✨ 数据迁移完成！');
        console.log('\n📝 下一步操作：');
        console.log('1. 打开文件: migration_output.sql');
        console.log('2. 复制全部内容');
        console.log('3. 在 Supabase SQL Editor 中粘贴并执行');
        console.log('4. 验证数据是否正确导入\n');
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        if (mysqlConnection) {
            await mysqlConnection.end();
        }
    }
}

async function migrateTable(connection, tableName, query) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 正在迁移表: ${tableName}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        const [rows] = await connection.execute(query);
        
        if (rows.length === 0) {
            console.log(`⚠️  表 ${tableName} 为空，跳过`);
            return;
        }
        
        console.log(`✅ 找到 ${rows.length} 条记录`);
        
        // 生成 PostgreSQL INSERT 语句
        const sqlStatements = generateInsertSQL(tableName, rows);
        
        // 保存到文件
        const outputFile = `migration_${tableName}.sql`;
        fs.writeFileSync(outputFile, sqlStatements.join('\n\n'));
        console.log(`💾 已保存到: ${outputFile}`);
        
        // 同时追加到主迁移文件
        appendToMainMigration(tableName, sqlStatements);
        
    } catch (error) {
        console.error(`❌ 迁移表 ${tableName} 失败:`, error.message);
        throw error;
    }
}

function generateInsertSQL(tableName, rows) {
    const statements = [];
    
    statements.push(`-- ========================================`);
    statements.push(`-- 迁移数据: ${tableName}`);
    statements.push(`-- 记录数: ${rows.length}`);
    statements.push(`-- 生成时间: ${new Date().toISOString()}`);
    statements.push(`-- ========================================\n`);
    
    // 根据不同表生成不同的 INSERT 语句
    if (tableName === 'buy_records') {
        rows.forEach(row => {
            const values = [
                row.id,
                `'${row.buy_time}'`,
                row.usd_amount,
                row.buy_rate,
                `'${row.created_at}'`,
                `'${row.updated_at}'`
            ];
            
            statements.push(
                `INSERT INTO public.${tableName} (id, buy_time, usd_amount, buy_rate, created_at, updated_at)\n` +
                `VALUES (${values.join(', ')});\n`
            );
        });
    } else if (tableName === 'history_records') {
        rows.forEach(row => {
            const values = [
                row.id,
                `'${row.query_time}'`,
                row.finance_roi,
                row.finance_profit_usd,
                row.total_profit_cny,
                row.total_roi,
                row.current_rate,
                row.rate_profit_cny,
                row.current_hold_usd,
                `'${row.created_at}'`
            ];
            
            statements.push(
                `INSERT INTO public.${tableName} (id, query_time, finance_roi, finance_profit_usd, total_profit_cny, total_roi, current_rate, rate_profit_cny, current_hold_usd, created_at)\n` +
                `VALUES (${values.join(', ')});\n`
            );
        });
    } else if (tableName === 'config') {
        if (rows.length > 0) {
            const row = rows[0];
            const lastUpdate = row.last_update ? `'${row.last_update}'` : 'NULL';
            
            // 先删除已存在的记录（避免重复键错误）
            statements.push(`-- 先删除已存在的配置记录`);
            statements.push(`DELETE FROM public.${tableName} WHERE id = ${row.id};\n`);
            
            // 再插入新数据
            statements.push(
                `INSERT INTO public.${tableName} (id, current_hold_usd, current_rate, last_update)\n` +
                `VALUES (${row.id}, ${row.current_hold_usd}, ${row.current_rate}, ${lastUpdate});\n`
            );
        }
    }
    
    // 重置序列值（PostgreSQL 自增ID）
    const maxId = Math.max(...rows.map(r => r.id));
    statements.push(`-- 重置自增序列`);
    statements.push(`SELECT setval(pg_get_serial_sequence('public.${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM public.${tableName}), 1));\n`);
    
    return statements;
}

function appendToMainMigration(tableName, sqlStatements) {
    const mainFile = 'migration_output.sql';
    let content = '';
    
    if (fs.existsSync(mainFile)) {
        content = fs.readFileSync(mainFile, 'utf8');
    }
    
    content += '\n\n' + sqlStatements.join('\n');
    fs.writeFileSync(mainFile, content);
}

// 执行迁移
migrateData().catch(console.error);

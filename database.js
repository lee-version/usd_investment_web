const mysql = require('mysql2/promise');

const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'usd_invest',
    ssl: {
        rejectUnauthorized: false
    }
};

let pool;

async function initDB() {
    try {
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const connection = await pool.getConnection();
        console.log('✅ 数据库连接成功');
        connection.release();

        return pool;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        throw error;
    }
}

function getPool() {
    if (!pool) {
        throw new Error('数据库未初始化');
    }
    return pool;
}

module.exports = { initDB, getPool };

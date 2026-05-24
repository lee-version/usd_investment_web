const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ 错误: 缺少 Supabase 配置');
    console.error('请确保 .env 文件中包含 SUPABASE_URL 和 SUPABASE_ANON_KEY');
    console.error('参考 .env.example 文件进行配置');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

console.log('✅ Supabase 客户端初始化成功');

module.exports = { supabase };

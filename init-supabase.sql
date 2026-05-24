-- ============================================================
-- USD Revenue Tracker - Supabase 完整数据库初始化脚本
-- 版本: 2.0.0
-- 说明: 在 Supabase SQL Editor 中执行此脚本
-- 包含: 用户认证表 + 业务数据表
-- ============================================================

-- 1. 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 第一部分：用户认证相关表
-- ============================================================

-- 2. 创建用户表 (users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_uid UUID UNIQUE NOT NULL,
    github_id VARCHAR(255) UNIQUE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON public.users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

COMMENT ON TABLE public.users IS '用户表 - 存储 GitHub OAuth 登录的用户信息';


-- 3. 创建用户资料表 (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bio TEXT,
    location VARCHAR(255),
    company VARCHAR(255),
    blog_url TEXT,
    preferences JSONB DEFAULT '{}',
    default_currency VARCHAR(10) DEFAULT 'CNY',
    notification_enabled BOOLEAN DEFAULT TRUE,
    theme VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
COMMENT ON TABLE public.profiles IS '用户资料扩展表';


-- 4. 创建会话日志表 (user_sessions)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    login_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    logout_at TIMESTAMPTZ,
    session_token_hash TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);


-- ============================================================
-- 第二部分：业务数据表（从 MySQL 迁移）
-- ============================================================

-- 5. 创建买入记录表 (buy_records)
CREATE TABLE IF NOT EXISTS public.buy_records (
    id SERIAL PRIMARY KEY,
    buy_time DATE NOT NULL,
    usd_amount DECIMAL(12, 2) NOT NULL,
    buy_rate DECIMAL(10, 4) NOT NULL,
    cost_cny DECIMAL(14, 2) GENERATED ALWAYS AS 
        (ROUND(usd_amount * buy_rate, 2)) STORED,
    created_at DATE NOT NULL,
    updated_at DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buy_records_buy_time ON public.buy_records(buy_time DESC);
CREATE INDEX IF NOT EXISTS idx_buy_records_created_at ON public.buy_records(created_at DESC);

COMMENT ON TABLE public.buy_records IS '买入记录 - 存储每次美元买入的日期、汇率和数量';
COMMENT ON COLUMN public.buy_records.cost_cny IS '自动计算的人民币成本 = usd_amount * buy_rate';


-- 6. 创建历史计算记录表 (history_records)
CREATE TABLE IF NOT EXISTS public.history_records (
    id SERIAL PRIMARY KEY,
    query_time DATE NOT NULL,
    finance_roi DECIMAL(8, 4),
    finance_profit_usd DECIMAL(12, 2),
    total_profit_cny DECIMAL(14, 2),
    total_roi DECIMAL(8, 4),
    current_rate DECIMAL(10, 4),
    rate_profit_cny DECIMAL(14, 2),
    current_hold_usd DECIMAL(12, 2),
    created_at DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_records_query_time ON public.history_records(query_time DESC);
CREATE INDEX IF NOT EXISTS idx_history_records_created_at ON public.history_records(created_at DESC);

COMMENT ON TABLE public.history_records IS '历史计算记录 - 存储每次收益计算的结果';


-- 7. 创建系统配置表 (config)
CREATE TABLE IF NOT EXISTS public.config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_hold_usd DECIMAL(12, 2) DEFAULT 0,
    current_rate DECIMAL(10, 4) DEFAULT 0,
    last_update TIMESTAMPTZ,
    
    CONSTRAINT config_single_row CHECK (id = 1)
);

COMMENT ON TABLE public.config IS '系统配置 - 存储当前持仓和汇率（单行表）';


-- ============================================================
-- 第三部分：启用 Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buy_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 第四部分：RLS 策略定义
-- ============================================================

-- users 表策略
CREATE POLICY "允许已认证用户查看用户信息" ON public.users
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许用户更新自己的信息" ON public.users
    FOR UPDATE USING (auth.uid() = supabase_uid);

CREATE POLICY "允许用户插入自己的记录" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = supabase_uid);


-- profiles 表策略
CREATE POLICY "允许已认证用户查看资料" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许用户更新自己的资料" ON public.profiles
    FOR UPDATE USING (
        user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid())
    );

CREATE POLICY "允许用户插入自己的资料" ON public.profiles
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid())
    );


-- user_sessions 表策略
CREATE POLICY "允许用户查看自己的会话" ON public.user_sessions
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid())
    );

CREATE POLICY "允许用户插入自己的会话" ON public.user_sessions
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE supabase_uid = auth.uid())
    );


-- buy_records 表策略（公开读写，适合个人工具）
CREATE POLICY "允许所有人查看买入记录" ON public.buy_records
    FOR SELECT USING (true);

CREATE POLICY "允许所有人插入买入记录" ON public.buy_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "允许所有人更新买入记录" ON public.buy_records
    FOR UPDATE USING (true);

CREATE POLICY "允许所有人删除买入记录" ON public.buy_records
    FOR DELETE USING (true);


-- history_records 表策略（公开读写）
CREATE POLICY "允许所有人查看历史记录" ON public.history_records
    FOR SELECT USING (true);

CREATE POLICY "允许所有人插入历史记录" ON public.history_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "允许所有人删除历史记录" ON public.history_records
    FOR DELETE USING (true);


-- config 表策略（公开读写）
CREATE POLICY "允许所有人查看配置" ON public.config
    FOR SELECT USING (true);

CREATE POLICY "允许所有人更新配置" ON public.config
    FOR UPDATE USING (true);

CREATE POLICY "允许所有人插入配置" ON public.config
    FOR INSERT WITH CHECK (true);


-- ============================================================
-- 第五部分：触发器函数
-- ============================================================

-- 自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_update_users ON public.users;
CREATE TRIGGER on_update_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_update_profiles ON public.profiles;
CREATE TRIGGER on_update_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_update_buy_records ON public.buy_records;
CREATE TRIGGER on_update_buy_records
    BEFORE UPDATE ON public.buy_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();


-- 新用户注册时自动创建记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO public.users (supabase_uid, username, email, avatar_url, last_login_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        NOW()
    )
    RETURNING id INTO new_user_id;
    
    INSERT INTO public.profiles (user_id)
    VALUES (new_user_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- 用户删除时清理数据
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();


-- ============================================================
-- 第六部分：权限设置
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 公开读取权限（用于未登录用户访问数据）
GRANT SELECT ON public.buy_records TO anon;
GRANT SELECT ON public.history_records TO anon;
GRANT SELECT ON public.config TO anon;


-- ============================================================
-- 第七部分：初始化配置记录（如果不存在）
-- ============================================================

INSERT INTO public.config (id, current_hold_usd, current_rate)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ✅ 初始化完成！
-- 
-- 已创建的表：
--   ✅ 用户认证:
--      - users           (用户基本信息)
--      - profiles        (用户扩展资料)
--      - user_sessions   (会话日志)
--
--   ✅ 业务数据:
--      - buy_records     (买入记录)
--      - history_records (历史计算记录)
--      - config          (系统配置)
--
-- 已启用的功能：
--   ✅ Row Level Security (RLS)
--   ✅ 自动更新时间戳
--   ✅ 新用户自动注册
--   ✅ 用户删除自动清理
--   ✅ cost_cny 自动计算列
--
-- 下一步：
--   1. 运行 migrate-to-supabase.js 从 MySQL 导入现有数据
--   2. 或手动在 SQL Editor 中执行 migration_output.sql
-- ============================================================

-- ============================================================
-- 数据库迁移：添加 user_id 实现按用户数据隔离
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 1. 给 buy_records 添加 user_id 列
ALTER TABLE public.buy_records
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 给 buy_records 的 user_id 创建索引
CREATE INDEX IF NOT EXISTS idx_buy_records_user_id ON public.buy_records(user_id);

-- 2. 给 history_records 添加 user_id 列
ALTER TABLE public.history_records
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_history_records_user_id ON public.history_records(user_id);

-- 3. 给 config 表添加 user_id 列（每用户一行配置）
ALTER TABLE public.config
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 移除 config 表的单行约束（改为每用户一行）
ALTER TABLE public.config DROP CONSTRAINT IF EXISTS config_single_row;
-- 移除 id 的默认值和主键约束，改用新主键
ALTER TABLE public.config DROP CONSTRAINT IF EXISTS config_pkey;
ALTER TABLE public.config ADD PRIMARY KEY (id);
-- 改 id 为自增，不再限制为 1
ALTER TABLE public.config ALTER COLUMN id DROP DEFAULT;
CREATE SEQUENCE IF NOT EXISTS public.config_id_seq;
ALTER TABLE public.config ALTER COLUMN id SET DEFAULT nextval('public.config_id_seq');
ALTER SEQUENCE public.config_id_seq OWNED BY public.config.id;

CREATE INDEX IF NOT EXISTS idx_config_user_id ON public.config(user_id);

-- 4. 删除旧的 RLS 策略（公开读写）
DROP POLICY IF EXISTS "允许所有人查看买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人插入买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人更新买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人删除买入记录" ON public.buy_records;

DROP POLICY IF EXISTS "允许所有人查看历史记录" ON public.history_records;
DROP POLICY IF EXISTS "允许所有人插入历史记录" ON public.history_records;
DROP POLICY IF EXISTS "允许所有人删除历史记录" ON public.history_records;

DROP POLICY IF EXISTS "允许所有人查看配置" ON public.config;
DROP POLICY IF EXISTS "允许所有人更新配置" ON public.config;
DROP POLICY IF EXISTS "允许所有人插入配置" ON public.config;

-- 5. 创建新的 RLS 策略（按用户隔离）

-- buy_records: 用户只能操作自己的数据
CREATE POLICY "用户查看自己的买入记录" ON public.buy_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户插入自己的买入记录" ON public.buy_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户更新自己的买入记录" ON public.buy_records
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "用户删除自己的买入记录" ON public.buy_records
    FOR DELETE USING (auth.uid() = user_id);

-- history_records: 用户只能操作自己的数据
CREATE POLICY "用户查看自己的历史记录" ON public.history_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户插入自己的历史记录" ON public.history_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户删除自己的历史记录" ON public.history_records
    FOR DELETE USING (auth.uid() = user_id);

-- config: 用户只能操作自己的配置
CREATE POLICY "用户查看自己的配置" ON public.config
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户插入自己的配置" ON public.config
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户更新自己的配置" ON public.config
    FOR UPDATE USING (auth.uid() = user_id);

-- 6. 创建 RPC 函数：一次性上传全量用户配置（防抖批量同步用）
CREATE OR REPLACE FUNCTION public.update_user_config_full(
    p_user_id UUID,
    p_buy_records JSONB,
    p_history_records JSONB,
    p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB := '{}';
BEGIN
    -- 删除该用户旧数据
    DELETE FROM public.buy_records WHERE user_id = p_user_id;
    DELETE FROM public.history_records WHERE user_id = p_user_id;
    DELETE FROM public.config WHERE user_id = p_user_id;

    -- 插入新的买入记录
    IF p_buy_records IS NOT NULL AND jsonb_array_length(p_buy_records) > 0 THEN
        INSERT INTO public.buy_records (user_id, buy_time, usd_amount, buy_rate, created_at, updated_at)
        SELECT
            p_user_id,
            (r->>'date')::date,
            (r->>'usdAmount')::numeric(12,2),
            (r->>'buyRate')::numeric(10,4),
            (r->>'createdAt')::timestamptz,
            (r->>'updatedAt')::timestamptz
        FROM jsonb_array_elements(p_buy_records) AS r;
    END IF;

    -- 插入新的历史记录
    IF p_history_records IS NOT NULL AND jsonb_array_length(p_history_records) > 0 THEN
        INSERT INTO public.history_records (user_id, query_time, finance_roi, finance_profit_usd, total_profit_cny, total_roi, current_rate, rate_profit_cny, current_hold_usd, created_at)
        SELECT
            p_user_id,
            (r->>'queryTime')::date,
            (r->>'financeROI')::numeric(8,4),
            (r->>'financeProfitUSD')::numeric(12,2),
            (r->>'totalProfitCNY')::numeric(14,2),
            (r->>'totalROI')::numeric(8,4),
            (r->>'currentRate')::numeric(10,4),
            (r->>'rateProfitCNY')::numeric(14,2),
            (r->>'currentHoldUSD')::numeric(12,2),
            (r->>'createdAt')::timestamptz
        FROM jsonb_array_elements(p_history_records) AS r;
    END IF;

    -- 插入新的配置
    IF p_config IS NOT NULL THEN
        INSERT INTO public.config (user_id, current_hold_usd, current_rate, last_update)
        VALUES (
            p_user_id,
            COALESCE((p_config->>'currentHoldUSD')::numeric(12,2), 0),
            COALESCE((p_config->>'currentRate')::numeric(10,4), 0),
            COALESCE((p_config->>'lastUpdate')::timestamptz, now())
        );
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'buy_records_count', (SELECT count(*) FROM public.buy_records WHERE user_id = p_user_id),
        'history_records_count', (SELECT count(*) FROM public.history_records WHERE user_id = p_user_id),
        'config_saved', (SELECT count(*) FROM public.config WHERE user_id = p_user_id) > 0
    );

    RETURN v_result;
END;
$$;

-- 7. 授权
GRANT EXECUTE ON FUNCTION public.update_user_config_full(UUID, JSONB, JSONB, JSONB) TO authenticated;

-- ✅ 迁移完成

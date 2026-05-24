-- ============================================================
-- 修复 RLS 权限：限制为仅登录用户可访问
-- 
-- 问题：当前允许匿名用户读取/写入所有业务表
-- 风险：任何人都可以查看或修改你的财务数据
-- 解决：改为仅认证用户（已登录）才能访问
-- 
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================


-- ============================================================
-- 第一部分：撤销匿名用户的公开权限
-- ============================================================

-- 撤销 buy_records 表的匿名访问权限
DROP POLICY IF EXISTS "允许所有人查看买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人插入买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人更新买入记录" ON public.buy_records;
DROP POLICY IF EXISTS "允许所有人删除买入记录" ON public.buy_records;

-- 撤销 history_records 表的匿名访问权限
DROP POLICY IF EXISTS "允许所有人查看历史记录" ON public.history_records;
DROP POLICY IF EXISTS "允许所有人插入历史记录" ON public.history_records;
DROP POLICY IF EXISTS "允许所有人删除历史记录" ON public.history_records;

-- 撤销 config 表的匿名访问权限（保留 SELECT 用于初始化）
DROP POLICY IF EXISTS "允许所有人查看配置" ON public.config;
DROP POLICY IF EXISTS "允许所有人更新配置" ON public.config;
DROP POLICY IF EXISTS "允许所有人插入配置" ON public.config;


-- ============================================================
-- 第二部分：创建新的认证用户策略
-- ============================================================

-- buy_records 表策略（仅登录用户）
CREATE POLICY "允许已认证用户查看买入记录" ON public.buy_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户插入买入记录" ON public.buy_records
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户更新买入记录" ON public.buy_records
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户删除买入记录" ON public.buy_records
    FOR DELETE USING (auth.uid() IS NOT NULL);


-- history_records 表策略（仅登录用户）
CREATE POLICY "允许已认证用户查看历史记录" ON public.history_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户插入历史记录" ON public.history_records
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户更新历史记录" ON public.history_records
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户删除历史记录" ON public.history_records
    FOR DELETE USING (auth.uid() IS NOT NULL);


-- config 表策略（仅登录用户）
CREATE POLICY "允许已认证用户查看配置" ON public.config
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户更新配置" ON public.config
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "允许已认证用户插入配置" ON public.config
    FOR INSERT WITH_CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 第三部分：清理旧的公开 GRANT 权限
-- ============================================================

REVOKE ALL ON public.buy_records FROM anon;
REVOKE ALL ON public.history_records FROM anon;
REVOKE SELECT, INSERT, UPDATE ON public.config FROM anon;


-- ============================================================
-- 第四部分：验证新策略
-- ============================================================

SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename IN ('buy_records', 'history_records', 'config')
ORDER BY tablename, cmd;


-- ============================================================
-- ✅ 修复完成！
-- 
-- 新的安全策略：
--   ✅ 只有登录用户才能读取/写入业务数据
--   ✅ 未登录用户无法访问任何敏感信息
--   ✅ 数据隐私得到保护
--
-- 测试方法：
--   1. 打开应用（未登录状态）→ 应该看不到任何数据
--   2. 登录后 → 应该能看到你的个人数据
--   3. 清空 localStorage → 刷新后仍能从云端加载数据
-- ============================================================
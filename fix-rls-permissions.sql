-- ============================================================
-- 修复 RLS 权限：为 history_records 添加缺失的 UPDATE 策略
-- 
-- 问题：upsert 操作需要 UPDATE 权限
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================


-- 为 history_records 表添加 UPDATE 策略
CREATE POLICY "允许所有人更新历史记录" ON public.history_records
    FOR UPDATE USING (true);


-- 验证策略是否生效
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'history_records';


-- ============================================================
-- ✅ 修复完成！
-- 
-- history_records 表现在应该有完整的 CRUD 权限：
--   ✅ SELECT - 查看数据
--   ✅ INSERT - 插入新数据
--   ✅ UPDATE - 更新已有数据（upsert 需要）
--   ✅ DELETE - 删除数据
-- ============================================================

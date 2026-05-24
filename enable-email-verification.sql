-- ============================================================
-- 启用邮箱验证功能 - Supabase 配置指南
-- 
-- 执行位置: Supabase Dashboard → SQL Editor
-- 或者通过 Supabase Dashboard → Authentication → Settings 手动配置
-- ============================================================


-- ============================================================
-- 方法 1：通过 SQL 启用（推荐）
-- ============================================================

-- 1. 启用邮箱验证（Email Confirmation）
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

-- 注意：Supabase 的邮箱验证主要通过 Dashboard 配置，SQL 只能辅助

-- 2. 确保用户表有正确的触发器（自动设置 email_confirmed_at）
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- 当用户点击验证链接时，Supabase 会自动更新此字段
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 方法 2：手动配置步骤（必须执行）
-- 
-- ⚠️ 重要：以下操作需要在 Supabase Dashboard 中手动完成！
-- ============================================================

/*
   📋 手动配置清单：
   
   ✅ 步骤 1：启用 Email Auth Provider
   ----------------------------------------
   1. 打开 https://supabase.com/dashboard
   2. 选择你的项目
   3. 左侧菜单 → Authentication → Providers
   4. 找到 "Email" provider
   5. 点击启用开关（Toggle ON）
   
   
   ✅ 步骤 2：配置邮箱验证选项
   ----------------------------------------
   1. 在同一个页面（Authentication → Settings）
   2. 滚动到 "Email Auth" 部分
   3. 启用以下选项：
      ☑️ Enable email confirmations (启用邮箱确认)
      ☑️ Secure email change (安全更改邮箱)
      ☑️ Enable email link (可选，用于无密码登录)
   
   
   ✅ 步骤 3：配置邮件模板（可选但推荐）
   ----------------------------------------
   1. Authentication → Email Templates
   2. 编辑以下模板（使用变量）：
      
      - Confirm signup (注册确认):
        {{ .ConfirmationURL }}
        
      - Invite user (邀请用户):
        {{ .InviteURL }}
        
      - Magic Link (魔法链接):
        {{ .MagicLinkURL }}
        
      - Change Email Address (更改邮箱):
        {{ .ConfirmationURL }}
        
      - Reset Password (重置密码):
        {{ .RedirectURL }}
   
   
   ✅ 步骤 4：配置 SMTP 邮件服务（重要！）
   ----------------------------------------
   如果 Supabase 默认邮件服务不够用，可以配置自定义 SMTP：
   
   1. Authentication → SMTP Settings
   2. 填写信息：
      - Host: smtp.example.com (如 smtp.gmail.com)
      - Port: 587 (TLS) 或 465 (SSL)
      - User: your-email@gmail.com
      - Password: 应用专用密码（不是登录密码）
      - Sender name: USD 投资追踪器
      - Sender email: noreply@yourdomain.com
   
   推荐的免费/低成本邮件服务：
   - Gmail SMTP (免费，有限制)
   - SendGrid (每月 100 封免费)
   - Mailgun (每月 1000 封免费)
   - Resend (每月 3000 封免费) ⭐ 推荐
   
   
   ✅ 步骤 5：配置站点 URL（Site URL）
   ----------------------------------------
   1. Authentication → URL Configuration
   2. 设置 Site URL:
      https://lee-version.github.io/usd_investment_web
   
   3. 可选：添加 Redirect URLs:
      https://lee-version.github.io/*
      http://localhost:* (开发环境)
*/


-- ============================================================
-- 方法 3：验证配置是否成功
-- ============================================================

-- 检查认证设置
SELECT 
    key,
    value
FROM auth.config 
WHERE key IN (
    'mailer_enabled',
    'mailer_admin_email', 
    'external_email_enabled',
    'mailer_secure_email_change_enabled'
);


-- 查看已注册用户的邮箱验证状态
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;


-- ============================================================
-- 常见问题排查
-- ============================================================

/*
   ❌ 问题 1：收不到验证邮件？
   解决：
   - 检查垃圾邮件文件夹
   - 确认 SMTP 配置正确
   - 查看 Supabase Logs → Edge Functions / Database
   - 测试发送：Authentication → Emails → Test
   
   
   ❌ 问题 2：点击验证链接后报错？
   解决：
   - 确认 Site URL 正确（不能有多余路径）
   - 检查 Redirect URLs 是否包含当前域名
   - 确认链接未过期（默认 24 小时）
   
   
   ❌ 问题 3：注册后无法登录？
   解决：
   - 等待几秒让数据库同步
   - 检查邮箱是否已验证（如果强制要求）
   - 查看 auth.users 表的 email_confirmed_at 字段
   
   
   ❌ 问题 4：想禁用邮箱验证？
   解决：
   - Dashboard → Authentication → Settings
   - 取消勾选 "Enable email confirmations"
   - 已注册的用户仍需验证才能登录
*/


-- ============================================================
-- 高级配置：强制邮箱验证（可选）
-- ============================================================

/*
   ⚠️ 警告：以下为高级配置，请谨慎执行！
   
   如果你想确保只有验证过邮箱的用户才能登录，
   可以在应用层或数据库层面添加检查。
*/

-- 创建函数检查邮箱是否已验证
CREATE OR REPLACE FUNCTION public.check_email_verified(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_confirmed BOOLEAN;
BEGIN
    SELECT email_confirmed_at IS NOT NULL INTO is_confirmed
    FROM auth.users 
    WHERE id = user_uuid;
    
    RETURN COALESCE(is_confirmed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_email_verified TO authenticated;


-- 在 RLS 策略中使用（示例）
/*
CREATE POLICY "仅允许已验证用户访问" ON public.buy_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email_confirmed_at IS NOT NULL
        )
    );
*/


-- ============================================================
-- ✅ 配置完成！
-- 
-- 下一步：
-- 1. 刷新前端页面测试注册功能
-- 2. 使用真实邮箱注册一个测试账户
-- 3. 检查收件箱获取验证邮件
-- 4. 点击验证链接完成验证
-- 5. 使用该邮箱和密码登录
--
-- 监控工具：
-- - Supabase Dashboard → Auth → Users (查看用户列表)
-- - Supabase Dashboard → Logs → Database (查看错误日志)
-- - 浏览器 Console (查看前端日志)
-- ============================================================
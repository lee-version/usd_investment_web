const { supabase } = require('./supabase');

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌',
                code: 'MISSING_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error) {
            console.error('Token 验证失败:', error.message);
            return res.status(401).json({
                success: false,
                message: '认证令牌无效或已过期',
                code: 'INVALID_TOKEN'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在',
                code: 'USER_NOT_FOUND'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('认证中间件错误:', error);
        return res.status(500).json({
            success: false,
            message: '服务器内部错误',
            code: 'AUTH_ERROR'
        });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            req.user = null;
            return next();
        }

        req.user = user;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = { authenticateUser, optionalAuth };

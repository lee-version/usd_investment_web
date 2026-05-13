@echo off
chcp 65001 >nul
title USD 收益追踪系统

echo ╔══════════════════════════════════════╗
echo ║     USD 收益追踪系统 - 启动中...      ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/3] 检查 Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
node -v
echo.

echo [2/3] 检查依赖包...
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 安装依赖失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖已就绪
)
echo.

echo [3/3] 启动服务器...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✨ 服务器即将启动，请稍候...
echo.
echo 💡 启动成功后，请在浏览器访问：
echo    http://localhost:3000
echo.
echo ⚠️  按 Ctrl+C 可停止服务器
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

node server.js

echo.
echo ╔══════════════════════════════════════╗
echo ║       服务器已停止                     ║
echo ╚══════════════════════════════════════╝
pause

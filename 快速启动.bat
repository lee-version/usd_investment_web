@echo off
chcp 65001 >nul 2>nul
title USD 收益追踪系统

:: ============================================
:: 🎯 项目根目录（固定路径）
:: 无论这个脚本放在哪里，都会自动找到项目
:: ============================================
set "PROJECT_DIR=c:\Users\10563\PycharmProjects\自定义项目\财务"

:: 切换到项目目录
cd /d "%PROJECT_DIR%"

:: 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ╔══════════════════════════════════════╗
    echo ║  ❌ 错误：未检测到 Node.js           ║
    echo ║  请安装: https://nodejs.org/          ║
    echo ╚══════════════════════════════════════╝
    pause
    exit /b 1
)

:: 检查依赖是否安装
if not exist "node_modules" (
    echo [安装] 首次运行，正在安装依赖...
    call npm install
)

echo.
echo ╔══════════════════════════════════════╗
echo ║     正在启动服务器...                ║
echo ║     地址: http://localhost:3000      ║
echo ╚══════════════════════════════════════╝
echo.

:: 前台启动服务器（显示日志和错误信息）
node server.js

echo.
echo ╔══════════════════════════════════════╗
echo ║  服务器已停止                         ║
echo ╚══════════════════════════════════════╝
pause

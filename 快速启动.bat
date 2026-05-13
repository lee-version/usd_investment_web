@echo off
chcp 65001 >nul
title USD 收益追踪系统 - 快速启动

cd /d "%~dp0"

echo [启动] 正在检查环境...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
)

echo ✅ 启动服务器...
start "" node server.js

echo ⏳ 等待服务器启动...
timeout /t 3 /nobreak >nul

echo 🌐 正在打开浏览器...
start http://localhost:3000

echo ✅ 完成！浏览器已打开
echo.
echo 💡 关闭此窗口不会停止服务器
echo ⚠️  如需停止服务器，请在服务器窗口按 Ctrl+C
timeout /t 5

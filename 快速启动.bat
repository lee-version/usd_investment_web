@echo off
chcp 65001 >nul 2>nul
title USD 收益追踪系统

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo   ❌ 未检测到 Node.js
    echo   请先安装: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 安装依赖（首次）
if not exist "node_modules" (
    echo.
    echo   📦 首次运行，正在安装依赖...
    call npm install >nul 2>&1
)

:: 检查端口是否被占用
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo   ⚠️  端口 3000 已被占用
    echo   可能服务器已在运行
    echo   请访问: http://localhost:3000
    echo.
    start http://localhost:3000
    timeout /t 3
    exit /b 0
)

:: 使用 PowerShell 后台启动（兼容中文路径）
echo.
echo   🚀 正在启动服务器...
powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && node server.js && pause' -WindowStyle Hidden"

:: 等待服务器启动
echo   ⏳ 等待服务器就绪...
timeout /t 4 /nobreak >nul

:: 打开浏览器
echo   🌐 打开浏览器...
start http://localhost:3000

timeout /t 1 /nobreak >nul

echo.
echo   ✅ 启动完成！
echo   💡 关闭此窗口不会影响服务器运行
echo   ⚠️  如需停止服务器，请关闭任务管理器中的 node.exe 进程
echo.
timeout /t 5
exit

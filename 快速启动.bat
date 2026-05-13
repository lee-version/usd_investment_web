@echo off
chcp 65001 >nul 2>nul
title USD 收益追踪系统 - 启动中

cd /d "%~dp0"

echo [检查] Node.js 环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js
    echo 请先安装: https://nodejs.org/
    timeout /t 5
    exit /b 1
)

if not exist "node_modules" (
    echo [安装] 首次运行，正在安装依赖...
    call npm install >nul 2>&1
)

echo [启动] 正在启动服务器...

:: 使用 VBScript 隐藏窗口启动 Node.js 服务器
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\launch_server.vbs"
echo WshShell.Run "cmd /c cd /d ""%~dp0"" && node server.js", 0, False >> "%temp%\launch_server.vbs"

cscript //nologo "%temp%\launch_server.vbs" >nul 2>&1
del "%temp%\launch_server.vbs" >nul 2>&1

echo [等待] 服务器启动中...
timeout /t 3 /nobreak >nul

echo [打开] 正在打开浏览器...
start http://localhost:3000

timeout /t 1 /nobreak >nul

:: 关闭自身窗口
exit

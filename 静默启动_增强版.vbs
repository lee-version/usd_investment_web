' USD Revenue Tracker - 静默启动器 (增强版)
On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 自动获取项目目录
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 显示启动提示 (可选,注释掉则完全静默)
' MsgBox "正在启动 USD 收益追踪系统...", vbInformation, "启动中"

' 方法1: 使用完整路径检查 Node.js
nodePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(nodePath) Then
    nodePath = "node"
End If

' 测试 Node.js 是否可用
Set exec = WshShell.Exec("""" & nodePath & """ --version")
If Err.Number <> 0 Or exec.Status <> 0 Then
    MsgBox "❌ 错误: 未检测到 Node.js" & vbCrLf & vbCrLf & "请安装: https://nodejs.org/", vbCritical, "USD Revenue Tracker"
    WScript.Quit
End If

' 安装依赖 (如果需要)
If Not fso.FolderExists(projectDir & "\node_modules") Then
    WshShell.Run "cmd /c cd /d """ & projectDir & """ && npm install", 0, True
End If

' 简化版: 关闭端口3000的进程
WshShell.Run "cmd /c netstat -ano | findstr :3000 | findstr LISTENING > nul && for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a > nul", 0, True

' 启动服务器 (使用完整路径)
startCmd = "cmd /c cd /d """ & projectDir & """ && """ & nodePath & """ server.js"
WshShell.Run startCmd, 0, False

' 等待服务器启动
WScript.Sleep 3500

' 打开浏览器
WshShell.Run "cmd /c start http://localhost:3000", 0, False

' 完成 (可选提示)
' MsgBox "✅ 启动成功!" & vbCrLf & "地址: http://localhost:3000", vbInformation, "成功"

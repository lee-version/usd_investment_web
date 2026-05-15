' USD 收益追踪系统 - 静默启动器
' 功能：完全隐藏窗口启动应用
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 项目目录
projectDir = "c:\Users\10563\PycharmProjects\自定义项目\财务"

' 检查 Node.js 是否可用
nodeCheck = WshShell.Run("where node", 0, True)
If nodeCheck <> 0 Then
    MsgBox "错误：未检测到 Node.js" & vbCrLf & vbCrLf & "请先安装: https://nodejs.org/", vbCritical, "USD 收益追踪系统"
    WScript.Quit
End If

' 检查依赖是否安装
If Not fso.FolderExists(projectDir & "\node_modules") Then
    ' 安装依赖（隐藏窗口）
    WshShell.Run "cmd /c cd /d """ & projectDir & """ && npm install", 0, True
End If

' 后台启动 Node.js 服务器（完全隐藏）
WshShell.Run "cmd /c cd /d """ & projectDir & """ && node server.js", 0, False

' 等待服务器启动
WScript.Sleep 3000

' 打开浏览器
WshShell.Run "http://localhost:3000"

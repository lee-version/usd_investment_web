' USD Revenue Tracker - Silent Launcher
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Auto-detect project directory (same folder as this script)
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if Node.js is available
nodeCheck = WshShell.Run("cmd /c where node", 0, True)
If nodeCheck <> 0 Then
    MsgBox "Node.js not found!" & vbCrLf & vbCrLf & "Please install: https://nodejs.org/", vbCritical, "USD Revenue Tracker"
    WScript.Quit
End If

' Install dependencies if needed
If Not fso.FolderExists(projectDir & "\node_modules") Then
    WshShell.Run "cmd /c cd /d """ & projectDir & """ && npm install", 0, True
End If

' Kill existing server on port 3000 (avoid port conflict)
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a 2>nul", 0, True

' Start Node.js server in background
WshShell.Run "cmd /c cd /d """ & projectDir & """ && node server.js", 0, False

' Wait for server to fully start
WScript.Sleep 3000

' Open default browser
WshShell.Run "cmd /c start http://localhost:3000", 0, False

Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "chrome.exe http://localhost:5174/"
WScript.Sleep 4000

' Find Chrome window
Dim ret
ret = WshShell.AppActivate("localhost:5174")
If ret = False Then
  ret = WshShell.AppActivate("SIAP")
End If
If ret = False Then
  ret = WshShell.AppActivate("Puskesmas")
End If

WScript.Sleep 500
WshShell.SendKeys "admin"
WScript.Sleep 300
WshShell.SendKeys "{TAB}"
WScript.Sleep 300
WshShell.SendKeys "Puskesmas@123"
WScript.Sleep 300
WshShell.SendKeys "{ENTER}"

WScript.Sleep 4000

' Light mode
WshShell.SendKeys "{F12}"
WScript.Sleep 1500
WshShell.SendKeys "localStorage.setItem('theme','light');location.reload()"
WScript.Sleep 200
WshShell.SendKeys "{ENTER}"

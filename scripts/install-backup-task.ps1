<#
.SYNOPSIS
  Daftarkan backup harian Presensiku ke Windows Task Scheduler.

.DESCRIPTION
  Plan gratis Supabase tidak punya backup otomatis. Skrip ini membuat jadwal
  harian yang menjalankan scripts/backup-database.mjs sehingga salinan data
  tersimpan di %USERPROFILE%\Presensiku-Backup.

  Tidak perlu hak Administrator — task dibuat untuk user yang sedang login.

.PARAMETER Time
  Jam eksekusi harian (format HH:mm). Default 23:30.

.PARAMETER Keep
  Jumlah backup yang disimpan. Default 14.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1
  powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 -Time 22:00 -Keep 30
#>
param(
  [string]$Time = "23:30",
  [int]$Keep = 14
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $PSScriptRoot "backup-database.mjs"
$TaskName = "Presensiku-Daily-Backup"

if (-not (Test-Path $Script)) {
  throw "Skrip backup tidak ditemukan: $Script"
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  throw "Node.js tidak ditemukan di PATH. Install Node.js dulu."
}

Write-Host "Repo    : $RepoRoot"
Write-Host "Node    : $Node"
Write-Host "Jadwal  : setiap hari $Time"
Write-Host "Simpan  : $Keep backup terakhir"

$Action = New-ScheduledTaskAction `
  -Execute $Node `
  -Argument "`"$Script`" --keep $Keep" `
  -WorkingDirectory $RepoRoot

$Trigger = New-ScheduledTaskTrigger -Daily -At $Time

# Mulai saat idle/baterai tetap dijalankan; lewatkan bila mesin mati.
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$Principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Backup harian database Presensiku (Supabase plan gratis tidak punya backup otomatis)." | Out-Null

Write-Host ""
Write-Host "OK  Task '$TaskName' terdaftar." -ForegroundColor Green
Write-Host "Jalankan sekarang untuk uji:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Lihat status:                 Get-ScheduledTaskInfo -TaskName $TaskName"
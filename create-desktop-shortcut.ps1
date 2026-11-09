# Creates a "Social Security Claiming" shortcut (with its own icon) on your desktop.
# Run once:  powershell -ExecutionPolicy Bypass -File .\create-desktop-shortcut.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$iconPath = Join-Path $root 'app.ico'

# Draw a small icon: a green rounded tile with a rising bar chart.
if (-not (Test-Path $iconPath)) {
  Add-Type -AssemblyName System.Drawing
  $size = 64
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 12; $d = $r * 2; $w = $size - 2
  $path.AddArc(1, 1, $d, $d, 180, 90)
  $path.AddArc($w - $d, 1, $d, $d, 270, 90)
  $path.AddArc($w - $d, $w - $d, $d, $d, 0, 90)
  $path.AddArc(1, $w - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 22, 101, 80))), $path)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillRectangle($white, 12, 38, 10, 14)
  $g.FillRectangle($white, 27, 28, 10, 24)
  $g.FillRectangle($white, 42, 14, 10, 38)
  $g.Dispose()

  $hIcon = $bmp.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($hIcon)
  $fs = [System.IO.File]::Create($iconPath)
  $icon.Save($fs)
  $fs.Close()
  $icon.Dispose(); $bmp.Dispose()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Social Security Claiming.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $root 'start-server.cmd'
$lnk.WorkingDirectory = $root
$lnk.IconLocation = "$iconPath,0"
$lnk.Description = 'Start the Social Security claiming page for the LAN'
$lnk.WindowStyle = 1
$lnk.Save()

Write-Host "Shortcut created: $lnkPath"

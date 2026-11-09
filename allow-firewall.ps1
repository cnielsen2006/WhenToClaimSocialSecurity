# One-time: let other computers on your home network reach the server.
# Opens only TCP port 47821, only on Private networks (not Public).
# Right-click > "Run with PowerShell", or:  powershell -ExecutionPolicy Bypass -File .\allow-firewall.ps1
$port = 47821
$name = 'Social Security Claiming (LAN)'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  # Re-launch this script elevated (you'll get a UAC prompt)
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
  exit
}

if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
  Write-Host "Rule '$name' already exists."
} else {
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Private | Out-Null
  Write-Host "Added rule '$name': TCP $port, Private networks only."
}
Read-Host 'Press Enter to close'

@echo off
rem Start the Social Security claiming page for everyone on the LAN.
rem Double-click this (or use the desktop shortcut). Close the window to stop it.
title Social Security Claiming Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH. Get it from https://nodejs.org
  pause
  exit /b 1
)

node server.js --open
if errorlevel 1 pause

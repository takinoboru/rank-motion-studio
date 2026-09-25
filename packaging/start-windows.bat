@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 serve.py --directory . --open
  exit /b
)

where python >nul 2>nul
if %errorlevel% equ 0 (
  python serve.py --directory . --open
  exit /b
)

echo Python 3 was not found. Opening index.html directly.
start "" index.html


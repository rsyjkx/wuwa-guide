@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
cd /d "%~dp0.."
title 鸣潮攻略站 · 本地预览（关闭这个窗口就停止）
echo.
echo   正在启动本地预览…
echo   几秒后会自动打开浏览器： http://localhost:4321
echo   改完文件会自动刷新；关闭这个窗口即停止服务。
echo.
start "" /min cmd /c "timeout /t 6 >nul & explorer http://localhost:4321"
call npm run dev
pause

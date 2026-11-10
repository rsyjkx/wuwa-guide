@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
cd /d "%~dp0.."
title 鸣潮攻略站 · 重新构建（构建完可直接发布）
echo.
echo   正在构建站点并生成搜索索引…
echo.
call npm run build
echo.
echo   构建完成。产物在 dist\ 目录。
pause

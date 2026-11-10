@echo off
rem OmniHarness 一键启动（Windows 双击即可）。
rem
rem   start.cmd            构建后端 + 前端，起本地服务并自动打开浏览器（Ctrl+C 停止）
rem   start.cmd mock       同上，但用零凭据的 mock 模型（没配 API Key 时用这个）
rem   start.cmd desktop    构建后启动 Electron 桌面应用（后端由桌面侧车自动拉起）
rem
rem 任一步失败都会停在窗口里并保留错误信息，避免"双击后一闪而过"。
chcp 65001 >nul
cd /d "%~dp0"
title OmniHarness

where node >nul 2>nul
if errorlevel 1 goto no_node

if exist "node_modules\@omniharness\kernel" goto root_deps_ready
echo [OmniHarness] 首次运行：安装依赖（npm ci，可能需要几分钟）……
call npm ci
if errorlevel 1 goto failed
:root_deps_ready

if /i "%~1"=="desktop" goto desktop_mode
if /i "%~1"=="mock" goto mock_mode

echo [OmniHarness] 构建后端与前端，然后启动 Web 工作台……
call npm start -- --open
if errorlevel 1 goto failed
goto end

:mock_mode
echo [OmniHarness] 构建后端与前端，然后以 mock 模型启动 Web 工作台……
call npm start -- --open --mock
if errorlevel 1 goto failed
goto end

:desktop_mode
if exist "desktop\node_modules\electron\dist\electron.exe" goto desktop_deps_ready
echo [OmniHarness] 安装桌面端依赖（首次约 100 MB）……
call npm --prefix desktop ci --no-audit --no-fund
if errorlevel 1 goto failed
:desktop_deps_ready

echo [OmniHarness] 构建后端、前端与桌面主进程，然后启动桌面应用……
call npm run build
if errorlevel 1 goto failed
call npm run build:web
if errorlevel 1 goto failed
call npm --prefix desktop start
if errorlevel 1 goto failed
goto end

:no_node
echo [OmniHarness] 未找到 Node.js，请先安装 Node.js 22.14 或更高版本：https://nodejs.org/
pause
exit /b 1

:failed
echo.
echo [OmniHarness] 启动失败，请查看上方错误信息。
pause
exit /b 1

:end
echo.
pause
exit /b 0

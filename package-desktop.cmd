@echo off
rem OmniHarness 桌面应用一键打包（Windows 双击即可）。
rem
rem 流程：后端 + 前端构建 → 复制运行时到 .desktop-stage → electron-builder 出 NSIS 安装包。
rem 产物：desktop\release\OmniHarness Setup <版本>.exe（以及 win-unpacked 未打包目录）。
rem 首次运行需要下载 Electron 运行时与 NSIS 工具链，耗时较长属正常。
chcp 65001 >nul
cd /d "%~dp0"
title OmniHarness 桌面打包

where node >nul 2>nul
if errorlevel 1 goto no_node

if exist "node_modules\@omniharness\kernel" goto root_deps_ready
echo [OmniHarness] 首次运行：安装依赖（npm ci，可能需要几分钟）……
call npm ci
if errorlevel 1 goto failed
:root_deps_ready

if exist "desktop\node_modules\electron-builder" goto desktop_deps_ready
echo [OmniHarness] 安装桌面端依赖……
call npm --prefix desktop ci --no-audit --no-fund
if errorlevel 1 goto failed
:desktop_deps_ready

if exist "desktop\node_modules\electron\dist\electron.exe" goto electron_ready
echo [OmniHarness] 解压 Electron 运行时……
node "desktop\node_modules\electron\install.js"
if errorlevel 1 goto failed
:electron_ready

echo [OmniHarness] 构建后端与前端……
call npm run build
if errorlevel 1 goto failed
call npm run build:web
if errorlevel 1 goto failed

echo [OmniHarness] 打包桌面应用（stage + electron-builder，首次较慢）……
call npm run desktop:dist
if errorlevel 1 goto failed

echo.
echo [OmniHarness] 安装包已生成：
dir /b "desktop\release\*.exe" 2>nul
echo 输出目录：%~dp0desktop\release
pause
exit /b 0

:no_node
echo [OmniHarness] 未找到 Node.js，请先安装 Node.js 22.14 或更高版本：https://nodejs.org/
pause
exit /b 1

:failed
echo.
echo [OmniHarness] 打包失败，请查看上方错误信息。
pause
exit /b 1

@echo off
setlocal

set FV_PORT=%FALLBACK_VISION_PORT%
if "%FV_PORT%"=="" set FV_PORT=8789

set FV_RESTART_FLAG=%USERPROFILE%\.fallback-vision\.restart

:: Find project root
set FV_DIR=%~dp0..

if not exist "%FV_DIR%\dist\cli.js" (
    echo ❌ 找不到 Fallback Vision
    echo 请先安装: npm install -g fallback-vision
    exit /b 1
)

if not exist "%USERPROFILE%\.fallback-vision" mkdir "%USERPROFILE%\.fallback-vision"
if exist "%FV_RESTART_FLAG%" del "%FV_RESTART_FLAG%"

echo ⚡ Fallback Vision — Claude Code 模式
echo 📁 项目目录: %FV_DIR%
echo.

:: Check if server is running
curl -s "http://127.0.0.1:%FV_PORT%/healthz" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 服务已在运行
) else (
    echo 🚀 启动服务...
    cd /d "%FV_DIR%" && start /b node dist/cli.js --port %FV_PORT%
    timeout /t 2 /nobreak >nul
    curl -s "http://127.0.0.1:%FV_PORT%/healthz" >nul 2>&1
    if %errorlevel%==0 (
        echo ✅ 服务启动成功
    ) else (
        echo ❌ 启动失败，请检查端口 %FV_PORT%
        exit /b 1
    )
)

echo 🌐 配置页面: http://127.0.0.1:%FV_PORT%/
start http://127.0.0.1:%FV_PORT%/

echo.
echo 📋 在网页上配置好后，点击「保存并重启使用」
echo.

:wait_loop
if exist "%FV_RESTART_FLAG%" (
    del "%FV_RESTART_FLAG%"
    echo 🔄 正在重启...
    taskkill /f /im node.exe /fi "windowtitle eq fallback*" >nul 2>&1
    timeout /t 1 /nobreak >nul
    goto restart
)
curl -s "http://127.0.0.1:%FV_PORT%/healthz" >nul 2>&1
if %errorlevel% neq 0 goto restart
timeout /t 1 /nobreak >nul
goto wait_loop

:restart
echo 🚀 重新启动服务...
cd /d "%FV_DIR%" && start /b node dist/cli.js --port %FV_PORT%
timeout /t 2 /nobreak >nul
curl -s "http://127.0.0.1:%FV_PORT%/healthz" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 服务重启成功
    echo 🤖 请手动打开 Claude Code 并配置:
    echo    set ANTHROPIC_BASE_URL=http://127.0.0.1:%FV_PORT%
    echo    claude
) else (
    echo ❌ 重启失败
    exit /b 1
)

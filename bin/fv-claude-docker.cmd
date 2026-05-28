@echo off
setlocal

set FV_PORT=%FALLBACK_VISION_PORT%
if "%FV_PORT%"=="" set FV_PORT=8789

set FV_IMAGE=yvesnihaohaode/fallback-vision:latest
set FV_CONTAINER=fallback-vision

echo ⚡ Fallback Vision — Docker + Claude Code 模式
echo.

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未安装 Docker
    echo 请先安装: https://docs.docker.com/get-docker/
    exit /b 1
)

echo 🚀 启动容器...
docker run -d --name %FV_CONTAINER% -p %FV_PORT%:8789 -e FALLBACK_VISION_PORT=8789 -v "%USERPROFILE%\.fallback-vision:/root/.fallback-vision" %FV_IMAGE%
timeout /t 2 /nobreak >nul

curl -s "http://127.0.0.1:%FV_PORT%/healthz" >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 容器启动成功
) else (
    echo ❌ 启动失败
    docker logs %FV_CONTAINER%
    exit /b 1
)

echo 🌐 配置页面: http://127.0.0.1:%FV_PORT%/
start http://127.0.0.1:%FV_PORT%/

echo.
echo 📋 在网页上配置好后，点击「保存并重启使用」
echo.

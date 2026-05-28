#!/bin/bash
# ============================================================================
# Fallback Vision — Auto-start with client integration
# Usage: source this file, then use fv-claude or fv-codex
# ============================================================================

FV_PORT=${FALLBACK_VISION_PORT:-8789}
FV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FV_CLIENT=""
FV_RESTART_FLAG="$HOME/.fallback-vision/.restart"

_fv_ensure_running() {
  if curl -s "http://127.0.0.1:${FV_PORT}/healthz" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

_fv_open_browser() {
  local url="http://127.0.0.1:${FV_PORT}/"
  if command -v open &>/dev/null; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url"
  fi
  echo "🌐 配置页面已打开: $url"
}

_fv_wait_for_restart() {
  echo "⏳ 等待用户配置完成（检测到保存后自动重启）..."
  while true; do
    if [ -f "$FV_RESTART_FLAG" ]; then
      rm -f "$FV_RESTART_FLAG"
      echo "🔄 检测到重启信号，正在重启..."
      # Kill existing server
      pkill -f "fallback-vision" 2>/dev/null
      sleep 1
      return 0
    fi
    # Check if server is still running
    if ! _fv_ensure_running; then
      # Server crashed, not a restart signal — just restart
      return 0
    fi
    sleep 1
  done
}

_fv_launch_client() {
  local client="$1"
  if [ "$client" = "claude" ]; then
    echo "🤖 启动 Claude Code..."
    ANTHROPIC_BASE_URL="http://127.0.0.1:${FV_PORT}" exec claude
  elif [ "$client" = "codex" ]; then
    echo "🔧 启动 Codex..."
    if [ -d "/Applications/Codex.app" ]; then
      open /Applications/Codex.app
    else
      exec codex
    fi
  fi
}

# ============================================================================
# Main commands
# ============================================================================

fv-claude() {
  FV_CLIENT="claude"
  echo "⚡ Fallback Vision — Claude Code 模式"
  echo ""

  # Start server
  if _fv_ensure_running; then
    echo "✅ 服务已在运行"
  else
    echo "🚀 启动服务..."
    cd "$FV_DIR" && npx fallback-vision --port "$FV_PORT" &
    sleep 2
    if _fv_ensure_running; then
      echo "✅ 服务启动成功"
    else
      echo "❌ 启动失败，请检查端口 ${FV_PORT}"
      return 1
    fi
  fi

  # Open browser for configuration
  _fv_open_browser
  echo ""
  echo "📋 在网页上配置好后，点击「保存并重启使用」"
  echo ""

  # Wait for user to click restart
  _fv_wait_for_restart

  # Relaunch
  echo "🚀 重新启动服务..."
  cd "$FV_DIR" && npx fallback-vision --port "$FV_PORT" &
  sleep 2

  if _fv_ensure_running; then
    echo "✅ 服务重启成功"
    _fv_launch_client "claude"
  else
    echo "❌ 重启失败"
    return 1
  fi
}

fv-codex() {
  FV_CLIENT="codex"
  echo "⚡ Fallback Vision — Codex 模式"
  echo ""

  if _fv_ensure_running; then
    echo "✅ 服务已在运行"
  else
    echo "🚀 启动服务..."
    cd "$FV_DIR" && npx fallback-vision --port "$FV_PORT" &
    sleep 2
    if _fv_ensure_running; then
      echo "✅ 服务启动成功"
    else
      echo "❌ 启动失败"
      return 1
    fi
  fi

  _fv_open_browser
  echo ""
  echo "📋 在网页上配置好后，点击「保存并重启使用」"
  echo ""

  _fv_wait_for_restart

  echo "🚀 重新启动服务..."
  cd "$FV_DIR" && npx fallback-vision --port "$FV_PORT" &
  sleep 2

  if _fv_ensure_running; then
    echo "✅ 服务重启成功"
    _fv_launch_client "codex"
  else
    echo "❌ 重启失败"
    return 1
  fi
}

fv-start() {
  echo "⚡ 启动 Fallback Vision..."
  if _fv_ensure_running; then
    echo "✅ 服务已在运行 (port ${FV_PORT})"
  else
    cd "$FV_DIR" && npx fallback-vision --port "$FV_PORT" &
    sleep 2
    if _fv_ensure_running; then
      echo "✅ 服务启动成功"
      echo "🌐 http://127.0.0.1:${FV_PORT}/"
    else
      echo "❌ 启动失败"
      return 1
    fi
  fi
}

fv-stop() {
  if _fv_ensure_running; then
    pkill -f "fallback-vision" 2>/dev/null
    echo "⏹  Fallback Vision 已停止"
  else
    echo "ℹ  未在运行"
  fi
}

fv-status() {
  if _fv_ensure_running; then
    echo "✅ 运行中 (port ${FV_PORT})"
    echo "   http://127.0.0.1:${FV_PORT}/"
  else
    echo "⏹  未运行"
  fi
}

echo "⚡ Fallback Vision 已加载。可用命令："
echo "   fv-claude   Claude Code 一键启动"
echo "   fv-codex    Codex 一键启动"
echo "   fv-start    仅启动服务"
echo "   fv-stop     停止服务"
echo "   fv-status   查看状态"

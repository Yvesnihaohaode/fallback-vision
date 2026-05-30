#!/bin/bash
# ============================================================================
# Fallback Vision — Auto-start with client integration
# Usage: source this file, then use fv-claude or fv-codex
#
# Vision routing:
#   - Proxy running  → MiMo native vision (Qwen hook disabled)
#   - Proxy stopped  → Qwen hook restored (cc-switch mode)
# ============================================================================

FV_PORT=${FALLBACK_VISION_PORT:-8789}
FV_DIR="$HOME/Desktop/fallback-vision"
FV_CLIENT=""
FV_RESTART_FLAG="$HOME/.fallback-vision/.restart"
FV_PID_FILE="$HOME/.fallback-vision/server.pid"
FV_HOOK="$HOME/.claude/hooks/describe-image.py"
FV_HOOK_DISABLED="$HOME/.claude/hooks/describe-image.py.disabled"

_fv_ensure_running() {
  if curl -s "http://127.0.0.1:${FV_PORT}/healthz" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

# ── Hook management ──
_fv_disable_hook() {
  if [ -f "$FV_HOOK" ] && [ ! -f "$FV_HOOK_DISABLED" ]; then
    mv "$FV_HOOK" "$FV_HOOK_DISABLED"
    echo "🔇 Qwen 视觉 hook 已禁用（使用 MiMo 原生 fallback）"
  fi
}

_fv_restore_hook() {
  if [ -f "$FV_HOOK_DISABLED" ] && [ ! -f "$FV_HOOK" ]; then
    mv "$FV_HOOK_DISABLED" "$FV_HOOK"
    echo "🔊 Qwen 视觉 hook 已恢复"
  fi
}

# ── Claude settings backup/restore ──
_fv_backup_settings() {
  local backup="$HOME/.fallback-vision/claude-settings-backup.json"
  local current="$HOME/.claude/settings.json"
  if [ ! -f "$current" ]; then
    return
  fi
  # Only backup if no backup exists (preserve original state)
  if [ ! -f "$backup" ]; then
    cp "$current" "$backup"
    echo "📋 Claude 配置已备份"
  fi
}

# Write ~/.claude/settings.json to point to Fallback Vision proxy
_fv_apply_proxy_config() {
  local current="$HOME/.claude/settings.json"
  local fv_settings="$HOME/.fallback-vision/settings.json"
  local api_key="fv-proxy-token"
  if [ -f "$fv_settings" ]; then
    api_key=$(python3 -c "import json,sys; d=json.load(open('$fv_settings')); print(d.get('mainModel',{}).get('apiKey','fv-proxy-token'))" 2>/dev/null || echo "fv-proxy-token")
  fi
  # Use python3 to safely modify JSON
  python3 -c "
import json, os
path = os.path.expanduser('~/.claude/settings.json')
cfg = {}
if os.path.exists(path):
    try:
        with open(path) as f: cfg = json.load(f)
    except: pass
if 'env' not in cfg: cfg['env'] = {}
cfg['env']['ANTHROPIC_BASE_URL'] = 'http://127.0.0.1:${FV_PORT}'
cfg['env']['ANTHROPIC_AUTH_TOKEN'] = '${api_key}'
cfg['env']['ANTHROPIC_MODEL'] = 'claude-sonnet-4-6'
# Clean ccswitch overrides
for k in list(cfg['env'].keys()):
    if k.startswith('ANTHROPIC_DEFAULT_'): del cfg['env'][k]
with open(path, 'w') as f: json.dump(cfg, f, indent=2)
"
  echo "⚙️  Claude Code → Fallback Vision (port ${FV_PORT})"
}

_fv_restore_settings() {
  local backup="$HOME/.fallback-vision/claude-settings-backup.json"
  local current="$HOME/.claude/settings.json"
  if [ -f "$backup" ]; then
    cp "$backup" "$current"
    rm -f "$backup"
    echo "♻️  Claude 配置已还原"
  fi
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

# Recover from stale proxy: if settings.json points to dead proxy, restore original
_fv_recover_stale_proxy() {
  local current="$HOME/.claude/settings.json"
  local backup="$HOME/.fallback-vision/claude-settings-backup.json"
  if [ ! -f "$current" ]; then return; fi
  if ! grep -q "127.0.0.1:${FV_PORT}" "$current" 2>/dev/null; then return; fi
  # Settings points to proxy — check if proxy is alive
  if _fv_ensure_running; then return; fi
  # Proxy is dead — restore from backup if available
  if [ -f "$backup" ]; then
    cp "$backup" "$current"
    rm -f "$backup"
    echo "🔧 检测到残留代理配置，已自动恢复原配置"
  fi
}

_fv_wait_for_restart() {
  echo "⏳ 等待用户配置完成（检测到保存后自动重启）..."
  while true; do
    if [ -f "$FV_RESTART_FLAG" ]; then
      rm -f "$FV_RESTART_FLAG"
      echo "🔄 检测到重启信号，正在重启..."
      _fv_stop_process
      sleep 1
      return 0
    fi
    if ! _fv_ensure_running; then
      return 0
    fi
    sleep 1
  done
}

_fv_stop_process() {
  # Try PID file first (clean SIGTERM → triggers shutdown handler)
  if [ -f "$FV_PID_FILE" ]; then
    local pid=$(cat "$FV_PID_FILE" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 2
    fi
    rm -f "$FV_PID_FILE"
  fi
  # Fallback: kill by port
  if _fv_ensure_running; then
    lsof -ti :"$FV_PORT" | xargs kill 2>/dev/null
    sleep 1
  fi
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

  _fv_recover_stale_proxy
  _fv_backup_settings
  _fv_disable_hook

  if _fv_ensure_running; then
    echo "✅ 服务已在运行"
  else
    echo "🚀 启动服务..."
    cd "$FV_DIR" && node "$FV_DIR/dist/cli.js" --port "$FV_PORT" &
    sleep 2
    if _fv_ensure_running; then
      echo "✅ 服务启动成功"
    else
      echo "❌ 启动失败，请检查端口 ${FV_PORT}"
      return 1
    fi
  fi

  _fv_open_browser
  echo ""
  echo "📋 在网页上配置好后，点击「保存并重启使用」"
  echo ""

  _fv_wait_for_restart

  echo "🚀 重新启动服务..."
  cd "$FV_DIR" && node "$FV_DIR/dist/cli.js" --port "$FV_PORT" &
  sleep 2

  if _fv_ensure_running; then
    echo "✅ 服务重启成功"
    _fv_apply_proxy_config
    echo ""
    echo "🤖 配置完成！请打开新终端输入: claude"
    echo ""
  else
    echo "❌ 重启失败"
    return 1
  fi
}

fv-codex() {
  FV_CLIENT="codex"
  echo "⚡ Fallback Vision — Codex 模式"
  echo ""

  _fv_recover_stale_proxy
  _fv_backup_settings
  _fv_disable_hook

  if _fv_ensure_running; then
    echo "✅ 服务已在运行"
  else
    echo "🚀 启动服务..."
    cd "$FV_DIR" && node "$FV_DIR/dist/cli.js" --port "$FV_PORT" &
    sleep 2
    if _fv_ensure_running; then
      echo "✅ 服务启动成功"
    else
      echo "❌ 启动失败，请检查端口 ${FV_PORT}"
      return 1
    fi
  fi

  _fv_open_browser
  echo ""
  echo "📋 在网页上配置好后，点击「保存并重启使用」"
  echo ""

  _fv_wait_for_restart

  echo "🚀 重新启动服务..."
  cd "$FV_DIR" && node "$FV_DIR/dist/cli.js" --port "$FV_PORT" &
  sleep 2

  if _fv_ensure_running; then
    echo "✅ 服务重启成功"
    echo ""
    echo "🔧 配置完成！Codex 已就绪。"
    echo ""
  else
    echo "❌ 重启失败"
    return 1
  fi
}

fv-start() {
  echo "⚡ 启动 Fallback Vision..."
  _fv_backup_settings
  _fv_disable_hook

  if _fv_ensure_running; then
    echo "✅ 服务已在运行 (port ${FV_PORT})"
  else
    cd "$FV_DIR" && node "$FV_DIR/dist/cli.js" --port "$FV_PORT" &
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
  echo "⏹  停止 Fallback Vision..."
  _fv_stop_process

  if _fv_ensure_running; then
    echo "⚠️  服务仍在运行，强制停止..."
    lsof -ti :"$FV_PORT" | xargs kill -9 2>/dev/null
    sleep 1
  fi

  echo "⏹  Fallback Vision 已停止"

  # Restore hook and settings — return to cc-switch mode
  _fv_restore_hook
  _fv_restore_settings
}

fv-status() {
  if _fv_ensure_running; then
    echo "✅ 运行中 (port ${FV_PORT})"
    echo "   http://127.0.0.1:${FV_PORT}/"
    echo "   视觉: MiMo 原生 fallback"
  else
    echo "⏹  未运行"
    echo "   视觉: Qwen hook (cc-switch)"
  fi
}

echo "⚡ Fallback Vision 已加载。可用命令："
echo "   fv-claude   Claude Code 一键启动"
echo "   fv-codex    Codex 一键启动"
echo "   fv-start    仅启动服务"
echo "   fv-stop     停止服务（自动还原 cc-switch）"
echo "   fv-status   查看状态"

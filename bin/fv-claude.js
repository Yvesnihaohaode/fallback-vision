#!/usr/bin/env node
// Fallback Vision — 一键启动 Claude Code
// 关键：服务器必须在 Claude Code 启动前真正可响应
// 重启机制：Save & Restart 后自动重启服务器（不退出 fv-claude 进程）

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import http from "node:http";

const PORT = Number(process.env.FALLBACK_VISION_PORT) || 8789;
const FV_DIR = join(homedir(), ".fallback-vision");
const PID_FILE = join(FV_DIR, "server.pid");
const RESTART_FLAG = join(FV_DIR, ".restart");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
// Backup = legacy path (used for backward compat)
const CLAUDE_SETTINGS_BACKUP = join(FV_DIR, "claude-settings-backup.json");
// Original = reliable storage for ccswitch config (never deleted by FV)
const ORIGINAL_SETTINGS = join(FV_DIR, "original-claude-settings.json");

// ── Find project root ──
function findProjectRoot() {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const gitCloneRoot = join(scriptDir, "..");
  if (existsSync(join(gitCloneRoot, "dist", "cli.js"))) return gitCloneRoot;
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    const npmDir = join(npmRoot, "fallback-vision");
    if (existsSync(join(npmDir, "dist", "cli.js"))) return npmDir;
  } catch {}
  return null;
}

// ── Health check ──
function checkHealth(port, timeout) {
  timeout = timeout || 3000;
  return new Promise(function(resolve) {
    var req = http.get("http://127.0.0.1:" + port + "/healthz", { timeout: timeout }, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try { resolve(JSON.parse(data).status === "healthy"); } catch(e) { resolve(false); }
      });
    });
    req.on("error", function() { resolve(false); });
    req.on("timeout", function() { req.destroy(); resolve(false); });
  });
}

function waitForServer(port, timeout) {
  timeout = timeout || 20000;
  return new Promise(function(resolve) {
    var start = Date.now();
    function check() {
      checkHealth(port).then(function(ok) {
        if (ok) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(check, 500);
      });
    }
    check();
  });
}

function killServerByPid() {
  try {
    if (!existsSync(PID_FILE)) return;
    var pid = Number(readFileSync(PID_FILE, "utf-8").trim());
    if (pid > 0) { try { process.kill(pid, "SIGTERM"); } catch(e) {} }
    unlinkSync(PID_FILE);
  } catch(e) {}
}

function killPort(port) {
  try {
    if (platform() === "win32") {
      execSync("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :" + port + "') do taskkill /f /pid %a 2>nul", { stdio: "ignore" });
    } else if (platform() === "darwin") {
      execSync("lsof -ti:" + port + " | xargs kill -9 2>/dev/null || true", { stdio: "ignore" });
    } else {
      execSync("fuser -k " + port + "/tcp 2>/dev/null || true", { stdio: "ignore" });
    }
  } catch(e) {}
}

function startServer(root) {
  return new Promise(function(resolve) {
    var child = spawn("node", ["dist/cli.js", "--port", String(PORT), "--verbose"], {
      cwd: root, stdio: "ignore", detached: true,
    });
    child.unref();
    if (!existsSync(FV_DIR)) mkdirSync(FV_DIR, { recursive: true });
    writeFileSync(PID_FILE, String(child.pid));
    console.log("🚀 服务启动中 (PID " + child.pid + ")...");
    resolve(child.pid);
  });
}

function openBrowser(url) {
  try {
    var cmd = platform() === "win32" ? "cmd.exe" : platform() === "darwin" ? "open" : "xdg-open";
    var args = platform() === "win32" ? ["/c", "start", url] : [url];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch(e) {}
}

// ── Read FV settings to get the actual model name ──
function getFvMainModelName() {
  try {
    var fv = JSON.parse(readFileSync(join(FV_DIR, "settings.json"), "utf-8"));
    return fv.mainModel && fv.mainModel.modelName ? fv.mainModel.modelName : "";
  } catch(e) { return ""; }
}

// ── Reliable backup: always store original before modifying ──
function storeOriginalSettings() {
  if (!existsSync(CLAUDE_SETTINGS)) return;

  // Already have a reliable original? Don't overwrite.
  if (existsSync(ORIGINAL_SETTINGS)) return;

  // Current settings point to proxy? Don't store as original.
  try {
    var current = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
    if ((current.env && current.env.ANTHROPIC_BASE_URL || "").includes("127.0.0.1")) return;
  } catch(e) {}

  // Store as the reliable original
  copyFileSync(CLAUDE_SETTINGS, ORIGINAL_SETTINGS);
  console.log("📋 已存储原始配置 (ccswitch 模式)");

  // Also create legacy backup for backward compat
  if (!existsSync(CLAUDE_SETTINGS_BACKUP)) {
    copyFileSync(CLAUDE_SETTINGS, CLAUDE_SETTINGS_BACKUP);
  }
}

function applyFallbackVisionConfig() {
  var settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8")); } catch(e) {}
  }

  var fvApiKey = "";
  var fvModelName = getFvMainModelName();
  try {
    var fvSettings = JSON.parse(readFileSync(join(FV_DIR, "settings.json"), "utf-8"));
    fvApiKey = (fvSettings.mainModel && fvSettings.mainModel.apiKey) || "";
  } catch(e) {}

  if (!settings.env) settings.env = {};
  settings.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:" + PORT;
  // Use the actual model name from FV settings, not a hardcoded Claude model
  settings.env.ANTHROPIC_MODEL = fvModelName || "claude-sonnet-4-6";
  settings.env.ANTHROPIC_AUTH_TOKEN = fvApiKey || "fv-proxy-token";

  var envKeys = Object.keys(settings.env);
  for (var i = 0; i < envKeys.length; i++) {
    if (envKeys[i].startsWith("ANTHROPIC_DEFAULT_")) delete settings.env[envKeys[i]];
  }

  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
  console.log("⚙️  Claude Code → Fallback Vision (port " + PORT + ")");
  console.log("   模型: " + (fvModelName || "claude-sonnet-4-6"));
}

function isFallbackVisionActive() {
  if (!existsSync(CLAUDE_SETTINGS)) return false;
  try {
    var s = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
    return (s.env && s.env.ANTHROPIC_BASE_URL || "").includes("127.0.0.1:" + PORT);
  } catch(e) { return false; }
}

async function ensureCleanState() {
  if (!isFallbackVisionActive()) return;
  var proxyAlive = await checkHealth(PORT);
  if (proxyAlive) return;
  console.log("🔧 检测到残留代理配置（代理已关闭），自动恢复...");
  // Try to restore from original or backup
  var restoreFrom = existsSync(ORIGINAL_SETTINGS) ? ORIGINAL_SETTINGS : (existsSync(CLAUDE_SETTINGS_BACKUP) ? CLAUDE_SETTINGS_BACKUP : null);
  if (restoreFrom) {
    try {
      var backup = JSON.parse(readFileSync(restoreFrom, "utf-8"));
      var backupUrl = (backup.env && backup.env.ANTHROPIC_BASE_URL) || "";
      if (!backupUrl.includes("127.0.0.1")) {
        copyFileSync(restoreFrom, CLAUDE_SETTINGS);
        console.log("   已恢复: " + backupUrl);
        return;
      }
    } catch(e) {}
  }
  console.log("   ⚠️ 无有效备份，已设置安全默认值");
  var settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8")); } catch(e) {}
  }
  if (settings.env) {
    delete settings.env.ANTHROPIC_BASE_URL;
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
    delete settings.env.ANTHROPIC_MODEL;
  }
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
}

// ── Full startup sequence ──
async function startupSequence(root, isFirstStart) {
  killPort(PORT);
  killServerByPid();
  await new Promise(function(r) { setTimeout(r, 500); });
  await startServer(root);
  console.log("⏳ 等待服务就绪...");
  var healthy = await waitForServer(PORT, 20000);
  if (!healthy) {
    console.error("❌ 服务启动超时，请检查端口是否被占用");
    return false;
  }
  console.log("✅ 服务就绪");
  if (isFirstStart) storeOriginalSettings();
  applyFallbackVisionConfig();
  var dashboardUrl = "http://127.0.0.1:" + PORT + "/";
  console.log("\n🌐 Web UI: " + dashboardUrl);
  if (isFirstStart) openBrowser(dashboardUrl);
  return true;
}

// ── Main ──
async function main() {
  console.log("\n⚡ Fallback Vision — Claude Code 模式\n");
  var root = findProjectRoot();
  if (!root) {
    console.error("❌ 找不到 Fallback Vision，请先安装: npm install -g fallback-vision");
    process.exit(1);
  }
  console.log("📁 项目目录: " + root);
  mkdirSync(FV_DIR, { recursive: true });
  if (existsSync(RESTART_FLAG)) unlinkSync(RESTART_FLAG);
  await ensureCleanState();

  var isRunning = await checkHealth(PORT);
  if (isRunning) {
    console.log("✅ 服务已在运行");
    applyFallbackVisionConfig();
    var dashboardUrl = "http://127.0.0.1:" + PORT + "/";
    console.log("\n🌐 Web UI: " + dashboardUrl);
    openBrowser(dashboardUrl);
  } else {
    var ok = await startupSequence(root, true);
    if (!ok) process.exit(1);
  }

  // Watch for restart flag from dashboard "Save & Restart"
  var watcher = setInterval(async function() {
    if (!existsSync(RESTART_FLAG)) return;
    unlinkSync(RESTART_FLAG);
    console.log("\n🔄 检测到重启信号...");
    // Wait briefly for server to exit (dashboard restores settings.json before exit)
    await new Promise(function(r) { setTimeout(r, 2000); });
    // Check if server is still alive
    var alive = await checkHealth(PORT);
    if (!alive) {
      // Server exited after dashboard restart — settings.json was restored
      console.log("✅ 服务器已停止，配置已恢复");
      console.log("\n💡 下次使用: fv-claude 重新启动代理\n");
      clearInterval(watcher);
      process.exit(0);
    }
    // Server still alive — restart it
    console.log("🔄 重启服务器...");
    var ok = await startupSequence(root, false);
    if (ok) {
      console.log("\n✅ 服务器已重启，配置已更新");
      console.log("\n🤖 配置完成！请打开新终端输入: claude\n");
    } else {
      console.error("\n❌ 重启失败，请手动运行 fv-claude\n");
    }
  }, 800);

  console.log("\n🤖 配置完成！请打开新终端输入: claude\n");

  process.on("SIGINT", function() { clearInterval(watcher); process.exit(0); });
  process.on("SIGTERM", function() { clearInterval(watcher); process.exit(0); });
}

main().catch(function(e) { console.error("❌ 错误:", e); process.exit(1); });

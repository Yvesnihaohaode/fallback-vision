#!/usr/bin/env node
// Fallback Vision — Claude Code 一键启动 (v2 简化版)
// 核心逻辑：启动服务器 → 写入配置 → 监控重启

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
const ORIGINAL_SETTINGS = join(FV_DIR, "original-claude-settings.json");

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

function getFvMainModelName() {
  try {
    var fv = JSON.parse(readFileSync(join(FV_DIR, "settings.json"), "utf-8"));
    return fv.mainModel && fv.mainModel.modelName ? fv.mainModel.modelName : "";
  } catch(e) { return ""; }
}

function getFvMainApiKey() {
  try {
    var fv = JSON.parse(readFileSync(join(FV_DIR, "settings.json"), "utf-8"));
    return fv.mainModel && fv.mainModel.apiKey ? fv.mainModel.apiKey : "";
  } catch(e) { return ""; }
}

// 备份原始配置（仅首次）
function storeOriginalSettings() {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  if (existsSync(ORIGINAL_SETTINGS)) return;
  try {
    var current = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
    if ((current.env && current.env.ANTHROPIC_BASE_URL || "").includes("127.0.0.1")) return;
  } catch(e) {}
  copyFileSync(CLAUDE_SETTINGS, ORIGINAL_SETTINGS);
  console.log("📋 已存储原始配置");
}

// 核心：写入 FV 代理配置到 Claude settings.json
function writeProxyConfig() {
  var settings = {};
  if (existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8")); } catch(e) {}
  }
  if (!settings.env) settings.env = {};

  var modelName = getFvMainModelName() || "claude-sonnet-4-6";
  var apiKey = getFvMainApiKey() || "fv-proxy-token";

  settings.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:" + PORT;
  settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;
  settings.env.ANTHROPIC_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelName;
  settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelName;

  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));

  // 验证写入
  try {
    var verify = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
    var actual = verify.env && verify.env.ANTHROPIC_MODEL;
    if (actual === modelName) {
      console.log("✅ 配置已写入并验证: " + modelName);
    } else {
      console.error("⚠️  写入验证失败: 期望 " + modelName + "，实际 " + actual);
    }
  } catch(e) {
    console.error("⚠️  验证异常: " + e.message);
  }

  console.log("⚙️  Claude Code → Fallback Vision (port " + PORT + ")");
  console.log("   模型: " + modelName);
}

async function startAndConfigure(root, isFirstStart) {
  killPort(PORT);
  killServerByPid();
  await new Promise(function(r) { setTimeout(r, 500); });
  await startServer(root);
  console.log("⏳ 等待服务就绪...");
  var healthy = await waitForServer(PORT, 20000);
  if (!healthy) {
    console.error("❌ 服务启动超时");
    return false;
  }
  console.log("✅ 服务就绪");
  if (isFirstStart) storeOriginalSettings();
  writeProxyConfig();
  if (isFirstStart) openBrowser("http://127.0.0.1:" + PORT + "/");
  return true;
}

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

  var isRunning = await checkHealth(PORT);
  if (isRunning) {
    console.log("✅ 服务已在运行");
    writeProxyConfig();
    openBrowser("http://127.0.0.1:" + PORT + "/");
  } else {
    var ok = await startAndConfigure(root, true);
    if (!ok) process.exit(1);
  }

  // 监控重启信号
  var watcher = setInterval(async function() {
    if (!existsSync(RESTART_FLAG)) return;
    unlinkSync(RESTART_FLAG);
    console.log("\n🔄 检测到重启信号...");
    var ok = await startAndConfigure(root, false);
    if (ok) {
      console.log("\n✅ 服务器已重启，配置已更新");
    } else {
      console.error("\n❌ 重启失败");
    }
  }, 800);

  // Watchdog: 每 30 秒健康检查，proxy 挂了自动拉起
  var watchdog = setInterval(async function() {
    var alive = await checkHealth(PORT, 5000);
    if (!alive) {
      console.warn("\n⚠️  Proxy 进程无响应，自动重启中...");
      var ok = await startAndConfigure(root, false);
      if (ok) {
        console.log("\n✅ Proxy 已自动恢复");
      } else {
        console.error("\n❌ Proxy 自动恢复失败");
      }
    }
  }, 30000);

  // 每 5 秒验证配置（防止外部覆盖）
  var configGuard = setInterval(function() {
    try {
      var current = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8"));
      var expected = getFvMainModelName();
      var actual = current.env && current.env.ANTHROPIC_MODEL;
      if (expected && actual !== expected && (current.env.ANTHROPIC_BASE_URL || "").includes("127.0.0.1")) {
        console.warn("⚠️  配置被外部修改 (" + actual + " → " + expected + ")，自动修复...");
        writeProxyConfig();
      }
    } catch(e) {}
  }, 5000);

  console.log("\n🌐 Web UI: http://127.0.0.1:" + PORT + "/");
  console.log("\n🤖 配置完成！请打开新终端输入: claude\n");

  process.on("SIGINT", function() { clearInterval(watcher); clearInterval(configGuard); clearInterval(watchdog); process.exit(0); });
  process.on("SIGTERM", function() { clearInterval(watcher); clearInterval(configGuard); clearInterval(watchdog); process.exit(0); });
}

main().catch(function(e) { console.error("❌ 错误:", e); process.exit(1); });

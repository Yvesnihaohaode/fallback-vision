#!/usr/bin/env node
// Fallback Vision — 一键启动 Codex (跨平台)

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import http from "node:http";

const PORT = Number(process.env.FALLBACK_VISION_PORT) || 8789;
const FV_DIR = join(homedir(), ".fallback-vision");
const RESTART_FLAG = join(FV_DIR, ".restart");
const CODEX_CONFIG = join(homedir(), ".codex", "config.toml");
const CODEX_CONFIG_BAK = join(FV_DIR, "original-codex-config.toml");

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

function waitForServer(port, timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      http
        .get(`http://127.0.0.1:${port}/healthz`, (res) => {
          if (res.statusCode === 200) resolve(true);
          else if (Date.now() - start < timeout) setTimeout(check, 300);
          else resolve(false);
        })
        .on("error", () => {
          if (Date.now() - start < timeout) setTimeout(check, 300);
          else resolve(false);
        });
    };
    check();
  });
}

// 备份原始 Codex 配置（仅首次）
function storeOriginalCodexConfig() {
  if (!existsSync(CODEX_CONFIG)) return;
  if (existsSync(CODEX_CONFIG_BAK)) return;
  try {
    const content = readFileSync(CODEX_CONFIG, "utf-8");
    if (content.includes("127.0.0.1:" + PORT)) return; // already pointing to FV
  } catch {}
  copyFileSync(CODEX_CONFIG, CODEX_CONFIG_BAK);
  console.log("📋 已备份原始 Codex 配置");
}

// 更新 Codex config.toml 中的 base_url 指向 FV 端口
function writeCodexConfig() {
  if (!existsSync(CODEX_CONFIG)) {
    console.log("⚠️  未找到 Codex 配置文件: " + CODEX_CONFIG);
    return;
  }
  try {
    let content = readFileSync(CODEX_CONFIG, "utf-8");
    const baseUrlPattern = /(base_url\s*=\s*"http:\/\/127\.0\.0\.1:)\d+(\/v1")/;
    const newBaseUrl = `$1${PORT}$2`;
    if (baseUrlPattern.test(content)) {
      content = content.replace(baseUrlPattern, newBaseUrl);
    } else {
      console.log("⚠️  未找到 base_url 配置，请手动检查 Codex 配置");
    }
    writeFileSync(CODEX_CONFIG, content);

    const verify = readFileSync(CODEX_CONFIG, "utf-8");
    if (verify.includes("127.0.0.1:" + PORT)) {
      console.log("✅ Codex 配置已更新: 127.0.0.1:" + PORT);
    } else {
      console.error("⚠️  Codex 配置更新验证失败");
    }
  } catch (e) {
    console.error("⚠️  更新 Codex 配置失败:", e.message);
  }
}

function openBrowser(url) {
  try {
    if (platform() === "win32") {
      spawn("cmd.exe", ["/c", "start", url], { stdio: "ignore", detached: true }).unref();
    } else if (platform() === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {}
}

function launchCodex() {
  console.log("🔧 启动 Codex...");
  if (platform() === "darwin" && existsSync("/Applications/Codex.app")) {
    spawn("open", ["/Applications/Codex.app"], { stdio: "ignore", detached: true }).unref();
  } else {
    console.log("   请手动打开 Codex");
  }
}

async function startServer(root) {
  const server = spawn("node", ["dist/cli.js", "--port", String(PORT)], {
    cwd: root, stdio: "ignore", detached: true,
  });
  server.unref();
  if (!existsSync(FV_DIR)) mkdirSync(FV_DIR, { recursive: true });
  writeFileSync(join(FV_DIR, "server.pid"), String(server.pid));
  return server.pid;
}

async function doRestart(root) {
  console.log("\n🔄 检测到重启信号，正在重启...");

  // Dashboard Save 后 process.exit(0) 已杀掉旧进程，等它退出即可
  await new Promise(r => setTimeout(r, 1500));

  console.log("🚀 重新启动服务...");
  await startServer(root);
  const ok = await waitForServer(PORT, 15000);
  if (ok) {
    writeCodexConfig();
    launchCodex();
    console.log("✅ 服务重启成功");
  } else {
    console.error("❌ 重启失败");
  }
  // 不退出 — 保持 watcher 和 watchdog 运行
}

async function main() {
  console.log("\n⚡ Fallback Vision — Codex 模式\n");

  const root = findProjectRoot();
  if (!root) {
    console.error("❌ 找不到 Fallback Vision");
    console.error("请先安装: npm install -g fallback-vision");
    process.exit(1);
  }

  console.log(`📁 项目目录: ${root}`);
  mkdirSync(join(homedir(), ".fallback-vision"), { recursive: true });
  if (existsSync(RESTART_FLAG)) unlinkSync(RESTART_FLAG);

  const running = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/healthz`, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });

  if (running) {
    console.log("✅ 服务已在运行");
  } else {
    console.log("🚀 启动服务...");
    await startServer(root);
    const ok = await waitForServer(PORT, 15000);
    if (!ok) { console.error("❌ 启动失败"); process.exit(1); }
    console.log("✅ 服务启动成功");
  }

  // 配置 Codex 指向 FV 代理端口
  storeOriginalCodexConfig();
  writeCodexConfig();

  // 直接启动 Codex
  launchCodex();

  console.log("\n🌐 Web UI: http://127.0.0.1:" + PORT + "/");

  // Watchdog: 每 30 秒健康检查，proxy 挂了自动拉起
  let watchdog;
  function startWatchdog() {
    watchdog = setInterval(async () => {
      const alive = await new Promise((resolve) => {
        http.get(`http://127.0.0.1:${PORT}/healthz`, { timeout: 5000 }, (res) => {
          resolve(res.statusCode === 200);
        }).on("error", () => resolve(false)).on("timeout", function() { this.destroy(); resolve(false); });
      });
      if (!alive) {
        // 如果有重启信号且不是 Codex 的，不要抢 — fv-claude 在处理
        try {
          if (existsSync(RESTART_FLAG)) {
            const flag = readFileSync(RESTART_FLAG, "utf-8").trim();
            if (flag && flag.includes("claude")) return;
          }
        } catch {}
        console.warn("\n⚠️  Proxy 进程无响应，自动重启中...");
        try {
          await startServer(root);
          const ok = await waitForServer(PORT, 15000);
          if (ok) {
            writeCodexConfig();
            launchCodex();
            console.log("✅ Proxy 已自动恢复");
          } else {
            console.error("❌ Proxy 自动恢复失败");
          }
        } catch(e) {
          console.error("❌ Proxy 自动恢复异常:", e.message);
        }
      }
    }, 30000);
  }
  startWatchdog();

  // Watcher: 检测 Save & Restart 信号
  let watcher;
  function startWatcher() {
    watcher = setInterval(async () => {
      if (!existsSync(RESTART_FLAG)) return;
      // 只处理 Codex 的重启信号（.restart 文件内容包含 "codex"）
      try {
        const flag = readFileSync(RESTART_FLAG, "utf-8").trim();
        if (flag && !flag.includes("codex")) return;
      } catch { return; }
      unlinkSync(RESTART_FLAG);
      clearInterval(watcher);
      clearInterval(watchdog);
      await doRestart(root);
      startWatchdog();
      startWatcher();
    }, 800);
  }
  startWatcher();

  process.on("SIGINT", () => { clearInterval(watcher); clearInterval(watchdog); process.exit(0); });
  process.on("SIGTERM", () => { clearInterval(watcher); clearInterval(watchdog); process.exit(0); });
}

main().catch((e) => { console.error("❌ 错误:", e); process.exit(1); });

#!/usr/bin/env node
// Fallback Vision — 一键启动 Codex (跨平台)

import { spawn, spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import http from "node:http";

const PORT = Number(process.env.FALLBACK_VISION_PORT) || 8789;
const FV_DIR = join(homedir(), ".fallback-vision");
const RESTART_FLAG = join(FV_DIR, ".restart");

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

function killServer() {
  const PORT = Number(process.env.FALLBACK_VISION_PORT) || 8789;
  if (platform() === "win32") {
    spawn("taskkill", ["/f", "/fi", "WINDOWTITLE eq fallback*"], { stdio: "ignore", detached: true }).unref();
  } else {
    // Kill by port — most reliable
    try {
      const result = spawnSync("lsof", ["-ti:" + PORT], { encoding: "utf-8" });
      const pids = (result.stdout || "").trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        const p = Number(pid);
        if (p > 0) {
          try { process.kill(p, "SIGTERM"); } catch(e) {}
        }
      }
    } catch(e) {}
    // Also try PID file
    try {
      const pidFile = join(FV_DIR, "server.pid");
      if (existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, "utf-8").trim());
        if (pid > 0) { try { process.kill(pid, "SIGTERM"); } catch(e) {} }
        unlinkSync(pidFile);
      }
    } catch(e) {}
  }
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
    const server = spawn("node", ["dist/cli.js", "--port", String(PORT)], {
      cwd: root, stdio: "ignore", detached: true,
    });
    server.unref();
    const ok = await waitForServer(PORT, 15000);
    if (!ok) { console.error("❌ 启动失败"); process.exit(1); }
    console.log("✅ 服务启动成功");
  }

  const dashboardUrl = `http://127.0.0.1:${PORT}/`;
  console.log(`\n🌐 Web UI: ${dashboardUrl}`);
  console.log("   可以在这里进一步调整设置\n");
  openBrowser(dashboardUrl);
  console.log("📋 在网页上配置好后，点击「Save & Restart」\n");

  const watcher = setInterval(() => {
    if (existsSync(RESTART_FLAG)) {
      unlinkSync(RESTART_FLAG);
      clearInterval(watcher);
      console.log("\n🔄 检测到重启信号，正在重启...");

      killServer();
      setTimeout(async () => {
        console.log("🚀 重新启动服务...");
        const server = spawn("node", ["dist/cli.js", "--port", String(PORT)], {
          cwd: root, stdio: "ignore", detached: true,
        });
        server.unref();
        const ok = await waitForServer(PORT, 15000);
        if (ok) {
          console.log("✅ 服务重启成功\n");
          console.log("🔧 启动 Codex...");
          if (platform() === "darwin" && existsSync("/Applications/Codex.app")) {
            spawn("open", ["/Applications/Codex.app"], { stdio: "ignore", detached: true }).unref();
          } else {
            console.log("   请手动打开 Codex");
          }
        } else {
          console.error("❌ 重启失败");
        }
        process.exit(0);
      }, 2000);
    }
  }, 800);

  process.on("SIGINT", () => { clearInterval(watcher); process.exit(0); });
  process.on("SIGTERM", () => { clearInterval(watcher); process.exit(0); });
}

main().catch((e) => { console.error("❌ 错误:", e); process.exit(1); });

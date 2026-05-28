#!/usr/bin/env node
// Fallback Vision — 一键启动 Codex (跨平台)

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import http from "node:http";

const PORT = Number(process.env.FALLBACK_VISION_PORT) || 8789;
const RESTART_FLAG = join(homedir(), ".fallback-vision", ".restart");

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

function waitForServer(port, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      http
        .get(`http://127.0.0.1:${port}/healthz`, (res) => {
          if (res.statusCode === 200) resolve(true);
          else if (Date.now() - start < timeout) setTimeout(check, 200);
          else resolve(false);
        })
        .on("error", () => {
          if (Date.now() - start < timeout) setTimeout(check, 200);
          else resolve(false);
        });
    };
    check();
  });
}

function openBrowser(url) {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
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
    http
      .get(`http://127.0.0.1:${PORT}/healthz`, (res) => {
        resolve(res.statusCode === 200);
      })
      .on("error", () => resolve(false));
  });

  if (running) {
    console.log("✅ 服务已在运行");
  } else {
    console.log("🚀 启动服务...");
    const server = spawn("node", ["dist/cli.js", "--port", String(PORT)], {
      cwd: root,
      stdio: "ignore",
      detached: true,
    });
    server.unref();

    const ok = await waitForServer(PORT, 10000);
    if (!ok) {
      console.error("❌ 启动失败，请检查端口", PORT);
      process.exit(1);
    }
    console.log("✅ 服务启动成功");
  }

  const dashboardUrl = `http://127.0.0.1:${PORT}/`;
  console.log(`\n🌐 Web UI: ${dashboardUrl}`);
  console.log("   可以在这里进一步调整设置\n");

  openBrowser(dashboardUrl);

  console.log("📋 在网页上配置好后，点击「保存并重启使用」\n");

  const checkInterval = setInterval(() => {
    if (existsSync(RESTART_FLAG)) {
      clearInterval(checkInterval);
      unlinkSync(RESTART_FLAG);
      console.log("\n🔄 正在重启...");
      spawn("pkill", ["-f", "fallback-vision"], { stdio: "ignore" }).unref();
      setTimeout(async () => {
        console.log("🚀 重新启动服务...");
        const server = spawn("node", ["dist/cli.js", "--port", String(PORT)], {
          cwd: root,
          stdio: "ignore",
          detached: true,
        });
        server.unref();
        const ok = await waitForServer(PORT, 10000);
        if (ok) {
          console.log("✅ 服务重启成功");
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
  }, 1000);
}

main().catch((e) => {
  console.error("❌ 错误:", e);
  process.exit(1);
});

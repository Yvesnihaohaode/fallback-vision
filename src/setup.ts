#!/usr/bin/env node
// ============================================================================
// Fallback Vision — Interactive Setup Wizard + 一键启动
// ============================================================================

import * as readline from "node:readline";
import * as http from "node:http";
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadSettings, saveSettings } from "./config/settings.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function getProjectRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.argv[1], "..", ".."),
    path.resolve(os.homedir(), "Desktop", "fallback-vision"),
  ];
  
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "dist", "cli.js"))) {
      return dir;
    }
  }
  
  try {
    const npmRoot = child_process.execSync("npm root -g", { encoding: "utf-8" }).trim();
    const npmDir = path.join(npmRoot, "fallback-vision");
    if (fs.existsSync(path.join(npmDir, "dist", "cli.js"))) {
      return npmDir;
    }
  } catch {}
  
  return process.cwd();
}

function waitForServer(port: number, timeout = 10000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else if (Date.now() - start < timeout) setTimeout(check, 200);
        else resolve(false);
      }).on("error", () => {
        if (Date.now() - start < timeout) setTimeout(check, 200);
        else resolve(false);
      });
    };
    check();
  });
}

function startServer(port: number): Promise<child_process.ChildProcess> {
  const projectRoot = getProjectRoot();
  console.log(`📁 项目目录: ${projectRoot}`);
  
  if (!fs.existsSync(path.join(projectRoot, "node_modules"))) {
    console.log("📦 首次运行，正在安装依赖...");
    child_process.execSync("npm install --omit=dev", { cwd: projectRoot, stdio: "pipe" });
  }
  
  const server = child_process.spawn("node", ["dist/cli.js", "--port", String(port)], {
    cwd: projectRoot,
    stdio: "ignore",
    detached: true,
  });
  
  server.unref();
  
  return waitForServer(port, 10000).then((ok) => {
    if (!ok) throw new Error("服务启动超时");
    return server;
  });
}

function openBrowser(url: string) {
  try {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    child_process.spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {}
}

async function main() {
  console.log("\n⚡ Fallback Vision — Setup Wizard\n");

  const settings = loadSettings();

  // Step 1: Client type
  console.log("Step 1/4: 你用的是什么客户端？");
  console.log("  1) Codex (OpenAI 协议)");
  console.log("  2) Claude Code (Anthropic 协议)");
  const clientChoice = await ask("选择 [1/2] (默认 1): ");
  settings.clientType = clientChoice === "2" ? "claude" : "codex";

  // Step 2: Main model
  console.log("\nStep 2/4: 设置主模型");
  const mainProvider = await ask(`Provider 名称 [${settings.mainModel.providerName}]: `);
  if (mainProvider) settings.mainModel.providerName = mainProvider;
  const mainKey = await ask(`API Key [${settings.mainModel.apiKey ? "***" : "未配置"}]: `);
  if (mainKey) settings.mainModel.apiKey = mainKey;
  const mainModel = await ask(`模型名称 [${settings.mainModel.modelName}]: `);
  if (mainModel) settings.mainModel.modelName = mainModel;
  const mainUrl = await ask(`Base URL [${settings.mainModel.baseUrl}]: `);
  if (mainUrl) settings.mainModel.baseUrl = mainUrl;

  // Step 3: Vision model
  console.log("\nStep 3/4: 设置视觉模型");
  const visionProvider = await ask(`Provider 名称 [${settings.visionModel.providerName}]: `);
  if (visionProvider) settings.visionModel.providerName = visionProvider;
  const visionKey = await ask(`API Key [${settings.visionModel.apiKey ? "***" : "未配置"}]: `);
  if (visionKey) settings.visionModel.apiKey = visionKey;
  const visionModel = await ask(`模型名称 [${settings.visionModel.modelName}]: `);
  if (visionModel) settings.visionModel.modelName = visionModel;
  const visionUrl = await ask(`Base URL [${settings.visionModel.baseUrl}]: `);
  if (visionUrl) settings.visionModel.baseUrl = visionUrl;

  // Step 4: Local search (MiMo only)
  if (settings.mainModel.providerName.toLowerCase().includes("mimo")) {
    console.log("\nStep 4/4: 本地优化搜索（MiMo 专属）");
    console.log("  MiMo 不支持原生 web_search/web_fetch。");
    console.log("  开启后由 Fallback Vision 本地处理搜索请求。");
    const localSearch = await ask("开启本地优化搜索？[y/N]: ");
    settings.localSearchEnabled = localSearch.toLowerCase() === "y";
  }

  saveSettings(settings);
  console.log("\n✅ 配置已保存到 ~/.fallback-vision/settings.json\n");

  rl.close();

  // Step 5: 自动启动服务 + 打开 Web UI
  const port = Number(process.env.FALLBACK_VISION_PORT) || 8789;
  
  // 检查是否已有服务在运行
  let serverRunning = false;
  try {
    await new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
        if (res.statusCode === 200) resolve();
        else reject();
      }).on("error", reject);
    });
    serverRunning = true;
  } catch {}
  
  if (!serverRunning) {
    console.log("🚀 启动服务...");
    try {
      await startServer(port);
      console.log("✅ 服务启动成功");
    } catch (e) {
      console.error("❌ 服务启动失败，请手动运行: npx fallback-vision");
      process.exit(1);
    }
  } else {
    console.log("✅ 服务已在运行");
  }
  
  const dashboardUrl = `http://127.0.0.1:${port}/`;
  console.log(`\n🌐 Web UI: ${dashboardUrl}`);
  console.log("   可以在这里进一步调整设置\n");
  
  openBrowser(dashboardUrl);
  
  // 打印使用说明
  if (settings.clientType === "codex") {
    console.log("📋 接下来：");
    console.log("   1. 打开 Codex");
    console.log(`   2. 配置 base_url = ${dashboardUrl}v1`);
    console.log("   或直接运行: fv-codex\n");
  } else {
    console.log("📋 接下来：");
    console.log(`   运行: ANTHROPIC_BASE_URL=${dashboardUrl} claude`);
    console.log("   或直接运行: fv-claude\n");
  }
  
  console.log("   在 Web UI 配置好后，点击「保存并重启使用」");
  console.log("   按 Ctrl+C 退出此向导\n");
  
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Setup 失败:", e);
  process.exit(1);
});

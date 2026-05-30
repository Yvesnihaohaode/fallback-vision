#!/usr/bin/env node
// Fallback Vision — 停止服务并恢复原配置
// 恢复优先级: original-claude-settings.json → claude-settings-backup.json → 从 FV 设置重建 → 清理 env

import { existsSync, unlinkSync, copyFileSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const FV_DIR = join(homedir(), ".fallback-vision");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const ORIGINAL_SETTINGS = join(FV_DIR, "original-claude-settings.json");
const CLAUDE_SETTINGS_BACKUP = join(FV_DIR, "claude-settings-backup.json");

console.log("\n⏹  Fallback Vision — 停止服务\n");

// Kill server
if (platform() === "win32") {
  spawnSync("taskkill", ["/f", "/fi", "WINDOWTITLE eq fallback*"], { stdio: "ignore" });
} else {
  spawnSync("pkill", ["-f", "fallback-vision"], { stdio: "ignore" });
  try {
    const pidFile = join(FV_DIR, "server.pid");
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, "utf-8").trim());
      if (pid > 0) { try { process.kill(pid, "SIGTERM"); } catch(e) {} }
      unlinkSync(pidFile);
    }
  } catch(e) {}
}
console.log("✅ 服务已停止");

// Restore original Claude settings
// Clean up FV-active marker
const FV_ACTIVE_MARKER = join(FV_DIR, ".fv-active");
if (existsSync(FV_ACTIVE_MARKER)) unlinkSync(FV_ACTIVE_MARKER);
var restored = false;

// Priority 1: original-claude-settings.json (reliable storage)
if (!restored && existsSync(ORIGINAL_SETTINGS)) {
  try {
    var original = JSON.parse(readFileSync(ORIGINAL_SETTINGS, "utf-8"));
    var origUrl = (original.env && original.env.ANTHROPIC_BASE_URL) || "";
    if (!origUrl.includes("127.0.0.1")) {
      copyFileSync(ORIGINAL_SETTINGS, CLAUDE_SETTINGS);
      console.log("♻️  已恢复原始配置: " + origUrl + " (模型: " + ((original.env && original.env.ANTHROPIC_MODEL) || "unknown") + ")");
      restored = true;
    }
  } catch(e) {}
}

// Priority 2: legacy backup
if (!restored && existsSync(CLAUDE_SETTINGS_BACKUP)) {
  try {
    var backup = JSON.parse(readFileSync(CLAUDE_SETTINGS_BACKUP, "utf-8"));
    var backupUrl = (backup.env && backup.env.ANTHROPIC_BASE_URL) || "";
    if (!backupUrl.includes("127.0.0.1")) {
      copyFileSync(CLAUDE_SETTINGS_BACKUP, CLAUDE_SETTINGS);
      console.log("♻️  已恢复备份配置: " + backupUrl + " (模型: " + ((backup.env && backup.env.ANTHROPIC_MODEL) || "unknown") + ")");
      restored = true;
    }
  } catch(e) {}
}

// Priority 3: reconstruct from FV settings
if (!restored) {
  try {
    var fvSettings = JSON.parse(readFileSync(join(FV_DIR, "settings.json"), "utf-8"));
    var mainModel = fvSettings.mainModel || {};
    if (mainModel.apiKey && mainModel.baseUrl) {
      var settings = {};
      if (existsSync(CLAUDE_SETTINGS)) {
        try { settings = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8")); } catch(e) {}
      }
      if (!settings.env) settings.env = {};
      settings.env.ANTHROPIC_BASE_URL = mainModel.baseUrl;
      settings.env.ANTHROPIC_AUTH_TOKEN = mainModel.apiKey;
      settings.env.ANTHROPIC_MODEL = mainModel.modelName || "unknown";
      writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
      console.log("♻️  已从 FV 配置重建: " + mainModel.baseUrl + " (模型: " + (mainModel.modelName || "unknown") + ")");
      restored = true;
    }
  } catch(e) {}
}

// Last resort: clean proxy env vars
if (!restored) {
  console.log("⚠️  无法恢复原始配置，正在清理代理设置...");
  try {
    var s = {};
    if (existsSync(CLAUDE_SETTINGS)) {
      try { s = JSON.parse(readFileSync(CLAUDE_SETTINGS, "utf-8")); } catch(e) {}
    }
    if (s.env) {
      delete s.env.ANTHROPIC_BASE_URL;
      delete s.env.ANTHROPIC_AUTH_TOKEN;
      delete s.env.ANTHROPIC_MODEL;
    }
    writeFileSync(CLAUDE_SETTINGS, JSON.stringify(s, null, 2));
    console.log("   已清理代理环境变量");
  } catch(e) {
    console.log("   ⚠️ 请手动编辑 ~/.claude/settings.json");
  }
}

// Clean up legacy backup (but keep original)
if (existsSync(CLAUDE_SETTINGS_BACKUP)) unlinkSync(CLAUDE_SETTINGS_BACKUP);

// Restore Qwen vision hook
const HOOK_FILE = join(homedir(), ".claude", "hooks", "describe-image.py");
const HOOK_DISABLED = HOOK_FILE + ".disabled";
if (existsSync(HOOK_DISABLED) && !existsSync(HOOK_FILE)) {
  renameSync(HOOK_DISABLED, HOOK_FILE);
  console.log("🔊 Qwen 视觉 hook 已恢复");
}

if (existsSync(join(FV_DIR, ".restart"))) unlinkSync(join(FV_DIR, ".restart"));

console.log("\n💡 现在可以正常使用 ccswitch 或其他工具了。");
console.log("   输入 claude 开始使用。\n");

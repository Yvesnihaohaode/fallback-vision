import type { ServerResponse } from "node:http";
import type { GatewayConfig } from "../../config/loader.js";
import { loadSettings, detectModelCapabilities, PROVIDERS, isMiMoModel } from "../../config/settings.js";

export function sendIndex(cfg: GatewayConfig, res: ServerResponse): void {
  const settings = loadSettings();
  const mainCap = detectModelCapabilities(settings.mainModel.modelName);
  const visionCap = detectModelCapabilities(settings.visionModel.modelName);
  const isCodex = settings.clientType === "codex";
  const isMiMo = isMiMoModel(settings.mainModel.modelName);

  // Build provider data for client-side JS
  const providerData = JSON.stringify(PROVIDERS);
  const clientType = settings.clientType;

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fallback Vision v${cfg.version}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e1e4e8;line-height:1.5}
.hdr{background:#1a1b26;padding:20px 28px;border-bottom:1px solid #2d2f3d;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:22px;color:#c0caf5}.hdr p{color:#565f89;margin-top:4px;font-size:13px}
.hdr .ver{color:#565f89;font-size:12px;background:#16161e;padding:4px 10px;border-radius:12px}
.ctr{max-width:920px;margin:0 auto;padding:28px}
.tabs{display:flex;border-bottom:1px solid #2d2f3d;margin-bottom:20px;gap:0}
.tab{padding:10px 24px;cursor:pointer;color:#565f89;font-size:14px;border-bottom:2px solid transparent;user-select:none;transition:all .15s}
.tab:hover{color:#7aa2f7}
.tab.on{color:#7aa2f7;border-bottom-color:#7aa2f7}
.page{display:none}.page.on{display:block}
.card{background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px;padding:20px;margin-bottom:14px}
.st{padding:3px 10px;border-radius:16px;font-size:12px;font-weight:500;display:inline-block}
.st.on{background:#1a3a2a;color:#73daca}
.sb{display:flex;gap:14px;padding:14px 18px;background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px;margin-bottom:20px;font-size:13px;flex-wrap:wrap}
.sb strong{color:#c0caf5}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:14px}
label{display:block;color:#565f89;font-size:12px;margin-bottom:4px}
input[type=text],input[type=password]{width:100%;background:#16161e;border:1px solid #2d2f3d;border-radius:6px;padding:8px 12px;color:#c0caf5;font-size:13px;transition:border-color .15s}
input:focus{outline:none;border-color:#7aa2f7}
.btn{padding:10px 24px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:500;background:#7aa2f7;color:#1a1b26;transition:background .15s}
.btn:hover{background:#89b4fa}
.btn:active{background:#6a8ee0}
.ct{display:flex;gap:0;background:#16161e;border:1px solid #2d2f3d;border-radius:8px;padding:3px;width:fit-content;margin-bottom:16px}
.cb{padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;color:#565f89;border:none;background:transparent;transition:all .15s}
.cb:hover{color:#c0caf5}
.cb.on{background:#7aa2f7;color:#1a1b26}
.ml{max-height:280px;overflow-y:auto;padding:6px;background:#16161e;border:1px solid #2d2f3d;border-radius:6px;margin-top:10px}
.mg{font-size:11px;font-weight:600;color:#7aa2f7;padding:6px 6px 3px;text-transform:uppercase;letter-spacing:.5px}
.mi{padding:6px 10px;border-radius:5px;cursor:pointer;font-size:13px;color:#a9b1d6;display:flex;justify-content:space-between;align-items:center;transition:all .1s}
.mi:hover{background:#1a2a4a;color:#c0caf5}
.mi.sel{background:#1a2a4a;color:#7aa2f7}
.mi .mt{display:flex;gap:4px}
.mi .t{font-size:10px;padding:2px 5px;border-radius:3px}
.t.v{background:#1a3a4a;color:#73daca}
.t.r{background:#2a1a3a;color:#bb9af7}
.cb2{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#16161e;border-radius:6px;margin-top:10px}
.cb2 label{color:#a9b1d6;cursor:pointer;font-size:13px;margin:0}
.tip{color:#565f89;font-size:11px;margin-top:6px}
#msg{margin-top:10px;font-size:13px;min-height:18px}
.fl{display:flex;align-items:center;justify-content:center;gap:14px;padding:20px 0;flex-wrap:wrap}
.fb{padding:10px 16px;border-radius:8px;font-size:12px;font-weight:500;text-align:center;min-width:100px}
.fb.c{background:#1a2a4a;color:#7aa2f7;border:1px solid #2a3a5a}
.fb.g{background:#2a2a1a;color:#e0af68;border:1px solid #3a3a2a}
.fb.m{background:#1a3a2a;color:#73daca;border:1px solid #2a4a3a}
.fb.v{background:#2a1a3a;color:#bb9af7;border:1px solid #3a2a4a}
.fa{color:#565f89;font-size:18px}
.h3{font-size:16px;color:#c0caf5;margin-bottom:12px}
.sc{display:flex;gap:10px;align-items:center;margin-top:14px;padding:10px 14px;background:#16161e;border-radius:6px;font-size:13px;flex-wrap:wrap}
.info-box{padding:14px 18px;background:#1a2a1a;border:1px solid #2a4a3a;border-radius:8px;color:#73daca;font-size:13px;line-height:1.6}
.warn-box{padding:14px 18px;background:#2a2a1a;border:1px solid #3a3a2a;border-radius:8px;color:#e0af68;font-size:13px;line-height:1.6}
.section-title{font-size:12px;font-weight:600;margin-bottom:12px;letter-spacing:.5px}
.section-title.blue{color:#7aa2f7}
.section-title.purple{color:#bb9af7}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <h1>🔮 Fallback Vision</h1>
    <p>AI Gateway with Visual Fallback Routing</p>
  </div>
  <div class="ver">v${cfg.version} · ${cfg.port} 端口</div>
</div>
<div class="ctr">
  <div class="tabs" id="tab-bar">
    <div class="tab on" data-page="overview">Overview</div>
    <div class="tab" data-page="settings">Settings</div>
  </div>

  <!-- ==================== OVERVIEW ==================== -->
  <div id="overview" class="page on">
    <div class="sb">
      <div>Status <span class="st on">Running</span></div>
      <div>Client <strong>${isCodex ? "Codex" : "Claude Code"}</strong></div>
      <div>Protocol <strong>${isCodex ? "OpenAI" : "Anthropic"}</strong></div>
    </div>
    <div class="card">
      <h3 class="h3">Data Flow</h3>
      <div class="fl">
        <div class="fb c">${isCodex ? "Codex" : "Claude Code"}</div>
        <div class="fa">→</div>
        <div class="fb g">Fallback Vision</div>
        <div class="fa">→</div>
        <div class="fb m">Main Model<br><small>${settings.mainModel.modelName || "not set"}</small></div>
        <div class="fa">←</div>
        <div class="fb v">Vision Model<br><small>${settings.visionModel.modelName || "not set"}</small></div>
      </div>
    </div>
    <div class="card">
      <div class="section-title blue">MAIN MODEL</div>
      <div style="font-size:18px;font-weight:600;color:#c0caf5">${settings.mainModel.modelName || "not configured"}</div>
      <div class="sc">
        <span>${mainCap.vision ? '👁️ Multimodal' : '📝 Text Only'}</span>
        <span style="color:${mainCap.vision ? '#73daca' : '#f7768e'}">Vision ${mainCap.vision ? '✓' : '✗'}</span>
        <span style="color:${mainCap.reasoning ? '#73daca' : '#f7768e'}">Reasoning ${mainCap.reasoning ? '✓' : '✗'}</span>
        ${mainCap.description ? '<span style="color:#565f89">— ' + mainCap.description + '</span>' : ''}
      </div>
    </div>
    <div class="card">
      <div class="section-title purple">VISION MODEL</div>
      <div style="font-size:18px;font-weight:600;color:#c0caf5">${settings.visionModel.modelName || "not configured"}</div>
      <div class="sc">
        <span>${visionCap.vision ? '👁️ Multimodal' : '📝 Text Only'}</span>
        <span style="color:${visionCap.vision ? '#73daca' : '#f7768e'}">Vision ${visionCap.vision ? '✓' : '✗'}</span>
        <span style="color:${visionCap.reasoning ? '#73daca' : '#f7768e'}">Reasoning ${visionCap.reasoning ? '✓' : '✗'}</span>
        ${visionCap.description ? '<span style="color:#565f89">— ' + visionCap.description + '</span>' : ''}
      </div>
    </div>
    ${isMiMo ? '<div class="info-box">✅ 因为 Claude Code 不兼容 MiMo 搜索，本程序已作出适配。工具定义会自动透传给上游模型，Claude Code 本地执行搜索。</div>' : ''}
  </div>

  <!-- ==================== SETTINGS ==================== -->
  <div id="settings" class="page">
    <div class="card">
      <h3 class="h3">Client Type</h3>
      <div class="ct" id="client-toggle">
        <button class="cb${isCodex ? ' on' : ''}" data-client="codex">🔧 Codex</button>
        <button class="cb${!isCodex ? ' on' : ''}" data-client="claude">💬 Claude Code</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title blue">MAIN MODEL</div>
      <div class="fg">
        <div><label>Provider</label><input type="text" id="mp" value="${settings.mainModel.providerName}" placeholder="DeepSeek / OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="mu" value="${settings.mainModel.baseUrl}" placeholder="https://api.deepseek.com/v1"></div>
        <div><label>API Key</label><input type="password" id="mk" value="${settings.mainModel.apiKey}" placeholder="sk-..."></div>
        <div><label>Model Name</label><input type="text" id="mm" value="${settings.mainModel.modelName}" placeholder="deepseek-chat / gpt-4o ..."></div>
      </div>
      <div class="ml" id="mlist"></div>
      <div class="tip">Click model to auto-fill provider + URL + name. Vision ✓ = supports images, Reasoning ✓ = deep thinking.</div>
      <div class="sc" id="mcap"></div>
    </div>

    <div class="card">
      <div class="section-title purple">VISION MODEL</div>
      <div class="fg">
        <div><label>Provider</label><input type="text" id="vp" value="${settings.visionModel.providerName}" placeholder="OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="vu" value="${settings.visionModel.baseUrl}" placeholder="https://api.openai.com/v1"></div>
        <div><label>API Key</label><input type="password" id="vk" value="${settings.visionModel.apiKey}" placeholder="sk-..."></div>
        <div><label>Model Name</label><input type="text" id="vm" value="${settings.visionModel.modelName}" placeholder="gpt-4o / mimo-v2.5 ..."></div>
      </div>
      <div class="ml" id="vlist"></div>
      <div class="tip">Vision model must support images (Vision ✓). Only vision-capable models shown.</div>
      <div class="sc" id="vcap"></div>
    </div>

    <div id="ls-section" style="display:${isMiMo ? 'block' : 'none'}">
      <div class="info-box">✅ 因为 Claude Code 不兼容 MiMo 搜索，本程序已作出适配。工具定义会自动透传给上游模型，Claude Code 本地执行搜索。</div>
    </div>

    <div style="margin-top:20px;display:flex;align-items:center;gap:14px">
      <button class="btn" id="btn-save">💾 Save & Restart</button>
      <div id="msg"></div>
    </div>
  </div>
</div>

<script>
(function() {
  "use strict";

  // === Data ===
  var P = ${providerData};
  var CC = "${clientType}";

  // === Tab switching ===
  var tabBar = document.getElementById("tab-bar");
  tabBar.addEventListener("click", function(e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    var pageId = tab.getAttribute("data-page");
    if (!pageId) return;
    // Hide all pages
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) pages[i].className = "page";
    // Deactivate all tabs
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].className = "tab";
    // Activate selected
    document.getElementById(pageId).className = "page on";
    tab.className = "tab on";
  });

  // === Client toggle ===
  var clientToggle = document.getElementById("client-toggle");
  clientToggle.addEventListener("click", function(e) {
    var btn = e.target.closest("[data-client]");
    if (!btn) return;
    CC = btn.getAttribute("data-client");
    var btns = clientToggle.querySelectorAll(".cb");
    for (var i = 0; i < btns.length; i++) btns[i].className = "cb";
    btn.className = "cb on";
  });

  // === Model list builder ===
  function buildList(listId, prefix, currentModel, visionOnly) {
    var el = document.getElementById(listId);
    if (!el) return;
    var h = "";
    for (var i = 0; i < P.length; i++) {
      if (P[i].name === "其他") continue;
      var models = visionOnly ? P[i].models.filter(function(m) { return m.vision; }) : P[i].models;
      if (models.length === 0) continue;
      h += '<div class="mg">' + esc(P[i].name) + '</div>';
      for (var j = 0; j < models.length; j++) {
        var m = models[j];
        var sel = currentModel === m.id ? " sel" : "";
        var tags = "";
        if (m.vision) tags += '<span class="t v">V</span>';
        if (m.reasoning) tags += '<span class="t r">R</span>';
        h += '<div class="mi' + sel + '" data-model="' + esc(m.id) + '" data-provider="' + esc(P[i].name) + '" data-url="' + esc(P[i].baseUrl) + '" data-prefix="' + esc(prefix) + '">'
          + '<span>' + esc(m.id) + '</span><span class="mt">' + tags + '</span></div>';
      }
    }
    h += '<div class="mg">Custom</div>';
    h += '<div class="mi" data-model="__custom" data-prefix="' + esc(prefix) + '"><span>Custom model name...</span></div>';
    el.innerHTML = h;
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  // === Model list click (event delegation) ===
  document.getElementById("mlist").addEventListener("click", function(e) { handleModelPick(e, "m"); });
  document.getElementById("vlist").addEventListener("click", function(e) { handleModelPick(e, "v"); });

  function handleModelPick(e, defaultPrefix) {
    var item = e.target.closest(".mi");
    if (!item) return;
    var prefix = item.getAttribute("data-prefix") || defaultPrefix;
    var listEl = item.parentElement;
    // Deselect all in this list
    var items = listEl.querySelectorAll(".mi");
    for (var i = 0; i < items.length; i++) items[i].className = "mi";
    // Select this one
    item.className = "mi sel";

    var modelId = item.getAttribute("data-model");
    var provider = item.getAttribute("data-provider") || "";
    var url = item.getAttribute("data-url") || "";

    if (modelId === "__custom") {
      document.getElementById(prefix + "m").value = "";
      document.getElementById(prefix + "m").focus();
    } else {
      document.getElementById(prefix + "m").value = modelId;
      if (provider) document.getElementById(prefix + "p").value = provider;
      if (url) document.getElementById(prefix + "u").value = url;
    }
    updateCap(prefix);
    checkMiMo();
  }

  // === Capability display ===
  function updateCap(prefix) {
    var modelId = document.getElementById(prefix + "m").value;
    var cap = null;
    for (var i = 0; i < P.length; i++) {
      for (var j = 0; j < P[i].models.length; j++) {
        if (P[i].models[j].id === modelId) { cap = P[i].models[j]; break; }
      }
      if (cap) break;
    }
    if (!cap) {
      cap = { vision: false, reasoning: false, description: modelId ? "Unknown model" : "" };
    }
    var el = document.getElementById(prefix + "cap");
    if (!el) return;
    var vc = cap.vision ? "#73daca" : "#f7768e";
    var rc = cap.reasoning ? "#73daca" : "#f7768e";
    el.innerHTML = (cap.vision ? "👁️ Multimodal" : "📝 Text Only")
      + ' &nbsp; <span style="color:' + vc + '">Vision ' + (cap.vision ? "✓" : "✗") + '</span>'
      + ' &nbsp; <span style="color:' + rc + '">Reasoning ' + (cap.reasoning ? "✓" : "✗") + '</span>'
      + (cap.description ? ' &nbsp; <span style="color:#565f89">— ' + esc(cap.description) + '</span>' : '');
  }

  // === MiMo check — by provider name, not model name ===
  function checkMiMo() {
    var pv = document.getElementById("mp").value;
    var found = pv.toLowerCase().indexOf("mimo") >= 0;
    var section = document.getElementById("ls-section");
    if (section) section.style.display = found ? "block" : "none";
  }

  // === Input listeners ===
  document.getElementById("mm").addEventListener("input", function() { updateCap("m"); checkMiMo(); });
  document.getElementById("vm").addEventListener("input", function() { updateCap("v"); });
  document.getElementById("mp").addEventListener("input", function() { checkMiMo(); });
  document.getElementById("mp").addEventListener("change", function() { checkMiMo(); });

  // === Init ===
  buildList("mlist", "m", "${settings.mainModel.modelName}", false);
  buildList("vlist", "v", "${settings.visionModel.modelName}", true);
  updateCap("m");
  updateCap("v");

  // === Save & Restart ===
  document.getElementById("btn-save").addEventListener("click", async function() {
    var msg = document.getElementById("msg");
    var mv = document.getElementById("mm").value;
    if (!mv) {
      msg.textContent = "Please enter a main model name";
      msg.style.color = "#f7768e";
      return;
    }
    var data = {
      clientType: CC,
      mainModel: {
        providerName: document.getElementById("mp").value,
        apiKey: document.getElementById("mk").value,
        baseUrl: document.getElementById("mu").value,
        modelName: mv
      },
      visionModel: {
        providerName: document.getElementById("vp").value,
        apiKey: document.getElementById("vk").value,
        baseUrl: document.getElementById("vu").value,
        modelName: document.getElementById("vm").value
      },
      localSearchEnabled: false
    };
    try {
      msg.textContent = "Saving...";
      msg.style.color = "#e0af68";
      var res = await fetch("/dashboard/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      var r = await res.json();
      if (!r.ok) {
        msg.textContent = "Error: " + (r.error || "save failed");
        msg.style.color = "#f7768e";
        return;
      }
      msg.textContent = "Saved! Restarting server...";
      msg.style.color = "#73daca";
      await fetch("/dashboard/api/restart", { method: "POST" });
    } catch (err) {
      msg.textContent = "Network error: " + err.message;
      msg.style.color = "#f7768e";
    }
  });

})();
</script>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

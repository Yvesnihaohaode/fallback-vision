import type { ServerResponse } from "node:http";
import type { GatewayConfig } from "../../config/loader.js";
import { loadSettings, detectModelCapabilities, PROVIDERS, isMiMoModel } from "../../config/settings.js";

export function sendIndex(cfg: GatewayConfig, res: ServerResponse): void {
  const settings = loadSettings();
  const mainCap = detectModelCapabilities(settings.mainModel.modelName);
  const visionCap = detectModelCapabilities(settings.visionModel.modelName);
  const isCodex = settings.clientType === "codex";
  const isMiMo = isMiMoModel(settings.mainModel.modelName);

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fallback Vision</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e1e4e8}
.hdr{background:#1a1b26;padding:20px 28px;border-bottom:1px solid #2d2f3d}
.hdr h1{font-size:22px;color:#c0caf5}.hdr p{color:#565f89;margin-top:4px;font-size:13px}
.ctr{max-width:900px;margin:0 auto;padding:28px}
.tabs{display:flex;border-bottom:1px solid #2d2f3d;margin-bottom:20px}
.tab{padding:10px 20px;cursor:pointer;color:#565f89;font-size:14px;border-bottom:2px solid transparent}
.tab.on{color:#7aa2f7;border-bottom-color:#7aa2f7}
.page{display:none}.page.on{display:block}
.card{background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px;padding:20px;margin-bottom:14px}
.st{padding:3px 10px;border-radius:16px;font-size:12px;font-weight:500;display:inline-block}
.st.on{background:#1a3a2a;color:#73daca}
.sb{display:flex;gap:14px;padding:14px 18px;background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px;margin-bottom:20px;font-size:13px}
.sb strong{color:#c0caf5}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
label{display:block;color:#565f89;font-size:12px;margin-bottom:4px}
input[type=text],input[type=password]{width:100%;background:#16161e;border:1px solid #2d2f3d;border-radius:6px;padding:8px 12px;color:#c0caf5;font-size:13px}
input:focus{outline:none;border-color:#7aa2f7}
.btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:500;background:#7aa2f7;color:#1a1b26}
.btn:hover{background:#89b4fa}
.ct{display:flex;gap:0;background:#16161e;border:1px solid #2d2f3d;border-radius:8px;padding:3px;width:fit-content;margin-bottom:16px}
.cb{padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;color:#565f89;border:none;background:transparent}
.cb.on{background:#7aa2f7;color:#1a1b26}
.ml{max-height:260px;overflow-y:auto;padding:6px;background:#16161e;border:1px solid #2d2f3d;border-radius:6px;margin-top:10px}
.mg{font-size:11px;font-weight:600;color:#7aa2f7;padding:6px 6px 3px;text-transform:uppercase;letter-spacing:.5px}
.mi{padding:6px 10px;border-radius:5px;cursor:pointer;font-size:13px;color:#a9b1d6;display:flex;justify-content:space-between;align-items:center}
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
.sc{display:flex;gap:10px;align-items:center;margin-top:14px;padding:10px 14px;background:#16161e;border-radius:6px;font-size:13px}
</style>
</head>
<body>
<div class="hdr">
  <h1>Fallback Vision</h1>
  <p>AI Gateway with Visual Fallback Routing</p>
</div>
<div class="ctr">
  <div class="tabs">
    <div class="tab on" onclick="showPage('overview')">Overview</div>
    <div class="tab" onclick="showPage('settings')">Settings</div>
  </div>

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
      <div style="color:#7aa2f7;font-size:12px;font-weight:600;margin-bottom:8px">MAIN MODEL</div>
      <div style="font-size:18px;font-weight:600;color:#c0caf5">${settings.mainModel.modelName || "not configured"}</div>
      <div class="sc">
        <span>${mainCap.vision ? '👁️ Multimodal' : '📝 Text Only'}</span>
        <span style="color:${mainCap.vision ? '#73daca' : '#f7768e'}">Vision ${mainCap.vision ? '✓' : '✗'}</span>
        <span style="color:${mainCap.reasoning ? '#73daca' : '#f7768e'}">Reasoning ${mainCap.reasoning ? '✓' : '✗'}</span>
      </div>
    </div>
    <div class="card">
      <div style="color:#bb9af7;font-size:12px;font-weight:600;margin-bottom:8px">VISION MODEL</div>
      <div style="font-size:18px;font-weight:600;color:#c0caf5">${settings.visionModel.modelName || "not configured"}</div>
      <div class="sc">
        <span>${visionCap.vision ? '👁️ Multimodal' : '📝 Text Only'}</span>
        <span style="color:${visionCap.vision ? '#73daca' : '#f7768e'}">Vision ${visionCap.vision ? '✓' : '✗'}</span>
        <span style="color:${visionCap.reasoning ? '#73daca' : '#f7768e'}">Reasoning ${visionCap.reasoning ? '✓' : '✗'}</span>
      </div>
    </div>
  </div>

  <div id="settings" class="page">
    <div class="card">
      <h3 class="h3">Client Type</h3>
      <div class="ct">
        <button class="cb ${isCodex ? 'on' : ''}" onclick="setClient('codex')" id="btn-codex">🔧 Codex</button>
        <button class="cb ${!isCodex ? 'on' : ''}" onclick="setClient('claude')" id="btn-claude">💬 Claude Code</button>
      </div>
    </div>

    <div class="card">
      <div style="color:#7aa2f7;font-size:12px;font-weight:600;margin-bottom:12px">MAIN MODEL</div>
      <div class="fg">
        <div><label>Provider</label><input type="text" id="mp" value="${settings.mainModel.providerName}" placeholder="DeepSeek / OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="mu" value="${settings.mainModel.baseUrl}" placeholder="https://api.deepseek.com/v1"></div>
        <div><label>API Key</label><input type="password" id="mk" value="${settings.mainModel.apiKey}" placeholder="sk-..."></div>
        <div><label>Model Name</label><input type="text" id="mm" value="${settings.mainModel.modelName}" placeholder="deepseek-chat / gpt-4o ..."></div>
      </div>
      <div class="ml" id="mlist"></div>
      <div class="tip">Click to auto-fill. Vision ✓ = supports images, Reasoning ✓ = deep thinking.</div>
      <div class="sc" id="mcap"></div>
    </div>

    <div class="card">
      <div style="color:#bb9af7;font-size:12px;font-weight:600;margin-bottom:12px">VISION MODEL</div>
      <div class="fg">
        <div><label>Provider</label><input type="text" id="vp" value="${settings.visionModel.providerName}" placeholder="OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="vu" value="${settings.visionModel.baseUrl}" placeholder="https://api.openai.com/v1"></div>
        <div><label>API Key</label><input type="password" id="vk" value="${settings.visionModel.apiKey}" placeholder="sk-..."></div>
        <div><label>Model Name</label><input type="text" id="vm" value="${settings.visionModel.modelName}" placeholder="gpt-4o / mimo-v2.5 ..."></div>
      </div>
      <div class="ml" id="vlist"></div>
      <div class="tip">Vision model must support images (Vision ✓).</div>
      <div class="sc" id="vcap"></div>
    </div>

    <div id="ls-section" style="display:${isMiMo ? 'block' : 'none'}">
      <div class="card">
        <h3 class="h3">🔍 Local Search (MiMo Only)</h3>
        <p class="tip">MiMo doesn't support web_search/web_fetch. Enable to handle search locally via DuckDuckGo.</p>
        <div class="cb2">
          <input type="checkbox" id="ls" ${settings.localSearchEnabled ? 'checked' : ''}>
          <label for="ls">Enable local search</label>
        </div>
      </div>
    </div>

    <div style="margin-top:20px;display:flex;align-items:center;gap:14px">
      <button class="btn" onclick="saveAndRestart()">Save & Restart</button>
      <div id="msg"></div>
    </div>
  </div>
</div>

<script>
var P = ${JSON.stringify(PROVIDERS)};
var CC = '${settings.clientType}';

function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.className = 'page'; });
  document.querySelectorAll('.tab').forEach(function(t) { t.className = 'tab'; });
  document.getElementById(id).className = 'page on';
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    if ((id === 'overview' && i === 0) || (id === 'settings' && i === 1)) {
      tabs[i].className = 'tab on';
    }
  }
}

function setClient(c) {
  CC = c;
  document.getElementById('btn-codex').className = 'cb' + (c === 'codex' ? ' on' : '');
  document.getElementById('btn-claude').className = 'cb' + (c === 'claude' ? ' on' : '');
}

function buildList(id, prefix, cur, visOnly) {
  var el = document.getElementById(id);
  if (!el) return;
  var h = '';
  for (var i = 0; i < P.length; i++) {
    if (P[i].name === 'Other') continue;
    var models = visOnly ? P[i].models.filter(function(m) { return m.vision; }) : P[i].models;
    if (models.length === 0) continue;
    h += '<div class="mg">' + P[i].name + '</div>';
    for (var j = 0; j < models.length; j++) {
      var m = models[j];
      var s = cur === m.id ? ' sel' : '';
      var tags = '';
      if (m.vision) tags += '<span class="t v">V</span>';
      if (m.reasoning) tags += '<span class="t r">R</span>';
      h += '<div class="mi' + s + '" data-m="' + m.id + '" data-p="' + P[i].name + '" data-u="' + P[i].baseUrl + '" onclick="pick(this,\'' + prefix + '\')"><span>' + m.id + '</span><span class="mt">' + tags + '</span></div>';
    }
  }
  h += '<div class="mg">Custom</div>';
  h += '<div class="mi" data-m="__custom" onclick="pick(this,\'' + prefix + '\')"><span>Custom model name...</span></div>';
  el.innerHTML = h;
}

function pick(el, prefix) {
  var items = el.parentElement.querySelectorAll('.mi');
  for (var i = 0; i < items.length; i++) items[i].className = 'mi';
  el.className = 'mi sel';
  var m = el.getAttribute('data-m');
  var p = el.getAttribute('data-p') || '';
  var u = el.getAttribute('data-u') || '';
  if (m === '__custom') {
    document.getElementById(prefix + 'm').value = '';
    document.getElementById(prefix + 'm').focus();
  } else {
    document.getElementById(prefix + 'm').value = m;
    if (p) document.getElementById(prefix + 'p').value = p;
    if (u) document.getElementById(prefix + 'u').value = u;
  }
  updateCap(prefix);
  checkMiMo();
}

function updateCap(prefix) {
  var model = document.getElementById(prefix + 'm').value;
  var cap = null;
  for (var i = 0; i < P.length; i++) {
    for (var j = 0; j < P[i].models.length; j++) {
      if (P[i].models[j].id === model) { cap = P[i].models[j]; break; }
    }
    if (cap) break;
  }
  if (!cap) {
    cap = { vision: false, reasoning: false, description: model ? 'Unknown model' : '' };
  }
  var el = document.getElementById(prefix + 'cap');
  if (!el) return;
  var vc = cap.vision ? '#73daca' : '#f7768e';
  var rc = cap.reasoning ? '#73daca' : '#f7768e';
  el.innerHTML = (cap.vision ? '👁️ Multimodal' : '📝 Text Only') + ' &nbsp; <span style="color:' + vc + '">Vision ' + (cap.vision ? '✓' : '✗') + '</span> &nbsp; <span style="color:' + rc + '">Reasoning ' + (cap.reasoning ? '✓' : '✗') + '</span>' + (cap.description ? ' &nbsp; — ' + cap.description : '');
}

function checkMiMo() {
  var mv = document.getElementById('mm').value;
  var found = false;
  for (var i = 0; i < P.length; i++) {
    if (P[i].name === 'MiMo') {
      for (var j = 0; j < P[i].models.length; j++) {
        if (P[i].models[j].id === mv) { found = true; break; }
      }
      break;
    }
  }
  var s = document.getElementById('ls-section');
  if (s) s.style.display = found ? 'block' : 'none';
}

document.getElementById('mm').oninput = function() { updateCap('m'); checkMiMo(); };
document.getElementById('vm').oninput = function() { updateCap('v'); };

buildList('mlist', 'm', '${settings.mainModel.modelName}', false);
buildList('vlist', 'v', '${settings.visionModel.modelName}', true);
updateCap('m');
updateCap('v');

async function saveAndRestart() {
  var msg = document.getElementById('msg');
  var mv = document.getElementById('mm').value;
  var found = false;
  for (var i = 0; i < P.length; i++) {
    if (P[i].name === 'MiMo') {
      for (var j = 0; j < P[i].models.length; j++) {
        if (P[i].models[j].id === mv) { found = true; break; }
      }
      break;
    }
  }
  var data = {
    clientType: CC,
    mainModel: {
      providerName: document.getElementById('mp').value,
      apiKey: document.getElementById('mk').value,
      baseUrl: document.getElementById('mu').value,
      modelName: document.getElementById('mm').value
    },
    visionModel: {
      providerName: document.getElementById('vp').value,
      apiKey: document.getElementById('vk').value,
      baseUrl: document.getElementById('vu').value,
      modelName: document.getElementById('vm').value
    },
    localSearchEnabled: found ? document.getElementById('ls').checked : false
  };
  try {
    msg.textContent = 'Saving...';
    msg.style.color = '#e0af68';
    var res = await fetch('/dashboard/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    var r = await res.json();
    if (!r.ok) {
      msg.textContent = 'Error: ' + (r.error || 'save failed');
      msg.style.color = '#f7768e';
      return;
    }
    msg.textContent = 'Restarting...';
    msg.style.color = '#e0af68';
    await fetch('/dashboard/api/restart', { method: 'POST' });
    msg.textContent = 'Saved! Restarting...';
    msg.style.color = '#73daca';
  } catch (e) {
    msg.textContent = 'Network error';
    msg.style.color = '#f7768e';
  }
}
</script>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

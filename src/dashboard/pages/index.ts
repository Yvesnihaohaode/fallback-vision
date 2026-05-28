import type { ServerResponse } from "node:http";
import type { GatewayConfig } from "../../config/loader.js";
import { loadSettings, detectModelCapabilities } from "../../config/settings.js";

export function sendIndex(cfg: GatewayConfig, res: ServerResponse): void {
  const settings = loadSettings();
  const mainCap = detectModelCapabilities(settings.mainModel.modelName);
  const visionCap = detectModelCapabilities(settings.visionModel.modelName);
  const isCodex = settings.clientType === "codex";
  const isMiMo = settings.mainModel.providerName.toLowerCase().includes("mimo");
  const localSearch = settings.localSearchEnabled;
  const proxyUrl = isCodex
    ? `http://127.0.0.1:${cfg.port}/v1/chat/completions`
    : `http://127.0.0.1:${cfg.port}/v1/messages`;

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fallback Vision</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e1e4e8;min-height:100vh}
.hdr{background:linear-gradient(135deg,#1a1b26,#16161e);padding:24px 32px;border-bottom:1px solid #2d2f3d}
.hdr h1{font-size:24px;color:#c0caf5}.hdr p{color:#565f89;margin-top:4px;font-size:14px}
.hdr .ver{color:#7aa2f7;font-size:12px;margin-top:8px}
.ctr{max-width:1200px;margin:0 auto;padding:32px}
.tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid #2d2f3d}
.tab{padding:12px 24px;cursor:pointer;color:#565f89;font-size:14px;border-bottom:2px solid transparent;transition:all .2s}
.tab:hover{color:#a9b1d6}.tab.active{color:#7aa2f7;border-bottom-color:#7aa2f7}
.page{display:none}.page.active{display:block}
.card{background:#1a1b26;border:1px solid #2d2f3d;border-radius:12px;padding:24px;margin-bottom:16px}
.st{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500}
.st.on{background:#1a3a2a;color:#73daca}.st.off{background:#3a1a1a;color:#f7768e}
.slot-card{background:#1a1b26;border:1px solid #2d2f3d;border-radius:12px;padding:28px;margin-bottom:20px}
.slot-label{display:inline-block;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:16px}
.slot-label.main{background:#1a2a4a;color:#7aa2f7}
.slot-label.vision{background:#2a1a4a;color:#bb9af7}
.slot-title{font-size:20px;font-weight:600;color:#c0caf5;margin-bottom:4px}
.slot-subtitle{color:#565f89;font-size:13px;margin-bottom:20px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-label{color:#565f89;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.input{background:#16161e;border:1px solid #2d2f3d;border-radius:8px;padding:10px 14px;color:#c0caf5;font-size:14px;width:100%;transition:border-color .2s}
.input:focus{outline:none;border-color:#7aa2f7}
.input.mono{font-family:'SF Mono',Monaco,Consolas,monospace}
.input-url{font-size:12px;color:#565f89}
.cap-box{display:flex;gap:10px;align-items:center;margin-top:16px;padding:12px 16px;background:#16161e;border-radius:8px}
.cap-icon{font-size:20px}.cap-info{flex:1}.cap-name{font-size:14px;font-weight:500;color:#c0caf5}
.cap-desc{font-size:12px;color:#565f89;margin-top:2px}
.cap-badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600}
.badge.v{background:#1a3a4a;color:#7dcfff}.badge.r{background:#2a1a3a;color:#bb9af7}
.badge.yes{background:#1a3a2a;color:#73daca}.badge.no{background:#3a1a1a;color:#f7768e}
.badge.y{background:#2d2f3d;color:#a9b1d6}.badge.n{background:#2d2f3d;color:#565f89}
.btn{padding:10px 24px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:500;transition:all .2s}
.btn-primary{background:#7aa2f7;color:#1a1b26}.btn-primary:hover{background:#89b4fa}
.client-toggle{display:flex;gap:0;background:#16161e;border:1px solid #2d2f3d;border-radius:10px;padding:4px;margin-bottom:20px;width:fit-content}
.client-btn{padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:#565f89;transition:all .2s;border:none;background:transparent;display:flex;align-items:center;gap:8px}
.client-btn.active{background:#7aa2f7;color:#1a1b26}
.client-btn:hover:not(.active){color:#a9b1d6}
.client-icon{font-size:16px}
.flow{display:flex;align-items:center;justify-content:center;gap:16px;padding:24px 0;flex-wrap:wrap}
.flow-box{padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;text-align:center;min-width:120px}
.flow-box.client{background:#1a2a4a;color:#7aa2f7;border:1px solid #2a3a5a}
.flow-box.gw{background:#2a2a1a;color:#e0af68;border:1px solid #3a3a2a}
.flow-box.model{background:#1a3a2a;color:#73daca;border:1px solid #2a4a3a}
.flow-box.fallback{background:#2a1a3a;color:#bb9af7;border:1px solid #3a2a4a}
.flow-arrow{color:#565f89;font-size:20px}
.status-bar{display:flex;gap:16px;margin-bottom:24px;padding:16px 20px;background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px;flex-wrap:wrap}
.status-item{display:flex;align-items:center;gap:8px;font-size:13px}
.status-dot{width:8px;height:8px;border-radius:50%}
.status-dot.on{background:#73daca}.status-dot.off{background:#f7768e}
.proxy-box{background:#16161e;border:1px solid #2d2f3d;border-radius:8px;padding:12px 16px;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:13px;color:#e0af68;margin:12px 0;word-break:break-all}
.ft{text-align:center;padding:32px;color:#565f89;font-size:12px}
/* Toggle switch */
.toggle-row{display:flex;align-items:center;gap:12px;padding:16px 20px;background:#16161e;border:1px solid #2d2f3d;border-radius:10px;margin-top:16px}
.toggle{position:relative;width:44px;height:24px;cursor:pointer}
.toggle input{opacity:0;width:0;height:0}
.toggle .slider{position:absolute;inset:0;background:#2d2f3d;border-radius:12px;transition:.3s}
.toggle .slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;bottom:3px;background:#565f89;border-radius:50%;transition:.3s}
.toggle input:checked+.slider{background:#7aa2f7}
.toggle input:checked+.slider:before{transform:translateX(20px);background:#1a1b26}
.toggle-label{font-size:14px;color:#c0caf5;font-weight:500}
.toggle-desc{font-size:12px;color:#565f89;margin-top:2px}
</style>
</head>
<body>
<div class="hdr">
  <h1>⚡ Fallback Vision</h1>
  <p>设置主模型和视觉模型，图片自动回退到视觉模型</p>
  <div class="ver">v${cfg.version}</div>
</div>
<div class="ctr">
  <div class="tabs">
    <div class="tab active" data-page="overview">Overview</div>
    <div class="tab" data-page="settings">Models</div>
  </div>

  <!-- OVERVIEW -->
  <div id="page-overview" class="page active">
    <div style="margin-bottom:20px">
      <div style="color:#565f89;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Client</div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">${isCodex ? '🔧' : '🤖'}</span>
        <span style="font-size:16px;font-weight:600;color:#c0caf5">${isCodex ? 'Codex' : 'Claude Code'}</span>
        <span class="st" style="${isCodex ? 'background:#1a3a2a;color:#73daca' : 'background:#2a1a4a;color:#bb9af7'}">${isCodex ? 'OpenAI Protocol' : 'Anthropic Protocol'}</span>
      </div>
      <div style="margin-top:12px;color:#565f89;font-size:13px">Proxy URL:</div>
      <div class="proxy-box">${proxyUrl}</div>
    </div>

    ${isMiMo && localSearch ? '<div style="margin-bottom:16px;padding:12px 16px;background:#1a2a1a;border:1px solid #2a4a2a;border-radius:8px;font-size:13px;color:#73daca">🔍 本地优化搜索已开启 — web_search/web_fetch 由 Fallback Vision 本地处理</div>' : ''}

    <div class="status-bar">
      <div class="status-item"><div class="status-dot ${settings.mainModel.apiKey ? 'on' : 'off'}"></div>Main: ${settings.mainModel.providerName} / ${settings.mainModel.modelName}</div>
      <div class="status-item"><div class="status-dot ${settings.visionModel.apiKey ? 'on' : 'off'}"></div>Vision: ${settings.visionModel.providerName} / ${settings.visionModel.modelName}</div>
    </div>

    <h2 style="color:#c0caf5;font-size:18px;font-weight:600;margin-bottom:16px">How It Works</h2>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="flow">
        <div class="flow-box client">📱 ${isCodex ? 'Codex' : 'Claude Code'}</div>
        <div class="flow-arrow">→</div>
        <div class="flow-box gw">⚡ Fallback Vision</div>
        <div class="flow-arrow">→</div>
        <div class="flow-box model">🤖 主模型<br><span style="font-size:11px;opacity:.7">处理所有文字任务</span></div>
      </div>
      <div style="text-align:center;color:#565f89;font-size:12px;padding:0 0 8px">遇到图片时 ↓</div>
      <div class="flow">
        <div class="flow-box client">🖼️ 图片/文档/视频</div>
        <div class="flow-arrow">→</div>
        <div class="flow-box gw">⚡ Fallback Vision<br><span style="font-size:10px;opacity:.7">Step 1 → Step 2</span></div>
        <div class="flow-arrow">→</div>
        <div class="flow-box fallback">👁️ 视觉模型<br><span style="font-size:11px;opacity:.7">分析图片</span></div>
        <div class="flow-arrow">→</div>
        <div class="flow-box model">🤖 主模型<br><span style="font-size:11px;opacity:.7">基于描述推理</span></div>
      </div>
    </div>

    <h2 style="color:#c0caf5;font-size:18px;font-weight:600;margin:24px 0 16px">Model Details</h2>
    ${renderModelCard("MAIN MODEL", "main", settings.mainModel, mainCap)}
    ${renderModelCard("VISION MODEL", "vision", settings.visionModel, visionCap)}
  </div>

  <!-- SETTINGS -->
  <div id="page-settings" class="page">
    <h2 style="color:#c0caf5;font-size:18px;font-weight:600;margin-bottom:8px">Configure Models</h2>
    <p style="color:#565f89;font-size:14px;margin-bottom:24px">选择客户端类型，输入 Provider 名称、API Key、模型名称。</p>

    <!-- Client type -->
    <div style="margin-bottom:24px">
      <div class="form-label" style="margin-bottom:8px">CLIENT TYPE</div>
      <div class="client-toggle">
        <div class="client-btn ${isCodex ? 'active' : ''}" onclick="setClient('codex')" id="btn-codex"><span class="client-icon">🔧</span> Codex</div>
        <div class="client-btn ${!isCodex ? 'active' : ''}" onclick="setClient('claude')" id="btn-claude"><span class="client-icon">🤖</span> Claude Code</div>
      </div>
      <div id="client-info" style="color:#565f89;font-size:13px;margin-top:8px">
        ${isCodex ? 'Codex 使用 OpenAI 协议。<code>/v1/chat/completions</code>' : 'Claude Code 使用 Anthropic Messages 协议。<code>/v1/messages</code>'}
      </div>
    </div>

    <!-- Main model -->
    ${renderModelSettings("MAIN MODEL — 主模型", "m", settings.mainModel, mainCap, "处理所有文字/代码任务，遇到图片时自动切换到视觉模型")}

    <!-- Local search toggle — only show when main model is MiMo -->
    <div id="local-search-section" style="display:${isMiMo ? 'block' : 'none'}">
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="local-search-toggle" ${localSearch ? 'checked' : ''} onchange="toggleLocalSearch()">
          <span class="slider"></span>
        </label>
        <div>
          <div class="toggle-label">🔍 打开本地优化搜索</div>
          <div class="toggle-desc">MiMo 不支持 Claude Code 的 web_search/web_fetch 工具。开启后由 Fallback Vision 本地处理搜索请求。</div>
        </div>
      </div>
    </div>

    <!-- Vision model -->
    ${renderModelSettings("VISION MODEL — 视觉模型", "v", settings.visionModel, visionCap, "只在需要识别图片/文档/视频时被调用")}

    <div style="margin-top:16px;display:flex;gap:12px;align-items:center">
      <button class="btn btn-primary" onclick="saveAndRestart()">🚀 保存并重启使用</button>
      <span id="save-msg" style="font-size:13px"></span>
    </div>
  </div>
</div>
<div class="ft">fallback-vision · Built with ❤️</div>

<script>
const KNOWN={"mimo-v2.5-pro":{v:false,r:true,d:"MiMo V2.5 Pro — 推理强，不支持图片"},"mimo-v2-pro":{v:false,r:true,d:"MiMo V2 Pro — 推理强，不支持图片"},"mimo-v2.5":{v:true,r:true,d:"MiMo V2.5 — 支持视觉 + 推理"},"mimo-v2-omni":{v:true,r:true,d:"MiMo V2 Omni — 支持视觉 + 音频 + 推理"},"mimo-v2-flash":{v:false,r:false,d:"MiMo V2 Flash — 轻量快速"},"deepseek-v4-pro":{v:false,r:true,d:"DeepSeek V4 Pro — 推理强，不支持图片"},"deepseek-v4-flash":{v:false,r:true,d:"DeepSeek V4 Flash — 快速推理"},"gpt-4o":{v:true,r:true,d:"GPT-4o — 多模态，支持图片 + 推理"},"gpt-4o-mini":{v:true,r:false,d:"GPT-4o Mini — 多模态，轻量"},"o1":{v:true,r:true,d:"OpenAI o1 — 推理模型，支持图片"},"o3":{v:true,r:true,d:"OpenAI o3 — 推理模型，支持图片"},"o4-mini":{v:true,r:true,d:"OpenAI o4-mini — 推理模型，支持图片"},"claude-sonnet-4-20250514":{v:true,r:true,d:"Claude Sonnet 4 — 多模态，强推理"},"claude-3-5-sonnet-20241022":{v:true,r:true,d:"Claude 3.5 Sonnet — 多模态，强推理"},"claude-3-5-haiku-20241022":{v:true,r:false,d:"Claude 3.5 Haiku — 多模态，快速"},"claude-3-opus-20240229":{v:true,r:true,d:"Claude 3 Opus — 多模态，最强推理"},"gemini-2.5-pro":{v:true,r:true,d:"Gemini 2.5 Pro — 多模态，强推理"},"gemini-2.5-flash":{v:true,r:true,d:"Gemini 2.5 Flash — 多模态，快速"},"qwen-vl-max":{v:true,r:false,d:"通义千问 VL Max — 多模态"},"qwen-max":{v:false,r:true,d:"通义千问 Max — 推理"}};
let currentClient='${settings.clientType}';

function detect(n){const k=KNOWN[n];if(k)return{vision:k.v,reasoning:k.r,description:k.d,known:true};const l=n.toLowerCase();const v=l.includes("vision")||l.includes("vl")||l.includes("omni");const r=l.includes("reason")||l.includes("think")||l.includes("o1")||l.includes("o3");return{vision:v,reasoning:r,description:"未识别的模型",known:false}}
function capHTML(name){const c=detect(name);return '<div class="cap-icon">'+(c.vision?'👁️':'📝')+'</div><div class="cap-info"><div class="cap-name">'+c.description+'</div></div><div class="cap-badges"><span class="badge '+(c.vision?'yes':'no')+'">Vision '+(c.vision?'✓':'✗')+'</span><span class="badge '+(c.reasoning?'yes':'no')+'">Reasoning '+(c.reasoning?'✓':'✗')+'</span><span class="badge '+(c.known?'y':'n')+'">'+(c.known?'已知模型':'未知模型')+'</span></div>';}
function updateCap(slot){const name=document.getElementById(slot==='main'?'m-model':'v-model').value||'...';document.getElementById(slot==='main'?'m-cap':'v-cap').innerHTML=capHTML(name);}
function setClient(type){currentClient=type;document.getElementById('btn-codex').className='client-btn'+(type==='codex'?' active':'');document.getElementById('btn-claude').className='client-btn'+(type==='claude'?' active':'');document.getElementById('client-info').innerHTML=type==='codex'?'Codex 使用 OpenAI 协议。<code>/v1/chat/completions</code>':'Claude Code 使用 Anthropic Messages 协议。<code>/v1/messages</code>';}
function toggleLocalSearch(){const checked=document.getElementById('local-search-toggle').checked;document.getElementById('local-search-section').style.display=(document.getElementById('m-provider').value.toLowerCase().includes('mimo')||document.getElementById('m-model').value.toLowerCase().includes('mimo'))?'block':'none';}

// Show/hide local search based on provider name
document.getElementById('m-provider').addEventListener('input',function(){
  const isMiMo=this.value.toLowerCase().includes('mimo');
  document.getElementById('local-search-section').style.display=isMiMo?'block':'none';
});

document.querySelectorAll('.tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));tab.classList.add('active');document.getElementById('page-'+tab.dataset.page).classList.add('active');});});
document.querySelectorAll('input[type=password]').forEach(i=>{i.addEventListener('focus',()=>{i.type='text';});i.addEventListener('blur',()=>{if(!i.value)i.type='password';});});

async function saveAndRestart(){
  const isMiMo=document.getElementById('m-provider').value.toLowerCase().includes('mimo');
  const data={
    clientType:currentClient,
    mainModel:{providerName:document.getElementById('m-provider').value,apiKey:document.getElementById('m-key').value,baseUrl:document.getElementById('m-url').value,modelName:document.getElementById('m-model').value},
    visionModel:{providerName:document.getElementById('v-provider').value,apiKey:document.getElementById('v-key').value,baseUrl:document.getElementById('v-url').value,modelName:document.getElementById('v-model').value},
    localSearchEnabled:isMiMo?(document.getElementById('local-search-toggle').checked):false,
  };
  const msg=document.getElementById('save-msg');
  try{
    msg.textContent='💾 保存中...';msg.style.color='#e0af68';
    const res=await fetch('/dashboard/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const r=await res.json();
    if(!r.ok){msg.textContent='❌ '+(r.error||'保存失败');msg.style.color='#f7768e';return;}
    msg.textContent='🔄 正在重启...';msg.style.color='#e0af68';
    await fetch('/dashboard/api/restart',{method:'POST'});
    msg.textContent='✅ 已保存！服务正在重启，即将自动打开客户端...';msg.style.color='#73daca';
  }catch(e){msg.textContent='❌ 网络错误';msg.style.color='#f7768e';}
}
</script>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function renderModelCard(label: string, id: string, model: { providerName: string; modelName: string; apiKey: string }, cap: { vision: boolean; reasoning: boolean; description: string; known: boolean }): string {
  return `<div class="slot-card"><div class="slot-label ${id}">${label}</div><div class="slot-title">${model.providerName}</div><div class="slot-subtitle">${model.modelName}</div><div class="cap-box"><div class="cap-icon">${cap.vision ? '👁️' : '📝'}</div><div class="cap-info"><div class="cap-name">${cap.vision ? 'Multimodal' : 'Text Only'}</div><div class="cap-desc">${cap.description}</div></div><div class="cap-badges"><span class="badge ${cap.vision ? 'yes' : 'no'}">Vision ${cap.vision ? '✓' : '✗'}</span><span class="badge ${cap.reasoning ? 'yes' : 'no'}">Reasoning ${cap.reasoning ? '✓' : '✗'}</span><span class="badge ${cap.known ? 'y' : 'n'}">${cap.known ? '已知模型' : '未知模型'}</span></div></div></div>`;
}

function renderModelSettings(label: string, prefix: string, model: { providerName: string; apiKey: string; baseUrl: string; modelName: string }, cap: { vision: boolean; reasoning: boolean; description: string; known: boolean }, subtitle: string): string {
  return `<div class="slot-card"><div class="slot-label ${prefix === 'm' ? 'main' : 'vision'}">${label}</div><div class="slot-subtitle">${subtitle}</div><div class="form-grid"><div class="form-group"><label class="form-label">Provider 名称</label><input class="input" id="${prefix}-provider" placeholder="DeepSeek / OpenAI / MiMo / Claude ..." value="${model.providerName}"></div><div class="form-group"><label class="form-label">Base URL</label><input class="input input-url mono" id="${prefix}-url" placeholder="https://api.deepseek.com/v1" value="${model.baseUrl}"></div><div class="form-group"><label class="form-label">API Key</label><input class="input mono" id="${prefix}-key" type="password" placeholder="sk-..." value="${model.apiKey}"></div><div class="form-group"><label class="form-label">模型名称</label><input class="input mono" id="${prefix}-model" placeholder="deepseek-v4-pro / gpt-4o ..." value="${model.modelName}" oninput="updateCap('${prefix === 'm' ? 'main' : 'vision'}')"></div></div><div id="${prefix}-cap" class="cap-box" style="margin-top:16px"></div></div>`;
}

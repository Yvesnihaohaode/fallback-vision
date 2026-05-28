import type { ServerResponse } from "node:http";
import type { GatewayConfig } from "../../config/loader.js";
import { loadSettings, detectModelCapabilities, PROVIDERS, isMiMoModel, type ProviderInfo } from "../../config/settings.js";

const providersJSON = JSON.stringify(PROVIDERS);

export function sendIndex(cfg: GatewayConfig, res: ServerResponse): void {
  const settings = loadSettings();
  const mainCap = detectModelCapabilities(settings.mainModel.modelName);
  const visionCap = detectModelCapabilities(settings.visionModel.modelName);
  const isCodex = settings.clientType === "codex";
  const isMiMo = isMiMoModel(settings.mainModel.modelName);
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
.input,.select{background:#16161e;border:1px solid #2d2f3d;border-radius:8px;padding:10px 14px;color:#c0caf5;font-size:14px;width:100%;transition:border-color .2s}
.input:focus,.select:focus{outline:none;border-color:#7aa2f7}
.select{cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23565f89' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.select option{background:#16161e;color:#c0caf5}
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
.flow{display:flex;align-items:center;justify-content:center;gap:16px;padding:24px 0;flex-wrap:wrap}
.flow-box{padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;text-align:center;min-width:120px}
.flow-box.client{background:#1a2a4a;color:#7aa2f7;border:1px solid #2a3a5a}
.flow-box.gw{background:#2a2a1a;color:#e0af68;border:1px solid #3a3a2a}
.flow-box.model{background:#1a3a2a;color:#73daca;border:1px solid #2a4a3a}
.flow-box.fallback{background:#2a1a3a;color:#bb9af7;border:1px solid #3a2a4a}
.flow-arrow{color:#565f89;font-size:20px}
.status-bar{display:flex;gap:16px;margin-bottom:24px;padding:16px 20px;background:#1a1b26;border:1px solid #2d2f3d;border-radius:10px}
.status-item{display:flex;align-items:center;gap:8px;font-size:13px}
.model-pick{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;padding:8px;background:#16161e;border:1px solid #2d2f3d;border-radius:8px;margin-top:8px}
.model-group-title{font-size:11px;font-weight:600;color:#7aa2f7;text-transform:uppercase;letter-spacing:1px;padding:8px 8px 4px;position:sticky;top:0;background:#16161e;z-index:1}
.model-opt{padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:#a9b1d6;transition:all .15s;display:flex;justify-content:space-between;align-items:center}
.model-opt:hover{background:#1a2a4a;color:#c0caf5}
.model-opt.selected{background:#1a2a4a;color:#7aa2f7}
.model-opt .mname{font-weight:500}.model-opt .mtags{display:flex;gap:4px}
.model-opt .mtag{font-size:10px;padding:2px 6px;border-radius:4px;background:#2d2f3d;color:#565f89}
.model-opt .mtag.vis{background:#1a3a4a;color:#73daca}.model-opt .mtag.rea{background:#2a1a3a;color:#bb9af7}
.local-toggle{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#16161e;border-radius:8px;margin-top:12px}
.local-toggle label{font-size:13px;color:#a9b1d6;cursor:pointer}
.tip{color:#565f89;font-size:12px;margin-top:4px}
#save-msg{margin-top:12px;font-size:13px;min-height:20px}
@media(max-width:768px){.form-grid{grid-template-columns:1fr}.flow{flex-direction:column}}
</style>
</head>
<body>
<div class="hdr">
  <h1>⚡ Fallback Vision</h1>
  <p>AI Gateway — 视觉回退路由</p>
  <div class="ver">v0.1.7 · ${cfg.port} 端口</div>
</div>
<div class="ctr">
  <div class="tabs">
    <div class="tab active" data-page="overview">概览</div>
    <div class="tab" data-page="settings">设置</div>
  </div>

  <!-- Overview Page -->
  <div id="page-overview" class="page active">
    <div class="status-bar">
      <div class="status-item">状态 <span class="st on">运行中</span></div>
      <div class="status-item">客户端 <strong>${isCodex ? "Codex" : "Claude Code"}</strong></div>
      <div class="status-item">协议 <strong>${isCodex ? "OpenAI" : "Anthropic"}</strong></div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:16px;color:#c0caf5">🔄 数据流</h3>
      <div class="flow">
        <div class="flow-box client">${isCodex ? "Codex" : "Claude Code"}</div>
        <div class="flow-arrow">→</div>
        <div class="flow-box gw">Fallback Vision</div>
        <div class="flow-arrow">→</div>
        <div class="flow-box model">主模型<br><small>${settings.mainModel.modelName || "未配置"}</small></div>
        <div class="flow-arrow">←</div>
        <div class="flow-box fallback">视觉模型<br><small>${settings.visionModel.modelName || "未配置"}</small></div>
      </div>
    </div>

    ${renderModelCard("主模型 — MAIN MODEL", "main", settings.mainModel, mainCap)}
    ${renderModelCard("视觉模型 — VISION MODEL", "vision", settings.visionModel, visionCap)}

    <div class="card">
      <h3 style="margin-bottom:12px;color:#c0caf5">📌 使用方式</h3>
      <p style="color:#a9b1d6;font-size:13px;line-height:1.8">
        ${isCodex
          ? `Codex 配置 <code style="background:#2d2f3d;padding:2px 6px;border-radius:4px;font-size:12px">base_url = "${proxyUrl}"</code>`
          : `运行 <code style="background:#2d2f3d;padding:2px 6px;border-radius:4px;font-size:12px">ANTHROPIC_BASE_URL=${proxyUrl.replace("/v1/messages", "")} claude</code>`}
      </p>
    </div>
  </div>

  <!-- Settings Page -->
  <div id="page-settings" class="page">
    <div class="card">
      <h3 style="margin-bottom:16px;color:#c0caf5">客户端类型</h3>
      <div class="client-toggle">
        <button class="client-btn ${isCodex ? 'active' : ''}" onclick="setClient('codex')" id="btn-codex"><span class="client-icon">🔧</span>Codex (OpenAI)</button>
        <button class="client-btn ${!isCodex ? 'active' : ''}" onclick="setClient('claude')" id="btn-claude"><span class="client-icon">💬</span>Claude Code (Anthropic)</button>
      </div>
      <p class="tip">Codex 使用 OpenAI 协议 <code>/v1/chat/completions</code>。Claude Code 使用 Anthropic Messages 协议 <code>/v1/messages</code>。</p>
    </div>

    ${renderModelSettings("主模型 — MAIN MODEL", "m", settings.mainModel, mainCap, "处理所有文字/代码任务，遇到图片时自动切换到视觉模型")}
    ${renderModelSettings("视觉模型 — VISION MODEL", "v", settings.visionModel, visionCap, "只在需要识别图片/文档/视频时被调用")}

    <div id="local-search-section" style="display:${isMiMo ? 'block' : 'none'}">
      <div class="card">
        <h3 style="margin-bottom:8px;color:#c0caf5">🔍 本地优化搜索（MiMo 专属）</h3>
        <p class="tip" style="margin-bottom:12px">MiMo 不支持 Claude Code 的 web_search / web_fetch。开启后由 Fallback Vision 本地处理搜索请求。</p>
        <div class="local-toggle">
          <input type="checkbox" id="local-search-toggle" ${localSearch ? 'checked' : ''} onchange="toggleLocalSearch()">
          <label for="local-search-toggle">开启本地优化搜索</label>
        </div>
      </div>
    </div>

    <div style="margin-top:24px;display:flex;align-items:center;gap:16px">
      <button class="btn btn-primary" onclick="saveAndRestart()">💾 保存并重启使用</button>
      <div id="save-msg"></div>
    </div>
  </div>
</div>

<script>
const PROVIDERS = ${providersJSON};
let currentClient = '${settings.clientType}';
const currentMain = ${JSON.stringify(settings.mainModel)};
const currentVision = ${JSON.stringify(settings.visionModel)};

function setClient(c){
  currentClient=c;
  document.querySelectorAll('.client-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+c).classList.add('active');
}

function buildProviderSelect(prefix, currentProvider){
  let html = '<option value="">-- 选择厂商或手动输入 --</option>';
  for(const p of PROVIDERS){
    if(p.name==='其他') continue;
    const sel = currentProvider===p.name ? 'selected' : '';
    html += '<option value="'+p.name+'" data-url="'+p.baseUrl+'" '+sel+'>'+p.name+'</option>';
  }
  html += '<option value="__custom">手动输入...</option>';
  return html;
}

function buildModelPicker(prefix, currentModel, filterVision){
  let html = '';
  for(const p of PROVIDERS){
    const models = filterVision ? p.models.filter(m=>m.vision) : p.models;
    if(models.length===0) continue;
    html += '<div class="model-group-title">'+p.name+'</div>';
    for(const m of models){
      const sel = currentModel===m.id ? ' selected' : '';
      const tags = [];
      if(m.vision) tags.push('<span class="mtag vis">Vision ✓</span>');
      if(m.reasoning) tags.push('<span class="mtag rea">Reasoning ✓</span>');
      html += '<div class="model-opt'+sel+'" data-model="'+m.id+'" data-provider="'+p.name+'" data-url="'+p.baseUrl+'" onclick="pickModel(this,\''+prefix+'\')" title="'+m.description+'"><span class="mname">'+m.id+'</span><span class="mtags">'+tags.join('')+'</span></div>';
    }
  }
  html += '<div class="model-group-title">其他</div>';
  html += '<div class="model-opt" data-model="__custom" onclick="pickModel(this,\''+prefix+'\')"><span class="mname">手动输入模型名...</span></div>';
  return html;
}

function pickModel(el, prefix){
  el.parentElement.querySelectorAll('.model-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  const model = el.dataset.model;
  const provider = el.dataset.provider || '';
  const url = el.dataset.url || '';
  if(model==='__custom'){
    document.getElementById(prefix+'-model').value='';
    document.getElementById(prefix+'-model').focus();
  } else {
    document.getElementById(prefix+'-model').value=model;
    if(provider){
      document.getElementById(prefix+'-provider').value=provider;
      if(url) document.getElementById(prefix+'-url').value=url;
    }
  }
  updateCap(prefix==='m'?'main':'vision');
}

function onProviderChange(prefix){
  const sel = document.getElementById(prefix+'-provider');
  const opt = sel.options[sel.selectedIndex];
  const url = opt.dataset.url;
  if(url) document.getElementById(prefix+'-url').value=url;
}

function initPicker(prefix, current, filterVision){
  const picker = document.getElementById(prefix+'-pick');
  picker.innerHTML = buildModelPicker(prefix, current.modelName, filterVision);
}

initPicker('m', currentMain, false);
initPicker('v', currentVision, true);

function updateCap(which){
  const prefix = which==='main' ? 'm' : 'v';
  const model = document.getElementById(prefix+'-model').value;
  const provider = document.getElementById(prefix+'-provider').value;
  let cap;
  for(const p of PROVIDERS){
    for(const m of p.models){
      if(m.id===model){ cap={vision:m.vision,reasoning:m.reasoning,description:m.description,known:true}; break; }
    }
    if(cap) break;
  }
  if(!cap){
    const lower=(provider+' '+model).toLowerCase();
    const vision=lower.includes('vision')||lower.includes('vl')||lower.includes('omni')||lower.includes('gpt-4o')||lower.includes('claude')||lower.includes('gemini');
    const reasoning=lower.includes('reason')||lower.includes('think')||lower.includes('o1')||lower.includes('o3')||lower.includes('o4')||lower.includes('deepseek-reasoner');
    cap={vision,reasoning,description:model?'未识别模型 — 根据名称推测':'',known:false};
  }
  const el=document.getElementById(prefix+'-cap');
  el.innerHTML='<div class="cap-icon">'+(cap.vision?'👁️':'📝')+'</div><div class="cap-info"><div class="cap-name">'+(cap.vision?'多模态 Multimodal':'纯文本 Text Only')+'</div><div class="cap-desc">'+(cap.description||'输入模型名后自动识别能力')+'</div></div><div class="cap-badges"><span class="badge '+(cap.vision?'yes':'no')+'">Vision '+(cap.vision?'✓':'✗')+'</span><span class="badge '+(cap.reasoning?'yes':'no')+'">Reasoning '+(cap.reasoning?'✓':'✗')+'</span><span class="badge '+(cap.known?'y':'n')+'">'+(cap.known?'已知模型':'未知')+'</span></div>';
}

updateCap('main');updateCap('vision');

function toggleLocalSearch(){
  const checked=document.getElementById('local-search-toggle').checked;
}
function checkIfMiMo(){
  const modelVal=document.getElementById('m-model').value;
  const mimoProvider=PROVIDERS.find(p=>p.name==='MiMo');
  const isMimo=mimoProvider?mimoProvider.models.some(m=>m.id===modelVal):false;
  document.getElementById('local-search-section').style.display=isMimo?'block':'none';
}
document.getElementById('m-model')?.addEventListener('input', checkIfMiMo);
document.getElementById('m-provider')?.addEventListener('input', function(){
  setTimeout(checkIfMiMo, 100);
});

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('page-'+tab.dataset.page).classList.add('active');
  });
});
document.querySelectorAll('input[type=password]').forEach(i=>{
  i.addEventListener('focus',()=>{i.type='text';});
  i.addEventListener('blur',()=>{if(!i.value)i.type='password';});
});

async function saveAndRestart(){
  const mimoP=PROVIDERS.find(p=>p.name==='MiMo');
  const isMiMo=mimoP?mimoP.models.some(m=>m.id===document.getElementById('m-model').value):false;
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
    msg.textContent='✅ 已保存！服务正在重启...';msg.style.color='#73daca';
  }catch(e){msg.textContent='❌ 网络错误';msg.style.color='#f7768e';}
}
</script>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function renderModelCard(label: string, id: string, model: { providerName: string; modelName: string; apiKey: string }, cap: { vision: boolean; reasoning: boolean; description: string; known: boolean }): string {
  const displayName = model.modelName || "未配置";
  const providerName = model.providerName || "未配置";
  return '<div class="slot-card"><div class="slot-label ' + id + '">' + label + '</div><div class="slot-title">' + providerName + '</div><div class="slot-subtitle">' + displayName + '</div><div class="cap-box"><div class="cap-icon">' + (cap.vision ? '👁️' : '📝') + '</div><div class="cap-info"><div class="cap-name">' + (cap.vision ? 'Multimodal' : 'Text Only') + '</div><div class="cap-desc">' + cap.description + '</div></div><div class="cap-badges"><span class="badge ' + (cap.vision ? 'yes' : 'no') + '">Vision ' + (cap.vision ? '✓' : '✗') + '</span><span class="badge ' + (cap.reasoning ? 'yes' : 'no') + '">Reasoning ' + (cap.reasoning ? '✓' : '✗') + '</span><span class="badge ' + (cap.known ? 'y' : 'n') + '">' + (cap.known ? '已知模型' : '未知模型') + '</span></div></div></div>';
}

function renderModelSettings(label: string, prefix: string, model: { providerName: string; apiKey: string; baseUrl: string; modelName: string }, cap: { vision: boolean; reasoning: boolean; description: string; known: boolean }, subtitle: string): string {
  return '<div class="slot-card"><div class="slot-label ' + (prefix === 'm' ? 'main' : 'vision') + '">' + label + '</div><div class="slot-subtitle">' + subtitle + '</div><div class="form-grid"><div class="form-group"><label class="form-label">Provider 名称</label><input class="input" id="' + prefix + '-provider" placeholder="选择厂商或手动输入" value="' + model.providerName + '" oninput="onProviderChange(\'' + prefix + '\')"></div><div class="form-group"><label class="form-label">Base URL</label><input class="input" id="' + prefix + '-url" placeholder="填入厂商 API 地址" value="' + model.baseUrl + '"></div><div class="form-group"><label class="form-label">API Key</label><input class="input" id="' + prefix + '-key" type="password" placeholder="sk-..." value="' + model.apiKey + '"></div><div class="form-group"><label class="form-label">模型名称</label><input class="input" id="' + prefix + '-model" placeholder="输入或从下方选择" value="' + model.modelName + '" oninput="updateCap(\'' + (prefix === 'm' ? 'main' : 'vision') + '\')"></div></div><div class="model-pick" id="' + prefix + '-pick"></div><div class="tip" style="margin-top:8px">💡 点击模型自动填充，也可手动输入模型名。Vision ✓ = 支持图片，Reasoning ✓ = 支持深度推理。</div><div id="' + prefix + '-cap" class="cap-box" style="margin-top:12px"></div></div>';
}

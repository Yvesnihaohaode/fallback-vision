import type { ServerResponse } from "node:http";
import type { GatewayConfig } from "../../config/loader.js";
import { loadSettings, detectModelCapabilities, PROVIDERS, isMiMoModel } from "../../config/settings.js";

export function sendIndex(cfg: GatewayConfig, res: ServerResponse): void {
  const settings = loadSettings();
  const isCodex = settings.clientType === "codex";
  const isMiMo = isMiMoModel(settings.mainModel.modelName);
  const providerData = JSON.stringify(PROVIDERS);
  const clientType = settings.clientType;

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fallback Vision v${cfg.version}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" onerror="this.src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#050508;--surface:rgba(255,255,255,.04);--surface-solid:rgba(20,20,28,.85);
  --text:#f0f0f5;--text-secondary:#a1a1aa;--text-muted:#52525b;
  --accent:#818cf8;--accent-rgb:129,140,248;--accent-glow:rgba(129,140,248,.2);
  --green:#34d399;--green-glow:rgba(52,211,153,.15);
  --yellow:#fbbf24;--red:#f87171;--purple:#a78bfa;
  --radius:22px;--radius-sm:16px;
  --glass-blur:blur(24px) saturate(180%) brightness(1.08);
  --glass-bg:rgba(255,255,255,.04);
  --glass-border-t:1px solid rgba(255,255,255,.14);
  --glass-border-l:1px solid rgba(255,255,255,.09);
  --glass-border-b:1px solid rgba(255,255,255,.03);
  --glass-border-r:1px solid rgba(255,255,255,.03);
  --glass-inset:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.12);
  --glass-reflect:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 40%,rgba(255,255,255,.02) 100%);
  --shadow-sm:0 2px 8px rgba(0,0,0,.2);--shadow-md:0 4px 24px rgba(0,0,0,.3);--shadow-lg:0 8px 40px rgba(0,0,0,.4);
  --spring:cubic-bezier(.34,1.56,.64,1);--spring-smooth:cubic-bezier(.25,.46,.45,.94);
  --hdr-bg:rgba(5,5,8,.7);
}
[data-theme="light"]{
  --bg:#e8e8f0;--surface:rgba(255,255,255,.45);--surface-solid:rgba(255,255,255,.7);
  --text:#1a1a2e;--text-secondary:#52525b;--text-muted:#a1a1aa;
  --accent:#6366f1;--accent-rgb:99,102,241;--accent-glow:rgba(99,102,241,.15);
  --green:#10b981;--green-glow:rgba(16,185,129,.1);
  --yellow:#f59e0b;--red:#ef4444;--purple:#8b5cf6;
  --glass-blur:blur(24px) saturate(200%) brightness(1.05);
  --glass-bg:rgba(255,255,255,.5);
  --glass-border-t:1px solid rgba(255,255,255,.8);
  --glass-border-l:1px solid rgba(255,255,255,.6);
  --glass-border-b:1px solid rgba(0,0,0,.04);
  --glass-border-r:1px solid rgba(0,0,0,.04);
  --glass-inset:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -1px 0 rgba(0,0,0,.04);
  --glass-reflect:linear-gradient(135deg,rgba(255,255,255,.65) 0%,transparent 50%,rgba(255,255,255,.25) 100%);
  --shadow-sm:0 2px 8px rgba(0,0,0,.06);--shadow-md:0 4px 24px rgba(0,0,0,.08);--shadow-lg:0 8px 40px rgba(0,0,0,.1);
  --hdr-bg:rgba(232,232,240,.75);
}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;overflow-x:hidden;transition:background .6s var(--spring-smooth),color .3s}
canvas#bg-canvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:.3;transition:opacity .5s}

/* ── Liquid glass base ── */
.glass{position:relative;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);box-shadow:var(--shadow-sm),var(--glass-inset)}
.glass::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none;z-index:0}
[data-theme="light"] .glass::before{background:linear-gradient(135deg,rgba(255,255,255,.65) 0%,transparent 50%,rgba(255,255,255,.25) 100%)}

/* ── Header ── */
.hdr{position:relative;z-index:1;background:var(--hdr-bg);backdrop-filter:blur(32px) saturate(200%);-webkit-backdrop-filter:blur(32px) saturate(200%);border-bottom:1px solid rgba(255,255,255,.06);padding:18px 32px;display:flex;justify-content:space-between;align-items:center}
[data-theme="light"] .hdr{border-bottom-color:rgba(0,0,0,.06)}
.hdr::before{content:'';position:absolute;inset:0;background:var(--glass-reflect);pointer-events:none}
.hdr h1{font-size:20px;font-weight:700;background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hdr .sub{color:var(--text-muted);font-size:12px;margin-top:2px}
.hdr-right{display:flex;align-items:center;gap:8px}
.lang-btn,.theme-btn{width:34px;height:34px;border-radius:50%;font-size:15px;font-weight:600;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--text-muted);cursor:pointer;transition:all .35s var(--spring);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center}
[data-theme="light"] .lang-btn,[data-theme="light"] .theme-btn{border-color:rgba(0,0,0,.08);background:rgba(255,255,255,.4)}
.lang-btn:hover,.theme-btn:hover{border-color:var(--accent);color:var(--accent);box-shadow:0 0 16px var(--accent-glow);transform:scale(1.08)}
.lang-btn:active,.theme-btn:active{transform:scale(.92)}
.ver{color:var(--text-muted);font-size:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);padding:5px 12px;border-radius:50px;backdrop-filter:blur(8px)}
[data-theme="light"] .ver{background:rgba(255,255,255,.4);border-color:rgba(0,0,0,.06)}

/* ── Layout ── */
.wrap{position:relative;z-index:1;max-width:960px;margin:0 auto;padding:24px 24px 60px}
.tabs{display:flex;gap:4px;margin-bottom:24px;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);border-radius:var(--radius);padding:4px;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);box-shadow:var(--shadow-sm),var(--glass-inset)}
.tabs::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none}
.tabs>*{position:relative;z-index:1}
.tab{flex:1;padding:10px 16px;text-align:center;cursor:pointer;color:var(--text-muted);font-size:13px;font-weight:500;border-radius:var(--radius-sm);user-select:none;transition:all .4s var(--spring)}
.tab:hover{color:var(--text-secondary);background:rgba(var(--accent-rgb),.05)}
.tab.on{background:var(--accent);color:#fff;box-shadow:0 2px 16px var(--accent-glow),0 0 0 1px rgba(var(--accent-rgb),.3)}
.page{display:none}.page.on{display:block}

/* ── Cards ── */
.card{position:relative;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);border-radius:var(--radius);padding:22px;margin-bottom:16px;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);transition:transform .4s var(--spring),box-shadow .4s var(--spring);box-shadow:var(--shadow-sm),var(--glass-inset);overflow:hidden;animation:fadeUp .5s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.card::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none;z-index:0}
.card>*{position:relative;z-index:1}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg),var(--glass-inset)}
.card h3{font-size:15px;font-weight:600;margin-bottom:14px}

/* ── Status bar ── */
.sb{position:relative;display:flex;gap:16px;padding:14px 18px;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);border-radius:var(--radius);margin-bottom:16px;font-size:13px;flex-wrap:wrap;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);align-items:center;box-shadow:var(--shadow-sm),var(--glass-inset);overflow:hidden;animation:fadeUp .5s ease both}
.sb::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none}
.sb>*{position:relative;z-index:1}
.sb strong{color:var(--text);font-weight:600}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;margin-right:6px;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 var(--green-glow)}50%{box-shadow:0 0 0 6px transparent}}

/* ── Data flow ── */
.flow{display:flex;align-items:center;justify-content:center;gap:12px;padding:24px 0;flex-wrap:wrap}
.flow-node{padding:12px 20px;border-radius:var(--radius-sm);font-size:13px;font-weight:600;text-align:center;border:1px solid;min-width:110px;position:relative;transition:all .35s var(--spring);backdrop-filter:blur(12px);animation:nodeIn .5s var(--spring) both}
@keyframes nodeIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
.flow-node:hover{transform:translateY(-2px) scale(1.03)}
.flow-node.client{background:rgba(var(--accent-rgb),.06);border-color:rgba(var(--accent-rgb),.2);color:var(--accent)}
.flow-node.fv{background:rgba(251,191,36,.06);border-color:rgba(251,191,36,.2);color:var(--yellow)}
.flow-node.main{background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.2);color:var(--green)}
.flow-node.vision{background:rgba(167,139,250,.06);border-color:rgba(167,139,250,.2);color:var(--purple)}
.flow-node small{display:block;font-weight:400;font-size:11px;color:var(--text-muted);margin-top:2px}
.flow-arrow{color:var(--text-muted);font-size:18px;animation:flowArrow 1.5s ease-in-out infinite}
@keyframes flowArrow{0%,100%{opacity:.4;transform:translateX(0)}50%{opacity:1;transform:translateX(4px)}}

/* ── Provider accordion ── */
.acc{margin-bottom:12px}
.acc-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);border-radius:var(--radius-sm);cursor:pointer;user-select:none;transition:all .35s var(--spring);backdrop-filter:blur(16px);position:relative;overflow:hidden}
.acc-header::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none}
.acc-header>*{position:relative;z-index:1}
.acc-header:hover{border-color:rgba(var(--accent-rgb),.2);background:rgba(var(--accent-rgb),.03)}
.acc-header.open{border-radius:var(--radius-sm) var(--radius-sm) 0 0;border-color:rgba(var(--accent-rgb),.2)}
.acc-icon{color:var(--text-muted);font-size:12px;transition:transform .35s var(--spring);flex-shrink:0;width:16px;text-align:center}
.acc-header.open .acc-icon{transform:rotate(90deg)}
.acc-name{font-weight:600;font-size:14px;color:var(--text);flex:1}
.acc-count{font-size:11px;color:var(--text-muted);background:rgba(var(--accent-rgb),.06);padding:2px 8px;border-radius:50px}
.acc-body{max-height:0;overflow:hidden;border-left:1px solid rgba(255,255,255,.04);border-right:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);transition:max-height .4s var(--spring-smooth),border-color .3s}
.acc-header.open+.acc-body{max-height:2000px;border-color:rgba(255,255,255,.06)}
[data-theme="light"] .acc-body{border-color:rgba(0,0,0,.04)}
.acc-model{display:flex;align-items:center;gap:8px;padding:9px 16px;font-size:13px;cursor:pointer;transition:all .25s var(--spring-smooth);border-bottom:1px solid rgba(var(--accent-rgb),.04)}
.acc-model:last-child{border-bottom:none}
.acc-model:hover{background:rgba(var(--accent-rgb),.04)}
.acc-model.main-sel{background:rgba(52,211,153,.06);border-left:3px solid var(--green);box-shadow:inset 3px 0 12px rgba(52,211,153,.06)}
.acc-model.vision-sel{background:rgba(167,139,250,.06);border-left:3px solid var(--purple);box-shadow:inset 3px 0 12px rgba(167,139,250,.06)}
.acc-model-name{flex:1;color:var(--text-secondary);font-weight:500}
.acc-model.main-sel .acc-model-name,.acc-model.vision-sel .acc-model-name{color:var(--text);font-weight:600}
.acc-model-desc{color:var(--text-muted);font-size:11px;flex:0 0 auto;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acc-model-tags{display:flex;gap:4px;flex-shrink:0}
.tag{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600}
.tag-v{background:rgba(52,211,153,.1);color:var(--green)}
.tag-r{background:rgba(167,139,250,.1);color:var(--purple)}
.acc-model-role{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600;flex-shrink:0}
.role-main{background:rgba(52,211,153,.1);color:var(--green)}
.role-vision{background:rgba(167,139,250,.1);color:var(--purple)}

/* ── Model picker in Settings ── */
.mpick .acc-model{cursor:pointer}
.mpick .acc-model:hover{background:rgba(var(--accent-rgb),.08)}
.mpick .acc-model.picked{background:rgba(var(--accent-rgb),.1);border-left:3px solid var(--accent);box-shadow:inset 3px 0 12px rgba(var(--accent-rgb),.08)}

/* ── Forms ── */
.fg{display:grid;grid-template-columns:1fr 1fr;gap:14px}
label{display:block;color:var(--text-muted);font-size:12px;margin-bottom:5px;font-weight:500}
input[type=text],input[type=password]{width:100%;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-size:13px;transition:all .35s var(--spring);backdrop-filter:blur(8px)}
[data-theme="light"] input[type=text],[data-theme="light"] input[type=password]{background:rgba(255,255,255,.5);border-color:rgba(0,0,0,.08)}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow),var(--shadow-sm)}
.btn{min-width:140px;padding:11px 28px;border-radius:50px;border:none;cursor:pointer;font-size:14px;font-weight:600;background:linear-gradient(135deg,var(--accent),#7c3aed);color:#fff;transition:all .35s var(--spring);position:relative;overflow:hidden;box-shadow:0 2px 12px var(--accent-glow);display:inline-flex;align-items:center;justify-content:center;gap:8px}
.btn:hover{box-shadow:0 4px 24px var(--accent-glow),0 0 0 1px rgba(var(--accent-rgb),.3);transform:translateY(-1px)}
.btn:active{transform:scale(.96) translateY(0);box-shadow:0 2px 8px var(--accent-glow)}
.btn:disabled{cursor:not-allowed;transform:none}
.btn .btn-progress{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.12);transition:width 1.2s cubic-bezier(.4,0,.2,1);z-index:0;border-radius:50px}
.btn .btn-content{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px}
.btn .btn-check{display:none;width:18px;height:18px}
.btn .btn-check svg{width:100%;height:100%}
.btn .btn-check path{stroke:#fff;stroke-width:3;fill:none;stroke-dasharray:24;stroke-dashoffset:24;animation:checkDraw .4s .3s ease forwards}
@keyframes checkDraw{to{stroke-dashoffset:0}}
.btn.saving .btn-progress{width:70%}
.btn.done{background:var(--green);box-shadow:0 2px 12px var(--green-glow)}
.btn.done .btn-progress{width:100%}
.btn.done .btn-check{display:inline-block}
#save-hint{display:none;color:var(--text-secondary);font-size:13px;animation:fadeUp .4s ease both}
#save-hint.show{display:inline-block}

/* ── Client toggle ── */
.ct{display:flex;gap:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:50px;padding:3px;width:fit-content;backdrop-filter:blur(12px)}
[data-theme="light"] .ct{background:rgba(255,255,255,.4);border-color:rgba(0,0,0,.06)}
.cb{padding:8px 20px;border-radius:50px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-muted);border:none;background:transparent;transition:all .35s var(--spring)}
.cb:hover{color:var(--text-secondary)}
.cb.on{background:var(--accent);color:#fff;box-shadow:0 2px 8px var(--accent-glow)}

/* ── Tags / badges ── */
.tip{color:var(--text-muted);font-size:11px;margin-top:6px}
.sc{display:flex;gap:10px;align-items:center;margin-top:12px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);font-size:13px;flex-wrap:wrap;backdrop-filter:blur(12px)}
#msg{margin-top:10px;font-size:13px;min-height:18px}
.info-box{padding:14px 18px;background:rgba(52,211,153,.04);border:1px solid rgba(52,211,153,.12);border-radius:var(--radius-sm);color:var(--green);font-size:13px;line-height:1.6}
.section-title{font-size:12px;font-weight:600;margin-bottom:12px;letter-spacing:.5px;text-transform:uppercase}
.section-title.blue{color:var(--accent)}
.section-title.purple{color:var(--purple)}

/* ── Logs ── */
.log-controls{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.log-filter{padding:6px 14px;border-radius:50px;font-size:12px;font-weight:500;border:1px solid rgba(255,255,255,.06);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .35s var(--spring)}
[data-theme="light"] .log-filter{border-color:rgba(0,0,0,.06)}
.log-filter.on{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 8px var(--accent-glow)}
.log-filter:hover:not(.on){border-color:var(--accent);color:var(--text)}
.log-box{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:var(--radius-sm);padding:12px;max-height:420px;overflow-y:auto;font-family:'JetBrains Mono','Fira Code',monospace;font-size:12px;line-height:1.7;backdrop-filter:blur(8px)}
[data-theme="light"] .log-box{background:rgba(255,255,255,.3);border-color:rgba(0,0,0,.04)}
.log-box::-webkit-scrollbar{width:4px}
.log-box::-webkit-scrollbar-track{background:transparent}
.log-box::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.log-line{display:flex;gap:10px;padding:2px 0}
.log-ts{color:var(--text-muted);white-space:nowrap;flex-shrink:0}
.log-level{font-weight:600;width:44px;flex-shrink:0;text-transform:uppercase;font-size:11px}
.log-level.info{color:var(--accent)}
.log-level.warn{color:var(--yellow)}
.log-level.error{color:var(--red)}
.log-level.debug{color:var(--text-muted)}
.log-msg{color:var(--text-secondary);word-break:break-all}

/* ── Stats ── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
.stat-card{position:relative;background:var(--glass-bg);border-top:var(--glass-border-t);border-left:var(--glass-border-l);border-bottom:var(--glass-border-b);border-right:var(--glass-border-r);border-radius:var(--radius-sm);padding:16px;text-align:center;backdrop-filter:var(--glass-blur);box-shadow:var(--shadow-sm),var(--glass-inset);overflow:hidden}
.stat-card::before{content:'';position:absolute;inset:0;border-radius:inherit;background:var(--glass-reflect);pointer-events:none}
.stat-card>*{position:relative;z-index:1}
.stat-val{font-size:28px;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stat-label{font-size:11px;color:var(--text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.req-list{max-height:320px;overflow-y:auto}
.req-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(var(--accent-rgb),.04);font-size:12px;transition:background .2s}
.req-item:last-child{border-bottom:none}
.req-item:hover{background:rgba(var(--accent-rgb),.03)}
.req-proto{padding:2px 8px;border-radius:6px;font-weight:600;font-size:11px;flex-shrink:0}
.req-proto.anthropic{background:rgba(var(--accent-rgb),.1);color:var(--accent)}
.req-proto.openai{background:rgba(52,211,153,.1);color:var(--green)}
.req-model{color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.req-latency{color:var(--text-muted);flex-shrink:0;width:60px;text-align:right}
.req-vision{color:var(--purple);font-weight:600;font-size:11px;flex-shrink:0}
.req-time{color:var(--text-muted);flex-shrink:0;font-size:11px}

/* ── Token stats ── */
.model-switcher{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.model-pill{padding:6px 16px;border-radius:50px;font-size:12px;font-weight:500;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);color:var(--text-muted);cursor:pointer;transition:all .35s var(--spring);backdrop-filter:blur(8px)}
[data-theme="light"] .model-pill{border-color:rgba(0,0,0,.06);background:rgba(255,255,255,.3)}
.model-pill:hover{border-color:rgba(var(--accent-rgb),.2);color:var(--text-secondary)}
.model-pill.on{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 12px var(--accent-glow)}
.token-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px}
.token-stat-card{position:relative;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:var(--radius-sm);padding:14px;text-align:center;overflow:hidden}
[data-theme="light"] .token-stat-card{background:rgba(255,255,255,.3);border-color:rgba(0,0,0,.04)}
.token-stat-val{font-size:22px;font-weight:700;color:var(--text)}
.token-stat-label{font-size:10px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.chart-container{margin-top:12px}
.chart-legend{display:flex;gap:16px;margin-bottom:10px;font-size:11px;color:var(--text-muted)}
.chart-legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle}
.chart-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px}
.chart-date{width:50px;color:var(--text-muted);flex-shrink:0;text-align:right}
.chart-bars{flex:1;display:flex;gap:2px;align-items:center;height:16px}
.chart-bar{height:14px;border-radius:3px;transition:width .5s var(--spring-smooth);min-width:2px}
.chart-bar.input{background:var(--accent);opacity:.7}
.chart-bar.output{background:var(--purple);opacity:.7}
.chart-bar:hover{opacity:1}
.chart-tokens{width:70px;color:var(--text-muted);text-align:right;flex-shrink:0;font-family:'JetBrains Mono','Fira Code',monospace;font-size:10px}
.no-data{text-align:center;padding:30px;color:var(--text-muted);font-size:13px}
</style>
</head>
<body>
<canvas id="bg-canvas"></canvas>

<div class="hdr">
  <div>
    <h1>Fallback Vision</h1>
    <div class="sub" data-i18n="subtitle">AI Gateway with Visual Fallback Routing</div>
  </div>
  <div class="hdr-right">
    <button class="theme-btn" id="theme-toggle" title="Toggle theme">☀</button>
    <button class="lang-btn" id="lang-toggle">EN</button>
    <div class="ver">v${cfg.version} · :${cfg.port}</div>
  </div>
</div>

<div class="wrap">
  <div class="tabs" id="tab-bar">
    <div class="tab on" data-page="overview" data-i18n="tab_overview">Overview</div>
    <div class="tab" data-page="logs" data-i18n="tab_logs">Logs</div>
    <div class="tab" data-page="stats" data-i18n="tab_stats">Stats</div>
    <div class="tab" data-page="settings" data-i18n="tab_settings">Settings</div>
  </div>

  <!-- ==================== OVERVIEW ==================== -->
  <div id="overview" class="page on">
    <div class="sb">
      <div><span class="dot"></span> <span data-i18n="running">Running</span></div>
      <div><span data-i18n="client">Client</span> <strong>${isCodex ? "Codex" : "Claude Code"}</strong></div>
      <div><span data-i18n="protocol">Protocol</span> <strong>${isCodex ? "OpenAI" : "Anthropic"}</strong></div>
      <div style="margin-left:auto;color:var(--text-muted);font-size:12px" id="uptime"></div>
    </div>

    <div class="card">
      <h3 data-i18n="data_flow">Data Flow</h3>
      <div class="flow">
        <div class="flow-node client">${isCodex ? "Codex" : "Claude Code"}<small>Client</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node fv">Fallback Vision<small>Gateway</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-node main">Main Model<small>${settings.mainModel.modelName || "not set"}</small></div>
        <div class="flow-arrow" style="animation-delay:.3s">←</div>
        <div class="flow-node vision">Vision Model<small>${settings.visionModel.modelName || "not set"}</small></div>
      </div>
    </div>

    <div class="card">
      <div class="section-title blue" data-i18n="model_directory">Model Directory</div>
      <div id="overview-accordions"></div>
    </div>

    ${isMiMo ? '<div class="info-box" data-i18n="mimo_search">Hybrid search enabled — web_search/web_fetch handled locally with Bing/Sogou/Brave/Google (4 engines parallel race, fastest wins)</div>' : ''}
  </div>

  <!-- ==================== LOGS ==================== -->
  <div id="logs" class="page">
    <div class="card">
      <h3 data-i18n="live_logs">Live Logs</h3>
      <div class="log-controls">
        <button class="log-filter on" data-level="all" data-i18n="log_all">All</button>
        <button class="log-filter" data-level="info">Info</button>
        <button class="log-filter" data-level="warn">Warn</button>
        <button class="log-filter" data-level="error">Error</button>
        <div style="flex:1"></div>
        <button class="log-filter" id="log-pause" data-i18n="pause">Pause</button>
      </div>
      <div class="log-box" id="log-box"></div>
    </div>
  </div>

  <!-- ==================== STATS ==================== -->
  <div id="stats" class="page">
    <div class="stat-grid" id="stat-grid"></div>
    <div class="card">
      <h3 data-i18n="recent_requests">Recent Requests</h3>
      <div class="req-list" id="req-list"></div>
    </div>

    <div class="card" id="token-card">
      <h3 data-i18n="token_consumption">Token Consumption</h3>
      <div class="model-switcher" id="model-switcher"></div>
      <div id="token-stats-area">
        <div class="token-stat-grid" id="token-stat-grid"></div>
        <div class="chart-container" id="chart-container"></div>
      </div>
      <div class="no-data" id="no-token-data" style="display:none" data-i18n="no_token_data">No token data yet</div>
    </div>
  </div>

  <!-- ==================== SETTINGS ==================== -->
  <div id="settings" class="page">
    <div class="card">
      <h3 data-i18n="client_type">Client Type</h3>
      <div class="ct" id="client-toggle">
        <button class="cb${isCodex ? ' on' : ''}" data-client="codex">Codex</button>
        <button class="cb${!isCodex ? ' on' : ''}" data-client="claude">Claude Code</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title blue" data-i18n="main_model">Main Model</div>
      <div class="fg">
        <div><label data-i18n="provider">Provider</label><input type="text" id="mp" value="${settings.mainModel.providerName}" placeholder="DeepSeek / OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="mu" value="${settings.mainModel.baseUrl}" placeholder="https://api.deepseek.com/v1"></div>
        <div><label>API Key</label><input type="password" id="mk" value="${settings.mainModel.apiKey}" placeholder="sk-..."></div>
        <div><label data-i18n="model_name">Model Name</label><input type="text" id="mm" value="${settings.mainModel.modelName}" placeholder="deepseek-chat / gpt-4o ..."></div>
      </div>
      <div class="mpick" id="mpick"></div>
      <div class="tip" data-i18n="pick_tip">Click model to auto-fill. Vision badge = supports images, Reasoning badge = deep thinking.</div>
      <div class="sc" id="mcap"></div>
    </div>

    <div class="card">
      <div class="section-title purple" data-i18n="vision_model">Vision Model</div>
      <div class="fg">
        <div><label data-i18n="provider">Provider</label><input type="text" id="vp" value="${settings.visionModel.providerName}" placeholder="OpenAI / MiMo ..."></div>
        <div><label>Base URL</label><input type="text" id="vu" value="${settings.visionModel.baseUrl}" placeholder="https://api.openai.com/v1"></div>
        <div><label>API Key</label><input type="password" id="vk" value="${settings.visionModel.apiKey}" placeholder="sk-..."></div>
        <div><label data-i18n="model_name">Model Name</label><input type="text" id="vm" value="${settings.visionModel.modelName}" placeholder="gpt-4o / mimo-v2.5 ..."></div>
      </div>
      <div class="mpick" id="vpick"></div>
      <div class="tip" data-i18n="vision_tip">Vision model must support images. Only vision-capable models shown.</div>
      <div class="sc" id="vcap"></div>
    </div>

    <div id="ls-section" style="display:${isMiMo ? 'block' : 'none'}">
      <div class="info-box" data-i18n="mimo_search">Hybrid search enabled — web_search/web_fetch handled locally with Bing/Sogou/Brave/Google (4 engines parallel race, fastest wins)</div>
    </div>

    <div style="margin-top:20px;display:flex;align-items:center;gap:14px">
      <button class="btn" id="btn-save">
        <div class="btn-progress"></div>
        <span class="btn-content">
          <span class="btn-check"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span>
          <span class="btn-label" data-i18n="save_restart">Save</span>
        </span>
      </button>
      <span id="save-hint"></span>
      <div id="msg"></div>
    </div>
  </div>
</div>

<script>
(function() {
  "use strict";

  // === i18n ===
  var LANG_KEY = "fv_lang";
  var lang = localStorage.getItem(LANG_KEY) || "en";
  var T = {
    en: {
      subtitle: "AI Gateway with Visual Fallback Routing",
      tab_overview: "Overview", tab_logs: "Logs", tab_stats: "Stats", tab_settings: "Settings",
      running: "Running", client: "Client", protocol: "Protocol",
      data_flow: "Data Flow", model_directory: "Model Directory",
      live_logs: "Live Logs", recent_requests: "Recent Requests",
      client_type: "Client Type", main_model: "Main Model", vision_model: "Vision Model",
      provider: "Provider", model_name: "Model Name",
      pick_tip: "Click model to auto-fill. Vision badge = supports images, Reasoning badge = deep thinking.",
      vision_tip: "Vision model must support images. Only vision-capable models shown.",
      save_restart: "Save", saving: "Saving...", saved: "Restarting...",
      save_hint_claude: "Open a new terminal and run <code>claude</code> to start Claude Code",
      save_hint_codex: "Codex will restart automatically...",
      no_reqs: "No requests yet", pause: "Pause", resume: "Resume",
      log_all: "All", mimo_search: "Hybrid search enabled — web_search/web_fetch handled locally with Bing/Sogou/Brave/Google (4 engines race, fastest wins)",
      vision: "Vision", reasoning: "Reasoning", no_vision: "No Vision", no_reasoning: "No Reasoning",
      main_model_tag: "MAIN", vision_model_tag: "VISION", custom: "Custom", custom_tip: "Custom model name...",
      err_rate: "Error Rate", avg_latency: "Avg Latency", total_requests: "Total Requests", vision_fallbacks: "Vision Fallbacks",
      token_consumption: "Token Consumption", total_input_tokens: "Input Tokens", total_output_tokens: "Output Tokens",
      api_requests: "API Requests", total_tokens: "Total Tokens", no_token_data: "No token data yet"
    },
    zh: {
      subtitle: "AI 网关 · 视觉回退路由",
      tab_overview: "概览", tab_logs: "日志", tab_stats: "统计", tab_settings: "设置",
      running: "运行中", client: "客户端", protocol: "协议",
      data_flow: "数据流", model_directory: "模型目录",
      live_logs: "实时日志", recent_requests: "最近请求",
      client_type: "客户端类型", main_model: "主模型", vision_model: "视觉模型",
      provider: "供应商", model_name: "模型名称",
      pick_tip: "点击模型自动填充。Vision = 支持图片，Reasoning = 深度推理。",
      vision_tip: "视觉模型必须支持图片（Vision ✓）。仅显示支持视觉的模型。",
      save_restart: "保存", saving: "保存中...", saved: "配置完成",
      save_hint_claude: "请打开新终端输入 <code>claude</code> 启动 Claude Code",
      save_hint_codex: "Codex 将自动重启...",
      no_reqs: "暂无请求", pause: "暂停", resume: "恢复",
      log_all: "全部", mimo_search: "已启用混合搜索 — web_search/web_fetch 由本地四引擎（Bing / Sogou / Brave / Google）并行竞赛，最快结果获胜",
      vision: "视觉", reasoning: "推理", no_vision: "无视觉", no_reasoning: "无推理",
      main_model_tag: "主模型", vision_model_tag: "视觉模型", custom: "自定义", custom_tip: "自定义模型名称...",
      err_rate: "错误率", avg_latency: "平均延迟", total_requests: "总请求数", vision_fallbacks: "视觉回退",
      token_consumption: "Token 用量", total_input_tokens: "输入 Token", total_output_tokens: "输出 Token",
      api_requests: "API 请求", total_tokens: "总 Token", no_token_data: "暂无 Token 数据"
    }
  };
  function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }

  function applyLang() {
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute("data-i18n");
      if (k) els[i].textContent = t(k);
    }
    document.getElementById("lang-toggle").textContent = lang === "en" ? "中文" : "EN";
    document.documentElement.lang = lang === "en" ? "en" : "zh";
    renderOverviewAccordions();
    renderSettingsPickers();
    if (tokenData) renderTokenStats();
  }

  document.getElementById("lang-toggle").addEventListener("click", function() {
    lang = lang === "en" ? "zh" : "en";
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  });

  // === Data ===
  var P = ${providerData};
  var CC = "${clientType}";
  var startedAt = Date.now();
  var curMain = "${settings.mainModel.modelName}";
  var curVision = "${settings.visionModel.modelName}";

  // === Theme toggle ===
  var THEME_KEY = "fv_theme";
  function getTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme:light)").matches ? "light" : "dark";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀" : "☾";
    localStorage.setItem(THEME_KEY, theme);
    particleTheme = theme;
  }
  var particleTheme = getTheme();
  applyTheme(particleTheme);
  document.getElementById("theme-toggle").addEventListener("click", function() {
    particleTheme = particleTheme === "dark" ? "light" : "dark";
    applyTheme(particleTheme);
  });

  // === Background particles — liquid light blobs ===
  (function initBg() {
    var c = document.getElementById("bg-canvas");
    if (!c) return;
    var ctx = c.getContext("2d");
    var w, h, particles = [];
    var PALETTE_DARK = [[129,140,248],[167,139,250],[99,102,241],[56,189,248]];
    var PALETTE_LIGHT = [[99,102,241],[139,92,246],[59,130,246],[14,165,233]];
    function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    for (var i = 0; i < 35; i++) {
      var rgb = PALETTE_DARK[Math.floor(Math.random() * PALETTE_DARK.length)];
      particles.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 40 + 15, dx: (Math.random() - 0.5) * 0.2, dy: (Math.random() - 0.5) * 0.2, o: Math.random() * 0.12 + 0.03, rgb: rgb });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      var pal = particleTheme === "light" ? PALETTE_LIGHT : PALETTE_DARK;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.dx; p.y += p.dy;
        if (p.x < -p.r) p.x = w + p.r; if (p.x > w + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = h + p.r; if (p.y > h + p.r) p.y = -p.r;
        var target = pal[i % pal.length];
        p.rgb[0] += (target[0] - p.rgb[0]) * 0.01;
        p.rgb[1] += (target[1] - p.rgb[1]) * 0.01;
        p.rgb[2] += (target[2] - p.rgb[2]) * 0.01;
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, "rgba(" + Math.round(p.rgb[0]) + "," + Math.round(p.rgb[1]) + "," + Math.round(p.rgb[2]) + "," + p.o + ")");
        grad.addColorStop(1, "rgba(" + Math.round(p.rgb[0]) + "," + Math.round(p.rgb[1]) + "," + Math.round(p.rgb[2]) + ",0)");
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            var alpha = 0.04 * (1 - dist / 200);
            var c1 = particles[i].rgb;
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = "rgba(" + Math.round(c1[0]) + "," + Math.round(c1[1]) + "," + Math.round(c1[2]) + "," + alpha + ")";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // === GSAP entry animations ===
  function animateIn() {
    if (typeof gsap === "undefined") return;
    gsap.from(".card, .sb", { y: 20, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out(1.4)" });
    gsap.from(".flow-node", { scale: 0.8, opacity: 0, duration: 0.5, stagger: 0.1, delay: 0.2, ease: "elastic.out(1, 0.6)" });
    gsap.from(".flow-arrow", { opacity: 0, x: -8, duration: 0.3, stagger: 0.08, delay: 0.5 });
  }
  animateIn();

  // === Uptime ===
  function updateUptime() {
    var el = document.getElementById("uptime");
    if (!el) return;
    var s = Math.floor((Date.now() - startedAt) / 1000);
    var m = Math.floor(s / 60); var h = Math.floor(m / 60);
    el.textContent = "up " + (h > 0 ? h + "h " : "") + (m % 60) + "m " + (s % 60) + "s";
  }
  setInterval(updateUptime, 1000);
  updateUptime();

  // === Escaping ===
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  // === Provider accordion builder ===
  function buildAccordions(containerId, opts) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var h = "";
    for (var i = 0; i < P.length; i++) {
      if (P[i].name === "Other") continue;
      var prov = P[i];
      var models = opts.visionOnly ? prov.models.filter(function(m) { return m.vision; }) : prov.models;
      if (models.length === 0) continue;
      var provId = "acc_" + containerId + "_" + i;
      h += '<div class="acc">';
      h += '<div class="acc-header" data-acc="' + provId + '">';
      h += '<span class="acc-icon">▶</span>';
      h += '<span class="acc-name">' + esc(prov.name) + '</span>';
      h += '<span class="acc-count">' + models.length + ' models</span>';
      h += '</div>';
      h += '<div class="acc-body" id="' + provId + '">';
      for (var j = 0; j < models.length; j++) {
        var m = models[j];
        var selClass = "";
        var roleTag = "";
        if (m.id === curMain) { selClass = " main-sel"; roleTag = '<span class="acc-model-role role-main">' + t("main_model_tag") + '</span>'; }
        else if (m.id === curVision) { selClass = " vision-sel"; roleTag = '<span class="acc-model-role role-vision">' + t("vision_model_tag") + '</span>'; }
        var tags = "";
        if (m.vision) tags += '<span class="tag tag-v">' + t("vision") + '</span>';
        if (m.reasoning) tags += '<span class="tag tag-r">' + t("reasoning") + '</span>';
        h += '<div class="acc-model' + selClass + '" data-model="' + esc(m.id) + '" data-provider="' + esc(prov.name) + '" data-url="' + esc(prov.baseUrl) + '"' + (opts.pickTarget ? ' data-target="' + esc(opts.pickTarget) + '"' : '') + '>';
        h += '<span class="acc-model-name">' + esc(m.id) + '</span>';
        if (m.description) h += '<span class="acc-model-desc">' + esc(m.description) + '</span>';
        h += '<span class="acc-model-tags">' + tags + '</span>';
        h += roleTag;
        h += '</div>';
      }
      if (opts.showCustom) {
        h += '<div class="acc-model" data-model="__custom" data-target="' + esc(opts.pickTarget) + '">';
        h += '<span class="acc-model-name" style="color:var(--text-muted);font-style:italic">' + t("custom_tip") + '</span>';
        h += '</div>';
      }
      h += '</div></div>';
    }
    el.innerHTML = h;
  }

  // === Accordion toggle ===
  document.addEventListener("click", function(e) {
    var hdr = e.target.closest(".acc-header");
    if (hdr) {
      hdr.classList.toggle("open");
      return;
    }
    var model = e.target.closest(".mpick .acc-model");
    if (model) {
      var target = model.getAttribute("data-target");
      var modelId = model.getAttribute("data-model");
      var provider = model.getAttribute("data-provider") || "";
      var url = model.getAttribute("data-url") || "";
      var siblings = model.parentElement.querySelectorAll(".acc-model");
      for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove("picked");
      model.classList.add("picked");
      if (modelId === "__custom") {
        document.getElementById(target + "m").value = "";
        document.getElementById(target + "m").focus();
      } else {
        document.getElementById(target + "m").value = modelId;
        if (provider) document.getElementById(target + "p").value = provider;
        if (url) document.getElementById(target + "u").value = url;
      }
      updateCap(target);
      checkMiMo();
      if (typeof gsap !== "undefined") gsap.from(model, { scale: 0.96, duration: 0.2, ease: "back.out(2)" });
    }
  });

  // === Overview accordions ===
  function renderOverviewAccordions() {
    buildAccordions("overview-accordions", { visionOnly: false, showCustom: false });
    var container = document.getElementById("overview-accordions");
    if (!container) return;
    var items = container.querySelectorAll(".acc-model");
    for (var i = 0; i < items.length; i++) {
      var mid = items[i].getAttribute("data-model");
      if (mid === curMain) items[i].classList.add("main-sel");
      else if (mid === curVision) items[i].classList.add("vision-sel");
    }
  }

  // === Settings pickers ===
  function renderSettingsPickers() {
    buildAccordions("mpick", { visionOnly: false, showCustom: true, pickTarget: "m" });
    buildAccordions("vpick", { visionOnly: true, showCustom: true, pickTarget: "v" });
    markPicked("mpick", "m");
    markPicked("vpick", "v");
  }

  function markPicked(pickerId, prefix) {
    var val = document.getElementById(prefix + "m").value;
    var picker = document.getElementById(pickerId);
    if (!picker || !val) return;
    var items = picker.querySelectorAll(".acc-model");
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute("data-model") === val) {
        items[i].classList.add("picked");
        var acc = items[i].closest(".acc");
        if (acc) {
          var hdr = acc.querySelector(".acc-header");
          if (hdr) hdr.classList.add("open");
        }
      }
    }
  }

  // === Tab switching ===
  var tabBar = document.getElementById("tab-bar");
  tabBar.addEventListener("click", function(e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    var pageId = tab.getAttribute("data-page");
    if (!pageId) return;
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) pages[i].className = "page";
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) tabs[i].className = "tab";
    document.getElementById(pageId).className = "page on";
    tab.className = "tab on";
    if (typeof gsap !== "undefined") {
      gsap.from("#" + pageId + " .card, #" + pageId + " .stat-grid, #" + pageId + " .stat-card", { y: 12, opacity: 0, duration: 0.4, stagger: 0.05, ease: "back.out(1.4)" });
    }
    if (pageId === "logs") fetchLogs();
    if (pageId === "stats") { fetchStats(); fetchTokenStats(); }
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
    if (!cap) cap = { vision: false, reasoning: false, description: modelId ? "Unknown model" : "" };
    var el = document.getElementById(prefix + "cap");
    if (!el) return;
    el.innerHTML = '<span class="tag ' + (cap.vision ? 'tag-v' : '') + '" style="' + (!cap.vision ? 'background:rgba(248,113,113,.1);color:var(--red)' : '') + '">' + (cap.vision ? t("vision") : t("no_vision")) + '</span>'
      + ' <span class="tag ' + (cap.reasoning ? 'tag-r' : '') + '" style="' + (!cap.reasoning ? 'background:rgba(248,113,113,.1);color:var(--red)' : '') + '">' + (cap.reasoning ? t("reasoning") : t("no_reasoning")) + '</span>'
      + (cap.description ? ' <span style="color:var(--text-muted);font-size:12px;margin-left:4px">' + esc(cap.description) + '</span>' : '');
  }

  // === MiMo check ===
  function checkMiMo() {
    var pv = document.getElementById("mp").value;
    var found = pv.toLowerCase().indexOf("mimo") >= 0;
    var section = document.getElementById("ls-section");
    if (section) section.style.display = found ? "block" : "none";
  }

  // === Input listeners ===
  document.getElementById("mm").addEventListener("input", function() { updateCap("m"); checkMiMo(); curMain = this.value; renderOverviewAccordions(); });
  document.getElementById("vm").addEventListener("input", function() { updateCap("v"); curVision = this.value; renderOverviewAccordions(); });
  document.getElementById("mp").addEventListener("input", function() { checkMiMo(); });
  document.getElementById("mp").addEventListener("change", function() { checkMiMo(); });

  // === Init ===
  renderOverviewAccordions();
  renderSettingsPickers();
  updateCap("m");
  updateCap("v");

  // === Logs ===
  var logPaused = false;
  var logFilter = "all";

  function fetchLogs() {
    fetch("/dashboard/api/logs").then(function(r) { return r.json(); }).then(function(logs) { renderLogs(logs); });
  }

  function renderLogs(logs) {
    var box = document.getElementById("log-box");
    if (!box) return;
    var wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
    var h = "";
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      if (logFilter !== "all" && l.level !== logFilter) continue;
      var ts = l.ts ? l.ts.slice(11, 19) : "";
      h += '<div class="log-line"><span class="log-ts">' + ts + '</span><span class="log-level ' + l.level + '">' + l.level + '</span><span class="log-msg">' + esc(l.msg) + '</span></div>';
    }
    box.innerHTML = h;
    if (wasAtBottom && !logPaused) box.scrollTop = box.scrollHeight;
  }

  document.querySelector(".log-controls").addEventListener("click", function(e) {
    var btn = e.target.closest(".log-filter");
    if (!btn) return;
    if (btn.id === "log-pause") {
      logPaused = !logPaused;
      btn.textContent = logPaused ? t("resume") : t("pause");
      btn.classList.toggle("on", logPaused);
      return;
    }
    var level = btn.getAttribute("data-level");
    if (!level) return;
    logFilter = level;
    var btns = document.querySelectorAll(".log-filter[data-level]");
    for (var i = 0; i < btns.length; i++) btns[i].className = "log-filter";
    btn.className = "log-filter on";
    fetchLogs();
  });

  setInterval(function() {
    var logsPage = document.getElementById("logs");
    if (logsPage && logsPage.classList.contains("on") && !logPaused) fetchLogs();
  }, 3000);
  fetchLogs();

  // === Stats ===
  function fetchStats() {
    fetch("/dashboard/api/metrics").then(function(r) { return r.json(); }).then(function(m) { renderStats(m); });
  }

  function renderStats(m) {
    var grid = document.getElementById("stat-grid");
    if (!grid) return;
    var errRate = m.totalRequests > 0 ? ((m.errors / m.totalRequests) * 100).toFixed(1) : "0";
    var avgLat = m.recent.length > 0 ? Math.round(m.recent.reduce(function(a, r) { return a + r.latencyMs; }, 0) / m.recent.length) : 0;
    grid.innerHTML =
      '<div class="stat-card"><div class="stat-val">' + m.totalRequests + '</div><div class="stat-label">' + t("total_requests") + '</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + m.visionFallbacks + '</div><div class="stat-label">' + t("vision_fallbacks") + '</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + errRate + '%</div><div class="stat-label">' + t("err_rate") + '</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + avgLat + 'ms</div><div class="stat-label">' + t("avg_latency") + '</div></div>';

    var list = document.getElementById("req-list");
    if (!list) return;
    var h = "";
    var recents = m.recent.slice().reverse();
    for (var i = 0; i < recents.length; i++) {
      var r = recents[i];
      var ts = r.ts ? new Date(r.ts).toLocaleTimeString() : "";
      h += '<div class="req-item">' +
        '<span class="req-time">' + ts + '</span>' +
        '<span class="req-proto ' + r.protocol + '">' + r.protocol + '</span>' +
        '<span class="req-model">' + esc(r.model) + '</span>' +
        (r.usedVision ? '<span class="req-vision">VIS</span>' : '') +
        '<span class="req-latency">' + r.latencyMs + 'ms</span>' +
        '</div>';
    }
    list.innerHTML = h || '<div style="padding:20px;text-align:center;color:var(--text-muted)">' + t("no_reqs") + '</div>';
  }

  // === Token Stats ===
  var tokenData = null;
  var selectedModel = null;

  function formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function fetchTokenStats() {
    fetch("/dashboard/api/token-stats").then(function(r) { return r.json(); }).then(function(data) {
      tokenData = data;
      renderTokenStats();
    }).catch(function() {});
  }

  function renderTokenStats() {
    var switcher = document.getElementById("model-switcher");
    var statGrid = document.getElementById("token-stat-grid");
    var chartArea = document.getElementById("chart-container");
    var noData = document.getElementById("no-token-data");
    var statsArea = document.getElementById("token-stats-area");
    if (!switcher || !tokenData || !tokenData.models) return;

    var models = Object.keys(tokenData.models);
    if (models.length === 0) {
      statsArea.style.display = "none";
      noData.style.display = "block";
      return;
    }
    statsArea.style.display = "block";
    noData.style.display = "none";

    if (!selectedModel || !tokenData.models[selectedModel]) {
      selectedModel = models[0];
    }

    // Render model switcher pills
    var pills = "";
    for (var i = 0; i < models.length; i++) {
      var active = models[i] === selectedModel ? " on" : "";
      pills += '<div class="model-pill' + active + '" data-model="' + esc(models[i]) + '">' + esc(models[i]) + '</div>';
    }
    switcher.innerHTML = pills;

    // Render stats for selected model
    var md = tokenData.models[selectedModel];
    statGrid.innerHTML =
      '<div class="token-stat-card"><div class="token-stat-val">' + md.requests + '</div><div class="token-stat-label">' + t("api_requests") + '</div></div>' +
      '<div class="token-stat-card"><div class="token-stat-val">' + formatTokens(md.inputTokens) + '</div><div class="token-stat-label">' + t("total_input_tokens") + '</div></div>' +
      '<div class="token-stat-card"><div class="token-stat-val">' + formatTokens(md.outputTokens) + '</div><div class="token-stat-label">' + t("total_output_tokens") + '</div></div>' +
      '<div class="token-stat-card"><div class="token-stat-val">' + formatTokens(md.inputTokens + md.outputTokens) + '</div><div class="token-stat-label">' + t("total_tokens") + '</div></div>';

    // Render daily chart
    var days = Object.keys(md.daily).sort().slice(-30);
    if (days.length === 0) {
      chartArea.innerHTML = "";
      return;
    }
    var maxTokens = 0;
    for (var i = 0; i < days.length; i++) {
      var d = md.daily[days[i]];
      var total = d.inputTokens + d.outputTokens;
      if (total > maxTokens) maxTokens = total;
    }

    var chartHtml = '<div class="chart-legend"><span><span class="chart-legend-dot" style="background:var(--accent)"></span>' + t("total_input_tokens") + '</span><span><span class="chart-legend-dot" style="background:var(--purple)"></span>' + t("total_output_tokens") + '</span></div>';
    for (var i = 0; i < days.length; i++) {
      var dayKey = days[i];
      var dd = md.daily[dayKey];
      var inW = maxTokens > 0 ? Math.max(2, (dd.inputTokens / maxTokens) * 100) : 2;
      var outW = maxTokens > 0 ? Math.max(2, (dd.outputTokens / maxTokens) * 100) : 2;
      var shortDate = dayKey.slice(5); // MM-DD
      chartHtml += '<div class="chart-row">' +
        '<span class="chart-date">' + shortDate + '</span>' +
        '<div class="chart-bars">' +
          '<div class="chart-bar input" style="width:' + inW + '%" title="Input: ' + formatTokens(dd.inputTokens) + '"></div>' +
          '<div class="chart-bar output" style="width:' + outW + '%" title="Output: ' + formatTokens(dd.outputTokens) + '"></div>' +
        '</div>' +
        '<span class="chart-tokens">' + formatTokens(dd.inputTokens + dd.outputTokens) + '</span>' +
        '</div>';
    }
    chartArea.innerHTML = chartHtml;

    // Animate bars in
    if (typeof gsap !== "undefined") {
      gsap.from(".chart-bar", { width: 0, duration: 0.5, stagger: 0.02, ease: "power2.out" });
    }
  }

  // Model pill click handler
  document.getElementById("model-switcher").addEventListener("click", function(e) {
    var pill = e.target.closest(".model-pill");
    if (!pill) return;
    selectedModel = pill.getAttribute("data-model");
    var pills = document.querySelectorAll(".model-pill");
    for (var i = 0; i < pills.length; i++) pills[i].classList.remove("on");
    pill.classList.add("on");
    renderTokenStats();
    if (typeof gsap !== "undefined") gsap.from(pill, { scale: 0.92, duration: 0.2, ease: "back.out(3)" });
  });

  setInterval(function() {
    var statsPage = document.getElementById("stats");
    if (statsPage && statsPage.classList.contains("on")) { fetchStats(); fetchTokenStats(); }
  }, 5000);

  // === Save ===
  document.getElementById("btn-save").addEventListener("click", async function() {
    var btn = this;
    var msg = document.getElementById("msg");
    var hint = document.getElementById("save-hint");
    var mv = document.getElementById("mm").value;
    if (!mv) {
      msg.textContent = lang === "zh" ? "请输入主模型名称" : "Please enter a main model name";
      msg.style.color = "var(--red)";
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
      localSearchEnabled: true
    };
    try {
      btn.classList.add("saving");
      btn.disabled = true;
      msg.textContent = "";
      msg.style.color = "";
      hint.classList.remove("show");

      var res = await fetch("/dashboard/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      var r = await res.json();
      if (!r.ok) {
        msg.textContent = "Error: " + (r.error || "save failed");
        msg.style.color = "var(--red)";
        btn.classList.remove("saving");
        btn.disabled = false;
        return;
      }

      btn.classList.remove("saving");
      btn.classList.add("done");

      if (CC === "claude") {
        hint.innerHTML = t("save_hint_claude");
        hint.classList.add("show");
        msg.textContent = "";
      } else {
        msg.textContent = t("save_hint_codex");
        msg.style.color = "var(--text-secondary)";
        await fetch("/dashboard/api/restart", { method: "POST" });
      }
    } catch (err) {
      msg.textContent = "Network error: " + err.message;
      msg.style.color = "var(--red)";
      btn.classList.remove("saving", "done");
      btn.disabled = false;
    }
  });

})();
</script>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

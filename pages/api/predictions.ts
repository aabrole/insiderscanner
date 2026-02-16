import type { NextApiRequest, NextApiResponse } from "next";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SPX Predictions | Polymarket-style stats</title>
<style>
:root{--bg:#0d0d0d;--card:#1a1a1a;--border:#2a2a2a;--text:#e5e5e5;--muted:#888;--accent:#00d4aa;--vol:#6b9fff}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:24px;min-height:100vh}
h1{font-size:1.5rem;font-weight:600;margin:0 0 8px 0}
.topic-bar{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.topic-bar input{background:var(--card);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:8px;font-size:1rem;width:140px}
.topic-bar button{background:var(--accent);color:var(--bg);border:none;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}
.topic-bar button:hover{opacity:.9}
.sub{color:var(--muted);font-size:.875rem;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;transition:border-color .15s}
.card:hover{border-color:var(--accent)}
.card h2{font-size:.95rem;font-weight:600;margin:0 0 12px 0;line-height:1.35}
.card a{color:inherit;text-decoration:none}
.card a:hover{text-decoration:underline}
.outcome{font-size:1.25rem;font-weight:700;margin-bottom:8px}
.outcome.up{color:#22c55e}
.outcome.down{color:#ef4444}
.outcome.yes{color:var(--accent)}
.meta{display:flex;gap:16px;font-size:.8rem;color:var(--muted)}
.meta span{color:var(--vol)}
.loading{color:var(--muted)}
.err{color:#ef4444}
</style>
</head>
<body>
<h1>Prediction markets</h1>
<p class="sub">Live odds from Polymarket (SPX, SPY, and more). Use alongside TradingView.</p>
<div class="topic-bar">
<input type="text" id="topic" value="spx" placeholder="e.g. spx"/>
<button type="button" id="go">Load</button>
</div>
<div id="root" class="grid"></div>
<script>
var root=document.getElementById("root"),topicInput=document.getElementById("topic"),goBtn=document.getElementById("go");
function formatVol(n){if(n>=1e6)return "$"+(n/1e6).toFixed(1)+"M";if(n>=1e3)return "$"+(n/1e3).toFixed(1)+"K";return "$"+Math.round(n)}
function escapeHtml(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
function render(data){
  if(!data||!data.markets||!data.markets.length){root.innerHTML='<p class="loading">No markets found. Try spx, btc, or trump.</p>';return}
  root.innerHTML=data.markets.map(function(m){
    var pct=Math.round(m.yesPct*100),oc=(m.outcomeLabel||"").toLowerCase();
    return '<article class="card"><a href="'+m.url+'" target="_blank" rel="noopener"><h2>'+escapeHtml(m.question)+'</h2><div class="outcome '+oc+'">'+pct+'% '+escapeHtml(m.outcomeLabel)+'</div><div class="meta"><span>'+formatVol(m.volume)+' Vol.</span> '+formatVol(m.liquidity)+' Liq.</div></a></article>';
  }).join("");
}
function load(){
  var topic=(topicInput.value||"spx").trim().toLowerCase();
  root.innerHTML='<p class="loading">Loading…</p>';
  fetch(window.location.origin+"/api/predictions-list?topic="+encodeURIComponent(topic)).then(function(r){return r.json()}).then(function(data){if(data.markets)render(data);else root.innerHTML='<p class="err">'+(data.error||"Request failed")+'</p>'}).catch(function(){root.innerHTML='<p class="err">Failed to load API.</p>'})
}
goBtn.addEventListener("click",load);
topicInput.addEventListener("keydown",function(e){if(e.key==="Enter")load()});
load();
</script>
</body>
</html>`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(HTML);
}

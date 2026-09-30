/* ============================================================
   dhl-ui2.js — หน้าตาใหม่ของแอป Staff ระบบเดิม (แบบตัวทดลองที่วินนี่เลือก)   · 1 ต.ค. 2569
   • "เปลี่ยนหน้าตา" เท่านั้น — ใช้ข้อมูล/ฟังก์ชัน/การซิงค์/รายงานของแอปเดิมทั้งหมด (ปุ่มใหม่เรียกฟังก์ชันเดิม)
   • เปิดเฉพาะสาขาในรายการ UI2 (เริ่มที่ TEST) · สาขาอื่นเห็นหน้าเดิม 100%
   • ผิดพลาดอะไร → ถอดหน้าตาใหม่ออกเอง กลับหน้าเดิมทันที
   ============================================================ */
(function(){
'use strict';
const UI2_VER = '2026.10.01-b';
const UI2 = ['TEST'];                                   /* สาขาที่เห็นหน้าใหม่ (นำร่อง) */
const G = n => { try { return (0,eval)(n); } catch(e){ return undefined; } };
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const hm = ts => { const d = new Date(+ts); return pad(d.getHours())+':'+pad(d.getMinutes()); };
const secOf = ts => { const d = new Date(+ts); return d.getHours()*3600+d.getMinutes()*60+d.getSeconds(); };
const secNow = () => secOf(Date.now());
const CUT = 7*3600, PD_A = 7*3600, PD_B = 7*3600+15*60, DEP_T = 8*3600+30*60, FDEL_T = 9*3600;
const settings = () => G('settings') || {};
const depot = () => settings().depot || (window.DHLSync && window.DHLSync.depot) || '';
const ready = () => !!(window.DHLSync && window.DHLSync.ready);
const call = (name, ...a) => { try { const f = G(name); if (typeof f === 'function') return Promise.resolve(f(...a)).catch(e => console.warn('[ui2]', name, e)); } catch(e){ console.warn('[ui2]', name, e); } return Promise.resolve(); };
let ON = false, TAB = 'checkin', SUN = false;
try { SUN = localStorage.getItem('ui2Sun') === '1'; } catch(e){}

/* ---------- สไตล์ (ชุดสีมาตรฐานเดียวกับ UPC) ---------- */
const CSS = `
body.ui2{--u-ok:#2E7D32;--u-okb:#E6F5EB;--u-late:#C62828;--u-lateb:#FDEAEA;--u-ab:#6A4FB3;--u-abb:#EFE9FB;--u-wait:#B7791F;--u-waitb:#FFF4D6;--u-line:#ece8dc;--u-mut:#7a7466;background:#f6f4ee;padding-bottom:86px}
body.ui2 .nav{display:none!important}
body.ui2 #tlCheckin,body.ui2 #tlPd,body.ui2 .tlcard,body.ui2 #clockCard{display:none!important}
body.ui2 #view-checkin > :not(#u2ci){display:none!important}
body.ui2 .card{border-radius:16px;border:1.5px solid var(--u-line);box-shadow:none}
body.ui2 .chip.ontime{background:var(--u-okb);color:var(--u-ok)} body.ui2 .chip.late{background:var(--u-lateb);color:var(--u-late)}
#u2tl{position:sticky;top:0;z-index:40;background:#f6f4ee;padding:8px 10px 6px;max-width:640px;margin:0 auto}
#u2tl .bx{background:#fff;border:1.5px solid var(--u-line);border-radius:16px;padding:8px 6px}
#u2tl .steps{display:grid;grid-template-columns:repeat(6,1fr);position:relative}
#u2tl .steps:before{content:"";position:absolute;left:8%;right:8%;top:12px;height:3px;background:#e8e4d8}
#u2tl .st{position:relative;text-align:center;cursor:pointer}
#u2tl .st i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;margin:0 auto;background:#fff;border:3px solid #d8d3c4;font-style:normal;font-weight:800;font-size:11.5px;color:#aaa;position:relative;z-index:1}
#u2tl .st.ok i{background:var(--u-ok);border-color:var(--u-ok);color:#fff} #u2tl .st.late i{background:var(--u-late);border-color:var(--u-late);color:#fff}
#u2tl .st.now i{border-color:#FFCC00;background:#fff8d9;color:#1a1a1a;box-shadow:0 0 0 4px rgba(255,204,0,.35)}
#u2tl .l{font-weight:700;font-size:10px;margin-top:2px;line-height:1.1} #u2tl .v{font-size:10.5px;color:var(--u-mut);font-weight:700}
#u2tl .nx{margin-top:6px;background:var(--u-waitb);border-radius:10px;padding:6px 8px;font-size:12.5px;font-weight:700;color:#6b4d00;display:flex;justify-content:space-between;align-items:center;gap:8px}
#u2tl .nx.done{background:var(--u-okb);color:var(--u-ok)}
#u2tl .nx button{border:0;background:#1a1a1a;color:#FFCC00;border-radius:9px;padding:6px 10px;font-weight:800;font-size:12px;white-space:nowrap;font-family:inherit}
#u2off{background:#3b2f00;color:#FFCC00;border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:800;margin-top:6px}
#u2nav{position:fixed;left:0;right:0;bottom:0;z-index:60;background:#fff;border-top:1px solid var(--u-line);display:grid;grid-template-columns:repeat(5,1fr);padding-bottom:env(safe-area-inset-bottom)}
#u2nav button{border:0;background:none;padding:7px 0 9px;font-size:11.5px;font-weight:700;color:#9a9484;display:flex;flex-direction:column;align-items:center;gap:1px;position:relative;font-family:inherit}
#u2nav button i{font-style:normal;font-size:20px;filter:grayscale(1);opacity:.55} #u2nav button.on{color:#1a1a1a} #u2nav button.on i{filter:none;opacity:1}
#u2ci .hero{display:flex;gap:12px;align-items:center}
#u2ci .ring{position:relative;width:86px;height:86px;flex:none} #u2ci .ring b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1;text-align:center;font-variant-numeric:tabular-nums}
#u2ci .ring b i{font-style:normal;font-size:26px;letter-spacing:-.5px} #u2ci .ring b i.d3{font-size:20px}
#u2ci .ring b small{display:block;margin-top:3px;font-size:11px;color:var(--u-mut);font-weight:700;white-space:nowrap}
#u2ci .hh{font-weight:800;font-size:18px} #u2ci .ch{display:inline-block;border-radius:999px;padding:3px 9px;font-weight:700;font-size:12px;margin:3px 4px 0 0}
.u-ok{background:var(--u-okb);color:var(--u-ok)} .u-late{background:var(--u-lateb);color:var(--u-late)} .u-ab{background:var(--u-abb);color:var(--u-ab)} .u-wait{background:var(--u-waitb);color:var(--u-wait)}
#u2ci .lock{font-size:11.5px;color:var(--u-mut);background:#f3f0e7;border-radius:8px;padding:5px 8px;margin-top:8px}
#u2ci .sec{display:flex;justify-content:space-between;align-items:baseline;margin:14px 4px 6px;font-weight:800;font-size:14px} #u2ci .sec small{font-weight:400;font-size:12px;color:var(--u-mut)}
#u2ci .srch{width:100%;box-sizing:border-box;border:1.5px solid var(--u-line);border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;margin-bottom:8px;background:#fff}
#u2ci .todo{display:flex;align-items:center;gap:9px;background:#fff;border-radius:14px;margin-bottom:7px;padding:8px 10px;border:1.5px solid var(--u-line)}
#u2ci .todo.over{border-color:#f0b4b4;background:#fffafa}
#u2ci .todo .nm{flex:1;min-width:0;font-weight:700;font-size:14px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#u2ci .todo .nm small{display:block;font-weight:400;color:var(--u-mut);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#u2ci .us{display:inline-block;background:#f3f0e7;border-radius:6px;padding:0 6px;font-size:11px;color:#6b6558;margin-left:4px}
#u2ci .bdg{font-weight:800;font-size:10px;border-radius:6px;padding:1px 6px;margin-left:5px;vertical-align:1px} #u2ci .bdg.risk{background:#C62828;color:#fff} #u2ci .bdg.watch{background:#FFCC00;color:#1a1a1a}
#u2ci .sb{flex:none;border:0;border-radius:11px;padding:10px 11px;font-weight:800;font-size:12.5px;font-family:inherit}
#u2ci .sb.ab{background:#fff;border:1.5px solid var(--u-line);color:var(--u-ab)} #u2ci .sb.sh{background:#1a1a1a;color:#FFCC00;font-size:17px;padding:8px 13px}
#u2ci .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#u2ci .tile{background:#fff;border-radius:12px;overflow:hidden;border:2px solid transparent;position:relative;cursor:pointer}
#u2ci .tile.late{border-color:var(--u-late)} #u2ci .tile .ph{position:relative;aspect-ratio:3/4;background:#f1eee5;display:grid;place-items:center}
#u2ci .tile .ph img{width:100%;height:100%;object-fit:cover;display:block}
#u2ci .tile .np{font-size:12px;font-weight:800;color:var(--u-late);text-align:center;padding:6px}
#u2ci .tile .tt{position:absolute;left:4px;bottom:4px;border-radius:7px;padding:1px 6px;font-weight:800;font-size:11px;background:rgba(255,255,255,.93);color:var(--u-ok)}
#u2ci .tile.late .tt{color:var(--u-late)} #u2ci .tile .uf{position:absolute;right:4px;bottom:4px;background:#fff;border-radius:7px;padding:0 5px;font-size:12px}
#u2ci .tile .n2{font-weight:700;font-size:12px;padding:4px 6px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#u2ci .abr{display:flex;align-items:center;gap:8px;background:#fff;border-radius:12px;margin-bottom:6px;padding:8px 10px;border-left:4px solid var(--u-ab)}
#u2ci .rep{display:block;width:100%;border:0;border-radius:14px;padding:13px;font-weight:800;font-size:15px;margin-top:14px;background:#1a1a1a;color:#FFCC00;font-family:inherit}
#u2pd .big{font-weight:800;font-size:38px;text-align:center;margin:6px 0 2px}
#u2sh{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.45);display:none;align-items:flex-end}
#u2sh.on{display:flex} #u2sh .bx{background:#fff;width:100%;max-width:640px;margin:0 auto;border-radius:22px 22px 0 0;padding:16px 16px 22px;max-height:88vh;overflow:auto}
#u2sh .mi{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid var(--u-line);font-weight:700;cursor:pointer} #u2sh .mi:first-of-type{border-top:0}
#u2sh .mi i{font-style:normal;font-size:22px} #u2sh .mi small{display:block;font-weight:400;color:var(--u-mut);font-size:12px}
#u2sh .bt{display:block;width:100%;border:0;border-radius:14px;padding:12px;font-weight:800;font-size:15px;margin-top:8px;font-family:inherit}
#u2sh .bt.y{background:#FFCC00} #u2sh .bt.o{background:#fff;border:1.5px solid var(--u-line)}
body.ui2.u2sun{background:#fff} body.ui2.u2sun .card,body.ui2.u2sun #u2ci .todo,body.ui2.u2sun #u2ci .tile,body.ui2.u2sun #u2tl .bx{border:2.5px solid #1a1a1a}
body.ui2.u2sun #u2ci .todo .nm{font-size:17px} body.ui2.u2sun #u2ci .sb{padding:13px 14px;font-size:15px} body.ui2.u2sun #u2ci .hh{font-size:22px}
body.ui2.u2sun .u-ok{background:#1b5e20;color:#fff} body.ui2.u2sun .u-late{background:#b71c1c;color:#fff} body.ui2.u2sun .u-ab{background:#4a2f9a;color:#fff}
body.ui2.u2sun #u2tl .nx{background:#1a1a1a;color:#FFCC00}
body.ui2 #rpList,body.ui2 #rpSearch,body.ui2 #fdList,body.ui2 #fdSearch{display:none!important}
.u2rp{margin:10px 0 4px}
.u2rp .sum{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
.u2rp .sum div{background:#f6f4ee;border-radius:10px;padding:6px 4px;text-align:center;font-size:11px;color:var(--u-mut);font-weight:700}
.u2rp .sum b{display:block;font-size:17px;color:#1a1a1a}
.u2rp .srch{width:100%;box-sizing:border-box;border:1.5px solid var(--u-line);border-radius:12px;padding:9px 12px;font:inherit;font-size:15px;margin-bottom:8px;background:#fff}
.u2rp .rw{display:flex;align-items:center;gap:8px;border:1.5px solid var(--u-line);border-radius:14px;padding:8px 9px;margin-bottom:7px;background:#fff}
.u2rp .rw.fin{background:#f7fbf8;border-color:#cfe7d6}
.u2rp .nm{flex:1;min-width:0;font-weight:700;font-size:14px;line-height:1.25}
.u2rp .nm>span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u2rp .ps{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.u2rp .ps i{font-style:normal;font-size:11px;font-weight:700;border-radius:7px;padding:1px 6px;background:#f1eee5;color:#9a9484;white-space:nowrap}
.u2rp .ps i.ok{background:var(--u-okb);color:var(--u-ok)} .u2rp .ps i.late{background:var(--u-lateb);color:var(--u-late)}
.u2rp .go{flex:none;border:0;border-radius:12px;min-width:92px;padding:11px 8px;font-weight:800;font-size:13.5px;font-family:inherit;line-height:1.15}
.u2rp .go.fs{background:#FFCC00;color:#1a1a1a} .u2rp .go.dep{background:#1a1a1a;color:#FFCC00} .u2rp .go.fdel{background:var(--u-ok);color:#fff}
.u2rp .go.dis{background:#eee;color:#aaa} .u2rp .go.fin{background:none;color:var(--u-ok);min-width:0;padding:6px 4px}
.u2rp .go small{display:block;font-weight:600;font-size:10.5px;opacity:.8}
.u2cf .flow{display:flex;align-items:center;gap:4px;margin:12px 0}
.u2cf .flow div{flex:1;text-align:center;border-radius:12px;padding:8px 2px;background:#f3f0e7;color:#9a9484;font-weight:800;font-size:12.5px}
.u2cf .flow div small{display:block;font-weight:700;font-size:13px;margin-top:2px}
.u2cf .flow div.ok{background:var(--u-okb);color:var(--u-ok)} .u2cf .flow div.cur{background:#FFCC00;color:#1a1a1a;box-shadow:0 0 0 3px #1a1a1a inset}
.u2cf .flow b{color:#c9c3b3}
.u2cf .when{text-align:center;font-size:13px;color:var(--u-mut)} .u2cf .when b{display:block;font-size:34px;color:#1a1a1a;font-variant-numeric:tabular-nums}
.u2cf .warn{background:var(--u-waitb);color:#6b4d00;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700;margin-top:10px}
.u2cf .bt.ok{background:#1a1a1a;color:#FFCC00;font-size:17px;padding:15px} .u2cf .bt.ok[disabled]{opacity:.45}`;

/* ---------- ข้อมูลของวัน (อ่านจากแอปเดิม) ---------- */
function actCouriers(){ const L = G('couriers') || [], rm = ((window.dsRemovedIds && window.dsRemovedIds()) || []).map(Number); return L.filter(c => c && c.active !== false && !rm.includes(Number(c.id))); }
function absMap(){ const a = window.DHLSync && window.DHLSync.absent; return (a && typeof a === 'object') ? a : {}; }
async function recsOf(k){ try { return (await G('getByDate')(k)) || []; } catch(e){ return []; } }
async function pphOf(k){ try { return (await G('getPPH')(k)) || null; } catch(e){ return null; } }
const today = () => { try { return G('todayKey')(); } catch(e){ return new Date().toISOString().slice(0,10); } };
let USUAL = {}, USUALDAY = '', RISK = {};
async function loadUsual(){ const k = today(); if (USUALDAY === k) return; USUALDAY = k;
  try { const m = {}; const d = new Date(k+'T00:00:00');
    for (let i = 1; i <= 21; i++){ const x = new Date(d); x.setDate(x.getDate()-i); if (x.getDay() === 0) continue;
      const kk = x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate()); (await recsOf(kk)).forEach(r => { (m[r.courierId] = m[r.courierId] || []).push(secOf(r.ts)); }); }
    USUAL = {}; Object.keys(m).forEach(id => { const a = m[id].sort((x,y)=>x-y); USUAL[id] = a[Math.floor(a.length/2)]; });
    const rm = G('riskMap'); RISK = rm ? ((await rm(k)) || {}) : {};
  } catch(e){ } }
const secHm = s => pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60));

/* ---------- ไทม์ไลน์ของวัน (นิยามเดียวกับแอปเดิม) ---------- */
async function stepData(){
  const recs = await recsOf(today()), p = (await pphOf(today())) || {}, ab = absMap(), act = actCouriers();
  const act2 = act.filter(c => !ab[String(c.id)]), need = act2.length, ids = new Set(recs.map(r => Number(r.courierId)));
  const allIn = need > 0 && act2.every(c => ids.has(Number(c.id)));
  const deps = Object.values(p.rp||{}).map(x=>x.dep).filter(Boolean), fd = Object.values(p.rp||{}).map(x=>x.fdel).filter(Boolean);
  const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null, s = secNow();
  const S = [
    { v:'checkin', l:'เข้างาน', val: allIn ? Math.max(...recs.map(r=>+r.ts)) : null, txt: allIn ? null : recs.length+'/'+need, st: allIn ? (recs.some(r=>r.status==='late')?'late':'ok') : (s >= CUT-1800 ? 'now' : '') },
    { v:'pd', l:'PD', val: p.pd && p.pd.ts, st: p.pd && p.pd.ts ? (secOf(p.pd.ts) >= PD_A && secOf(p.pd.ts) <= PD_B ? 'ok' : 'late') : (recs.length && s >= PD_A-600 ? 'now' : '') },
    { v:'pph', l:'First IB', val: p.inboundTs, st: p.inboundTs ? 'ok' : '' },
    { v:'pph', l:'Last IB', val: p.lastInboundTs, st: p.lastInboundTs ? 'ok' : '' },
    { v:'pph', l:'Departure', val: avg(deps), st: deps.length ? (secOf(avg(deps)) < DEP_T ? 'ok' : 'late') : '' },
    { v:'fdel', l:'First Del', val: avg(fd), st: fd.length ? (secOf(avg(fd)) < FDEL_T ? 'ok' : 'late') : '' } ];
  const nx = S.find(x => x.st !== 'ok' && x.st !== 'late');
  return { S, nx };
}
const ACT = { checkin:'ไปลงเวลา', pd:'ถ่ายภาพ PD', pph:'บันทึก PPH', fdel:'บันทึก First Del' };
let TLSIG = '';
async function renderTL(){ const el = $('u2tl'); if (!el) return; const { S, nx } = await stepData();
  const q = (window.dsPhotoQueue && window.dsPhotoQueue()) || 0, off = !navigator.onLine;
  const h = '<div class="bx"><div class="steps">' + S.map((x,i) => '<div class="st '+x.st+'" data-v="'+x.v+'"><i>'+(x.st==='ok'?'✓':x.st==='late'?'!':i+1)+'</i><div class="l">'+x.l+'</div><div class="v">'+(x.val?hm(x.val):(x.txt||'—'))+'</div></div>').join('') + '</div>'
    + (nx ? '<div class="nx"><span>ถัดไป: '+nx.l+'</span><button data-v="'+nx.v+'">'+ACT[nx.v]+' ›</button></div>' : '<div class="nx done">✅ ครบทุกขั้นตอนของวันนี้แล้ว</div>') + '</div>'
    + (off||q ? '<div id="u2off">'+(off?'📴 ไม่มีสัญญาณ — ทำงานต่อได้ ข้อมูลเก็บในเครื่อง แล้วส่งเองเมื่อมีสัญญาณ':'')+(q?(off?' · ':'')+'📤 รูปรอส่ง '+q+' รูป':'')+'</div>' : '');
  if (h === TLSIG) return; TLSIG = h; el.innerHTML = h;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v)); }

/* ---------- เมนูล่าง ---------- */
function renderNav(){ const el = $('u2nav'); if (!el) return;
  const T = [['checkin','📷','เช็คอิน'],['pd','📸','PD'],['pph','📦','PPH'],['fdel','🛵','First Del'],['more','☰','เพิ่มเติม']];
  const more = ['dash','insight','hist','manage'].includes(TAB);
  el.innerHTML = T.map(t => '<button data-v="'+t[0]+'" class="'+(TAB===t[0]||(t[0]==='more'&&more)?'on':'')+'"><i>'+t[1]+'</i>'+t[2]+'</button>').join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => b.dataset.v === 'more' ? openMore() : go(b.dataset.v)); }
function go(v){ closeSheet(); call('nav', v); setTimeout(() => { const act = document.querySelector('.view.active'); TAB = act ? act.id.replace('view-','') : v; renderNav(); if (TAB === 'checkin') renderCI(); if (TAB === 'pd') renderPD(); if (TAB === 'pph' || TAB === 'fdel'){ RPSIG=''; setTimeout(renderRP, 300); } TLSIG=''; renderTL(); try { window.scrollTo(0,0); } catch(e){} }, 60); }
function openMore(){ sheet('<h3 style="margin:0 0 6px">☰ เพิ่มเติม</h3>'
  + [['📊','สรุปผล','KPI ทั้งวัน · สร้างรายงาน Report 1+2','dash'],['📈','อินไซต์','เทรนด์ · คนสายบ่อย','insight'],['🗓','ประวัติ','ย้อนหลังรายวัน + รายงานย้อนหลัง','hist'],['👥','จัดการ','รายชื่อ Courier · ตั้งค่า','manage']].map(m => '<div class="mi" data-v="'+m[3]+'"><i>'+m[0]+'</i><div>'+m[1]+'<small>'+m[2]+'</small></div></div>').join('')
  + '<div class="mi" data-sun="1"><i>☀️</i><div>โหมดกลางแดด: '+(SUN?'เปิดอยู่':'ปิดอยู่')+'<small>ตัวใหญ่ ตัดกันชัด มองกลางแจ้งง่าย</small></div></div>'
  + '<button class="bt o" data-x="1">ปิด</button>');
  const b = $('u2shb'); b.querySelectorAll('.mi[data-v]').forEach(m => m.onclick = () => go(m.dataset.v));
  b.querySelector('[data-sun]').onclick = () => { SUN = !SUN; try { localStorage.setItem('ui2Sun', SUN?'1':'0'); } catch(e){} document.body.classList.toggle('u2sun', SUN); closeSheet(); };
  b.querySelector('[data-x]').onclick = closeSheet; }
function sheet(h){ $('u2shb').innerHTML = h; $('u2sh').classList.add('on'); }
function closeSheet(){ const s = $('u2sh'); if (s){ s.classList.remove('on'); s.onclick = e => { if (e.target.id === 'u2sh') closeSheet(); }; } CFOPEN = false; }

/* ---------- แท็บเช็คอิน ---------- */
let SRCH = '', SIG = '', LASTTYPE = 0;
async function sig(){ const r = await recsOf(today()); return r.map(x => x.courierId+':'+x.ts+':'+(x.photo?1:0)+':'+(x.uniform===false?0:1)).sort().join('|')+'#'+Object.keys(absMap()).sort().join(',')+'#'+actCouriers().map(c=>c.id).join(','); }
async function renderCI(){ const box = $('u2ci'); if (!box) return;
  const recs = await recsOf(today()), ab = absMap(), act = actCouriers(), byC = {}; recs.forEach(r => byC[Number(r.courierId)] = r);
  const done = act.filter(c => byC[Number(c.id)]).sort((a,b) => byC[Number(b.id)].ts - byC[Number(a.id)].ts);
  const abs = act.filter(c => !byC[Number(c.id)] && ab[String(c.id)]);
  const todo = act.filter(c => !byC[Number(c.id)] && !ab[String(c.id)]).sort((a,b) => (USUAL[a.id]||99999)-(USUAL[b.id]||99999) || String(a.code).localeCompare(String(b.code)));
  const need = act.length - abs.length, lt = done.filter(c => byC[Number(c.id)].status === 'late').length, noPh = done.filter(c => !byC[Number(c.id)].photo).length;
  const R = 36, C = 2*Math.PI*R, n = act.length || 1; let off = 0;
  const seg = [[done.length,'#2E7D32'],[abs.length,'#6A4FB3']].map(([v,c]) => { if (!v) return ''; const L = v/n*C, s = '<circle cx="43" cy="43" r="'+R+'" fill="none" stroke="'+c+'" stroke-width="10" stroke-dasharray="'+L+' '+C+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 43 43)"/>'; off += L; return s; }).join('');
  const s = secNow(), rlv = G('riskLevel') || (() => null);
  let h = '<div class="card"><div class="hero"><div class="ring"><svg width="86" height="86"><circle cx="43" cy="43" r="'+R+'" fill="none" stroke="#ece9df" stroke-width="10"/>'+seg+'</svg><b><i'+(done.length>99?' class="d3"':'')+'>'+done.length+'</i><small>/ '+need+' คน</small></b></div>'
    + '<div><div class="hh">'+(!act.length ? 'ยังไม่มีรายชื่อ' : todo.length ? 'เหลืออีก '+todo.length+' คน' : lt ? 'ครบแล้ว ✓' : 'Ontime ทุกคน! 🎉')+'</div>'
    + '<div><span class="ch u-ok">Ontime '+(done.length-lt)+'</span>'+(lt?'<span class="ch u-late">Late '+lt+'</span>':'')+(abs.length?'<span class="ch u-ab">ขาด/ลา '+abs.length+'</span>':'')+(noPh?'<span class="ch u-late">📷 รอถ่าย '+noPh+'</span>':'')+'</div>'
    + '<div style="font-size:12.5px;color:var(--u-mut);margin-top:3px">เข้างาน 07:00 · '+(s > CUT ? '<b style="color:var(--u-late)">เลยเวลาแล้ว</b>' : 'อีก '+Math.ceil((CUT-s)/60)+' นาที')+'</div></div></div>'
    + '<div class="lock">🔒 เวลาเข้างาน = เวลาที่ถ่ายรูปจริง · ผิด แตะรูป → ↺ ถ่ายใหม่</div></div>';
  if (!act.length) h += '<div class="card">ยังไม่มีรายชื่อ Courier — ไปที่ ☰ เพิ่มเติม → จัดการ</div>';
  if (todo.length){
    const q = SRCH.trim().toLowerCase(), T = q ? todo.filter(c => String(c.code).toLowerCase().endsWith(q) || String(c.code).toLowerCase().includes(q) || String(c.name).toLowerCase().includes(q) || String(c.vendor||'').toLowerCase().includes(q)) : todo;
    h += '<div class="sec"><span>⏳ ยังไม่ลงเวลา '+todo.length+' คน</span><small>เรียงตามเวลาที่มาปกติ</small></div>'
      + '<input class="srch" id="u2q" inputmode="search" placeholder="🔍 พิมพ์เลขท้ายรหัส เช่น 05 หรือชื่อ" value="'+esc(SRCH)+'">'
      + (T.length ? T.map(c => { const rl = rlv(RISK[c.id]||0);
          return '<div class="todo'+(s > CUT+600 ? ' over' : '')+'"><div class="nm">'+esc(c.name)+(rl?'<span class="bdg '+rl+'">'+(rl==='risk'?'RISK':'WATCH')+'</span>':'')
            + '<small>'+esc(c.code)+' · '+esc(c.type||'')+' · '+esc(c.vendor||'')+(USUAL[c.id]?'<span class="us">ปกติมา '+secHm(USUAL[c.id])+'</span>':'')+'</small></div>'
            + '<button class="sb ab" data-ab="'+esc(c.id)+'">ลา/ขาด</button><button class="sb sh" data-cam="'+esc(c.id)+'">📷</button></div>'; }).join('')
        : '<div style="text-align:center;color:var(--u-mut);padding:12px">ไม่พบ "'+esc(SRCH)+'"</div>');
  }
  if (done.length) h += '<div class="sec"><span>🖼 เช็คอินแล้ว '+done.length+' คน</span><small>แตะรูป = ดู / 👕 / ถ่ายใหม่</small></div><div class="grid">'
    + done.map(c => { const r = byC[Number(c.id)], L = r.status === 'late';
        return '<div class="tile'+(L?' late':'')+'" data-cid="'+esc(c.id)+'"><div class="ph">'+(r.photo?'<img src="'+r.photo+'" alt="">':'<div class="np">📷<br>แตะเพื่อถ่าย</div>')
          + '<span class="tt">'+(L?'Late ':'✔ ')+hm(r.ts)+'</span><span class="uf">'+(r.uniform===false?'🚫':'👕')+'</span></div><div class="n2">'+esc(String(c.name).split(' ')[0])+'</div></div>'; }).join('') + '</div>';
  if (abs.length) h += '<div class="sec"><span>🟣 ขาด / ลา '+abs.length+' คน</span></div>' + abs.map(c => { const a = ab[String(c.id)] || {};
      return '<div class="abr"><div style="flex:1;font-weight:700;font-size:13.5px">'+esc(c.name)+'<div style="font-weight:400;font-size:11.5px;color:var(--u-mut)">'+esc(c.code)+'</div></div><span class="ch u-ab">'+esc(a.label||a.type||a.note||'ขาด/ลา')+'</span><button class="sb ab" data-abx="'+esc(c.id)+'">✕</button></div>'; }).join('');
  if (act.length) h += '<button class="rep" data-rep="1">📄 รายงานวันนี้ (Report 1 + 2)</button>';
  box.innerHTML = h;
  const qi = $('u2q'); if (qi) qi.oninput = () => { SRCH = qi.value; LASTTYPE = performance.now(); renderCI().then(() => { const e = $('u2q'); if (e){ e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch(x){} } }); };
  const cOf = id => act.find(c => String(c.id) === String(id));
  box.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { const c = cOf(b.dataset.cam); if (c){ SRCH = ''; call('openCamera', c.id); } });
  box.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { const c = cOf(b.dataset.ab); if (c && window.dsAbsOpen) window.dsAbsOpen(c.id, c.name, c.code); });
  box.querySelectorAll('[data-abx]').forEach(b => b.onclick = () => { if (window.dsAbsClear) Promise.resolve(window.dsAbsClear(b.dataset.abx)).then(() => setTimeout(renderCI, 300)); });
  box.querySelectorAll('.tile').forEach(t => t.onclick = () => { const c = cOf(t.dataset.cid); openTile(c, c && byC[Number(c.id)]); });
  const rb = box.querySelector('[data-rep]'); if (rb) rb.onclick = () => call('openReport', today());
  SIG = await sig();
}
function openTile(c, r){ if (!c || !r) return; const L = r.status === 'late';
  if (!r.photo){ call('openCamera', c.id, r.id); return; }
  sheet('<h3 style="margin:0">'+esc(c.name)+'</h3><div style="font-size:12.5px;color:var(--u-mut)">'+esc(c.code)+' · '+(L?'<b style="color:var(--u-late)">Late</b>':'<b style="color:var(--u-ok)">Ontime</b>')+' '+hm(r.ts)+'</div>'
    + '<img src="'+r.photo+'" style="width:64%;display:block;margin:10px auto;border-radius:12px">'
    + '<button class="bt o" data-u="1">'+(r.uniform===false?'🚫 ไม่ใส่ยูนิฟอร์ม — แตะเพื่อเปลี่ยน':'👕 ใส่ยูนิฟอร์ม ✓ — แตะเพื่อเปลี่ยน')+'</button>'
    + '<button class="bt o" data-r="1">↺ ถ่ายใหม่ (ลบรายการนี้ แล้วเวลาใหม่ = ตอนถ่าย)</button><button class="bt y" data-x="1">ปิด</button>');
  const b = $('u2shb');
  b.querySelector('[data-u]').onclick = () => { closeSheet(); call('toggleUniformRec', r.id).then(() => setTimeout(renderCI, 200)); };
  b.querySelector('[data-r]').onclick = () => { closeSheet(); call('redo', r.id).then(() => setTimeout(renderCI, 300)); };
  b.querySelector('[data-x]').onclick = closeSheet; }

/* ---------- แท็บ PD: นับถอยหลัง ---------- */
async function renderPD(){ const v = $('view-pd'); if (!v) return; let el = $('u2pd');
  if (!el){ el = document.createElement('div'); el.id = 'u2pd'; el.className = 'card'; v.insertBefore(el, v.firstChild); }
  const p = (await pphOf(today())) || {}, s = secNow();
  if (p.pd && p.pd.ts){ el.style.display = 'none'; return; } el.style.display = '';
  const inW = s >= PD_A && s <= PD_B;
  el.innerHTML = '<div style="font-weight:800">📸 ประชุมเช้า PD · 07:00–07:15</div><div class="big" style="color:'+(inW?'#2E7D32':s<PD_A?'#B7791F':'#C62828')+'">'
    + (s < PD_A ? 'อีก '+Math.ceil((PD_A-s)/60)+' นาที' : inW ? 'เหลือ '+Math.ceil((PD_B-s)/60)+' นาที' : 'เลย '+Math.floor((s-PD_B)/60)+' นาที')+'</div>'
    + '<div style="text-align:center;font-size:12.5px;color:var(--u-mut)">'+(s<PD_A?'ยังไม่ถึงเวลาประชุม':inW?'อยู่ในช่วงเวลาถ่าย PD':'เลยช่วงเวลาแล้ว — ถ่ายได้ แต่นับว่านอกช่วง')+' · 🔒 เวลา = เวลาถ่ายจริง</div>'; }

/* ---------- PPH Route prep + First Del: FS → ออกรถ → ส่งชิ้นแรก (รายคน · ยืนยันทุกขั้น) ----------
   ใช้ rpStamp(cid,k) เดิมของแอป (มีตรวจลำดับเวลาอยู่แล้ว) · ไม่มีการแก้เวลา · กดแล้วต้องยืนยันใน Pop Up
   กันกดรัว: ปุ่มยืนยันเปิดหลัง 1 วินาที + พัก 1.5 วินาทีหลังบันทึกทุกครั้ง + เตือนถ้าห่างจากขั้นก่อนน้อยผิดปกติ */
const RS = ['fs','dep','fdel'], RN = { fs:'FS', dep:'ออกรถ', fdel:'ส่งชิ้นแรก' }, RL = { fs:'จัดรถเสร็จ (First Scan)', dep:'ออกรถ (Departure)', fdel:'ส่งชิ้นแรก (First Del)' };
const RMIN = { dep:3, fdel:3 };                       /* ห่างจากขั้นก่อนน้อยกว่านี้ (นาที) → เตือนเพิ่ม */
let RPSIG = '', RPQ = '', BUSY = 0, CFOPEN = false;
const nextStep = q => RS.find(k => !q[k]) || null;
const stLate = (k, ts) => k === 'dep' ? secOf(ts) >= DEP_T : k === 'fdel' ? secOf(ts) >= FDEL_T : false;
async function rpData(){
  const recs = (await recsOf(today())).slice().sort((a,b) => a.ts - b.ts), p = (await pphOf(today())) || {}, cs = G('couriers') || [];
  const L = recs.map(r => cs.find(c => c.id === r.courierId)).filter(Boolean);
  return { L, rp: p.rp || {}, inb: p.inboundTs || null }; }
function rpRow(c, q, inb){ const nx = nextStep(q), dq = esc((c.name+' '+c.code+' '+(c.vendor||'')).toLowerCase());
  const pills = RS.map(k => '<i class="'+(q[k] ? (stLate(k,q[k])?'late':'ok') : '')+'">'+RN[k]+' '+(q[k]?hm(q[k]):'—')+'</i>').join('');
  const lock = nx === 'fs' && !inb;
  const btn = !nx ? '<button class="go fin" disabled>✓ ครบ'+(q.dep&&q.fdel?'<small>Stem '+Math.round((q.fdel-q.dep)/60000)+' น.</small>':'')+'</button>'
    : lock ? '<button class="go dis" disabled>รอ First IB</button>'
    : '<button class="go '+nx+'" data-rk="'+nx+'" data-rc="'+esc(c.id)+'">'+RN[nx]+'<small>กดตอนนี้</small></button>';
  return '<div class="rw'+(nx?'':' fin')+'" data-q="'+dq+'"><div class="nm"><span>'+esc(c.name)+'</span><div class="ps">'+pills+'</div></div>'+btn+'</div>'; }
async function renderRP(){
  if (CFOPEN) return;
  const host = TAB === 'fdel' ? $('fdList') : TAB === 'pph' ? $('rpList') : null; if (!host || !host.parentNode) { RPSIG = ''; return; }
  const { L, rp, inb } = await rpData();
  const s = L.map(c => c.id+':'+JSON.stringify(rp[c.id]||{})).join('|')+'#'+inb+'#'+host.id;
  let box = $('u2rp');
  if (box && box.nextSibling === host && s === RPSIG) return;
  RPSIG = s; if (!box){ box = document.createElement('div'); box.id = 'u2rp'; box.className = 'u2rp'; }
  if (box.nextSibling !== host) host.parentNode.insertBefore(box, host);
  const n = L.length, cnt = k => L.filter(c => (rp[c.id]||{})[k]).length;
  box.innerHTML = '<div class="sum">'+RS.map(k => '<div><b>'+cnt(k)+'/'+n+'</b>'+RN[k]+'</div>').join('')+'</div>'
    + '<input class="srch" id="u2rq" inputmode="search" placeholder="🔍 เลขท้ายรหัส / ชื่อ" value="'+esc(RPQ)+'">'
    + L.map(c => rpRow(c, rp[c.id]||{}, inb)).join('')
    + '<div class="lock" style="font-size:11.5px;color:var(--u-mut);background:#f3f0e7;border-radius:8px;padding:5px 8px">🔒 กดทีละขั้นตามจริง FS → ออกรถ → ส่งชิ้นแรก · ทุกครั้งต้องกดยืนยัน · ไม่มีการแก้เวลา</div>';
  const qi = $('u2rq'), flt = () => { const v = RPQ.trim().toLowerCase(); box.querySelectorAll('.rw').forEach(r => r.style.display = !v || r.dataset.q.includes(v) ? '' : 'none'); };
  qi.oninput = () => { RPQ = qi.value; flt(); }; flt();
  box.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { const c = L.find(x => String(x.id) === b.dataset.rc); if (c) confirmStep(c, b.dataset.rk); });
}
async function confirmStep(c, k){
  if (performance.now() < BUSY) return;
  const { rp, inb } = await rpData(), q = rp[c.id] || {};
  if (nextStep(q) !== k){ RPSIG = ''; renderRP(); return; }          /* อีกเครื่องกดไปแล้ว → วาดใหม่ */
  if (k === 'fs' && !inb){ (G('flash')||alert)('กด 📥 First Inbound ก่อน'); return; }
  const i = RS.indexOf(k), prev = i ? q[RS[i-1]] : null, gap = prev ? (Date.now() - prev)/60000 : null;
  const warn = prev && gap < RMIN[k] ? '⚠ เพิ่งกด '+RN[RS[i-1]]+' เมื่อ '+(gap < 1 ? 'ไม่ถึง 1 นาที' : Math.floor(gap)+' นาที')+'ที่แล้ว — แน่ใจว่า "'+esc(c.name)+'" '+RL[k]+' จริงแล้ว?' : '';
  const tag = k === 'dep' && secNow() >= DEP_T ? ' <span class="ch u-late">เลย 08:30</span>' : k === 'fdel' && secNow() >= FDEL_T ? ' <span class="ch u-late">เลย 09:00</span>' : '';
  CFOPEN = true;
  sheet('<div class="u2cf"><h3 style="margin:0">ยืนยัน: '+RL[k]+'</h3><div style="font-size:15px;font-weight:800;margin-top:4px">'+esc(c.name)+'</div><div style="font-size:12.5px;color:var(--u-mut)">'+esc(c.code)+' · '+esc(c.type||'')+' · '+esc(c.vendor||'')+'</div>'
    + '<div class="flow">'+RS.map((x,j) => (j?'<b>›</b>':'')+'<div class="'+(x===k?'cur':q[x]?'ok':'')+'">'+RN[x]+'<small>'+(q[x]?hm(q[x]):x===k?'ตอนนี้':'—')+'</small></div>').join('')+'</div>'
    + '<div class="when">เวลาที่จะบันทึก<b id="u2cft">'+hm(Date.now())+'</b>'+tag+'</div>'
    + (warn ? '<div class="warn">'+warn+'</div>' : '')
    + '<div style="font-size:12px;color:var(--u-mut);text-align:center;margin-top:8px">บันทึกแล้วแก้ไม่ได้ — ตรวจชื่อให้ถูกคนก่อนกด</div>'
    + '<button class="bt ok" id="u2cfy" disabled>รอสักครู่…</button><button class="bt o" id="u2cfn">ยกเลิก</button></div>');
  const y = $('u2cfy'), n = $('u2cfn'), wait = warn ? 2000 : 1000;
  const tm = setInterval(() => { const t = $('u2cft'); if (t) t.textContent = hm(Date.now()); }, 1000);
  const done = () => { clearInterval(tm); CFOPEN = false; closeSheet(); };
  setTimeout(() => { if (y){ y.disabled = false; y.textContent = '✓ ยืนยัน '+RN[k]; } }, wait);
  n.onclick = () => { done(); RPSIG = ''; renderRP(); };
  $('u2sh').onclick = e => { if (e.target.id === 'u2sh'){ done(); RPSIG = ''; renderRP(); } };
  y.onclick = async () => { if (y.disabled) return; y.disabled = true; BUSY = performance.now() + 1500; done();
    await call('rpStamp', c.id, k);
    const p2 = (await pphOf(today())) || {}, ok = ((p2.rp||{})[c.id]||{})[k];
    if (ok) (G('flash')||(()=>{}))('✓ '+RN[k]+' '+hm(ok)+' · '+String(c.name).split(' ')[0]);
    RPSIG = ''; setTimeout(renderRP, 150); TLSIG = ''; renderTL(); };
}
function hookRP(){ ['pphBody','fdelBody'].forEach(id => { const el = $(id); if (!el || el._u2) return; el._u2 = true;
  new MutationObserver(() => { if (ON){ RPSIG = ''; renderRP(); } }).observe(el, { childList:true }); }); }

/* ---------- รายงาน: ปุ่มส่ง Report 1 + 2 พร้อมกัน ---------- */
function hookReport(){ const m = $('repModal'); if (!m || m._u2) return; m._u2 = true;
  new MutationObserver(() => {
    if (!m.classList.contains('show')){ const b = $('u2share'); if (b) b.remove(); return; }
    if ($('u2share')) return; const dl = $('repDlFull'); if (!dl || !navigator.canShare) return;
    const b = document.createElement('button'); b.id = 'u2share'; b.className = dl.className; b.style.marginBottom = '8px'; b.textContent = '📤 ส่ง Report 1 + 2 พร้อมกัน (LINE)';
    dl.parentNode.insertBefore(b, dl);
    b.onclick = async () => { try { const k = (($('repTitle')||{}).textContent||'').includes(' ') ? today() : today(); const dep = depot(), f1 = await G('drawReport')(k), f2 = await G('drawSummary')(k);
        const bl = c => new Promise(ok => c.toBlob(ok, 'image/jpeg', .9));
        const files = [new File([await bl(f1)], dep+'_Report1_'+k+'.jpg', {type:'image/jpeg'}), new File([await bl(f2)], dep+'_Report2_'+k+'.jpg', {type:'image/jpeg'})];
        if (navigator.canShare({ files })) await navigator.share({ files, title:'รายงาน '+dep+' '+k }); else (G('flash')||alert)('เครื่องนี้ส่งพร้อมกันไม่ได้ — ใช้ปุ่มโหลดทีละไฟล์');
      } catch(e){ if (e && e.name !== 'AbortError') (G('flash')||alert)('ส่งไม่สำเร็จ — ใช้ปุ่มโหลดทีละไฟล์'); } };
  }).observe(m, { attributes:true, attributeFilter:['class'] }); }

/* ---------- เปิด / ปิด ---------- */
function mount(){
  if (ON) return; ON = true;
  const st = document.createElement('style'); st.id = 'u2css'; st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('ui2'); document.body.classList.toggle('u2sun', SUN);
  const tl = document.createElement('div'); tl.id = 'u2tl';
  const tb = document.querySelector('.topbar'); if (tb && tb.parentNode) tb.parentNode.insertBefore(tl, tb.nextSibling); else document.body.insertBefore(tl, document.body.firstChild);
  const ci = document.createElement('div'); ci.id = 'u2ci'; const v = $('view-checkin'); if (v) v.insertBefore(ci, v.firstChild);
  document.body.insertAdjacentHTML('beforeend', '<div id="u2nav"></div><div id="u2sh"><div class="bx" id="u2shb"></div></div>');
  $('u2sh').onclick = e => { if (e.target.id === 'u2sh') closeSheet(); };
  const act = document.querySelector('.view.active'); TAB = act ? act.id.replace('view-','') : 'checkin';
  hookReport(); hookRP(); renderNav(); TLSIG=''; renderTL(); loadUsual().then(renderCI); renderPD();
}
function unmount(){ if (!ON) return; ON = false; ['u2css','u2tl','u2ci','u2nav','u2sh','u2pd','u2rp'].forEach(i => { const e = $(i); if (e) e.remove(); }); document.body.classList.remove('ui2','u2sun'); }
async function tick(){
  try {
    const want = ready() && UI2.includes(depot());
    if (!want){ unmount(); return; }
    mount();
    const act = document.querySelector('.view.active'); const cur = act ? act.id.replace('view-','') : TAB;
    if (cur !== TAB){ TAB = cur; renderNav(); }
    await renderTL();
    if (TAB === 'checkin'){ const s = await sig(); const typing = performance.now() - LASTTYPE < 4000;   /* กำลังพิมพ์ค้นหา — รอพิมพ์เสร็จก่อนค่อยวาดใหม่ */ if (s !== SIG && !typing) await renderCI(); }
    if (TAB === 'pd') await renderPD();
    if ((TAB === 'pph' || TAB === 'fdel') && !(document.activeElement && document.activeElement.id === 'u2rq')) await renderRP();
  } catch(e){ console.warn('[ui2] ถอดหน้าตาใหม่ชั่วคราว', e); try { unmount(); } catch(x){} }
}
setInterval(tick, 2000); setTimeout(tick, 800);
window.addEventListener('online', () => { TLSIG=''; renderTL(); }); window.addEventListener('offline', () => { TLSIG=''; renderTL(); });
window.DHLUI2 = { ver: UI2_VER, list: UI2, on: () => ON };
})();

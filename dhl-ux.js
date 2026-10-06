/* ============================================================
   dhl-ux.js — ข้อดีจาก UPC Staff สำหรับระบบเดิม (ทีม BKK 7 สาขา)  · 1 ต.ค. 2569
   🔊 เสียง · 📥 การ์ดเด้ง · 🎉 ฉลอง+พลุ · 🔔 Pop Up เตือนทุก 15 นาทีหลัง 07:00
   ⚠ แบบ "ส่วนเสริม": อ่านอย่างเดียว ไม่แตะข้อมูล/การบันทึก/การซิงค์ · ผิดพลาดอะไร = เงียบ แอปเดิมทำงานตามปกติ
   ปิดทั้งหมดได้ทันที: ลบบรรทัด import('./dhl-ux.js') ใน DHL_Courier_Attendance.html
   ============================================================ */
(function(){
'use strict';
const UX_VER = '2026.10.01-a';
const TEAM = ['PHI','BPE','PWT','PKS','DST','BPL','PWN','KTN','TEST'];   /* เปิดเฉพาะทีม BKK (+ สาขาทดสอบ TEST) */
const G = n => { try { return (0,eval)(n); } catch(e){ return undefined; } };
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const hm = ts => { const d = new Date(ts); return pad(d.getHours())+':'+pad(d.getMinutes()); };
const secNow = () => { const d = new Date(); return d.getHours()*3600+d.getMinutes()*60+d.getSeconds(); };
const CUT = 7*3600;
const settings = () => G('settings') || null;
const depot = () => { const s = settings(); return (s && s.depot) || (window.DHLSync && window.DHLSync.depot) || ''; };
const on = () => TEAM.includes(depot()) && window.DHLSync && window.DHLSync.ready;

/* ---------- เสียง (สร้างเอง ไม่โหลดไฟล์) ---------- */
let ACX = null;
function acx(){ try { if (!ACX) ACX = new (window.AudioContext||window.webkitAudioContext)(); if (ACX.state === 'suspended') ACX.resume(); } catch(e){ ACX = null; } return ACX; }
function tone(f,t0,dur,type,vol,f2){ const c = acx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
  o.type = type||'triangle'; o.frequency.setValueAtTime(f,t); if (f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||.18,t+.006); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.02); }
function noise(t0,dur,vol,type,freq){ const c = acx(); if (!c) return; const t = c.currentTime+t0, n = Math.floor(c.sampleRate*dur), b = c.createBuffer(1,n,c.sampleRate), d = b.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = (Math.random()*2-1)*(1-i/n); const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; fl.type = type||'bandpass'; fl.frequency.value = freq||1800; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(t); }
function brass(f,t0,dur,vol){ const c = acx(); if (!c) return; const t = c.currentTime+t0, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900,t); fl.frequency.linearRampToValueAtTime(2600,t+.08);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.03); g.gain.setValueAtTime(vol,t+dur*.7); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(fl); fl.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.02); }
function fanfare(full){ const roll = full?14:8; for (let i=0;i<roll;i++) noise(i*.045,.05,.12+i*.012,'bandpass',1200);
  const s = roll*.045, run = full?[392,523,659,784]:[523,659]; run.forEach((f,i)=>brass(f,s+i*.11,.14,.14));
  const top = s+run.length*.11; (full?[262,523,659,784,1047]:[523,659,784]).forEach(f=>brass(f,top,full?1.5:.9,full?.11:.1));
  noise(top,full?1.4:.8,.22,'highpass',6000); [2093,2637,3136].forEach((f,i)=>tone(f,top+.15+i*.07,.35,'sine',.05)); }
const SFX = { ok:()=>{ tone(1047,0,.09,'triangle',.2); tone(1568,.08,.16,'triangle',.2); tone(3136,.08,.12,'sine',.04); },
  late:()=>tone(659,0,.16,'triangle',.15), bell:()=>{ tone(880,0,.12,'triangle',.16); tone(880,.16,.16,'triangle',.16); },
  win:()=>fanfare(true), small:()=>fanfare(false) };
function sfx(k){ try { SFX[k] && SFX[k](); } catch(e){} }
document.addEventListener('pointerdown', () => acx(), { passive:true, once:true });

/* ---------- หน้าจอ ---------- */
function mount(){
  if ($('uxPop')) return;
  const st = document.createElement('style'); st.textContent = `
#uxPop{position:fixed;left:12px;right:12px;top:12px;max-width:480px;margin:0 auto;background:#fff;border-radius:18px;padding:10px 12px;display:flex;align-items:center;gap:10px;z-index:9990;box-shadow:0 10px 30px rgba(0,0,0,.22);transform:translateY(-160%);transition:transform .35s cubic-bezier(.2,1.4,.4,1);font-family:inherit}
#uxPop.on{transform:none}#uxPop img{width:44px;height:58px;border-radius:10px;object-fit:cover;background:#f3f0e7;flex:none}
#uxPop .t1{font-weight:800;font-size:15px}#uxPop .t2{font-size:13px;color:#666}#uxPop.late{border:2px solid #f1d27a}
#uxPop svg{width:40px;height:40px;margin-left:auto;flex:none}#uxPop svg path{fill:none;stroke:#2e7d32;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30}
#uxPop.on svg path{animation:uxdraw .45s .2s forwards}@keyframes uxdraw{to{stroke-dashoffset:0}}
#uxCele{position:fixed;inset:0;z-index:9995;background:rgba(255,204,0,.97);display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:26px;overflow:hidden;font-family:inherit}
#uxCele.on{display:flex}#uxCele canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#uxCele .md{width:96px;height:96px;border-radius:50%;background:#D40511;color:#fff;display:grid;place-items:center;font-size:52px;font-weight:900;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.2)}
#uxCele h2{font-size:25px;font-weight:900;color:#D40511;margin:16px 0 0;position:relative}#uxCele .wh{font-size:18px;font-weight:800;color:#3b2f00;margin-top:4px;position:relative}
#uxCele .bx{background:#fff;border-radius:14px;padding:9px 12px;margin-top:10px;font-size:14px;position:relative;line-height:1.6;max-width:420px}
#uxCele .lm{color:#C62828;font-weight:700}#uxCele .lm span{display:inline-block;background:#FDEAEA;border-radius:8px;padding:1px 8px;margin:2px;font-weight:600}
#uxCele button,#uxRem button{border:0;border-radius:14px;padding:12px 16px;font-weight:800;font-size:15px;font-family:inherit;cursor:pointer}
#uxRem{position:fixed;inset:0;z-index:9993;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:18px;font-family:inherit}
#uxRem.on{display:flex}#uxRem .bx{background:#fff;border-radius:22px;padding:16px;width:100%;max-width:420px;max-height:85vh;overflow:auto;text-align:center}
#uxRem .bl{font-size:40px;animation:uxring 1s ease 2}@keyframes uxring{0%,100%{transform:rotate(0)}20%{transform:rotate(18deg)}40%{transform:rotate(-16deg)}60%{transform:rotate(10deg)}80%{transform:rotate(-6deg)}}
#uxRem .w{display:flex;justify-content:space-between;align-items:center;background:#FDEAEA;border-radius:12px;padding:11px 12px;margin-top:7px;font-weight:700;cursor:pointer;text-align:left}
#uxRem .w span{font-size:12px;color:#C62828;white-space:nowrap}`;
  document.head.appendChild(st);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="uxPop"><img id="uxPopImg" alt=""><div><div class="t1" id="uxPopT1"></div><div class="t2" id="uxPopT2"></div></div><svg id="uxPopTick" viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#e6f5eb"/><path d="M12 21l6 6 11-13"/></svg></div>'
   +'<div id="uxCele"><canvas id="uxConf"></canvas><div class="md">✓</div><h2 id="uxCeleH"></h2><div class="wh" id="uxCeleW"></div><div class="bx" id="uxCeleS"></div><div class="bx lm" id="uxCeleL" style="display:none"></div><div style="margin-top:14px;position:relative"><button style="background:#1a1a1a;color:#FFCC00" onclick="document.getElementById(\'uxCele\').classList.remove(\'on\')">ปิด</button></div></div>'
   +'<div id="uxRem"><div class="bx"><div class="bl">🔔</div><h3 style="margin:4px 0">ยังลงข้อมูลไม่ครบ</h3><div id="uxRemS" style="font-size:13px;color:#777"></div><div id="uxRemL"></div><div style="margin-top:12px"><button style="background:#FFCC00;width:100%" onclick="document.getElementById(\'uxRem\').classList.remove(\'on\')">รับทราบ</button></div></div></div>');
}

/* ---------- ข้อมูล (อ่านอย่างเดียว) ---------- */
function actCouriers(){ const L = G('couriers') || [], rm = (window.dsRemovedIds && window.dsRemovedIds()) || [];
  return L.filter(c => c && c.active !== false && !rm.map(Number).includes(Number(c.id))); }
function absMap(){ const a = window.DHLSync && window.DHLSync.absent; return (a && typeof a === 'object') ? a : {}; }
async function recsToday(){ try { const tk = G('todayKey'), gb = G('getByDate'); if (!tk || !gb) return null; return await gb(tk()); } catch(e){ return null; } }
function pendingList(recs){ const ids = new Set(recs.map(r => Number(r.courierId))), ab = absMap();
  return actCouriers().filter(c => !ids.has(Number(c.id)) && !ab[String(c.id)]); }
const busy = () => ['camOverlay','uxCele','uxRem','dsLogin'].some(i => { const e = $(i); return e && (e.classList.contains('show') || e.classList.contains('on')); });

/* ---------- การ์ดเด้ง ---------- */
let popT = null;
function pop(rec, left){ const c = actCouriers().find(x => Number(x.id) === Number(rec.courierId)) || {}, ok = rec.status !== 'late', e = $('uxPop'); if (!e) return;
  $('uxPopImg').src = rec.photo || ''; $('uxPopImg').style.display = rec.photo ? '' : 'none';
  $('uxPopT1').textContent = c.name || ('#'+rec.courierId);
  $('uxPopT2').textContent = (ok ? 'Ontime · ' : 'บันทึกแล้ว · Late · ') + hm(rec.ts) + (left ? ' · เหลืออีก '+left+' คน' : '');
  $('uxPopTick').style.display = ok ? '' : 'none'; e.classList.toggle('late', !ok); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
  clearTimeout(popT); popT = setTimeout(() => e.classList.remove('on'), 2300);
  try { navigator.vibrate && navigator.vibrate(ok ? [40] : [20,60,20]); } catch(x){}
  setTimeout(() => sfx(ok ? 'ok' : 'late'), 120); }

/* ---------- ฉลอง ---------- */
function celebrate(recs){ const late = recs.filter(r => r.status === 'late'), perfect = !late.length, L = actCouriers(), ab = absMap();
  const fin = Math.max(...recs.map(r => +r.ts || 0)), fd = new Date(fin), early = Math.floor((CUT - (fd.getHours()*3600+fd.getMinutes()*60))/60);
  const nm = id => { const c = L.find(x => Number(x.id) === Number(id)); return c ? String(c.name).split(' ')[0] : '#'+id; };
  $('uxCeleH').textContent = perfect ? 'ยอดเยี่ยม Ontime ทุกคน!' : 'ครบแล้ว ขอบคุณมาก';
  const s = settings(); $('uxCeleW').textContent = 'ขอบคุณ ' + ((s && s.staff) || (window.DHLSync && window.DHLSync.staff) || '');
  const nab = Object.keys(ab).length;
  $('uxCeleS').innerHTML = '<b>'+(recs.length-late.length)+' / '+recs.length+' Ontime</b><br>'+(nab ? 'ขาด/ลา '+nab+' คน · ' : '')+'ครบเวลา '+hm(fin)+(early > 0 ? ' · ก่อนเวลาเข้างาน '+early+' นาที' : '');
  const lm = $('uxCeleL');
  if (perfect) lm.style.display = 'none';
  else { lm.style.display = 'block'; lm.innerHTML = 'อย่าลืมโฟกัสการสื่อสารกับผู้ที่มาสายน้าา<br>' + late.sort((a,b)=>a.ts-b.ts).map(r => '<span>'+esc(nm(r.courierId))+' '+hm(r.ts)+'</span>').join(''); }
  $('uxCele').classList.add('on'); confetti(perfect ? 90 : 30); sfx(perfect ? 'win' : 'small'); }
function confetti(n){ try { const c = $('uxConf'), x = c.getContext('2d'); if (!x) return; const W = c.width = innerWidth, H = c.height = innerHeight;
  const Q = Array.from({length:n}, () => ({ x:W/2, y:H*.4, vx:(Math.random()-.5)*10, vy:-Math.random()*12-3, r:Math.random()*6+5, c:['#D40511','#ffffff','#1a1a1a','#D40511'][Math.floor(Math.random()*4)], a:Math.random()*6 }));
  let f = 0; (function tk(){ x.clearRect(0,0,W,H); Q.forEach(p => { p.vy += .3; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); x.restore(); }); if (++f < 160) requestAnimationFrame(tk); else x.clearRect(0,0,W,H); })(); } catch(e){} }

/* ---------- Pop Up เตือน ---------- */
function showRem(list){ if (!list.length) return;
  $('uxRemS').textContent = 'เลยเวลาเข้างาน 07:00 น. แล้ว · ยังไม่ลงเวลา '+list.length+' คน — แตะชื่อเพื่อไปถ่ายเลย';
  $('uxRemL').innerHTML = list.map((c,i) => '<div class="w" data-i="'+i+'">'+esc(c.name)+'<span>ไปถ่ายเลย ›</span></div>').join('');
  $('uxRemL').querySelectorAll('.w').forEach(el => el.onclick = () => { $('uxRem').classList.remove('on'); const c = list[+el.dataset.i]; if (!c) return;
    try { const nav = G('nav'); if (nav) nav('checkin'); } catch(e){}
    try { const oc = G('openCamera'); if (oc) Promise.resolve(oc(c.id)).catch(()=>{}); } catch(e){} });   /* ใช้ id ชนิดเดิมของแอป */
  $('uxRem').classList.add('on'); sfx('bell'); try { navigator.vibrate && navigator.vibrate([80,60,80]); } catch(x){} }

/* ---------- ตัวเฝ้าดู (ทุก 1.5 วินาที) ---------- */
let SEEN = null, DAY = '', REMSLOT = null;
async function tick(){
  try {
    if (!on()) return; mount();
    const tk = G('todayKey'); const day = tk ? tk() : ''; if (day !== DAY){ DAY = day; SEEN = null; REMSLOT = null; }
    const recs = await recsToday(); if (!recs) return;
    const me = (settings() && settings().staff) || (window.DHLSync && window.DHLSync.staff) || '';
    const pend = pendingList(recs);
    if (SEEN === null){ SEEN = new Set(recs.map(r => r.courierId+'|'+r.ts)); }
    else {
      const fresh = recs.filter(r => !SEEN.has(r.courierId+'|'+r.ts)); fresh.forEach(r => SEEN.add(r.courierId+'|'+r.ts));
      const mine = fresh.filter(r => !r.staff || r.staff === me).sort((a,b)=>b.ts-a.ts);   /* เด้ง/มีเสียงเฉพาะที่เครื่องนี้ลง */
      if (mine.length) pop(mine[0], pend.length);
      const key = 'uxCele_'+depot()+'_'+day;
      let done1 = null; try { done1 = localStorage.getItem(key); } catch(e){}
      if (mine.length && !pend.length && recs.length && !done1){ try { localStorage.setItem(key,'1'); } catch(e){} setTimeout(() => celebrate(recs), 900); }
    }
    const s = secNow();
    if (pend.length && s >= CUT && document.visibilityState === 'visible'){
      const slot = Math.floor((s - CUT)/900);
      if (slot !== REMSLOT && !busy()){ REMSLOT = slot; showRem(pend); }
    }
  } catch(e){ /* เงียบ — ไม่กระทบแอป */ }
}
setInterval(tick, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') REMSLOT = null; });   /* กลับเข้าแอป → เตือนทันทีถ้ายังไม่ครบ */
window.DHLUX = { ver: UX_VER, test: () => { mount(); sfx('ok'); } };
})();

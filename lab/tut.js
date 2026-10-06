
/* ============================================================
   🎓 Tutorial สาขาฝึก TEST (หน้าเดิม) — พาทำทีละขั้น 8 ขั้นสั้นๆ   · 6 ต.ค. 2569
   • แสดงเฉพาะสาขา TEST เท่านั้น · สาขาจริงไม่เห็นเลย
   • ไฮไลต์ปุ่มที่ต้องกด + ตรวจเองว่าทำสำเร็จแล้วค่อยไปขั้นถัดไป · ข้าม/ปิดได้ทุกเมื่อ · เปิดใหม่ได้ที่ปุ่ม 🎓
   ============================================================ */
(function(){
'use strict';
const G = n => { try { return (0,eval)(n); } catch(e){ return undefined; } };
const $ = s => document.querySelector(s);
const dep = () => { const s = G('settings'); return (s && s.depot) || (window.DHLSync && window.DHLSync.depot) || ''; };
const today = () => { try { return G('todayKey')(); } catch(e){ return ''; } };
const recs = async () => { try { return (await G('getByDate')(today())) || []; } catch(e){ return []; } };
const pph = async () => { try { return (await G('getPPH')(today())) || {}; } catch(e){ return {}; } };
const ls = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
const vis = el => el && el.offsetParent !== null;
const navBtn = v => $('.nav button[data-v="'+v+'"]');
const firstVisible = sel => [...document.querySelectorAll(sel)].find(vis) || null;

/* ขั้นตอน: t=หัวข้อ, d=คำอธิบาย, el=ปุ่มที่ต้องกด (ตามสถานะ), ok=ทำสำเร็จหรือยัง */
const STEPS = [
  { t:'👋 ยินดีต้อนรับสู่สาขาฝึก', d:'สาขา TEST ใช้ฝึกเท่านั้น ข้อมูลไม่นับจริง กดผิดได้ไม่ต้องกลัว<br>ใช้เวลาประมาณ 3 นาที', info:true },
  { t:'📷 ขั้น 1 · เช็คอิน', d:'แตะปุ่ม <b>📷</b> ที่ชื่อ Courier คนไหนก็ได้ แล้วกด<b>ปุ่มวงกลม</b>เพื่อถ่ายรูป<br>เวลาเข้างาน = เวลาที่ถ่ายรูปจริง',
    el:()=>{ if (!vis($('#view-checkin'))) return navBtn('checkin'); return $('#camOverlay.show .shutter') || firstVisible('#ciList [onclick^="openCamera("]:not([onclick*=","])') || firstVisible('#ciList [onclick^="openCamera("]'); },
    ok:async()=> (await recs()).length > 0 },
  { t:'↺ ขั้น 2 · ถ่ายผิดคน ทำยังไง', d:'ถ้าถ่ายผิดคน กดปุ่ม <b>บันทึกใหม่ ↺</b> ที่รายการนั้น ระบบจะลบแล้วให้ถ่ายใหม่<br>(ลองกดหรือข้ามก็ได้)', info:true,
    el:()=> vis($('#view-checkin')) ? firstVisible('#ciList [onclick^="redo("]') : null },
  { t:'📸 ขั้น 3 · ภาพประชุม PD', d:'ไปแท็บ <b>2️⃣ PD</b> แล้วกด <b>ถ่ายภาพประชุมรวม</b> (ถือมือถือแนวนอน) → กด <b>✔ บันทึกภาพนี้</b><br>ต้องถ่ายไม่เกิน 07:15',
    el:()=>{ if ($('#pdPreview.show')) return firstVisible('#pdPreview [onclick="savePDPhoto()"]'); if ($('#camOverlay.show')) return $('#camOverlay .shutter'); if (!vis($('#view-pd'))) return navBtn('pd'); return firstVisible('#pdCard button'); },
    ok:async()=>{ const p = await pph(); return !!(p.pd && p.pd.ts); } },
  { t:'📦 ขั้น 4 · PPH', d:'ไปแท็บ <b>3️⃣ PPH</b> กรอก <b>จำนวน Staff</b> และ <b>พัสดุ</b> แล้วกด <b>📥 First Inbound</b> ตอนรถเข้า',
    el:()=>{ if (!vis($('#view-pph'))) return navBtn('pph'); const p = $('#pphBody input[onchange*="pNew"]'); if (p && !(+p.value > 0)) return p;
      return [...document.querySelectorAll('#pphBody button')].find(b=>vis(b) && /First Inbound/.test(b.textContent)) || null; },
    ok:async()=>{ const p = await pph(); return !!p.inboundTs; } },
  { t:'🛵 ขั้น 5 · FS และ ออกรถ', d:'ในแท็บ PPH ส่วน <b>Route prep</b> กด <b>FS</b> ตอนจัดรถเสร็จ แล้วกด <b>DEP</b> ตอนรถออก ของคนที่เช็คอิน',
    el:()=>{ if (!vis($('#view-pph'))) return navBtn('pph'); return firstVisible('#rpList button[onclick*="\'fs\'"]:not(.btn-o)') || firstVisible('#rpList button[onclick*="\'dep\'"]:not(.btn-o)') || firstVisible('#rpList button'); },
    ok:async()=>{ const p = await pph(); return Object.values(p.rp||{}).some(q=>q && q.dep); } },
  { t:'🎯 ขั้น 6 · ส่งชิ้นแรก', d:'ไปแท็บ <b>4️⃣ First Del</b> แล้วกด <b>First Del</b> ตอน Courier ส่งพัสดุชิ้นแรก',
    el:()=>{ if (!vis($('#view-fdel'))) return navBtn('fdel'); return firstVisible('#fdList button:not([disabled])'); },
    ok:async()=>{ const p = await pph(); return Object.values(p.rp||{}).some(q=>q && q.fdel); } },
  { t:'📄 ขั้น 7 · ส่งรายงาน', d:'ไปแท็บ <b>📊 สรุปผล</b> แล้วกด <b>สร้างรายงานวันนี้</b> → ดาวน์โหลด/ส่งใน LINE ให้หัวหน้า', info:true,
    el:()=>{ if (!vis($('#view-dash'))) return navBtn('dash'); return firstVisible('#view-dash button[onclick^="openReport"]'); } },
  { t:'🎉 เก่งมาก! ครบทุกขั้นแล้ว', d:'พร้อมใช้งานจริงแล้ว · อยากฝึกซ้ำ กดปุ่ม <b>🎓</b> มุมจอได้ทุกเมื่อ<br>(ผู้ดูแลล้างข้อมูลฝึกให้เริ่มใหม่ได้)', info:true, last:true }
];

const CSS = `#tutCard{position:fixed;left:10px;right:10px;bottom:84px;z-index:9990;max-width:520px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:18px;padding:14px 14px 12px;box-shadow:0 10px 30px rgba(0,0,0,.45);font-family:inherit;animation:tutUp .3s ease}
@keyframes tutUp{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
#tutCard h4{margin:0 0 4px;font-size:16px;color:#FFCC00} #tutCard p{margin:0;font-size:13.5px;line-height:1.55;color:#eee}
#tutCard .dots{display:flex;gap:4px;margin:10px 0 8px} #tutCard .dots i{flex:1;height:4px;border-radius:4px;background:#444} #tutCard .dots i.on{background:#FFCC00}
#tutCard .bt{display:flex;gap:8px;justify-content:flex-end;align-items:center} #tutCard button{border:0;border-radius:99px;padding:8px 14px;font-weight:800;font-size:13px;font-family:inherit;cursor:pointer}
#tutCard .sk{background:transparent;color:#aaa} #tutCard .nx{background:#FFCC00;color:#1a1a1a} #tutCard .nx[disabled]{background:#555;color:#999}
#tutCard .st{margin-right:auto;font-size:12px;color:#8fd19e;font-weight:700}
.tut-hl{outline:3px solid #FFCC00!important;outline-offset:3px;animation:tutPulse 1.1s ease-in-out infinite;position:relative;z-index:2}
@keyframes tutPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,204,0,.75)}50%{box-shadow:0 0 0 10px rgba(255,204,0,0)}}
#tutFab{position:fixed;left:10px;bottom:96px;z-index:9989;width:42px;height:42px;border-radius:50%;border:0;background:#FFCC00;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;display:none}`;

let IDX = 0, OPEN = false, HL = null, DONE = false, TICK = null;
function hl(el){ if (HL === el) return; if (HL) HL.classList.remove('tut-hl'); HL = el; if (el){ el.classList.add('tut-hl'); try{ el.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){} } }
function render(){
  let c = $('#tutCard'); const s = STEPS[IDX];
  if (!c){ c = document.createElement('div'); c.id = 'tutCard'; document.body.appendChild(c); }
  c.innerHTML = '<h4>'+s.t+'</h4><p>'+s.d+'</p><div class="dots">'+STEPS.slice(1).map((x,i)=>'<i class="'+(i<IDX?'on':'')+'"></i>').join('')+'</div>'
    + '<div class="bt"><span class="st" id="tutSt"></span>'+(s.last?'':'<button class="sk" id="tutSk">ปิด</button>')
    + '<button class="nx" id="tutNx"'+(s.info?'':' disabled')+'>'+(IDX===0?'เริ่มเลย ›':s.last?'เสร็จสิ้น':'ถัดไป ›')+'</button></div>';
  $('#tutNx').onclick = () => { if (s.last){ close(true); return; } IDX++; ls.set('tutIdx', String(IDX)); render(); };
  const sk = $('#tutSk'); if (sk) sk.onclick = () => close(false);
  DONE = !!s.info;
}
async function tick(){
  if (!OPEN) return; const s = STEPS[IDX];
  try { hl(s.el ? s.el() : null); } catch(e){ hl(null); }
  if (s.ok && !DONE){ let ok = false; try { ok = await s.ok(); } catch(e){}
    if (ok){ DONE = true; const n = $('#tutNx'), st = $('#tutSt'); if (n) n.disabled = false; if (st) st.textContent = '✔ ทำได้แล้ว!'; hl(null);
      try { if (window.navigator.vibrate) navigator.vibrate(60); } catch(e){} } }
}
function open(from){ if (OPEN) return; OPEN = true; IDX = from != null ? from : (+ls.get('tutIdx') || 0); if (IDX >= STEPS.length) IDX = 0; render(); $('#tutFab').style.display = 'none'; TICK = setInterval(tick, 700); tick(); }
function close(finished){ OPEN = false; clearInterval(TICK); hl(null); const c = $('#tutCard'); if (c) c.remove(); $('#tutFab').style.display = 'block';
  if (finished){ ls.set('tutDone', '1'); ls.set('tutIdx', '0'); } }
function mount(){
  if ($('#tutFab')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const f = document.createElement('button'); f.id = 'tutFab'; f.textContent = '🎓'; f.title = 'Tutorial'; f.onclick = () => open(+ls.get('tutIdx') || 0); document.body.appendChild(f);
  f.style.display = 'block';
  if (!ls.get('tutDone')) setTimeout(() => open(), 1200);   /* เข้าสาขาฝึกครั้งแรก → เปิดให้อัตโนมัติ */
}
function unmount(){ if (OPEN) close(false); ['tutFab','tutCard'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); }
/* แสดงเฉพาะสาขา TEST + หน้าเดิม (ไม่ใช่หน้าใหม่ ui2) + เข้าระบบแล้ว */
setInterval(() => { try {
  const want = dep() === 'TEST' && window.DHLSync && window.DHLSync.ready && !(window.DHLUI2 && window.DHLUI2.on && window.DHLUI2.on());
  if (want) mount(); else unmount();
} catch(e){} }, 1500);
window.DHLTut = { open, close, steps: STEPS.length };
})();

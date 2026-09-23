/* ===================================================================
   dhl-photos.js  —  📷 ย้อนหลัง : เลือกวันที่ ดูรูปเช็คอินทุกสาขา
   ใช้กับ DHL_Manager_Live.html เท่านั้น
   รูปเก็บในระบบ 30 วัน (ลบอัตโนมัติ) — ย้อนได้ไกลสุด 30 วัน
   Design By Winnie
   =================================================================== */
export const PH_VER = '2026.09.23-ph2';

const KEEP_DAYS = 30;
const CUT = 25200;   // 07:00:00

let C = null;
let PH_DATE = null;
let PH_LOADING = false;
const DAYS = {};
const PICS = {};
const OPEN = {};

const S   = () => C.get();
const esc = s => C.esc(s);
const sec = ts => C.secOf(ts);
const pad = n => String(n).padStart(2,'0');
const hm  = ts => { const d=new Date(ts); return pad(d.getHours())+':'+pad(d.getMinutes()); };

function todayKey(){ return S().DATE; }
function minKey(){
  const d=new Date(todayKey()+'T00:00:00');
  d.setDate(d.getDate()-(KEEP_DAYS-1));
  return d.toISOString().slice(0,10);
}
function shift(k,n){ const d=new Date(k+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function clampDate(k){
  if(k>todayKey()) return todayKey();
  if(k<minKey()) return minKey();
  return k;
}
function curDate(){ return PH_DATE || todayKey(); }
function thaiDate(k){
  const d=new Date(k+'T00:00:00');
  const D=['อา','จ','อ','พ','พฤ','ศ','ส'][d.getDay()];
  const M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][d.getMonth()];
  return D+' '+d.getDate()+' '+M+' '+(d.getFullYear()+543);
}

let CSS_DONE=false;
function injectCss(){
  if(CSS_DONE) return; CSS_DONE=true;
  const s=document.createElement('style');
  s.textContent=[
  '#viewPh{--phY:#FFCC00;--phK:#171717;--phLine:#e6e2da;--phRed:#c0392b;--phGrn:#12784a}',
  '#viewPh *{box-sizing:border-box}',
  '#viewPh .phCard{background:#fff;border:1px solid var(--phLine);border-radius:14px;padding:14px 16px;margin:0 0 12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}',
  '#viewPh .phBar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
  '#viewPh .phBtn{height:34px;padding:0 13px;border:1px solid var(--phLine);border-radius:9px;background:#fff;color:#55504a;font:700 12.5px inherit;cursor:pointer;white-space:nowrap;transition:.14s}',
  '#viewPh .phBtn:hover{border-color:#bdb7ad;color:var(--phK)}',
  '#viewPh .phBtn.on{background:var(--phK);border-color:var(--phK);color:var(--phY)}',
  '#viewPh .phBtn[disabled]{opacity:.35;cursor:not-allowed}',
  '#viewPh .phDate{height:34px;border:1px solid var(--phLine);border-radius:9px;padding:0 10px;font:700 13px inherit;background:#fff;color:var(--phK)}',
  '#viewPh .phNote{font-size:12px;line-height:1.55;color:#7d776b}',
  '#viewPh .phDep{border:1px solid var(--phLine);border-radius:12px;margin:0 0 9px;overflow:hidden;background:#fff}',
  '#viewPh .phHd{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;background:#faf8f4;transition:.13s}',
  '#viewPh .phHd:hover{background:#fffbe8}',
  '#viewPh .phHd .nm{font:800 14px inherit;color:var(--phK)}',
  '#viewPh .phHd .s2{font:600 11.5px inherit;color:#8a8478}',
  '#viewPh .phHd .ar{margin-left:auto;font-size:12px;color:#8a8478}',
  '#viewPh .phBody{padding:12px 13px;border-top:1px solid var(--phLine)}',
  '#viewPh .phGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}',
  '#viewPh .phIt{border:1px solid var(--phLine);border-radius:11px;overflow:hidden;background:#fff}',
  '#viewPh .phIt.late{border-color:#f0c5bf;background:#fffaf9}',
  '#viewPh .phImg{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;background:#f2efe9;cursor:zoom-in}',
  '#viewPh .phNo{width:100%;aspect-ratio:3/4;display:grid;place-items:center;background:#f5f2ec;color:#b3ada1;font-size:11.5px;line-height:1.5;text-align:center;padding:6px}',
  '#viewPh .phNo.lost{background:#fdecea;color:#b3261e;font-weight:800}',
  '#viewPh .phNo.never{background:#fff5db;color:#8a5d00;font-weight:800}',
  '#viewPh .phNo small{display:block;font-weight:600;opacity:.75;font-size:10px;margin-top:3px}',
  '#viewPh .phMeta{padding:8px 9px 9px}',
  '#viewPh .phMeta .c{font:800 12.5px inherit;color:var(--phK)}',
  '#viewPh .phMeta .n{font:600 11px inherit;color:#8a8478;line-height:1.35;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#viewPh .phMeta .t{margin-top:5px;display:flex;align-items:center;gap:6px}',
  '#viewPh .phMeta .t b{font:800 14px inherit;font-variant-numeric:tabular-nums;color:var(--phK)}',
  '#viewPh .tgg{display:inline-block;padding:2px 8px;border-radius:999px;font:800 10.5px inherit;white-space:nowrap}',
  '#viewPh .phEmpty{padding:24px 10px;text-align:center;color:#a8a296;font-size:13px}',
  '#phZoom{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;padding:18px;cursor:zoom-out}',
  '#phZoom.on{display:flex}',
  '#phZoom img{max-width:100%;max-height:82vh;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5)}',
  '#phZoom .cap{position:absolute;left:0;right:0;bottom:22px;text-align:center;color:#fff;font:700 14px inherit;text-shadow:0 1px 3px rgba(0,0,0,.7)}'
  ].join('\n');
  document.head.appendChild(s);
  const z=document.createElement('div');
  z.id='phZoom';
  z.innerHTML='<img alt=""><div class="cap"></div>';
  z.onclick=()=>z.classList.remove('on');
  document.body.appendChild(z);
}

async function loadDay(){
  const date=curDate(), deps=S().DEPOTS, need=deps.filter(d=>!((d+'|'+date) in DAYS));
  if(!need.length) return;
  PH_LOADING=true; paint();
  await Promise.all(need.map(dep =>
    C.getDoc(C.doc(C.db,'depots',dep,'days',date))
      .then(s=>{ DAYS[dep+'|'+date] = s.exists()? s.data() : null; })
      .catch(()=>{ DAYS[dep+'|'+date] = null; })
  ));
  PH_LOADING=false; paint();
}

async function loadPics(dep){
  const date=curDate(), key=dep+'|'+date;
  if(PICS[key]) return;
  const d=DAYS[key]; if(!d){ PICS[key]={}; return; }
  const cids=Object.keys(d.checkins||{});
  PICS[key]='loading'; paint();
  const out={};
  for(let i=0;i<cids.length;i+=12){
    await Promise.all(cids.slice(i,i+12).map(cid =>
      C.getDoc(C.doc(C.db,'depots',dep,'photos','ci_'+cid+'_'+date))
        .then(s=>{ if(s.exists() && s.data().d) out[cid]=s.data().d; })
        .catch(()=>{})
    ));
  }
  PICS[key]=out; paint();
}

function cmapOf(dep){
  const st=S(), m={}, add=l=>(l||[]).forEach(c=>{ if(c&&c.id!=null) m[c.id]=c; });
  add(st.META[dep]&&st.META[dep].couriers);
  const d=DAYS[dep+'|'+curDate()]; if(d) add(d.couriers);
  add(st.DATA[dep]&&st.DATA[dep].couriers);
  return m;
}

function paint(){
  const el=document.getElementById('viewPh'); if(!el) return;
  injectCss();
  const date=curDate(), deps=S().DEPOTS;
  const isToday = date===todayKey();
  const atMin = date<=minKey();

  let tot=0, late=0, never=0, lost=0;
  deps.forEach(dep=>{
    const d=DAYS[dep+'|'+date]; if(!d) return;
    const pk=PICS[dep+'|'+date];
    Object.keys(d.checkins||{}).forEach(cid=>{
      const r=d.checkins[cid];
      tot++; if(sec(r.ts)>CUT) late++;
      if(r.hasPhoto!==true) never++;
      else if(pk && pk!=='loading' && !pk[cid]) lost++;
    });
  });

  let h='<div class="phCard"><div class="phBar">'
    +'<button class="phBtn" onclick="window.__phShift(-1)"'+(atMin?' disabled':'')+'>‹ ก่อนหน้า</button>'
    +'<input class="phDate" type="date" value="'+date+'" min="'+minKey()+'" max="'+todayKey()+'" onchange="window.__phDate(this.value)">'
    +'<button class="phBtn" onclick="window.__phShift(1)"'+(isToday?' disabled':'')+'>ถัดไป ›</button>'
    +'<button class="phBtn'+(isToday?' on':'')+'" onclick="window.__phDate(\'\')">วันนี้</button>'
    +'<button class="phBtn" onclick="window.__phAll()">📷 โหลดรูปทุกสาขา</button>'
    +'</div>'
    +'<div class="phNote" style="margin-top:9px"><b style="color:#171717">'+thaiDate(date)+'</b>'
    +' &nbsp;·&nbsp; เช็คอิน '+tot+' คน'
    +(late? ' &nbsp;·&nbsp; <b style="color:#c0392b">สาย '+late+' คน</b>':(tot?' &nbsp;·&nbsp; เข้าทันทุกคน':''))
    +'</div>'
    +((never||lost)? '<div class="phNote" style="margin-top:4px">'
        +(never? '🚫 ลงเวลาด่วนไม่มีรูป <b style="color:#8a5d00">'+never+' คน</b>':'')
        +((never&&lost)? ' &nbsp;·&nbsp; ':'')
        +(lost? '⚠️ รูปหาย <b style="color:#c0392b">'+lost+' คน</b> (เปิดดูสาขาแล้วถึงจะนับครบ)':'')
        +'</div>' : '')
    +'<div class="phNote" style="margin-top:4px">รูปเก็บในระบบ 30 วัน — ย้อนได้ถึง '+thaiDate(minKey())+'</div>'
    +(PH_LOADING? '<div class="phNote" style="margin-top:8px">⏳ กำลังโหลด…</div>':'')
    +'</div>';

  let any=false;
  deps.forEach(dep=>{
    const key=dep+'|'+date, d=DAYS[key];
    const cm=cmapOf(dep);
    const rows=d? Object.keys(d.checkins||{}).map(cid=>({cid:cid, c:cm[cid]||{}, r:d.checkins[cid]}))
                    .sort((a,b)=>a.r.ts-b.r.ts) : [];
    const dLate=rows.filter(x=>sec(x.r.ts)>CUT).length;
    const pics=PICS[key];
    const op=!!OPEN[dep];
    if(rows.length) any=true;

    h+='<div class="phDep"><div class="phHd" onclick="window.__phTog(\''+dep+'\')">'
      +'<div><div class="nm">'+dep+'</div>'
      +'<div class="s2">'+(d? (rows.length+' คน'+(dLate? ' · สาย '+dLate+' คน':'')) : 'ไม่มีข้อมูลวันนี้')+'</div></div>'
      +'<div class="ar">'+(op?'▲ ย่อ':'▼ ดูรูป')+'</div></div>';

    if(op){
      h+='<div class="phBody">';
      if(!rows.length){ h+='<div class="phEmpty">ไม่มีการเช็คอินในวันที่เลือก</div>'; }
      else if(pics==='loading'){ h+='<div class="phEmpty">⏳ กำลังโหลดรูป '+rows.length+' รูป…</div>'; }
      else {
        h+='<div class="phGrid">';
        rows.forEach(x=>{
          const s=sec(x.r.ts), isLate=s>CUT;
          const mins=Math.max(0,Math.round((s-CUT)/60));
          const code=esc(x.c.code||('#'+x.cid));
          const src=pics? pics[x.cid] : null;
          const cap=(x.c.code||('#'+x.cid))+' · '+hm(x.r.ts)+' · '+dep+' · '+thaiDate(date);
          h+='<div class="phIt'+(isLate?' late':'')+'">'
            + (src
               ? '<img class="phImg" src="'+src+'" alt="'+code+'" onclick="window.__phZoom(this.src,'
                 + JSON.stringify(cap).replace(/"/g,'&quot;')+')">'
               : '<div class="phNo '+(pics? (x.r.hasPhoto===true?'lost':'never'):'')+'">'
                 +(pics
                    ? (x.r.hasPhoto===true
                        ? '⚠️ รูปหาย<small>อัปโหลดไม่สำเร็จ</small>'
                        : '🚫 ไม่ได้ถ่ายรูป<small>ลงเวลาด่วน</small>')
                    : 'ยังไม่ได้โหลดรูป')+'</div>')
            +'<div class="phMeta"><div class="c">'+code+'</div>'
            +'<div class="n">'+esc(x.c.name||'—')+(x.c.vendor? ' · '+esc(x.c.vendor):'')+'</div>'
            +'<div class="t"><b>'+hm(x.r.ts)+'</b>'
            + (isLate
               ? '<span class="tgg" style="color:#b3261e;background:#fdecea">สาย '+mins+' น.</span>'
               : '<span class="tgg" style="color:#0a7a3d;background:#e6f6ec">ทัน</span>')
            +'</div></div></div>';
        });
        h+='</div>';
        if(!pics) h+='<div style="margin-top:11px"><button class="phBtn" onclick="window.__phPics(\''+dep+'\')">📷 โหลดรูปของ '+dep+'</button></div>';
      }
      h+='</div>';
    }
    h+='</div>';
  });

  if(!any && !PH_LOADING)
    h+='<div class="phCard"><div class="phEmpty">ไม่มีสาขาไหนบันทึกข้อมูลในวันที่เลือก</div></div>';

  el.innerHTML=h;
}

export function initPhotos(ctx){
  C = ctx;
  window.__phRender = paint;
  window.__phEnsure = () => { loadDay(); };
  window.__phDate  = v => { PH_DATE = v? clampDate(v) : null; paint(); loadDay(); };
  window.__phShift = n => { PH_DATE = clampDate(shift(curDate(), n)); paint(); loadDay(); };
  window.__phTog   = dep => {
    OPEN[dep] = !OPEN[dep];
    paint();
    if(OPEN[dep] && !PICS[dep+'|'+curDate()]) loadPics(dep);
  };
  window.__phPics  = dep => loadPics(dep);
  window.__phAll   = async () => {
    const deps=S().DEPOTS;
    deps.forEach(d=>{ OPEN[d]=true; });
    paint();
    for(const d of deps){ await loadPics(d); }
  };
  window.__phZoom  = (src,cap) => {
    const z=document.getElementById('phZoom'); if(!z) return;
    z.querySelector('img').src=src;
    z.querySelector('.cap').textContent=cap||'';
    z.classList.add('on');
  };
  window.__phVer = PH_VER;
  return PH_VER;
}

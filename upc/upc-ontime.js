/* ===================================================================
   upc-ontime.js  —  ⏱ On-time Rate สำหรับ UPC Manager Lite
   หน้าตา/การคำนวณเดียวกับ dhl-ontime.js ต้นฉบับ (ot6)
   ตัดส่วนที่เป็นของ BKK ออก: ค่าตอบแทน (฿) และปุ่ม "5 สาขานำร่อง"
   เกณฑ์ที่ประกาศ 07:00 • โหมดทบทวนภายใน 07:10 (ไม่เปิดเผย)
   Design By Winnie
   =================================================================== */
export const OT_VER = '2026.09.25-upc1';

const OT_CUT   = 25200;          // 07:00:00
const OT_GRACE = 25800;          // 07:10:00
const OT_FIRST = '2026-09';      // เดือนแรกที่มีข้อมูล UPC

let C = null;
let OT_MON=null, OT_MODE='cut', OT_LOADING=false;
const OTD = {};                  // OTD['DEP|YYYY-MM-DD'] = dayDoc | null

const S  = () => C.get();
const esc= s => C.esc(s);
const secOf = ts => C.secOf(ts);

function otMonth(){ return OT_MON || S().DATE.slice(0,7); }
function otDeps(){ return S().DEPOTS; }
function otDates(mon){
  const a=mon.split('-'), y=+a[0], m=+a[1], DATE=S().DATE;
  const last=new Date(y,m,0).getDate(), out=[];
  for(let i=1;i<=last;i++){
    const k=mon+'-'+String(i).padStart(2,'0');
    if(k>DATE) break;
    if(new Date(y, m-1, i).getDay()===0) continue;   // ไม่นับวันอาทิตย์
    out.push(k);
  }
  return out;
}
function otMonList(){
  const DATE=S().DATE, out=[];
  let y=+OT_FIRST.slice(0,4), m=+OT_FIRST.slice(5,7);
  const ey=+DATE.slice(0,4), em=+DATE.slice(5,7);
  while(y<ey||(y===ey&&m<=em)){ out.push(y+'-'+String(m).padStart(2,'0')); m++; if(m>12){m=1;y++;} }
  return out.length?out:[DATE.slice(0,7)];
}

async function ensureOt(){
  if(OT_LOADING) return;
  const deps=otDeps(), dks=otDates(otMonth()), need=[];
  deps.forEach(dep=>dks.forEach(dk=>{ if(!((dep+'|'+dk) in OTD)) need.push([dep,dk]); }));
  if(!need.length) return;
  OT_LOADING=true; paint();
  for(let i=0;i<need.length;i+=40){
    await Promise.all(need.slice(i,i+40).map(j =>
      C.getDoc(C.doc(C.db,'depots',j[0],'days',j[1]))
        .then(s=>{ OTD[j[0]+'|'+j[1]] = s.exists()? s.data() : null; })
        .catch(()=>{ OTD[j[0]+'|'+j[1]] = null; })
    ));
  }
  OT_LOADING=false; paint();
}

function otCmap(dep,dks){
  const st=S(), m={}, add=l=>(l||[]).forEach(c=>{ if(c&&c.id!=null) m[c.id]=c; });
  add(st.META[dep]&&st.META[dep].couriers);
  dks.forEach(dk=>{ const d=OTD[dep+'|'+dk]; if(d) add(d.couriers); });
  add(st.DATA[dep]&&st.DATA[dep].couriers);
  return m;
}
function otTier(r){ return r==null?'—': r>=99.995?'100': r>=95?'95': r>=90?'90':'0'; }

function otAgg(){
  const deps=otDeps(), dks=otDates(otMonth());
  const lim = OT_MODE==='grace' ? OT_GRACE : OT_CUT;
  const byDep={}, people=[];
  deps.forEach(dep=>{
    const cm=otCmap(dep,dks);
    const active=dks.filter(dk=>{
      const d=OTD[dep+'|'+dk];
      return d && (Object.keys(d.checkins||{}).length || Object.keys(d.absent||{}).length);
    });
    const P={}, daily=[];
    const get=cid=>P[cid]||(P[cid]={dep,cid,c:cm[cid]||{},abs:0,ck:0,late:0,worst:0,lateDays:[]});
    active.forEach(dk=>{
      const d=OTD[dep+'|'+dk]; let dn=0, dl=0;
      Object.keys(d.absent||{}).forEach(cid=>{ if(!(d.checkins&&d.checkins[cid]&&d.checkins[cid].ts)) get(cid).abs++; });
      Object.keys(d.checkins||{}).forEach(cid=>{
        const r=d.checkins[cid]; if(!r||!r.ts) return;
        const o=get(cid); o.ck++; dn++;
        const s=secOf(r.ts);
        if(s>lim){ o.late++; dl++; o.lateDays.push(dk); if(s-lim>o.worst) o.worst=s-lim; }
      });
      daily.push({dk, n:dn, late:dl, pct: dn? (dn-dl)/dn*100 : null});
    });
    const rows=Object.keys(P).map(k=>P[k]).filter(o=>o.ck||o.abs).map(o=>{
      const wd=Math.max(0, active.length-o.abs);
      const rate= wd? (wd-o.late)/wd*100 : null;
      const ty=(String(o.c.type||'').indexOf('4')>=0)?'4W':'2W';
      return Object.assign({}, o, { wd, rate, ty, tier:otTier(rate), cov:(wd? o.ck/wd*100 : null), days:active.length });
    });
    byDep[dep]={ active:active.length, rows, daily };
    rows.forEach(r=>people.push(r));
  });
  return { byDep, people, dks };
}

/* ---------- CSS เฉพาะแท็บ On-time (เหมือนต้นฉบับ) ---------- */
let CSS_DONE=false;
function injectCss(){
  if(CSS_DONE) return; CSS_DONE=true;
  const s=document.createElement('style');
  s.textContent = [
  '#viewOt{--otY:#FFCC00;--otK:#171717;--otLine:#e6e2da;--otRed:#c0392b;--otGrn:#12784a;--otAmb:#9a6b00;--otBlu:#1f6feb}',
  '#viewOt *{box-sizing:border-box}',
  '#viewOt .otCard{background:#fff;border:1px solid var(--otLine);border-radius:14px;padding:14px 16px;margin:0 0 12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}',
  '#viewOt .otH{display:flex;align-items:baseline;gap:8px;margin:0 0 10px;font-size:15px;font-weight:800;color:var(--otK)}',
  '#viewOt .otH small{font-size:11.5px;font-weight:600;color:#8a8478;letter-spacing:0}',
  '#viewOt .otNote{font-size:12px;line-height:1.55;color:#7d776b}',
  '#viewOt .otBar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
  '#viewOt .otSel{height:34px;border:1px solid var(--otLine);border-radius:9px;padding:0 10px;font:700 13px inherit;background:#fff;color:var(--otK)}',
  '#viewOt .otBtn{height:34px;padding:0 13px;border:1px solid var(--otLine);border-radius:9px;background:#fff;color:#55504a;font:700 12.5px inherit;cursor:pointer;white-space:nowrap;transition:.14s}',
  '#viewOt .otBtn:hover{border-color:#bdb7ad;color:var(--otK)}',
  '#viewOt .otBtn.on{background:var(--otK);border-color:var(--otK);color:var(--otY)}',
  '#viewOt .otBtn.lock.on{background:var(--otRed);border-color:var(--otRed);color:#fff}',
  '#viewOt .otSp{flex:1 1 auto;min-width:8px}',
  '#viewOt .otKpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 12px}',
  '@media(max-width:820px){#viewOt .otKpis{grid-template-columns:repeat(2,1fr)}}',
  '#viewOt .otK1{position:relative;background:#fff;border:1px solid var(--otLine);border-radius:13px;padding:13px 12px 11px;cursor:pointer;overflow:hidden;transition:.14s;text-align:left}',
  '#viewOt .otK1:hover{border-color:#bdb7ad;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.07)}',
  '#viewOt .otK1::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:#d9d4cb}',
  '#viewOt .otK1.g::before{background:var(--otGrn)}#viewOt .otK1.b::before{background:var(--otBlu)}',
  '#viewOt .otK1.a::before{background:#e6a700}#viewOt .otK1.r::before{background:var(--otRed)}',
  '#viewOt .otK1.sel{border-color:var(--otK);box-shadow:0 0 0 2px rgba(23,23,23,.12)}',
  '#viewOt .otK1 .v{font:800 26px/1.05 inherit;color:var(--otK);letter-spacing:-.5px;font-variant-numeric:tabular-nums;white-space:nowrap}',
  '#viewOt .otK1 .v.m{font-size:19px}',
  '#viewOt .otK1 .l{margin-top:4px;font:600 11px/1.3 inherit;color:#8a8478}',
  '#viewOt .otWrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--otLine);border-radius:11px}',
  '#viewOt table.otT{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;min-width:620px}',
  '#viewOt table.otT th{position:sticky;top:0;z-index:1;background:#f7f5f1;color:#6f6a60;font:700 11px/1.2 inherit;text-transform:none;letter-spacing:0;padding:9px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--otLine)}',
  '#viewOt table.otT th.l{text-align:left}',
  '#viewOt table.otT td{padding:9px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid #f0ece5;color:#3d3932;font-variant-numeric:tabular-nums;vertical-align:middle}',
  '#viewOt table.otT td.l{text-align:left;white-space:normal}',
  '#viewOt table.otT tbody tr:last-child td{border-bottom:0}',
  '#viewOt table.otT tbody tr.clk{cursor:pointer}',
  '#viewOt table.otT tbody tr.clk:hover td{background:#fffbe8}',
  '#viewOt table.otT tbody tr.hot td{background:#fdf1ef}',
  '#viewOt table.otT tbody tr.hot.clk:hover td{background:#fbe6e2}',
  '#viewOt table.otT tbody tr.sel td{background:#fff6cc}',
  '#viewOt .nm2{font-weight:800;color:var(--otK);font-size:13px;line-height:1.25}',
  '#viewOt .sb{font-size:11px;color:#8a8478;line-height:1.3;margin-top:1px}',
  '#viewOt .good{color:var(--otGrn);font-weight:700}',
  '#viewOt .bad{color:var(--otRed);font-weight:800}',
  '#viewOt .dim{color:#a8a296}',
  '#viewOt .tg{display:inline-block;padding:2.5px 9px;border-radius:999px;font:800 11px/1.35 inherit;white-space:nowrap}',
  '#viewOt .spark{display:inline-flex;gap:2px;align-items:flex-end;height:20px}',
  '#viewOt .spark i{display:block;width:4px;border-radius:1px}',
  '#viewOt .otChip{display:inline-flex;align-items:center;gap:7px;background:var(--otK);color:var(--otY);border-radius:999px;padding:5px 7px 5px 13px;font:800 12px inherit;margin:0 6px 6px 0}',
  '#viewOt .otChip b{width:19px;height:19px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;cursor:pointer;font-size:12px}',
  '#viewOt .otChip b:hover{background:rgba(255,255,255,.34)}',
  '#viewOt .otEmpty{padding:26px 10px;text-align:center;color:#a8a296;font-size:13px}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ---------- ตัวช่วยแสดงผล ---------- */
const TIERS = {
  '100':{t:'100%',   c:'#0a7a3d', bg:'#e6f6ec'},
  '95' :{t:'95–99%', c:'#1f6feb', bg:'#e8f1ff'},
  '90' :{t:'90–94%', c:'#9a6b00', bg:'#fff5db'},
  '0'  :{t:'< 90%',  c:'#b3261e', bg:'#fdecea'},
  '—'  :{t:'—',      c:'#8a8478', bg:'#f0ece5'}
};
function tag(t){ const x=TIERS[t]||TIERS['—'];
  return '<span class="tg" style="color:'+x.c+';background:'+x.bg+'">'+x.t+'</span>'; }
function spark(daily){
  if(!daily.length) return '<span class="dim">—</span>';
  return '<span class="spark">'+daily.map(d=>{
    const p=d.pct==null?0:d.pct;
    const col=p>=95?'#12784a':p>=90?'#e6a700':'#c0392b';
    return '<i title="'+d.dk.slice(5)+' · '+(d.pct==null?'—':Math.round(p)+'%')
      +'" style="height:'+Math.max(3,Math.round(p/100*18))+'px;background:'+col+'"></i>';
  }).join('')+'</span>';
}
const pctCell = v => v==null ? '<td class="dim">—</td>'
  : '<td class="'+(v>=95?'good':'bad')+'">'+ (Math.round(v*10)/10) +'%</td>';

/* ---------- ตัวกรอง ---------- */
let FILT={tier:null,dep:null,vendor:null};
function filtOn(){ return !!(FILT.tier||FILT.dep||FILT.vendor); }
const vnOf = o => (o.c.vendor && String(o.c.vendor).trim()) || 'ไม่ระบุ Vendor';
function keep(o){
  if(FILT.tier && o.tier!==FILT.tier) return false;
  if(FILT.dep && o.dep!==FILT.dep) return false;
  if(FILT.vendor && vnOf(o)!==FILT.vendor) return false;
  return true;
}
function chips(){
  if(!filtOn()) return '';
  let h='<div style="margin:0 0 10px">';
  if(FILT.tier)   h+='<span class="otChip">ระดับ '+(TIERS[FILT.tier]||{}).t+'<b onclick="window.__otFilt(\'tier\',null)">✕</b></span>';
  if(FILT.dep)    h+='<span class="otChip">สาขา '+FILT.dep+'<b onclick="window.__otFilt(\'dep\',null)">✕</b></span>';
  if(FILT.vendor) h+='<span class="otChip">'+esc(FILT.vendor)+'<b onclick="window.__otFilt(\'vendor\',null)">✕</b></span>';
  h+='<button class="otBtn" onclick="window.__otFilt(\'all\',null)">ล้างตัวกรอง</button></div>';
  return h;
}

/* ---------- วาดหน้า ---------- */
function paint(){
  const el=document.getElementById('viewOt'); if(!el) return;
  injectCss();
  const mon=otMonth(), A=otAgg();
  const cnt = t => A.people.filter(p=>p.tier===t).length;
  const n100=cnt('100'), n95=cnt('95'), n90=cnt('90'), n0=cnt('0');
  const rated=A.people.filter(p=>p.rate!=null);
  const avgAll= rated.length? rated.reduce((s,p)=>s+p.rate,0)/rated.length : null;
  const thin  =A.people.filter(p=>p.cov!=null && p.cov<70);
  const noName=A.people.filter(p=>!p.c.code);

  let h='<div class="otCard" style="border-left:4px solid var(--otY)">'
    +'<div style="font:800 14px inherit;color:var(--otK)">📌 On-time Rate รายเดือน</div>'
    +'<div class="otNote" style="margin-top:4px">ไม่นับวันอาทิตย์ &nbsp;·&nbsp; '
    +'หน้านี้เห็นเฉพาะ Manager — Staff และ Courier ไม่เห็นตัวเลขนี้</div></div>';

  h+='<div class="otCard"><div class="otBar">'
    +'<select class="otSel" onchange="window.__otMon(this.value)">'
    + otMonList().map(m=>'<option value="'+m+'"'+(m===mon?' selected':'')+'>'+m+'</option>').join('')
    +'</select>'
    +'<span class="otNote">'+otDeps().length+' สาขา</span>'
    +'<span class="otSp"></span>'
    +'<button class="otBtn'+(OT_MODE==='cut'?' on':'')+'" onclick="window.__otMode(\'cut\')">กฎ 07:00</button>'
    +'<button class="otBtn lock'+(OT_MODE==='grace'?' on':'')+'" onclick="window.__otMode(\'grace\')">ทบทวน 07:10 🔒</button>'
    +'</div>'
    +(OT_MODE==='grace'
      ? '<div class="otNote" style="margin-top:9px;color:var(--otRed);font-weight:700">🔒 ชุดนี้ผ่อนผัน 10 นาที — ใช้ภายใน ไม่ใช่ตัวเลขที่ประกาศ</div>':'')
    +(OT_LOADING? '<div class="otNote" style="margin-top:9px">⏳ กำลังโหลดข้อมูลเดือน '+mon+' …</div>':'')
    +'</div>';

  const kpi=(key,v,l,cl,big)=>'<div class="otK1 '+cl+(FILT.tier===key?' sel':'')+'" onclick="window.__otFilt(\'tier\','
    +(key?'\''+key+'\'':'null')+')"><div class="v'+(big?' m':'')+'">'+v+'</div><div class="l">'+l+'</div></div>';
  h+='<div class="otKpis">'
    +kpi('100',n100,'100%','g')
    +kpi('95', n95, '95–99%','b')
    +kpi('90', n90, '90–94%','a')
    +kpi('0',  n0,  'ต่ำกว่า 90%','r')
    +'<div class="otK1"><div class="v m">'+(avgAll==null?'—':(Math.round(avgAll*10)/10)+'%')+'</div><div class="l">On-time เฉลี่ยทั้งหมด · '+A.people.length+' คน</div></div>'
    +'</div>';
  h+='<div class="otNote" style="margin:-4px 0 12px">แตะการ์ดด้านบนเพื่อดูว่าใครอยู่ระดับนั้น</div>';

  const warn=[];
  if(noName.length) warn.push('มีคนเช็คอิน '+noName.length+' คนที่ไม่มีชื่อในทะเบียน');
  if(thin.length)   warn.push('มี '+thin.length+' คนที่บันทึกเช็คอินไม่ถึง 70% ของวันทำงาน — วันที่ไม่มีบันทึกจะถูกนับเป็น “เข้าทัน”');
  if(warn.length) h+='<div class="otCard" style="border-left:4px solid var(--otRed)">'
    +'<div style="font:800 13.5px inherit;color:var(--otK)">⚠️ ข้อมูลที่ควรตรวจสอบ</div>'
    +warn.map(w=>'<div class="otNote" style="margin-top:5px">• '+w+'</div>').join('')+'</div>';

  h+='<div class="otCard"><div class="otH">🏢 ระดับสาขา <small>แตะแถวเพื่อกรองเฉพาะสาขานั้น</small></div>'
    +'<div class="otWrap"><table class="otT"><thead><tr>'
    +'<th class="l">สาขา</th><th>วันเก็บ</th><th>คน</th><th>On-time เฉลี่ย</th>'
    +'<th>ต่ำกว่า 90%</th><th class="l">แนวโน้มรายวัน</th></tr></thead><tbody>';
  otDeps().map(dep=>{
    const b=A.byDep[dep]||{active:0,rows:[],daily:[]};
    const rs=b.rows.filter(r=>r.rate!=null);
    return { dep, b, avg: rs.length? rs.reduce((s,r)=>s+r.rate,0)/rs.length : null, bad: b.rows.filter(r=>r.tier==='0').length };
  }).sort((x,y)=>(x.avg==null?-1:x.avg)-(y.avg==null?-1:y.avg)).forEach(x=>{
    const hot = x.avg!=null && x.avg<90;
    h+='<tr class="clk'+(hot?' hot':'')+(FILT.dep===x.dep?' sel':'')
      +'" onclick="window.__otFilt(\'dep\',\''+x.dep+'\')">'
      +'<td class="l"><div class="nm2">'+x.dep+(hot?' 🔴':'')+'</div><div class="sb">'+x.b.rows.length+' คน</div></td>'
      +'<td class="dim">'+x.b.active+'</td><td>'+x.b.rows.length+'</td>'
      + pctCell(x.avg)
      +'<td class="'+(x.bad?'bad':'good')+'">'+x.bad+'</td>'
      +'<td class="l">'+spark(x.b.daily)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';

  const VG={};
  A.people.forEach(o=>{ const k=vnOf(o); (VG[k]||(VG[k]={rows:[],deps:{}})).rows.push(o); VG[k].deps[o.dep]=1; });
  const vRows=Object.keys(VG).map(k=>{
    const g=VG[k], rs=g.rows.filter(r=>r.rate!=null);
    const bad=g.rows.filter(r=>r.tier==='0').length, half=g.rows.filter(r=>r.tier==='90').length;
    return { name:k, n:g.rows.length, deps:Object.keys(g.deps).sort(),
      avg: rs.length? rs.reduce((s,r)=>s+r.rate,0)/rs.length : null, bad, half,
      pctBad: g.rows.length? bad/g.rows.length*100 : null,
      pctRisk: g.rows.length? (bad+half)/g.rows.length*100 : null,
      worst: rs.slice().sort((a,b)=>a.rate-b.rate)[0] };
  }).sort((x,y)=>(y.pctBad==null?-1:y.pctBad)-(x.pctBad==null?-1:x.pctBad));

  if(vRows.length){
    const vBad=vRows.filter(x=>x.pctBad>=50).length;
    h+='<div class="otCard"><div class="otH">🏭 Vendor ที่มีปัญหา <small>เรียงตาม % คนที่หลุดเกณฑ์ · แตะเพื่อกรอง</small></div>'
      +(vBad? '<div class="otNote" style="color:var(--otRed);font-weight:700;margin:-4px 0 9px">🔴 '+vBad+' Vendor มีคนหลุดเกณฑ์เกินครึ่ง</div>':'')
      +'<div class="otWrap"><table class="otT"><thead><tr>'
      +'<th class="l">Vendor</th><th>คน</th><th>เฉลี่ย</th><th>% หลุด</th><th>% เสี่ยง</th><th class="l">แย่สุด</th></tr></thead><tbody>';
    vRows.forEach(x=>{
      const hot=x.pctBad>=50;
      h+='<tr class="clk'+(hot?' hot':'')+(FILT.vendor===x.name?' sel':'')
        +'" onclick="window.__otFilt(&quot;vendor&quot;,'+JSON.stringify(x.name).replace(/"/g,'&quot;')+')">'
        +'<td class="l"><div class="nm2">'+esc(x.name)+(hot?' 🔴':'')+'</div>'
        +'<div class="sb">'+x.deps.join(' · ')+'</div></td>'
        +'<td>'+x.n+'</td>'
        + pctCell(x.avg)
        +'<td class="'+(x.pctBad>0?'bad':'good')+'">'+(x.pctBad==null?'—':Math.round(x.pctBad)+'%')+'</td>'
        +'<td class="'+(x.pctRisk>0?'bad':'good')+'">'+(x.pctRisk==null?'—':Math.round(x.pctRisk)+'%')+'</td>'
        +'<td class="l"><span class="sb">'+(x.worst? esc(x.worst.c.code||('#'+x.worst.cid))+' · '+Math.round(x.worst.rate)+'%':'—')+'</span></td>'
        +'</tr>';
    });
    h+='</tbody></table></div>'
      +'<div class="otNote" style="margin-top:9px">% หลุด = สัดส่วนคนที่ On-time ต่ำกว่า 90% &nbsp;·&nbsp; % เสี่ยง = ต่ำกว่า 95%</div>'
      +'<div style="margin-top:11px"><button class="otBtn" onclick="window.__otCsvV()">⬇️ CSV รายละเอียดตาม Vendor</button></div></div>';
  }

  const all=A.people.slice().sort((a,b)=>(a.rate==null?999:a.rate)-(b.rate==null?999:b.rate));
  const ppl=all.filter(keep);
  h+='<div class="otCard" id="otPeople"><div class="otH">👤 รายบุคคล '
    +'<small>'+(filtOn()? 'กรองแล้ว '+ppl.length+' / '+all.length+' คน' : 'เรียงจากแย่ที่สุด · '+all.length+' คน')+'</small></div>'
    + chips();
  if(!ppl.length){
    h+='<div class="otEmpty">ไม่มีคนในเงื่อนไขนี้</div>';
  } else {
    h+='<div class="otWrap"><table class="otT"><thead><tr>'
      +'<th class="l">รหัส / ชื่อ</th><th class="l">Vendor</th><th>สาขา</th><th>รถ</th>'
      +'<th>วันทำงาน</th><th>สาย</th><th>ไม่มา</th><th>On-time</th><th>ระดับ</th><th>บันทึกครบ</th></tr></thead><tbody>';
    ppl.forEach(o=>{
      h+='<tr'+(o.tier==='0'?' class="hot"':'')+'>'
        +'<td class="l"><div class="nm2">'+esc(o.c.code||('⚠️ #'+o.cid))+'</div>'
        +'<div class="sb">'+esc(o.c.name||'ไม่มีชื่อในทะเบียน')+'</div></td>'
        +'<td class="l"><span class="sb">'+esc(vnOf(o))+'</span></td>'
        +'<td class="dim">'+o.dep+'</td><td class="dim">'+o.ty+'</td>'
        +'<td>'+o.wd+'</td>'
        +'<td class="'+(o.late?'bad':'good')+'">'+o.late+'</td>'
        +'<td class="dim">'+(o.abs||'—')+'</td>'
        + pctCell(o.rate)
        +'<td>'+tag(o.tier)+'</td>'
        +'<td class="'+(o.cov!=null&&o.cov<70?'bad':'dim')+'">'+(o.cov==null?'—':Math.round(o.cov)+'%')+'</td>'
        +'</tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='<div class="otNote" style="margin-top:9px">On-time Rate = (วันทำงาน − วันที่สาย) ÷ วันทำงาน &nbsp;·&nbsp; '
    +'วันทำงาน = วันที่สาขามีข้อมูล (ไม่รวมวันอาทิตย์) − วันที่บันทึกว่าไม่มาทำงาน &nbsp;·&nbsp; '
    +'วันที่ไม่มีบันทึกเช็คอิน นับเป็นเข้าทัน</div>'
    +'<div style="margin-top:11px"><button class="otBtn" onclick="window.__otCsv()">⬇️ ดาวน์โหลด CSV</button></div></div>';

  el.innerHTML=h;
}

function dl(name, lines){
  const blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
function csv(){
  const A=otAgg(), mon=otMonth();
  const lines=[['depot','code','name','vendor','type','workDays','lateDays','absentDays','onTimeRate','tier','coveragePct'].join(',')];
  A.people.forEach(o=>{
    lines.push([o.dep,(o.c.code||('#'+o.cid)),(o.c.name||''),(o.c.vendor||''),o.ty,o.wd,o.late,o.abs,
      (o.rate==null?'':Math.round(o.rate*10)/10),o.tier,(o.cov==null?'':Math.round(o.cov))].map(q).join(','));
  });
  dl('ontime_'+mon+'_'+(OT_MODE==='cut'?'0700':'0710')+'.csv', lines);
}
function csvVendor(){
  const A=otAgg(), mon=otMonth(), G={};
  A.people.forEach(o=>{ const k=vnOf(o); (G[k]||(G[k]=[])).push(o); });
  const lines=['vendor,people,avgOnTime,pctBelow90,pctBelow95,depots'];
  Object.keys(G).map(k=>{
    const rows=G[k], rs=rows.filter(r=>r.rate!=null);
    const bad=rows.filter(r=>r.tier==='0').length, half=rows.filter(r=>r.tier==='90').length;
    return { k, n:rows.length, avg: rs.length? rs.reduce((s,r)=>s+r.rate,0)/rs.length : null,
      pb: rows.length? bad/rows.length*100 : 0, pr: rows.length? (bad+half)/rows.length*100 : 0,
      dp: Array.from(new Set(rows.map(r=>r.dep))).sort().join(' ') };
  }).sort((x,y)=>y.pb-x.pb).forEach(x=>{
    lines.push([x.k,x.n,(x.avg==null?'':Math.round(x.avg*10)/10),Math.round(x.pb),Math.round(x.pr),x.dp].map(q).join(','));
  });
  dl('ontime_vendor_'+mon+'_'+(OT_MODE==='cut'?'0700':'0710')+'.csv', lines);
}

export function initOntime(ctx){
  C = ctx;
  const clr = () => { FILT={tier:null,dep:null,vendor:null}; };
  window.__otRender = paint;
  window.__otEnsure = ensureOt;
  window.__otMon    = v => { OT_MON=v; clr(); paint(); ensureOt(); };
  window.__otMode   = v => { OT_MODE=v; paint(); };
  window.__otFilt   = (kind,val) => {
    if(kind==='all'){ clr(); }
    else { FILT[kind] = (FILT[kind]===val) ? null : val; }
    paint();
    const t=document.getElementById('otPeople');
    if(t && (FILT.tier||FILT.dep||FILT.vendor)) t.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.__otCsv    = csv;
  window.__otCsvV   = csvVendor;
  window.__otVer    = OT_VER;
  return OT_VER;
}

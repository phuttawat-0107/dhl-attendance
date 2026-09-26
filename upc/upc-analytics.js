/* ===================================================================
   upc-analytics.js — 📈 อินไซต์ / 📊 กราฟ / 📋 Data สำหรับ UPC Manager Lite
   หน้าตาและวิธีใช้เหมือนแท็บเดิมใน DHL_Manager_Live.html
   ตัดเหลือเฉพาะเรื่องเข้างาน: On-time / Late / นาทีสาย / เวลาเข้าเฉลี่ย / ขาด-ลา
   + เปรียบเทียบช่วงก่อน-หลัง (Improve)
   • ไม่นับวันอาทิตย์ทุกส่วน • สาย = เกิน 07:10 (ตรงกับแท็บ Live / ย้อนหลัง)
   Design By Winnie
   =================================================================== */
export const AN_VER = '2026.09.26-an4';

const CUT = 25200, GRACE = 25800;          // 07:00 / 07:10
let C = null;
const S   = () => C.get();
const esc = s => C.esc(s);
const secOf = ts => C.secOf(ts);
const pad = n => String(n).padStart(2,'0');
const dKey = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addD = (k,n) => { const d=new Date(k+'T00:00:00'); d.setDate(d.getDate()+n); return dKey(d); };
const isSun = k => new Date(k+'T00:00:00').getDay()===0;
const hmOf = s => { const m=Math.round(s/60); return pad(Math.floor(m/60))+':'+pad(m%60); };
const av = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const m1 = v => Math.round(v*10)/10;
const nowSec = () => { const d=new Date(); return d.getHours()*3600+d.getMinutes()*60+d.getSeconds(); };
const TODAY = () => S().DATE;
function thD(k){ const d=new Date(k+'T00:00:00'); const M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return d.getDate()+' '+M[d.getMonth()]+' '+String(d.getFullYear()+543).slice(2); }
const PAL = ['#D40511','#1565c0','#2e7d32','#b58900','#7a3b8f','#00838f','#e64a19'];

/* ================= ช่วงวันที่ (เหมือนต้นฉบับ) ================= */
let RFROM = null, RTO = null;
function chDates(){ const out=[]; let k=RFROM, g=0; while(k<=RTO && g++<95){ if(!isSun(k)) out.push(k); k=addD(k,1); } return out; }
function dList(f,t){ const o=[]; let k=f, g=0; while(k<=t && g++<95){ if(!isSun(k)) o.push(k); k=addD(k,1); } return o; }
const rangeDays = () => chDates().length;
function setQuick(n){
  const t=TODAY();
  if(n==='month'){ const d=new Date(t+'T00:00:00'); RFROM=dKey(new Date(d.getFullYear(),d.getMonth(),1)); RTO=t; }
  else if(n==='prevmonth'){ const d=new Date(t+'T00:00:00'); RFROM=dKey(new Date(d.getFullYear(),d.getMonth()-1,1)); RTO=dKey(new Date(d.getFullYear(),d.getMonth(),0)); }
  else { RTO=t; RFROM=addD(t,-(n-1)); }
}
function rangeBarHTML(withDeps){
  const t=TODAY(), days=rangeDays();
  const isQ=n=>{ if(n==='month'){ const d=new Date(t+'T00:00:00'); return RFROM===dKey(new Date(d.getFullYear(),d.getMonth(),1))&&RTO===t; }
    if(n==='prevmonth'){ const d=new Date(t+'T00:00:00'); return RFROM===dKey(new Date(d.getFullYear(),d.getMonth()-1,1))&&RTO===dKey(new Date(d.getFullYear(),d.getMonth(),0)); }
    return RTO===t && RFROM===addD(t,-(n-1)); };
  const q=(v,l)=>'<button class="qbtn'+(isQ(v)?' on':'')+'" onclick="window.__anQuick('+(typeof v==='number'?v:"'"+v+"'")+')">'+l+'</button>';
  let h='<div class="rangebar"><div style="display:flex;gap:7px;align-items:flex-end;">'
    +'<div class="dfield"><div class="lab">จากวันที่</div><input type="date" value="'+RFROM+'" max="'+t+'" onchange="window.__anRange(this.value,null)"></div>'
    +'<div class="dsep">→</div>'
    +'<div class="dfield"><div class="lab">ถึงวันที่</div><input type="date" value="'+RTO+'" max="'+t+'" onchange="window.__anRange(null,this.value)"></div></div>'
    +'<div class="quick">'+q(1,'วันนี้')+q(7,'7 วัน')+q(14,'14 วัน')+q(30,'30 วัน')+q('month','เดือนนี้')+q('prevmonth','เดือนที่แล้ว')+'</div>'
    +'<div class="rsum"><b>'+days+' วันทำงาน</b> · '+thD(RFROM)+(RFROM===RTO?'':' → '+thD(RTO))+' · ไม่นับวันอาทิตย์'
    +(LOADING?' · <span style="color:#b58900;font-weight:700;">กำลังโหลด…</span>':'')+'</div>';
  if(withDeps){
    const D=S().DEPOTS;
    if(D.length<=20){
      h+='<div class="depbar"><button class="dbtn all'+(CHDEP==='all'?' on':'')+'" onclick="window.__anDep(\'all\')">👥 ทุกสาขา</button>'
        + D.map((d,i)=>'<button class="dbtn'+(CHDEP===d?' on':'')+'" onclick="window.__anDep(\''+d+'\')"><i style="background:'+PAL[i%PAL.length]+'"></i>'+d+'</button>').join('')+'</div>';
    } else {
      h+='<div class="depbar"><button class="dbtn all'+(CHDEP==='all'?' on':'')+'" onclick="window.__anDep(\'all\')">👥 รวมทุกสาขา</button>'
        +'<select class="dbtn" onchange="window.__anDep(this.value)"><option value="all">— เลือกสาขา —</option>'
        + D.map(d=>'<option value="'+d+'"'+(CHDEP===d?' selected':'')+'>'+d+'</option>').join('')+'</select></div>';
    }
  }
  return h+'</div>';
}

/* ================= โหลดข้อมูล (1 คำขอต่อสาขา) ================= */
const RC = {}, LOADED = {};
let LOADING = false;
function docOf(dep,dk){ if(dk===TODAY()) return (S().TODAY||{})[dep]||null; return RC[dep+'|'+dk]||null; }
async function ensure(from){
  const deps=S().DEPOTS.filter(d=>!(LOADED[d] && LOADED[d]<=from));
  if(!deps.length || LOADING) return;
  LOADING=true; repaint();
  for(let i=0;i<deps.length;i+=8){
    await Promise.all(deps.slice(i,i+8).map(async dep=>{
      try{
        const L=await C.fb.list('depots/'+dep+'/days','date','>=',from);
        L.forEach(x=>{ if(x.data && x.data.date) RC[dep+'|'+x.data.date]=x.data; });
        LOADED[dep]=from;
      }catch(e){ console.warn('analytics load',dep,e); LOADED[dep]=from; }
    }));
  }
  LOADING=false; repaint();
  /* ระหว่างโหลดผู้ใช้อาจเปลี่ยนช่วงวันที่ — โหลดส่วนที่ขาดต่อ */
  const nf=needFrom();
  if(S().DEPOTS.some(d=>!(LOADED[d] && LOADED[d]<=nf))) ensure(nf);
}
function needFrom(){ let f=RFROM; if(TAB()==='data' && DMODE==='cmp'){ const b=baseRange(); if(b.f<f) f=b.f; } return f; }
const TAB = () => S().MTAB;

/* ================= คำนวณ ================= */
function roster(dep){ return ((S().META[dep]||{}).couriers)||[]; }
function clockOff(r){ const s=C.toMs(r.srv); if(!s||!r.ts) return 0; const d=(s-r.ts)/60000; if(r.off) return d<-2?1:0; return Math.abs(d)>5?1:0; }
const cutD = dep => ((S().META[dep]||{}).cut) || CUT;
const sinceD = dep => ((S().META[dep]||{}).since) || '0000-00-00';   /* วันแรกที่สาขาเริ่มใช้ระบบ */          /* เวลาเข้างานของสาขา */
const isLate = (r,cut) => r.status ? r.status==='late' : secOf(r.ts) > (r.cut||cut)+600;
const relFmt = v => Math.round(v)===0 ? 'ตรงเวลา' : (v<0 ? 'ก่อน '+m1(-v)+' น.' : 'หลัง '+m1(v)+' น.');
function dayStat(d,cut){
  if(!d) return null; cut=cut||CUT;
  const cks=d.checkins||{}, ck=Object.values(cks).filter(r=>r&&r.ts);
  const ab=Object.keys(d.absent||{}).filter(id=>!(cks[id]&&cks[id].ts)).length;
  if(!ck.length && !ab) return null;
  let late=0, lm=0, lmL=0, flag=0; const arr=[], rel=[];
  ck.forEach(r=>{ const s=secOf(r.ts), k=r.cut||cut; if(isLate(r,cut)){ late++; lmL+=Math.max(0,s-k)/60; } lm+=Math.max(0,s-k)/60; arr.push(s); rel.push((s-k)/60); flag+=clockOff(r); });
  return { n:ck.length, late, lm, lmL, arr, rel, ab, flag };
}
function metricOf(st,k){
  if(!st) return null;
  if(k==='ontime') return st.n? (st.n-st.late)/st.n*100 : null;
  if(k==='late')   return st.n? st.late : null;
  if(k==='lateAvg')return st.n? st.lm/st.n : null;
  if(k==='arr')    return st.rel.length? av(st.rel) : null;
  if(k==='ab')     return st.ab;
  return null;
}
function mergeStats(list){
  const L=list.filter(Boolean); if(!L.length) return null;
  return L.reduce((a,s)=>({ n:a.n+s.n, late:a.late+s.late, lm:a.lm+s.lm, lmL:a.lmL+s.lmL, arr:a.arr.concat(s.arr), rel:a.rel.concat(s.rel), ab:a.ab+s.ab, flag:a.flag+s.flag }),
    { n:0, late:0, lm:0, lmL:0, arr:[], rel:[], ab:0, flag:0 });
}
function aggDep(dep,dks){
  let days=0; const sts=[];
  const cut=cutD(dep);
  dks.forEach(dk=>{ const s=dayStat(docOf(dep,dk),cut); if(s){ days++; sts.push(s); } });
  if(!days) return null;
  const m=mergeStats(sts);
  return { days, head: Math.round(m.n/days), ckN:m.n, lateN:m.late, abN:m.ab, flag:m.flag,
    ontime: m.n? (m.n-m.late)/m.n*100 : null,
    lateAvg: m.n? m.lm/m.n : null,
    lateMinPer: m.late? m.lmL/m.late : null,
    latePerDay: m.late/days,
    arr: av(m.arr), arrRel: av(m.rel), cut,
    abRate: (m.n+m.ab)? m.ab/(m.n+m.ab)*100 : null,
    /* นับวันที่ขาดข้อมูลเฉพาะตั้งแต่วันที่สาขาเริ่มใช้ระบบ — กันเตือนผิดช่วงเปิดสาขาใหม่ */
    missing: Math.max(0, dks.filter(dk=> dk>=sinceD(dep) && !(dk===TODAY() && nowSec()<cutD(dep)+1800) && !dayStat(docOf(dep,dk),cut)).length) };
}
function aggPeople(deps,dks){
  const M={};
  deps.forEach(dep=>{
    const cm={}; roster(dep).forEach(c=>{ cm[c.id]=c; });
    const cut=cutD(dep);
    const get=cid=>{ const k=dep+'|'+cid; return M[k]||(M[k]={dep,cid,c:cm[cid]||{},days:0,late:0,lateMin:0,arr:[],rel:[],ab:0,cut}); };
    dks.forEach(dk=>{
      const d=docOf(dep,dk); if(!d) return;
      const cks=d.checkins||{};
      Object.entries(cks).forEach(([cid,r])=>{ if(!r||!r.ts) return; const o=get(cid), s=secOf(r.ts);
        const k=r.cut||cut; o.days++; if(isLate(r,cut)) o.late++; o.lateMin+=Math.max(0,s-k)/60; o.arr.push(s); o.rel.push((s-k)/60); });
      Object.keys(d.absent||{}).forEach(cid=>{ if(!(cks[cid]&&cks[cid].ts)) get(cid).ab++; });
    });
  });
  return Object.values(M).filter(o=>o.days||o.ab).map(o=>({...o,
    ontime: o.days? (o.days-o.late)/o.days*100 : null, lateAvg: o.days? o.lateMin/o.days : null, arrA: av(o.arr), relA: av(o.rel) }));
}

/* ---- % พัฒนาการ: สเกลคงที่ + ช่วงทรงตัว (deadband) ----
   เปลี่ยนน้อยกว่า db = "ทรงตัว" (0%) • เปลี่ยนถึง full = ±100%
   ไม่ใช้ % ของฐาน → ค่าฐานน้อยๆ ไม่ทำให้ % พุ่ง และตัวชี้วัดเดียวไม่ลากคะแนนรวม            */
const IMET=[
  {k:'ontime',    l:'Ontime %',          fmt:v=>Math.round(v)+'%', hi:true,  tgt:95,  unit:'p', db:2,   full:10,  du:'จุด'},
  {k:'latePerDay',l:'คนสาย / วัน',        fmt:v=>m1(v)+' คน',      hi:false, tgt:0,   unit:'n', db:0.5, full:3,   du:'คน'},
  {k:'lateAvg',   l:'นาทีสาย / คน',       fmt:v=>m1(v)+' น.',      hi:false, tgt:0,   unit:'m', db:1,   full:10,  du:'น.'},
  {k:'arrRel',    l:'เข้าก่อน/หลังเวลาเข้างาน', fmt:relFmt,            hi:false, tgt:0,   unit:'m', db:3,   full:15,  du:'นาที'},
  {k:'abRate',    l:'ขาด / ลา %',         fmt:v=>m1(v)+'%',        hi:false, tgt:5,   unit:'p', db:2,   full:10,  du:'จุด'}
];
const inT=(m,v)=> m.hi? v>=m.tgt : v<=m.tgt;
function impState(m,a,b){
  if(a==null||b==null||isNaN(a)||isNaN(b)) return 'na';
  const A=inT(m,a), B=inT(m,b);
  if(A&&B) return 'keep'; if(!A&&B) return 'reach'; if(A&&!B) return 'lost'; return 'gap';
}
function impPct(m,a,b){
  if(a==null||b==null||isNaN(a)||isNaN(b)) return null;
  const d = m.hi? b-a : a-b, ad=Math.abs(d);
  if(ad<=m.db) return 0;
  return Math.sign(d)*Math.min(100,(ad-m.db)/(m.full-m.db)*100);
}
const clamp=v=>Math.max(-100,Math.min(100,v));
function impTxt(m,a,b){ const st=impState(m,a,b), p=impPct(m,a,b);
  if(st==='na') return '—';
  const tag= st==='reach'?' ✓ ถึงเป้า' : st==='lost'?' ✗ หลุดเป้า' : st==='keep'?' ✓ ในเป้า' : '';
  return (p===0?'• ทรงตัว':(p>0?'+':'−')+Math.round(Math.abs(p))+'%')+tag; }
function impCls(m,a,b){ const p=impPct(m,a,b); if(p==null) return 'n'; return p>0?'g':(p<0?'b':'n'); }
function pcHTML(p){ if(p==null) return '<span class="pc eq">—</span>'; const c=p>1?'up':(p<-1?'dn':'eq'), s=p>1?'▲':(p<-1?'▼':'•'); return '<span class="pc '+c+'">'+s+' '+Math.abs(Math.round(p))+'%</span>'; }

/* ================= 📈 อินไซต์ ================= */
function issues(){
  const dks=chDates(), out=[], t=TODAY(), only=dks.length===1&&dks[0]===t;
  S().DEPOTS.forEach(dep=>{
    const a=aggDep(dep,dks), act=roster(dep).filter(c=>c.active!==false).length;
    if(!a){
      if(act && (!only || nowSec()>=7.5*3600))
        out.push({dep,k:'none',lv:'crit',ic:'📵',ti:dep+' ไม่มีการลงเวลาเลย',
          de: only? 'ยังไม่มีการเช็คอินวันนี้ — ตรวจว่าสาขาเปิดแอปและล็อกอินแล้วหรือยัง' : 'ไม่มีข้อมูลตลอด '+dks.length+' วันทำงานที่เลือก'});
      return;
    }
    if(a.lateN){
      const crit=a.ontime<85 || a.latePerDay>=3;
      out.push({dep,k:'late',lv:crit?'crit':'warn',ic:'⏰',
        ti: only? dep+' มาสาย '+a.lateN+' คน' : dep+' มาสายเฉลี่ย '+m1(a.latePerDay)+' คน/วัน',
        de:'On-time '+Math.round(a.ontime)+'% • สายเฉลี่ย '+m1(a.lateMinPer)+' นาที/ครั้ง • รวม '+a.lateN+' ครั้ง — แตะดูรายชื่อ'});
    }
    if(!only){
      const rep=aggPeople([dep],dks).filter(o=>o.late>=3).sort((x,y)=>y.late-x.late);
      if(rep.length) out.push({dep,k:'repeat',lv:rep.length>=3?'crit':'warn',ic:'🔁',ti:dep+' มีคนสายซ้ำ '+rep.length+' คน',
        de:rep.slice(0,3).map(o=>(o.c.code||'#'+o.cid)+' สาย '+o.late+' ครั้ง').join(' • ')+(rep.length>3?' • และอีก '+(rep.length-3)+' คน':'')});
      if(a.missing>0) out.push({dep,k:'missing',lv:'warn',ic:'📅',ti:dep+' ไม่ได้ลงเวลา '+a.missing+' วัน',
        de:'จาก '+dks.length+' วันทำงานที่เลือก — วันที่ไม่มีข้อมูลจะไม่ถูกนับในสถิติ'});
    }
    if(a.abRate!=null && a.abRate>10) out.push({dep,k:'ab',lv:'warn',ic:'🚫',ti:dep+' ขาด/ลา สูง '+m1(a.abRate)+'%',
      de:'รวม '+a.abN+' ครั้ง ใน '+a.days+' วัน — ตรวจสาเหตุและกำลังคนสำรอง'});
    if(a.flag) out.push({dep,k:'flag',lv:'warn',ic:'⏱',ti:dep+' เวลาเครื่องไม่ตรง '+a.flag+' ครั้ง',
      de:'เวลาในมือถือต่างจากเวลาเซิร์ฟเวอร์เกิน 5 นาที — อาจมีการแก้นาฬิกาเครื่อง'});
  });
  const rank={crit:0,warn:1};
  return out.sort((a,b)=>rank[a.lv]-rank[b.lv]);
}
const STEPS=[
  {k:'ontime', l:'⏱ On-time ≥ 95%',    st:a=>a.ontime>=95,          v:a=>Math.round(a.ontime)+'%'},
  {k:'nolate', l:'🙅 ไม่มีคนสาย',       st:a=>a.lateN===0,            v:a=>a.lateN+' ครั้ง'},
  {k:'arr',    l:'🕖 เข้าก่อนเวลาเข้างาน', st:a=>a.arrRel<=0,       v:a=>relFmt(a.arrRel)},
  {k:'ab',     l:'🚫 ขาด/ลา ≤ 5%',      st:a=>(a.abRate||0)<=5,       v:a=>m1(a.abRate||0)+'%'},
  {k:'full',   l:'📅 ลงเวลาครบทุกวัน',   st:a=>a.missing<=0,           v:a=>(a.days)+' วัน'}
];
function stepState(dep,s){ const a=aggDep(dep,chDates()); if(!a) return {st:'none'}; return {st:s.st(a)?'ok':'bad', v:s.v(a), a}; }
function renderIns(){
  const el=document.getElementById('viewIns'); if(!el) return;
  const D=S().DEPOTS, dks=chDates(), iss=issues(), crit=iss.filter(x=>x.lv==='crit').length, warn=iss.length-crit;
  let h=rangeBarHTML(false)
    +'<div class="kpis" style="grid-template-columns:repeat(3,1fr);">'
    +'<div class="kpi '+(crit?'red':'green')+'"><div class="v">'+crit+'</div><div class="l">ปัญหาเร่งด่วน</div></div>'
    +'<div class="kpi '+(warn?'am':'green')+'"><div class="v">'+warn+'</div><div class="l">ต้องเฝ้าระวัง</div></div>'
    +'<div class="kpi '+(iss.length?'':'green')+'"><div class="v">'+D.filter(d=>!iss.some(x=>x.dep===d)).length+'/'+D.length+'</div><div class="l">สาขาไม่มีปัญหา</div></div></div>';
  h+='<div class="card"><h2>🚨 ปัญหาที่ต้องแก้ <span class="small">'+(dks.length>1?'สรุปจาก '+dks.length+' วันทำงานที่เลือก • ':'')+'เรียงตามความเร่งด่วน • แตะเพื่อเจาะดู</span></h2>'
    + (iss.length? iss.map(x=>'<div class="iss '+x.lv+'" onclick="window.__anOpen(\''+x.dep+'\')"><div class="ic">'+x.ic+'</div><div class="bd"><div class="ti">'+esc(x.ti)+'</div><div class="de">'+esc(x.de)+'</div></div><div class="go">ดู ›</div></div>').join('')
      : '<div class="empty">'+(LOADING?'กำลังโหลดข้อมูล…':'✅ ไม่พบปัญหา ทุกสาขาทำได้ตามเป้า')+'</div>')+'</div>';
  h+='<div class="card"><h2>🔍 เจาะลึกรายหัวข้อ <span class="small">แตะการ์ดเพื่อดูสาขาที่ไม่ผ่าน</span></h2><div class="stepgrid">';
  STEPS.forEach(s=>{
    const per=D.map(dep=>({dep,s:stepState(dep,s)})), ok=per.filter(x=>x.s.st==='ok').length, bad=per.filter(x=>x.s.st==='bad');
    h+='<div class="stepcard" onclick="window.__anStep(\''+s.k+'\')"><div class="h">'+s.l+'</div>'
      +'<div class="n" style="color:'+(bad.length?'var(--r)':(ok?'var(--g)':'#b0a892'))+'">'+ok+'/'+D.length+'</div>'
      +'<div class="s">'+(bad.length? 'ไม่ผ่าน: '+bad.slice(0,4).map(x=>x.dep).join(', ')+(bad.length>4?' +'+(bad.length-4):'') : (ok?'ผ่านทั้งหมด':'ยังไม่มีข้อมูล'))+'</div>'
      +'<div class="stepbar">'+per.slice(0,40).map(x=>'<i class="'+(x.s.st==='none'?'':x.s.st)+'"></i>').join('')+'</div></div>';
  });
  h+='</div></div>';
  if(dks.length>1){
    const rows=D.map(dep=>{ const a=aggDep(dep,dks); if(!a) return null;
      const rep=aggPeople([dep],dks).filter(o=>o.late>=3).length;
      return {dep,a,rep,score:a.lateN+rep*3+a.missing*2+(a.abRate>10?3:0)}; }).filter(Boolean).sort((x,y)=>y.score-x.score);
    h+='<div class="card"><h2>🔁 ปัญหาสะสมในช่วงที่เลือก <span class="small">'+dks.length+' วันทำงาน</span></h2>'
      + (rows.length? rows.map(r=>'<div class="row-c"><div class="info"><div class="nm">'+r.dep
          +(r.score>=10?' <span class="chip no">ต้องแก้ด่วน</span>':(r.score>=4?' <span class="chip" style="background:#fff3c2;color:#7a5c00;">เฝ้าระวัง</span>':''))+'</div>'
          +'<div class="sub2">'+r.a.days+' วัน • On-time '+Math.round(r.a.ontime||0)+'% • สายรวม '+r.a.lateN+' ครั้ง • คนสายซ้ำ '+r.rep+' คน • ขาด/ลา '+r.a.abN+(r.a.missing>0?' • ไม่ลงเวลา '+r.a.missing+' วัน':'')+'</div></div>'
          +'<button class="btn btn-o" style="min-height:34px;padding:7px 12px;font-size:11.5px;" onclick="window.__anOpen(\''+r.dep+'\')">ดู</button></div>').join('')
        : '<div class="small">'+(LOADING?'กำลังโหลด…':'ยังไม่มีข้อมูลในช่วงนี้')+'</div>')+'</div>';
  }
  const top=aggPeople(D,dks).filter(o=>o.late>0).sort((a,b)=>b.late-a.late||b.lateAvg-a.lateAvg).slice(0,10);
  h+='<div class="card"><h2>👤 คนที่สายบ่อยที่สุด <span class="small">10 อันดับในช่วงที่เลือก</span></h2>'
    + (top.length? top.map((o,i)=>'<div class="row-c"><div class="info"><div class="nm">'+(i+1)+'. '+esc(o.c.code||'#'+o.cid)+' · '+esc(o.c.name||'')+'</div>'
        +'<div class="sub2">'+o.dep+' • '+esc(o.c.vendor||'-')+' • '+o.days+' วัน • เข้าเฉลี่ย '+(o.arrA!=null?hmOf(o.arrA):'—')+'</div></div>'
        +'<span class="chip no">สาย '+o.late+' ครั้ง</span></div>').join('') : '<div class="empty">ไม่มีคนสายในช่วงนี้ 🎉</div>')+'</div>';
  el.innerHTML=h;
}
window.__anStep = k => {
  const s=STEPS.find(x=>x.k===k), D=S().DEPOTS, per=D.map(dep=>({dep,s:stepState(dep,s)}));
  const mk=(list,label,cls)=> list.length? '<div class="grp">'+label+' '+list.length+' สาขา</div>'
    + list.map(x=>'<div class="row-c" style="cursor:pointer" onclick="window.__anOpen(\''+x.dep+'\')"><div class="info"><div class="nm">'+x.dep+'</div><div class="sub2">'+x.s.a.days+' วัน • On-time '+Math.round(x.s.a.ontime||0)+'%</div></div><span class="chip '+cls+'">'+x.s.v+'</span></div>').join('') : '';
  const none=per.filter(x=>x.s.st==='none').map(x=>x.dep);
  C.modal('<h3>🔍 '+s.l+'</h3><div class="sub">'+thD(RFROM)+(RFROM===RTO?'':' → '+thD(RTO))+' • '+rangeDays()+' วันทำงาน</div>'
    + mk(per.filter(x=>x.s.st==='bad'),'❌ ไม่ผ่าน','no') + mk(per.filter(x=>x.s.st==='ok'),'✅ ผ่าน','ok')
    + (none.length?'<div class="small" style="margin-top:10px;">ไม่มีข้อมูล: '+none.join(', ')+'</div>':'')
    + '<button class="btn btn-o btn-block" style="margin-top:14px;" onclick="window.__close()">ปิด</button>');
};
window.__anOpen = dep => {
  const dks=chDates(), a=aggDep(dep,dks), P=aggPeople([dep],dks).sort((x,y)=>y.late-x.late||(y.lateAvg||0)-(x.lateAvg||0));
  let b='<h3>'+dep+' — สรุปช่วงที่เลือก</h3><div class="sub">'+thD(RFROM)+(RFROM===RTO?'':' → '+thD(RTO))+' • '+dks.length+' วันทำงาน</div>';
  if(!a){ C.modal(b+'<div class="empty">ไม่มีข้อมูลในช่วงนี้</div><button class="btn btn-o btn-block" onclick="window.__close()">ปิด</button>'); return; }
  b+='<div class="kpis" style="grid-template-columns:repeat(4,1fr);">'
    +'<div class="kpi '+(a.ontime>=95?'green':'red')+'"><div class="v">'+Math.round(a.ontime)+'%</div><div class="l">On-time</div></div>'
    +'<div class="kpi '+(a.lateN?'red':'green')+'"><div class="v">'+a.lateN+'</div><div class="l">สาย (ครั้ง)</div></div>'
    +'<div class="kpi"><div class="v">'+hmOf(a.arr)+'</div><div class="l">เข้าเฉลี่ย (เวลาเข้างาน '+hmOf(a.cut)+')</div></div>'
    +'<div class="kpi am"><div class="v">'+a.abN+'</div><div class="l">ขาด/ลา</div></div></div>';
  b+=P.map(o=>'<div class="row-c"><div class="info"><div class="nm">'+esc(o.c.code||'#'+o.cid)+' · '+esc(o.c.name||'')+'</div>'
      +'<div class="sub2">'+esc(o.c.vendor||'-')+' • '+o.days+' วัน • เข้าเฉลี่ย '+(o.arrA!=null?hmOf(o.arrA):'—')+(o.ab?' • ขาด/ลา '+o.ab:'')+(o.late?' • สายเฉลี่ย '+m1(o.lateAvg)+' น./วัน':'')+'</div></div>'
      +(o.late? '<span class="chip no">สาย '+o.late+'</span>' : '<span class="chip ok">ทันทุกวัน</span>')+'</div>').join('');
  C.modal(b+'<button class="btn btn-o btn-block" style="margin-top:12px" onclick="window.__close()">ปิด</button>');
};

/* ================= 📊 กราฟ ================= */
let CHDEP='all';
const METRICS=[
  {k:'ontime', l:'Ontime %',              unit:'%', tgt:95,   fmt:v=>Math.round(v)+'%',  hi:true},
  {k:'late',   l:'จำนวนคนมาสาย',           unit:'n', tgt:0,    fmt:v=>Math.round(v)+' คน', hi:false},
  {k:'lateAvg',l:'นาทีสายเฉลี่ย / คน',      unit:'n', tgt:0,    fmt:v=>m1(v)+' น.',       hi:false},
  {k:'arr',    l:'เข้าก่อน/หลังเวลาเข้างาน (นาที)', unit:'r', tgt:0, fmt:relFmt,           hi:false},
  {k:'ab',     l:'ขาด / ลา',               unit:'n', tgt:null, fmt:v=>Math.round(v)+' คน', hi:false}
];
function renderCh(){
  const el=document.getElementById('viewCh'); if(!el) return;
  const D=S().DEPOTS; if(CHDEP!=='all' && !D.includes(CHDEP)) CHDEP='all';
  let h=rangeBarHTML(true);
  METRICS.forEach(m=>{
    h+='<div class="card"><h2>'+m.l+' <span class="small">'
      +(m.tgt==null?'ยิ่งน้อยยิ่งดี':(m.k==='late'||m.k==='lateAvg')?'ยิ่งน้อยยิ่งดี • เป้า 0':m.unit==='r'?'ติดลบ = มาก่อนเวลา • เป้า ≤ 0 (เทียบเวลาเข้างานของแต่ละสาขา)':(m.hi?'เป้า ≥ '+m.tgt+'%':'เป้า ไม่เกิน '+hmOf(m.tgt)))+'</span></h2>'
      +'<canvas id="ch_'+m.k+'" style="width:100%;height:150px;"></canvas><div class="small" id="lg_'+m.k+'" style="margin-top:6px;"></div></div>';
  });
  el.innerHTML=h;
  const series = CHDEP!=='all' ? [{dep:CHDEP, col:PAL[D.indexOf(CHDEP)%PAL.length], one:true}]
    : D.length<=7 ? D.map((dep,i)=>({dep,col:PAL[i%PAL.length]}))
    : [{dep:'all', col:'#D40511', one:true, lab:'รวม '+D.length+' สาขา'}];
  METRICS.forEach(m=>drawMetric(m,series));
}
function cvx(id,hpx){ const c=document.getElementById(id); if(!c) return null; const dpr=window.devicePixelRatio||1, w=c.clientWidth||600, hh=hpx||150; c.width=w*dpr; c.height=hh*dpr; c.style.height=hh+'px'; const x=c.getContext('2d'); x.scale(dpr,dpr); return {x,w,h:hh}; }
function drawMetric(m,series){
  const cv=cvx('ch_'+m.k,150); if(!cv) return;
  const {x,w,h}=cv, dks=chDates(), PB=20,PT=12,PL=44,PR=10, D=S().DEPOTS;
  series.forEach(s=>{ s.pts=dks.map(dk=> metricOf(s.dep==='all'? mergeStats(D.map(dep=>dayStat(docOf(dep,dk),cutD(dep)))) : dayStat(docOf(s.dep,dk),cutD(s.dep)), m.k)); });
  const vals=series.flatMap(s=>s.pts).filter(v=>v!=null), lg=document.getElementById('lg_'+m.k);
  if(!vals.length){ x.fillStyle='#c4bca6'; x.font='13px Segoe UI'; x.textAlign='center'; x.fillText(LOADING?'กำลังโหลด…':'ยังไม่มีข้อมูลในช่วงนี้', w/2, h/2); if(lg) lg.textContent=''; return; }
  const hasT=m.tgt!=null;
  let vmin=Math.min(...vals, hasT?m.tgt:Infinity), vmax=Math.max(...vals, hasT?m.tgt:-Infinity, m.unit==='n'?1:-Infinity);
  if(m.unit==='n') vmin=Math.min(vmin,0);
  const padv=(vmax-vmin)*0.18||1; vmin-=padv; vmax+=padv;
  if(m.unit==='%'){ vmin=Math.max(0,vmin); vmax=Math.min(100,vmax+2); }
  if(m.unit==='n') vmin=Math.max(0,vmin);
  const X=i=> dks.length===1? w/2 : PL+(w-PL-PR)*i/(dks.length-1);
  const Y=v=> PT+(h-PT-PB)*(1-(v-vmin)/(vmax-vmin));
  x.strokeStyle='#f0ead9'; x.lineWidth=1;
  [0,.5,1].forEach(f=>{ const v=vmin+(vmax-vmin)*f; x.beginPath(); x.moveTo(PL,Y(v)); x.lineTo(w-PR,Y(v)); x.stroke();
    x.fillStyle='#c4bca6'; x.font='9.5px Segoe UI'; x.textAlign='right'; x.textBaseline='middle'; x.fillText(m.unit==='t'? hmOf(v) : (Math.round(v*10)/10), PL-5, Y(v)); });
  if(m.unit==='r' && vmin>0) vmin=0;
  if(hasT && !(m.unit==='n' && m.tgt===0)){
    x.setLineDash([5,4]); x.strokeStyle='#2e7d32'; x.lineWidth=1.5; x.beginPath(); x.moveTo(PL,Y(m.tgt)); x.lineTo(w-PR,Y(m.tgt)); x.stroke(); x.setLineDash([]);
    x.fillStyle='#2e7d32'; x.font='700 9.5px Segoe UI'; x.textAlign='left'; x.textBaseline='bottom'; x.fillText(m.unit==='r'?'เวลาเข้างาน':'เป้า', PL+2, Y(m.tgt)-2);
  }
  const good=v=> !hasT ? v===0 : (m.hi? v>=m.tgt : (m.unit==='n'? v<=m.tgt : v<=m.tgt));
  const one=series.length===1;
  if(one){ const s=series[0], pts=s.pts.map((v,i)=>v==null?null:{x:X(i),y:Y(v)}).filter(Boolean);
    if(pts.length>1){ x.beginPath(); x.moveTo(pts[0].x,h-PB); pts.forEach(p=>x.lineTo(p.x,p.y)); x.lineTo(pts[pts.length-1].x,h-PB); x.closePath();
      const gr=x.createLinearGradient(0,0,0,h); gr.addColorStop(0,s.col+'55'); gr.addColorStop(1,s.col+'05'); x.fillStyle=gr; x.fill(); } }
  series.forEach(s=>{
    const pts=s.pts.map((v,i)=>v==null?null:{x:X(i),y:Y(v),v});
    x.strokeStyle=s.col; x.lineWidth=one?2.8:2; x.beginPath(); let st=false;
    pts.forEach(p=>{ if(!p){ st=false; return; } st? x.lineTo(p.x,p.y) : x.moveTo(p.x,p.y); st=true; }); x.stroke();
    pts.forEach(p=>{ if(!p) return; x.beginPath(); x.arc(p.x,p.y,one?4.5:3.5,0,Math.PI*2); x.fillStyle='#fff'; x.fill(); x.lineWidth=2.5;
      x.strokeStyle= one? (good(p.v)?'#2e7d32':'#D40511') : s.col; x.stroke(); });
    if(one && dks.length<=16){ x.font='700 10px Segoe UI'; x.textAlign='center'; x.textBaseline='bottom';
      pts.forEach(p=>{ if(!p) return; x.fillStyle=good(p.v)?'#1c7a4d':'#b3121d'; x.fillText(m.fmt(p.v), p.x, p.y-8); }); }
  });
  x.fillStyle='#a09884'; x.font='9.5px Segoe UI'; x.textAlign='center'; x.textBaseline='top';
  const step=Math.ceil(dks.length/12);
  dks.forEach((k,i)=>{ if(i%step && i!==dks.length-1) return; const[,mm,dd]=k.split('-'); x.fillText((k===TODAY()?'วันนี้':(+dd)+'/'+(+mm)), X(i), h-PB+4); });
  if(lg){
    if(one){ const v=series[0].pts.filter(p=>p!=null), avg=av(v), last=v[v.length-1];
      lg.innerHTML= v.length? '<b>'+(series[0].lab||series[0].dep)+'</b> • เฉลี่ย '+m.fmt(avg)+' • ล่าสุด '+m.fmt(last) : ''; }
    else lg.innerHTML=series.map(s=>'<span style="font-weight:700;color:'+s.col+';margin-right:9px;">● '+s.dep+'</span>').join('');
  }
}

/* ================= 📋 Data ================= */
let DLEVEL='dep', DMODE='data', CMODE='auto', BFROM=null, BTO=null;
function baseRange(){ if(CMODE==='custom') return {f:BFROM,t:BTO}; const days=(new Date(RTO+'T00:00:00')-new Date(RFROM+'T00:00:00'))/864e5+1, t=addD(RFROM,-1); return {f:addD(t,-(days-1)), t}; }
function cel(v,fmt,ok){ if(v==null||isNaN(v)) return '<td class="n">—</td>'; return '<td class="'+(ok===null?'':(ok?'g':'b'))+'">'+fmt(v)+'</td>'; }
function tblDep(dks){
  const rows=S().DEPOTS.map(dep=>({dep,a:aggDep(dep,dks)})).filter(x=>x.a);
  if(!rows.length) return '<div class="empty">'+(LOADING?'กำลังโหลดข้อมูล…':'ไม่มีข้อมูลในช่วงวันที่เลือก')+'</div>';
  rows.sort((x,y)=>(y.a.ontime??-1)-(x.a.ontime??-1));
  let h='<div class="dwrap"><table class="dtbl"><thead><tr><th class="l">สาขา</th><th>วัน</th><th>คน/วัน</th><th>Ontime</th><th>สาย</th><th>คนสาย/วัน</th><th>นาทีสาย/คน</th><th>เวลาเข้างาน</th><th>เข้าเฉลี่ย</th><th>ขาด/ลา</th></tr></thead><tbody>';
  rows.forEach(({dep,a})=>{
    h+='<tr><td class="l"><div class="nm">'+dep+'</div><div class="s2">'+a.days+' วัน'+(a.missing>0?' • ขาดข้อมูล '+a.missing+' วัน':'')+'</div></td>'
      +'<td class="n">'+a.days+'</td><td class="n">'+a.head+'</td>'
      +cel(a.ontime,v=>Math.round(v)+'%',a.ontime>=95)+cel(a.lateN,v=>v+' ครั้ง',a.lateN===0)+cel(a.latePerDay,v=>m1(v),a.latePerDay===0)
      +cel(a.lateAvg,v=>m1(v)+' น.',a.lateAvg<=2)+'<td class="n">'+hmOf(a.cut)+'</td>'+cel(a.arr,v=>hmOf(v)+' ('+relFmt(a.arrRel)+')',a.arrRel<=0)+cel(a.abRate,v=>a.abN+' ('+m1(v)+'%)',a.abRate<=5)+'</tr>';
  });
  return h+'</tbody></table></div>';
}
function tblPeople(dks){
  const rows=aggPeople(S().DEPOTS,dks);
  if(!rows.length) return '<div class="empty">'+(LOADING?'กำลังโหลดข้อมูล…':'ไม่มีข้อมูลในช่วงวันที่เลือก')+'</div>';
  rows.sort((a,b)=>b.late-a.late||(b.lateAvg??-1)-(a.lateAvg??-1));
  let h='<div class="dwrap"><table class="dtbl"><thead><tr><th class="l">รหัส / ชื่อ</th><th>สาขา</th><th>ประเภทรถ</th><th>Vendor</th><th>วัน</th><th>Ontime</th><th>สาย</th><th>นาทีสาย/วัน</th><th>เข้าเฉลี่ย</th><th>ขาด/ลา</th></tr></thead><tbody>';
  rows.forEach(o=>{
    h+='<tr><td class="l"><div class="nm">'+esc(o.c.code||('#'+o.cid))+'</div><div class="s2">'+esc(o.c.name||'—')+'</div></td>'
      +'<td class="n">'+o.dep+'</td><td class="n">'+esc(o.c.type||'—')+'</td><td class="n">'+esc(o.c.vendor||'—')+'</td><td class="n">'+o.days+'</td>'
      +cel(o.ontime,v=>Math.round(v)+'%',o.ontime>=95)+cel(o.late,v=>v+' ครั้ง',o.late===0)+cel(o.lateAvg,v=>m1(v)+' น.',o.lateAvg<=2)
      +cel(o.arrA,hmOf,o.relA<=0)+'<td class="n">'+(o.ab||'—')+'</td></tr>';
  });
  return h+'</tbody></table><div class="small" style="margin-top:8px;">เรียงจากคนที่สายบ่อยสุด → น้อยสุด</div></div>';
}
function cmpRows(){
  const b=baseRange(), A=dList(b.f,b.t), B=chDates();
  return S().DEPOTS.map(dep=>{
    const a=aggDep(dep,A), c=aggDep(dep,B);
    if(!a||!c) return null;
    const det=IMET.map(m=>({m, va:a[m.k], vb:c[m.k], p:impPct(m,a[m.k],c[m.k])}));
    const ps=det.map(d=>d.p).filter(p=>p!=null).map(clamp);
    return {dep,a,c,det,nA:A.length,nB:B.length,score: ps.length? av(ps) : null};
  }).filter(Boolean);
}
function renderData(){
  const el=document.getElementById('viewData'); if(!el) return;
  const dks=chDates();
  let h='<div class="segbar"><button class="seg'+(DMODE==='data'?' on':'')+'" onclick="window.__anDMode(\'data\')">📋 ชุดข้อมูล</button>'
    +'<button class="seg'+(DMODE==='cmp'?' on':'')+'" onclick="window.__anDMode(\'cmp\')">📈 เปรียบเทียบ Improve</button></div>';
  h+=rangeBarHTML(false);
  if(DMODE==='cmp'){
    const b=baseRange();
    h+='<div class="rangebar"><div class="lab">เทียบกับช่วงไหน</div><div class="cmpsel" style="margin-top:0;">'
      +'<button class="'+(CMODE==='auto'?'on':'')+'" onclick="window.__anCMode(\'auto\')">⚡ ช่วงก่อนหน้าอัตโนมัติ</button>'
      +'<button class="'+(CMODE==='custom'?'on':'')+'" onclick="window.__anCMode(\'custom\')">📅 เลือกเอง</button></div>'
      +(CMODE==='custom'? '<div style="display:flex;gap:9px;align-items:flex-end;margin-top:11px;">'
        +'<div class="dfield"><div class="lab">ช่วงฐาน (ก่อน)</div><input type="date" value="'+BFROM+'" max="'+TODAY()+'" onchange="window.__anBase(this.value,null)"></div>'
        +'<div class="dsep">→</div><div class="dfield"><div class="lab">ถึงวันที่</div><input type="date" value="'+BTO+'" max="'+TODAY()+'" onchange="window.__anBase(null,this.value)"></div></div>' : '')
      +'<div class="rsum">ฐาน <b>'+thD(b.f)+' → '+thD(b.t)+'</b> ('+dList(b.f,b.t).length+' วัน) &nbsp;⟶&nbsp; ปัจจุบัน <b>'+thD(RFROM)+' → '+thD(RTO)+'</b> ('+dks.length+' วัน)</div></div>';
  }
  if(DMODE==='data'){
    h+='<div class="segbar"><button class="seg'+(DLEVEL==='dep'?' on':'')+'" onclick="window.__anLv(\'dep\')">🏢 รายสาขา</button>'
      +'<button class="seg'+(DLEVEL==='ppl'?' on':'')+'" onclick="window.__anLv(\'ppl\')">👤 รายบุคคล</button></div>';
    h+='<div class="card"><h2>'+(DLEVEL==='dep'?'🏢 ข้อมูลรายสาขา':'👤 ข้อมูลรายบุคคล')+' <span class="small">'+dks.length+' วันทำงาน • '+thD(RFROM)+(RFROM===RTO?'':' → '+thD(RTO))+(LOADING?' • กำลังโหลด...':'')+'</span></h2>'
      +(DLEVEL==='dep'? tblDep(dks) : tblPeople(dks))
      +'<div class="dlg"><span><i style="background:#e6f5eb"></i>Ontime / ตามเป้า</span><span><i style="background:#fdeaea"></i>Late / ไม่ถึงเป้า</span>'
      +'<span>เป้า: เข้างานตามเวลาของแต่ละสาขา • On-time ≥ 95% • ขาด/ลา ≤ 5%</span></div>'
      +'<div class="quick" style="margin-top:10px"><button class="qbtn" onclick="window.__anCsv()">⬇️ ดาวน์โหลด CSV</button></div></div>';
  } else {
    const rows=cmpRows(); rows.sort((a,b)=>(b.score??-999)-(a.score??-999));
    h+='<div class="card"><h2>🏆 พัฒนาการรายสาขา <span class="small">เรียงจากดีขึ้นมากสุด • แตะเพื่อดูรายละเอียด</span></h2>';
    if(LOADING) h+='<div class="empty">กำลังโหลดข้อมูล...</div>';
    else if(!rows.length) h+='<div class="empty">ยังไม่มีข้อมูลพอเปรียบเทียบ — ลองขยายช่วงวันที่</div>';
    else rows.forEach(r=>{
      const up=r.score>1, dn=r.score<-1;
      const lost=r.det.filter(d=>impState(d.m,d.va,d.vb)==='lost'), reach=r.det.filter(d=>impState(d.m,d.va,d.vb)==='reach');
      const ok=r.det.filter(d=>d.p!=null);
      const best=ok.slice().sort((a,b)=>b.p-a.p)[0], worst=ok.slice().sort((a,b)=>a.p-b.p)[0];
      const t2=[];
      if(best&&best.p>0) t2.push('👍 '+best.m.l+' +'+Math.round(best.p)+'%');
      if(worst&&worst.p<0) t2.push('⚠️ '+worst.m.l+' −'+Math.round(-worst.p)+'%');
      if(reach.length) t2.push('✓ ถึงเป้า: '+reach.map(d=>d.m.l).join(', '));
      if(lost.length) t2.push('✗ หลุดเป้า: '+lost.map(d=>d.m.l).join(', '));
      const thin = r.a.days < Math.ceil(r.nA/2) || r.c.days < Math.ceil(r.nB/2);
      h+='<div class="impcard '+(up?'up':(dn?'dn':''))+'" onclick="window.__anImp(\''+r.dep+'\')"><div class="dp">'+r.dep+'</div><div class="bd">'
        +'<div class="t1">'+(up?'ดีขึ้น':(dn?'แย่ลง':'ทรงตัว'))+' • '+r.a.days+' วัน → '+r.c.days+' วัน'+(thin?' • <span style="color:#b3121d">⚠️ ข้อมูลน้อย ใช้ตัดสินไม่ได้</span>':'')+'</div>'
        +'<div class="t2">'+(t2.join(' • ')||'ไม่มีการเปลี่ยนแปลงชัดเจน')+'</div></div>'+pcHTML(r.score)+'</div>';
    });
    h+='</div>';
    if(!LOADING && rows.length){
      h+='<div class="card"><h2>📊 รายละเอียดตัวชี้วัด <span class="small">ก่อน → หลัง • % พัฒนาการ</span></h2>'
        +'<div class="small" style="margin:-4px 0 8px;line-height:1.6">% พัฒนาการวัดจากขนาดการเปลี่ยนแปลงจริง: '
        + IMET.map(m=>m.l+' ทรงตัว ±'+(m.unit==='t'?m.db/60:m.db)+' '+m.du+' / เต็ม 100% ที่ '+(m.unit==='t'?m.full/60:m.full)+' '+m.du).join(' • ')+'</div>'
        +'<div class="dwrap"><table class="dtbl"><thead><tr><th class="l">สาขา / ตัวชี้วัด</th><th>ช่วงก่อน</th><th>ช่วงปัจจุบัน</th><th>เปลี่ยนแปลง</th><th>% พัฒนาการ</th></tr></thead><tbody>';
      rows.forEach(r=>{
        h+='<tr><td class="l" colspan="5" style="background:#1a1a1a;color:var(--y);border-radius:12px;font-weight:900;">'+r.dep
          +' &nbsp;<span style="font-weight:600;font-size:11px;color:#a09884;">รวม '+(r.score==null?'—':(r.score>0?'+':'')+Math.round(r.score)+'%')+'</span></td></tr>';
        r.det.forEach(d=>{
          const cls=impCls(d.m,d.va,d.vb); let diff='—';
          if(d.va!=null&&d.vb!=null){
            if(d.m.unit==='t'){ const mm=Math.round((d.vb-d.va)/60); diff=(mm>0?'+':'')+mm+' นาที'; }
            else if(d.m.k==='arrRel'){ const mm=m1(d.vb-d.va); diff=(mm>0?'ช้าลง '+mm:'เร็วขึ้น '+(-mm))+' นาที'; }
            else if(d.m.unit==='m'){ diff=((d.vb-d.va)>0?'+':'')+m1(d.vb-d.va)+' น.'; }
            else if(d.m.unit==='n'){ diff=((d.vb-d.va)>0?'+':'')+m1(d.vb-d.va)+' คน'; }
            else { diff=((d.vb-d.va)>0?'+':'')+m1(d.vb-d.va)+' จุด'; }
          }
          h+='<tr><td class="l">'+d.m.l+'</td><td class="n">'+(d.va==null?'—':d.m.fmt(d.va))+'</td>'
            +'<td class="'+(d.vb==null?'n':(d.m.hi?(d.vb>=d.m.tgt?'g':'b'):(d.vb<=d.m.tgt?'g':'b')))+'">'+(d.vb==null?'—':d.m.fmt(d.vb))+'</td>'
            +'<td class="'+cls+'">'+diff+'</td><td class="'+cls+'">'+impTxt(d.m,d.va,d.vb)+'</td></tr>';
        });
        h+='<tr class="sep"><td colspan="5"></td></tr>';
      });
      h+='</tbody></table></div></div>';
    }
  }
  el.innerHTML=h;
}
window.__anImp = dep => {
  const b=baseRange(), a=aggDep(dep,dList(b.f,b.t)), c=aggDep(dep,chDates()); if(!a||!c) return;
  let x='<h3>📈 '+dep+' — พัฒนาการ</h3><div class="sub">'+thD(b.f)+' → '+thD(b.t)+' &nbsp;เทียบกับ&nbsp; '+thD(RFROM)+' → '+thD(RTO)+'</div>';
  IMET.forEach(m=>{ const cls=impCls(m,a[m.k],c[m.k]);
    x+='<div class="row-c"><div class="info"><div class="nm">'+m.l+'</div><div class="sub2">'+(a[m.k]==null?'—':m.fmt(a[m.k]))+' → '+(c[m.k]==null?'—':m.fmt(c[m.k]))+'</div></div>'
      +'<span class="chip '+(cls==='g'?'ok':(cls==='b'?'no':''))+'">'+impTxt(m,a[m.k],c[m.k])+'</span></div>'; });
  C.modal(x+'<button class="btn btn-o btn-block" style="margin-top:14px;" onclick="window.__close()">ปิด</button>');
};
function csv(){
  const dks=chDates(), q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"', lines=[];
  if(DLEVEL==='dep'){
    lines.push(['depot','startTime','days','headPerDay','ontimePct','lateCount','latePerDay','lateMinPerHead','avgArrival','arrivalVsStartMin','absent','absentPct'].join(','));
    S().DEPOTS.forEach(dep=>{ const a=aggDep(dep,dks); if(!a) return;
      lines.push([dep,hmOf(a.cut),a.days,a.head,m1(a.ontime),a.lateN,m1(a.latePerDay),m1(a.lateAvg),hmOf(a.arr),m1(a.arrRel),a.abN,m1(a.abRate||0)].map(q).join(',')); });
  } else {
    lines.push(['depot','code','name','vendor','type','days','ontimePct','lateCount','lateMinPerDay','avgArrival','absent'].join(','));
    aggPeople(S().DEPOTS,dks).forEach(o=>lines.push([o.dep,o.c.code||'#'+o.cid,o.c.name||'',o.c.vendor||'',o.c.type||'',o.days,o.ontime==null?'':m1(o.ontime),o.late,o.lateAvg==null?'':m1(o.lateAvg),o.arrA==null?'':hmOf(o.arrA),o.ab].map(q).join(',')));
  }
  const blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='upc_'+DLEVEL+'_'+RFROM+'_'+RTO+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

/* ================= ควบคุม ================= */
function repaint(){ const t=TAB(); if(t==='ins') renderIns(); else if(t==='ch') renderCh(); else if(t==='data') renderData(); }
function go(){ repaint(); ensure(needFrom()); }
export function initAnalytics(ctx){
  C = ctx;
  const t=TODAY(); RFROM=addD(t,-6); RTO=t; BFROM=addD(t,-13); BTO=addD(t,-7);
  window.__anRender = go;
  window.__anRepaint = repaint;
  window.__anQuick = n => { setQuick(n); go(); };
  window.__anRange = (f,t2) => { if(f) RFROM=f; if(t2) RTO=t2; if(RFROM>RTO){ const x=RFROM; RFROM=RTO; RTO=x; } const n=(new Date(RTO+'T00:00:00')-new Date(RFROM+'T00:00:00'))/864e5; if(n>92) RFROM=addD(RTO,-92); go(); };
  window.__anDep  = d => { CHDEP=d; renderCh(); };
  window.__anDMode= m => { DMODE=m; go(); };
  window.__anLv   = l => { DLEVEL=l; renderData(); };
  window.__anCMode= m => { CMODE=m; go(); };
  window.__anBase = (f,t2) => { if(f) BFROM=f; if(t2) BTO=t2; if(BFROM>BTO){ const x=BFROM; BFROM=BTO; BTO=x; } go(); };
  window.__anCsv  = csv;
  window.__anVer  = AN_VER;
  return AN_VER;
}

/* ===================================================================
   dhl-ontime.js  —  ⏱ On-time Rate (นโยบายการันตี/โบนัส)
   ใช้กับ DHL_Manager_Live.html เท่านั้น — Staff / Courier ไม่เห็นข้อมูลนี้
   เกณฑ์ที่ประกาศ 07:00 • โหมดทบทวนภายใน 07:10 (ไม่เปิดเผย)
   Design By Winnie
   =================================================================== */
export const OT_VER = '2026.09.20-ot2';

const OT_CUT   = 25200;          // 07:00:00
const OT_GRACE = 25800;          // 07:10:00
const OT_START = '2026-09-21';   // วันเริ่มเก็บข้อมูลตามข้อกำหนดใหม่
const OT_SCOPE = ['BPE','DST','PHI','PWN','BPL'];
const OT_PAY = {
  '2W':{ g:20000, t100:21000, t95:20000, t90:18525, t0:17050 },
  '4W':{ g:29000, t100:30500, t95:29000, t90:26125, t0:23250 }
};

let C = null;                    // context จาก Manager
let OT_MON=null, OT_MODE='cut', OT_ALL=false, OT_LOADING=false, OT_BACK=false;
const OTD = {};                  // OTD['DEP|YYYY-MM-DD'] = dayDoc | null

const B  = n => Math.round(n).toLocaleString('en-US');
const S  = () => C.get();
const esc= s => C.esc(s);
const secOf = ts => C.secOf(ts);

function otMonth(){ return OT_MON || S().DATE.slice(0,7); }
function otDeps(){
  const st=S(), s = OT_ALL ? st.DEPOTS : st.DEPOTS.filter(d=>OT_SCOPE.indexOf(d)>=0);
  return s.length ? s : st.DEPOTS;
}
function otDates(mon){
  const a=mon.split('-'), y=+a[0], m=+a[1], DATE=S().DATE;
  const last=new Date(y,m,0).getDate(), out=[];
  for(let i=1;i<=last;i++){
    const k=mon+'-'+String(i).padStart(2,'0');
    if(!OT_BACK && k<OT_START) continue;
    if(k>DATE) break;
    out.push(k);
  }
  return out;
}
function otMonList(){
  const DATE=S().DATE, out=[];
  const st0 = OT_BACK ? '2026-07' : OT_START;
  let y=+st0.slice(0,4), m=+st0.slice(5,7);
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
      Object.keys(d.absent||{}).forEach(cid=>{ get(cid).abs++; });
      Object.keys(d.checkins||{}).forEach(cid=>{
        const r=d.checkins[cid], o=get(cid); o.ck++; dn++;
        const s=secOf(r.ts);
        if(s>lim){ o.late++; dl++; o.lateDays.push(dk); if(s-lim>o.worst) o.worst=s-lim; }
      });
      daily.push({dk, n:dn, late:dl, pct: dn? (dn-dl)/dn*100 : null});
    });
    const rows=Object.keys(P).map(k=>P[k]).filter(o=>o.ck||o.abs).map(o=>{
      const wd=Math.max(0, active.length-o.abs);
      const rate= wd? (wd-o.late)/wd*100 : null;
      const ty=(String(o.c.type||'').indexOf('4')>=0)?'4W':'2W';
      const pay=OT_PAY[ty], tier=otTier(rate);
      const amt= rate==null? null : (tier==='100'?pay.t100: tier==='95'?pay.t95: tier==='90'?pay.t90: pay.t0);
      return Object.assign({}, o, {
        wd, rate, ty, tier, amt,
        diff:(amt==null? null : pay.g-amt),
        cov:(wd? o.ck/wd*100 : null),
        days:active.length
      });
    });
    byDep[dep]={ active:active.length, rows, daily };
    rows.forEach(r=>people.push(r));
  });
  return { byDep, people, dks };
}

function otBadge(t){
  const M={'100':['#0a7a3d','#e6f6ec','100%'],'95':['#1f6feb','#e8f1ff','95–99%'],
           '90':['#9a6b00','#fff5db','90–94%'],'0':['#b3261e','#fdecea','<90%'],'—':['#666','#eee','—']};
  const x=M[t]||M['—'];
  return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;color:'
    +x[0]+';background:'+x[1]+'">'+x[2]+'</span>';
}
function otBar(daily){
  if(!daily.length) return '<span class="s2">—</span>';
  return '<span style="display:inline-flex;gap:2px;align-items:flex-end;height:22px">'+daily.map(d=>{
    const p = d.pct==null?0:d.pct;
    const col = p>=95?'#0a7a3d':p>=90?'#e6a700':'#d64541';
    const h = Math.max(3, Math.round(p/100*20));
    return '<i title="'+d.dk.slice(5)+' · '+(d.pct==null?'—':Math.round(p)+'%')+'" style="display:block;width:5px;height:'
      +h+'px;background:'+col+';border-radius:1px"></i>';
  }).join('')+'</span>';
}

function paint(){
  const el=document.getElementById('viewOt'); if(!el) return;
  const mon=otMonth(), A=otAgg();
  const n100=A.people.filter(p=>p.tier==='100').length;
  const n95 =A.people.filter(p=>p.tier==='95').length;
  const n90 =A.people.filter(p=>p.tier==='90').length;
  const n0  =A.people.filter(p=>p.tier==='0').length;
  const hold =A.people.reduce((s,p)=>s+Math.max(0,p.diff||0),0);
  const bonus=A.people.reduce((s,p)=>s+Math.max(0,-(p.diff||0)),0);
  const thin  =A.people.filter(p=>p.cov!=null && p.cov<70);
  const noName=A.people.filter(p=>!p.c.code);

  let h='<div class="card" style="border-left:4px solid var(--y)">'
    +'<div style="font-weight:800;font-size:14px">📌 โหมดเก็บข้อมูล — ยังไม่มีผลกับค่าตอบแทน</div>'
    +'<div class="s2" style="margin-top:4px">เริ่มนับ '+OT_START
    +' • หน้านี้เห็นเฉพาะ Manager • Staff และ Courier ไม่เห็นตัวเลขนี้</div></div>';

  h+='<div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    +'<select id="otMon" onchange="window.__otMon(this.value)" style="height:34px;border-radius:8px;padding:0 8px;font-weight:700">'
    + otMonList().map(m=>'<option value="'+m+'"'+(m===mon?' selected':'')+'>'+m+'</option>').join('')
    +'</select>'
    +'<button class="mtab'+(OT_ALL?'':' on')+'" onclick="window.__otScope(0)">5 สาขานำร่อง</button>'
    +'<button class="mtab'+(OT_ALL?' on':'')+'" onclick="window.__otScope(1)">ทุกสาขา</button>'
    +'<button class="mtab'+(OT_BACK?' on':'')+'" onclick="window.__otBack('+(OT_BACK?0:1)+')">📜 ดูย้อนหลัง</button>'
    +'<span style="flex:1"></span>'
    +'<button class="mtab'+(OT_MODE==='cut'?' on':'')+'" onclick="window.__otMode(\'cut\')">กฎ 07:00</button>'
    +'<button class="mtab'+(OT_MODE==='grace'?' on':'')+'" onclick="window.__otMode(\'grace\')">ทบทวน 07:10 🔒</button>'
    +'</div>'
    +(OT_MODE==='grace'
      ? '<div class="s2" style="margin-top:8px;color:#b3261e;font-weight:700">🔒 ชุดนี้ผ่อนผัน 10 นาที — ใช้ประกอบการตัดสินใจภายใน ไม่ใช่ตัวเลขที่ประกาศ</div>' : '')
    +(OT_LOADING? '<div class="s2" style="margin-top:8px">⏳ กำลังโหลดข้อมูลเดือน '+mon+' …</div>' : '')
    +'</div>';

  h+='<div class="kpis" style="grid-template-columns:repeat(5,1fr)">'
    +'<div class="kpi '+(n100?'green':'')+'"><div class="v">'+n100+'</div><div class="l">100% + โบนัส</div></div>'
    +'<div class="kpi"><div class="v">'+n95+'</div><div class="l">95–99% เต็ม</div></div>'
    +'<div class="kpi '+(n90?'am':'')+'"><div class="v">'+n90+'</div><div class="l">90–94% ครึ่ง</div></div>'
    +'<div class="kpi '+(n0?'red':'green')+'"><div class="v">'+n0+'</div><div class="l">ต่ำกว่า 90%</div></div>'
    +'<div class="kpi '+(hold?'red':'green')+'"><div class="v" style="font-size:20px">฿'+B(hold)+'</div><div class="l">ผลต่างจากการันตี</div></div>'
    +'</div>';
  if(bonus) h+='<div class="s2" style="margin:-6px 0 10px">🎁 โบนัสที่ต้องจ่ายเพิ่ม ฿'+B(bonus)+'</div>';

  const warn=[];
  if(noName.length) warn.push('มีคนเช็คอิน '+noName.length+' คนที่ไม่มีชื่อในทะเบียน — คิดเงินไม่ได้');
  if(thin.length)   warn.push('มี '+thin.length+' คนที่บันทึกเช็คอินไม่ถึง 70% ของวันทำงาน — กติกาจะนับวันที่ไม่มีบันทึกเป็น "เข้าทัน" ให้อัตโนมัติ');
  if(warn.length) h+='<div class="card" style="border-left:4px solid #d64541">'
    +'<div style="font-weight:800">⚠️ ข้อมูลยังไม่พร้อมผูกกับเงิน</div>'
    +warn.map(w=>'<div class="s2" style="margin-top:4px">• '+w+'</div>').join('')+'</div>';

  h+='<div class="card"><h2>🏢 ระดับสาขา</h2><div class="dwrap"><table class="dtbl"><thead><tr>'
    +'<th class="l">สาขา</th><th>วันเก็บ</th><th>คน</th><th>On-time เฉลี่ย</th><th>ต่ำกว่า 90%</th><th>ผลต่าง</th><th>แนวโน้มรายวัน</th>'
    +'</tr></thead><tbody>';
  otDeps().map(dep=>{
    const b=A.byDep[dep]||{active:0,rows:[],daily:[]};
    const rs=b.rows.filter(r=>r.rate!=null);
    return {
      dep, b,
      avg: rs.length? rs.reduce((s,r)=>s+r.rate,0)/rs.length : null,
      bad: b.rows.filter(r=>r.tier==='0').length,
      df : b.rows.reduce((s,r)=>s+Math.max(0,r.diff||0),0)
    };
  }).sort((x,y)=>(x.avg==null?-1:x.avg)-(y.avg==null?-1:y.avg)).forEach(x=>{
    const cr = x.avg!=null && x.avg<90;
    h+='<tr'+(cr?' style="background:#fdecea"':'')+'>'
      +'<td class="l"><div class="nm">'+x.dep+(cr?' 🔴':'')+'</div><div class="s2">'+x.b.rows.length+' คน</div></td>'
      +'<td class="n">'+x.b.active+'</td><td class="n">'+x.b.rows.length+'</td>'
      +'<td class="'+(x.avg==null?'n':(x.avg>=95?'g':'b'))+'">'+(x.avg==null?'—':Math.round(x.avg)+'%')+'</td>'
      +'<td class="'+(x.bad?'b':'g')+'">'+x.bad+' คน</td>'
      +'<td class="'+(x.df?'b':'g')+'">฿'+B(x.df)+'</td>'
      +'<td class="n">'+otBar(x.b.daily)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';

  const ppl=A.people.slice().sort((a,b)=>(a.rate==null?999:a.rate)-(b.rate==null?999:b.rate));
  h+='<div class="card"><h2>👤 รายบุคคล <span class="small">เรียงจากแย่ที่สุด • '+ppl.length+' คน</span></h2>'
    +'<div class="dwrap"><table class="dtbl"><thead><tr>'
    +'<th class="l">รหัส / ชื่อ</th><th>สาขา</th><th>รถ</th><th>วันทำงาน</th><th>สาย</th><th>ไม่มา</th>'
    +'<th>On-time</th><th>ระดับ</th><th>ได้รับ</th><th>ผลต่าง</th><th>บันทึกครบ</th>'
    +'</tr></thead><tbody>';
  ppl.forEach(o=>{
    h+='<tr>'
      +'<td class="l"><div class="nm">'+esc(o.c.code||('⚠️ #'+o.cid))+'</div>'
      +'<div class="s2">'+esc(o.c.name||'ไม่มีชื่อในทะเบียน')+'</div></td>'
      +'<td class="n">'+o.dep+'</td><td class="n">'+o.ty+'</td>'
      +'<td class="n">'+o.wd+'</td>'
      +'<td class="'+(o.late?'b':'g')+'">'+o.late+'</td>'
      +'<td class="n">'+(o.abs||'—')+'</td>'
      +'<td class="'+(o.rate==null?'n':(o.rate>=95?'g':'b'))+'">'+(o.rate==null?'—':Math.round(o.rate*10)/10+'%')+'</td>'
      +'<td class="n">'+otBadge(o.tier)+'</td>'
      +'<td class="n">'+(o.amt==null?'—':'฿'+B(o.amt))+'</td>'
      +'<td class="'+(o.diff>0?'b':(o.diff<0?'g':'n'))+'">'
      +(o.diff==null?'—':(o.diff>0?'−฿'+B(o.diff):(o.diff<0?'+฿'+B(-o.diff):'0')))+'</td>'
      +'<td class="'+(o.cov!=null&&o.cov<70?'b':'n')+'">'+(o.cov==null?'—':Math.round(o.cov)+'%')+'</td>'
      +'</tr>';
  });
  h+='</tbody></table></div>'
    +'<div class="s2" style="margin-top:8px">On-time Rate = (วันทำงาน − วันที่สาย) ÷ วันทำงาน • '
    +'วันทำงาน = วันที่สาขามีข้อมูล − วันที่บันทึกว่าไม่มาทำงาน • วันที่ไม่มีบันทึกเช็คอิน นับเป็นเข้าทันตามกติกา</div>'
    +'<div style="margin-top:10px"><button class="mtab" onclick="window.__otCsv()">⬇️ ดาวน์โหลด CSV</button></div></div>';

  el.innerHTML=h;
}

function csv(){
  const A=otAgg(), mon=otMonth();
  const head=['depot','code','name','vendor','type','workDays','lateDays','absentDays','onTimeRate','tier','payout','diffFromGuarantee','coveragePct'];
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const lines=[head.join(',')];
  A.people.forEach(o=>{
    lines.push([o.dep,(o.c.code||('#'+o.cid)),(o.c.name||''),(o.c.vendor||''),o.ty,o.wd,o.late,o.abs,
      (o.rate==null?'':Math.round(o.rate*10)/10),o.tier,(o.amt==null?'':o.amt),
      (o.diff==null?'':o.diff),(o.cov==null?'':Math.round(o.cov))].map(q).join(','));
  });
  const blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='ontime_'+mon+'_'+(OT_MODE==='cut'?'0700':'0710')+'.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

export function initOntime(ctx){
  C = ctx;
  window.__otRender = paint;
  window.__otEnsure = ensureOt;
  window.__otMon    = v => { OT_MON=v; paint(); ensureOt(); };
  window.__otScope  = v => { OT_ALL=!!v; paint(); ensureOt(); };
  window.__otMode   = v => { OT_MODE=v; paint(); };
  window.__otBack   = v => { OT_BACK=!!v; OT_MON=null; paint(); ensureOt(); };
  window.__otCsv    = csv;
  window.__otVer    = OT_VER;
  return OT_VER;
}

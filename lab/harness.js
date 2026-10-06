/* ============================================================
   แล็บทดสอบหลายเครื่องพร้อมกัน — แอป Staff ระบบเดิม (โค้ดจริงทั้งหมด)
   • แต่ละ "เครื่อง" = iframe แยกที่เก็บข้อมูลของตัวเอง (localStorage/IndexedDB แยกกัน)
   • ทุกเครื่องต่อ "คลาวด์จำลอง" ตัวเดียวกัน (ไม่แตะ Firebase จริง)
   • path ของเครื่องเป็น URL ปลอม → ถ้าแอปรีโหลดเอง จะเจอหน้า 404 (ไม่โหลดแอปจริงขึ้นมา)
   ============================================================ */
(function(){
const BASE = '/dhl-attendance/';
const pad = n => String(n).padStart(2,'0');
const today = () => { const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
const W = ms => new Promise(r=>setTimeout(r,ms));
const LAB = window.LAB = { devs:[], src:{}, res:[], t0:performance.now() };

LAB.load = async () => {
  const f = n => fetch(BASE+n+'?x='+Date.now(),{cache:'no-store'}).then(r=>r.text());
  LAB.src.html = await f('DHL_Courier_Attendance.html');
  LAB.src.sync = window.__applyPatch('dhl-sync.js', await f('dhl-sync.js'));
  LAB.src.ui2  = window.__applyPatch('dhl-ui2.js',  await f('dhl-ui2.js'));
  LAB.ui2Url = URL.createObjectURL(new Blob([LAB.src.ui2], {type:'text/javascript'}));
};

LAB.seed = (nCour, opts) => {
  const DB = window.__FSDB = window.__makeFSDB(opts||{});
  const V=['Vendor A','Vendor B','Vendor C'];
  const cs = Array.from({length:nCour}, (_,i)=>({ id:9001+i, code:'TEST'+String(i+1).padStart(3,'0'), name:'ฝึก Courier '+(i+1), vendor:V[i%3], type:i%4?'2W':'4W', active:true }));
  const set=(p,v)=>{ DB.docs.set(p,v); DB.ver.set(p,1); };
  set('config/app', { staffVer:'2026.09.23-q' });
  set('config/teams', { BKK:{ name:'BKK', depots:['PHI','BPE','PWT','PKS','DST','BPL','PWN','KTN'] } });
  set('depots/TEST', { pin:'1234', staffNames:['ฝึก A','ฝึก B','ฝึก C','ฝึก D'], maxStaff:3, couriers:cs, couriersAt:Date.now() });
  LAB.couriers = cs; return DB;
};

function shim(n, staff){
  return `<script>(function(){
  var N='lab${n}_', SP=Storage.prototype, gi=SP.getItem, si=SP.setItem, ri=SP.removeItem;
  SP.getItem=function(k){ return gi.call(this,N+k); }; SP.setItem=function(k,v){ return si.call(this,N+k,v); }; SP.removeItem=function(k){ return ri.call(this,N+k); };
  var io=indexedDB.open.bind(indexedDB); indexedDB.open=function(nm,v){ return io(N+nm,v); };
  if(!localStorage.getItem('dsDepot')){ localStorage.setItem('dsDepot','TEST'); localStorage.setItem('dsStaff',${JSON.stringify(staff)}); localStorage.setItem('dsPin','1234');
    localStorage.setItem('dhl_settings', JSON.stringify({depot:'TEST', staff:${JSON.stringify(staff)}})); localStorage.setItem('dsDataDepot','TEST'); }
  window.__lab=${n}; window.__alerts=[]; window.alert=function(m){ window.__alerts.push(String(m)); }; window.confirm=function(){ return true; }; window.prompt=function(m,d){ return d||''; };
  function fake(){ var c=document.createElement('canvas'); c.width=640; c.height=480; var x=c.getContext('2d'); var f=0;
    function dr(){ f++; x.fillStyle='hsl('+(${n}*110)+',70%,55%)'; x.fillRect(0,0,640,480); x.fillStyle='#fff'; x.beginPath(); x.arc(320,190,80,0,7); x.fill(); x.fillRect(210,280,220,200); x.fillStyle='#000'; x.font='bold 40px sans-serif'; x.fillText('LAB ${n} #'+f,190,70); }
    dr(); var iv=setInterval(dr,250); var s=c.captureStream(8); s.getTracks().forEach(function(t){ var st=t.stop.bind(t); t.stop=function(){ clearInterval(iv); st(); }; }); return s; }
  if(navigator.mediaDevices) navigator.mediaDevices.getUserMedia=function(){ return Promise.resolve(fake()); };
})();<\/script>`;
}

LAB.boot = async (n, staff) => {
  let d = LAB.devs.find(x=>x.n===n);
  if(!d){
    const fr=document.createElement('iframe'); fr.style.cssText='width:360px;height:720px;border:2px solid #999;margin:3px;vertical-align:top';
    document.body.appendChild(fr); d={n, staff, fr, reloads:0}; LAB.devs.push(d);
  }
  d.fr.src = BASE+'__lab_device_'+n+'.html?r='+Date.now();      /* URL ปลอม: รีโหลด = หน้า 404 ไม่ใช่แอปจริง */
  await new Promise(r=>{ d.fr.onload=r; });
  const w = d.fr.contentWindow;
  w.history.replaceState(null,'', BASE+'__lab_device_'+n+'.html?test=1&lab='+n);
  const mock = URL.createObjectURL(new Blob([window.__MOCKFB_SRC(n)],{type:'text/javascript'}));
  const sync = LAB.src.sync.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(app|auth|firestore)\.js/g, mock);
  const syncUrl = URL.createObjectURL(new Blob([sync],{type:'text/javascript'}));
  let h = LAB.src.html;
  h = h.replace(/<head([^>]*)>/i, '<head$1><base href="'+location.origin+BASE+'">'+shim(n, staff));
  const A="<script type=\"module\">import('./dhl-sync.js?b='+Date.now());</script>";
  const B="<script type=\"module\">import('./dhl-ui2.js?b='+Date.now()).catch(()=>{});</script>";
  if(h.split(A).length!==2 || h.split(B).length!==2) throw new Error('html anchors');
  h = h.replace(A, '<script type="module">import('+JSON.stringify(syncUrl)+');</script>').replace(B, '<script type="module">import('+JSON.stringify(LAB.ui2Url)+');</script>');
  w.document.open(); w.document.write(h); w.document.close();
  d.w = w; d.bootAt = performance.now(); d.reloaded = false;
  /* เฝ้าดูการรีโหลด (แอปสั่งรีโหลดเอง → iframe ไปหน้า 404) */
  setTimeout(()=>{ d.fr.onload = () => { d.reloads++; d.reloaded = true; }; }, 1500);
  return d;
};

LAB.ready = async (d, ms) => { const t=performance.now(); while(performance.now()-t < (ms||15000)){ try{ if(d.w.DHLSync && d.w.DHLSync.ready && d.w.couriers && d.w.couriers.length) return performance.now()-t; }catch(e){} await W(100); } return -1; };
LAB.G = (d, name) => { try{ return d.w.eval(name); }catch(e){ return undefined; } };
LAB.recs = async d => { try{ return (await d.w.getByDate(today())) || []; }catch(e){ return null; } };
LAB.pph = async d => { try{ return (await d.w.getPPH(today())) || null; }catch(e){ return null; } };
LAB.cloud = () => (window.__FSDB.docs.get('depots/TEST/days/'+today()) || null);

/* เช็คอินด้วยกล้อง (เส้นทางเดียวกับ Staff กดจริง) */
LAB.ciCam = async (d, cid) => {
  const w=d.w, t=performance.now();
  w.openCamera(cid);
  for(let i=0;i<60;i++){ const v=w.document.getElementById('camVideo'); if(v && v.videoWidth) break; await W(50); }
  await w.capture();
  return performance.now()-t;
};
LAB.waitAll = async (pred, ms) => { const t=performance.now(); while(performance.now()-t<(ms||20000)){ if(await pred()) return Math.round(performance.now()-t); await W(150); } return -1; };
LAB.ok = (name, cond, info) => { LAB.res.push({name, ok:!!cond, info: info===undefined? '' : info}); return !!cond; };
LAB.summary = () => ({ pass: LAB.res.filter(r=>r.ok).length, fail: LAB.res.filter(r=>!r.ok).map(r=>r.name+' '+JSON.stringify(r.info)), stats: window.__FSDB && window.__FSDB.stats });
})();

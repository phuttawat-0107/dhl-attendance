/* ============================================================
   DHL Attendance — Firebase Sync Module (Staff side)
   แทรกด้วย <script type="module" src="dhl-sync.js"></script> ก่อน </body>
   ไม่แตะโค้ดเดิม — ใช้วิธี wrap ฟังก์ชันเดิม (putCheckin / putPPH)
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection,
         query, where, getDocs, deleteDoc, serverTimestamp, addDoc, orderBy, arrayUnion, arrayRemove, deleteField }
  from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAtPH24o4_Iaj81xD6lg5FGjDU9XIzKUAo",
  authDomain: "dhl-attendance-747ba.firebaseapp.com",
  projectId: "dhl-attendance-747ba",
  storageBucket: "dhl-attendance-747ba.firebasestorage.app",
  messagingSenderId: "32188572532",
  appId: "1:32188572532:web:17c975530ba03ab1574221"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const dbF  = getFirestore(app);

const PHOTO_KEEP_DAYS = 30;          // ลบรูปบนคลาวด์อัตโนมัติหลัง 30 วัน (คุมโควตาฟรี)
const PHOTO_MAX_W     = 720;         // ย่อรูปก่อนอัป
const PHOTO_QUALITY   = 0.55;        // ~60-90KB/รูป

const S = {
  uid:null, depot:null, staff:null, pin:null,
  unsubDay:null, unsubCom:null, comments:[], busy:false, ready:false, removed:[], ckDel:{}
};
window.DHLSync = S;

/* ---------- utils ---------- */
/* ตัวแปรที่แอปประกาศด้วย let/const จะไม่อยู่บน window — ต้องอ่านผ่าน global scope */
function G(name){ try{ return (0,eval)(name); }catch(e){ return undefined; } }
const getCouriers = ()=> (Array.isArray(G('couriers'))? G('couriers') : (window.couriers||[]));
const getSettings = ()=> (G('settings') || window.settings || null);

const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet = (k,v) => { try{ localStorage.setItem(k,v); }catch(e){} };
const dayRef  = (dep,date)=> doc(dbF,'depots',dep,'days',date);
const depRef  = dep => doc(dbF,'depots',dep);
const comCol  = dep => collection(dbF,'depots',dep,'comments');
const phoCol  = dep => collection(dbF,'depots',dep,'photos');
const tKey = ()=> (window.todayKey? todayKey() : new Date().toISOString().slice(0,10));

function toast(msg){ if(window.flash) flash(msg); }

/* รอให้ฐานข้อมูลในเครื่อง (IndexedDB) พร้อมก่อน — ไม่งั้น merge จะล้มเหลวเงียบๆ */
async function waitDB(ms=20000){
  const t0=Date.now();
  while(Date.now()-t0<ms){
    try{
      if(window.getByDate){ await getByDate(tKey()); S.dbOK=true; return true; }
    }catch(e){}
    await new Promise(r=>setTimeout(r,300));
  }
  /* ⚠ ฐานข้อมูลในเครื่องเปิดไม่ได้ — ต้องบอก Staff ให้รู้ ไม่ให้ทำงานต่อโดยข้อมูลไม่ถูกบันทึก */
  S.dbOK=false;
  const b=document.getElementById('dsBadge');
  if(b){ b.classList.add('on'); b.style.background='#D40511'; b.style.color='#fff';
    b.textContent='⛔ เปิดฐานข้อมูลไม่ได้ — ปิดแอปแล้วเปิดใหม่';
    b.onclick=()=>alert('เครื่องนี้เปิดฐานข้อมูลในเครื่องไม่ได้\n\nวิธีแก้:\n1) ปิดแท็บ/แอปนี้ทุกหน้าต่าง\n2) เปิดใหม่อีกครั้ง\n\nถ้ายังไม่ได้ ให้ปิด-เปิดเบราว์เซอร์ใหม่ทั้งหมด'); }
  return false;
}

/* ---------- ย่อรูปให้เล็กพอสำหรับ Firestore ---------- */
function shrink(dataUrl){
  return new Promise(res=>{
    if(!dataUrl){ res(null); return; }
    const im=new Image();
    im.onload=()=>{
      const sc=Math.min(1, PHOTO_MAX_W/im.width);
      const c=document.createElement('canvas');
      c.width=Math.round(im.width*sc); c.height=Math.round(im.height*sc);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      let out=c.toDataURL('image/jpeg',PHOTO_QUALITY);
      if(out.length>900000){ out=c.toDataURL('image/jpeg',0.4); }
      res(out.length>950000? null : out);
    };
    im.onerror=()=>res(null);
    im.src=dataUrl;
  });
}

/* ============ LOGIN OVERLAY ============ */
const LOGIN_CSS = `
#dsLogin{position:fixed;inset:0;z-index:9999;background:linear-gradient(165deg,#1a1a1a,#2a2a2a);
  display:none;align-items:center;justify-content:center;padding:24px;font-family:'Segoe UI','Noto Sans Thai',sans-serif;}
#dsLogin.show{display:flex;}
#dsLogin .box{background:#fff;border-radius:28px;padding:26px 22px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:dsUp .35s cubic-bezier(.34,1.56,.64,1);}
@keyframes dsUp{from{opacity:0;transform:translateY(24px) scale(.96);}to{opacity:1;transform:none;}}
#dsLogin h3{font-size:21px;margin:0 0 4px;font-weight:800;}
#dsLogin p{font-size:12.5px;color:#a09884;margin:0 0 16px;}
#dsLogin label{font-size:12px;color:#a09884;font-weight:600;display:block;margin-bottom:4px;}
#dsLogin select,#dsLogin input{width:100%;padding:13px;border:none;border-radius:14px;background:#f2ede2;
  font-size:15px;font-weight:600;color:#3a3428;margin-bottom:12px;font-family:inherit;}
#dsLogin input{letter-spacing:6px;text-align:center;font-size:22px;}
#dsLogin button{width:100%;border:none;border-radius:99px;padding:14px;font-size:15px;font-weight:800;
  background:#1a1a1a;color:#FFCC00;cursor:pointer;transition:transform .18s cubic-bezier(.34,1.56,.64,1);font-family:inherit;}
#dsLogin button:active{transform:scale(.94);}
#dsLogin .err{color:#D40511;font-size:12.5px;font-weight:700;min-height:18px;margin-bottom:6px;}
#dsLogin .yb{height:5px;background:linear-gradient(90deg,#FFCC00,#ffb700);border-radius:99px;margin-bottom:16px;}
#dsBadge{position:fixed;right:10px;bottom:96px;z-index:60;background:#1a1a1a;color:#FFCC00;font-size:11px;
  font-weight:800;padding:6px 11px;border-radius:99px;box-shadow:0 3px 12px rgba(0,0,0,.3);display:none;}
#dsBadge.on{display:block;}
#dsBell{position:fixed;right:10px;bottom:136px;z-index:61;background:#D40511;color:#fff;font-size:12px;font-weight:800;
  padding:9px 13px;border-radius:99px;box-shadow:0 4px 14px rgba(212,5,17,.5);display:none;cursor:pointer;
  animation:dsPulse 1.4s infinite;}
#dsBell.on{display:block;}
@keyframes dsPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.09);}}
#dsCom{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;}
#dsCom.show{display:flex;}
#dsCom .sheet{background:#fff;border-radius:26px 26px 0 0;width:100%;max-width:640px;max-height:80vh;overflow:auto;padding:20px;
  font-family:'Segoe UI','Noto Sans Thai',sans-serif;animation:dsSlide .28s ease;}
@keyframes dsSlide{from{transform:translateY(60px);opacity:.4;}to{transform:none;opacity:1;}}
#dsCom .cm{background:#fff8d9;border-radius:16px;padding:13px;margin-bottom:10px;}
#dsCom .cm .t{font-size:11px;color:#a09884;font-weight:700;margin-bottom:4px;}
#dsCom .cm .x{font-size:14.5px;line-height:1.55;}
#dsCom .cm button{border:none;border-radius:99px;padding:9px 16px;font-size:12.5px;font-weight:800;
  background:#1a1a1a;color:#FFCC00;cursor:pointer;margin-top:9px;font-family:inherit;}
#dsCom .cm.done{background:#f3faf5;} #dsCom .cm.done .ok{color:#1c7a4d;font-weight:800;font-size:12px;}
`;

async function injectUI(){
  const st=document.createElement('style'); st.textContent=LOGIN_CSS; document.head.appendChild(st);
  const d=document.createElement('div'); d.id='dsLogin';
  d.innerHTML=`<div class="box"><div class="yb"></div>
    <h3>เข้าสู่ระบบ</h3><p>ใส่ PIN ของสาขา แล้วเลือกชื่อของคุณ</p>
    <label>สาขา</label><select id="dsDep"></select>
    <label>PIN สาขา (4 หลัก)</label><input id="dsPin" type="tel" inputmode="numeric" maxlength="6" placeholder="••••••">
    <label>ชื่อผู้บันทึก</label><select id="dsStaff"><option value="">— เลือกชื่อ —</option></select>
    <div class="err" id="dsErr"></div>
    <button id="dsGo">เข้าใช้งาน</button></div>`;
  document.body.appendChild(d);
  const b=document.createElement('div'); b.id='dsBadge'; document.body.appendChild(b);
  const bell=document.createElement('div'); bell.id='dsBell'; bell.textContent='💬 คอมเมนต์ใหม่';
  bell.onclick=openComments; document.body.appendChild(bell);
  const cm=document.createElement('div'); cm.id='dsCom';
  cm.innerHTML='<div class="sheet"><h3 style="font-size:18px;margin-bottom:12px;">💬 คอมเมนต์จากผู้จัดการ</h3><div id="dsComList"></div>'
    +'<button onclick="document.getElementById(\'dsCom\').classList.remove(\'show\')" '
    +'style="width:100%;border:none;border-radius:99px;padding:13px;font-weight:800;background:#f2ede2;color:#5a5140;margin-top:6px;cursor:pointer;font-family:inherit;">ปิด</button></div>';
  document.body.appendChild(cm);

  /* สาขา TEST จะโผล่เฉพาะเมื่อเปิดลิงก์ด้วย ?test=1 — Staff ทั่วไปไม่เห็น */
  let deps=['PHI','BPE','PWT','PKS','DST','BPL','PWN'];
  /* ทีมจากลิงก์ ?t=XXX — แต่ละทีมเห็นเฉพาะสาขาของตัวเอง */
  const tm=(location.search.match(/[?&]t=([A-Za-z0-9_]+)/)||[])[1];
  if(tm){
    try{
      const ts=await getDoc(doc(dbF,'config','teams'));
      const T=ts.exists()? ts.data():null;
      const key=Object.keys(T||{}).find(k=>k.toUpperCase()===tm.toUpperCase());
      if(key && Array.isArray(T[key].depots) && T[key].depots.length) deps=T[key].depots.slice();
    }catch(e){ console.warn('team',e); }
  }
  if(/[?&]test=1/.test(location.search) && !deps.includes('TEST')) deps.push('TEST');
  document.getElementById('dsDep').innerHTML=deps.map(x=>'<option>'+x+'</option>').join('');
  const st0=getSettings();
  const cur=(st0&&st0.depot)||lsGet('dsDepot');
  if(cur) document.getElementById('dsDep').value=cur;
  document.getElementById('dsDep').onchange=()=>{
    const b=document.getElementById('dsGo'); b.textContent='เข้าใช้งาน'; delete b.dataset.force;
    loadStaffList();
  };
  document.getElementById('dsStaff').onchange=()=>{
    const b=document.getElementById('dsGo'); b.textContent='เข้าใช้งาน'; delete b.dataset.force;
    document.getElementById('dsErr').textContent='';
  };
  document.getElementById('dsGo').onclick=function(){ doLogin(this.dataset.force==='1'); };
  loadStaffList();
}

const sesCol = dep => collection(dbF,'depots',dep,'sessions');
const SES_TIMEOUT = 6*60*1000;       // ไม่ heartbeat เกิน 6 นาที = ถือว่าออกแล้ว

async function loadStaffList(){
  const dep=document.getElementById('dsDep').value;
  const sel=document.getElementById('dsStaff');
  const err=document.getElementById('dsErr');
  sel.innerHTML='<option value="">— กำลังโหลด —</option>';
  try{
    const snap=await getDoc(depRef(dep));
    const names=(snap.exists()&&snap.data().staffNames)||[];
    if(!names.length){
      sel.innerHTML='<option value="">— ยังไม่มีรายชื่อ —</option>';
      err.textContent='สาขานี้ยังไม่มีรายชื่อ — แจ้งผู้จัดการเพิ่มชื่อให้ก่อน';
      return;
    }
    const owner=lsGet('dsDataDepot');
    err.style.color = (owner&&owner!==dep) ? '#a06a00' : '';
    err.innerHTML = (owner&&owner!==dep)
      ? '⚠ เครื่องนี้เก็บข้อมูลของสาขา <b>'+owner+'</b> อยู่<br>ถ้าเข้าสาขา <b>'+dep
        +'</b> ระบบจะล้างข้อมูลเดิมทิ้งแล้วดึงของ '+dep+' ลงมาใหม่'
      : '';
    sel.innerHTML='<option value="">— เลือกชื่อ —</option>'+names.map(n=>'<option>'+n+'</option>').join('');
    const last=lsGet('dsStaff'); if(last&&names.includes(last)) sel.value=last;
  }catch(e){ sel.innerHTML='<option value="">— เลือกชื่อ —</option>'; }
}

async function doLogin(force){
  const dep=document.getElementById('dsDep').value;
  const pin=document.getElementById('dsPin').value.trim();
  const staff=document.getElementById('dsStaff').value;
  const err=document.getElementById('dsErr');
  err.textContent='';
  const fail=m=>{ err.textContent=m; document.getElementById('dsLogin').classList.add('show'); return false; };
  if(!/^\d{4,6}$/.test(pin)) return fail('PIN ต้องเป็นตัวเลข 4–6 หลัก');
  if(!staff) return fail('เลือกชื่อผู้บันทึกก่อน');
  err.textContent='กำลังตรวจสอบ...';
  try{
    const snap=await getDoc(depRef(dep));
    if(!snap.exists()) return fail('สาขานี้ยังไม่ถูกตั้งค่า — แจ้งผู้จัดการ');
    const d=snap.data();
    if(!d.pin) return fail('สาขานี้ยังไม่ตั้ง PIN — แจ้งผู้จัดการ');
    if(d.pin!==pin){ try{ localStorage.removeItem('dsPin'); }catch(e){}
      document.getElementById('dsPin').value='';
      return fail('PIN ไม่ถูกต้อง'); }
    const names=d.staffNames||[];
    if(!names.includes(staff)) return fail('ไม่พบชื่อนี้ในสาขา '+dep+' — แจ้งผู้จัดการ');

    /* ---- ตรวจการเข้าซ้ำซ้อน ---- */
    const now=Date.now();
    const ss=await getDocs(sesCol(dep));
    const active=ss.docs.map(x=>({name:x.id,...x.data()}))
      .filter(x=> now-(x.at||0) < SES_TIMEOUT);
    const mine=active.find(x=>x.name===staff);
    if(mine && mine.uid!==S.uid && !force){
      document.getElementById('dsLogin').classList.add('show');
      err.innerHTML='⚠ ชื่อ "'+staff+'" กำลังใช้งานอยู่บนอีกเครื่อง<br>'
        +'<span style="font-weight:400;color:#a09884;">ถ้าเป็นเครื่องเก่าของคุณเอง กดปุ่มด้านล่างเพื่อย้ายมาเครื่องนี้</span>';
      const b=document.getElementById('dsGo');
      b.textContent='เข้าแทนที่เครื่องเดิม'; b.dataset.force='1';
      return false;
    }
    const maxN = (+d.maxStaff)|| (dep==='BPE'?4:3);
    const others=active.filter(x=>x.name!==staff).length;
    if(others+1 > maxN){
      document.getElementById('dsLogin').classList.add('show');
      err.innerHTML='⛔ สาขา '+dep+' เข้าใช้ได้สูงสุด '+maxN+' เครื่อง<br>'
        +'<span style="font-weight:400;color:#a09884;">กำลังใช้อยู่: '+active.map(x=>x.name).join(', ')+'</span>';
      return false;
    }
    await setDoc(doc(sesCol(dep),staff),{ uid:S.uid, at:now, ua:navigator.userAgent.slice(0,90) });
  }catch(e){ return fail('เชื่อมต่อไม่ได้: '+e.message); }
  S.depot=dep; S.staff=staff; S.pin=pin;
  lsSet('dsDepot',dep); lsSet('dsStaff',staff); lsSet('dsPin',pin);
  document.getElementById('dsLogin').classList.remove('show');
  await afterLogin();
  return true;
}

/* heartbeat + ตรวจว่าถูกเครื่องอื่นแทนที่ */
function startHeartbeat(){
  if(S._hb) clearInterval(S._hb);
  const beat=async ()=>{
    if(!S.ready||!S.depot||!S.staff) return;
    try{
      const ref=doc(sesCol(S.depot),S.staff);
      const s=await getDoc(ref);
      if(s.exists() && s.data().uid && s.data().uid!==S.uid){
        S.ready=false; if(S.unsubDay)S.unsubDay(); if(S.unsubCom)S.unsubCom();
        document.getElementById('dsBadge').classList.remove('on');
        alert('⚠ ชื่อ "'+S.staff+'" ถูกใช้เข้าระบบจากเครื่องอื่น\nเครื่องนี้จะออกจากระบบเพื่อป้องกันข้อมูลชนกัน');
        try{ localStorage.removeItem('dsStaff'); }catch(e){}
        location.reload(); return;
      }
      /* 🛡 ส่งสถานะสุขภาพขึ้นไปด้วย — Manager จะเห็นปัญหาเองโดยไม่ต้องรอ Staff แจ้ง */
      let nLocal=0;
      try{ nLocal=(await getByDate(tKey())).length; }catch(e){}
      await setDoc(ref,{ uid:S.uid, at:Date.now(),
        ver:H.ver, lastPush:H.lastPush, lastPull:H.lastPull,
        err:H.err||'', errAt:H.errAt||0, nLocal, taps:H.taps, saves:H.saves },{merge:true});
    }catch(e){}
  };
  beat(); S._hb=setInterval(beat,120000);
}

/* เครื่องที่เพิ่งเข้าใช้ครั้งแรกจะยังไม่มี dhl_settings → หน้า "จัดการ"/Dashboard จะพัง
   ฟังก์ชันนี้สร้างให้อัตโนมัติ แล้วรีโหลดหนึ่งครั้งเพื่อให้แอปอ่านค่าใหม่
   คืน true = กำลังรีโหลด (ให้หยุดทำงานต่อ) */
function ensureAppSettings(){
  const live=getSettings();
  if(live){                                   // มีอยู่แล้ว → อัปเดตให้ตรงกับที่ล็อกอิน
    live.depot=S.depot; live.staff=S.staff;
    try{ localStorage.setItem('dhl_settings',JSON.stringify(live)); }catch(e){}
    if(window.applyHeader) try{ applyHeader(); }catch(e){}
    return false;
  }
  let base={};
  try{ base=JSON.parse(localStorage.getItem('dhl_settings')||'{}')||{}; }catch(e){ base={}; }
  base.depot=S.depot; base.staff=S.staff;
  try{ localStorage.setItem('dhl_settings',JSON.stringify(base)); }catch(e){}
  let done=false; try{ done=sessionStorage.getItem('dsInitReload')==='1'; }catch(e){}
  if(!done){
    try{ sessionStorage.setItem('dsInitReload','1'); }catch(e){}
    const b=document.getElementById('dsBadge');
    if(b) b.textContent='⏳ กำลังเริ่มระบบ...';
    setTimeout(()=>location.reload(),600);
    return true;
  }
  return false;
}

/* ============ 🔒 กันข้อมูลข้ามสาขา ============
   เครื่องหนึ่งเครื่องเก็บข้อมูลได้ทีละ 1 สาขาเท่านั้น
   ถ้าล็อกอินสาขาใหม่ → ล้างข้อมูลสาขาเดิมออกก่อน แล้วดึงของสาขาใหม่ลงมา */
async function wipeLocalData(){
  /* ล้าง IndexedDB ทุกตาราง */
  try{
    const dbx=await new Promise((res,rej)=>{ const q=indexedDB.open('dhl_attendance');
      q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); });
    for(const n of [...dbx.objectStoreNames]){
      await new Promise(r=>{ const t=dbx.transaction(n,'readwrite');
        try{ t.objectStore(n).clear(); }catch(e){}
        t.oncomplete=r; t.onerror=r; t.onabort=r; });
    }
    dbx.close();
  }catch(e){ console.warn('[ds] wipe idb',e); }
  /* ล้างรายชื่อ Courier ในเครื่อง */
  try{ localStorage.removeItem('dhl_couriers'); localStorage.removeItem('couriers'); }catch(e){}
}
/* คืน true = กำลังล้าง+รีโหลด ให้หยุดทำงานต่อ */
async function guardDepotData(){
  const owner=lsGet('dsDataDepot');
  if(!owner){ lsSet('dsDataDepot',S.depot); return false; }   // เครื่องเดิม → ผูกสาขาให้เลย
  if(owner===S.depot) return false;                            // สาขาเดิม → ปกติ
  const b=document.getElementById('dsBadge');
  if(b){ b.style.background='#D40511'; b.style.color='#fff';
         b.textContent='🧹 ล้างข้อมูลสาขา '+owner+' ...'; }
  await wipeLocalData();
  lsSet('dsDataDepot',S.depot);
  setTimeout(()=>location.reload(),700);
  return true;
}

async function afterLogin(){
  await waitDB();                       // ⏳ รอฐานข้อมูลในเครื่องพร้อมก่อนเสมอ
  if(await guardDepotData()) return;     // 🔒 เปลี่ยนสาขา → ล้างของเดิมแล้วเริ่มใหม่
  S.ready=true;
  document.getElementById('dsBadge').classList.add('on');
  document.getElementById('dsBadge').textContent='☁ '+S.depot+' · '+S.staff;
  /* ให้แอปเดิมใช้ค่าตรงกัน (คีย์จริงคือ dhl_settings) */
  if(ensureAppSettings()) return;      // เครื่องใหม่: สร้างค่าตั้งต้นแล้วรีโหลด 1 ครั้ง
  /* 1) ดึงของสาขาลงมาก่อน (สำคัญมากสำหรับเครื่องที่ยังไม่มีข้อมูล/รายชื่อ) */
  await pullOnce();
  /* 2) แล้วค่อยส่งของเราขึ้นไปเสริม */
  await pushAll();
  listenDay();
  listenComments();
  listenNotices();                     // 📣 ประกาศจากผู้จัดการ
  setTimeout(checkNotices, 2500);
  startHeartbeat();
  purgeOldPhotos30();
  setTimeout(backfill, 4000);          // 🛟 กู้ข้อมูลย้อนหลังที่หายไป (ถ้ามี)
}

/* ดึงข้อมูลวันนี้ + รายชื่อ Courier ของสาขาลงเครื่องทันที */
async function pullOnce(){
  try{
    await waitDB();
    const dep0=await getDoc(depRef(S.depot));
    if(dep0.exists()){
      S.removed = Array.isArray(dep0.data().removedIds)? dep0.data().removedIds.map(Number) : [];
      const cloudList=dep0.data().couriers;
      /* 🔒 ครั้งแรกหลังล็อกอิน: ตัดรายชื่อที่ไม่ใช่ของสาขานี้ทิ้ง (กันข้อมูลข้ามสาขาค้างในเครื่อง)
         ทำเฉพาะตอนล็อกอินครั้งแรก เพื่อไม่ให้ไปลบคนที่ Staff เพิ่งเพิ่มแล้วยังไม่ทันซิงค์ */
      if(!S.firstPullDone && Array.isArray(cloudList) && cloudList.length){
        purgeForeignCouriers(cloudList);
      }
      if(cloudList) mergeCouriers(cloudList);
      purgeRemovedLocal();
      S.firstPullDone=true;
    }
    const snap=await getDoc(dayRef(S.depot,tKey()));
    if(snap.exists()){ await mergeRemote(snap.data()); }
    else repaintSoon();
    /* ตรวจซ้ำ: ถ้าคลาวด์มีแต่เครื่องยังว่าง แปลว่า merge ไม่ติด — ลองใหม่ */
    if(snap.exists()){
      const n=Object.keys(snap.data().checkins||{}).length;
      if(n){
        const local=await getByDate(tKey());
        if(local.length<n){ S.merging=false; await mergeRemote(snap.data()); }
      }
    }
    H.lastPull=Date.now();
  }catch(e){ console.warn('pull',e); flagErr('ดึงข้อมูลจากคลาวด์ไม่สำเร็จ: '+e.message); }
}

/* ============ PUSH: ส่งข้อมูลวันนี้ขึ้นคลาวด์ ============ */
/* เขียนแบบ field-level (dot path) — ไม่ทับข้อมูลของเครื่องอื่น และไม่ล้างด้วยค่าว่าง */
async function pushAll(){
  if(!S.ready||S.busy) return;
  /* 🔒 กันข้อมูลข้ามสาขา: ถ้าข้อมูลในเครื่องเป็นของสาขาอื่น ห้ามส่งขึ้นเด็ดขาด */
  if(lsGet('dsDataDepot') && lsGet('dsDataDepot')!==S.depot){
    console.warn('[ds] ข้ามการส่ง — ข้อมูลในเครื่องเป็นของสาขา '+lsGet('dsDataDepot')); return;
  }
  S.busy=true;
  try{
    const date=tKey();
    let recs = window.getByDate? await getByDate(date) : [];
    /* 🚫 ไม่ส่งระเบียนที่ถูกลบไปแล้ว (และลบทิ้งจากเครื่องนี้ให้ด้วย) */
    const ckDel=S.ckDel||{};
    if(Object.keys(ckDel).length){
      const dead=recs.filter(r=>isDeleted(ckDel, r.courierId, r.ts));
      if(dead.length){
        for(const r of dead){ try{ if(S._rawDel) await S._rawDel(r.id); }catch(e){} }
        recs=recs.filter(r=>!dead.some(x=>x.id===r.id));
        repaintSoon();
      }
    }
    const pph  = window.getPPH?    await getPPH(date)    : null;
    const hasPph = pph && ((+pph.pNew||0)+(+pph.pOld||0) > 0 || pph.inboundTs || pph.lastInboundTs
                    || (pph.pd&&pph.pd.ts) || Object.keys(pph.rp||{}).length);
    /* ⛔ ไม่มีอะไรจะส่ง = ไม่แตะคลาวด์เลย (กันเครื่องเปล่าเขียนทับข้อมูลสาขา) */
    if(!recs.length && !hasPph){ S.busy=false; return; }

    const ref=dayRef(S.depot,date);
    await setDoc(ref,{ depot:S.depot, date, by:S.staff, updatedAt:Date.now() },{ merge:true });

    const up={};
    recs.forEach(r=>{ up['checkins.'+r.courierId]={ ts:r.ts, status:r.status, buffer:!!r.buffer,
      uniform:r.uniform!==false, manualEdit:!!r.manualEdit, staff:r.staff||S.staff, hasPhoto:!!r.photo }; });
    if(pph){
      ['staffN','sorterN','courierN','pNew','pOld'].forEach(k=>{ if(pph[k]!=null) up['pph.'+k]=+pph[k]||0; });
      if(pph.inboundTs)     up['pph.inboundTs']=pph.inboundTs;
      if(pph.lastInboundTs) up['pph.lastInboundTs']=pph.lastInboundTs;
      if(pph.pd&&pph.pd.ts) up['pph.pd']={ ts:pph.pd.ts, manualEdit:!!pph.pd.manualEdit, hasPhoto:!!pph.pd.photo };
      Object.entries(pph.rp||{}).forEach(([cid,q])=>{
        const o={}; if(q.fs)o.fs=q.fs; if(q.dep)o.dep=q.dep; if(q.fdel)o.fdel=q.fdel;
        if(Object.keys(o).length) up['pph.rp.'+cid]=o;
      });
    }
    const couriers=getCouriers().filter(c=>c.active!==false && !(S.removed||[]).includes(Number(c.id)))
      .map(c=>({ id:c.id, code:c.code, name:c.name, vendor:c.vendor||'', type:c.type||'' }));
    if(couriers.length){
      up['couriers']=couriers;
      /* เก็บ master list ไว้ที่สาขาด้วย — Manager ใช้เป็นตัวสำรองถ้าวันไหนไม่มี */
      try{ await setDoc(depRef(S.depot),{ couriers, couriersAt:Date.now() },{merge:true}); }catch(e){}
    }

    if(Object.keys(up).length) await updateDoc(ref,up);
    H.lastPush=Date.now(); H.saves++; H.err=''; H.ok=true;
    const eb=document.getElementById('dsErrBar'); if(eb) eb.remove();
  }catch(e){ console.warn('sync push',e); flagErr('ส่งข้อมูลขึ้นคลาวด์ไม่สำเร็จ: '+e.message); }
  S.busy=false;
}
let pushTimer=null;
function pushSoon(){ clearTimeout(pushTimer); pushTimer=setTimeout(pushAll,700); }

/* ============ 🛟 กู้ข้อมูลย้อนหลัง ============
   ตรวจ 7 วันย้อนหลัง: วันไหนเครื่องมีข้อมูลแต่คลาวด์ไม่มี/ไม่ครบ → ส่งขึ้นไปคืน
   ทำครั้งเดียวหลังล็อกอิน (เงียบๆ ไม่รบกวนการทำงาน) */
async function backfill(){
  if(!S.ready) return;
  try{
    const today=tKey();
    for(let i=1;i<=7;i++){
      const d=new Date(); d.setDate(d.getDate()-i);
      const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      if(date===today) continue;
      let recs=[]; try{ recs=await getByDate(date); }catch(e){ continue; }
      let lp=null; try{ lp=await getPPH(date); }catch(e){}
      const lRp=lp? Object.keys(lp.rp||{}).length : 0;
      if(!recs.length && !lRp) continue;                 // เครื่องนี้ไม่มีข้อมูลวันนั้น

      const snap=await getDoc(dayRef(S.depot,date));
      const cN = snap.exists()? Object.keys(snap.data().checkins||{}).length : 0;
      const cRp= snap.exists()&&snap.data().pph? Object.keys(snap.data().pph.rp||{}).length : 0;
      if(recs.length<=cN && lRp<=cRp) continue;          // คลาวด์ครบแล้ว

      /* ส่งคืนวันนั้น */
      const ref=dayRef(S.depot,date);
      await setDoc(ref,{ depot:S.depot, date, by:S.staff, restoredAt:Date.now() },{merge:true});
      const up={};
      recs.forEach(r=>{ up['checkins.'+r.courierId]={ ts:r.ts, status:r.status, buffer:!!r.buffer,
        uniform:r.uniform!==false, manualEdit:!!r.manualEdit, staff:r.staff||S.staff, hasPhoto:!!r.photo }; });
      if(lp){
        ['staffN','sorterN','courierN','pNew','pOld'].forEach(k=>{ if(lp[k]!=null) up['pph.'+k]=+lp[k]||0; });
        if(lp.inboundTs)     up['pph.inboundTs']=lp.inboundTs;
        if(lp.lastInboundTs) up['pph.lastInboundTs']=lp.lastInboundTs;
        if(lp.pd&&lp.pd.ts)  up['pph.pd']={ ts:lp.pd.ts, manualEdit:!!lp.pd.manualEdit, hasPhoto:!!lp.pd.photo };
        Object.entries(lp.rp||{}).forEach(([cid,q])=>{
          const o={}; if(q.fs)o.fs=q.fs; if(q.dep)o.dep=q.dep; if(q.fdel)o.fdel=q.fdel;
          if(Object.keys(o).length) up['pph.rp.'+cid]=o;
        });
      }
      const cl=getCouriers().filter(c=>c.active!==false && !(S.removed||[]).includes(Number(c.id)))
        .map(c=>({ id:c.id, code:c.code, name:c.name, vendor:c.vendor||'', type:c.type||'' }));
      if(cl.length) up['couriers']=cl;
      if(Object.keys(up).length) await updateDoc(ref,up);
      console.log('backfill: กู้ข้อมูลวัน '+date+' คืนแล้ว ('+recs.length+' คน)');
      toast('🛟 กู้ข้อมูลวัน '+date+' คืนขึ้นระบบแล้ว');
    }
  }catch(e){ console.warn('backfill',e); }
}

/* ============ PHOTOS: ย่อ + อัปขึ้น Firestore ============ */
/* ลบเช็คอินคนหนึ่งออกจากคลาวด์ (พร้อมรูป) — ใช้ตอน Staff กด "บันทึกใหม่/ลบ"
   จด ckDel[cid] = เวลาที่ลบ  → ทุกเครื่องจะลบเฉพาะระเบียนที่เก่ากว่าเวลานี้
   ถ้าเช็คอินใหม่ทีหลัง (ts ใหม่กว่า) จะไม่โดนลบ ไม่ต้องยกเลิก tombstone เอง */
async function removeCloudCheckin(cid, delTs){
  if(!S.ready||cid==null) return;
  const date=tKey(), now=Date.now();
  try{
    await updateDoc(dayRef(S.depot,date),{ ['checkins.'+cid]: deleteField(),
      ['ckDel.'+cid]: { ts:(delTs||0), at:now }, updatedAt:now });
    S.ckDel=S.ckDel||{}; S.ckDel[String(cid)]={ts:(delTs||0), at:now};
  }catch(e){ console.warn('rm checkin',e); }
  try{ await deleteDoc(doc(phoCol(S.depot),'ci_'+cid+'_'+date)); }catch(e){}
}
function isDeleted(ckDel, cid, ts){
  const e=ckDel && ckDel[String(cid)];
  if(!e) return false;
  if(typeof e==='number') return false;
  return Number(e.ts)>0 && Number(e.ts)===Number(ts);
}

/* ============ 📷 ดึงรูปจากคลาวด์ลงเครื่อง (ให้ทุกเครื่องเห็นรูปเหมือนกัน) ============ */
const photoQ=[]; let photoBusy=false, photoDone={};
function queuePhotoPull(cid,date){
  const key=cid+'_'+date;
  if(photoDone[key]) return;
  if(photoQ.some(x=>x.key===key)) return;
  photoQ.push({cid,date,key});
  runPhotoQ();
}
async function runPhotoQ(){
  if(photoBusy||!photoQ.length||!S.ready) return;
  photoBusy=true;
  let got=0;
  while(photoQ.length){
    const j=photoQ.shift();
    photoDone[j.key]=1;
    try{
      const snap=await getDoc(doc(phoCol(S.depot),'ci_'+j.cid+'_'+j.date));
      if(!snap.exists()||!snap.data().d) continue;
      const recs=await getByDate(j.date);
      const rec=recs.find(r=>String(r.courierId)===String(j.cid));
      if(!rec||rec.photo) continue;
      rec.photo=snap.data().d;
      const put=S._rawPutCheckin||window.putCheckin;
      const wasMerging=S.merging; S.merging=true;      // อย่าให้ push กลับขึ้นคลาวด์
      try{ await put(rec); }finally{ S.merging=wasMerging; }
      got++;
    }catch(e){ console.warn('photo pull',e); }
    await new Promise(r=>setTimeout(r,120));           // เว้นจังหวะ ไม่ให้เครื่องหน่วง
  }
  photoBusy=false;
  if(got){ toast('📷 โหลดรูปจากเครื่องอื่นแล้ว '+got+' รูป'); repaintSoon(); }
}

let pdPulled={};
async function queuePdPull(date){
  if(pdPulled[date]||!S.ready) return; pdPulled[date]=1;
  try{
    const snap=await getDoc(doc(phoCol(S.depot),'pd_pd_'+date));
    if(!snap.exists()||!snap.data().d) return;
    const cur=await getPPH(date); if(!cur||!cur.pd||cur.pd.photo) return;
    cur.pd.photo=snap.data().d;
    const put=S._rawPutPPH||window.putPPH;
    const was=S.merging; S.merging=true;
    try{ await put(cur); }finally{ S.merging=was; }
    toast('📷 โหลดรูป PD จากเครื่องอื่นแล้ว'); repaintSoon();
  }catch(e){ console.warn('pd pull',e); }
}

async function pushPhoto(kind, cid, dataUrl){
  if(!S.ready||!dataUrl) return;
  try{
    const small=await shrink(dataUrl); if(!small) return;
    const date=tKey();
    const id=kind+'_'+(cid||'pd')+'_'+date;
    await setDoc(doc(phoCol(S.depot),id),{ kind, cid:cid||null, date, d:small, at:Date.now(), by:S.staff });
  }catch(e){ console.warn('photo up',e); }
}
async function purgeOldPhotos30(){
  try{
    const cut=new Date(Date.now()-PHOTO_KEEP_DAYS*86400000).toISOString().slice(0,10);
    const q=query(phoCol(S.depot), where('date','<',cut));
    const snap=await getDocs(q);
    for(const d of snap.docs) await deleteDoc(d.ref);
    if(snap.size) console.log('purged cloud photos:',snap.size);
  }catch(e){}
}

/* ============ LISTEN: ข้อมูลจากเครื่องอื่นในสาขาเดียวกัน ============ */
function listenDay(){
  if(S.unsubDay) S.unsubDay();
  const date=tKey();
  S.unsubDay=onSnapshot(dayRef(S.depot,date), async snap=>{
    if(snap.metadata.hasPendingWrites) return;      // การเขียนของเราเอง
    if(!snap.exists()){ await selfHeal(null); return; }   // 🛟 คลาวด์ว่าง → ส่งของเราขึ้นไปคืน
    await mergeRemote(snap.data());
    await selfHeal(snap.data());
  }, e=>console.warn('listen day',e));
}

/* 🛟 SELF-HEAL: ถ้าคลาวด์มีข้อมูลน้อยกว่าในเครื่อง (ถูกลบ/หาย) → ส่งขึ้นไปคืนอัตโนมัติ */
async function selfHeal(cloud){
  if(!S.ready||S.merging) return;
  try{
    const date=tKey();
    const local=await getByDate(date);
    const lp=await getPPH(date);
    const cN=cloud? Object.keys(cloud.checkins||{}).length : 0;
    const cRp=cloud&&cloud.pph? Object.keys(cloud.pph.rp||{}).length : 0;
    const lRp=lp? Object.keys(lp.rp||{}).length : 0;
    const cPd=!!(cloud&&cloud.pph&&cloud.pph.pd&&cloud.pph.pd.ts);
    const lPd=!!(lp&&lp.pd&&lp.pd.ts);
    if(local.length>cN || lRp>cRp || (lPd&&!cPd)){
      console.log('self-heal: คืนข้อมูลขึ้นคลาวด์', {local:local.length, cloud:cN});
      await pushAll();
    }
  }catch(e){}
}

/* ซิงค์รายชื่อ Courier ลงเครื่อง — สำคัญมากสำหรับเครื่องที่เพิ่งเข้าใช้ครั้งแรก */
/* 🔒 ตัดรายชื่อที่ไม่ได้อยู่ในทะเบียนของสาขานี้ออก (ข้อมูลข้ามสาขาที่ค้างในเครื่อง)
   เรียกเฉพาะตอน pull ครั้งแรกหลังล็อกอินเท่านั้น */
function purgeForeignCouriers(cloudList){
  const arr=getCouriers(); if(!Array.isArray(arr)||!arr.length) return false;
  const ok={}; cloudList.forEach(c=>{ if(c&&c.id!=null) ok[Number(c.id)]=1; });
  /* 🛡 ตัดเฉพาะคนที่ "รหัสขึ้นต้นด้วยชื่อสาขาอื่น" เท่านั้น
     คนที่รหัสเป็นของสาขานี้ หรือรหัสไม่มีรูปแบบชัดเจน จะไม่ถูกแตะ
     (กันไม่ให้ลบพนักงานจริงที่ Staff เพิ่งเพิ่มแล้วยังไม่ทันซิงค์ขึ้นคลาวด์) */
  const OTHERS=['PHI','BPE','PWT','PKS','DST','BPL','PWN','TST','TEST'].filter(p=>p!==S.depot && p!==(S.depot==='TEST'?'TST':''));
  const isOther=c=>{
    const code=String(c.code||'').toUpperCase();
    if(!code) return false;
    if(code.indexOf(String(S.depot).toUpperCase())===0) return false;      // รหัสของสาขานี้ → ไม่แตะ
    if(S.depot==='TEST' && code.indexOf('TST')===0) return false;
    return OTHERS.some(p=>code.indexOf(p)===0);                            // ขึ้นต้นด้วยสาขาอื่นเท่านั้น
  };
  const foreign=arr.filter(c=>!ok[Number(c.id)] && isOther(c));
  if(!foreign.length) return false;
  console.warn('[ds] ตัดรายชื่อข้ามสาขา '+foreign.length+' คน:', foreign.map(c=>c.code));
  const kill={}; foreign.forEach(c=>kill[Number(c.id)]=1);
  for(let i=arr.length-1;i>=0;i--) if(kill[Number(arr[i].id)]) arr.splice(i,1);
  try{ localStorage.setItem('dhl_couriers',JSON.stringify(arr)); }catch(e){}
  try{ if(window.saveCouriers) saveCouriers(); }catch(e){}
  try{ if(window.renderManage) renderManage(); }catch(e){}
  try{ if(window.renderCheckin) renderCheckin(); }catch(e){}
  toast('🧹 ตัดรายชื่อที่ไม่ใช่ของสาขานี้ออก '+foreign.length+' คน');
  return true;
}

/* ลบพนักงานที่ถูกลบทิ้ง (tombstone) ออกจากรายชื่อในเครื่อง */
function purgeRemovedLocal(){
  const rm=S.removed||[]; if(!rm.length) return false;
  const arr=getCouriers(); if(!Array.isArray(arr)) return false;
  let changed=false;
  for(let i=arr.length-1;i>=0;i--){
    if(rm.includes(Number(arr[i].id))){ arr.splice(i,1); changed=true; }
  }
  if(changed){
    try{ localStorage.setItem('dhl_couriers',JSON.stringify(arr)); }catch(e){}
    try{ if(window.saveCouriers) saveCouriers(); }catch(e){}
    try{ if(window.renderManage) renderManage(); }catch(e){}
    try{ if(window.renderCheckin) renderCheckin(); }catch(e){}
  }
  return changed;
}

function mergeCouriers(list){
  if(!Array.isArray(list)||!list.length) return false;
  const arr=getCouriers();
  if(!Array.isArray(arr)) return false;
  const rm=S.removed||[];
  list=list.filter(c=>c && !rm.includes(Number(c.id)));   // 🚫 ไม่ดึงคนที่ถูกลบกลับมา
  if(!list.length) return false;
  const have={}; arr.forEach(c=>have[c.id]=c);
  let changed=false;
  list.forEach(c=>{
    if(!have[c.id]){ arr.push({ id:c.id, code:c.code, name:c.name,
      vendor:c.vendor||'', type:c.type||'2W', active:true }); changed=true; }
    else{
      const o=have[c.id];
      if(!o.code&&c.code){ o.code=c.code; changed=true; }
      if(!o.name&&c.name){ o.name=c.name; changed=true; }
      if(!o.vendor&&c.vendor){ o.vendor=c.vendor; changed=true; }
      if(!o.type&&c.type){ o.type=c.type; changed=true; }
    }
  });
  if(changed){
    try{ localStorage.setItem('dhl_couriers',JSON.stringify(arr)); }catch(e){}
    try{ if(window.saveCouriers) saveCouriers(); }catch(e){}
    try{ if(window.renderManage) renderManage(); }catch(e){}
  }
  return changed;
}

async function mergeRemote(d){
  if(S.merging) return;
  S.merging=true;                       // ⛔ กันลูป: ระหว่าง merge จะไม่ push กลับ
  try{
    const date=d.date||tKey();
    let changed=false;
    /* --- รายชื่อ Courier (ต้องมาก่อน เพื่อให้เช็คอินมีที่แสดง) --- */
    if(mergeCouriers(d.couriers)) changed=true;
    const putCk = S._rawPutCheckin || window.putCheckin;   // ใช้ตัวดิบ ไม่ trigger push
    const putPp = S._rawPutPPH || window.putPPH;
    /* --- เช็คอิน --- */
    const local = window.getByDate? await getByDate(date) : [];
    const lmap={}; local.forEach(r=>lmap[r.courierId]=r);
    /* --- เช็คอินที่ถูกลบไปแล้ว → ลบออกจากเครื่องนี้ด้วย (เฉพาะระเบียนที่เก่ากว่าเวลาที่ลบ) --- */
    const ckDel=d.ckDel||{};
    if(date===tKey()){
      S.ckDel=ckDel;
      const cloudAbs=d.absent||{}, locAbs=S.absent||{}, merged=Object.assign({},cloudAbs);
      Object.keys(locAbs).forEach(k=>{ if(!cloudAbs[k] && (Date.now()-(locAbs[k].at||0))<45000) merged[k]=locAbs[k]; });
      S.absent=merged;
      try{ localStorage.setItem('dsAbs_'+date, JSON.stringify(S.absent)); }catch(e){}
    }
    if(Object.keys(ckDel).length && S._rawDel){
      for(const r of local){
        if(isDeleted(ckDel, r.courierId, r.ts)){
          try{ await S._rawDel(r.id); changed=true; }catch(e){}
          delete lmap[r.courierId];
        }
      }
    }
    for(const [cid,rc] of Object.entries(d.checkins||{})){
      if(isDeleted(ckDel, cid, rc.ts)) continue;
      const id=+cid, cur=lmap[id];
      if(!cur){
        await putCk({ courierId:id, date, ts:rc.ts, status:rc.status, buffer:!!rc.buffer,
          photo:null, uniform:rc.uniform!==false, manualEdit:!!rc.manualEdit, staff:rc.staff||'' });
        if(rc.hasPhoto) queuePhotoPull(id,date);      // 📷 ดึงรูปจากคลาวด์มาแสดงด้วย
        changed=true;
      } else if(cur.ts===rc.ts && rc.hasPhoto && !cur.photo){
        queuePhotoPull(id,date);                      // มีรูปบนคลาวด์ แต่เครื่องนี้ยังไม่มี
      }
      if(cur && (cur.ts!==rc.ts || cur.status!==rc.status || (!!cur.manualEdit)!==(!!rc.manualEdit))){
        cur.ts=rc.ts; cur.status=rc.status; cur.buffer=!!rc.buffer;
        cur.manualEdit=!!rc.manualEdit; cur.uniform=rc.uniform!==false;
        await putCk(cur); changed=true;
      }
    }
    /* --- PPH / Route prep / PD --- */
    if(d.pph && window.getPPH){
      const cur = await getPPH(date) || { date };
      const r=d.pph;
      const same = JSON.stringify([cur.staffN,cur.sorterN,cur.courierN,cur.pNew,cur.pOld,cur.inboundTs,cur.lastInboundTs,cur.rp])
                === JSON.stringify([r.staffN,r.sorterN,r.courierN,r.pNew,r.pOld,r.inboundTs,r.lastInboundTs,r.rp]);
      if(!same){
        cur.staffN=r.staffN; cur.sorterN=r.sorterN; cur.courierN=r.courierN;
        cur.pNew=r.pNew; cur.pOld=r.pOld; cur.inboundTs=r.inboundTs;
        cur.lastInboundTs=r.lastInboundTs; cur.rp=r.rp||{};
        if(r.pd){ cur.pd = cur.pd||{}; cur.pd.ts=r.pd.ts; cur.pd.manualEdit=!!r.pd.manualEdit; }
        await putPp(cur); changed=true;
      }
      /* 📷 รูป PD จากเครื่องอื่น */
      if(r.pd && r.pd.hasPhoto && !(cur.pd&&cur.pd.photo)) queuePdPull(date);
    }
    if(changed) repaintSoon();
  }catch(e){ console.warn('merge',e); }
  finally{ S.merging=false; }
}

/* วาดหน้าใหม่แบบหน่วง — กันกระตุกเวลาข้อมูลไหลเข้าถี่ๆ */
/* ============ 🛡 ระบบเฝ้าระวังตัวเอง (กันปัญหาเงียบๆ) ============ */
const SYNC_VER='2026.08.05-j';
const H={ ver:SYNC_VER, lastPush:0, lastPull:0, err:'', errAt:0, taps:0, saves:0, ok:true };
window.DHLHealth=H;

/* จับ error ทุกชนิดที่หลุดมา แล้วโชว์ให้ Staff เห็นทันที ไม่ให้เงียบ */
function flagErr(msg){
  H.err=String(msg||'').slice(0,160); H.errAt=Date.now(); H.ok=false;
  showErrBar();
}
function showErrBar(){
  let b=document.getElementById('dsErrBar');
  if(!b){
    b=document.createElement('div'); b.id='dsErrBar';
    b.style.cssText='position:fixed;left:8px;right:8px;bottom:86px;z-index:98;background:#D40511;color:#fff;'
      +'border-radius:14px;padding:11px 14px;font-size:13px;font-weight:700;line-height:1.5;'
      +'box-shadow:0 6px 20px rgba(212,5,17,.4);cursor:pointer;';
    b.onclick=()=>{ b.remove(); };
    document.body.appendChild(b);
  }
  b.innerHTML='⚠️ ระบบมีปัญหา — ข้อมูลอาจไม่ขึ้นคลาวด์<br>'
    +'<span style="font-weight:500;font-size:11.5px;opacity:.9;">ลองปิดแอปแล้วเปิดใหม่ • ถ้ายังไม่หายแจ้งผู้จัดการ • แตะเพื่อปิด</span>';
}
window.addEventListener('error', e=>flagErr(e.message));
window.addEventListener('unhandledrejection', e=>flagErr(e.reason&&e.reason.message||e.reason));

/* ✋ ตอบสนองทันทีที่แตะปุ่มในหน้าเช็คอิน — ให้ Staff เห็นว่ากดติดแล้ว
   และกันกดซ้ำระหว่างที่ระบบกำลังบันทึก */
document.addEventListener('pointerdown', e=>{
  const b=e.target.closest && e.target.closest('#ciList button, #fdelBody button, #pphBody button');
  if(!b || b.dataset.dsBusy) return;
  H.taps++;
  b.dataset.dsBusy='1';
  const old=b.innerHTML;
  b.style.opacity='.55';
  setTimeout(()=>{ b.style.opacity=''; delete b.dataset.dsBusy; }, 900);
}, {capture:true, passive:true});

/* 🖐 จับเวลาที่ผู้ใช้แตะจอล่าสุด — ห้ามวาดจอใหม่ระหว่างที่กำลังกด
   (สาเหตุอาการ "กดไม่ติด": ระหว่างนิ้วแตะ ระบบวาดรายชื่อใหม่ ปุ่มเดิมถูกลบทิ้ง คลิกเลยหลุด) */
let lastTouch=0, touching=false;
['pointerdown','touchstart','mousedown'].forEach(ev=>
  document.addEventListener(ev,()=>{ touching=true; lastTouch=Date.now(); },{capture:true,passive:true}));
['pointerup','touchend','touchcancel','mouseup','click'].forEach(ev=>
  document.addEventListener(ev,()=>{ touching=false; lastTouch=Date.now(); },{capture:true,passive:true}));
const QUIET_MS=2500;      // เงียบ 2.5 วิหลังแตะจอครั้งล่าสุด ค่อยวาดใหม่

let paintT=null, paintQueued=false;
function repaintSoon(){
  paintQueued=true;
  if(paintT) return;
  paintT=setTimeout(()=>{
    paintT=null;
    if(!paintQueued) return;
    paintQueued=false;
    /* 🖐 กำลังแตะจออยู่ หรือเพิ่งแตะไม่ถึง 2.5 วิ → เลื่อนออกไปก่อน */
    if(touching || (Date.now()-lastTouch) < QUIET_MS){ repaintSoon(); return; }
    /* ไม่วาดถ้าผู้ใช้กำลังพิมพ์/เปิดกล้อง/เปิด popup อยู่ — กันจอกระพริบขณะทำงาน */
    const ae=document.activeElement;
    if(ae && (ae.tagName==='INPUT'||ae.tagName==='SELECT'||ae.tagName==='TEXTAREA')) { repaintSoon(); return; }
    if(document.querySelector('.overlay.show, .modal.show, #dsNotice.show')) { repaintSoon(); return; }
    toast('☁ ซิงค์ข้อมูลจากเครื่องอื่นแล้ว');
    const v=document.querySelector('.view.active'); const id=v? v.id:'';
    try{
      if(id==='view-checkin'&&window.renderCheckin) renderCheckin();
      else if(id==='view-pd'&&window.renderPDCard) renderPDCard();
      else if(id==='view-pph'&&window.renderPPH) renderPPH();
      else if(id==='view-fdel'&&window.renderFDel) renderFDel();
      else if(id==='view-dash'&&window.renderDash) renderDash();
    }catch(e){}
  },1200);
}

/* ============ COMMENTS ============ */
function listenComments(){
  if(S.unsubCom) S.unsubCom();
  const cut=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  S.unsubCom=onSnapshot(query(comCol(S.depot), where('date','>=',cut)), snap=>{
    S.comments=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.at||0)-(a.at||0));
    const unread=S.comments.filter(c=>!c.ackAt).length;
    const bell=document.getElementById('dsBell');
    if(unread){
      bell.textContent='💬 คอมเมนต์ใหม่ '+unread;
      if(!bell.classList.contains('on')){ bell.classList.add('on'); beep(); }
    } else bell.classList.remove('on');
    if(document.getElementById('dsCom').classList.contains('show')) renderComments();
  }, e=>console.warn('listen com',e));
}
function beep(){
  try{
    const C=new (window.AudioContext||window.webkitAudioContext)();
    [0,0.18].forEach((t,i)=>{
      const o=C.createOscillator(), g=C.createGain();
      o.connect(g); g.connect(C.destination);
      o.frequency.value=i?1046:784; o.type='sine';
      g.gain.setValueAtTime(0.001,C.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.35,C.currentTime+t+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,C.currentTime+t+0.16);
      o.start(C.currentTime+t); o.stop(C.currentTime+t+0.18);
    });
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([80,60,80]);
}
const TASK_TH={checkin:'1️⃣ เช็คอิน',pd:'2️⃣ PD',sort:'3️⃣ Sort time',route:'3️⃣ Route prep',fdel:'4️⃣ First Del',all:'📋 ภาพรวม'};
function renderComments(){
  const el=document.getElementById('dsComList');
  if(!S.comments.length){ el.innerHTML='<div style="color:#a09884;font-size:13px;padding:14px 0;">ยังไม่มีคอมเมนต์</div>'; return; }
  el.innerHTML=S.comments.map(c=>{
    const t=new Date(c.at||Date.now());
    const hh=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
    return '<div class="cm'+(c.ackAt?' done':'')+'">'
      +'<div class="t">'+(TASK_TH[c.task]||c.task||'')+' • '+(c.date||'')+' • '+hh+'</div>'
      +'<div class="x">'+String(c.text||'').replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))+'</div>'
      +(c.ackAt? '<div class="ok">✔ รับทราบแล้วโดย '+(c.ackBy||'')+'</div>'
               : '<button onclick="window.__dsAck(\''+c.id+'\')">✔ รับทราบ</button>')
      +'</div>';
  }).join('');
}
function openComments(){ document.getElementById('dsCom').classList.add('show'); renderComments(); }
window.__dsAck=async id=>{
  try{ await updateDoc(doc(comCol(S.depot),id),{ ackAt:Date.now(), ackBy:S.staff }); toast('✔ ส่งการรับทราบแล้ว'); }
  catch(e){ toast('ส่งไม่สำเร็จ'); }
};
window.dsOpenComments=openComments;

/* ============ LOGOUT ============ */
window.dsLogout=async ()=>{
  if(!confirm('ออกจากระบบ?\n\nข้อมูลที่บันทึกไว้ยังอยู่ครบทั้งในเครื่องและบนคลาวด์\nครั้งหน้าต้องใส่ PIN และเลือกชื่อใหม่')) return;
  try{ if(S.depot&&S.staff) await deleteDoc(doc(sesCol(S.depot),S.staff)); }catch(e){}
  try{ if(S.unsubDay)S.unsubDay(); if(S.unsubCom)S.unsubCom(); if(S._hb)clearInterval(S._hb); }catch(e){}
  S.ready=false; S.depot=null; S.staff=null; S.pin=null; S.comments=[];
  try{ localStorage.removeItem('dsStaff'); localStorage.removeItem('dsPin'); }catch(e){}
  const bell=document.getElementById('dsBell'); if(bell) bell.classList.remove('on');
  location.reload();
};
/* ============ 🗑 ลบพนักงานออกถาวร (ลาออก / เพิ่มผิด) ============
   ลบทั้งในเครื่องและบนคลาวด์ พร้อมจดไว้ใน removedIds
   กันไม่ให้เครื่องอื่นในสาขาเดียวกันดันชื่อกลับขึ้นมาอีก
   ประวัติเก่า (เช็คอินย้อนหลัง) ยังอยู่ครบ ไม่ถูกลบ */
window.dsDelCourier=async (id)=>{
  id=Number(id);
  const arr=getCouriers();
  const c=arr.find(x=>Number(x.id)===id);
  if(!c) return;
  if(!S.ready){ alert('ต้องเข้าสู่ระบบก่อนจึงจะลบได้'); return; }
  if(!confirm('ลบพนักงานคนนี้ออกถาวร?\n\n'
    +(c.code||'')+' — '+(c.name||'')+'\n\n'
    +'• จะหายจากรายชื่อและหน้าเช็คอินของทุกเครื่องในสาขา '+S.depot+'\n'
    +'• ประวัติการเข้างานย้อนหลังยังอยู่ครบ ไม่ถูกลบ\n'
    +'• ถ้าแค่หยุดงานชั่วคราว ให้กดปุ่ม "พัก" แทน')) return;

  /* 1) ลบในเครื่อง */
  const i=arr.findIndex(x=>Number(x.id)===id);
  if(i>=0) arr.splice(i,1);
  try{ localStorage.setItem('dhl_couriers',JSON.stringify(arr)); }catch(e){}
  try{ if(window.saveCouriers) saveCouriers(); }catch(e){}
  if(!S.removed.includes(id)) S.removed.push(id);

  /* 2) ลบบนคลาวด์ + จด tombstone */
  try{
    const cl=arr.filter(x=>x.active!==false && !S.removed.includes(Number(x.id)))
      .map(x=>({ id:x.id, code:x.code, name:x.name, vendor:x.vendor||'', type:x.type||'' }));
    await setDoc(depRef(S.depot),{ couriers:cl, couriersAt:Date.now(), removedIds:arrayUnion(id) },{merge:true});
    toast('🗑 ลบ '+(c.code||c.name)+' แล้ว');
  }catch(e){ console.warn('del courier',e); alert('ลบในเครื่องแล้ว แต่ส่งขึ้นคลาวด์ไม่สำเร็จ — ลองใหม่เมื่อเน็ตกลับมา'); }

  try{ if(window.renderManage) renderManage(); }catch(e){}
  try{ if(window.renderCheckin) renderCheckin(); }catch(e){}
};

/* ใส่ปุ่ม 🗑 ต่อท้ายทุกแถวในรายชื่อพนักงาน */
function mountDelButtons(){
  const list=document.getElementById('mList'); if(!list) return;
  list.querySelectorAll('.row-c').forEach(row=>{
    if(row.querySelector('.dsDel')) return;
    const ed=[...row.querySelectorAll('button')]
      .find(b=>/editCourier\(/.test(b.getAttribute('onclick')||''));
    if(!ed) return;
    const m=(ed.getAttribute('onclick')||'').match(/editCourier\((\d+)\)/);
    if(!m) return;
    const b=document.createElement('button');
    b.className='btn btn-o dsDel';
    b.style.cssText='min-height:36px;padding:6px 9px;font-size:12px;color:var(--r);border-color:var(--r);';
    b.textContent='🗑';
    b.title='ลบออกถาวร';
    b.onclick=()=>window.dsDelCourier(m[1]);
    row.appendChild(b);
  });
}
setInterval(mountDelButtons,1200);

/* 🧹 ล้างข้อมูลในเครื่องแล้วดึงใหม่จากคลาวด์ (ใช้เมื่อมีข้อมูลสาขาอื่นปน) */
window.dsResync=async ()=>{
  if(!S.ready){ alert('ต้องเข้าสู่ระบบก่อน'); return; }
  if(!confirm('ล้างข้อมูลในเครื่องนี้ แล้วดึงใหม่จากคลาวด์?\n\n'
    +'• รายชื่อ Courier และข้อมูลทั้งหมดในเครื่องจะถูกลบ\n'
    +'• จากนั้นระบบจะดึงข้อมูลของสาขา '+S.depot+' ลงมาใหม่ทั้งหมด\n'
    +'• ข้อมูลที่ซิงค์ขึ้นคลาวด์แล้วจะกลับมาครบ\n\n'
    +'ใช้เมื่อเห็นข้อมูลของสาขาอื่นปนอยู่เท่านั้น')) return;
  const b=document.getElementById('dsBadge');
  if(b){ b.style.background='#D40511'; b.style.color='#fff'; b.textContent='🧹 กำลังล้างข้อมูล...'; }
  try{ if(S.unsubDay)S.unsubDay(); if(S.unsubCom)S.unsubCom(); }catch(e){}
  S.ready=false;
  await wipeLocalData();
  lsSet('dsDataDepot',S.depot);
  setTimeout(()=>location.reload(),700);
};

/* ปุ่มออกจากระบบในหน้า "จัดการ" + แตะแถบสถานะ */
function mountLogout(){
  const badge=document.getElementById('dsBadge');
  if(badge && S.ready) badge.onclick=()=>window.dsLogout();
  const mv=document.getElementById('view-manage');
  if(mv && !document.getElementById('dsLogoutCard')){
    const div=document.createElement('div');
    div.id='dsLogoutCard'; div.className='card';
    div.innerHTML='<h2>☁ บัญชีผู้ใช้</h2>'
      +'<div class="small" id="dsWho" style="margin-bottom:9px;"></div>'
      +'<button class="btn btn-o btn-block" style="color:var(--r);border-color:var(--r);" onclick="dsLogout()">🚪 ออกจากระบบ</button>'
      +'<div class="small" style="margin-top:7px;">ใช้เมื่อเปลี่ยนคนใช้เครื่องนี้ หรือย้ายไปเครื่องอื่น</div>'
      +'<div style="height:12px"></div>'
      +'<button class="btn btn-o btn-block" onclick="dsResync()">🧹 ล้างข้อมูลเครื่องนี้ แล้วดึงใหม่จากคลาวด์</button>'
      +'<div class="small" style="margin-top:7px;">ใช้เมื่อเห็นรายชื่อหรือข้อมูลของสาขาอื่นปนอยู่ — ข้อมูลที่ซิงค์แล้วจะกลับมาครบ</div>';
    mv.appendChild(div);
  }
  const who=document.getElementById('dsWho');
  if(who) who.innerHTML = S.ready
    ? 'เข้าใช้งานอยู่: <b>'+S.staff+'</b> • สาขา <b>'+S.depot+'</b> • ☁ ซิงค์อัตโนมัติ'
    : '<span style="color:var(--r);font-weight:700;">⚠ ยังไม่ได้เข้าระบบ — ข้อมูลจะไม่ขึ้นคลาวด์</span>';
}
setInterval(mountLogout,2000);

/* ============ 📣 ประกาศจากผู้จัดการ (บังคับกดรับทราบ) ============ */
const NOTICE_CSS=`
#dsNotice{position:fixed;inset:0;z-index:99999;background:rgba(16,14,10,.82);
  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
  display:none;align-items:center;justify-content:center;padding:16px;}
#dsNotice.show{display:flex;}
#dsNotice .box{background:#fff;border-radius:24px;width:100%;max-width:460px;max-height:92vh;overflow-y:auto;
  box-shadow:0 20px 60px rgba(0,0,0,.45);animation:nPop .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes nPop{from{opacity:0;transform:translateY(26px) scale(.95);}to{opacity:1;transform:none;}}
/* รีเซ็ตกันสไตล์ของแอปเดิมมากวน */
#dsNotice .box *{box-sizing:border-box;margin:0;padding:0;float:none;position:static;
  display:block;width:auto;max-width:none;text-align:left;}
#dsNotice .hd{padding:20px 22px 18px;border-radius:24px 24px 0 0;color:#fff;}
#dsNotice .hd.info{background:linear-gradient(135deg,#1565c0,#1e88e5);}
#dsNotice .hd.warn{background:linear-gradient(135deg,#b07d00,#e0a500);}
#dsNotice .hd.crit{background:linear-gradient(135deg,#8e0b13,#D40511);}
#dsNotice .hd .lv{font-size:11px;font-weight:900;letter-spacing:1.4px;opacity:.92;
  text-transform:uppercase;line-height:1.4;}
#dsNotice .hd h3{font-size:21px;font-weight:900;margin-top:7px;line-height:1.4;
  letter-spacing:-.2px;word-break:break-word;}
#dsNotice .hd .mt{font-size:12px;opacity:.85;margin-top:10px;font-weight:600;line-height:1.5;
  padding-top:9px;border-top:1px solid rgba(255,255,255,.25);}
#dsNotice .bd{padding:20px 22px 22px;}
#dsNotice .box table{width:100%!important;display:table!important;border-collapse:separate!important;
  border-spacing:0 7px!important;}
#dsNotice .box tbody{display:table-row-group!important;}
#dsNotice .box tr{display:table-row!important;}
#dsNotice .box td{display:table-cell!important;background:#fbf9f4;padding:14px 15px;
  vertical-align:middle!important;font-size:15px;line-height:1.4;width:auto!important;}
#dsNotice .box td:first-child{border-radius:14px 0 0 14px;font-weight:700;color:#3a352c;
  text-align:left!important;}
#dsNotice .box td:last-child{border-radius:0 14px 14px 0;text-align:right!important;font-weight:900;
  white-space:nowrap;font-size:19px;color:#1a1a1a;width:1%!important;}
#dsNotice .box td .tg{display:block!important;font-size:11px;color:#a09884;font-weight:700;
  margin-top:3px;text-align:right!important;letter-spacing:.2px;}
#dsNotice .msg{background:#fff8e1;border-left:6px solid #FFCC00;border-radius:16px;
  padding:18px 20px;margin-top:16px;font-size:18px;line-height:1.85;white-space:pre-wrap;
  font-weight:600;color:#2a2620;word-break:break-word;}
#dsNotice .ackbtn{width:100%;margin-top:20px;border:none;border-radius:18px;padding:19px 16px;
  font-size:18px;font-weight:900;font-family:inherit;background:#1a1a1a;color:#FFCC00;cursor:pointer;
  text-align:center;letter-spacing:.3px;
  transition:transform .15s;-webkit-tap-highlight-color:transparent;}
#dsNotice .ackbtn:active{transform:scale(.97);}
#dsNotice .ackbtn:disabled{opacity:.55;}
#dsNotice .cnt{text-align:center;font-size:12px;color:#a09884;margin-top:11px;font-weight:700;}
@media(max-width:420px){
  #dsNotice{padding:10px;}
  #dsNotice .hd{padding:17px 17px 15px;} #dsNotice .hd h3{font-size:19px;}
  #dsNotice .bd{padding:16px 17px 18px;}
  #dsNotice .msg{font-size:16.5px;padding:15px 16px;line-height:1.8;}
  #dsNotice .box td{font-size:14px;padding:12px 13px;} #dsNotice .box td:last-child{font-size:17px;}
  #dsNotice .ackbtn{font-size:17px;padding:17px 14px;}
}
`;
(function(){ const st=document.createElement('style'); st.textContent=NOTICE_CSS; document.head.appendChild(st);
  const d=document.createElement('div'); d.id='dsNotice'; d.innerHTML='<div class="box"></div>';
  document.body.appendChild(d); })();

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LV={info:{t:'ประกาศทั่วไป',i:'🔵'},warn:{t:'สำคัญ — โปรดอ่าน',i:'🟡'},crit:{t:'ด่วน — ต้องดำเนินการ',i:'🔴'}};
function showNotice(n, idx, total){
  const box=document.querySelector('#dsNotice .box');
  const lv=LV[n.level]||LV.warn;
  const t=new Date(n.at||Date.now());
  let h='<div class="hd '+(n.level||'warn')+'">'
    +'<div class="lv">'+lv.i+' '+lv.t+'</div>'
    +'<h3>'+esc(n.title||'ประกาศจากผู้จัดการ')+'</h3>'
    +'<div class="mt">จากผู้จัดการ • '+t.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})+'</div></div>'
    +'<div class="bd">';
  if(Array.isArray(n.rows)&&n.rows.length){
    h+='<table>'+n.rows.map(r=>'<tr><td>'+esc(r.k)+'</td><td>'+esc(r.v)
      +(r.t? '<span class="tg">เป้า '+esc(r.t)+'</span>':'')+'</td></tr>').join('')+'</table>';
  }
  if(n.msg) h+='<div class="msg">'+esc(n.msg)+'</div>';
  h+='<button class="ackbtn" id="dsAckBtn">✔ รับทราบแล้ว</button>';
  if(total>1) h+='<div class="cnt">ประกาศที่ '+(idx+1)+' จาก '+total+'</div>';
  h+='</div>';
  box.innerHTML=h;
  document.getElementById('dsAckBtn').onclick=async function(){
    this.disabled=true; this.textContent='กำลังบันทึก...';
    try{
      await updateDoc(doc(dbF,'depots',S.depot,'notices',n.__id),{ ['acks.'+S.staff]: Date.now() });
      document.getElementById('dsNotice').classList.remove('show');
      toast('✔ รับทราบประกาศแล้ว');
      setTimeout(checkNotices,600);
    }catch(e){ this.disabled=false; this.textContent='✔ รับทราบแล้ว'; alert('บันทึกไม่สำเร็จ: '+e.message); }
  };
  document.getElementById('dsNotice').classList.add('show');
}
async function checkNotices(){
  if(!S.ready||!S.depot||!S.staff) return;
  if(document.getElementById('dsNotice').classList.contains('show')) return;
  try{
    const snap=await getDocs(collection(dbF,'depots',S.depot,'notices'));
    const cut=Date.now()-7*86400000;
    const pending=snap.docs.map(d=>({...d.data(), __id:d.id}))
      .filter(n=>(n.at||0)>cut && !(n.acks&&n.acks[S.staff]))
      .sort((a,b)=>(a.at||0)-(b.at||0));
    if(pending.length) showNotice(pending[0], 0, pending.length);
  }catch(e){ console.warn('notices',e); }
}
function listenNotices(){
  if(S.unsubNoti) try{ S.unsubNoti(); }catch(e){}
  S.unsubNoti = onSnapshot(collection(dbF,'depots',S.depot,'notices'), ()=>{ checkNotices(); },
    e=>console.warn('noti listen',e));
}

/* ============ 🎛 ปรับ UX/UI + ตัดเมนูที่ไม่ใช้แล้ว ============ */
const TIDY_CSS=`
/* --- แถบเมนูล่าง: กดง่ายขึ้น --- */
.nav{left:6px;right:6px;padding:4px;border-radius:24px;
  bottom:max(10px,env(safe-area-inset-bottom,10px));}
.nav button{padding:6px 1px 5px;min-height:56px;font-size:9.5px;line-height:1.15;font-weight:700;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  letter-spacing:-.2px;white-space:nowrap;overflow:hidden;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  transition:transform .13s cubic-bezier(.34,1.56,.64,1),background .15s,color .15s;}
.nav button .ic{font-size:20px;line-height:1;display:block;}
.nav button:active{transform:scale(.86);}
.nav button.on{box-shadow:0 3px 11px rgba(255,204,0,.55);}
.nav button.on .ic{transform:scale(1.1);}
/* --- ปุ่มทั่วไป: มีฟีดแบ็กตอนกด --- */
.btn{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
.btn:active{transform:scale(.96);}
/* --- ช่องกรอก: กันมือถือซูมอัตโนมัติตอนแตะ (ต้อง ≥16px) --- */
input[type=text],input[type=search],input[type=tel],input[type=number],select,textarea{
  font-size:16px;min-height:46px;}
/* --- กล่องข้อมูลผู้ใช้ (อ่านอย่างเดียว) --- */
#dsSetInfo{background:#fbf9f4;border-radius:13px;padding:11px 13px;margin:4px 0 10px;line-height:1.65;}
#dsSetInfo b{color:#1a1a1a;}
`;
(function(){ const st=document.createElement('style'); st.id='dsTidyCSS';
  st.textContent=TIDY_CSS; document.head.appendChild(st); })();

/* ซ่อนเมนูที่ซ้ำซ้อน/เสี่ยง ในหน้า "จัดการ"
   - ตั้งค่าสาขา + ชื่อ Staff  → ควบคุมโดยระบบ Login แล้ว (กดเปลี่ยนเองทำให้ข้อมูลลงผิดสาขา)
   - ⬇ สำรองข้อมูล (JSON)      → ซิงค์ขึ้นคลาวด์อัตโนมัติแล้ว */
function tidyManage(){
  const sd=document.getElementById('sDepot');
  if(!sd || sd.dataset.dsTidy) return;
  const card=sd.closest('.card'); if(!card) return;
  sd.dataset.dsTidy='1';
  const hide=el=>{ if(el) el.style.display='none'; };

  ['sDepot','sStaff'].forEach(id=>{
    const e=document.getElementById(id); if(!e) return;
    hide(e);
    const p=e.previousElementSibling;
    if(p && p.tagName==='LABEL') hide(p);
  });
  [...card.querySelectorAll('button')].forEach(b=>{
    if(/saveSettings|backupJSON/.test(b.getAttribute('onclick')||'')) hide(b);
  });
  /* ซ่อน spacer เปล่าที่เหลือค้าง */
  [...card.children].forEach(c=>{
    if(c.tagName==='DIV' && !c.id && !c.textContent.trim()
       && /height/.test(c.getAttribute('style')||'')) hide(c);
  });
  /* อัปเดตข้อความเดิมที่ล้าสมัย (ตอนนี้ซิงค์ขึ้นคลาวด์แล้ว) */
  [...card.querySelectorAll('.small')].forEach(el=>{
    if(/เก็บในเครื่องนี้เท่านั้น/.test(el.textContent))
      el.innerHTML='☁ ข้อมูลซิงค์ขึ้นคลาวด์อัตโนมัติ — ผู้จัดการเห็นแบบเรียลไทม์<br>'
        +'ห้ามล้างข้อมูลเบราว์เซอร์ • ภาพถ่ายเก็บย้อนหลัง 30 วัน';
  });
  /* แทนที่ด้วยบรรทัดอ่านอย่างเดียว */
  const info=document.createElement('div');
  info.id='dsSetInfo'; info.className='small';
  const h2=card.querySelector('h2');
  if(h2) h2.parentNode.insertBefore(info,h2.nextSibling); else card.insertBefore(info,card.firstChild);
}
function paintSetInfo(){
  const info=document.getElementById('dsSetInfo'); if(!info) return;
  info.innerHTML = S.ready
    ? '🏢 สาขา <b>'+S.depot+'</b><br>👤 ผู้บันทึก <b>'+S.staff+'</b>'
      +'<br><span style="color:#8a8272;">สาขาและชื่อกำหนดจากตอนเข้าสู่ระบบ — เปลี่ยนได้โดยกด 🚪 ออกจากระบบ ด้านล่าง</span>'
    : '<span style="color:var(--r);font-weight:700;">⚠ ยังไม่ได้เข้าระบบ</span>'
      +'<br><span style="color:#8a8272;">แตะแถบสีแดงมุมขวาล่างเพื่อเข้าสู่ระบบ</span>';
}
setInterval(()=>{ try{ tidyManage(); paintSetInfo(); }catch(e){} },2000);
try{ tidyManage(); paintSetInfo(); }catch(e){}

/* ============ WRAP ฟังก์ชันเดิม ============ */
function wrap(){
  if(window.putCheckin && !window.putCheckin.__ds){
    const o=window.putCheckin; S._rawPutCheckin=o;
    const f=async function(rec){ const r=await o(rec);
      if(!S.merging){
        pushSoon(); if(rec&&rec.photo) pushPhoto('ci',rec.courierId,rec.photo);
      }
      return r; };
    f.__ds=true; window.putCheckin=f;
  }
  if(window.putPPH && !window.putPPH.__ds){
    const o=window.putPPH; S._rawPutPPH=o;
    const f=async function(rec){ const r=await o(rec);
      if(!S.merging){ pushSoon(); if(rec&&rec.pd&&rec.pd.photo) pushPhoto('pd',null,rec.pd.photo); }
      return r; };
    f.__ds=true; window.putPPH=f;
  }
  if(window.delCheckin && !window.delCheckin.__ds){
    const o=window.delCheckin; S._rawDel=o;
    const f=async function(id){
      /* จำรายชื่อก่อนลบ เพื่อรู้ว่าใครถูกลบ แล้วลบออกจากคลาวด์ด้วย */
      let before=[]; try{ before=await getByDate(tKey()); }catch(e){}
      const r=await o(id);
      if(!S.merging){
        try{
          const after=await getByDate(tKey());
          const gone=before.filter(b=>!after.some(a=>String(a.courierId)===String(b.courierId)));
          for(const g of gone) await removeCloudCheckin(g.courierId, g.ts);
        }catch(e){ console.warn('del cloud',e); }
        pushSoon();
      }
      return r;
    };
    f.__ds=true; window.delCheckin=f;
  }
}

/* ============ BOOT ============ */
async function boot(){
  await injectUI(); wrap();
  const iv=setInterval(wrap,1500);         // เผื่อฟังก์ชันถูกนิยามทีหลัง
  setTimeout(()=>clearInterval(iv),20000);
  signInAnonymously(auth).catch(e=>console.warn('anon auth',e));
  onAuthStateChanged(auth, async u=>{
    if(!u) return; S.uid=u.uid;
    const dep=lsGet('dsDepot'), stf=lsGet('dsStaff'), pin=lsGet('dsPin');
    if(dep&&stf&&pin){
      /* เข้าอัตโนมัติ แต่ยังต้องผ่านการตรวจชื่อ/PIN/ซ้ำซ้อน */
      document.getElementById('dsDep').value=dep;
      await loadStaffList();
      document.getElementById('dsPin').value=pin;
      const sel=document.getElementById('dsStaff');
      if([...sel.options].some(o=>o.value===stf)){ sel.value=stf; await doLogin(); }
      else document.getElementById('dsLogin').classList.add('show');
    }
    else document.getElementById('dsLogin').classList.add('show');
  });
  /* เตือนถ้ายังไม่ได้ล็อกอิน = ข้อมูลจะไม่ขึ้นคลาวด์ */
  setInterval(()=>{
    const b=document.getElementById('dsBadge'); if(!b) return;
    if(S.ready){ b.style.background='#1a1a1a'; b.style.color='#FFCC00'; return; }
    b.classList.add('on'); b.style.background='#D40511'; b.style.color='#fff';
    b.textContent='⚠ ยังไม่ได้เข้าระบบ — แตะเพื่อล็อกอิน';
    b.onclick=()=>document.getElementById('dsLogin').classList.add('show');
  },5000);

  /* กลับมาที่แอป (สลับแอป/ปลดล็อกจอ) → ดึงข้อมูลล่าสุดทันที */
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && S.ready) pullOnce();
  });
  window.addEventListener('online',()=>{ if(S.ready){ pullOnce(); pushAll(); } });

  /* 🛟 ส่งข้อมูลขึ้นคลาวด์ซ้ำทุก 3 นาที — ประกันว่าข้อมูลไม่มีวันหายจากคลาวด์ */
  setInterval(()=>{ if(S.ready&&!S.merging) pushAll(); },180000);

  /* ข้ามวัน → ย้าย listener */
  let cur=tKey();
  setInterval(()=>{ const k=tKey(); if(k!==cur){ cur=k; if(S.ready){ listenDay(); pushAll(); } } },60000);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();


/* ============ 📋 จัดกลุ่มหน้าเช็คอิน (ยังไม่เช็คอิน / เช็คอินแล้ว) ============
   ย้ายแถวที่แอปสร้างไว้แล้ว ไม่สร้างใหม่ — ปุ่มและ event เดิมทำงานครบทุกอย่าง
   ถ้าเกิดข้อผิดพลาดใดๆ จะคืนรายชื่อเป็นแบบเดิมอัตโนมัติ */
const GRP_CSS = "#dsGrpBar{display:flex;gap:6px;align-items:center;margin:2px 0 8px;}"
+"#dsPhoto{border:1px solid #e0d9c8;background:#fbf9f4;color:#6b6558;border-radius:9px;padding:7px 11px;"
+"font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;}"
+"#dsPhoto.on{background:#1a1a1a;color:#FFCC00;border-color:#1a1a1a;}"
+".dsHdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 13px;"
+"border-radius:12px;margin:12px 0 7px;font-size:13.5px;font-weight:800;}"
+".dsHdr.todo{background:#fdeaea;color:#a3151f;}"
+".dsHdr.done{background:#f2ede2;color:#5f5a4e;cursor:pointer;}"
+".dsHdr .c{font-size:12px;font-weight:700;opacity:.85;}"
+".dsHdr .cv{font-size:16px;line-height:1;transition:transform .2s;}"
+".dsHdr.open .cv{transform:rotate(180deg);}"
+"#dsDone{overflow:hidden;}"
+"#dsAllDone{background:#e6f5eb;color:#12683f;border-radius:12px;padding:18px 14px;text-align:center;"
+"font-size:14.5px;font-weight:800;margin-bottom:6px;}"
+"body.dsNoPh #ciList img{display:none!important;}"
+"#dsSum{display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:16px;"
+"padding:15px 17px;margin:0 0 11px;transition:background .3s;}"
+"#dsSum.go{background:#fff5d6;} #dsSum.ok{background:#e6f5eb;}"
+"#dsSum .pv{font-size:34px;font-weight:900;line-height:1;letter-spacing:-1px;}"
+"#dsSum .ps{font-size:13.5px;font-weight:700;margin-top:5px;}"
+"#dsSum .tl{font-size:11.5px;font-weight:700;opacity:.75;text-align:right;}"
+"#dsSum .tv{font-size:21px;font-weight:900;line-height:1.15;text-align:right;margin-top:2px;}"
+"#dsSum.go,#dsSum.go *{color:#8a6100;} #dsSum.ok,#dsSum.ok *{color:#12683f;}"
+"#dsSum .lt{font-size:12px;font-weight:800;color:#b3121d;}";
(function(){ const s=document.createElement('style'); s.id='dsGrpCSS'; s.textContent=GRP_CSS; document.head.appendChild(s); })();

let GRPBUSY=false;
function phOn(){ try{ return localStorage.getItem('dsPhoto')==='1'; }catch(e){ return false; } }
function doneOpen(){ try{ return localStorage.getItem('dsDoneOpen')==='1'; }catch(e){ return false; } }
function applyPhotoMode(){
  document.body.classList.toggle('dsNoPh', !phOn());
  const b=document.getElementById('dsPhoto');
  if(b){ b.classList.toggle('on', phOn()); b.textContent = phOn()? '📷 ซ่อนรูป' : '📷 แสดงรูป'; }
}
window.dsTogglePhoto=()=>{
  try{ localStorage.setItem('dsPhoto', phOn()?'0':'1'); }catch(e){}
  applyPhotoMode();
};
window.dsToggleDone=()=>{
  const open=!doneOpen();
  try{ localStorage.setItem('dsDoneOpen', open?'1':'0'); }catch(e){}
  const d=document.getElementById('dsDone'), h=document.getElementById('dsDoneHdr');
  if(d) d.style.display = open?'':'none';
  if(h) h.classList.toggle('open', open);
};
function isDone(row){
  return !!row.querySelector('button[onclick*="editTime("]');
}
function regroupCheckin(){
  if(GRPBUSY) return;
  const list=document.getElementById('ciList');
  if(!list) return;
  const rows=[...list.querySelectorAll('.row-c')];
  if(!rows.length) return;                      // แอปยังไม่วาด หรือไม่มีรายชื่อ
  GRPBUSY=true;
  try{
    const sig=rows.length+':'+rows.map(r=>(r.querySelector('button')||{}).outerHTML? (r.querySelector('button').getAttribute('onclick')||''):'').join(',')+'|A:'+Object.keys(absMap()).sort().join(',');
    if(list.dataset.dsSig===sig && list.querySelector('.dsHdr')){ GRPBUSY=false; return; }
    list.dataset.dsSig=sig;
    const todo=[], done=[], absent=[];
    const AM=absMap();
    rows.forEach(r=>{
      if(isDone(r)){ done.push(r); return; }
      const cid=rowCid(r);
      if(cid && AM[cid]) absent.push(r); else todo.push(r);
    });
    const late=done.filter(r=>r.classList.contains('st-late')).length;

    const frag=document.createDocumentFragment();
    if(todo.length){
      const h=document.createElement('div'); h.className='dsHdr todo';
      h.innerHTML='<span>⚠ ยังไม่เช็คอิน '+todo.length+' คน</span><span class="c">แตะปุ่มเพื่อบันทึก</span>';
      frag.appendChild(h);
      todo.forEach(r=>{
        const cid=rowCid(r);
        r.classList.remove('dsAbsRow');
        const oldTag=r.querySelector('.dsAbsTag'); if(oldTag) oldTag.remove();
        if(cid && !r.querySelector('#dsAbsBtnRow'+cid)){
          const nm=rowName(r);
          const b=document.createElement('button');
          b.id='dsAbsBtnRow'+cid; b.type='button'; b.textContent='🚫 ไม่มา';
          b.className='dsAbsAdd';
          b.setAttribute('style','border:1px solid #e6c9c9;background:#fff5f5;color:#a3151f;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap;margin-left:5px;');
          b.onclick=(ev)=>{ ev.stopPropagation(); window.dsAbsOpen(cid, nm.name, nm.code); };
          r.appendChild(b);
        }
        frag.appendChild(r);
      });
    } else {
      const ok=document.createElement('div'); ok.id='dsAllDone';
      ok.textContent='✅ เช็คอินครบทุกคนแล้ว '+done.length+' คน';
      frag.appendChild(ok);
    }
    if(absent.length){
      const h=document.createElement('div'); h.className='dsHdr abs';
      h.innerHTML='<span>🚫 ไม่มาทำงาน '+absent.length+' คน</span><span class="c">ไม่นับใน %</span>';
      frag.appendChild(h);
      absent.forEach(r=>{
        r.classList.add('dsAbsRow');
        const cid=rowCid(r), info=AM[cid]||{};
        const bx=r.querySelector('.info')||r;
        if(!bx.querySelector('.dsAbsTag')){
          const tg=document.createElement('span'); tg.className='dsAbsTag';
          tg.textContent='🚫 '+(info.note||'ไม่มาทำงาน');
          bx.appendChild(tg);
        }
        const btn=r.querySelector('button[onclick*="quickLog("],button[onclick*="openCamera("]');
        if(btn && !btn.dataset.dsAbsSwap){
          btn.dataset.dsAbsSwap='1';
          btn.setAttribute('onclick','dsAbsClear('+cid+')');
          btn.textContent='↩ ยกเลิก';
          btn.style.cssText='min-height:34px;padding:6px 11px;font-size:12px;';
        }
        frag.appendChild(r);
      });
    }
    if(done.length){
      const h=document.createElement('div'); h.className='dsHdr done'; h.id='dsDoneHdr';
      h.setAttribute('onclick','dsToggleDone()');
      h.innerHTML='<span>✓ เช็คอินแล้ว '+done.length+' คน'+(late? ' · สาย '+late:'')+'</span><span class="cv">⌄</span>';
      frag.appendChild(h);
      const box=document.createElement('div'); box.id='dsDone';
      done.forEach(r=>box.appendChild(r));
      frag.appendChild(box);
      if(doneOpen()) h.classList.add('open'); else box.style.display='none';
    }
    list.innerHTML='';
    list.appendChild(frag);
    list.querySelectorAll('img').forEach(im=>im.setAttribute('loading','lazy'));
    mountSummary(); paintSummary(todo.length, done.length, late, absent.length);
  }catch(e){ console.warn('regroup',e); }
  GRPBUSY=false;
}
function mountSummary(){
  const anchor=document.getElementById('dsGrpBar')||document.getElementById('ciSearch');
  if(!anchor||document.getElementById('dsSum')) return;
  const d=document.createElement('div'); d.id='dsSum'; d.className='go';
  anchor.parentNode.insertBefore(d, anchor);
}
function paintSummary(todo, done, late, abs){
  const el=document.getElementById('dsSum'); if(!el) return;
  abs=abs||0;
  const tot=todo+done, pct= tot? Math.round(done/tot*100):0;
  const now=new Date();
  const hh=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  el.className = (todo===0 && tot>0)? 'ok':'go';
  el.innerHTML='<div><div class="pv">'+pct+'%</div>'
    +'<div class="ps">เช็คอินแล้ว '+done+'/'+tot+' คน'+(abs? ' <span style="color:#8a6100">· ไม่มา '+abs+'</span>':'')
    +(late? ' <span class="lt">· สาย '+late+'</span>':'')+'</div></div>'
    +'<div><div class="tl">เวลา</div><div class="tv">'+hh+'</div></div>';
}
function mountGrpBar(){
  const s=document.getElementById('ciSearch');
  if(!s || document.getElementById('dsGrpBar')) return;
  const bar=document.createElement('div'); bar.id='dsGrpBar';
  s.parentNode.insertBefore(bar, s);
  bar.appendChild(s);
  const b=document.createElement('button');
  b.id='dsPhoto'; b.type='button'; b.setAttribute('onclick','dsTogglePhoto()');
  bar.appendChild(b);
  applyPhotoMode();
}
(function(){
  const start=()=>{
    const list=document.getElementById('ciList');
    if(!list){ setTimeout(start,600); return; }
    absLocalLoad(); mountGrpBar(); applyPhotoMode(); regroupCheckin();
    new MutationObserver(()=>{ if(!GRPBUSY) setTimeout(regroupCheckin,30); })
      .observe(list,{childList:true});
    setInterval(()=>{ mountGrpBar(); mountSummary(); regroupCheckin(); }, 3000);
    setInterval(()=>{ const l=document.getElementById('ciList'); if(!l) return;
      const rw=[...l.querySelectorAll('.row-c')];
      const dn=rw.filter(isDone); const AM=absMap();
      const ab=rw.filter(r=>!isDone(r) && AM[rowCid(r)]).length;
      paintSummary(rw.length-dn.length-ab, dn.length, dn.filter(r=>r.classList.contains('st-late')).length, ab); }, 20000);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();


/* ============ 🚫 ไม่มาทำงาน (ลา/ขาด) รายวัน ============
   เก็บแยกจากปุ่ม "พัก" ในหน้าจัดการ — มีผลเฉพาะวันนั้น พรุ่งนี้กลับมาปกติเอง
   ตัดออกจากฐานคำนวณ % Ontime เพื่อไม่ให้ตัวเลขเพี้ยน */
const ABS_CSS = "#dsAbsWrap{position:fixed;inset:0;z-index:99998;background:rgba(16,14,10,.8);display:none;"
+"align-items:center;justify-content:center;padding:16px;}"
+"#dsAbsWrap.show{display:flex;}"
+"#dsAbsBox{background:#fff;border-radius:22px;width:100%;max-width:420px;padding:20px 20px 18px;box-shadow:0 18px 50px rgba(0,0,0,.4);}"
+"#dsAbsBox h3{font-size:18px;font-weight:900;margin:0 0 4px;color:#1a1a1a;}"
+"#dsAbsBox .who{font-size:13.5px;color:#8a8272;font-weight:700;margin-bottom:14px;}"
+"#dsAbsBox label{display:block;font-size:12px;font-weight:800;color:#8a8272;margin-bottom:5px;}"
+"#dsAbsNote{width:100%;min-height:86px;padding:12px 13px;border:1px solid #ece5d5;border-radius:13px;"
+"background:#fbf9f4;font-family:inherit;font-size:16px;font-weight:600;color:#1a1a1a;}"
+"#dsAbsNote:focus{outline:none;border-color:#FFCC00;background:#fffdf5;}"
+"#dsAbsQuick{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 4px;}"
+"#dsAbsQuick button{border:1px solid #efe9dc;background:#fbf9f4;color:#6b6558;border-radius:9px;"
+"padding:7px 11px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;}"
+".dsAbsAct{display:flex;gap:9px;margin-top:15px;}"
+".dsAbsAct button{flex:1;border:none;border-radius:15px;padding:15px;font-size:15.5px;font-weight:900;font-family:inherit;cursor:pointer;}"
+"#dsAbsOk{background:#D40511;color:#fff;} #dsAbsCancel{background:#f2ede2;color:#5f5a4e;}"
+".dsHdr.abs{background:#f2ede2;color:#5f5a4e;}"
+".row-c.dsAbsRow{opacity:.72;}"
+".dsAbsTag{display:block;font-size:11.5px;font-weight:700;color:#8a6100;margin-top:3px;}"
+"#dsAbsBtn{border:1px solid #e6c9c9;background:#fff5f5;color:#a3151f;border-radius:9px;padding:7px 10px;"
+"font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap;}";
(function(){ const s=document.createElement('style'); s.textContent=ABS_CSS; document.head.appendChild(s);
  const w=document.createElement('div'); w.id='dsAbsWrap';
  w.innerHTML='<div id="dsAbsBox"><h3>🚫 ไม่มาทำงานวันนี้</h3><div class="who" id="dsAbsWho"></div>'
   +'<label>สาเหตุ (ระบุให้ชัดเจน)</label>'
   +'<textarea id="dsAbsNote" placeholder="เช่น ลาป่วย มีใบรับรองแพทย์ / ลากิจ แจ้งล่วงหน้า 1 วัน / ขาดงาน ไม่แจ้ง"></textarea>'
   +'<div id="dsAbsQuick"></div>'
   +'<div class="dsAbsAct"><button id="dsAbsCancel" type="button">ยกเลิก</button>'
   +'<button id="dsAbsOk" type="button">บันทึก</button></div></div>';
  document.body.appendChild(w);
})();

let ABS_CID=null;
function absMap(){ return (S.absent&&typeof S.absent==='object')? S.absent : {}; }
function absLocalSave(){
  try{ localStorage.setItem('dsAbs_'+tKey(), JSON.stringify(absMap())); }catch(e){}
}
function absLocalLoad(){
  try{ const v=localStorage.getItem('dsAbs_'+tKey()); if(v) S.absent=JSON.parse(v)||{}; }catch(e){}
}
window.dsAbsOpen=(cid,name,code)=>{
  ABS_CID=String(cid);
  document.getElementById('dsAbsWho').textContent=(code||'')+' · '+(name||'');
  const n=document.getElementById('dsAbsNote'); n.value='';
  const q=document.getElementById('dsAbsQuick'); q.innerHTML='';
  ['ลาป่วย','ลากิจ','ขาดงาน ไม่แจ้ง','ลาพักร้อน','แจ้งลาล่วงหน้า'].forEach(x=>{
    const b=document.createElement('button'); b.type='button'; b.textContent=x;
    b.onclick=()=>{ n.value = n.value? (n.value+' · '+x) : x; n.focus(); };
    q.appendChild(b);
  });
  document.getElementById('dsAbsWrap').classList.add('show');
  setTimeout(()=>n.focus(),150);
};
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='dsAbsCancel'){ document.getElementById('dsAbsWrap').classList.remove('show'); ABS_CID=null; }
  if(e.target && e.target.id==='dsAbsWrap'){ document.getElementById('dsAbsWrap').classList.remove('show'); ABS_CID=null; }
  if(e.target && e.target.id==='dsAbsOk'){
    const note=(document.getElementById('dsAbsNote').value||'').trim();
    if(!note){ alert('กรุณาระบุสาเหตุ'); return; }
    const btn=e.target; btn.disabled=true; btn.textContent='กำลังบันทึก...';
    dsAbsSave(ABS_CID, note).finally(()=>{ btn.disabled=false; btn.textContent='บันทึก';
      document.getElementById('dsAbsWrap').classList.remove('show'); ABS_CID=null; });
  }
});
async function dsAbsSave(cid, note){
  if(!cid) return;
  const rec={ note, at:Date.now(), by:S.staff||'' };
  S.absent=S.absent||{}; S.absent[String(cid)]=rec; absLocalSave();
  try{ const L=document.getElementById('ciList'); if(L) L.dataset.dsSig=''; }catch(e){}
  try{ regroupCheckin(); }catch(e){}
  if(!S.ready) return;
  try{
    await setDoc(dayRef(S.depot,tKey()), { depot:S.depot, date:tKey(),
      absent:{ [String(cid)]: rec }, updatedAt:Date.now() }, {merge:true});
    toast('🚫 บันทึกไม่มาทำงานแล้ว');
  }catch(e){ flagErr('บันทึกไม่มาทำงานไม่สำเร็จ: '+e.message); }
}
window.dsAbsClear=async (cid)=>{
  if(!confirm('ยกเลิกสถานะไม่มาทำงาน?\nคนนี้จะกลับไปอยู่ในรายชื่อรอเช็คอิน')) return;
  const k=String(cid);
  if(S.absent) delete S.absent[k];
  absLocalSave();
  try{ const L=document.getElementById('ciList'); if(L) L.dataset.dsSig=''; }catch(e){}
  try{ regroupCheckin(); }catch(e){}
  if(!S.ready) return;
  try{ await updateDoc(dayRef(S.depot,tKey()), { ['absent.'+k]: deleteField(), updatedAt:Date.now() }); }
  catch(e){ console.warn('clr abs',e); }
};
function rowCid(row){
  if(row.dataset && row.dataset.dsCid) return row.dataset.dsCid;
  const b=row.querySelector('button[onclick*="quickLog("],button[onclick*="openCamera("],button[onclick*="dsAbsClear("],button[onclick*="editTime("]');
  if(!b) return null;
  const oc=b.getAttribute('onclick')||'';
  const m=oc.match(/quickLog\((\d+)|openCamera\((\d+)|dsAbsClear\((\d+)/);
  const id = m? (m[1]||m[2]||m[3]) : null;
  if(id && row.dataset) row.dataset.dsCid=id;
  return id;
}
function rowName(row){
  const n=row.querySelector('.nm'), s=row.querySelector('.sub,.sub2');
  return { name:(n?n.textContent:'').trim(), code:(s?s.textContent:'').split('•')[0].trim() };
}

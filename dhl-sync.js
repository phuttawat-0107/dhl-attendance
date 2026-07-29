/* ============================================================
   DHL Attendance — Firebase Sync Module (Staff side)
   แทรกด้วย <script type="module" src="dhl-sync.js"></script> ก่อน </body>
   ไม่แตะโค้ดเดิม — ใช้วิธี wrap ฟังก์ชันเดิม (putCheckin / putPPH)
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection,
         query, where, getDocs, deleteDoc, serverTimestamp, addDoc, orderBy }
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
  unsubDay:null, unsubCom:null, comments:[], busy:false, ready:false
};
window.DHLSync = S;

/* ---------- utils ---------- */
const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet = (k,v) => { try{ localStorage.setItem(k,v); }catch(e){} };
const dayRef  = (dep,date)=> doc(dbF,'depots',dep,'days',date);
const depRef  = dep => doc(dbF,'depots',dep);
const comCol  = dep => collection(dbF,'depots',dep,'comments');
const phoCol  = dep => collection(dbF,'depots',dep,'photos');
const tKey = ()=> (window.todayKey? todayKey() : new Date().toISOString().slice(0,10));

function toast(msg){ if(window.flash) flash(msg); }

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

function injectUI(){
  const st=document.createElement('style'); st.textContent=LOGIN_CSS; document.head.appendChild(st);
  const d=document.createElement('div'); d.id='dsLogin';
  d.innerHTML=`<div class="box"><div class="yb"></div>
    <h3>เข้าสู่ระบบ</h3><p>ใส่ PIN ของสาขา แล้วเลือกชื่อของคุณ</p>
    <label>สาขา</label><select id="dsDep"></select>
    <label>PIN สาขา (6 หลัก)</label><input id="dsPin" type="tel" inputmode="numeric" maxlength="6" placeholder="••••••">
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

  const deps=['PHI','BPE','PWT','PKS','DST','BPL','PWN'];
  document.getElementById('dsDep').innerHTML=deps.map(x=>'<option>'+x+'</option>').join('');
  const cur=(window.settings&&settings.depot)||lsGet('dsDepot');
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
    err.textContent='';
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
      await setDoc(ref,{ uid:S.uid, at:Date.now() },{merge:true});
    }catch(e){}
  };
  beat(); S._hb=setInterval(beat,120000);
}

async function afterLogin(){
  S.ready=true;
  document.getElementById('dsBadge').classList.add('on');
  document.getElementById('dsBadge').textContent='☁ '+S.depot+' · '+S.staff;
  /* ให้แอปเดิมใช้ค่าตรงกัน */
  if(window.settings){ settings.depot=S.depot; settings.staff=S.staff;
    try{ localStorage.setItem('settings',JSON.stringify(settings)); }catch(e){}
    if(window.applyHeader) applyHeader();
  }
  await pushAll();
  listenDay();
  listenComments();
  startHeartbeat();
  purgeOldPhotos30();
}

/* ============ PUSH: ส่งข้อมูลวันนี้ขึ้นคลาวด์ ============ */
/* เขียนแบบ field-level (dot path) — ไม่ทับข้อมูลของเครื่องอื่น และไม่ล้างด้วยค่าว่าง */
async function pushAll(){
  if(!S.ready||S.busy) return; S.busy=true;
  try{
    const date=tKey();
    const recs = window.getByDate? await getByDate(date) : [];
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
    const couriers=(window.couriers||[]).filter(c=>c.active!==false)
      .map(c=>({ id:c.id, code:c.code, name:c.name, vendor:c.vendor||'', type:c.type||'' }));
    if(couriers.length){
      up['couriers']=couriers;
      /* เก็บ master list ไว้ที่สาขาด้วย — Manager ใช้เป็นตัวสำรองถ้าวันไหนไม่มี */
      try{ await setDoc(depRef(S.depot),{ couriers, couriersAt:Date.now() },{merge:true}); }catch(e){}
    }

    if(Object.keys(up).length) await updateDoc(ref,up);
  }catch(e){ console.warn('sync push',e); }
  S.busy=false;
}
let pushTimer=null;
function pushSoon(){ clearTimeout(pushTimer); pushTimer=setTimeout(pushAll,700); }

/* ============ PHOTOS: ย่อ + อัปขึ้น Firestore ============ */
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
  S.unsubDay=onSnapshot(dayRef(S.depot,date), snap=>{
    if(!snap.exists()||!snap.metadata.hasPendingWrites===false) {}
    if(!snap.exists()) return;
    if(snap.metadata.hasPendingWrites) return;      // การเขียนของเราเอง
    mergeRemote(snap.data());
  }, e=>console.warn('listen day',e));
}

async function mergeRemote(d){
  try{
    const date=d.date||tKey();
    let changed=false;
    /* --- เช็คอิน --- */
    const local = window.getByDate? await getByDate(date) : [];
    const lmap={}; local.forEach(r=>lmap[r.courierId]=r);
    for(const [cid,rc] of Object.entries(d.checkins||{})){
      const id=+cid, cur=lmap[id];
      if(!cur){
        await putCheckin({ courierId:id, date, ts:rc.ts, status:rc.status, buffer:!!rc.buffer,
          photo:null, uniform:rc.uniform!==false, manualEdit:!!rc.manualEdit, staff:rc.staff||'' });
        changed=true;
      } else if(cur.ts!==rc.ts || cur.status!==rc.status || (!!cur.manualEdit)!==(!!rc.manualEdit)){
        cur.ts=rc.ts; cur.status=rc.status; cur.buffer=!!rc.buffer;
        cur.manualEdit=!!rc.manualEdit; cur.uniform=rc.uniform!==false;
        await putCheckin(cur); changed=true;
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
        await putPPH(cur); changed=true;
      }
    }
    if(changed){
      toast('☁ ซิงค์ข้อมูลจากเครื่องอื่นแล้ว');
      const v=document.querySelector('.view.active');
      const id=v? v.id:'';
      if(id==='view-checkin'&&window.renderCheckin) renderCheckin();
      if(id==='view-pd'&&window.renderPDCard) renderPDCard();
      if(id==='view-pph'&&window.renderPPH) renderPPH();
      if(id==='view-fdel'&&window.renderFDel) renderFDel();
      if(id==='view-dash'&&window.renderDash) renderDash();
    }
  }catch(e){ console.warn('merge',e); }
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
      +'<div class="small" style="margin-top:7px;">ใช้เมื่อเปลี่ยนคนใช้เครื่องนี้ หรือย้ายไปเครื่องอื่น</div>';
    mv.appendChild(div);
  }
  const who=document.getElementById('dsWho');
  if(who) who.innerHTML = S.ready
    ? 'เข้าใช้งานอยู่: <b>'+S.staff+'</b> • สาขา <b>'+S.depot+'</b> • ☁ ซิงค์อัตโนมัติ'
    : '<span style="color:var(--r);font-weight:700;">⚠ ยังไม่ได้เข้าระบบ — ข้อมูลจะไม่ขึ้นคลาวด์</span>';
}
setInterval(mountLogout,2000);

/* ============ WRAP ฟังก์ชันเดิม ============ */
function wrap(){
  if(window.putCheckin && !window.putCheckin.__ds){
    const o=window.putCheckin;
    const f=async function(rec){ const r=await o(rec); pushSoon(); if(rec&&rec.photo) pushPhoto('ci',rec.courierId,rec.photo); return r; };
    f.__ds=true; window.putCheckin=f;
  }
  if(window.putPPH && !window.putPPH.__ds){
    const o=window.putPPH;
    const f=async function(rec){ const r=await o(rec); pushSoon();
      if(rec&&rec.pd&&rec.pd.photo) pushPhoto('pd',null,rec.pd.photo); return r; };
    f.__ds=true; window.putPPH=f;
  }
  if(window.delCheckin && !window.delCheckin.__ds){
    const o=window.delCheckin;
    const f=async function(id){ const r=await o(id); pushSoon(); return r; };
    f.__ds=true; window.delCheckin=f;
  }
}

/* ============ BOOT ============ */
function boot(){
  injectUI(); wrap();
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

  /* ข้ามวัน → ย้าย listener */
  let cur=tKey();
  setInterval(()=>{ const k=tKey(); if(k!==cur){ cur=k; if(S.ready){ listenDay(); pushAll(); } } },60000);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();

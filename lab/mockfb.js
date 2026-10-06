/* ============================================================
   แล็บทดสอบหลายเครื่อง — Firebase จำลอง (ใช้แทน gstatic ในแล็บเท่านั้น)
   ข้อมูลอยู่ที่ window.top.__FSDB (คลาวด์จำลองตัวเดียว ทุกเครื่องเห็นร่วมกัน)
   มีความหน่วงเครือข่ายสุ่ม · transaction ตรวจชนกันแล้วรันใหม่ เหมือนของจริง
   ============================================================ */
window.__MOCKFB_SRC = function(DEV){ return `
const DEV=${JSON.stringify(DEV)};
const DB = window.top.__FSDB;
const clone = v => v===undefined? undefined : JSON.parse(JSON.stringify(v));
const isObj = v => v && typeof v==='object' && !Array.isArray(v) && !v.__fv;
const lat = () => new Promise(r=>setTimeout(r, DB.latency(DEV)));
function FV(t,a){ return {__fv:t, a}; }
export const deleteField = () => FV('del');
export const serverTimestamp = () => FV('ts');
export const arrayUnion = (...a) => FV('au',a);
export const arrayRemove = (...a) => FV('ar',a);
function resolve(v, old){
  if(v && v.__fv){
    if(v.__fv==='ts') return Date.now();
    if(v.__fv==='au'){ const o=Array.isArray(old)?old.slice():[]; v.a.forEach(x=>{ if(!o.some(y=>JSON.stringify(y)===JSON.stringify(x))) o.push(x); }); return o; }
    if(v.__fv==='ar'){ const o=Array.isArray(old)?old:[]; return o.filter(y=>!v.a.some(x=>JSON.stringify(x)===JSON.stringify(y))); }
  }
  if(isObj(v)){ const o={}; for(const k in v){ if(v[k]&&v[k].__fv==='del') continue; o[k]=resolve(v[k], old&&old[k]); } return o; }
  return clone(v);
}
function deepMerge(base, add){
  const o = isObj(base)? clone(base) : {};
  for(const k in add){ const v=add[k];
    if(v && v.__fv==='del'){ delete o[k]; continue; }
    if(isObj(v)) o[k]=deepMerge(o[k], v); else o[k]=resolve(v, o[k]);
  } return o;
}
function setPath(obj, path, v){
  const ks=path.split('.'); let o=obj;
  for(let i=0;i<ks.length-1;i++){ if(!isObj(o[ks[i]])) o[ks[i]]={}; o=o[ks[i]]; }
  const last=ks[ks.length-1];
  if(v && v.__fv==='del') delete o[last]; else o[last]=resolve(v, o[last]);
}
/* refs */
export function initializeApp(){ return {dev:DEV}; }
export function getFirestore(app){ return {dev:DEV, _db:true}; }
export function doc(base, ...segs){ const p = base && base._col? [base._col,...segs] : segs; const path=(base&&base._col? p : p).join('/'); return {_doc:true, path, id:path.split('/').pop(), parent:{_col:path.split('/').slice(0,-1).join('/')}}; }
export function collection(base, ...segs){ const pre = base && base._doc? base.path+'/' : ''; return {_col: pre+segs.join('/')}; }
export function where(f,op,v){ return {_w:[f,op,v]}; }
export function orderBy(f,d){ return {_o:[f,d||'asc']}; }
export function query(col, ...cs){ return {_col:col._col, _q:cs}; }
function snapOf(path){ const d=DB.docs.get(path); return { id:path.split('/').pop(), ref:doc(...[{_col:path.split('/').slice(0,-1).join('/')}], path.split('/').pop()), exists:()=>d!==undefined, data:()=>clone(d), get:(f)=>d? f.split('.').reduce((o,k)=>o&&o[k], d) : undefined, metadata:{hasPendingWrites:false, fromCache:false} }; }
function matches(q, path){
  const parent=path.split('/').slice(0,-1).join('/'); if(parent!==q._col) return false;
  const d=DB.docs.get(path); if(d===undefined) return false;
  for(const c of (q._q||[])){ if(!c._w) continue; const [f,op,v]=c._w; const x=f.split('.').reduce((o,k)=>o&&o[k], d);
    if(op==='=='&&!(x===v)) return false; if(op==='<'&&!(x<v)) return false; if(op==='<='&&!(x<=v)) return false;
    if(op==='>'&&!(x>v)) return false; if(op==='>='&&!(x>=v)) return false; if(op==='in'&&!(v.includes(x))) return false;
    if(op==='array-contains'&&!(Array.isArray(x)&&x.includes(v))) return false; }
  return true;
}
function qsnap(q){ const docs=[...DB.docs.keys()].filter(p=>matches(q,p)).map(snapOf); return {docs, size:docs.length, empty:!docs.length, forEach:f=>docs.forEach(f)}; }
function commit(path, val){ if(val===undefined) DB.docs.delete(path); else DB.docs.set(path, val); DB.ver.set(path,(DB.ver.get(path)||0)+1); DB.log.push([Date.now(),DEV,val===undefined?'del':'set',path]); DB.notify(path); }
async function chk(){ await lat(); if(DB.offline[DEV]) { const e=new Error('offline (lab)'); e.code='unavailable'; throw e; } }
export async function getDoc(ref){ await chk(); DB.stats.reads++; return snapOf(ref.path); }
export async function getDocs(q){ await chk(); DB.stats.reads++; return qsnap(q._q? q : {_col:q._col,_q:[]}); }
export async function setDoc(ref, data, opt){ await chk(); DB.stats.writes++; const old=DB.docs.get(ref.path); commit(ref.path, opt&&opt.merge? deepMerge(old, data) : resolve(data, {})); }
export async function updateDoc(ref, data){ await chk(); DB.stats.writes++; const old=DB.docs.get(ref.path); if(old===undefined){ const e=new Error('No document to update: '+ref.path); e.code='not-found'; throw e; } const o=clone(old); for(const k in data) setPath(o,k,data[k]); commit(ref.path,o); }
export async function deleteDoc(ref){ await chk(); DB.stats.writes++; commit(ref.path, undefined); }
export async function addDoc(col, data){ const id='a'+Math.random().toString(36).slice(2,10); const ref=doc(col,id); await setDoc(ref,data); return ref; }
export async function runTransaction(db, fn){
  for(let attempt=0; attempt<6; attempt++){
    await chk(); const reads=new Map(), writes=[];
    const tx={ get: async ref=>{ await lat(); reads.set(ref.path, DB.ver.get(ref.path)||0); return snapOf(ref.path); },
      set:(ref,d,o)=>{ writes.push(['set',ref,d,o]); return tx; }, update:(ref,d)=>{ writes.push(['upd',ref,d]); return tx; }, delete:ref=>{ writes.push(['del',ref]); return tx; } };
    const res = await fn(tx);
    const conflict=[...reads].some(([p,v])=>(DB.ver.get(p)||0)!==v);
    if(conflict){ DB.stats.txRetry++; continue; }
    for(const w of writes){ const p=w[1].path, old=DB.docs.get(p);
      if(w[0]==='set') commit(p, w[3]&&w[3].merge? deepMerge(old,w[2]) : resolve(w[2],{}));
      else if(w[0]==='upd'){ if(old===undefined){ const e=new Error('No document to update'); e.code='not-found'; throw e; } const o=clone(old); for(const k in w[2]) setPath(o,k,w[2][k]); commit(p,o); }
      else commit(p, undefined); }
    DB.stats.tx++; return res;
  }
  const e=new Error('transaction contention (lab)'); e.code='aborted'; throw e;
}
export function onSnapshot(target, cb, err){
  const L={dev:DEV, target, cb, alive:true}; DB.listeners.add(L);
  setTimeout(()=>{ if(L.alive) DB.fire(L); }, DB.latency(DEV));
  return ()=>{ L.alive=false; DB.listeners.delete(L); };
}
/* auth */
const AUTH={currentUser:null, subs:[]};
export function getAuth(){ return AUTH; }
export async function signInAnonymously(a){ await lat(); AUTH.currentUser={uid:'lab-'+DEV+'-'+Math.random().toString(36).slice(2,7), isAnonymous:true}; AUTH.subs.forEach(f=>setTimeout(()=>f(AUTH.currentUser),0)); return {user:AUTH.currentUser}; }
export function onAuthStateChanged(a, f){ AUTH.subs.push(f); if(AUTH.currentUser) setTimeout(()=>f(AUTH.currentUser),0); return ()=>{}; }
`; };

/* คลาวด์จำลอง (อยู่หน้าแม่) */
window.__makeFSDB = function(opts){
  const DB = { docs:new Map(), ver:new Map(), listeners:new Set(), log:[], offline:{}, stats:{reads:0,writes:0,tx:0,txRetry:0,snaps:0},
    lat:[opts&&opts.min||20, opts&&opts.max||180] };
  DB.latency = dev => DB.lat[0] + Math.random()*(DB.lat[1]-DB.lat[0]);
  const clone = v => v===undefined? undefined : JSON.parse(JSON.stringify(v));
  DB.fire = L => {
    if(!L.alive) return; DB.stats.snaps++;
    const t=L.target;
    if(t._doc){ const d=DB.docs.get(t.path); L.cb({ id:t.id, exists:()=>d!==undefined, data:()=>clone(d), metadata:{hasPendingWrites:false,fromCache:false}, ref:t }); }
    else { const parent=t._col; const docs=[...DB.docs.keys()].filter(p=>p.split('/').slice(0,-1).join('/')===parent).filter(p=>{
        const d=DB.docs.get(p); return (t._q||[]).every(c=>{ if(!c._w) return true; const [f,op,v]=c._w; const x=f.split('.').reduce((o,k)=>o&&o[k], d);
          return op==='=='?x===v: op==='>='?x>=v: op==='<='?x<=v: op==='<'?x<v: op==='>'?x>v: op==='in'?v.includes(x): true; }); })
        .map(p=>({ id:p.split('/').pop(), data:()=>clone(DB.docs.get(p)), ref:{path:p, _doc:true, id:p.split('/').pop()}, exists:()=>true }));
      L.cb({ docs, size:docs.length, empty:!docs.length, forEach:f=>docs.forEach(f), docChanges:()=>[] }); }
  };
  DB.notify = path => {
    for(const L of DB.listeners){ const t=L.target;
      const hit = t._doc? t.path===path : path.split('/').slice(0,-1).join('/')===t._col;
      if(hit){ if(DB.offline[L.dev]) continue; setTimeout(()=>DB.fire(L), DB.latency(L.dev)); } }
  };
  return DB;
};

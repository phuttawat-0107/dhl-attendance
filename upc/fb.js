/* ===================================================================
   fb.js — ชั้นข้อมูลของ DHL UPC Attendance Lite
   • โหมดจริง  : Firebase (Auth + Firestore พร้อมแคชออฟไลน์)
   • โหมด Demo : เปิดลิงก์ด้วย ?demo — จำลองทุกอย่างในเบราว์เซอร์ ไม่แตะข้อมูลจริง
                 ใช้ทดสอบระบบ และใช้ฝึก UPC Manager / Staff ก่อนใช้งานจริง
   Design By Winnie
   =================================================================== */
export const FB_VER = '2026.09.26-e';
export const DEMO = new URLSearchParams(location.search).has('demo');

/* ⚙️ ค่าเชื่อมต่อโปรเจกต์ Firebase ใหม่ของ UPC — วางค่าจาก Firebase Console ตรงนี้ */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDUy5BlqFvGQnlUrwpH2VcdLHIDeNNi4TY',
  authDomain: 'dhl-upc-attendance.firebaseapp.com',
  projectId: 'dhl-upc-attendance',
  storageBucket: 'dhl-upc-attendance.firebasestorage.app',
  messagingSenderId: '340598497230',
  appId: '1:340598497230:web:b2d52fd1c7ee6bd9bb959f'
};

export const DEL = { __del: true };   // ลบฟิลด์
export const NOW = { __now: true };   // เวลาเซิร์ฟเวอร์
export const toMs = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : null);

/* อีเมลภายในสำหรับบัญชี (ผู้ใช้ไม่เห็น) */
export const depotEmail = (code, ver) => code.toLowerCase().replace(/[^a-z0-9]/g, '') + (ver > 1 ? '.v' + ver : '') + '@depot.upc.dhl';
/* Manager เข้าด้วย PIN 6 หลักอย่างเดียว (เหมือนหน้า Manager เดิม) — PIN แต่ละคนไม่ซ้ำกัน */
export const mgrEmail   = pin => 'm' + String(pin).replace(/\D/g, '') + '@mgr.upc.dhl';
export const mgrPw      = pin => 'upc#' + String(pin).replace(/\D/g, '');
/* สถานะแบบเดียวกับแอปเดิม: ontime ถ้าไม่เกิน 07:10 (ผ่อนผันภายใน ไม่แสดงบนหน้าจอ) */
export const CUT = 25200, GRACE = 25800;
/* เวลาเข้างานตั้งได้รายสาขา (เช่น SRN 07:30) — ผ่อนผันภายใน +10 นาทีเสมอ */
export const GRACE_ADD = 600;
export const cutOf = dep => (dep && +dep.cut) || CUT;
export const hmCut = s => String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0');
export function calcStatus(ms, cut = CUT) {
  const d = new Date(ms), s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return s <= cut + GRACE_ADD ? { status: 'ontime', buffer: s > cut } : { status: 'late', buffer: false };
}

let impl = null;
/* appName แยก session ของแต่ละแอป (Staff / Manager) — เปิดทั้ง 2 แอปในเครื่องเดียวกันได้โดยไม่ชนกัน */
export async function initFB(appName) {
  if (impl) return impl;
  impl = DEMO ? makeDemo(appName) : await makeReal(appName);
  return impl;
}

/* ============================ โหมดจริง ============================ */
async function makeReal(appName) {
  if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME') throw new Error('ยังไม่ได้ตั้งค่า Firebase — เปิดด้วย ?demo เพื่อทดลองก่อน');
  const V = '11.0.2', base = 'https://www.gstatic.com/firebasejs/' + V + '/';
  const [A, U, F] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')
  ]);
  const app = appName ? A.initializeApp(FIREBASE_CONFIG, appName) : A.initializeApp(FIREBASE_CONFIG);
  const auth = U.getAuth(app);
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) { db = F.getFirestore(app); }
  const ref = p => F.doc(db, ...p.split('/'));
  const conv = o => {
    if (o === DEL) return F.deleteField();
    if (o === NOW) return F.serverTimestamp();
    if (o instanceof Date) return o;
    if (o && typeof o === 'object' && !Array.isArray(o)) { const r = {}; for (const k in o) r[k] = conv(o[k]); return r; }
    return o;
  };
  let second = null;
  return {
    mode: 'real',
    uid: () => auth.currentUser ? auth.currentUser.uid : null,
    onAuth: cb => U.onAuthStateChanged(auth, u => cb(u ? u.uid : null)),
    signIn: async (email, pw) => (await U.signInWithEmailAndPassword(auth, email, pw)).user.uid,
    signOut: () => U.signOut(auth),
    /* สร้างบัญชีใหม่ผ่านแอปสำรอง — ไม่ทำให้แอดมินหลุดจากระบบ */
    createUser: async (email, pw) => {
      if (!second) second = U.getAuth(A.initializeApp(FIREBASE_CONFIG, 'admin-create'));
      const c = await U.createUserWithEmailAndPassword(second, email, pw);
      const id = c.user.uid; await U.signOut(second); return id;
    },
    createSelf: async (email, pw) => (await U.createUserWithEmailAndPassword(auth, email, pw)).user.uid,
    get: async p => { const s = await F.getDoc(ref(p)); return s.exists() ? s.data() : null; },
    set: (p, d, merge = true) => F.setDoc(ref(p), conv(d), { merge }),
    update: (p, d) => F.updateDoc(ref(p), conv(d)),
    del: p => F.deleteDoc(ref(p)),
    listen: (p, cb) => F.onSnapshot(ref(p), { includeMetadataChanges: true },
      s => cb(s.exists() ? s.data() : null, { pending: s.metadata.hasPendingWrites, cache: s.metadata.fromCache }),
      e => cb(null, { error: e })),
    list: async (col, field, op, val) => {
      const c = F.collection(db, ...col.split('/'));
      const q = field ? F.query(c, F.where(field, op, val)) : c;
      const s = await F.getDocs(q); return s.docs.map(d => ({ id: d.id, data: d.data() }));
    }
  };
}

/* ============================ โหมด Demo ============================ */
function makeDemo(appName) {
  const KEY = 'upcDemoDB_v4', SES = 'upcDemoUid_' + (appName || 'app');
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('upc-demo') : null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  let DB = load();
  if (!DB) { DB = seed(); save(); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { console.warn('demo storage full', e); }
  }
  const L = {}; // path -> Set(cb)
  const fire = p => { (L[p] || []).forEach(cb => { try { cb(clone(DB.docs[p] || null), { pending: false, cache: false }); } catch (e) {} }); };
  const touched = p => { save(); fire(p); bc && bc.postMessage({ p }); };
  if (bc) bc.onmessage = e => { DB = load() || DB; fire(e.data.p); };
  window.addEventListener('storage', e => { if (e.key === KEY) { DB = load() || DB; Object.keys(L).forEach(fire); } });

  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const val = v => v === NOW ? Date.now() : v;
  function deepMerge(t, s) {
    for (const k in s) {
      const v = s[k];
      if (v === DEL) { delete t[k]; continue; }
      if (v && typeof v === 'object' && !Array.isArray(v) && v !== NOW) {
        if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {};
        deepMerge(t[k], v);
      } else t[k] = val(v);
    }
    return t;
  }
  function setPath(o, path, v) {
    const ks = path.split('.'); let c = o;
    for (let i = 0; i < ks.length - 1; i++) { if (!c[ks[i]] || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; }
    const last = ks[ks.length - 1];
    if (v === DEL) delete c[last];
    else if (v && typeof v === 'object' && !Array.isArray(v)) c[last] = deepMerge({}, v);
    else c[last] = val(v);
  }
  const authCbs = new Set();
  const uid = () => sessionStorage.getItem(SES);
  const setUid = u => { if (u) sessionStorage.setItem(SES, u); else sessionStorage.removeItem(SES); authCbs.forEach(cb => cb(u)); };
  const err = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

  return {
    mode: 'demo',
    uid,
    onAuth: cb => { authCbs.add(cb); setTimeout(() => cb(uid()), 0); return () => authCbs.delete(cb); },
    signIn: async (email, pw) => {
      await wait(250);
      const u = DB.users[email];
      if (!u || u.pw !== pw) throw err('auth/invalid-credential', 'wrong');
      setUid(u.uid); return u.uid;
    },
    signOut: async () => setUid(null),
    createUser: async (email, pw) => {
      if (DB.users[email]) throw err('auth/email-already-in-use', 'exists');
      if (String(pw).length < 6) throw err('auth/weak-password', 'weak');
      const id = 'u' + Math.random().toString(36).slice(2, 10);
      DB.users[email] = { pw, uid: id }; save(); return id;
    },
    createSelf: async function (email, pw) { const id = await this.createUser(email, pw); setUid(id); return id; },
    get: async p => { await wait(40); return clone(DB.docs[p] || synth(p)); },
    set: async (p, d, merge = true) => {
      DB.docs[p] = merge ? deepMerge(DB.docs[p] || {}, clone2(d)) : deepMerge({}, clone2(d)); touched(p);
    },
    update: async (p, d) => {
      if (!DB.docs[p]) throw err('not-found', 'no doc');
      for (const k in d) setPath(DB.docs[p], k, d[k]); touched(p);
    },
    del: async p => { delete DB.docs[p]; touched(p); },
    listen: (p, cb) => {
      (L[p] = L[p] || new Set()).add(cb);
      setTimeout(() => cb(clone(DB.docs[p] || null), { pending: false, cache: false }), 0);
      return () => L[p].delete(cb);
    },
    list: async (col, field, op, v) => {
      const pre = col + '/', out = [];
      Object.keys(DB.docs).forEach(p => {
        if (p.indexOf(pre) !== 0 || p.slice(pre.length).indexOf('/') >= 0) return;
        const d = DB.docs[p];
        if (field) { const x = d[field]; if (op === '<' && !(x < v)) return; if (op === '==' && x !== v) return; if (op === '>=' && !(x >= v)) return; }
        out.push({ id: p.slice(pre.length), data: clone(d) });
      });
      return out;
    },
    resetDemo: () => { localStorage.removeItem(KEY); sessionStorage.removeItem(SES); }
  };

  function clone2(d) { // เก็บ sentinel ไว้ ไม่ให้ JSON ทำหาย
    if (d === DEL || d === NOW) return d;
    if (d instanceof Date) return d.getTime();
    if (d && typeof d === 'object' && !Array.isArray(d)) { const r = {}; for (const k in d) r[k] = clone2(d[k]); return r; }
    return Array.isArray(d) ? d.slice() : d;
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* รูปจำลองสำหรับข้อมูลย้อนหลังในโหมด Demo (ไม่กินพื้นที่เครื่อง) */
  function synth(p) {
    const m = /^depots\/([^/]+)\/photos\/ci_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(p);
    if (!m) return null;
    const day = DB.docs['depots/' + m[1] + '/days/' + m[3]];
    if (!day || !day.checkins || !day.checkins[m[2]] || !day.checkins[m[2]].demoPhoto) return null;
    const c = document.createElement('canvas'); c.width = 180; c.height = 240;
    const x = c.getContext('2d');
    const hue = (parseInt(m[2], 10) * 47) % 360;
    x.fillStyle = 'hsl(' + hue + ',35%,78%)'; x.fillRect(0, 0, 180, 240);
    x.fillStyle = '#FFCC00'; x.fillRect(35, 120, 110, 120);
    x.fillStyle = '#D40511'; x.fillRect(35, 150, 110, 14);
    x.fillStyle = 'hsl(' + hue + ',25%,45%)'; x.beginPath(); x.arc(90, 80, 38, 0, 7); x.fill();
    x.fillStyle = '#171717'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
    x.fillText('DEMO ' + m[1] + ' #' + m[2], 90, 228);
    return { d: c.toDataURL('image/jpeg', 0.6), date: m[3], demo: true };
  }

  /* ข้อมูลตั้งต้นของโหมด Demo */
  function seed() {
    const db = { users: {}, docs: {} };
    const addUser = (email, pw) => { const id = 'u' + Math.random().toString(36).slice(2, 10); db.users[email] = { pw, uid: id }; return id; };
    const admin = addUser(mgrEmail('999999'), mgrPw('999999'));
    db.docs['config/adminLock'] = { uid: admin, at: Date.now() };
    db.docs['managers/' + admin] = { name: 'วินนี่ (Admin)', role: 'admin', depots: [] };
    db.docs['config/app'] = { staffVer: '', managerVer: '', cut: '07:00', grace: '07:10', keepDays: 30 };
    /* upc = UPC ผู้ดูแลสาขา • cut = เวลาเข้างานของสาขา (วินาที) • staff = ชื่อผู้บันทึก */
    const W = 'K.Wanchai Prukrunggroj';
    const NE3 = ['K.Aummarin Auppakarat', 'K.Sant Pimma', 'K.Suphasil Nanthong'];
    const depots = [
      { code: 'CNX1', name: 'เชียงใหม่ 1', region: 'เหนือ', province: 'เชียงใหม่', pin: '111111', upc: ['K.Khanaphot Chaiwong', 'K.Piyaphan Chosinmingson'] },
      { code: 'CNX2', name: 'เชียงใหม่ 2', region: 'เหนือ', province: 'เชียงใหม่', pin: '222222', upc: ['K.Khanaphot Chaiwong', 'K.Piyaphan Chosinmingson'] },
      { code: 'LPG1', name: 'ลำปาง', region: 'เหนือ', province: 'ลำปาง', pin: '333333', upc: ['K.Khanaphot Chaiwong', 'K.Piyaphan Chosinmingson'] },
      { code: 'KKN1', name: 'ขอนแก่น', region: 'อีสาน', province: 'ขอนแก่น', pin: '444444', upc: NE3 },
      { code: 'AYA1', name: 'อยุธยา', region: 'กลาง', province: 'พระนครศรีอยุธยา', pin: '555555', upc: ['K.Kobkiat Doungthong', 'K.Prasitchai Krobsuan'] },
      { code: 'CBI1', name: 'ชลบุรี', region: 'ตะวันออก', province: 'ชลบุรี', pin: '666666', upc: ['K.Phongthep Sendi', 'K.Suttipong Kongchiyapoom'] },
      { code: 'HDY1', name: 'หาดใหญ่', region: 'ใต้', province: 'สงขลา', pin: '777777', upc: ['K.Kittisak Chanakul', 'K.Srichon Chaiyasad'] },
      { code: 'UDN1', name: 'อุดรธานี', region: 'อีสาน', province: 'อุดรธานี', pin: '888888', upc: NE3 },
      /* สาขาของ K.Wanchai (ข้อมูลจริงจากตาราง) */
      { code: 'BRM', name: 'BRM', region: 'อีสาน', province: '', pin: '210001', upc: [W], staff: ['K.Pongsak Kodram', 'K.Atitiya Inta'] },
      { code: 'CCI', name: 'CCI', region: 'อีสาน', province: '', pin: '210002', upc: [W], staff: ['K.Oakkharachai Sroising', 'K.Anan Saenwanna'] },
      { code: 'NMA', name: 'NMA', region: 'อีสาน', province: '', pin: '210003', upc: [W], staff: ['K.Sarawut Siripru', 'K.Sarawut Suraphopphisit', 'K.Ratchadakorn Vittayaphonpipat'] },
      { code: 'NRG', name: 'NRG', region: 'อีสาน', province: '', pin: '210004', upc: [W], staff: ['K.Pakasupang Suksawang', 'K.Chalitta Chaengprachak'] },
      { code: 'PCG', name: 'PCG', region: 'อีสาน', province: '', pin: '210005', upc: [W], staff: ['K.Thanyaporn Yotkhwan'] },
      { code: 'SNN', name: 'SNN', region: 'อีสาน', province: '', pin: '210006', upc: [W], staff: ['K.Chainarong Janpotia', 'K.Jutamas Ratsungnoen'] },
      { code: 'SRN', name: 'SRN', region: 'อีสาน', province: '', pin: '210007', upc: [W], staff: ['K.Jatuporn Kertsup', 'K.Kornkrit Tantiworasri'], cut: 27000 },
      { code: 'TLK', name: 'TLK', region: 'อีสาน', province: '', pin: '210008', upc: [W], staff: ['K.Piyawat Phonkong', 'K.Natthakran Jaroenram'] }
    ];
    const vendors = ['เวนเดอร์ A', 'เวนเดอร์ B', 'เวนเดอร์ C'];
    const first = ['สมชาย', 'สมศักดิ์', 'วิชัย', 'ประเสริฐ', 'อนุชา', 'ธนพล', 'กิตติ', 'สุรชัย', 'ชัยวัฒน์', 'ณัฐพล', 'ปิยะ', 'เอกชัย', 'วีระ', 'ศักดิ์ดา'];
    const pub = {};
    depots.forEach((d, di) => {
      const uidD = addUser(depotEmail(d.code, 1), d.pin);
      const cut = d.cut || CUT;
      pub[d.code] = { ver: 1, name: d.name };
      const staff = d.staff || ['หัวหน้า ' + d.code, 'ผู้ช่วย ' + d.code];
      const roster = [];
      const n = 8 + (di * 3) % 9;
      for (let i = 1; i <= n; i++) roster.push({ id: i, code: d.code + 'C' + String(i).padStart(2, '0'), name: first[(i + di) % first.length] + ' ' + d.code + i, vendor: vendors[(i + di) % 3], type: i % 5 === 0 ? '4W' : '2W', active: true });
      db.docs['depots/' + d.code] = { code: d.code, name: d.name, region: d.region, province: d.province, cut, upc: d.upc || [], authUid: uidD, authVer: 1, roster, createdAt: Date.now() };
      for (let k = 1; k <= 24; k++) {
        const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - k);
        if (dt.getDay() === 0) continue;
        const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        const ck = {}, ab = {};
        roster.forEach((c, i) => {
          const r = (k * 31 + i * 17 + di * 7) % 100;
          if (r < 5) { ab[c.id] = { note: 'ลาป่วย', by: staff[0], at: dt.getTime() + 6 * 3600e3 }; return; }
          const lateBias = di === 3 ? 45 : (di % 4 === 0 ? 8 : 20);
          const mins = r < lateBias ? 3 + ((k * 7 + i * 3) % 40) : -(2 + ((k + i) % 25));
          const t = dt.getTime() + cut * 1000 + mins * 60e3 + ((i * 13) % 60) * 1000;
          const skew = (di === 3 && i === 2 && k % 3 === 0) ? 18 * 60e3 : 800;
          ck[c.id] = { ts: t, srv: t + skew, cut, ...calcStatus(t, cut), staff: staff[i % staff.length], hasPhoto: true, demoPhoto: true };
        });
        db.docs['depots/' + d.code + '/days/' + key] = { date: key, depot: d.code, checkins: ck, absent: ab };
      }
      db.docs['pubstaff/' + d.code] = { names: staff };
    });
    db.docs['pub/depots'] = pub;
    /* UPC Manager แต่ละภาค (รายชื่อจริง — PIN ในโหมดทดลองเท่านั้น) */
    const UPC = [
      ['K.Kobkiat Doungthong','กลาง','110001'], ['K.Prasitchai Krobsuan','กลาง','110002'],
      ['K.Phongthep Sendi','ตะวันออก','120001'], ['K.Suttipong Kongchiyapoom','ตะวันออก','120002'],
      ['K.Khanaphot Chaiwong','เหนือ','130001'], ['K.Piyaphan Chosinmingson','เหนือ','130002'],
      ['K.Aummarin Auppakarat','อีสาน','140001'], ['K.Sant Pimma','อีสาน','140002'], ['K.Suphasil Nanthong','อีสาน','140003'], ['K.Wanchai Prukrunggroj','อีสาน','140004'],
      ['K.Kittisak Chanakul','ใต้','150001'], ['K.Srichon Chaiyasad','ใต้','150002']
    ];
    UPC.forEach(([name, region, pin]) => {
      const id = addUser(mgrEmail(pin), mgrPw(pin));
      db.docs['managers/' + id] = { name, role: 'upc', region, depots: depots.filter(d => (d.upc || []).includes(name)).map(d => d.code) };
    });
    return db;
  }
}

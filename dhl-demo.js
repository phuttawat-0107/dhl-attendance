/* ============================================================
   dhl-demo.js — โหมดทดลองของแอป Staff ระบบเดิม   · 1 ต.ค. 2569
   เปิดด้วย  DHL_Courier_Attendance.html?demo=1   (ลิงก์ปกติไม่โหลดไฟล์นี้เลย)
   • ไม่เชื่อม Firebase / ไม่ซิงค์ / ไม่มี PIN — ข้อมูลอยู่ในเครื่องแยกจากข้อมูลจริง (คีย์ขึ้นต้น demo_)
   • ใช้โค้ดจริงของแอปเดิม + หน้าใหม่ (dhl-ui2) + เสียง/Pop Up (dhl-ux) ทั้งหมด
   • ตัวเลือก:  &t=06:50  = ตั้งนาฬิกาจำลอง  ·  &reset=1 = ล้างข้อมูลทดลองเริ่มใหม่  ·  &fakecam=1 = ใช้กล้องจำลอง
   ============================================================ */
(function(){
'use strict';
const Q = new URLSearchParams(location.search);
if (!Q.has('demo')) return;
window.DHL_DEMO = true;
const pad = n => String(n).padStart(2,'0');

/* ---------- 1) แยกที่เก็บข้อมูล: localStorage + IndexedDB ขึ้นต้น demo_ ---------- */
const SP = Storage.prototype, gi = SP.getItem, si = SP.setItem, ri = SP.removeItem;
const K = k => (typeof k === 'string' && k.indexOf('demo_') !== 0) ? 'demo_' + k : k;
SP.getItem = function(k){ return gi.call(this, K(k)); };
SP.setItem = function(k, v){ return si.call(this, K(k), v); };
SP.removeItem = function(k){ return ri.call(this, K(k)); };
const DBN = 'demo_dhl_attendance', idbOpen = indexedDB.open.bind(indexedDB);
indexedDB.open = (n, v) => idbOpen(n === 'dhl_attendance' ? DBN : n, v);

if (Q.has('reset')){
  try { Object.keys(localStorage).filter(k => k.indexOf('demo_') === 0).forEach(k => ri.call(localStorage, k)); } catch(e){}
  try { indexedDB.deleteDatabase(DBN); } catch(e){}
}

/* ---------- 2) นาฬิกาจำลอง (&t=HH:MM) ---------- */
const tm = /^(\d{1,2}):(\d{2})$/.exec(Q.get('t') || '');
if (tm){
  const RD = Date, base = new RD(); base.setHours(+tm[1], +tm[2], 0, 0);
  const OFF = base.getTime() - RD.now();
  const FD = function(...a){ if (!(this instanceof FD)) return new RD(RD.now() + OFF).toString(); return a.length ? new RD(...a) : new RD(RD.now() + OFF); };
  FD.prototype = RD.prototype; FD.now = () => RD.now() + OFF; FD.parse = RD.parse; FD.UTC = RD.UTC;
  window.Date = FD;
}

/* ---------- 3) ข้อมูลตั้งต้น: สาขา TEST + Courier ตัวอย่าง 8 คน ---------- */
if (!localStorage.getItem('dhl_settings')) localStorage.setItem('dhl_settings', JSON.stringify({ depot:'TEST', staff:'ทดลอง (Demo)' }));
if (!localStorage.getItem('dhl_couriers') || localStorage.getItem('dhl_couriers') === '[]'){
  const N = [['TSTT01','สมชาย ใจดี','2W','Vendor A'],['TSTT02','สมศรี มีสุข','2W','Vendor A'],['TSTT03','ประยุทธ ขยันดี','4W','Vendor B'],['TSTT04','วิภา รักงาน','2W','Vendor B'],
             ['TSTT05','ธนพล ตรงเวลา','4W','Vendor C'],['TSTT06','อรุณ สายบ่อย','2W','Vendor C'],['TSTT07','กมล ส่งไว','2W','Vendor A'],['TSTT08','ชัยวัฒน์ มั่นคง','4W','Vendor B']];
  localStorage.setItem('dhl_couriers', JSON.stringify(N.map((x,i) => ({ id:9001+i, code:x[0], name:x[1], type:x[2], vendor:x[3], active:true }))));
}

/* ---------- 4) แทนระบบซิงค์ (ไม่ต่อ Firebase) — ให้หน้าใหม่/ขาด-ลา ทำงานได้ ---------- */
const dkey = () => { const d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
const absLoad = () => { try { return JSON.parse(localStorage.getItem('abs_'+dkey()) || '{}'); } catch(e){ return {}; } };
window.DHLSync = { ready:true, demo:true, depot:'TEST', staff:'ทดลอง (Demo)', get absent(){ return absLoad(); } };
window.dsRemovedIds = () => []; window.dsPhotoQueue = () => 0;
window.dsAbsOpen = (cid, name, code) => {
  const t = prompt('🟣 บันทึก '+name+' ('+code+') เป็น:\n1 = ลากิจ\n2 = ลาป่วย\n3 = ขาดงาน', '1'); if (t == null) return;
  const L = { '1':'ลากิจ', '2':'ลาป่วย', '3':'ขาดงาน' }[String(t).trim()]; if (!L) return;
  const a = absLoad(); a[String(cid)] = { label:L, ts:Date.now() }; localStorage.setItem('abs_'+dkey(), JSON.stringify(a)); try { (0,eval)('renderCheckin')(); } catch(e){} };
window.dsAbsClear = cid => { const a = absLoad(); delete a[String(cid)]; localStorage.setItem('abs_'+dkey(), JSON.stringify(a)); try { (0,eval)('renderCheckin')(); } catch(e){} };

/* ---------- 5) กล้องจำลอง (ใช้เมื่อไม่มีกล้อง หรือ &fakecam=1) ---------- */
function fakeStream(){
  const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'); let f = 0;
  const draw = () => { f++; const g = x.createLinearGradient(0,0,0,480); g.addColorStop(0,'#FFCC00'); g.addColorStop(1,'#D40511'); x.fillStyle = g; x.fillRect(0,0,640,480);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(320,170,70,0,7); x.fill(); x.fillRect(215,255,210,200);
    x.fillStyle = '#1a1a1a'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('DEMO CAMERA', 320, 60);
    const d = new Date(); x.font = 'bold 26px sans-serif'; x.fillText(pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()), 320, 470 - (f % 2)); };
  draw(); const iv = setInterval(draw, 200);
  const s = c.captureStream(10); s.getTracks().forEach(t => { const st = t.stop.bind(t); t.stop = () => { clearInterval(iv); st(); }; }); return s; }
if (navigator.mediaDevices){
  const real = navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;
  navigator.mediaDevices.getUserMedia = async (c) => {
    if (Q.has('fakecam') || !real) return fakeStream();
    try { return await Promise.race([real(c), new Promise((_,rj) => setTimeout(() => rj(new Error('timeout')), 4000))]); } catch(e){ return fakeStream(); } };
}

/* ---------- 6) ประวัติย้อนหลัง 6 วันทำงาน (ให้ อินไซต์ / Risk / กราฟ 7 วัน มีข้อมูล) ---------- */
async function seedHistory(){
  for (let i = 0; i < 100 && !(typeof getByDate === 'function' && (0,eval)('db')); i++) await new Promise(r => setTimeout(r, 100));
  if (typeof getByDate !== 'function') return;
  if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const cs = JSON.parse(localStorage.getItem('dhl_couriers') || '[]'); let d = new Date(), n = 0;
  while (n < 6){ d.setDate(d.getDate()-1); if (d.getDay() === 0) continue; n++;
    const k = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    for (let j = 0; j < cs.length; j++){ const c = cs[j]; const late = (c.code === 'TSTT06' && n <= 4) || (j === (n % 5) && n % 2 === 0);
      const t = new Date(d); t.setHours(6, 25 + ((j*7 + n*3) % 30), (j*13) % 60, 0); if (late) t.setHours(7, 12 + (j+n) % 20);
      try { await putCheckin({ courierId:c.id, date:k, ts:t.getTime(), status: late ? 'late' : 'ontime', buffer:false, photo:null, uniform:true, manualEdit:false, staff:'ทดลอง (Demo)' }); } catch(e){} }
    const b = new Date(d), at = (h,m) => { const x = new Date(b); x.setHours(h,m,0,0); return x.getTime(); }, rp = {};
    cs.forEach((c,j) => { rp[c.id] = { fs:at(7,35+j%10), dep:at(8,5+(j*3+n)%25), fdel:at(8,35+(j*4+n)%25) }; });
    try { await putPPH({ date:k, staffN:2, sorterN:1, courierN:cs.length, pNew:1400+n*37, pOld:120, inboundTs:at(6,40), lastInboundTs:at(7,20), pd:{ ts:at(7,3+n%12) }, rp }); } catch(e){}
  }
  try { (0,eval)('renderCheckin')(); } catch(e){}
}

/* ---------- 7) แถบบอกว่าอยู่โหมดทดลอง ---------- */
function banner(){
  const b = document.createElement('div');
  b.style.cssText = 'background:repeating-linear-gradient(45deg,#1a1a1a,#1a1a1a 10px,#2b2b2b 10px,#2b2b2b 20px);color:#FFCC00;font:700 12.5px/1.3 sans-serif;padding:6px 10px;display:flex;gap:8px;align-items:center;justify-content:space-between';
  b.innerHTML = '<span>🧪 โหมดทดลอง — ไม่ส่งข้อมูลขึ้นระบบจริง'+(tm?' · นาฬิกาจำลอง':'')+'</span><a href="?demo=1&reset=1" style="color:#fff;text-decoration:underline;white-space:nowrap">↺ เริ่มใหม่</a>';
  document.body.insertBefore(b, document.body.firstChild);
  if (Q.has('reset')) history.replaceState(null, '', location.pathname + '?demo=1' + (tm ? '&t='+Q.get('t') : '') + (Q.has('fakecam') ? '&fakecam=1' : ''));
}
document.addEventListener('DOMContentLoaded', () => { banner(); seedHistory(); });
})();

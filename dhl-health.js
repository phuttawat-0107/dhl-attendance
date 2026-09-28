/* dhl-health.js — สุขภาพระบบ + บังคับอัปเดตแอป Staff (ใช้ใน DHL_Manager_Live → ⚙️)
   • อ่านอย่างเดียว ยกเว้นปุ่ม "บังคับอัปเดต" ที่เขียน config/app.staffVer
   • staffVer ที่บังคับ = SYNC_VER ของ dhl-sync.js ที่ขึ้นเว็บจริง (อ่านจากไฟล์) → ไม่มีทางวนรีโหลด */
import { getApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, limit, getCountFromServer }
  from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const LIMIT_MB = 1024;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bar = (p) => { const c = p >= 75 ? '#D40511' : p >= 50 ? '#e0a800' : '#2e9e57';
  return '<div style="height:8px;background:#eee;border-radius:5px;overflow:hidden;margin:5px 0 3px"><div style="height:100%;width:' + Math.min(100, p) + '%;background:' + c + '"></div></div>'; };

async function liveSyncVer() {
  const t = await fetch('dhl-sync.js?x=' + Date.now(), { cache: 'no-store' }).then(r => r.text());
  const m = t.match(/const\s+SYNC_VER\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

window.__sysBox = async (DEPOTS) => {
  const el = document.getElementById('sysBox'); if (!el) return;
  const db = getFirestore(getApp());
  el.innerHTML = '<div class="small" style="margin:6px 0 14px">🛡️ กำลังตรวจสุขภาพระบบ…</div>';
  let html = '';
  /* ---------- เวอร์ชันแอป Staff ---------- */
  try {
    const [cfg, live] = await Promise.all([getDoc(doc(db, 'config', 'app')), liveSyncVer()]);
    const want = cfg.exists() ? String(cfg.data().staffVer || '') : '';
    const same = live && want === live;
    html += '<div style="font-weight:800;font-size:13.5px;margin:4px 0 7px">🔄 เวอร์ชันแอป Staff</div>'
      + '<div class="small" style="margin-bottom:8px">เวอร์ชันล่าสุดบนเว็บ: <b>' + esc(live || '—') + '</b> • ที่บังคับใช้อยู่: <b>' + esc(want || '—') + '</b></div>'
      + (same ? '<div class="small" style="color:#2e7d32;font-weight:700;margin-bottom:14px">✓ ทุกเครื่องใช้เวอร์ชันล่าสุดแล้ว</div>'
        : (live ? '<button class="btn btn-y btn-block" id="sysForce" style="margin-bottom:14px">🔄 บังคับทุกเครื่อง Staff อัปเดตเป็น ' + esc(live) + '</button>' : ''));
    window.__sysForceVer = live;
  } catch (e) { html += '<div class="small" style="margin-bottom:14px">ตรวจเวอร์ชันไม่ได้ — ' + esc(e.code || e.message) + '</div>'; }

  /* ---------- พื้นที่เก็บข้อมูล (รูปถ่าย) ---------- */
  try {
    const per = {};
    await Promise.all((DEPOTS || []).map(async d => {
      try { per[d] = (await getCountFromServer(collection(db, 'depots', d, 'photos'))).data().count; } catch (e) { per[d] = null; }
    }));
    const total = Object.values(per).reduce((a, b) => a + (b || 0), 0);
    let avg = 90000;
    const big = Object.keys(per).sort((a, b) => (per[b] || 0) - (per[a] || 0))[0];
    if (big && per[big]) {
      try { const s = await getDocs(query(collection(db, 'depots', big, 'photos'), limit(5)));
        const L = s.docs.map(x => String((x.data() || {}).d || '').length).filter(Boolean); if (L.length) avg = L.reduce((a, b) => a + b, 0) / L.length; } catch (e) {}
    }
    const mb = total * (avg + 800) * 1.15 / 1048576 + (DEPOTS || []).length * 0.5;
    const pct = Math.round(mb / LIMIT_MB * 100);
    html += '<div style="font-weight:800;font-size:13.5px;margin:4px 0 4px">🛡️ พื้นที่เก็บข้อมูล (ประมาณ)</div>'
      + '<div class="small">' + Math.round(mb) + ' / ' + LIMIT_MB + ' MB (' + pct + '%) • รูป ' + total.toLocaleString() + ' ใบ • เฉลี่ย ' + Math.round(avg / 1024) + ' KB/รูป • เฉพาะสาขาในทีมนี้</div>'
      + bar(pct)
      + '<div class="small" style="color:' + (pct >= 75 ? '#D40511' : pct >= 50 ? '#8a6100' : '#2e7d32') + ';font-weight:700;margin-bottom:6px">'
      + (pct >= 75 ? '🚨 ใกล้เต็ม — ควรอัปเกรด Firebase เป็น Blaze' : pct >= 50 ? '⚠️ เกินครึ่ง — เริ่มวางแผนอัปเกรด' : '✓ ปกติ') + '</div>'
      + '<div class="small" style="margin-bottom:14px">' + (DEPOTS || []).map(d => esc(d) + ' ' + (per[d] == null ? '—' : per[d])).join(' • ') + '</div>';
  } catch (e) { html += '<div class="small" style="margin-bottom:14px">ตรวจพื้นที่ไม่ได้ — ' + esc(e.code || e.message) + '</div>'; }

  el.innerHTML = html;
  const b = document.getElementById('sysForce');
  if (b) b.onclick = async () => {
    const v = window.__sysForceVer; if (!v) return;
    if (!confirm('บังคับทุกเครื่อง Staff อัปเดตเป็น ' + v + ' ?\nเครื่องที่เปิดแอปอยู่จะรีโหลดเองภายใน 1 นาที (ข้อมูลไม่หาย)')) return;
    b.disabled = true;
    try { await setDoc(doc(db, 'config', 'app'), { staffVer: v }, { merge: true }); b.textContent = '✓ ตั้งค่าแล้ว — ทุกเครื่องจะอัปเดตภายใน 1 นาที'; }
    catch (e) { b.disabled = false; alert('ตั้งค่าไม่สำเร็จ: ' + (e.code || e.message)); }
  };
};

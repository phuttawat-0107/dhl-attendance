/* upc-report.js — รายงานประจำวันของสาขา (UPC) → ภาพเดียว ส่งผู้บังคับบัญชา
   อ้างอิงรูปแบบ Report 1 ของระบบเดิม (DHL_Courier_Attendance.html)
   ⭐ ภาพถ่ายคือหัวใจของรายงาน — ใช้รูปต้นฉบับ 640px วาดบนผืนภาพความละเอียด 2 เท่า ให้คมชัดที่สุด
   จำนวนรูปต่อแถวปรับตามจำนวนพนักงาน: ≤6 คน = 3 · ≤16 = 4 · ≤30 = 5 · มากกว่า = 6  */
export const REPORT_VER = 1;

const W = 1080, P = 40, SCALE = 2;
const C = { y: '#FFCC00', r: '#D40511', k: '#1a1a1a', g: '#2e7d32', gbg: '#f2fbf6', rbg: '#fff5f5', mute: '#777', line: '#eee', am: '#b7791f', ambg: '#fff8e6' };

function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
function trunc(x, t, max) { t = String(t || ''); if (x.measureText(t).width <= max) return t; while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
const loadImg = src => new Promise(ok => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const colsFor = n => n <= 6 ? 3 : n <= 16 ? 4 : n <= 30 ? 5 : 6;
const isSun = k => new Date(k + 'T00:00:00').getDay() === 0;
const addDays = (k, n, ymd) => { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };

/* ---------- เก็บข้อมูล ---------- */
async function collect(ctx) {
  const { fb, code, key, roster, ymd } = ctx;
  const act = roster.filter(c => c.active !== false);
  const byId = id => roster.find(c => String(c.id) === String(id));
  const day = (await fb.get(`depots/${code}/days/${key}`)) || {};
  const ck = day.checkins || {}, ab = day.absent || {};
  const recs = Object.keys(ck).filter(id => ck[id] && ck[id].ts).map(id => ({ id, ...ck[id], c: byId(id) || { code: '#' + id, name: '(ไม่อยู่ในรายชื่อ)' } })).sort((a, b) => a.ts - b.ts);
  const absent = Object.keys(ab).map(id => ({ id, note: (ab[id] && ab[id].note) || 'ขาด', c: byId(id) || { code: '#' + id, name: '' } }));
  const none = act.filter(c => !ck[c.id] && !ab[c.id]);
  const late = recs.filter(r => r.status === 'late').length, on = recs.length - late;
  /* ย้อนหลัง 7 วันทำงาน (ไม่นับอาทิตย์) — ใช้ทำกราฟและ Risk Alert */
  const days = []; let k = key, guard = 0;
  while (days.length < 7 && guard++ < 12) { if (!isSun(k)) days.unshift(k); k = addDays(k, -1, ymd); }
  const hist = await Promise.all(days.map(async d => d === key ? day : ((await fb.get(`depots/${code}/days/${d}`).catch(() => null)) || {})));
  const trend = days.map((d, i) => { const c2 = hist[i].checkins || {}, ids = Object.keys(c2).filter(x => c2[x] && c2[x].ts), l = ids.filter(x => c2[x].status === 'late').length; return { d, n: ids.length, pct: ids.length ? Math.round((ids.length - l) / ids.length * 100) : null }; });
  const lateCnt = {}; hist.forEach(h => { const c2 = h.checkins || {}; Object.keys(c2).forEach(x => { if (c2[x] && c2[x].status === 'late') lateCnt[x] = (lateCnt[x] || 0) + 1; }); });
  const risk = Object.keys(lateCnt).filter(x => lateCnt[x] >= 2).map(x => ({ c: byId(x) || { code: '#' + x, name: '' }, n: lateCnt[x] })).sort((a, b) => b.n - a.n);
  /* รูปถ่าย (ต้นฉบับ 640px) */
  const imgs = await Promise.all(recs.map(async r => { try { const p = await fb.get(`depots/${code}/photos/ci_${r.id}_${key}`); return await loadImg(p && p.d); } catch (e) { return null; } }));
  return { recs, imgs, absent, none, late, on, need: act.length - absent.length, act: act.length, trend, risk };
}

/* ---------- วาดรายงาน ---------- */
export async function drawReport(ctx) {
  const { code, key, dep, staff, thDate, fmtTime, hmCut, cutOf } = ctx;
  const S = await collect(ctx);
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const F = (w, s) => w + ' ' + s + 'px ' + font;
  const n = S.recs.length, COLS = colsFor(n), GAP = 14, CELL = (W - P * 2 - (COLS - 1) * GAP) / COLS, CAP = 58, CELLH = CELL + CAP;
  const rows = Math.ceil(n / COLS);
  const riskH = S.risk.length ? 70 + S.risk.length * 32 : 80;
  const listN = S.absent.length + S.none.length;
  const listH = listN ? 70 + Math.ceil(listN / 2) * 34 : 0;
  const gridH = n ? 70 + rows * (CELLH + 16) : 110;
  const H = 180 + 150 + 300 + riskH + gridH + listH + 70;
  const cv = document.createElement('canvas'); cv.width = W * SCALE; cv.height = H * SCALE;
  const x = cv.getContext('2d'); x.scale(SCALE, SCALE); x.imageSmoothingQuality = 'high';
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);

  /* หัวรายงาน */
  x.fillStyle = C.y; x.fillRect(0, 0, W, 16);
  const logo = await loadImg('logo.webp');
  if (logo) { const lh = 64, lw = logo.width * lh / logo.height; x.drawImage(logo, P, 40, lw, lh); var bx = P + lw + 16; } else var bx = P;
  x.font = F('800', 30); const bw = x.measureText(code).width + 36;
  x.fillStyle = C.k; rr(x, bx, 46, bw, 52, 14); x.fill(); x.fillStyle = C.y; x.textBaseline = 'middle'; x.fillText(code, bx + 18, 73); x.textBaseline = 'alphabetic';
  x.textAlign = 'right'; x.fillStyle = C.k; x.font = F('700', 30); x.fillText('Courier Attendance Report', W - P, 62);
  x.font = F('400', 21); x.fillStyle = '#555';
  x.fillText(thDate(key) + '  •  เวลาเข้างาน ' + hmCut(cutOf(dep)) + ' น.' + (isSun(key) ? '  •  วันอาทิตย์' : ''), W - P, 96);
  x.font = F('400', 17); x.fillStyle = C.mute; x.fillText('ผู้บันทึก: ' + (staff || '-'), W - P, 124);
  x.textAlign = 'left'; x.strokeStyle = C.line; x.lineWidth = 2; x.beginPath(); x.moveTo(P, 146); x.lineTo(W - P, 146); x.stroke();

  /* KPI */
  const pct = v => S.recs.length ? Math.round(v / S.recs.length * 100) : 0;
  const kY = 166, kW = (W - P * 2 - 3 * 16) / 4;
  [{ l: 'Check-in', v: n + ' / ' + S.need, c: C.k, bg: '#f7f7f7' },
   { l: 'Ontime', v: S.on + '  (' + pct(S.on) + '%)', c: C.g, bg: C.gbg },
   { l: 'Late', v: S.late + '  (' + pct(S.late) + '%)', c: C.r, bg: C.rbg },
   { l: 'ขาด/ลา • ยังไม่ลง', v: S.absent.length + ' • ' + S.none.length, c: C.am, bg: C.ambg }].forEach((k, i) => {
    const kx = P + i * (kW + 16);
    x.fillStyle = k.bg; rr(x, kx, kY, kW, 110, 14); x.fill();
    x.fillStyle = k.c; rr(x, kx, kY, 10, 110, 5); x.fill();
    x.font = F('800', 40); x.fillStyle = k.c; x.fillText(trunc(x, k.v, kW - 36), kx + 26, kY + 58);
    x.font = F('700', 19); x.fillStyle = C.mute; x.fillText(k.l, kx + 26, kY + 92);
  });

  /* กราฟ On-time 7 วันทำงาน */
  let y = kY + 150;
  x.fillStyle = C.k; x.font = F('700', 25); x.fillText('Ontime % — 7 วันทำงานล่าสุด', P, y);
  const gx0 = P + 10, gy0 = y + 30, gw = W - P * 2 - 20, gh = 200, bwid = gw / 7;
  x.strokeStyle = '#f0f0f0'; x.lineWidth = 1; [0, 50, 100].forEach(v => { const yy = gy0 + gh - v / 100 * gh; x.beginPath(); x.moveTo(gx0, yy); x.lineTo(gx0 + gw, yy); x.stroke(); });
  S.trend.forEach((t, i) => {
    const bxx = gx0 + i * bwid + bwid * 0.2, bww = bwid * 0.6, v = t.pct;
    if (v != null) { const hh = Math.max(4, v / 100 * gh); x.fillStyle = t.d === key ? (v >= 95 ? C.g : C.r) : (v >= 95 ? '#9fd3ae' : '#f1a3a8'); rr(x, bxx, gy0 + gh - hh, bww, hh, 8); x.fill();
      x.fillStyle = C.k; x.font = F('700', 18); x.textAlign = 'center'; x.fillText(v + '%', bxx + bww / 2, gy0 + gh - hh - 8); }
    else { x.fillStyle = '#ccc'; x.font = F('400', 15); x.textAlign = 'center'; x.fillText('—', bxx + bww / 2, gy0 + gh - 8); }
    x.fillStyle = t.d === key ? C.k : C.mute; x.font = F(t.d === key ? '700' : '400', 15);
    const [, m, d] = t.d.split('-'); x.fillText(+d + '/' + +m, bxx + bww / 2, gy0 + gh + 24); x.textAlign = 'left';
  });
  y = gy0 + gh + 60;

  /* Risk Alert */
  x.fillStyle = C.k; x.font = F('700', 25); x.fillText('⚠ Risk Alert — สายตั้งแต่ 2 ครั้งใน 7 วันทำงาน', P, y);
  if (S.risk.length) {
    S.risk.forEach((r2, i) => { const yy = y + 40 + i * 32; x.fillStyle = r2.n >= 3 ? C.r : C.am; x.font = F('700', 19);
      x.fillText((r2.n >= 3 ? '● RISK  ' : '● WATCH  ') + r2.c.code + '  ' + r2.c.name + (r2.c.vendor ? '  (' + r2.c.vendor + ')' : '') + '  — สาย ' + r2.n + ' ครั้ง', P + 10, yy); });
    y += riskH;
  } else { x.fillStyle = C.g; x.font = F('400', 20); x.fillText('✓ ไม่มีพนักงานเสี่ยง', P + 10, y + 40); y += riskH; }

  /* รูปเช็คอิน — หัวใจของรายงาน */
  x.fillStyle = C.k; x.font = F('700', 26); x.fillText('📸 Check-in Photos (' + n + ')', P, y);
  x.font = F('400', 16); x.fillStyle = C.mute; x.textAlign = 'right'; x.fillText('เรียงตามเวลาเช็คอิน • แถบเขียว = ทัน • แถบแดง = สาย', W - P, y); x.textAlign = 'left';
  let gy = y + 22;
  if (!n) { x.fillStyle = '#bbb'; x.font = F('400', 22); x.fillText('ยังไม่มีการเช็คอิน', P + 10, gy + 50); }
  S.recs.forEach((r, i) => {
    const col = i % COLS, row = Math.floor(i / COLS), cx = P + col * (CELL + GAP), cy = gy + row * (CELLH + 16);
    x.fillStyle = '#f2f2f2'; rr(x, cx, cy, CELL, CELL, 12); x.fill();
    const im = S.imgs[i];
    if (im) { x.save(); rr(x, cx, cy, CELL, CELL, 12); x.clip(); const sc = Math.max(CELL / im.width, CELL / im.height);
      x.drawImage(im, cx + (CELL - im.width * sc) / 2, cy + (CELL - im.height * sc) / 2, im.width * sc, im.height * sc); x.restore(); }
    else { x.fillStyle = '#aaa'; x.font = F('400', 15); x.textAlign = 'center'; x.fillText('ไม่มีรูป', cx + CELL / 2, cy + CELL / 2); x.textAlign = 'left'; }
    const ok = r.status !== 'late', cc = ok ? C.g : C.r;
    x.fillStyle = cc; rr(x, cx, cy + CELL + 6, 6, CAP - 12, 3); x.fill();
    x.fillStyle = C.k; x.font = F('700', COLS >= 6 ? 13 : 16); x.fillText(trunc(x, r.c.name, CELL - 18), cx + 14, cy + CELL + 25);
    x.fillStyle = cc; x.font = F('700', COLS >= 6 ? 12 : 15);
    x.fillText(trunc(x, r.c.code + '  ' + fmtTime(r.ts) + (ok ? '  ✔' : '  Late'), CELL - 18), cx + 14, cy + CELL + 46);
  });
  y = gy + (n ? rows * (CELLH + 16) + 40 : 110);

  /* ขาด/ลา + ยังไม่ลงเวลา */
  if (listN) {
    x.fillStyle = C.k; x.font = F('700', 25); x.fillText('ขาด / ลา ' + S.absent.length + ' คน  •  ยังไม่ลงเวลา ' + S.none.length + ' คน', P, y);
    const items = S.absent.map(a => ({ t: a.c.code + '  ' + a.c.name + '  — ' + a.note, c: C.am })).concat(S.none.map(c => ({ t: c.code + '  ' + c.name + '  — ยังไม่ลงเวลา', c: C.r })));
    const cw = (W - P * 2) / 2;
    items.forEach((it, i) => { const cx = P + 10 + (i % 2) * cw, yy = y + 40 + Math.floor(i / 2) * 34; x.fillStyle = it.c; x.font = F('400', 18); x.fillText(trunc(x, '• ' + it.t, cw - 20), cx, yy); });
    y += listH;
  }

  /* ท้ายรายงาน */
  x.fillStyle = C.y; x.fillRect(0, H - 10, W, 10);
  x.font = F('400', 15); x.fillStyle = '#999'; x.textAlign = 'center';
  x.fillText('Generated by DHL eCommerce UPC Attendance • ' + new Date().toLocaleString('th-TH'), W / 2, H - 26); x.textAlign = 'left';
  return cv;
}

/* ---------- หน้าต่างรายงาน + แชร์ ---------- */
export async function openReport(ctx) {
  const { code, key, sheet, flash, thDate } = ctx;
  flash('กำลังสร้างรายงาน…');
  let cv; try { cv = await drawReport(ctx); } catch (e) { console.warn(e); flash('สร้างรายงานไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่'); return; }
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.92));
  const name = code + '_Report_' + key + '.jpg', url = URL.createObjectURL(blob);
  const file = new File([blob], name, { type: 'image/jpeg' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  sheet('<h2>📄 รายงาน ' + thDate(key) + ' — ' + code + '</h2>'
    + '<div class="small" style="margin-bottom:8px">ตรวจความเรียบร้อยของรูปก่อนส่ง · แตะรูปเพื่อขยาย</div>'
    + '<a href="' + url + '" target="_blank"><img src="' + url + '" style="width:100%;border-radius:10px;border:1px solid #eee"></a>'
    + '<div style="height:10px"></div>'
    + (canShare ? '<button class="btn btn-r btn-block" id="repShare">📤 ส่งรายงาน (LINE / อีเมล)</button><div style="height:8px"></div>' : '')
    + '<button class="btn btn-y btn-block" id="repDl">⬇ บันทึกรูปรายงาน</button><div style="height:8px"></div>'
    + '<button class="btn btn-o btn-block" onclick="closeSheet()">ปิด</button>');
  document.getElementById('repDl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); flash('✔ บันทึกรูปรายงานแล้ว'); };
  const sh = document.getElementById('repShare');
  if (sh) sh.onclick = async () => { try { await navigator.share({ files: [file], title: 'รายงานลงเวลา ' + code + ' ' + thDate(key) }); } catch (e) { if (e.name !== 'AbortError') flash('แชร์ไม่ได้ — ใช้ปุ่มบันทึกรูปแทน'); } };
}

/* ใช้ร่วมกันทั้งในแล็บทดสอบและตอนอัปโหลดจริง — แก้ไฟล์จริงแบบแทนข้อความ (ต้องเจอครบตามจำนวน ไม่งั้นหยุด) */
window.__PATCHES = {
  'dhl-ui2.js': [
    ["const UI2 = ['TEST'];", "const UI2 = /[?&]ui2=1/.test(location.search) ? ['TEST'] : [];   /* 6 ต.ค.: TEST ใช้หน้าเดิมเพื่อฝึก Staff · ทดสอบหน้าใหม่ต่อได้ด้วย &ui2=1 */", 1]
  ],
  'dhl-sync.js': [
    /* 0) 🐞 แก้บั๊กซิงค์ค้าง (6 ต.ค. 2569 — เจอจากแล็บทดสอบ 3 เครื่อง)
          ตัวดึงรูปตั้ง S.merging=true แล้วคืนค่า "เดิม" ทีหลัง → ถ้าจังหวะชนกับ mergeRemote ค่าจะค้าง true ถาวร
          → เครื่องนั้นไม่รับข้อมูลจากเครื่องอื่นอีกเลยจนกว่าจะปิด-เปิดแอป
          แก้: ตัวดึงรูปใช้ put ตัวดิบอยู่แล้ว (ไม่ส่งขึ้นคลาวด์) จึงไม่ต้องแตะ S.merging
               + snapshot ที่มาระหว่าง merge ไม่ทิ้ง เก็บไว้ทำต่อทันทีหลังเสร็จ */
    ["const wasMerging=S.merging; S.merging=true;\n          try{ await put(rec); }finally{ S.merging=wasMerging; }",
     "await put(rec);   /* 🐞 6 ต.ค.: ไม่แตะ S.merging (เคยทำให้ค้าง) */", 1],
    ["const was=S.merging; S.merging=true;\n    try{ await put(cur); }finally{ S.merging=was; }",
     "await put(cur);   /* 🐞 6 ต.ค.: ไม่แตะ S.merging (เคยทำให้ค้าง) */", 1],
    ["async function mergeRemote(d){\n  if(S.merging) return;\n  S.merging=true;",
     "async function mergeRemote(d){\n  if(S.merging){ S._pendMerge=d; return; }   /* 🐞 6 ต.ค.: ข้อมูลที่มาระหว่าง merge ไม่ทิ้ง */\n  S.merging=true;", 1],
    ["finally{ S.merging=false; }\n}",
     "finally{ S.merging=false;\n    if(S._pendMerge){ const _n=S._pendMerge; S._pendMerge=null; setTimeout(()=>mergeRemote(_n),0); } }\n}", 1],
    /* 1) ตัวตรวจรีเซ็ตข้อมูลฝึก (เฉพาะสาขา TEST) — วางไว้ก่อน pushAll */
    ["/* ============ PUSH: ส่งข้อมูลวันนี้ขึ้นคลาวด์ ============ */",
     "/* ============ 🧪 TEST: รีเซ็ตข้อมูลฝึกจาก Manager (6 ต.ค. 2569) ============\n" +
     "   Manager กด \"ล้างข้อมูล TEST วันนี้\" → เขียน depots/TEST.resetAt แล้วลบข้อมูลวันนี้บนคลาวด์\n" +
     "   ทุกเครื่องที่อยู่สาขา TEST เห็นค่าใหม่ → ล้างข้อมูลในเครื่อง + รีโหลด (ไม่ส่งของเก่ากลับขึ้นไป)\n" +
     "   สาขาจริงทุกสาขาไม่ผ่านโค้ดนี้เลย (เช็ค S.depot==='TEST' ก่อนทุกครั้ง) */\n" +
     "let _trBusy=false;\n" +
     "async function checkTestReset(){\n" +
     "  if(S.depot!=='TEST') return false;\n" +
     "  if(_trBusy) return true;\n" +
     "  try{\n" +
     "    const s=await getDoc(depRef('TEST'));\n" +
     "    const r=s.exists()? (+s.data().resetAt||0) : 0, seen=+lsGet('dsTestReset')||0;\n" +
     "    if(!r || r<=seen) return false;\n" +
     "    _trBusy=true; S.ready=false;\n" +
     "    const b=document.getElementById('dsBadge'); if(b){ b.style.background='#1a1a1a'; b.style.color='#FFCC00'; b.textContent='🧪 ล้างข้อมูลฝึก TEST ...'; }\n" +
     "    await wipeLocalData();\n" +
     "    try{ Object.keys(localStorage).filter(k=>k.indexOf('dsAbs_')===0).forEach(k=>localStorage.removeItem(k)); }catch(e){}\n" +
     "    lsSet('dsTestReset', String(r));\n" +
     "    setTimeout(()=>location.reload(), 500);\n" +
     "    return true;\n" +
     "  }catch(e){ return false; }\n" +
     "}\n\n" +
     "/* ============ PUSH: ส่งข้อมูลวันนี้ขึ้นคลาวด์ ============ */", 1],
    /* 2) ก่อนส่งขึ้นคลาวด์ทุกครั้ง (เฉพาะ TEST) ตรวจรีเซ็ตก่อน */
    ["async function pushAll(){\n  if(!S.ready||S.busy) return;",
     "async function pushAll(){\n  if(!S.ready||S.busy) return;\n  if(S.depot==='TEST' && await checkTestReset()) return;   /* 🧪 */", 1],
    /* 3) TEST ไม่ต้องกู้ข้อมูลย้อนหลัง */
    ["async function backfill(){\n  if(!S.ready) return;",
     "async function backfill(){\n  if(!S.ready) return;\n  if(S.depot==='TEST') return;   /* 🧪 ข้อมูลฝึก ไม่กู้ย้อนหลัง */", 1],
    /* 4) คลาวด์ว่าง/น้อยกว่า (self-heal) — TEST เช็ครีเซ็ตก่อน */
    ["/* 🛟 SELF-HEAL: ถ้าคลาวด์มีข้อมูลน้อยกว่าในเครื่อง (ถูกลบ/หาย) → ส่งขึ้นไปคืนอัตโนมัติ */\nasync function selfHeal(cloud){",
     "/* 🛟 SELF-HEAL: ถ้าคลาวด์มีข้อมูลน้อยกว่าในเครื่อง (ถูกลบ/หาย) → ส่งขึ้นไปคืนอัตโนมัติ */\nasync function selfHeal(cloud){\n  if(S.depot==='TEST' && await checkTestReset()) return;   /* 🧪 */", 1]
  ]
};
window.__applyPatch = (name, text) => {
  for (const [a, b, n] of (window.__PATCHES[name] || [])) {
    const c = text.split(a).length - 1;
    if (c !== n) throw new Error(name + ': พบ ' + c + ' ครั้ง (ต้อง ' + n + ') → ' + a.slice(0, 60));
    text = text.split(a).join(b);
  }
  return text;
};

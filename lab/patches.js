/* ใช้ร่วมกันทั้งในแล็บทดสอบและตอนอัปโหลดจริง — แก้ไฟล์จริงแบบแทนข้อความ (ต้องเจอครบตามจำนวน ไม่งั้นหยุด) */
window.__PATCHES = {
  'dhl-ui2.js': [
    ["const UI2 = ['TEST'];", "const UI2 = /[?&]ui2=1/.test(location.search) ? ['TEST'] : [];   /* 6 ต.ค.: TEST ใช้หน้าเดิมเพื่อฝึก Staff · ทดสอบหน้าใหม่ต่อได้ด้วย &ui2=1 */", 1, 'test']
  ],
  'dhl-sync.js': [
    /* 0) 🐞 แก้บั๊กซิงค์ค้าง (6 ต.ค. 2569 — เจอจากแล็บทดสอบ 3 เครื่อง)
          ตัวดึงรูปตั้ง S.merging=true แล้วคืนค่า "เดิม" ทีหลัง → ถ้าจังหวะชนกับ mergeRemote ค่าจะค้าง true ถาวร
          → เครื่องนั้นไม่รับข้อมูลจากเครื่องอื่นอีกเลยจนกว่าจะปิด-เปิดแอป
          แก้: ตัวดึงรูปใช้ put ตัวดิบอยู่แล้ว (ไม่ส่งขึ้นคลาวด์) จึงไม่ต้องแตะ S.merging
               + snapshot ที่มาระหว่าง merge ไม่ทิ้ง เก็บไว้ทำต่อทันทีหลังเสร็จ */
    ["const wasMerging=S.merging; S.merging=true;\n          try{ await put(rec); }finally{ S.merging=wasMerging; }",
     "await put(rec);   /* 🐞 6 ต.ค.: ไม่แตะ S.merging (เคยทำให้ค้าง) */", 1, 'fix'],
    ["const was=S.merging; S.merging=true;\n    try{ await put(cur); }finally{ S.merging=was; }",
     "await put(cur);   /* 🐞 6 ต.ค.: ไม่แตะ S.merging (เคยทำให้ค้าง) */", 1, 'fix'],
    ["async function mergeRemote(d){\n  if(S.merging) return;\n  S.merging=true;",
     "async function mergeRemote(d){\n  if(S.merging){ S._pendMerge=d; return; }   /* 🐞 6 ต.ค.: ข้อมูลที่มาระหว่าง merge ไม่ทิ้ง */\n  S.merging=true;", 1, 'fix'],
    ["finally{ S.merging=false; }\n}",
     "finally{ S.merging=false;\n    if(S._pendMerge){ const _n=S._pendMerge; S._pendMerge=null; setTimeout(()=>mergeRemote(_n),0); } }\n}", 1, 'fix'],
    /* 5) 🐞 snapshot ที่มาพร้อมการเขียนของเราเอง (hasPendingWrites) อาจรวมข้อมูลจากเครื่องอื่นมาด้วย
          เดิมทิ้งไปเลย → เครื่องนี้ไม่เห็นข้อมูลเครื่องอื่นจนกว่าจะมีการเปลี่ยนครั้งถัดไป
          แก้: ดึงสถานะล่าสุดจากคลาวด์แล้วรวมอีกครั้งหลัง 1.5 วิ (รวมหลายครั้งเป็นครั้งเดียว) */
    ["    if(snap.metadata.hasPendingWrites) return;",
     "    if(snap.metadata.hasPendingWrites){ clearTimeout(S._psT); S._psT=setTimeout(async()=>{ try{ const s2=await getDoc(dayRef(S.depot,date)); if(s2.exists()) await mergeRemote(s2.data()); }catch(e){} }, 1500); return; }   /* 🐞 6 ต.ค. */", 1, 'fix'],
    /* 6) 🐞 PPH: รวมแบบ 3 ทาง (ในเครื่อง / คลาวด์ / ค่าที่ซิงค์ล่าสุด) — เดิมเอาค่าคลาวด์ทับทั้งก้อน
          ทำให้ 2 เครื่องแก้คนละช่องพร้อมกันแล้วหาย และค่าที่เพิ่งกรอกยังไม่ทันส่งถูกทับ */
    ["      const same = JSON.stringify([cur.staffN,cur.sorterN,cur.courierN,cur.pNew,cur.pOld,cur.inboundTs,cur.lastInboundTs,cur.rp])\n                === JSON.stringify([r.staffN,r.sorterN,r.courierN,r.pNew,r.pOld,r.inboundTs,r.lastInboundTs,r.rp]);\n      if(!same){\n        cur.staffN=r.staffN; cur.sorterN=r.sorterN; cur.courierN=r.courierN;\n        cur.pNew=r.pNew; cur.pOld=r.pOld; cur.inboundTs=r.inboundTs;\n        cur.lastInboundTs=r.lastInboundTs; cur.rp=r.rp||{};\n        if(r.pd){ cur.pd = cur.pd||{}; cur.pd.ts=r.pd.ts; cur.pd.manualEdit=!!r.pd.manualEdit; }\n        await putPp(cur); changed=true;\n      }",
     "      /* 🐞 6 ต.ค.: รวมแบบ 3 ทาง — ช่องไหนเครื่องนี้เพิ่งแก้ (ต่างจากค่าที่ซิงค์ล่าสุด) และคลาวด์ยังไม่เปลี่ยน → เก็บของเครื่องนี้ไว้ส่งขึ้น */\n" +
     "      const B=S._pb||(S._pb={f:{},rp:{}}); let _ch=false;\n" +
     "      PPH_F.forEach(k=>{ const lv=cur[k], cv=r[k], had=(k in B.f), bv=B.f[k];\n" +
     "        const localEdited = !!(S._dirty&&S._dirty[k]) || (had && !_peq(lv,bv));\n" +
     "        if(!localEdited || !_peq(cv,bv)){ if(!_peq(lv,cv)){ cur[k]=cv; _ch=true; } }\n" +
     "        B.f[k]=cv; });\n" +
     "      const crp=r.rp||{}, lrp=cur.rp||{}, nrp={};\n" +
     "      new Set([...Object.keys(crp),...Object.keys(lrp)]).forEach(cid=>{ const c=crp[cid]||{}, l=lrp[cid]||{}, hadB=(cid in B.rp), b=B.rp[cid]||{}, o={};\n" +
     "        ['fs','dep','fdel'].forEach(f=>{ const le = !!(S._dirty&&S._dirty['rp.'+cid+'.'+f]) || (hadB? !_peq(l[f],b[f]) : (l[f]!=null && c[f]==null));\n" +
     "          const v = (le && _peq(c[f],b[f])) ? l[f] : (c[f]!=null? c[f] : (le? l[f] : null));\n" +
     "          if(v!=null) o[f]=v; });\n" +
     "        if(Object.keys(o).length) nrp[cid]=o;\n" +
     "        B.rp[cid]={fs:c.fs,dep:c.dep,fdel:c.fdel}; });\n" +
     "      if(!_peq(nrp,lrp)){ cur.rp=nrp; _ch=true; }\n" +
     "      if(r.pd && (!cur.pd || cur.pd.ts!==r.pd.ts || (!!cur.pd.manualEdit)!==(!!r.pd.manualEdit))){ cur.pd = cur.pd||{}; cur.pd.ts=r.pd.ts; cur.pd.manualEdit=!!r.pd.manualEdit; _ch=true; }\n" +
     "      if(_ch){ await putPp(cur); changed=true;\n" +
     "        /* ให้ตัวแปร pphRec ของแอปเดิมเป็นค่าล่าสุดด้วย — กันกดปุ่ม PPH ต่อแล้วเอาค่าเก่าในหน่วยความจำไปทับ */\n" +
     "        try{ const _pr=G('pphRec'); if(_pr && _pr.date===date) (0,eval)('pphRec='+JSON.stringify(cur)); }catch(e){} }", 1, 'fix'],
    /* 7) 🐞 ตอนส่งขึ้นคลาวด์: ส่งเฉพาะช่อง PPH ที่เครื่องนี้แก้จริง (ไม่เอาค่าเก่าในเครื่องไปทับค่าใหม่ของเครื่องอื่น)
          และ Route prep ส่งรายช่อง (FS / ออกรถ / ส่งชิ้นแรก) แทนการทับทั้งคน */
    ["const o=keepFirst(cs.exists()?(cs.data().checkins||{}):{});",
     "const o=pphPushFilter(keepFirst(cs.exists()?(cs.data().checkins||{}):{}), cs.exists()?cs.data().pph:null);", 1, 'fix'],
    ["if(Object.keys(o).length) t.update(ref,o); }); }\n      catch(e){",
     "if(Object.keys(o).length) t.update(ref,o); }); pphBaseCommit(); }\n      catch(e){", 1, 'fix'],
    ["let pushTimer=null;",
     "/* 🐞 6 ต.ค.: ตัวช่วย PPH (ดูข้อ 6–7) */\n" +
     "const PPH_F=['staffN','sorterN','courierN','pNew','pOld','inboundTs','lastInboundTs'];\n" +
     "function _peq(a,b){ return JSON.stringify(a==null?null:a)===JSON.stringify(b==null?null:b); }\n" +
     "function pphPushFilter(o, cp){\n" +
     "  const B=S._pb||(S._pb={f:{},rp:{}}), n={f:{},rp:{},at:null};\n" +
     "  PPH_F.forEach(k=>{ const key='pph.'+k; if(!(key in o)) return;\n" +
     "    const lv=o[key], had=(k in B.f), cv=cp?cp[k]:undefined;\n" +
     "    const dirty=!!(S._dirty&&S._dirty[k]), changed=had && !_peq(lv,B.f[k]);\n" +
     "    if(!dirty && !changed && cv!=null){ delete o[key]; return; }   /* เครื่องนี้ไม่ได้แก้ → ไม่ทับคลาวด์ */\n" +
     "    n.f[k]=lv; });\n" +
     "  Object.keys(o).filter(x=>x.indexOf('pph.rp.')===0 && x.split('.').length===3).forEach(key=>{\n" +
     "    const cid=key.split('.')[2], lv=o[key]||{}, b=B.rp[cid], c=(cp&&cp.rp&&cp.rp[cid])||{}; delete o[key];\n" +
     "    ['fs','dep','fdel'].forEach(f=>{ if(lv[f]==null) return; const edited = !!(S._dirty&&S._dirty['rp.'+cid+'.'+f]) || (b? !_peq(lv[f],b[f]) : c[f]==null);\n" +
     "      if(!edited && c[f]!=null) return;\n" +
     "      o['pph.rp.'+cid+'.'+f]=lv[f]; (n.rp[cid]=n.rp[cid]||{})[f]=lv[f]; }); });\n" +
     "  n.m=Object.assign({}, S._dirty||{}); S._pbNext=n; return o; }\n" +
     "function pphBaseCommit(){ const n=S._pbNext; S._pbNext=null; if(!n) return; const B=S._pb||(S._pb={f:{},rp:{}}), D=S._dirty||{};\n" +
     "  Object.keys(n.f).forEach(k=>{ B.f[k]=n.f[k]; if(D[k] && D[k]===(n.m||{})[k]) delete D[k]; });\n" +
     "  Object.keys(n.rp).forEach(cid=>{ B.rp[cid]=Object.assign({}, B.rp[cid]||{}, n.rp[cid]); Object.keys(n.rp[cid]).forEach(f=>{ const _dk='rp.'+cid+'.'+f; if(D[_dk] && D[_dk]===(n.m||{})[_dk]) delete D[_dk]; }); }); }\n" +
     "let pushTimer=null;", 1, 'fix'],
    /* 8) 🐞 ปุ่ม PPH ของแอปเดิม (กรอกตัวเลข / กดเวลา / FS-ออกรถ-ส่งชิ้นแรก) ใช้ตัวแปร pphRec ในหน่วยความจำ
          ถ้าเครื่องอื่นเพิ่งแก้ แต่หน้านี้ยังไม่รีเฟรช → ค่าเก่าในหน่วยความจำจะถูกบันทึกทับ
          แก้: ก่อนกดทุกครั้ง โหลดค่าล่าสุดจากเครื่องก่อน แล้วค่อยบันทึกเฉพาะช่องที่กด */
    ["function wrap(){\n",
     "function wrap(){\n" +
     "  /* 🐞 6 ต.ค.: ปุ่ม PPH โหลดค่าล่าสุดก่อนบันทึก (กันค่าเก่าทับค่าที่ซิงค์มาจากเครื่องอื่น) */\n" +
     "  ['pphNum','pphStamp','rpStamp','pphSyncCourier'].forEach(fn=>{ const o=window[fn]; if(typeof o!=='function' || o.__ds) return;\n" +
     "    const f=async function(){ try{ const k=tKey(), fr=window.getPPH? await getPPH(k) : null; const pr=G('pphRec');\n" +
     "        if(fr && pr && pr.date===k) (0,eval)('pphRec='+JSON.stringify(fr)); }catch(e){}\n" +
     "      const a=arguments, r=await o.apply(this, a);\n" +
     "      try{ const D=S._dirty||(S._dirty={}), t=Date.now()+Math.random();\n" +
     "        if(fn==='rpStamp') D['rp.'+a[0]+'.'+a[1]]=t; else if(fn==='pphSyncCourier') D.courierN=t; else D[a[0]]=t; }catch(e){}\n" +
     "      return r; };\n" +
     "    f.__ds=true; window[fn]=f; });\n", 1, 'fix'],
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
     "/* ============ PUSH: ส่งข้อมูลวันนี้ขึ้นคลาวด์ ============ */", 1, 'test'],
    /* 2) ก่อนส่งขึ้นคลาวด์ทุกครั้ง (เฉพาะ TEST) ตรวจรีเซ็ตก่อน */
    ["async function pushAll(){\n  if(!S.ready||S.busy) return;",
     "async function pushAll(){\n  if(!S.ready||S.busy) return;\n  if(S.depot==='TEST' && await checkTestReset()) return;   /* 🧪 */", 1, 'test'],
    /* 3) TEST ไม่ต้องกู้ข้อมูลย้อนหลัง */
    ["async function backfill(){\n  if(!S.ready) return;",
     "async function backfill(){\n  if(!S.ready) return;\n  if(S.depot==='TEST') return;   /* 🧪 ข้อมูลฝึก ไม่กู้ย้อนหลัง */", 1, 'test'],
    /* 4) คลาวด์ว่าง/น้อยกว่า (self-heal) — TEST เช็ครีเซ็ตก่อน */
    ["/* 🛟 SELF-HEAL: ถ้าคลาวด์มีข้อมูลน้อยกว่าในเครื่อง (ถูกลบ/หาย) → ส่งขึ้นไปคืนอัตโนมัติ */\nasync function selfHeal(cloud){",
     "/* 🛟 SELF-HEAL: ถ้าคลาวด์มีข้อมูลน้อยกว่าในเครื่อง (ถูกลบ/หาย) → ส่งขึ้นไปคืนอัตโนมัติ */\nasync function selfHeal(cloud){\n  if(S.depot==='TEST' && await checkTestReset()) return;   /* 🧪 */", 1, 'test']
  ]
};
window.__applyPatch = (name, text, tags) => {
  for (const [a, b, n, tag] of (window.__PATCHES[name] || [])) {
    if (tags && !tags.includes(tag)) continue;
    const c = text.split(a).length - 1;
    if (c !== n) throw new Error(name + ': พบ ' + c + ' ครั้ง (ต้อง ' + n + ') → ' + a.slice(0, 60));
    text = text.split(a).join(b);
  }
  return text;
};

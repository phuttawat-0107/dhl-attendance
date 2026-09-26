/* inapp.js — กันปัญหาเปิดลิงก์จากในแอปแชท (LINE / Facebook / Messenger / IG ฯลฯ)
   - LINE: เด้งไปเปิดในเบราว์เซอร์หลักอัตโนมัติ (?openExternalBrowser=1)
   - แอปอื่น: แสดงหน้าแนะนำให้เปิดใน Chrome / Safari
   - เปิดในเบราว์เซอร์ปกติ: ลบพารามิเตอร์ออกจาก URL ให้สะอาด */
(function () {
  var ua = navigator.userAgent || '';
  var isLine = /\bLine\//i.test(ua);
  var isOther = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|MicroMessenger|TikTok|musical_ly|Bytedance|KAKAOTALK|Twitter|Snapchat|Pinterest/i.test(ua);
  var isAndroid = /Android/i.test(ua), isIOS = /iPhone|iPad|iPod/i.test(ua);
  var u; try { u = new URL(location.href); } catch (e) { return; }
  var P = 'openExternalBrowser';

  if (!isLine && !isOther) {
    if (u.searchParams.has(P)) { u.searchParams.delete(P); try { history.replaceState(null, '', u.toString()); } catch (e) {} }
    return;
  }
  if (isLine && !u.searchParams.has(P)) {
    u.searchParams.set(P, '1'); location.replace(u.toString()); return;
  }
  try { if (sessionStorage.getItem('inappStay') === '1') return; } catch (e) {}

  var clean = new URL(u.toString()); clean.searchParams.delete(P);
  var link = clean.toString();
  var intent = 'intent://' + clean.host + clean.pathname + clean.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(link) + ';end';

  function show() {
    var d = document.createElement('div');
    d.id = 'inappGate';
    d.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:#FFCC00;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit;');
    var how = isIOS
      ? 'แตะปุ่ม <b>•••</b> หรือ <b>แชร์</b> มุมจอ แล้วเลือก <b>“เปิดใน Safari”</b>'
      : 'แตะปุ่มด้านล่าง หรือแตะ <b>⋮</b> มุมขวาบน แล้วเลือก <b>“เปิดใน Chrome / เบราว์เซอร์”</b>';
    d.innerHTML =
      '<div style="background:#fff;border-radius:18px;max-width:360px;width:100%;padding:22px 20px;box-shadow:0 10px 30px rgba(0,0,0,.18);text-align:center;color:#1a1a1a;line-height:1.55;">'
      + '<div style="font-size:34px;margin-bottom:4px;">🌐</div>'
      + '<div style="font-size:18px;font-weight:800;margin-bottom:6px;">กรุณาเปิดใน ' + (isIOS ? 'Safari' : 'Chrome') + '</div>'
      + '<div style="font-size:13.5px;color:#555;margin-bottom:14px;">เปิดจากในแอปแชท กล้องและการจำการเข้าสู่ระบบอาจใช้ไม่ได้<br>' + how + '</div>'
      + (isAndroid ? '<a href="' + intent + '" style="display:block;background:#1a1a1a;color:#FFCC00;font-weight:800;padding:13px;border-radius:12px;text-decoration:none;margin-bottom:8px;">เปิดใน Chrome</a>' : '')
      + '<button id="inappCopy" type="button" style="display:block;width:100%;background:#fff;border:1.5px solid #1a1a1a;color:#1a1a1a;font-weight:800;padding:12px;border-radius:12px;font-family:inherit;font-size:14px;margin-bottom:12px;">📋 คัดลอกลิงก์</button>'
      + '<div style="font-size:11.5px;color:#888;word-break:break-all;margin-bottom:12px;">' + link.replace(/</g, '&lt;') + '</div>'
      + '<a href="#" id="inappStay" style="font-size:12.5px;color:#D40511;font-weight:700;">ใช้งานต่อในหน้านี้</a>'
      + '</div>';
    document.body.appendChild(d);
    document.getElementById('inappCopy').onclick = function () {
      var b = this, ok = function () { b.textContent = '✓ คัดลอกแล้ว — ไปวางใน ' + (isIOS ? 'Safari' : 'Chrome'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, fb); else fb();
      function fb() { var t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); }
    };
    document.getElementById('inappStay').onclick = function (e) {
      e.preventDefault(); try { sessionStorage.setItem('inappStay', '1'); } catch (x) {} d.remove();
    };
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();

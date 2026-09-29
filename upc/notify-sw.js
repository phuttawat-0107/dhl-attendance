/* notify-sw.js — ใช้สำหรับแจ้งเตือน "ยังไม่ลงเวลา" เท่านั้น (ไม่แคช ไม่ดักการโหลดหน้าเว็บ) */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './staff2.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    for (const c of L) { if (c.url.split('?')[0] === url.split('?')[0] && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

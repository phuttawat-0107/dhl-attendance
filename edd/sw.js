// EDD Sorter — service worker (scope: /dhl-attendance/edd/ only; does not touch the Attendance app)
// Job 1: receive a file shared from LINE / Gmail / Outlook (Android share sheet) and hand it to the page.
// Job 2: nothing else — no offline caching, so staff always get the latest version of the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const f = form.get('file');
        if (f && f.size) {
          const cache = await caches.open('edd-share');
          await cache.put('shared-file', new Response(f, { headers: { 'x-name': encodeURIComponent(f.name || 'shared.xlsx') } }));
        }
      } catch (err) { /* page will report "file not found" */ }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
  }
});

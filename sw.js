// Mude este número a CADA publicação nova no GitHub (v3 -> v4 -> v5...)
const CACHE_NAME = 'note-bounce-v10';
const CORE = ['./', './index.html', './manifest.json'];
const EXTRA = [
  './icon-192x192.png', './icon-512x512.png', './apple-touch-icon.png', './favicon-32x32.png',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Arquivos do app: sempre buscados da rede (ignora o cache HTTP do navegador/GitHub Pages)
      await Promise.all(CORE.map(u =>
        fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && cache.put(u, r)).catch(() => {})
      ));
      // Extras (ícones, Tone.js, fonte): se algum falhar, não impede a instalação
      await Promise.all(EXTRA.map(u =>
        cache.add(new Request(u, { mode: u.startsWith('http') ? 'no-cors' : 'same-origin' })).catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Amostras do piano (Salamander): cache primeiro. Baixa uma vez e depois toca rápido e até offline.
  if (url.hostname === 'tonejs.github.io' || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/Tonejs/audio'))) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE_NAME).then(ca => ca.put(req, c)); }
        return res;
      }))
    );
    return;
  }

  // Soundfonts antigos: rede primeiro
  if (url.hostname === 'gleitz.github.io') {
    event.respondWith(
      fetch(req).then(res => { const c = res.clone(); caches.open(CACHE_NAME).then(ca => ca.put(req, c)); return res; })
                .catch(() => caches.match(req))
    );
    return;
  }

  // Páginas e arquivos do próprio app (html, js, css, json): REDE PRIMEIRO, cache só se estiver offline.
  // Assim, cada atualização subida no GitHub aparece na hora.
  const sameOrigin = url.origin === self.location.origin;
  const isAppFile = sameOrigin && (req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.endsWith('/'));
  if (isAppFile) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE_NAME).then(ca => ca.put(req, c)); }
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Ícones, Tone.js, fontes: cache primeiro (raramente mudam)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && (res.status === 200 || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE_NAME).then(ca => ca.put(req, c)); }
      return res;
    }).catch(() => undefined))
  );
});

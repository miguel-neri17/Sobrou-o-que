/* Service worker: deixa o app abrir sem internet depois da primeira visita.
   Estratégia: rede primeiro, cache de reserva. Online, a pessoa sempre recebe a versão mais nova (e o cache é renovado);
   sem rede, vale a última cópia guardada. Só atende pedidos GET do próprio site: nada de fora é guardado.
   Os dados da pessoa ficam no localStorage, que o service worker não toca.
   A lista abaixo é conferida por tests/design.test.js contra o index.html e o CSS: arquivo novo no app = arquivo novo aqui.
   Um arquivo da lista que não existe faz a instalação inteira falhar (addAll é tudo ou nada). */
const CACHE = 'sobrou-v1'; // mude o número só se um arquivo sair da lista: o resto é renovado a cada visita online
const ARQUIVOS = [
  './',
  'manifest.webmanifest',
  'js/util.js',
  'js/state.js',
  'js/storage.js',
  'js/calc.js',
  'js/auth.js',
  'js/render.js',
  'js/forms.js',
  'js/backup.js',
  'js/csv.js',
  'js/extrato.js',
  'js/demo.js',
  'js/exemplo.js',
  'js/tema.js',
  'js/nav.js',
  'js/main.js',
  'style.css',
  'img/logo-1.png',
  'img/logo-2.png',
  'fonts/chonburi-latin.woff2',
  'fonts/ibm-plex-sans-latin.woff2',
  'img/icon-192.png',
  'img/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(r, copia)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then((c) => c || caches.match('./')))
  );
});

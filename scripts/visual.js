// Regressão visual: tira retratos de todas as telas e compara dois conjuntos byte a byte.
// Serve para PROVAR que uma mudança de CSS não alterou o que não devia (uma refatoração tem de dar 100% iguais).
//   npm run visual -- capturar <nome>            retratos de 6 telas x celular e computador x claro e escuro
//   npm run visual -- comparar <nomeA> <nomeB>   lista o que ficou diferente entre dois conjuntos
// Os conjuntos ficam em shots/visual/<nome>/ (pasta ignorada pelo git). Usa a conta de exemplo, com "reduzir movimento"
// ligado e SEM as fontes da internet (Google Fonts): elas ora carregam, ora não, e isso mudava conjuntos inteiros entre
// rodadas da mesma versão. Com a fonte de reserva sempre, o resultado é determinístico, e qualquer diferença vem do CSS.
// Limite conhecido: a Análise no computador claro (desk-light-analise) às vezes oscila sozinha, mesmo sem mudar nada.
// Uma diferença ISOLADA nela deve ser confirmada capturando de novo; várias telas diferentes ao mesmo tempo indicam mudança real.
// Para ver a aparência real, com as fontes, use  npm run screenshots.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const RAIZ = path.resolve(__dirname, '..');
const BASE = path.join(RAIZ, 'shots', 'visual');
const [modo, a, b] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const manifesto = (nome) => JSON.parse(fs.readFileSync(path.join(BASE, nome, 'manifest.json'), 'utf8'));

if (modo === 'comparar' && a && b) {
  const A = manifesto(a), B = manifesto(b);
  const iguais = [], difer = [], faltam = [];
  for (const k of Object.keys(A)) { if (!B[k]) faltam.push(k); else (A[k] === B[k] ? iguais : difer).push(k); }
  console.log(`iguais: ${iguais.length}  diferentes: ${difer.length}  ausentes: ${faltam.length}`);
  difer.forEach((k) => console.log('  DIFERE  ' + k));
  faltam.forEach((k) => console.log('  AUSENTE ' + k));
  process.exit(difer.length || faltam.length ? 1 : 0);
}
if (modo !== 'capturar' || !a) {
  console.error('Uso: npm run visual -- capturar <nome>   |   npm run visual -- comparar <nomeA> <nomeB>');
  process.exit(2);
}

const puppeteer = require('puppeteer-core');
const { acharNavegador } = require('./browser');
const OUT = path.join(BASE, a);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: acharNavegador(), headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const SITE = pathToFileURL(path.join(RAIZ, 'index.html')).href;
  const manifest = {};
  for (const [cfg, W, H] of [['cel', 390, 844], ['desk', 1280, 900]]) {
    for (const tema of ['light', 'dark']) {
      const ctx = await browser.createBrowserContext(); // contexto limpo a cada conjunto
      const page = await ctx.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: tema }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (rq) => (/fonts\.(googleapis|gstatic)\.com/.test(rq.url()) ? rq.abort() : rq.continue()));
      await page.goto(SITE, { waitUntil: 'networkidle2' });
      await page.evaluate(() => document.fonts.ready); await sleep(500);
      const shot = async (nome) => { const f = path.join(OUT, `${cfg}-${tema}-${nome}.png`); await page.screenshot({ path: f, fullPage: true }); manifest[path.basename(f)] = hash(f); };
      await shot('entrar');
      await page.click('#demoBtn');
      await page.waitForFunction(() => location.hash === '#inicio', { timeout: 10000 });
      await sleep(700);
      for (const t of ['inicio', 'financas', 'estudos', 'investimentos', 'analise']) {
        await page.evaluate((x) => { location.hash = '#' + x; }, t);
        await page.evaluate(() => document.fonts.ready);
        await sleep(1100); // tempo para fontes de reserva e SVG assentarem
        await shot(t);
      }
      if (errs.length) console.log(cfg, tema, 'ERROS JS:', errs);
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`${Object.keys(manifest).length} retratos em ${path.relative(RAIZ, OUT)}`);
  await browser.close();
})().catch((e) => { console.error('ERRO', e); process.exit(1); });

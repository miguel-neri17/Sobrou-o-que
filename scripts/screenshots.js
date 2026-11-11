// Tira capturas de tela do site em um navegador real.
// Uso: npm run screenshots -- <rotulo> <largura> <altura> [light|dark] [cheio|negativo|vazio]
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const [label, W, H, theme = 'light', estado = 'cheio'] = process.argv.slice(2);
const { pathToFileURL } = require('url');
const { acharNavegador } = require('./browser');
const SITE = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const OUT = path.join(__dirname, '..', 'shots'); // ignorada pelo git
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dados(estado) {
  const now = new Date();
  const key = now.getFullYear() + '-' + (now.getMonth() + 1);
  if (estado === 'vazio') return null;
  const items = [
    { id: 'a1', d: 3, cat: 'alimentacao', desc: 'Mercado', v: 220 },
    { id: 'a2', d: 5, cat: 'alimentacao', desc: 'Lanche depois da aula', v: 85 },
    { id: 'a3', d: 6, cat: 'transporte', desc: 'Passe do ônibus', v: 120 },
    { id: 'a4', d: 9, cat: 'lazer', desc: 'Cinema com a turma', v: 160 },
    { id: 'a5', d: 10, cat: 'contas', desc: 'Assinatura de música', v: 21.9 },
    { id: 'a6', d: 11, cat: 'estudos', desc: 'Livro de cálculo', v: 70 },
    { id: 'a7', d: 12, cat: 'outros', desc: 'Presente', v: 45 },
  ];
  const renda = estado === 'negativo' ? 400 : 1800;
  const weeks = [[0, 2, 1.5, 0, 2, 1, 0, 0], [0, 1, 2, 2, 1.5, 0, 3, 0], [0, 0, 1, 1, 1, 0, 0, 0], [1, 2, 2, 3, 2, 1, 0, 0]];
  return { meta: 10, months: { [key]: { renda, items, weeks, nota: null, grades: [
    { id: 'g1', subj: 'Matemática', v: 7.5, label: 'Prova 1' },
    { id: 'g2', subj: 'Matemática', v: 8, label: 'Trabalho' },
    { id: 'g3', subj: 'Português', v: 6.5, label: 'Prova 1' } ] } } };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: acharNavegador(),
    headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: +W, height: +H, deviceScaleFactor: 1, isMobile: +W < 700, hasTouch: +W < 700 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  const shot = async (nome, full = true) => { await sleep(500); await page.screenshot({ path: path.join(OUT, label + '-' + nome + '.png'), fullPage: full }); };

  await page.goto(SITE, { waitUntil: 'networkidle2' });
  await sleep(400);
  await shot('1-entrar');
  await page.evaluate(() => { location.hash = '#cadastro'; }); await sleep(300);
  await shot('2-cadastro');

  // cria a conta pelo formulario
  await page.type('#cUser', 'ana'); await page.type('#cPass', 'segredo1'); await page.type('#cPass2', 'segredo1');
  await page.click('#cForm .go');
  await page.waitForFunction(() => location.hash === '#inicio', { timeout: 15000 });

  const d = dados(estado);
  if (d) {
    await page.evaluate((json) => { localStorage.setItem('sobrou-v2-ana', json); }, JSON.stringify(d));
    await page.reload({ waitUntil: 'networkidle2' });
  }
  await sleep(400);
  await shot('3-inicio');
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('3v-inicio', false);
  for (const [n, h] of [['4-financas', '#financas'], ['5-estudos', '#estudos'], ['6-investimentos', '#investimentos']]) {
    await page.evaluate((x) => { location.hash = x; }, h);
    await sleep(300);
    await shot(n);
  }
  // menu lateral aberto, se houver botao para abri-lo
  await page.evaluate(() => { location.hash = '#inicio'; }); await sleep(300);
  const b = await page.$('.menubtn, .logobtn');
  if (b) { try { await b.click(); await sleep(600); await shot('7-menu', false); } catch (e) { errs.push('menu: ' + e.message); } }

  console.log('erros:', errs.length ? errs : 'nenhum');
  await browser.close();
})().catch((e) => { console.error('ERRO', e); process.exit(1); });

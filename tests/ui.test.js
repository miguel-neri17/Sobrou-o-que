// Testes de comportamento e medidas em um navegador real (Edge, Chrome ou Chromium). Uso: npm run test:ui
const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const { acharNavegador } = require('../scripts/browser');
const SITE = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

function dados(renda) {
  const now = new Date(), key = now.getFullYear() + '-' + (now.getMonth() + 1);
  const items = [
    { id: 'a1', d: 3, cat: 'alimentacao', desc: 'Mercado', v: 220 },
    { id: 'a2', d: 5, cat: 'alimentacao', desc: 'Lanche', v: 85 },
    { id: 'a3', d: 6, cat: 'transporte', desc: 'Passe do ônibus', v: 120 },
    { id: 'a4', d: 9, cat: 'lazer', desc: 'Cinema com a turma', v: 160 },
    { id: 'a5', d: 10, cat: 'contas', desc: 'Assinatura de música', v: 21.9 },
    { id: 'a6', d: 11, cat: 'estudos', desc: 'Livro de cálculo', v: 70 },
    { id: 'a7', d: 12, cat: 'outros', desc: 'Presente', v: 45 },
  ];
  const weeks = [[0, 2, 1.5, 0, 2, 1, 0, 0], [0, 1, 2, 2, 1.5, 0, 3, 0], [0, 0, 1, 1, 1, 0, 0, 0], [1, 2, 2, 3, 2, 1, 0, 0]];
  return JSON.stringify({ meta: 10, months: { [key]: { renda, items, weeks, nota: null, grades: [] } } });
}

async function abrir(browser, w, h, renda) {
  const ctx = await browser.createBrowserContext(); // contexto limpo: sem contas de cenários anteriores
  const page = await ctx.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(SITE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => { location.hash = '#cadastro'; }); await sleep(200);
  await page.type('#cUser', 'ana'); await page.type('#cPass', 'segredo1'); await page.type('#cPass2', 'segredo1');
  await page.click('#cForm .go');
  await page.waitForFunction(() => location.hash === '#inicio', { timeout: 15000 });
  await page.evaluate((j) => localStorage.setItem('sobrou-v2-ana', j), dados(renda));
  return { page, errs };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: acharNavegador(),
    headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'],
  });

  // ---------- celular, com animações ligadas ----------
  let { page, errs } = await abrir(browser, 390, 844, 1800);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(150);
  const meio = await page.$eval('#saldo', (e) => e.textContent);
  await sleep(1500);
  const fim = await page.$eval('#saldo', (e) => e.textContent.replace(/\s/g, ' '));
  ok(fim === 'R$1.078,10', 'a contagem termina exatamente no valor: "' + fim + '" (durante: "' + meio + '")');
  ok(await page.$eval('#hero', (e) => !e.classList.contains('is-neg')) && /Sobrou em/.test(await page.$eval('#saldoLbl', (e) => e.textContent)), 'estado normal: "Sobrou em ..."');
  const linha = await page.$eval('#saldo', (e) => ({ h: e.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(e).fontSize) }));
  ok(linha.h < linha.fs * 1.5, 'o valor cabe em uma linha (altura ' + Math.round(linha.h) + 'px, fonte ' + linha.fs + 'px)');
  ok(await page.$eval('.mark-q', (e) => e.getBoundingClientRect().width > 0) && await page.$eval('.mark-x', (e) => e.getBoundingClientRect().width === 0), 'aparece o "?" e não o "!"');
  const segs = await page.$$eval('#inBar .rbar i', (l) => l.map((e) => e.className));
  ok(segs.length === 7 && segs[segs.length - 1] === 'c-sobra', 'barra da renda: 6 categorias + trecho "sobra" por último (' + segs.join(',') + ')');
  ok(await page.$eval('#inBar .rbar', (e) => e.getAttribute('role') === 'img' && /Sobrou 59,9%/.test(e.getAttribute('aria-label'))), 'barra tem texto alternativo com a divisão');

  // abas e menu
  ok(await page.$eval('.tabs', (e) => getComputedStyle(e).display !== 'none') && await page.$eval('.screen:not([hidden]) .topnav', (e) => getComputedStyle(e).display === 'none'), 'celular: abas visíveis, links do topo escondidos');
  const tb = await page.$eval('.tabs', (e) => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, pos: getComputedStyle(e).position }; });
  ok(tb.pos === 'fixed' && Math.abs(tb.bottom - tb.vh) < 1, 'abas fixas no rodapé da tela');
  await page.click('.tabs a[data-nav="financas"]'); await sleep(300);
  ok(await page.evaluate(() => location.hash) === '#financas' && await page.$eval('.tabs a[data-nav="financas"]', (e) => e.getAttribute('aria-current') === 'page') && await page.$eval('.tabs a[data-nav="inicio"]', (e) => !e.hasAttribute('aria-current')), 'tocar na aba troca de tela e marca a aba atual');
  ok(await page.$eval('.tabs a', (e) => e.getBoundingClientRect().height >= 44), 'alvo de toque das abas tem pelo menos 44px');

  const telas = ['#inicio', '#financas', '#estudos', '#investimentos'];
  for (const t of telas) {
    await page.evaluate((x) => { location.hash = x; }, t); await sleep(300);
    const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: innerWidth }));
    ok(sw.s <= sw.w, 'sem rolagem lateral em ' + t + ' (' + sw.s + ' <= ' + sw.w + ')');
  }

  await page.evaluate(() => { location.hash = '#inicio'; }); await sleep(300);
  await page.click('.screen:not([hidden]) .menubtn'); await sleep(400);
  ok(await page.evaluate(() => document.body.classList.contains('menu-open')) && await page.$eval('.screen:not([hidden]) .menubtn', (e) => e.getAttribute('aria-expanded') === 'true'), 'botão de menu abre o menu lateral');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'menuClose', 'o foco vai para o botão Fechar');
  await page.click('#menuClose'); await sleep(400);
  ok(await page.evaluate(() => !document.body.classList.contains('menu-open')), 'Fechar fecha o menu');
  await page.click('.screen:not([hidden]) .menubtn'); await sleep(300); await page.keyboard.press('Escape'); await sleep(300);
  ok(await page.evaluate(() => !document.body.classList.contains('menu-open')), 'Esc fecha o menu');

  // ocultar valores
  await page.click('#hideBtn'); await sleep(200);
  ok((await page.$eval('#saldo', (e) => e.textContent)).includes('••••'), 'ocultar valores esconde o saldo');
  await page.click('#hideBtn'); await sleep(200);

  // meta de estudos
  await page.evaluate(() => { location.hash = '#estudos'; }); await sleep(300);
  const goals = await page.$$eval('#eCols .col', (l) => l.map((e) => ({ goal: e.classList.contains('goal'), low: e.classList.contains('low') })));
  ok(goals.every((g) => g.goal) && goals.filter((g) => g.low).length === 3, 'gráfico de estudo: 4 marcas de meta, 3 semanas abaixo da meta');
  const g1 = await page.$eval('#eCols .col .t', (e) => { const a = getComputedStyle(e, '::after'); return { top: a.borderTopStyle, w: a.borderTopWidth }; });
  ok(g1.top === 'dashed', 'a marca da meta é tracejada');
  ok(await page.$eval('#eDias .col', (e) => !e.classList.contains('goal')), 'gráfico por dia não tem marca de meta');
  ok(errs.length === 0, 'sem erros no console (celular) ' + JSON.stringify(errs));
  await page.close();

  // ---------- estado "faltou" ----------
  ({ page, errs } = await abrir(browser, 390, 844, 400));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
  ok(await page.$eval('#hero', (e) => e.classList.contains('is-neg')), 'gastos acima da renda: estado "faltou"');
  ok(/Faltou em/.test(await page.$eval('#saldoLbl', (e) => e.textContent)) && (await page.$eval('#saldo', (e) => e.textContent.replace(/\s/g, ' '))) === 'R$321,90', 'mostra "Faltou em ..." com R$ 321,90');
  ok(await page.$eval('.mark-x', (e) => e.getBoundingClientRect().width > 0) && await page.$eval('.mark-q', (e) => e.getBoundingClientRect().width === 0), 'troca o "?" pelo "!"');
  ok(await page.$$eval('#inBar .rbar i.c-sobra', (l) => l.length) === 0, 'sem trecho laranja quando não sobrou');
  ok(await page.$eval('#inBar .rleg li.is-warn', (e) => /Lazer/.test(e.textContent)), 'lazer acima de 20% da renda fica sinalizado');
  await page.close();

  // ---------- celular, números grandes ----------
  ({ page, errs } = await abrir(browser, 360, 740, 987654.32));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
  const big = await page.$eval('#saldo', (e) => { const r = e.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(e).fontSize), t: e.textContent.replace(/\s/g, ' '), right: r.right, vw: innerWidth }; });
  ok(big.h < big.fs * 1.5 && big.right <= big.vw, 'valor grande (' + big.t + ') cabe em 360px: fonte reduzida para ' + big.fs + 'px');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem lateral com valor grande');
  await page.close();

  // ---------- desktop ----------
  ({ page, errs } = await abrir(browser, 1280, 800, 1800));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
  ok(await page.$eval('.tabs', (e) => getComputedStyle(e).display === 'none') && await page.$eval('.screen:not([hidden]) .topnav', (e) => getComputedStyle(e).display === 'flex'), 'desktop: abas escondidas, links no topo');
  await page.click('.screen:not([hidden]) .topnav a[data-nav="estudos"]'); await sleep(300);
  ok(await page.evaluate(() => location.hash) === '#estudos' && await page.$eval('.screen:not([hidden]) .topnav a[data-nav="estudos"]', (e) => e.getAttribute('aria-current') === 'page'), 'desktop: link do topo navega e marca a seção atual');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desktop sem rolagem lateral');
  await page.evaluate(() => { document.querySelector('#sairSide').click(); }); await sleep(400);
  ok(await page.evaluate(() => location.hash) === '#entrar' && await page.$eval('.tabs', (e) => getComputedStyle(e).display === 'none'), 'sair volta ao login sem mostrar abas');
  ok(await page.$eval('.screen:not([hidden]) .lg-brand', (e) => e.getBoundingClientRect().width > 400), 'login no desktop: painel verde ocupa uma coluna');
  ok(errs.length === 0, 'sem erros no console (desktop) ' + JSON.stringify(errs));
  await page.close();

  // ---------- login no celular ----------
  page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(SITE, { waitUntil: 'networkidle2' }); await sleep(300);
  ok(await page.evaluate(() => location.hash) === '#entrar' && await page.$eval('.tabs', (e) => getComputedStyle(e).display === 'none'), 'celular, sem login: tela de entrada, sem abas');
  ok(await page.$eval('.screen:not([hidden]) .lg-brand', (e) => e.getBoundingClientRect().width >= 389 && e.getBoundingClientRect().height < 160), 'login no celular: faixa verde no topo');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'login sem rolagem lateral');
  await page.close();

  await browser.close();
  console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });

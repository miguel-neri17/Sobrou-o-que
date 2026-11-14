/* Testes do sistema visual (style.css + DESIGN.md). Sem navegador: lê o CSS como texto.
   Transforma regras de design em regras de projeto, para elas não se perderem sem ninguém perceber:
   contraste das cores (WCAG 2.2), movimento centralizado e respeitando "reduzir movimento", nenhuma cor solta fora
   dos tokens, superfícies do navegador temadas e DESIGN.md em dia com o CSS. Roda com:  npm run test:design */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const info = (m) => console.log('INFO ' + m);

/* ---------- lê os blocos de tokens ---------- */
function bloco(re) {
  const m = re.exec(css);
  if (!m) throw new Error('bloco não encontrado no style.css: ' + re);
  let i = m.index + m[0].length, d = 1;
  const ini = i;
  while (d > 0 && i < css.length) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
  return css.slice(ini, i - 1);
}
const vars = (txt) => { const o = {}; txt.replace(/--([a-z0-9-]+)\s*:\s*([^;]+);?/gi, (m, k, v) => { o[k] = v.trim(); }); return o; };
const claroTxt = bloco(/:root\s*\{/);
const escuroMidiaTxt = bloco(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{/);
const escuroAttrTxt = bloco(/:root\[data-theme="dark"\]\{/);
const claro = vars(claroTxt);
const escuroMidia = vars(escuroMidiaTxt);
const escuroAttr = vars(escuroAttrTxt);
const temas = { claro, escuro: Object.assign({}, claro, escuroMidia) };

function resolve(tema, nome) {
  let v = temas[tema][nome];
  for (let n = 0; v && /^var\(--([a-z0-9-]+)\)$/.test(v) && n < 5; n++) v = temas[tema][/^var\(--([a-z0-9-]+)\)$/.exec(v)[1]];
  return v;
}
function rgb(hex) {
  const h = String(hex).replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(t)) throw new Error('cor não é hexadecimal: ' + hex);
  return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
}
function lum(hex) {
  const [r, g, b] = rgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

/* ---------- 1. tokens obrigatórios (o DESIGN.md depende deles) ---------- */
const OBRIGATORIOS = ['brand', 'on-brand', 'brand-text', 'sobra', 'bg', 'surface', 'soft', 'line', 'field-line', 'fg', 'muted', 'danger', 'danger-text',
  'bar', 'bar-low', 'scrim',
  's-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-8', 's-10',
  't-xs', 't-sm', 't-md', 't-base', 't-lg', 't-xl', 't-2xl', 't-3xl', 't-4xl', 't-5xl', 'tabs-h',
  'r-xs', 'r-sm', 'r-ctl', 'r', 'r-xl', 'r-2xl',
  'dur-fast', 'dur-fade', 'dur-base', 'dur-drawer', 'dur-slow', 'dur-reveal', 'ease-out', 'ease-drawer',
  'z-tabs', 'z-scrim', 'z-side', 'z-dialog'];
const faltam = OBRIGATORIOS.filter((k) => !(k in claro));
ok(faltam.length === 0, 'tokens obrigatórios definidos no :root' + (faltam.length ? ' (faltam: ' + faltam.join(', ') + ')' : ''));

/* ---------- 2. tema escuro definido por preferência e por atributo com os MESMOS valores ---------- */
const ks = new Set([...Object.keys(escuroMidia), ...Object.keys(escuroAttr)]);
const divergem = [...ks].filter((k) => escuroMidia[k] !== escuroAttr[k]);
ok(divergem.length === 0, 'o escuro por preferência do sistema e o escuro forçado por atributo têm os mesmos valores' + (divergem.length ? ' (divergem: ' + divergem.join(', ') + ')' : ''));

/* ---------- 3. contraste (WCAG 2.2) nos dois temas ---------- */
const TEXTO = [['fg', 'bg'], ['fg', 'surface'], ['fg', 'soft'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'soft'],
  ['brand-text', 'bg'], ['brand-text', 'surface'], ['brand-text', 'soft'], ['danger-text', 'bg'], ['danger-text', 'surface'], ['danger-text', 'soft'],
  ['on-brand', 'brand'], ['on-brand-2', 'brand']];
const COMPONENTES = [['field-line', 'surface'], ['field-line', 'bg'], ['brand', 'surface'], ['brand', 'bg'], ['bar', 'soft'], ['bar-low', 'soft'], ['bar', 'bar-low']];
for (const tema of ['claro', 'escuro']) {
  const ruins = [];
  for (const [f, b] of TEXTO) {
    const cf = resolve(tema, f), cb = resolve(tema, b);
    if (!cf || !cb) { ruins.push(`${f}/${b}: token ausente`); continue; }
    const r = contraste(cf, cb);
    if (r < 4.5) ruins.push(`${f} sobre ${b} = ${r.toFixed(2)}:1`);
  }
  ok(ruins.length === 0, `tema ${tema}: texto com pelo menos 4,5:1 (14 pares)` + (ruins.length ? '\n       abaixo: ' + ruins.join('; ') : ''));
  const ruins2 = [];
  for (const [f, b] of COMPONENTES) {
    const cf = resolve(tema, f), cb = resolve(tema, b);
    if (!cf || !cb) { ruins2.push(`${f}/${b}: token ausente`); continue; }
    const r = contraste(cf, cb);
    const min = f === 'bar' && b === 'bar-low' ? 1.5 : 3; // as duas barras da meta também diferem por padrão (hachura), então a razão entre elas só precisa se notar
    if (r < min) ruins2.push(`${f} contra ${b} = ${r.toFixed(2)}:1 (mínimo ${min})`);
  }
  ok(ruins2.length === 0, `tema ${tema}: bordas de campos, botões e barras com pelo menos 3:1` + (ruins2.length ? '\n       abaixo: ' + ruins2.join('; ') : ''));
}
{ // informativo: as cores das categorias dependem da legenda com números (WCAG 1.4.11 aceita se a informação também está em texto)
  const baixos = [];
  for (const tema of ['claro', 'escuro']) for (const c of ['alimentacao', 'transporte', 'lazer', 'assinaturas', 'estudos', 'outros']) {
    const r = contraste(resolve(tema, 'c-' + c), resolve(tema, 'surface'));
    if (r < 3) baixos.push(`${tema}/${c} ${r.toFixed(1)}`);
  }
  info('cores de categoria abaixo de 3:1 contra o cartão (ficam acompanhadas da legenda com valores): ' + (baixos.join(', ') || 'nenhuma'));
}

/* ---------- 4. movimento ---------- */
const semTokens = css.replace(claroTxt, '').replace(escuroMidiaTxt, '').replace(escuroAttrTxt, '');
const soltas = (semTokens.match(/(?:transition|animation)[^;}]*?[^\w.-](\d+(?:\.\d+)?)ms\b/g) || []).filter((d) => !/\.01ms/.test(d));
ok(soltas.length === 0, 'toda duração de transição ou animação vem de um token --dur-* (nada de "160ms" solto)' + (soltas.length ? '\n       soltas: ' + soltas.slice(0, 4).join(' | ') : ''));
const reduzido = bloco(/@media \(prefers-reduced-motion:reduce\)\{/);
ok(/\*\s*\{[^}]*transition-duration/.test(reduzido), '"reduzir movimento" zera todas as transições (regra no *)');
ok(/\.screen\.enter\s*\{\s*animation\s*:\s*none/.test(reduzido), '"reduzir movimento" desliga o desvanecer de entrada das telas');
ok(/\.rbar\.reveal\s*\{\s*animation\s*:\s*none/.test(reduzido), '"reduzir movimento" desliga a abertura da barra da renda');
ok(/\.screen\.enter\s*\{[^}]*animation\s*:\s*fade\b/.test(semTokens) && !/\.screen\.enter\s+\.card/.test(semTokens.replace(reduzido, '')), 'a tela entra com UM desvanecer (fade) e não com cascata de cartões');
{
  const m = /--dur-fade\s*:\s*(\d+)ms/.exec(claroTxt);
  ok(m && +m[1] >= 100 && +m[1] <= 250, 'o desvanecer de entrada fica entre 100 e 250 ms (hoje: ' + (m ? m[1] : '?') + ' ms)');
}

/* ---------- 5. nenhuma cor solta fora dos tokens ---------- */
const cores = (semTokens.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []);
ok(cores.length === 0, 'nenhuma cor escrita direto nas regras: tudo vem de um token' + (cores.length ? '\n       soltas: ' + [...new Set(cores)].join(', ') : ''));

/* ---------- 6. superfícies do navegador temadas ---------- */
ok(/accent-color\s*:/.test(css), 'caixas de marcar e botões nativos usam a cor da marca (accent-color)');
ok(/scrollbar-color\s*:/.test(css), 'barra de rolagem temada (scrollbar-color)');
ok(/caret-color\s*:/.test(css), 'cursor de texto temado (caret-color)');
ok(/::selection\s*\{/.test(css), 'seleção de texto temada (::selection)');
ok(/color-scheme\s*:\s*dark/.test(escuroMidiaTxt) && /color-scheme\s*:\s*light/.test(css), 'color-scheme declarado nos dois temas');

/* ---------- 7. DESIGN.md e PRODUCT.md existem e só citam tokens que existem ---------- */
for (const f of ['DESIGN.md', 'PRODUCT.md']) ok(fs.existsSync(path.join(root, f)), f + ' existe');
if (fs.existsSync(path.join(root, 'DESIGN.md'))) {
  const md = fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8');
  const citados = [...new Set((md.match(/`--[a-z0-9-]+`/g) || []).map((s) => s.slice(3, -1)))];
  const sumidos = citados.filter((k) => !(k in claro) && !(k in escuroMidia));
  ok(citados.length > 20 && sumidos.length === 0, `o DESIGN.md cita ${citados.length} tokens e todos existem no CSS` + (sumidos.length ? '\n       inexistentes: ' + sumidos.join(', ') : ''));
}

/* ---------- 8. ritmo: espaçamento na escala e tamanhos de texto só por token ---------- */
{
  const escala = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 56, 64]); // 6 e 10 são metades de passo, aceitos em ajustes finos
  const fora = {};
  (semTokens.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]+/g) || []).forEach((d) => {
    (d.match(/(?<![\w.-])\d+(?:\.\d+)?px/g) || []).forEach((p) => { const n = parseFloat(p); if (!escala.has(n)) fora[p] = (fora[p] || 0) + 1; });
  });
  ok(JSON.stringify(fora) === '{}', 'todo espaçamento (padding, margin, gap) está na escala' + (JSON.stringify(fora) === '{}' ? '' : '\n       fora da escala (valor: ocorrências): ' + JSON.stringify(fora)));
  const textos = [...new Set((semTokens.match(/font-size\s*:\s*\d+(?:\.\d+)?px/g) || []).map((s) => s.replace(/\s+/g, '')))];
  ok(textos.length === 0, 'todo tamanho de texto vem de um token --t-* (só clamp() fluido pode ter px direto)' + (textos.length ? '\n       literais: ' + textos.join(', ') : ''));
}

/* ---------- 9. estados, textura e composição (PR 3) ---------- */
ok(/\.btn:disabled/.test(css) && /\.lgc \.go:disabled/.test(css), 'botão desabilitado PARECE desabilitado (.btn:disabled e .lgc .go:disabled)');
ok(/\.rbar i\.c-outros[^{]*\{[^}]*repeating-linear-gradient/.test(css) && /\.rleg \.sw\.c-outros[^{]*\{[^}]*repeating-linear-gradient/.test(css), 'a categoria Outros tem textura listrada na barra e na legenda: não depende só da cor');
ok(/\.tip\.is-warn\s*\{/.test(css), 'o cartão de observações tem um estado de aviso (.tip.is-warn)');
ok(/\.ext-box[^{]*\{[^}]*max-height/.test(css) || /\.ext\s*\{[^}]*overflow-y/.test(css), 'o diálogo do extrato rola por dentro quando é mais alto que a tela');
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const partes = (html.match(/class="an-split"/g) || []).length;
  ok(partes >= 3 && /\.an-split\s*\{/.test(css) && /@media \(min-width:900px\)\{[^]*\.an-split/.test(css), `a Análise tem ${partes} blocos lado a lado no computador (.an-split), esperado 3 ou mais`);
  ok(/id="extPanel"[^>]*role="dialog"[^>]*aria-modal="true"/.test(html) || /id="extPanel"[^>]*aria-modal="true"[^>]*role="dialog"/.test(html), 'o painel do extrato é um diálogo acessível (role="dialog" aria-modal="true")');
  const cartoes = (html.match(/id="eCols"|id="eDias"/g) || []).length;
  ok(!/<div class="card wide"[^>]*>\s*<h2>Horas de estudo por semana/.test(html) && !/<div class="card wide"[^>]*>\s*<h2>Horas por dia da semana/.test(html) && cartoes === 2, 'os dois gráficos de barras do Estudos não são cartões de largura total');
}

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
process.exit(fails ? 1 : 0);

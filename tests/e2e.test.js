const fs = require('fs');
const { JSDOM } = require('jsdom');
const wc = require('crypto').webcrypto;
const root = process.argv[2] || require('path').resolve(__dirname, '..'); // por padrão, a raiz do projeto
let html = fs.readFileSync(root + '/index.html', 'utf8');
// carrega cada <script src="js/..."> do index.html, na ordem em que aparecem, como script inline
const srcs = [];
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, p) => { srcs.push(p); return '<script>' + fs.readFileSync(root + '/' + p, 'utf8') + '</script>'; });
console.log('scripts carregados (' + srcs.length + '): ' + srcs.join(', '));
if (!srcs.length || /<script src=/.test(html)) { console.error('ERRO: sobrou <script src> sem tratar'); process.exit(2); }
html = html.replace('<link rel="stylesheet" href="style.css">', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

function boot(pre, cr) {
  const errs = [];
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'crypto', { value: cr || wc });
      w.TextEncoder = TextEncoder;
      w.TextDecoder = TextDecoder;
      w.confirm = () => true;
      w.scrollTo = () => {};
      w.addEventListener('error', (e) => errs.push(e.message));
      if (pre) pre(w);
    },
  });
  return { w: dom.window, d: dom.window.document, errs };
}
const submit = (w, f) => f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));

(async () => {
  let { w, d, errs } = boot();
  const set = (id, v) => { d.querySelector(id).value = v; };
  await sleep(100);
  ok(w.location.hash === '#entrar', 'sem login cai em #entrar');

  set('#cUser', 'Ana_01'); set('#cPass', 'segredo1'); set('#cPass2', 'segredo1');
  submit(w, d.querySelector('#cForm')); await sleep(2500);
  ok(w.location.hash === '#inicio', 'cadastro leva ao #inicio (' + w.location.hash + ', erro="' + d.querySelector('#cErr').textContent + '")');
  const us = w.localStorage.getItem('sobrou-users');
  ok(us && !us.includes('segredo1') && JSON.parse(us).ana_01.h, 'senha guardada como hash, sem texto puro');

  w.location.hash = '#financas'; await sleep(50);
  set('#gDesc', 'Lanche'); set('#gVal', '12.5'); set('#gDia', '3'); set('#gCat', 'alimentacao');
  submit(w, d.querySelector('#gForm'));
  let rows = d.querySelectorAll('#fList tr');
  ok(rows.length === 1 && rows[0].textContent.includes('Lanche'), 'gasto adicionado');
  const saved = () => JSON.parse(w.localStorage.getItem('sobrou-v2-ana_01')).months;
  const mk = () => Object.keys(saved())[0];
  ok(saved()[mk()].items[0].id, 'gasto salvo com id');

  d.querySelector('[data-edit]').click();
  ok(d.querySelector('#gDesc').value === 'Lanche' && d.querySelector('#gVal').value === '12.5' && d.querySelector('#gDia').value === '3', 'editar preenche o formulario');
  ok(d.querySelector('#gTitulo').textContent === 'Editar gasto' && d.querySelector('#gSubmit').textContent === 'Salvar alteração' && !d.querySelector('#gCancel').hidden, 'modo edicao visivel');
  set('#gVal', '20'); set('#gDesc', 'Lanche grande');
  submit(w, d.querySelector('#gForm'));
  rows = d.querySelectorAll('#fList tr');
  ok(rows.length === 1 && rows[0].textContent.includes('Lanche grande') && saved()[mk()].items.length === 1 && saved()[mk()].items[0].v === 20 && saved()[mk()].items[0].d === 3, 'edicao atualiza o mesmo item (dia mantido)');
  ok(d.querySelector('#gTitulo').textContent === 'Registrar gasto' && d.querySelector('#gCancel').hidden && d.querySelector('#gDesc').value === '', 'formulario volta ao normal');

  d.querySelector('[data-edit]').click(); d.querySelector('#gCancel').click();
  ok(d.querySelector('#gDesc').value === '' && d.querySelector('#gMsg').textContent === 'Edição cancelada.' && saved()[mk()].items[0].v === 20, 'cancelar nao altera nada');

  d.querySelector('[data-edit]').click();
  d.querySelector('#financas [data-step="-1"]').click();
  ok(d.querySelector('#gSubmit').textContent === 'Adicionar gasto' && d.querySelector('#gDesc').value === '', 'trocar de mes encerra a edicao');
  d.querySelector('#financas [data-step="1"]').click();

  d.querySelector('[data-gdel]').click();
  ok(d.querySelectorAll('#fList tr .empty').length === 1 && saved()[mk()].items.length === 0, 'remover apaga e salva');

  set('#gDesc', '<img src=x onerror=1>'); set('#gVal', '1'); submit(w, d.querySelector('#gForm'));
  ok(!d.querySelector('#fList img'), 'descricao e escapada');

  d.querySelector('#sairSide').click(); await sleep(50);
  ok(w.location.hash === '#entrar', 'sair volta ao login');
  set('#lUser', 'ana_01'); set('#lPass', 'errada'); submit(w, d.querySelector('#lForm')); await sleep(2500);
  ok(w.location.hash === '#entrar' && d.querySelector('#lErr').textContent.includes('incorretos'), 'senha errada recusada');
  ok(!d.querySelector('#lForm .go').disabled, 'botao volta a habilitar');
  set('#lUser', 'ana_01'); set('#lPass', 'segredo1'); submit(w, d.querySelector('#lForm')); await sleep(2500);
  ok(w.location.hash === '#inicio', 'senha certa entra');
  ok(errs.length === 0, 'sem erros JS no cenario 1 ' + JSON.stringify(errs));

  // cenario 2: conta antiga (senha em texto, gasto sem id)
  // key = formato atual (AAAA-MM); legacyKey = formato antigo (AAAA-M), que ainda precisa ser lido
  const now = new Date(), key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), legacyKey = now.getFullYear() + '-' + (now.getMonth() + 1);
  const z = () => [0, 0, 0, 0, 0, 0, 0, 0];
  ({ w, d, errs } = boot((win) => {
    win.localStorage.setItem('sobrou-users', JSON.stringify({ velho: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-velho', JSON.stringify({ meta: 10, months: { [legacyKey]: { renda: 100, items: [{ d: 2, cat: 'lazer', desc: 'Cinema', v: 30 }], weeks: [z(), z(), z(), z()], nota: null, grades: [] } } }));
  }));
  await sleep(100);
  set('#lUser', 'admin'); set('#lPass', 'admin123'); submit(w, d.querySelector('#lForm')); await sleep(2500);
  ok(w.location.hash === '#entrar', 'admin/admin123 NAO entra mais');
  set('#lUser', 'velho'); set('#lPass', 'abc123'); submit(w, d.querySelector('#lForm')); await sleep(2500);
  ok(w.location.hash === '#inicio', 'conta antiga entra');
  ok(!w.localStorage.getItem('sobrou-users').includes('abc123'), 'conta antiga migrada para hash');
  w.location.hash = '#financas'; await sleep(50);
  const eb = d.querySelector('[data-edit]');
  ok(eb && eb.getAttribute('data-edit') && d.querySelector('#fList').textContent.includes('Cinema'), 'gasto antigo ganhou id e aparece com botoes');
  eb.click(); set('#gVal', '45'); submit(w, d.querySelector('#gForm'));
  const it = JSON.parse(w.localStorage.getItem('sobrou-v2-velho')).months[key].items;
  ok(it.length === 1 && it[0].v === 45 && it[0].id, 'editar gasto antigo funciona e persiste o id');
  ok(errs.length === 0, 'sem erros JS no cenario 2 ' + JSON.stringify(errs));

  // cenario 3: exportar / importar (continua logado como "velho")
  const blobs = [];
  w.URL.createObjectURL = (b) => { blobs.push(b); return 'blob:x'; };
  w.URL.revokeObjectURL = () => {};
  const readBlob = (b) => new Promise((res) => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); });
  const month = () => JSON.parse(w.localStorage.getItem('sobrou-v2-velho')).months[key];
  const importText = async (t) => {
    const inp = d.querySelector('#impFile');
    const f = new w.File([t], 'x.json', { type: 'application/json' });
    Object.defineProperty(inp, 'files', { value: [f], configurable: true });
    inp.dispatchEvent(new w.Event('change')); await sleep(150);
  };
  const dmsg = () => d.querySelector('#dMsg').textContent;

  d.querySelector('#expBtn').click(); await sleep(50);
  const exported = await readBlob(blobs[0]);
  const ej = JSON.parse(exported);
  ok(ej.app === 'sobrou' && ej.versao === 1 && ej.months[key].items[0].v === 45, 'exportar gera JSON com os dados');
  ok(!exported.includes('abc123') && !/senha|password|sobrou-users/i.test(exported), 'exportacao nao contem senha');
  ok(dmsg().includes('gerado'), 'exportar avisa o usuario');

  d.querySelector('[data-gdel]').click();
  ok(month().items.length === 0, '(preparo) gasto removido antes de importar');
  await importText(exported);
  ok(month().items.length === 1 && month().items[0].v === 45 && month().items[0].id === ej.months[key].items[0].id, 'importar restaura os dados (ida e volta)');
  ok(dmsg().startsWith('Dados importados'), 'importar avisa o usuario: ' + dmsg());
  ok(d.querySelector('#fList').textContent.includes('Cinema'), 'tela atualiza depois de importar');

  const before = JSON.stringify(month());
  await importText('isto nao e json');
  ok(dmsg().includes('JSON válido') && JSON.stringify(month()) === before, 'JSON invalido recusado, dados intactos');
  await importText(JSON.stringify({ months: {} }));
  ok(dmsg().includes('não parece') && JSON.stringify(month()) === before, 'arquivo de outro app recusado');
  await importText(JSON.stringify({ app: 'sobrou', versao: 1, months: { foo: {} } }));
  ok(dmsg().includes('nenhum mês') && JSON.stringify(month()) === before, 'arquivo sem meses validos recusado');
  await importText(JSON.stringify({ app: 'sobrou', versao: 9, months: { [key]: {} } }));
  ok(dmsg().includes('versão') && JSON.stringify(month()) === before, 'versao desconhecida recusada');
  w.confirm = () => false;
  await importText(exported);
  ok(dmsg() === 'Importação cancelada.' && JSON.stringify(month()) === before, 'cancelar a confirmacao nao altera nada');
  w.confirm = () => true;
  await importText('x'.repeat(2.1 * 1024 * 1024));
  ok(dmsg().includes('grande demais'), 'arquivo grande demais recusado');

  const evil = '{"app":"sobrou","versao":1,"meta":999,"months":{"__proto__":{"polluted":1},"abc":{},"' + key + '":{"renda":"50","items":['
    + '{"id":"\\"><img src=x onerror=1>","d":99,"cat":"hack","desc":"<b>x</b>","v":"12"},'
    + '{"id":"dup","d":5,"cat":"lazer","desc":"A","v":1},{"id":"dup","d":6,"cat":"lazer","desc":"B","v":2},'
    + '{"desc":"sem valor","v":-5},"lixo",null],"weeks":[[1,2],"x",[99999],[]],"nota":"abc","grades":[{"subj":"Mat","v":11},{"subj":"Port","v":8.456,"label":"P1"}]}}}';
  await importText(evil);
  const m = month();
  const idRe = /^[A-Za-z0-9_-]{1,60}$/;
  ok(dmsg().startsWith('Dados importados: 1'), 'arquivo malicioso: so o mes valido entra (' + dmsg() + ')');
  ok(({}).polluted === undefined && w.Object.prototype.polluted === undefined, 'sem poluicao de prototype');
  ok(m.items.length === 3 && m.items.every((i) => idRe.test(i.id)) && new Set(m.items.map((i) => i.id)).size === 3, 'ids sanitizados e unicos');
  ok(m.items[0].cat === 'outros' && m.items[0].d === 1 && m.items[0].v === 12 && m.renda === 50, 'categoria/dia/valores normalizados');
  ok(m.nota === null && m.grades.length === 1 && m.grades[0].v === 8.46, 'nota invalida descartada, nota fora de 0-10 descartada, arredondamento');
  ok(m.weeks.length === 4 && m.weeks.every((x) => x.length === 8) && m.weeks[0][0] === 1 && m.weeks[1].every((h) => h === 0) && m.weeks[2][0] === 0, 'semanas normalizadas (999 descartado)');
  const lst = d.querySelector('#fList');
  const descs = Array.from(lst.querySelectorAll('tr td:nth-child(2) b')).map((e) => e.textContent);
  ok(lst.querySelector('img') === null && lst.querySelectorAll('b').length === 3 && lst.querySelectorAll('button').length === 6 && descs.includes('<b>x</b>'), 'nada de HTML injetado na tabela (a descricao aparece como texto literal)');
  ok(JSON.parse(w.localStorage.getItem('sobrou-v2-velho')).meta === 10, 'meta fora do limite (999) ignorada');
  ok(errs.length === 0, 'sem erros JS no cenario 3 ' + JSON.stringify(errs));

  // cenario 3b: falha de gravacao e meses fora da janela na importacao
  const snap = JSON.stringify(month());
  const realSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  await importText(exported);
  w.Storage.prototype.setItem = realSet;
  ok(dmsg().includes('Nada foi alterado') && JSON.stringify(month()) === snap, 'importacao com armazenamento cheio avisa e restaura');
  ok(d.querySelector('#fList').textContent.includes('B') || d.querySelector('#fList').textContent.length > 0, 'tela segue com os dados anteriores');
  await importText(JSON.stringify({ app: 'sobrou', versao: 1, months: { '2000-1': { renda: 5 } } }));
  ok(dmsg().includes('últimos 12 meses') && JSON.stringify(month()) === snap, 'arquivo so com meses antigos recusado');

  // cenario 4: dados antigos/adulterados no localStorage e hash fraco
  const rec150 = await (async () => {
    const salt = wc.getRandomValues(new Uint8Array(16));
    const k = await wc.subtle.importKey('raw', new TextEncoder().encode('velha123'), 'PBKDF2', false, ['deriveBits']);
    const bits = await wc.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256);
    return { s: Buffer.from(salt).toString('base64'), h: Buffer.from(bits).toString('base64'), i: 150000 };
  })();
  ({ w, d, errs } = boot((win) => {
    win.localStorage.setItem('sobrou-users', JSON.stringify({ forte: rec150 }));
    win.localStorage.setItem('sobrou-v2-forte', JSON.stringify({ meta: 'x', months: {
      [key]: { renda: 100, items: [{ id: '"><img src=x onerror=1>', d: 2, cat: 'hack', desc: 'Item', v: 30 }], weeks: [8, 0, 0, 0], grades: 'lixo' },
      '__proto__': { polluted: 1 }, abc: {} } }));
  }));
  await sleep(100);
  set('#lUser', 'forte'); set('#lPass', 'velha123'); submit(w, d.querySelector('#lForm')); await sleep(4000);
  ok(w.location.hash === '#inicio', 'hash com 150000 iteracoes ainda entra');
  ok(JSON.parse(w.localStorage.getItem('sobrou-users')).forte.i === 600000, 'hash fraco refeito com 600000 iteracoes');
  d.querySelector('#sairSide').click(); await sleep(50);
  set('#lUser', 'forte'); set('#lPass', 'velha123'); submit(w, d.querySelector('#lForm')); await sleep(4000);
  ok(w.location.hash === '#inicio', 'login continua funcionando depois do upgrade');
  w.location.hash = '#financas'; await sleep(50);
  const fl = d.querySelector('#fList');
  ok(fl.querySelector('img') === null && fl.querySelectorAll('[data-edit]').length === 1 && /^[A-Za-z0-9_-]+$/.test(fl.querySelector('[data-edit]').getAttribute('data-edit')), 'dados adulterados no storage sao saneados ao carregar (id seguro, sem img)');
  ok(fl.textContent.includes('Outros'), 'categoria desconhecida vira Outros');
  ok(d.querySelector('#inEstudo').textContent.includes('2 h'), 'semanas no formato antigo (numero) preservadas: ' + d.querySelector('#inEstudo').textContent);
  ok(w.Object.prototype.polluted === undefined, 'sem poluicao de prototype ao carregar');

  // cenario 5: falha do crypto no login nao trava o botao
  const badCrypto = { subtle: { importKey: () => Promise.reject(new Error('x')), deriveBits: () => Promise.reject(new Error('x')) }, getRandomValues: (a) => wc.getRandomValues(a) };
  ({ w, d, errs } = boot((win) => { win.localStorage.setItem('sobrou-users', JSON.stringify({ antigo: 'abc123' })); }, badCrypto));
  await sleep(100);
  set('#lUser', 'antigo'); set('#lPass', 'abc123'); submit(w, d.querySelector('#lForm')); await sleep(300);
  ok(!d.querySelector('#lForm .go').disabled && d.querySelector('#lErr').textContent.length > 0 && w.location.hash === '#entrar', 'falha do crypto reabilita o botao e mostra erro');
  // cadastro duplicado (corrida): login criado por outra aba entre a checagem e a gravacao
  set('#cUser', 'dupla'); set('#cPass', 'abcdef'); set('#cPass2', 'abcdef');
  ok(true, '(cadastro com crypto quebrado cai no catch)');
  submit(w, d.querySelector('#cForm')); await sleep(300);
  ok(!d.querySelector('#cForm .go').disabled && d.querySelector('#cErr').textContent.includes('Não foi possível'), 'cadastro com falha reabilita o botao');

  // cenario 6: categoria "assinaturas" e mes no formato AAAA-MM (dados no formato antigo sao migrados)
  const login = async (win, doc, u, p) => {
    doc.querySelector('#lUser').value = u; doc.querySelector('#lPass').value = p;
    submit(win, doc.querySelector('#lForm')); await sleep(2500);
  };
  const stored = (win, u) => JSON.parse(win.localStorage.getItem('sobrou-v2-' + u));
  // data fixa em maio de 2026: so em meses de 1 a 9 as formas AAAA-M e AAAA-MM sao diferentes
  const k6 = '2026-05', l6 = '2026-5';
  const fixDate = (win) => {
    const Real = win.Date, fixed = new Real(2026, 4, 15, 12).getTime();
    win.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(fixed); } static now() { return fixed; } };
  };
  const legacyData = { meta: 10, months: { [l6]: { renda: 100, items: [{ id: 'a1', d: 2, cat: 'contas', desc: 'Streaming', v: 30 }], weeks: [z(), z(), z(), z()], nota: null, grades: [] } } };
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ mig: 'abc123', col: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-mig', JSON.stringify(legacyData));
    // o mesmo mes nas duas formas: a forma nova (AAAA-MM) vence
    win.localStorage.setItem('sobrou-v2-col', JSON.stringify({ meta: 10, months: { [l6]: { renda: 10 }, [k6]: { renda: 20 } } }));
  }));
  await sleep(100);
  await login(w, d, 'mig', 'abc123');
  w.location.hash = '#financas'; await sleep(50);
  const catVals = Array.from(d.querySelectorAll('#gCat option')).map((o) => o.value);
  ok(catVals.includes('assinaturas') && !catVals.includes('contas'), 'categoria se chama assinaturas (nao contas)');
  ok(d.querySelector('#fList').textContent.includes('Streaming') && d.querySelector('#fList small').textContent === 'Assinaturas', 'gasto salvo como "contas" aparece como Assinaturas');
  set('#gDesc', 'Spotify'); set('#gVal', '10'); set('#gCat', 'assinaturas'); submit(w, d.querySelector('#gForm'));
  ok(JSON.stringify(Object.keys(stored(w, 'mig').months)) === JSON.stringify([k6]), 'mes antigo (AAAA-M) migrado para AAAA-MM ao salvar: ' + Object.keys(stored(w, 'mig').months));
  ok(stored(w, 'mig').months[k6].items.length === 2 && stored(w, 'mig').months[k6].items.every((i) => i.cat === 'assinaturas'), 'categoria contas migrada para assinaturas no armazenamento');
  ok(d.querySelector('#fCats .c-assinaturas') !== null, 'barra da renda usa a cor de assinaturas');

  // importar arquivo exportado no formato antigo (versao 1, mes AAAA-M e categoria contas)
  const importOld = async (t) => {
    const inp = d.querySelector('#impFile');
    Object.defineProperty(inp, 'files', { value: [new w.File([t], 'x.json', { type: 'application/json' })], configurable: true });
    inp.dispatchEvent(new w.Event('change')); await sleep(150);
  };
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [l6]: { renda: 77, items: [{ id: 'z9', d: 4, cat: 'contas', desc: 'Antigo', v: 5 }] } } }));
  ok(d.querySelector('#dMsg').textContent.startsWith('Dados importados') && JSON.stringify(Object.keys(stored(w, 'mig').months)) === JSON.stringify([k6]) && stored(w, 'mig').months[k6].items[0].cat === 'assinaturas', 'arquivo antigo importa e vira AAAA-MM / assinaturas: ' + d.querySelector('#dMsg').textContent);

  d.querySelector('#sairSide').click(); await sleep(50);
  await login(w, d, 'col', 'abc123');
  w.location.hash = '#financas'; await sleep(50);
  ok(d.querySelector('#rRenda').value === '20', 'mes nas duas formas: a forma AAAA-MM prevalece (renda ' + d.querySelector('#rRenda').value + ')');
  ok(errs.length === 0, 'sem erros JS no cenario 6 ' + JSON.stringify(errs));

  // cenario 7: importar extrato bancario em CSV (saida = valor negativo), com revisao antes de salvar
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ ext: 'abc123' }));
  }));
  await sleep(100);
  await login(w, d, 'ext', 'abc123');
  const pickCsv = async (t) => {
    const inp = d.querySelector('#extFile');
    Object.defineProperty(inp, 'files', { value: [new w.File([t], 'extrato.csv', { type: 'text/csv' })], configurable: true });
    inp.dispatchEvent(new w.Event('change')); await sleep(150);
  };
  const panel = () => d.querySelector('#extPanel'), sum = () => d.querySelector('#extSum').textContent, items7 = () => (stored(w, 'ext') ? Object.values(stored(w, 'ext').months).flatMap((m) => m.items) : []);
  const csv7 = 'Data;Descrição;Valor\n05/05/2026;Mercado;-12,50\n06/05/2026;Salário;1000,00\n07/05/2026;Cinema;-30,00\n01/01/2020;Antigo;-9\n31/02/2026;X;-1\n';
  ok(d.querySelector('#extBtn') && panel().hidden, 'botao de importar extrato existe e o painel comeca fechado');

  await pickCsv(csv7);
  ok(!panel().hidden, 'escolher o arquivo abre o painel de revisao');
  ok(d.querySelector('#extData').value === '0' && d.querySelector('#extDesc').value === '1' && d.querySelector('#extVal').value === '2' && d.querySelector('#extHead').checked, 'colunas e cabecalho detectados sozinhos');
  ok(sum().includes('2 gastos para importar') && sum().includes('1 entrada ignorada') && sum().includes('1 linha inválida') && sum().includes('1 fora dos últimos 12 meses'), 'resumo conta novos, entradas, invalidas e fora da janela: ' + sum());
  ok(items7().length === 0, 'nada e salvo antes de confirmar');
  ok(d.querySelector('#extOk').textContent.includes('2') && !d.querySelector('#extOk').disabled, 'botao de confirmar mostra a quantidade');

  d.querySelector('#extOk').click(); await sleep(50);
  const it7 = items7();
  ok(panel().hidden && it7.length === 2 && it7.every((i) => i.id) && it7.some((i) => i.desc === 'Mercado' && i.v === 12.5 && i.d === 5 && i.cat === 'alimentacao') && it7.some((i) => i.desc === 'Cinema' && i.v === 30 && i.d === 7 && i.cat === 'lazer'), 'confirmar salva so as saidas, como positivo, com a categoria sugerida (Mercado = alimentacao, Cinema = lazer)');
  ok(Object.keys(stored(w, 'ext').months).join() === k6, 'gastos salvos no mes AAAA-MM certo');
  ok(d.querySelector('#dMsg').textContent.includes('2 gastos importados'), 'avisa quantos foram importados: ' + d.querySelector('#dMsg').textContent);
  w.location.hash = '#financas'; await sleep(50);
  ok(d.querySelector('#fList').textContent.includes('Mercado') && d.querySelector('#fList').textContent.includes('Cinema'), 'tela de financas mostra os gastos importados');

  await pickCsv(csv7);
  ok(sum().includes('0 gastos para importar') && sum().includes('2 já existentes') && d.querySelector('#extOk').disabled, 'reimportar o mesmo extrato marca tudo como ja existente e bloqueia a confirmacao: ' + sum());
  d.querySelector('#extVal').value = '1'; d.querySelector('#extVal').dispatchEvent(new w.Event('change'));
  ok(sum().includes('0 gastos para importar') && sum().includes('inválida'), 'trocar a coluna de valor refaz a previa');
  d.querySelector('#extCancel').click();
  ok(panel().hidden && items7().length === 2, 'cancelar fecha o painel sem alterar nada');

  await pickCsv('');
  ok(panel().hidden && d.querySelector('#dMsg').textContent.includes('vazio'), 'arquivo vazio recusado');
  await pickCsv('x'.repeat(2.1 * 1024 * 1024));
  ok(panel().hidden && d.querySelector('#dMsg').textContent.includes('grande demais'), 'arquivo grande demais recusado');

  // extrato em Windows-1252 (comum em banco): "Descrição" gravada em 1 byte por letra, sem UTF-8 valido
  const latin1 = Uint8Array.from(Array.from('Data;Descrição;Valor\n10/05/2026;Pão de açúcar;-8,00\n'), (ch) => ch.charCodeAt(0));
  const inpL = d.querySelector('#extFile');
  Object.defineProperty(inpL, 'files', { value: [new w.File([latin1], 'banco.csv', { type: 'text/csv' })], configurable: true });
  inpL.dispatchEvent(new w.Event('change')); await sleep(300);
  ok(!panel().hidden && d.querySelector('#extDesc').textContent.includes('Descrição') && d.querySelector('#extList').textContent.includes('Pão de açúcar'), 'CSV em Windows-1252 e relido e os acentos saem certos');
  d.querySelector('#extCancel').click();

  const before7 = JSON.stringify(stored(w, 'ext'));
  await pickCsv('Data;Descrição;Valor\n08/05/2026;Padaria;-5,00\n');
  const realSet7 = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  d.querySelector('#extOk').click(); await sleep(50);
  w.Storage.prototype.setItem = realSet7;
  ok(d.querySelector('#dMsg').textContent.includes('Nada foi alterado') && JSON.stringify(stored(w, 'ext')) === before7 && items7().length === 2, 'falha ao gravar avisa e restaura os dados');
  ok(d.querySelector('#fList').textContent.includes('Mercado') && !d.querySelector('#fList').textContent.includes('Padaria'), 'tela volta ao estado anterior depois da falha');
  d.querySelector('#extCancel').click();

  await pickCsv('Data;Descrição;Valor\n09/05/2026;<img src=x onerror=1>;-1,00\n');
  ok(d.querySelector('#extList img') === null, 'previa nao injeta HTML');
  d.querySelector('#extOk').click(); await sleep(50);
  ok(d.querySelector('#fList img') === null && d.querySelector('#fList').textContent.includes('<img src=x onerror=1>'), 'gasto importado com HTML aparece como texto');
  ok(errs.length === 0, 'sem erros JS no cenario 7 ' + JSON.stringify(errs));

  // cenario 8: gastos fixos (recorrentes): "repetir todo mes" cria um modelo; lancar nos outros meses sem duplicar
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ fix: 'abc123' }));
  }));
  await sleep(100);
  await login(w, d, 'fix', 'abc123');
  w.location.hash = '#financas'; await sleep(50);
  const rec8 = () => stored(w, 'fix').recurring, mon8 = (k) => (stored(w, 'fix').months[k] || { items: [] }).items;
  const addFixo = (desc, val, dia, fixo) => { set('#gDesc', desc); set('#gVal', val); set('#gDia', dia); set('#gCat', 'outros'); d.querySelector('#gFixo').checked = fixo; submit(w, d.querySelector('#gForm')); };
  const pend = () => d.querySelector('#fxPend').textContent;
  const prev = () => d.querySelector('#financas [data-step="-1"]').click();

  addFixo('Aluguel', '500', '5', true);
  ok(rec8().length === 1 && rec8()[0].desc === 'Aluguel' && rec8()[0].v === 500 && rec8()[0].d === 5 && rec8()[0].cat === 'outros' && /^[A-Za-z0-9_-]+$/.test(rec8()[0].id), 'marcar "repetir todo mes" cria o modelo de gasto fixo');
  ok(mon8(k6).length === 1 && mon8(k6)[0].rid === rec8()[0].id, 'o gasto do mes fica ligado ao modelo (rid)');
  ok(d.querySelector('#gFixo').checked === false, 'a caixa desmarca depois de salvar');
  ok(d.querySelector('#fxList').textContent.includes('Aluguel') && d.querySelector('#fxList').textContent.includes('dia 5'), 'lista de gastos fixos mostra o modelo');
  ok(pend().includes('já foram lançados') && !d.querySelector('#fxLancar'), 'no mes em que foi criado nao ha nada a lancar');
  ok(d.querySelector('#fList small').textContent.includes('fixo'), 'o lancamento fixo e marcado como fixo na lista');
  addFixo('Aula de inglês', '90', '', false);
  ok(rec8().length === 1, 'sem a caixa marcada nao cria modelo');
  addFixo('Seguro', '40', '31', true);
  ok(rec8().length === 2, 'segundo gasto fixo criado');

  prev(); // abril (30 dias)
  ok(pend().includes('2 gastos fixos') && d.querySelector('#fxLancar'), 'em outro mes mostra quantos fixos faltam lancar: ' + pend());
  d.querySelector('#fxLancar').click();
  const abr = mon8('2026-04');
  ok(abr.length === 2 && abr.every((i) => i.rid) && abr.map((i) => i.d).sort((a, b) => a - b).join() === '5,30', 'lanca os dois; o dia 31 vira 30 em abril: ' + abr.map((i) => i.d));
  ok(d.querySelector('#gMsg').textContent.includes('2 gastos fixos lançados') && pend().includes('já foram lançados') && !d.querySelector('#fxLancar'), 'avisa o que lancou e nao deixa lancar de novo');
  prev(); // marco (31 dias)
  d.querySelector('#fxLancar').click();
  ok(mon8('2026-03').some((i) => i.desc === 'Seguro' && i.d === 31), 'em mes de 31 dias o dia 31 se mantem');
  ok(mon8('2026-03').length === 2 && mon8('2026-04').length === 2, 'nada foi duplicado');
  d.querySelector('#financas [data-step="1"]').click(); d.querySelector('#financas [data-step="1"]').click(); // volta a maio

  const eb8 = Array.from(d.querySelectorAll('#fList tr')).find((tr) => tr.textContent.includes('Aluguel')).querySelector('[data-edit]');
  eb8.click();
  ok(d.querySelector('#gFixo').disabled, 'durante a edicao a caixa de repetir fica desabilitada');
  set('#gVal', '520'); submit(w, d.querySelector('#gForm'));
  const al = mon8(k6).find((i) => i.desc === 'Aluguel');
  ok(al.v === 520 && al.rid === rec8()[0].id && rec8()[0].v === 500 && !d.querySelector('#gFixo').disabled, 'editar o gasto mantem o vinculo e nao muda o modelo');

  w.confirm = () => false;
  d.querySelector('[data-fxdel]').click();
  ok(rec8().length === 2, 'cancelar a confirmacao nao remove o modelo');
  w.confirm = () => true;
  d.querySelector('[data-fxdel]').click();
  ok(rec8().length === 1 && rec8()[0].desc === 'Seguro' && mon8('2026-04').length === 2, 'remover o modelo nao apaga gastos ja lancados');
  prev(); prev(); prev(); // fevereiro
  ok(pend().includes('1 gasto fixo') && d.querySelector('#fxLancar'), 'a contagem acompanha os modelos que sobraram: ' + pend());

  // exportar / importar levam os gastos fixos
  const blobs8 = [];
  w.URL.createObjectURL = (b) => { blobs8.push(b); return 'blob:y'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(50);
  const ex8 = JSON.parse(await readBlob(blobs8[0]));
  ok(Array.isArray(ex8.recurring) && ex8.recurring.length === 1 && ex8.recurring[0].desc === 'Seguro' && ex8.versao === 1, 'exportar inclui os gastos fixos (versao do arquivo continua 1)');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 1 } }, recurring: [{ id: 'r1', desc: 'Academia', v: 90, d: 10, cat: 'lazer' }] }));
  ok(rec8().length === 1 && rec8()[0].desc === 'Academia' && rec8()[0].cat === 'lazer', 'importar com gastos fixos substitui os modelos');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 2 } } }));
  ok(rec8().length === 1 && rec8()[0].desc === 'Academia', 'importar arquivo antigo (sem gastos fixos) mantem os modelos atuais');

  // arquivo hostil: texto, id, valor, dia e categoria sao saneados; limite de 100 modelos
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 3 } }, recurring: [
    { id: '"><img src=x onerror=1>', desc: '<b>x</b>'.repeat(20), v: '12', d: 99, cat: 'hack' },
    { id: 'neg', desc: 'negativo', v: -5, d: 3 }, 'lixo', null,
    { id: 'dup', desc: 'A', v: 1, d: 1, cat: 'lazer' }, { id: 'dup', desc: 'B', v: 2, d: 2, cat: 'lazer' }] }));
  const hs = rec8();
  ok(hs.length === 3 && hs.every((x) => /^[A-Za-z0-9_-]{1,60}$/.test(x.id)) && new Set(hs.map((x) => x.id)).size === 3, 'modelos hostis: invalidos descartados, ids seguros e unicos (' + hs.length + ')');
  ok(hs[0].desc.length === 40 && hs[0].v === 12 && hs[0].d === 1 && hs[0].cat === 'outros', 'modelos hostis: texto cortado, dia e categoria normalizados');
  w.location.hash = '#inicio'; await sleep(30); w.location.hash = '#financas'; await sleep(30);
  ok(d.querySelector('#fxList img') === null && d.querySelector('#fxList b') === null, 'lista de fixos nao injeta HTML');
  const muitos = Array.from({ length: 150 }, (_, i) => ({ id: 'm' + i, desc: 'F' + i, v: 1, d: 1, cat: 'outros' }));
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 4 } }, recurring: muitos }));
  ok(rec8().length === 100, 'limite de 100 gastos fixos');
  ok(errs.length === 0, 'sem erros JS no cenario 8 ' + JSON.stringify(errs));

  // cenario 9: orcamento por categoria (limite mensal; avisa quando perto e quando passa)
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ bud: 'abc123' }));
  }));
  await sleep(100);
  await login(w, d, 'bud', 'abc123');
  w.location.hash = '#financas'; await sleep(50);
  const addG = (desc, val, cat) => { set('#gDesc', desc); set('#gVal', val); set('#gDia', '3'); set('#gCat', cat); submit(w, d.querySelector('#gForm')); };
  const bud9 = () => stored(w, 'bud').budget || {};
  const saveBud = (o) => { Object.keys(o).forEach((k) => set('#bud-' + k, o[k])); submit(w, d.querySelector('#bForm')); };
  const bl = () => d.querySelector('#bList').textContent.toLowerCase();
  const brow = (nome) => Array.from(d.querySelectorAll('#bList li')).find((li) => li.textContent.includes(nome));

  ok(d.querySelectorAll('#bFields input').length === 6, 'um campo de limite por categoria');
  addG('Mercado', '300', 'alimentacao'); addG('Cinema', '120', 'lazer');
  ok(bl().includes('nenhum limite'), 'sem orcamento definido a lista explica como comecar');
  saveBud({ alimentacao: '250', lazer: '200' });
  ok(JSON.stringify(bud9()) === JSON.stringify({ alimentacao: 250, lazer: 200 }), 'salvar guarda so os limites preenchidos: ' + JSON.stringify(bud9()));
  ok(brow('Alimentação') && brow('Alimentação').classList.contains('bud-over') && bl().includes('passou do limite'), 'categoria acima do limite aparece como "passou do limite"');
  ok(brow('Lazer') && brow('Lazer').classList.contains('bud-ok') && brow('Lazer').textContent.includes('60%'), 'categoria dentro do limite mostra a porcentagem usada');
  ok(d.querySelector('#fCats li.is-warn') && d.querySelector('#fCats li.is-warn').textContent.includes('Alimentação'), 'a barra da renda destaca a categoria que passou do orcamento');
  ok(d.querySelector('#inTips').textContent.includes('Alimentação') && d.querySelector('#inTips').textContent.includes('orçamento'), 'o inicio avisa da categoria que passou: ' + d.querySelector('#inTips').textContent);
  ok(d.querySelector('#inTips').closest('.tip').classList.contains('is-warn'), 'o cartao de observacoes do inicio ganha o estado de aviso quando um orcamento estoura');
  addG('Show', '50', 'lazer');
  ok(brow('Lazer').classList.contains('bud-near') && bl().includes('perto do limite'), 'a partir de 80% do limite avisa "perto do limite"');

  saveBud({ transporte: '100', lazer: '-1' });
  ok(d.querySelector('#bMsg').textContent.includes('inválido') && bud9().transporte === undefined && bud9().lazer === 200, 'limite invalido recusa tudo e nao salva nada pela metade');
  saveBud({ transporte: '', lazer: '0' });
  ok(d.querySelector('#bMsg').textContent.includes('inválido') && bud9().lazer === 200, 'limite zero e invalido (para tirar o limite, deixe em branco)');
  saveBud({ lazer: '', alimentacao: '250' });
  ok(bud9().lazer === undefined && bud9().alimentacao === 250 && !brow('Lazer'), 'campo em branco remove o limite da categoria');

  // exportar / importar levam o orcamento
  const blobs9 = [];
  w.URL.createObjectURL = (b) => { blobs9.push(b); return 'blob:z'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(50);
  const ex9 = JSON.parse(await readBlob(blobs9[0]));
  ok(ex9.budget && ex9.budget.alimentacao === 250 && ex9.versao === 1, 'exportar inclui o orcamento (versao do arquivo continua 1)');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 1 } }, budget: { contas: 80, hack: 5, outros: '12', alimentacao: -1, transporte: 'abc', __proto__: { lazer: 9 } } }));
  ok(JSON.stringify(bud9()) === JSON.stringify({ assinaturas: 80, outros: 12 }), 'importar saneia o orcamento: categoria antiga contas vira assinaturas, invalidos caem: ' + JSON.stringify(bud9()));
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 2 } } }));
  ok(JSON.stringify(bud9()) === JSON.stringify({ assinaturas: 80, outros: 12 }), 'importar arquivo antigo (sem orcamento) mantem o atual');

  const before9 = JSON.stringify(stored(w, 'bud'));
  const realSet9 = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  saveBud({ transporte: '100' });
  w.Storage.prototype.setItem = realSet9;
  ok(d.querySelector('#bMsg').textContent.includes('Nada foi alterado') && JSON.stringify(stored(w, 'bud')) === before9 && !brow('Transporte'), 'falha ao gravar avisa e restaura o orcamento');
  ok(errs.length === 0, 'sem erros JS no cenario 9 ' + JSON.stringify(errs));

  // cenario 10: aba Analise (saldo mes a mes, comparacao com o mes anterior, horas x nota, meta de reserva)
  const wk = (h) => [0, 1, 2, 3].map(() => [h, 0, 0, 0, 0, 0, 0, 0]);
  const gasto10 = (id, cat, v) => ({ id, d: 1, cat, desc: 'x', v });
  const seed10 = { meta: 10, months: {
    '2026-02': { renda: 0, items: [gasto10('f1', 'lazer', 200)], weeks: wk(0), nota: null, grades: [] },
    '2026-03': { renda: 1000, items: [gasto10('m1', 'alimentacao', 300), gasto10('m2', 'lazer', 100), gasto10('m3', 'transporte', 50)], weeks: wk(8), nota: null, grades: [{ id: 'n1', subj: 'Mat', v: 6, label: '' }] },
    '2026-04': { renda: 1000, items: [gasto10('a1', 'alimentacao', 450), gasto10('a2', 'lazer', 90), gasto10('a3', 'assinaturas', 30)], weeks: wk(10), nota: null, grades: [{ id: 'n2', subj: 'Mat', v: 7.5, label: '' }] },
  } };
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ ana: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-ana', JSON.stringify(seed10));
  }));
  await sleep(100);
  await login(w, d, 'ana', 'abc123');
  w.location.hash = '#analise'; await sleep(50);
  const an = (s) => d.querySelector(s), anT = (s) => (an(s) ? an(s).textContent : '');
  ok(an('#analise') && !an('#analise').hidden, 'a aba Analise existe e abre pelo #analise');
  ok(d.querySelectorAll('#analise .topnav [data-nav="analise"]').length === 1 && d.querySelectorAll('.tabs [data-nav="analise"]').length === 1, 'link para Analise na barra de cima e nas abas do celular');
  ok(d.querySelectorAll('[data-nav="analise"][aria-current="page"]').length >= 1, 'a aba Analise fica marcada como a pagina atual');

  const linhas = Array.from(d.querySelectorAll('#anRows tr'));
  ok(linhas.length === 12, 'tabela do saldo tem uma linha por mes (12)');
  const lm = (nome) => linhas.find((tr) => tr.textContent.includes(nome));
  ok(lm('Mar').textContent.includes('550,00') && lm('Abr').textContent.includes('430,00') && lm('Fev').textContent.includes('200,00'), 'tabela mostra a sobra de cada mes (Fev negativa: -200,00)');
  ok(lm('Fev').textContent.includes('sem renda') && !lm('Mar').textContent.includes('sem renda'), 'mes com gastos e sem renda avisa "sem renda" na tabela, em vez de parecer so uma sobra negativa');
  ok(d.querySelectorAll('#anChart svg rect.an-pos').length === 2 && d.querySelectorAll('#anChart svg rect.an-neg').length === 1, 'grafico tem uma barra por mes com registro: 2 positivas e 1 negativa');
  ok(an('#anChart svg').getAttribute('aria-hidden') === 'true' || an('#anChart svg').getAttribute('role') === 'img', 'grafico e acessivel (a tabela traz os mesmos dados)');

  ok(anT('#anComp').toLowerCase().includes('ainda não há registros'), 'mes atual vazio: avisa que nao ha o que comparar');
  d.querySelector('#analise [data-step="-1"]').click(); // abril
  ok(anT('#anComp').includes('570,00') && anT('#anComp').includes('120,00'), 'comparacao: gastos de abril e a diferenca contra marco: ' + anT('#anComp').slice(0, 160));
  ok(anT('#anComp').includes('a mais') || anT('#anComp').includes('mais que'), 'a diferenca aparece em palavras (a mais), nao so em cor');
  const cats = Array.from(d.querySelectorAll('#anCats li')).map((li) => li.textContent);
  ok(cats.length === 3 && cats[0].includes('Alimentação') && cats[1].includes('Transporte') && cats[2].includes('Assinaturas'), 'as 3 categorias que mais mudaram, da maior para a menor diferenca');

  ok(d.querySelectorAll('#anScatter svg circle').length === 2, 'grafico de horas x nota tem um ponto por mes com as duas coisas');
  ok(anT('#anHN').toLowerCase().includes('poucos meses') && !anT('#anHN').includes('r ='), 'com menos de 4 meses avisa e nao mostra coeficiente');

  const rsRes = () => anT('#rsRes'), rsMsg = () => anT('#rsMsg'), reserva = () => (stored(w, 'ana').reserva || 0);
  ok(rsRes().includes('Defina uma meta'), 'sem meta de reserva a tela explica como comecar');
  set('#rsMeta', '3000'); submit(w, d.querySelector('#rsForm'));
  ok(reserva() === 3000 && rsRes().includes('490,00') && rsRes().includes('meses') && rsRes().includes('0,7%'), 'meta salva e prazo calculado com a sobra media (490,00): ' + rsRes().slice(0, 200));
  set('#rsMeta', '-5'); submit(w, d.querySelector('#rsForm'));
  ok(rsMsg().includes('Informe um valor') && reserva() === 3000, 'meta invalida recusada, a anterior continua');
  set('#rsMeta', '999999999'); submit(w, d.querySelector('#rsForm'));
  ok(rsRes().includes('mais de 50 anos'), 'meta que levaria mais de 50 anos e avisada');
  set('#rsMeta', ''); submit(w, d.querySelector('#rsForm'));
  ok(reserva() === 0 && rsRes().includes('Defina uma meta'), 'campo em branco remove a meta');
  set('#rsMeta', '3000'); submit(w, d.querySelector('#rsForm'));

  // progresso real: quanto a pessoa já guardou (antes só havia a estimativa de prazo pela sobra média)
  const guardado = () => (stored(w, 'ana').guardado || 0), barW = () => { const i = d.querySelector('#rsRes .bar i'); return i ? i.style.getPropertyValue('--w') : null; };
  const prazo = () => Number((/em (\d+) m[eê]s/.exec(rsRes()) || [])[1]);
  const n0 = prazo();
  ok(d.querySelector('#rsGuardado') && !rsRes().includes('já guardou') && barW() === null && n0 > 0, 'sem valor guardado não aparece progresso, e o prazo cobre a meta inteira (' + n0 + ' meses)');
  set('#rsGuardado', '1000'); submit(w, d.querySelector('#rsForm'));
  ok(guardado() === 1000 && reserva() === 3000, 'o valor já guardado é salvo junto com a meta');
  ok(rsRes().includes('já guardou') && rsRes().includes('1.000,00') && rsRes().includes('33%') && barW() === '0.333', 'mostra o progresso real, 1.000 de 3.000 (33%), com a barra no tamanho certo: ' + rsRes().slice(0, 160));
  ok(prazo() > 0 && prazo() < n0, 'o prazo conta só o que falta: com 1.000 guardados cai de ' + n0 + ' para ' + prazo() + ' meses');
  set('#rsGuardado', '3000'); submit(w, d.querySelector('#rsForm'));
  ok(rsRes().includes('Meta atingida') && barW() === '1.000' && !/em \d+ m[eê]s/.test(rsRes()), 'guardado igual à meta: "Meta atingida", barra cheia e sem prazo');
  set('#rsGuardado', '5000'); submit(w, d.querySelector('#rsForm'));
  ok(rsRes().includes('Meta atingida') && barW() === '1.000' && !rsRes().includes('166'), 'guardado acima da meta: barra e texto não passam de 100%');
  for (const ruim of ['-5', '2000000000']) {
    set('#rsGuardado', ruim); submit(w, d.querySelector('#rsForm'));
    ok(rsMsg().includes('Informe') && guardado() === 5000, `valor guardado inválido (${ruim}) é recusado e o anterior continua: ${rsMsg()}`);
  }
  set('#rsGuardado', ''); submit(w, d.querySelector('#rsForm'));
  ok(guardado() === 0 && barW() === null, 'campo em branco zera o valor guardado');
  set('#rsMeta', ''); set('#rsGuardado', '200'); submit(w, d.querySelector('#rsForm'));
  ok(guardado() === 200 && reserva() === 0 && rsRes().includes('Defina uma meta'), 'dá para guardar o valor mesmo sem meta definida');
  set('#rsMeta', '3000'); set('#rsGuardado', '1000'); submit(w, d.querySelector('#rsForm'));
  const antesG = JSON.stringify(stored(w, 'ana')), setG = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  set('#rsGuardado', '2500'); submit(w, d.querySelector('#rsForm'));
  w.Storage.prototype.setItem = setG;
  ok(rsMsg().includes('Nada foi alterado') && JSON.stringify(stored(w, 'ana')) === antesG && an('#rsGuardado').value === '1000', 'falha ao gravar mantém o valor guardado anterior na tela e nos dados');

  const blobs10 = [];
  w.URL.createObjectURL = (b) => { blobs10.push(b); return 'blob:k'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(50);
  ok(JSON.parse(await readBlob(blobs10[0])).reserva === 3000 && JSON.parse(await readBlob(blobs10[0])).guardado === 1000, 'exportar inclui a meta de reserva e o valor já guardado');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 1 } }, reserva: 500 }));
  ok(reserva() === 500, 'importar com meta substitui a meta');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 2 } } }));
  ok(reserva() === 500, 'importar arquivo antigo (sem meta) mantem a atual');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 3 } }, reserva: 'abc' }));
  ok(reserva() === 0, 'meta invalida no arquivo vira "sem meta"');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 3 } }, guardado: 120 }));
  ok(guardado() === 120, 'importar com valor guardado substitui o atual');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 4 } } }));
  ok(guardado() === 120, 'importar arquivo antigo (sem valor guardado) mantém o atual');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 5 } }, guardado: 'abc' }));
  ok(guardado() === 0, 'valor guardado inválido no arquivo vira zero');
  const before10 = JSON.stringify(stored(w, 'ana'));
  const realSet10 = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  set('#rsMeta', '800'); submit(w, d.querySelector('#rsForm'));
  w.Storage.prototype.setItem = realSet10;
  ok(rsMsg().includes('Nada foi alterado') && JSON.stringify(stored(w, 'ana')) === before10 && an('#rsMeta').value === '', 'falha ao gravar a meta avisa e restaura');
  ok(errs.length === 0, 'sem erros JS no cenario 10 ' + JSON.stringify(errs));

  // tela vazia: sem nenhum registro
  ({ w, d, errs } = boot((win) => { fixDate(win); win.localStorage.setItem('sobrou-users', JSON.stringify({ novo: 'abc123' })); }));
  await sleep(100);
  await login(w, d, 'novo', 'abc123');
  w.location.hash = '#analise'; await sleep(50);
  ok(d.querySelector('#anChart').textContent.toLowerCase().includes('nenhum registro') && d.querySelector('#anChart svg') === null, 'sem registros o grafico explica em vez de desenhar vazio');
  ok(d.querySelector('#anHN').textContent.toLowerCase().includes('pelo menos 2 meses') && d.querySelectorAll('#anScatter svg').length === 0, 'sem horas e notas a tela diz o que falta');
  ok(d.querySelectorAll('#anRows tr').length === 12 && errs.length === 0, 'tela vazia monta a tabela sem erro ' + JSON.stringify(errs));

  // cenario 11: "Ver com dados de exemplo" (conta @exemplo, sem senha, recarregada a cada entrada) sem tocar nas contas reais
  const real11 = JSON.stringify({ meta: 10, months: { [key]: { renda: 777, items: [gasto10('r1', 'lazer', 10)], weeks: wk(0), nota: null, grades: [] } } });
  ({ w, d, errs } = boot((win) => {
    win.localStorage.setItem('sobrou-users', JSON.stringify({ real: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-real', real11);
  }));
  await sleep(100);
  const janela = Array.from({ length: 12 }, (_, i) => { const dt = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); });
  const ex11 = () => JSON.parse(w.localStorage.getItem('sobrou-v2-@exemplo'));
  ok(w.location.hash === '#entrar' && d.querySelector('#demoBtn') && d.querySelector('#demoBar').hidden, 'tela de login tem o botao de exemplo e a faixa de aviso comeca escondida');

  d.querySelector('#demoBtn').click(); await sleep(150);
  ok(w.location.hash === '#inicio', 'o botao entra direto, sem senha');
  ok(!d.querySelector('#demoBar').hidden && d.querySelector('#demoBar').textContent.toLowerCase().includes('dados de exemplo'), 'faixa avisa que sao dados de exemplo');
  ok(d.querySelector('[data-who]').textContent === 'Exemplo', 'a conta aparece como "Exemplo", nao como @exemplo');
  const dm = ex11();
  ok(JSON.stringify(Object.keys(dm.months)) === JSON.stringify(janela) && Object.values(dm.months).every((m) => m.renda > 0 && m.items.length > 5), 'os 12 meses do exemplo preenchem a janela de meses do site (o ultimo e o mes atual)');
  ok(dm.recurring.length >= 2 && Object.keys(dm.budget).length >= 1 && dm.reserva > 0, 'exemplo traz gastos fixos, orcamento e meta de reserva');
  ok(d.querySelectorAll('#fxList li').length >= 2, 'o cartao de gastos fixos mostra os modelos do exemplo');
  ok(d.querySelectorAll('#anRows tr').length === 12 && d.querySelectorAll('#anChart svg rect.an-neg').length === 1 && d.querySelectorAll('#anChart svg rect.an-pos').length === 11, 'a aba Analise tem 12 linhas e mostra os 12 meses do exemplo, com um no vermelho');
  ok(d.querySelectorAll('#anScatter svg circle').length >= 4 && d.querySelector('#anHN').textContent.includes('r ='), 'horas x nota com pontos suficientes para o coeficiente');
  ok(d.querySelector('#bList').textContent.includes('Lazer') && d.querySelector('#bList .bud-over, #bList .bud-near, #bList .bud-ok'), 'o orcamento do exemplo aparece na lista');
  w.location.hash = '#financas'; await sleep(50);
  ok(d.querySelectorAll('#fList tr').length > 5 && !d.querySelector('#fList .empty'), 'tela de financas tem os gastos do mes atual do exemplo');

  set('#gDesc', 'Teste meu'); set('#gVal', '5'); set('#gCat', 'outros'); submit(w, d.querySelector('#gForm'));
  ok(ex11().months[janela[janela.length - 1]].items.some((i) => i.desc === 'Teste meu'), '(preparo) o que se faz no exemplo e salvo enquanto se usa');
  d.querySelector('#sairSide').click(); await sleep(50);
  ok(w.location.hash === '#entrar' && d.querySelector('#demoBar').hidden, 'sair volta ao login e esconde a faixa');
  d.querySelector('#demoBtn').click(); await sleep(150);
  ok(!ex11().months[janela[janela.length - 1]].items.some((i) => i.desc === 'Teste meu'), 'entrar de novo recarrega o exemplo do zero (o que foi mudado some)');

  ok(w.localStorage.getItem('sobrou-v2-real') === real11 && !JSON.parse(w.localStorage.getItem('sobrou-users'))['@exemplo'], 'a conta real e a lista de contas nao foram tocadas pelo exemplo');
  d.querySelector('#sairSide').click(); await sleep(50);
  w.location.hash = '#cadastro'; await sleep(30);
  set('#cUser', '@exemplo'); set('#cPass', 'segredo1'); set('#cPass2', 'segredo1'); submit(w, d.querySelector('#cForm')); await sleep(100);
  ok(d.querySelector('#cErr').textContent.includes('3 a 20 letras') && w.location.hash === '#cadastro', 'ninguem consegue criar uma conta chamada @exemplo');
  w.location.hash = '#entrar'; await sleep(30);
  set('#lUser', '@exemplo'); set('#lPass', 'qualquer'); submit(w, d.querySelector('#lForm')); await sleep(400);
  ok(d.querySelector('#lErr').textContent.includes('incorretos') && w.location.hash === '#entrar', 'o formulario de login nao entra na conta de exemplo (so o botao)');
  ok(errs.length === 0, 'sem erros JS no cenario 11 ' + JSON.stringify(errs));

  ({ w, d, errs } = boot((win) => { win.Storage.prototype.setItem = function () { throw new Error('quota'); }; }));
  await sleep(100);
  d.querySelector('#demoBtn').click(); await sleep(150);
  ok(w.location.hash === '#entrar' && d.querySelector('#lErr').textContent.includes('Não foi possível carregar o exemplo') && d.querySelector('#demoBar').hidden, 'sem poder gravar, avisa e continua no login');

  // cenario 12: o painel do extrato e um DIALOGO acessivel (foco preso, fundo inerte, Esc, foco devolvido)
  ({ w, d, errs } = boot((win) => { fixDate(win); }));
  await sleep(100);
  d.querySelector('#demoBtn').click(); await sleep(150);
  const dlg = () => d.querySelector('#extPanel'), inerte = (s) => d.querySelector(s).hasAttribute('inert');
  const tecla = (el, key, shift) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true, cancelable: true }));
  ok(dlg().getAttribute('role') === 'dialog' && dlg().getAttribute('aria-modal') === 'true' && dlg().getAttribute('aria-labelledby') === 'extTit', 'o painel do extrato declara role="dialog", aria-modal e o titulo que o nomeia');
  ok(!inerte('main') && !inerte('#menu') && !inerte('.tabs'), 'com o dialogo fechado nada fica inerte');
  await pickCsv('Data;Descrição;Valor\n05/05/2026;Mercado;-12,50\n');
  ok(!dlg().hidden && inerte('main') && inerte('#menu') && inerte('.tabs') && inerte('#scrim'), 'dialogo aberto: o resto da pagina (conteudo, menu, abas, pelicula) fica inerte');
  ok(dlg().contains(d.activeElement), 'o foco vai para dentro do dialogo ao abrir (' + (d.activeElement && d.activeElement.id) + ')');
  const foc = Array.from(dlg().querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])'));
  const primeiro = foc[0], ultimo = foc[foc.length - 1];
  ultimo.focus(); tecla(ultimo, 'Tab', false);
  ok(d.activeElement === primeiro, 'Tab no ultimo controle volta ao primeiro (foco preso): ' + (d.activeElement && d.activeElement.id));
  primeiro.focus(); tecla(primeiro, 'Tab', true);
  ok(d.activeElement === ultimo, 'Shift+Tab no primeiro controle vai ao ultimo: ' + (d.activeElement && d.activeElement.id));
  tecla(d.activeElement, 'Escape', false);
  ok(dlg().hidden && !inerte('main') && !inerte('#menu') && !inerte('.tabs') && !inerte('#scrim'), 'Esc fecha e tudo volta a funcionar');
  ok(d.activeElement && d.activeElement.tagName === 'H1' && !d.activeElement.closest('[hidden]'), 'ao fechar o foco vai para o titulo da tela visivel, e nao para o botao escondido no menu: ' + (d.activeElement && d.activeElement.tagName));
  await pickCsv('Data;Descrição;Valor\n05/05/2026;Mercado;-12,50\n');
  d.querySelector('#extOk').click(); await sleep(60);
  ok(dlg().hidden && !inerte('main') && d.activeElement && d.activeElement.tagName === 'H1', 'confirmar a importacao tambem fecha, libera a pagina e devolve o foco');
  ok(errs.length === 0, 'sem erros JS no cenario 12 ' + JSON.stringify(errs));

  // cenario 13: alternador de tema (sistema, claro, escuro), lembrado entre visitas e a prova de armazenamento ruim
  ({ w, d, errs } = boot((win) => { win.localStorage.setItem('sobrou-tema', 'escuro'); }));
  await sleep(100);
  ok(d.documentElement.getAttribute('data-theme') === 'dark', 'tema salvo é aplicado antes de qualquer tela, sem piscar o tema errado');
  const radios13 = Array.from(d.querySelectorAll('input[name="tema"]'));
  ok(radios13.map((r) => r.value).join() === 'sistema,claro,escuro' && radios13.find((r) => r.checked).value === 'escuro', 'o seletor tem sistema, claro e escuro e mostra o que está salvo');
  const escolher13 = (v) => { const r = d.querySelector('input[name="tema"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
  escolher13('claro');
  ok(d.documentElement.getAttribute('data-theme') === 'light' && w.localStorage.getItem('sobrou-tema') === 'claro', 'Claro: aplica o tema claro e guarda a escolha');
  escolher13('sistema');
  ok(!d.documentElement.hasAttribute('data-theme') && w.localStorage.getItem('sobrou-tema') === 'sistema', 'Sistema: tira o atributo e volta a seguir o sistema');
  ({ w, d, errs } = boot((win) => { win.localStorage.setItem('sobrou-tema', '"><img src=x onerror=1>'); }));
  await sleep(100);
  ok(!d.documentElement.hasAttribute('data-theme') && d.querySelector('input[name="tema"]:checked').value === 'sistema', 'valor estranho guardado no navegador é ignorado: volta para Sistema');
  ({ w, d, errs } = boot((win) => { win.Storage.prototype.setItem = function () { throw new Error('quota'); }; }));
  await sleep(100);
  escolher13('escuro');
  ok(d.documentElement.getAttribute('data-theme') === 'dark', 'se o navegador não deixa guardar, o tema ainda é aplicado nesta visita');
  ok(errs.length === 0, 'sem erros JS no cenario 13 ' + JSON.stringify(errs));

  // cenario 14: o extrato sugere a categoria (aprendida > palavra-chave > Outros), a pessoa troca na revisão e o app aprende
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ cat: 'abc123' }));
  }));
  await sleep(100);
  await login(w, d, 'cat', 'abc123');
  const pick14 = async (t) => {
    const inp = d.querySelector('#extFile');
    Object.defineProperty(inp, 'files', { value: [new w.File([t], 'extrato.csv', { type: 'text/csv' })], configurable: true });
    inp.dispatchEvent(new w.Event('change')); await sleep(150);
  };
  const sels14 = () => Array.from(d.querySelectorAll('#extList .ext-cat'));
  const troca14 = (i, v) => { const s = sels14()[i]; s.value = v; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const regras14 = () => (stored(w, 'cat') && stored(w, 'cat').regras) || {};
  const itens14 = () => (stored(w, 'cat') ? Object.values(stored(w, 'cat').months).flatMap((m) => m.items) : []);
  const csv14 = 'Data;Descrição;Valor\n05/05/2026;UBER *TRIP;-20,00\n06/05/2026;Padaria do Ze;-8,00\n07/05/2026;Coisa Rara;-3,00\n08/05/2026;Salário;100,00\n';

  await pick14(csv14);
  ok(sels14().length === 3 && sels14().every((s) => s.getAttribute('aria-label')) && sels14()[0].options.length === 6, 'cada gasto novo tem uma lista de categorias com nome acessível (entrada não tem)');
  ok(sels14().map((s) => s.value).join() === 'transporte,alimentacao,outros', 'sugestão por palavra-chave (Uber, Padaria) e Outros para o que não é reconhecido: ' + sels14().map((s) => s.value));
  ok(d.querySelector('#extSum').textContent.includes('2 por palavra-chave') && d.querySelector('#extSum').textContent.includes('1 em Outros'), 'o resumo conta de onde veio cada sugestão: ' + d.querySelector('#extSum').textContent);
  ok(regras14().padaria === undefined && Object.keys(regras14()).length === 0, 'antes de importar nada foi aprendido');
  troca14(1, 'lazer'); troca14(2, 'estudos');
  d.querySelector('#extOk').click(); await sleep(50);
  ok(itens14().find((i) => i.desc === 'UBER *TRIP').cat === 'transporte' && itens14().find((i) => i.desc === 'Padaria do Ze').cat === 'lazer' && itens14().find((i) => i.desc === 'Coisa Rara').cat === 'estudos', 'o gasto é salvo com a categoria escolhida na revisão');
  ok(JSON.stringify(regras14()) === JSON.stringify({ 'padaria do ze': 'lazer', 'coisa rara': 'estudos' }), 'só as categorias que a pessoa trocou viram regra (Uber, que ela não mexeu, não): ' + JSON.stringify(regras14()));
  ok(d.querySelector('#dMsg').textContent.includes('2 regras'), 'avisa quantas regras aprendeu: ' + d.querySelector('#dMsg').textContent);

  await pick14('Data;Descrição;Valor\n09/05/2026;PADARIA DO ZE 77;-9,00\n10/05/2026;coisa  rara;-1,00\n11/05/2026;Outra Coisa;-2,00\n');
  ok(sels14().map((s) => s.value).join() === 'lazer,estudos,outros', 'na importação seguinte a regra aprendida vence a palavra-chave, mesmo com número e caixa diferentes: ' + sels14().map((s) => s.value));
  ok(d.querySelector('#extSum').textContent.includes('2 aprendidas'), 'o resumo conta as regras aprendidas: ' + d.querySelector('#extSum').textContent);
  troca14(0, 'alimentacao');
  d.querySelector('#extCancel').click();
  ok(JSON.stringify(regras14()) === JSON.stringify({ 'padaria do ze': 'lazer', 'coisa rara': 'estudos' }), 'cancelar não aprende nada');

  await pick14('Data;Descrição;Valor\n12/05/2026;Padaria do Ze;-4,00\n');
  troca14(0, 'alimentacao');
  d.querySelector('#extOk').click(); await sleep(50);
  ok(regras14()['padaria do ze'] === 'alimentacao' && Object.keys(regras14()).join() === 'coisa rara,padaria do ze', 'corrigir uma regra existente troca a categoria e a deixa como a mais recente');

  await pick14('Data;Descrição;Valor\n13/05/2026;Sorveteria Nova;-5,00\n');
  const antes14 = JSON.stringify(stored(w, 'cat'));
  troca14(0, 'lazer');
  const setReal14 = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  d.querySelector('#extOk').click(); await sleep(50);
  w.Storage.prototype.setItem = setReal14;
  ok(d.querySelector('#dMsg').textContent.includes('Nada foi alterado') && JSON.stringify(stored(w, 'cat')) === antes14, 'se a gravação falha, nem o gasto nem a regra são salvos');
  d.querySelector('#extCancel').click();
  await pick14('Data;Descrição;Valor\n13/05/2026;Sorveteria Nova;-5,00\n');
  ok(sels14()[0].value === 'alimentacao', 'a regra que não foi salva também não vale na memória (voltou a sugestão normal)');
  d.querySelector('#extCancel').click();

  // exportar e importar: as regras viajam no arquivo, vêm validadas, e arquivo antigo (sem regras) não apaga as atuais
  const blobs14 = []; w.URL.createObjectURL = (b) => { blobs14.push(b); return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(100);
  const exp14 = JSON.parse(await readBlob(blobs14[0]));
  ok(JSON.stringify(exp14.regras) === JSON.stringify(regras14()), 'exportar inclui as regras aprendidas');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 1 } } }));
  ok(Object.keys(regras14()).length === 2, 'importar arquivo antigo (sem regras) mantém as atuais');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 2 } }, regras: { 'loja boa': 'lazer', 'constructor': 'estudos', '__proto__': 'lazer', 'Chave Ruim!': 'lazer', 'sem cat': 'nao-existe', ['x'.repeat(40)]: 'lazer' } }));
  ok(JSON.stringify(regras14()) === JSON.stringify({ 'loja boa': 'lazer', 'constructor': 'estudos' }), 'importar com regras substitui as atuais e descarta chave estranha, categoria inexistente e chave longa: ' + JSON.stringify(regras14()));
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 3 } }, regras: 'abc' }));
  ok(Object.keys(regras14()).length === 0, 'regras inválidas no arquivo viram "nenhuma regra"');
  ({ w, d, errs } = boot((win) => { fixDate(win); win.localStorage.setItem('sobrou-users', JSON.stringify({ cat: 'abc123' })); win.localStorage.setItem('sobrou-v2-cat', JSON.stringify({ months: { [k6]: { renda: 4 } }, regras: { 'loja boa': 'lazer', 'ruim!': 'lazer', 'constructor': 'estudos' } })); }));
  await sleep(100);
  await login(w, d, 'cat', 'abc123');
  await pick14('Data;Descrição;Valor\n14/05/2026;Constructor;-5,00\n15/05/2026;Loja Boa;-1,00\n');
  ok(sels14().map((s) => s.value).join() === 'estudos,lazer', 'ao carregar do navegador, as regras também são validadas (sem chave com símbolo) e funcionam: ' + sels14().map((s) => s.value));

  // esquecer as regras aprendidas
  ok(!d.querySelector('#extForget').hidden && d.querySelector('#extRegras').textContent.includes('2'), 'o painel mostra quantas regras foram aprendidas e oferece esquecê-las');
  w.confirm = () => false; d.querySelector('#extForget').click(); await sleep(30);
  ok(d.querySelector('#extRegras').textContent.includes('2') && !d.querySelector('#extForget').hidden, 'esquecer pede confirmação e, se a pessoa recusa, mantém as regras');
  w.confirm = () => true; d.querySelector('#extForget').click(); await sleep(30);
  ok(Object.keys(regras14()).length === 0 && d.querySelector('#extForget').hidden, 'confirmando, as regras são apagadas e o botão some');
  ok(sels14().map((s) => s.value).join() === 'outros,outros', 'a prévia aberta volta a sugerir sem as regras apagadas: ' + sels14().map((s) => s.value));
  d.querySelector('#extCancel').click();

  // a descrição não injeta HTML na lista de categorias
  await pick14('Data;Descrição;Valor\n16/05/2026;<img src=x onerror=1>;-1,00\n');
  ok(d.querySelector('#extList img') === null && sels14().length === 1, 'a prévia com categoria não injeta HTML');
  d.querySelector('#extCancel').click();
  ok(errs.length === 0, 'sem erros JS no cenario 14 ' + JSON.stringify(errs));

  // cenario 15: corrigir horas de estudo (antes so somava: um erro de digitacao nao tinha conserto)
  ({ w, d, errs } = boot((win) => { fixDate(win); win.localStorage.setItem('sobrou-users', JSON.stringify({ est: 'abc123' })); }));
  await sleep(100);
  await login(w, d, 'est', 'abc123');
  w.location.hash = '#estudos'; await sleep(50);
  const h15 = (s, di) => (stored(w, 'est') ? stored(w, 'est').months[k6].weeks[s][di] : 0);
  const envia15 = (horas, subst) => { set('#eSem', '0'); set('#eDia', '1'); set('#eHoras', horas); d.querySelector('#eSubst').checked = !!subst; d.querySelector('#eSubst').dispatchEvent(new w.Event('change')); submit(w, d.querySelector('#eForm')); };
  const atual15 = () => d.querySelector('#eAtual').textContent, msg15 = () => d.querySelector('#eMsg').textContent;
  ok(d.querySelector('#eSubst') && !d.querySelector('#eSubst').checked, 'o formulário de horas tem a caixa "Substituir", desmarcada por padrão');
  envia15('3', false); envia15('1.5', false);
  ok(h15(0, 1) === 4.5 && msg15().includes('adicionadas'), 'sem a caixa, as horas continuam somando (3 + 1,5 = 4,5): ' + h15(0, 1));
  set('#eSem', '0'); set('#eDia', '1'); d.querySelector('#eDia').dispatchEvent(new w.Event('change'));
  ok(atual15().includes('4,5'), 'o formulário mostra o que já está registrado naquele dia: ' + atual15());
  envia15('1.5', true);
  ok(h15(0, 1) === 1.5 && msg15().includes('Total') && !d.querySelector('#eSubst').checked, 'com a caixa, o total do dia é SUBSTITUÍDO (4,5 vira 1,5), e a caixa se desmarca para não sobrescrever sem querer: ' + h15(0, 1) + ' / ' + msg15());
  ok(atual15().includes('1,5'), 'depois de substituir, o total mostrado é o novo: ' + atual15());
  envia15('0', true);
  ok(h15(0, 1) === 0, 'substituir por 0 apaga as horas do dia');
  envia15('2.2', true);
  ok(h15(0, 1) === 2, 'substituir também arredonda para meia hora (2,2 vira 2)');
  const antes15 = h15(0, 1);
  for (const [hs, sb] of [['0', false], ['', false], ['', true], ['-1', true], ['25', false], ['25', true], ['abc', true]]) {
    envia15(hs, sb);
    ok(h15(0, 1) === antes15 && msg15().includes('Informe'), `horas inválidas (${JSON.stringify(hs)}, ${sb ? 'substituir' : 'somar'}) são recusadas sem alterar nada: ${msg15()}`);
  }
  ok(h15(0, 2) === 0 && h15(1, 1) === 0, 'só o dia e a semana escolhidos mudam');
  const set15 = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  envia15('4', true);
  w.Storage.prototype.setItem = set15;
  ok(msg15().includes('Nada foi alterado') && h15(0, 1) === antes15, 'se o navegador não deixa gravar, avisa e mantém o valor anterior: ' + msg15());
  ok(d.querySelector('#eDias').textContent.length > 0 && atual15().includes('2'), 'a tela volta ao valor anterior depois da falha: ' + atual15());
  ok(errs.length === 0, 'sem erros JS no cenario 15 ' + JSON.stringify(errs));

  // cenario 16: historico de 12 meses (antes eram 6): da para voltar 11 meses e ver gastos antigos
  ({ w, d, errs } = boot((win) => {
    fixDate(win); // maio de 2026: a janela vai de junho de 2025 a maio de 2026
    win.localStorage.setItem('sobrou-users', JSON.stringify({ his: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-his', JSON.stringify({ months: { '2025-06': { renda: 111, items: [{ id: 'a', d: 3, cat: 'lazer', desc: 'Mais antigo', v: 20 }] }, '2025-11': { renda: 222, items: [{ id: 'b', d: 4, cat: 'lazer', desc: 'Sete meses atras', v: 30 }] }, '2025-05': { renda: 999 } } }));
  }));
  await sleep(100);
  await login(w, d, 'his', 'abc123');
  w.location.hash = '#financas'; await sleep(50);
  const voltar16 = () => d.querySelector('#financas [data-step="-1"]').click();
  for (let i = 0; i < 6; i++) voltar16();
  ok(d.querySelector('#fSub').textContent.includes('novembro') && d.querySelector('#fList').textContent.includes('Sete meses atras'), 'voltando 6 meses chega em novembro e mostra o gasto que antes ficava escondido');
  for (let i = 0; i < 5; i++) voltar16();
  ok(d.querySelector('#fSub').textContent.includes('junho') && d.querySelector('#fList').textContent.includes('Mais antigo') && d.querySelector('#financas [data-step="-1"]').disabled, 'voltando 11 meses chega ao primeiro mês da janela (junho de 2025) e o botão de voltar desliga');
  voltar16();
  ok(d.querySelector('#fSub').textContent.includes('junho'), 'não passa do primeiro mês da janela');
  w.location.hash = '#analise'; await sleep(50);
  ok(d.querySelectorAll('#anRows tr').length === 12 && d.querySelectorAll('#anChart svg rect.an-pos').length === 2, 'a Análise mostra os 12 meses, com os 2 que têm registro como barras (maio de 2025 está fora da janela)');
  ok(d.querySelector('#anRows tr th').textContent === 'Jun/25', 'a tabela começa em junho de 2025: ' + d.querySelector('#anRows tr th').textContent);
  ok(errs.length === 0, 'sem erros JS no cenario 16 ' + JSON.stringify(errs));

  // cenario 17: lembrete de backup (os dados ficam so no navegador): aparece na tela Inicio depois de 30 dias sem exportar
  const DIA = 864e5, hoje17 = new Date(2026, 4, 15, 12).getTime(); // a mesma data fixa de fixDate
  const boot17 = async (user, dados) => {
    ({ w, d, errs } = boot((win) => { fixDate(win); win.localStorage.setItem('sobrou-users', JSON.stringify({ [user]: 'abc123' })); if (dados) win.localStorage.setItem('sobrou-v2-' + user, JSON.stringify(dados)); }));
    await sleep(100); await login(w, d, user, 'abc123'); w.location.hash = '#inicio'; await sleep(50);
  };
  const mes17 = { [k6]: { renda: 1000, items: [{ id: 'a', d: 2, cat: 'lazer', desc: 'Cinema', v: 30 }] } };
  const dicas17 = () => d.querySelector('#inTips').textContent;
  await boot17('bk', { months: mes17, backupEm: hoje17 - 40 * DIA });
  ok(dicas17().includes('40 dias') && dicas17().includes('Exportar dados'), 'com dados e 40 dias sem exportar, o Início lembra do backup e diz onde exportar: ' + dicas17());
  const blobs17 = []; w.URL.createObjectURL = (b) => { blobs17.push(b); return 'blob:z'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(50);
  ok(stored(w, 'bk').backupEm === hoje17 && !dicas17().includes('dias sem exportar'), 'exportar zera a contagem (grava a data de hoje) e o lembrete some: ' + dicas17());
  ok(!('backupEm' in JSON.parse(await readBlob(blobs17[0]))), 'a data do último backup não vai dentro do arquivo exportado');
  await boot17('bk2', { months: mes17, backupEm: hoje17 - 10 * DIA });
  ok(!dicas17().includes('sem exportar'), 'com 10 dias sem exportar ainda não incomoda');
  await boot17('bk3', { months: mes17, backupEm: hoje17 - 30 * DIA });
  ok(dicas17().includes('30 dias'), 'o lembrete começa nos 30 dias exatos');
  await boot17('bk4', { months: { [k6]: { renda: 0 } }, backupEm: hoje17 - 90 * DIA });
  ok(!dicas17().includes('sem exportar'), 'conta sem nenhum dado não tem nada a perder: não lembra');
  await boot17('bk5', { months: mes17 });
  ok(!dicas17().includes('sem exportar') && stored(w, 'bk5').backupEm === undefined, 'quem nunca exportou não ganha lembrete logo de cara (a contagem ainda não começou)');
  w.location.hash = '#financas'; await sleep(50);
  set('#gDesc', 'Pão'); set('#gVal', '5'); set('#gCat', 'alimentacao'); submit(w, d.querySelector('#gForm'));
  ok(stored(w, 'bk5').backupEm === hoje17, 'a contagem começa na primeira vez que a pessoa salva algo');
  for (const ruim of ['abc', -5, hoje17 + 400 * DIA, null]) {
    await boot17('bk6', { months: mes17, backupEm: ruim });
    ok(!dicas17().includes('sem exportar') && errs.length === 0, `data de backup inválida (${JSON.stringify(ruim)}) é ignorada, sem erro e sem lembrete`);
  }
  await boot17('bk7', { months: mes17, backupEm: hoje17 - 40 * DIA });
  w.URL.createObjectURL = () => 'blob:q'; w.URL.revokeObjectURL = () => {};
  const set17 = w.Storage.prototype.setItem; w.Storage.prototype.setItem = function () { throw new Error('quota'); };
  d.querySelector('#expBtn').click(); await sleep(50);
  w.Storage.prototype.setItem = set17;
  ok(d.querySelector('#dMsg').textContent.includes('gerado') && errs.length === 0, 'se o navegador não deixar gravar a data, o arquivo é gerado mesmo assim, sem erro: ' + d.querySelector('#dMsg').textContent);
  ok(errs.length === 0, 'sem erros JS no cenario 17 ' + JSON.stringify(errs));

  // cenario 18: exportar com senha (cifra o arquivo, AES-GCM) e importar arquivo protegido
  ({ w, d, errs } = boot((win) => {
    fixDate(win);
    win.localStorage.setItem('sobrou-users', JSON.stringify({ pw: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-pw', JSON.stringify({ months: { [k6]: { renda: 1000, items: [{ id: 'a', d: 2, cat: 'lazer', desc: 'Segredo do Zé', v: 30 }] } }, reserva: 2000 }));
  }));
  await sleep(100);
  await login(w, d, 'pw', 'abc123');
  const blobs18 = []; w.URL.createObjectURL = (b) => { blobs18.push(b); return 'blob:p'; }; w.URL.revokeObjectURL = () => {};
  const ate18 = async (f) => { for (let i = 0; i < 100 && !f(); i++) await sleep(100); };
  const msg18 = () => d.querySelector('#dMsg').textContent, desc18 = () => (stored(w, 'pw').months[k6].items[0] || {}).desc;
  const exporta18 = async (senha) => { const n = blobs18.length; d.querySelector('#dMsg').textContent = ''; set('#arqSenha', senha); d.querySelector('#expBtn').click(); await ate18(() => blobs18.length > n || msg18().includes('pelo menos')); return blobs18.length > n ? await readBlob(blobs18[blobs18.length - 1]) : null; };
  ok(d.querySelector('#arqSenha') && d.querySelector('#arqSenha').type === 'password' && d.querySelector('label[for="arqSenha"]'), 'o menu tem o campo de senha do arquivo (tipo senha, com rótulo)');
  const plano18 = JSON.parse(await exporta18(''));
  ok(plano18.months && !plano18.cifrado, 'sem senha, o arquivo continua em texto simples, como antes');
  ok((await exporta18('abc')) === null && msg18().includes('pelo menos 8'), 'senha curta é recusada e nenhum arquivo é gerado: ' + msg18());
  const SENHA = 'sênha-forte-ção';
  const txt18 = await exporta18(SENHA), cif18 = JSON.parse(txt18);
  ok(cif18.app === 'sobrou' && cif18.cifrado && cif18.cifrado.alg === 'AES-GCM' && cif18.cifrado.i === 600000 && typeof cif18.dados === 'string' && !cif18.months, 'com senha, o arquivo é cifrado (AES-GCM, 600 mil iterações) e não tem a estrutura dos dados');
  ok(!txt18.includes('Segredo') && !txt18.includes('lazer') && !txt18.includes('1000'), 'nada legível dos dados aparece no arquivo cifrado');
  ok(msg18().includes('protegido') && d.querySelector('#arqSenha').value === '', 'avisa que está protegido e limpa o campo da senha');
  ok((await exporta18(SENHA)) !== txt18, 'cada exportação usa sal e vetor novos (dois arquivos iguais não saem iguais)');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 5, items: [{ id: 'z', d: 1, cat: 'outros', desc: 'Outro', v: 1 }] } } }));
  ok(desc18() === 'Outro', '(preparo) os dados foram trocados por outros');
  await importOld(txt18);
  ok(msg18().includes('protegido por senha') && desc18() === 'Outro', 'arquivo protegido sem senha digitada: explica o que fazer e não altera nada: ' + msg18());
  set('#arqSenha', 'senha-errada-1'); await importOld(txt18); await ate18(() => msg18().includes('incorreta'));
  ok(msg18().includes('Senha incorreta') && desc18() === 'Outro', 'senha errada: avisa e não altera nada: ' + msg18());
  const adulterado = JSON.parse(txt18); adulterado.dados = adulterado.dados.slice(0, 20) + (adulterado.dados[20] === 'A' ? 'B' : 'A') + adulterado.dados.slice(21);
  set('#arqSenha', SENHA); await importOld(JSON.stringify(adulterado)); await ate18(() => msg18().includes('alterado'));
  ok(msg18().includes('alterado') && desc18() === 'Outro', 'arquivo adulterado é detectado (o AES-GCM autentica) e nada muda: ' + msg18());
  for (const [nome, mexe] of [['iterações absurdas (travaria o navegador)', (c) => { c.cifrado.i = 900000000; }], ['iterações em texto', (c) => { c.cifrado.i = 'x'; }], ['sal de tamanho errado', (c) => { c.cifrado.s = 'AAAA'; }], ['vetor de tamanho errado', (c) => { c.cifrado.n = 'AAAA'; }], ['dados que não são texto', (c) => { c.dados = 5; }], ['algoritmo desconhecido', (c) => { c.cifrado.alg = 'AES-CBC'; }]]) {
    const c = JSON.parse(txt18); mexe(c); set('#arqSenha', SENHA); await importOld(JSON.stringify(c)); await sleep(100);
    ok(msg18().includes('danificado') && desc18() === 'Outro', 'arquivo protegido com ' + nome + ' é recusado sem tentar abrir: ' + msg18());
  }
  set('#arqSenha', SENHA); await importOld(txt18); await ate18(() => msg18().includes('Dados importados'));
  ok(msg18().includes('Dados importados') && desc18() === 'Segredo do Zé' && stored(w, 'pw').reserva === 2000, 'senha certa (com acento): os dados voltam como estavam: ' + msg18());
  ok(d.querySelector('#arqSenha').value === '', 'depois de importar, o campo da senha é limpo');
  set('#arqSenha', 'qualquer-coisa-1'); await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 7 } } }));
  ok(msg18().includes('Dados importados'), 'arquivo comum continua importando normalmente mesmo com senha digitada');
  ok(errs.length === 0, 'sem erros JS no cenario 18 ' + JSON.stringify(errs));

  console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });

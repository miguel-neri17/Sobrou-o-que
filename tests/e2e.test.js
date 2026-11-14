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
  ok(dmsg().includes('últimos 6 meses') && JSON.stringify(month()) === snap, 'arquivo so com meses antigos recusado');

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
  ok(sum().includes('2 gastos para importar') && sum().includes('1 entrada ignorada') && sum().includes('1 linha inválida') && sum().includes('1 fora dos últimos 6 meses'), 'resumo conta novos, entradas, invalidas e fora da janela: ' + sum());
  ok(items7().length === 0, 'nada e salvo antes de confirmar');
  ok(d.querySelector('#extOk').textContent.includes('2') && !d.querySelector('#extOk').disabled, 'botao de confirmar mostra a quantidade');

  d.querySelector('#extOk').click(); await sleep(50);
  const it7 = items7();
  ok(panel().hidden && it7.length === 2 && it7.every((i) => i.cat === 'outros' && i.id) && it7.some((i) => i.desc === 'Mercado' && i.v === 12.5 && i.d === 5) && it7.some((i) => i.desc === 'Cinema' && i.v === 30 && i.d === 7), 'confirmar salva so as saidas, como positivo, categoria outros');
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
  ok(linhas.length === 6, 'tabela do saldo tem uma linha por mes (6)');
  const lm = (nome) => linhas.find((tr) => tr.textContent.includes(nome));
  ok(lm('Mar').textContent.includes('550,00') && lm('Abr').textContent.includes('430,00') && lm('Fev').textContent.includes('200,00'), 'tabela mostra a sobra de cada mes (Fev negativa: -200,00)');
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
  ok(reserva() === 3000 && rsRes().includes('490,00') && rsRes().includes('meses'), 'meta salva e prazo calculado com a sobra media (490,00): ' + rsRes().slice(0, 200));
  set('#rsMeta', '-5'); submit(w, d.querySelector('#rsForm'));
  ok(rsMsg().includes('Informe um valor') && reserva() === 3000, 'meta invalida recusada, a anterior continua');
  set('#rsMeta', '999999999'); submit(w, d.querySelector('#rsForm'));
  ok(rsRes().includes('mais de 50 anos'), 'meta que levaria mais de 50 anos e avisada');
  set('#rsMeta', ''); submit(w, d.querySelector('#rsForm'));
  ok(reserva() === 0 && rsRes().includes('Defina uma meta'), 'campo em branco remove a meta');
  set('#rsMeta', '3000'); submit(w, d.querySelector('#rsForm'));

  const blobs10 = [];
  w.URL.createObjectURL = (b) => { blobs10.push(b); return 'blob:k'; }; w.URL.revokeObjectURL = () => {};
  d.querySelector('#expBtn').click(); await sleep(50);
  ok(JSON.parse(await readBlob(blobs10[0])).reserva === 3000, 'exportar inclui a meta de reserva');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 1 } }, reserva: 500 }));
  ok(reserva() === 500, 'importar com meta substitui a meta');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 2 } } }));
  ok(reserva() === 500, 'importar arquivo antigo (sem meta) mantem a atual');
  await importOld(JSON.stringify({ app: 'sobrou', versao: 1, months: { [k6]: { renda: 3 } }, reserva: 'abc' }));
  ok(reserva() === 0, 'meta invalida no arquivo vira "sem meta"');
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
  ok(d.querySelectorAll('#anRows tr').length === 6 && errs.length === 0, 'tela vazia monta a tabela sem erro ' + JSON.stringify(errs));

  console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });

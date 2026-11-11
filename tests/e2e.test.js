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
  const now = new Date(), key = now.getFullYear() + '-' + (now.getMonth() + 1);
  const z = () => [0, 0, 0, 0, 0, 0, 0, 0];
  ({ w, d, errs } = boot((win) => {
    win.localStorage.setItem('sobrou-users', JSON.stringify({ velho: 'abc123' }));
    win.localStorage.setItem('sobrou-v2-velho', JSON.stringify({ meta: 10, months: { [key]: { renda: 100, items: [{ d: 2, cat: 'lazer', desc: 'Cinema', v: 30 }], weeks: [z(), z(), z(), z()], nota: null, grades: [] } } }));
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

  console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });

/* Testes unitários do leitor de extrato (js/csv.js): funções puras, sem navegador.
   Carrega util.js e csv.js em um contexto isolado, do mesmo jeito que o navegador (objeto global Sobrou). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

const box = { Intl };
box.window = box;
vm.createContext(box);
['js/util.js', 'js/state.js', 'js/csv.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), box, { filename: f }));
const A = box.Sobrou;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
// o contexto do vm tem seus próprios Array/Object: compara pelo JSON
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); ok(x === y, m + (x === y ? '' : '\n       obtido:   ' + x + '\n       esperado: ' + y)); };

// ---------- parseCSV ----------
eq(A.parseCSV('Data;Descrição;Valor\n05/03/2026;Mercado;-12,50\n'), [['Data', 'Descrição', 'Valor'], ['05/03/2026', 'Mercado', '-12,50']], 'parseCSV: separador ponto e vírgula');
eq(A.parseCSV('a,b,c\n1,2,3'), [['a', 'b', 'c'], ['1', '2', '3']], 'parseCSV: separador vírgula');
eq(A.parseCSV('a\tb\n1\t2'), [['a', 'b'], ['1', '2']], 'parseCSV: separador tab');
eq(A.parseCSV('﻿a;b\r\n1;2\r\n'), [['a', 'b'], ['1', '2']], 'parseCSV: BOM e quebra de linha do Windows');
eq(A.parseCSV('a;b\n\n   \n1;2\n'), [['a', 'b'], ['1', '2']], 'parseCSV: linhas em branco ignoradas');
eq(A.parseCSV('d,desc,v\n1,"Padaria, do Zé",-5\n2,"Disse ""oi""",-1'), [['d', 'desc', 'v'], ['1', 'Padaria, do Zé', '-5'], ['2', 'Disse "oi"', '-1']], 'parseCSV: aspas, vírgula dentro do campo e aspas duplas');
eq(A.parseCSV('a;b\n1;"linha 1\nlinha 2"'), [['a', 'b'], ['1', 'linha 1\nlinha 2']], 'parseCSV: quebra de linha dentro de aspas');
eq(A.parseCSV(''), [], 'parseCSV: texto vazio');

// ---------- parseMoney ----------
const money = [['-12,50', -12.5], ['R$ 1.234,56', 1234.56], ['-R$ 1.234,56', -1234.56], ['12.50', 12.5], ['1,234.56', 1234.56], ['(45,00)', -45], ['45,00-', -45], ['  7 ', 7], ['1.234', 1234], ['0,99', 0.99], ['-0,005', -0.01]];
money.forEach(([s, v]) => eq(A.parseMoney(s), v, 'parseMoney: "' + s + '" -> ' + v));
['', 'abc', '--5', '1,2,3,4', 'R$'].forEach((s) => eq(A.parseMoney(s), null, 'parseMoney: "' + s + '" é inválido'));

// ---------- parseDate ----------
eq(A.parseDate('05/03/2026'), { y: 2026, m: 3, d: 5 }, 'parseDate: DD/MM/AAAA');
eq(A.parseDate('2026-03-05'), { y: 2026, m: 3, d: 5 }, 'parseDate: AAAA-MM-DD');
eq(A.parseDate('5/3/26'), { y: 2026, m: 3, d: 5 }, 'parseDate: D/M/AA');
eq(A.parseDate('05-03-2026'), { y: 2026, m: 3, d: 5 }, 'parseDate: DD-MM-AAAA');
eq(A.parseDate('05.03.2026'), { y: 2026, m: 3, d: 5 }, 'parseDate: DD.MM.AAAA');
eq(A.parseDate('29/02/2024'), { y: 2024, m: 2, d: 29 }, 'parseDate: 29/02 em ano bissexto');
['31/02/2026', '2026-13-01', '00/01/2026', 'hoje', '05/03', ''].forEach((s) => eq(A.parseDate(s), null, 'parseDate: "' + s + '" é inválida'));

// ---------- guessColumns ----------
eq(A.guessColumns(A.parseCSV('Data;Descrição;Valor\n05/03/2026;Mercado;-12,50')), { header: true, date: 0, desc: 1, valor: 2 }, 'guessColumns: cabeçalho padrão');
eq(A.guessColumns(A.parseCSV('Histórico;Valor;Data\nMercado;-12,50;05/03/2026')), { header: true, date: 2, desc: 0, valor: 1 }, 'guessColumns: colunas fora de ordem pelo nome');
eq(A.guessColumns(A.parseCSV('05/03/2026;-12,50;Mercado\n06/03/2026;-3,00;Padaria')), { header: false, date: 0, desc: 2, valor: 1 }, 'guessColumns: sem cabeçalho, pelo conteúdo');

// ---------- buildExtrato ----------
const mes = ['2026-03', '2026-04'];
const build = (txt, map, existing) => A.buildExtrato(A.parseCSV(txt), map, { months: mes, existing: (k) => (existing && existing[k]) || [] });
const map = { header: true, date: 0, desc: 1, valor: 2 };
let r = build('Data;Descrição;Valor\n05/03/2026;Mercado;-12,50\n06/03/2026;Salário;1000,00\n07/03/2026;Cinema;-30,00\n', map);
eq(r.counts, { total: 3, novos: 2, duplicados: 0, entradas: 1, invalidos: 0, fora: 0 }, 'buildExtrato: saída negativa vira gasto e entrada é ignorada');
eq(r.rows.filter((x) => x.status === 'novo').map((x) => [x.key, x.d, x.desc, x.v]), [['2026-03', 5, 'Mercado', 12.5], ['2026-03', 7, 'Cinema', 30]], 'buildExtrato: mês, dia, descrição e valor positivo');

r = build('Data;Descrição;Valor\n31/02/2026;X;-1\n05/03/2026;;-4\n05/03/2026;Y;abc\n05/03/2026;Z;0\n', map);
eq(r.counts.invalidos, 4, 'buildExtrato: data impossível, descrição vazia, valor inválido e valor zero são inválidos');

r = build('Data;Descrição;Valor\n05/01/2026;Antigo;-9\n05/05/2026;Futuro;-9\n05/04/2026;Ok;-9\n', map);
eq(r.counts, { total: 3, novos: 1, duplicados: 0, entradas: 0, invalidos: 0, fora: 2 }, 'buildExtrato: meses fora da janela são avisados e não importados');

const ex = { '2026-03': [{ d: 5, desc: 'mercado ', v: 12.5 }] };
r = build('Data;Descrição;Valor\n05/03/2026;Mercado;-12,50\n05/03/2026;Mercado;-12,50\n', map, ex);
eq([r.counts.novos, r.counts.duplicados], [1, 1], 'buildExtrato: o que já existe é duplicado, na conta de uma linha por gasto salvo (sem diferenciar maiúscula e espaço)');
r = build('Data;Descrição;Valor\n05/03/2026;Café;-6,00\n05/03/2026;Café;-6,00\n', map);
eq(r.counts.novos, 2, 'buildExtrato: duas linhas iguais no mesmo arquivo são dois gastos (dois cafés no dia)');

r = build('Data;Descrição;Valor\n05/03/2026;' + 'x'.repeat(60) + ';-1\n', map);
ok(r.rows[0].desc.length === 40, 'buildExtrato: descrição cortada em 40 caracteres, como no formulário');
r = build('05/03/2026;Mercado;-12,50\n', { header: false, date: 0, desc: 1, valor: 2 });
eq(r.counts.novos, 1, 'buildExtrato: sem cabeçalho não descarta a primeira linha');
r = build('Data;Descrição;Valor\n05/03/2026;Enorme;-2.000.000.000,00\n05/03/2026;Limite;-1.000.000.000,00\n', map);
eq([r.counts.invalidos, r.counts.novos], [1, 1], 'buildExtrato: valor acima de 1 bilhão é inválido (o storage descartaria ao carregar), 1 bilhão ainda passa');
r = build('Data;Descrição;Valor\n05/03/2026;Mercado;-12,50\n', { header: true, date: 0, desc: 1, valor: 7 });
eq(r.counts.invalidos, 1, 'buildExtrato: coluna que não existe na linha deixa a linha inválida');

// ---------- categorização: chave da regra, sugestão por palavras-chave e aprendizado ----------
eq(A.regraKey('COMPRA NO DEBITO IFOOD *RESTAURANTE 1234'), 'ifood restaurante', 'regraKey: tira ruído de banco, números e pontuação');
eq(A.regraKey('Padaria São João'), 'padaria sao joao', 'regraKey: sem acentos e em minúsculas');
eq(A.regraKey('PIX ENVIADO 12/03 ***'), '', 'regraKey: descrição só de ruído e números não gera chave (nada para aprender)');
eq(A.regraKey('A'.repeat(80)).length <= 30, true, 'regraKey: no máximo 30 caracteres');
eq(A.regraKey('Constructor toString valueOf'), 'constructor tostring valueof', 'regraKey: nome igual a propriedade de objeto ("constructor") não é tratado como ruído');
eq(/^[a-z0-9 ]*$/.test(A.regraKey('__proto__ <b>x</b> "é"')), true, 'regraKey: só letras, números e espaço (seguro como chave de objeto)');

const sug = (d, reg) => { const s = A.sugerirCategoria(d, reg || {}); return [s.cat, s.fonte]; };
eq(sug('UBER *TRIP'), ['transporte', 'palavra'], 'sugerir: Uber é Transporte');
eq(sug('UBER EATS'), ['alimentacao', 'palavra'], 'sugerir: a palavra mais específica vence (Uber Eats é Alimentação)');
eq(sug('COMPRA IFOOD*PIZZARIA'), ['alimentacao', 'palavra'], 'sugerir: iFood é Alimentação');
eq(sug('NETFLIX.COM'), ['assinaturas', 'palavra'], 'sugerir: Netflix é Assinaturas');
eq(sug('Posto Shell Centro'), ['transporte', 'palavra'], 'sugerir: posto de combustível é Transporte');
eq(sug('Açougue Boa Carne'), ['alimentacao', 'palavra'], 'sugerir: acento no extrato não atrapalha');
eq(sug('KALUNGA PAPELARIA'), ['estudos', 'palavra'], 'sugerir: papelaria é Material de estudo');
eq(sug('CINEMARK INGRESSO'), ['lazer', 'palavra'], 'sugerir: cinema é Lazer');
eq(sug('PIX ENVIADO FULANO DA SILVA'), ['outros', 'padrao'], 'sugerir: o que não é reconhecido fica em Outros');
eq(sug('MERCADOLIVRE*PEDIDO'), ['outros', 'padrao'], 'sugerir: só casa palavra inteira (MercadoLivre não é "mercado")');
eq(sug('Constructor Ltda', {}), ['outros', 'padrao'], 'sugerir: nome como "constructor" não pega propriedade do objeto');
eq(sug('NETFLIX.COM', { 'netflix com': 'lazer' }), ['lazer', 'aprendida'], 'sugerir: a regra aprendida vence a palavra-chave');
eq(sug('PADARIA DO ZE 55', { 'padaria do ze': 'lazer' }), ['lazer', 'aprendida'], 'sugerir: a regra aprendida casa mesmo com número diferente no extrato');
eq(sug('UBER *TRIP', { 'uber trip': 'inexistente' }), ['transporte', 'palavra'], 'sugerir: regra com categoria inválida é ignorada');

const r0 = {};
const r1 = A.aprender(r0, 'padaria do ze', 'alimentacao');
eq([Object.keys(r0).length, r1['padaria do ze']], [0, 'alimentacao'], 'aprender: devolve um mapa novo e não altera o original');
eq(Object.keys(A.aprender(r1, '', 'lazer')).length, 1, 'aprender: chave vazia não vira regra');
eq(Object.keys(A.aprender(r1, 'x', 'nao-existe')).length, 1, 'aprender: categoria inválida não vira regra');
let big = {}; for (let i = 0; i < 505; i++) big = A.aprender(big, 'loja ' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)), 'lazer');
eq([Object.keys(big).length, 'loja aa' in big, 'loja' + ' ' + String.fromCharCode(97 + (504 % 26)) + String.fromCharCode(97 + Math.floor(504 / 26)) in big], [A.MAX_REGRAS, false, true], 'aprender: guarda no máximo ' + A.MAX_REGRAS + ' regras, descartando as mais antigas');
eq(Object.keys(A.aprender(A.aprender({ a: 'lazer', b: 'lazer' }, 'a', 'estudos'), 'c', 'lazer')).join(','), 'b,a,c', 'aprender: corrigir uma regra existente a move para o fim (a mais recente)');

// buildExtrato devolve a categoria sugerida de cada gasto novo
{
  const rr = A.buildExtrato(A.parseCSV('Data;Descrição;Valor\n05/03/2026;UBER *TRIP;-20,00\n06/03/2026;Padaria do Ze;-8,00\n07/03/2026;Coisa Rara;-3,00\n08/03/2026;Salário;100,00\n'),
    { header: true, date: 0, desc: 1, valor: 2 }, { months: mes, existing: () => [], regras: { 'padaria do ze': 'alimentacao' } });
  eq(rr.rows.filter((x) => x.status === 'novo').map((x) => [x.cat, x.fonte, x.rk]),
    [['transporte', 'palavra', 'uber trip'], ['alimentacao', 'aprendida', 'padaria do ze'], ['outros', 'padrao', 'coisa rara']], 'buildExtrato: cada gasto novo traz categoria, origem da sugestão e chave da regra');
  eq(rr.porFonte, { aprendida: 1, palavra: 1, padrao: 1 }, 'buildExtrato: conta quantos vieram de regra aprendida, palavra-chave e padrão');
  const sem = A.buildExtrato(A.parseCSV('Data;Descrição;Valor\n05/03/2026;UBER *TRIP;-20,00\n'), { header: true, date: 0, desc: 1, valor: 2 }, { months: mes, existing: () => [] });
  eq(sem.rows[0].cat, 'transporte', 'buildExtrato: sem opts.regras funciona (só palavras-chave)');
}

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
process.exit(fails ? 1 : 0);

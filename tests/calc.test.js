/* Testes unitários das contas da aba Análise (js/calc.js) e da validação da meta de reserva (js/storage.js).
   Sem navegador: carrega os scripts em um contexto isolado, como o navegador (objeto global Sobrou).
   Os meses vêm de A.MON (últimos 6 meses a partir de hoje), então os testes funcionam em qualquer data. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function carregar() {
  const box = { Intl };
  box.window = box;
  vm.createContext(box);
  ['js/util.js', 'js/state.js', 'js/storage.js', 'js/calc.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), box, { filename: f }));
  return box.Sobrou;
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
// o contexto do vm tem seus próprios Array/Object: compara pelo JSON
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); ok(x === y, m + (x === y ? '' : '\n       obtido:   ' + x + '\n       esperado: ' + y)); };
const perto = (a, b, m) => ok(typeof a === 'number' && Math.abs(a - b) < 1e-6, m + (Math.abs(a - b) < 1e-6 ? '' : ' (obtido ' + a + ', esperado ' + b + ')'));

// monta um mês com renda, gastos [[categoria, valor]...], horas por semana (4 semanas, no dia 7) e notas
function mes(A, i, { renda = 0, gastos = [], horas = 0, notas = [] } = {}) {
  const m = A.blank();
  m.renda = renda;
  gastos.forEach(([cat, v], n) => m.items.push({ id: 'g' + i + '-' + n, d: 1, cat, desc: 'x', v }));
  m.weeks = [0, 1, 2, 3].map(() => { const w = A.zw(); w[0] = horas; return w; });
  notas.forEach((v, n) => m.grades.push({ id: 'n' + i + '-' + n, subj: 'Mat', v, label: '' }));
  A.S.data[A.MON[i].key] = m;
}

// ---------- serieSaldo ----------
let A = carregar();
mes(A, 3, { renda: 1000, gastos: [['alimentacao', 300], ['lazer', 100]] });
mes(A, 4, { renda: 500, gastos: [['alimentacao', 700]] });
let s = A.serieSaldo();
ok(s.length === 6 && s.every((x, i) => x.label === A.MON[i].abbr && x.key === A.MON[i].key), 'serieSaldo: um ponto por mês da janela, com rótulo e chave');
eq([s[3].renda, s[3].gastos, s[3].sobra, s[3].tem], [1000, 400, 600, true], 'serieSaldo: renda, gastos e sobra do mês');
eq([s[4].sobra, s[4].tem], [-200, true], 'serieSaldo: mês no vermelho tem sobra negativa');
eq([s[0].renda, s[0].gastos, s[0].sobra, s[0].tem], [0, 0, 0, false], 'serieSaldo: mês sem registro vem zerado e marcado como vazio');
ok(Object.keys(A.S.data).length === 2, 'serieSaldo: só lê, não cria meses vazios no armazenamento');

// ---------- compara ----------
A = carregar();
mes(A, 4, { renda: 1000, gastos: [['alimentacao', 300], ['lazer', 100], ['transporte', 50]], horas: 8, notas: [6] });
mes(A, 5, { renda: 1000, gastos: [['alimentacao', 450], ['lazer', 90], ['assinaturas', 30]], horas: 10, notas: [7.5] });
let c = A.compara(5);
eq([c.gastos.atual, c.gastos.ant, c.gastos.delta], [570, 450, 120], 'compara: gastos do mês, do anterior e a diferença');
perto(c.gastos.pct, 120 / 450 * 100, 'compara: variação percentual dos gastos');
eq([c.sobra.atual, c.sobra.ant, c.sobra.delta], [430, 550, -120], 'compara: sobra do mês, do anterior e a diferença');
eq([c.horas.atual, c.horas.ant], [10, 8], 'compara: média de horas por semana');
eq([c.nota.atual, c.nota.ant, c.nota.delta], [7.5, 6, 1.5], 'compara: nota média');
eq(c.cats.map((x) => [x.k, x.delta]), [['alimentacao', 150], ['transporte', -50], ['assinaturas', 30]], 'compara: as 3 categorias que mais mudaram, pela maior diferença absoluta (a de menor mudança fica de fora)');
eq(A.compara(0), null, 'compara: o primeiro mês da janela não tem anterior');
eq(A.compara(3), null, 'compara: sem registro no mês anterior não há o que comparar');
A = carregar();
mes(A, 4, { renda: 100 }); mes(A, 5, { renda: 100, gastos: [['lazer', 10]] });
c = A.compara(5);
eq([c.gastos.pct, c.nota], [null, null], 'compara: sem gastos no mês anterior a porcentagem é nula, e sem nota não há comparação de nota');

// ---------- horasNota ----------
A = carregar();
mes(A, 2, { renda: 1, horas: 4, notas: [5] }); mes(A, 3, { renda: 1, horas: 6, notas: [6] }); mes(A, 4, { renda: 1, horas: 8, notas: [7] });
mes(A, 5, { renda: 1, horas: 0, notas: [9] }); // sem horas registradas: fica de fora
let hn = A.horasNota();
eq([hn.pontos.length, hn.r], [3, null], 'horasNota: só entram meses com horas e nota; com menos de 4 meses não há coeficiente');
eq(hn.pontos.map((p) => [p.horas, p.nota]), [[4, 5], [6, 6], [8, 7]], 'horasNota: pares de horas por semana e nota');
mes(A, 1, { renda: 1, horas: 2, notas: [4] });
hn = A.horasNota();
eq(hn.pontos.length, 4, 'horasNota: com 4 meses passa a calcular');
perto(hn.r, 1, 'horasNota: relação perfeita dá coeficiente 1');
A = carregar();
[1, 2, 3, 4].forEach((i) => mes(A, i, { renda: 1, horas: 5, notas: [i + 4] }));
eq(A.horasNota().r, null, 'horasNota: horas todas iguais não têm coeficiente (variância zero)');
A = carregar();
[1, 2, 3, 4].forEach((i) => mes(A, i, { renda: 1, horas: i * 2, notas: [10 - i] }));
perto(A.horasNota().r, -1, 'horasNota: relação inversa perfeita dá coeficiente -1');

// ---------- mesesParaMeta e sobraMedia ----------
A = carregar();
eq(A.mesesParaMeta(1000, 100, 0), 10, 'mesesParaMeta: sem rendimento, meta ÷ aporte');
eq([A.mesesParaMeta(1050, 100, 0), A.mesesParaMeta(1050, 100, 2)], [11, 10], 'mesesParaMeta: com rendimento chega mais cedo');
eq([A.mesesParaMeta(1000, 0, 0.7), A.mesesParaMeta(1000, -50, 0.7), A.mesesParaMeta(0, 100, 0.7)], [null, null, null], 'mesesParaMeta: sem aporte positivo ou sem meta não há prazo');
eq(A.mesesParaMeta(1e9, 1, 0), null, 'mesesParaMeta: prazo acima de 50 anos (600 meses) é tratado como inalcançável');
eq(A.sobraMedia(), null, 'sobraMedia: sem nenhum mês com renda não há média');
mes(A, 4, { renda: 1000, gastos: [['lazer', 400]] }); mes(A, 5, { renda: 1000, gastos: [['lazer', 800]] }); mes(A, 3, { renda: 0, gastos: [['lazer', 999]] });
perto(A.sobraMedia(), 400, 'sobraMedia: média da sobra só dos meses com renda informada');

// ---------- meta de reserva vinda de fora ----------
eq([A.cleanReserva(1500), A.cleanReserva('1500.5'), A.cleanReserva(1500.456)], [1500, 1500.5, 1500.46], 'cleanReserva: número ou texto numérico, arredondado em centavos');
eq([A.cleanReserva(-1), A.cleanReserva('abc'), A.cleanReserva(null), A.cleanReserva(2e9), A.cleanReserva(0)], [0, 0, 0, 0, 0], 'cleanReserva: inválido, negativo, nulo, acima de 1e9 ou zero vira 0 (sem meta)');

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK');
process.exit(fails ? 1 : 0);

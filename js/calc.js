/* Contas do site: tudo recebe o índice do mês (posição em MON) e devolve números. Sem mexer na tela. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,CATS=A.CATS,sum=A.sum,round2=A.round2;

  /* dados de um mês; cria um mês vazio se ainda não existir */
  function M(i){var k=MON[i].key;if(!S.data[k])S.data[k]=A.blank();return S.data[k]}

  function money(v){return S.hidden?'R$ ••••':A.brl.format(v)}
  function total(m){return round2(M(m).items.reduce(function(a,i){return a+i.v},0))}
  function sobra(m){return round2(M(m).renda-total(m))}
  function byCat(m){var o={};CATS.forEach(function(c){o[c.k]=0});M(m).items.forEach(function(i){o[i.cat]=round2(o[i.cat]+i.v)});return o}
  function notaMes(m){var g=M(m).grades;return g.length?sum(g.map(function(x){return x.v}))/g.length:M(m).nota}
  function weekTotals(m){return M(m).weeks.map(sum)}
  function dayTotals(m){var o=[0,0,0,0,0,0,0];M(m).weeks.forEach(function(w){for(var i=0;i<7;i++)o[i]+=w[i]});return o}
  function avgWeeks(m){var w=weekTotals(m);return sum(w)/w.length}
  /* valor futuro de aportes mensais p, à taxa ratePct (% ao mês), durante n meses */
  function fv(p,ratePct,n){var i=ratePct/100;return i===0?p*n:p*(Math.pow(1+i,n)-1)/i}
  function mlabel(){return MON[S.cur].abbr+'/'+MON[S.cur].year}

  /* gastos fixos: os modelos (S.recurring) que ainda não têm gasto lançado no mês m (o gasto guarda o id do modelo em "rid") */
  function fixosPend(m){
    var lancado={};M(m).items.forEach(function(i){if(i.rid) lancado[i.rid]=1});
    return S.recurring.filter(function(t){return !lancado[t.id]});
  }
  /* lança os que faltam no mês m e devolve os gastos criados. O dia do modelo vale no máximo até o último dia do mês (31 vira 30, ou 28/29). */
  function lancarFixos(m){
    var dim=new Date(MON[m].year,Number(MON[m].key.slice(5)),0).getDate(),add=[];
    fixosPend(m).forEach(function(t){add.push({id:A.uid(),d:Math.min(t.d,dim),cat:t.cat,desc:t.desc,v:t.v,rid:t.id})});
    add.forEach(function(i){M(m).items.push(i)});
    return add;
  }

  /* orçamento: uma linha por categoria que tem limite, na ordem de CATS. state: ok | near (a partir de 80% do limite) | over (passou) */
  var NEAR=0.8;
  function budgetStatus(m){
    var bc=byCat(m),out=[];
    CATS.forEach(function(c){
      var lim=S.budget[c.k];if(!(lim>0)) return;
      var spent=bc[c.k],pct=spent/lim*100;
      out.push({k:c.k,n:c.n,limit:lim,spent:spent,pct:pct,over:round2(spent-lim),state:spent>lim?'over':(spent>=lim*NEAR?'near':'ok')});
    });
    return out;
  }

  A.budgetStatus=budgetStatus;
  A.fixosPend=fixosPend;A.lancarFixos=lancarFixos;
  A.M=M;A.money=money;A.total=total;A.sobra=sobra;A.byCat=byCat;A.notaMes=notaMes;
  A.weekTotals=weekTotals;A.dayTotals=dayTotals;A.avgWeeks=avgWeeks;A.fv=fv;A.mlabel=mlabel;
})();

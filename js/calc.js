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

  /* ---------- análise (aba Análise) ----------
     Só leem os dados e nunca criam meses vazios (M() cria): P(i) devolve um mês em branco sem guardá-lo. */
  function P(i){return S.data[MON[i].key]||A.blank()}
  function gastosDe(d){return round2(d.items.reduce(function(a,x){return a+x.v},0))}
  function horasDe(d){var w=d.weeks.map(sum);return sum(w)/w.length}
  function notaDe(d){return d.grades.length?sum(d.grades.map(function(g){return g.v}))/d.grades.length:d.nota}
  function temDados(d){return d.renda>0||d.items.length>0}

  /* um ponto por mês da janela: renda, gastos e sobra (tem = o mês tem algum registro) */
  function serieSaldo(){
    return MON.map(function(mo,i){
      var d=P(i),g=gastosDe(d);
      return {i:i,key:mo.key,label:mo.abbr,renda:d.renda,gastos:g,sobra:round2(d.renda-g),tem:temDados(d)};
    });
  }

  /* média da sobra dos meses em que a renda foi informada (null se nenhum) */
  function sobraMedia(){
    var v=serieSaldo().filter(function(x){return x.renda>0}).map(function(x){return x.sobra});
    return v.length?round2(sum(v)/v.length):null;
  }

  /* mês m contra o anterior. null se m é o primeiro da janela ou se o anterior está vazio.
     cats: as 3 categorias que mais mudaram (pela diferença absoluta em R$). */
  function compara(m){
    if(m<1) return null;
    var a=P(m),b=P(m-1);
    if(!temDados(b)) return null;
    var ga=gastosDe(a),gb=gastosDe(b);
    function par(x,y,pct){return {atual:x,ant:y,delta:round2(x-y),pct:pct&&y>0?(x-y)/y*100:null}}
    var na=notaDe(a),nb=notaDe(b);
    function porCat(d,k){return round2(d.items.reduce(function(s,i){return s+(i.cat===k?i.v:0)},0))}
    var cats=CATS.map(function(c){var x=porCat(a,c.k),y=porCat(b,c.k);return {k:c.k,n:c.n,atual:x,ant:y,delta:round2(x-y)}})
      .filter(function(c){return c.delta!==0})
      .sort(function(p,q){return Math.abs(q.delta)-Math.abs(p.delta)}).slice(0,3);
    return {
      gastos:par(ga,gb,true),
      sobra:par(round2(a.renda-ga),round2(b.renda-gb),false),
      horas:{atual:horasDe(a),ant:horasDe(b)},
      nota:na==null||nb==null?null:{atual:na,ant:nb,delta:round2(na-nb)},
      cats:cats
    };
  }

  function pearson(x,y){
    var n=x.length,mx=sum(x)/n,my=sum(y)/n,sxx=0,syy=0,sxy=0;
    for(var i=0;i<n;i++){sxx+=(x[i]-mx)*(x[i]-mx);syy+=(y[i]-my)*(y[i]-my);sxy+=(x[i]-mx)*(y[i]-my)}
    return sxx===0||syy===0?null:sxy/Math.sqrt(sxx*syy);
  }
  /* pares (horas de estudo por semana, nota) dos meses que têm as duas coisas.
     r (coeficiente de correlação) só existe com 4 meses ou mais: com menos, qualquer número seria ruído. */
  function horasNota(){
    var pts=[];
    MON.forEach(function(mo,i){var d=P(i),h=horasDe(d),n=notaDe(d);if(h>0&&n!=null) pts.push({i:i,label:mo.abbr,horas:h,nota:n})});
    return {pontos:pts,r:pts.length>=4?pearson(pts.map(function(p){return p.horas}),pts.map(function(p){return p.nota})):null};
  }

  /* em quantos meses guardando "aporte" por mês (a "taxa" % ao mês) se chega à meta; null se não há aporte, meta
     ou se passa de 600 meses (50 anos) */
  function mesesParaMeta(meta,aporte,taxa){
    if(!(meta>0)||!(aporte>0)) return null;
    for(var n=1;n<=600;n++) if(fv(aporte,taxa,n)>=meta) return n;
    return null;
  }

  A.serieSaldo=serieSaldo;A.sobraMedia=sobraMedia;A.compara=compara;A.horasNota=horasNota;A.mesesParaMeta=mesesParaMeta;
  A.budgetStatus=budgetStatus;
  A.fixosPend=fixosPend;A.lancarFixos=lancarFixos;
  A.M=M;A.money=money;A.total=total;A.sobra=sobra;A.byCat=byCat;A.notaMes=notaMes;
  A.weekTotals=weekTotals;A.dayTotals=dayTotals;A.avgWeeks=avgWeeks;A.fv=fv;A.mlabel=mlabel;
})();

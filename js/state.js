/* Constantes e o estado da tela. Tudo começa vazio e fica só neste navegador, separado por usuário. */
(function(){
  var A=window.Sobrou;

  A.CATS=[
    {k:'alimentacao',n:'Alimentação'},
    {k:'transporte',n:'Transporte'},
    {k:'lazer',n:'Lazer'},
    {k:'assinaturas',n:'Assinaturas'},
    {k:'estudos',n:'Material de estudo'},
    {k:'outros',n:'Outros'}
  ];
  A.DIAS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  A.DIAS_C=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  var ABBR=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var FULLN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  /* o site mostra os 6 últimos meses; MON[MON.length-1] é o mês atual */
  A.now=new Date();
  A.MON=[];
  for(var q=5;q>=0;q--){
    var dt=new Date(A.now.getFullYear(),A.now.getMonth()-q,1);
    A.MON.push({key:A.monthKey(dt.getFullYear(),dt.getMonth()+1),abbr:ABBR[dt.getMonth()],full:FULLN[dt.getMonth()],year:dt.getFullYear()});
  }

  /* cur: índice do mês em exibição | hidden: valores ocultos | meta: horas de estudo por semana
     aporteTocado: o usuário mexeu no valor do simulador | editing: id do gasto em edição
     intro: o usuário acabou de entrar, então o início anima o valor uma vez
     data: dados do usuário logado, por mês (chave "AAAA-MM")
     recurring: modelos de gasto fixo ("repetir todo mês"), {id,desc,v,d,cat}; os gastos lançados a partir deles guardam o id em "rid"
     budget: limite mensal em R$ por categoria, {categoria: valor}; categoria sem entrada = sem limite */
  A.S={cur:A.MON.length-1,hidden:false,meta:10,aporteTocado:false,editing:null,intro:false,data:{},recurring:[],budget:{}};
})();

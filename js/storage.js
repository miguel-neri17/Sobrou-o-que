/* Modelo de dados, validação e persistência no localStorage (uma chave por usuário: sobrou-v2-<login>).
   Tudo que vem de fora (storage ou arquivo importado) passa por cleanMonth antes de ser usado. */
(function(){
  var A=window.Sobrou,S=A.S,CATS=A.CATS,isObj=A.isObj,num=A.num,str=A.str,round2=A.round2,uid=A.uid;

  function zw(){return [0,0,0,0,0,0,0,0]} /* 7 dias + 1 posição para horas antigas sem dia */
  function blank(){return {renda:0,items:[],weeks:[zw(),zw(),zw(),zw()],nota:null,grades:[]}}

  /* o id vai para atributos HTML (data-edit, data-del): só aceita caracteres seguros e únicos */
  var SAFE_ID=/^[A-Za-z0-9_-]{1,60}$/,MAX_RECURRING=100;
  function cleanId(x,seen){var id=typeof x==='string'&&SAFE_ID.test(x)?x:'';if(!id||seen[id])id=uid();seen[id]=1;return id}
  /* "contas" é o nome antigo de "assinaturas"; categoria desconhecida vira "outros" */
  function cleanCat(c){var c0=c==='contas'?'assinaturas':c;return CATS.some(function(x){return x.k===c0})?c0:'outros'}

  /* orçamento vindo de fora: lê só as categorias conhecidas (nunca as chaves do arquivo), valor de 0,01 a 1e9.
     "contas" (nome antigo) vale para "assinaturas". */
  function cleanBudget(o){
    var out={};
    if(!isObj(o)) return out;
    CATS.forEach(function(c){
      var v=num(o[c.k]!==undefined?o[c.k]:(c.k==='assinaturas'?o.contas:undefined),0.01,1e9);
      if(v!==null) out[c.k]=round2(v);
    });
    return out;
  }

  /* meta de reserva (R$) vinda de fora: de 0,01 a 1e9; qualquer outra coisa vira 0 = sem meta */
  function cleanReserva(v){var n=num(v,0.01,1e9);return n===null?0:round2(n)}

  /* modelos de gasto fixo vindos de fora: descarta o inválido, sanea ids e textos, no máximo MAX_RECURRING */
  function cleanRecurring(a){
    var out=[],seen={};
    if(!Array.isArray(a)) return out;
    for(var n=0;n<a.length&&out.length<MAX_RECURRING;n++){
      var x=a[n];if(!isObj(x)) continue;
      var v=num(x.v,0.01,1e9),d=num(x.d,1,31),desc=str(x.desc,40);
      if(v===null||!desc) continue;
      out.push({id:cleanId(x.id,seen),desc:desc,v:round2(v),d:d===null?1:Math.floor(d),cat:cleanCat(x.cat)});
    }
    return out;
  }

  function cleanMonth(m){
    var o=blank(),r=num(m.renda,0,1e9),seenI={},seenG={};
    if(r!==null) o.renda=round2(r);
    (Array.isArray(m.items)?m.items:[]).slice(0,5000).forEach(function(i){
      if(!isObj(i)) return;
      var v=num(i.v,0.01,1e9),d=num(i.d,1,31),desc=str(i.desc,40);
      if(v===null||!desc) return;
      var it={id:cleanId(i.id,seenI),d:d===null?1:Math.floor(d),cat:cleanCat(i.cat),desc:desc,v:round2(v)};
      if(typeof i.rid==='string'&&SAFE_ID.test(i.rid)) it.rid=i.rid; /* vínculo com o modelo de gasto fixo */
      o.items.push(it);
    });
    if(Array.isArray(m.weeks)&&m.weeks.length===4){
      o.weeks=m.weeks.map(function(w){
        var z=zw();
        if(typeof w==='number'){var t=num(w,0,168);if(t!==null) z[7]=t;return z} /* formato antigo: um número por semana */
        if(!Array.isArray(w)) return z;
        for(var k=0;k<8;k++){var h=num(w[k],0,168);if(h!==null) z[k]=Math.round(h*2)/2}
        return z;
      });
    }
    o.nota=num(m.nota,0,10);
    (Array.isArray(m.grades)?m.grades:[]).slice(0,2000).forEach(function(g){
      if(!isObj(g)) return;
      var v=num(g.v,0,10),s=str(g.subj,40);
      if(v===null||!s) return;
      o.grades.push({id:cleanId(g.id,seenG),subj:s,v:round2(v),label:str(g.label,30)});
    });
    return o;
  }

  /* valida e normaliza os meses de um objeto vindo de fora. Aceita a chave AAAA-MM e a antiga AAAA-M;
     o resultado só tem AAAA-MM. Se o mesmo mês vier nas duas formas, a AAAA-MM vence. */
  function readMonths(src,max){
    var out={},keys=Object.keys(src).filter(function(k){return A.normMonthKey(k)&&isObj(src[k])}).slice(0,max);
    keys.sort(function(a,b){return (a===A.normMonthKey(a))-(b===A.normMonthKey(b))}); /* formas antigas primeiro, as novas sobrescrevem */
    keys.forEach(function(k){out[A.normMonthKey(k)]=cleanMonth(src[k])});
    return out;
  }

  /* lê e valida um arquivo de exportação; devolve {months,meta,n} ou {err} */
  function parseImport(txt){
    var j;try{j=JSON.parse(txt)}catch(e){return {err:'O arquivo não é um JSON válido.'}}
    if(!isObj(j)||j.app!=='sobrou'||!isObj(j.months)) return {err:'Este arquivo não parece ser uma exportação do Sobrou o Quê?.'};
    if(num(j.versao,1,1)===null) return {err:'Esta versão do arquivo não é suportada.'};
    var months=readMonths(j.months,240),n=Object.keys(months).length;
    if(!n) return {err:'O arquivo não tem nenhum mês com dados.'};
    var meta=num(j.meta,2,30);
    /* recurring: null = o arquivo não trouxe gastos fixos (exportação antiga), então os atuais ficam */
    return {months:months,meta:meta===null?null:Math.round(meta),recurring:Array.isArray(j.recurring)?cleanRecurring(j.recurring):null,budget:isObj(j.budget)?cleanBudget(j.budget):null,reserva:j.reserva===undefined?null:cleanReserva(j.reserva),n:n};
  }

  var KEY_PREFIX='sobrou-v2-'; /* a chave de cada pessoa no localStorage é este prefixo + o login */
  function ukey(){var u=A.getUser();return u?KEY_PREFIX+u:null}

  function loadData(){
    S.data={};S.meta=10;S.recurring=[];S.budget={};S.reserva=0;var k=ukey();if(!k) return;
    try{
      var d=JSON.parse(localStorage.getItem(k)||'null');
      if(d&&isObj(d.months)){
        S.data=readMonths(d.months,Infinity);
        S.recurring=cleanRecurring(d.recurring);
        S.budget=cleanBudget(d.budget);
        S.reserva=cleanReserva(d.reserva);
        var mt=num(d.meta,2,30);if(mt!==null) S.meta=Math.round(mt);
      }
    }catch(e){}
  }

  /* devolve false se o navegador não deixou gravar (armazenamento cheio ou bloqueado) */
  function saveData(){
    var k=ukey();if(!k) return false;
    try{localStorage.setItem(k,JSON.stringify({months:S.data,meta:S.meta,recurring:S.recurring,budget:S.budget,reserva:S.reserva}));return true}catch(e){return false}
  }

  A.KEY_PREFIX=KEY_PREFIX;A.MAX_RECURRING=MAX_RECURRING;A.cleanBudget=cleanBudget;A.cleanReserva=cleanReserva;
  A.zw=zw;A.blank=blank;A.cleanMonth=cleanMonth;A.parseImport=parseImport;A.loadData=loadData;A.saveData=saveData;
})();

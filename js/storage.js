/* Modelo de dados, validação e persistência no localStorage (uma chave por usuário: sobrou-v2-<login>).
   Tudo que vem de fora (storage ou arquivo importado) passa por cleanMonth antes de ser usado. */
(function(){
  var A=window.Sobrou,S=A.S,CATS=A.CATS,isObj=A.isObj,num=A.num,str=A.str,round2=A.round2,uid=A.uid;

  function zw(){return [0,0,0,0,0,0,0,0]} /* 7 dias + 1 posição para horas antigas sem dia */
  function blank(){return {renda:0,items:[],weeks:[zw(),zw(),zw(),zw()],nota:null,grades:[]}}

  /* o id vai para atributos HTML (data-edit, data-del): só aceita caracteres seguros e únicos */
  function cleanId(x,seen){var id=typeof x==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(x)?x:'';if(!id||seen[id])id=uid();seen[id]=1;return id}

  function cleanMonth(m){
    var o=blank(),r=num(m.renda,0,1e9),seenI={},seenG={};
    if(r!==null) o.renda=round2(r);
    (Array.isArray(m.items)?m.items:[]).slice(0,5000).forEach(function(i){
      if(!isObj(i)) return;
      var v=num(i.v,0.01,1e9),d=num(i.d,1,31),desc=str(i.desc,40);
      if(v===null||!desc) return;
      var c0=i.cat==='contas'?'assinaturas':i.cat; /* "contas" é o nome antigo de "assinaturas" */
      var cat=CATS.some(function(c){return c.k===c0})?c0:'outros';
      o.items.push({id:cleanId(i.id,seenI),d:d===null?1:Math.floor(d),cat:cat,desc:desc,v:round2(v)});
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
    return {months:months,meta:meta===null?null:Math.round(meta),n:n};
  }

  function ukey(){var u=A.getUser();return u?'sobrou-v2-'+u:null}

  function loadData(){
    S.data={};S.meta=10;var k=ukey();if(!k) return;
    try{
      var d=JSON.parse(localStorage.getItem(k)||'null');
      if(d&&isObj(d.months)){
        S.data=readMonths(d.months,Infinity);
        var mt=num(d.meta,2,30);if(mt!==null) S.meta=Math.round(mt);
      }
    }catch(e){}
  }

  /* devolve false se o navegador não deixou gravar (armazenamento cheio ou bloqueado) */
  function saveData(){
    var k=ukey();if(!k) return false;
    try{localStorage.setItem(k,JSON.stringify({months:S.data,meta:S.meta}));return true}catch(e){return false}
  }

  A.zw=zw;A.blank=blank;A.cleanMonth=cleanMonth;A.parseImport=parseImport;A.loadData=loadData;A.saveData=saveData;
})();

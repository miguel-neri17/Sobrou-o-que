/* Desenho das telas. Cada render*() lê o estado (S) e os cálculos (calc.js) e atualiza o HTML do index.html.
   renderAll() é chamado depois de qualquer mudança de dados. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,CATS=A.CATS,DIAS=A.DIAS,DIAS_C=A.DIAS_C,now=A.now,$=A.$,$$=A.$$,el=A.el,esc=A.esc,dec=A.dec,sum=A.sum,norm=A.norm,
      M=A.M,money=A.money,total=A.total,sobra=A.sobra,byCat=A.byCat,notaMes=A.notaMes,weekTotals=A.weekTotals,dayTotals=A.dayTotals,avgWeeks=A.avgWeeks,fv=A.fv,mlabel=A.mlabel,round2=A.round2;

  function reduceMotion(){return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}

  /* mostra o valor; na primeira abertura do início ele "conta" de zero até o valor (a única animação por conta própria) */
  var raf=0;
  /* "R$" menor que os algarismos: só dígitos e símbolos, então é seguro usar innerHTML */
  function heroHTML(v){var s=money(v),i=s.search(/\s/);return i<0?s:'<span class="cur">'+s.slice(0,i)+'</span>'+s.slice(i+1)}
  function showAmount(node,v,animate){
    if(raf){cancelAnimationFrame(raf);raf=0}
    node.dataset.final=heroHTML(v);
    if(!animate||!window.requestAnimationFrame){node.innerHTML=node.dataset.final;fitAmount();return}
    fitAmount();
    var t0=null,dur=800;
    function step(t){
      if(t0===null) t0=t;
      var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      node.innerHTML=p<1?heroHTML(Math.round(v*e*100)/100):node.dataset.final;
      raf=p<1?requestAnimationFrame(step):0;
    }
    raf=requestAnimationFrame(step);
  }
  /* reduz o tamanho do valor até ele caber ao lado do ponto de interrogação; mede com o texto final.
     Precisa rodar de novo quando a tela aparece, a janela muda de tamanho ou a fonte termina de carregar. */
  function fitAmount(){
    var node=$('#saldo'),row=node&&node.parentNode;
    if(!node||!row||!row.clientWidth) return;
    var mark=$$('.hero-mark',row).filter(function(x){return x.offsetWidth>0})[0];
    var avail=row.clientWidth-(mark?mark.offsetWidth+14:0),shown=node.innerHTML;
    node.style.fontSize='';node.innerHTML=node.dataset.final||shown;
    var fs=parseFloat(getComputedStyle(node).fontSize);
    while(node.offsetWidth>avail&&fs>24){fs-=2;node.style.fontSize=fs+'px'}
    node.innerHTML=shown;
  }
  window.addEventListener('resize',fitAmount);
  if(document.fonts){document.fonts.addEventListener&&document.fonts.addEventListener('loadingdone',fitAmount);document.fonts.ready&&document.fonts.ready.then(fitAmount)}

  /* ---------- seletor de mês ---------- */
  function renderMonthSwitch(){
    $$('[data-month]').forEach(function(box){
      box.innerHTML='<div class="mswitch"><button type="button" data-step="-1" aria-label="Mês anterior"><span class="chev"></span></button><span class="ml num">'+mlabel()+'</span><button type="button" data-step="1" aria-label="Próximo mês"><span class="chev r"></span></button></div>';
      $('[data-step="-1"]',box).disabled=S.cur===0;
      $('[data-step="1"]',box).disabled=S.cur===MON.length-1;
    });
    $$('[data-who]').forEach(function(e){e.textContent=A.getUser()||''});
  }

  /* ---------- barra da renda ----------
     Um trecho por categoria (do maior para o menor) e, se sobrou dinheiro, o trecho laranja "Sobrou".
     o.compact: legenda enxuta (só nome e %), usada no início. o.reveal: a barra "abre" da esquerda para a direita. */
  function rendaBar(box,m,o){
    o=o||{};
    var bc=byCat(m),r=M(m).renda,t=total(m),base=Math.max(r,t);
    box.innerHTML='';
    if(base<=0){box.appendChild(el('p','rcap','Nada registrado neste mês ainda. Informe a renda e adicione os gastos em Finanças.'));return}
    var segs=CATS.filter(function(c){return bc[c.k]>0}).sort(function(a,b){return bc[b.k]-bc[a.k]}).map(function(c){return {k:c.k,n:c.n,v:bc[c.k]}});
    if(r>t) segs.push({k:'sobra',n:'Sobrou',v:round2(r-t)});
    var bar=el('div','rbar'+(o.reveal?' reveal':''));
    bar.setAttribute('role','img');
    bar.setAttribute('aria-label','Divisão da renda: '+segs.map(function(s){return s.n+' '+dec.format(s.v/base*100)+'%'}).join(', '));
    segs.forEach(function(s){var i=document.createElement('i');i.className='c-'+s.k;i.style.setProperty('--w',(s.v/base).toFixed(4));bar.appendChild(i)});
    box.appendChild(bar);
    var cap=r<=0?'Sem renda informada: as porcentagens são sobre os gastos.':(t>r?'Os gastos passaram da renda em '+money(round2(t-r))+'.':'');
    if(cap&&(!o.compact||r<=0)) box.appendChild(el('p','rcap',cap));
    var ul=el('ul','rleg'+(o.compact?' compact':''));
    segs.forEach(function(s){
      var p=s.v/base*100,cls=(s.k==='sobra'?'is-sobra':'')+(s.k==='lazer'&&r>0&&p>20?' is-warn':'');
      ul.appendChild(el('li',cls.trim(),'<span class="sw c-'+s.k+'"></span><span class="nm">'+s.n+'</span><span class="vl">'+(o.compact?'':'<span class="money">'+money(s.v)+'</span>')+'<small class="num">'+dec.format(p)+'%</small></span>'));
    });
    box.appendChild(ul);
  }

  /* ---------- início ---------- */

  function renderInicio(){
    var m=S.cur,d=M(m),s=sobra(m),t=total(m),avg=avgWeeks(m);
    $('#hello').textContent='Olá, '+(A.getUser()||'');
    $('#inSub').textContent='Resumo de '+MON[m].full+' de '+MON[m].year+'.';
    /* o valor que sobrou (ou, se os gastos passaram da renda, o que faltou) é o protagonista da página */
    var neg=s<0,intro=!!S.intro&&location.hash==='#inicio'&&!reduceMotion();
    if(location.hash==='#inicio') S.intro=false; /* a contagem acontece uma vez por entrada */
    $('#hero').classList.toggle('is-neg',neg);
    $('#saldoLbl').textContent=(neg?'Faltou em ':'Sobrou em ')+MON[m].full;
    showAmount($('#saldo'),Math.abs(s),intro&&!S.hidden);
    $('#hideBtn').textContent=S.hidden?'Mostrar valores':'Ocultar valores';
    $('#hideBtn').setAttribute('aria-pressed',S.hidden);
    rendaBar($('#inBar'),m,{compact:true,reveal:intro});
    $('#inEstudo').textContent=dec.format(avg)+' h por semana';
    $('#inEstudoHint').textContent='Meta de '+S.meta+' h por semana.'+(notaMes(m)!=null?' Nota média do mês: '+dec.format(notaMes(m)).replace('.',',')+'.':'');
    $('#inEstudoBar').style.setProperty('--w',Math.min(1,avg/S.meta).toFixed(3));
    var p=Math.max(0,s);
    $('#inInv').textContent=money(fv(p,0.7,12));
    $('#inInvHint').textContent=p>0?'Guardando '+money(p)+' por mês durante 12 meses, com uma taxa de exemplo de 0,7% ao mês.':'Informe a renda e registre os gastos em Finanças para ver uma simulação com a sua sobra.';
    var tips=[],bc=byCat(m);
    if(d.renda<=0&&t<=0&&avg<=0){
      tips.push('Comece informando a renda do mês na aba Finanças. Depois, registre seus gastos e suas horas de estudo.');
    }else{
      if(d.renda<=0) tips.push('Informe a renda do mês na aba Finanças para ver quanto sobrou.');
      else{
        var lz=bc.lazer/d.renda;
        if(s<0) tips.push('Os gastos passaram da renda em '+money(-s)+'. Vale olhar as maiores categorias na aba Finanças.');
        if(lz>.2) tips.push('O lazer ficou em '+dec.format(lz*100)+'% da renda, acima de 20%. Não é erro, só um ponto para decidir de propósito.');
        else if(s/d.renda>=.3) tips.push('Sobraram '+dec.format(s/d.renda*100)+'% da renda. Que tal separar uma parte como reserva de emergência? A lição está em Investimentos.');
      }
      if(avg<=0) tips.push('Nenhuma hora de estudo registrada neste mês ainda.');
      else if(avg<S.meta) tips.push('A média foi de '+dec.format(avg)+' h por semana, abaixo da meta de '+S.meta+' h.');
    }
    if(!tips.length) tips.push('Gastos e estudos dentro do esperado neste mês. Continue registrando para comparar com os próximos.');
    $('#inTips').innerHTML=tips.slice(0,2).map(function(x){return '<p>'+x+'</p>'}).join('');
  }

  /* ---------- finanças ---------- */
  function renderFinancas(){
    var m=S.cur,d=M(m);
    $('#fSub').innerHTML='Gastos de '+MON[m].full+': '+money(total(m))+'. Sobrou '+money(sobra(m))+'.';
    $('#rRenda').value=d.renda>0?d.renda:'';
    $('#rTitulo').textContent='Renda de '+MON[m].full;
    rendaBar($('#fCats'),m,{});
    var tb=$('#fList'); tb.innerHTML='';
    var catName={};CATS.forEach(function(c){catName[c.k]=c.n});
    if(!d.items.length){tb.appendChild(el('tr','','<td class="empty" colspan="4">Nenhum gasto registrado neste mês. Use o formulário acima para adicionar o primeiro.</td>'));return}
    d.items.slice().sort(function(a,b){return b.d-a.d}).forEach(function(i){
      var nm=esc(i.desc);
      tb.appendChild(el('tr','','<td class="d num">'+String(i.d).padStart(2,'0')+'</td><td><b>'+nm+'</b><small>'+catName[i.cat]+'</small></td><td class="r money">−'+money(i.v)+'</td>'+
        '<td class="r acts"><button class="rm" type="button" data-edit="'+i.id+'" aria-label="Editar '+nm+'">Editar</button><button class="rm" type="button" data-gdel="'+i.id+'" aria-label="Remover '+nm+'">Remover</button></td>'));
    });
  }

  /* ---------- estudos ---------- */
  function colsInto(box,vals,labels,useMeta){
    box.innerHTML='';
    var mx=Math.max(16,useMeta?S.meta:0,Math.max.apply(null,vals));
    var g=Math.min(1,S.meta/mx).toFixed(3); /* altura da meta semanal */
    vals.forEach(function(h,i){
      box.appendChild(el('div','col'+(useMeta?' goal':'')+(useMeta&&h>0&&h<S.meta?' low':''),'<b class="num">'+dec.format(h)+'</b><div class="t" style="--g:'+g+'"><i style="--h:'+Math.min(1,h/mx).toFixed(3)+'"></i></div><span>'+labels[i]+'</span>'));
    });
  }

  function renderEstudos(){
    var m=S.cur,d=M(m);
    $('#eSub').innerHTML='Média de '+dec.format(avgWeeks(m))+' h por semana em '+MON[m].full+'.';
    colsInto($('#eCols'),weekTotals(m),['Sem. 1','Sem. 2','Sem. 3','Sem. 4'],true);
    colsInto($('#eDias'),dayTotals(m),DIAS_C,false);
    $('#mVal').textContent=S.meta+' h';
    var ni=$('#eNotaIn'),has_g=d.grades.length>0;
    ni.readOnly=has_g;
    ni.value=notaMes(S.cur)!=null?dec.format(notaMes(S.cur)):'';
    $('#eNotaHint').textContent=has_g?'Calculada pela média das notas lançadas em Notas por matéria.':'Opcional. Anote a sua nota média, de 0 a 10, ou lance as notas por matéria abaixo.';
    renderNotas();
    var sel=$('#eSem'),old=sel.value; sel.innerHTML='';
    for(var i=0;i<4;i++){var o=document.createElement('option');o.value=i;o.textContent='Semana '+(i+1);sel.appendChild(o)}
    var cur=S.cur===MON.length-1;
    sel.value=old||String(cur?Math.min(3,Math.floor((now.getDate()-1)/7)):3);
    var sd=$('#eDia'),oldd=sd.value; sd.innerHTML='';
    DIAS.forEach(function(n,i){var o=document.createElement('option');o.value=i;o.textContent=n;sd.appendChild(o)});
    sd.value=oldd||String(now.getDay());
  }

  function renderNotas(){
    var g=M(S.cur).grades,box=$('#nList');box.innerHTML='';
    var seen={},names=[];
    Object.keys(S.data).forEach(function(k){(S.data[k].grades||[]).forEach(function(x){var n=norm(x.subj);if(!seen[n]){seen[n]=1;names.push(x.subj)}})});
    $('#nSubs').innerHTML=names.map(function(n){return '<option value="'+esc(n)+'"></option>'}).join('');
    if(!g.length){box.appendChild(el('p','hint','Nenhuma nota neste mês. Escreva a matéria e a nota acima para começar.'));return}
    var groups=[],idx={};
    g.forEach(function(x){var n=norm(x.subj);if(idx[n]==null){idx[n]=groups.length;groups.push({name:x.subj,items:[]})}groups[idx[n]].items.push(x)});
    groups.forEach(function(gr){
      var avg=sum(gr.items.map(function(x){return x.v}))/gr.items.length;
      var s=el('div','subj','<div class="subj-h"><b>'+esc(gr.name)+'</b><span class="num">média '+dec.format(Math.round(avg*100)/100)+'</span></div>');
      var ul=el('ul','list');
      gr.items.forEach(function(x){
        ul.appendChild(el('li','','<div class="n"><b>'+esc(x.label||'Nota')+'</b></div><div class="v num">'+dec.format(x.v)+'<button class="rm" type="button" data-del="'+x.id+'" aria-label="Remover '+esc(x.label||'nota')+' de '+esc(gr.name)+'">Remover</button></div>'));
      });
      s.appendChild(ul);box.appendChild(s);
    });
  }

  /* ---------- investimentos ---------- */
  function renderInvest(){
    var s=Math.max(0,Math.round(sobra(S.cur)));
    $('#iHint').textContent=s>0?'Sugestão de partida: sua sobra de '+MON[S.cur].full+' ('+money(s)+'). Você pode trocar o valor.':'Informe quanto pretende guardar por mês. Quando houver sobra registrada, ela aparece aqui como sugestão.';
    if(!S.aporteTocado) $('#iAporte').value=s>0?s:'';
    calc();
  }
  function calc(){
    var p=Math.max(0,parseFloat($('#iAporte').value)||0),
        t=Math.max(0,parseFloat($('#iTaxa').value)||0),
        n=Math.max(1,Math.min(120,parseInt($('#iMeses').value,10)||1));
    var f=fv(p,t,n),inv=p*n;
    $('#iRes').innerHTML=
      '<div><span>Total guardado</span><b class="money">'+money(inv)+'</b></div>'+
      '<div><span>Rendimento de exemplo</span><b class="money">'+money(f-inv)+'</b></div>'+
      '<div><span>Montante final</span><b class="total money">'+money(f)+'</b></div>';
  }

  function renderAll(){
    renderMonthSwitch(); renderInicio(); renderFinancas(); renderEstudos(); renderInvest();
  }

  A.renderAll=renderAll;A.renderInicio=renderInicio;A.calc=calc;A.fitAmount=fitAmount;
})();

/* Desenho das telas. Cada render*() lê o estado (S) e os cálculos (calc.js) e atualiza o HTML do index.html.
   renderAll() é chamado depois de qualquer mudança de dados. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,CATS=A.CATS,DIAS=A.DIAS,DIAS_C=A.DIAS_C,now=A.now,$=A.$,$$=A.$$,el=A.el,esc=A.esc,dec=A.dec,sum=A.sum,norm=A.norm,
      M=A.M,money=A.money,total=A.total,sobra=A.sobra,byCat=A.byCat,notaMes=A.notaMes,weekTotals=A.weekTotals,dayTotals=A.dayTotals,avgWeeks=A.avgWeeks,fv=A.fv,mlabel=A.mlabel,round2=A.round2;

  var TX=A.TAXA_EXEMPLO,TXT=dec.format(TX)+'%'; /* taxa de exemplo e seu texto ("0,7%"), de um lugar só */
  $('#iTaxa').value=TX;

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
    $$('[data-who]').forEach(function(e){e.textContent=A.getUser()===A.DEMO_USER?'Exemplo':(A.getUser()||'')});
  }

  /* ---------- barra da renda ----------
     Um trecho por categoria (do maior para o menor) e, se sobrou dinheiro, o trecho laranja "Sobrou".
     o.compact: legenda enxuta (só nome e %), usada no início. o.reveal: a barra "abre" da esquerda para a direita. */
  function rendaBar(box,m,o){
    o=o||{};
    var bc=byCat(m),r=M(m).renda,t=total(m),base=Math.max(r,t);
    box.innerHTML='';
    if(base<=0){box.appendChild(el('p','rcap','Nada registrado neste mês ainda. Informe a renda e adicione os gastos em Finanças.'));return}
    var ov={};A.budgetStatus(m).forEach(function(x){if(x.state==='over') ov[x.k]=1}); /* categorias que passaram do orçamento ficam em destaque */
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
      var p=s.v/base*100,cls=(s.k==='sobra'?'is-sobra':'')+((s.k==='lazer'&&r>0&&p>20)||ov[s.k]?' is-warn':'');
      ul.appendChild(el('li',cls.trim(),'<span class="sw c-'+s.k+'"></span><span class="nm">'+s.n+'</span><span class="vl">'+(o.compact?'':'<span class="money">'+money(s.v)+'</span>')+'<small class="num">'+dec.format(p)+'%</small></span>'));
    });
    box.appendChild(ul);
  }

  /* ---------- início ---------- */

  function renderInicio(){
    var m=S.cur,d=M(m),s=sobra(m),t=total(m),avg=avgWeeks(m);
    $('#hello').textContent='Olá, '+(A.getUser()===A.DEMO_USER?'estudante de exemplo':(A.getUser()||''));
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
    $('#inInv').textContent=money(fv(p,TX,12));
    $('#inInvHint').textContent=p>0?'Guardando '+money(p)+' por mês durante 12 meses, com uma taxa de exemplo de '+TXT+' ao mês.':'Informe a renda e registre os gastos em Finanças para ver uma simulação com a sua sobra.';
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
    /* categoria que passou do orçamento vem primeiro: é o aviso mais acionável */
    tips=A.budgetStatus(m).filter(function(x){return x.state==='over'}).map(function(x){return 'O orçamento de '+x.n+' passou em '+money(x.over)+' neste mês.'}).concat(tips);
    if(!tips.length) tips.push('Gastos e estudos dentro do esperado neste mês. Continue registrando para comparar com os próximos.');
    $('#inTips').innerHTML=tips.slice(0,2).map(function(x){return '<p>'+x+'</p>'}).join('');
  }

  /* ---------- gastos fixos: quantos faltam lançar no mês e a lista dos modelos ---------- */
  function renderFixos(m){
    var p=A.fixosPend(m),n=p.length,box=$('#fxPend'),ul=$('#fxList'),catName={};
    CATS.forEach(function(c){catName[c.k]=c.n});
    box.innerHTML='';ul.innerHTML='';
    if(!S.recurring.length){box.appendChild(el('p','hint','Nenhum gasto fixo ainda. Ao registrar um gasto, marque "Repetir todo mês".'));return}
    if(n){
      box.appendChild(el('p','','<b>'+n+(n===1?' gasto fixo ainda não lançado':' gastos fixos ainda não lançados')+' em '+MON[m].full+'.</b>'));
      box.appendChild(el('button','btn','Lançar '+(n===1?'o gasto fixo':'os '+n+' gastos fixos')+' em '+MON[m].full)).id='fxLancar';
      $('#fxLancar').type='button';
    }else box.appendChild(el('p','hint','Todos os gastos fixos já foram lançados em '+MON[m].full+'.'));
    S.recurring.forEach(function(t){
      var nm=esc(t.desc);
      ul.appendChild(el('li','','<div class="n"><span class="nm">'+nm+'</span><small>'+catName[t.cat]+' · dia '+t.d+'</small></div><div class="v num"><span class="money">'+money(t.v)+'</span><button class="rm" type="button" data-fxdel="'+t.id+'" aria-label="Remover o gasto fixo '+nm+'">Remover</button></div>'));
    });
  }

  /* ---------- orçamento por categoria: campos de limite e o gasto do mês contra cada limite ---------- */
  function renderBudget(m){
    var box=$('#bList'),st=A.budgetStatus(m);
    CATS.forEach(function(c){var inp=$('#bud-'+c.k);if(inp) inp.value=S.budget[c.k]>0?S.budget[c.k]:''});
    box.innerHTML='';
    if(!st.length){box.appendChild(el('p','hint','Nenhum limite definido ainda. Preencha os campos acima e salve.'));return}
    var ul=el('ul','');
    st.forEach(function(x){
      var pct=Math.round(x.pct),txt=x.state==='over'?'Passou do limite em '+money(x.over)+' ('+pct+'%)':(x.state==='near'?'Perto do limite: ':'')+pct+'% usado';
      ul.appendChild(el('li','bud-'+x.state,'<div class="bud-h"><span class="nm">'+x.n+'</span><small>'+txt+'</small></div><p class="hint"><span class="money">'+money(x.spent)+'</span> de <span class="money">'+money(x.limit)+'</span></p><div class="bar"><i style="--w:'+Math.min(1,x.spent/x.limit).toFixed(3)+'"></i></div>'));
    });
    box.appendChild(ul);
  }

  /* ---------- finanças ---------- */
  function renderFinancas(){
    var m=S.cur,d=M(m);
    $('#fSub').innerHTML='Gastos de '+MON[m].full+': '+money(total(m))+'. Sobrou '+money(sobra(m))+'.';
    $('#rRenda').value=d.renda>0?d.renda:'';
    $('#rTitulo').textContent='Renda de '+MON[m].full;
    rendaBar($('#fCats'),m,{});
    renderFixos(m);
    renderBudget(m);
    var tb=$('#fList'); tb.innerHTML='';
    var catName={};CATS.forEach(function(c){catName[c.k]=c.n});
    if(!d.items.length){tb.appendChild(el('tr','','<td class="empty" colspan="4">Nenhum gasto registrado neste mês. Use o formulário acima para adicionar o primeiro.</td>'));return}
    d.items.slice().sort(function(a,b){return b.d-a.d}).forEach(function(i){
      var nm=esc(i.desc);
      tb.appendChild(el('tr','','<td class="d num">'+String(i.d).padStart(2,'0')+'</td><td><b>'+nm+'</b><small>'+catName[i.cat]+(i.rid?' · fixo':'')+'</small></td><td class="r money">−'+money(i.v)+'</td>'+
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

  /* ---------- análise ----------
     Os gráficos são SVG montado em texto: os valores são números e rótulos fixos, nada digitado pelo usuário entra no HTML. */
  function renderSaldo(serie){
    var box=$('#anChart'),tb=$('#anRows');
    box.innerHTML='';tb.innerHTML='';
    serie.forEach(function(t,i){
      tb.appendChild(el('tr','','<th scope="row">'+MON[i].abbr+'/'+String(MON[i].year).slice(2)+'</th>'+(t.tem?'<td class="r'+(t.renda>0?' money">'+money(t.renda):'">sem renda')+'</td><td class="r money">'+money(t.gastos)+'</td><td class="r money">'+money(t.sobra)+'</td>':'<td class="r" colspan="3">sem registros</td>')));
    });
    var com=serie.filter(function(t){return t.tem});
    if(!com.length){box.appendChild(el('p','hint','Nenhum registro nos últimos 6 meses ainda. Informe a renda e os gastos em Finanças para ver o gráfico.'));return}
    var vals=com.map(function(t){return t.sobra}),pos=Math.max.apply(null,vals.concat(0)),neg=Math.max.apply(null,vals.map(function(v){return -v}).concat(0)),span=(pos+neg)||1;
    var W=600,H=240,top=28,bot=46,ph=H-top-bot,y0=top+ph*pos/span,slot=W/serie.length,bw=Math.min(64,slot*0.6);
    var s='<svg class="an-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Sobra por mês: '+com.map(function(t){return MON[t.i].abbr+' '+money(t.sobra)}).join(', ')+'"><line class="an-axis" x1="0" x2="'+W+'" y1="'+y0.toFixed(1)+'" y2="'+y0.toFixed(1)+'"/>';
    serie.forEach(function(t,i){
      var cx=i*slot+slot/2;
      s+='<text class="an-m" x="'+cx.toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle">'+MON[i].abbr+'</text>';
      if(!t.tem) return;
      var h=Math.max(2,Math.abs(t.sobra)/span*ph),up=t.sobra>=0,y=up?y0-h:y0;
      s+='<rect class="'+(up?'an-pos':'an-neg')+'" x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3"/>'
        +'<text class="an-v" x="'+cx.toFixed(1)+'" y="'+(up?y-6:y+h+15).toFixed(1)+'" text-anchor="middle">'+money(t.sobra)+'</text>';
    });
    box.innerHTML=s+'</svg>';
  }

  function renderComp(m,serie){
    var box=$('#anComp'),ul=$('#anCats');
    box.innerHTML='';ul.innerHTML='';$('#anCatsH').hidden=true;
    if(m<1){box.appendChild(el('p','hint','Este é o primeiro mês da janela: não há mês anterior para comparar.'));return}
    if(!serie[m].tem){box.appendChild(el('p','hint','Ainda não há registros neste mês para comparar.'));return}
    var c=A.compara(m),ant=MON[m-1].full;
    if(!c){box.appendChild(el('p','hint','O mês anterior ('+ant+') não tem registros, então não há o que comparar.'));return}
    /* a diferença vai em palavras ("a mais"/"a menos") e não só em cor; good = melhor para você, warn = pior */
    function dif(delta,fmt,maisRuim,pct){
      if(delta===0) return '<span class="an-d">igual</span>';
      var up=delta>0,ruim=up===maisRuim;
      return '<span class="an-d '+(ruim?'warn':'good')+'">'+fmt(Math.abs(delta))+(up?' a mais':' a menos')+(pct!=null?' ('+(up?'+':'−')+dec.format(Math.abs(pct))+'%)':'')+'</span>';
    }
    function li(nome,sub,val,d){return '<li><div class="n"><b>'+nome+'</b><small>'+sub+'</small></div><div class="v"><span class="money">'+val+'</span>'+d+'</div></li>'}
    var h='<ul class="list an-list">'
      +li('Gastos','em '+ant+': '+money(c.gastos.ant),money(c.gastos.atual),dif(c.gastos.delta,money,true,c.gastos.pct))
      +li('Sobra','em '+ant+': '+money(c.sobra.ant),money(c.sobra.atual),dif(c.sobra.delta,money,false,null))
      +li('Horas de estudo','em '+ant+': '+dec.format(c.horas.ant)+' h por semana',dec.format(c.horas.atual)+' h por semana',dif(round2(c.horas.atual-c.horas.ant),function(v){return dec.format(v)+' h'},false,null));
    if(c.nota) h+=li('Nota média','em '+ant+': '+dec.format(c.nota.ant),dec.format(c.nota.atual),dif(c.nota.delta,function(v){return dec.format(v)},false,null));
    box.innerHTML=h+'</ul>';
    c.cats.forEach(function(x){
      ul.appendChild(el('li','','<div class="n"><b>'+x.n+'</b><small>'+money(x.atual)+' neste mês, '+money(x.ant)+' em '+ant+'</small></div><div class="v">'+dif(x.delta,money,true,null)+'</div>'));
    });
    $('#anCatsH').hidden=!c.cats.length;
  }

  function renderHN(){
    var r=A.horasNota(),pts=r.pontos,box=$('#anScatter'),p=$('#anHN');
    box.innerHTML='';
    if(pts.length<2){p.textContent='Para ver a relação entre horas e nota, registre horas de estudo e uma nota em pelo menos 2 meses.';return}
    /* os eixos se ajustam aos seus dados (num gráfico de pontos o zero não é obrigatório) para os pontos não ficarem todos juntos */
    var W=360,H=250,L=44,R=16,T=14,B=46,hs=pts.map(function(q){return q.horas}),ns=pts.map(function(q){return q.nota});
    var x0=Math.max(0,Math.floor(Math.min.apply(null,hs))-1),x1=Math.ceil(Math.max.apply(null,hs))+1;
    var y0=Math.max(0,Math.floor(Math.min.apply(null,ns))-1),y1=Math.min(10,Math.ceil(Math.max.apply(null,ns))+1);
    if(y1<=y0) y0=y1-1;
    function X(v){return L+(v-x0)/(x1-x0)*(W-L-R)} function Y(v){return T+(1-(v-y0)/(y1-y0))*(H-T-B)}
    var s='<svg class="an-svg an-sc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Horas de estudo por semana e nota por mês: '+pts.map(function(q){return q.label+' '+dec.format(q.horas)+' h, nota '+dec.format(q.nota)}).join('; ')+'">'
      +'<line class="an-axis" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(y0)+'" y2="'+Y(y0)+'"/><line class="an-axis" x1="'+L+'" x2="'+L+'" y1="'+T+'" y2="'+Y(y0)+'"/>';
    [y0,y1].forEach(function(n){s+='<text class="an-s" x="'+(L-8)+'" y="'+(Y(n)+4)+'" text-anchor="end">'+n+'</text>'});
    s+='<text class="an-s" x="'+(L+6)+'" y="'+(T+2)+'">nota média</text>';
    [x0,x1].forEach(function(n){s+='<text class="an-s" x="'+X(n)+'" y="'+(H-B+18)+'" text-anchor="middle">'+n+' h</text>'});
    s+='<text class="an-s" x="'+(L+(W-L-R)/2)+'" y="'+(H-4)+'" text-anchor="middle">horas de estudo por semana</text>';
    /* meses com pontos praticamente no mesmo lugar dividem um rótulo ("Jun/Ago"), para os nomes não se cobrirem;
       os rótulos dos grupos alternam entre acima e abaixo do ponto, para grupos vizinhos também não se cobrirem */
    var grupos=[];
    pts.forEach(function(q){
      var cx=X(q.horas),cy=Y(q.nota),g=grupos.filter(function(k){return Math.abs(k.cx-cx)<14&&Math.abs(k.cy-cy)<14})[0];
      if(g) g.labels.push(q.label); else grupos.push({cx:cx,cy:cy,labels:[q.label]});
      s+='<circle class="an-dot" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="6"><title>'+q.label+': '+dec.format(q.horas)+' h por semana, nota '+dec.format(q.nota)+'</title></circle>';
    });
    grupos.forEach(function(k,i){
      s+='<text class="an-s" x="'+k.cx.toFixed(1)+'" y="'+(i%2?k.cy+20:k.cy-11).toFixed(1)+'" text-anchor="middle">'+k.labels.join('/')+'</text>';
    });
    box.innerHTML=s+'</svg>';
    var aviso=' Correlação não mostra causa, e poucos meses variam muito de um ano para o outro.';
    if(pts.length<4) p.textContent='Com poucos meses ('+pts.length+') isto é só uma observação: não dá para dizer se há relação entre horas e nota. Continue registrando.'+aviso;
    else if(r.r===null) p.textContent='As horas (ou as notas) foram iguais em todos os meses, então não há como medir a relação.';
    else{
      var a=Math.abs(r.r),forca=a<0.3?'fraca':(a<0.7?'moderada':'forte');
      p.textContent='Coeficiente de correlação: r = '+r.r.toFixed(2).replace('.',',')+' (relação '+forca+' e '+(r.r>=0?'positiva: mais horas, notas maiores':'negativa: mais horas, notas menores')+', nos seus '+pts.length+' meses).'+aviso;
    }
  }

  function renderReserva(serie){
    var box=$('#rsRes'),meta=S.reserva,sm=A.sobraMedia();
    $('#rsMeta').value=meta>0?meta:'';
    box.innerHTML='';
    function p(t){box.appendChild(el('p','',t))}
    if(!(meta>0)){
      var gs=serie.filter(function(t){return t.tem}).map(function(t){return t.gastos}),media=gs.length?sum(gs)/gs.length:0;
      p('Defina uma meta para ver em quanto tempo você chega nela.'+(media>0?' Uma referência comum é guardar 3 meses de gastos: com a sua média, seriam '+money(round2(media*3))+'.':''));
      return;
    }
    if(sm===null) p('Informe a renda de pelo menos um mês em Finanças para estimar o prazo.');
    else if(sm<=0) p('Nos meses com renda informada, a sua sobra média é de '+money(sm)+': com ela não dá para formar a reserva. Veja as maiores categorias em Finanças.');
    else{
      var n=A.mesesParaMeta(meta,sm,TX);
      if(n===null) p('Com a sua sobra média de '+money(sm)+' por mês, a meta de '+money(meta)+' levaria mais de 50 anos.');
      else p('Guardando a sua sobra média de '+money(sm)+' por mês, com a taxa de exemplo de '+TXT+' ao mês, você chega a '+money(meta)+' em '+n+(n===1?' mês':' meses')+(n>=12?' ('+Math.floor(n/12)+(Math.floor(n/12)===1?' ano':' anos')+(n%12?' e '+n%12+(n%12===1?' mês':' meses'):'')+')':'')+'. A taxa é só um exemplo: rendimentos reais mudam.');
    }
    box.appendChild(el('a','link','Simular em Investimentos')).setAttribute('href','#investimentos');
  }

  function renderAnalise(){
    var serie=A.serieSaldo();
    renderSaldo(serie);renderComp(S.cur,serie);renderHN();renderReserva(serie);
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
    renderMonthSwitch(); renderInicio(); renderFinancas(); renderEstudos(); renderInvest(); renderAnalise();
  }

  A.renderAll=renderAll;A.renderInicio=renderInicio;A.calc=calc;A.fitAmount=fitAmount;
})();

/* Importar extrato bancário em CSV: tela de revisão. A leitura do arquivo e as contas ficam em csv.js;
   aqui só tem a tela e a gravação. Nada é salvo antes do usuário confirmar, e se a gravação falhar tudo volta como estava. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,$=A.$,$$=A.$$,el=A.el,esc=A.esc;

  var MAXFILE=2*1024*1024,MAXROWS=5000,SHOW=50,MAXITEMS=5000; /* MAXITEMS é o limite por mês que o storage.js aplica ao carregar */
  var STATUS={novo:'Será importado',duplicado:'Já existe',entrada:'Entrada (ignorada)',invalido:'Inválida',fora:'Fora dos últimos '+A.MESES+' meses'};
  var rows=[],preview=null;
  /* categorias que a pessoa trocou na revisão: {nº da linha: {cat, rk}}. Vale só se a linha ainda é a mesma
     descrição (rk) depois de trocar as colunas. Só estas trocas viram regra aprendida ao confirmar. */
  var over={};
  function catDe(r){var o=over[r.line];return o&&o.rk===r.rk?o.cat:r.cat}
  function catOptions(sel){return A.CATS.map(function(c){return '<option value="'+c.k+'"'+(c.k===sel?' selected':'')+'>'+esc(c.n)+'</option>'}).join('')}
  function regrasInfo(){
    var n=Object.keys(S.regras||{}).length;
    $('#extRegras').textContent=n?'Regras de categoria aprendidas neste navegador: '+n+'.':'Nenhuma regra de categoria aprendida ainda.';
    $('#extForget').hidden=!n;
  }

  function dmsg(t){$('#dMsg').textContent=t}
  function plural(n,um,varios){return n+' '+(n===1?um:varios)}

  /* ---------- escolher o arquivo ---------- */
  $('#extBtn').addEventListener('click',function(){$('#extFile').click()});

  $('#extFile').addEventListener('change',function(){
    var inp=this,f=inp.files&&inp.files[0];if(!f) return;
    if(f.size>MAXFILE){dmsg('Arquivo grande demais (máximo de 2 MB).');inp.value='';return}
    function read(enc,retry){
      var fr=new FileReader();
      fr.onload=function(){
        var t=String(fr.result);
        /* extratos de banco costumam vir em Windows-1252: se o UTF-8 deu caractere inválido, lê de novo assim */
        if(retry&&t.indexOf('\u{FFFD}')>=0){read('windows-1252',false);return}
        inp.value='';openPanel(t);
      };
      fr.onerror=function(){inp.value='';dmsg('Não foi possível ler o arquivo.')};
      fr.readAsText(f,enc);
    }
    read('utf-8',true);
  });

  function openPanel(text){
    over={};
    rows=A.parseCSV(text);
    if(!rows.length){dmsg('O arquivo está vazio ou não parece um CSV.');return}
    if(rows.length>MAXROWS+1){dmsg('O arquivo tem linhas demais (máximo de '+MAXROWS+').');return}
    var g=A.guessColumns(rows);
    $('#extHead').checked=g.header;
    fillSelects();
    $('#extData').value=String(g.date);$('#extDesc').value=String(g.desc);$('#extVal').value=String(g.valor);
    if(document.body.classList.contains('menu-open')) $('#menuClose').click(); /* o botão que abriu o seletor de arquivo fica dentro do menu: fecha o menu antes */
    $('#extPanel').hidden=false;
    setInert(true);
    $('#extTit').focus();
    refresh();
  }

  function closePanel(){
    $('#extPanel').hidden=true;rows=[];preview=null;over={};
    setInert(false);
    /* o foco volta ao título da tela visível: o botão de importar fica dentro do menu fechado e não pode receber foco */
    var h=$('.screen:not([hidden]) h1');if(h) h.focus({preventScroll:true});
  }

  /* enquanto o diálogo está aberto, o resto da página fica inerte (sem foco, clique nem leitor de tela) */
  var INERT=['main','#menu','.tabs','#scrim'];
  function setInert(on){INERT.forEach(function(s){var e=$(s);if(e){if(on) e.setAttribute('inert','');else e.removeAttribute('inert')}})}

  /* foco preso: Tab no último controle volta ao primeiro, e Shift+Tab no primeiro vai ao último */
  function focaveis(){
    return $$('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',$('#extPanel')).filter(function(e){return !e.disabled&&!e.hidden});
  }
  function prender(e){
    var l=focaveis(),p=$('#extPanel'),a=document.activeElement;
    if(!l.length){e.preventDefault();return}
    var primeiro=l[0],ultimo=l[l.length-1];
    if(e.shiftKey){if(a===primeiro||!p.contains(a)){e.preventDefault();ultimo.focus()}}
    else if(a===ultimo||!p.contains(a)){e.preventDefault();primeiro.focus()}
  }

  /* as três listas de coluna mostram o nome do cabeçalho, ou "Coluna N" se a primeira linha já é um gasto */
  function fillSelects(){
    var w=rows.slice(0,20).reduce(function(m,r){return Math.max(m,r.length)},0),head=$('#extHead').checked;
    ['#extData','#extDesc','#extVal'].forEach(function(id){
      var sel=$(id),old=sel.value;sel.innerHTML='';
      for(var i=0;i<w;i++){
        var o=document.createElement('option'),name=head&&rows[0][i]?rows[0][i]:'';
        o.value=String(i);o.textContent='Coluna '+(i+1)+(name?': '+name.slice(0,30):'');
        sel.appendChild(o);
      }
      if(old!=='') sel.value=old;
    });
  }

  /* ---------- prévia ---------- */
  function refresh(){
    var map={header:$('#extHead').checked,date:Number($('#extData').value),desc:Number($('#extDesc').value),valor:Number($('#extVal').value)};
    preview=A.buildExtrato(rows,map,{months:MON.map(function(m){return m.key}),existing:function(k){return S.data[k]?S.data[k].items:[]},regras:S.regras});
    var c=preview.counts,pf=preview.porFonte,parts=[plural(c.novos,'gasto','gastos')+' para importar'];
    if(c.novos){
      var cs=[];
      if(pf.aprendida) cs.push(plural(pf.aprendida,'aprendida','aprendidas'));
      if(pf.palavra) cs.push(pf.palavra+' por palavra-chave');
      if(pf.padrao) cs.push(pf.padrao+' em Outros');
      parts.push('categorias: '+cs.join(', '));
    }
    if(c.duplicados) parts.push(plural(c.duplicados,'já existente','já existentes'));
    if(c.entradas) parts.push(plural(c.entradas,'entrada ignorada','entradas ignoradas'));
    if(c.invalidos) parts.push(plural(c.invalidos,'linha inválida','linhas inválidas'));
    if(c.fora) parts.push(c.fora+' fora dos últimos '+A.MESES+' meses');
    $('#extSum').textContent=parts.join(' · ')+'.';
    var tb=$('#extList');tb.innerHTML='';
    preview.rows.slice(0,SHOW).forEach(function(r){
      var src=rows[r.line-1]||[];
      tb.appendChild(el('tr','ext-'+r.status,'<td class="num">'+r.line+'</td><td>'+esc(src[map.date]===undefined?'':src[map.date])+'</td><td>'+esc(src[map.desc]===undefined?'':src[map.desc])+'</td><td class="r num">'+esc(src[map.valor]===undefined?'':src[map.valor])+'</td><td>'+(r.status==='novo'?'<select class="ext-cat" data-line="'+r.line+'" aria-label="Categoria da linha '+r.line+'">'+catOptions(catDe(r))+'</select>':'')+'</td><td>'+STATUS[r.status]+'</td>'));
    });
    $('#extMore').textContent=preview.rows.length>SHOW?'Mostrando as primeiras '+SHOW+' de '+preview.rows.length+' linhas. O resumo conta todas, e as demais entram com a categoria sugerida.':'';
    regrasInfo();
    $('#extOk').disabled=!c.novos;
    $('#extOk').textContent=c.novos?'Importar '+plural(c.novos,'gasto','gastos'):'Nada para importar';
  }

  ['#extData','#extDesc','#extVal'].forEach(function(id){$(id).addEventListener('change',refresh)});
  $('#extHead').addEventListener('change',function(){fillSelects();refresh()});
  $('#extCancel').addEventListener('click',closePanel);
  $('#extList').addEventListener('change',function(e){
    var s=e.target;if(!s.classList||!s.classList.contains('ext-cat')||!preview) return;
    var line=Number(s.getAttribute('data-line')),r=preview.rows.filter(function(x){return x.line===line})[0];
    if(r&&A.CATS.some(function(c){return c.k===s.value})) over[line]={cat:s.value,rk:r.rk};
  });
  $('#extForget').addEventListener('click',function(){
    if(!window.confirm('Esquecer todas as regras de categoria aprendidas? Os gastos já salvos não mudam.')) return;
    var old=S.regras;S.regras={};
    if(!A.saveData()){S.regras=old;$('#extRegras').textContent='Não foi possível salvar (armazenamento cheio ou bloqueado). Nada foi alterado.';return}
    refresh();
  });
  document.addEventListener('keydown',function(e){
    if($('#extPanel').hidden) return;
    if(e.key==='Escape') closePanel();
    else if(e.key==='Tab') prender(e);
  });

  /* ---------- confirmar ---------- */
  $('#extOk').addEventListener('click',function(){
    if(!preview||!preview.counts.novos) return;
    var add={},keys,old={},had={};
    preview.rows.forEach(function(r){if(r.status==='novo')(add[r.key]=add[r.key]||[]).push(r)});
    keys=Object.keys(add);
    for(var i=0;i<keys.length;i++){
      var cur=S.data[keys[i]]?S.data[keys[i]].items.length:0;
      if(cur+add[keys[i]].length>MAXITEMS){dmsg('Esse extrato faria um mês passar de '+MAXITEMS+' gastos. Nada foi alterado.');return}
    }
    /* aprende só o que a pessoa trocou: uma regra por descrição (a última troca vale) */
    var oldRegras=S.regras,novasRegras=S.regras,mudou={};
    preview.rows.forEach(function(r){
      if(r.status!=='novo'||!r.rk) return;
      var c=catDe(r);
      if(c!==r.cat){novasRegras=A.aprender(novasRegras,r.rk,c);mudou[r.rk]=1}
    });
    var nRegras=Object.keys(mudou).length;
    S.regras=novasRegras;
    keys.forEach(function(k){
      had[k]=!!S.data[k];if(!had[k]) S.data[k]=A.blank();
      old[k]=S.data[k].items;
      S.data[k].items=old[k].concat(add[k].map(function(r){return {id:A.uid(),d:r.d,cat:catDe(r),desc:r.desc,v:r.v}}));
    });
    if(!A.saveData()){
      S.regras=oldRegras;
      keys.forEach(function(k){if(had[k]) S.data[k].items=old[k];else delete S.data[k]});
      dmsg('Não foi possível salvar o extrato (armazenamento cheio ou bloqueado). Nada foi alterado.');
      return;
    }
    var n=preview.counts.novos,dup=preview.counts.duplicados;
    closePanel();A.renderAll();
    dmsg(plural(n,'gasto importado','gastos importados')+(dup?' ('+plural(dup,'já existia','já existiam')+').':'.')+(nRegras?' Categorias lembradas: '+plural(nRegras,'regra','regras')+'.':''));
  });
})();

/* Importar extrato bancário em CSV: tela de revisão. A leitura do arquivo e as contas ficam em csv.js;
   aqui só tem a tela e a gravação. Nada é salvo antes do usuário confirmar, e se a gravação falhar tudo volta como estava. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,$=A.$,el=A.el,esc=A.esc;

  var MAXFILE=2*1024*1024,MAXROWS=5000,SHOW=50,MAXITEMS=5000; /* MAXITEMS é o limite por mês que o storage.js aplica ao carregar */
  var STATUS={novo:'Será importado',duplicado:'Já existe',entrada:'Entrada (ignorada)',invalido:'Inválida',fora:'Fora dos últimos 6 meses'};
  var rows=[],preview=null;

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
    rows=A.parseCSV(text);
    if(!rows.length){dmsg('O arquivo está vazio ou não parece um CSV.');return}
    if(rows.length>MAXROWS+1){dmsg('O arquivo tem linhas demais (máximo de '+MAXROWS+').');return}
    var g=A.guessColumns(rows);
    $('#extHead').checked=g.header;
    fillSelects();
    $('#extData').value=String(g.date);$('#extDesc').value=String(g.desc);$('#extVal').value=String(g.valor);
    $('#extPanel').hidden=false;
    $('#extTit').focus();
    refresh();
  }

  function closePanel(){
    $('#extPanel').hidden=true;rows=[];preview=null;
    $('#extBtn').focus();
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
    preview=A.buildExtrato(rows,map,{months:MON.map(function(m){return m.key}),existing:function(k){return S.data[k]?S.data[k].items:[]}});
    var c=preview.counts,parts=[plural(c.novos,'gasto','gastos')+' para importar'];
    if(c.duplicados) parts.push(plural(c.duplicados,'já existente','já existentes'));
    if(c.entradas) parts.push(plural(c.entradas,'entrada ignorada','entradas ignoradas'));
    if(c.invalidos) parts.push(plural(c.invalidos,'linha inválida','linhas inválidas'));
    if(c.fora) parts.push(c.fora+' fora dos últimos 6 meses');
    $('#extSum').textContent=parts.join(' · ')+'.';
    var tb=$('#extList');tb.innerHTML='';
    preview.rows.slice(0,SHOW).forEach(function(r){
      var src=rows[r.line-1]||[];
      tb.appendChild(el('tr','ext-'+r.status,'<td class="num">'+r.line+'</td><td>'+esc(src[map.date]===undefined?'':src[map.date])+'</td><td>'+esc(src[map.desc]===undefined?'':src[map.desc])+'</td><td class="r num">'+esc(src[map.valor]===undefined?'':src[map.valor])+'</td><td>'+STATUS[r.status]+'</td>'));
    });
    $('#extMore').textContent=preview.rows.length>SHOW?'Mostrando as primeiras '+SHOW+' de '+preview.rows.length+' linhas. O resumo conta todas.':'';
    $('#extOk').disabled=!c.novos;
    $('#extOk').textContent=c.novos?'Importar '+plural(c.novos,'gasto','gastos'):'Nada para importar';
  }

  ['#extData','#extDesc','#extVal'].forEach(function(id){$(id).addEventListener('change',refresh)});
  $('#extHead').addEventListener('change',function(){fillSelects();refresh()});
  $('#extCancel').addEventListener('click',closePanel);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#extPanel').hidden) closePanel()});

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
    keys.forEach(function(k){
      had[k]=!!S.data[k];if(!had[k]) S.data[k]=A.blank();
      old[k]=S.data[k].items;
      S.data[k].items=old[k].concat(add[k].map(function(r){return {id:A.uid(),d:r.d,cat:'outros',desc:r.desc,v:r.v}}));
    });
    if(!A.saveData()){
      keys.forEach(function(k){if(had[k]) S.data[k].items=old[k];else delete S.data[k]});
      dmsg('Não foi possível salvar o extrato (armazenamento cheio ou bloqueado). Nada foi alterado.');
      return;
    }
    var n=preview.counts.novos,dup=preview.counts.duplicados;
    closePanel();A.renderAll();
    dmsg(plural(n,'gasto importado','gastos importados')+(dup?' ('+plural(dup,'já existia','já existiam')+').':'.'));
  });
})();

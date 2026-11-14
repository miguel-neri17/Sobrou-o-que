/* Exportar e importar os dados do usuário em um arquivo .json (sem senha).
   A validação do conteúdo importado fica em storage.js (parseImport / cleanMonth). */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,$=A.$,pad2=A.pad2;

  var MAXFILE=2*1024*1024;
  function dmsg(t){$('#dMsg').textContent=t}

  $('#expBtn').addEventListener('click',function(){
    var u=A.getUser();if(!u) return;
    var n=new Date(),name='sobrou-'+u+'-'+n.getFullYear()+'-'+pad2(n.getMonth()+1)+'-'+pad2(n.getDate())+'.json';
    var txt=JSON.stringify({app:'sobrou',versao:1,exportadoEm:n.toISOString(),meta:S.meta,months:S.data,recurring:S.recurring,budget:S.budget,reserva:S.reserva},null,2);
    try{
      var url=URL.createObjectURL(new Blob([txt],{type:'application/json'}));
      var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url)},1000);
      dmsg('Arquivo "'+name+'" gerado. Guarde-o com cuidado: ele não tem senha.');
    }catch(e){dmsg('Não foi possível gerar o arquivo neste navegador.')}
  });

  $('#impBtn').addEventListener('click',function(){$('#impFile').click()});

  $('#impFile').addEventListener('change',function(){
    var inp=this,f=inp.files&&inp.files[0];if(!f) return;
    if(f.size>MAXFILE){dmsg('Arquivo grande demais (máximo de 2 MB).');inp.value='';return}
    var fr=new FileReader();
    fr.onload=function(){
      inp.value='';
      var r=A.parseImport(String(fr.result));
      if(r.err){dmsg(r.err);return}
      var vis=MON.filter(function(x){return r.months[x.key]}).length,old=r.n-vis;
      if(!vis){dmsg('O arquivo não tem dados dos últimos 6 meses, que são os únicos que o site mostra.');return}
      if(!window.confirm('Importar vai SUBSTITUIR todos os dados atuais de "'+A.getUser()+'" pelos do arquivo ('+vis+' dos últimos 6 meses'+(old>0?'; mais '+old+' mês(es) antigos serão guardados, mas não aparecem nas telas':'')+'). Continuar?')){dmsg('Importação cancelada.');return}
      var oldData=S.data,oldMeta=S.meta,oldRec=S.recurring,oldBud=S.budget,oldRes=S.reserva;
      S.data=r.months;if(r.meta!==null) S.meta=r.meta;
      if(r.recurring!==null) S.recurring=r.recurring; /* arquivo antigo, sem gastos fixos nem orçamento: mantém os atuais */
      if(r.budget!==null) S.budget=r.budget;
      if(r.reserva!==null) S.reserva=r.reserva;
      if(!A.saveData()){S.data=oldData;S.meta=oldMeta;S.recurring=oldRec;S.budget=oldBud;S.reserva=oldRes;dmsg('Não foi possível salvar os dados importados (armazenamento cheio ou bloqueado). Nada foi alterado.');return}
      S.cur=MON.length-1;S.aporteTocado=false;A.endEdit();A.renderAll();
      dmsg('Dados importados: '+vis+' mês(es) dos últimos 6'+(old>0?' (mais '+old+' antigos guardados)':'')+'.');
    };
    fr.onerror=function(){inp.value='';dmsg('Não foi possível ler o arquivo.')};
    fr.readAsText(f);
  });
})();

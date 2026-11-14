/* Exportar e importar os dados do usuário em um arquivo .json (sem senha).
   A validação do conteúdo importado fica em storage.js (parseImport / cleanMonth). */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,$=A.$,pad2=A.pad2;

  var MAXFILE=2*1024*1024;
  function dmsg(t){$('#dMsg').textContent=t}

  /* ---------- proteger o arquivo com senha: AES-256-GCM, chave derivada da senha (PBKDF2-SHA-256, o mesmo custo do login) ----------
     O AES-GCM também autentica: senha errada e arquivo alterado falham do mesmo jeito. Não há como recuperar sem a senha. */
  var ITER=600000,MAXITER=1000000,MINSENHA=8;
  function chave(senha,salt,iter){
    return crypto.subtle.importKey('raw',new TextEncoder().encode(senha),'PBKDF2',false,['deriveKey']).then(function(k){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    });
  }
  function cifrar(txt,senha){
    var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    return chave(senha,salt,ITER).then(function(k){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,new TextEncoder().encode(txt))}).then(function(ct){
      return JSON.stringify({app:'sobrou',versao:1,cifrado:{alg:'AES-GCM',kdf:'PBKDF2-SHA-256',i:ITER,s:A.toB64(salt),n:A.toB64(iv)},dados:A.toB64(ct)},null,2);
    });
  }
  /* Promise<texto>; rejeita com 'formato' (arquivo fora do padrão: nem tenta, para um número de iterações absurdo não travar o navegador) ou 'senha' */
  function decifrar(j,senha){
    var c=j.cifrado,salt,iv,ct;
    try{
      if(!c||c.alg!=='AES-GCM'||c.kdf!=='PBKDF2-SHA-256'||!(c.i>=100000&&c.i<=MAXITER)||c.i!==Math.floor(c.i)||typeof j.dados!=='string') throw 0;
      salt=A.fromB64(c.s);iv=A.fromB64(c.n);ct=A.fromB64(j.dados);
      if(salt.length!==16||iv.length!==12||ct.length<17) throw 0;
    }catch(e){return Promise.reject('formato')}
    return chave(senha,salt,c.i).then(function(k){return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},k,ct)}).then(function(b){return new TextDecoder().decode(b)},function(){return Promise.reject('senha')});
  }

  function baixar(txt,name,protegido){
    try{
      var url=URL.createObjectURL(new Blob([txt],{type:'application/json'}));
      var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url)},1000);
      S.backupEm=Date.now();A.saveData();A.renderAll(); /* se não gravar a data, o arquivo já foi gerado: o lembrete só volta antes do tempo */
      if(protegido) $('#arqSenha').value='';
      dmsg(protegido?'Arquivo "'+name+'" gerado e protegido com senha. Sem a senha ele não abre: guarde-a em lugar seguro.':'Arquivo "'+name+'" gerado. Guarde-o com cuidado: ele não tem senha.');
    }catch(e){dmsg('Não foi possível gerar o arquivo neste navegador.')}
  }

  $('#expBtn').addEventListener('click',function(){
    var u=A.getUser();if(!u) return;
    var senha=$('#arqSenha').value,btn=this;
    if(senha&&senha.length<MINSENHA){dmsg('A senha do arquivo precisa ter pelo menos '+MINSENHA+' caracteres.');return}
    if(senha&&!A.cryptoOk()){dmsg('Este navegador não consegue proteger arquivos com senha.');return}
    var n=new Date(),name='sobrou-'+u+'-'+n.getFullYear()+'-'+pad2(n.getMonth()+1)+'-'+pad2(n.getDate())+(senha?'-protegido':'')+'.json';
    var txt=JSON.stringify({app:'sobrou',versao:1,exportadoEm:n.toISOString(),meta:S.meta,months:S.data,recurring:S.recurring,budget:S.budget,reserva:S.reserva,guardado:S.guardado,regras:S.regras},null,2);
    btn.disabled=true;
    (senha?cifrar(txt,senha):Promise.resolve(txt)).then(function(out){baixar(out,name,!!senha)},function(){dmsg('Não foi possível proteger o arquivo.')}).then(function(){btn.disabled=false});
  });

  $('#impBtn').addEventListener('click',function(){$('#impFile').click()});

  $('#impFile').addEventListener('change',function(){
    var inp=this,f=inp.files&&inp.files[0];if(!f) return;
    if(f.size>MAXFILE){dmsg('Arquivo grande demais (máximo de 2 MB).');inp.value='';return}
    var fr=new FileReader();
    fr.onload=function(){
      inp.value='';
      var txt=String(fr.result),j=null;
      try{j=JSON.parse(txt)}catch(e){}
      if(!(j&&j.app==='sobrou'&&j.cifrado!==undefined)){importar(txt,false);return}
      var senha=$('#arqSenha').value;
      if(!senha){dmsg('Este arquivo é protegido por senha. Digite a senha no campo "Senha do arquivo" do menu e importe de novo.');return}
      if(!A.cryptoOk()){dmsg('Este navegador não consegue abrir arquivos protegidos.');return}
      decifrar(j,senha).then(function(t){importar(t,true)},function(e){dmsg(e==='senha'?'Senha incorreta, ou o arquivo foi alterado.':'O arquivo protegido está danificado.')});
    };
    function importar(txt,limpar){
      var r=A.parseImport(txt);
      if(r.err){dmsg(r.err);return}
      var vis=MON.filter(function(x){return r.months[x.key]}).length,old=r.n-vis;
      if(!vis){dmsg('O arquivo não tem dados dos últimos '+A.MESES+' meses, que são os únicos que o site mostra.');return}
      if(!window.confirm('Importar vai SUBSTITUIR todos os dados atuais de "'+A.getUser()+'" pelos do arquivo ('+vis+' dos últimos '+A.MESES+' meses'+(old>0?'; mais '+old+' mês(es) antigos serão guardados, mas não aparecem nas telas':'')+'). Continuar?')){dmsg('Importação cancelada.');return}
      var oldData=S.data,oldMeta=S.meta,oldRec=S.recurring,oldBud=S.budget,oldRes=S.reserva,oldGua=S.guardado,oldReg=S.regras;
      S.data=r.months;if(r.meta!==null) S.meta=r.meta;
      if(r.recurring!==null) S.recurring=r.recurring; /* arquivo antigo, sem gastos fixos nem orçamento: mantém os atuais */
      if(r.budget!==null) S.budget=r.budget;
      if(r.reserva!==null) S.reserva=r.reserva;
      if(r.guardado!==null) S.guardado=r.guardado;
      if(r.regras!==null) S.regras=r.regras;
      if(!A.saveData()){S.data=oldData;S.meta=oldMeta;S.recurring=oldRec;S.budget=oldBud;S.reserva=oldRes;S.guardado=oldGua;S.regras=oldReg;dmsg('Não foi possível salvar os dados importados (armazenamento cheio ou bloqueado). Nada foi alterado.');return}
      S.cur=MON.length-1;S.aporteTocado=false;A.endEdit();A.renderAll();
      if(limpar) $('#arqSenha').value='';
      dmsg('Dados importados: '+vis+' mês(es) dos últimos '+A.MESES+(old>0?' (mais '+old+' antigos guardados)':'')+'.');
    };
    fr.onerror=function(){inp.value='';dmsg('Não foi possível ler o arquivo.')};
    fr.readAsText(f);
  });
})();

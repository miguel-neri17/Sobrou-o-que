/* Acesso: login, cadastro e guarda das senhas.
   Não há servidor: o login só separa os dados de cada pessoa neste navegador. As senhas ficam guardadas como hash
   (PBKDF2-SHA-256 com sal aleatório), nunca em texto. Quem abrir as ferramentas do navegador ainda consegue ler
   o localStorage, então isto NÃO é proteção contra alguém com acesso ao aparelho. */
(function(){
  var A=window.Sobrou,$=A.$,has=A.has;

  var ITER=600000; /* contas criadas com menos iterações são refeitas no próximo login certo */
  var mem=null;

  function getUser(){try{var v=sessionStorage.getItem('sobrou-user');if(v!==null)return v}catch(e){}return mem}
  function setUser(u){mem=u;try{if(u)sessionStorage.setItem('sobrou-user',u);else sessionStorage.removeItem('sobrou-user')}catch(e){}}
  function stored(){try{return JSON.parse(localStorage.getItem('sobrou-users')||'{}')||{}}catch(e){return {}}}
  function saveUsers(s){try{localStorage.setItem('sobrou-users',JSON.stringify(s));return true}catch(e){return false}}

  function cryptoOk(){return !!(window.crypto&&crypto.subtle&&crypto.getRandomValues&&window.TextEncoder)}
  function toB64(buf){var a=new Uint8Array(buf),s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}
  function fromB64(t){var b=atob(t),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
  function derive(p,salt,iter){
    return crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']).then(function(k){
      return crypto.subtle.deriveBits({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},k,256);
    });
  }
  function makeRecord(p){
    var salt=crypto.getRandomValues(new Uint8Array(16));
    return derive(p,salt,ITER).then(function(bits){return {s:toB64(salt),h:toB64(bits),i:ITER}});
  }
  function sameBytes(a,b){if(a.length!==b.length)return false;var d=0;for(var i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}

  /* devolve uma Promise<boolean>; contas antigas (senha em texto) são convertidas para hash no primeiro login certo */
  function checkLogin(u,p){
    var all=stored();
    if(!has(all,u)) return Promise.resolve(false);
    var r=all[u];
    if(typeof r==='string'){
      if(r!==p) return Promise.resolve(false);
      return makeRecord(p).then(function(rec){var s=stored();if(s[u]===p){s[u]=rec;saveUsers(s)}return true});
    }
    if(r&&typeof r.s==='string'&&typeof r.h==='string'){
      return Promise.resolve().then(function(){
        return derive(p,fromB64(r.s),r.i>0?r.i:ITER).then(function(bits){return sameBytes(new Uint8Array(bits),fromB64(r.h))});
      }).then(function(ok){
        if(!ok||r.i>=ITER) return ok;
        /* senha certa com hash mais fraco: refaz com o custo atual (se falhar, o login continua valendo) */
        return makeRecord(p).then(function(rec){var s=stored();if(s[u]&&s[u].h===r.h){s[u]=rec;saveUsers(s)}return true}).catch(function(){return true});
      }).catch(function(){return false});
    }
    return Promise.resolve(false);
  }

  function logout(){setUser(null);if(location.hash==='#entrar')A.route();else location.hash='#entrar'}
  $('#sairSide').addEventListener('click',logout);

  $('#lForm').addEventListener('submit',function(e){
    e.preventDefault();
    var u=$('#lUser').value.trim().toLowerCase(),p=$('#lPass').value,btn=$('#lForm .go');
    if(!cryptoOk()){$('#lErr').textContent='Este navegador não tem os recursos de segurança necessários. Abra o site em um navegador atualizado.';return}
    btn.disabled=true;
    checkLogin(u,p).then(function(ok){
      btn.disabled=false;
      if(ok){
        setUser(u);$('#lErr').textContent='';$('#lPass').value='';location.hash='#inicio';
      }else{
        $('#lErr').textContent='Usuário ou senha incorretos. Confira e tente de novo.';
        $('#lPass').value='';$('#lPass').focus();
      }
    }).catch(function(){btn.disabled=false;$('#lErr').textContent='Não foi possível entrar agora. Tente de novo.'});
  });

  $('#cForm').addEventListener('submit',function(e){
    e.preventDefault();
    var u=$('#cUser').value.trim().toLowerCase(),p=$('#cPass').value,p2=$('#cPass2').value,er=$('#cErr');
    if(!/^[a-z0-9._-]{3,20}$/.test(u)){er.textContent='O login deve ter de 3 a 20 letras minúsculas, números, ponto, hífen ou sublinhado.';return}
    if(u==='__proto__'||has(stored(),u)){er.textContent='Esse login já existe. Escolha outro.';return}
    if(p.length<6){er.textContent='A senha precisa ter pelo menos 6 caracteres.';return}
    if(p!==p2){er.textContent='As senhas não são iguais.';return}
    if(!cryptoOk()){er.textContent='Este navegador não tem os recursos de segurança necessários. Abra o site em um navegador atualizado.';return}
    var btn=$('#cForm .go');btn.disabled=true;
    makeRecord(p).then(function(rec){
      btn.disabled=false;
      var s=stored();
      if(has(s,u)){er.textContent='Esse login já existe. Escolha outro.';return}
      s[u]=rec;
      if(!saveUsers(s)){er.textContent='Este navegador não deixou salvar a conta.';return}
      er.textContent='';$('#cPass').value='';$('#cPass2').value='';
      setUser(u);location.hash='#inicio';
    }).catch(function(){btn.disabled=false;er.textContent='Não foi possível criar a conta. Tente de novo.'});
  });

  A.getUser=getUser;A.setUser=setUser; /* setUser: usado só pelo botão "Ver com dados de exemplo" (exemplo.js) */
})();

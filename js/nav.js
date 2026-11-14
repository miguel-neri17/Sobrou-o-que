/* Navegação: menu lateral (abre pela logo) e rotas por #hash. Telas públicas: entrar e cadastro.
   Quem não está logado só vê as públicas. */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,$=A.$,$$=A.$$;

  /* ---------- menu escondido ---------- */
  var menuOpen=false,lastBtn=null;
  function setMenu(open,back){
    menuOpen=open;document.body.classList.toggle('menu-open',open);
    $$('.menubtn').forEach(function(b){b.setAttribute('aria-expanded',open)});
    if(open){var a=$('#menuClose');if(a)setTimeout(function(){a.focus({preventScroll:true})},60)}
    else if(back&&lastBtn){lastBtn.focus({preventScroll:true})}
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.menubtn');
    if(b){lastBtn=b;setMenu(!menuOpen,true)}
  });
  $('#menuClose').addEventListener('click',function(){setMenu(false,true)});
  $('#scrim').addEventListener('click',function(){setMenu(false,true)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuOpen)setMenu(false,true)});

  /* ---------- rotas ---------- */
  var pubIds=['entrar','cadastro'];
  var ids=pubIds.concat(['inicio','financas','estudos','investimentos','analise']);
  var loadedFor,focusAfter=null;
  if(!A.getUser()&&(location.hash===''||location.hash==='#'))location.replace('#entrar');

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('[data-focus]');
    if(a) focusAfter=a.getAttribute('data-focus');
  });

  function route(){
    setMenu(false,false);
    var id=(location.hash||'').replace('#',''),user=A.getUser();
    if(ids.indexOf(id)<0) id=user?'inicio':'entrar';
    if(!user&&pubIds.indexOf(id)<0){location.replace('#entrar');return}
    if(user&&(id==='entrar'||id==='cadastro')){location.replace('#inicio');return}
    if(user!==loadedFor){ /* trocou de usuário: carrega os dados dele e limpa o que era do anterior */
      loadedFor=user;A.loadData();S.aporteTocado=false;S.cur=MON.length-1;S.intro=!!user;A.endEdit();
      $('#dMsg').textContent='';$('#gMsg').textContent='';A.renderAll();
    }
    $('#demoBar').hidden=user!==A.DEMO_USER; /* faixa "dados de exemplo" só enquanto se usa a conta de exemplo */
    document.body.classList.toggle('public',pubIds.indexOf(id)>=0);
    $$('.screen').forEach(function(s){
      var on=s.id===id;
      s.hidden=!on;
      s.classList.remove('enter');
      if(on){void s.offsetWidth;s.classList.add('enter')}
    });
    $$('[data-nav]').forEach(function(a){
      if(a.getAttribute('data-nav')===id) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
    A.fitAmount(); /* o início só tem largura depois de aparecer */
    window.scrollTo(0,0);
    var target=focusAfter&&document.getElementById(focusAfter);
    if(target){target.focus({preventScroll:true})}
    else{var h=$('#'+id+' h1');if(h)h.focus({preventScroll:true})}
    focusAfter=null;
  }
  window.addEventListener('hashchange',route);

  A.route=route;
})();

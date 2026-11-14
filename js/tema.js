/* Alternador de aparência: Sistema (segue o sistema), Claro ou Escuro.
   A escolha fica neste navegador (vale para todas as contas, porque é do aparelho, e não da pessoa) na chave "sobrou-tema".
   O tema salvo é aplicado por um trecho no <head> do index.html, antes de qualquer tela, para não piscar o tema errado;
   aqui fica só o seletor do menu. "Sistema" não guarda atributo: o CSS segue a preferência do sistema. */
(function(){
  var A=window.Sobrou,$$=A.$$,KEY='sobrou-tema',ATRIBUTO={claro:'light',escuro:'dark'};

  function aplicar(v){
    var r=document.documentElement;
    if(ATRIBUTO[v]) r.setAttribute('data-theme',ATRIBUTO[v]);
    else r.removeAttribute('data-theme');
  }
  /* valor estranho guardado no navegador (ou armazenamento bloqueado) vira "sistema" */
  function salvo(){try{var v=localStorage.getItem(KEY);return ATRIBUTO[v]?v:'sistema'}catch(e){return 'sistema'}}

  var atual=salvo();
  $$('input[name="tema"]').forEach(function(r){
    r.checked=r.value===atual;
    r.addEventListener('change',function(){
      if(!r.checked) return;
      aplicar(r.value); /* vale já nesta visita, mesmo se o navegador não deixar guardar */
      try{localStorage.setItem(KEY,r.value)}catch(e){}
    });
  });
})();

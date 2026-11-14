/* "Ver com dados de exemplo": entra numa conta separada (@exemplo), sem senha, com um estudante simulado
   (js/demo.js, gerado por dados/gerar_demo.py a partir de dados/esperado/).

   Os dados reais ficam a salvo por construção: o cadastro só aceita logins com letras minúsculas, números, ponto,
   hífen e sublinhado, então ninguém tem uma conta chamada "@exemplo", e o exemplo nunca escreve na conta de ninguém.
   O formulário de login também não entra nele: só este botão. O exemplo é recarregado do zero a cada entrada,
   então o que for mudado nele some ao sair. */
(function(){
  var A=window.Sobrou,$=A.$,MON=A.MON,D=A.DEMO,USER='@exemplo';
  A.DEMO_USER=USER;

  /* o último mês do exemplo vai para o mês atual, o anterior para o mês passado, e assim por diante */
  function montar(){
    var n=Math.min(D.months.length,MON.length),months={};
    for(var i=0;i<n;i++) months[MON[MON.length-n+i].key]=D.months[D.months.length-n+i];
    return {months:months,meta:D.meta,recurring:D.recurring,budget:D.budget,reserva:D.reserva};
  }

  $('#demoBtn').addEventListener('click',function(){
    var er=$('#lErr');
    if(!D){er.textContent='Não foi possível carregar o exemplo neste navegador.';return}
    try{localStorage.setItem(A.KEY_PREFIX+USER,JSON.stringify(montar()))}
    catch(e){er.textContent='Não foi possível carregar o exemplo (o navegador não deixou salvar). Tente de novo.';return}
    A.setUser(USER);er.textContent='';location.hash='#inicio';
  });

  $('#demoSair').addEventListener('click',function(){$('#sairSide').click()}); /* mesmo caminho do botão Sair do menu */
})();

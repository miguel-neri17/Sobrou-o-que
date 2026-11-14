/* Último script a carregar: desenha as telas e mostra a página certa. */
(function(){
  var A=window.Sobrou;
  A.renderAll();
  A.route();
  /* uso sem internet: o service worker só existe em http(s), nunca em file:// */
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function(){});
})();

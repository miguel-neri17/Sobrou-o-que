/* Funções pequenas e sem estado, usadas pelos outros arquivos de js/.
   Cada arquivo é um script comum (assim o site abre com duplo clique, sem servidor) e eles se
   enxergam pelo objeto global Sobrou. A ordem dos <script> no index.html importa. */
(function(){
  var A=window.Sobrou=window.Sobrou||{};

  A.$=function(s,r){return (r||document).querySelector(s)};
  A.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  A.el=function(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
  A.esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

  A.sum=function(a){return a.reduce(function(x,y){return x+y},0)};
  A.round2=function(v){return Math.round(v*100)/100};
  A.pad2=function(n){return String(n).padStart(2,'0')};
  A.norm=function(s){return String(s).trim().toLowerCase()};
  A.has=function(o,k){return Object.prototype.hasOwnProperty.call(o,k)};

  /* validação de valores vindos de fora (localStorage ou arquivo importado) */
  A.isObj=function(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)};
  A.num=function(x,lo,hi){x=typeof x==='string'?parseFloat(x):x;return typeof x==='number'&&isFinite(x)&&x>=lo&&x<=hi?x:null};
  A.str=function(x,n){return typeof x==='string'?x.trim().slice(0,n):''};

  var uidN=0;
  A.uid=function(){return String(Date.now())+'-'+(uidN++)+'-'+Math.floor(Math.random()*100000)};

  A.brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  A.dec=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
})();

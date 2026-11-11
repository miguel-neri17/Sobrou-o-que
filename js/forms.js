/* Formulários e botões das telas: renda, gastos (adicionar, editar, remover), estudo, notas, meta,
   simulador e o seletor de mês. Cada um grava com saveData() e redesenha com renderAll(). */
(function(){
  var A=window.Sobrou,S=A.S,MON=A.MON,CATS=A.CATS,DIAS=A.DIAS,now=A.now,$=A.$,M=A.M,round2=A.round2,uid=A.uid;

  /* ---------- seletor de mês ---------- */
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-step]');
    if(!b||b.disabled) return;
    S.cur=Math.max(0,Math.min(MON.length-1,S.cur+Number(b.getAttribute('data-step'))));
    S.aporteTocado=false;
    if(S.editing) endEdit(); /* só descarta o formulário se havia uma edição em andamento */
    A.renderAll();
  });

  /* ---------- renda ---------- */
  $('#rForm').addEventListener('submit',function(e){
    e.preventDefault();
    var v=round2(parseFloat($('#rRenda').value));
    if(isNaN(v)||v<0){$('#rMsg').textContent='Informe um valor de renda igual ou maior que zero.';return}
    M(S.cur).renda=v;A.saveData();
    $('#rMsg').textContent='Renda de '+MON[S.cur].full+' salva.';
    A.renderAll();
  });

  /* ---------- gastos ---------- */
  var sel=$('#gCat'); CATS.forEach(function(c){var o=document.createElement('option');o.value=c.k;o.textContent=c.n;sel.appendChild(o)});

  function endEdit(){
    S.editing=null;$('#gForm').reset();
    $('#gTitulo').textContent='Registrar gasto';$('#gSubmit').textContent='Adicionar gasto';$('#gCancel').hidden=true;
  }

  $('#gForm').addEventListener('submit',function(e){
    e.preventDefault();
    var desc=$('#gDesc').value.trim(),v=round2(parseFloat($('#gVal').value));
    if(!desc||!(v>0)){$('#gMsg').textContent='Preencha o que foi e um valor maior que zero.';return}
    var dia=parseInt($('#gDia').value,10),ok=dia>=1&&dia<=31,msg;
    if(S.editing){
      var it=M(S.cur).items.filter(function(x){return x.id===S.editing})[0];
      if(it){
        it.d=ok?dia:it.d;it.cat=$('#gCat').value;it.desc=desc;it.v=v;A.saveData();
        msg='Gasto atualizado.';
      }else msg='Esse gasto não existe mais.';
      endEdit();
    }else{
      if(!ok) dia=S.cur===MON.length-1?now.getDate():1;
      M(S.cur).items.push({id:uid(),d:dia,cat:$('#gCat').value,desc:desc,v:v});A.saveData();
      $('#gDesc').value='';$('#gVal').value='';$('#gDia').value='';
      msg='Gasto adicionado em '+MON[S.cur].full+'.';
    }
    $('#gMsg').textContent=msg;
    A.renderAll();
  });
  $('#gCancel').addEventListener('click',function(){endEdit();$('#gMsg').textContent='Edição cancelada.'});

  $('#fList').addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-edit],[data-gdel]');if(!b)return;
    var d=M(S.cur),id=b.getAttribute('data-edit')||b.getAttribute('data-gdel');
    var it=d.items.filter(function(x){return x.id===id})[0];if(!it)return;
    if(b.hasAttribute('data-edit')){
      S.editing=id;
      $('#gDesc').value=it.desc;$('#gVal').value=it.v;$('#gDia').value=it.d;$('#gCat').value=it.cat;
      $('#gTitulo').textContent='Editar gasto';$('#gSubmit').textContent='Salvar alteração';$('#gCancel').hidden=false;
      $('#gMsg').textContent='';$('#gDesc').focus();
    }else{
      if(!window.confirm('Remover o gasto "'+it.desc+'"?')) return;
      d.items=d.items.filter(function(x){return x.id!==id});A.saveData();
      if(S.editing===id) endEdit();
      $('#gMsg').textContent='Gasto removido.';
      A.renderAll();
    }
  });

  /* ---------- estudos ---------- */
  $('#eForm').addEventListener('submit',function(e){
    e.preventDefault();
    var h=parseFloat($('#eHoras').value),w=parseInt($('#eSem').value,10),di=parseInt($('#eDia').value,10);
    if(!(h>0)){$('#eMsg').textContent='Informe as horas estudadas.';return}
    var wk=M(S.cur).weeks[w];wk[di]=Math.round((wk[di]+h)*2)/2;A.saveData();
    $('#eHoras').value='';
    $('#eMsg').textContent='Horas adicionadas: '+DIAS[di]+', semana '+(w+1)+'.';
    A.renderAll();
  });

  $('#nForm').addEventListener('submit',function(e){
    e.preventDefault();
    var subj=$('#nMat').value.trim(),v=parseFloat($('#nVal').value.replace(',','.')),lab=$('#nLab').value.trim(),er=$('#nMsg');
    if(!subj){er.textContent='Escreva o nome da matéria.';return}
    if(isNaN(v)||v<0||v>10){er.textContent='A nota deve ser um número de 0 a 10.';return}
    M(S.cur).grades.push({id:uid(),subj:subj,v:Math.round(v*100)/100,label:lab});A.saveData();
    $('#nMat').value='';$('#nVal').value='';$('#nLab').value='';
    er.textContent='Nota de '+subj+' adicionada.';
    A.renderAll();$('#nMat').focus();
  });
  $('#nList').addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-del]');if(!b)return;
    var id=b.getAttribute('data-del'),d=M(S.cur);
    d.grades=d.grades.filter(function(x){return x.id!==id});A.saveData();A.renderAll();
  });
  $('#eNotaIn').addEventListener('input',function(){
    if(this.readOnly) return;
    var v=parseFloat(this.value.replace(',','.'));
    M(S.cur).nota=isNaN(v)?null:Math.max(0,Math.min(10,v));A.saveData();A.renderInicio();
  });
  $('#mMenos').addEventListener('click',function(){S.meta=Math.max(2,S.meta-1);A.saveData();A.renderAll()});
  $('#mMais').addEventListener('click',function(){S.meta=Math.min(30,S.meta+1);A.saveData();A.renderAll()});

  /* ---------- investimentos e valores ocultos ---------- */
  ['iAporte','iTaxa','iMeses'].forEach(function(id){$('#'+id).addEventListener('input',function(){if(id==='iAporte')S.aporteTocado=true;A.calc()})});
  $('#hideBtn').addEventListener('click',function(){S.hidden=!S.hidden;A.renderAll()});

  A.endEdit=endEdit;
})();

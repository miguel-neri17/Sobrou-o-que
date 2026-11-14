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
    S.editing=null;$('#gForm').reset();$('#gFixo').disabled=false;
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
      var item={id:uid(),d:dia,cat:$('#gCat').value,desc:desc,v:v},fixoMsg='';
      if($('#gFixo').checked){ /* "repetir todo mês": guarda um modelo e liga o gasto a ele (rid) */
        if(S.recurring.length<A.MAX_RECURRING){
          var t={id:uid(),desc:desc,v:v,d:dia,cat:item.cat};S.recurring.push(t);item.rid=t.id;
          fixoMsg=' Ele também ficou como gasto fixo.';
        }else fixoMsg=' Limite de '+A.MAX_RECURRING+' gastos fixos atingido: este não foi marcado como fixo.';
      }
      M(S.cur).items.push(item);A.saveData();
      $('#gDesc').value='';$('#gVal').value='';$('#gDia').value='';$('#gFixo').checked=false;
      msg='Gasto adicionado em '+MON[S.cur].full+'.'+fixoMsg;
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
      $('#gFixo').checked=false;$('#gFixo').disabled=true; /* editar um gasto não cria nem muda modelo de gasto fixo */
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

  /* ---------- orçamento por categoria ----------
     Um campo de limite por categoria (em branco = sem limite). Se algum valor for inválido, nada é salvo. */
  CATS.forEach(function(c){
    $('#bFields').appendChild(A.el('div','f','<label for="bud-'+c.k+'">'+c.n+' (R$ por mês)</label><input id="bud-'+c.k+'" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="Sem limite">'));
  });
  $('#bForm').addEventListener('submit',function(e){
    e.preventDefault();
    var nb={};
    for(var i=0;i<CATS.length;i++){
      var raw=$('#bud-'+CATS[i].k).value.trim();if(raw==='') continue;
      var v=parseFloat(raw.replace(',','.'));
      if(!(v>=0.01&&v<=1e9)){$('#bMsg').textContent='Limite inválido em '+CATS[i].n+': use um valor maior que zero, ou deixe em branco para ficar sem limite.';return}
      nb[CATS[i].k]=round2(v);
    }
    var old=S.budget;S.budget=nb;
    if(!A.saveData()){S.budget=old;$('#bMsg').textContent='Não foi possível salvar o orçamento (armazenamento cheio ou bloqueado). Nada foi alterado.';A.renderAll();return}
    $('#bMsg').textContent=Object.keys(nb).length?'Orçamento salvo.':'Orçamento removido: nenhum limite definido.';
    A.renderAll();
  });

  /* ---------- meta de reserva (aba Análise): em branco remove a meta; valor inválido não salva ---------- */
  $('#rsForm').addEventListener('submit',function(e){
    e.preventDefault();
    var raw=$('#rsMeta').value.trim(),v=0;
    if(raw!==''){
      v=parseFloat(raw.replace(',','.'));
      if(!(v>=0.01&&v<=1e9)){$('#rsMsg').textContent='Informe um valor maior que zero (até 1 bilhão), ou deixe em branco para remover a meta.';return}
    }
    var old=S.reserva;S.reserva=round2(v);
    if(!A.saveData()){S.reserva=old;$('#rsMsg').textContent='Não foi possível salvar a meta (armazenamento cheio ou bloqueado). Nada foi alterado.';A.renderAll();return}
    $('#rsMsg').textContent=v>0?'Meta salva.':'Meta removida.';
    A.renderAll();
  });

  /* ---------- gastos fixos: lançar no mês e remover o modelo ---------- */
  $('#fxPend').addEventListener('click',function(e){
    if(!(e.target.closest&&e.target.closest('#fxLancar'))) return;
    var add=A.lancarFixos(S.cur);if(!add.length) return;
    if(!A.saveData()){
      M(S.cur).items=M(S.cur).items.filter(function(x){return add.indexOf(x)<0});
      $('#gMsg').textContent='Não foi possível salvar os gastos fixos (armazenamento cheio ou bloqueado). Nada foi alterado.';
    }else $('#gMsg').textContent=add.length+(add.length===1?' gasto fixo lançado':' gastos fixos lançados')+' em '+MON[S.cur].full+'.';
    A.renderAll();
  });
  $('#fxList').addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-fxdel]');if(!b) return;
    var id=b.getAttribute('data-fxdel'),t=S.recurring.filter(function(x){return x.id===id})[0];if(!t) return;
    if(!window.confirm('Remover o gasto fixo "'+t.desc+'"? Os gastos que já foram lançados continuam nos meses.')) return;
    var old=S.recurring;S.recurring=old.filter(function(x){return x.id!==id});
    if(!A.saveData()){S.recurring=old;$('#gMsg').textContent='Não foi possível salvar (armazenamento cheio ou bloqueado). Nada foi alterado.'}
    else $('#gMsg').textContent='Gasto fixo removido.';
    A.renderAll();
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

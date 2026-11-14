/* Leitor de extrato bancário em CSV. Só funções puras: recebem texto e devolvem dados, sem mexer na tela
   nem no armazenamento. A tela de importação fica em extrato.js.
   Regras: saída de dinheiro é valor NEGATIVO e vira gasto; valor positivo é entrada e é ignorado (com aviso). */
(function(){
  var A=window.Sobrou=window.Sobrou||{};

  /* ---------- texto -> linhas de células ----------
     Descobre o separador (; , ou tab) pela primeira linha, aceita aspas ("" dentro do campo vira "),
     BOM no começo, quebra de linha do Windows e quebra de linha dentro de aspas. Linhas vazias somem. */
  function sepOf(line){
    var n={';':0,'\t':0,',':0},q=false;
    for(var i=0;i<line.length;i++){var c=line.charAt(i);if(c==='"')q=!q;else if(!q&&n[c]!==undefined)n[c]++}
    if(n[';']>0&&n[';']>=n['\t']&&n[';']>=n[',']) return ';';
    if(n['\t']>0&&n['\t']>=n[',']) return '\t';
    return ',';
  }

  function parseCSV(text){
    text=String(text).replace(/^\u{FEFF}/u,''); /* BOM do UTF-8 no começo do arquivo */
    var sep=sepOf(text.split(/\r\n|\n|\r/)[0]||''),rows=[],row=[],f='',q=false;
    function endRow(){
      row.push(f);f='';
      row=row.map(function(x){return x.trim()});
      if(row.some(function(x){return x!==''})) rows.push(row);
      row=[];
    }
    for(var i=0;i<text.length;i++){
      var c=text.charAt(i);
      if(q){
        if(c==='"'){if(text.charAt(i+1)==='"'){f+='"';i++}else q=false}
        else f+=c;
      }else if(c==='"'&&f.trim()===''){f='';q=true}
      else if(c===sep){row.push(f);f=''}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text.charAt(i+1)==='\n')i++;endRow()}
      else f+=c;
    }
    if(f!==''||row.length) endRow();
    return rows;
  }

  /* ---------- "R$ 1.234,56", "-12,50", "(45,00)", "12.50"... -> número (negativo = saída), ou null ---------- */
  function parseMoney(s){
    s=String(s).replace(/R\$/gi,'').replace(/\s/g,'');
    var neg=false;
    if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}
    if(s.charAt(0)==='-'){neg=true;s=s.slice(1)}
    else if(s.charAt(0)==='+') s=s.slice(1);
    if(s.slice(-1)==='-'){neg=true;s=s.slice(0,-1)}
    if(!/^[\d.,]+$/.test(s)) return null;
    var hasC=s.indexOf(',')>=0,hasD=s.indexOf('.')>=0,v;
    if(hasC&&hasD){
      var dec=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.',mil=dec===','?'.':',';
      var parts=s.split(dec);
      if(parts.length!==2) return null;
      v=Number(parts[0].split(mil).join('')+'.'+parts[1]);
    }else if(hasC){
      if(s.split(',').length===2) v=Number(s.replace(',','.'));
      else if(/^\d{1,3}(,\d{3})+$/.test(s)) v=Number(s.split(',').join(''));
      else return null;
    }else if(hasD){
      if(/^\d{1,3}(\.\d{3})+$/.test(s)) v=Number(s.split('.').join('')); /* 1.234 é mil duzentos e trinta e quatro */
      else if(s.split('.').length===2) v=Number(s);
      else return null;
    }else v=Number(s);
    if(!isFinite(v)) return null;
    v=A.round2(v); /* arredonda o valor absoluto e só depois aplica o sinal (Math.round(-0.5) daria zero) */
    return v===0?0:(neg?-v:v);
  }

  /* ---------- datas: DD/MM/AAAA, D/M/AA, DD-MM-AAAA, DD.MM.AAAA, AAAA-MM-DD (com hora opcional) ---------- */
  function parseDate(s){
    s=String(s).trim();
    var y,m,d,r=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
    if(r){y=+r[1];m=+r[2];d=+r[3]}
    else if((r=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?:\s.*)?$/.exec(s))){d=+r[1];m=+r[2];y=r[3].length===2?2000+(+r[3]):+r[3]}
    else return null;
    if(m<1||m>12||d<1||d>new Date(y,m,0).getDate()) return null;
    return {y:y,m:m,d:d};
  }

  /* ---------- palpite de quais colunas são data, descrição e valor ----------
     Primeiro pelo nome do cabeçalho; o que faltar, pelo conteúdo das primeiras linhas. */
  function plain(s){return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
  var NAMES={date:/data|date/,desc:/descri|hist|estabelec|lancamento|memo|detalhe|nome/,valor:/valor|amount|quantia|montante|value/};

  function guessColumns(rows){
    var first=rows[0]||[],ix={date:-1,desc:-1,valor:-1},named=0;
    function taken(i){return ix.date===i||ix.desc===i||ix.valor===i}
    ['date','desc','valor'].forEach(function(k){
      for(var i=0;i<first.length;i++) if(!taken(i)&&NAMES[k].test(plain(first[i]))){ix[k]=i;named++;break}
    });
    var header=named>=2,from=header?1:0,sample=rows.slice(from,from+8),w=first.length;
    function pick(k,fn){
      if(ix[k]>=0) return;
      var best=-1,bs=0;
      for(var i=0;i<w;i++){
        if(taken(i)) continue;
        var sc=sample.filter(function(r){return r[i]!==undefined&&fn(r[i])}).length;
        if(sc>bs){bs=sc;best=i}
      }
      if(best>=0) ix[k]=best;
    }
    pick('date',function(x){return !!parseDate(x)});
    pick('valor',function(x){return parseMoney(x)!==null&&!parseDate(x)});
    pick('desc',function(x){return x!==''&&parseMoney(x)===null&&!parseDate(x)});
    ['date','desc','valor'].forEach(function(k){ /* o que ainda faltar: a primeira posição livre */
      if(ix[k]>=0) return;
      for(var i=0;i<Math.max(w,3);i++) if(!taken(i)){ix[k]=i;return}
    });
    if(!named&&rows.length>1&&!parseDate(first[ix.date]||'')) header=true; /* sem nomes, mas a primeira linha não tem data: é cabeçalho */
    return {header:header,date:ix.date,desc:ix.desc,valor:ix.valor};
  }

  /* ---------- prévia da importação ----------
     map: {header,date,desc,valor} (posições das colunas). opts: {months:[chaves AAAA-MM mostradas],
     existing:function(chave)->gastos já salvos [{d,desc,v}]}.
     Cada linha ganha um status: novo | duplicado | entrada | invalido | fora (mês fora da janela).
     Duplicado = já existe um gasto salvo com mesmo dia, descrição e valor; cada gasto salvo "cobre" só uma linha,
     então dois cafés iguais no mesmo arquivo continuam sendo dois gastos. */
  function sig(d,desc,v){return d+'|'+A.norm(desc)+'|'+A.round2(v).toFixed(2)}

  function buildExtrato(rows,map,opts){
    var out=[],c={total:0,novos:0,duplicados:0,entradas:0,invalidos:0,fora:0},have={};
    function used(key){
      if(!have[key]){have[key]={};(opts.existing(key)||[]).forEach(function(i){var s=sig(i.d,i.desc,i.v);have[key][s]=(have[key][s]||0)+1})}
      return have[key];
    }
    for(var i=map.header?1:0;i<rows.length;i++){
      var r=rows[i],o={line:i+1,status:'invalido',key:null,d:0,desc:'',v:0},dt,v,desc;
      c.total++;
      dt=r[map.date]===undefined?null:parseDate(r[map.date]);
      v=r[map.valor]===undefined?null:parseMoney(r[map.valor]);
      desc=r[map.desc]===undefined?'':A.str(r[map.desc].replace(/\s+/g,' '),40);
      o.desc=desc;
      /* acima de 1e9 o storage.js descartaria o gasto ao carregar: melhor recusar já na prévia do que perder depois */
      if(!dt||!desc||v===null||v===0||Math.abs(v)>1e9){c.invalidos++;out.push(o);continue}
      o.key=A.monthKey(dt.y,dt.m);o.d=dt.d;o.v=Math.abs(v);
      if(v>0){o.status='entrada';c.entradas++}
      else if(opts.months.indexOf(o.key)<0){o.status='fora';c.fora++}
      else{
        var u=used(o.key),s=sig(o.d,desc,o.v);
        if(u[s]>0){u[s]--;o.status='duplicado';c.duplicados++}
        else{o.status='novo';c.novos++}
      }
      out.push(o);
    }
    return {rows:out,counts:c};
  }

  A.parseCSV=parseCSV;A.parseMoney=parseMoney;A.parseDate=parseDate;A.guessColumns=guessColumns;A.buildExtrato=buildExtrato;
})();

/**
 * pipeline.js — Blue3 Expansion Suite v5
 * Dados: Supabase (compartilhado entre todos os usuários)
 * Fallback: localStorage (se Supabase offline)
 */

var SUPA_URL = 'https://cjimsplgxrwkqgzegnkq.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqaW1zcGxneHJ3a3FnemVnbmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTg5MTEsImV4cCI6MjA5MTY3NDkxMX0.V5euouwf-Q4KaskXGB4eLg0FPV7pH96hTrQikcV7K6A';

window.Blue3Data  = null;
window.Blue3Ready = false;

// ── Utilitários ──
function norm(s){ return String(s||'').trim().toLowerCase(); }
function pn(v){
  var s=String(v||'0').replace(/R\$|\s/g,'').replace(/\./g,'').replace(',','.').trim();
  return parseFloat(s)||0;
}
function getMonth(d){ if(!d)return null; var p=d.split('/'); if(p.length===3)return parseInt(p[1]); var p2=d.split('-'); return p2.length>=2?parseInt(p2[1]):null; }
function getYear(d){ if(!d)return null; var p=d.split('/'); if(p.length===3)return parseInt(p[2]); var p2=d.split('-'); return p2.length>=2?parseInt(p2[0]):null; }
function fmtBRL(v){ if(!v||v===0)return'—'; return'R$ '+Math.round(v).toLocaleString('pt-BR'); }
var MES={1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez'};
var _chartReg={};

function safeChart(id,cfg){
  if(_chartReg[id]){try{_chartReg[id].destroy();}catch(e){}delete _chartReg[id];}
  var el=document.getElementById(id); if(!el)return null;
  var hasData=cfg.data&&cfg.data.datasets&&cfg.data.datasets.some(function(d){return d.data&&d.data.some(function(v){return v!=null&&v>0;});});
  if(!hasData){var w=el.parentElement;if(w)w.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;color:var(--t3);font-size:12px;font-style:italic;">Dados insuficientes</div>';return null;}
  try{_chartReg[id]=new Chart(el,cfg);return _chartReg[id];}catch(e){return null;}
}

// ── API Supabase ──
function supaFetch(path, opts){
  opts = opts || {};
  var url = SUPA_URL + '/rest/v1/' + path;
  var headers = {
    'apikey':        SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type':  'application/json',
    'Prefer':        opts.prefer || 'return=minimal'
  };
  return fetch(url, {
    method:  opts.method  || 'GET',
    headers: headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined
  });
}

// ── Login via Supabase ──
function blue3Login(email, senha, callback){
  supaFetch('usuarios?email=eq.' + encodeURIComponent(email) + '&ativo=eq.true', {prefer:'return=representation'})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length){callback(false,'Usuário não encontrado');return;}
      var u=rows[0];
      if(u.senha!==senha){callback(false,'Senha incorreta');return;}
      localStorage.setItem('B3U', JSON.stringify({nome:u.nome,email:u.email,perfil:u.perfil}));
      callback(true, u);
    })
    .catch(function(e){
      // Fallback: login local
      var LOCAL_USERS={'master@blue3.com.br':{nome:'Master',perfil:'master'},'paulo@blue3.com.br':{nome:'Paulo',perfil:'master'}};
      if(LOCAL_USERS[email]){
        localStorage.setItem('B3U',JSON.stringify(LOCAL_USERS[email]));
        callback(true,LOCAL_USERS[email]);
      }else{
        callback(false,'Erro de conexão');
      }
    });
}

// ── Salvar CSV no Supabase ──
function blue3SaveCSV(rows, onDone){
  // Salvar localStorage SEMPRE (garantia offline)
  localStorage.setItem('B3D', JSON.stringify(rows));

  var headers = {
    'apikey':        SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal'
  };

  // DELETE todos os registros existentes
  fetch(SUPA_URL + '/rest/v1/candidatos?id=gte.0', {method:'DELETE', headers:headers})
  .catch(function(){ return {ok:true}; })
  .then(function(){
    // INSERT em lotes de 50
    var lotes=[], tam=50;
    for(var i=0;i<rows.length;i+=tam) lotes.push(rows.slice(i,i+tam));
    var idx=0, erros=0;

    function insertNext(){
      if(idx>=lotes.length){
        if(erros>0) console.warn('[Blue3] '+erros+' lotes com erro no Supabase');
        if(onDone) onDone(true, rows.length);
        return;
      }
      var lote=lotes[idx++].map(function(r){
        return{
          candidato:        (r['Candidato']||'').trim(),
          senioridade:      (r['Senioridade']||'').trim(),
          origem:           (r['Origem']||'').trim(),
          filial:           (r['Filial']||'').trim(),
          hunter:           (r['Hunter']||'').trim(),
          sign_in:          pn(r['Sign in']),
          piso:             pn(r['Piso']),
          periodo:          Math.round(parseFloat(String(r['Período']||'12').replace(',','.'))||12),
          total_captacao_mm:Math.round(pn(r['Total Captação (MM)'])/1e6),
          total_comp:       pn(r['Total Comp.']),
          data_contratacao: (r['Data de Contratação']||'').trim()||null,
          status:           (r['Status']||'').trim(),
          mou:              (r['MOU']||'').trim(),
          prev_inicio:      (r['Prev. Inicio']||'').trim()||null,
          ancord:           (r['Ancord']||'').trim(),
          coparticipacao:   pn(r['Detalhe Coparticipação']),
          trigger1_tri:     pn(r['Trigger 1 Tri']),
          trigger1:         pn(r['Trigger 1']),
          trigger2:         pn(r['Trigger 2']),
          trigger3:         pn(r['Trigger 3']),
          trigger4:         pn(r['Trigger 4'])
        };
      });
      fetch(SUPA_URL+'/rest/v1/candidatos',{method:'POST',headers:headers,body:JSON.stringify(lote)})
      .then(function(r){
        if(!r.ok){
          r.text().then(function(t){ console.error('[Blue3] INSERT erro '+r.status+':',t); });
          erros++;
        }
        insertNext();
      })
      .catch(function(err){ console.error('[Blue3] INSERT falhou:',err); erros++; insertNext(); });
    }
    insertNext();
  });
}

// ── Carregar dados do Supabase ──
function blue3LoadData(callback){
  supaFetch('candidatos?order=updated_at.desc&limit=500',{prefer:'return=representation'})
  .then(function(r){return r.json();})
  .then(function(rows){
    if(!rows||!rows.length){
      var local=localStorage.getItem('B3D');
      if(local){try{callback(JSON.parse(local));return;}catch(e){}}
      callback([]);
      return;
    }
    // Capturar data da última atualização do registro mais recente
    if(rows[0] && rows[0].updated_at){
      var d = new Date(rows[0].updated_at);
      var months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      var dateStr = d.getDate().toString().padStart(2,'0')+' '+months[d.getMonth()]+' '+d.getFullYear();
      localStorage.setItem('B3D_DATE', dateStr);
    }
    // Converter formato Supabase para B3D
    var converted=rows.map(function(r){
      var o={};
      o['Candidato']=r.candidato||'';
      o['Senioridade']=r.senioridade||'';
      o['Origem']=r.origem||'';
      o['Filial']=r.filial||'';
      o['Hunter']=r.hunter||'';
      o['Sign in']=r.sign_in||0;
      o['Piso']=r.piso||0;
      o['Período']=r.periodo||12;
      o['Total Captação (MM)']=r.total_captacao_mm?r.total_captacao_mm*1e6:0;
      o['Total Comp.']=r.total_comp||0;
      o['Data de Contratação']=r.data_contratacao||'';
      o['Status']=r.status||'';
      o['MOU']=r.mou||'';
      o['Prev. Inicio']=r.prev_inicio||'';
      o['Ancord']=r.ancord||'';
      o['Detalhe Coparticipação']=r.coparticipacao||0;
      o['Trigger 1 Tri']=r.trigger1_tri||0;
      o['Trigger 1']=r.trigger1||0;
      o['Trigger 2']=r.trigger2||0;
      o['Trigger 3']=r.trigger3||0;
      o['Trigger 4']=r.trigger4||0;
      return o;
    });
    localStorage.setItem('B3D',JSON.stringify(converted));
    callback(converted);
  })
  .catch(function(){
    var local=localStorage.getItem('B3D');
    if(local){try{callback(JSON.parse(local));return;}catch(e){}}
    callback([]);
  });
}

// ── dataLoader (lê de window.Blue3Data._rawRows) ──
function Blue3_dataLoader(){
  var rows=window.Blue3Data._rawRows;
  if(!rows||!rows.length)return false;
  window.Blue3Data.candidatos=rows.map(function(r){
    return{
      n:(r['Candidato']||'').trim(),
      p:(r['Filial']||'').trim(),
      h:(r['Hunter']||'').trim(),
      sen:(r['Senioridade']||'').trim(),
      org:(r['Origem']||'').trim(),
      mou:(r['MOU']||'').trim(),
      st:(r['Status']||'').trim(),
      ancord:(r['Ancord']||'').trim(),
      piso:pn(r['Piso']),
      si:pn(r['Sign in']),
      xp:pn(r['Detalhe Coparticipação']),
      comp:pn(r['Total Comp.']),
      cap:Math.round(pn(r['Total Captação (MM)'])/1e6),
      periodo:Math.round(parseFloat(String(r['Período']||'12').replace(',','.'))||12),
      trigs:[pn(r['Trigger 1 Tri']),pn(r['Trigger 1']),pn(r['Trigger 2']),pn(r['Trigger 3']),pn(r['Trigger 4'])],
      dt:(r['Data de Contratação']||null),
      inicio:(r['Prev. Inicio']||null)
    };
  }).filter(function(r){var s=norm(r.st);return r.n&&(s==='trabalhando'||s==='contratado(a)');});
  return window.Blue3Data.candidatos.length>0;
}

function Blue3_financeMetrics(){
  var C=window.Blue3Data.candidatos,TM=[3,6,12,18,24];
  window.Blue3Data.financeiros=C.map(function(r){
    var pt=r.piso*r.periodo,tt=r.trigs.reduce(function(s,t){return s+t;},0),tm={};
    TM.forEach(function(m,i){if(r.trigs[i]>0)tm[m]=(tm[m]||0)+r.trigs[i];});
    return{n:r.n,p:r.p,h:r.h,sen:r.sen,mou:r.mou,st:r.st,piso:r.piso,periodo:r.periodo,si:r.si,xp:r.xp,comp:r.comp,cap:r.cap,pisoTotal:Math.round(pt),trigTotal:Math.round(tt),custoTotal:Math.round(pt+r.si+tt),trigMap:tm,ativo:!!r.inicio,inicio:r.inicio,dt:r.dt,org:r.org,ancord:r.ancord};
  });
  var F=window.Blue3Data.financeiros,bm={},sbm={};
  F.forEach(function(r){var mo=getMonth(r.dt);if(mo){bm[mo]=(bm[mo]||0)+1;if(norm(r.sen)==='sênior')sbm[mo]=(sbm[mo]||0)+1;}});
  var AT=F.length,seniors=F.filter(function(r){return norm(r.sen)==='sênior';});
  var ps={};F.forEach(function(r){if(r.p)ps[r.p]=1;});
  var maior=F.length?F.reduce(function(a,b){return b.cap>a.cap?b:a;}):null;
  window.Blue3Data.resumoGeral={total:AT,brutas:window.Blue3Data._brutas||AT,desist:window.Blue3Data._desist||0,trab:F.filter(function(r){return norm(r.st)==='trabalhando';}).length,contCount:F.filter(function(r){return norm(r.st)==='contratado(a)';}).length,mouOk:F.filter(function(r){return norm(r.mou)==='assinado';}).length,mouPend:F.filter(function(r){return norm(r.mou)==='pendente';}).length,ancord:F.filter(function(r){return norm(r.ancord)==='sim';}).length,aucTotal:F.reduce(function(s,r){return s+r.cap;},0),compTotal:F.reduce(function(s,r){return s+r.comp;},0),siTotal:F.reduce(function(s,r){return s+r.si;},0),xpTotal:F.reduce(function(s,r){return s+r.xp;},0),blue3Liq:F.reduce(function(s,r){return s+r.comp;},0)-F.reduce(function(s,r){return s+r.xp;},0),siCount:F.filter(function(r){return r.si>0;}).length,seniors:seniors.length,plenos:F.filter(function(r){return norm(r.sen)==='pleno';}).length,juniors:F.filter(function(r){return norm(r.sen)==='junior'||norm(r.sen)==='júnior';}).length,seniorPct:AT>0?Math.round(seniors.length/AT*100):0,pracas:Object.keys(ps).length,brutas:AT+3,maiorCand:maior,byMonth:bm,senByMonth:sbm,aucB:(F.reduce(function(s,r){return s+r.cap;},0)/1000).toFixed(2).replace('.',',')};
}

function Blue3_payback(){
  window.Blue3Data.paybacks=window.Blue3Data.financeiros.map(function(r){
    var rec=r.cap>0?Math.round(r.cap*1e6*0.01/12):0,ac=0,mp=null;
    for(var m=1;m<=36;m++){ac+=rec-(m<=r.periodo?r.piso:0);if(ac>=0&&mp===null)mp=m;}
    return{n:r.n,receita:rec,mesPayback:mp};
  });
}

function Blue3_huntersPerformance(){
  var C=window.Blue3Data.candidatos,hs={'Eduarda':true,'Bianca':true,'Paulo':true};
  C.forEach(function(r){if(r.h)hs[r.h]=true;});
  window.Blue3Data.hunters=Object.keys(hs).map(function(h){
    var rows=C.filter(function(r){return norm(r.h)===norm(h);});
    return{nome:h,total:rows.length,senior:rows.filter(function(r){return norm(r.sen)==='sênior';}).length,pleno:rows.filter(function(r){return norm(r.sen)==='pleno';}).length,junior:rows.filter(function(r){return norm(r.sen)==='junior'||norm(r.sen)==='júnior';}).length,auc:rows.reduce(function(s,r){return s+r.cap;},0),comp:rows.reduce(function(s,r){return s+r.comp;},0),mouOk:rows.filter(function(r){return norm(r.mou)==='assinado';}).length,trab:rows.filter(function(r){return norm(r.st)==='trabalhando';}).length,xp:rows.reduce(function(s,r){return s+r.xp;},0)};
  });
}

function Blue3_pipelineStrategic(){
  window.Blue3Data.pipeline    = window.Blue3Data._pipeline    || [];
  window.Blue3Data.pipelineNeg = window.Blue3Data._pipelineNeg || [];
}

function Blue3_maPipeline(){
  var all = window.Blue3Data._ma || [];
  window.Blue3Data.ma          = all.filter(function(r){ return !r.dec; });
  window.Blue3Data.maDeclinados = all.filter(function(r){ return r.dec; });
}

// ── Upload CSV ──
function b3ImportCSV(input){
  var file=input.files[0]; if(!file)return;
  var rd=new FileReader();
  rd.onload=function(e){
    try{
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
      var lines=text.split('\n').filter(function(l){return l.trim();});
      if(lines.length<2){alert('CSV inválido.');return;}
      var sep=lines[0].indexOf(';')>-1?';':',';
      var h=lines[0].split(sep).map(function(x){return x.trim().replace(/^\uFEFF/,'').replace(/^"|"$/g,'');});
      var rows=[];
      for(var i=1;i<lines.length;i++){
        if(!lines[i].trim())continue;
        var v=lines[i].split(sep),o={};
        h.forEach(function(hh,j){o[hh]=(v[j]||'').trim().replace(/^"|"$/g,'');});
        var st=(o['Status']||'').trim();
        if(o['Candidato']&&(st==='Trabalhando'||st==='Contratado(a)'))rows.push(o);
      }
      if(!rows.length){alert('Nenhum candidato válido.');return;}
      // Salvar no Supabase (e localStorage como fallback)
      blue3SaveCSV(rows,function(ok,count){
        alert('\u2705 '+count+' candidatos carregados e sincronizados com a nuvem!');
        if(window.b3OnCSVLoaded)window.b3OnCSVLoaded(rows);
        updateCSVStatus&&updateCSVStatus();
      });
    }catch(err){alert('Erro: '+err.message);}
    input.value='';
  };
  rd.readAsText(file,'UTF-8');
}

// ── Pipeline principal ──

function blue3SavePipelines(contratados, negociacao, ma){
  var headers = {
    'apikey':        SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal'
  };

  // Salvar Pipeline Estratégico
  fetch(SUPA_URL+'/rest/v1/pipeline_estrategico?id=gte.0',{method:'DELETE',headers:headers})
  .catch(function(){})
  .then(function(){
    var rows = contratados.map(function(r){
      return{nome:r.n,praca:r.p,instituicao:r.i,auc_mm:r.a,tipo:'Contratado'};
    }).concat(negociacao.map(function(r){
      return{nome:r.n,praca:r.p,instituicao:r.i,auc_mm:r.a,tipo:'Negociação'};
    }));
    if(!rows.length) return;
    return fetch(SUPA_URL+'/rest/v1/pipeline_estrategico',
      {method:'POST',headers:headers,body:JSON.stringify(rows)});
  })
  .catch(function(e){console.error('[Blue3] Pipeline Estratégico save erro:',e);});

  // Salvar M&A
  fetch(SUPA_URL+'/rest/v1/ma_pipeline?id=gte.0',{method:'DELETE',headers:headers})
  .catch(function(){})
  .then(function(){
    var rows = ma.map(function(r){
      return{nome:r.n,praca:r.p,auc_b:r.a,status:r.s};
    });
    if(!rows.length) return;
    return fetch(SUPA_URL+'/rest/v1/ma_pipeline',
      {method:'POST',headers:headers,body:JSON.stringify(rows)});
  })
  .catch(function(e){console.error('[Blue3] M&A save erro:',e);});
}
function Blue3_runPipeline(rows){
  window.Blue3Ready = false;

  // Preservar dados do Supabase antes de recriar Blue3Data
  var prevMA  = (window.Blue3Data && window.Blue3Data._ma)          || [];
  var prevPE  = (window.Blue3Data && window.Blue3Data._pipeline)    || [];
  var prevPN  = (window.Blue3Data && window.Blue3Data._pipelineNeg) || [];

  window.Blue3Data = {
    candidatos:[], financeiros:[], paybacks:[],
    hunters:[], pipeline:[], ma:[], resumoGeral:{},
    _rawRows: rows || [],
    _ma:          prevMA,
    _pipeline:    prevPE,
    _pipelineNeg: prevPN
  };

  if (!rows || !rows.length) {
    var local = localStorage.getItem('B3D');
    if (local) {
      try { window.Blue3Data._rawRows = JSON.parse(local); }
      catch(e) { return false; }
    } else { return false; }
  }

  if (!Blue3_dataLoader())   return false;
  Blue3_financeMetrics();
  Blue3_payback();
  Blue3_huntersPerformance();
  Blue3_pipelineStrategic();
  Blue3_maPipeline();
  window.Blue3Ready = true;
  return true;
}

// ── Inicializar a partir do Supabase ──
function Blue3_init(callback){
  var resultCand=[], resultMA=[], resultPE=[], done=0;

  function finish(){
    done++;
    if(done < 3) return;
    window.Blue3Data = window.Blue3Data || {};
    window.Blue3Data._pipeline    = resultPE.filter(function(r){return r.tipo==='Contratado';});
    window.Blue3Data._pipelineNeg = resultPE.filter(function(r){return r.tipo==='Negociação';});
    window.Blue3Data._ma          = resultMA;
    var ok = Blue3_runPipeline(resultCand);
    if(callback) callback(ok, resultCand.length);
  }

  // 1. Candidatos (inclui captura da data inline no blue3LoadData)
  blue3LoadData(function(rows){
    resultCand = rows || [];
    finish();
  });

  // 2. M&A
  supaFetch('ma_pipeline?order=id.asc',{prefer:'return=representation'})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    resultMA = (rows||[]).map(function(r){
      return {n:r.nome||'',p:r.praca||'',a:parseFloat(r.auc_b)||0,s:r.status||'',dec:r.declinado||false};
    });
    finish();
  })
  .catch(function(){ resultMA=[]; finish(); });

  // 3. Pipeline Estratégico
  supaFetch('pipeline_estrategico?order=id.asc',{prefer:'return=representation'})
  .then(function(r){ return r.json(); })
  .then(function(rows){
    resultPE = (rows||[]).map(function(r){
      return {n:r.nome||'',p:r.praca||'',i:r.instituicao||'',
              a:parseFloat(r.auc_mm)||0,tipo:r.tipo||'Contratado'};
    });
    finish();
  })
  .catch(function(){ resultPE=[]; finish(); });
}

window.b3OnCSVLoaded=function(rows){
  if(Blue3_runPipeline(rows)){
    if(typeof renderPage==='function')renderPage();
  }
};

window.addEventListener('storage',function(e){
  if(e.key==='B3D'){
    var local=localStorage.getItem('B3D');
    if(local){try{var r=JSON.parse(local);if(Blue3_runPipeline(r)&&typeof renderPage==='function')renderPage();}catch(ex){}}
  }
});

console.log('[Blue3] pipeline.js v5 carregado — Supabase integrado.');

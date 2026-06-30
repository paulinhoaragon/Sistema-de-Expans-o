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
  var s=String(v||'0').replace(/R\$|\s/g,'').trim();
  // Formato Supabase (americano): 9265.82 — ponto é decimal, sem vírgula
  // Formato CSV PT-BR: 9.265,82 — ponto é milhar, vírgula é decimal
  if(s.indexOf(',')>-1){
    // PT-BR: remove pontos de milhar, troca vírgula por ponto
    s=s.replace(/\./g,'').replace(',','.');
  }
  // Se não tem vírgula, ponto já é decimal — não remove
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

// ── Carregar dados do CRM (crm_candidatos) ──
function blue3LoadData(callback){
  // Primeiro carrega crm_candidatos (essencial), depois tenta propostas (opcional)
  supaFetch('crm_candidatos?order=data_entrada.desc&limit=500',{prefer:'return=representation'})
  .then(function(r){return r.json();})
  .then(function(rows){
    if(!rows||!rows.length){ callback([]); return; }

    // Tenta buscar payback das propostas — falha silenciosa se não conseguir
    supaFetch('propostas?select=telefone,nome,payback_meses&order=versao.desc&limit=1000',{prefer:'return=representation'})
    .then(function(pr){ return pr.ok ? pr.json() : []; })
    .catch(function(){ return []; })
    .then(function(propRows){
      // Join por telefone (primário) e nome (fallback)
      var pbByTelMap = {}, pbByNomeMap = {};
      (propRows||[]).forEach(function(p){
        var tel  = (p.telefone||'').replace(/\D/g,'');
        var nome = (p.nome||'').trim().toLowerCase();
        if(tel  && p.payback_meses && !pbByTelMap[tel])  pbByTelMap[tel]  = parseInt(p.payback_meses)||0;
        if(nome && p.payback_meses && !pbByNomeMap[nome]) pbByNomeMap[nome] = parseInt(p.payback_meses)||0;
      });
      _processCrmRows(rows, pbByTelMap, pbByNomeMap, callback);
    });
  })
  .catch(function(){
    console.error('Erro ao carregar dados do Supabase');
    callback([]);
  });
}

function _processCrmRows(rows, pbByIdMap, pbByNomeMap, callback){
    // Capturar data da última atualização
    if(rows[0] && rows[0].atualizado_em){
      var d = new Date(rows[0].atualizado_em);
      var months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      var dateStr = d.getDate().toString().padStart(2,'0')+' '+months[d.getMonth()]+' '+d.getFullYear();
      localStorage.setItem('B3D_DATE', dateStr);
    }
    // Mapear etapa CRM → Status compatível com pipeline
    function etapaToStatus(etapa){
      var e = norm(etapa);
      if(e==='trabalhando')   return 'Trabalhando';
      if(e==='contratação')   return 'Contratado(a)';
      if(e==='declinou')      return 'Desistência';
      return etapa || '';
    }
    // Converter crm_candidatos → formato B3D (compatível com Blue3_dataLoader)
    var converted = rows.map(function(r){
      var totalCap = ((parseFloat(r.trigger1_tri_meta)||0)
                    + (parseFloat(r.trigger1_meta)||0)
                    + (parseFloat(r.trigger2_meta)||0)
                    + (parseFloat(r.trigger3_meta)||0)
                    + (parseFloat(r.trigger4_meta)||0)); // em MM
      // Sanity check: se valor > 10000 provavelmente foi salvo em R$ — converter para MM
      if (totalCap > 10000) totalCap = totalCap / 1e6;
      var totalComp = ((parseFloat(r.piso)||0) * (parseInt(r.periodo)||12))
                    + (parseFloat(r.upfront)||0)
                    + (parseFloat(r.trigger1_tri_val)||0)
                    + (parseFloat(r.trigger1_val)||0)
                    + (parseFloat(r.trigger2_val)||0)
                    + (parseFloat(r.trigger3_val)||0)
                    + (parseFloat(r.trigger4_val)||0);
      var o={};
      o['Candidato']             = (r.nome||'').trim();
      o['Senioridade']           = (r.nivel||'').trim();
      o['Origem']                = (r.instituicao||'').trim();
      o['AuC Custódia']          = parseFloat(r.auc_custodia_mm)||0; // carteira atual (MM) — distinto de Total Captação
      o['Filial']                = (r.praca||'').trim();
      o['Hunter']                = (r.hunter||'').trim();
      o['Sign in']               = parseFloat(r.upfront)||0;
      o['Piso']                  = parseFloat(r.piso)||0;
      o['Período']               = parseInt(r.periodo)||12;
      o['Total Captação (MM)']   = totalCap * 1e6; // MM → R$ para Blue3_dataLoader dividir de volta
      o['Total Comp.']           = totalComp;
      var _statusFinal = etapaToStatus(r.etapa);
      // _foi_contratado = TRUE se data_contratacao foi gravada no banco
      var _foiContratado = !!(r.data_contratacao);
      // Data de referência = SOMENTE a data de contratação real.
      // Se não houver data_contratacao, fica null (não usa data_entrada como
      // fallback, senão a coluna "Contrat." mostraria a entrada disfarçada).
      var _dataContrat = r.data_contratacao || null;
      o['Data de Contratação']   = _dataContrat
        ? _dataContrat.split('-').reverse().join('/')
        : '';
      o['_foi_contratado']       = _foiContratado;
      o['foiContratado']         = _foiContratado;
      o['Status']                = _statusFinal;
      o['MOU']                   = (r.mou||'').trim();
      o['Data MOU']              = r.data_mou || '';
      o['Prev. Inicio']          = r.prev_inicio || '';
      o['Data Inicio']           = r.data_inicio || '';
      o['Ancord']                = (r.status_ancord||'').trim();
      o['Área']                  = (r.vaga||'Assessor').trim();
      o['Detalhe Coparticipação']= parseFloat(r.coparticipacao)||0;
      o['Coparticipação Condição']= (r.detalhe_coparticipacao || '').toString().trim();
      o['Trigger 1 Tri']         = parseFloat(r.trigger1_tri_val)||0;
      o['Trigger 1']             = parseFloat(r.trigger1_val)||0;
      o['Trigger 2']             = parseFloat(r.trigger2_val)||0;
      o['Trigger 3']             = parseFloat(r.trigger3_val)||0;
      o['Trigger 4']             = parseFloat(r.trigger4_val)||0;
      o['Estratégico']           = (r.estrategico||'Não').trim();
      o['Telefone']              = (r.telefone||'').trim();
      o['_crm_id']               = r.id || '';
      o['data_entrada']          = r.data_entrada || '';
      o['data_declinio']         = r.data_declinio || '';
      o['historico_etapas']      = r.historico_etapas || null;
      o['lider']                 = (r.lider||'').trim();
      var _tel  = (r.telefone||'').replace(/\D/g,'');
      var _nome = (r.nome||'').trim().toLowerCase();
      o['payback_meses'] = pbByIdMap[_tel] || pbByNomeMap[_nome] || parseInt(r.payback_meses) || 0;
      return o;
    });
    // Não salvar em localStorage — dados sempre frescos do Supabase
    callback(converted);
}

// ── dataLoader (lê de window.Blue3Data._rawRows) ──
function Blue3_dataLoader(){
  var rows=window.Blue3Data._rawRows;
  if(!rows||!rows.length)return false;
  var all=rows.map(function(r){
    return{
      n:(r['Candidato']||'').trim(),
      p:(r['Filial']||'').trim(),
      h:(r['Hunter']||'').trim(),
      lider:(r['lider']||'').trim(),
      sen:(r['Senioridade']||'').trim(),
      area:(r['Área']||r['Area']||'Assessor').trim(),
      org:(r['Origem']||'').trim(),
      aucCust:pn(r['AuC Custódia']),
      mou:(r['MOU']||'').trim(),
      data_mou:(r['Data MOU']||'').trim(),
      st:(r['Status']||'').trim(),
      ancord:(r['Ancord']||'').trim(),
      piso:pn(r['Piso']),
      si:pn(r['Sign in']),
      xp:pn(r['Detalhe Coparticipação']),
      xpCond:(r['Coparticipação Condição']||'').trim(),
      comp:pn(r['Total Comp.']),
      cap:Math.round(pn(r['Total Captação (MM)'])/1e6),
      periodo:Math.round(parseFloat(String(r['Período']||'12').replace(',','.'))||12),
      trigs:[pn(r['Trigger 1 Tri']),pn(r['Trigger 1']),pn(r['Trigger 2']),pn(r['Trigger 3']),pn(r['Trigger 4'])],
      dt:(r['Data de Contratação']||null),
      foiContratado:!!(r['_foi_contratado']),
      inicio:(r['Data Inicio']||r['Prev. Inicio']||null),
      inicioReal:(r['Data Inicio']||null),
      prevInicio:(r['Prev. Inicio']||null),
      estrategico:(r['Estratégico']||'Não').trim(),
      tel:(r['Telefone']||'').trim(),
      _id:(r['_crm_id']||''),
      hist:(r['historico_etapas']||r['Historico Etapas']||null),
      dataEntrada:(r['data_entrada']||null),
      dataDeclinio:(r['data_declinio']||null),
      payback_meses:parseInt(r['payback_meses'])||0
    };
  });
  // Desduplicar por nome — previne soma dupla se Supabase retornar duplicatas
  var seen = {};
  var deduped = all.filter(function(r){
    if (!r.n) return false;
    var key = r.n.trim().toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  // Contar brutas e desistências — excluindo Negociação
  var validAll = deduped;
  var brutasStatuses = ['trabalhando','contratado(a)','contratado','desistência','desistencia'];
  var isAssR = function(r){ return (r.area||r.vaga||'Assessor').trim().toLowerCase() === 'assessor'; };
  window.Blue3Data._brutas = validAll.filter(function(r){
    return isAssR(r) && brutasStatuses.indexOf(norm(r.st)) > -1;
  }).length;
  window.Blue3Data._desist = validAll.filter(function(r){
    var s=norm(r.st); return isAssR(r) && (s==='desistência'||s==='desistencia');
  }).length;
  // Aplicar filtro — apenas ativos
  window.Blue3Data.candidatos = validAll.filter(function(r){
    var s=norm(r.st); return s==='trabalhando'||s==='contratado(a)';
  });
  return window.Blue3Data.candidatos.length>0;
}

function Blue3_financeMetrics(){
  var C=window.Blue3Data.candidatos,TM=[3,6,12,18,24];
  window.Blue3Data.financeiros=C.map(function(r){
    var pt=r.piso*r.periodo,tt=r.trigs.reduce(function(s,t){return s+t;},0),tm={};
    TM.forEach(function(m,i){if(r.trigs[i]>0)tm[m]=(tm[m]||0)+r.trigs[i];});
    // DEBUG — remover após diagnóstico
    if(r.n && r.n.toLowerCase().indexOf('azad')>-1){
      console.log('CANDIDATO DEBUG', {
        nome: r.n,
        comp: r.comp,
        piso: r.piso,
        periodo: r.periodo,
        upfront: r.si,
        trigs: r.trigs,
        pt_calculado: pt,
        tt_calculado: tt,
        custoTotal_calculado: Math.round(pt+r.si+tt)
      });
    }
    var _temInicioReal = !!(r.inicioReal && String(r.inicioReal).trim());
    var _mouAssinado = (r.mou||'').trim().toLowerCase() === 'assinado';
    var _assinadoSemInicio = _mouAssinado && !_temInicioReal;
    return{n:r.n,p:r.p,h:r.h,lider:r.lider||'',sen:r.sen,mou:r.mou,st:r.st,piso:r.piso,periodo:r.periodo,si:r.si,xp:r.xp,xpCond:r.xpCond||'',comp:r.comp,cap:r.cap,pisoTotal:Math.round(pt),trigTotal:Math.round(tt),custoTotal:Math.round(pt+r.si+tt),trigMap:tm,ativo:_temInicioReal,assinadoSemInicio:_assinadoSemInicio,inicio:r.inicio,inicioReal:r.inicioReal||null,prevInicio:r.prevInicio||null,dt:r.dt,org:r.org,aucCust:r.aucCust||0,ancord:r.ancord,estrategico:r.estrategico||"Não",data_mou:r.data_mou||'',area:r.area||'Assessor',payback_meses:r.payback_meses||0};
  });
  var F=window.Blue3Data.financeiros,bm={},sbm={};
  F.forEach(function(r){var mo=getMonth(r.dt);if(mo){bm[mo]=(bm[mo]||0)+1;if(norm(r.sen)==='sênior')sbm[mo]=(sbm[mo]||0)+1;}});
  var AT=F.length,seniors=F.filter(function(r){return norm(r.sen)==='sênior';});
  var ps={};F.forEach(function(r){if(r.p)ps[r.p]=1;});
  var maior=F.length?F.reduce(function(a,b){return b.cap>a.cap?b:a;}):null;
  var byArea={};
  F.forEach(function(r){ var a=r.area||'Assessores'; byArea[a]=(byArea[a]||0)+1; });
  var compTotal=F.reduce(function(s,r){return s+r.comp;},0);
  var capTotal=F.reduce(function(s,r){return s+r.cap;},0);
  var xpTotal=F.reduce(function(s,r){return s+r.xp;},0);
  var siTotal=F.reduce(function(s,r){return s+r.si;},0);
  console.log('[FINANCE DEBUG]', { candidatos: F.length, compTotal: compTotal });
  var assF2 = F.filter(function(r){ return (r.area||'Assessor').trim().toLowerCase()==='assessor'; });
  var aucTrab    = assF2.filter(function(r){return norm(r.st)==='trabalhando';}).reduce(function(s,r){return s+(r.cap||0);},0);
  var aucContrat = assF2.reduce(function(s,r){return s+(r.cap||0);},0);
  window.Blue3Data.resumoGeral={total:AT,brutas:window.Blue3Data._brutas||AT,desist:window.Blue3Data._desist||0,aucTrab:aucTrab,aucContrat:aucContrat,byArea:byArea,trab:F.filter(function(r){return norm(r.st)==='trabalhando';}).length,contCount:F.filter(function(r){return norm(r.st)==='contratado(a)';}).length,mouOk:F.filter(function(r){return norm(r.mou)==='assinado';}).length,mouPend:F.filter(function(r){return norm(r.mou)==='pendente';}).length,ancord:F.filter(function(r){return norm(r.ancord)==='sim';}).length,aucTotal:capTotal,compTotal:compTotal,siTotal:siTotal,xpTotal:xpTotal,blue3Liq:compTotal-xpTotal,siCount:F.filter(function(r){return r.si>0;}).length,seniors:seniors.length,plenos:F.filter(function(r){return norm(r.sen)==='pleno';}).length,juniors:F.filter(function(r){return norm(r.sen)==='junior'||norm(r.sen)==='júnior';}).length,seniorPct:AT>0?Math.round(seniors.length/AT*100):0,pracas:Object.keys(ps).length,brutas:window.Blue3Data._brutas||AT,maiorCand:maior,byMonth:bm,senByMonth:sbm,aucB:(capTotal/1000).toFixed(2).replace('.',',')};
}

function Blue3_payback(){
  // Usa payback_meses salvo pelo simulador de proposta — não recalcula
  window.Blue3Data.paybacks=window.Blue3Data.financeiros.map(function(r){
    var mp = r.payback_meses > 0 ? r.payback_meses : null;
    return{n:r.n, mp:mp, mesPayback:mp};
  });
}

function Blue3_huntersPerformance(){
  var C=window.Blue3Data.candidatos; // ativos (trabalhando + contratado)
  var raw=window.Blue3Data._rawRows||[]; // todos incluindo desistentes

  var hs={};
  C.forEach(function(r){if(r.h)hs[r.h]=true;});
  // Incluir também desistentes nos hunters
  raw.forEach(function(r){
    var h=r['Hunter']||r['hunter']||'';
    if(h)hs[h]=true;
  });
  if(typeof HUNTER_DB !== 'undefined' && HUNTER_DB.length){
    HUNTER_DB.forEach(function(h){ if(h.status==='Ativo') hs[h.nome]=true; });
  }

  window.Blue3Data.hunters=Object.keys(hs).map(function(h){
    var ativos=C.filter(function(r){return norm(r.h)===norm(h);});

    // Desistentes via _rawRows
    var desist=raw.filter(function(r){
      var rh=norm(r['Hunter']||r['hunter']||'');
      var s=norm(r['Status']||'');
      return rh===norm(h)&&(s==='desistência'||s==='desistencia');
    });

    var totalFunil=ativos.length+desist.length;
    var txDesist=totalFunil>0?Math.round(desist.length/totalFunil*100):0;

    // Tempo médio até contratação usando data_entrada dos _rawRows
    var tempos=[];
    ativos.forEach(function(r){
      // Tentar historico_etapas primeiro
      var hist=r.hist;
      if(typeof hist==='string'){try{hist=JSON.parse(hist);}catch(e){hist=null;}}
      var inicio=null;
      if(hist&&Array.isArray(hist)&&hist.length){
        var sorted=hist.slice().sort(function(a,b){return new Date(a.entrada||a.timestamp||0)-new Date(b.entrada||b.timestamp||0);});
        inicio=new Date(sorted[0].entrada||sorted[0].timestamp);
      }
      // Fallback: data_entrada do _rawRows
      if(!inicio||isNaN(inicio.getTime())){
        var rawRow=raw.find(function(rr){return norm(rr['Candidato']||rr['nome']||'')===norm(r.n);});
        var de=rawRow&&(rawRow['data_entrada']||rawRow['Data Entrada']||rawRow['Data de Entrada']);
        if(de) inicio=new Date(de);
      }
      if(!inicio||isNaN(inicio.getTime()))return;
      // Usar a data mais antiga entre início e contratação
      var fim=r.dt?new Date(r.dt.split('/').reverse().join('-')):new Date();
      if(inicio>fim){ var tmp=inicio; inicio=fim; fim=tmp; }
      var dias=Math.round((fim-inicio)/(1000*60*60*24));
      if(dias>0&&dias<500)tempos.push(dias);
    });
    var tempoMedio=tempos.length?Math.round(tempos.reduce(function(s,v){return s+v;},0)/tempos.length):null;

    return{
      nome:h,total:ativos.length,
      senior:ativos.filter(function(r){return norm(r.sen)==='sênior';}).length,
      pleno:ativos.filter(function(r){return norm(r.sen)==='pleno';}).length,
      junior:ativos.filter(function(r){var s=norm(r.sen);return s==='junior'||s==='júnior';}).length,
      auc:ativos.reduce(function(s,r){return s+(r.cap||0);},0),
      comp:ativos.reduce(function(s,r){return s+(r.comp||0);},0),
      mouOk:ativos.filter(function(r){return norm(r.mou)==='assinado';}).length,
      trab:ativos.filter(function(r){return norm(r.st)==='trabalhando';}).length,
      xp:ativos.reduce(function(s,r){return s+(r.xp||0);},0),
      txDesist:txDesist,
      tempoMedio:tempoMedio,
      totalFunil:totalFunil
    };
  });
}

function Blue3_pipelineStrategic(){
  // Pipeline estratégico 100% do crm_candidatos — tabela pipeline_estrategico ignorada
  var C = window.Blue3Data.candidatos || [];
  var etapasAtivas = ['trabalhando','contratado(a)','contratado'];

  window.Blue3Data.pipeline = C.filter(function(r){
    var isEstrat = (r.estrategico||'').toLowerCase() === 'sim';
    var isAtivo  = etapasAtivas.indexOf(norm(r.st)) > -1;
    return isEstrat && isAtivo;
  }).map(function(r){
    // Situação de transição (mesma lógica do cashflow):
    //  ativo (trabalhando/tombou) > assinado sem início (MOU ok, sem início real) > a confirmar
    var _temInicio = !!r.inicioReal;
    var _mouOk = (r.mou||'').toLowerCase() === 'assinado';
    var _sit = _temInicio ? 'trabalhando' : (_mouOk ? 'assinado' : 'aconf');
    return { n:r.n, p:r.p, i:r.org||'', a:r.cap||0, tipo:'Contratado',
             sit:_sit, mou:r.mou||'', st:r.st||'' };
  });

  window.Blue3Data.pipelineNeg = window.Blue3Data._pipelineNeg || [];
}

function Blue3_maPipeline(){
  var all = window.Blue3Data._ma || [];
  window.Blue3Data.ma          = all.filter(function(r){ return !r.dec && r.s !== 'Declinou'; });
  window.Blue3Data.maDeclinados = all.filter(function(r){ return r.dec || r.s === 'Declinou'; });
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
      var rows=[], allRows=[];
      for(var i=1;i<lines.length;i++){
        if(!lines[i].trim())continue;
        var v=lines[i].split(sep),o={};
        h.forEach(function(hh,j){o[hh]=(v[j]||'').trim().replace(/^"|"$/g,'');});
        var st=(o['Status']||'').trim();
        if(!o['Candidato'])continue;
        allRows.push(o); // todas as linhas com nome válido
        if(st==='Trabalhando'||st==='Contratado(a)')rows.push(o);
      }
      if(!rows.length){alert('Nenhum candidato válido.');return;}
      // Salvar todas as linhas (incluindo desistentes) para uso interno
      localStorage.setItem('B3D_RAW', JSON.stringify(allRows));
      // Salvar no Supabase apenas os ativos (e localStorage como fallback)
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
var __B3_LOCKED__ = false;
function Blue3_runPipeline(rows){
  if (__B3_LOCKED__) {
    console.warn('[PIPELINE] Bloqueado — já executou uma vez.');
    return false;
  }
  __B3_LOCKED__ = true;
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

  if (!rows || !rows.length) { return false; }

  console.log('[PIPELINE RUN]', { total_rows: rows.length });

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
  // Tentar limpar cache — pode falhar em iframes com Tracking Prevention
  try { localStorage.removeItem('B3D'); localStorage.removeItem('B3D_RAW'); } catch(e){}
  var resultCand=[], resultMA=[], resultPE=[], done=0;

  var _finished = false;
  function finish(){
    done++;
    if(done < 3) return;
    if(_finished) return; // previne execução dupla
    _finished = true;
    // Recriar Blue3Data do zero — sem herdar estado anterior
    window.Blue3Data = {
      candidatos:[], financeiros:[], paybacks:[],
      hunters:[], pipeline:[], ma:[], resumoGeral:{},
      _rawRows: resultCand,
      _ma:          resultMA,
      _pipeline:    resultPE.filter(function(r){return r.tipo==='Contratado';}),
      _pipelineNeg: resultPE.filter(function(r){return r.tipo==='Negociação';})
    };
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
      return {id:r.id||'',n:r.nome||'',p:r.praca||'',a:parseFloat(r.auc_b)||0,s:r.status||'',dec:r.declinado||false};
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

console.log('[Blue3] pipeline.js v6 carregado — fonte: crm_candidatos (Supabase).');

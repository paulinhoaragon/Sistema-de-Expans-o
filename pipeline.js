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
  // 1. Apagar todos os registros anteriores
  supaFetch('candidatos?id=gte.0', {method:'DELETE'})
    .then(function(){
      // 2. Inserir novos registros em lotes de 50
      var lotes=[], tam=50;
      for(var i=0;i<rows.length;i+=tam) lotes.push(rows.slice(i,i+tam));
      var idx=0;
      function insertNext(){
        if(idx>=lotes.length){
          localStorage.setItem('B3D',JSON.stringify(rows)); // fallback local
          if(onDone)onDone(true,rows.length);
          return;
        }
        var lote=lotes[idx++].map(function(r){
          return{
            candidato: (r['Candidato']||'').trim(),
            senioridade:(r['Senioridade']||'').trim(),
            origem:    (r['Origem']||'').trim(),
            filial:    (r['Filial']||'').trim(),
            hunter:    (r['Hunter']||'').trim(),
            sign_in:   pn(r['Sign in']),
            piso:      pn(r['Piso']),
            periodo:   Math.round(parseFloat(String(r['Período']||'12').replace(',','.'))||12),
            total_captacao_mm: Math.round(pn(r['Total Captação (MM)'])/1e6),
            total_comp:pn(r['Total Comp.']),
            data_contratacao:(r['Data de Contratação']||null)||null,
            status:    (r['Status']||'').trim(),
            mou:       (r['MOU']||'').trim(),
            prev_inicio:(r['Prev. Inicio']||null)||null,
            ancord:    (r['Ancord']||'').trim(),
            coparticipacao:pn(r['Detalhe Coparticipação']),
            trigger1_tri:pn(r['Trigger 1 Tri']),
            trigger1:  pn(r['Trigger 1']),
            trigger2:  pn(r['Trigger 2']),
            trigger3:  pn(r['Trigger 3']),
            trigger4:  pn(r['Trigger 4'])
          };
        });
        supaFetch('candidatos',{method:'POST',body:lote,prefer:'return=minimal'})
          .then(insertNext)
          .catch(function(){
            // Fallback só localStorage
            localStorage.setItem('B3D',JSON.stringify(rows));
            if(onDone)onDone(true,rows.length);
          });
      }
      insertNext();
    })
    .catch(function(){
      localStorage.setItem('B3D',JSON.stringify(rows));
      if(onDone)onDone(true,rows.length);
    });
}

// ── Carregar dados do Supabase ──
function blue3LoadData(callback){
  supaFetch('candidatos?order=id.asc&limit=500',{prefer:'return=representation'})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length){
        // Tentar localStorage como fallback
        var local=localStorage.getItem('B3D');
        if(local){try{callback(JSON.parse(local));return;}catch(e){}}
        callback([]);
        return;
      }
      // Converter formato Supabase → formato B3D
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
      localStorage.setItem('B3D',JSON.stringify(converted)); // cache local
      callback(converted);
    })
    .catch(function(){
      // Fallback localStorage
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
  window.Blue3Data.resumoGeral={total:AT,trab:F.filter(function(r){return norm(r.st)==='trabalhando';}).length,contCount:F.filter(function(r){return norm(r.st)==='contratado(a)';}).length,mouOk:F.filter(function(r){return norm(r.mou)==='assinado';}).length,mouPend:F.filter(function(r){return norm(r.mou)==='pendente';}).length,ancord:F.filter(function(r){return norm(r.ancord)==='sim';}).length,aucTotal:F.reduce(function(s,r){return s+r.cap;},0),compTotal:F.reduce(function(s,r){return s+r.comp;},0),siTotal:F.reduce(function(s,r){return s+r.si;},0),xpTotal:F.reduce(function(s,r){return s+r.xp;},0),blue3Liq:F.reduce(function(s,r){return s+r.comp;},0)-F.reduce(function(s,r){return s+r.xp;},0),siCount:F.filter(function(r){return r.si>0;}).length,seniors:seniors.length,plenos:F.filter(function(r){return norm(r.sen)==='pleno';}).length,juniors:F.filter(function(r){return norm(r.sen)==='junior'||norm(r.sen)==='júnior';}).length,seniorPct:AT>0?Math.round(seniors.length/AT*100):0,pracas:Object.keys(ps).length,brutas:AT+3,maiorCand:maior,byMonth:bm,senByMonth:sbm,aucB:(F.reduce(function(s,r){return s+r.cap;},0)/1000).toFixed(2).replace('.',',')};
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
  window.Blue3Data.pipeline=[{n:'Pedro',i:'XP - Plus Investimentos',p:'',a:275},{n:'Eduardo',i:'XP - Fatorial',p:'',a:40},{n:'Isabela',i:'BTG - Jobin',p:'',a:80},{n:'Marco Ratton',i:'XP - Santé',p:'',a:34},{n:'Daniel Lima',i:'BTG - AUVP',p:'',a:20},{n:'Carla Proença',i:'BTG - Origem Capital',p:'',a:26},{n:'Leandro',i:'XP - Quaestor',p:'',a:180}];
}

function Blue3_maPipeline(){
  window.Blue3Data.ma=[{n:'All Investimentos',p:'nan',a:3.5,s:'Deal'},{n:'Norte Investimentos',p:'nan',a:0.56,s:'Proposta Apresentada'},{n:'Ibbra Planejamento Financeiro',p:'nan',a:0.6,s:'Prospecção'},{n:'Petropolis Investimentos',p:'nan',a:4.5,s:'NDA'},{n:'Olimpo Investimentos',p:'nan',a:3.5,s:'NDA'},{n:'Arcani Investimentos',p:'nan',a:1.8,s:'Prospecção'},{n:'Choice Investimentos',p:'nan',a:3.1,s:'Prospecção'},{n:'Liberta Investimentos',p:'nan',a:7.5,s:'Documentação Valuation'}];
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
      // Salvar no Supabase E localStorage
      blue3SaveCSV(rows,function(ok,count){
        alert('✅ '+count+' candidatos carregados e sincronizados!');
        if(window.b3OnCSVLoaded)window.b3OnCSVLoaded(rows);
      });
    }catch(err){alert('Erro: '+err.message);}
    input.value='';
  };
  rd.readAsText(file,'UTF-8');
}

// ── Pipeline principal ──
function Blue3_runPipeline(rows){
  window.Blue3Ready=false;
  window.Blue3Data={candidatos:[],financeiros:[],paybacks:[],hunters:[],pipeline:[],ma:[],resumoGeral:{},_rawRows:rows||[]};
  if(!rows||!rows.length){
    // Tentar localStorage
    var local=localStorage.getItem('B3D');
    if(local){try{window.Blue3Data._rawRows=JSON.parse(local);}catch(e){return false;}}
    else{return false;}
  }
  if(!Blue3_dataLoader())return false;
  Blue3_financeMetrics();
  Blue3_payback();
  Blue3_huntersPerformance();
  Blue3_pipelineStrategic();
  Blue3_maPipeline();
  window.Blue3Ready=true;
  return true;
}

// ── Inicializar a partir do Supabase ──
function Blue3_init(callback){
  blue3LoadData(function(rows){
    var ok=Blue3_runPipeline(rows);
    if(callback)callback(ok,rows.length);
  });
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

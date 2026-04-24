// ════════════════════════════════════════════════════════════════
// Nexus · config.js — Serviço central de configurações
// Importar em qualquer módulo: <script src="config.js"></script>
// ════════════════════════════════════════════════════════════════

var NexusConfig = (function() {

  var SUPA_URL = 'https://cjimsplgxrwkqgzegnkq.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqaW1zcGxneHJ3a3FnemVnbmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTg5MTEsImV4cCI6MjA5MTY3NDkxMX0.V5euouwf-Q4KaskXGB4eLg0FPV7pH96hTrQikcV7K6A';
  var TENANT    = 'default'; // multi-tenant: trocar pelo ID do cliente

  var _cache = {
    parametros: null,
    whiteLabel: null,
    hunters:    null,
  };

  function headers() {
    return {
      'apikey':        SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    };
  }

  function supa(path, opts) {
    return fetch(SUPA_URL + '/rest/v1/' + path, Object.assign({ headers: headers() }, opts || {}))
      .then(function(r) { return r.json(); });
  }

  // ── Parâmetros ──────────────────────────────────────────────────
  function getParametros(cb) {
    if (_cache.parametros) { cb(null, _cache.parametros); return; }
    supa('parametros?tenant_id=eq.' + TENANT + '&limit=1')
      .then(function(rows) {
        var p = (rows && rows[0]) ? rows[0] : {};
        _cache.parametros = p;
        cb(null, p);
      })
      .catch(function(e) { cb(e, null); });
  }

  function saveParametros(dados, cb) {
    _cache.parametros = null; // invalidar cache
    dados.atualizado_em = new Date().toISOString();
    supa('parametros?tenant_id=eq.' + TENANT, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }).then(function(r) { cb(null, r); })
      .catch(function(e) { cb(e, null); });
  }

  // ── White Label ─────────────────────────────────────────────────
  function getWhiteLabel(cb) {
    if (_cache.whiteLabel) { cb(null, _cache.whiteLabel); return; }
    supa('white_label?tenant_id=eq.' + TENANT + '&limit=1')
      .then(function(rows) {
        var wl = (rows && rows[0]) ? rows[0] : {
          nome_empresa: 'Nexus',
          cor_primaria: '#1A3BAD',
          cor_secundaria: '#4A70F5',
          cor_acento: '#B8962E',
          logo_url: '',
        };
        _cache.whiteLabel = wl;
        cb(null, wl);
      })
      .catch(function(e) { cb(e, null); });
  }

  function saveWhiteLabel(dados, cb) {
    _cache.whiteLabel = null;
    dados.atualizado_em = new Date().toISOString();
    supa('white_label?tenant_id=eq.' + TENANT, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }).then(function(r) { cb(null, r); })
      .catch(function(e) { cb(e, null); });
  }

  // Aplica white label nas CSS vars do documento atual
  function applyWhiteLabel(wl) {
    if (!wl) return;
    var r = document.documentElement;
    if (wl.cor_primaria)   r.style.setProperty('--cobalt',    wl.cor_primaria);
    if (wl.cor_secundaria) r.style.setProperty('--cobalt-br', wl.cor_secundaria);
    if (wl.cor_acento)     r.style.setProperty('--gold',      wl.cor_acento);
    // Logo e nome
    var logoEl = document.getElementById('nexus-wl-logo');
    var nomeEl = document.getElementById('nexus-wl-nome');
    if (logoEl && wl.logo_url) { logoEl.src = wl.logo_url; logoEl.style.display = ''; }
    if (nomeEl && wl.nome_empresa) nomeEl.textContent = wl.nome_empresa;
  }

  // ── Hunters ─────────────────────────────────────────────────────
  function getHunters(cb) {
    supa('hunters?order=nome.asc&limit=200')
      .then(function(rows) {
        _cache.hunters = rows || [];
        cb(null, _cache.hunters);
      })
      .catch(function(e) { cb(e, []); });
  }

  function saveHunter(dados, cb) {
    _cache.hunters = null;
    var isNew = !dados.id;
    dados.atualizado_em = new Date().toISOString();
    if (isNew) {
      supa('hunters', { method: 'POST', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    } else {
      var id = dados.id; delete dados.id;
      supa('hunters?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    }
  }

  function deleteHunter(id, cb) {
    _cache.hunters = null;
    supa('hunters?id=eq.' + id, { method: 'DELETE' })
      .then(function() { cb(null); }).catch(function(e) { cb(e); });
  }

  // ── Histórico de etapas CRM ─────────────────────────────────────
  // Registra automaticamente a mudança de etapa
  // Chamar sempre que etapa mudar (drag ou select)
  function registrarMudancaEtapa(candidatoId, etapaAnterior, etapaNova, historicoBruto, cb) {
    var hist = [];
    try { hist = JSON.parse(historicoBruto || '[]'); } catch(e) { hist = []; }

    var agora = new Date().toISOString();

    // Fechar entrada anterior (registrar saída)
    if (hist.length > 0) {
      var ultima = hist[hist.length - 1];
      if (!ultima.saida) ultima.saida = agora;
    }

    // Abrir nova entrada
    hist.push({ etapa: etapaNova, entrada: agora });

    var payload = {
      etapa: etapaNova,
      historico_etapas: JSON.stringify(hist),
      atualizado_em: agora,
    };

    supa('crm_candidatos?id=eq.' + candidatoId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then(function(r) {
      if (cb) cb(null, hist);
    }).catch(function(e) {
      if (cb) cb(e, null);
    });

    return hist; // retorna imediatamente para atualizar UI
  }

  // Calcula tempo médio em dias por etapa a partir do histórico
  function calcularTempoEtapas(historicoBruto) {
    var hist = [];
    try { hist = JSON.parse(historicoBruto || '[]'); } catch(e) { return {}; }
    var tempos = {};
    hist.forEach(function(h) {
      if (!h.entrada) return;
      var entrada = new Date(h.entrada);
      var saida   = h.saida ? new Date(h.saida) : new Date();
      var dias    = Math.round((saida - entrada) / 86400000);
      if (!tempos[h.etapa]) tempos[h.etapa] = { total: 0, count: 0 };
      tempos[h.etapa].total += dias;
      tempos[h.etapa].count += 1;
    });
    // Calcular média
    Object.keys(tempos).forEach(function(e) {
      tempos[e].media = tempos[e].count > 0
        ? Math.round(tempos[e].total / tempos[e].count) : 0;
    });
    return tempos;
  }

  // ── Init automático: aplica white label se disponível ───────────
  function init(cb) {
    getWhiteLabel(function(err, wl) {
      if (!err && wl) applyWhiteLabel(wl);
      if (cb) cb(wl);
    });
  }

  // API pública
  return {
    init:                   init,
    getParametros:          getParametros,
    saveParametros:         saveParametros,
    getWhiteLabel:          getWhiteLabel,
    saveWhiteLabel:         saveWhiteLabel,
    applyWhiteLabel:        applyWhiteLabel,
    getHunters:             getHunters,
    saveHunter:             saveHunter,
    deleteHunter:           deleteHunter,
    registrarMudancaEtapa:  registrarMudancaEtapa,
    calcularTempoEtapas:    calcularTempoEtapas,
    TENANT:                 TENANT,
  };

})();

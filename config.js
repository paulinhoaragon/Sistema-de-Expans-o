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
    lideres:    null,
    regionais:  null,
    pracas:     null,
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
          subtitulo: 'Blue3 Expansão Suite',
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

  // ── Canais / Metas por (hunter, semestre, canal) ────────────────
  // Lista canônica de canais (frentes de contratação). Ordem = exibição.
  var CANAIS = [
    'Assessoria de Investimentos',
    'Vem ser Blue',
    'Blue3 Future',
    'Planejador/Consultor',
    'Vagas Comerciais',
    'M&A'
  ];

  // Mapa VAGA (campo do CRM) → CANAL. Cobre os 13 valores de vaga.
  var VAGA_CANAL = {
    'Assessor':             'Assessoria de Investimentos',
    'Vem ser Blue':         'Vem ser Blue',
    'Future':               'Blue3 Future',
    'Planejador/Consultor': 'Planejador/Consultor',
    'Líder':                'Vagas Comerciais',
    'Advisor':              'Vagas Comerciais',
    'Broker':               'Vagas Comerciais',
    'Offshore':             'Vagas Comerciais',
    'Seguros':              'Vagas Comerciais',
    'Corporate':            'Vagas Comerciais',
    'Assistente':           'Vagas Comerciais',
    'Outros':               'Vagas Comerciais',
    'M&A':                  'M&A'
  };

  // Resolve o canal a partir do valor de vaga. Vazio → Assessor (igual pipeline).
  // Vaga desconhecida cai em 'Vagas Comerciais' (catch-all) para nada sumir.
  function canalDeVaga(vaga) {
    var v = (vaga || '').trim();
    if (!v) v = 'Assessor';
    return VAGA_CANAL[v] || 'Vagas Comerciais';
  }

  // Lê todas as metas por canal (todos os hunters/períodos).
  function getMetasHunter(cb) {
    supa('hunter_metas?order=canal.asc&limit=5000')
      .then(function(rows) { cb(null, rows || []); })
      .catch(function(e) { cb(e, []); });
  }

  // Grava as metas de um (hunter, ano, semestre): substitui o conjunto inteiro.
  // metas = [{ canal, meta_contratacoes }]. Só grava linhas com meta > 0.
  function saveMetasHunter(hunterId, ano, semestre, metas, cb) {
    _cache.hunters = null;
    var filtro = 'hunter_metas?hunter_id=eq.' + hunterId +
                 '&ano=eq.' + ano + '&semestre=eq.' + semestre;
    supa(filtro, { method: 'DELETE' })
      .then(function() {
        var rows = (metas || [])
          .filter(function(m) { return (m.meta_contratacoes || 0) > 0; })
          .map(function(m) {
            return {
              hunter_id:         hunterId,
              ano:               ano,
              semestre:          semestre,
              canal:             m.canal,
              meta_contratacoes: m.meta_contratacoes || 0,
              atualizado_em:     new Date().toISOString()
            };
          });
        log('hunter_metas.save', { hunter_id: hunterId, ano: ano, semestre: semestre, metas: rows });
        if (!rows.length) { cb(null, []); return; }
        supa('hunter_metas', { method: 'POST', body: JSON.stringify(rows) })
          .then(function(r) { cb(null, r); })
          .catch(function(e) { cb(e, null); });
      })
      .catch(function(e) { cb(e, null); });
  }

  // ── Líderes ─────────────────────────────────────────────────────
  // Líder assiste uma ou mais praças. Campo 'pracas' = array (jsonb no banco).
  function getLideres(cb) {
    supa('lideres?order=nome.asc&limit=200')
      .then(function(rows) {
        _cache.lideres = rows || [];
        cb(null, _cache.lideres);
      })
      .catch(function(e) { cb(e, []); });
  }

  function saveLider(dados, cb) {
    _cache.lideres = null;
    var isNew = !dados.id;
    dados.atualizado_em = new Date().toISOString();
    if (isNew) {
      supa('lideres', { method: 'POST', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    } else {
      var id = dados.id; delete dados.id;
      supa('lideres?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    }
  }

  function deleteLider(id, cb) {
    _cache.lideres = null;
    supa('lideres?id=eq.' + id, { method: 'DELETE' })
      .then(function() { cb(null); }).catch(function(e) { cb(e); });
  }

  // ── Regionais ───────────────────────────────────────────────────
  // Regional assiste um bloco de praças. Campo 'pracas' = array (jsonb no banco).
  function getRegionais(cb) {
    supa('regionais?order=nome.asc&limit=200')
      .then(function(rows) {
        _cache.regionais = rows || [];
        cb(null, _cache.regionais);
      })
      .catch(function(e) { cb(e, []); });
  }

  function saveRegional(dados, cb) {
    _cache.regionais = null;
    var isNew = !dados.id;
    dados.atualizado_em = new Date().toISOString();
    if (isNew) {
      supa('regionais', { method: 'POST', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    } else {
      var id = dados.id; delete dados.id;
      supa('regionais?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    }
  }

  function deleteRegional(id, cb) {
    _cache.regionais = null;
    supa('regionais?id=eq.' + id, { method: 'DELETE' })
      .then(function() { cb(null); }).catch(function(e) { cb(e); });
  }

  // ── Praças ──────────────────────────────────────────────────────
  // Cadastro central de praças. Fonte única para CRM e cadastros.
  function getPracas(cb) {
    supa('pracas?order=grupo.asc,nome.asc&limit=300')
      .then(function(rows) {
        _cache.pracas = rows || [];
        cb(null, _cache.pracas);
      })
      .catch(function(e) { cb(e, []); });
  }

  function savePraca(dados, cb) {
    _cache.pracas = null;
    var isNew = !dados.id;
    dados.atualizado_em = new Date().toISOString();
    if (isNew) {
      supa('pracas', { method: 'POST', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    } else {
      var id = dados.id; delete dados.id;
      supa('pracas?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(dados) })
        .then(function(r) { cb(null, r); }).catch(function(e) { cb(e, null); });
    }
  }

  function deletePraca(id, cb) {
    _cache.pracas = null;
    supa('pracas?id=eq.' + id, { method: 'DELETE' })
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

  // ── Usuário da sessão ───────────────────────────────────────────
  // Lê de todas as fontes: window.parent.B3CU → sessionStorage b3s → Blue3Data → fallback
  function getUsuario() {
    try {
      if (window.parent && window.parent.B3CU) {
        var cu = window.parent.B3CU;
        return cu.n || cu.l || cu.nome || cu.email || '';
      }
    } catch(e) {}
    try {
      var raw = sessionStorage.getItem('b3s');
      if (raw) {
        var s = JSON.parse(raw);
        return s.n || s.l || s.nome || s.email || '';
      }
    } catch(e) {}
    try {
      if (window.Blue3Data && window.Blue3Data.usuario) return window.Blue3Data.usuario;
    } catch(e) {}
    return 'Master';
  }

  // ── Log de auditoria centralizado ──────────────────────────────
  // Uso em qualquer módulo: NexusConfig.log('Ação', { campo: valor })
  function log(acao, meta) {
    try {
      var payload = JSON.stringify({
        acao:      acao,
        usuario:   getUsuario(),
        meta:      typeof meta === 'string' ? meta : JSON.stringify(meta || {}),
        criado_em: new Date().toISOString(),
      });
      fetch(SUPA_URL + '/rest/v1/logs_auditoria', {
        method: 'POST',
        headers: {
          'apikey':        SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: payload,
      }).catch(function() {});
    } catch(e) {}
  }

  // ── Init automático: aplica white label se disponível ───────────
  function init(cb) {
    getWhiteLabel(function(err, wl) {
      if (!err && wl) applyWhiteLabel(wl);
      if (cb) cb(wl);
    });
  }

  // ── Listener: recebe cores do index.html via postMessage ─────────
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'wl-cores') return;
    var r = document.documentElement;
    if (e.data.cobalt)   r.style.setProperty('--cobalt',    e.data.cobalt);
    if (e.data.cobaltBr) r.style.setProperty('--cobalt-br', e.data.cobaltBr);
    if (e.data.gold)     r.style.setProperty('--gold',      e.data.gold);
  });

  // Limpa o cache forçando nova leitura do banco na próxima chamada
  function clearCache() {
    _cache.parametros = null;
    _cache.whiteLabel = null;
    _cache.hunters    = null;
    _cache.lideres    = null;
    _cache.regionais  = null;
    _cache.pracas     = null;
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
    CANAIS:                 CANAIS,
    VAGA_CANAL:             VAGA_CANAL,
    canalDeVaga:            canalDeVaga,
    getMetasHunter:         getMetasHunter,
    saveMetasHunter:        saveMetasHunter,
    getLideres:             getLideres,
    saveLider:              saveLider,
    deleteLider:            deleteLider,
    getRegionais:           getRegionais,
    saveRegional:           saveRegional,
    deleteRegional:         deleteRegional,
    getPracas:              getPracas,
    savePraca:              savePraca,
    deletePraca:            deletePraca,
    registrarMudancaEtapa:  registrarMudancaEtapa,
    calcularTempoEtapas:    calcularTempoEtapas,
    clearCache:             clearCache,
    TENANT:                 TENANT,
    getUsuario:             getUsuario,
    log:                    log,
  };

})();

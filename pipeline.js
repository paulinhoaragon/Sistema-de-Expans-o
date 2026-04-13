/**
 * pipeline.js — Blue3 Expansion Suite v4
 * Fonte de verdade: parse + cálculo + localStorage
 * NÃO roda automaticamente — aguarda chamada explícita
 * Nunca persistir window.Blue3Data no localStorage
 */

// ── Objeto global (sempre recriado, nunca persistido) ──
window.Blue3Data = null;
window.Blue3Ready = false;

// ── Utilitários ──

/** Normaliza string para comparação case-insensitive sem espaços */
function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/** Parseia moeda brasileira: "R$ 10.000,00" → 10000 */
function pn(v) {
  var s = String(v || '0').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(s) || 0;
}

/** Extrai mês de string de data (dd/mm/yyyy ou yyyy-mm-dd) */
function getMonth(dtStr) {
  if (!dtStr) return null;
  var p = dtStr.split('/');
  if (p.length === 3) return parseInt(p[1]);
  var p2 = dtStr.split('-');
  return p2.length >= 2 ? parseInt(p2[1]) : null;
}

/** Extrai ano de string de data (dd/mm/yyyy ou yyyy-mm-dd) */
function getYear(dtStr) {
  if (!dtStr) return null;
  var p = dtStr.split('/');
  if (p.length === 3) return parseInt(p[2]);
  var p2 = dtStr.split('-');
  return p2.length >= 2 ? parseInt(p2[0]) : null;
}

/** Formata número para moeda BRL */
function fmtBRL(v) {
  if (!v || v === 0) return '—';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

var MES = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr',
  5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
};

// ── Chart registry — evita duplicação ──
var _chartReg = {};

function safeChart(id, cfg) {
  if (_chartReg[id]) {
    try { _chartReg[id].destroy(); } catch (e) {}
    delete _chartReg[id];
  }
  var el = document.getElementById(id);
  if (!el) {
    console.warn('[Blue3] canvas não encontrado:', id);
    return null;
  }

  // Verificar se há dados válidos
  var hasData = cfg.data && cfg.data.datasets && cfg.data.datasets.some(function (d) {
    return d.data && d.data.some(function (v) { return v != null && v > 0; });
  });

  if (!hasData) {
    var wrapper = el.parentElement;
    if (wrapper) {
      wrapper.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
        + 'height:100%;min-height:120px;color:var(--t3);font-size:12px;font-style:italic;">'
        + 'Dados insuficientes para gerar gráfico</div>';
    }
    console.warn('[Blue3] Dados insuficientes para:', id);
    return null;
  }

  try {
    _chartReg[id] = new Chart(el, cfg);
    return _chartReg[id];
  } catch (e) {
    console.error('[Blue3] Erro no chart', id, e);
    return null;
  }
}

/** Estado vazio padrão */
function showEmptyState(msg) {
  var el = document.getElementById('content') || document.body;
  el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;'
    + 'justify-content:center;height:60vh;gap:16px;">'
    + '<div style="font-size:48px;">📊</div>'
    + '<div style="font-size:16px;font-weight:600;color:var(--t1);">Sem dados carregados</div>'
    + '<div style="font-size:13px;color:var(--t3);">'
    + (msg || 'Acesse a tela inicial e faça o upload do CSV para continuar.')
    + '</div>'
    + '<a href="index.html" style="padding:10px 24px;background:var(--cobalt);color:#fff;'
    + 'border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Ir para a home</a>'
    + '</div>';
}

// ────────────────────────────────────────────────────────────
// MÓDULO 1 — dataLoader
// ────────────────────────────────────────────────────────────
function Blue3_dataLoader() {
  console.log('[Blue3] dataLoader iniciado...');
  var raw = localStorage.getItem('B3D');
  if (!raw) {
    console.warn('[Blue3] B3D não encontrado no localStorage');
    return false;
  }
  var rows;
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    console.error('[Blue3] JSON inválido em B3D:', e);
    return false;
  }
  if (!Array.isArray(rows) || !rows.length) {
    console.warn('[Blue3] B3D vazio');
    return false;
  }

  window.Blue3Data.candidatos = rows.map(function (r) {
    return {
      n:       (r['Candidato'] || '').trim(),
      p:       (r['Filial'] || '').trim(),
      h:       (r['Hunter'] || '').trim(),
      sen:     (r['Senioridade'] || '').trim(),
      org:     (r['Origem'] || '').trim(),
      mou:     (r['MOU'] || '').trim(),
      st:      (r['Status'] || '').trim(),
      ancord:  (r['Ancord'] || '').trim(),
      piso:    pn(r['Piso']),
      si:      pn(r['Sign in']),
      xp:      pn(r['Detalhe Coparticipação']),
      comp:    pn(r['Total Comp.']),
      cap:     Math.round(pn(r['Total Captação (MM)']) / 1e6),
      periodo: Math.round(parseFloat(String(r['Período'] || '12').replace(',', '.')) || 12),
      trigs: [
        pn(r['Trigger 1 Tri']),
        pn(r['Trigger 1']),
        pn(r['Trigger 2']),
        pn(r['Trigger 3']),
        pn(r['Trigger 4']),
      ],
      dt:     (r['Data de Contratação'] || null),
      inicio: (r['Prev. Inicio'] || null),
    };
  }).filter(function (r) {
    var st = norm(r.st);
    return r.n && (st === 'trabalhando' || st === 'contratado(a)');
  });

  if (!window.Blue3Data.candidatos.length) {
    console.error('[Blue3] Nenhum candidato válido após filtro');
    return false;
  }
  console.log('[Blue3] candidatos carregados:', window.Blue3Data.candidatos.length);
  return true;
}

// ────────────────────────────────────────────────────────────
// MÓDULO 2 — financeMetrics
// ────────────────────────────────────────────────────────────
function Blue3_financeMetrics() {
  var C = window.Blue3Data.candidatos;
  var TRIG_MONTHS = [3, 6, 12, 18, 24];

  window.Blue3Data.financeiros = C.map(function (r) {
    var pisoTotal = r.piso * r.periodo;
    var trigTotal = r.trigs.reduce(function (s, t) { return s + t; }, 0);
    var custoTotal = pisoTotal + r.si + trigTotal;
    var trigMap = {};
    TRIG_MONTHS.forEach(function (m, i) {
      if (r.trigs[i] > 0) trigMap[m] = (trigMap[m] || 0) + r.trigs[i];
    });
    return {
      n: r.n, p: r.p, h: r.h, sen: r.sen, mou: r.mou, st: r.st,
      piso: r.piso, periodo: r.periodo, si: r.si, xp: r.xp,
      comp: r.comp, cap: r.cap,
      pisoTotal:  Math.round(pisoTotal),
      trigTotal:  Math.round(trigTotal),
      custoTotal: Math.round(custoTotal),
      trigMap:    trigMap,
      ativo:      !!r.inicio,
      inicio:     r.inicio,
      dt:         r.dt,
      org:        r.org,
      ancord:     r.ancord,
    };
  });

  // resumoGeral
  var F = window.Blue3Data.financeiros;
  var byMonth = {}, senByMonth = {};
  F.forEach(function (r) {
    var mo = getMonth(r.dt);
    if (mo) {
      byMonth[mo] = (byMonth[mo] || 0) + 1;
      if (norm(r.sen) === 'sênior') senByMonth[mo] = (senByMonth[mo] || 0) + 1;
    }
  });

  var AT = F.length;
  var seniors = F.filter(function (r) { return norm(r.sen) === 'sênior'; });
  var pracasSet = {};
  F.forEach(function (r) { if (r.p) pracasSet[r.p] = 1; });
  var maiorCand = F.length > 0 ? F.reduce(function (a, b) { return b.cap > a.cap ? b : a; }) : null;

  window.Blue3Data.resumoGeral = {
    total:      AT,
    trab:       F.filter(function (r) { return norm(r.st) === 'trabalhando'; }).length,
    contCount:  F.filter(function (r) { return norm(r.st) === 'contratado(a)'; }).length,
    mouOk:      F.filter(function (r) { return norm(r.mou) === 'assinado'; }).length,
    mouPend:    F.filter(function (r) { return norm(r.mou) === 'pendente'; }).length,
    ancord:     F.filter(function (r) { return norm(r.ancord) === 'sim'; }).length,
    aucTotal:   F.reduce(function (s, r) { return s + r.cap; }, 0),
    compTotal:  F.reduce(function (s, r) { return s + r.comp; }, 0),
    siTotal:    F.reduce(function (s, r) { return s + r.si; }, 0),
    xpTotal:    F.reduce(function (s, r) { return s + r.xp; }, 0),
    blue3Liq:   F.reduce(function (s, r) { return s + r.comp; }, 0) - F.reduce(function (s, r) { return s + r.xp; }, 0),
    siCount:    F.filter(function (r) { return r.si > 0; }).length,
    seniors:    seniors.length,
    plenos:     F.filter(function (r) { return norm(r.sen) === 'pleno'; }).length,
    juniors:    F.filter(function (r) { return norm(r.sen) === 'junior' || norm(r.sen) === 'júnior'; }).length,
    seniorPct:  AT > 0 ? Math.round(seniors.length / AT * 100) : 0,
    pracas:     Object.keys(pracasSet).length,
    brutas:     AT + 3,
    maiorCand:  maiorCand,
    byMonth:    byMonth,
    senByMonth: senByMonth,
    aucB:       (F.reduce(function (s, r) { return s + r.cap; }, 0) / 1000).toFixed(2).replace('.', ','),
  };

  console.log('[Blue3] financeMetrics:', {
    total: window.Blue3Data.resumoGeral.total,
    trab: window.Blue3Data.resumoGeral.trab,
    contCount: window.Blue3Data.resumoGeral.contCount,
    mouOk: window.Blue3Data.resumoGeral.mouOk,
    ancord: window.Blue3Data.resumoGeral.ancord,
    aucTotal: window.Blue3Data.resumoGeral.aucTotal,
    compTotal: window.Blue3Data.resumoGeral.compTotal,
    seniors: window.Blue3Data.resumoGeral.seniors,
    pracas: window.Blue3Data.resumoGeral.pracas,
  });
}

// ────────────────────────────────────────────────────────────
// MÓDULO 3 — payback
// ────────────────────────────────────────────────────────────
function Blue3_payback() {
  window.Blue3Data.paybacks = window.Blue3Data.financeiros.map(function (r) {
    var receita = r.cap > 0 ? Math.round((r.cap * 1e6 * 0.01) / 12) : 0;
    var acum = 0, mesPayback = null;
    for (var m = 1; m <= 36; m++) {
      var custo = m <= r.periodo ? r.piso : 0;
      acum += receita - custo;
      if (acum >= 0 && mesPayback === null) mesPayback = m;
    }
    return { n: r.n, receita: receita, mesPayback: mesPayback };
  });
}

// ────────────────────────────────────────────────────────────
// MÓDULO 4 — huntersPerformance
// ────────────────────────────────────────────────────────────
function Blue3_huntersPerformance() {
  var C = window.Blue3Data.candidatos;

  // Detectar hunters dinamicamente do CSV, mais os padrão
  var huntersSet = { 'Eduarda': true, 'Bianca': true, 'Paulo': true };
  C.forEach(function (r) { if (r.h) huntersSet[r.h] = true; });
  var hunterNames = Object.keys(huntersSet);

  window.Blue3Data.hunters = hunterNames.map(function (h) {
    var rows = C.filter(function (r) { return norm(r.h) === norm(h); });
    return {
      nome:   h,
      total:  rows.length,
      senior: rows.filter(function (r) { return norm(r.sen) === 'sênior'; }).length,
      pleno:  rows.filter(function (r) { return norm(r.sen) === 'pleno'; }).length,
      junior: rows.filter(function (r) { return norm(r.sen) === 'junior' || norm(r.sen) === 'júnior'; }).length,
      auc:    rows.reduce(function (s, r) { return s + r.cap; }, 0),
      comp:   rows.reduce(function (s, r) { return s + r.comp; }, 0),
      mouOk:  rows.filter(function (r) { return norm(r.mou) === 'assinado'; }).length,
      trab:   rows.filter(function (r) { return norm(r.st) === 'trabalhando'; }).length,
      xp:     rows.reduce(function (s, r) { return s + r.xp; }, 0),
    };
  });

  console.log('[Blue3] hunters:', window.Blue3Data.hunters.map(function (h) {
    return h.nome + ':' + h.total;
  }));
}

// ────────────────────────────────────────────────────────────
// MÓDULO 5 — pipelineStrategic (dados estáticos)
// ────────────────────────────────────────────────────────────
function Blue3_pipelineStrategic() {
  var strat = [
    { n: 'Pedro',        i: 'XP - Plus Investimentos',  p: '', a: 275 },
    { n: 'Eduardo',      i: 'XP - Fatorial',            p: '', a: 40  },
    { n: 'Isabela',      i: 'BTG - Jobin',              p: '', a: 80  },
    { n: 'Marco Ratton', i: 'XP - Santé',               p: '', a: 34  },
    { n: 'Daniel Lima',  i: 'BTG - AUVP',               p: '', a: 20  },
    { n: 'Carla Proença',i: 'BTG - Origem Capital',     p: '', a: 26  },
    { n: 'Leandro',      i: 'XP - Quaestor',            p: '', a: 180 },
  ];
  window.Blue3Data.pipeline = strat;
}

// ────────────────────────────────────────────────────────────
// MÓDULO 6 — maPipeline (dados estáticos)
// ────────────────────────────────────────────────────────────
function Blue3_maPipeline() {
  var maOps = [
    { n: 'All Investimentos',               p: 'nan', a: 3.5,  s: 'Deal'                   },
    { n: 'Norte Investimentos',             p: 'nan', a: 0.56, s: 'Proposta Apresentada'   },
    { n: 'Ibbra Planejamento Financeiro',   p: 'nan', a: 0.6,  s: 'Prospecção'             },
    { n: 'Petropolis Investimentos',        p: 'nan', a: 4.5,  s: 'NDA'                    },
    { n: 'Olimpo Investimentos',            p: 'nan', a: 3.5,  s: 'NDA'                    },
    { n: 'Arcani Investimentos',            p: 'nan', a: 1.8,  s: 'Prospecção'             },
    { n: 'Choice Investimentos',            p: 'nan', a: 3.1,  s: 'Prospecção'             },
    { n: 'Liberta Investimentos',           p: 'nan', a: 7.5,  s: 'Documentação Valuation' },
  ];
  window.Blue3Data.ma = maOps;
}

// ────────────────────────────────────────────────────────────
// UPLOAD CSV — Parser com auto-detecção de separador
// ────────────────────────────────────────────────────────────
function b3ImportCSV(input) {
  var file = input.files[0];
  if (!file) return;
  var rd = new FileReader();
  rd.onload = function (e) {
    try {
      var text = e.target.result;
      // Remover BOM se presente
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      var lines = text.split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) { alert('CSV inválido — menos de 2 linhas.'); return; }

      // Auto-detectar separador
      var sep = lines[0].indexOf(';') > -1 ? ';' : ',';

      // Parse headers (remove BOM e espaços)
      var h = lines[0].split(sep).map(function (x) {
        return x.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, '');
      });

      // Parse rows
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) continue;
        var v = line.split(sep);
        var o = {};
        h.forEach(function (hh, j) {
          o[hh] = (v[j] || '').trim().replace(/^"|"$/g, '');
        });
        // Filtrar linhas com candidato e status válido
        var cand = (o['Candidato'] || '').trim();
        var st = (o['Status'] || '').trim();
        if (cand && (st === 'Trabalhando' || st === 'Contratado(a)')) {
          rows.push(o);
        }
      }

      if (!rows.length) {
        alert('Nenhum candidato válido encontrado.\nVerifique se o CSV possui colunas "Candidato" e "Status".');
        return;
      }

      // Salvar e disparar pipeline
      localStorage.setItem('B3D', JSON.stringify(rows));
      console.log('[Blue3] CSV importado:', rows.length, 'candidatos');
      if (window.b3OnCSVLoaded) window.b3OnCSVLoaded();
      alert('✅ Base atualizada: ' + rows.length + ' candidatos carregados.');
    } catch (err) {
      console.error('[Blue3] Erro no CSV:', err);
      alert('Erro ao importar CSV: ' + err.message);
    }
    input.value = '';
  };
  rd.readAsText(file, 'UTF-8');
}

// ────────────────────────────────────────────────────────────
// MASTER PIPELINE
// ────────────────────────────────────────────────────────────
function Blue3_runPipeline() {
  console.log('[Blue3] === PIPELINE INICIADO ===');
  window.Blue3Ready = false;
  window.Blue3Data = {
    candidatos: [], financeiros: [], paybacks: [],
    hunters: [], pipeline: [], ma: [], resumoGeral: {}
  };

  if (!Blue3_dataLoader()) {
    console.error('[Blue3] dataLoader falhou');
    return false;
  }

  Blue3_financeMetrics();
  Blue3_payback();
  Blue3_huntersPerformance();
  Blue3_pipelineStrategic();
  Blue3_maPipeline();

  window.Blue3Ready = true;
  console.log('[Blue3] === PIPELINE COMPLETO ===');
  console.log('[Blue3] Candidatos:', window.Blue3Data.candidatos.length);
  console.log('[Blue3] Hunters:', window.Blue3Data.hunters.map(function (h) { return h.nome + ':' + h.total; }));
  console.log('[Blue3] Resumo:', window.Blue3Data.resumoGeral);
  return true;
}

// ── Hook para upload CSV (chamado pelo index após upload) ──
window.b3OnCSVLoaded = function () {
  if (Blue3_runPipeline()) {
    if (typeof renderPage === 'function') renderPage();
  }
};

// ── Sincronizar entre abas ──
window.addEventListener('storage', function (e) {
  if (e.key === 'B3D') {
    console.log('[Blue3] B3D atualizado em outra aba — recarregando pipeline...');
    if (Blue3_runPipeline()) {
      if (typeof renderPage === 'function') renderPage();
    }
  }
});

console.log('[Blue3] pipeline.js carregado — aguardando chamada explícita.');

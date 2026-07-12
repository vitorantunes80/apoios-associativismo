// ============================================================
// GestDDS — visitas.js  v1.0
// Registo de Visitas — visitantes que não passam por reserva
//
// Ex: uma escola que visita o CEAVM, uma família que aparece.
// Não há reserva, mas conta para os indicadores mensais.
//
// Módulo activável por equipamento (chave 'visitas').
// ============================================================

var Visitas = (function() {

  var _lista = [];
  var _eqId  = null;

  var TIPOS = [
    { v: 'escola',      l: 'Escola',              i: '🎒' },
    { v: 'instituicao', l: 'Instituição / IPSS',  i: '🏛' },
    { v: 'grupo',       l: 'Grupo organizado',    i: '👥' },
    { v: 'particular',  l: 'Particular / família', i: '👨‍👩‍👧' },
    { v: 'outro',       l: 'Outro',               i: '📍' }
  ];

  var PAISES = ['Portugal', 'Espanha', 'França', 'Alemanha', 'Reino Unido', 'Países Baixos', 'Brasil', 'Outro'];

  var MESES   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // ── DADOS ─────────────────────────────────────────────────
  function load(eqId, cb) {
    _eqId = eqId;
    sbGet('visitas', 'equipamento_id=eq.' + eqId + '&order=data.desc').then(function(d) {
      _lista = Array.isArray(d) ? d : [];
      if (cb) cb();
    }).catch(function() {
      _lista = [];
      if (cb) cb();
    });
  }

  function _tipo(v) { return TIPOS.filter(function(t){ return t.v === v; })[0] || TIPOS[4]; }
  function _pessoas(v) { return (parseInt(v.n_adultos,10)||0) + (parseInt(v.n_criancas,10)||0); }
  function _hoje() { return new Date().toISOString().split('T')[0]; }

  function _fdata(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + d.getFullYear();
  }

  // filtro de período (ano de trabalho + mês opcional)
  function _noPeriodo(iso) {
    if (!iso) return false;
    var ano = String(APP.anoTrabalho || new Date().getFullYear());
    var s = String(iso).slice(0,10);
    if (s.slice(0,4) !== ano) return false;
    if (!APP.repMes) return true;
    return s.slice(5,7) === ('0'+APP.repMes).slice(-2);
  }

  function _perLabel() {
    var ano = APP.anoTrabalho || new Date().getFullYear();
    return APP.repMes ? (MESES[APP.repMes-1] + ' de ' + ano) : ('Ano de ' + ano);
  }

  // ── PERMISSÕES ────────────────────────────────────────────
  function _podeGerir(eqId) {
    if (typeof APP.podeGerirVisitas === 'function') return APP.podeGerirVisitas(eqId);
    return true;
  }

  // ── RENDER ────────────────────────────────────────────────
  function renderPainel(eqId) {
    _eqId = eqId;
    if (typeof APP.podeVerVisitas === 'function' && !APP.podeVerVisitas(eqId)) {
      return '<div class="mod-ph"><div class="mod-ph-t">Sem acesso</div><div class="mod-ph-s">Não tem autorização para consultar o registo de visitas. Peça acesso ao administrador.</div></div>';
    }
    var pode = _podeGerir(eqId);
    var anoW = APP.anoTrabalho || new Date().getFullYear();

    var h = '';

    // barra de período
    h += '<div class="rep-periodo">';
    h += '<span class="rep-periodo-l">Período</span>';
    h += '<button class="rep-mes' + (!APP.repMes ? ' active' : '') + '" onclick="Visitas.setMes(null)">Ano ' + anoW + '</button>';
    for (var mi = 1; mi <= 12; mi++) {
      h += '<button class="rep-mes' + (APP.repMes === mi ? ' active' : '') + '" onclick="Visitas.setMes(' + mi + ')">' + MESES_C[mi-1] + '</button>';
    }
    h += '</div>';

    var doPeriodo = _lista.filter(function(v){ return _noPeriodo(v.data); });

    // KPIs
    var nVis = doPeriodo.length, nAd = 0, nCr = 0;
    doPeriodo.forEach(function(v) {
      nAd += parseInt(v.n_adultos,10)||0;
      nCr += parseInt(v.n_criancas,10)||0;
    });

    h += '<div class="rep-cards" style="margin-bottom:14px;">';
    h += _card(nVis, 'Visitas', 'no período', '#1D4ED8');
    h += _card(nAd + nCr, 'Visitantes', 'total de pessoas', '#15803D');
    h += _card(nCr, 'Crianças', 'até 12 anos', '#7C3AED');
    h += _card(nAd, 'Adultos', '', '#D97706');
    h += '</div>';

    if (pode) {
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">';
      h += '<button class="btn btn-primary btn-sm" onclick="Visitas.openNovo(\'' + eqId + '\')">+ Registar visita</button>';
      h += '<button class="btn btn-secondary btn-sm" onclick="Visitas.imprimir()">🖨️ Relatório mensal</button>';
      h += '</div>';
    }

    // por tipo de visitante
    if (doPeriodo.length) {
      var porTipo = {};
      doPeriodo.forEach(function(v) {
        var t = v.tipo_visitante || 'outro';
        if (!porTipo[t]) porTipo[t] = { n: 0, pessoas: 0, criancas: 0 };
        porTipo[t].n++;
        porTipo[t].pessoas  += _pessoas(v);
        porTipo[t].criancas += parseInt(v.n_criancas,10)||0;
      });

      h += '<div class="card" style="margin-bottom:14px;">';
      h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Por tipo de visitante</div></div>';
      h += '<div class="dtw"><table class="dt">';
      h += '<thead><tr><th>Tipo</th><th>Visitas</th><th>Pessoas</th><th>Crianças</th></tr></thead><tbody>';
      Object.keys(porTipo).sort(function(a,b){ return porTipo[b].pessoas - porTipo[a].pessoas; }).forEach(function(t) {
        var td = _tipo(t);
        h += '<tr><td>' + td.i + ' ' + td.l + '</td><td class="td-m">' + porTipo[t].n + '</td><td><strong>' + porTipo[t].pessoas + '</strong></td><td class="td-m">' + porTipo[t].criancas + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    }

    // lista
    h += '<div class="card">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Registos — ' + H(_perLabel()) + '</div></div>';

    if (!doPeriodo.length) {
      h += emptyState('Sem visitas', 'Não há visitas registadas neste período.');
    } else {
      h += '<div class="dtw"><table class="dt">';
      h += '<thead><tr><th>Data</th><th>Tipo</th><th>Entidade / Nome</th><th>Adultos</th><th>Crianças</th><th>Total</th><th>País</th>';
      if (pode) h += '<th></th>';
      h += '</tr></thead><tbody>';
      doPeriodo.forEach(function(v) {
        var t = _tipo(v.tipo_visitante);
        h += '<tr>';
        h += '<td class="td-m">' + _fdata(v.data) + '</td>';
        h += '<td class="td-m">' + t.i + ' ' + t.l + '</td>';
        h += '<td><span class="td-p">' + H(v.entidade || '—') + '</span></td>';
        h += '<td class="td-m">' + (v.n_adultos || 0) + '</td>';
        h += '<td class="td-m">' + (v.n_criancas || 0) + '</td>';
        h += '<td><strong>' + _pessoas(v) + '</strong></td>';
        h += '<td class="td-m">' + H(v.nacionalidade || '—') + '</td>';
        if (pode) {
          h += '<td style="text-align:right;white-space:nowrap;">';
          h += '<button class="btn btn-ghost btn-sm" onclick="Visitas.openEditar(\'' + v.id + '\')">Editar</button>';
          h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Visitas.apagar(\'' + v.id + '\')">Apagar</button>';
          h += '</td>';
        }
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';

    _garantirModais();
    return h;
  }

  function _card(v, t, s, cor) {
    return '<div class="rep-card"><div class="rep-card-v" style="color:' + cor + ';">' + v + '</div>'
         + '<div class="rep-card-t">' + t + '</div><div class="rep-card-s">' + s + '</div></div>';
  }

  // ── MODAL ─────────────────────────────────────────────────
  function _garantirModais() {
    if (document.getElementById('m-vis-novo')) return;
    var w = document.createElement('div');
    w.id = 'visitas-modais';
    w.innerHTML = _modalHTML();
    document.body.appendChild(w);
  }

  function _modalHTML() {
    var h = '<div class="modal-bd" id="m-vis-novo">';
    h += '<div class="modal" style="max-width:500px;">';
    h += '<div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg></div>';
    h += '<div><div class="modal-title" id="m-vis-ttl">Registar visita</div><div class="modal-sub" id="m-vis-eq">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-vis-novo\')">✕</button></div>';
    h += '<div class="modal-body">';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Data *</label><input type="date" id="vis-data" class="fin"></div>';
    h += '<div class="fi"><label class="fl">Tipo *</label><select id="vis-tipo" class="fin">';
    TIPOS.forEach(function(t){ h += '<option value="' + t.v + '">' + t.i + ' ' + t.l + '</option>'; });
    h += '</select></div>';
    h += '</div>';

    h += '<div class="fi"><label class="fl">Entidade / Nome</label>';
    h += '<input type="text" id="vis-entidade" class="fin" placeholder="ex: EB1 de Cabeceiras, Família Silva">';
    h += '<p style="font-size:11.5px;color:var(--text-3);margin:4px 0 0;">Deixe em branco se for uma visita anónima.</p></div>';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Adultos *</label><input type="number" id="vis-adultos" class="fin" min="0" value="0"></div>';
    h += '<div class="fi"><label class="fl">Crianças (até 12 anos)</label><input type="number" id="vis-criancas" class="fin" min="0" value="0"></div>';
    h += '</div>';

    h += '<div class="fi"><label class="fl">Nacionalidade</label>';
    h += '<input type="text" id="vis-pais" class="fin" list="vis-paises" placeholder="Portugal">';
    h += '<datalist id="vis-paises">';
    PAISES.forEach(function(p){ h += '<option value="' + p + '"></option>'; });
    h += '</datalist></div>';

    h += '<div class="fi"><label class="fl">Observações</label><textarea id="vis-obs" class="fin" rows="2" placeholder="ex: Visita guiada aos animais"></textarea></div>';

    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-vis-novo\')">Cancelar</button>';
    h += '<button class="btn btn-primary" onclick="Visitas.salvar()">Guardar</button></div>';
    h += '</div></div>';
    return h;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function _redesenhar() {
    var c = document.getElementById('spot-visitas-content')
         || document.getElementById('ftab-visitas-content');
    if (c) c.innerHTML = renderPainel(_eqId);
    else if (typeof App !== 'undefined' && App.renderContent) App.renderContent();
  }

  function setMes(m) {
    APP.repMes = m || null;
    _redesenhar();
  }

  function openNovo(eqId) {
    APP.editId = null;
    _eqId = eqId || _eqId;
    var eq = getEq(_eqId);
    var set = function(i,v){ var el = document.getElementById(i); if (el) el.value = v; };

    var t = document.getElementById('m-vis-ttl'); if (t) t.textContent = 'Registar visita';
    var e = document.getElementById('m-vis-eq');  if (e) e.textContent = eq ? eq.nome : '—';

    set('vis-data', _hoje());
    set('vis-tipo', 'escola');
    set('vis-entidade', '');
    set('vis-adultos', 0);
    set('vis-criancas', 0);
    set('vis-pais', 'Portugal');
    set('vis-obs', '');
    openModal('m-vis-novo');
  }

  function openEditar(id) {
    var v = _lista.filter(function(x){ return x.id === id; })[0];
    if (!v) return;
    APP.editId = id;
    var eq = getEq(v.equipamento_id);
    var set = function(i,val){ var el = document.getElementById(i); if (el) el.value = (val == null ? '' : val); };

    var t = document.getElementById('m-vis-ttl'); if (t) t.textContent = 'Editar visita';
    var e = document.getElementById('m-vis-eq');  if (e) e.textContent = eq ? eq.nome : '—';

    set('vis-data', v.data);
    set('vis-tipo', v.tipo_visitante);
    set('vis-entidade', v.entidade);
    set('vis-adultos', v.n_adultos);
    set('vis-criancas', v.n_criancas);
    set('vis-pais', v.nacionalidade);
    set('vis-obs', v.observacoes);
    openModal('m-vis-novo');
  }

  function salvar() {
    if (!_podeGerir(_eqId)) { toast('Não tem autorização para registar visitas.', 'error'); return; }

    var v = function(i){ var el = document.getElementById(i); return el ? el.value : ''; };
    var data = v('vis-data');
    var ad = parseInt(v('vis-adultos'),10) || 0;
    var cr = parseInt(v('vis-criancas'),10) || 0;

    if (!data) { toast('Indique a data.', 'error'); return; }
    if (ad + cr < 1) { toast('Indique pelo menos uma pessoa.', 'error'); return; }

    var body = {
      equipamento_id: _eqId,
      data:           data,
      tipo_visitante: v('vis-tipo') || 'particular',
      entidade:       (v('vis-entidade') || '').trim() || null,
      n_adultos:      ad,
      n_criancas:     cr,
      nacionalidade:  (v('vis-pais') || '').trim() || null,
      observacoes:    (v('vis-obs') || '').trim() || null,
      criado_por:     APP.user ? APP.user.id : null
    };

    var p = APP.editId
      ? sbPatch('visitas', 'id=eq.' + APP.editId, body)
      : sbPost('visitas', body);

    p.then(function() {
      toast(APP.editId ? 'Visita actualizada.' : 'Visita registada.', 'success');
      closeModal('m-vis-novo');
      load(_eqId, function() { _redesenhar(); });
    }).catch(function(e) {
      console.error('Erro visita:', e);
      var msg = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao guardar: ' + (msg || 'desconhecido'), 'error');
    });
  }

  function apagar(id) {
    if (!_podeGerir(_eqId)) return;
    if (!confirm('Apagar este registo de visita?')) return;
    sbDelete('visitas', 'id=eq.' + id).then(function() {
      toast('Visita apagada.', 'success');
      load(_eqId, function() { _redesenhar(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  // ── RELATÓRIO MENSAL (visitas + reservas do equipamento) ──
  function imprimir() {
    var eq = getEq(_eqId);
    var ano = APP.anoTrabalho || new Date().getFullYear();

    var vis = _lista.filter(function(v){ return _noPeriodo(v.data); });

    // reservas do mesmo equipamento e período
    var res = (APP.reservas || []).filter(function(r) {
      return r.equipamento_id === _eqId && _noPeriodo(r.data_inicio || r.data);
    });

    var vAd = 0, vCr = 0;
    var porTipo = {}, porPais = {};
    vis.forEach(function(v) {
      var a = parseInt(v.n_adultos,10)||0, c = parseInt(v.n_criancas,10)||0;
      vAd += a; vCr += c;
      var t = v.tipo_visitante || 'outro';
      if (!porTipo[t]) porTipo[t] = { n:0, pessoas:0, criancas:0 };
      porTipo[t].n++; porTipo[t].pessoas += a+c; porTipo[t].criancas += c;
      var p = v.nacionalidade || 'Não indicado';
      if (!porPais[p]) porPais[p] = { n:0, pessoas:0 };
      porPais[p].n++; porPais[p].pessoas += a+c;
    });

    var rPessoas = 0;
    res.forEach(function(r) { rPessoas += (parseInt(r.num_pessoas,10) || 0); });

    var totalPessoas = vAd + vCr + rPessoas;

    var hoje = new Date();
    var dh = ('0'+hoje.getDate()).slice(-2)+'/'+('0'+(hoje.getMonth()+1)).slice(-2)+'/'+hoje.getFullYear();

    var h = '<div class="pr-head"><div class="pr-head-top"><div>';
    h += '<div class="pr-org">Município de Cabeceiras de Basto · Divisão de Desenvolvimento Social</div>';
    h += '<div class="pr-title">Relatório de Actividade</div>';
    h += '<div class="pr-meta">' + H(eq ? eq.nome : '') + ' · Emitido em ' + dh + '</div>';
    h += '</div><div class="pr-chip">' + H(_perLabel()) + '</div></div></div>';

    // KPIs
    h += '<div class="pr-kpis">';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + totalPessoas + '</div><div class="pr-kpi-l">Total de pessoas</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + vis.length + '</div><div class="pr-kpi-l">Visitas</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + res.length + '</div><div class="pr-kpi-l">Reservas</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + vCr + '</div><div class="pr-kpi-l">Crianças</div></div>';
    h += '</div>';

    // resumo
    h += '<div class="pr-sec">Resumo da afluência</div>';
    h += '<table class="pr-table"><colgroup><col style="width:44%"><col style="width:18%"><col style="width:19%"><col style="width:19%"></colgroup>';
    h += '<thead><tr><th>Origem</th><th>Ocorrências</th><th>Pessoas</th><th>% do total</th></tr></thead><tbody>';
    var pctV = totalPessoas ? Math.round((vAd+vCr)/totalPessoas*100) : 0;
    var pctR = totalPessoas ? Math.round(rPessoas/totalPessoas*100) : 0;
    h += '<tr><td>Visitas (sem reserva)</td><td>' + vis.length + '</td><td>' + (vAd+vCr) + '</td><td>' + pctV + '%</td></tr>';
    h += '<tr><td>Reservas</td><td>' + res.length + '</td><td>' + rPessoas + '</td><td>' + pctR + '%</td></tr>';
    h += '<tr class="pr-tot"><td>Total</td><td>' + (vis.length + res.length) + '</td><td>' + totalPessoas + '</td><td>100%</td></tr>';
    h += '</tbody></table>';

    // visitas por tipo
    if (vis.length) {
      h += '<div class="pr-sec">Visitas por tipo de visitante</div>';
      h += '<table class="pr-table"><colgroup><col style="width:40%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:15%"></colgroup>';
      h += '<thead><tr><th>Tipo</th><th>Visitas</th><th>Adultos</th><th>Crianças</th><th>Total</th></tr></thead><tbody>';
      Object.keys(porTipo).sort(function(a,b){ return porTipo[b].pessoas - porTipo[a].pessoas; }).forEach(function(t) {
        var d = porTipo[t];
        h += '<tr><td>' + _tipo(t).l + '</td><td>' + d.n + '</td><td>' + (d.pessoas - d.criancas) + '</td><td>' + d.criancas + '</td><td><strong>' + d.pessoas + '</strong></td></tr>';
      });
      h += '<tr class="pr-tot"><td>Total</td><td>' + vis.length + '</td><td>' + vAd + '</td><td>' + vCr + '</td><td>' + (vAd+vCr) + '</td></tr>';
      h += '</tbody></table>';

      // nacionalidade
      h += '<div class="pr-sec">Visitas por nacionalidade</div>';
      h += '<table class="pr-table"><colgroup><col style="width:50%"><col style="width:25%"><col style="width:25%"></colgroup>';
      h += '<thead><tr><th>País</th><th>Visitas</th><th>Pessoas</th></tr></thead><tbody>';
      Object.keys(porPais).sort(function(a,b){ return porPais[b].pessoas - porPais[a].pessoas; }).forEach(function(p) {
        h += '<tr><td>' + H(p) + '</td><td>' + porPais[p].n + '</td><td><strong>' + porPais[p].pessoas + '</strong></td></tr>';
      });
      h += '</tbody></table>';
    }

    // reservas detalhadas
    if (res.length) {
      h += '<div class="pr-sec">Reservas (' + res.length + ')</div>';
      h += '<table class="pr-table"><colgroup><col style="width:14%"><col style="width:30%"><col style="width:26%"><col style="width:15%"><col style="width:15%"></colgroup>';
      h += '<thead><tr><th>Data</th><th>Título</th><th>Entidade</th><th>Espaço</th><th>Pessoas</th></tr></thead><tbody>';
      res.slice().sort(function(a,b){ return new Date(a.data_inicio||a.data) - new Date(b.data_inicio||b.data); }).forEach(function(r) {
        var esp = r.espaco_id ? ((APP.espacos||[]).filter(function(x){ return x.id === r.espaco_id; })[0]||{}).nome : null;
        h += '<tr><td>' + _fdata(r.data_inicio || r.data) + '</td><td>' + H(r.titulo || '—') + '</td><td>' + H(r.entidade || '—') + '</td><td>' + H(esp || '—') + '</td><td>' + (r.num_pessoas || 0) + '</td></tr>';
      });
      h += '<tr class="pr-tot"><td colspan="4">Total</td><td>' + rPessoas + '</td></tr>';
      h += '</tbody></table>';
    }

    // detalhe das visitas
    if (vis.length) {
      h += '<div class="pr-sec">Detalhe das visitas (' + vis.length + ')</div>';
      h += '<table class="pr-table"><colgroup><col style="width:12%"><col style="width:20%"><col style="width:28%"><col style="width:11%"><col style="width:11%"><col style="width:18%"></colgroup>';
      h += '<thead><tr><th>Data</th><th>Tipo</th><th>Entidade</th><th>Adultos</th><th>Crianças</th><th>País</th></tr></thead><tbody>';
      vis.slice().sort(function(a,b){ return new Date(a.data) - new Date(b.data); }).forEach(function(v) {
        h += '<tr><td>' + _fdata(v.data) + '</td><td>' + _tipo(v.tipo_visitante).l + '</td><td>' + H(v.entidade || '—') + '</td><td>' + (v.n_adultos||0) + '</td><td>' + (v.n_criancas||0) + '</td><td>' + H(v.nacionalidade || '—') + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    if (!vis.length && !res.length) {
      h += '<div class="pr-empty">Não há actividade registada neste período.</div>';
    }

    h += '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';

    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = h;
    window.print();
  }

  function init() {}

  return {
    init: init, load: load, renderPainel: renderPainel,
    openNovo: openNovo, openEditar: openEditar, salvar: salvar, apagar: apagar,
    setMes: setMes, imprimir: imprimir,
    lista: function() { return _lista; },
    pessoas: _pessoas
  };

})();

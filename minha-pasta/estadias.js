// ============================================================
// GestDDS — estadias.js  v1.0
// Estadias — check-in / check-out (parque de campismo e outros)
//
// Regista quem está no equipamento, em que lugar, quantas pessoas
// e de onde vêm — para produzir estatísticas de ocupação e dormidas.
//
// Módulo activável por equipamento (chave 'estadias').
// ============================================================

var Estadias = (function() {

  var _lista = [];
  var _eqId  = null;

  var TIPOS = [
    { v: 'tenda',        l: 'Tenda',         i: '⛺' },
    { v: 'caravana',     l: 'Caravana',      i: '🚐' },
    { v: 'autocaravana', l: 'Autocaravana',  i: '🚍' },
    { v: 'bungalow',     l: 'Bungalow',      i: '🏠' },
    { v: 'outro',        l: 'Outro',         i: '📍' }
  ];

  // países mais frequentes em primeiro; o campo aceita qualquer valor
  var PAISES = [
    'Portugal', 'Espanha', 'França', 'Alemanha', 'Reino Unido', 'Países Baixos',
    'Bélgica', 'Itália', 'Suíça', 'Polónia', 'Brasil', 'Estados Unidos', 'Outro'
  ];

  // ── DADOS ─────────────────────────────────────────────────
  function load(eqId, cb) {
    _eqId = eqId;
    sbGet('estadias', 'equipamento_id=eq.' + eqId + '&order=data_checkin.desc').then(function(d) {
      _lista = Array.isArray(d) ? d : [];
      if (cb) cb();
    }).catch(function() {
      _lista = [];
      if (cb) cb();
    });
  }

  function _tipo(v) {
    return TIPOS.filter(function(t) { return t.v === v; })[0] || TIPOS[4];
  }

  function _pessoas(e) {
    return (parseInt(e.n_adultos, 10) || 0) + (parseInt(e.n_criancas, 10) || 0);
  }

  // noites entre check-in e check-out (real, ou previsto, ou hoje se ainda cá está)
  function _noites(e) {
    var ini = e.data_checkin ? new Date(e.data_checkin) : null;
    if (!ini) return 0;
    var fim = e.data_checkout_real ? new Date(e.data_checkout_real)
            : (e.estado === 'ativa' ? new Date() : (e.data_checkout_prev ? new Date(e.data_checkout_prev) : null));
    if (!fim) return 0;
    var n = Math.round((fim - ini) / 86400000);
    return n > 0 ? n : (e.estado === 'ativa' ? 0 : 1);
  }

  // dormidas = pessoas × noites  (o indicador oficial de turismo)
  function _dormidas(e) { return _pessoas(e) * _noites(e); }

  function _fdata(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function _hoje() { return new Date().toISOString().split('T')[0]; }

  // ── RENDER (dentro da aba do equipamento) ─────────────────
  function renderPainel(eqId) {
    var eq = getEq(eqId);

    // sem autorização não mostra nada (dados pessoais de hóspedes)
    if (APP.podeVerEstadias && !APP.podeVerEstadias(eqId)) {
      return '<div class="mod-ph"><div class="mod-ph-t">Sem acesso</div><div class="mod-ph-s">Não tem autorização para consultar os check-ins deste equipamento. Peça acesso ao administrador.</div></div>';
    }

    var pode = APP.podeGerirEstadias ? APP.podeGerirEstadias(eqId) : true;

    var hoje = _hoje();
    var ativas   = _lista.filter(function(e) { return e.estado === 'ativa'; });
    var reservas = _lista.filter(function(e) {
      return e.estado === 'reservada' && (!e.data_checkout_prev || e.data_checkout_prev >= hoje);
    });
    var saemHoje  = ativas.filter(function(e) { return e.data_checkout_prev === hoje; });
    var chegamHoje = reservas.filter(function(e) { return e.data_checkin === hoje; });

    var h = '';

    // ── KPIs ao vivo ──
    var pessoasAgora = 0;
    ativas.forEach(function(e) { pessoasAgora += _pessoas(e); });

    h += '<div class="rep-cards" style="margin-bottom:14px;">';
    h += _card(ativas.length, 'Ocupados agora', 'tendas / caravanas', '#1D4ED8');
    h += _card(pessoasAgora, 'Pessoas no parque', 'neste momento', '#15803D');
    h += _card(chegamHoje.length, 'Chegadas hoje', 'reservas por entrar', '#7C3AED');
    h += _card(saemHoje.length, 'Saídas hoje', 'check-outs previstos', '#D97706');
    h += '</div>';

    var tab = APP.estadiaTab || 'ativas';

    // ── Botões ──
    if (pode) {
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">';
      h += '<button class="btn btn-primary btn-sm" onclick="Estadias.openNovo(\'' + eqId + '\',\'reserva\')">+ Nova reserva</button>';
      h += '<button class="btn btn-secondary btn-sm" onclick="Estadias.openNovo(\'' + eqId + '\',\'checkin\')">+ Check-in directo</button>';
      h += '</div>';
    }

    // ── Separadores ──
    h += '<div class="eq-tabs" style="margin-bottom:14px;">';
    h += _tab('reservas',  'Reservas', reservas.length, tab);
    h += _tab('ativas',    'No parque', ativas.length, tab);
    h += _tab('historico', 'Histórico', 0, tab);
    h += _tab('stats',     '📊 Estatísticas', 0, tab);
    h += '</div>';

    if (tab === 'stats')          h += _renderStats();
    else if (tab === 'historico') h += _renderLista(_lista, pode, true);
    else if (tab === 'reservas')  h += _renderReservas(reservas, pode);
    else                          h += _renderLista(ativas, pode, false);

    _garantirModais();
    return h;
  }

  function _tab(id, label, n, atual) {
    var h = '<div class="eq-tab' + (atual === id ? ' active' : '') + '" onclick="Estadias.setTab(\'' + id + '\')">';
    h += label;
    if (n > 0) h += ' <span style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;margin-left:3px;">' + n + '</span>';
    h += '</div>';
    return h;
  }

  // ── LISTA DE RESERVAS (ainda não chegaram) ────────────────
  function _renderReservas(lista, pode) {
    if (!lista.length) {
      return emptyState('Sem reservas', 'Não há reservas de lugares por ocupar.');
    }

    var hoje = _hoje();
    lista = lista.slice().sort(function(a, b) { return (a.data_checkin || '').localeCompare(b.data_checkin || ''); });

    var h = '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Chegada</th><th>Lugar</th><th>Tipo</th><th>Responsável</th><th>Pessoas</th><th>Noites</th><th>País</th><th></th></tr></thead><tbody>';

    lista.forEach(function(e) {
      var t = _tipo(e.tipo_alojamento);
      var hojeChega = e.data_checkin === hoje;
      var atrasada  = e.data_checkin < hoje;

      h += '<tr' + (hojeChega ? ' style="background:#F5F3FF;"' : (atrasada ? ' style="background:#FEF2F2;"' : '')) + '>';
      h += '<td><span class="td-p">' + _fdata(e.data_checkin) + '</span>';
      if (hojeChega) h += '<div style="font-size:10.5px;color:#7C3AED;font-weight:700;">HOJE</div>';
      else if (atrasada) h += '<div style="font-size:10.5px;color:var(--red);font-weight:600;">Não compareceu?</div>';
      h += '</td>';
      h += '<td class="td-m">' + H(e.lugar || '—') + '</td>';
      h += '<td class="td-m">' + t.i + ' ' + t.l + '</td>';
      h += '<td><span class="td-p">' + H(e.responsavel_nome) + '</span>';
      if (e.contacto) h += '<div class="td-m" style="font-size:10.5px;">' + H(e.contacto) + '</div>';
      h += '</td>';
      h += '<td class="td-m">' + _pessoas(e) + '</td>';
      h += '<td class="td-m">' + (e.data_checkout_prev ? _noitesPrev(e) : '—') + '</td>';
      h += '<td class="td-m">' + H(e.nacionalidade || '—') + '</td>';
      h += '<td style="text-align:right;white-space:nowrap;">';
      if (pode) {
        h += '<button class="btn btn-primary btn-sm" onclick="Estadias.fazerCheckin(\'' + e.id + '\')">Check-in</button>';
        h += '<button class="btn btn-ghost btn-sm" onclick="Estadias.openEditar(\'' + e.id + '\')">Editar</button>';
        h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Estadias.cancelar(\'' + e.id + '\')">Cancelar</button>';
        h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Estadias.apagar(\'' + e.id + '\')">Apagar</button>';
      }
      h += '</td></tr>';
    });

    h += '</tbody></table></div>';
    return h;
  }

  // noites previstas de uma reserva
  function _noitesPrev(e) {
    if (!e.data_checkin || !e.data_checkout_prev) return '—';
    var n = Math.round((new Date(e.data_checkout_prev) - new Date(e.data_checkin)) / 86400000);
    return n > 0 ? n : 1;
  }

  // os modais vivem no body (fora do painel), para não serem destruídos ao redesenhar
  function _garantirModais() {
    if (document.getElementById('m-est-novo')) return;
    var wrap = document.createElement('div');
    wrap.id = 'estadias-modais';
    wrap.innerHTML = _modais();
    document.body.appendChild(wrap);
  }

  function _card(v, t, s, cor) {
    var h = '<div class="rep-card">';
    h += '<div class="rep-card-v" style="color:' + cor + ';">' + v + '</div>';
    h += '<div class="rep-card-t">' + t + '</div>';
    h += '<div class="rep-card-s">' + s + '</div>';
    h += '</div>';
    return h;
  }

  // ── LISTA ─────────────────────────────────────────────────
  function _renderLista(lista, pode, historico) {
    if (!lista.length) {
      return emptyState(historico ? 'Sem estadias' : 'Parque vazio',
        historico ? 'Ainda não há estadias registadas.' : 'Não há ninguém no parque neste momento.');
    }

    var h = '<div class="dtw"><table class="dt">';
    h += '<thead><tr>';
    h += '<th>Lugar</th><th>Tipo</th><th>Responsável</th><th>Pessoas</th><th>País</th><th>Check-in</th><th>Check-out</th>';
    if (historico) h += '<th>Noites</th><th>Dormidas</th>';
    h += '<th></th></tr></thead><tbody>';

    lista.forEach(function(e) {
      var t = _tipo(e.tipo_alojamento);
      var atrasado = e.estado === 'ativa' && e.data_checkout_prev && e.data_checkout_prev < _hoje();

      h += '<tr' + (atrasado ? ' style="background:#FEF2F2;"' : '') + '>';
      h += '<td><span class="td-p">' + H(e.lugar || '—') + '</span>';
      if (e.matricula) h += '<div class="td-m" style="font-size:10.5px;">' + H(e.matricula) + '</div>';
      h += '</td>';
      h += '<td class="td-m">' + t.i + ' ' + t.l + '</td>';
      h += '<td><span class="td-p">' + H(e.responsavel_nome) + '</span>';
      if (e.contacto) h += '<div class="td-m" style="font-size:10.5px;">' + H(e.contacto) + '</div>';
      h += '</td>';
      h += '<td class="td-m">' + _pessoas(e);
      if (e.n_criancas > 0) h += ' <span style="font-size:10.5px;color:var(--text-3);">(' + e.n_adultos + 'A + ' + e.n_criancas + 'C)</span>';
      h += '</td>';
      h += '<td class="td-m">' + H(e.nacionalidade || '—') + '</td>';
      h += '<td class="td-m">' + _fdata(e.data_checkin);
      if (historico && e.estado === 'cancelada') {
        h += '<div style="font-size:10.5px;color:var(--red);font-weight:600;">Cancelada</div>';
      } else if (historico && e.estado === 'reservada') {
        h += '<div style="font-size:10.5px;color:#7C3AED;font-weight:600;">Por chegar</div>';
      }
      h += '</td>';
      h += '<td class="td-m">';
      if (e.estado === 'ativa') {
        h += (e.data_checkout_prev ? _fdata(e.data_checkout_prev) : '—');
        if (atrasado) h += '<div style="font-size:10.5px;color:var(--red);font-weight:600;">Em atraso</div>';
        else h += '<div style="font-size:10.5px;color:var(--text-3);">previsto</div>';
      } else {
        h += _fdata(e.data_checkout_real);
      }
      h += '</td>';

      if (historico) {
        h += '<td class="td-m">' + _noites(e) + '</td>';
        h += '<td><strong>' + _dormidas(e) + '</strong></td>';
      }

      h += '<td style="text-align:right;white-space:nowrap;">';
      if (pode && e.estado === 'ativa') {
        h += '<button class="btn btn-primary btn-sm" onclick="Estadias.checkout(\'' + e.id + '\')">Check-out</button>';
      }
      if (pode) {
        h += '<button class="btn btn-ghost btn-sm" onclick="Estadias.openEditar(\'' + e.id + '\')">Editar</button>';
        h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Estadias.apagar(\'' + e.id + '\')">Apagar</button>';
      }
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div>';
    return h;
  }

  // ── ESTATÍSTICAS ──────────────────────────────────────────
  function _renderStats() {
    var MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var anoW = APP.anoTrabalho || new Date().getFullYear();

    // barra de período
    var hp = '<div class="rep-periodo">';
    hp += '<span class="rep-periodo-l">Período</span>';
    hp += '<button class="rep-mes' + (!APP.repMes ? ' active' : '') + '" onclick="Estadias.setMes(null)">Ano ' + anoW + '</button>';
    for (var mi = 1; mi <= 12; mi++) {
      hp += '<button class="rep-mes' + (APP.repMes === mi ? ' active' : '') + '" onclick="Estadias.setMes(' + mi + ')">' + MESES_C[mi - 1] + '</button>';
    }
    hp += '</div>';

    // filtrar pelo período
    var fechadas = _lista.filter(function(e) {
      if (e.estado === 'cancelada') return false;
      var s = String(e.data_checkin || '').slice(0, 10);
      if (s.slice(0, 4) !== String(anoW)) return false;
      if (APP.repMes && s.slice(5, 7) !== ('0' + APP.repMes).slice(-2)) return false;
      return true;
    });

    if (!fechadas.length) return hp + emptyState('Sem dados', 'Não há estadias neste período.');

    var totEstadias = fechadas.length;
    var totPessoas = 0, totDormidas = 0, totNoites = 0;
    var porPais = {}, porTipo = {}, porMes = {};

    fechadas.forEach(function(e) {
      var p = _pessoas(e), n = _noites(e), d = _dormidas(e);
      totPessoas  += p;
      totNoites   += n;
      totDormidas += d;

      var pais = e.nacionalidade || 'Não indicado';
      if (!porPais[pais]) porPais[pais] = { estadias: 0, pessoas: 0, dormidas: 0 };
      porPais[pais].estadias++;
      porPais[pais].pessoas  += p;
      porPais[pais].dormidas += d;

      var tp = e.tipo_alojamento || 'outro';
      if (!porTipo[tp]) porTipo[tp] = { estadias: 0, dormidas: 0 };
      porTipo[tp].estadias++;
      porTipo[tp].dormidas += d;

      if (e.data_checkin) {
        var mes = e.data_checkin.slice(0, 7);
        if (!porMes[mes]) porMes[mes] = { estadias: 0, pessoas: 0, dormidas: 0 };
        porMes[mes].estadias++;
        porMes[mes].pessoas  += p;
        porMes[mes].dormidas += d;
      }
    });

    var mediaEstadia = totEstadias ? (totNoites / totEstadias) : 0;

    var h = hp;
    h += '<div class="rep-cards" style="margin-bottom:14px;">';
    h += _card(totEstadias, 'Estadias', 'no total', '#1D4ED8');
    h += _card(totPessoas, 'Hóspedes', 'pessoas recebidas', '#15803D');
    h += _card(totDormidas, 'Dormidas', 'pessoas × noites', '#7C3AED');
    h += _card(mediaEstadia.toFixed(1), 'Estadia média', 'noites', '#D97706');
    h += '</div>';

    // por nacionalidade
    var paises = Object.keys(porPais).sort(function(a, b) { return porPais[b].dormidas - porPais[a].dormidas; });
    h += '<div class="card" style="margin-bottom:14px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Por nacionalidade</div>';
    h += '<button class="btn btn-secondary btn-sm" onclick="Estadias.imprimir()">🖨️ Imprimir</button></div>';
    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>País</th><th>Estadias</th><th>Hóspedes</th><th>Dormidas</th><th>%</th></tr></thead><tbody>';
    paises.forEach(function(p) {
      var pct = totDormidas ? Math.round(porPais[p].dormidas / totDormidas * 100) : 0;
      h += '<tr><td><span class="td-p">' + H(p) + '</span></td>';
      h += '<td class="td-m">' + porPais[p].estadias + '</td>';
      h += '<td class="td-m">' + porPais[p].pessoas + '</td>';
      h += '<td><strong>' + porPais[p].dormidas + '</strong></td>';
      h += '<td><div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;max-width:70px;"><div style="width:' + pct + '%;height:100%;background:var(--accent);"></div></div><span style="font-size:11.5px;">' + pct + '%</span></div></td>';
      h += '</tr>';
    });
    h += '</tbody></table></div></div>';

    // por tipo de alojamento
    h += '<div class="card" style="margin-bottom:14px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Por tipo de alojamento</div></div>';
    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Tipo</th><th>Estadias</th><th>Dormidas</th></tr></thead><tbody>';
    Object.keys(porTipo).sort(function(a, b) { return porTipo[b].dormidas - porTipo[a].dormidas; }).forEach(function(t) {
      var td = _tipo(t);
      h += '<tr><td>' + td.i + ' ' + td.l + '</td><td class="td-m">' + porTipo[t].estadias + '</td><td><strong>' + porTipo[t].dormidas + '</strong></td></tr>';
    });
    h += '</tbody></table></div></div>';

    // evolução mensal
    var meses = Object.keys(porMes).sort();
    if (meses.length) {
      var maxD = Math.max.apply(null, meses.map(function(m) { return porMes[m].dormidas; }));
      h += '<div class="card">';
      h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Evolução mensal (dormidas)</div></div>';
      meses.forEach(function(m) {
        var pct = maxD ? Math.round(porMes[m].dormidas / maxD * 100) : 0;
        var nm = _nomeMes(m);
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">';
        h += '<div style="width:80px;font-size:12px;color:var(--text-2);">' + nm + '</div>';
        h += '<div style="flex:1;height:20px;background:var(--border);border-radius:4px;overflow:hidden;">';
        h += '<div style="width:' + pct + '%;height:100%;background:var(--accent);border-radius:4px;"></div>';
        h += '</div>';
        h += '<div style="width:100px;font-size:12px;text-align:right;"><strong>' + porMes[m].dormidas + '</strong> <span style="color:var(--text-3);">(' + porMes[m].estadias + ' est.)</span></div>';
        h += '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  function _nomeMes(iso) {
    var MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var p = iso.split('-');
    return MS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  // ── MODAIS ────────────────────────────────────────────────
  function _modais() {
    var h = '';

    h += '<div class="modal-bd" id="m-est-novo">';
    h += '<div class="modal" style="max-width:560px;">';
    h += '<div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M12 3L2 21h20L12 3z"/></svg></div>';
    h += '<div><div class="modal-title" id="m-est-ttl">Novo check-in</div><div class="modal-sub" id="m-est-eq">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-est-novo\')">✕</button></div>';
    h += '<div class="modal-body">';

    h += '<div class="form-sec-t">Alojamento</div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Tipo *</label><select id="est-tipo" class="fin">';
    TIPOS.forEach(function(t) { h += '<option value="' + t.v + '">' + t.i + ' ' + t.l + '</option>'; });
    h += '</select></div>';
    h += '<div class="fi"><label class="fl">Lugar / alvéolo *</label><input type="text" id="est-lugar" class="fin" placeholder="ex: A12"></div>';
    h += '</div>';
    h += '<div class="fi"><label class="fl">Matrícula</label><input type="text" id="est-matricula" class="fin" placeholder="Para caravanas e autocaravanas"></div>';

    h += '<div class="form-sec-t">Hóspedes</div>';
    h += '<div class="fi"><label class="fl">Nome do responsável *</label><input type="text" id="est-nome" class="fin"></div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Contacto</label><input type="text" id="est-contacto" class="fin" placeholder="Telefone ou email"></div>';
    h += '<div class="fi"><label class="fl">Documento</label><input type="text" id="est-doc" class="fin" placeholder="CC / Passaporte"></div>';
    h += '</div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Adultos *</label><input type="number" id="est-adultos" class="fin" min="1" value="1"></div>';
    h += '<div class="fi"><label class="fl">Crianças</label><input type="number" id="est-criancas" class="fin" min="0" value="0"></div>';
    h += '</div>';
    h += '<div class="fi"><label class="fl">Nacionalidade *</label>';
    h += '<input type="text" id="est-pais" class="fin" list="paises-lista" placeholder="ex: Portugal">';
    h += '<datalist id="paises-lista">';
    PAISES.forEach(function(p) { h += '<option value="' + p + '"></option>'; });
    h += '</datalist></div>';

    h += '<div class="form-sec-t">Datas</div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl" id="est-lbl-ci">Check-in *</label><input type="date" id="est-ci" class="fin"></div>';
    h += '<div class="fi"><label class="fl">Saída prevista</label><input type="date" id="est-co" class="fin"></div>';
    h += '</div>';
    h += '<div id="est-ajuda" style="border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.5;margin-bottom:12px;display:none;"></div>';
    h += '<div class="fi"><label class="fl">Observações</label><textarea id="est-obs" class="fin" rows="2"></textarea></div>';

    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-est-novo\')">Cancelar</button>';
    h += '<button class="btn btn-primary" id="est-btn-salvar" onclick="Estadias.salvar()">Registar</button></div>';
    h += '</div></div>';

    // CHECK-OUT
    h += '<div class="modal-bd" id="m-est-checkout">';
    h += '<div class="modal"><div class="modal-header"><div class="mh-ic mhi-amber"><svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>';
    h += '<div><div class="modal-title">Fazer check-out</div><div class="modal-sub" id="m-est-co-sub">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-est-checkout\')">✕</button></div>';
    h += '<div class="modal-body">';
    h += '<div class="fi"><label class="fl">Data de saída *</label><input type="date" id="est-co-data" class="fin"></div>';
    h += '<div id="est-co-resumo" style="background:var(--bg);border-radius:8px;padding:12px;font-size:13px;color:var(--text-2);line-height:1.7;"></div>';
    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-est-checkout\')">Cancelar</button>';
    h += '<button class="btn btn-primary" onclick="Estadias.confirmarCheckout()">Confirmar check-out</button></div>';
    h += '</div></div>';

    return h;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function setTab(t) {
    APP.estadiaTab = t;
    _redesenhar();
  }

  function setMes(m) {
    APP.repMes = m || null;
    _redesenhar();
  }

  // redesenha apenas o painel das estadias (dashboard ou ficha do equipamento)
  function _redesenhar() {
    var cont = document.getElementById('spot-estadias-content')
            || document.getElementById('ftab-estadias-content');
    if (cont) cont.innerHTML = renderPainel(_eqId);
    else if (typeof App !== 'undefined' && App.renderContent) App.renderContent();
  }

  function openNovo(eqId, modo) {
    APP.editId = null;
    APP.estModo = modo || 'checkin';   // 'reserva' | 'checkin'
    _eqId = eqId || _eqId;
    var eq = getEq(_eqId);
    var set = function(i, v) { var el = document.getElementById(i); if (el) el.value = v; };

    var eReserva = (APP.estModo === 'reserva');

    var ttl = document.getElementById('m-est-ttl');
    if (ttl) ttl.textContent = eReserva ? 'Nova reserva de lugar' : 'Novo check-in';
    var eqEl = document.getElementById('m-est-eq');
    if (eqEl) eqEl.textContent = eq ? eq.nome : '—';

    // rótulos e ajuda mudam conforme o modo
    var lblCi = document.getElementById('est-lbl-ci');
    if (lblCi) lblCi.textContent = eReserva ? 'Data de chegada *' : 'Check-in *';
    var ajuda = document.getElementById('est-ajuda');
    if (ajuda) {
      ajuda.style.display = 'block';
      ajuda.innerHTML = eReserva
        ? 'A reserva fica <strong>à espera</strong>. Quando o hóspede chegar, faça o check-in a partir da lista de reservas.'
        : 'O hóspede <strong>já chegou</strong> — a estadia começa hoje.';
      ajuda.style.background = eReserva ? '#F5F3FF' : '#DCFCE7';
      ajuda.style.color = eReserva ? '#5B21B6' : '#15803D';
    }
    var btn = document.getElementById('est-btn-salvar');
    if (btn) btn.textContent = eReserva ? 'Reservar lugar' : 'Registar entrada';

    set('est-tipo', 'tenda');
    set('est-lugar', '');
    set('est-matricula', '');
    set('est-nome', '');
    set('est-contacto', '');
    set('est-doc', '');
    set('est-adultos', 1);
    set('est-criancas', 0);
    set('est-pais', '');
    set('est-ci', _hoje());
    set('est-co', '');
    set('est-obs', '');

    openModal('m-est-novo');
  }

  // ── Check-in de uma reserva: passa de 'reservada' a 'ativa' ──
  function fazerCheckin(id) {
    if (APP.podeGerirEstadias && !APP.podeGerirEstadias(_eqId)) {
      toast('Não tem autorização.', 'error');
      return;
    }
    var e = _lista.filter(function(x) { return x.id === id; })[0];
    if (!e) return;

    var hoje = _hoje();
    var msg = 'Confirmar a entrada de ' + e.responsavel_nome + ' no lugar ' + (e.lugar || '—') + '?';
    if (e.data_checkin !== hoje) {
      msg += '\n\nA reserva era para ' + _fdata(e.data_checkin) + '. A estadia passa a começar hoje (' + _fdata(hoje) + ').';
    }
    if (!confirm(msg)) return;

    sbPatch('estadias', 'id=eq.' + id, {
      estado: 'ativa',
      data_checkin: hoje    // a estadia conta a partir da entrada real
    }).then(function() {
      toast('Check-in feito. Bem-vindos!', 'success');
      APP.estadiaTab = 'ativas';
      load(_eqId, function() { _redesenhar(); });
    }).catch(function(err) {
      console.error('Erro no check-in:', err);
      var m = [err && err.code, err && err.message].filter(Boolean).join(' · ');
      toast('Erro no check-in: ' + (m || 'desconhecido'), 'error');
    });
  }

  // Apagar definitivamente — o registo sai das estatísticas.
  // Diferente de "Cancelar" (que mantém o histórico da desistência).
  function apagar(id) {
    if (APP.podeGerirEstadias && !APP.podeGerirEstadias(_eqId)) {
      toast('Não tem autorização.', 'error');
      return;
    }
    var e = _lista.filter(function(x) { return x.id === id; })[0];
    if (!e) return;

    var aviso = 'Apagar definitivamente o registo de ' + e.responsavel_nome + '?';
    if (e.estado === 'concluida') {
      aviso += '\n\nAtenção: as ' + _dormidas(e) + ' dormidas desta estadia deixam de contar nas estatísticas.';
    } else if (e.estado === 'ativa') {
      aviso += '\n\nEsta estadia está ACTIVA — o lugar ' + (e.lugar || '') + ' fica livre.';
    }
    aviso += '\n\nEsta acção não pode ser desfeita.';
    if (!confirm(aviso)) return;

    sbDelete('estadias', 'id=eq.' + id).then(function() {
      _lista = _lista.filter(function(x) { return x.id !== id; });
      toast('Registo apagado.', 'success');
      _redesenhar();
    }).catch(function(err) {
      console.error('Erro ao apagar estadia:', err);
      var m = [err && err.code, err && err.message].filter(Boolean).join(' · ');
      toast('Erro ao apagar: ' + (m || 'desconhecido'), 'error');
    });
  }

  function cancelar(id) {
    if (APP.podeGerirEstadias && !APP.podeGerirEstadias(_eqId)) return;
    var e = _lista.filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    if (!confirm('Cancelar a reserva de ' + e.responsavel_nome + '?\n\nO lugar ' + (e.lugar || '') + ' fica livre.')) return;

    sbPatch('estadias', 'id=eq.' + id, { estado: 'cancelada' }).then(function() {
      toast('Reserva cancelada.', 'success');
      load(_eqId, function() { _redesenhar(); });
    }).catch(function() { toast('Erro ao cancelar.', 'error'); });
  }

  function openEditar(id) {
    var e = _lista.filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    APP.editId = id;
    var eq = getEq(e.equipamento_id);
    var set = function(i, v) { var el = document.getElementById(i); if (el) el.value = (v == null ? '' : v); };

    APP.estModo = (e.estado === 'reservada') ? 'reserva' : 'checkin';

    var ttl = document.getElementById('m-est-ttl');
    if (ttl) ttl.textContent = (e.estado === 'reservada') ? 'Editar reserva' : 'Editar estadia';
    var eqEl = document.getElementById('m-est-eq');
    if (eqEl) eqEl.textContent = eq ? eq.nome : '—';

    var lblCi = document.getElementById('est-lbl-ci');
    if (lblCi) lblCi.textContent = (e.estado === 'reservada') ? 'Data de chegada *' : 'Check-in *';
    var ajuda = document.getElementById('est-ajuda');
    if (ajuda) ajuda.style.display = 'none';
    var btn = document.getElementById('est-btn-salvar');
    if (btn) btn.textContent = 'Guardar alterações';

    set('est-tipo', e.tipo_alojamento);
    set('est-lugar', e.lugar);
    set('est-matricula', e.matricula);
    set('est-nome', e.responsavel_nome);
    set('est-contacto', e.contacto);
    set('est-doc', e.documento);
    set('est-adultos', e.n_adultos);
    set('est-criancas', e.n_criancas);
    set('est-pais', e.nacionalidade);
    set('est-ci', e.data_checkin);
    set('est-co', e.data_checkout_prev);
    set('est-obs', e.observacoes);

    openModal('m-est-novo');
  }

  function salvar() {
    if (APP.podeGerirEstadias && !APP.podeGerirEstadias(_eqId)) {
      toast('Não tem autorização para registar check-ins.', 'error');
      return;
    }
    var v = function(i) { var el = document.getElementById(i); return el ? el.value : ''; };

    var nome  = (v('est-nome') || '').trim();
    var lugar = (v('est-lugar') || '').trim();
    var pais  = (v('est-pais') || '').trim();
    var ci    = v('est-ci');
    var co    = v('est-co');
    var ad    = parseInt(v('est-adultos'), 10) || 0;
    var cr    = parseInt(v('est-criancas'), 10) || 0;

    if (!nome)  { toast('Indique o nome do responsável.', 'error'); return; }
    if (!lugar) { toast('Indique o lugar / alvéolo.', 'error'); return; }
    if (!pais)  { toast('Indique a nacionalidade.', 'error'); return; }
    if (!ci)    { toast('Indique a data de check-in.', 'error'); return; }
    if (ad < 1) { toast('Tem de haver pelo menos 1 adulto.', 'error'); return; }
    if (co && co < ci) { toast('O check-out não pode ser anterior ao check-in.', 'error'); return; }

    var body = {
      equipamento_id:     _eqId,
      tipo_alojamento:    v('est-tipo') || 'tenda',
      lugar:              lugar,
      matricula:          (v('est-matricula') || '').trim() || null,
      responsavel_nome:   nome,
      contacto:           (v('est-contacto') || '').trim() || null,
      documento:          (v('est-doc') || '').trim() || null,
      nacionalidade:      pais,
      n_adultos:          ad,
      n_criancas:         cr,
      data_checkin:       ci,
      data_checkout_prev: co || null,
      observacoes:        (v('est-obs') || '').trim() || null,
      criado_por:         APP.user ? APP.user.id : null
    };
    if (!APP.editId) {
      body.estado = (APP.estModo === 'reserva') ? 'reservada' : 'ativa';
    }

    var p = APP.editId
      ? sbPatch('estadias', 'id=eq.' + APP.editId, body)
      : sbPost('estadias', body);

    p.then(function() {
      var msg = APP.editId ? 'Registo actualizado.'
              : (APP.estModo === 'reserva' ? 'Lugar reservado.' : 'Check-in registado.');
      toast(msg, 'success');
      closeModal('m-est-novo');
      if (!APP.editId) APP.estadiaTab = (APP.estModo === 'reserva') ? 'reservas' : 'ativas';
      load(_eqId, function() { _redesenhar(); });
    }).catch(function(e) {
      console.error('Erro estadia:', e);
      var msg = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao guardar: ' + (msg || 'desconhecido'), 'error');
    });
  }

  function checkout(id) {
    var e = _lista.filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    APP.actionId = id;

    var sub = document.getElementById('m-est-co-sub');
    if (sub) sub.textContent = (e.lugar || '') + ' · ' + e.responsavel_nome;

    var d = document.getElementById('est-co-data');
    if (d) d.value = _hoje();

    _resumoCheckout(e);
    openModal('m-est-checkout');
  }

  function _resumoCheckout(e) {
    var box = document.getElementById('est-co-resumo');
    if (!box) return;
    var simulado = {};
    for (var k in e) simulado[k] = e[k];
    simulado.data_checkout_real = _hoje();
    simulado.estado = 'concluida';

    var h = '<div><strong>Check-in:</strong> ' + _fdata(e.data_checkin) + '</div>';
    h += '<div><strong>Pessoas:</strong> ' + _pessoas(e) + '</div>';
    h += '<div><strong>Noites:</strong> ' + _noites(simulado) + '</div>';
    h += '<div style="margin-top:4px;padding-top:6px;border-top:1px solid var(--border);"><strong>Dormidas:</strong> ' + _dormidas(simulado) + '</div>';
    box.innerHTML = h;
  }

  function confirmarCheckout() {
    if (!APP.actionId) return;
    if (APP.podeGerirEstadias && !APP.podeGerirEstadias(_eqId)) {
      toast('Não tem autorização para fazer check-out.', 'error');
      return;
    }
    var data = (document.getElementById('est-co-data') || {}).value;
    if (!data) { toast('Indique a data de saída.', 'error'); return; }

    var e = _lista.filter(function(x) { return x.id === APP.actionId; })[0];
    if (e && data < e.data_checkin) { toast('A saída não pode ser anterior à entrada.', 'error'); return; }

    sbPatch('estadias', 'id=eq.' + APP.actionId, {
      estado: 'concluida',
      data_checkout_real: data
    }).then(function() {
      toast('Check-out registado.', 'success');
      closeModal('m-est-checkout');
      load(_eqId, function() { _redesenhar(); });
    }).catch(function() { toast('Erro ao fazer check-out.', 'error'); });
  }

  // ── IMPRESSÃO ─────────────────────────────────────────────
  function imprimir() {
    var eq = getEq(_eqId);
    var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var ano = APP.anoTrabalho || new Date().getFullYear();
    var mes = APP.repMes;
    var perLabel = mes ? (MESES[mes - 1] + ' de ' + ano) : ('Ano de ' + ano);

    // estadias do período (pela data de check-in)
    var fechadas = _lista.filter(function(e) {
      if (e.estado === 'cancelada') return false;
      var s = String(e.data_checkin || '').slice(0, 10);
      if (s.slice(0, 4) !== String(ano)) return false;
      if (mes && s.slice(5, 7) !== ('0' + mes).slice(-2)) return false;
      return true;
    });

    var totPessoas = 0, totDormidas = 0, totNoites = 0;
    var porPais = {}, porTipo = {};
    fechadas.forEach(function(e) {
      var p = _pessoas(e), n = _noites(e), d = _dormidas(e);
      totPessoas += p; totNoites += n; totDormidas += d;
      var pais = e.nacionalidade || 'Não indicado';
      if (!porPais[pais]) porPais[pais] = { estadias: 0, pessoas: 0, dormidas: 0 };
      porPais[pais].estadias++;
      porPais[pais].pessoas += p;
      porPais[pais].dormidas += d;
      var tp = e.tipo_alojamento || 'outro';
      if (!porTipo[tp]) porTipo[tp] = { estadias: 0, dormidas: 0 };
      porTipo[tp].estadias++;
      porTipo[tp].dormidas += d;
    });

    var hoje = new Date();
    var dh = ('0' + hoje.getDate()).slice(-2) + '/' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '/' + hoje.getFullYear();

    var h = '<div class="pr-head"><div class="pr-head-top"><div>';
    h += '<div class="pr-org">Município de Cabeceiras de Basto · Divisão de Desenvolvimento Social</div>';
    h += '<div class="pr-title">Estatísticas de Ocupação</div>';
    h += '<div class="pr-meta">' + H(eq ? eq.nome : '') + ' · Emitido em ' + dh + '</div>';
    h += '</div><div class="pr-chip">' + H(perLabel) + '</div></div></div>';

    if (!fechadas.length) {
      h += '<div class="pr-empty">Não há estadias registadas neste período.</div>';
      h += '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';
      _print(h);
      return;
    }

    h += '<div class="pr-kpis">';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + fechadas.length + '</div><div class="pr-kpi-l">Estadias</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + totPessoas + '</div><div class="pr-kpi-l">Hóspedes</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + totDormidas + '</div><div class="pr-kpi-l">Dormidas</div></div>';
    h += '<div class="pr-kpi"><div class="pr-kpi-v">' + (totNoites / fechadas.length).toFixed(1) + '</div><div class="pr-kpi-l">Estadia média</div></div>';
    h += '</div>';

    h += '<div class="pr-sec">Por nacionalidade</div>';
    h += '<table class="pr-table"><colgroup><col style="width:34%"><col style="width:16%"><col style="width:16%"><col style="width:17%"><col style="width:17%"></colgroup>';
    h += '<thead><tr><th>País</th><th>Estadias</th><th>Hóspedes</th><th>Dormidas</th><th>% dormidas</th></tr></thead><tbody>';
    Object.keys(porPais).sort(function(a, b) { return porPais[b].dormidas - porPais[a].dormidas; }).forEach(function(p) {
      var pct = totDormidas ? Math.round(porPais[p].dormidas / totDormidas * 100) : 0;
      h += '<tr><td>' + H(p) + '</td><td>' + porPais[p].estadias + '</td><td>' + porPais[p].pessoas + '</td><td>' + porPais[p].dormidas + '</td><td>' + pct + '%</td></tr>';
    });
    h += '<tr class="pr-tot"><td>Total</td><td>' + fechadas.length + '</td><td>' + totPessoas + '</td><td>' + totDormidas + '</td><td>100%</td></tr>';
    h += '</tbody></table>';

    h += '<div class="pr-sec">Por tipo de alojamento</div>';
    h += '<table class="pr-table"><colgroup><col style="width:50%"><col style="width:25%"><col style="width:25%"></colgroup>';
    h += '<thead><tr><th>Tipo</th><th>Estadias</th><th>Dormidas</th></tr></thead><tbody>';
    Object.keys(porTipo).sort(function(a, b) { return porTipo[b].dormidas - porTipo[a].dormidas; }).forEach(function(t) {
      h += '<tr><td>' + _tipo(t).l + '</td><td>' + porTipo[t].estadias + '</td><td>' + porTipo[t].dormidas + '</td></tr>';
    });
    h += '</tbody></table>';

    // detalhe das estadias
    h += '<div class="pr-sec">Detalhe das estadias (' + fechadas.length + ')</div>';
    h += '<table class="pr-table"><colgroup><col style="width:10%"><col style="width:14%"><col style="width:22%"><col style="width:14%"><col style="width:11%"><col style="width:11%"><col style="width:9%"><col style="width:9%"></colgroup>';
    h += '<thead><tr><th>Lugar</th><th>Tipo</th><th>Responsável</th><th>País</th><th>Entrada</th><th>Saída</th><th>Pess.</th><th>Dorm.</th></tr></thead><tbody>';
    fechadas.slice().sort(function(a, b) { return new Date(a.data_checkin) - new Date(b.data_checkin); }).forEach(function(e) {
      h += '<tr><td>' + H(e.lugar || '—') + '</td><td>' + _tipo(e.tipo_alojamento).l + '</td><td>' + H(e.responsavel_nome) + '</td><td>' + H(e.nacionalidade || '—') + '</td>';
      h += '<td>' + _fdata(e.data_checkin) + '</td><td>' + _fdata(e.data_checkout_real || e.data_checkout_prev) + '</td>';
      h += '<td>' + _pessoas(e) + '</td><td>' + _dormidas(e) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';
    _print(h);
  }

  function _print(html) {
    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = html;
    window.print();
  }

  function init() {}

  return {
    init: init, load: load, renderPainel: renderPainel,
    openNovo: openNovo, openEditar: openEditar, salvar: salvar,
    checkout: checkout, confirmarCheckout: confirmarCheckout,
    setTab: setTab, setMes: setMes, imprimir: imprimir,
    fazerCheckin: fazerCheckin, cancelar: cancelar, apagar: apagar,
    lista: function() { return _lista; },
    dormidas: _dormidas, pessoas: _pessoas, noites: _noites
  };

})();

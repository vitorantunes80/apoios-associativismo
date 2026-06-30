// ============================================================
// GestDDS — reservas.js  v5.1
// Módulo de Reservas — calendário semanal por equipamento
// ============================================================

var Reservas = (function() {

  var _weekOffset = 0; // semanas relativas à actual

  var CORES = [
    { v: '#3B82F6', l: 'Azul' },
    { v: '#8B5CF6', l: 'Roxo' },
    { v: '#10B981', l: 'Verde' },
    { v: '#F59E0B', l: 'Âmbar' },
    { v: '#EF4444', l: 'Vermelho' },
    { v: '#06B6D4', l: 'Ciano' },
    { v: '#EC4899', l: 'Rosa' },
    { v: '#6366F1', l: 'Índigo' }
  ];

  var HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00',
               '15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

  // ── RENDER ────────────────────────────────────────────────
  function render(eqId) {
    var eq = getEq(eqId || APP.spotEqId);
    if (!eq) return emptyState('Sem equipamento', 'Seleccione um equipamento para ver as reservas.');

    var tipo = getTipo(eq.tipo_id);
    if (tipo && !tipo.mod_reservas) {
      return '<div class="mod-ph"><div class="mod-ph-t">Módulo não activo</div><div class="mod-ph-s">As reservas não estão activadas para este tipo de equipamento.</div></div>';
    }

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Reservas — ' + H(eq.nome) + '</div></div>';
    html += '<button class="btn btn-primary" onclick="Reservas.openNova(\'' + eq.id + '\')">+ Nova reserva</button>';
    html += '</div>';

    html += _renderCalendario(eq.id);
    return html;
  }

  // ── CALENDÁRIO SEMANAL ────────────────────────────────────
  function _getWeekDates() {
    var hoje = new Date();
    var diaSemana = hoje.getDay(); // 0=Dom, 1=Seg...
    var seg = new Date(hoje);
    seg.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1) + (_weekOffset * 7));
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(seg);
      d.setDate(seg.getDate() + i);
      dias.push(d);
    }
    return dias;
  }

  function _fDataCurta(d) {
    var nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    return nomes[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1);
  }

  function _isHoje(d) {
    var hoje = new Date();
    return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }

  function _renderCalendario(eqId) {
    var dias = _getWeekDates();
    var seg = dias[0], dom = dias[6];

    var labelSemana = fData(seg.toISOString()) + ' — ' + fData(dom.toISOString());

    var html = '<div class="reservas-cal">';

    // Controlos
    html += '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaAnterior()">‹</div>';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaProxima()">›</div>';
    if (_weekOffset !== 0) html += '<button class="btn btn-ghost btn-sm" onclick="Reservas.semanaActual()" style="font-size:12px;">Hoje</button>';
    html += '</div>';
    html += '<button class="btn btn-primary btn-sm" onclick="Reservas.openNova(\'' + eqId + '\')">+ Nova reserva</button>';
    html += '</div>';

    // Grid
    html += '<div class="sched-wrap"><div class="sched-grid">';

    // Header
    html += '<div class="sched-head"></div>';
    dias.forEach(function(d) {
      html += '<div class="sched-head' + (_isHoje(d) ? ' today' : '') + '">' + _fDataCurta(d) + '</div>';
    });

    // Linhas de horas
    HORAS.forEach(function(h, hi) {
      var hora = 7 + hi;
      html += '<div class="sched-time">' + h + '</div>';

      dias.forEach(function(d) {
        html += '<div class="sched-cell" data-hora="' + hora + '" data-data="' + d.toISOString().split('T')[0] + '" onclick="Reservas.clickCelula(this,\'' + eqId + '\')">';

        // Reservas desta célula
        if (APP.reservas) {
          APP.reservas.forEach(function(r) {
            if (r.equipamento_id !== eqId) return;
            var rInicio = new Date(r.data_inicio);
            var rFim    = new Date(r.data_fim);
            var celData = new Date(d);
            celData.setHours(hora, 0, 0, 0);
            var celFim  = new Date(celData);
            celFim.setHours(hora + 1, 0, 0, 0);

            // mostra se a reserva começa nesta célula
            if (rInicio.toDateString() === d.toDateString() && rInicio.getHours() === hora) {
              var dur = (rFim - rInicio) / 3600000; // duração em horas
              var height = Math.max(1, dur) * 26 - 3;
              html += '<div class="sched-event" style="background:' + (r.cor || '#3B82F6') + '22;color:' + (r.cor || '#3B82F6') + ';border-left:3px solid ' + (r.cor || '#3B82F6') + ';height:' + height + 'px;" onclick="event.stopPropagation();Reservas.openEditar(\'' + r.id + '\')">';
              html += '<div style="font-weight:700;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(r.titulo) + '</div>';
              if (r.entidade) html += '<div style="font-size:9.5px;opacity:.8;">' + H(r.entidade) + '</div>';
              html += '</div>';
            }
          });
        }

        html += '</div>';
      });
    });

    html += '</div></div>';// sched-grid + sched-wrap

    // Legenda de estado
    html += '<div class="sched-legend">';
    html += '<div class="legend-item"><div class="legend-dot" style="background:#3B82F6;"></div>Confirmada</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:#F59E0B;"></div>Pendente</div>';
    html += '<div class="legend-item"><div class="legend-dot" style="background:#EF4444;"></div>Cancelada</div>';
    html += '</div>';

    html += '</div>';// reservas-cal
    return html;
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    html += '<div class="modal-bd" id="m-reserva-nova">';
    html += '<div class="modal" style="max-width:520px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="modal-title" id="m-res-ttl">Nova reserva</div><div class="modal-sub" id="m-res-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-reserva-nova\')">✕</button></div>';
    html += '<div class="modal-body">';

    html += '<div class="form-sec-t">Identificação</div>';
    html += '<div class="fi"><label class="fl">Título / Actividade *</label><input type="text" id="res-titulo" class="fin" placeholder="ex: Treino Basquetebol"></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Entidade / Clube</label><input type="text" id="res-entidade" class="fin" placeholder="ex: Clube Desportivo de Basto"></div>';
    html += '<div class="fi"><label class="fl">Espaço</label><input type="text" id="res-espaco" class="fin" placeholder="ex: Campo, Sala, Piscina"></div></div>';

    html += '<div class="form-sec-t">Data e hora</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Início *</label><input type="datetime-local" id="res-inicio" class="fin"></div>';
    html += '<div class="fi"><label class="fl">Fim *</label><input type="datetime-local" id="res-fim" class="fin"></div></div>';

    html += '<div class="form-sec-t">Detalhes</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Estado</label><select id="res-estado" class="fin"><option value="confirmada">Confirmada</option><option value="pendente">Pendente</option><option value="cancelada">Cancelada</option></select></div>';
    html += '<div class="fi"><label class="fl">Cor</label><select id="res-cor" class="fin">';
    CORES.forEach(function(cor) {
      html += '<option value="' + cor.v + '">' + cor.l + '</option>';
    });
    html += '</select></div></div>';
    html += '<div class="fi"><label class="fl">Observações</label><textarea id="res-obs" class="fin" rows="2" placeholder="Informações adicionais..."></textarea></div>';

    html += '</div>';
    html += '<div class="modal-footer" id="m-res-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button><button class="btn btn-primary" onclick="Reservas.salvar()">Guardar reserva</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function semanaAnterior() { _weekOffset--; _rerender(); }
  function semanaProxima()  { _weekOffset++; _rerender(); }
  function semanaActual()   { _weekOffset = 0; _rerender(); }

  function _rerender() {
    var c = document.getElementById('main-content');
    if (c && APP.view === 'equipamentos' && APP.subview === 'reservas') {
      c.innerHTML = render(APP.spotEqId);
    } else {
      // re-render ficha tab
      var tab = document.getElementById('ftab-reservas');
      if (tab) tab.innerHTML = _renderCalendario(APP.spotEqId);
    }
  }

  function clickCelula(el, eqId) {
    var hora  = el.dataset.hora;
    var data  = el.dataset.data;
    if (!hora || !data) return;
    // pré-preencher data/hora no modal
    var inicio = data + 'T' + String(hora).padStart(2,'0') + ':00';
    var fimH   = String(parseInt(hora) + 1).padStart(2,'0');
    var fim    = data + 'T' + fimH + ':00';
    openNova(eqId, inicio, fim);
  }

  function openNova(eqId, inicio, fim) {
    APP.editId = null;
    APP.actionRecord = { equipamento_id: eqId };
    var eq = getEq(eqId);
    document.getElementById('m-res-ttl').textContent = 'Nova reserva';
    document.getElementById('m-res-eq').textContent  = eq ? eq.nome : '—';
    document.getElementById('res-titulo').value   = '';
    document.getElementById('res-entidade').value = '';
    document.getElementById('res-espaco').value   = '';
    document.getElementById('res-obs').value      = '';
    document.getElementById('res-estado').value   = 'confirmada';
    document.getElementById('res-cor').value      = '#3B82F6';
    var ri = document.getElementById('res-inicio');
    var rf = document.getElementById('res-fim');
    if (ri) ri.value = inicio || '';
    if (rf) rf.value = fim || '';

    // footer com só Guardar
    var footer = document.getElementById('m-res-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button><button class="btn btn-primary" onclick="Reservas.salvar()">Guardar reserva</button>';

    openModal('m-reserva-nova');
  }

  function openEditar(id) {
    var r = (APP.reservas || []).filter(function(x) { return x.id === id; })[0];
    if (!r) return;
    APP.editId = id;
    APP.actionRecord = r;
    var eq = getEq(r.equipamento_id);
    document.getElementById('m-res-ttl').textContent = 'Editar reserva';
    document.getElementById('m-res-eq').textContent  = eq ? eq.nome : '—';

    var set = function(eid, val) { var el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('res-titulo',   r.titulo);
    set('res-entidade', r.entidade);
    set('res-espaco',   r.espaco);
    set('res-obs',      r.observacoes);
    set('res-estado',   r.estado || 'confirmada');
    set('res-cor',      r.cor || '#3B82F6');

    // formatar datas para datetime-local
    if (r.data_inicio) {
      var di = new Date(r.data_inicio);
      document.getElementById('res-inicio').value = di.toISOString().slice(0,16);
    }
    if (r.data_fim) {
      var df = new Date(r.data_fim);
      document.getElementById('res-fim').value = df.toISOString().slice(0,16);
    }

    // footer com Apagar + Guardar
    var footer = document.getElementById('m-res-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-danger btn-sm" onclick="Reservas.apagar(\'' + id + '\')">Apagar</button><button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button><button class="btn btn-primary" onclick="Reservas.salvar()">Guardar alterações</button>';

    openModal('m-reserva-nova');
  }

  function salvar() {
    var titulo  = document.getElementById('res-titulo');
    var inicio  = document.getElementById('res-inicio');
    var fim     = document.getElementById('res-fim');

    if (!titulo || !titulo.value.trim()) { toast('O título é obrigatório.', 'error'); return; }
    if (!inicio || !inicio.value)        { toast('A data de início é obrigatória.', 'error'); return; }
    if (!fim || !fim.value)              { toast('A data de fim é obrigatória.', 'error'); return; }
    if (new Date(inicio.value) >= new Date(fim.value)) { toast('O fim deve ser posterior ao início.', 'error'); return; }

    var eqId = APP.actionRecord ? APP.actionRecord.equipamento_id : APP.spotEqId;
    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var criadoPor = APP.user && APP.user.id && uuidRx.test(APP.user.id) ? APP.user.id : null;

    var body = {
      equipamento_id: eqId,
      titulo:         titulo.value.trim(),
      entidade:       (document.getElementById('res-entidade').value || '').trim(),
      espaco:         (document.getElementById('res-espaco').value || '').trim(),
      data_inicio:    new Date(inicio.value).toISOString(),
      data_fim:       new Date(fim.value).toISOString(),
      estado:         document.getElementById('res-estado').value || 'confirmada',
      cor:            document.getElementById('res-cor').value || '#3B82F6',
      observacoes:    (document.getElementById('res-obs').value || '').trim(),
      criado_por:     criadoPor
    };

    var p = APP.editId
      ? sbPatch('reservas', 'id=eq.' + APP.editId, body)
      : sbPost('reservas', body);

    p.then(function() {
      toast(APP.editId ? 'Reserva actualizada.' : 'Reserva criada.', 'success');
      closeModal('m-reserva-nova');
      _loadReservas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro reserva:', e);
      toast('Erro ao guardar reserva.', 'error');
    });
  }

  function apagar(id) {
    if (!confirm('Apagar esta reserva? A acção é irreversível.')) return;
    sbDelete('reservas', 'id=eq.' + id).then(function() {
      toast('Reserva eliminada.', 'success');
      closeModal('m-reserva-nova');
      _loadReservas(function() { _rerender(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  // ── CARREGAR RESERVAS ─────────────────────────────────────
  function _loadReservas(cb) {
    if (!APP.spotEqId) { if (cb) cb(); return; }
    // carregar 4 semanas à volta da semana actual
    var dias = _getWeekDates();
    var inicio = new Date(dias[0]); inicio.setDate(inicio.getDate() - 14);
    var fim    = new Date(dias[6]); fim.setDate(fim.getDate() + 14);
    sbGet('reservas', 'equipamento_id=eq.' + APP.spotEqId +
      '&data_inicio=gte.' + inicio.toISOString() +
      '&data_inicio=lte.' + fim.toISOString() +
      '&order=data_inicio.asc')
    .then(function(data) {
      APP.reservas = Array.isArray(data) ? data : [];
      if (cb) cb();
    }).catch(function() {
      APP.reservas = [];
      if (cb) cb();
    });
  }

  function init() {
    APP.reservas = APP.reservas || [];
    var cont = document.getElementById('modais-reservas');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  function load(cb) {
    _loadReservas(cb);
  }

  return {
    render: render,
    init: init,
    load: load,
    semanaAnterior: semanaAnterior,
    semanaProxima:  semanaProxima,
    semanaActual:   semanaActual,
    clickCelula:    clickCelula,
    openNova:       openNova,
    openEditar:     openEditar,
    salvar:         salvar,
    apagar:         apagar
  };

})();

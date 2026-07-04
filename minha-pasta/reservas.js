// ============================================================
// GestDDS — reservas.js  v5.2
// Módulo de Reservas — calendário semanal, pré-reserva,
// reservas recorrentes semanais
// ============================================================

var Reservas = (function() {

  var _weekOffset = 0;

  var DIAS_SEMANA = [
    { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
    { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' }
  ];

  var CORES = [
    { v: '#3B82F6', l: 'Azul' },   { v: '#8B5CF6', l: 'Roxo' },
    { v: '#10B981', l: 'Verde' },  { v: '#F59E0B', l: 'Âmbar' },
    { v: '#EF4444', l: 'Vermelho'},{ v: '#06B6D4', l: 'Ciano' },
    { v: '#EC4899', l: 'Rosa' },   { v: '#6366F1', l: 'Índigo'}
  ];

  var HORAS = [];
  for (var h = 7; h <= 23; h++) HORAS.push(h.toString().padStart(2,'0') + ':00');

  // ── ESTADO DAS RESERVAS ───────────────────────────────────
  var ESTADOS = {
    pre_reserva: { l: 'Pré-reserva', cor: '#F59E0B', bg: '#FFFBEB' },
    confirmada:  { l: 'Confirmada',  cor: '#3B82F6', bg: '#EFF6FF' },
    cancelada:   { l: 'Cancelada',   cor: '#EF4444', bg: '#FEF2F2' }
  };

  // ── RENDER PRINCIPAL ──────────────────────────────────────
  function render(eqId) {
    var eq = getEq(eqId || APP.spotEqId);
    if (!eq) return emptyState('Sem equipamento', 'Seleccione um equipamento para ver as reservas.');

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Reservas — ' + H(eq.nome) + '</div></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btn-secondary btn-sm" onclick="Reservas.openNova(\'' + eq.id + '\',\'pre_reserva\')">+ Pré-reserva</button>';
    html += '<button class="btn btn-primary btn-sm" onclick="Reservas.openNova(\'' + eq.id + '\',\'confirmada\')">+ Reserva confirmada</button>';
    html += '</div></div>';

    // Legenda de estado
    html += '<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">';
    for (var est in ESTADOS) {
      var e = ESTADOS[est];
      html += '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-2);">';
      html += '<div style="width:10px;height:10px;border-radius:50%;background:' + e.cor + ';"></div>' + e.l;
      html += '</div>';
    }
    html += '</div>';

    html += _renderCalendario(eq.id);
    return html;
  }

  // ── CALENDÁRIO ────────────────────────────────────────────
  function _getWeekDates() {
    var hoje = new Date();
    var diaSemana = hoje.getDay();
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

  function _fDia(d) {
    var n = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    return n[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1);
  }

  function _isHoje(d) {
    var h = new Date();
    return d.getDate()===h.getDate() && d.getMonth()===h.getMonth() && d.getFullYear()===h.getFullYear();
  }

  // Expandir reservas recorrentes para a semana actual
  function _expandirRecorrentes(reservas, dias) {
    var eventos = [];
    var seg = dias[0], dom = dias[6];

    reservas.forEach(function(r) {
      if (!r.recorrente) {
        // reserva simples — mostrar em cada dia que abrange na semana
        var ri = new Date(r.data_inicio);
        var rf = new Date(r.data_fim);
        var horaInicio = ri.getHours();
        dias.forEach(function(d) {
          var dNorm = new Date(d); dNorm.setHours(0,0,0,0);
          var riNorm = new Date(ri); riNorm.setHours(0,0,0,0);
          var rfNorm = new Date(rf); rfNorm.setHours(23,59,59,0);
          if (dNorm >= riNorm && dNorm <= rfNorm) {
            eventos.push({ reserva: r, data: d, hora: horaInicio });
          }
        });
        return;
      }

      // reserva recorrente — expandir para cada dia da semana neste período
      var diasSem = (r.dias_semana || '').split(',').map(function(x) { return parseInt(x,10); });
      var periInicio = r.data_inicio_periodo ? new Date(r.data_inicio_periodo) : new Date(r.data_inicio);
      var periFim    = r.data_fim_periodo    ? new Date(r.data_fim_periodo)    : new Date(r.data_fim);
      var horaIn = r.hora_inicio ? parseInt(r.hora_inicio.split(':')[0],10) : 9;

      dias.forEach(function(d) {
        // verificar se dia está no período e é um dos dias da semana
        var dNorm = new Date(d); dNorm.setHours(0,0,0,0);
        var pNorm = new Date(periInicio); pNorm.setHours(0,0,0,0);
        var fNorm = new Date(periFim);    fNorm.setHours(23,59,59,0);

        if (dNorm >= pNorm && dNorm <= fNorm && diasSem.indexOf(d.getDay()) >= 0) {
          eventos.push({ reserva: r, data: d, hora: horaIn });
        }
      });
    });
    return eventos;
  }

  function _renderCalendario(eqId) {
    var dias = _getWeekDates();
    var labelSemana = fData(dias[0].toISOString()) + ' — ' + fData(dias[6].toISOString());
    var eventos = _expandirRecorrentes(APP.reservas || [], dias);

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaAnterior()">‹</div>';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaProxima()">›</div>';
    if (_weekOffset !== 0) html += '<button class="btn btn-ghost btn-sm" onclick="Reservas.semanaActual()" style="font-size:12px;">Hoje</button>';
    html += '</div>';
    html += '<button class="btn btn-secondary btn-sm" onclick="Reservas.openListagem(\'' + eqId + '\')">Ver lista</button>';
    html += '</div>';

    html += '<div class="sched-wrap"><div class="sched-grid">';
    html += '<div class="sched-head"></div>';
    dias.forEach(function(d) {
      html += '<div class="sched-head' + (_isHoje(d) ? ' today' : '') + '">' + _fDia(d) + '</div>';
    });

    HORAS.forEach(function(hStr, hi) {
      var horaNum = 7 + hi;
      html += '<div class="sched-time">' + hStr + '</div>';
      dias.forEach(function(d, di) {
        html += '<div class="sched-cell" onclick="Reservas.clickCelula(this,\'' + eqId + '\')" data-hora="' + horaNum + '" data-data="' + d.toISOString().split('T')[0] + '">';

        // eventos desta célula
        eventos.forEach(function(ev) {
          if (ev.data.toDateString() !== d.toDateString()) return;
          if (ev.hora !== horaNum) return;

          var r   = ev.reserva;
          var r   = ev.reserva;
          var est = ESTADOS[r.estado] || ESTADOS.confirmada;

          // hora de fim para mostrar
          var horaFimStr = '';
          if (r.recorrente && r.hora_fim) {
            horaFimStr = r.hora_fim.slice(0,5);
          } else if (!r.recorrente && r.data_fim) {
            var hfEv = new Date(r.data_fim);
            horaFimStr = hfEv.getHours().toString().padStart(2,'0') + ':' + hfEv.getMinutes().toString().padStart(2,'0');
          }

          // altura fixa — 1 célula = 22px
          html += '<div class="sched-event" style="background:' + est.bg + ';color:' + est.cor + ';border-left:3px solid ' + est.cor + ';height:22px;overflow:hidden;cursor:pointer;" onclick="event.stopPropagation();Reservas.openEditar(\\\'' + r.id + '\\\')">'
;          html += '<div style="font-weight:700;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">';
          if (r.estado === 'pre_reserva') html += '⏳ ';
          if (r.recorrente) html += '🔁 ';
          html += H(r.titulo);
          if (horaFimStr) html += ' →' + horaFimStr;
          html += '</div></div>';
        });

        html += '</div>';
      });
    });

    html += '</div></div>';
    return html;
  }

  // ── LISTAGEM ──────────────────────────────────────────────
  function openListagem(eqId) {
    var reservas = (APP.reservas || []).filter(function(r) { return r.equipamento_id === eqId; });
    reservas.sort(function(a,b) { return new Date(a.data_inicio) - new Date(b.data_inicio); });

    var body = document.getElementById('m-res-list-body');
    if (!body) return;

    if (!reservas.length) {
      body.innerHTML = emptyState('Sem reservas', 'Não existem reservas para este equipamento.');
    } else {
      var html = '<div class="dtw"><table class="dt">';
      html += '<thead><tr><th>Título</th><th>Entidade</th><th>Período</th><th>Horário</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>';
      reservas.forEach(function(r) {
        var est = ESTADOS[r.estado] || ESTADOS.confirmada;
        html += '<tr>';
        html += '<td class="td-p">' + H(r.titulo) + '</td>';
        html += '<td class="td-m">' + H(r.entidade || '—') + '</td>';
        if (!r.recorrente && r.data_inicio) {
      // preencher campos pontual separados
      var diDate = new Date(r.data_inicio);
      var dfDate = r.data_fim ? new Date(r.data_fim) : diDate;
      document.getElementById('res-data-i').value = diDate.toISOString().split('T')[0];
      document.getElementById('res-data-f').value = dfDate.toISOString().split('T')[0];
      document.getElementById('res-inicio').value = diDate.getHours().toString().padStart(2,'0') + ':' + diDate.getMinutes().toString().padStart(2,'0');
      document.getElementById('res-fim').value    = dfDate.getHours().toString().padStart(2,'0') + ':' + dfDate.getMinutes().toString().padStart(2,'0');
    }
    if (r.recorrente) {
          var diasStr = (r.dias_semana || '').split(',').map(function(d) {
            var ds = DIAS_SEMANA.filter(function(x) { return x.v == parseInt(d,10); })[0];
            return ds ? ds.l : d;
          }).join(', ');
          html += '<td class="td-m">' + fData(r.data_inicio_periodo) + ' → ' + fData(r.data_fim_periodo) + '</td>';
          html += '<td class="td-m">' + diasStr + '<br><span style="font-family:JetBrains Mono,monospace;">' + (r.hora_inicio||'').slice(0,5) + '–' + (r.hora_fim||'').slice(0,5) + '</span></td>';
          html += '<td><span class="bdg" style="background:#EDE9FE;color:#5B21B6;">🔁 Recorrente</span></td>';
        } else {
          html += '<td class="td-m">' + fData(r.data_inicio) + '</td>';
          var hi = new Date(r.data_inicio), hf = new Date(r.data_fim);
          html += '<td class="td-mono">' + hi.getHours().toString().padStart(2,'0') + ':00–' + hf.getHours().toString().padStart(2,'0') + ':00</td>';
          html += '<td><span class="bdg" style="background:var(--accent-light);color:var(--accent-dark);">Pontual</span></td>';
        }
        html += '<td><span class="bdg" style="background:' + est.bg + ';color:' + est.cor + ';">' + est.l + '</span></td>';
        html += '<td><div class="td-act">';
        if (r.estado === 'pre_reserva') {
          html += '<button class="btn btn-primary btn-sm" onclick="Reservas.confirmar(\'' + r.id + '\')">Confirmar</button> ';
        }
        html += '<button class="btn btn-ghost btn-sm" onclick="Reservas.openEditar(\'' + r.id + '\')">Editar</button>';
        html += '</div></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;
    }
    openModal('m-res-listagem');
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // MODAL NOVA / EDITAR RESERVA
    html += '<div class="modal-bd" id="m-reserva-nova">';
    html += '<div class="modal" style="max-width:540px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="modal-title" id="m-res-ttl">Nova reserva</div><div class="modal-sub" id="m-res-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-reserva-nova\')">✕</button></div>';
    html += '<div class="modal-body">';

    html += '<div class="form-sec-t">Identificação</div>';
    html += '<div class="fi"><label class="fl">Título / Actividade *</label><input type="text" id="res-titulo" class="fin" placeholder="Descrição da actividade"></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Entidade / Clube</label><input type="text" id="res-entidade" class="fin" placeholder="Nome da entidade ou pessoa"></div>';
    html += '<div class="fi"><label class="fl">Espaço</label><select id="res-espaco-sel" class="fin" onchange="Reservas.onEspacoChange()"><option value="">Nenhum</option></select><input type="text" id="res-espaco" class="fin" placeholder="Escreva o espaço" style="display:none;margin-top:5px;"></div></div>';
    html += '<div class="form-row" id="res-contagem-wrap"><div class="fi"><label class="fl" id="res-lbl-cont">Nº de pessoas</label><input type="number" id="res-num-pessoas" class="fin" min="0" placeholder="0"></div>';
    html += '<div class="fi" id="res-cont2-wrap" style="display:none;"><label class="fl" id="res-lbl-cont2">—</label><input type="number" id="res-num-pessoas2" class="fin" min="0" placeholder="0"></div></div>';

    html += '<div class="form-sec-t">Estado</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Tipo de reserva *</label>';
    html += '<select id="res-estado" class="fin">';
    html += '<option value="pre_reserva">Pré-reserva (aguarda confirmação)</option>';
    html += '<option value="confirmada">Reserva confirmada</option>';
    html += '<option value="cancelada">Cancelada</option>';
    html += '</select></div>';
    html += '<div class="fi"><label class="fl">Cor no calendário</label><select id="res-cor" class="fin">';
    CORES.forEach(function(cor) { html += '<option value="' + cor.v + '">' + cor.l + '</option>'; });
    html += '</select></div></div>';

    html += '<div class="form-sec-t">Tipo de agendamento</div>';
    html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';
    html += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--r);transition:border-color .15s;" id="lbl-pontual">';
    html += '<input type="radio" name="res-tipo" id="res-tipo-p" value="pontual" checked onchange="Reservas.onTipoChange()">';
    html += '<div><div style="font-size:13px;font-weight:600;">Pontual</div><div style="font-size:11px;color:var(--text-3);">Uma data específica</div></div></label>';
    html += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--r);transition:border-color .15s;" id="lbl-recorrente">';
    html += '<input type="radio" name="res-tipo" id="res-tipo-r" value="recorrente" onchange="Reservas.onTipoChange()">';
    html += '<div><div style="font-size:13px;font-weight:600;">🔁 Recorrente</div><div style="font-size:11px;color:var(--text-3);">Semanal durante um período</div></div></label>';
    html += '</div>';

    // PONTUAL
    html += '<div id="res-pontual-wrap">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Data início *</label><input type="date" id="res-data-i" class="fin" onchange="Reservas.onDataChange()"></div>';
    html += '<div class="fi"><label class="fl">Data fim</label><input type="date" id="res-data-f" class="fin"><div class="form-hint">Deixe igual ao início para reserva de um dia</div></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Hora início *</label><input type="time" id="res-inicio" class="fin" value="09:00"></div>';
    html += '<div class="fi"><label class="fl">Hora fim *</label><input type="time" id="res-fim" class="fin" value="10:00"></div></div>';
    html += '</div>';

    // RECORRENTE
    html += '<div id="res-recorrente-wrap" style="display:none;">';
    html += '<div class="fi"><label class="fl">Dias da semana *</label>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
    DIAS_SEMANA.forEach(function(d) {
      html += '<label style="cursor:pointer;">';
      html += '<input type="checkbox" id="res-dia-' + d.v + '" value="' + d.v + '" style="display:none;" onchange="Reservas.onDiaChange(this)">';
      html += '<div class="res-dia-btn" id="res-dia-btn-' + d.v + '" style="width:38px;height:38px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:var(--text-3);transition:all .15s;">' + d.l + '</div>';
      html += '</label>';
    });
    html += '</div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Hora início *</label><input type="time" id="res-hora-i" class="fin" value="09:00"></div>';
    html += '<div class="fi"><label class="fl">Hora fim *</label><input type="time" id="res-hora-f" class="fin" value="10:00"></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Período — início *</label><input type="date" id="res-peri-i" class="fin"></div>';
    html += '<div class="fi"><label class="fl">Período — fim *</label><input type="date" id="res-peri-f" class="fin"></div></div>';
    html += '</div>';

    html += '<div class="fi"><label class="fl">Observações</label><textarea id="res-obs" class="fin" rows="2" placeholder="Informações adicionais..."></textarea></div>';

    html += '</div>';
    html += '<div class="modal-footer" id="m-res-footer">';
    html += '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button>';
    html += '<button class="btn btn-primary" onclick="Reservas.salvar()">Guardar reserva</button>';
    html += '</div>';
    html += '</div></div>';

    // MODAL LISTAGEM
    html += '<div class="modal-bd" id="m-res-listagem">';
    html += '<div class="modal" style="max-width:800px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div><div><div class="modal-title">Lista de reservas</div><div class="modal-sub" id="m-res-list-sub">—</div></div><button class="modal-close" onclick="closeModal(\'m-res-listagem\')">✕</button></div>';
    html += '<div class="modal-body" id="m-res-list-body"></div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-res-listagem\')">Fechar</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function onTipoChange() {
    var isRec = document.getElementById('res-tipo-r').checked;
    document.getElementById('res-pontual-wrap').style.display    = isRec ? 'none'  : 'block';
    document.getElementById('res-recorrente-wrap').style.display = isRec ? 'block' : 'none';
    // highlight selected label
    document.getElementById('lbl-pontual').style.borderColor    = isRec ? 'var(--border)' : 'var(--accent)';
    document.getElementById('lbl-recorrente').style.borderColor = isRec ? 'var(--accent)' : 'var(--border)';
  }

  function onDiaChange(cb) {
    var btn = document.getElementById('res-dia-btn-' + cb.value);
    if (!btn) return;
    if (cb.checked) {
      btn.style.background   = 'var(--accent)';
      btn.style.color        = '#fff';
      btn.style.borderColor  = 'var(--accent)';
    } else {
      btn.style.background   = '';
      btn.style.color        = 'var(--text-3)';
      btn.style.borderColor  = 'var(--border)';
    }
  }

  function _configurarPorTipo(eqId) {
    // popular dropdown com os espaços DO EQUIPAMENTO
    var sel = document.getElementById('res-espaco-sel');
    var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === eqId; });
    espacos.sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });

    if (sel) {
      sel.innerHTML = '<option value="">Nenhum</option>';
      espacos.forEach(function(esp) {
        var o = document.createElement('option');
        o.value = esp.id; o.textContent = esp.nome;
        sel.appendChild(o);
      });
      var oOutro = document.createElement('option');
      oOutro.value = '__outro'; oOutro.textContent = 'Outro...';
      sel.appendChild(oOutro);
    }

    // por defeito: contagem genérica até escolher espaço
    _aplicarLabelsContagem(null);
  }

  function _aplicarLabelsContagem(espacoId) {
    var esp = espacoId ? (APP.espacos || []).filter(function(x){ return x.id === espacoId; })[0] : null;
    var lbl1 = document.getElementById('res-lbl-cont');
    if (lbl1) lbl1.textContent = (esp && esp.label_contagem) ? esp.label_contagem : 'Nº de pessoas';
    var cont2wrap = document.getElementById('res-cont2-wrap');
    var lbl2 = document.getElementById('res-lbl-cont2');
    if (esp && esp.label_contagem2) {
      if (cont2wrap) cont2wrap.style.display = 'block';
      if (lbl2) lbl2.textContent = esp.label_contagem2;
    } else {
      if (cont2wrap) cont2wrap.style.display = 'none';
    }
  }

  function onEspacoChange() {
    var sel = document.getElementById('res-espaco-sel');
    var inp = document.getElementById('res-espaco');
    if (!sel || !inp) return;
    if (sel.value === '__outro') {
      inp.style.display = 'block';
      inp.value = '';
      inp.focus();
      _aplicarLabelsContagem(null);
    } else if (sel.value === '') {
      inp.style.display = 'none';
      inp.value = '';
      _aplicarLabelsContagem(null);
    } else {
      // é um espaço definido — usar o nome e aplicar os seus rótulos
      inp.style.display = 'none';
      var esp = (APP.espacos || []).filter(function(x){ return x.id === sel.value; })[0];
      inp.value = esp ? esp.nome : '';
      _aplicarLabelsContagem(sel.value);
    }
  }

  function _resetModal() {
    document.getElementById('res-titulo').value   = '';
    document.getElementById('res-entidade').value = '';
    document.getElementById('res-espaco').value   = '';
    var ss = document.getElementById('res-espaco-sel'); if (ss) ss.value = '';
    var si = document.getElementById('res-espaco'); if (si) si.style.display = 'none';
    var np = document.getElementById('res-num-pessoas'); if (np) np.value = '';
    var np2 = document.getElementById('res-num-pessoas2'); if (np2) np2.value = '';
    document.getElementById('res-obs').value      = '';
    document.getElementById('res-cor').value      = '#3B82F6';
    document.getElementById('res-tipo-p').checked = true;
    document.getElementById('res-data-i').value   = '';
    document.getElementById('res-data-f').value   = '';
    document.getElementById('res-inicio').value   = '09:00';
    document.getElementById('res-fim').value      = '10:00';
    document.getElementById('res-hora-i').value   = '09:00';
    document.getElementById('res-hora-f').value   = '10:00';
    document.getElementById('res-peri-i').value   = '';
    document.getElementById('res-peri-f').value   = '';
    DIAS_SEMANA.forEach(function(d) {
      var cb  = document.getElementById('res-dia-' + d.v);
      var btn = document.getElementById('res-dia-btn-' + d.v);
      if (cb)  cb.checked = false;
      if (btn) { btn.style.background=''; btn.style.color='var(--text-3)'; btn.style.borderColor='var(--border)'; }
    });
    onTipoChange();
  }

  function semanaAnterior() { _weekOffset--; _rerender(); }
  function semanaProxima()  { _weekOffset++; _rerender(); }
  function semanaActual()   { _weekOffset = 0; _rerender(); }

  function _rerender() {
    var c = document.getElementById('main-content');
    if (c) c.innerHTML = render(APP.spotEqId);
  }

  function clickCelula(el, eqId) {
    var hora = el.dataset.hora, data = el.dataset.data;
    if (!hora || !data) return;
    openNova(eqId, 'confirmada', data, String(hora).padStart(2,'0') + ':00');
  }

  function onDataChange() {
    // se data fim estiver vazia, copiar data início
    var di = document.getElementById('res-data-i');
    var df = document.getElementById('res-data-f');
    if (di && df && !df.value) df.value = di.value;
  }

  function openNova(eqId, estado, data, hora) {
    APP.editId = null;
    APP.actionRecord = { equipamento_id: eqId };
    var eq = getEq(eqId);
    document.getElementById('m-res-ttl').textContent = estado === 'pre_reserva' ? 'Nova pré-reserva' : 'Nova reserva';
    document.getElementById('m-res-eq').textContent  = eq ? eq.nome : '—';
    _resetModal();
    _configurarPorTipo(eqId);
    document.getElementById('res-estado').value = estado || 'confirmada';
    if (data) {
      document.getElementById('res-data-i').value = data;
      document.getElementById('res-data-f').value = data;
    }
    if (hora) document.getElementById('res-inicio').value = hora;

    var footer = document.getElementById('m-res-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button><button class="btn btn-primary" onclick="Reservas.salvar()">Guardar</button>';
    openModal('m-reserva-nova');
  }

  function openEditar(idOrEl) {
    var id = typeof idOrEl === 'string' ? idOrEl : (idOrEl.dataset ? idOrEl.dataset.rid : idOrEl);
    var r = (APP.reservas || []).filter(function(x) { return x.id === id; })[0];
    if (!r) return;
    APP.editId = id;
    APP.actionRecord = r;
    var eq = getEq(r.equipamento_id);
    document.getElementById('m-res-ttl').textContent = 'Editar reserva';
    document.getElementById('m-res-eq').textContent  = eq ? eq.nome : '—';
    _resetModal();
    _configurarPorTipo(r.equipamento_id);

    var set = function(eid, val) { var el=document.getElementById(eid); if(el) el.value=val||''; };
    set('res-titulo',   r.titulo);
    set('res-entidade', r.entidade);
    set('res-num-pessoas',  r.num_pessoas);
    set('res-num-pessoas2', r.num_pessoas2);
    // espaço — tentar seleccionar no dropdown, senão usar campo livre
    var espSel = document.getElementById('res-espaco-sel');
    if (r.espaco_id && espSel) {
      espSel.value = r.espaco_id;
      _aplicarLabelsContagem(r.espaco_id);
      var espInp0 = document.getElementById('res-espaco');
      if (espInp0) espInp0.value = r.espaco || '';
    } else if (r.espaco && espSel) {
      espSel.value = '__outro';
      var espInp = document.getElementById('res-espaco');
      if (espInp) { espInp.style.display = 'block'; espInp.value = r.espaco; }
    }
    set('res-obs',      r.observacoes);
    set('res-estado',   r.estado || 'confirmada');
    set('res-cor',      r.cor || '#3B82F6');

    if (r.recorrente) {
      document.getElementById('res-tipo-r').checked = true;
      set('res-hora-i', (r.hora_inicio || '09:00').slice(0,5));
      set('res-hora-f', (r.hora_fim    || '10:00').slice(0,5));
      set('res-peri-i', r.data_inicio_periodo ? new Date(r.data_inicio_periodo).toISOString().split('T')[0] : '');
      set('res-peri-f', r.data_fim_periodo    ? new Date(r.data_fim_periodo).toISOString().split('T')[0]    : '');
      (r.dias_semana || '').split(',').forEach(function(d) {
        var cb  = document.getElementById('res-dia-' + d.trim());
        if (cb) { cb.checked = true; onDiaChange(cb); }
      });
    } else {
      document.getElementById('res-tipo-p').checked = true;
      if (r.data_inicio) document.getElementById('res-inicio').value = new Date(r.data_inicio).toISOString().slice(0,16);
      if (r.data_fim)    document.getElementById('res-fim').value    = new Date(r.data_fim).toISOString().slice(0,16);
    }
    onTipoChange();

    var footer = document.getElementById('m-res-footer');
    if (footer) {
      var btnsExtra = '';
      if (r.estado === 'pre_reserva') {
        btnsExtra = '<button class="btn btn-success btn-sm" onclick="Reservas.confirmar(\'' + r.id + '\')">✓ Confirmar reserva</button> ';
      }
      footer.innerHTML = btnsExtra +
        '<button class="btn btn-danger btn-sm" onclick="Reservas.apagar(\'' + r.id + '\')">Apagar</button>' +
        '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="Reservas.salvar()">Guardar alterações</button>';
    }
    openModal('m-reserva-nova');
  }

  function confirmar(id) {
    // mudar estado para confirmada + notificar admin
    sbPatch('reservas', 'id=eq.' + id, { estado: 'confirmada' }).then(function() {
      toast('Reserva confirmada.', 'success');
      closeModal('m-reserva-nova');
      closeModal('m-res-listagem');

      // notificar admin
      var r = (APP.reservas || []).filter(function(x) { return x.id === id; })[0];
      var admin = APP.utilizadores.filter(function(u) { return u.perfil === 'admin'; })[0];
      if (admin && admin.id) {
        sbPost('avisos', {
          destinatario_id: admin.id,
          titulo: 'Reserva confirmada — ' + (r ? r.titulo : ''),
          mensagem: 'A pré-reserva "' + (r ? r.titulo : '') + '" foi confirmada.' + (r && r.entidade ? ' Entidade: ' + r.entidade + '.' : ''),
          lido: false
        }).then(function() {
          if (typeof Avisos !== 'undefined') Avisos.carregar();
        }).catch(function() {});
      }

      _loadReservas(function() { _rerender(); });
    }).catch(function() { toast('Erro ao confirmar.', 'error'); });
  }

  function salvar() {
    var titulo = document.getElementById('res-titulo');
    if (!titulo || !titulo.value.trim()) { toast('O título é obrigatório.', 'error'); return; }

    var isRec = document.getElementById('res-tipo-r').checked;
    var eqId  = APP.actionRecord ? APP.actionRecord.equipamento_id : APP.spotEqId;
    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var criadoPor = APP.user && APP.user.id && uuidRx.test(APP.user.id) ? APP.user.id : null;

    var body = {
      equipamento_id: eqId,
      titulo:         titulo.value.trim(),
      entidade:       (document.getElementById('res-entidade').value || '').trim(),
      espaco:         (document.getElementById('res-espaco').value   || '').trim(),
      espaco_id:      (function(){ var s=document.getElementById('res-espaco-sel'); return (s && s.value && s.value!=='__outro') ? s.value : null; })(),
      num_pessoas:    parseInt(document.getElementById('res-num-pessoas').value,10)  || null,
      num_pessoas2:   parseInt(document.getElementById('res-num-pessoas2').value,10) || null,
      estado:         document.getElementById('res-estado').value || 'confirmada',
      cor:            document.getElementById('res-cor').value    || '#3B82F6',
      observacoes:    (document.getElementById('res-obs').value   || '').trim(),
      criado_por:     criadoPor,
      recorrente:     isRec
    };

    if (isRec) {
      // validar dias
      var diasSel = DIAS_SEMANA.map(function(d) {
        var cb = document.getElementById('res-dia-' + d.v);
        return cb && cb.checked ? d.v : null;
      }).filter(function(v) { return v !== null; });

      if (!diasSel.length) { toast('Seleccione pelo menos um dia da semana.', 'error'); return; }
      var pi = document.getElementById('res-peri-i').value;
      var pf = document.getElementById('res-peri-f').value;
      if (!pi || !pf) { toast('Indique o período da reserva recorrente.', 'error'); return; }
      if (pi > pf) { toast('A data de fim deve ser posterior ao início.', 'error'); return; }

      body.dias_semana          = diasSel.join(',');
      body.hora_inicio          = document.getElementById('res-hora-i').value || null;
      body.hora_fim             = document.getElementById('res-hora-f').value || null;
      body.data_inicio_periodo  = pi;
      body.data_fim_periodo     = pf;
      body.data_inicio          = pi; // para compatibilidade
      body.data_fim             = pf;
    } else {
      var dataI  = document.getElementById('res-data-i').value;
      var dataF  = document.getElementById('res-data-f').value || dataI;
      var horaI  = document.getElementById('res-inicio').value || '09:00';
      var horaF  = document.getElementById('res-fim').value    || '10:00';
      if (!dataI) { toast('A data de início é obrigatória.', 'error'); return; }
      if (!horaI) { toast('A hora de início é obrigatória.', 'error'); return; }
      if (!horaF) { toast('A hora de fim é obrigatória.', 'error'); return; }
      if (dataF < dataI) { toast('A data de fim deve ser posterior ao início.', 'error'); return; }
      body.data_inicio = dataI + 'T' + horaI + ':00';
      body.data_fim    = dataF + 'T' + horaF + ':00';
      body.hora_inicio = horaI;
      body.hora_fim    = horaF;
    }

    var p = APP.editId
      ? sbPatch('reservas', 'id=eq.' + APP.editId, body)
      : sbPost('reservas', body);

    p.then(function() {
      toast(APP.editId ? 'Reserva actualizada.' : 'Reserva criada.', 'success');
      closeModal('m-reserva-nova');
      _loadReservas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro reserva:', e);
      var msg = 'Erro ao guardar reserva.';
      if (e && e.message) msg += ' ' + e.message;
      if (e && e.details) msg += ' ' + e.details;
      if (e && e.hint)    msg += ' ' + e.hint;
      if (e && e.code)    msg += ' (código: ' + e.code + ')';
      toast(msg, 'error');
    });
  }

  function apagar(id) {
    if (!confirm('Apagar esta reserva? A acção é irreversível.')) return;
    sbDelete('reservas', 'id=eq.' + id).then(function() {
      toast('Reserva eliminada.', 'success');
      closeModal('m-reserva-nova');
      closeModal('m-res-listagem');
      _loadReservas(function() { _rerender(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  // ── CARREGAR ──────────────────────────────────────────────
  function _loadReservas(cb) {
    if (!APP.spotEqId) { APP.reservas = []; if (cb) cb(); return; }
    sbGet('reservas', 'equipamento_id=eq.' + APP.spotEqId + '&order=data_inicio.asc')
      .then(function(data) {
        APP.reservas = Array.isArray(data) ? data : [];
        if (cb) cb();
      }).catch(function() { APP.reservas = []; if (cb) cb(); });
  }

  function init() {
    APP.reservas = APP.reservas || [];
    var cont = document.getElementById('modais-reservas');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  function load(cb) { _loadReservas(cb); }

  return {
    render: render, init: init, load: load,
    semanaAnterior: semanaAnterior, semanaProxima: semanaProxima, semanaActual: semanaActual,
    clickCelula: clickCelula, openNova: openNova, openEditar: openEditar,
    openListagem: openListagem, confirmar: confirmar, salvar: salvar, apagar: apagar,
    onTipoChange: onTipoChange, onDiaChange: onDiaChange, onEspacoChange: onEspacoChange
  };

})();

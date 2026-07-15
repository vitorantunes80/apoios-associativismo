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
    // resolve para um equipamento onde o módulo esteja REALMENTE ligado
    var alvo = eqDoModulo('reservas', eqId || APP.spotEqId);
    if (!alvo) return semEqParaModulo('Reservas');
    if (APP.spotEqId !== alvo) APP.spotEqId = alvo; // manter a sidebar coerente
    var eq = getEq(alvo);
    if (!eq) return semEqParaModulo('Reservas');

    var podeGerir = APP.podeGerirReservas(eq.id);
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Reservas — ' + H(eq.nome) + '</div>';
    html += eqSwitcher('reservas', eq.id) + '</div>';
    if (podeGerir) {
      html += '<div style="display:flex;gap:8px;">';
      html += '<button class="btn btn-secondary btn-sm" onclick="Reservas.openNova(\'' + eq.id + '\',\'pre_reserva\')">+ Pré-reserva</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Reservas.openNova(\'' + eq.id + '\',\'confirmada\')">+ Reserva confirmada</button>';
      html += '</div>';
    } else {
      html += '<span style="font-size:12px;color:var(--text-3);padding:6px 10px;background:var(--bg);border-radius:6px;">👁 Apenas consulta</span>';
    }
    html += '</div>';

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
  // "09:30" → 9.5   (os minutos contam)
  // Fundo claro (translúcido) a partir de uma cor #RRGGBB, para o bloco
  // da reserva ter a cor escolhida sem esconder o texto.
  function _corClara(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(59,130,246,0.14)';
    var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',0.15)';
  }

  function _hDec(hhmm) {
    if (!hhmm) return null;
    var p = String(hhmm).split(':');
    return (parseInt(p[0], 10) || 0) + (parseInt(p[1], 10) || 0) / 60;
  }

  // Componentes LOCAIS de uma data, para os inputs date/time.
  // toISOString() dá UTC e pode saltar de dia consoante o fuso.
  function _pad(n) { return (n < 10 ? '0' : '') + n; }
  function _dataLocal(d) {
    return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
  }
  function _horaLocal(d) {
    return _pad(d.getHours()) + ':' + _pad(d.getMinutes());
  }

  function _expandirRecorrentes(reservas, dias) {
    var eventos = [];

    reservas.forEach(function(r) {
      if (!r.recorrente) {
        var ri = new Date(r.data_inicio);
        var rf = r.data_fim ? new Date(r.data_fim) : null;

        var hIni = ri.getHours() + ri.getMinutes() / 60;
        var hFim = rf ? (rf.getHours() + rf.getMinutes() / 60) : (hIni + 1);
        // se acaba noutro dia, mostra até ao fim do dia
        if (rf && rf.toDateString() !== ri.toDateString()) hFim = 24;

        dias.forEach(function(d) {
          var dNorm  = new Date(d);  dNorm.setHours(0,0,0,0);
          var riNorm = new Date(ri); riNorm.setHours(0,0,0,0);
          var rfNorm = new Date(rf || ri); rfNorm.setHours(23,59,59,0);
          if (dNorm >= riNorm && dNorm <= rfNorm) {
            eventos.push({ reserva: r, data: d, hIni: hIni, hFim: hFim });
          }
        });
        return;
      }

      // recorrente — expandir por dia da semana dentro do período
      var diasSem = (r.dias_semana || '').split(',').map(function(x) { return parseInt(x, 10); });
      var periInicio = r.data_inicio_periodo ? new Date(r.data_inicio_periodo) : new Date(r.data_inicio);
      var periFim    = r.data_fim_periodo    ? new Date(r.data_fim_periodo)    : new Date(r.data_fim);

      var hIniR = _hDec(r.hora_inicio);
      var hFimR = _hDec(r.hora_fim);
      if (hIniR == null) hIniR = 9;
      if (hFimR == null || hFimR <= hIniR) hFimR = hIniR + 1;

      dias.forEach(function(d) {
        var dNorm = new Date(d); dNorm.setHours(0,0,0,0);
        var pNorm = new Date(periInicio); pNorm.setHours(0,0,0,0);
        var fNorm = new Date(periFim);    fNorm.setHours(23,59,59,0);

        if (dNorm >= pNorm && dNorm <= fNorm && diasSem.indexOf(d.getDay()) >= 0) {
          eventos.push({ reserva: r, data: d, hIni: hIniR, hFim: hFimR });
        }
      });
    });
    _atribuirColunas(eventos);
    return eventos;
  }

  // Reservas que se sobrepõem no tempo, no mesmo dia, ficam LADO A LADO.
  // A cada evento damos { _col, _cols } para calcular largura e posição.
  function _atribuirColunas(eventos) {
    // agrupar por dia
    var porDia = {};
    eventos.forEach(function(ev) {
      var k = ev.data.toDateString();
      (porDia[k] = porDia[k] || []).push(ev);
    });

    Object.keys(porDia).forEach(function(k) {
      var lista = porDia[k].sort(function(a, b) { return a.hIni - b.hIni || a.hFim - b.hFim; });

      // dividir em grupos que se tocam (cadeias de sobreposição)
      var grupo = [], fimGrupo = -1;
      function fecharGrupo() {
        if (!grupo.length) return;
        // colocação gulosa por colunas
        var cols = [];
        grupo.forEach(function(ev) {
          var c = 0;
          while (cols[c] != null && cols[c] > ev.hIni + 1e-6) c++;
          ev._col = c;
          cols[c] = ev.hFim;
        });
        var total = cols.length;
        grupo.forEach(function(ev) { ev._cols = total; });
        grupo = []; fimGrupo = -1;
      }

      lista.forEach(function(ev) {
        if (grupo.length && ev.hIni >= fimGrupo - 1e-6) fecharGrupo();
        grupo.push(ev);
        if (ev.hFim > fimGrupo) fimGrupo = ev.hFim;
      });
      fecharGrupo();
    });
  }

  function _renderCalendario(eqId) {
    var dias = _getWeekDates();
    var labelSemana = fData(dias[0].toISOString()) + ' — ' + fData(dias[6].toISOString());

    // só as reservas DESTE equipamento
    var doEq = (APP.reservas || []).filter(function(r) { return r.equipamento_id === eqId; });
    var eventos = _expandirRecorrentes(doEq, dias);

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaAnterior()">‹</div>';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '<div class="esc-nav-btn" onclick="Reservas.semanaProxima()">›</div>';
    if (_weekOffset !== 0) html += '<button class="btn btn-ghost btn-sm" onclick="Reservas.semanaActual()" style="font-size:12px;">Hoje</button>';
    html += '</div>';
    html += '<button class="btn btn-secondary btn-sm" onclick="Reservas.openListagem(\'' + eqId + '\')">Ver lista</button>';
    html += '</div>';

    // ── Grelha DINÂMICA: só as horas em que há reservas ──
    var minH = 24, maxH = 0;
    eventos.forEach(function(ev) {
      var hi = ev.hIni, hf = ev.hFim;
      if (hi == null) return;
      if (hi < minH) minH = hi;
      if ((hf || hi + 1) > maxH) maxH = hf || hi + 1;
    });
    if (minH > maxH) { minH = 9; maxH = 18; }    // sem reservas
    minH = Math.max(0, Math.floor(minH) - 1);
    maxH = Math.min(24, Math.ceil(maxH) + 1);
    if (maxH - minH < 6) maxH = Math.min(24, minH + 6);

    var LINHA = 30;

    html += '<div class="sched-wrap"><div class="sched-grid" style="--row:' + LINHA + 'px;">';
    html += '<div class="sched-head"></div>';
    dias.forEach(function(d) {
      html += '<div class="sched-head' + (_isHoje(d) ? ' today' : '') + '">' + _fDia(d) + '</div>';
    });

    for (var hn = minH; hn < maxH; hn++) {
      var horaNum = hn;
      html += '<div class="sched-time">' + ('0' + hn).slice(-2) + ':00</div>';

      dias.forEach(function(d) {
        var dStr = d.toISOString().split('T')[0];
        html += '<div class="sched-cell" onclick="Reservas.clickCelula(this,\'' + eqId + '\')" data-hora="' + horaNum + '" data-data="' + dStr + '">';

        eventos.forEach(function(ev) {
          if (ev.data.toDateString() !== d.toDateString()) return;
          if (Math.floor(ev.hIni) !== horaNum) return;

          var r   = ev.reserva;
          var est = ESTADOS[r.estado] || ESTADOS.confirmada;

          var hIni = ev.hIni;
          var hFim = (ev.hFim && ev.hFim > hIni) ? ev.hFim : hIni + 1;

          var offset = (hIni - Math.floor(hIni)) * LINHA;
          var altura = Math.max(16, (hFim - hIni) * LINHA - 2);

          var lbl = _fmtH(hIni) + '–' + _fmtH(hFim);

          // posição lado a lado quando há sobreposição
          var cols = ev._cols || 1;
          var col  = ev._col || 0;
          var larg = 100 / cols;
          var posL = col * larg;

          // A cor do bloco é a COR ESCOLHIDA na reserva. O estado vira sinal
          // secundário: pré-reserva com contorno tracejado, cancelada esbatida.
          var cor = r.cor || '#3B82F6';
          var estilo = 'background:' + _corClara(cor) + ';color:' + cor +
                       ';border-left:3px solid ' + cor + ';top:' + offset + 'px;height:' + altura + 'px;' +
                       'left:calc(' + posL + '% + 1px);width:calc(' + larg + '% - 2px);cursor:pointer;';
          if (r.estado === 'pre_reserva') estilo += 'border:1.5px dashed ' + cor + ';border-left:3px solid ' + cor + ';';
          if (r.estado === 'cancelada')   estilo += 'opacity:.5;text-decoration:line-through;';

          html += '<div class="sched-event" title="' + H(r.titulo) + (r.espaco ? ' · ' + H(r.espaco) : '') + ' · ' + lbl + '"';
          html += ' style="' + estilo + '"';
          html += ' onclick="event.stopPropagation();Reservas.abrirDetalhe(\'' + r.id + '\')">';
          html += '<span style="font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">';
          if (r.estado === 'pre_reserva') html += '⏳ ';
          if (r.recorrente) html += '🔁 ';
          html += H(r.titulo);
          html += '</span>';
          if (r.espaco && altura > 24) {
            html += '<span style="font-weight:600;opacity:.85;font-size:9px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(r.espaco) + '</span>';
          }
          if (altura > 26) {
            html += '<span style="font-weight:400;opacity:.8;font-size:9.5px;">' + lbl + '</span>';
          }
          html += '</div>';
        });

        html += '</div>';
      });
    }

    html += '</div></div>';
    return html;
  }

  // 9.5 → "09:30"
  function _fmtH(dec) {
    var h = Math.floor(dec);
    var m = Math.round((dec - h) * 60);
    if (m === 60) { h++; m = 0; }
    return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
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
          html += '<td class="td-mono">' + _horaLocal(hi) + '–' + _horaLocal(hf) + '</td>';
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
    html += '<div class="fi"><label class="fl">Cor no calendário</label>';
    html += '<div class="res-cores" id="res-cor-picker">';
    CORES.forEach(function(cor, i) {
      html += '<button type="button" class="res-cor-bolha' + (i === 0 ? ' sel' : '') + '" data-cor="' + cor.v +
              '" title="' + cor.l + '" style="background:' + cor.v + ';" onclick="Reservas.escolherCor(\'' + cor.v + '\')"></button>';
    });
    html += '</div>';
    html += '<input type="hidden" id="res-cor" value="#3B82F6">';
    html += '</div></div>';

    // Seletor de tipo — só aparece quando o equipamento permite recorrentes.
    // Fica escondido por defeito; _configurarPorTipo() decide se o mostra.
    html += '<div id="res-tipo-wrap" style="display:none;">';
    html += '<div class="form-sec-t">Tipo de agendamento</div>';
    html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';
    html += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--r);transition:border-color .15s;" id="lbl-pontual">';
    html += '<input type="radio" name="res-tipo" id="res-tipo-p" value="pontual" checked onchange="Reservas.onTipoChange()">';
    html += '<div><div style="font-size:13px;font-weight:600;">Pontual</div><div style="font-size:11px;color:var(--text-3);">Uma data específica</div></div></label>';
    html += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--r);transition:border-color .15s;" id="lbl-recorrente">';
    html += '<input type="radio" name="res-tipo" id="res-tipo-r" value="recorrente" onchange="Reservas.onTipoChange()">';
    html += '<div><div style="font-size:13px;font-weight:600;">🔁 Recorrente</div><div style="font-size:11px;color:var(--text-3);">Semanal durante um período</div></div></label>';
    html += '</div>';
    html += '</div>';

    // PONTUAL — sempre num único dia (data + intervalo de horas)
    html += '<div id="res-pontual-wrap">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Data *</label><input type="date" id="res-data-i" class="fin" onchange="Reservas.onDataChange()"></div></div>';
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

    // MODAL DETALHE — aberto ao tocar numa reserva do calendário
    html += '<div class="modal-bd" id="m-res-detalhe">';
    html += '<div class="modal" style="max-width:460px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="modal-title" id="m-resd-ttl">Reserva</div><div class="modal-sub" id="m-resd-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-res-detalhe\')">✕</button></div>';
    html += '<div class="modal-body" id="m-resd-body"></div>';
    html += '<div class="modal-footer" id="m-resd-footer"></div>';
    html += '</div></div>';

    return html;
  }

  // ── DETALHE DE UMA RESERVA ────────────────────────────────
  function escolherCor(v) {
    var inp = document.getElementById('res-cor');
    if (inp) inp.value = v;
    var picker = document.getElementById('res-cor-picker');
    if (picker) {
      picker.querySelectorAll('.res-cor-bolha').forEach(function(b) {
        b.classList.toggle('sel', b.dataset.cor === v);
      });
    }
  }

  function abrirDetalhe(id) {
    var r = (APP.reservas || []).filter(function(x) { return x.id === id; })[0];
    if (!r) { toast('Reserva não encontrada.', 'error'); return; }
    var eq  = getEq(r.equipamento_id);
    var est = ESTADOS[r.estado] || ESTADOS.confirmada;

    document.getElementById('m-resd-ttl').textContent = r.titulo || 'Reserva';
    document.getElementById('m-resd-eq').textContent  = eq ? eq.nome : '—';

    function linha(rot, val) {
      if (val == null || val === '') return '';
      return '<div class="resd-l"><span class="resd-r">' + H(rot) + '</span><span class="resd-v">' + H(String(val)) + '</span></div>';
    }

    var quando;
    if (r.recorrente) {
      var diasStr = (r.dias_semana || '').split(',').map(function(d) {
        var ds = DIAS_SEMANA.filter(function(x) { return x.v == parseInt(d, 10); })[0];
        return ds ? ds.l : d;
      }).join(', ');
      quando = diasStr + ' · ' + (r.hora_inicio || '').slice(0, 5) + '–' + (r.hora_fim || '').slice(0, 5) +
               '<br><span style="font-size:12px;color:var(--text-3);">' + fData(r.data_inicio_periodo) + ' a ' + fData(r.data_fim_periodo) + '</span>';
    } else {
      var hi = new Date(r.data_inicio), hf = new Date(r.data_fim);
      quando = fData(r.data_inicio) + ' · ' + _horaLocal(hi) + '–' + _horaLocal(hf);
    }

    var body = '<div class="resd-badges">';
    body += '<span class="bdg" style="background:' + est.bg + ';color:' + est.cor + ';">' + est.l + '</span>';
    body += '<span class="bdg" style="background:' + (r.recorrente ? '#EDE9FE' : 'var(--accent-light)') + ';color:' + (r.recorrente ? '#5B21B6' : 'var(--accent-dark)') + ';">' + (r.recorrente ? '🔁 Recorrente' : 'Pontual') + '</span>';
    body += '</div>';
    body += '<div class="resd-quando">' + quando + '</div>';
    body += linha('Entidade', r.entidade);
    body += linha('Espaço', r.espaco);
    body += linha('Nº de pessoas', r.num_pessoas);
    body += linha('Observações', r.observacoes);
    document.getElementById('m-resd-body').innerHTML = body;

    var footer = document.getElementById('m-resd-footer');
    if (APP.podeGerirReservas(r.equipamento_id)) {
      var extra = '';
      if (r.estado === 'pre_reserva') {
        extra = '<button class="btn btn-success btn-sm" onclick="Reservas.confirmar(\'' + r.id + '\')">✓ Confirmar</button> ';
      }
      footer.innerHTML = extra +
        '<button class="btn btn-danger btn-sm" onclick="Reservas.apagar(\'' + r.id + '\')">Apagar</button>' +
        '<button class="btn btn-ghost" onclick="closeModal(\'m-res-detalhe\')">Fechar</button>' +
        '<button class="btn btn-primary" onclick="closeModal(\'m-res-detalhe\');Reservas.openEditar(\'' + r.id + '\')">Editar</button>';
    } else {
      footer.innerHTML = '<button class="btn btn-ghost" onclick="closeModal(\'m-res-detalhe\')">Fechar</button>';
    }
    openModal('m-res-detalhe');
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

    // Só mostra a escolha Pontual/Recorrente se o equipamento a permitir.
    // Caso contrário, força pontual e esconde o seletor.
    var eq = getEq(eqId);
    var permite = permiteRecorrente(eq);
    var wrap = document.getElementById('res-tipo-wrap');
    if (wrap) wrap.style.display = permite ? 'block' : 'none';
    if (!permite) {
      var rp = document.getElementById('res-tipo-p');
      var rr = document.getElementById('res-tipo-r');
      if (rp) rp.checked = true;
      if (rr) rr.checked = false;
      onTipoChange();
    }
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
    escolherCor('#3B82F6');
    document.getElementById('res-tipo-p').checked = true;
    document.getElementById('res-data-i').value   = '';
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
    if (!APP.podeGerirReservas(eqId)) return; // funcionário não cria
    var hora = el.dataset.hora, data = el.dataset.data;
    if (!hora || !data) return;
    openNova(eqId, 'confirmada', data, String(hora).padStart(2,'0') + ':00');
  }

  function onDataChange() {
    // reserva pontual é sempre de um dia — nada a sincronizar
  }

  function openNova(eqId, estado, data, hora) {
    APP.editId = null;
    APP.actionRecord = { equipamento_id: eqId };
    var eq = getEq(eqId);
    document.getElementById('m-res-ttl').textContent = estado === 'pre_reserva' ? 'Nova pré-reserva' : 'Nova reserva';
    document.getElementById('m-res-eq').textContent  = eq ? eq.nome : '—';
    _resetModal();
    _configurarPorTipo(eqId);
    // reactivar campos (podem ter ficado disabled de uma consulta anterior)
    document.querySelectorAll('#m-reserva-nova input, #m-reserva-nova select, #m-reserva-nova textarea').forEach(function(el){ el.disabled = false; });
    document.getElementById('res-estado').value = estado || 'confirmada';
    if (data) {
      document.getElementById('res-data-i').value = data;
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
    escolherCor(r.cor || '#3B82F6');

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
      // Preencher com componentes LOCAIS. Usar toISOString() convertia para UTC
      // e podia trocar o dia/hora (foi o que fazia os campos parecerem vazios ou
      // errados ao reabrir para editar).
      if (r.data_inicio) {
        var di = new Date(r.data_inicio);
        document.getElementById('res-data-i').value = _dataLocal(di);
        document.getElementById('res-inicio').value = _horaLocal(di);
      }
      if (r.data_fim) {
        document.getElementById('res-fim').value = _horaLocal(new Date(r.data_fim));
      } else if (r.hora_fim) {
        document.getElementById('res-fim').value = String(r.hora_fim).slice(0, 5);
      }
    }
    onTipoChange();

    var footer = document.getElementById('m-res-footer');
    if (footer) {
      // reactivar campos primeiro
      document.querySelectorAll('#m-reserva-nova input, #m-reserva-nova select, #m-reserva-nova textarea').forEach(function(el){ el.disabled = false; });

      if (!APP.podeGerirReservas(r.equipamento_id)) {
        // só consulta — desactivar campos e mostrar só Fechar
        footer.innerHTML = '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Fechar</button>';
        document.querySelectorAll('#m-reserva-nova input, #m-reserva-nova select, #m-reserva-nova textarea').forEach(function(el){ el.disabled = true; });
      } else {
        var btnsExtra = '';
        if (r.estado === 'pre_reserva') {
          btnsExtra = '<button class="btn btn-success btn-sm" onclick="Reservas.confirmar(\'' + r.id + '\')">✓ Confirmar reserva</button> ';
        }
        footer.innerHTML = btnsExtra +
          '<button class="btn btn-danger btn-sm" onclick="Reservas.apagar(\'' + r.id + '\')">Apagar</button>' +
          '<button class="btn btn-ghost" onclick="closeModal(\'m-reserva-nova\')">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="Reservas.salvar()">Guardar alterações</button>';
      }
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

    // Rede de segurança: se o equipamento não permite recorrentes, garantir
    // que nunca se grava uma (ex.: estado residual do formulário).
    if (isRec && !permiteRecorrente(getEq(eqId))) isRec = false;

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
      var horaI  = document.getElementById('res-inicio').value || '09:00';
      var horaF  = document.getElementById('res-fim').value    || '10:00';
      if (!dataI) { toast('A data é obrigatória.', 'error'); return; }
      if (!horaI) { toast('A hora de início é obrigatória.', 'error'); return; }
      if (!horaF) { toast('A hora de fim é obrigatória.', 'error'); return; }
      if (horaF <= horaI) { toast('A hora de fim deve ser posterior à de início.', 'error'); return; }
      // Reserva pontual = SEMPRE um único dia. data_fim fica no mesmo dia,
      // só muda a hora. Assim o calendário nunca a espalha por dois dias.
      body.data_inicio = dataI + 'T' + horaI + ':00';
      body.data_fim    = dataI + 'T' + horaF + ':00';
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
    if (!APP.spotEqId) { if (cb) cb(); return; }
    var eq = APP.spotEqId;

    sbGet('reservas', 'equipamento_id=eq.' + eq + '&order=data_inicio.asc')
      .then(function(data) {
        var novas = Array.isArray(data) ? data : [];

        // Fundir com as que já existem, descartando as antigas DESTE
        // equipamento (assim as apagadas desaparecem e as dos outros
        // equipamentos não se perdem).
        var base = (APP.reservas || []).filter(function(r) {
          return r.equipamento_id !== eq;
        });

        APP.reservas = base.concat(novas);
        if (cb) cb();
      }).catch(function(e) {
        console.error('Erro ao carregar reservas:', e);
        if (cb) cb();
      });
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
    abrirDetalhe: abrirDetalhe, escolherCor: escolherCor,
    openListagem: openListagem, confirmar: confirmar, salvar: salvar, apagar: apagar,
    onTipoChange: onTipoChange, onDiaChange: onDiaChange, onEspacoChange: onEspacoChange
  };

})();

// ============================================================
// GestDDS — escalas.js  v5.1
// Módulo de Escalas e Turnos por equipamento
// ============================================================

var Escalas = (function() {

  var _weekOffset = 0;

  var TIPOS_TURNO = [
    { v: 'normal',   l: 'Turno Normal',  cor: '#3B82F6' },
    { v: 'ferias',   l: 'Férias',        cor: '#10B981' },
    { v: 'folga',    l: 'Folga',         cor: '#94A3B8' },
    { v: 'feriado',  l: 'Feriado',       cor: '#F59E0B' },
    { v: 'formacao', l: 'Formação',      cor: '#8B5CF6' },
    { v: 'doenca',   l: 'Doença',        cor: '#EF4444' }
  ];

  var FUNCOES = ['Manutenção','Receção','Limpeza','Sala / Campo','Piscina','Segurança','Outra'];
  var HORAS   = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00',
                 '14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

  // ── RENDER ────────────────────────────────────────────────
  function render(eqId) {
    var eq = getEq(eqId || APP.spotEqId);
    if (!eq) return emptyState('Sem equipamento', 'Seleccione um equipamento para ver as escalas.');

    var tipo = getTipo(eq.tipo_id);
    if (!modAtivo(eq, 'escalas')) {
      return '<div class="mod-ph"><div class="mod-ph-t">Módulo não activo</div><div class="mod-ph-s">As escalas não estão activadas para este equipamento.</div></div>';
    }

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Escalas — ' + H(eq.nome) + '</div></div>';
    if (!APP.podeGerirEscalas(eq.id)) {
      html += '<span style="font-size:12px;color:var(--text-3);padding:6px 10px;background:var(--bg);border-radius:6px;">👁 Apenas consulta</span>';
    }
    html += '</div>';

    // Para funcionário: destacar a SUA escala
    if (APP.isFuncionario() && APP.user) {
      html += _renderMinhaEscala(eq.id, APP.user.id);
    }

    html += _renderEscala(eq.id);
    return html;
  }

  function _renderMinhaEscala(eqId, funcId) {
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var diaSem = hoje.getDay();
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (diaSem===0?6:diaSem-1));
    var nomesDia = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

    var meusTurnos = (APP.escalas || []).filter(function(e) {
      return e.equipamento_id === eqId && e.funcionario_id === funcId;
    });

    // turnos desta semana
    var estaSemana = [];
    for (var k=0;k<7;k++) {
      var d = new Date(seg); d.setDate(seg.getDate()+k);
      var dataStr = d.toISOString().split('T')[0];
      meusTurnos.forEach(function(t) {
        var ei = new Date(t.data_inicio).toISOString().split('T')[0];
        var ef = new Date(t.data_fim).toISOString().split('T')[0];
        if (dataStr >= ei && dataStr <= ef) {
          estaSemana.push({ dia: d, turno: t });
        }
      });
    }

    var html = '<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:var(--r);padding:14px;margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:700;color:var(--accent-dark);margin-bottom:10px;">📋 A minha escala esta semana</div>';
    if (!estaSemana.length) {
      html += '<div style="font-size:13px;color:var(--text-2);">Não tens turnos marcados esta semana.</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      estaSemana.forEach(function(item) {
        var t = item.turno;
        var ent = (t.hora_entrada||'').slice(0,5);
        var sai = (t.hora_saida||'').slice(0,5);
        var isHoje = item.dia.toDateString() === new Date().toDateString();
        html += '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--surface);border-radius:6px;' + (isHoje?'border:2px solid var(--accent);':'') + '">';
        html += '<div style="font-weight:700;font-size:12.5px;min-width:80px;color:var(--text);">' + nomesDia[item.dia.getDay()] + (isHoje?' (hoje)':'') + '</div>';
        html += '<div style="font-family:JetBrains Mono,monospace;font-size:13px;color:var(--accent-dark);font-weight:600;">' + ent + ' – ' + sai + '</div>';
        if (t.funcao) html += '<div style="font-size:12px;color:var(--text-3);">' + H(t.funcao) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ── SEMANA ────────────────────────────────────────────────
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

  function _fDataCurta(d) {
    var nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    return nomes[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1);
  }

  function _isHoje(d) {
    var h = new Date();
    return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
  }

  function _tipoCor(tipo) {
    var t = TIPOS_TURNO.filter(function(x) { return x.v === tipo; })[0];
    return t ? t.cor : '#3B82F6';
  }

  function _tipoLabel(tipo) {
    var t = TIPOS_TURNO.filter(function(x) { return x.v === tipo; })[0];
    return t ? t.l : tipo;
  }

  // ── RENDER ESCALA ─────────────────────────────────────────
  function _renderEscala(eqId) {
    var dias = _getWeekDates();
    var seg = dias[0], dom = dias[6];
    var labelSemana = fData(seg.toISOString()) + ' — ' + fData(dom.toISOString());

    // funcionários deste equipamento
    var funcs = APP.utilizadores.filter(function(u) {
      return funcNoEq(u, eqId) && !u.isDds;
    });

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="esc-nav-btn" onclick="Escalas.semanaAnterior()">‹</div>';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '<div class="esc-nav-btn" onclick="Escalas.semanaProxima()">›</div>';
    if (_weekOffset !== 0) html += '<button class="btn btn-ghost btn-sm" onclick="Escalas.semanaActual()" style="font-size:12px;">Hoje</button>';
    html += '</div>';
    if (APP.podeGerirEscalas(eqId)) {
      html += '<div style="display:flex;gap:6px;">';
      html += '<button class="btn btn-secondary btn-sm" onclick="Escalas.exportar(\'' + eqId + '\')">↓ Exportar</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="Escalas.openNovo(\'' + eqId + '\')">+ Novo turno</button>';
      html += '</div>';
    }
    html += '</div>';

    if (!funcs.length) {
      html += emptyState('Sem funcionários', 'Não existem funcionários afectos a este equipamento. Adicione funcionários em Configurações → Funcionários.');
      return html;
    }

    // GRID: linhas = funcionários, colunas = dias
    html += '<div class="sched-wrap"><div style="overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;min-width:600px;font-size:12px;">';

    // Header
    html += '<thead><tr><th style="padding:7px 10px;text-align:left;font-size:10.5px;font-weight:700;color:var(--text-3);text-transform:uppercase;background:var(--bg);border-bottom:1px solid var(--border);min-width:120px;">Funcionário</th>';
    dias.forEach(function(d) {
      html += '<th style="padding:7px 6px;text-align:center;font-size:10.5px;font-weight:700;color:' + (_isHoje(d) ? 'var(--accent)' : 'var(--text-3)') + ';background:' + (_isHoje(d) ? 'var(--accent-light)' : 'var(--bg)') + ';border-bottom:1px solid var(--border);">' + _fDataCurta(d) + '</th>';
    });
    html += '</tr></thead>';

    // Linhas por funcionário
    html += '<tbody>';
    funcs.forEach(function(func) {
      var pal = PERFIL_PALETTES[func.perfil] || ['#F1F5F9','#475569'];
      html += '<tr>';
      html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:middle;">';
      html += '<div style="display:flex;align-items:center;gap:7px;">';
      html += '<div style="width:26px;height:26px;border-radius:50%;background:' + pal[0] + ';color:' + pal[1] + ';font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + iniciais(func.nome) + '</div>';
      html += '<div><div style="font-weight:600;color:var(--text);font-size:12.5px;">' + H(func.nome) + '</div>';
      html += '<div style="font-size:10.5px;color:var(--text-3);">' + H((func.perfil || '').replace(/_/g,' ')) + '</div></div>';
      html += '</div></td>';

      dias.forEach(function(d) {
        var dataStr = d.toISOString().split('T')[0];
        // encontrar turno deste funcionário neste dia
        var turnos = (APP.escalas || []).filter(function(e) {
          if (e.funcionario_id !== func.id || e.equipamento_id !== eqId) return false;
          var ei = new Date(e.data_inicio).toISOString().split('T')[0];
          var ef = new Date(e.data_fim).toISOString().split('T')[0];
          return dataStr >= ei && dataStr <= ef;
        });

        html += '<td style="padding:3px 4px;border-bottom:1px solid var(--border);border-left:1px solid var(--border);text-align:center;vertical-align:middle;min-width:80px;">';

        if (turnos.length) {
          turnos.forEach(function(t) {
            var cor = t.cor || _tipoCor(t.tipo_turno);
            html += '<div style="background:' + cor + '22;color:' + cor + ';border:1px solid ' + cor + '44;border-radius:5px;padding:3px 5px;font-size:10.5px;font-weight:600;cursor:pointer;margin-bottom:2px;" onclick="Escalas.openEditar(\'' + t.id + '\')">';
            if (t.hora_entrada && t.hora_saida) {
              html += t.hora_entrada.slice(0,5) + '—' + t.hora_saida.slice(0,5);
            } else {
              html += _tipoLabel(t.tipo_turno);
            }
            html += '</div>';
          });
          // permitir adicionar mais um turno no mesmo dia (ex: manhã + tarde)
          html += '<div style="color:var(--border-2);font-size:14px;cursor:pointer;line-height:1;" title="Adicionar outro turno neste dia" onclick="Escalas.openNovoDia(\'' + eqId + '\',\'' + func.id + '\',\'' + dataStr + '\')">+</div>';
        } else {
          html += '<div style="color:var(--border-2);font-size:18px;cursor:pointer;" onclick="Escalas.openNovoDia(\'' + eqId + '\',\'' + func.id + '\',\'' + dataStr + '\')">+</div>';
        }

        html += '</td>';
      });

      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    // Legenda
    html += '<div class="sched-legend" style="margin-top:10px;">';
    TIPOS_TURNO.forEach(function(t) {
      html += '<div class="legend-item"><div class="legend-dot" style="background:' + t.cor + ';"></div>' + t.l + '</div>';
    });
    html += '</div>';

    return html;
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    html += '<div class="modal-bd" id="m-escala-novo">';
    html += '<div class="modal" style="max-width:520px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-amber"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="modal-title" id="m-esc-ttl">Novo turno</div><div class="modal-sub" id="m-esc-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-escala-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div id="m-esc-info" style="display:none;"></div>';

    html += '<div class="form-sec-t">Funcionário</div>';
    html += '<div class="fi"><label class="fl">Funcionário *</label><select id="esc-func" class="fin"><option value="">Seleccione...</option></select></div>';

    html += '<div class="form-sec-t">Turno</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Tipo de turno</label><select id="esc-tipo" class="fin" onchange="Escalas.onTipoChange()">';
    TIPOS_TURNO.forEach(function(t) {
      html += '<option value="' + t.v + '">' + t.l + '</option>';
    });
    html += '</select></div>';
    html += '<div class="fi"><label class="fl">Função</label><select id="esc-funcao" class="fin"><option value="">Seleccione...</option>';
    FUNCOES.forEach(function(f) { html += '<option value="' + f + '">' + f + '</option>'; });
    html += '</select></div></div>';

    html += '<div class="form-row"><div class="fi"><label class="fl">Data início *</label><input type="date" id="esc-di" class="fin"></div>';
    html += '<div class="fi"><label class="fl">Data fim *</label><input type="date" id="esc-df" class="fin"></div></div>';

    html += '<div id="esc-horas-wrap"><div class="form-row"><div class="fi"><label class="fl">Hora entrada</label><input type="time" id="esc-he" class="fin" value="09:00"></div>';
    html += '<div class="fi"><label class="fl">Hora saída</label><input type="time" id="esc-hs" class="fin" value="17:00"></div></div></div>';

    html += '<div class="fi"><label class="fl">Observações</label><textarea id="esc-obs" class="fin" rows="2" placeholder="Notas..."></textarea></div>';

    // ── Repetição (só ao criar) ──
    html += '<div id="esc-rep-wrap">';
    html += '<div class="form-sec-t">Repetir turno</div>';
    html += '<p style="font-size:12px;color:var(--text-3);margin:-2px 0 8px;line-height:1.5;">Para quem faz sempre o mesmo horário. Escolha os dias da semana e até quando — cria todos os turnos de uma vez.</p>';
    html += '<div class="fi"><label class="fl">Dias da semana</label>';
    html += '<div id="esc-dias" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;">';
    [['1','Seg'],['2','Ter'],['3','Qua'],['4','Qui'],['5','Sex'],['6','Sáb'],['0','Dom']].forEach(function(d) {
      html += '<label style="display:inline-flex;align-items:center;gap:4px;font-size:13px;border:1px solid var(--border);border-radius:6px;padding:5px 9px;cursor:pointer;">';
      html += '<input type="checkbox" class="esc-dia" value="' + d[0] + '" style="margin:0;">' + d[1] + '</label>';
    });
    html += '</div></div>';
    html += '<div class="fi"><label class="fl">Repetir até</label><input type="date" id="esc-ate" class="fin"></div>';
    html += '<p style="font-size:11.5px;color:var(--text-3);margin:4px 0 0;line-height:1.5;">Deixe em branco para criar apenas um turno.</p>';
    html += '</div>';

    html += '</div>';
    html += '<div class="modal-footer" id="m-esc-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-escala-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Escalas.salvar()">Guardar turno</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function semanaAnterior() { _weekOffset--; _rerender(); }
  function semanaProxima()  { _weekOffset++; _rerender(); }
  function semanaActual()   { _weekOffset = 0; _rerender(); }

  function _rerender() {
    var c = document.getElementById('main-content');
    if (c) c.innerHTML = render(APP.spotEqId);
  }

  function onTipoChange() {
    var tipo = document.getElementById('esc-tipo').value;
    var hw   = document.getElementById('esc-horas-wrap');
    // folga/feriado/férias não têm hora
    var semHoras = ['ferias','folga','feriado'];
    if (hw) hw.style.display = semHoras.indexOf(tipo) >= 0 ? 'none' : 'block';
  }

  // Mostra a origem do turno quando vem do Banco de Horas ou das Férias
  function _preencherInfoOrigem(e) {
    var box = document.getElementById('m-esc-info');
    if (!box) return;
    box.style.display = 'none';
    box.innerHTML = '';

    // ── Folga vinda do banco de horas ──
    if (e.tipo_turno === 'folga' && typeof Horas !== 'undefined' && Horas.registos) {
      var reg = Horas.registos().filter(function(r) {
        return r.tipo === 'gozada' && r.estado === 'aprovado' &&
               r.funcionario_id === e.funcionario_id && r.data === e.data_inicio;
      })[0];

      if (reg) {
        var quem = (APP.utilizadores || []).filter(function(u) { return u.id === reg.validado_chefe_por; })[0];
        var per  = (typeof Horas.labelPeriodo === 'function') ? Horas.labelPeriodo(reg) : '';
        var s    = Horas.saldoDe(reg.funcionario_id);

        var h = '<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:12px;margin-bottom:14px;">';
        h += '<div style="font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">⏱ Folga do banco de horas</div>';
        h += '<div style="font-size:13px;color:#78350F;line-height:1.7;">';
        h += '<div><strong>Horas gozadas:</strong> ' + Horas.fmtH(reg.horas) + (per ? ' · ' + H(per) : '') + '</div>';
        h += '<div><strong>Data:</strong> ' + _fdataBr(reg.data) + '</div>';
        if (reg.motivo) h += '<div><strong>Motivo:</strong> ' + H(reg.motivo) + '</div>';
        if (reg.data_valid_chefe) {
          h += '<div><strong>Autorizado em:</strong> ' + _fdataBr(reg.data_valid_chefe) + (quem ? ' por ' + H(quem.nome) : '') + '</div>';
        }
        h += '<div style="margin-top:4px;padding-top:6px;border-top:1px solid #FDE68A;"><strong>Saldo actual:</strong> ' + Horas.fmtH(s.saldo) + '</div>';
        h += '</div>';
        h += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">';
        h += '<button class="btn btn-secondary btn-sm" onclick="closeModal(\'m-escala-novo\');App.nav(\'horas\')">Abrir Banco de Horas</button>';
        h += '</div>';
        h += '<p style="font-size:11px;color:#92400E;margin:8px 0 0;line-height:1.5;">Este turno foi criado a partir de um pedido autorizado. Se o apagar aqui, o registo de horas mantém-se — corrija no Banco de Horas.</p>';
        h += '</div>';

        box.innerHTML = h;
        box.style.display = 'block';
        return;
      }
    }

    // ── Turno de férias ──
    if (e.tipo_turno === 'ferias') {
      var hf = '<div style="background:#DCFCE7;border:1px solid #BBF7D0;border-radius:10px;padding:12px;margin-bottom:14px;">';
      hf += '<div style="font-size:12px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">🏖 Férias aprovadas</div>';
      hf += '<div style="font-size:13px;color:#166534;line-height:1.7;">';
      hf += '<div><strong>Período:</strong> ' + _fdataBr(e.data_inicio) + (e.data_fim && e.data_fim !== e.data_inicio ? ' a ' + _fdataBr(e.data_fim) : '') + '</div>';
      hf += '</div>';
      hf += '<div style="margin-top:10px;"><button class="btn btn-secondary btn-sm" onclick="closeModal(\'m-escala-novo\');App.nav(\'ferias\')">Abrir Férias</button></div>';
      hf += '</div>';
      box.innerHTML = hf;
      box.style.display = 'block';
    }
  }

  function _fdataBr(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function _popularFuncSelect(eqId, selId) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccione o funcionário...</option>';
    var funcs = APP.utilizadores.filter(function(u) {
      return funcNoEq(u, eqId) && !u.isDds;
    });
    funcs.forEach(function(f) {
      var o = document.createElement('option');
      o.value = f.id; o.textContent = f.nome;
      sel.appendChild(o);
    });
  }

  function openNovo(eqId) {
    APP.editId = null;
    APP.actionRecord = { equipamento_id: eqId };
    var eq = getEq(eqId);
    document.getElementById('m-esc-ttl').textContent = 'Novo turno';
    document.getElementById('m-esc-eq').textContent  = eq ? eq.nome : '—';

    _popularFuncSelect(eqId, 'esc-func');
    document.getElementById('esc-tipo').value  = 'normal';
    document.getElementById('esc-obs').value   = '';
    var hoje = new Date().toISOString().split('T')[0];
    document.getElementById('esc-di').value = hoje;
    document.getElementById('esc-df').value = hoje;
    document.getElementById('esc-he').value = '09:00';
    document.getElementById('esc-hs').value = '17:00';
    onTipoChange();
    var infoBox = document.getElementById('m-esc-info');
    if (infoBox) { infoBox.style.display = 'none'; infoBox.innerHTML = ''; }

    // repetição: limpar e mostrar (só disponível ao criar)
    var repW = document.getElementById('esc-rep-wrap');
    if (repW) repW.style.display = 'block';
    var ateEl = document.getElementById('esc-ate'); if (ateEl) ateEl.value = '';
    document.querySelectorAll('.esc-dia').forEach(function(cb) { cb.checked = false; });

    var footer = document.getElementById('m-esc-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-ghost" onclick="closeModal(\'m-escala-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Escalas.salvar()">Guardar turno</button>';

    openModal('m-escala-novo');
  }

  function openNovoDia(eqId, funcId, data) {
    openNovo(eqId);
    setTimeout(function() {
      var sel = document.getElementById('esc-func');
      if (sel) sel.value = funcId;
      var di = document.getElementById('esc-di');
      var df = document.getElementById('esc-df');
      if (di) di.value = data;
      if (df) df.value = data;
    }, 50);
  }

  function openEditar(id) {
    var e = (APP.escalas || []).filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    APP.editId = id;
    APP.actionRecord = e;
    var eq = getEq(e.equipamento_id);
    document.getElementById('m-esc-ttl').textContent = 'Editar turno';
    document.getElementById('m-esc-eq').textContent  = eq ? eq.nome : '—';
    _preencherInfoOrigem(e);

    _popularFuncSelect(e.equipamento_id, 'esc-func');
    var set = function(eid, val) { var el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('esc-func',  e.funcionario_id);
    set('esc-tipo',  e.tipo_turno || 'normal');
    set('esc-funcao',e.funcao);
    set('esc-di',    e.data_inicio ? new Date(e.data_inicio).toISOString().split('T')[0] : '');
    set('esc-df',    e.data_fim    ? new Date(e.data_fim).toISOString().split('T')[0]    : '');
    set('esc-he',    e.hora_entrada ? e.hora_entrada.slice(0,5) : '');
    set('esc-hs',    e.hora_saida  ? e.hora_saida.slice(0,5)   : '');
    set('esc-obs',   e.observacoes);
    onTipoChange();

    // repetição não se aplica a edição de um turno existente
    var repW = document.getElementById('esc-rep-wrap');
    if (repW) repW.style.display = 'none';

    var footer = document.getElementById('m-esc-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-danger btn-sm" onclick="Escalas.apagar(\'' + id + '\')">Apagar</button><button class="btn btn-ghost" onclick="closeModal(\'m-escala-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Escalas.salvar()">Guardar alterações</button>';

    openModal('m-escala-novo');
  }

  function salvar() {
    var funcSel = document.getElementById('esc-func');
    var di      = document.getElementById('esc-di');
    var df      = document.getElementById('esc-df');
    if (!funcSel || !funcSel.value) { toast('Seleccione o funcionário.', 'error'); return; }
    if (!di || !di.value)           { toast('Data de início obrigatória.', 'error'); return; }
    if (!df || !df.value)           { toast('Data de fim obrigatória.', 'error'); return; }
    if (di.value > df.value)        { toast('O fim deve ser posterior ao início.', 'error'); return; }

    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var criadoPor = APP.user && APP.user.id && uuidRx.test(APP.user.id) ? APP.user.id : null;
    var tipo = document.getElementById('esc-tipo').value;
    var semHoras = ['ferias','folga','feriado'];
    var comHoras = semHoras.indexOf(tipo) < 0;

    var body = {
      equipamento_id: APP.actionRecord ? APP.actionRecord.equipamento_id : APP.spotEqId,
      funcionario_id: funcSel.value,
      tipo_turno:     tipo,
      funcao:         (document.getElementById('esc-funcao').value || '').trim() || null,
      data_inicio:    di.value,
      data_fim:       df.value,
      hora_entrada:   comHoras ? (document.getElementById('esc-he').value || null) : null,
      hora_saida:     comHoras ? (document.getElementById('esc-hs').value || null) : null,
      cor:            _tipoCor(tipo),
      observacoes:    (document.getElementById('esc-obs').value || '').trim(),
      criado_por:     criadoPor
    };

    // ── Repetição: cria um turno por cada dia escolhido até à data limite ──
    var ate = document.getElementById('esc-ate');
    var diasSel = [];
    document.querySelectorAll('.esc-dia').forEach(function(cb) {
      if (cb.checked) diasSel.push(parseInt(cb.value, 10));
    });

    if (!APP.editId && ate && ate.value && diasSel.length) {
      if (ate.value < di.value) { toast('A data de "Repetir até" deve ser posterior ao início.', 'error'); return; }

      var datas = [];
      var cur = new Date(di.value + 'T12:00:00');
      var lim = new Date(ate.value + 'T12:00:00');
      var guard = 0;
      while (cur <= lim && guard < 400) {
        if (diasSel.indexOf(cur.getDay()) >= 0) {
          datas.push(cur.getFullYear() + '-' + ('0' + (cur.getMonth() + 1)).slice(-2) + '-' + ('0' + cur.getDate()).slice(-2));
        }
        cur.setDate(cur.getDate() + 1);
        guard++;
      }

      if (!datas.length) { toast('Nenhum dia corresponde aos dias escolhidos.', 'error'); return; }

      var lote = datas.map(function(d) {
        var b = {};
        for (var k in body) b[k] = body[k];
        b.data_inicio = d;
        b.data_fim    = d;
        return b;
      });

      sbPost('escalas', lote).then(function() {
        toast(datas.length + ' turnos criados.', 'success');
        closeModal('m-escala-novo');
        _loadEscalas(function() { _rerender(); });
      }).catch(function(e) {
        console.error('Erro escala (lote):', e);
        toast('Erro ao criar os turnos.', 'error');
      });
      return;
    }

    var p = APP.editId
      ? sbPatch('escalas', 'id=eq.' + APP.editId, body)
      : sbPost('escalas', body);

    p.then(function() {
      toast(APP.editId ? 'Turno actualizado.' : 'Turno criado.', 'success');
      closeModal('m-escala-novo');
      _loadEscalas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro escala:', e);
      toast('Erro ao guardar turno.', 'error');
    });
  }

  function apagar(id) {
    if (!confirm('Apagar este turno?')) return;
    sbDelete('escalas', 'id=eq.' + id).then(function() {
      toast('Turno eliminado.', 'success');
      closeModal('m-escala-novo');
      _loadEscalas(function() { _rerender(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  function exportar(eqId) {
    // Exportar escala da semana como CSV simples
    var dias = _getWeekDates();
    var funcs = funcsDoEq(eqId);
    var linhas = ['Funcionário,Seg,Ter,Qua,Qui,Sex,Sáb,Dom'];
    funcs.forEach(function(func) {
      var row = [func.nome];
      dias.forEach(function(d) {
        var dataStr = d.toISOString().split('T')[0];
        var turno = (APP.escalas || []).filter(function(e) {
          if (e.funcionario_id !== func.id) return false;
          var ei = new Date(e.data_inicio).toISOString().split('T')[0];
          var ef = new Date(e.data_fim).toISOString().split('T')[0];
          return dataStr >= ei && dataStr <= ef;
        })[0];
        if (turno) {
          row.push(turno.hora_entrada ? turno.hora_entrada.slice(0,5) + '-' + turno.hora_saida.slice(0,5) : _tipoLabel(turno.tipo_turno));
        } else {
          row.push('—');
        }
      });
      linhas.push(row.join(','));
    });
    var csv = linhas.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'escala_' + dias[0].toISOString().split('T')[0] + '.csv';
    a.click(); URL.revokeObjectURL(url);
    toast('Escala exportada.', 'success');
  }

  // ── CARREGAR ESCALAS ──────────────────────────────────────
  function _loadEscalas(cb) {
    if (!APP.spotEqId) { if (cb) cb(); return; }
    var dias = _getWeekDates();
    var inicio = new Date(dias[0]); inicio.setDate(inicio.getDate() - 14);
    var fim    = new Date(dias[6]); fim.setDate(fim.getDate() + 14);
    sbGet('escalas', 'equipamento_id=eq.' + APP.spotEqId +
      '&data_inicio=gte.' + inicio.toISOString().split('T')[0] +
      '&data_fim=lte.' + fim.toISOString().split('T')[0] +
      '&order=data_inicio.asc')
    .then(function(data) {
      APP.escalas = Array.isArray(data) ? data : [];
      if (cb) cb();
    }).catch(function() {
      APP.escalas = [];
      if (cb) cb();
    });
  }

  function init() {
    APP.escalas = APP.escalas || [];
    var cont = document.getElementById('modais-escalas');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  function load(cb) { _loadEscalas(cb); }

  return {
    render: render, init: init, load: load,
    semanaAnterior: semanaAnterior, semanaProxima: semanaProxima, semanaActual: semanaActual,
    openNovo: openNovo, openNovoDia: openNovoDia, openEditar: openEditar,
    salvar: salvar, apagar: apagar, exportar: exportar, onTipoChange: onTipoChange
  };

})();

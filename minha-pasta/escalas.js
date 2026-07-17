// ============================================================
// GestDDS — escalas.js  v5.1
// Módulo de Escalas e Turnos por equipamento
// ============================================================

var Escalas = (function() {

  var _weekOffset = 0;

  // Data 'YYYY-MM-DD' em componentes LOCAIS. Nunca usar toISOString() para
  // comparar dias: converte para UTC e, em Portugal (UTC+1 no verão), a
  // meia-noite local de dia 13 vira '2026-07-12', desalinhando a grelha.
  function _ymdLocal(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
  }

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
    var alvo = eqDoModulo('escalas', eqId || APP.spotEqId);
    if (!alvo) return semEqParaModulo('Escalas');
    if (APP.spotEqId !== alvo) APP.spotEqId = alvo;
    var eq = getEq(alvo);
    if (!eq) return semEqParaModulo('Escalas');

    var tipo = getTipo(eq.tipo_id);

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Escalas — ' + H(eq.nome) + '</div>';
    html += eqSwitcher('escalas', eq.id) + '</div>';
    if (!APP.podeGerirEscalas(eq.id)) {
      html += '<span style="font-size:12px;color:var(--text-3);padding:6px 10px;background:var(--bg);border-radius:6px;">👁 Apenas consulta</span>';
    }
    html += '</div>';

    // ── DIAGNÓSTICO TEMPORÁRIO (v...r) — remover depois ──
    (function() {
      var todas = (APP.escalas || []);
      var doEq  = todas.filter(function(e){ return e.equipamento_id === eq.id; });
      var ex    = doEq[0];
      html += '<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px;margin:8px 0;font-size:11px;font-family:monospace;color:#92400E;line-height:1.6;">';
      html += '<b>DIAGNÓSTICO</b><br>';
      html += 'eq.id (CEAVM) = ' + eq.id + '<br>';
      html += 'spotEqId = ' + APP.spotEqId + '<br>';
      html += 'escalas em memória (total) = ' + todas.length + '<br>';
      html += 'escalas deste equipamento = ' + doEq.length + '<br>';
      if (ex) {
        html += 'exemplo: data_inicio=' + JSON.stringify(ex.data_inicio) +
                ' func=' + ex.funcionario_id + '<br>';
        html += 'eq do exemplo === eq.id ? ' + (ex.equipamento_id === eq.id) + '<br>';
      } else {
        html += 'nenhum turno deste equipamento em memória<br>';
      }
      // os funcionários que a grelha desenha
      var funcs = (APP.utilizadores || []).filter(function(u){ return funcNoEq(u, eq.id) && !u.isDds; });
      html += 'funcionários na grelha = ' + funcs.map(function(f){ return f.id.slice(0,8); }).join(', ') + '<br>';
      if (ex) html += 'func do exemplo está na grelha? ' + funcs.some(function(f){ return f.id === ex.funcionario_id; });
      html += '</div>';
    })();

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
      var dataStr = _ymdLocal(d);
      meusTurnos.forEach(function(t) {
        var ei = String(t.data_inicio).slice(0, 10);
        var ef = String(t.data_fim || t.data_inicio).slice(0, 10);
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
      html += ' <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Escalas.openSerie(\'' + eqId + '\')">Limpar turnos…</button>';
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
        var dataStr = _ymdLocal(d);
        // encontrar turno deste funcionário neste dia
        var turnos = (APP.escalas || []).filter(function(e) {
          if (e.funcionario_id !== func.id || e.equipamento_id !== eqId) return false;
          // as datas vêm do Supabase como 'YYYY-MM-DD' — comparar os 10 primeiros
          // caracteres directamente evita o desvio de fuso do toISOString()
          var ei = String(e.data_inicio).slice(0, 10);
          var ef = String(e.data_fim || e.data_inicio).slice(0, 10);
          return dataStr >= ei && dataStr <= ef;
        });

        html += '<td style="padding:3px 4px;border-bottom:1px solid var(--border);border-left:1px solid var(--border);text-align:center;vertical-align:middle;min-width:80px;">';

        var podeGerir = APP.podeGerirEscalas(eqId);

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
          // adicionar outro turno no mesmo dia (ex: manhã + tarde) — só quem gere
          if (podeGerir) {
            html += '<div style="color:var(--border-2);font-size:14px;cursor:pointer;line-height:1;" title="Adicionar outro turno neste dia" onclick="Escalas.openNovoDia(\'' + eqId + '\',\'' + func.id + '\',\'' + dataStr + '\')">+</div>';
          }
        } else if (podeGerir) {
          html += '<div style="color:var(--border-2);font-size:18px;cursor:pointer;" onclick="Escalas.openNovoDia(\'' + eqId + '\',\'' + func.id + '\',\'' + dataStr + '\')">+</div>';
        } else {
          html += '<div style="color:var(--border-2);font-size:12px;">—</div>';
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

    // todo o formulário — escondido nas folgas/férias (só se consulta)
    html += '<div id="esc-form">';
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

    html += '<div id="esc-horas-wrap">';
    html += '<div class="fi"><label class="fl">Horário</label><select id="esc-horario" class="fin" onchange="Escalas.onHorarioChange()">';
    html += '<option value="partido">Horário partido — 09:00–12:30 e 14:00–17:30</option>';
    html += '<option value="manha">Só manhã — 09:00–12:30</option>';
    html += '<option value="tarde">Só tarde — 14:00–17:30</option>';
    html += '<option value="custom">Personalizado…</option>';
    html += '</select>';
    html += '<p id="esc-horario-help" style="font-size:11.5px;color:var(--text-3);margin:4px 0 0;line-height:1.4;">Cria dois turnos por dia: manhã e tarde.</p>';
    html += '</div>';
    html += '<div class="form-row" id="esc-horas-custom" style="display:none;"><div class="fi"><label class="fl">Hora entrada</label><input type="time" id="esc-he" class="fin" value="09:00"></div>';
    html += '<div class="fi"><label class="fl">Hora saída</label><input type="time" id="esc-hs" class="fin" value="17:00"></div></div>';
    html += '</div>';

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

    html += '</div>';   // fecha #esc-form
    html += '</div>';   // fecha .modal-body
    html += '<div class="modal-footer" id="m-esc-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-escala-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Escalas.salvar()">Guardar turno</button></div>';
    html += '</div></div>';

    html += _modalSerie();

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function semanaAnterior() { _weekOffset--; _recarregarSemana(); }
  function semanaProxima()  { _weekOffset++; _recarregarSemana(); }
  function semanaActual()   { _weekOffset = 0; _recarregarSemana(); }

  // Ao mudar de semana podemos sair da janela de ±14 dias já carregada,
  // por isso vamos buscar os turnos da nova semana antes de redesenhar.
  function _recarregarSemana() {
    _loadEscalas(function() { _rerender(); });
  }

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
        h += '<div><strong>Funcionário:</strong> ' + H(_nomeFunc(reg.funcionario_id)) + '</div>';
        h += '<div><strong>Horas gozadas:</strong> ' + Horas.fmtH(reg.horas) + (per ? ' · ' + H(per) : '') + '</div>';
        h += '<div><strong>Data:</strong> ' + _fdataBr(reg.data) + '</div>';
        if (reg.motivo) h += '<div><strong>Motivo:</strong> ' + H(reg.motivo) + '</div>';
        if (reg.data_valid_chefe) {
          h += '<div><strong>Autorizado em:</strong> ' + _fdataBr(reg.data_valid_chefe) + (quem ? ' por ' + H(quem.nome) : '') + '</div>';
        }
        h += '<div style="margin-top:4px;padding-top:6px;border-top:1px solid #FDE68A;"><strong>Saldo actual:</strong> ' + Horas.fmtH(s.saldo) + '</div>';
        h += '</div>';
        h += '<p style="font-size:11.5px;color:#92400E;margin:10px 0 0;line-height:1.5;">Esta folga resulta de um pedido autorizado, por isso <strong>não pode ser alterada aqui</strong>. Para a corrigir, peça a alteração no Banco de Horas — segue o mesmo circuito de autorização.</p>';
        h += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">';
        h += '<button class="btn btn-secondary btn-sm" onclick="closeModal(\'m-escala-novo\');App.nav(\'horas\')">Abrir Banco de Horas</button>';
        // o admin pode anular a folga (apaga o turno E o registo de horas)
        if (APP.user && APP.user.perfil === 'admin') {
          h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Escalas.anularFolga(\'' + e.id + '\',\'' + reg.id + '\')">Anular folga</button>';
        }
        h += '</div>';
        h += '</div>';

        box.innerHTML = h;
        box.style.display = 'block';
        return;
      }

      // ── Folga ÓRFÃ: o pedido já não existe no banco de horas ──
      var ho = '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px;margin-bottom:14px;">';
      ho += '<div style="font-size:12px;font-weight:700;color:#B91C1C;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">⚠️ Folga sem pedido associado</div>';
      ho += '<div style="font-size:13px;color:#7F1D1D;line-height:1.6;">';
      ho += 'Este turno de folga já não tem um pedido correspondente no banco de horas — o registo terá sido apagado.';
      ho += '</div>';
      ho += '<p style="font-size:11.5px;color:#B91C1C;margin:8px 0 0;line-height:1.5;">Pode apagá-lo em segurança com o botão <strong>Apagar turno</strong>, em baixo. Não afecta o saldo de horas.</p>';
      ho += '</div>';
      box.innerHTML = ho;
      box.style.display = 'block';
      return;
    }

    // ── Turno de férias ──
    if (e.tipo_turno === 'ferias') {
      var hf = '<div style="background:#DCFCE7;border:1px solid #BBF7D0;border-radius:10px;padding:12px;margin-bottom:14px;">';
      hf += '<div style="font-size:12px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">🏖 Férias aprovadas</div>';
      hf += '<div style="font-size:13px;color:#166534;line-height:1.7;">';
      hf += '<div><strong>Período:</strong> ' + _fdataBr(e.data_inicio) + (e.data_fim && e.data_fim !== e.data_inicio ? ' a ' + _fdataBr(e.data_fim) : '') + '</div>';
      hf += '</div>';
      hf += '<div style="margin-top:10px;"><button class="btn btn-secondary btn-sm" onclick="closeModal(\'m-escala-novo\');App.nav(\'ferias\')">Abrir Férias</button></div>';
      hf += '<p style="font-size:11.5px;color:#15803D;margin:8px 0 0;line-height:1.5;">Férias aprovadas — para alterar, use o menu Férias.</p>';
      hf += '</div>';
      box.innerHTML = hf;
      box.style.display = 'block';
    }
  }

  // Bloqueia (ou repõe) os campos de edição do turno.
  // turnoId: se vier preenchido e o utilizador puder gerir a escala,
  // mantém o botão de apagar no rodapé (para folgas órfãs, férias, etc.)
  function _bloquearEdicao(bloquear, turnoId, podeApagar) {
    ['esc-func','esc-tipo','esc-di','esc-df','esc-he','esc-hs','esc-funcao','esc-obs','esc-horario'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !!bloquear;
    });

    var rep = document.getElementById('esc-rep-wrap');
    if (rep && bloquear) rep.style.display = 'none';

    var footer = document.getElementById('m-esc-footer');
    if (footer && bloquear) {
      var h = '';
      if (podeApagar && turnoId) {
        h += '<button class="btn btn-danger btn-sm" onclick="Escalas.apagarTurnoBloqueado(\'' + turnoId + '\')">Apagar turno</button>';
      }
      h += '<button class="btn btn-primary" onclick="closeModal(\'m-escala-novo\')">Fechar</button>';
      footer.innerHTML = h;
    }
  }

  // Esconde (ou repõe) o formulário de edição.
  // Nas folgas e férias não faz sentido mostrar campos — só a informação.
  function _mostrarFormulario(mostrar) {
    var f = document.getElementById('esc-form');
    if (f) f.style.display = mostrar ? '' : 'none';
  }

  // apagar um turno que está em modo consulta (folga/férias).
  // Se houver um pedido de banco de horas associado, avisa e apaga os dois.
  function apagarTurnoBloqueado(id) {
    var t = (APP.escalas || []).filter(function(x) { return x.id === id; })[0];
    if (!t) return;
    if (!APP.podeGerirEscalas(t.equipamento_id)) {
      toast('Não tem permissão para apagar turnos.', 'error');
      return;
    }

    // procurar o pedido de banco de horas correspondente
    var reg = null;
    if (t.tipo_turno === 'folga' && typeof Horas !== 'undefined' && Horas.registos) {
      reg = Horas.registos().filter(function(r) {
        return r.tipo === 'gozada' && r.funcionario_id === t.funcionario_id && r.data === t.data_inicio;
      })[0];
    }

    var msg = reg
      ? 'Apagar esta folga?\n\nO turno sai da escala e o pedido é apagado do banco de horas. As horas voltam ao saldo do funcionário.'
      : 'Apagar este turno da escala?';
    if (!confirm(msg)) return;

    sbDelete('escalas', 'id=eq.' + id).then(function() {
      if (reg) {
        return sbDelete('banco_horas', 'id=eq.' + reg.id).catch(function(e) {
          console.error('Registo de horas não apagado:', e);
        });
      }
    }).then(function() {
      APP.escalas = (APP.escalas || []).filter(function(x) { return x.id !== id; });
      toast(reg ? 'Folga apagada. As horas voltaram ao saldo.' : 'Turno apagado.', 'success');
      closeModal('m-escala-novo');
      if (reg && typeof Horas !== 'undefined' && Horas.load) {
        Horas.load(function() { _rerender(); });
      } else {
        _rerender();
      }
    }).catch(function(e) {
      console.error('Erro ao apagar:', e);
      var m = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao apagar: ' + (m || 'desconhecido'), 'error');
    });
  }

  function _nomeFunc(id) {
    var u = (APP.utilizadores || []).filter(function(x) { return x.id === id; })[0];
    return u ? u.nome : '—';
  }

  function _fdataBr(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  // horários padrão da DDS
  var HORARIOS = {
    partido: [{ he: '09:00', hs: '12:30' }, { he: '14:00', hs: '17:30' }],
    manha:   [{ he: '09:00', hs: '12:30' }],
    tarde:   [{ he: '14:00', hs: '17:30' }]
  };

  function onHorarioChange() {
    var sel = document.getElementById('esc-horario');
    var cw  = document.getElementById('esc-horas-custom');
    var hp  = document.getElementById('esc-horario-help');
    if (!sel) return;
    var v = sel.value;

    if (cw) cw.style.display = (v === 'custom') ? 'flex' : 'none';

    if (hp) {
      hp.textContent = v === 'partido' ? 'Cria dois turnos por dia: manhã e tarde.'
                     : v === 'manha'   ? 'Um turno de manhã.'
                     : v === 'tarde'   ? 'Um turno de tarde.'
                     : 'Indique as horas de entrada e saída.';
    }
  }

  // Admin: anular uma folga — apaga o turno da escala E o registo no banco de horas
  function anularFolga(turnoId, regId) {
    if (!APP.user || APP.user.perfil !== 'admin') {
      toast('Apenas o administrador pode anular folgas.', 'error');
      return;
    }
    if (!confirm('Anular esta folga?\n\nO turno é retirado da escala e o registo é apagado do banco de horas. As horas voltam ao saldo do funcionário.')) return;

    sbDelete('escalas', 'id=eq.' + turnoId).then(function() {
      if (regId && regId !== 'null') {
        return sbDelete('banco_horas', 'id=eq.' + regId).catch(function(e) {
          console.error('Registo de horas não apagado:', e);
        });
      }
    }).then(function() {
      APP.escalas = (APP.escalas || []).filter(function(x) { return x.id !== turnoId; });
      toast('Folga anulada. As horas voltaram ao saldo.', 'success');
      closeModal('m-escala-novo');
      if (typeof Horas !== 'undefined' && Horas.load) {
        Horas.load(function() { _rerender(); });
      } else {
        _rerender();
      }
    }).catch(function(e) {
      console.error('Erro ao anular folga:', e);
      var msg = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao anular: ' + (msg || 'desconhecido'), 'error');
    });
  }

  // ── Apagar turnos em série (quando uma repetição correu mal) ──
  function _modalSerie() {
    var h = '<div class="modal-bd" id="m-escala-serie">';
    h += '<div class="modal" style="max-width:460px;">';
    h += '<div class="modal-header"><div class="mh-ic" style="background:var(--red-bg);color:var(--red);"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></div>';
    h += '<div><div class="modal-title">Limpar turnos</div><div class="modal-sub" id="m-serie-eq">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-escala-serie\')">✕</button></div>';
    h += '<div class="modal-body">';
    h += '<p style="font-size:12.5px;color:var(--text-2);line-height:1.6;margin:0 0 12px;">Apaga de uma vez todos os turnos de um funcionário num intervalo. Útil quando uma repetição correu mal.</p>';
    h += '<div class="fi"><label class="fl">Funcionário *</label><select id="serie-func" class="fin" onchange="Escalas.contarSerie()"></select></div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">De *</label><input type="date" id="serie-de" class="fin" onchange="Escalas.contarSerie()"></div>';
    h += '<div class="fi"><label class="fl">Até *</label><input type="date" id="serie-ate" class="fin" onchange="Escalas.contarSerie()"></div>';
    h += '</div>';
    h += '<div id="serie-aviso" style="background:var(--red-bg);border-radius:8px;padding:10px 12px;font-size:12.5px;color:var(--red);line-height:1.6;">Escolha o funcionário e o intervalo.</div>';
    h += '<p style="font-size:11.5px;color:var(--text-3);margin:10px 0 0;line-height:1.5;">Folgas e férias <strong>não</strong> são apagadas — essas geram-se nos módulos respectivos.</p>';
    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-escala-serie\')">Cancelar</button>';
    h += '<button class="btn btn-danger" onclick="Escalas.execSerie()">Apagar turnos</button></div>';
    h += '</div></div>';
    return h;
  }

  function openSerie(eqId) {
    if (!APP.podeGerirEscalas(eqId)) { toast('Não tem permissão.', 'error'); return; }
    APP.serieEqId = eqId;
    var eq = getEq(eqId);

    var sub = document.getElementById('m-serie-eq');
    if (sub) sub.textContent = eq ? eq.nome : '—';

    _popularFuncSelect(eqId, 'serie-func');

    var hoje = new Date().toISOString().split('T')[0];
    var fim = new Date(); fim.setMonth(fim.getMonth() + 1);
    var de = document.getElementById('serie-de');
    var ate = document.getElementById('serie-ate');
    if (de) de.value = hoje;
    if (ate) ate.value = fim.toISOString().split('T')[0];

    _contarSerie();
    openModal('m-escala-serie');
  }

  function _contarSerie() {
    var box = document.getElementById('serie-aviso');
    if (!box) return;
    var f  = (document.getElementById('serie-func') || {}).value;
    var de = (document.getElementById('serie-de') || {}).value;
    var at = (document.getElementById('serie-ate') || {}).value;
    if (!f || !de || !at) { box.textContent = 'Escolha o funcionário e o intervalo.'; return; }

    var n = (APP.escalas || []).filter(function(t) {
      return t.equipamento_id === APP.serieEqId && t.funcionario_id === f &&
             t.data_inicio >= de && t.data_inicio <= at &&
             t.tipo_turno !== 'folga' && t.tipo_turno !== 'ferias';
    }).length;

    box.innerHTML = n
      ? 'Vai apagar <strong>' + n + ' turno(s)</strong>. Esta acção não pode ser desfeita.'
      : 'Não há turnos neste intervalo.';
  }

  function execSerie() {
    var f  = (document.getElementById('serie-func') || {}).value;
    var de = (document.getElementById('serie-de') || {}).value;
    var at = (document.getElementById('serie-ate') || {}).value;
    if (!f)  { toast('Escolha o funcionário.', 'error'); return; }
    if (!de || !at) { toast('Indique o intervalo.', 'error'); return; }
    if (at < de) { toast('A data final não pode ser anterior à inicial.', 'error'); return; }
    apagarSerie(APP.serieEqId, f, de, at);
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
    if (!APP.podeGerirEscalas(eqId)) {
      toast('Não tem permissão para criar turnos. A escala é gerida pelo responsável do equipamento.', 'error');
      return;
    }
    _bloquearEdicao(false);
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
    var hSel = document.getElementById('esc-horario');
    if (hSel) hSel.value = 'partido';
    var he = document.getElementById('esc-he'); if (he) he.value = '09:00';
    var hs = document.getElementById('esc-hs'); if (hs) hs.value = '17:00';
    onTipoChange();
    onHorarioChange();
    var infoBox = document.getElementById('m-esc-info');
    if (infoBox) { infoBox.style.display = 'none'; infoBox.innerHTML = ''; }
    _mostrarFormulario(true);
    _bloquearEdicao(false);

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
    document.getElementById('m-esc-ttl').textContent = APP.podeGerirEscalas(e.equipamento_id) ? 'Editar turno' : 'Detalhe do turno';
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
    var hSelE = document.getElementById('esc-horario');
    if (hSelE) hSelE.value = 'custom';   // ao editar mostra as horas reais
    onHorarioChange();
    set('esc-obs',   e.observacoes);
    onTipoChange();

    // repetição não se aplica a edição de um turno existente
    var repW = document.getElementById('esc-rep-wrap');
    if (repW) repW.style.display = 'none';

    var footer = document.getElementById('m-esc-footer');
    if (footer) footer.innerHTML = '<button class="btn btn-danger btn-sm" onclick="Escalas.apagar(\'' + id + '\')">Apagar</button><button class="btn btn-ghost" onclick="closeModal(\'m-escala-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Escalas.salvar()">Guardar alterações</button>';

    // Bloqueio (depois do rodapé, para o substituir):
    // — quem não gere escalas só consulta
    // — folgas/férias são geridas nos respectivos módulos, mas quem gere
    //   a escala mantém o botão de apagar (para corrigir turnos órfãos)
    var podeGerir  = APP.podeGerirEscalas(e.equipamento_id);
    var eFolgaOuFerias = (e.tipo_turno === 'folga' || e.tipo_turno === 'ferias');
    var soConsulta = !podeGerir || eFolgaOuFerias;

    // nas folgas e férias esconde-se o formulário: só interessa a informação
    _mostrarFormulario(!eFolgaOuFerias);

    if (soConsulta) _bloquearEdicao(true, id, podeGerir);

    openModal('m-escala-novo');
  }

  function salvar() {
    var eqId = APP.actionRecord ? APP.actionRecord.equipamento_id : APP.spotEqId;
    if (eqId && !APP.podeGerirEscalas(eqId)) {
      toast('Não tem permissão para alterar a escala.', 'error');
      return;
    }
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

    // ── blocos horários (partido cria 2 turnos por dia) ──
    var blocos = [{ he: null, hs: null }];
    if (comHoras) {
      var hSel = (document.getElementById('esc-horario') || {}).value || 'partido';
      if (hSel === 'custom') {
        blocos = [{
          he: (document.getElementById('esc-he') || {}).value || null,
          hs: (document.getElementById('esc-hs') || {}).value || null
        }];
      } else {
        blocos = HORARIOS[hSel] || HORARIOS.partido;
      }
    }

    var base = {
      equipamento_id: APP.actionRecord ? APP.actionRecord.equipamento_id : APP.spotEqId,
      funcionario_id: funcSel.value,
      tipo_turno:     tipo,
      funcao:         (document.getElementById('esc-funcao').value || '').trim() || null,
      cor:            _tipoCor(tipo),
      observacoes:    (document.getElementById('esc-obs').value || '').trim(),
      criado_por:     criadoPor
    };

    // ── Repetição: um turno por cada dia escolhido até à data limite ──
    var ate = document.getElementById('esc-ate');
    var diasSel = [];
    document.querySelectorAll('.esc-dia').forEach(function(cb) {
      if (cb.checked) diasSel.push(parseInt(cb.value, 10));
    });

    // datas a criar
    var datas = [];
    if (!APP.editId && ate && ate.value && diasSel.length) {
      if (ate.value < di.value) { toast('A data de "Repetir até" deve ser posterior ao início.', 'error'); return; }
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
    }

    // ── EDIÇÃO: actualiza só o turno em causa ──
    if (APP.editId) {
      var upd = {};
      for (var k in base) upd[k] = base[k];
      upd.data_inicio  = di.value;
      upd.data_fim     = df.value;
      upd.hora_entrada = blocos[0].he;
      upd.hora_saida   = blocos[0].hs;
      sbPatch('escalas', 'id=eq.' + APP.editId, upd).then(function() {
        toast('Turno actualizado.', 'success');
        closeModal('m-escala-novo');
        _loadEscalas(function() { _rerender(); });
      }).catch(function(e) {
        console.error('Erro escala:', e);
        toast('Erro ao guardar turno.', 'error');
      });
      return;
    }

    // ── CRIAÇÃO: datas × blocos horários ──
    var lote = [];
    var listaDatas = datas.length ? datas : [di.value];

    // Se indicou uma Data fim posterior SEM escolher dias da semana,
    // expandimos dia a dia (senão o turno aparecia em todos os dias do
    // intervalo, fins-de-semana incluídos).
    if (!datas.length && df.value && df.value > di.value) {
      listaDatas = [];
      var c2 = new Date(di.value + 'T12:00:00');
      var l2 = new Date(df.value + 'T12:00:00');
      var g2 = 0;
      while (c2 <= l2 && g2 < 400) {
        listaDatas.push(c2.getFullYear() + '-' + ('0' + (c2.getMonth() + 1)).slice(-2) + '-' + ('0' + c2.getDate()).slice(-2));
        c2.setDate(c2.getDate() + 1);
        g2++;
      }
    }

    listaDatas.forEach(function(d) {
      blocos.forEach(function(b) {
        var t = {};
        for (var k2 in base) t[k2] = base[k2];
        t.data_inicio  = d;
        t.data_fim     = d;   // cada turno é de UM dia
        t.hora_entrada = b.he;
        t.hora_saida   = b.hs;
        lote.push(t);
      });
    });

    sbPost('escalas', lote).then(function() {
      toast(lote.length > 1 ? (lote.length + ' turnos criados.') : 'Turno criado.', 'success');
      closeModal('m-escala-novo');
      _loadEscalas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro escala:', e);
      toast('Erro ao guardar turno.', 'error');
    });
  }

  function apagar(id) {
    var t = (APP.escalas || []).filter(function(x) { return x.id === id; })[0];
    if (t && !APP.podeGerirEscalas(t.equipamento_id)) {
      toast('Não tem permissão para apagar turnos.', 'error');
      return;
    }
    if (!confirm('Apagar este turno?')) return;

    sbDelete('escalas', 'id=eq.' + id).then(function() {
      // tirar já da memória, para desaparecer do ecrã
      APP.escalas = (APP.escalas || []).filter(function(x) { return x.id !== id; });
      toast('Turno eliminado.', 'success');
      closeModal('m-escala-novo');
      _loadEscalas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro ao apagar turno:', e);
      var m = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao apagar: ' + (m || 'desconhecido'), 'error');
    });
  }

  // Apagar TODOS os turnos de um funcionário num intervalo — útil quando
  // uma repetição correu mal e são dezenas de turnos.
  function apagarSerie(eqId, funcId, de, ate) {
    if (!APP.podeGerirEscalas(eqId)) {
      toast('Não tem permissão.', 'error');
      return;
    }
    var alvo = (APP.escalas || []).filter(function(t) {
      return t.equipamento_id === eqId && t.funcionario_id === funcId &&
             t.data_inicio >= de && t.data_inicio <= ate &&
             t.tipo_turno !== 'folga' && t.tipo_turno !== 'ferias';
    });
    if (!alvo.length) { toast('Não há turnos nesse intervalo.', 'error'); return; }

    var u = (APP.utilizadores || []).filter(function(x){ return x.id === funcId; })[0];
    if (!confirm('Apagar ' + alvo.length + ' turno(s) de ' + (u ? u.nome : 'este funcionário') + '?\n\n(Folgas e férias não são afectadas.)')) return;

    sbDelete('escalas',
      'equipamento_id=eq.' + eqId +
      '&funcionario_id=eq.' + funcId +
      '&data_inicio=gte.' + de +
      '&data_inicio=lte.' + ate +
      '&tipo_turno=neq.folga' +
      '&tipo_turno=neq.ferias'
    ).then(function() {
      var ids = alvo.map(function(t){ return t.id; });
      APP.escalas = (APP.escalas || []).filter(function(t){ return ids.indexOf(t.id) < 0; });
      toast(alvo.length + ' turno(s) eliminados.', 'success');
      closeModal('m-escala-serie');
      _loadEscalas(function() { _rerender(); });
    }).catch(function(e) {
      console.error('Erro ao apagar série:', e);
      var m = [e && e.code, e && e.message].filter(Boolean).join(' · ');
      toast('Erro ao apagar: ' + (m || 'desconhecido'), 'error');
    });
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
    var di = inicio.toISOString().split('T')[0];
    var dfim = fim.toISOString().split('T')[0];

    sbGet('escalas', 'equipamento_id=eq.' + APP.spotEqId +
      '&data_inicio=gte.' + di +
      '&data_fim=lte.' + dfim +
      '&order=data_inicio.asc')
    .then(function(data) {
      var novos = Array.isArray(data) ? data : [];
      // registar o que já foi carregado (equipamento + janela + semana)
      APP._escCarregado = APP.spotEqId + '|' + di + '|' + dfim;

      // Fundir com o que já está em memória, MAS descartando os turnos
      // deste equipamento dentro desta janela — assim os que foram
      // apagados no servidor desaparecem de facto.
      var base = (APP.escalas || []).filter(function(e) {
        var mesmaJanela = e.equipamento_id === APP.spotEqId &&
                          e.data_inicio >= di && e.data_inicio <= dfim;
        return !mesmaJanela;
      });

      APP.escalas = base.concat(novos);
      if (cb) cb();
    }).catch(function(e) {
      console.error('Erro ao carregar escalas:', e);
      if (cb) cb();
    });
  }

  function init() {
    APP.escalas = APP.escalas || [];
    var cont = document.getElementById('modais-escalas');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  function load(cb) {
    // Resolver o MESMO equipamento que o render vai mostrar ANTES de carregar.
    // Sem isto, o load usava um spotEqId ainda não acertado (o último visto) e
    // trazia as escalas do equipamento errado — a grelha aparecia vazia.
    var alvo = (typeof eqDoModulo === 'function') ? eqDoModulo('escalas', APP.spotEqId) : APP.spotEqId;
    if (alvo && APP.spotEqId !== alvo) APP.spotEqId = alvo;
    _loadEscalas(cb);
  }

  return {
    render: render, init: init, load: load,
    semanaAnterior: semanaAnterior, semanaProxima: semanaProxima, semanaActual: semanaActual,
    openNovo: openNovo, openNovoDia: openNovoDia, openEditar: openEditar,
    salvar: salvar, apagar: apagar, exportar: exportar, onTipoChange: onTipoChange,
    onHorarioChange: onHorarioChange, anularFolga: anularFolga,
    apagarTurnoBloqueado: apagarTurnoBloqueado,
    openSerie: openSerie, execSerie: execSerie, contarSerie: _contarSerie
  };

})();

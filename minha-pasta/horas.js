// ============================================================
// GestDDS — horas.js  v1.0
// Banco de Horas — horas extraordinárias efectuadas e gozadas
//
// FLUXO DE VALIDAÇÃO (dois níveis):
//   1. Funcionário regista            → estado 'pendente'
//   2. Responsável do equipamento     → estado 'validado_resp'  (notifica chefe)
//   3. Chefe da unidade do funcionário→ estado 'aprovado'       (conta no saldo)
//   Rejeição em qualquer fase         → estado 'rejeitado'
//
// Só as horas APROVADAS contam para o saldo.
// Saldo = Σ efectuadas aprovadas − Σ gozadas aprovadas
// ============================================================

var Horas = (function() {

  var _registos = [];

  var ESTADOS = {
    pendente:      { l: 'Aguarda responsável',   c: '#D97706', bg: '#FEF3C7' },
    validado_resp: { l: 'Aguarda chefe unidade',  c: '#2563EB', bg: '#DBEAFE' },
    aprovado:      { l: 'Autorizado',            c: '#15803D', bg: '#DCFCE7' },
    rejeitado:     { l: 'Recusado',              c: '#B91C1C', bg: '#FEE2E2' }
  };

  // ── PERMISSÕES ────────────────────────────────────────────
  function _isAdmin()  { return APP.user && APP.user.perfil === 'admin'; }
  function _isDdsTop() { return _isAdmin() || (APP.user && APP.user.perfil === 'responsavel_dds'); }

  // unidade de um Chefe de Unidade
  function _unidadeChefe() {
    if (!APP.user) return null;
    if (APP.user.perfil === 'supervisor_udaj') return 'UDAJ';
    if (APP.user.perfil === 'supervisor_uase') return 'UASE';
    return null;
  }
  function _ehChefe() { return !!_unidadeChefe() || _isDdsTop(); }

  // é responsável por algum equipamento?
  function _ehResponsavel() {
    return APP.user && ['responsavel', 'professor_responsavel'].indexOf(APP.user.perfil) >= 0;
  }

  // equipamentos de que o utilizador actual é responsável
  function _meusEquipamentos() {
    if (!APP.user) return [];
    return (APP.equipamentos || []).filter(function(e) {
      return e.responsavel_id === APP.user.id || APP.user.equipamento_id === e.id;
    }).map(function(e) { return e.id; });
  }

  // ── CADEIA DE AUTORIZAÇÃO ─────────────────────────────────
  // 1º Responsável do(s) equipamento(s) onde o funcionário trabalha
  // 2º Chefe da unidade do funcionário (só depois do responsável)
  // O ADMIN não autoriza — supervisiona, é notificado e pode apagar.

  // responsáveis dos equipamentos onde o funcionário trabalha
  function _responsaveisDe(func) {
    if (!func) return [];
    var eqs = (typeof eqsDoFunc === 'function') ? eqsDoFunc(func) : (func.equipamento_id ? [func.equipamento_id] : []);
    var ids = [];
    eqs.forEach(function(eqId) {
      var eq = getEq(eqId);
      if (eq && eq.responsavel_id && ids.indexOf(eq.responsavel_id) < 0) ids.push(eq.responsavel_id);
    });
    return ids;
  }

  // Pode fazer a 1ª autorização? (responsável de um equipamento onde a pessoa trabalha)
  function _podeValidarResp(r) {
    if (!APP.user) return false;
    if (r.funcionario_id === APP.user.id) return false; // não autoriza os seus
    if (!_ehResponsavel()) return false;
    var func = _getFunc(r.funcionario_id);
    return _responsaveisDe(func).indexOf(APP.user.id) >= 0;
  }

  // Pode fazer a 2ª autorização? (chefe da unidade do funcionário)
  function _podeValidarChefe(r) {
    if (!APP.user) return false;
    if (r.funcionario_id === APP.user.id) return false;
    var uni = _unidadeChefe();
    if (!uni) return false;
    var func = _getFunc(r.funcionario_id);
    return !!(func && func.unidade === uni);
  }

  function _getFunc(id) {
    return (APP.utilizadores || []).filter(function(u) { return u.id === id; })[0] || null;
  }

  // ── DADOS ─────────────────────────────────────────────────
  function load(cb) {
    sbGet('banco_horas', 'order=data.desc').then(function(d) {
      _registos = Array.isArray(d) ? d : [];
      if (cb) cb();
    }).catch(function() {
      _registos = [];
      if (cb) cb();
    });
  }

  // registos que o utilizador actual pode ver
  function _visiveis() {
    if (!APP.user) return [];
    if (_isDdsTop()) return _registos;

    var uni = _unidadeChefe();
    if (uni) {
      return _registos.filter(function(r) {
        var f = _getFunc(r.funcionario_id);
        return f && f.unidade === uni;
      });
    }

    if (_ehResponsavel()) {
      var meus = _meusEquipamentos();
      return _registos.filter(function(r) {
        return meus.indexOf(r.equipamento_id) >= 0 || r.funcionario_id === APP.user.id;
      });
    }

    // funcionário: só os seus
    return _registos.filter(function(r) { return r.funcionario_id === APP.user.id; });
  }

  // ── SALDOS ────────────────────────────────────────────────
  // Só as horas aprovadas contam
  function saldoDe(funcId) {
    var efet = 0, goz = 0;
    _registos.forEach(function(r) {
      if (r.funcionario_id !== funcId || r.estado !== 'aprovado') return;
      if (r.tipo === 'gozada') goz += parseFloat(r.horas) || 0;
      else                     efet += parseFloat(r.horas) || 0;
    });
    return { efetuadas: efet, gozadas: goz, saldo: efet - goz };
  }

  function _fmtH(n) {
    n = parseFloat(n) || 0;
    var neg = n < 0;
    var abs = Math.abs(n);
    var h = Math.floor(abs);
    var m = Math.round((abs - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return (neg ? '−' : '') + h + 'h' + (m ? (m < 10 ? '0' + m : m) : '00');
  }

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Banco de Horas</div>';
    html += '<div class="dash-sub">Registo de serviço prestado e pedidos de gozo de horas.</div></div>';
    html += '<button class="btn btn-primary" onclick="Horas.openNovo()">+ Novo registo</button>';
    html += '</div>';

    // o meu saldo
    html += _renderMeuSaldo();

    // validações pendentes (para quem valida)
    html += _renderPendentes();

    // saldos de todos (chefes e admin)
    html += _renderSaldosEquipa();

    // histórico
    html += _renderHistorico();

    return html + getModaisHTML();
  }

  // Saldos de toda a equipa — visível a responsáveis, chefes e admin
  function _renderSaldosEquipa() {
    if (!APP.user) return '';
    if (!(_isDdsTop() || _unidadeChefe() || _ehResponsavel())) return '';

    // âmbito base conforme o perfil
    var funcs = (APP.utilizadores || []).slice();
    var ambito = 'Toda a DDS';
    var eqsDisponiveis = (APP.equipamentos || []).slice();

    if (!_isDdsTop()) {
      var uni = _unidadeChefe();
      if (uni) {
        funcs = funcs.filter(function(u) { return u.unidade === uni; });
        ambito = 'Unidade ' + uni;
        eqsDisponiveis = eqsDisponiveis.filter(function(e) { return e.unidade === uni; });
      } else {
        var meus = _meusEquipamentos();
        funcs = funcs.filter(function(u) { return meus.some(function(eid) { return funcNoEq(u, eid); }); });
        ambito = 'Meus equipamentos';
        eqsDisponiveis = eqsDisponiveis.filter(function(e) { return meus.indexOf(e.id) >= 0; });
      }
    }

    // filtro por equipamento (escolhido pelo utilizador nesta página)
    var filtro = APP.horasEqFiltro || '';
    if (filtro) {
      funcs = funcs.filter(function(u) { return funcNoEq(u, filtro); });
      var eqF = getEq(filtro);
      ambito = eqF ? eqF.nome : ambito;
    }

    var linhas = funcs.map(function(f) { return { f: f, s: saldoDe(f.id) }; })
      .filter(function(x) { return x.s.efetuadas > 0 || x.s.gozadas > 0; })
      .sort(function(a, b) { return b.s.saldo - a.s.saldo; });

    var tEf = 0, tGo = 0;
    linhas.forEach(function(x) { tEf += x.s.efetuadas; tGo += x.s.gozadas; });

    var h = '<div class="card" style="margin-bottom:16px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Saldos da equipa — ' + H(ambito) + '</div>';
    h += '<button class="btn btn-secondary btn-sm" onclick="Relatorios.imprimir(\'horas\',\'' + (_unidadeChefe() || '') + '\')">🖨️ Imprimir</button></div>';

    // ── Filtro por equipamento ──
    eqsDisponiveis.sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); });
    h += '<div class="fi" style="margin-bottom:12px;">';
    h += '<label class="fl">Filtrar por equipamento</label>';
    h += '<select class="fin" style="max-width:320px;" onchange="Horas.setEqFiltro(this.value)">';
    h += '<option value=""' + (!filtro ? ' selected' : '') + '>Todos os funcionários</option>';
    eqsDisponiveis.forEach(function(e) {
      h += '<option value="' + e.id + '"' + (filtro === e.id ? ' selected' : '') + '>' + H(e.nome) + '</option>';
    });
    h += '</select></div>';

    if (!linhas.length) {
      h += emptyState('Sem saldos', filtro ? 'Nenhum funcionário deste equipamento tem horas registadas.' : 'Nenhum funcionário tem horas autorizadas.');
      return h + '</div>';
    }

    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">';
    h += _miniKpi(_fmtH(tEf), 'Total efectuadas', 'var(--green)');
    h += _miniKpi(_fmtH(tGo), 'Total gozadas', 'var(--amber)');
    h += _miniKpi(_fmtH(tEf - tGo), 'Saldo a compensar', (tEf - tGo) > 0 ? 'var(--red)' : 'var(--green)');
    h += '</div>';

    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Funcionário</th><th>Unidade</th><th>Efectuadas</th><th>Gozadas</th><th>Saldo</th><th></th></tr></thead><tbody>';
    linhas.forEach(function(x) {
      var cor = x.s.saldo > 0 ? 'var(--green)' : (x.s.saldo < 0 ? 'var(--red)' : 'var(--text-2)');
      var uniL = x.f.unidade === 'EXTERNA' ? (x.f.divisao_origem || 'Externo') : (x.f.unidade || '—');
      h += '<tr>';
      h += '<td><span class="td-p">' + H(x.f.nome) + '</span>';
      if (filtro && x.f.equipamento_id !== filtro) h += '<div class="td-m" style="font-size:10.5px;color:var(--accent);">Apoio</div>';
      h += '</td>';
      h += '<td class="td-m">' + H(uniL) + '</td>';
      h += '<td class="td-m">' + _fmtH(x.s.efetuadas) + '</td>';
      h += '<td class="td-m">' + _fmtH(x.s.gozadas) + '</td>';
      h += '<td><strong style="color:' + cor + ';">' + _fmtH(x.s.saldo) + '</strong></td>';
      h += '<td style="text-align:right;"><button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'horas_ind\',\'' + x.f.id + '\')">Extrato</button></td>';
      h += '</tr>';
    });
    h += '<tr style="font-weight:700;background:var(--bg);"><td>Total</td><td></td><td>' + _fmtH(tEf) + '</td><td>' + _fmtH(tGo) + '</td><td>' + _fmtH(tEf - tGo) + '</td><td></td></tr>';
    h += '</tbody></table></div></div>';
    return h;
  }

  function setEqFiltro(v) {
    APP.horasEqFiltro = v || '';
    App.renderContent();
  }

  function _renderMeuSaldo() {
    if (!APP.user) return '';
    var s = saldoDe(APP.user.id);
    var corSaldo = s.saldo > 0 ? 'var(--green)' : (s.saldo < 0 ? 'var(--red)' : 'var(--text-2)');

    var h = '<div class="card" style="margin-bottom:16px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">O meu banco de horas</div>';
    h += '<button class="btn btn-secondary btn-sm" onclick="Relatorios.imprimir(\'horas_ind\',\'' + APP.user.id + '\')">🖨️ Extrato</button></div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
    h += _miniKpi(_fmtH(s.efetuadas), 'Efectuadas', 'var(--green)');
    h += _miniKpi(_fmtH(s.gozadas),   'Gozadas',    'var(--amber)');
    h += _miniKpi(_fmtH(s.saldo),     'Saldo actual', corSaldo);
    h += '</div>';

    // pendentes do próprio
    var meusPend = _registos.filter(function(r) {
      return r.funcionario_id === APP.user.id && (r.estado === 'pendente' || r.estado === 'validado_resp');
    });
    if (meusPend.length) {
      h += '<p style="font-size:12.5px;color:var(--text-3);margin:10px 0 0;line-height:1.5;">';
      h += '<strong style="color:var(--amber);">' + meusPend.length + '</strong> registo(s) a aguardar autorização — só contam para o saldo depois de autorizados.';
      h += '</p>';
    }
    h += '</div>';
    return h;
  }

  function _miniKpi(v, l, cor) {
    var h = '<div style="flex:1;min-width:100px;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">';
    h += '<div style="font-size:20px;font-weight:800;color:' + cor + ';">' + v + '</div>';
    h += '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.3px;margin-top:2px;">' + l + '</div>';
    h += '</div>';
    return h;
  }

  // Registos à espera da MINHA validação
  function _renderPendentes() {
    if (!APP.user) return '';

    var paraMim = _registos.filter(function(r) {
      if (r.estado === 'pendente')      return _podeValidarResp(r);
      if (r.estado === 'validado_resp') return _podeValidarChefe(r);
      return false;
    });

    // pedidos de alteração a aguardar a minha autorização
    var altsParaMim = _registos.filter(function(r) {
      if (!r.alteracao || !r.alteracao.estado) return false;
      if (r.alteracao.estado === 'pendente')      return _podeValidarResp(r);
      if (r.alteracao.estado === 'validado_resp') return _podeValidarChefe(r);
      return false;
    });

    if (!paraMim.length && !altsParaMim.length) return '';

    var total = paraMim.length + altsParaMim.length;
    var h = '<div class="card" style="margin-bottom:16px;border-left:3px solid var(--amber);">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">A aguardar a sua autorização ';
    h += '<span style="background:var(--amber);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;">' + total + '</span>';
    h += '</div></div>';

    // ── pedidos de alteração ──
    altsParaMim.forEach(function(r) {
      var f = _getFunc(r.funcionario_id);
      var alt = r.alteracao;
      var fase = alt.estado === 'pendente' ? '1ª confirmação — responsável do equipamento' : '2ª e última — chefe de unidade';

      h += '<div style="border:1px solid #BFDBFE;background:#EFF6FF;border-radius:10px;padding:12px;margin-bottom:8px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">';
      h += '<div style="flex:1;min-width:180px;">';
      h += '<div style="font-size:11px;font-weight:700;color:#1E40AF;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">✎ Pedido de alteração</div>';
      h += '<div style="font-weight:600;font-size:13.5px;">' + H(f ? f.nome : '?') + '</div>';
      h += '<div style="font-size:12px;color:var(--text-2);margin-top:3px;">';
      h += '<span style="text-decoration:line-through;opacity:.6;">' + _fdata(r.data) + ' · ' + _fmtH(r.horas) + '</span>';
      h += ' → <strong>' + _fdata(alt.data) + ' · ' + _fmtH(alt.horas) + '</strong>';
      h += '</div>';
      h += '<div style="font-size:12px;color:var(--text-3);margin-top:3px;">Motivo: ' + H(alt.motivo) + '</div>';
      h += '<div style="font-size:11px;color:var(--text-3);margin-top:4px;">' + fase + '</div>';
      h += '</div>';
      h += '<div style="display:flex;gap:6px;">';
      h += '<button class="btn btn-primary btn-sm" onclick="Horas.aprovarAlteracao(\'' + r.id + '\')">Autorizar</button>';
      h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Horas.recusarAlteracao(\'' + r.id + '\')">Recusar</button>';
      h += '</div>';
      h += '</div></div>';
    });

    paraMim.forEach(function(r) {
      var f = _getFunc(r.funcionario_id);
      var eq = getEq(r.equipamento_id);
      var fase = r.estado === 'pendente' ? '1ª confirmação — responsável do equipamento' : '2ª e última — chefe de unidade';

      h += '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">';
      h += '<div style="flex:1;min-width:180px;">';
      h += '<div style="font-weight:600;font-size:13.5px;">' + H(f ? f.nome : '?') + '</div>';
      h += '<div style="font-size:12px;color:var(--text-2);margin-top:2px;">';
      h += _badgeTipo(r.tipo) + ' <strong>' + _fmtH(r.horas) + '</strong> · ' + _fdata(r.data);
      var per = _labelPeriodo(r);
      if (per) h += ' · <strong style="color:var(--amber);">' + per + '</strong>';
      if (eq) h += ' · ' + H(eq.nome);
      if (r.iniciativa) h += ' · 📌 ' + H(r.iniciativa);
      h += '</div>';
      if (r.motivo) h += '<div style="font-size:12px;color:var(--text-3);margin-top:3px;">' + H(r.motivo) + '</div>';
      h += '<div style="font-size:11px;color:var(--text-3);margin-top:4px;">' + fase + '</div>';
      h += '</div>';
      h += '<div style="display:flex;gap:6px;">';
      h += '<button class="btn btn-primary btn-sm" onclick="Horas.aprovar(\'' + r.id + '\')">Autorizar</button>';
      h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Horas.openRejeitar(\'' + r.id + '\')">Recusar</button>';
      h += '</div>';
      h += '</div></div>';
    });

    h += '</div>';
    return h;
  }

  function _renderHistorico() {
    var lista = _visiveis().slice().sort(function(a, b) {
      return new Date(b.data || 0) - new Date(a.data || 0);
    });

    var h = '<div class="card">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Registos</div></div>';

    if (!lista.length) {
      return h + emptyState('Sem registos', 'Ainda não há registos no banco de horas.') + '</div>';
    }

    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Data</th><th>Funcionário</th><th>Tipo</th><th>Horas</th><th>Descrição</th><th>Estado</th><th></th></tr></thead><tbody>';

    lista.forEach(function(r) {
      var f = _getFunc(r.funcionario_id);
      var podeApagar = (r.funcionario_id === APP.user.id && r.estado === 'pendente') || _isAdmin();

      h += '<tr>';
      h += '<td class="td-m">' + _fdata(r.data) + '</td>';
      h += '<td><span class="td-p">' + H(f ? f.nome : '?') + '</span></td>';
      h += '<td>' + _badgeTipo(r.tipo);
      var perT = _labelPeriodo(r);
      if (perT) h += '<div class="td-m" style="font-size:11px;margin-top:2px;">' + perT + '</div>';
      h += '</td>';
      h += '<td><strong>' + _fmtH(r.horas) + '</strong></td>';
      h += '<td class="td-m" style="max-width:200px;">' + H(r.motivo || '—');
      if (r.iniciativa) h += '<div style="font-size:11px;color:var(--accent);margin-top:2px;">📌 ' + H(r.iniciativa) + '</div>';
      if (r.estado === 'rejeitado' && r.motivo_rejeicao) {
        h += '<div style="color:var(--red);font-size:11px;margin-top:2px;">Motivo da recusa: ' + H(r.motivo_rejeicao) + '</div>';
      }
      h += '</td>';
      h += '<td>' + _badgeEstado(r.estado);
      if (r.alteracao && r.alteracao.estado) {
        h += '<div style="font-size:10.5px;color:#2563EB;margin-top:3px;font-weight:600;">✎ Alteração ' + (r.alteracao.estado === 'pendente' ? 'aguarda responsável' : 'aguarda chefe') + '</div>';
      }
      h += '</td>';
      h += '<td style="text-align:right;white-space:nowrap;">';
      // pedir alteração de um registo já autorizado (mesmo circuito)
      if (r.estado === 'aprovado' && !r.alteracao && (r.funcionario_id === APP.user.id || _isAdmin())) {
        h += '<button class="btn btn-ghost btn-sm" onclick="Horas.openAlterar(\'' + r.id + '\')">Pedir alteração</button>';
      }
      if (podeApagar) {
        var lblBtn = (_isAdmin() && r.funcionario_id !== APP.user.id) ? 'Apagar' : 'Retirar';
        h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Horas.confirmarApagar(\'' + r.id + '\')">' + lblBtn + '</button>';
      }
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div></div>';
    return h;
  }

  function _badgeTipo(t) {
    if (t === 'gozada') return '<span class="bdg" style="background:#FEF3C7;color:#92400E;">Gozo</span>';
    return '<span class="bdg" style="background:#DCFCE7;color:#15803D;">Serviço</span>';
  }
  function _badgeEstado(e) {
    var d = ESTADOS[e] || { l: e, c: '#475569', bg: '#F1F5F9' };
    return '<span class="bdg" style="background:' + d.bg + ';color:' + d.c + ';">' + d.l + '</span>';
  }
  function _fdata(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  // ── MODAIS ────────────────────────────────────────────────
  function getModaisHTML() {
    var h = '';

    // NOVO PEDIDO
    h += '<div class="modal-bd" id="m-horas-novo">';
    h += '<div class="modal" style="max-width:520px;">';
    h += '<div class="modal-header"><div class="mh-ic mhi-amber"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>';
    h += '<div><div class="modal-title" id="m-horas-ttl">Banco de horas</div><div class="modal-sub">Banco de horas</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-novo\')">✕</button></div>';
    h += '<div class="modal-body">';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Tipo *</label><select id="h-tipo" class="fin" onchange="Horas.onTipoChange()">';
    h += '<option value="efetuada">Serviço prestado — horas a acumular</option>';
    h += '<option value="gozada">Pedido de gozo de horas do banco</option>';
    h += '</select></div></div>';
    h += '<p id="h-tipo-help" style="font-size:12px;color:var(--text-3);margin:-4px 0 10px;line-height:1.5;"></p>';

    // quem valida por outrem escolhe o funcionário
    h += '<div class="fi" id="h-func-wrap" style="display:none;"><label class="fl">Funcionário *</label>';
    h += '<select id="h-func" class="fin"><option value="">Eu próprio</option></select></div>';

    // Período — só para pedidos de gozo de horas
    h += '<div id="h-periodo-wrap" style="display:none;">';
    h += '<div class="fi"><label class="fl">Período a gozar *</label>';
    h += '<select id="h-periodo" class="fin" onchange="Horas.onPeriodoChange()">';
    h += '<option value="dia">Dia completo</option>';
    h += '<option value="manha">Manhã completa</option>';
    h += '<option value="tarde">Tarde completa</option>';
    h += '<option value="horas">Entre horas (indicar)</option>';
    h += '</select></div>';
    h += '<div class="form-row" id="h-horas-wrap" style="display:none;">';
    h += '<div class="fi"><label class="fl">Das</label><input type="time" id="h-hi" class="fin" onchange="Horas.onHoraChange()"></div>';
    h += '<div class="fi"><label class="fl">Às</label><input type="time" id="h-hf" class="fin" onchange="Horas.onHoraChange()"></div>';
    h += '</div>';
    h += '</div>';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Data *</label><input type="date" id="h-data" class="fin"></div>';
    h += '<div class="fi"><label class="fl">Nº de horas *</label><input type="number" id="h-horas" class="fin" step="0.25" min="0.25" placeholder="ex: 2.5"></div>';
    h += '</div>';
    h += '<p style="font-size:11.5px;color:var(--text-3);margin:-4px 0 10px;">Use decimais para as meias horas: 1.5 = 1h30 · 2.25 = 2h15</p>';

    // Equipamento e iniciativa — só para horas extraordinárias
    h += '<div id="h-onde-wrap">';
    h += '<div class="fi"><label class="fl">Equipamento</label><select id="h-eq" class="fin"><option value="">Nenhum / não se aplica</option></select></div>';
    h += '<div class="fi"><label class="fl">Iniciativa / actividade</label>';
    h += '<input type="text" id="h-iniciativa" class="fin" list="iniciativa-opcoes" placeholder="ex: Torneio de Verão, Festa da Juventude">';
    h += '<datalist id="iniciativa-opcoes"></datalist>';
    h += '<p style="font-size:11.5px;color:var(--text-3);margin:4px 0 0;line-height:1.4;">Se as horas foram numa iniciativa e não num equipamento, indique aqui.</p>';
    h += '</div>';
    h += '</div>';
    h += '<div class="fi"><label class="fl">Descrição do serviço *</label><textarea id="h-motivo" class="fin" rows="2" placeholder="ex: Apoio ao torneio de sábado"></textarea></div>';

    h += '<div id="h-circuito" style="background:var(--bg);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text-2);line-height:1.6;">';
    h += '<strong>Circuito de confirmação:</strong> o registo é confirmado pelo responsável do equipamento e, só depois, pelo chefe da sua unidade. Serve de controlo — só conta no saldo depois de confirmado.';
    h += '</div>';

    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-novo\')">Cancelar</button>';
    h += '<button class="btn btn-primary" onclick="Horas.salvar()">Submeter</button></div>';
    h += '</div></div>';

    // REJEITAR
    h += '<div class="modal-bd" id="m-horas-rejeitar">';
    h += '<div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>';
    h += '<div><div class="modal-title">Recusar pedido</div><div class="modal-sub" id="m-horas-rej-sub">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-rejeitar\')">✕</button></div>';
    h += '<div class="modal-body"><div class="fi"><label class="fl">Motivo da recusa *</label>';
    h += '<textarea id="h-motivo-rej" class="fin" rows="3" placeholder="Explique porque está a recusar..."></textarea></div></div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-rejeitar\')">Cancelar</button>';
    h += '<button class="btn btn-danger" onclick="Horas.rejeitar()">Recusar pedido</button></div>';
    h += '</div></div>';

    // APAGAR
    h += '<div class="modal-bd" id="m-horas-apagar">';
    h += '<div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></div>';
    h += '<div><div class="modal-title">Retirar pedido</div><div class="modal-sub">Esta acção é irreversível</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-apagar\')">✕</button></div>';
    h += '<div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);line-height:1.6;">Tem a certeza que quer retirar este pedido?</p></div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-apagar\')">Cancelar</button>';
    h += '<button class="btn btn-danger" onclick="Horas.execApagar()">Retirar pedido</button></div>';
    h += '</div></div>';

    // PEDIR ALTERAÇÃO
    h += '<div class="modal-bd" id="m-horas-alterar">';
    h += '<div class="modal" style="max-width:520px;">';
    h += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>';
    h += '<div><div class="modal-title">Pedir alteração</div><div class="modal-sub" id="m-alt-sub">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-alterar\')">✕</button></div>';
    h += '<div class="modal-body">';
    h += '<div id="m-alt-atual" style="background:var(--bg);border-radius:8px;padding:10px 12px;font-size:12.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px;"></div>';
    h += '<div class="form-sec-t">Novos valores</div>';
    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Data *</label><input type="date" id="alt-data" class="fin"></div>';
    h += '<div class="fi"><label class="fl">Nº de horas *</label><input type="number" id="alt-horas" class="fin" step="0.25" min="0.25"></div>';
    h += '</div>';
    h += '<div class="fi" id="alt-periodo-wrap" style="display:none;"><label class="fl">Período</label>';
    h += '<select id="alt-periodo" class="fin">';
    h += '<option value="dia">Dia completo</option>';
    h += '<option value="manha">Manhã completa</option>';
    h += '<option value="tarde">Tarde completa</option>';
    h += '<option value="horas">Entre horas</option>';
    h += '</select></div>';
    h += '<div class="fi"><label class="fl">Motivo da alteração *</label>';
    h += '<textarea id="alt-motivo" class="fin" rows="2" placeholder="Explique porque precisa de alterar..."></textarea></div>';
    h += '<div style="background:#DBEAFE;border-radius:8px;padding:10px 12px;font-size:12px;color:#1E40AF;line-height:1.6;">';
    h += 'A alteração <strong>só produz efeito depois de autorizada</strong> pelo responsável do equipamento e, em seguida, pelo chefe de unidade. Até lá, mantêm-se os valores actuais.';
    h += '</div>';
    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-alterar\')">Cancelar</button>';
    h += '<button class="btn btn-primary" onclick="Horas.salvarAlteracao()">Submeter alteração</button></div>';
    h += '</div></div>';

    return h;
  }
  // texto de ajuda conforme o tipo de pedido
  function onTipoChange() {
    var t = (document.getElementById('h-tipo') || {}).value;
    var el = document.getElementById('h-tipo-help');
    if (el) {
      el.textContent = (t === 'gozada')
        ? 'Pedido para usar horas já acumuladas no seu banco (folga, saída antecipada).'
        : 'Serviço prestado além do horário normal, já articulado com a chefia. As horas acumulam no seu banco após confirmação.';
    }
    // o período só se aplica a pedidos de gozo
    var gozo = (t === 'gozada');
    var pw = document.getElementById('h-periodo-wrap');
    if (pw) pw.style.display = gozo ? 'block' : 'none';

    // equipamento e iniciativa só fazem sentido nas horas extraordinárias
    var ow = document.getElementById('h-onde-wrap');
    if (ow) ow.style.display = gozo ? 'none' : 'block';

    var mot = document.getElementById('h-motivo');
    if (mot) mot.placeholder = gozo ? 'ex: Assuntos pessoais' : 'ex: Abertura e fecho do pavilhão — torneio de sábado';

    var circ = document.getElementById('h-circuito');
    if (circ) {
      circ.innerHTML = gozo
        ? '<strong>Circuito:</strong> o pedido segue para o responsável do equipamento e, só depois deste autorizar, para o chefe da sua unidade. Depois de autorizado, é lançado na sua escala e descontado do saldo.'
        : '<strong>Circuito de confirmação:</strong> o registo é confirmado pelo responsável do equipamento e, só depois, pelo chefe da sua unidade. Serve de controlo — só conta no saldo depois de confirmado.';
    }

    if (gozo) onPeriodoChange();
    else {
      var hw = document.getElementById('h-horas-wrap');
      if (hw) hw.style.display = 'none';
    }
  }

  // horas por defeito de cada período (ajustáveis pelo utilizador)
  var HORAS_PERIODO = { dia: 7, manha: 3.5, tarde: 3.5 };

  function onPeriodoChange() {
    var p  = (document.getElementById('h-periodo') || {}).value;
    var hw = document.getElementById('h-horas-wrap');
    var hs = document.getElementById('h-horas');

    if (hw) hw.style.display = (p === 'horas') ? 'flex' : 'none';

    if (p === 'horas') {
      _calcHorasIntervalo();
    } else if (HORAS_PERIODO[p] && hs) {
      hs.value = HORAS_PERIODO[p];
    }
  }

  // calcula automaticamente as horas a partir do intervalo indicado
  function _calcHorasIntervalo() {
    var hi = (document.getElementById('h-hi') || {}).value;
    var hf = (document.getElementById('h-hf') || {}).value;
    var hs = document.getElementById('h-horas');
    if (!hi || !hf || !hs) return;
    var a = hi.split(':'), b = hf.split(':');
    var mins = (parseInt(b[0], 10) * 60 + parseInt(b[1], 10)) - (parseInt(a[0], 10) * 60 + parseInt(a[1], 10));
    if (mins > 0) hs.value = (mins / 60).toFixed(2).replace(/\.00$/, '');
  }
  function onHoraChange() { _calcHorasIntervalo(); }

  function _labelPeriodo(r) {
    if (r.tipo !== 'gozada') return '';
    if (r.periodo === 'manha') return 'Manhã completa';
    if (r.periodo === 'tarde') return 'Tarde completa';
    if (r.periodo === 'dia')   return 'Dia completo';
    if (r.periodo === 'horas' && r.hora_inicio && r.hora_fim) {
      return r.hora_inicio.slice(0, 5) + '–' + r.hora_fim.slice(0, 5);
    }
    return '';
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function openNovo() {
    APP.editId = null;
    var hoje = new Date().toISOString().split('T')[0];
    var set = function(id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    set('h-tipo', 'efetuada');
    set('h-data', hoje);
    set('h-horas', '');
    set('h-motivo', '');
    set('h-iniciativa', '');
    set('h-periodo', 'dia');
    set('h-hi', '');
    set('h-hf', '');
    onTipoChange();

    // quem valida pode registar por outro funcionário
    var podeOutro = _ehChefe() || _ehResponsavel();
    var fw = document.getElementById('h-func-wrap');
    if (fw) fw.style.display = podeOutro ? 'block' : 'none';
    if (podeOutro) _popularFuncs();

    _popularEqs();
    openModal('m-horas-novo');
  }

  function _popularFuncs() {
    var sel = document.getElementById('h-func');
    if (!sel) return;
    var lista = (APP.utilizadores || []).slice();

    if (!_isDdsTop()) {
      var uni = _unidadeChefe();
      if (uni) {
        lista = lista.filter(function(u) { return u.unidade === uni; });
      } else if (_ehResponsavel()) {
        var meus = _meusEquipamentos();
        lista = lista.filter(function(u) { return meus.indexOf(u.equipamento_id) >= 0; });
      }
    }

    sel.innerHTML = '<option value="">Eu próprio</option>';
    lista.sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); })
      .forEach(function(u) {
        var o = document.createElement('option');
        o.value = u.id;
        o.textContent = u.nome;
        sel.appendChild(o);
      });
  }

  function _popularEqs() {
    var sel = document.getElementById('h-eq');
    if (!sel) return;
    // TODOS os equipamentos — um funcionário pode fazer horas em qualquer um
    sel.innerHTML = '<option value="">Nenhum / não se aplica</option>';
    (APP.equipamentos || []).slice()
      .sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); })
      .forEach(function(e) {
        var o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.nome + (e.unidade ? ' (' + e.unidade + ')' : '');
        sel.appendChild(o);
      });
    // sugere o equipamento principal, mas pode trocar-se
    if (APP.user && APP.user.equipamento_id) sel.value = APP.user.equipamento_id;

    // sugestões de iniciativas já usadas
    var dl = document.getElementById('iniciativa-opcoes');
    if (dl) {
      var vistos = {};
      _registos.forEach(function(r) {
        if (r.iniciativa && !vistos[r.iniciativa]) vistos[r.iniciativa] = true;
      });
      dl.innerHTML = Object.keys(vistos).map(function(v) {
        return '<option value="' + H(v) + '"></option>';
      }).join('');
    }
  }

  function salvar() {
    var tipo  = (document.getElementById('h-tipo')  || {}).value || 'efetuada';
    var data  = (document.getElementById('h-data')  || {}).value;
    var horas = parseFloat((document.getElementById('h-horas') || {}).value);
    var gozo = (tipo === 'gozada');
    var eq    = gozo ? null : ((document.getElementById('h-eq') || {}).value || null);
    var inic  = gozo ? '' : ((document.getElementById('h-iniciativa') || {}).value || '').trim();
    var motivo= ((document.getElementById('h-motivo') || {}).value || '').trim();

    if (!data)  { toast('Indique a data.', 'error'); return; }
    if (!horas || horas <= 0) { toast('Indique um número de horas válido.', 'error'); return; }
    if (horas > 24) { toast('O número de horas não pode exceder 24 num dia.', 'error'); return; }
    if (!motivo) { toast('Descreva o serviço / motivo.', 'error'); return; }

    // período (só para gozo de horas)
    var periodo = null, hIni = null, hFim = null;
    if (tipo === 'gozada') {
      periodo = (document.getElementById('h-periodo') || {}).value || 'dia';
      if (periodo === 'horas') {
        hIni = (document.getElementById('h-hi') || {}).value || null;
        hFim = (document.getElementById('h-hf') || {}).value || null;
        if (!hIni || !hFim) { toast('Indique a hora de início e de fim.', 'error'); return; }
        if (hFim <= hIni)   { toast('A hora de fim deve ser posterior à de início.', 'error'); return; }
      }
    }

    // por quem é o registo
    var fwSel = document.getElementById('h-func');
    var fw    = document.getElementById('h-func-wrap');
    var paraOutro = fw && fw.style.display !== 'none' && fwSel && fwSel.value;
    var funcId = paraOutro ? fwSel.value : APP.user.id;
    var func   = _getFunc(funcId);

    // se for gozar horas, avisar se não há saldo
    if (tipo === 'gozada') {
      var s = saldoDe(funcId);
      if (horas > s.saldo) {
        if (!confirm('Atenção: o saldo disponível é de ' + _fmtH(s.saldo) + ' e está a pedir ' + _fmtH(horas) + '.\n\nQuer continuar mesmo assim?')) return;
      }
    }

    var body = {
      funcionario_id: funcId,
      equipamento_id: eq,
      unidade:        func ? func.unidade : null,
      tipo:           tipo,
      data:           data,
      horas:          horas,
      iniciativa:     inic || null,
      periodo:        periodo,
      hora_inicio:    hIni,
      hora_fim:       hFim,
      motivo:         motivo || null,
      estado:         'pendente',
      criado_por:     APP.user.id
    };

    // Todos os pedidos entram na cadeia normal:
    // responsável do equipamento → chefe de unidade.
    // O admin não autoriza (supervisiona e pode apagar).
    sbPost('banco_horas', body).then(function(resp) {
      var criado = Array.isArray(resp) ? resp[0] : null;
      toast('Registo submetido. Aguarda autorização.', 'success');
      closeModal('m-horas-novo');
      if (criado) _notificarResponsavel(criado, func);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function(e) {
      console.error('Erro banco_horas:', e);
      var msg = [e && e.code, e && e.message, e && e.details, e && e.hint].filter(Boolean).join(' · ');
      toast('Erro ao submeter: ' + (msg || 'desconhecido'), 'error');
    });
  }

  // ── NOTIFICAÇÕES ──────────────────────────────────────────
  // 1º nível: avisa o(s) responsável(eis) dos equipamentos onde a pessoa trabalha
  function _notificarResponsavel(r, func) {
    var destinos = _responsaveisDe(func);

    // sem responsável definido em nenhum equipamento → não há 1º nível;
    // o pedido segue para o chefe da unidade (senão ficaria bloqueado)
    if (!destinos.length) {
      sbPatch('banco_horas', 'id=eq.' + r.id, {
        estado: 'validado_resp',
        data_valid_resp: new Date().toISOString()
      }).then(function() { _notificarChefe(r, func); }).catch(function() {});
      return;
    }

    var tipoTxt = r.tipo === 'gozada' ? 'gozo de horas' : 'serviço prestado';
    var perTxt  = _labelPeriodo(r);
    destinos.forEach(function(uid) {
      if (uid === APP.user.id) return;
      sbPost('avisos', {
        destinatario_id: uid,
        titulo: 'Banco de horas — pedido para autorizar',
        mensagem: (func ? func.nome : 'Um funcionário') + ' registou ' + _fmtH(r.horas) + ' (' + tipoTxt + ') em ' + _fdata(r.data) + (perTxt ? ' — ' + perTxt : '') + '. Aguarda a sua autorização.',
        lido: false,
        tipo: 'notificacao',
        remetente_id: APP.user.id,
        remetente_nome: APP.user.nome
      }).catch(function() {});
    });
  }

  // 2º nível: avisa o chefe da unidade do funcionário
  function _notificarChefe(r, func) {
    if (!func || !func.unidade) return;
    var perfilDir = func.unidade === 'UDAJ' ? 'supervisor_udaj'
                  : func.unidade === 'UASE' ? 'supervisor_uase' : null;
    if (!perfilDir) return;

    var tipoTxt = r.tipo === 'gozada' ? 'gozo de horas' : 'horas extraordinárias';
    (APP.utilizadores || []).filter(function(u) { return u.perfil === perfilDir; })
      .forEach(function(dir) {
        if (dir.id === APP.user.id) return;
        sbPost('avisos', {
          destinatario_id: dir.id,
          titulo: 'Banco de horas — autorização final',
          mensagem: (func ? func.nome : 'Um funcionário') + ': ' + _fmtH(r.horas) + ' (' + tipoTxt + ') em ' + _fdata(r.data) + ' foi autorizado pelo responsável. Aguarda a sua autorização final.',
          lido: false,
          tipo: 'notificacao',
          remetente_id: APP.user.id,
          remetente_nome: APP.user.nome
        }).catch(function() {});
      });
  }

  // avisa o admin quando o dirigente dá a autorização final (supervisão)
  function _notificarAdmin(r, func) {
    var tipoTxt = r.tipo === 'gozada' ? 'gozo de horas' : 'serviço prestado';
    var perTxt  = _labelPeriodo(r);
    (APP.utilizadores || []).filter(function(u) { return u.perfil === 'admin'; })
      .forEach(function(a) {
        if (a.id === APP.user.id) return;
        sbPost('avisos', {
          destinatario_id: a.id,
          titulo: 'Banco de horas — autorizado pelo dirigente',
          mensagem: (func ? func.nome : 'Um funcionário') + ': ' + _fmtH(r.horas) + ' (' + tipoTxt + ') em ' + _fdata(r.data) + (perTxt ? ' — ' + perTxt : '') + ' foi autorizado por ' + (APP.user.nome || 'um dirigente') + '.',
          lido: false,
          tipo: 'notificacao',
          remetente_id: APP.user.id,
          remetente_nome: APP.user.nome
        }).catch(function() {});
      });
  }

  // avisa o funcionário do desfecho
  function _notificarFuncionario(r, aprovado, motivo) {
    if (!r.funcionario_id || r.funcionario_id === APP.user.id) return;
    var tipoTxt = r.tipo === 'gozada' ? 'gozo de horas' : 'horas extraordinárias';
    sbPost('avisos', {
      destinatario_id: r.funcionario_id,
      titulo: aprovado ? 'Banco de horas — autorizado' : 'Banco de horas — recusado',
      mensagem: aprovado
        ? 'As suas ' + _fmtH(r.horas) + ' (' + tipoTxt + ') de ' + _fdata(r.data) + ' foram autorizadas e já contam no seu saldo.'
        : 'As suas ' + _fmtH(r.horas) + ' (' + tipoTxt + ') de ' + _fdata(r.data) + ' foram recusadas.' + (motivo ? ' Motivo: ' + motivo : ''),
      lido: false,
      tipo: 'notificacao',
      remetente_id: APP.user.id,
      remetente_nome: APP.user.nome
    }).catch(function() {});
  }

  // ── PEDIDO DE ALTERAÇÃO (mesmo circuito de autorização) ────
  function openAlterar(id) {
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    if (!r) return;
    APP.actionId = id;

    var f = _getFunc(r.funcionario_id);
    var sub = document.getElementById('m-alt-sub');
    if (sub) sub.textContent = (f ? f.nome : '?') + ' · ' + (r.tipo === 'gozada' ? 'Gozo de horas' : 'Serviço prestado');

    var per = _labelPeriodo(r);
    var atual = document.getElementById('m-alt-atual');
    if (atual) {
      atual.innerHTML = '<strong>Valores actuais:</strong><br>' +
        _fdata(r.data) + ' · ' + _fmtH(r.horas) + (per ? ' · ' + H(per) : '') +
        (r.motivo ? '<br>' + H(r.motivo) : '');
    }

    var set = function(i, v) { var el = document.getElementById(i); if (el) el.value = v; };
    set('alt-data', r.data);
    set('alt-horas', r.horas);
    set('alt-periodo', r.periodo || 'dia');
    set('alt-motivo', '');

    var pw = document.getElementById('alt-periodo-wrap');
    if (pw) pw.style.display = (r.tipo === 'gozada') ? 'block' : 'none';

    openModal('m-horas-alterar');
  }

  function salvarAlteracao() {
    if (!APP.actionId) return;
    var r = _registos.filter(function(x) { return x.id === APP.actionId; })[0];
    if (!r) return;

    var data   = (document.getElementById('alt-data')   || {}).value;
    var horas  = parseFloat((document.getElementById('alt-horas') || {}).value);
    var per    = (document.getElementById('alt-periodo') || {}).value;
    var motivo = ((document.getElementById('alt-motivo') || {}).value || '').trim();

    if (!data) { toast('Indique a data.', 'error'); return; }
    if (!horas || horas <= 0 || horas > 24) { toast('Indique um número de horas válido.', 'error'); return; }
    if (!motivo) { toast('Explique o motivo da alteração.', 'error'); return; }

    var alt = {
      data: data,
      horas: horas,
      periodo: (r.tipo === 'gozada') ? per : null,
      motivo: motivo,
      estado: 'pendente',
      pedida_por: APP.user.id,
      data_pedido: new Date().toISOString()
    };

    sbPatch('banco_horas', 'id=eq.' + r.id, { alteracao: alt }).then(function() {
      toast('Alteração submetida. Aguarda autorização.', 'success');
      closeModal('m-horas-alterar');
      _notificarAlteracao(r, alt);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function(e) {
      console.error('Erro alteração:', e);
      toast('Erro ao submeter a alteração.', 'error');
    });
  }

  function _notificarAlteracao(r, alt) {
    var func = _getFunc(r.funcionario_id);
    var destinos = _responsaveisDe(func);
    if (!destinos.length) return;
    destinos.forEach(function(uid) {
      if (uid === APP.user.id) return;
      sbPost('avisos', {
        destinatario_id: uid,
        titulo: 'Banco de horas — pedido de alteração',
        mensagem: (func ? func.nome : 'Um funcionário') + ' pediu para alterar um registo autorizado de ' + _fdata(r.data) + ' (' + _fmtH(r.horas) + ') para ' + _fdata(alt.data) + ' (' + _fmtH(alt.horas) + '). Motivo: ' + alt.motivo,
        lido: false,
        tipo: 'notificacao',
        remetente_id: APP.user.id,
        remetente_nome: APP.user.nome
      }).catch(function() {});
    });
  }

  // autorizar / recusar uma alteração
  function aprovarAlteracao(id) {
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    if (!r || !r.alteracao) return;
    var alt = r.alteracao;
    var func = _getFunc(r.funcionario_id);
    var agora = new Date().toISOString();

    // 1ª autorização — responsável
    if (alt.estado === 'pendente' && _podeValidarResp(r)) {
      alt.estado = 'validado_resp';
      alt.valid_resp_por = APP.user.id;
      alt.data_valid_resp = agora;
      sbPatch('banco_horas', 'id=eq.' + id, { alteracao: alt }).then(function() {
        toast('Alteração autorizada. Segue para o chefe de unidade.', 'success');
        _notificarChefeAlteracao(r, alt, func);
        load(function() { App.renderContent(); App.updateBadges(); });
      }).catch(function() { toast('Erro ao autorizar.', 'error'); });
      return;
    }

    // 2ª autorização — chefe: aplica de facto a alteração
    if (alt.estado === 'validado_resp' && _podeValidarChefe(r)) {
      var body = {
        data: alt.data,
        horas: alt.horas,
        alteracao: null,
        motivo: (r.motivo || '') + ' [alterado: ' + alt.motivo + ']'
      };
      if (r.tipo === 'gozada') body.periodo = alt.periodo;

      sbPatch('banco_horas', 'id=eq.' + id, body).then(function() {
        toast('Alteração aplicada.', 'success');
        _notificarFuncAlteracao(r, alt, true);
        _notificarAdmin(r, func);
        _actualizarEscala(r, alt);
        load(function() { App.renderContent(); App.updateBadges(); });
      }).catch(function() { toast('Erro ao aplicar a alteração.', 'error'); });
      return;
    }

    toast('Não pode autorizar esta alteração nesta fase.', 'error');
  }

  function recusarAlteracao(id) {
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    if (!r || !r.alteracao) return;
    sbPatch('banco_horas', 'id=eq.' + id, { alteracao: null }).then(function() {
      toast('Alteração recusada. O registo mantém-se como estava.', 'success');
      _notificarFuncAlteracao(r, r.alteracao, false);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function() { toast('Erro ao recusar.', 'error'); });
  }

  function _notificarChefeAlteracao(r, alt, func) {
    if (!func || !func.unidade) return;
    var perfilDir = func.unidade === 'UDAJ' ? 'supervisor_udaj'
                  : func.unidade === 'UASE' ? 'supervisor_uase' : null;
    if (!perfilDir) return;
    (APP.utilizadores || []).filter(function(u) { return u.perfil === perfilDir; })
      .forEach(function(dir) {
        if (dir.id === APP.user.id) return;
        sbPost('avisos', {
          destinatario_id: dir.id,
          titulo: 'Banco de horas — alteração para autorizar',
          mensagem: (func ? func.nome : 'Um funcionário') + ': alteração de ' + _fdata(r.data) + ' (' + _fmtH(r.horas) + ') para ' + _fdata(alt.data) + ' (' + _fmtH(alt.horas) + ') foi autorizada pelo responsável. Aguarda a sua autorização final.',
          lido: false, tipo: 'notificacao',
          remetente_id: APP.user.id, remetente_nome: APP.user.nome
        }).catch(function() {});
      });
  }

  function _notificarFuncAlteracao(r, alt, aprovada) {
    if (!r.funcionario_id || r.funcionario_id === APP.user.id) return;
    sbPost('avisos', {
      destinatario_id: r.funcionario_id,
      titulo: aprovada ? 'Banco de horas — alteração aplicada' : 'Banco de horas — alteração recusada',
      mensagem: aprovada
        ? 'A alteração que pediu foi autorizada. O registo passou a ' + _fdata(alt.data) + ' · ' + _fmtH(alt.horas) + '.'
        : 'A alteração que pediu foi recusada. O registo mantém-se como estava.',
      lido: false, tipo: 'notificacao',
      remetente_id: APP.user.id, remetente_nome: APP.user.nome
    }).catch(function() {});
  }

  // corrigir a folga na escala depois da alteração
  function _actualizarEscala(r, alt) {
    if (r.tipo !== 'gozada') return;
    // apaga as folgas antigas e lança as novas
    sbDelete('escalas', 'funcionario_id=eq.' + r.funcionario_id + '&data_inicio=eq.' + r.data + '&tipo_turno=eq.folga')
      .then(function() {
        var novo = {};
        for (var k in r) novo[k] = r[k];
        novo.data = alt.data;
        novo.horas = alt.horas;
        novo.periodo = alt.periodo;
        _lancarNaEscala(novo);
      }).catch(function() {});
  }

  // ── ESCALA: lançar a folga nos equipamentos onde o funcionário trabalha ──
  function _lancarNaEscala(r) {
    if (!r || r.tipo !== 'gozada') return;
    var func = _getFunc(r.funcionario_id);
    if (!func) return;

    // todos os equipamentos onde a pessoa trabalha (principal + adicionais)
    var eqs = (typeof eqsDoFunc === 'function') ? eqsDoFunc(func) : (func.equipamento_id ? [func.equipamento_id] : []);
    if (!eqs.length) return;

    var lbl = _labelPeriodo(r) || 'Folga';
    var body = eqs.map(function(eqId) {
      var b = {
        equipamento_id: eqId,
        funcionario_id: r.funcionario_id,
        data_inicio: r.data,
        data_fim: r.data,
        tipo_turno: 'folga',
        funcao: 'Folga (banco de horas) — ' + lbl,
        observacoes: r.motivo || null
      };
      // se foi um intervalo concreto, guardar as horas
      if (r.periodo === 'horas' && r.hora_inicio && r.hora_fim) {
        b.hora_entrada = r.hora_inicio;
        b.hora_saida   = r.hora_fim;
      }
      return b;
    });

    sbPost('escalas', body).catch(function(e) {
      console.error('Erro ao lançar folga na escala:', e);
    });
  }

  // ── VALIDAÇÃO ─────────────────────────────────────────────
  function aprovar(id) {
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    if (!r) return;
    var func = _getFunc(r.funcionario_id);
    var agora = new Date().toISOString();
    var body, fase;

    if (r.estado === 'pendente' && _podeValidarResp(r)) {
      // 1ª autorização — responsável do equipamento
      body = { estado: 'validado_resp', validado_resp_por: APP.user.id, data_valid_resp: agora };
      fase = 'resp';
    } else if (r.estado === 'validado_resp' && _podeValidarChefe(r)) {
      // 2ª e última autorização — chefe de unidade
      body = { estado: 'aprovado', validado_chefe_por: APP.user.id, data_valid_chefe: agora };
      fase = 'aprovado';
    } else {
      toast('Não pode autorizar este pedido nesta fase.', 'error');
      return;
    }

    sbPatch('banco_horas', 'id=eq.' + id, body).then(function() {
      if (fase === 'aprovado') {
        toast('Autorizado. Já conta no saldo.', 'success');
        _notificarFuncionario(r, true);
        _notificarAdmin(r, func);   // supervisão
        _lancarNaEscala(r);
      } else {
        toast('Autorizado. Segue para o chefe de unidade.', 'success');
        _notificarChefe(r, func);
      }
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function(e) {
      console.error('Erro ao validar:', e);
      toast('Erro ao autorizar.', 'error');
    });
  }

  function openRejeitar(id) {
    APP.actionId = id;
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    var f = r ? _getFunc(r.funcionario_id) : null;
    var sub = document.getElementById('m-horas-rej-sub');
    if (sub) sub.textContent = r ? ((f ? f.nome : '?') + ' · ' + _fmtH(r.horas) + ' · ' + _fdata(r.data)) : '—';
    var m = document.getElementById('h-motivo-rej');
    if (m) m.value = '';
    openModal('m-horas-rejeitar');
  }

  function rejeitar() {
    if (!APP.actionId) return;
    var motivo = ((document.getElementById('h-motivo-rej') || {}).value || '').trim();
    if (!motivo) { toast('Indique o motivo da recusa.', 'error'); return; }

    var r = _registos.filter(function(x) { return x.id === APP.actionId; })[0];

    sbPatch('banco_horas', 'id=eq.' + APP.actionId, {
      estado: 'rejeitado',
      motivo_rejeicao: motivo,
      rejeitado_por: APP.user.id
    }).then(function() {
      toast('Pedido recusado.', 'success');
      closeModal('m-horas-rejeitar');
      if (r) _notificarFuncionario(r, false, motivo);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function() { toast('Erro ao recusar.', 'error'); });
  }

  // ── APAGAR ────────────────────────────────────────────────
  function confirmarApagar(id) {
    APP.actionId = id;
    openModal('m-horas-apagar');
  }
  function execApagar() {
    if (!APP.actionId) return;
    sbDelete('banco_horas', 'id=eq.' + APP.actionId).then(function() {
      toast('Pedido retirado.', 'success');
      closeModal('m-horas-apagar');
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  // ── API PÚBLICA para relatórios/badges ────────────────────
  // nº de registos à espera da validação do utilizador actual
  function pendentesParaMim() {
    if (!APP.user) return 0;
    var n = _registos.filter(function(r) {
      if (r.estado === 'pendente')      return _podeValidarResp(r);
      if (r.estado === 'validado_resp') return _podeValidarChefe(r);
      return false;
    }).length;
    n += _registos.filter(function(r) {
      if (!r.alteracao || !r.alteracao.estado) return false;
      if (r.alteracao.estado === 'pendente')      return _podeValidarResp(r);
      if (r.alteracao.estado === 'validado_resp') return _podeValidarChefe(r);
      return false;
    }).length;
    return n;
  }

  function registos() { return _registos; }

  function init() {}

  return {
    render: render, init: init, load: load,
    openNovo: openNovo, salvar: salvar, onTipoChange: onTipoChange,
    onPeriodoChange: onPeriodoChange, onHoraChange: onHoraChange,
    labelPeriodo: _labelPeriodo,
    aprovar: aprovar, openRejeitar: openRejeitar, rejeitar: rejeitar,
    openAlterar: openAlterar, salvarAlteracao: salvarAlteracao,
    aprovarAlteracao: aprovarAlteracao, recusarAlteracao: recusarAlteracao,
    setEqFiltro: setEqFiltro,
    confirmarApagar: confirmarApagar, execApagar: execApagar,
    saldoDe: saldoDe, registos: registos, pendentesParaMim: pendentesParaMim,
    fmtH: _fmtH
  };

})();

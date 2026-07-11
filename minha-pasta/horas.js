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
    pendente:      { l: 'Pendente',              c: '#D97706', bg: '#FEF3C7' },
    validado_resp: { l: 'Validado pelo resp.',   c: '#2563EB', bg: '#DBEAFE' },
    aprovado:      { l: 'Aprovado',              c: '#15803D', bg: '#DCFCE7' },
    rejeitado:     { l: 'Rejeitado',             c: '#B91C1C', bg: '#FEE2E2' }
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

  // Pode fazer a 1ª validação (responsável do equipamento do registo)?
  function _podeValidarResp(r) {
    if (!APP.user) return false;
    if (r.funcionario_id === APP.user.id) return false; // não valida o seu próprio
    if (_isDdsTop()) return true;
    if (!_ehResponsavel()) return false;
    return _meusEquipamentos().indexOf(r.equipamento_id) >= 0;
  }

  // Pode fazer a 2ª validação (chefe da unidade do funcionário)?
  function _podeValidarChefe(r) {
    if (!APP.user) return false;
    if (r.funcionario_id === APP.user.id) return false;
    if (_isDdsTop()) return true;
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
    html += '<div class="dash-sub">Horas extraordinárias efectuadas e gozadas.</div></div>';
    html += '<button class="btn btn-primary" onclick="Horas.openNovo()">+ Registar horas</button>';
    html += '</div>';

    // o meu saldo
    html += _renderMeuSaldo();

    // validações pendentes (para quem valida)
    html += _renderPendentes();

    // histórico
    html += _renderHistorico();

    return html + getModaisHTML();
  }

  function _renderMeuSaldo() {
    if (!APP.user) return '';
    var s = saldoDe(APP.user.id);
    var corSaldo = s.saldo > 0 ? 'var(--green)' : (s.saldo < 0 ? 'var(--red)' : 'var(--text-2)');

    var h = '<div class="card" style="margin-bottom:16px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">O meu banco de horas</div></div>';
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
      h += '<strong style="color:var(--amber);">' + meusPend.length + '</strong> registo(s) ainda a aguardar validação — só contam para o saldo depois de aprovados.';
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

    if (!paraMim.length) return '';

    var h = '<div class="card" style="margin-bottom:16px;border-left:3px solid var(--amber);">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">A aguardar a sua validação ';
    h += '<span style="background:var(--amber);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;">' + paraMim.length + '</span>';
    h += '</div></div>';

    paraMim.forEach(function(r) {
      var f = _getFunc(r.funcionario_id);
      var eq = getEq(r.equipamento_id);
      var fase = r.estado === 'pendente' ? '1ª validação (responsável)' : '2ª validação (chefe de unidade)';

      h += '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">';
      h += '<div style="flex:1;min-width:180px;">';
      h += '<div style="font-weight:600;font-size:13.5px;">' + H(f ? f.nome : '?') + '</div>';
      h += '<div style="font-size:12px;color:var(--text-2);margin-top:2px;">';
      h += _badgeTipo(r.tipo) + ' <strong>' + _fmtH(r.horas) + '</strong> · ' + _fdata(r.data);
      if (eq) h += ' · ' + H(eq.nome);
      h += '</div>';
      if (r.motivo) h += '<div style="font-size:12px;color:var(--text-3);margin-top:3px;">' + H(r.motivo) + '</div>';
      h += '<div style="font-size:11px;color:var(--text-3);margin-top:4px;">' + fase + '</div>';
      h += '</div>';
      h += '<div style="display:flex;gap:6px;">';
      h += '<button class="btn btn-primary btn-sm" onclick="Horas.aprovar(\'' + r.id + '\')">Validar</button>';
      h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Horas.openRejeitar(\'' + r.id + '\')">Rejeitar</button>';
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
      return h + emptyState('Sem registos', 'Ainda não há horas registadas.') + '</div>';
    }

    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Data</th><th>Funcionário</th><th>Tipo</th><th>Horas</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>';

    lista.forEach(function(r) {
      var f = _getFunc(r.funcionario_id);
      var podeApagar = (r.funcionario_id === APP.user.id && r.estado === 'pendente') || _isAdmin();

      h += '<tr>';
      h += '<td class="td-m">' + _fdata(r.data) + '</td>';
      h += '<td><span class="td-p">' + H(f ? f.nome : '?') + '</span></td>';
      h += '<td>' + _badgeTipo(r.tipo) + '</td>';
      h += '<td><strong>' + _fmtH(r.horas) + '</strong></td>';
      h += '<td class="td-m" style="max-width:200px;">' + H(r.motivo || '—');
      if (r.estado === 'rejeitado' && r.motivo_rejeicao) {
        h += '<div style="color:var(--red);font-size:11px;margin-top:2px;">Motivo da rejeição: ' + H(r.motivo_rejeicao) + '</div>';
      }
      h += '</td>';
      h += '<td>' + _badgeEstado(r.estado) + '</td>';
      h += '<td style="text-align:right;">';
      if (podeApagar) h += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Horas.confirmarApagar(\'' + r.id + '\')">Apagar</button>';
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div></div>';
    return h;
  }

  function _badgeTipo(t) {
    if (t === 'gozada') return '<span class="bdg" style="background:#FEF3C7;color:#92400E;">Gozadas</span>';
    return '<span class="bdg" style="background:#DCFCE7;color:#15803D;">Efectuadas</span>';
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

    // NOVO REGISTO
    h += '<div class="modal-bd" id="m-horas-novo">';
    h += '<div class="modal" style="max-width:520px;">';
    h += '<div class="modal-header"><div class="mh-ic mhi-amber"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>';
    h += '<div><div class="modal-title" id="m-horas-ttl">Registar horas</div><div class="modal-sub">Banco de horas</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-novo\')">✕</button></div>';
    h += '<div class="modal-body">';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Tipo *</label><select id="h-tipo" class="fin">';
    h += '<option value="efetuada">Horas efectuadas (fiz horas a mais)</option>';
    h += '<option value="gozada">Horas gozadas (usei horas do banco)</option>';
    h += '</select></div></div>';

    // quem valida por outrem escolhe o funcionário
    h += '<div class="fi" id="h-func-wrap" style="display:none;"><label class="fl">Funcionário *</label>';
    h += '<select id="h-func" class="fin"><option value="">Seleccione...</option></select></div>';

    h += '<div class="form-row">';
    h += '<div class="fi"><label class="fl">Data *</label><input type="date" id="h-data" class="fin"></div>';
    h += '<div class="fi"><label class="fl">Horas *</label><input type="number" id="h-horas" class="fin" step="0.25" min="0.25" placeholder="ex: 2.5"></div>';
    h += '</div>';
    h += '<p style="font-size:11.5px;color:var(--text-3);margin:-4px 0 10px;">Use decimais para as meias horas: 1.5 = 1h30 · 2.25 = 2h15</p>';

    h += '<div class="fi"><label class="fl">Equipamento</label><select id="h-eq" class="fin"><option value="">Nenhum</option></select></div>';
    h += '<div class="fi"><label class="fl">Motivo / descrição</label><textarea id="h-motivo" class="fin" rows="2" placeholder="ex: Apoio ao torneio de sábado"></textarea></div>';

    h += '</div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-novo\')">Cancelar</button>';
    h += '<button class="btn btn-primary" onclick="Horas.salvar()">Registar</button></div>';
    h += '</div></div>';

    // REJEITAR
    h += '<div class="modal-bd" id="m-horas-rejeitar">';
    h += '<div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>';
    h += '<div><div class="modal-title">Rejeitar registo</div><div class="modal-sub" id="m-horas-rej-sub">—</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-rejeitar\')">✕</button></div>';
    h += '<div class="modal-body"><div class="fi"><label class="fl">Motivo da rejeição *</label>';
    h += '<textarea id="h-motivo-rej" class="fin" rows="3" placeholder="Explique porque está a rejeitar..."></textarea></div></div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-rejeitar\')">Cancelar</button>';
    h += '<button class="btn btn-danger" onclick="Horas.rejeitar()">Rejeitar</button></div>';
    h += '</div></div>';

    // APAGAR
    h += '<div class="modal-bd" id="m-horas-apagar">';
    h += '<div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></div>';
    h += '<div><div class="modal-title">Apagar registo</div><div class="modal-sub">Esta acção é irreversível</div></div>';
    h += '<button class="modal-close" onclick="closeModal(\'m-horas-apagar\')">✕</button></div>';
    h += '<div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);line-height:1.6;">Tem a certeza que quer apagar este registo de horas?</p></div>';
    h += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-horas-apagar\')">Cancelar</button>';
    h += '<button class="btn btn-danger" onclick="Horas.execApagar()">Apagar</button></div>';
    h += '</div></div>';

    return h;
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
    sel.innerHTML = '<option value="">Nenhum</option>';
    (APP.equipamentos || []).forEach(function(e) {
      if (!APP.podeVerEquipamento(e.id)) return;
      var o = document.createElement('option');
      o.value = e.id;
      o.textContent = e.nome;
      sel.appendChild(o);
    });
    // pré-seleccionar o equipamento do próprio
    if (APP.user && APP.user.equipamento_id) sel.value = APP.user.equipamento_id;
  }

  function salvar() {
    var tipo  = (document.getElementById('h-tipo')  || {}).value || 'efetuada';
    var data  = (document.getElementById('h-data')  || {}).value;
    var horas = parseFloat((document.getElementById('h-horas') || {}).value);
    var eq    = (document.getElementById('h-eq')    || {}).value || null;
    var motivo= ((document.getElementById('h-motivo') || {}).value || '').trim();

    if (!data)  { toast('Indique a data.', 'error'); return; }
    if (!horas || horas <= 0) { toast('Indique um número de horas válido.', 'error'); return; }
    if (horas > 24) { toast('O número de horas não pode exceder 24 num dia.', 'error'); return; }

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
      motivo:         motivo || null,
      estado:         'pendente',
      criado_por:     APP.user.id
    };

    // Se quem regista já é chefe/DDS, o registo entra logo aprovado
    if (_isDdsTop() || _unidadeChefe()) {
      body.estado = 'aprovado';
      body.validado_resp_por  = APP.user.id;
      body.data_valid_resp    = new Date().toISOString();
      body.validado_chefe_por = APP.user.id;
      body.data_valid_chefe   = new Date().toISOString();
    }

    sbPost('banco_horas', body).then(function(resp) {
      var criado = Array.isArray(resp) ? resp[0] : null;
      toast(body.estado === 'aprovado' ? 'Horas registadas e aprovadas.' : 'Horas registadas. A aguardar validação.', 'success');
      closeModal('m-horas-novo');
      if (body.estado === 'pendente' && criado) _notificarResponsavel(criado, func);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function(e) {
      console.error('Erro banco_horas:', e);
      toast('Erro ao registar as horas.', 'error');
    });
  }

  // ── NOTIFICAÇÕES ──────────────────────────────────────────
  // 1º nível: avisa o responsável do equipamento
  function _notificarResponsavel(r, func) {
    var destinos = [];
    var eq = getEq(r.equipamento_id);
    if (eq && eq.responsavel_id) destinos.push(eq.responsavel_id);

    // sem responsável definido → salta direto para o chefe da unidade
    if (!destinos.length) { _notificarChefe(r, func); return; }

    var tipoTxt = r.tipo === 'gozada' ? 'gozar horas' : 'horas efectuadas';
    destinos.forEach(function(uid) {
      if (uid === APP.user.id) return;
      sbPost('avisos', {
        destinatario_id: uid,
        titulo: 'Banco de horas — validação',
        mensagem: (func ? func.nome : 'Um funcionário') + ' registou ' + _fmtH(r.horas) + ' (' + tipoTxt + ') em ' + _fdata(r.data) + '. Aguarda a sua validação.',
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

    var tipoTxt = r.tipo === 'gozada' ? 'gozar horas' : 'horas efectuadas';
    (APP.utilizadores || []).filter(function(u) { return u.perfil === perfilDir; })
      .forEach(function(dir) {
        if (dir.id === APP.user.id) return;
        sbPost('avisos', {
          destinatario_id: dir.id,
          titulo: 'Banco de horas — validação final',
          mensagem: (func ? func.nome : 'Um funcionário') + ': ' + _fmtH(r.horas) + ' (' + tipoTxt + ') em ' + _fdata(r.data) + ' foi validado pelo responsável. Aguarda a sua aprovação.',
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
    var tipoTxt = r.tipo === 'gozada' ? 'horas a gozar' : 'horas efectuadas';
    sbPost('avisos', {
      destinatario_id: r.funcionario_id,
      titulo: aprovado ? 'Banco de horas — aprovado' : 'Banco de horas — rejeitado',
      mensagem: aprovado
        ? 'As suas ' + _fmtH(r.horas) + ' (' + tipoTxt + ') de ' + _fdata(r.data) + ' foram aprovadas e já contam no seu saldo.'
        : 'As suas ' + _fmtH(r.horas) + ' (' + tipoTxt + ') de ' + _fdata(r.data) + ' foram rejeitadas.' + (motivo ? ' Motivo: ' + motivo : ''),
      lido: false,
      tipo: 'notificacao',
      remetente_id: APP.user.id,
      remetente_nome: APP.user.nome
    }).catch(function() {});
  }

  // ── VALIDAÇÃO ─────────────────────────────────────────────
  function aprovar(id) {
    var r = _registos.filter(function(x) { return x.id === id; })[0];
    if (!r) return;
    var func = _getFunc(r.funcionario_id);
    var agora = new Date().toISOString();
    var body, fase;

    if (r.estado === 'pendente' && _podeValidarResp(r)) {
      // 1ª validação — se quem valida também é chefe/DDS, aprova de vez
      if (_isDdsTop() || _unidadeChefe()) {
        body = { estado: 'aprovado', validado_resp_por: APP.user.id, data_valid_resp: agora,
                 validado_chefe_por: APP.user.id, data_valid_chefe: agora };
        fase = 'aprovado';
      } else {
        body = { estado: 'validado_resp', validado_resp_por: APP.user.id, data_valid_resp: agora };
        fase = 'resp';
      }
    } else if (r.estado === 'validado_resp' && _podeValidarChefe(r)) {
      body = { estado: 'aprovado', validado_chefe_por: APP.user.id, data_valid_chefe: agora };
      fase = 'aprovado';
    } else {
      toast('Não tem permissão para validar este registo agora.', 'error');
      return;
    }

    sbPatch('banco_horas', 'id=eq.' + id, body).then(function() {
      if (fase === 'aprovado') {
        toast('Registo aprovado. Já conta no saldo.', 'success');
        _notificarFuncionario(r, true);
      } else {
        toast('Validado. Enviado ao chefe de unidade.', 'success');
        _notificarChefe(r, func);
      }
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function(e) {
      console.error('Erro ao validar:', e);
      toast('Erro ao validar.', 'error');
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
    if (!motivo) { toast('Indique o motivo da rejeição.', 'error'); return; }

    var r = _registos.filter(function(x) { return x.id === APP.actionId; })[0];

    sbPatch('banco_horas', 'id=eq.' + APP.actionId, {
      estado: 'rejeitado',
      motivo_rejeicao: motivo,
      rejeitado_por: APP.user.id
    }).then(function() {
      toast('Registo rejeitado.', 'success');
      closeModal('m-horas-rejeitar');
      if (r) _notificarFuncionario(r, false, motivo);
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function() { toast('Erro ao rejeitar.', 'error'); });
  }

  // ── APAGAR ────────────────────────────────────────────────
  function confirmarApagar(id) {
    APP.actionId = id;
    openModal('m-horas-apagar');
  }
  function execApagar() {
    if (!APP.actionId) return;
    sbDelete('banco_horas', 'id=eq.' + APP.actionId).then(function() {
      toast('Registo apagado.', 'success');
      closeModal('m-horas-apagar');
      load(function() { App.renderContent(); App.updateBadges(); });
    }).catch(function() { toast('Erro ao apagar.', 'error'); });
  }

  // ── API PÚBLICA para relatórios/badges ────────────────────
  // nº de registos à espera da validação do utilizador actual
  function pendentesParaMim() {
    if (!APP.user) return 0;
    return _registos.filter(function(r) {
      if (r.estado === 'pendente')      return _podeValidarResp(r);
      if (r.estado === 'validado_resp') return _podeValidarChefe(r);
      return false;
    }).length;
  }

  function registos() { return _registos; }

  function init() {}

  return {
    render: render, init: init, load: load,
    openNovo: openNovo, salvar: salvar,
    aprovar: aprovar, openRejeitar: openRejeitar, rejeitar: rejeitar,
    confirmarApagar: confirmarApagar, execApagar: execApagar,
    saldoDe: saldoDe, registos: registos, pendentesParaMim: pendentesParaMim,
    fmtH: _fmtH
  };

})();

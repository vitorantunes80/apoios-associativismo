// ============================================================
// GestDDS — ferias.js  v1.0
// Sistema de marcação e validação de férias
// Funcionário marca → dirigente da unidade (UDAJ/UASE) valida
// ============================================================

var Ferias = (function() {

  var _ferias = [];

  // ── CARREGAR ──────────────────────────────────────────────
  function load(cb) {
    sbGet('ferias', 'order=data_inicio.desc').then(function(d) {
      _ferias = Array.isArray(d) ? d : [];
      if (cb) cb();
    }).catch(function() { _ferias = []; if (cb) cb(); });
  }

  function todas() { return _ferias; }

  // ── PERMISSÕES ────────────────────────────────────────────
  // dirigente valida as férias dos funcionários da SUA unidade
  function _ehDirigente() {
    return APP.user && ['supervisor_udaj','supervisor_uase','admin'].indexOf(APP.user.perfil) >= 0;
  }
  function _unidadeDoDirigente() {
    if (!APP.user) return null;
    if (APP.user.perfil === 'supervisor_udaj') return 'UDAJ';
    if (APP.user.perfil === 'supervisor_uase') return 'UASE';
    return null; // admin vê todas
  }
  function _podeValidar(f) {
    if (!_ehDirigente()) return false;
    if (APP.user.perfil === 'admin') return true;
    var func = _getFunc(f.funcionario_id);
    if (!func) return false;
    return func.unidade === _unidadeDoDirigente();
  }

  function _getFunc(id) {
    return (APP.utilizadores || []).filter(function(u) { return u.id === id; })[0];
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────
  function render() {
    if (!APP.user) return '';

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Férias</div>';
    html += '<div class="dash-sub">' + (_ehDirigente() ? 'Validação e gestão de férias.' : 'Marcação e acompanhamento das suas férias.') + '</div></div>';
    html += '<button class="btn btn-primary btn-sm" onclick="Ferias.openMarcar()">+ Marcar férias</button>';
    html += '</div>';

    if (_ehDirigente()) {
      html += _renderDirigente();
    } else {
      html += _renderFuncionario();
    }
    return html;
  }

  // ── VISTA FUNCIONÁRIO (as suas férias) ────────────────────
  function _renderFuncionario() {
    var minhas = _ferias.filter(function(f) { return f.funcionario_id === APP.user.id; });
    minhas.sort(function(a, b) { return new Date(b.data_inicio) - new Date(a.data_inicio); });

    if (!minhas.length) {
      return '<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px;border:1px dashed var(--border);border-radius:var(--r);">Ainda não marcou férias.<br><br><button class="btn btn-primary btn-sm" onclick="Ferias.openMarcar()">Marcar as primeiras férias</button></div>';
    }

    var html = '<div class="dtw"><table class="dt"><thead><tr><th>Período</th><th>Dias</th><th>Estado</th><th>Observações</th></tr></thead><tbody>';
    minhas.forEach(function(f) {
      html += '<tr>';
      html += '<td class="td-p">' + fData(f.data_inicio) + ' → ' + fData(f.data_fim) + '</td>';
      html += '<td class="td-mono">' + (f.dias_uteis || _diasEntre(f.data_inicio, f.data_fim)) + '</td>';
      html += '<td>' + _badgeEstado(f.estado) + '</td>';
      html += '<td class="td-m">' + H(f.observacoes || '—');
      if (f.estado === 'rejeitada' && f.motivo_rejeicao) html += '<div style="color:var(--red);font-size:11px;">Motivo: ' + H(f.motivo_rejeicao) + '</div>';
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // ── VISTA DIRIGENTE (validar) ─────────────────────────────
  function _renderDirigente() {
    var unidade = _unidadeDoDirigente();
    // filtrar férias dos funcionários da sua unidade (admin vê todas)
    var relevantes = _ferias.filter(function(f) {
      if (APP.user.perfil === 'admin') return true;
      var func = _getFunc(f.funcionario_id);
      return func && func.unidade === unidade;
    });

    var pendentes = relevantes.filter(function(f) { return f.estado === 'pendente'; });
    var outras    = relevantes.filter(function(f) { return f.estado !== 'pendente'; });
    outras.sort(function(a, b) { return new Date(b.data_inicio) - new Date(a.data_inicio); });

    var html = '';

    // pendentes de validação
    html += '<div class="sec-head"><div class="sec-title">Pendentes de validação';
    if (pendentes.length) html += ' <span style="background:var(--amber);color:#fff;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;">' + pendentes.length + '</span>';
    html += '</div></div>';

    if (!pendentes.length) {
      html += '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12.5px;border:1px dashed var(--border);border-radius:var(--r);margin-bottom:20px;">Sem pedidos por validar.</div>';
    } else {
      pendentes.forEach(function(f) {
        var func = _getFunc(f.funcionario_id);
        var sobrepos = _sobreposicoes(f);
        html += '<div style="border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px;background:var(--surface);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">';
        html += '<div><div style="font-weight:700;font-size:14px;color:var(--text);">' + H(func ? func.nome : 'Funcionário') + '</div>';
        html += '<div style="font-size:12.5px;color:var(--text-2);margin-top:2px;">' + fData(f.data_inicio) + ' → ' + fData(f.data_fim) + ' · <strong>' + (f.dias_uteis || _diasEntre(f.data_inicio, f.data_fim)) + ' dias</strong></div>';
        if (func && func.equipamento_id) {
          var eq = getEq(func.equipamento_id);
          if (eq) html += '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">📍 ' + H(eq.nome) + '</div>';
        }
        if (f.observacoes) html += '<div style="font-size:12px;color:var(--text-2);margin-top:4px;font-style:italic;">"' + H(f.observacoes) + '"</div>';
        html += '</div>';
        html += '</div>';

        // aviso de sobreposição
        if (sobrepos.length) {
          html += '<div style="margin-top:10px;padding:10px;background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;">';
          html += '<div style="font-size:12.5px;font-weight:700;color:var(--amber);margin-bottom:4px;">⚠️ Sobreposição no mesmo equipamento</div>';
          sobrepos.forEach(function(s) {
            var sf = _getFunc(s.funcionario_id);
            html += '<div style="font-size:11.5px;color:var(--text-2);">• ' + H(sf ? sf.nome : '?') + ': ' + fData(s.data_inicio) + ' → ' + fData(s.data_fim) + ' (' + _labelEstado(s.estado) + ')</div>';
          });
          html += '</div>';
        }

        html += '<div style="display:flex;gap:8px;margin-top:12px;">';
        html += '<button class="btn btn-success btn-sm" onclick="Ferias.aprovar(\'' + f.id + '\')">✓ Aprovar</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="Ferias.openRejeitar(\'' + f.id + '\')">✕ Rejeitar</button>';
        html += '</div>';
        html += '</div>';
      });
    }

    // histórico
    if (outras.length) {
      html += '<div class="sec-head" style="margin-top:8px;"><div class="sec-title">Histórico</div></div>';
      html += '<div class="dtw"><table class="dt"><thead><tr><th>Funcionário</th><th>Período</th><th>Dias</th><th>Estado</th></tr></thead><tbody>';
      outras.forEach(function(f) {
        var func = _getFunc(f.funcionario_id);
        html += '<tr><td class="td-p">' + H(func ? func.nome : '—') + '</td>';
        html += '<td class="td-m">' + fData(f.data_inicio) + ' → ' + fData(f.data_fim) + '</td>';
        html += '<td class="td-mono">' + (f.dias_uteis || _diasEntre(f.data_inicio, f.data_fim)) + '</td>';
        html += '<td>' + _badgeEstado(f.estado) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    return html;
  }

  // ── SOBREPOSIÇÕES (mesmo equipamento, datas cruzadas) ─────
  function _sobreposicoes(f) {
    var func = _getFunc(f.funcionario_id);
    if (!func || !func.equipamento_id) return [];
    var ini = new Date(f.data_inicio), fim = new Date(f.data_fim);

    return _ferias.filter(function(o) {
      if (o.id === f.id) return false;
      if (o.estado === 'rejeitada') return false;
      var of = _getFunc(o.funcionario_id);
      if (!of || of.equipamento_id !== func.equipamento_id) return false;
      // datas cruzam-se?
      var oi = new Date(o.data_inicio), ofim = new Date(o.data_fim);
      return ini <= ofim && oi <= fim;
    });
  }

  // ── MARCAR FÉRIAS ─────────────────────────────────────────
  function openMarcar() {
    var hoje = new Date().toISOString().split('T')[0];
    document.getElementById('fer-inicio').value = '';
    document.getElementById('fer-fim').value = '';
    document.getElementById('fer-obs').value = '';
    var av = document.getElementById('fer-aviso'); if (av) av.style.display = 'none';
    openModal('m-ferias');
  }

  function _onDatasChange() {
    var ini = document.getElementById('fer-inicio').value;
    var fim = document.getElementById('fer-fim').value;
    var info = document.getElementById('fer-dias-info');
    if (ini && fim && info) {
      var d = _diasEntre(ini, fim);
      info.textContent = d > 0 ? (d + ' dia(s) útil(eis)') : 'Datas inválidas';
      info.style.color = d > 0 ? 'var(--accent)' : 'var(--red)';
    } else if (info) {
      info.textContent = '';
    }
  }

  function marcar() {
    var ini = document.getElementById('fer-inicio').value;
    var fim = document.getElementById('fer-fim').value;
    var obs = (document.getElementById('fer-obs').value || '').trim();

    if (!ini || !fim) { toast('Indique as datas de início e fim.', 'error'); return; }
    if (new Date(fim) < new Date(ini)) { toast('A data de fim não pode ser anterior à de início.', 'error'); return; }

    var dias = _diasEntre(ini, fim);

    var body = {
      funcionario_id: APP.user.id,
      data_inicio: ini,
      data_fim: fim,
      dias_uteis: dias,
      observacoes: obs || null,
      estado: 'pendente'
    };

    sbPost('ferias', body).then(function() {
      toast('Férias marcadas. Aguardam validação do dirigente.', 'success');
      closeModal('m-ferias');
      // avisar o dirigente da unidade
      _avisarDirigente(body);
      load(function() { App.renderContent(); });
    }).catch(function() {
      toast('Erro ao marcar férias.', 'error');
    });
  }

  function _avisarDirigente(f) {
    var func = APP.user;
    if (!func.unidade) return;
    // encontrar o dirigente da unidade
    var perfilDir = func.unidade === 'UDAJ' ? 'supervisor_udaj' : func.unidade === 'UASE' ? 'supervisor_uase' : null;
    if (!perfilDir) return;
    var dirigentes = (APP.utilizadores || []).filter(function(u) { return u.perfil === perfilDir; });
    dirigentes.forEach(function(dir) {
      sbPost('avisos', {
        destinatario_id: dir.id,
        titulo: 'Pedido de férias',
        mensagem: func.nome + ' marcou férias de ' + fData(f.data_inicio) + ' a ' + fData(f.data_fim) + '. Aguarda validação.',
        lido: false,
        tipo: 'notificacao',
        remetente_id: func.id,
        remetente_nome: func.nome
      }).catch(function() {});
    });
  }

  // ── APROVAR / REJEITAR ────────────────────────────────────
  function aprovar(id) {
    var f = _ferias.filter(function(x) { return x.id === id; })[0];
    if (!f) return;
    if (!_podeValidar(f)) { toast('Sem permissão para validar estas férias.', 'error'); return; }

    sbPatch('ferias', 'id=eq.' + id, {
      estado: 'aprovada',
      validado_por: APP.user.id,
      data_validacao: new Date().toISOString()
    }).then(function() {
      toast('Férias aprovadas.', 'success');
      _avisarFuncionario(f, true, null);
      _criarTurnoFerias(f);
      load(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao aprovar.', 'error'); });
  }

  function openRejeitar(id) {
    document.getElementById('fer-rej-id').value = id;
    document.getElementById('fer-rej-motivo').value = '';
    openModal('m-ferias-rejeitar');
  }

  function rejeitar() {
    var id = document.getElementById('fer-rej-id').value;
    var motivo = (document.getElementById('fer-rej-motivo').value || '').trim();
    var f = _ferias.filter(function(x) { return x.id === id; })[0];
    if (!f) return;

    sbPatch('ferias', 'id=eq.' + id, {
      estado: 'rejeitada',
      validado_por: APP.user.id,
      data_validacao: new Date().toISOString(),
      motivo_rejeicao: motivo || null
    }).then(function() {
      toast('Férias rejeitadas.', 'success');
      closeModal('m-ferias-rejeitar');
      _avisarFuncionario(f, false, motivo);
      load(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao rejeitar.', 'error'); });
  }

  function _avisarFuncionario(f, aprovada, motivo) {
    var msg = aprovada
      ? 'As suas férias de ' + fData(f.data_inicio) + ' a ' + fData(f.data_fim) + ' foram aprovadas.'
      : 'As suas férias de ' + fData(f.data_inicio) + ' a ' + fData(f.data_fim) + ' foram rejeitadas.' + (motivo ? ' Motivo: ' + motivo : '');
    sbPost('avisos', {
      destinatario_id: f.funcionario_id,
      titulo: aprovada ? 'Férias aprovadas' : 'Férias rejeitadas',
      mensagem: msg,
      lido: false,
      tipo: 'notificacao',
      remetente_id: APP.user.id,
      remetente_nome: APP.user.nome
    }).catch(function() {});
  }

  // criar turno de férias na escala do equipamento (se afecto)
  function _criarTurnoFerias(f) {
    var func = _getFunc(f.funcionario_id);
    if (!func || !func.equipamento_id) return;
    sbPost('escalas', {
      equipamento_id: func.equipamento_id,
      funcionario_id: f.funcionario_id,
      data_inicio: f.data_inicio,
      data_fim: f.data_fim,
      tipo_turno: 'ferias',
      funcao: 'Férias'
    }).catch(function() {});
  }

  // ── HELPERS ───────────────────────────────────────────────
  function _diasEntre(ini, fim) {
    // conta dias úteis (seg-sex)
    var d = new Date(ini), f = new Date(fim), n = 0;
    while (d <= f) {
      var dow = d.getDay();
      if (dow !== 0 && dow !== 6) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  function _badgeEstado(e) {
    if (e === 'aprovada') return '<span class="bdg bdg-concluido"><span class="bdg-dot"></span>Aprovada</span>';
    if (e === 'rejeitada') return '<span class="bdg bdg-inativo">Rejeitada</span>';
    return '<span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span>';
  }
  function _labelEstado(e) {
    return e === 'aprovada' ? 'aprovada' : e === 'rejeitada' ? 'rejeitada' : 'pendente';
  }

  // ── MODAIS HTML ───────────────────────────────────────────
  function getModaisHTML() {
    var html = '';
    // marcar férias
    html += '<div class="modal-bd" id="m-ferias">';
    html += '<div class="modal" style="max-width:440px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div class="modal-title">Marcar férias</div><div class="modal-sub">Pedido sujeito a validação</div></div><button class="modal-close" onclick="closeModal(\'m-ferias\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Data de início</label><input type="date" id="fer-inicio" class="fin" onchange="Ferias._onDatasChange()"></div>';
    html += '<div class="fi"><label class="fl">Data de fim</label><input type="date" id="fer-fim" class="fin" onchange="Ferias._onDatasChange()"></div></div>';
    html += '<div id="fer-dias-info" style="font-size:12.5px;font-weight:600;margin-bottom:10px;"></div>';
    html += '<div class="fi"><label class="fl">Observações</label><textarea id="fer-obs" class="fin" rows="2" placeholder="Opcional"></textarea></div>';
    html += '<div id="fer-aviso" style="display:none;"></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-ferias\')">Cancelar</button><button class="btn btn-primary" onclick="Ferias.marcar()">Submeter pedido</button></div>';
    html += '</div></div>';

    // rejeitar
    html += '<div class="modal-bd" id="m-ferias-rejeitar">';
    html += '<div class="modal" style="max-width:400px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div><div class="modal-title">Rejeitar férias</div></div><button class="modal-close" onclick="closeModal(\'m-ferias-rejeitar\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<input type="hidden" id="fer-rej-id">';
    html += '<div class="fi"><label class="fl">Motivo da rejeição</label><textarea id="fer-rej-motivo" class="fin" rows="3" placeholder="Explique porque não pode aprovar..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-ferias-rejeitar\')">Cancelar</button><button class="btn btn-danger" onclick="Ferias.rejeitar()">Rejeitar férias</button></div>';
    html += '</div></div>';

    return html;
  }

  function init() {
    var host = document.getElementById('modals-host') || document.body;
    if (host && !document.getElementById('m-ferias')) {
      var div = document.createElement('div');
      div.innerHTML = getModaisHTML();
      while (div.firstChild) host.appendChild(div.firstChild);
    }
  }

  return {
    render: render, init: init, load: load, todas: todas,
    openMarcar: openMarcar, marcar: marcar,
    aprovar: aprovar, openRejeitar: openRejeitar, rejeitar: rejeitar,
    _onDatasChange: _onDatasChange
  };

})();

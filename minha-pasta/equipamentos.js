// ============================================================
// GestDDS — equipamentos.js
// Módulo de Equipamentos (lista, tipos, ficha)
// ============================================================

var Equipamentos = (function() {

  // ── RENDER ────────────────────────────────────────────────
  function render(subview) {
    switch (subview) {
      case 'tipos': return _renderTipos();
      case 'ficha': return _renderFicha();
      default:      return _renderLista();
    }
  }

  // ── LISTA ─────────────────────────────────────────────────
  function _renderLista() {
    var isAdmin = APP.isAdmin();
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Equipamentos</div>';
    html += '<div class="dash-sub">Todos os equipamentos da divisão.</div></div>';
    if (isAdmin) {
      html += '<button class="btn btn-primary" onclick="Equipamentos.openNovo()">+ Novo equipamento</button>';
    }
    html += '</div>';

    if (!APP.equipamentos.length) return html + emptyState('Sem equipamentos', 'Crie o primeiro equipamento para começar.');

    // só os equipamentos visíveis para este perfil
    var visiveis = APP.equipamentos.filter(function(e) { return APP.podeVerEquipamento(e.id); });
    if (!visiveis.length) return html + emptyState('Sem equipamentos', 'Não há equipamentos atribuídos a si.');

    // mini stats
    var ativos  = visiveis.filter(function(e) { return e.estado === 'ativo'; }).length;
    var manut   = visiveis.filter(function(e) { return e.estado === 'manutencao'; }).length;
    var inativo = visiveis.filter(function(e) { return e.estado === 'inativo'; }).length;

    html += '<div class="stats-grid stats-grid-3" style="margin-bottom:20px;">';
    html += _statCard('si-green', ativos,  'Activos');
    html += _statCard('si-amber', manut,   'Em manutenção');
    html += _statCard('si-red',   inativo, 'Inactivos');
    html += '</div>';

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Código</th><th>Equipamento</th><th>Tipo</th><th>Localidade</th><th>Módulos</th><th>Estado</th><th></th></tr></thead>';
    html += '<tbody>';

    visiveis.forEach(function(e, idx) {
      var tipo = getTipo(e.tipo_id);
      var cor  = EQ_COLORS[idx % EQ_COLORS.length];

      html += '<tr>';
      html += '<td class="td-mono">' + H(e.codigo || '—') + '</td>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="Equipamentos.abrirFicha(\'' + e.id + '\')">';
      html += '<span style="width:8px;height:8px;border-radius:50%;background:' + cor + ';flex-shrink:0;display:inline-block;"></span>';
      html += '<span class="td-p">' + H(e.nome) + '</span></div>';
      if (e.morada) html += '<div class="td-m" style="padding-left:16px;">' + H(e.morada) + '</div>';
      html += '</td>';
      html += '<td><span class="bdg" style="background:var(--teal-bg);color:var(--teal);">' + H(tipo ? tipo.nome : '—') + '</span></td>';
      html += '<td class="td-m">' + H(e.localidade || '—') + '</td>';
      html += '<td>' + modChips(tipo) + '</td>';
      html += '<td>' + badgeEqEstado(e.estado) + '</td>';
      html += '<td><div class="td-act">';
      html += '<button class="btn btn-secondary btn-sm" onclick="Equipamentos.abrirFicha(\'' + e.id + '\')">Ver ficha</button>';
      if (isAdmin) {
        html += ' <button class="btn btn-ghost btn-sm" onclick="Equipamentos.openEditar(\'' + e.id + '\')">Editar</button>';
      }
      html += '</div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  // ── TIPOS ─────────────────────────────────────────────────
  function _renderTipos() {
    if (!APP.isAdmin()) return accessDenied();

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Tipos de Equipamento</div>';
    html += '<div class="dash-sub">Configure os módulos disponíveis por tipo.</div></div>';
    html += '<button class="btn btn-primary" onclick="Equipamentos.openNovoTipo()">+ Novo tipo</button>';
    html += '</div>';

    if (!APP.tiposEq.length) return html + emptyState('Sem tipos', 'Crie o primeiro tipo de equipamento.');

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th></th><th>Tipo</th><th>Módulos activos</th><th>Equipamentos</th><th></th></tr></thead>';
    html += '<tbody>';

    APP.tiposEq.forEach(function(t) {
      var nEq = APP.equipamentos.filter(function(e) { return e.tipo_id === t.id; }).length;
      html += '<tr>';
      html += '<td style="font-size:22px;text-align:center;">' + H(t.emoji || '🏢') + '</td>';
      html += '<td><div class="td-p">' + H(t.nome) + '</div>' + (t.descricao ? '<div class="td-m">' + H(t.descricao) + '</div>' : '') + '</td>';
      html += '<td>' + modChips(t) + '</td>';
      html += '<td class="td-mono">' + nEq + '</td>';
      html += '<td><div class="td-act"><button class="btn btn-ghost btn-sm" onclick="Equipamentos.openEditarTipo(\'' + t.id + '\')">Editar</button></div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  // ── FICHA ─────────────────────────────────────────────────
  function _renderFicha() {
    var eq = APP.equipamentos.filter(function(e) { return e.id === APP.spotEqId; })[0] || null;
    if (!eq) return emptyState('Equipamento não encontrado', 'Seleccione um equipamento na lista.');

    var tipo = getTipo(eq.tipo_id);

    var html = '<div style="margin-bottom:14px;">';
    html += '<button class="btn btn-ghost btn-sm" onclick="App.nav(\'equipamentos\',\'lista\')">← Voltar à lista</button>';
    html += '</div>';

    // Header card
    html += '<div class="eq-spotlight">';
    html += '<div class="eqs-hdr">';
    html += '<div class="eqs-left">';
    html += '<span class="eqs-emoji">' + (tipo ? (tipo.emoji || '🏢') : '🏢') + '</span>';
    html += '<div>';
    html += '<div class="eqs-title">' + H(eq.nome) + '</div>';
    html += '<div style="font-size:12.5px;color:var(--text-3);">' + H(tipo ? tipo.nome : 'Sem tipo') + '</div>';
    html += '</div></div>';
    html += badgeEqEstado(eq.estado);
    if (APP.isAdmin()) {
      html += ' <button class="btn btn-secondary btn-sm" onclick="Equipamentos.openEditar(\'' + eq.id + '\')">Editar</button>';
    }
    html += '</div>';

    // Tabs — módulos activos deste equipamento (tipo + override do equipamento)
    var tabs = [{ id: 'info', label: 'Informações' }];
    MOD_DEFS.forEach(function(m) {
      if (!modAtivo(eq, m.k)) return;
      // check-in/check-out exige autorização específica
      if (m.k === 'estadias' && typeof APP.podeVerEstadias === 'function' && !APP.podeVerEstadias(eq.id)) return;
      if (m.k === 'visitas' && typeof APP.podeVerVisitas === 'function' && !APP.podeVerVisitas(eq.id)) return;
      tabs.push({ id: m.k, label: m.l });
    });

    html += '<div class="eq-tabs">';
    tabs.forEach(function(t, i) {
      html += '<div class="eq-tab' + (i === 0 ? ' active' : '') + '" onclick="Equipamentos.switchTab(this, \'ftab-' + t.id + '\')">' + t.label + '</div>';
    });
    html += '</div>';

    // Tab panels
    html += '<div>';

    // Info tab
    html += '<div class="eq-tab-panel active" id="ftab-info" style="padding:16px;">';
    html += '<div class="detail-box">';
    html += '<div class="detail-row"><span class="detail-lbl">Código</span><span class="detail-val td-mono">' + H(eq.codigo || '—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Morada</span><span class="detail-val">' + H(eq.morada || '—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Localidade</span><span class="detail-val">' + H(eq.localidade || '—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Telefone</span><span class="detail-val">' + H(eq.telefone || '—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Capacidade</span><span class="detail-val">' + (eq.capacidade ? eq.capacidade + ' pessoas' : '—') + '</span></div>';
    if (eq.descricao) html += '<div class="detail-row"><span class="detail-lbl">Notas</span><span class="detail-val">' + H(eq.descricao) + '</span></div>';
    html += '</div>';

    // Secção de espaços/valências
    var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === eq.id; });
    espacos.sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
    html += '<div class="sec-head" style="margin-top:18px;"><div class="sec-title">Espaços / Valências para reservas</div>';
    if (APP.isAdmin()) html += '<button class="btn btn-primary btn-sm" onclick="Equipamentos.gerirEspacos(\'' + eq.id + '\')">⚙ Gerir espaços</button>';
    html += '</div>';
    if (!espacos.length) {
      html += '<div style="padding:14px;background:var(--bg);border:1px dashed var(--border);border-radius:var(--r);font-size:12.5px;color:var(--text-3);text-align:center;">Sem espaços definidos. ' + (APP.isAdmin() ? 'Clique em "Gerir espaços" para adicionar.' : '') + '</div>';
    } else {
      html += '<div class="dtw"><table class="dt"><thead><tr><th>Espaço</th><th>Contagem 1</th><th>Contagem 2</th></tr></thead><tbody>';
      espacos.forEach(function(esp) {
        html += '<tr><td class="td-p">' + H(esp.nome) + '</td>';
        html += '<td class="td-m">' + H(esp.label_contagem || '—') + '</td>';
        html += '<td class="td-m">' + H(esp.label_contagem2 || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // Módulos activos — conteúdo real
    MOD_DEFS.forEach(function(m) {
      if (!modAtivo(eq, m.k)) return;
        html += '<div class="eq-tab-panel" id="ftab-' + m.k + '" style="padding:16px;">';
        if (m.k === 'reservas' && typeof Reservas !== 'undefined') {
          html += '<div id="ftab-reservas-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
        } else if (m.k === 'escalas' && typeof Escalas !== 'undefined') {
          html += '<div id="ftab-escalas-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
        } else if (m.k === 'checklist' && typeof Checklist !== 'undefined') {
          html += '<div id="ftab-checklist-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
        } else if (m.k === 'estadias' && typeof Estadias !== 'undefined') {
          html += '<div id="ftab-estadias-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
        } else if (m.k === 'visitas' && typeof Visitas !== 'undefined') {
          html += '<div id="ftab-visitas-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
        } else if (m.k === 'funcionarios') {
          html += _painelFuncionarios(eq);
        } else if (m.k === 'responsavel') {
          html += _painelResponsavel(eq);
        } else {
          html += '<div class="mod-ph"><div class="mod-ph-t">' + m.l + '</div><div class="mod-ph-s">' + m.s + '</div></div>';
        }
        html += '</div>';
    });

    html += '</div></div>'; // panels + spotlight
    return html;
  }

  // ── PAINEL: Funcionários afectos a ESTE equipamento ────────
  // Filtra pelo equipamento (principal + adicionais), não pelo tipo/complexo.
  // ── PAINEL: Responsável do equipamento ────────────────────
  function _painelResponsavel(eq) {
    var resp = eq.responsavel_id
      ? (APP.utilizadores || []).filter(function(u) { return u.id === eq.responsavel_id; })[0]
      : null;

    var podeEditar = APP.podeGerirEquipamento ? APP.podeGerirEquipamento(eq.id) : false;

    if (!resp) {
      var h0 = '<div class="mod-ph"><div class="mod-ph-t">Sem responsável atribuído</div>';
      h0 += '<div class="mod-ph-s">Ainda não foi definido um responsável técnico para ' + H(eq.nome) + '.';
      if (podeEditar) h0 += '<br>Atribua na ficha do equipamento (Editar → Responsável).';
      h0 += '</div>';
      if (podeEditar) {
        h0 += '<div style="margin-top:12px;"><button class="btn btn-primary btn-sm" onclick="Equipamentos.openEditar(\'' + eq.id + '\')">Atribuir responsável</button></div>';
      }
      h0 += '</div>';
      return h0;
    }

    // iniciais para o avatar
    var partes = (resp.nome || '').trim().split(/\s+/);
    var ini = (partes[0] || '').charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '');
    ini = ini.toUpperCase();

    // equipamentos por que responde
    var outros = (APP.equipamentos || []).filter(function(e) {
      return e.responsavel_id === resp.id && e.id !== eq.id;
    });

    // equipa que tem a seu cargo neste equipamento
    var equipa = (typeof funcsDoEq === 'function') ? funcsDoEq(eq.id) : [];
    var nEquipa = equipa.filter(function(u) { return u.id !== resp.id; }).length;

    var h = '<div class="card">';

    // cartão principal
    h += '<div style="display:flex;align-items:center;gap:14px;padding:4px 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px;">';
    h += '<div style="width:52px;height:52px;border-radius:50%;background:var(--accent-light);color:var(--accent-dark);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">' + H(ini) + '</div>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-size:17px;font-weight:700;color:var(--text);">' + H(resp.nome) + '</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-top:2px;">' + H(resp.cargo || _labelPerfil(resp.perfil)) + '</div>';
    h += '<div style="margin-top:6px;">';
    h += '<span style="display:inline-block;font-size:11px;font-weight:700;background:var(--accent-light);color:var(--accent-dark);border-radius:20px;padding:2px 9px;">Responsável técnico</span>';
    if (resp.unidade) {
      h += '<span style="display:inline-block;font-size:11px;font-weight:600;background:var(--bg);color:var(--text-2);border-radius:20px;padding:2px 9px;margin-left:5px;">' + H(resp.unidade) + '</span>';
    }
    h += '</div>';
    h += '</div>';
    if (podeEditar) {
      h += '<button class="btn btn-ghost btn-sm" onclick="Equipamentos.openEditar(\'' + eq.id + '\')">Alterar</button>';
    }
    h += '</div>';

    // contactos
    h += '<div class="form-sec-t" style="margin-top:0;">Contactos</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px;">';
    h += _linhaInfo('Email', resp.email || '—', resp.email ? 'mailto:' + resp.email : null);
    h += _linhaInfo('Telefone', resp.telefone || '—', resp.telefone ? 'tel:' + resp.telefone : null);
    h += _linhaInfo('Código de acesso', resp.codigo || '—');
    h += _linhaInfo('Vínculo', resp.vinculo || '—');
    h += '</div>';

    // âmbito da responsabilidade
    h += '<div class="form-sec-t">Âmbito</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">';

    h += '<div style="background:var(--bg);border-radius:8px;padding:11px 13px;">';
    h += '<div style="font-size:20px;font-weight:800;color:var(--accent);">' + nEquipa + '</div>';
    h += '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">' + (nEquipa === 1 ? 'funcionário a cargo' : 'funcionários a cargo') + '</div>';
    h += '</div>';

    h += '<div style="background:var(--bg);border-radius:8px;padding:11px 13px;">';
    h += '<div style="font-size:20px;font-weight:800;color:var(--accent);">' + (outros.length + 1) + '</div>';
    h += '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">' + (outros.length ? 'equipamentos sob responsabilidade' : 'equipamento') + '</div>';
    h += '</div>';

    h += '</div>';

    if (outros.length) {
      h += '<div style="margin-top:12px;">';
      h += '<div style="font-size:12px;color:var(--text-3);margin-bottom:6px;">Responde também por:</div>';
      outros.forEach(function(e) {
        h += '<span style="display:inline-block;font-size:12px;background:var(--bg);color:var(--text-2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;margin:0 4px 4px 0;cursor:pointer;" onclick="Dashboard.selectSpot(\'' + e.id + '\')">' + H(e.nome) + '</span>';
      });
      h += '</div>';
    }

    h += '<p style="font-size:11.5px;color:var(--text-3);line-height:1.6;margin:16px 0 0;padding-top:12px;border-top:1px solid var(--border);">';
    h += 'O responsável faz a escala deste equipamento, valida os pedidos de banco de horas da sua equipa e acompanha os memorandos de manutenção.';
    h += '</p>';

    h += '</div>';
    return h;
  }

  function _linhaInfo(label, valor, link) {
    var h = '<div>';
    h += '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px;">' + H(label) + '</div>';
    if (link && valor !== '—') {
      h += '<a href="' + H(link) + '" style="font-size:13.5px;color:var(--accent);text-decoration:none;font-weight:500;word-break:break-word;">' + H(valor) + '</a>';
    } else {
      h += '<div style="font-size:13.5px;color:' + (valor === '—' ? 'var(--text-3)' : 'var(--text)') + ';font-weight:500;word-break:break-word;">' + H(valor) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function _labelPerfil(p) {
    var M = {
      admin: 'Administrador',
      responsavel_dds: 'Responsável DDS',
      supervisor_udaj: 'Chefe de Unidade — UDAJ',
      supervisor_uase: 'Chefe de Unidade — UASE',
      responsavel: 'Responsável de equipamento',
      professor_responsavel: 'Professor responsável',
      funcionario: 'Funcionário'
    };
    return M[p] || p || '—';
  }

  function _painelFuncionarios(eq) {
    var funcs = (typeof funcsDoEq === 'function')
      ? funcsDoEq(eq.id)
      : APP.utilizadores.filter(function(u) { return u.equipamento_id === eq.id; });

    funcs = funcs.slice().sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); });

    if (!funcs.length) {
      return '<div class="mod-ph"><div class="mod-ph-t">Sem funcionários afectos</div><div class="mod-ph-s">Nenhum funcionário está afecto a ' + H(eq.nome) + '. Atribua em Funcionários → Equipamento.</div></div>';
    }

    var temHoras = (typeof Horas !== 'undefined' && Horas.saldoDe);

    var h = '<div style="padding:2px 0 4px;font-size:12.5px;color:var(--text-3);">' + funcs.length + ' funcionário(s) afecto(s) a <strong>' + H(eq.nome) + '</strong></div>';

    // horas registadas NESTE equipamento
    var horasEq = {};
    if (temHoras) {
      Horas.registos().forEach(function(r) {
        if (r.equipamento_id !== eq.id || r.estado !== 'aprovado') return;
        if (!horasEq[r.funcionario_id]) horasEq[r.funcionario_id] = 0;
        horasEq[r.funcionario_id] += (r.tipo === 'gozada' ? -1 : 1) * (parseFloat(r.horas) || 0);
      });
    }

    h += '<div class="dtw"><table class="dt">';
    h += '<thead><tr><th>Funcionário</th><th>Função</th><th>Vínculo</th>';
    if (temHoras) h += '<th>Serviço aqui</th><th>Saldo total</th>';
    h += '</tr></thead><tbody>';

    funcs.forEach(function(u) {
      var principal = (u.equipamento_id === eq.id);
      h += '<tr>';
      h += '<td><span class="td-p">' + H(u.nome) + '</span>';
      if (!principal) h += '<div class="td-m" style="font-size:10.5px;color:var(--accent);">Apoio (equipamento adicional)</div>';
      if (u.unidade === 'EXTERNA') h += '<div class="td-m" style="font-size:10.5px;color:var(--amber);">Externo — ' + H(u.divisao_origem || 'outra divisão') + '</div>';
      h += '</td>';
      h += '<td class="td-m">' + H(u.funcao || '—') + '</td>';
      h += '<td class="td-m">' + H(u.vinculo || '—') + '</td>';
      if (temHoras) {
        var aqui = horasEq[u.id] || 0;
        var s = Horas.saldoDe(u.id);
        var cor = s.saldo > 0 ? 'var(--green)' : (s.saldo < 0 ? 'var(--red)' : 'var(--text-2)');
        h += '<td class="td-m">' + (aqui ? Horas.fmtH(aqui) : '—') + '</td>';
        h += '<td><strong style="color:' + cor + ';">' + Horas.fmtH(s.saldo) + '</strong></td>';
      }
      h += '</tr>';
    });

    h += '</tbody></table></div>';

    if (temHoras) {
      h += '<p style="font-size:11.5px;color:var(--text-3);margin:8px 0 0;line-height:1.5;">';
      h += '<strong>Serviço aqui</strong>: horas autorizadas com este equipamento indicado. <strong>Saldo total</strong>: banco de horas da pessoa em toda a DDS.';
      h += '</p>';
    }

    return h;
  }

  // ── TAB SWITCH ────────────────────────────────────────────
  function switchTab(el, panelId) {
    el.parentNode.querySelectorAll('.eq-tab').forEach(function(t) { t.classList.remove('active'); });
    el.classList.add('active');
    var parent = el.parentNode.nextSibling;
    if (parent) {
      parent.querySelectorAll('.eq-tab-panel').forEach(function(p) { p.classList.remove('active'); });
    }
    var target = document.getElementById(panelId);
    if (target) target.classList.add('active');

    // carregar conteúdo do módulo se necessário
    var eqId = APP.spotEqId;
    if (panelId === 'ftab-reservas' && typeof Reservas !== 'undefined') {
      Reservas.load(function() {
        var cont = document.getElementById('ftab-reservas-content');
        if (cont) cont.innerHTML = Reservas.render(eqId);
      });
    } else if (panelId === 'ftab-escalas' && typeof Escalas !== 'undefined') {
      Escalas.load(function() {
        var cont = document.getElementById('ftab-escalas-content');
        if (cont) cont.innerHTML = Escalas.render(eqId);
      });
    } else if (panelId === 'ftab-checklist' && typeof Checklist !== 'undefined') {
      Checklist.load(function() {
        var cont = document.getElementById('ftab-checklist-content');
        if (cont) cont.innerHTML = Checklist.render(eqId);
      });
    } else if (panelId === 'ftab-estadias' && typeof Estadias !== 'undefined') {
      Estadias.load(eqId, function() {
        var cont = document.getElementById('ftab-estadias-content');
        if (cont) cont.innerHTML = Estadias.renderPainel(eqId);
      });
    } else if (panelId === 'ftab-visitas' && typeof Visitas !== 'undefined') {
      Visitas.load(eqId, function() {
        var cont = document.getElementById('ftab-visitas-content');
        if (cont) cont.innerHTML = Visitas.renderPainel(eqId);
      });
    }
  }

  function abrirFicha(eqId) {
    APP.spotEqId = eqId;
    App.nav('equipamentos', 'ficha');
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // MODAL EQUIPAMENTO
    html += '<div class="modal-bd" id="m-eq-novo">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg></div><div><div class="modal-title" id="m-eq-ttl">Novo equipamento</div><div class="modal-sub">Ficha do equipamento</div></div><button class="modal-close" onclick="closeModal(\'m-eq-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-sec-t">Identificação</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Nome *</label><input type="text" id="eq-nome" class="fin" placeholder="ex: Pavilhão Municipal Norte"></div><div class="fi"><label class="fl">Tipo *</label><select id="eq-tipo" class="fin"><option value="">Seleccione...</option></select></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Unidade</label><select id="eq-unidade" class="fin"><option value="">—</option><option value="UDAJ">UDAJ</option><option value="UASE">UASE</option></select></div><div class="fi"><label class="fl">Responsável</label><select id="eq-responsavel" class="fin"><option value="">—</option></select></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Código</label><input type="text" id="eq-codigo" class="fin" placeholder="PAV-001"></div><div class="fi"><label class="fl">Estado</label><select id="eq-estado" class="fin"><option value="ativo">Activo</option><option value="inativo">Inactivo</option><option value="manutencao">Em manutenção</option></select></div></div>';
    html += '<div class="form-sec-t">Localização</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Morada</label><input type="text" id="eq-morada" class="fin" placeholder="Rua, nº"></div><div class="fi"><label class="fl">Localidade</label><input type="text" id="eq-local" class="fin" placeholder="Localidade"></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Telefone</label><input type="text" id="eq-tel" class="fin" placeholder="2xx xxx xxx"></div><div class="fi"><label class="fl">Capacidade</label><input type="number" id="eq-cap" class="fin" placeholder="0" min="0"></div></div>';
    html += '<div class="fi"><label class="fl">Notas</label><textarea id="eq-desc" class="fin" rows="2" placeholder="Informações adicionais..."></textarea></div>';
    // Módulos deste equipamento (override ao tipo)
    html += '<div class="form-sec-t">Módulos deste equipamento</div>';
    html += '<p style="font-size:12px;color:var(--text-3);margin:-2px 0 10px;line-height:1.5;">Por defeito herdam do tipo. Aqui podes ligar ou desligar módulos só para este equipamento (ex: só o Centro Hípico tem Aulas).</p>';
    MOD_DEFS.forEach(function(m) {
      html += '<div class="form-row"><div class="fi"><label class="fl">' + m.l + '</label>';
      html += '<select id="eqmod-' + m.k + '" class="fin">';
      html += '<option value="">Herdar do tipo</option>';
      html += '<option value="on">Ligar neste equipamento</option>';
      html += '<option value="off">Desligar neste equipamento</option>';
      html += '</select></div></div>';
    });

    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-eq-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Equipamentos.salvar()">Guardar equipamento</button></div>';
    html += '</div></div>';

    // MODAL GERIR ESPAÇOS
    html += '<div class="modal-bd" id="m-eq-espacos">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-teal"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div><div><div class="modal-title">Gerir espaços</div><div class="modal-sub" id="m-esp-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-eq-espacos\')">✕</button></div>';
    html += '<div class="modal-body"><div class="form-hint" style="margin-bottom:10px;">Cada espaço reservável com o que contar (ex: Parque de Campismo → Nº de pessoas + Nº de tendas).</div><div id="eq-espacos-list"></div><button class="btn btn-ghost btn-sm" onclick="Equipamentos.addEspaco()" style="margin-top:6px;">+ Adicionar espaço</button></div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-eq-espacos\')">Cancelar</button><button class="btn btn-primary" onclick="Equipamentos.guardarEspacos()">Guardar espaços</button></div>';
    html += '</div></div>';

    // MODAL TIPO
    html += '<div class="modal-bd" id="m-tipo-novo">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-teal"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><div><div class="modal-title" id="m-tipo-ttl">Novo tipo de equipamento</div><div class="modal-sub">Configure os módulos disponíveis</div></div><button class="modal-close" onclick="closeModal(\'m-tipo-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Nome *</label><input type="text" id="tipo-nome" class="fin" placeholder="ex: Pavilhão Gimnodesportivo"></div><div class="fi"><label class="fl">Emoji</label><input type="text" id="tipo-emoji" class="fin" placeholder="🏟️" maxlength="4" style="font-size:20px;text-align:center;"></div></div>';
    html += '<div class="fi"><label class="fl">Descrição</label><input type="text" id="tipo-desc" class="fin" placeholder="Descrição breve"></div>';
    html += '<div class="form-sec-t">Reservas — espaços e contagem</div>';
    html += '<div class="fi"><label class="fl">Espaços disponíveis</label><input type="text" id="tipo-espacos" class="fin" placeholder="ex: Espaço 1, Espaço 2, Espaço 3"><div class="form-hint">Separe por vírgulas. Deixe vazio se não aplicável.</div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Rótulo da contagem</label><input type="text" id="tipo-lbl-cont" class="fin" placeholder="ex: Nº de alunos"><div class="form-hint">Ex: Nº de pessoas, Nº de alunos</div></div>';
    html += '<div class="fi"><label class="fl">Contagem secundária</label><input type="text" id="tipo-lbl-cont2" class="fin" placeholder="ex: Nº de tendas"><div class="form-hint">Opcional (ex: campismo)</div></div></div>';
    html += '<div class="form-sec-t">Módulos activos</div>';
    html += '<div id="tipo-mods"></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-tipo-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Equipamentos.salvarTipo()">Guardar tipo</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES EQUIPAMENTO ────────────────────────────────────
  function openNovo() {
    APP.editId = null;
    document.getElementById('m-eq-ttl').textContent = 'Novo equipamento';
    ['eq-nome','eq-codigo','eq-morada','eq-local','eq-tel','eq-desc'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var cap = document.getElementById('eq-cap'); if (cap) cap.value = '';
    var est = document.getElementById('eq-estado'); if (est) est.value = 'ativo';
    var uni = document.getElementById('eq-unidade'); if (uni) uni.value = '';
    MOD_DEFS.forEach(function(m) {
      var el = document.getElementById('eqmod-' + m.k); if (el) el.value = '';
    });
    _popularResponsaveis();
    _popularTiposSelect();
    openModal('m-eq-novo');
  }

  function openEditar(id) {
    var eq = APP.equipamentos.filter(function(e) { return e.id === id; })[0];
    if (!eq) return;
    APP.editId = id;
    document.getElementById('m-eq-ttl').textContent = 'Editar equipamento';
    var set = function(eid, val) { var el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('eq-nome',   eq.nome);
    set('eq-codigo', eq.codigo);
    set('eq-morada', eq.morada);
    set('eq-local',  eq.localidade);
    set('eq-tel',    eq.telefone);
    set('eq-desc',   eq.descricao);
    set('eq-estado', eq.estado || 'ativo');
    var cap = document.getElementById('eq-cap'); if (cap) cap.value = eq.capacidade || '';
    set('eq-unidade', eq.unidade);
    var mods = eq.modulos && typeof eq.modulos === 'object' ? eq.modulos : {};
    MOD_DEFS.forEach(function(m) {
      var el = document.getElementById('eqmod-' + m.k);
      if (!el) return;
      if (mods[m.k] === true) el.value = 'on';
      else if (mods[m.k] === false) el.value = 'off';
      else el.value = '';
    });
    _popularResponsaveis(eq.responsavel_id);
    _popularTiposSelect(eq.tipo_id);
    openModal('m-eq-novo');
  }

  // popula o select de responsável com funcionários com perfil de responsável
  function _popularResponsaveis(selId) {
    var sel = document.getElementById('eq-responsavel');
    if (!sel) return;
    sel.innerHTML = '<option value="">—</option>';
    (APP.utilizadores || [])
      .filter(function(u) {
        return ['responsavel','professor_responsavel'].indexOf(u.perfil) >= 0;
      })
      .sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); })
      .forEach(function(u) {
        var o = document.createElement('option');
        o.value = u.id;
        o.textContent = u.nome;
        if (selId && u.id === selId) o.selected = true;
        sel.appendChild(o);
      });
  }

  function _popularTiposSelect(selId) {
    var sel = document.getElementById('eq-tipo');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccione o tipo...</option>';
    APP.tiposEq.forEach(function(t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = (t.emoji ? t.emoji + ' ' : '') + t.nome;
      if (selId && t.id === selId) o.selected = true;
      sel.appendChild(o);
    });
  }

  var _espacoIdx = 0;

  function _renderEspacosList(espacos) {
    _espacoIdx = 0;
    var cont = document.getElementById('eq-espacos-list');
    if (cont) cont.innerHTML = '';
    if (espacos && espacos.length) {
      espacos.forEach(function(e) { addEspaco(e); });
    }
  }

  var _espEqId = null;

  function gerirEspacos(eqId) {
    _espEqId = eqId;
    var eq = getEq(eqId);
    var sub = document.getElementById('m-esp-eq');
    if (sub) sub.textContent = eq ? eq.nome : '—';
    var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === eqId; });
    espacos.sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
    _renderEspacosList(espacos);
    openModal('m-eq-espacos');
  }

  function guardarEspacos() {
    if (!_espEqId) return;
    _salvarEspacos(_espEqId, function() {
      toast('Espaços guardados.', 'success');
      closeModal('m-eq-espacos');
      loadAll(function() { App.renderContent(); });
    });
  }

  function addEspaco(e) {
    _espacoIdx++;
    var idx = _espacoIdx;
    var cont = document.getElementById('eq-espacos-list');
    if (!cont) return;
    var div = document.createElement('div');
    div.className = 'esp-row';
    div.dataset.espId = e && e.id ? e.id : '';
    div.style.cssText = 'border:1px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:8px;background:var(--bg);';
    div.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px;">' +
        '<input type="text" class="fin esp-nome" placeholder="Nome do espaço (ex: Parque de Campismo)" value="' + (e ? H(e.nome||'') : '') + '" style="flex:1;">' +
        '<button class="btn btn-ghost btn-sm" style="color:var(--red);flex-shrink:0;" onclick="this.closest(\'.esp-row\').remove()">✕</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<input type="text" class="fin esp-cont1" placeholder="Contagem 1 (ex: Nº de pessoas)" value="' + (e ? H(e.label_contagem||'') : 'Nº de pessoas') + '" style="flex:1;font-size:12px;">' +
        '<input type="text" class="fin esp-cont2" placeholder="Contagem 2 (opcional)" value="' + (e ? H(e.label_contagem2||'') : '') + '" style="flex:1;font-size:12px;">' +
      '</div>';
    cont.appendChild(div);
  }

  function _salvarEspacos(eqId, cb) {
    var rows = document.querySelectorAll('#eq-espacos-list .esp-row');
    // apagar os antigos e recriar (simples e fiável)
    sbDelete('equipamento_espacos', 'equipamento_id=eq.' + eqId).then(function() {
      var inserts = [];
      rows.forEach(function(row, i) {
        var nome = (row.querySelector('.esp-nome').value || '').trim();
        if (!nome) return;
        inserts.push(sbPost('equipamento_espacos', {
          equipamento_id: eqId,
          nome: nome,
          label_contagem:  (row.querySelector('.esp-cont1').value || 'Nº de pessoas').trim(),
          label_contagem2: (row.querySelector('.esp-cont2').value || '').trim() || null,
          ordem: i
        }));
      });
      if (!inserts.length) { if (cb) cb(); return; }
      Promise.all(inserts).then(function() { if (cb) cb(); }).catch(function() { if (cb) cb(); });
    }).catch(function() { if (cb) cb(); });
  }

  function salvar() {
    var nome  = document.getElementById('eq-nome');
    var tipo  = document.getElementById('eq-tipo');
    if (!nome || !nome.value.trim()) { toast('Nome obrigatório.', 'error'); return; }
    if (!tipo || !tipo.value) { toast('Seleccione o tipo.', 'error'); return; }
    var cap = document.getElementById('eq-cap');
    var body = {
      nome:       nome.value.trim(),
      tipo_id:    tipo.value,
      codigo:     (document.getElementById('eq-codigo') || {}).value || '',
      morada:     (document.getElementById('eq-morada') || {}).value || '',
      localidade: (document.getElementById('eq-local')  || {}).value || '',
      telefone:   (document.getElementById('eq-tel')    || {}).value || '',
      descricao:  (document.getElementById('eq-desc')   || {}).value || '',
      estado:     (document.getElementById('eq-estado') || {}).value || 'ativo',
      capacidade: cap && cap.value ? parseInt(cap.value, 10) : null,
      unidade:        (document.getElementById('eq-unidade')     || {}).value || null,
      responsavel_id: (document.getElementById('eq-responsavel') || {}).value || null
    };
    // módulos: só guarda as excepções ao tipo
    var mods = {};
    MOD_DEFS.forEach(function(m) {
      var el = document.getElementById('eqmod-' + m.k);
      if (!el) return;
      if (el.value === 'on') mods[m.k] = true;
      else if (el.value === 'off') mods[m.k] = false;
    });
    body.modulos = mods;
    var p = APP.editId
      ? sbPatch('equipamentos', 'id=eq.' + APP.editId, body)
      : sbPost('equipamentos', body);
    p.then(function() {
      toast(APP.editId ? 'Equipamento actualizado.' : 'Equipamento criado.', 'success');
      closeModal('m-eq-novo');
      loadAll(function() { App.renderContent(); App.buildSidebar(); });
    }).catch(function() { toast('Erro ao guardar.', 'error'); });
  }

  // ── ACÇÕES TIPO ───────────────────────────────────────────
  function openNovoTipo() {
    APP.editId = null;
    document.getElementById('m-tipo-ttl').textContent = 'Novo tipo de equipamento';
    var n = document.getElementById('tipo-nome'); if (n) n.value = '';
    var e = document.getElementById('tipo-emoji'); if (e) e.value = '';
    var d = document.getElementById('tipo-desc'); if (d) d.value = '';
    var es = document.getElementById('tipo-espacos'); if (es) es.value = '';
    var lc = document.getElementById('tipo-lbl-cont'); if (lc) lc.value = '';
    var lc2 = document.getElementById('tipo-lbl-cont2'); if (lc2) lc2.value = '';
    _renderTogglesMods({});
    openModal('m-tipo-novo');
  }

  function openEditarTipo(id) {
    var tipo = APP.tiposEq.filter(function(t) { return t.id === id; })[0];
    if (!tipo) return;
    APP.editId = id;
    document.getElementById('m-tipo-ttl').textContent = 'Editar tipo';
    var n = document.getElementById('tipo-nome'); if (n) n.value = tipo.nome || '';
    var e = document.getElementById('tipo-emoji'); if (e) e.value = tipo.emoji || '';
    var d = document.getElementById('tipo-desc'); if (d) d.value = tipo.descricao || '';
    var es = document.getElementById('tipo-espacos'); if (es) es.value = tipo.espacos || '';
    var lc = document.getElementById('tipo-lbl-cont'); if (lc) lc.value = tipo.label_contagem || '';
    var lc2 = document.getElementById('tipo-lbl-cont2'); if (lc2) lc2.value = tipo.label_contagem2 || '';
    _renderTogglesMods(tipo);
    openModal('m-tipo-novo');
  }

  function _renderTogglesMods(tipo) {
    var c = document.getElementById('tipo-mods');
    if (!c) return;
    c.innerHTML = '';
    MOD_DEFS.forEach(function(m) {
      var on = !!(tipo && tipo['mod_' + m.k]);
      var row = document.createElement('label');
      row.className = 'toggle-row' + (on ? ' on' : '');
      row.innerHTML = '<div class="t-body"><div class="t-title">' + H(m.l) + '</div><div class="t-sub">' + H(m.s) + '</div></div>' +
        '<div class="t-sw"><input type="checkbox" id="tmod-' + m.k + '"' + (on ? ' checked' : '') + '><div class="t-track"></div><div class="t-thumb"></div></div>';
      var cb = row.querySelector('input');
      cb.onchange = function() { row.classList.toggle('on', cb.checked); };
      c.appendChild(row);
    });
  }

  function salvarTipo() {
    var n = document.getElementById('tipo-nome');
    if (!n || !n.value.trim()) { toast('Nome obrigatório.', 'error'); return; }
    var body = {
      nome:      n.value.trim(),
      emoji:     (document.getElementById('tipo-emoji') || {}).value || '🏢',
      descricao: (document.getElementById('tipo-desc')  || {}).value || '',
      espacos:         (document.getElementById('tipo-espacos')   || {}).value || '',
      label_contagem:  (document.getElementById('tipo-lbl-cont')  || {}).value || 'Nº de pessoas',
      label_contagem2: (document.getElementById('tipo-lbl-cont2') || {}).value || ''
    };
    MOD_DEFS.forEach(function(m) {
      var cb = document.getElementById('tmod-' + m.k);
      body['mod_' + m.k] = cb ? cb.checked : false;
    });
    var p = APP.editId
      ? sbPatch('tipos_equipamento', 'id=eq.' + APP.editId, body)
      : sbPost('tipos_equipamento', body);
    p.then(function() {
      toast(APP.editId ? 'Tipo actualizado.' : 'Tipo criado.', 'success');
      closeModal('m-tipo-novo');
      loadAll(function() { App.renderContent(); App.buildSidebar(); });
    }).catch(function() { toast('Erro ao guardar.', 'error'); });
  }

  // ── HELPERS ───────────────────────────────────────────────
  function _statCard(ic, val, label) {
    return '<div class="stat-card"><div class="stat-ic ' + ic + '"><svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><div class="stat-body"><div class="stat-lbl">' + H(label) + '</div><div class="stat-val">' + val + '</div></div></div>';
  }

  function init() {
    var cont = document.getElementById('modais-equipamentos');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  return {
    render: render,
    init: init,
    openNovo: openNovo,
    openEditar: openEditar,
    addEspaco: addEspaco,
    gerirEspacos: gerirEspacos,
    guardarEspacos: guardarEspacos,
    salvar: salvar,
    openNovoTipo: openNovoTipo,
    openEditarTipo: openEditarTipo,
    salvarTipo: salvarTipo,
    abrirFicha: abrirFicha,
    switchTab: switchTab
  };

})();

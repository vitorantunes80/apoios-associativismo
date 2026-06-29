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

    // mini stats
    var ativos  = APP.equipamentos.filter(function(e) { return e.estado === 'ativo'; }).length;
    var manut   = APP.equipamentos.filter(function(e) { return e.estado === 'manutencao'; }).length;
    var inativo = APP.equipamentos.filter(function(e) { return e.estado === 'inativo'; }).length;

    html += '<div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">';
    html += _statCard('si-green', ativos,  'Activos');
    html += _statCard('si-amber', manut,   'Em manutenção');
    html += _statCard('si-red',   inativo, 'Inactivos');
    html += '</div>';

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Código</th><th>Equipamento</th><th>Tipo</th><th>Localidade</th><th>Módulos</th><th>Estado</th><th></th></tr></thead>';
    html += '<tbody>';

    APP.equipamentos.forEach(function(e, idx) {
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

    // Tabs — só módulos activos do tipo
    var tabs = [{ id: 'info', label: 'Informações' }];
    if (tipo) {
      MOD_DEFS.forEach(function(m) {
        if (tipo['mod_' + m.k]) tabs.push({ id: m.k, label: m.l });
      });
    }

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
    html += '</div>';

    // Módulos activos — placeholder
    if (tipo) {
      MOD_DEFS.forEach(function(m) {
        if (!tipo['mod_' + m.k]) return;
        html += '<div class="eq-tab-panel" id="ftab-' + m.k + '" style="padding:16px;">';
        html += '<div class="mod-ph"><div class="mod-ph-t">' + m.l + '</div><div class="mod-ph-s">' + m.s + ' — módulo em desenvolvimento.</div><span class="wip-badge">Em desenvolvimento</span></div>';
        html += '</div>';
      });
    }

    html += '</div></div>'; // panels + spotlight
    return html;
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
    html += '<div class="form-row"><div class="fi"><label class="fl">Código</label><input type="text" id="eq-codigo" class="fin" placeholder="PAV-001"></div><div class="fi"><label class="fl">Estado</label><select id="eq-estado" class="fin"><option value="ativo">Activo</option><option value="inativo">Inactivo</option><option value="manutencao">Em manutenção</option></select></div></div>';
    html += '<div class="form-sec-t">Localização</div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Morada</label><input type="text" id="eq-morada" class="fin" placeholder="Rua, nº"></div><div class="fi"><label class="fl">Localidade</label><input type="text" id="eq-local" class="fin" placeholder="Localidade"></div></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Telefone</label><input type="text" id="eq-tel" class="fin" placeholder="2xx xxx xxx"></div><div class="fi"><label class="fl">Capacidade</label><input type="number" id="eq-cap" class="fin" placeholder="0" min="0"></div></div>';
    html += '<div class="fi"><label class="fl">Notas</label><textarea id="eq-desc" class="fin" rows="2" placeholder="Informações adicionais..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-eq-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Equipamentos.salvar()">Guardar equipamento</button></div>';
    html += '</div></div>';

    // MODAL TIPO
    html += '<div class="modal-bd" id="m-tipo-novo">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-teal"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><div><div class="modal-title" id="m-tipo-ttl">Novo tipo de equipamento</div><div class="modal-sub">Configure os módulos disponíveis</div></div><button class="modal-close" onclick="closeModal(\'m-tipo-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Nome *</label><input type="text" id="tipo-nome" class="fin" placeholder="ex: Pavilhão Gimnodesportivo"></div><div class="fi"><label class="fl">Emoji</label><input type="text" id="tipo-emoji" class="fin" placeholder="🏟️" maxlength="4" style="font-size:20px;text-align:center;"></div></div>';
    html += '<div class="fi"><label class="fl">Descrição</label><input type="text" id="tipo-desc" class="fin" placeholder="Descrição breve"></div>';
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
    _popularTiposSelect(eq.tipo_id);
    openModal('m-eq-novo');
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
      capacidade: cap && cap.value ? parseInt(cap.value, 10) : null
    };
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
      descricao: (document.getElementById('tipo-desc')  || {}).value || ''
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
    salvar: salvar,
    openNovoTipo: openNovoTipo,
    openEditarTipo: openEditarTipo,
    salvarTipo: salvarTipo,
    abrirFicha: abrirFicha,
    switchTab: switchTab
  };

})();

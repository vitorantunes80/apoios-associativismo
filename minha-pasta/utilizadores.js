// ============================================================
// GestDDS — utilizadores.js  v5.1
// Gestão completa de utilizadores e perfis de acesso
// ============================================================

var Utilizadores = (function() {

  // Menus configuráveis nos acessos personalizados
  // (Utilizadores fica de fora — é sempre só admin)
  var MENUS_ACESSO = [
    ['memorandos',  'Memorandos'],
    ['reservas',    'Reservas'],
    ['escalas',     'Escalas e Turnos'],
    ['checklists',  'Checklists'],
    ['ferias',      'Férias'],
    ['horas',       'Banco de Horas'],
    ['estadias',    'Check-in / Check-out'],
    ['relatorios',  'Relatórios'],
    ['funcionarios','Funcionários']
  ];

  var PERFIS = [
    { v: 'admin',                 l: 'Administrador' },
    { v: 'responsavel_dds',       l: 'Responsável DDS' },
    { v: 'supervisor_udaj',       l: 'Supervisor UDAJ' },
    { v: 'supervisor_uase',       l: 'Supervisor UASE' },
    { v: 'responsavel',           l: 'Responsável de Equipamento' },
    { v: 'professor_responsavel', l: 'Professor Responsável' },
    { v: 'funcionario',           l: 'Funcionário' }
  ];

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    if (!APP.isDds()) return accessDenied();

    var isAdmin = APP.isAdmin();
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Utilizadores</div>';
    html += '<div class="dash-sub">Funcionários com acesso à plataforma — códigos, perfis e permissões. Para dar acesso a alguém, use o menu Funcionários.</div></div>';
    html += '</div>';

    // só quem tem acesso à app
    var comAcesso = APP.utilizadores.filter(function(u) { return u.tem_acesso === true; });

    if (!comAcesso.length) {
      return html + emptyState('Sem utilizadores com acesso', 'Nenhum funcionário tem acesso à app. Dê acesso no menu Funcionários.');
    }

    // Separar DDS de Equipamentos
    var dds = comAcesso.filter(function(u) { return u.isDds; });
    var eqs = comAcesso.filter(function(u) { return !u.isDds; });

    html += _secHead('Equipa DDS', dds.length);
    html += _tabela(dds, isAdmin);

    if (eqs.length) {
      html += '<div style="margin-top:20px;">';
      html += _secHead('Responsáveis e Funcionários', eqs.length);
      html += _tabela(eqs, isAdmin);
      html += '</div>';
    }

    return html;
  }

  function _secHead(title, count) {
    return '<div class="sec-head"><div class="sec-title">' + H(title) +
      ' <span class="sec-badge">' + count + '</span></div></div>';
  }

  function _tabela(utilizadores, isAdmin) {
    if (!utilizadores.length) return emptyState('Sem registos', '');

    var html = '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Utilizador</th><th>Nome</th><th>Perfil</th><th>Equipamento</th><th>Código</th><th>Estado</th>';
    if (isAdmin) html += '<th></th>';
    html += '</tr></thead><tbody>';

    utilizadores.forEach(function(u) {
      var pal = PERFIL_PALETTES[u.perfil] || ['#F1F5F9','#475569'];
      var ini = iniciais(u.nome);
      var eq  = u.equipamento_id ? getEq(u.equipamento_id) : null;
      var ativo = u.ativo !== false;

      html += '<tr>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;">';
      html += '<div style="width:30px;height:30px;border-radius:50%;background:' + pal[0] + ';color:' + pal[1] + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ini + '</div>';
      html += '<span class="td-mono">' + H(u.username || '—') + '</span></div></td>';
      html += '<td class="td-p">' + H(u.nome) + '</td>';
      html += '<td><span class="bdg" style="background:' + pal[0] + ';color:' + pal[1] + ';">' + H(_labelPerfil(u.perfil)) + '</span>';
      var nExc = u.permissoes_extra ? Object.keys(u.permissoes_extra).length : 0;
      if (nExc > 0) html += '<div class="td-m" style="font-size:10.5px;margin-top:3px;color:var(--amber);" title="Acessos personalizados ativos">🔑 ' + nExc + ' excepç' + (nExc > 1 ? 'ões' : 'ão') + '</div>';
      html += '</td>';
      html += '<td class="td-m">' + H(eq ? eq.nome : (u.isDds ? 'Acesso global' : '—')) + '</td>';
      html += '<td><span class="td-mono" style="font-size:12px;background:var(--bg);padding:2px 8px;border-radius:6px;border:1px solid var(--border);">' + H(u.codigo || '—') + '</span></td>';
      html += '<td>' + (ativo
        ? '<span class="bdg bdg-ativo"><span class="bdg-dot"></span>Activo</span>'
        : '<span class="bdg bdg-inativo">Inactivo</span>') + '</td>';

      if (isAdmin) {
        html += '<td><div class="td-act">';
        html += '<button class="btn btn-ghost btn-sm" onclick="Utilizadores.openEditar(\'' + u.id + '\')">Editar</button>';
        // não permitir retirar o próprio acesso
        if (APP.user && u.id !== APP.user.id) {
          html += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Utilizadores.confirmarApagar(\'' + u.id + '\',\'' + H(u.nome) + '\')">Retirar acesso</button>';
        }
        html += '</div></td>';
      }
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _labelPerfil(p) {
    var found = PERFIS.filter(function(x) { return x.v === p; })[0];
    return found ? found.l : (p || '—');
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // MODAL UTILIZADOR
    html += '<div class="modal-bd" id="m-util-novo">';
    html += '<div class="modal" style="max-width:520px;">';
    html += '<div class="modal-header">';
    html += '<div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
    html += '<div><div class="modal-title" id="m-util-ttl">Novo utilizador</div><div class="modal-sub">Preencha os dados da conta</div></div>';
    html += '<button class="modal-close" onclick="closeModal(\'m-util-novo\')">✕</button>';
    html += '</div>';
    html += '<div class="modal-body">';

    html += '<div class="form-sec-t">Identificação</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Nome completo *</label><input type="text" id="util-nome" class="fin" placeholder="ex: João Silva"></div>';
    html += '<div class="fi"><label class="fl">Username</label><input type="text" id="util-username" class="fin" placeholder="ex: joao.silva"></div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Código de acesso *</label><input type="text" id="util-codigo" class="fin" placeholder="ex: JS2026" style="font-family:\'JetBrains Mono\',monospace;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"><div class="form-hint">Código único que o utilizador usa para entrar</div></div>';
    html += '<div class="fi"><label class="fl">Email</label><input type="email" id="util-email" class="fin" placeholder="email@cm-cabeceiras.pt"></div>';
    html += '</div>';

    html += '<div class="form-sec-t">Perfil e acesso</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Perfil *</label>';
    html += '<select id="util-perfil" class="fin" onchange="Utilizadores.onPerfilChange()">';
    html += '<option value="">Seleccione...</option>';
    PERFIS.forEach(function(p) {
      html += '<option value="' + p.v + '">' + p.l + '</option>';
    });
    html += '</select></div>';
    html += '<div class="fi"><label class="fl">Acesso DDS?</label>';
    html += '<select id="util-isdds" class="fin">';
    html += '<option value="false">Não — ligado a equipamento</option>';
    html += '<option value="true">Sim — acesso global DDS</option>';
    html += '</select></div>';
    html += '</div>';

    html += '<div class="fi" id="util-eq-wrap">';
    html += '<label class="fl">Equipamento afecto</label>';
    html += '<select id="util-eq" class="fin">';
    html += '<option value="">Nenhum</option>';
    html += '</select>';
    html += '</div>';

    // ── Acessos personalizados ──
    html += '<div class="form-sec-t">Acessos personalizados</div>';
    html += '<p style="font-size:12px;color:var(--text-3);margin:-2px 0 10px;line-height:1.5;">Excepções às regras do perfil — útil para dar ou retirar acessos temporariamente (baixas, férias, substituições). "Perfil" segue o comportamento normal.</p>';
    for (var mi = 0; mi < MENUS_ACESSO.length; mi += 2) {
      html += '<div class="form-row">';
      for (var mj = mi; mj < Math.min(mi + 2, MENUS_ACESSO.length); mj++) {
        var mm = MENUS_ACESSO[mj];
        html += '<div class="fi"><label class="fl">' + mm[1] + '</label>';
        html += '<select id="uacc-' + mm[0] + '" class="fin">';
        html += '<option value="">Perfil (por defeito)</option>';
        html += '<option value="sim">✓ Dar acesso</option>';
        html += '<option value="nao">✗ Retirar acesso</option>';
        html += '</select></div>';
      }
      html += '</div>';
    }

    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Estado</label>';
    html += '<select id="util-ativo" class="fin">';
    html += '<option value="true">Activo</option>';
    html += '<option value="false">Inactivo</option>';
    html += '</select></div>';
    html += '</div>';

    html += '</div>'; // modal-body
    html += '<div class="modal-footer">';
    html += '<button class="btn btn-ghost" onclick="closeModal(\'m-util-novo\')">Cancelar</button>';
    html += '<button class="btn btn-primary" onclick="Utilizadores.salvar()">Guardar utilizador</button>';
    html += '</div>';
    html += '</div></div>';

    // MODAL CONFIRMAR RETIRAR ACESSO
    html += '<div class="modal-bd" id="m-util-apagar">';
    html += '<div class="modal"><div class="modal-header">';
    html += '<div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></div>';
    html += '<div><div class="modal-title">Retirar acesso à app</div><div class="modal-sub" id="m-util-ap-nome">—</div></div>';
    html += '<button class="modal-close" onclick="closeModal(\'m-util-apagar\')">✕</button>';
    html += '</div>';
    html += '<div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);line-height:1.6;">O funcionário deixa de poder entrar na aplicação, mas <strong>continua registado</strong> — as suas escalas, férias e histórico mantêm-se. Pode voltar a dar-lhe acesso a qualquer momento no menu Funcionários.</p></div>';
    html += '<div class="modal-footer">';
    html += '<button class="btn btn-ghost" onclick="closeModal(\'m-util-apagar\')">Cancelar</button>';
    html += '<button class="btn btn-danger" onclick="Utilizadores.execApagar()">Retirar acesso</button>';
    html += '</div></div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function onPerfilChange() {
    var perfil = document.getElementById('util-perfil').value;
    var isDdsSelect = document.getElementById('util-isdds');
    var eqWrap = document.getElementById('util-eq-wrap');

    // perfis DDS ficam automaticamente com isDds=true
    var isDdsPerfil = ['admin','responsavel_dds','supervisor_udaj','supervisor_uase'].indexOf(perfil) >= 0;
    if (isDdsSelect) {
      isDdsSelect.value = isDdsPerfil ? 'true' : 'false';
    }
    if (eqWrap) {
      eqWrap.style.display = isDdsPerfil ? 'none' : 'block';
    }
  }

  function _popularEqSelect(selId) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhum</option>';
    APP.equipamentos.forEach(function(e) {
      var o = document.createElement('option');
      o.value = e.id;
      o.textContent = e.nome;
      sel.appendChild(o);
    });
  }

  function openNovo() {
    APP.editId = null;
    document.getElementById('m-util-ttl').textContent = 'Novo utilizador';
    var ids = ['util-nome','util-username','util-codigo','util-email'];
    ids.forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var p = document.getElementById('util-perfil'); if (p) p.value = '';
    var d = document.getElementById('util-isdds'); if (d) d.value = 'false';
    var a = document.getElementById('util-ativo'); if (a) a.value = 'true';
    MENUS_ACESSO.forEach(function(m) {
      var el = document.getElementById('uacc-' + m[0]); if (el) el.value = '';
    });
    _popularEqSelect('util-eq');
    var ew = document.getElementById('util-eq-wrap'); if (ew) ew.style.display = 'block';
    openModal('m-util-novo');
  }

  function openEditar(id) {
    var u = APP.utilizadores.filter(function(x) { return x.id === id; })[0];
    if (!u) return;
    APP.editId = id;
    document.getElementById('m-util-ttl').textContent = 'Editar utilizador';

    var set = function(eid, val) {
      var el = document.getElementById(eid);
      if (el) el.value = val !== null && val !== undefined ? val : '';
    };
    set('util-nome',     u.nome);
    set('util-username', u.username);
    set('util-codigo',   u.codigo);
    set('util-email',    u.email);
    set('util-perfil',   u.perfil);
    set('util-isdds',    u.isDds ? 'true' : 'false');
    set('util-ativo',    u.ativo !== false ? 'true' : 'false');

    // acessos personalizados
    var pexE = u.permissoes_extra || {};
    MENUS_ACESSO.forEach(function(m) {
      var el = document.getElementById('uacc-' + m[0]);
      if (!el) return;
      if (pexE[m[0]] === true)       el.value = 'sim';
      else if (pexE[m[0]] === false) el.value = 'nao';
      else                           el.value = '';
    });

    _popularEqSelect('util-eq');
    var eqSel = document.getElementById('util-eq');
    if (eqSel && u.equipamento_id) eqSel.value = u.equipamento_id;

    // mostrar/esconder eq
    var isDdsPerfil = ['admin','responsavel_dds','supervisor_udaj','supervisor_uase'].indexOf(u.perfil) >= 0;
    var ew = document.getElementById('util-eq-wrap');
    if (ew) ew.style.display = isDdsPerfil ? 'none' : 'block';

    openModal('m-util-novo');
  }

  function salvar() {
    var nome   = document.getElementById('util-nome');
    var codigo = document.getElementById('util-codigo');
    if (!nome || !nome.value.trim()) { toast('O nome é obrigatório.', 'error'); return; }
    if (!codigo || !codigo.value.trim()) { toast('O código de acesso é obrigatório.', 'error'); return; }

    var perfil = document.getElementById('util-perfil').value;
    var isDds  = document.getElementById('util-isdds').value === 'true';
    var eqSel  = document.getElementById('util-eq');
    var atvSel = document.getElementById('util-ativo');

    var body = {
      nome:           nome.value.trim(),
      username:       (document.getElementById('util-username').value || '').trim(),
      codigo:         codigo.value.trim().toUpperCase(),
      email:          (document.getElementById('util-email').value || '').trim(),
      perfil:         perfil,
      isDds:          isDds,
      equipamento_id: (eqSel && eqSel.value) ? eqSel.value : null,
      ativo:          atvSel ? atvSel.value === 'true' : true
    };

    // acessos personalizados
    var pex = {};
    MENUS_ACESSO.forEach(function(m) {
      var el = document.getElementById('uacc-' + m[0]);
      if (!el) return;
      if (el.value === 'sim') pex[m[0]] = true;
      else if (el.value === 'nao') pex[m[0]] = false;
    });
    body.permissoes_extra = pex;
    body.tem_acesso = true; // quem está neste menu tem acesso à app

    var p = APP.editId
      ? sbPatch('utilizadores', 'id=eq.' + APP.editId, body)
      : sbPost('utilizadores', body);

    p.then(function() {
      toast(APP.editId ? 'Utilizador actualizado.' : 'Utilizador criado.', 'success');
      closeModal('m-util-novo');
      loadAll(function() {
        App.renderContent();
        App.buildSidebar();
      });
    }).catch(function(e) {
      // código duplicado
      if (e && e.message && e.message.indexOf('unique') >= 0) {
        toast('Esse código já está em uso. Escolha outro.', 'error');
      } else {
        toast('Erro ao guardar.', 'error');
      }
    });
  }

  function confirmarApagar(id, nome) {
    APP.actionId = id;
    var el = document.getElementById('m-util-ap-nome');
    if (el) el.textContent = nome;
    openModal('m-util-apagar');
  }

  function execApagar() {
    if (!APP.actionId) return;
    sbPatch('utilizadores', 'id=eq.' + APP.actionId, { tem_acesso: false }).then(function() {
      toast('Acesso à app retirado. O funcionário continua registado.', 'success');
      closeModal('m-util-apagar');
      loadAll(function() { App.renderContent(); App.buildSidebar(); });
    }).catch(function() { toast('Erro ao retirar acesso.', 'error'); });
  }

  function init() {
    var cont = document.getElementById('modais-utilizadores');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  return {
    render: render,
    init: init,
    openNovo: openNovo,
    openEditar: openEditar,
    salvar: salvar,
    confirmarApagar: confirmarApagar,
    execApagar: execApagar,
    onPerfilChange: onPerfilChange
  };

})();

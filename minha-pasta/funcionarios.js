// ============================================================
// GestDDS — funcionarios.js  v5.1
// Gestão de funcionários afectos aos equipamentos
// ============================================================

var Funcionarios = (function() {

  // Menus configuráveis nos acessos personalizados
  // (Utilizadores fica de fora — é sempre só admin)
  var MENUS_ACESSO = [
    ['memorandos',  'Memorandos'],
    ['reservas',    'Reservas'],
    ['escalas',     'Escalas e Turnos'],
    ['checklists',  'Checklists'],
    ['ferias',      'Férias'],
    ['relatorios',  'Relatórios'],
    ['funcionarios','Funcionários']
  ];

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    var isAdmin = APP.isAdmin();
    var isDds   = APP.isDds();
    var podeGerir = isAdmin || isDds || APP.isResponsavel();

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Funcionários</div>';
    html += '<div class="dash-sub">Funcionários afectos aos equipamentos da divisão.</div></div>';
    if (podeGerir) {
      html += '<button class="btn btn-primary" onclick="Funcionarios.openNovo()">+ Novo funcionário</button>';
    }
    html += '</div>';

    // Filtrar utilizadores com perfil de terreno
    var perfisTerreno = ['responsavel','professor_responsavel','funcionario'];
    var funcs = APP.utilizadores.filter(function(u) {
      return perfisTerreno.indexOf(u.perfil) >= 0;
    });

    // Se não-DDS, mostrar só do seu equipamento
    if (!isDds && APP.user && APP.user.equipamento_id) {
      funcs = funcs.filter(function(u) {
        return u.equipamento_id === APP.user.equipamento_id;
      });
    }

    if (!funcs.length) {
      return html + emptyState('Sem funcionários', 'Nenhum funcionário registado.');
    }

    // Agrupar por equipamento
    var groups = {};
    var semEq = [];
    funcs.forEach(function(u) {
      if (u.equipamento_id) {
        if (!groups[u.equipamento_id]) groups[u.equipamento_id] = [];
        groups[u.equipamento_id].push(u);
      } else {
        semEq.push(u);
      }
    });

    // Por equipamento
    APP.equipamentos.forEach(function(eq) {
      if (!groups[eq.id] || !groups[eq.id].length) return;
      html += '<div style="margin-bottom:20px;">';
      html += '<div class="sec-head"><div class="sec-title">';
      var tipo = eq.tipo_id ? APP.tiposEq.filter(function(t) { return t.id === eq.tipo_id; })[0] : null;
      html += (tipo && tipo.emoji ? tipo.emoji + ' ' : '') + H(eq.nome);
      html += ' <span class="sec-badge">' + groups[eq.id].length + '</span></div></div>';
      html += _tabela(groups[eq.id], podeGerir);
      html += '</div>';
    });

    // Sem equipamento
    if (semEq.length) {
      html += '<div style="margin-bottom:20px;">';
      html += '<div class="sec-head"><div class="sec-title">Sem equipamento atribuído <span class="sec-badge">' + semEq.length + '</span></div></div>';
      html += _tabela(semEq, podeGerir);
      html += '</div>';
    }

    return html;
  }

  function _opcoesGuardadas(campo, predefinidos) {
    // reunir valores únicos: predefinidos + os já usados nos utilizadores
    var set = {};
    (predefinidos || []).forEach(function(v) { if (v) set[v] = true; });
    (APP.utilizadores || []).forEach(function(u) {
      var v = u[campo];
      if (v && String(v).trim()) set[String(v).trim()] = true;
    });
    var opcoes = Object.keys(set).sort();
    return opcoes.map(function(v) { return '<option value="' + H(v) + '"></option>'; }).join('');
  }

  function _tabela(funcs, isAdmin) {
    var html = '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Nome</th><th>Perfil</th><th>Unidade / Categoria</th><th>Código</th><th>Estado</th>';
    if (isAdmin) html += '<th></th>';
    html += '</tr></thead><tbody>';

    funcs.forEach(function(u) {
      var pal  = PERFIL_PALETTES[u.perfil] || ['#F1F5F9','#475569'];
      var ini  = iniciais(u.nome);
      var ativo = u.ativo !== false;

      html += '<tr>';
      html += '<td><div style="display:flex;align-items:center;gap:10px;">';
      html += '<div style="width:34px;height:34px;border-radius:50%;background:' + pal[0] + ';color:' + pal[1] + ';font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ini + '</div>';
      html += '<div><div class="td-p">' + H(u.nome) + '</div>';
      if (u.funcao) html += '<div class="td-m">' + H(u.funcao) + '</div>';
      if (u.num_mecanografico) html += '<div class="td-m" style="font-size:11px;">Nº ' + H(u.num_mecanografico) + '</div>';
      html += '</div></div></td>';
      html += '<td><span class="bdg" style="background:' + pal[0] + ';color:' + pal[1] + ';">' + H(_labelPerfil(u.perfil)) + '</span>';
      var nExc = u.permissoes_extra ? Object.keys(u.permissoes_extra).length : 0;
      if (nExc > 0) html += '<div class="td-m" style="font-size:10.5px;margin-top:3px;color:var(--amber);" title="Acessos personalizados ativos">🔑 ' + nExc + ' acesso' + (nExc > 1 ? 's' : '') + ' personalizado' + (nExc > 1 ? 's' : '') + '</div>';
      html += '</td>';
      html += '<td>';
      if (u.unidade) html += '<span class="td-p" style="font-size:12.5px;">' + H(u.unidade) + '</span>';
      if (u.area) html += '<div class="td-m">' + H(u.area) + '</div>';
      if (u.categoria) html += '<div class="td-m" style="font-size:11px;">' + H(u.categoria) + '</div>';
      if (!u.unidade && !u.area && !u.categoria) html += '<span class="td-m">—</span>';
      html += '</td>';
      html += '<td><span class="td-mono" style="font-size:12px;background:var(--bg);padding:2px 8px;border-radius:6px;border:1px solid var(--border);">' + H(u.codigo || '—') + '</span></td>';
      html += '<td>' + (ativo
        ? '<span class="bdg bdg-ativo"><span class="bdg-dot"></span>Activo</span>'
        : '<span class="bdg bdg-inativo">Inactivo</span>') + '</td>';

      if (isAdmin) {
        html += '<td><div class="td-act">';
        html += '<button class="btn btn-ghost btn-sm" onclick="Funcionarios.openEditar(\'' + u.id + '\')">Editar</button>';
        if (APP.user && u.id !== APP.user.id) {
          html += '<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Funcionarios.confirmarApagar(\'' + u.id + '\',\'' + H(u.nome) + '\')">Apagar</button>';
        }
        html += '</div></td>';
      }
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _labelPerfil(p) {
    var labels = {
      admin: 'Administrador',
      responsavel_dds: 'Responsável DDS',
      supervisor_udaj: 'Chefe UDAJ',
      supervisor_uase: 'Chefe UASE',
      responsavel: 'Responsável',
      professor_responsavel: 'Prof. Responsável',
      funcionario: 'Funcionário'
    };
    return labels[p] || p || '—';
  }

  // ── MODAL HTML ────────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    html += '<div class="modal-bd" id="m-func-novo">';
    html += '<div class="modal" style="max-width:520px;">';
    html += '<div class="modal-header">';
    html += '<div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
    html += '<div><div class="modal-title" id="m-func-ttl">Novo funcionário</div><div class="modal-sub">Dados do funcionário</div></div>';
    html += '<button class="modal-close" onclick="closeModal(\'m-func-novo\')">✕</button>';
    html += '</div>';
    html += '<div class="modal-body">';

    html += '<div class="form-sec-t">Identificação</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Nome completo *</label><input type="text" id="func-nome" class="fin" placeholder="ex: Ana Silva"></div>';
    html += '<div class="fi"><label class="fl">Código de acesso *</label><input type="text" id="func-codigo" class="fin" placeholder="ex: AS2026" style="font-family:\'JetBrains Mono\',monospace;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"></div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Email</label><input type="email" id="func-email" class="fin" placeholder="email@cm-cabeceiras.pt"></div>';
    html += '<div class="fi"><label class="fl">Nº mecanográfico</label><input type="text" id="func-mecanografico" class="fin" placeholder="ex: 12345"></div>';
    html += '</div>';

    html += '<div class="form-sec-t">Perfil e equipamento</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Perfil *</label>';
    html += '<select id="func-perfil" class="fin">';
    html += '<option value="funcionario">Funcionário</option>';
    html += '<option value="responsavel">Responsável de Equipamento</option>';
    html += '<option value="professor_responsavel">Professor Responsável</option>';
    html += '<option value="supervisor_udaj">Chefe de Unidade — UDAJ</option>';
    html += '<option value="supervisor_uase">Chefe de Unidade — UASE</option>';
    html += '<option value="responsavel_dds">Responsável DDS</option>';
    html += '</select></div>';
    html += '<div class="fi"><label class="fl">Equipamento afecto</label>';
    html += '<select id="func-eq" class="fin"><option value="">Nenhum</option></select>';
    html += '</div></div>';

    html += '<div class="form-sec-t">Enquadramento orgânico</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Unidade</label>';
    html += '<select id="func-unidade" class="fin">';
    html += '<option value="">Nenhuma</option>';
    html += '<option value="UASE">UASE — Unidade de Ação Social, Saúde e Educação</option>';
    html += '<option value="UDAJ">UDAJ — Unidade de Desporto, Associativismo e Juventude</option>';
    html += '</select></div>';
    html += '<div class="fi"><label class="fl">Área</label>';
    html += '<input type="text" id="func-area" class="fin" list="area-opcoes" placeholder="Escreva ou escolha">';
    html += '<datalist id="area-opcoes">' + _opcoesGuardadas('area', ['Ação Social','Saúde','Educação','Desporto','Associativismo','Juventude']) + '</datalist>';
    html += '</div>';
    html += '</div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Função</label>';
    html += '<input type="text" id="func-funcao" class="fin" list="funcao-opcoes" placeholder="ex: Coordenador de instalações">';
    html += '<datalist id="funcao-opcoes">' + _opcoesGuardadas('funcao', []) + '</datalist>';
    html += '</div>';
    html += '<div class="fi"><label class="fl">Categoria</label>';
    html += '<input type="text" id="func-categoria" class="fin" list="categoria-opcoes" placeholder="Escreva ou escolha">';
    html += '<datalist id="categoria-opcoes">' + _opcoesGuardadas('categoria', ['Assistente Operacional','Assistente Técnico','Técnico Superior','Dirigente']) + '</datalist>';
    html += '</div>';
    html += '</div>';

    // ── Acessos personalizados (só admin) ──
    if (APP.isAdmin()) {
      html += '<div class="form-sec-t">Acessos personalizados</div>';
      html += '<p style="font-size:12px;color:var(--text-3);margin:-2px 0 10px;line-height:1.5;">Excepções às regras do perfil — útil para dar ou retirar acessos temporariamente (baixas, férias, substituições). "Perfil" segue o comportamento normal.</p>';
      for (var mi = 0; mi < MENUS_ACESSO.length; mi += 2) {
        html += '<div class="form-row">';
        for (var mj = mi; mj < Math.min(mi + 2, MENUS_ACESSO.length); mj++) {
          var mm = MENUS_ACESSO[mj];
          html += '<div class="fi"><label class="fl">' + mm[1] + '</label>';
          html += '<select id="acc-' + mm[0] + '" class="fin">';
          html += '<option value="">Perfil (por defeito)</option>';
          html += '<option value="sim">✓ Dar acesso</option>';
          html += '<option value="nao">✗ Retirar acesso</option>';
          html += '</select></div>';
        }
        html += '</div>';
      }
    }

    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Estado</label>';
    html += '<select id="func-ativo" class="fin"><option value="true">Activo</option><option value="false">Inactivo</option></select>';
    html += '</div></div>';

    html += '</div>'; // modal-body
    html += '<div class="modal-footer">';
    html += '<button class="btn btn-ghost" onclick="closeModal(\'m-func-novo\')">Cancelar</button>';
    html += '<button class="btn btn-primary" onclick="Funcionarios.salvar()">Guardar</button>';
    html += '</div>';
    html += '</div></div>';

    // APAGAR
    html += '<div class="modal-bd" id="m-func-apagar"><div class="modal">';
    html += '<div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></div>';
    html += '<div><div class="modal-title">Apagar funcionário</div><div class="modal-sub" id="m-func-ap-nome">—</div></div>';
    html += '<button class="modal-close" onclick="closeModal(\'m-func-apagar\')">✕</button></div>';
    html += '<div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);">Esta acção é irreversível.</p></div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-func-apagar\')">Cancelar</button>';
    html += '<button class="btn btn-danger" onclick="Funcionarios.execApagar()">Apagar</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function _popularEqSelect(selId, selValue) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhum</option>';
    APP.equipamentos.forEach(function(e) {
      var o = document.createElement('option');
      o.value = e.id;
      o.textContent = e.nome;
      if (selValue && e.id === selValue) o.selected = true;
      sel.appendChild(o);
    });
  }

  function openNovo() {
    APP.editId = null;
    document.getElementById('m-func-ttl').textContent = 'Novo funcionário';
    ['func-nome','func-codigo','func-email','func-mecanografico','func-funcao'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    ['func-unidade','func-area','func-categoria'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var p = document.getElementById('func-perfil'); if (p) p.value = 'funcionario';
    var a = document.getElementById('func-ativo'); if (a) a.value = 'true';
    MENUS_ACESSO.forEach(function(m) {
      var el = document.getElementById('acc-' + m[0]); if (el) el.value = '';
    });
    _popularEqSelect('func-eq');
    // Se não-DDS, pré-seleccionar o seu equipamento
    if (!APP.isDds() && APP.user && APP.user.equipamento_id) {
      var eqSel = document.getElementById('func-eq');
      if (eqSel) eqSel.value = APP.user.equipamento_id;
    }
    openModal('m-func-novo');
  }

  function openEditar(id) {
    var u = APP.utilizadores.filter(function(x) { return x.id === id; })[0];
    if (!u) return;
    APP.editId = id;
    document.getElementById('m-func-ttl').textContent = 'Editar funcionário';
    var set = function(eid, val) {
      var el = document.getElementById(eid);
      if (el) el.value = val !== null && val !== undefined ? val : '';
    };
    set('func-nome',     u.nome);
    set('func-codigo',   u.codigo);
    set('func-email',    u.email);
    set('func-mecanografico', u.num_mecanografico);
    set('func-perfil',   u.perfil);
    set('func-unidade',  u.unidade);
    set('func-area',     u.area);
    set('func-funcao',   u.funcao);
    set('func-categoria',u.categoria);
    set('func-ativo',    u.ativo !== false ? 'true' : 'false');
    // acessos personalizados
    var pex = u.permissoes_extra || {};
    MENUS_ACESSO.forEach(function(m) {
      var el = document.getElementById('acc-' + m[0]);
      if (!el) return;
      if (pex[m[0]] === true)       el.value = 'sim';
      else if (pex[m[0]] === false) el.value = 'nao';
      else                          el.value = '';
    });
    _popularEqSelect('func-eq', u.equipamento_id);
    openModal('m-func-novo');
  }

  function salvar() {
    var nome   = document.getElementById('func-nome');
    var codigo = document.getElementById('func-codigo');
    if (!nome || !nome.value.trim()) { toast('O nome é obrigatório.', 'error'); return; }
    if (!codigo || !codigo.value.trim()) { toast('O código de acesso é obrigatório.', 'error'); return; }

    var eqSel  = document.getElementById('func-eq');
    var atvSel = document.getElementById('func-ativo');
    var pSel   = document.getElementById('func-perfil');
    var perfilSel = pSel ? pSel.value : 'funcionario';
    // perfis com acesso DDS (vêem todos os equipamentos)
    var perfisDds = ['responsavel_dds','supervisor_udaj','supervisor_uase'];
    var ehDds = perfisDds.indexOf(perfilSel) >= 0;

    var body = {
      nome:           nome.value.trim(),
      codigo:         codigo.value.trim().toUpperCase(),
      email:          (document.getElementById('func-email').value || '').trim(),
      num_mecanografico: (document.getElementById('func-mecanografico').value || '').trim() || null,
      perfil:         perfilSel,
      isDds:          ehDds,
      equipamento_id: (eqSel && eqSel.value) ? eqSel.value : null,
      unidade:        (document.getElementById('func-unidade')   || {}).value || null,
      area:           (document.getElementById('func-area')      || {}).value || null,
      funcao:         ((document.getElementById('func-funcao')   || {}).value || '').trim() || null,
      categoria:      (document.getElementById('func-categoria') || {}).value || null,
      ativo:          atvSel ? atvSel.value === 'true' : true
    };

    // acessos personalizados — só o admin vê/edita estes campos
    if (APP.isAdmin()) {
      var pex = {};
      MENUS_ACESSO.forEach(function(m) {
        var el = document.getElementById('acc-' + m[0]);
        if (!el) return;
        if (el.value === 'sim') pex[m[0]] = true;
        else if (el.value === 'nao') pex[m[0]] = false;
      });
      body.permissoes_extra = pex;
    }

    var p = APP.editId
      ? sbPatch('utilizadores', 'id=eq.' + APP.editId, body)
      : sbPost('utilizadores', body);

    p.then(function() {
      toast(APP.editId ? 'Funcionário actualizado.' : 'Funcionário criado.', 'success');
      closeModal('m-func-novo');
      loadAll(function() { App.renderContent(); App.buildSidebar(); });
    }).catch(function(e) {
      if (e && e.message && e.message.indexOf('unique') >= 0) {
        toast('Esse código já está em uso.', 'error');
      } else {
        toast('Erro ao guardar.', 'error');
      }
    });
  }

  function confirmarApagar(id, nome) {
    APP.actionId = id;
    var el = document.getElementById('m-func-ap-nome');
    if (el) el.textContent = nome;
    openModal('m-func-apagar');
  }

  function execApagar() {
    if (!APP.actionId) return;
    sbDelete('utilizadores', 'id=eq.' + APP.actionId).then(function() {
      toast('Funcionário eliminado.', 'success');
      closeModal('m-func-apagar');
      loadAll(function() { App.renderContent(); App.buildSidebar(); });
    }).catch(function() { toast('Erro ao eliminar.', 'error'); });
  }

  function init() {
    var cont = document.getElementById('modais-funcionarios');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  return {
    render: render,
    init: init,
    openNovo: openNovo,
    openEditar: openEditar,
    salvar: salvar,
    confirmarApagar: confirmarApagar,
    execApagar: execApagar
  };

})();

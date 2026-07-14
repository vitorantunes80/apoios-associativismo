// ============================================================
// GestDDS — checklist.js  v5.1
// Módulo de Checklists de Verificação por equipamento
// ============================================================

var Checklist = (function() {

  // ── RENDER PRINCIPAL ──────────────────────────────────────
  function render(eqId) {
    var alvo = eqDoModulo('checklist', eqId || APP.spotEqId);
    if (!alvo) return semEqParaModulo('Checklists');
    if (APP.spotEqId !== alvo) APP.spotEqId = alvo;
    var eq = getEq(alvo);
    if (!eq) return semEqParaModulo('Checklists');

    var tipo = getTipo(eq.tipo_id);

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Checklists — ' + H(eq.nome) + '</div>';
    html += eqSwitcher('checklist', eq.id) + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    if (APP.podeGerirTemplates(eq.id)) html += '<button class="btn btn-secondary btn-sm" onclick="Checklist.openGerirTemplates(\'' + eq.id + '\')">⚙ Gerir templates</button>';
    html += '<button class="btn btn-primary" onclick="Checklist.openNovoRegisto(\'' + eq.id + '\')">+ Novo registo</button>';
    html += '</div></div>';

    html += _renderTemplates(eq.id);
    html += _renderHistorico(eq.id);
    return html;
  }

  function _renderTemplates(eqId) {
    var templates = (APP.checklist_templates || []).filter(function(t) { return t.equipamento_id === eqId && t.ativo; });

    var html = '<div class="sec-head"><div class="sec-title">Templates activos</div></div>';

    if (!templates.length) {
      return html + emptyState('Sem templates', 'Crie um template de checklist para este equipamento.');
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:20px;">';
    templates.forEach(function(t) {
      var items = (APP.checklist_items || []).filter(function(i) { return i.template_id === t.id; });
      // último registo
      var regs = (APP.checklist_registos || []).filter(function(r) { return r.template_id === t.id; });
      regs.sort(function(a,b) { return new Date(b.data_registo) - new Date(a.data_registo); });
      var ultimo = regs[0];

      var periLabel = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };

      html += '<div class="panel-card" style="cursor:default;">';
      html += '<div class="panel-head">';
      html += '<div><div class="panel-title">' + H(t.nome) + '</div>';
      html += '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">' + (periLabel[t.periodicidade] || t.periodicidade) + ' · ' + items.length + ' itens</div></div>';
      html += '<button class="btn btn-primary btn-sm" onclick="Checklist.openNovoRegistoTemplate(\'' + eqId + '\',\'' + t.id + '\')">Preencher</button>';
      html += '</div>';
      if (ultimo) {
        var d = diasDesde(ultimo.data_registo);
        html += '<div style="padding:10px 13px;font-size:12px;color:var(--text-2);">';
        html += '✓ Último registo: <strong>' + fData(ultimo.data_registo) + '</strong>';
        html += ' <span class="days-bdg ' + diasCls(d) + '">' + d + 'd</span></div>';
      } else {
        html += '<div style="padding:10px 13px;font-size:12px;color:var(--text-3);">Sem registos ainda.</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderHistorico(eqId) {
    var regs = (APP.checklist_registos || []).filter(function(r) { return r.equipamento_id === eqId; });
    regs.sort(function(a,b) { return new Date(b.data_registo) - new Date(a.data_registo); });

    var html = '<div class="sec-head" style="margin-top:4px;"><div class="sec-title">Histórico de registos</div></div>';

    if (!regs.length) return html + emptyState('Sem registos', 'Nenhuma verificação realizada ainda.');

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Data</th><th>Template</th><th>Realizado por</th><th>Resultado</th><th>Obs.</th></tr></thead>';
    html += '<tbody>';
    regs.slice(0, 20).forEach(function(r) {
      var tmpl  = (APP.checklist_templates || []).filter(function(t) { return t.id === r.template_id; })[0];
      var func  = APP.utilizadores.filter(function(u) { return u.id === r.realizado_por; })[0];
      var resps = (APP.checklist_respostas || []).filter(function(x) { return x.registo_id === r.id; });
      var nOk   = resps.filter(function(x) { return x.resposta === true; }).length;
      var nNok  = resps.filter(function(x) { return x.resposta === false; }).length;
      var pct   = resps.length ? Math.round(nOk / resps.length * 100) : 0;

      html += '<tr>';
      html += '<td class="td-m">' + fData(r.data_registo) + '</td>';
      html += '<td class="td-p">' + H(tmpl ? tmpl.nome : '—') + '</td>';
      html += '<td class="td-m">' + H(func ? func.nome : '—') + '</td>';
      html += '<td>';
      if (resps.length) {
        var cor = pct === 100 ? 'var(--green)' : pct >= 75 ? 'var(--amber)' : 'var(--red)';
        html += '<span style="font-weight:700;color:' + cor + ';">' + pct + '%</span>';
        html += '<span style="font-size:11px;color:var(--text-3);"> (' + nOk + '✓ ' + nNok + '✗)</span>';
      } else {
        html += '<span class="td-m">—</span>';
      }
      html += '</td>';
      html += '<td class="td-m" style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(r.observacoes || '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // ── MODAIS HTML ───────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // MODAL REGISTO (preencher checklist)
    html += '<div class="modal-bd" id="m-chk-registo">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><div><div class="modal-title" id="m-chk-ttl">Preencher checklist</div><div class="modal-sub" id="m-chk-sub">—</div></div><button class="modal-close" onclick="closeModal(\'m-chk-registo\')">✕</button></div>';
    html += '<div class="modal-body" id="m-chk-body"><div class="loading-wrap"><div class="spinner"></div></div></div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-chk-registo\')">Cancelar</button><button class="btn btn-primary" onclick="Checklist.guardarRegisto()">Guardar registo</button></div>';
    html += '</div></div>';

    // MODAL GERIR TEMPLATES
    html += '<div class="modal-bd" id="m-chk-templates">';
    html += '<div class="modal" style="max-width:560px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-teal"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><div><div class="modal-title">Gerir templates de checklist</div><div class="modal-sub" id="m-tmpl-eq">—</div></div><button class="modal-close" onclick="closeModal(\'m-chk-templates\')">✕</button></div>';
    html += '<div class="modal-body" id="m-tmpl-body"></div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-chk-templates\')">Fechar</button><button class="btn btn-primary" onclick="Checklist.openNovoTemplate()">+ Novo template</button></div>';
    html += '</div></div>';

    // MODAL NOVO TEMPLATE
    html += '<div class="modal-bd" id="m-chk-novo-tmpl">';
    html += '<div class="modal" style="max-width:520px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-teal"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div><div class="modal-title" id="m-ntmpl-ttl">Novo template</div><div class="modal-sub">Defina os itens de verificação</div></div><button class="modal-close" onclick="closeModal(\'m-chk-novo-tmpl\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-row"><div class="fi"><label class="fl">Nome *</label><input type="text" id="tmpl-nome" class="fin" placeholder="ex: Checklist Início de Turno"></div>';
    html += '<div class="fi"><label class="fl">Periodicidade</label><select id="tmpl-peri" class="fin"><option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></div></div>';
    html += '<div class="fi"><label class="fl">Descrição</label><input type="text" id="tmpl-desc" class="fin" placeholder="Descrição breve"></div>';
    html += '<div class="form-sec-t">Itens de verificação</div>';
    html += '<div id="tmpl-itens" style="margin-bottom:8px;"></div>';
    html += '<button class="btn btn-ghost btn-sm" onclick="Checklist.addItem()">+ Adicionar item</button>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-chk-novo-tmpl\')">Cancelar</button><button class="btn btn-primary" onclick="Checklist.salvarTemplate()">Guardar template</button></div>';
    html += '</div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  var _currentEqId     = null;
  var _currentTemplId  = null;
  var _itemCount       = 0;

  function openNovoRegisto(eqId) {
    // se há templates, mostrar selector
    var templates = (APP.checklist_templates || []).filter(function(t) { return t.equipamento_id === eqId && t.ativo; });
    if (!templates.length) {
      toast('Crie primeiro um template de checklist.', 'error'); return;
    }
    if (templates.length === 1) {
      openNovoRegistoTemplate(eqId, templates[0].id); return;
    }
    // múltiplos — mostrar escolha (simplificado: usar o primeiro)
    openNovoRegistoTemplate(eqId, templates[0].id);
  }

  function openNovoRegistoTemplate(eqId, templId) {
    _currentEqId    = eqId;
    _currentTemplId = templId;
    var eq    = getEq(eqId);
    var templ = (APP.checklist_templates || []).filter(function(t) { return t.id === templId; })[0];
    var items = (APP.checklist_items || []).filter(function(i) { return i.template_id === templId; });
    items.sort(function(a,b) { return a.ordem - b.ordem; });

    document.getElementById('m-chk-ttl').textContent = templ ? templ.nome : 'Checklist';
    document.getElementById('m-chk-sub').textContent = eq ? eq.nome : '—';

    var body = document.getElementById('m-chk-body');
    if (!items.length) {
      body.innerHTML = emptyState('Sem itens', 'Adicione itens a este template.');
    } else {
      var html = '<div style="margin-bottom:12px;">';
      items.forEach(function(item) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">';
        html += '<div style="display:flex;gap:8px;flex-shrink:0;">';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="item-' + item.id + '" value="ok" style="accent-color:var(--green);"> <span style="font-size:12px;color:var(--green);font-weight:600;">✓ OK</span></label>';
        html += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="item-' + item.id + '" value="nok" style="accent-color:var(--red);"> <span style="font-size:12px;color:var(--red);font-weight:600;">✗ NOK</span></label>';
        html += '</div>';
        html += '<div style="flex:1;font-size:13px;color:var(--text);">' + H(item.pergunta) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="fi"><label class="fl">Observações gerais</label><textarea id="chk-obs" class="fin" rows="2" placeholder="Notas sobre esta verificação..."></textarea></div>';
      body.innerHTML = html;
    }
    openModal('m-chk-registo');
  }

  function guardarRegisto() {
    if (!_currentEqId || !_currentTemplId) return;
    var items = (APP.checklist_items || []).filter(function(i) { return i.template_id === _currentTemplId; });
    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var realPor = APP.user && APP.user.id && uuidRx.test(APP.user.id) ? APP.user.id : null;
    var obs = (document.getElementById('chk-obs') || {}).value || '';

    // criar registo
    sbPost('checklist_registos', {
      template_id:   _currentTemplId,
      equipamento_id: _currentEqId,
      realizado_por: realPor,
      data_registo:  new Date().toISOString(),
      observacoes:   obs
    }).then(function(data) {
      var regId = Array.isArray(data) ? data[0].id : (data.id || null);
      if (!regId || !items.length) {
        toast('Registo guardado.', 'success');
        closeModal('m-chk-registo');
        _reloadChecklist();
        return;
      }
      // guardar respostas
      var respostas = items.map(function(item) {
        var radios = document.querySelectorAll('input[name="item-' + item.id + '"]');
        var val = null;
        radios.forEach(function(r) { if (r.checked) val = r.value === 'ok'; });
        return { registo_id: regId, item_id: item.id, resposta: val };
      }).filter(function(r) { return r.resposta !== null; });

      if (!respostas.length) {
        toast('Registo guardado (sem respostas).', 'success');
        closeModal('m-chk-registo');
        _reloadChecklist();
        return;
      }

      // inserir respostas em batch
      var promises = respostas.map(function(r) { return sbPost('checklist_respostas', r); });
      Promise.all(promises).then(function() {
        toast('Checklist registada com sucesso.', 'success');
        closeModal('m-chk-registo');
        _reloadChecklist();
      });
    }).catch(function(e) {
      console.error('Erro checklist:', e);
      toast('Erro ao guardar registo.', 'error');
    });
  }

  function openGerirTemplates(eqId) {
    _currentEqId = eqId;
    var eq = getEq(eqId);
    document.getElementById('m-tmpl-eq').textContent = eq ? eq.nome : '—';
    _renderTmplList();
    openModal('m-chk-templates');
  }

  function _renderTmplList() {
    var templates = (APP.checklist_templates || []).filter(function(t) { return t.equipamento_id === _currentEqId; });
    var body = document.getElementById('m-tmpl-body');
    if (!body) return;
    if (!templates.length) {
      body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px;">Sem templates. Crie o primeiro.</div>';
      return;
    }
    var html = '';
    templates.forEach(function(t) {
      var items = (APP.checklist_items || []).filter(function(i) { return i.template_id === t.id; });
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">';
      html += '<div style="flex:1;"><div style="font-weight:600;color:var(--text);font-size:13px;">' + H(t.nome) + '</div>';
      html += '<div style="font-size:11.5px;color:var(--text-3);">' + items.length + ' itens · ' + (t.periodicidade || '') + (t.ativo ? '' : ' · Inactivo') + '</div></div>';
      html += '<button class="btn btn-ghost btn-sm" onclick="Checklist.editarTemplate(\'' + t.id + '\')">Editar</button>';
      html += '</div>';
    });
    body.innerHTML = html;
  }

  function openNovoTemplate() {
    APP.editId = null;
    document.getElementById('m-ntmpl-ttl').textContent = 'Novo template';
    document.getElementById('tmpl-nome').value = '';
    document.getElementById('tmpl-desc').value = '';
    document.getElementById('tmpl-peri').value = 'diaria';
    document.getElementById('tmpl-itens').innerHTML = '';
    _itemCount = 0;
    addItem();
    openModal('m-chk-novo-tmpl');
  }

  function editarTemplate(id) {
    var t = (APP.checklist_templates || []).filter(function(x) { return x.id === id; })[0];
    if (!t) return;
    APP.editId = id;
    document.getElementById('m-ntmpl-ttl').textContent = 'Editar template';
    document.getElementById('tmpl-nome').value = t.nome || '';
    document.getElementById('tmpl-desc').value = t.descricao || '';
    document.getElementById('tmpl-peri').value = t.periodicidade || 'diaria';

    var items = (APP.checklist_items || []).filter(function(i) { return i.template_id === id; });
    items.sort(function(a,b) { return a.ordem - b.ordem; });
    document.getElementById('tmpl-itens').innerHTML = '';
    _itemCount = 0;
    items.forEach(function(item) {
      addItemCom(item.pergunta, item.id);
    });
    if (!items.length) addItem();
    openModal('m-chk-novo-tmpl');
  }

  function addItem() { addItemCom('', null); }

  function addItemCom(valor, itemId) {
    _itemCount++;
    var cont = document.getElementById('tmpl-itens');
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:7px;';
    div.innerHTML = '<span style="font-size:12px;color:var(--text-3);width:18px;text-align:right;flex-shrink:0;">' + _itemCount + '.</span>' +
      '<input type="text" class="fin" placeholder="Descrição do item..." value="' + H(valor) + '" style="flex:1;" data-item-id="' + (itemId || '') + '">' +
      '<button class="btn btn-ghost btn-sm" style="color:var(--red);flex-shrink:0;" onclick="this.parentNode.remove()">✕</button>';
    cont.appendChild(div);
  }

  function salvarTemplate() {
    var nome = document.getElementById('tmpl-nome').value.trim();
    if (!nome) { toast('Nome obrigatório.', 'error'); return; }

    var body = {
      equipamento_id: _currentEqId,
      nome:           nome,
      descricao:      document.getElementById('tmpl-desc').value.trim(),
      periodicidade:  document.getElementById('tmpl-peri').value,
      ativo:          true
    };

    var p = APP.editId
      ? sbPatch('checklist_templates', 'id=eq.' + APP.editId, body)
      : sbPost('checklist_templates', body);

    p.then(function(data) {
      var tmplId = APP.editId || (Array.isArray(data) ? data[0].id : data.id);

      // guardar itens
      var inputs = document.querySelectorAll('#tmpl-itens input[type="text"]');
      var itens  = [];
      inputs.forEach(function(inp, idx) {
        var val = inp.value.trim();
        if (val) itens.push({ pergunta: val, ordem: idx, existId: inp.dataset.itemId || null });
      });

      // apagar itens antigos se edição
      var deleteP = APP.editId
        ? sbDelete('checklist_items', 'template_id=eq.' + APP.editId)
        : Promise.resolve();

      deleteP.then(function() {
        var inserts = itens.map(function(it) {
          return sbPost('checklist_items', { template_id: tmplId, pergunta: it.pergunta, ordem: it.ordem });
        });
        return Promise.all(inserts);
      }).then(function() {
        toast(APP.editId ? 'Template actualizado.' : 'Template criado.', 'success');
        closeModal('m-chk-novo-tmpl');
        _reloadChecklist();
        _renderTmplList();
      });
    }).catch(function() { toast('Erro ao guardar template.', 'error'); });
  }

  function _reloadChecklist() {
    _loadChecklist(function() {
      var c = document.getElementById('main-content');
      if (c && APP.view === 'equipamentos' && APP.subview === 'checklist') {
        c.innerHTML = render(APP.spotEqId);
      }
    });
  }

  function _loadChecklist(cb) {
    if (!APP.spotEqId) { if (cb) cb(); return; }
    Promise.all([
      sbGet('checklist_templates', 'equipamento_id=eq.' + APP.spotEqId + '&order=created_at.asc').then(function(d) { APP.checklist_templates = Array.isArray(d) ? d : []; }),
      sbGet('checklist_items',     'order=ordem.asc').then(function(d) { APP.checklist_items     = Array.isArray(d) ? d : []; }),
      sbGet('checklist_registos',  'equipamento_id=eq.' + APP.spotEqId + '&order=data_registo.desc&limit=50').then(function(d) { APP.checklist_registos  = Array.isArray(d) ? d : []; }),
      sbGet('checklist_respostas', 'order=created_at.desc').then(function(d) { APP.checklist_respostas = Array.isArray(d) ? d : []; })
    ]).then(function() { if (cb) cb(); }).catch(function() { if (cb) cb(); });
  }

  function init() {
    APP.checklist_templates = APP.checklist_templates || [];
    APP.checklist_items     = APP.checklist_items     || [];
    APP.checklist_registos  = APP.checklist_registos  || [];
    APP.checklist_respostas = APP.checklist_respostas || [];
    var cont = document.getElementById('modais-checklist');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  function load(cb) { _loadChecklist(cb); }

  return {
    render: render, init: init, load: load,
    openNovoRegisto: openNovoRegisto,
    openNovoRegistoTemplate: openNovoRegistoTemplate,
    guardarRegisto: guardarRegisto,
    openGerirTemplates: openGerirTemplates,
    openNovoTemplate: openNovoTemplate,
    editarTemplate: editarTemplate,
    addItem: addItem,
    salvarTemplate: salvarTemplate
  };

})();

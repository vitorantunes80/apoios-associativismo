// ============================================================
// GestDDS — dashboard.js
// Módulo do dashboard principal
// ============================================================

var Dashboard = (function() {

  function _seletorAno() {
    var anoActual = new Date().getFullYear();
    var anoSel = APP.anoTrabalho || anoActual;
    // oferecer do ano actual até 4 anos atrás, e o próximo ano
    var anos = [];
    for (var a = anoActual + 1; a >= anoActual - 4; a--) anos.push(a);

    var html = '<select onchange="App.mudarAno(this.value)" style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;">';
    anos.forEach(function(a) {
      var label = a === anoActual ? a + ' (actual)' : a;
      html += '<option value="' + a + '"' + (a === anoSel ? ' selected' : '') + '>' + label + '</option>';
    });
    html += '</select>';
    if (anoSel !== anoActual) {
      html += '<span style="font-size:11px;color:var(--amber);font-weight:700;">📅 A ver ' + anoSel + '</span>';
    }
    return html;
  }

  // ── RENDER PRINCIPAL ──────────────────────────────────────
  function render() {
    var nome = APP.nomeUtilizador().split(' ')[0];
    var eqAtivos = APP.equipamentos.filter(function(e) { return e.estado === 'ativo'; }).length;
    var mAbertos = APP.memos.filter(function(m) { return m.estado !== 'concluido'; }).length;

    var html = '';

    // GREETING
    html += '<div class="dash-greeting">';
    html += '<div><div class="dash-hello">' + H(saudacao()) + ', ' + H(nome) + ' 👋</div>';
    var subMsg = 'Bem-vindo ao sistema de gestão de equipamentos da DDS.';
    if (!APP.isDds() && APP.user && APP.user.equipamento_id) {
      var meuEq = getEq(APP.user.equipamento_id);
      if (meuEq) subMsg = APP.perfilLabel() + ' · ' + meuEq.nome;
    } else if (APP.isDds()) {
      subMsg = APP.perfilLabel() + ' · Divisão de Desenvolvimento Social';
    }
    html += '<div class="dash-sub">' + H(subMsg) + '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    html += '<div class="dash-date"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + H(hojeExtenso()) + '</div>';
    html += _seletorAno();
    html += '</div>';
    html += '</div>';

    // STATS — adaptados ao perfil
    var reservasHoje   = _contarReservasHoje();
    var reservasSemana = _contarReservasSemana();

    if (APP.isDds()) {
      // DDS vê tudo
      html += '<div class="stats-grid stats-grid-5">';
      html += _statCard('si-blue',   _svgEq(),   'Equipamentos',   APP.equipamentos.length, 'Ativos',    "App.nav('equipamentos','lista')");
      var _nExt = APP.utilizadores.filter(function(u){ return u.unidade === 'EXTERNA'; }).length;
      var _nDds = APP.utilizadores.length - _nExt;
      html += _statCard('si-green',  _svgTeam(), 'Funcionários',   _nDds, _nExt ? ('DDS · +' + _nExt + ' externos') : 'Registados', APP.podeGerirUtilizadores()?"App.nav('funcionarios')":'');
      html += _statCard('si-amber',  _svgTool(), 'Memorandos',     mAbertos,                'Pendentes', "App.nav('memorandos','sec2')");
      html += _statCard('si-purple', _svgCal(),  'Reservas Hoje',  reservasHoje,            'Agendadas', "App.nav('reservas')");
      html += _statCard('si-teal',   _svgCal(),  'Reservas Semana', reservasSemana,         'Na semana', "App.nav('reservas')");
      html += '</div>';
    } else {
      // Responsável / funcionário — foco no seu equipamento
      var meuEqId = APP.user ? APP.user.equipamento_id : null;
      var memosMe = APP.memos.filter(function(m){ return m.equipamento_id === meuEqId && m.estado !== 'concluido'; }).length;
      var funcsMe = APP.utilizadores.filter(function(u){ return u.equipamento_id === meuEqId && !u.isDds; }).length;
      html += '<div class="stats-grid">';
      html += _statCard('si-purple', _svgCal(),  'Reservas Hoje',   reservasHoje,   'Hoje', "App.nav('reservas')");
      html += _statCard('si-teal',   _svgCal(),  'Reservas Semana', reservasSemana, 'Na semana', "App.nav('reservas')");
      html += _statCard('si-green',  _svgTeam(), 'Colegas',         funcsMe,        'Afectos', '');
      if (APP.podeCriarMemorandos()) {
        html += _statCard('si-amber', _svgTool(), 'Memorandos', memosMe, 'Abertos', "App.nav('memorandos','sec2')");
      } else if (APP.acessoMenu('checklists')) {
        html += _statCard('si-blue', _svgCheck(), 'Checklists', (APP.checklist_templates||[]).filter(function(t){return t.equipamento_id===meuEqId&&t.ativo;}).length, 'Para preencher', "App.nav('checklists')");
      }
      html += '</div>';
    }

    // MAIN GRID
    html += '<div class="dash-grid">';

    // ESQUERDA
    html += '<div>';
    html += _renderSpotlight();
    if (APP.podeCriarMemorandos()) html += _renderMemosRecentes();
    html += '</div>';

    // DIREITA
    html += '<div>';
    html += _renderReservas();
    html += _renderChecklists();
    if (APP.podeCriarMemorandos()) html += _renderReparacoes();
    html += '</div>';

    html += '</div>'; // dash-grid

    return html;
  }

  // ── SPOTLIGHT ─────────────────────────────────────────────
  // ── ABAS DE UM EQUIPAMENTO ─────────────────────────────────
  // Módulos activos do equipamento × acessos do utilizador.
  // Usada pelo spotlight do dashboard E pela sidebar (sub-menus).
  function tabsDoEquipamento(eq) {
    function _tem(chave) {
      if (!eq) return false;
      if (typeof modAtivo !== 'function') return true;
      return modAtivo(eq, chave);
    }

    var tabs = [{ k: 'geral', l: 'Visão Geral' }];

    if (_tem('reservas')  && APP.acessoMenu('reservas'))   tabs.push({ k: 'reservas',  l: 'Reservas' });
    if (_tem('escalas')   && APP.acessoMenu('escalas'))    tabs.push({ k: 'escalas',   l: 'Escala' });
    if (_tem('checklist') && APP.acessoMenu('checklists')) tabs.push({ k: 'checklist', l: 'Checklists' });

    // memorandos existem sempre (são transversais à DDS)
    tabs.push({ k: 'reparacoes', l: 'Reparações' });

    var temEstadias = _tem('estadias') && typeof Estadias !== 'undefined'
                   && (typeof APP.podeVerEstadias !== 'function' || APP.podeVerEstadias(eq.id));
    if (temEstadias) tabs.push({ k: 'estadias', l: 'Check-in / Check-out' });

    var temVisitas = _tem('visitas') && typeof Visitas !== 'undefined'
                  && (typeof APP.podeVerVisitas !== 'function' || APP.podeVerVisitas(eq.id));
    if (temVisitas) tabs.push({ k: 'visitas', l: 'Registo de Visitas' });

    tabs.push({ k: 'info', l: 'Informações' });
    return tabs;
  }

  // Navegar directamente para uma aba de um equipamento (usado pela sidebar)
  function goTab(eqId, chave) {
    APP.spotEqId = eqId;
    App.nav('dashboard'); // renderiza o dashboard e fecha a sidebar no mobile
    // repor o destaque do equipamento (o nav limpa os .active)
    document.querySelectorAll('.sb-eq-item[data-eqid], .sb-eq-row[data-eqid]').forEach(function(el) {
      el.classList.toggle('active', el.dataset.eqid === eqId);
    });
    var idx = (APP._spotTabs || []).indexOf(chave);
    if (idx >= 0) switchTab(idx);
  }

  function _renderSpotlight() {
    var spotEq   = getEq(APP.spotEqId);
    var spotTipo = spotEq ? getTipo(spotEq.tipo_id) : null;
    var spotNome = spotEq ? spotEq.nome : 'Seleccione um equipamento';
    var spotEmoji = spotTipo ? (spotTipo.emoji || '🏢') : '🏢';

    var html = '<div class="eq-spotlight">';

    // HEADER
    html += '<div class="eqs-hdr">';
    html += '<div class="eqs-left">';
    html += '<span class="eqs-emoji">' + spotEmoji + '</span>';
    html += '<div class="eqs-title">' + H(spotNome) + '</div>';
    html += '</div>';

    // Selector — apenas DDS
    if (APP.isDds()) {
      html += '<div class="eq-sel-wrap" id="eq-sel-wrap">';
      html += '<div class="eq-sel-btn" id="eq-sel-btn" onclick="Dashboard.toggleSelector()">Mudar equipamento ▾</div>';
      html += '<div class="eq-sel-dd" id="eq-sel-dd">';
      // agrupar por tipo
      APP.tiposEq.forEach(function(tipo) {
        var eqsTipo = APP.equipamentos.filter(function(e) { return e.tipo_id === tipo.id; });
        if (!eqsTipo.length) return;
        html += '<div class="eq-sel-grp">' + (tipo.emoji ? tipo.emoji + ' ' : '') + H(tipo.nome) + '</div>';
        eqsTipo.forEach(function(e) {
          var cor = EQ_COLORS[APP.equipamentos.indexOf(e) % EQ_COLORS.length];
          var active = e.id === APP.spotEqId;
          html += '<div class="eq-sel-item' + (active ? ' active' : '') + '" onclick="Dashboard.selectSpot(\'' + e.id + '\')">';
          html += '<span class="eq-sel-dot" style="background:' + cor + ';"></span>' + H(e.nome);
          html += '</div>';
        });
      });
      html += '</div></div>';
    }

    html += '</div>'; // eqs-hdr

    // TABS
    // ── Abas construídas a partir dos MÓDULOS ACTIVOS do equipamento
    //    e dos ACESSOS do utilizador (função partilhada com a sidebar) ──
    var tabs = tabsDoEquipamento(spotEq);

    // helpers locais usados nos painéis mais abaixo
    function _tem(chave) {
      if (!spotEq) return false;
      if (typeof modAtivo !== 'function') return true;
      return modAtivo(spotEq, chave);
    }
    var temEstadias = tabs.some(function(t) { return t.k === 'estadias'; });

    // guardar para o switchTab saber o que carregar
    APP._spotTabs = tabs.map(function(t) { return t.k; });

    html += '<div class="eq-tabs" id="spot-tabs">';
    tabs.forEach(function(t, i) {
      html += '<div class="eq-tab' + (i === 0 ? ' active' : '') + '" onclick="Dashboard.switchTab(' + i + ')">' + t.l + '</div>';
    });
    html += '</div>';

    // ── PAINÉIS — um por aba, pela mesma ordem ──
    html += '<div id="spot-panels">';

    tabs.forEach(function(t, i) {
      html += '<div class="eq-tab-panel' + (i === 0 ? ' active' : '') + '" id="spot-t' + i + '">';

      if (t.k === 'geral') {
        if (spotEq) {
          html += '<div class="stats-grid stats-grid-3" style="margin-bottom:12px;">';

          // o cartão de reservas só faz sentido se o módulo estiver ligado
          if (_tem('reservas')) {
            var rHoje = _contarReservasHojeEq(APP.spotEqId);
            var rSemana = _contarReservasSemanaEq(APP.spotEqId);
            html += _statCard('si-blue', _svgCal(), 'Reservas', rSemana, rHoje + ' hoje · ' + rSemana + ' esta semana', '');
          } else if (temEstadias && typeof Estadias !== 'undefined') {
            // no campismo, o que interessa é a ocupação
            var est = Estadias.lista ? Estadias.lista() : [];
            var ocup = est.filter(function(x){ return x.equipamento_id === spotEq.id && x.estado === 'ativa'; });
            var pes = 0;
            ocup.forEach(function(x){ pes += (parseInt(x.n_adultos,10)||0) + (parseInt(x.n_criancas,10)||0); });
            html += _statCard('si-blue', _svgCal(), 'Ocupação', ocup.length, pes + ' pessoas no parque', '');
          }

          var funcsEq = (typeof funcsDoEq === 'function')
            ? funcsDoEq(spotEq.id).length
            : APP.utilizadores.filter(function(u){ return u.equipamento_id === spotEq.id; }).length;
          html += _statCard('si-green', _svgTeam(), 'Funcionários', funcsEq, 'Afectos', '');

          var memosEq = APP.memos.filter(function(m) { return m.equipamento_id === spotEq.id && m.estado !== 'concluido'; });
          html += _statCard('si-amber', _svgTool(), 'Memos Abertos', memosEq.length, 'Pendentes', '');
          html += '</div>';

          if (spotEq.morada || spotEq.localidade || spotEq.telefone) {
            html += '<div class="detail-box">';
            if (spotEq.morada) html += '<div class="detail-row"><span class="detail-lbl">Morada</span><span class="detail-val">' + H(spotEq.morada) + (spotEq.localidade ? ', ' + H(spotEq.localidade) : '') + '</span></div>';
            if (spotEq.telefone) html += '<div class="detail-row"><span class="detail-lbl">Telefone</span><span class="detail-val">' + H(spotEq.telefone) + '</span></div>';
            if (spotEq.capacidade) html += '<div class="detail-row"><span class="detail-lbl">Capacidade</span><span class="detail-val">' + spotEq.capacidade + ' pessoas</span></div>';
            html += '</div>';
          }
        } else {
          html += '<div class="mod-ph"><div class="mod-ph-t">Sem equipamento seleccionado</div><div class="mod-ph-s">Seleccione um equipamento na barra lateral.</div></div>';
        }

      } else if (t.k === 'reservas') {
        html += _renderReservasTab(APP.spotEqId);
      } else if (t.k === 'escalas') {
        html += _renderEscala();
      } else if (t.k === 'checklist') {
        html += _renderChecklistsTab(APP.spotEqId);
      } else if (t.k === 'reparacoes') {
        html += _renderReparacoesTab(APP.spotEqId);
      } else if (t.k === 'info') {
        html += _renderInfoTab(APP.spotEqId);
      } else if (t.k === 'estadias') {
        html += '<div id="spot-estadias-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
      } else if (t.k === 'visitas') {
        html += '<div id="spot-visitas-content"><div class="loading-wrap"><div class="spinner"></div></div></div>';
      }

      html += '</div>';
    });

    html += '</div>'; // spot-panels
    html += '</div>'; // eq-spotlight
    return html;
  }

  // ── TAB CHECKLISTS ────────────────────────────────────────
  function _renderChecklistsTab(eqId) {
    var templates = (APP.checklist_templates || []).filter(function(t){ return t.equipamento_id === eqId && t.ativo; });
    var registos  = (APP.checklist_registos || []).filter(function(r){ return r.equipamento_id === eqId; });
    registos.sort(function(a,b){ return new Date(b.data_registo) - new Date(a.data_registo); });

    var html = '<div style="padding:4px 0;">';
    html += '<div class="escala-controls"><div class="escala-nav"><div class="escala-week">✓ Checklists de verificação</div></div>';
    if (APP.acessoMenu('checklists')) {
      html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'checklists\')">Abrir checklists</button>';
    }
    html += '</div>';

    if (!templates.length) {
      html += '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13px;border:1px dashed var(--border);border-radius:var(--r);">Sem checklists configuradas para este equipamento.</div>';
      html += '</div>';
      return html;
    }

    // cards de templates
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px;">';
    templates.forEach(function(t) {
      var regsT = registos.filter(function(r){ return r.template_id === t.id; });
      var ultimo = regsT[0];
      var periLabel = { diaria:'Diária', semanal:'Semanal', mensal:'Mensal' };
      html += '<div style="border:1px solid var(--border);border-radius:var(--r);padding:12px;background:var(--surface);">';
      html += '<div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:3px;">' + H(t.nome) + '</div>';
      html += '<div style="font-size:11px;color:var(--text-3);margin-bottom:8px;">' + (periLabel[t.periodicidade]||t.periodicidade) + '</div>';
      if (ultimo) {
        var d = diasDesde(ultimo.data_registo);
        html += '<div style="font-size:11.5px;color:var(--text-2);">Último: ' + fData(ultimo.data_registo) + ' <span class="days-bdg ' + diasCls(d) + '">' + d + 'd</span></div>';
      } else {
        html += '<div style="font-size:11.5px;color:var(--text-3);">Sem registos</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // últimos registos
    if (registos.length) {
      html += '<div class="sec-head"><div class="sec-title" style="font-size:13px;">Últimos registos</div></div>';
      html += '<div class="dtw"><table class="dt"><thead><tr><th>Data</th><th>Checklist</th><th>Por</th><th>Resultado</th></tr></thead><tbody>';
      registos.slice(0,5).forEach(function(r){
        var tmpl = templates.filter(function(t){return t.id===r.template_id;})[0];
        var func = APP.utilizadores.filter(function(u){return u.id===r.realizado_por;})[0];
        var resps = (APP.checklist_respostas||[]).filter(function(x){return x.registo_id===r.id;});
        var nOk = resps.filter(function(x){return x.resposta===true;}).length;
        var pct = resps.length ? Math.round(nOk/resps.length*100) : 0;
        var cor = pct===100?'var(--green)':pct>=75?'var(--amber)':'var(--red)';
        html += '<tr><td class="td-m">' + fData(r.data_registo) + '</td>';
        html += '<td class="td-p">' + H(tmpl?tmpl.nome:'—') + '</td>';
        html += '<td class="td-m">' + H(func?func.nome:'—') + '</td>';
        html += '<td>' + (resps.length ? '<span style="font-weight:700;color:'+cor+';">'+pct+'%</span>' : '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  // ── TAB REPARAÇÕES (memorandos do equipamento) ────────────
  function _renderReparacoesTab(eqId) {
    var memos = (APP.memos || []).filter(function(m){ return m.equipamento_id === eqId; });
    memos.sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at); });

    var abertos = memos.filter(function(m){ return m.estado !== 'concluido'; });
    var concl   = memos.filter(function(m){ return m.estado === 'concluido'; });

    var html = '<div style="padding:4px 0;">';
    html += '<div class="escala-controls"><div class="escala-nav"><div class="escala-week">🔧 Memorandos / Reparações</div></div>';
    if (APP.podeCriarMemorandos()) {
      html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'memorandos\',\'sec2\')">Ver memorandos</button>';
    }
    html += '</div>';

    // stats rápidas
    html += '<div class="stats-grid stats-grid-3" style="margin-bottom:14px;">';
    html += _statCard('si-amber', _svgTool(), 'Abertos', abertos.length, 'Pendentes', '');
    html += _statCard('si-green', _svgCheck(), 'Concluídos', concl.length, 'Resolvidos', '');
    var comReforco = memos.filter(function(m){ return m.num_reforcos>0; }).length;
    html += _statCard('si-red', _svgTool(), 'Com reforço', comReforco, 'Insistências', '');
    html += '</div>';

    if (!memos.length) {
      html += '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13px;border:1px dashed var(--border);border-radius:var(--r);">Sem memorandos para este equipamento.</div>';
      html += '</div>';
      return html;
    }

    // lista de memorandos
    html += '<div class="sec-head"><div class="sec-title" style="font-size:13px;">Histórico</div></div>';
    html += '<div class="dtw"><table class="dt"><thead><tr><th>Nº</th><th>Descrição</th><th>Data</th><th>Estado</th></tr></thead><tbody>';
    memos.slice(0,8).forEach(function(m){
      var estBadge;
      if (m.estado === 'concluido') estBadge = '<span class="bdg bdg-concluido"><span class="bdg-dot"></span>Concluído</span>';
      else if (m.data_envio_servicos) estBadge = '<span class="bdg bdg-andamento"><span class="bdg-dot"></span>Em curso</span>';
      else if (m.aprovado_dds) estBadge = '<span class="bdg bdg-enviado"><span class="bdg-dot"></span>A enviar</span>';
      else estBadge = '<span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span>';
      html += '<tr><td class="td-mono">' + H(m.numero||'—') + '</td>';
      html += '<td class="td-p" style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(m.descricao||'—') + '</td>';
      html += '<td class="td-m">' + fData(m.created_at) + '</td>';
      html += '<td>' + estBadge + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '</div>';
    return html;
  }

  // ── TAB INFORMAÇÕES ───────────────────────────────────────
  function _renderInfoTab(eqId) {
    var eq = getEq(eqId);
    if (!eq) return '<div class="mod-ph"><div class="mod-ph-t">Sem dados</div></div>';
    var tipo = getTipo(eq.tipo_id);
    var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === eqId; });
    var funcs = APP.utilizadores.filter(function(u){ return u.equipamento_id === eqId && !u.isDds; });

    var html = '<div style="padding:4px 0;">';

    // dados gerais
    html += '<div class="detail-box" style="margin-bottom:14px;">';
    html += '<div class="detail-row"><span class="detail-lbl">Tipo</span><span class="detail-val">' + (tipo?(tipo.emoji||'')+' '+H(tipo.nome):'—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Código</span><span class="detail-val td-mono">' + H(eq.codigo||'—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Morada</span><span class="detail-val">' + H(eq.morada||'—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Localidade</span><span class="detail-val">' + H(eq.localidade||'—') + '</span></div>';
    var respD = eq.responsavel_id ? (APP.utilizadores||[]).filter(function(u){ return u.id === eq.responsavel_id; })[0] : null;
    html += '<div class="detail-row"><span class="detail-lbl">Responsável</span><span class="detail-val">' + (respD ? H(respD.nome) : '<span style="color:var(--text-3);">Não atribuído</span>') + '</span></div>';
    if (respD && (respD.email || respD.telefone)) {
      html += '<div class="detail-row"><span class="detail-lbl">Contacto</span><span class="detail-val">' + H(respD.telefone || respD.email) + '</span></div>';
    }
    html += '<div class="detail-row"><span class="detail-lbl">Telefone</span><span class="detail-val">' + H(eq.telefone||'—') + '</span></div>';
    html += '<div class="detail-row"><span class="detail-lbl">Estado</span><span class="detail-val">' + badgeEqEstado(eq.estado) + '</span></div>';
    html += '</div>';

    // espaços
    if (espacos.length) {
      html += '<div class="sec-head"><div class="sec-title" style="font-size:13px;">Espaços / Valências</div></div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">';
      espacos.forEach(function(esp){
        html += '<span style="background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;">' + H(esp.nome) + '</span>';
      });
      html += '</div>';
    }

    // funcionários afectos
    html += '<div class="sec-head"><div class="sec-title" style="font-size:13px;">Funcionários afectos (' + funcs.length + ')</div></div>';
    if (!funcs.length) {
      html += '<div style="padding:14px;text-align:center;color:var(--text-3);font-size:12.5px;border:1px dashed var(--border);border-radius:var(--r);">Sem funcionários afectos.</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      funcs.forEach(function(f){
        var pal = PERFIL_PALETTES[f.perfil] || ['#F1F5F9','#475569'];
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);">';
        html += '<div style="width:30px;height:30px;border-radius:50%;background:'+pal[0]+';color:'+pal[1]+';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">'+iniciais(f.nome)+'</div>';
        html += '<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:var(--text);">'+H(f.nome)+'</div>';
        html += '<div style="font-size:11px;color:var(--text-3);">'+H((f.perfil||'').replace(/_/g,' '))+'</div></div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // "Maria F. Ferreira" → "Maria F." (nos blocos estreitos não cabe tudo)
  function _primeiroNome(nome) {
    var p = String(nome || '').trim().split(/\s+/);
    if (p.length <= 2) return nome;
    return p[0] + ' ' + p[1];
  }

  // "09:30" → 9.5 (minutos contam!)
  function _hDec(hhmm) {
    if (!hhmm) return null;
    var p = String(hhmm).split(':');
    var h = parseInt(p[0], 10) || 0;
    var m = parseInt(p[1], 10) || 0;
    return h + m / 60;
  }

  function _renderEscala() {
    var eqId = APP.spotEqId;

    // semana actual
    var hoje = new Date();
    var diaSem = hoje.getDay();
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (diaSem===0?6:diaSem-1));
    var dias = [];
    for (var k=0;k<7;k++){ var d=new Date(seg); d.setDate(seg.getDate()+k); dias.push(d); }
    var nomesDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    // cores por tipo de turno
    var TURNO_CORES = {
      normal:   { bg:'#DBEAFE', color:'#1D4ED8' },
      ferias:   { bg:'#DCFCE7', color:'#15803D' },
      folga:    { bg:'#F1F5F9', color:'#64748B' },
      feriado:  { bg:'#FEF3C7', color:'#92400E' },
      formacao: { bg:'#EDE9FE', color:'#5B21B6' },
      doenca:   { bg:'#FEE2E2', color:'#B91C1C' }
    };
    var TURNO_LABELS = { normal:'Normal', ferias:'Férias', folga:'Folga', feriado:'Feriado', formacao:'Formação', doenca:'Doença' };

    var escalas = (APP.escalas || []).filter(function(e){ return e.equipamento_id === eqId; });
    var labelSemana = fData(dias[0].toISOString()) + ' — ' + fData(dias[6].toISOString());

    // ── Grelha horária DINÂMICA: só as horas que interessam ──
    var minH = 24, maxH = 0;
    escalas.forEach(function(e) {
      var hi = _hDec(e.hora_entrada);
      var hf = _hDec(e.hora_saida);
      if (hi == null || hf == null) return;
      if (hi < minH) minH = hi;
      if (hf > maxH) maxH = hf;
    });
    if (minH > maxH) { minH = 9; maxH = 18; }        // sem horas definidas
    minH = Math.max(0, Math.floor(minH) - 1);         // uma hora de folga em cima
    maxH = Math.min(24, Math.ceil(maxH) + 1);         // e outra em baixo
    if (maxH - minH < 4) maxH = minH + 4;             // altura mínima decente

    var hours = [];
    for (var hh = minH; hh < maxH; hh++) {
      hours.push(('0' + hh).slice(-2) + ':00');
    }

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '</div>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'escalas\')">+ Gerir escala</button>';
    html += '</div>';

    if (!escalas.length) {
      html += '<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px;border:1px dashed var(--border);border-radius:var(--r);">';
      html += 'Sem turnos definidos para esta semana.<br><br>';
      html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'escalas\')">Criar escala</button></div>';
      return html;
    }

    html += '<div class="sched-wrap"><div class="sched-grid">';
    html += '<div class="sched-head"></div>';
    dias.forEach(function(d) {
      var isHoje = d.toDateString() === hoje.toDateString();
      html += '<div class="sched-head' + (isHoje ? ' today' : '') + '">' + nomesDia[d.getDay()] + ' ' + d.getDate() + '</div>';
    });

    // TEM de ser igual ao --row do CSS (.sched-grid), senão os blocos
    // ficam desalinhados com a grelha.
    var LINHA = 34;

    hours.forEach(function(h, hi) {
      var hourNum = minH + hi;
      html += '<div class="sched-time">' + h + '</div>';
      dias.forEach(function(d) {
        var dataStr = d.toISOString().split('T')[0];
        html += '<div class="sched-cell">';
        escalas.forEach(function(e) {
          // turno neste dia?
          var ei = String(e.data_inicio).slice(0, 10);
          var ef = String(e.data_fim || e.data_inicio).slice(0, 10);
          if (dataStr < ei || dataStr > ef) return;

          var hIni = _hDec(e.hora_entrada);
          var hFim = _hDec(e.hora_saida);

          // turnos sem hora (folga, férias) — ocupam a primeira linha
          if (hIni == null) {
            if (hourNum !== minH) return;
            var cc0 = TURNO_CORES[e.tipo_turno] || TURNO_CORES.normal;
            var f0 = APP.utilizadores.filter(function(u){ return u.id === e.funcionario_id; })[0];
            html += '<div class="sched-event" style="background:' + cc0.bg + ';color:' + cc0.color + ';height:' + (LINHA - 3) + 'px;cursor:pointer;" onclick="App.nav(\'escalas\')">';
            html += H(f0 ? f0.nome : '—') + '<br><span style="font-weight:400;opacity:.75;font-size:9.5px;">' + H(TURNO_LABELS[e.tipo_turno] || '') + '</span>';
            html += '</div>';
            return;
          }

          // o bloco desenha-se na linha da hora em que COMEÇA
          if (Math.floor(hIni) !== hourNum) return;
          if (hFim == null || hFim <= hIni) hFim = hIni + 1;

          var cc = TURNO_CORES[e.tipo_turno] || TURNO_CORES.normal;
          var func = APP.utilizadores.filter(function(u){ return u.id === e.funcionario_id; })[0];
          var nome = func ? func.nome : 'Funcionário';
          var sub = e.funcao || TURNO_LABELS[e.tipo_turno] || '';

          // offset dentro da linha (ex: 09:30 → meia linha para baixo)
          var offset = (hIni - Math.floor(hIni)) * LINHA;
          var altura = Math.max(14, (hFim - hIni) * LINHA - 3);
          var hrs = e.hora_entrada.slice(0,5) + '–' + e.hora_saida.slice(0,5);

          html += '<div class="sched-event" title="' + H(nome) + ' · ' + hrs + (sub ? ' · ' + H(sub) : '') + '" style="background:' + cc.bg + ';color:' + cc.color + ';top:' + offset + 'px;height:' + altura + 'px;cursor:pointer;" onclick="App.nav(\'escalas\')">';
          html += '<span class="sched-ev-h">' + hrs + '</span>';
          html += H(_primeiroNome(nome));
          html += '</div>';
        });
        html += '</div>';
      });
    });
    html += '</div></div>';

    // Legenda dinâmica — só tipos presentes
    var tiposPresentes = {};
    escalas.forEach(function(e){ tiposPresentes[e.tipo_turno || 'normal'] = true; });
    html += '<div class="sched-legend">';
    Object.keys(tiposPresentes).forEach(function(t){
      var cc = TURNO_CORES[t] || TURNO_CORES.normal;
      html += '<div class="legend-item"><div class="legend-dot" style="background:' + cc.color + ';"></div>' + (TURNO_LABELS[t]||t) + '</div>';
    });
    html += '</div>';

    html += '<div class="sched-footer">';
    html += '<a class="link-text" onclick="App.nav(\'escalas\')">Ver escala completa →</a>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'escalas\')">+ Novo turno</button>';
    html += '</div>';

    return html;
  }

  function _renderMemosRecentes() {
    var abertos = APP.memos.filter(function(m) { return m.estado !== 'concluido'; }).slice(0, 4);
    var html = '<div class="sec-head" style="margin-top:14px;"><div class="sec-title">Memorandos Abertos</div>';
    html += '<div class="sec-link" onclick="App.nav(\'memorandos\',\'sec2\')">Ver todos</div></div>';
    html += '<div class="panel-card">';

    if (abertos.length) {
      abertos.forEach(function(m) {
        var eq = m.equipamento_id ? getEq(m.equipamento_id) : null;
        var d = diasDesde(m.created_at);
        html += '<div class="memo-item">';
        html += '<div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>';
        html += '<div class="mi-body"><div class="mi-title">' + H(m.descricao || '—') + '</div>';
        html += '<div class="mi-sub">' + H(eq ? eq.nome : (m.brigada || '—')) + '</div></div>';
        html += '<div class="mi-right">' + badgeMemo(m) + '<div class="mi-days">' + d + 'd</div></div>';
        html += '<div class="mi-arr">›</div>';
        html += '</div>';
      });
    } else {
      html += '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12.5px;">Sem memorandos abertos.</div>';
    }

    html += '</div>';
    return html;
  }

  function _contarReservasSemana() {
    if (!APP.reservas) return 0;
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var diaSem = hoje.getDay();
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (diaSem===0?6:diaSem-1));
    var total = 0;
    (APP.reservas||[]).forEach(function(r){
      if (r.estado==='cancelada') return;
      if (r.recorrente) {
        var ds=(r.dias_semana||'').split(',').map(function(x){return parseInt(x,10);});
        var pi=new Date(r.data_inicio_periodo), pf=new Date(r.data_fim_periodo);
        for (var k=0;k<7;k++){
          var d=new Date(seg); d.setDate(seg.getDate()+k); d.setHours(0,0,0,0);
          if (ds.indexOf(d.getDay())>=0 && d>=new Date(pi.getFullYear(),pi.getMonth(),pi.getDate()) && d<=new Date(pf.getFullYear(),pf.getMonth(),pf.getDate())) total++;
        }
      } else {
        var di=new Date(r.data_inicio); di.setHours(0,0,0,0);
        var domFim=new Date(seg); domFim.setDate(seg.getDate()+6); domFim.setHours(23,59,59,0);
        if (di>=seg && di<=domFim) total++;
      }
    });
    return total;
  }

  function _contarReservasHoje() {
    if (!APP.reservas) return 0;
    var hoje = new Date().toDateString();
    return (APP.reservas || []).filter(function(r) {
      if (r.estado === 'cancelada') return false;
      if (r.recorrente) {
        var dias = (r.dias_semana || '').split(',').map(function(d) { return parseInt(d,10); });
        var diaSem = new Date().getDay();
        var pi = new Date(r.data_inicio_periodo), pf = new Date(r.data_fim_periodo);
        var agora = new Date(); agora.setHours(0,0,0,0);
        return dias.indexOf(diaSem) >= 0 && agora >= pi && agora <= pf;
      }
      return new Date(r.data_inicio).toDateString() === hoje;
    }).length;
  }

  function _contarReservasSemanaEq(eqId) {
    if (!APP.reservas || !eqId) return 0;
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var diaSem = hoje.getDay();
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (diaSem===0?6:diaSem-1));
    var dom = new Date(seg);  dom.setDate(seg.getDate()+6); dom.setHours(23,59,59,0);
    var total = 0;
    (APP.reservas || []).forEach(function(r) {
      if (r.equipamento_id !== eqId || r.estado === 'cancelada') return;
      if (r.recorrente) {
        var dias = (r.dias_semana||'').split(',').filter(function(x){return x;});
        var pi = new Date(r.data_inicio_periodo), pf = new Date(r.data_fim_periodo);
        // conta uma ocorrência por dia da semana que cai no período E nesta semana
        dias.forEach(function(dstr) {
          var dnum = parseInt(dstr,10);
          for (var k=0;k<7;k++) {
            var d = new Date(seg); d.setDate(seg.getDate()+k);
            if (d.getDay()===dnum && d>=pi && d<=pf) total++;
          }
        });
      } else {
        var di = new Date(r.data_inicio);
        if (di>=seg && di<=dom) total++;
      }
    });
    return total;
  }

  function _contarReservasHojeEq(eqId) {
    if (!APP.reservas || !eqId) return 0;
    var hoje = new Date().toDateString();
    return (APP.reservas || []).filter(function(r) {
      if (r.equipamento_id !== eqId || r.estado === 'cancelada') return false;
      if (r.recorrente) {
        var dias = (r.dias_semana || '').split(',').map(function(d) { return parseInt(d,10); });
        var diaSem = new Date().getDay();
        var pi = new Date(r.data_inicio_periodo), pf = new Date(r.data_fim_periodo);
        var agora = new Date(); agora.setHours(0,0,0,0);
        return dias.indexOf(diaSem) >= 0 && agora >= pi && agora <= pf;
      }
      return new Date(r.data_inicio).toDateString() === hoje;
    }).length;
  }

  function _renderProximasReservasSemana(eqId) {
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var diaSem = hoje.getDay();
    var seg = new Date(hoje); seg.setDate(hoje.getDate() - (diaSem===0?6:diaSem-1));
    var dias = [];
    for (var k=0;k<7;k++){ var d=new Date(seg); d.setDate(seg.getDate()+k); dias.push(d); }
    var nomesDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var ESTADOS_CORES = { pre_reserva:'#F59E0B', confirmada:'#3B82F6', cancelada:'#EF4444' };

    // recolher eventos da semana
    var eventos = [];
    (APP.reservas||[]).forEach(function(r){
      if (r.equipamento_id!==eqId || r.estado==='cancelada') return;
      if (r.recorrente) {
        var ds=(r.dias_semana||'').split(',').map(function(x){return parseInt(x,10);});
        var pi=new Date(r.data_inicio_periodo), pf=new Date(r.data_fim_periodo);
        dias.forEach(function(d){
          var dN=new Date(d); dN.setHours(0,0,0,0);
          if (ds.indexOf(d.getDay())>=0 && dN>=new Date(pi.getFullYear(),pi.getMonth(),pi.getDate()) && dN<=new Date(pf.getFullYear(),pf.getMonth(),pf.getDate())) {
            eventos.push({ dia:d, hora:(r.hora_inicio||'09:00').slice(0,5), horaFim:(r.hora_fim||'').slice(0,5), r:r });
          }
        });
      } else {
        var di=new Date(r.data_inicio);
        dias.forEach(function(d){
          if (di.toDateString()===d.toDateString())
            eventos.push({ dia:d, hora:di.getHours().toString().padStart(2,'0')+':00', horaFim:'', r:r });
        });
      }
    });

    eventos.sort(function(a,b){ return a.dia-b.dia || a.hora.localeCompare(b.hora); });

    var html = '<div class="sec-head" style="margin-bottom:8px;"><div class="sec-title" style="font-size:13px;">Reservas desta semana</div>';
    html += '<div class="panel-link" onclick="Dashboard.switchTab(1)">Ver calendário</div></div>';

    if (!eventos.length) {
      html += '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12.5px;border:1px dashed var(--border);border-radius:var(--r);">Sem reservas agendadas esta semana.</div>';
      return html;
    }

    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    eventos.slice(0,6).forEach(function(ev){
      var cor = ESTADOS_CORES[ev.r.estado]||'#3B82F6';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);cursor:pointer;" onclick="Dashboard.switchTab(1)">';
      html += '<div style="width:8px;height:8px;border-radius:50%;background:'+cor+';flex-shrink:0;"></div>';
      html += '<div style="font-size:11px;font-weight:700;color:var(--text-2);min-width:78px;font-family:JetBrains Mono,monospace;">'+nomesDia[ev.dia.getDay()]+' '+ev.hora+(ev.horaFim?'–'+ev.horaFim:'')+'</div>';
      html += '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(ev.r.estado==='pre_reserva'?'⏳ ':'')+(ev.r.recorrente?'🔁 ':'')+H(ev.r.titulo)+'</div>';
      if (ev.r.entidade) html += '<div style="font-size:11px;color:var(--text-3);">'+H(ev.r.entidade)+'</div>';
      html += '</div>';
      if (ev.r.estado==='pre_reserva') html += '<span style="font-size:9.5px;font-weight:700;color:#B45309;">PRÉ</span>';
      html += '</div>';
    });
    if (eventos.length>6) html += '<div style="font-size:11.5px;color:var(--text-3);text-align:center;padding:4px;">+ '+(eventos.length-6)+' mais</div>';
    html += '</div>';
    return html;
  }

  function _renderReservasTab(eqId) {
    // Mini-calendário semanal visual (estilo escala)
    var hoje = new Date();
    var diaSem = hoje.getDay();
    var seg = new Date(hoje);
    seg.setDate(hoje.getDate() - (diaSem === 0 ? 6 : diaSem - 1));
    var dias = [];
    for (var k = 0; k < 7; k++) {
      var d = new Date(seg); d.setDate(seg.getDate() + k); dias.push(d);
    }
    var nomesDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var hours = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

    var ESTADOS_CORES = {
      pre_reserva: { bg:'#FFFBEB', color:'#B45309', label:'Pré-reserva' },
      confirmada:  { bg:'#EFF6FF', color:'#1D4ED8', label:'Confirmada' },
      cancelada:   { bg:'#FEF2F2', color:'#B91C1C', label:'Cancelada' }
    };

    var reservas = (APP.reservas || []).filter(function(r) {
      return r.equipamento_id === eqId && r.estado !== 'cancelada';
    });


    // expandir para eventos por dia/hora
    function eventosDe(d) {
      var evs = [];
      reservas.forEach(function(r) {
        if (r.recorrente) {
          var ds = (r.dias_semana||'').split(',').map(function(x){return parseInt(x,10);});
          var pi = new Date(r.data_inicio_periodo), pf = new Date(r.data_fim_periodo);
          var dN = new Date(d); dN.setHours(0,0,0,0);
          if (ds.indexOf(d.getDay())>=0 && dN>=new Date(pi.setHours(0,0,0,0)) && dN<=new Date(pf.setHours(23,59,59,0))) {
            evs.push({ r:r, start: parseInt((r.hora_inicio||'09:00').split(':')[0],10), end: parseInt((r.hora_fim||'10:00').split(':')[0],10) });
          }
        } else {
          var ri = new Date(r.data_inicio), rf = new Date(r.data_fim);
          if (ri.toDateString() === d.toDateString()) {
            evs.push({ r:r, start: ri.getHours(), end: rf.getHours() || ri.getHours()+1 });
          }
        }
      });
      return evs;
    }

    var labelSemana = fData(dias[0].toISOString()) + ' — ' + fData(dias[6].toISOString());

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="escala-week">📅 ' + labelSemana + '</div>';
    html += '</div>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'reservas\')">+ Gerir reservas</button>';
    html += '</div>';

    html += '<div class="sched-wrap"><div class="sched-grid">';
    html += '<div class="sched-head"></div>';
    dias.forEach(function(d) {
      var isHoje = d.toDateString() === hoje.toDateString();
      html += '<div class="sched-head' + (isHoje ? ' today' : '') + '">' + nomesDia[d.getDay()] + ' ' + d.getDate() + '</div>';
    });

    hours.forEach(function(h, hi) {
      var hourNum = 8 + hi;
      html += '<div class="sched-time">' + h + '</div>';
      dias.forEach(function(d) {
        html += '<div class="sched-cell">';
        eventosDe(d).forEach(function(ev) {
          if (ev.start !== hourNum) return;
          var est = ESTADOS_CORES[ev.r.estado] || ESTADOS_CORES.confirmada;
          var dur = Math.max(1, ev.end - ev.start);
          var height = dur * 26 - 3;
          html += '<div class="sched-event" style="background:' + est.bg + ';color:' + est.color + ';height:' + height + 'px;cursor:pointer;" onclick="App.nav(\'reservas\')">';
          html += (ev.r.estado === 'pre_reserva' ? '⏳ ' : '') + (ev.r.recorrente ? '🔁 ' : '') + H(ev.r.titulo);
          if (ev.r.entidade) html += '<br><span style="font-weight:400;opacity:.75;font-size:9.5px;">' + H(ev.r.entidade) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      });
    });
    html += '</div></div>';

    // Legenda
    html += '<div class="sched-legend">';
    for (var ek in ESTADOS_CORES) {
      html += '<div class="legend-item"><div class="legend-dot" style="background:' + ESTADOS_CORES[ek].color + ';"></div>' + ESTADOS_CORES[ek].label + '</div>';
    }
    html += '</div>';

    html += '<div class="sched-footer">';
    html += '<a class="link-text" onclick="App.nav(\'reservas\')">Ver calendário completo →</a>';
    html += '<button class="btn btn-primary btn-sm" onclick="App.nav(\'reservas\')">+ Nova reserva</button>';
    html += '</div>';

    return html;
  }

  function _renderReservas() {
    var eqSel = APP.spotEqId;

    // se o equipamento não usa reservas, não mostrar o painel
    var eqR = eqSel ? getEq(eqSel) : null;
    if (eqR && typeof modAtivo === 'function' && !modAtivo(eqR, 'reservas')) return '';
    // próximas reservas DO EQUIPAMENTO SELECCIONADO
    var reservas = (APP.reservas || []).filter(function(r) {
      return eqSel ? r.equipamento_id === eqSel : APP.podeVerEquipamento(r.equipamento_id);
    });
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 2);
    var ESTADOS_CORES = { pre_reserva: '#F59E0B', confirmada: '#3B82F6', cancelada: '#EF4444' };

    var proximas = reservas.filter(function(r) {
      if (r.estado === 'cancelada') return false;
      if (r.recorrente) {
        var dias = (r.dias_semana || '').split(',').map(function(d) { return parseInt(d,10); });
        return dias.indexOf(hoje.getDay()) >= 0 || dias.indexOf(amanha.getDay()) >= 0;
      }
      var d = new Date(r.data_inicio); d.setHours(0,0,0,0);
      return d >= hoje && d < amanha;
    }).slice(0, 5);

    var nEqR = eqSel ? (getEq(eqSel) || {}).nome : null;
    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div>';
    html += '<div class="panel-title">Próximas Reservas</div>';
    if (nEqR) html += '<div class="panel-sub">' + H(nEqR) + '</div>';
    html += '</div>';
    html += '<div class="panel-link" onclick="App.nav(\'reservas\')">Ver calendário</div></div>';

    if (!proximas.length) {
      var nEq = eqSel ? (getEq(eqSel) || {}).nome : null;
      html += '<div style="padding:14px 13px;font-size:12.5px;color:var(--text-3);text-align:center;">Sem reservas' + (nEq ? ' em ' + H(nEq) : '') + ' para hoje.</div>';
    } else {
      proximas.forEach(function(r) {
        var cor = ESTADOS_CORES[r.estado] || '#3B82F6';
        var eq  = r.equipamento_id ? getEq(r.equipamento_id) : null;
        var hora = '';
        if (r.recorrente && r.hora_inicio) hora = (r.hora_inicio||'').slice(0,5) + '–' + (r.hora_fim||'').slice(0,5);
        else if (r.data_inicio) { var d=new Date(r.data_inicio); hora=d.getHours().toString().padStart(2,'0')+':00'; }
        html += '<div class="reserva-item" onclick="App.nav(\'reservas\')">';
        html += '<div class="r-dot" style="background:' + cor + ';"></div>';
        html += '<div class="r-time">' + H(hora) + '</div>';
        html += '<div class="r-info"><div class="r-name">' + H(r.titulo) + '</div>';
        html += '<div class="r-loc">' + H(eq ? eq.nome : (r.entidade || '—')) + '</div></div>';
        if (r.estado === 'pre_reserva') html += '<span style="font-size:10px;color:#F59E0B;font-weight:700;">PRÉ</span>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function _renderChecklists() {
    // sem acesso ao menu de checklists → não mostrar o painel
    if (!APP.acessoMenu('checklists')) return '';
    // checklists DO EQUIPAMENTO SELECCIONADO
    var eqSel = APP.spotEqId;

    var eqC = eqSel ? getEq(eqSel) : null;
    if (eqC && typeof modAtivo === 'function' && !modAtivo(eqC, 'checklist')) return '';
    var eqIds = eqSel
      ? [eqSel]
      : (APP.equipamentos || []).filter(function(e){ return APP.podeVerEquipamento(e.id); }).map(function(e){ return e.id; });
    var templates = (APP.checklist_templates||[]).filter(function(t){ return eqIds.indexOf(t.equipamento_id)>=0 && t.ativo; });

    // determinar templates sem registo recente (pendentes)
    var pendentes = [];
    templates.forEach(function(t) {
      var regs = (APP.checklist_registos||[]).filter(function(r){ return r.template_id === t.id; });
      regs.sort(function(a,b){ return new Date(b.data_registo)-new Date(a.data_registo); });
      var ultimo = regs[0];
      var dias = ultimo ? diasDesde(ultimo.data_registo) : 999;
      // pendente se: diária e >0 dias, semanal e >7, mensal e >30, ou nunca feita
      var limite = t.periodicidade==='diaria'?1:t.periodicidade==='semanal'?7:30;
      if (dias >= limite) {
        var eq = getEq(t.equipamento_id);
        pendentes.push({ nome: t.nome, sub: eq?eq.nome:'', dias: dias, ultimo: ultimo });
      }
    });

    var nEqC2 = eqSel ? (getEq(eqSel) || {}).nome : null;
    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div>';
    html += '<div class="panel-title">Checklists Pendentes</div>';
    if (nEqC2) html += '<div class="panel-sub">' + H(nEqC2) + '</div>';
    html += '</div>';
    html += '<div class="panel-link" onclick="App.nav(\'checklists\')">Ver todas</div></div>';
    if (!pendentes.length) {
      var nEqC = eqSel ? (getEq(eqSel) || {}).nome : null;
      html += '<div style="padding:14px 13px;font-size:12.5px;color:var(--text-3);text-align:center;">Sem checklists pendentes' + (nEqC ? ' em ' + H(nEqC) : '') + '. ✓</div>';
    } else {
      pendentes.slice(0,5).forEach(function(c) {
        html += '<div class="small-item" onclick="App.nav(\'checklists\')" style="cursor:pointer;">';
        html += '<div class="si-icon si-amber"><svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>';
        html += '<div class="si-body"><div class="si-title">' + H(c.nome) + '</div><div class="si-sub">' + H(c.sub) + '</div></div>';
        html += '<div class="si-right"><span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span></div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function _renderReparacoes() {
    // memorandos abertos DO EQUIPAMENTO SELECCIONADO
    var eqSel = APP.spotEqId;
    var memos = APP.memos.filter(function(m) {
      if (m.estado === 'concluido') return false;
      if (eqSel) return m.equipamento_id === eqSel;
      return APP.podeVerEquipamento(m.equipamento_id);
    });
    memos.sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); });

    var nomeEq = eqSel ? (getEq(eqSel) || {}).nome : null;

    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div>';
    html += '<div class="panel-title">Reparações em Curso</div>';
    if (nomeEq) html += '<div class="panel-sub">' + H(nomeEq) + '</div>';
    html += '</div>';
    html += '<div class="panel-link" onclick="App.nav(\'memorandos\',\'sec2\')">Ver todas</div></div>';
    if (!memos.length) {
      html += '<div style="padding:14px 13px;font-size:12.5px;color:var(--text-3);text-align:center;">Sem reparações' + (nomeEq ? ' em ' + H(nomeEq) : ' em curso') + '.</div>';
    } else {
      memos.slice(0,5).forEach(function(m) {
        var eq = m.equipamento_id ? getEq(m.equipamento_id) : null;
        var est, estLabel;
        if (m.data_envio_servicos) { est='andamento'; estLabel='Em curso'; }
        else if (m.aprovado_dds) { est='enviado'; estLabel='A enviar'; }
        else { est='pendente'; estLabel='Pendente'; }
        if (m.num_reforcos>0) { est='reforco'; estLabel='Reforço'; }
        html += '<div class="small-item" onclick="App.nav(\'memorandos\',\'sec2\')" style="cursor:pointer;">';
        html += '<div class="si-icon si-amber"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>';
        html += '<div class="si-body"><div class="si-title">' + H(m.descricao||m.numero||'—') + '</div><div class="si-sub">' + H(eq?eq.nome:(m.brigada||'')) + '</div></div>';
        html += '<div class="si-right"><span class="bdg bdg-' + est + '"><span class="bdg-dot"></span>' + estLabel + '</span></div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  // ── STAT CARD ─────────────────────────────────────────────
  function _statCard(ic, svgInner, label, val, sub, onclick) {
    var onclickAttr = onclick ? ' onclick="' + onclick + '"' : '';
    return '<div class="stat-card"' + onclickAttr + '>' +
      '<div class="stat-ic ' + ic + '"><svg viewBox="0 0 24 24">' + svgInner + '</svg></div>' +
      '<div class="stat-body"><div class="stat-lbl">' + H(label) + '</div>' +
      '<div class="stat-val">' + val + '</div>' +
      '<div class="stat-sub">' + H(sub) + '</div></div></div>';
  }

  // SVG helpers
  function _svgEq()   { return '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>'; }
  function _svgTeam() { return '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'; }
  function _svgTool() { return '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>'; }
  function _svgCal()  { return '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'; }
  function _svgCheck() { return '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'; }

  // ── ACÇÕES PÚBLICAS ───────────────────────────────────────
  function selectSpot(eqId) {
    APP.spotEqId = eqId;
    // fechar dropdown
    var dd = document.getElementById('eq-sel-dd');
    if (dd) dd.classList.remove('open');
    // actualizar sidebar
    document.querySelectorAll('.sb-eq-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.eqid === eqId);
    });
    // re-render
    App.renderContent();
  }

  function toggleSelector() {
    var dd = document.getElementById('eq-sel-dd');
    var btn = document.getElementById('eq-sel-btn');
    if (!dd || !btn) return;
    var abrir = !dd.classList.contains('open');
    if (abrir) {
      // posicionar como fixed junto ao botão (escapa ao overflow:hidden do spotlight)
      var r = btn.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top = (r.bottom + 6) + 'px';
      dd.style.left = Math.max(8, r.left) + 'px';
      dd.style.right = 'auto';
      dd.style.maxWidth = (window.innerWidth - 16) + 'px';
      dd.classList.add('open');
    } else {
      dd.classList.remove('open');
    }
  }

  function switchTab(i) {
    var tabs = document.querySelectorAll('#spot-tabs .eq-tab');
    tabs.forEach(function(t, idx) { t.classList.toggle('active', idx === i); });

    var lista = APP._spotTabs || [];
    for (var j = 0; j < lista.length; j++) {
      var p = document.getElementById('spot-t' + j);
      if (p) p.classList.toggle('active', j === i);
    }

    var chave = lista[i];
    var eqId = APP.spotEqId;

    // carregar o conteúdo dos módulos que vêm do servidor
    if (chave === 'estadias' && typeof Estadias !== 'undefined') {
      Estadias.load(eqId, function() {
        var c = document.getElementById('spot-estadias-content');
        if (c) c.innerHTML = Estadias.renderPainel(eqId);
      });
    } else if (chave === 'visitas' && typeof Visitas !== 'undefined') {
      Visitas.load(eqId, function() {
        var c = document.getElementById('spot-visitas-content');
        if (c) c.innerHTML = Visitas.renderPainel(eqId);
      });
    }
  }

  // Fechar selector ao clicar fora
  function onDocClick(e) {
    var wrap = document.getElementById('eq-sel-wrap');
    if (wrap && !wrap.contains(e.target)) {
      var dd = document.getElementById('eq-sel-dd');
      if (dd) dd.classList.remove('open');
    }
  }

  function init() {
    document.addEventListener('click', onDocClick);
  }

  // API pública
  return {
    render: render,
    init: init,
    selectSpot: selectSpot,
    tabsFor: tabsDoEquipamento,
    goTab: goTab,
    toggleSelector: toggleSelector,
    switchTab: switchTab
  };

})();

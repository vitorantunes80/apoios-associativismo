// ============================================================
// GestDDS — dashboard.js
// Módulo do dashboard principal
// ============================================================

var Dashboard = (function() {

  // Dados demo para reservas/checklists/reparações (até módulos reais existirem)
  var RESERVAS_DEMO = [
    { hora: '09:00 - 11:00', nome: 'Clube Desportivo de Basto', local: 'Campo', cor: '#3B82F6' },
    { hora: '14:00 - 16:00', nome: 'Treino Basquetebol',        local: 'Sala',  cor: '#8B5CF6' },
    { hora: '17:00 - 19:00', nome: 'Aula de Grupo',             local: 'Sala',  cor: '#7C3AED' },
    { hora: '20:00 - 22:00', nome: 'Jogo Futsal',               local: 'Campo', cor: '#F59E0B' }
  ];

  var CHECKS_DEMO = [
    { nome: 'Checklist Início de Turno', sub: 'João Silva',    hora: '07:00' },
    { nome: 'Checklist Fim de Turno',    sub: 'Ana Pereira',   hora: '14:00' },
    { nome: 'Checklist Início de Turno', sub: 'Miguel Costa',  hora: '14:00' }
  ];

  var REPS_DEMO = [
    { nome: 'Substituição de lâmpadas', local: 'Pavilhão Refojos',       est: 'pendente' },
    { nome: 'Fuga de água na piscina',  local: 'Piscina Coberta Baúlhe', est: 'reforco' },
    { nome: 'Portão avariado',          local: 'Piscina Descoberta',      est: 'andamento' }
  ];

  // Escala demo
  var SCHED_COLORS = {
    manut: { bg: '#DCFCE7', color: '#15803D', label: 'Manutenção' },
    rec:   { bg: '#DBEAFE', color: '#1D4ED8', label: 'Receção' },
    sala:  { bg: '#EDE9FE', color: '#5B21B6', label: 'Sala / Campo' },
    limp:  { bg: '#FEF3C7', color: '#92400E', label: 'Limpeza' }
  };

  var SCHED_EVENTS = [
    { name: 'João Silva',    sub: 'Manutenção',   start: 7,  end: 12, days: [0,1,2,3,4],     color: 'manut' },
    { name: 'Ana Pereira',   sub: 'Receção',      start: 14, end: 22, days: [0,1,2,3,4,5,6], color: 'rec'   },
    { name: 'Miguel Costa',  sub: 'Sala / Campo', start: 17, end: 22, days: [0,1,2,3,4,5,6], color: 'sala'  },
    { name: 'Sofia Martins', sub: 'Limpeza',      start: 20, end: 22, days: [0,1,2,3,4,5],   color: 'limp'  }
  ];

  // ── RENDER PRINCIPAL ──────────────────────────────────────
  function render() {
    var nome = APP.nomeUtilizador().split(' ')[0];
    var eqAtivos = APP.equipamentos.filter(function(e) { return e.estado === 'ativo'; }).length;
    var mAbertos = APP.memos.filter(function(m) { return m.estado !== 'concluido'; }).length;

    var html = '';

    // GREETING
    html += '<div class="dash-greeting">';
    html += '<div><div class="dash-hello">' + H(saudacao()) + ', ' + H(nome) + ' 👋</div>';
    html += '<div class="dash-sub">Bem-vindo ao sistema de gestão de equipamentos da DDS.</div></div>';
    html += '<div class="dash-date"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + H(hojeExtenso()) + '</div>';
    html += '</div>';

    // STATS
    var reservasHoje   = _contarReservasHoje();
    var reservasSemana = _contarReservasSemana();
    html += '<div class="stats-grid stats-grid-5">';
    html += _statCard('si-blue',   _svgEq(),   'Equipamentos',   APP.equipamentos.length, 'Ativos',    "App.nav('equipamentos','lista')");
    html += _statCard('si-green',  _svgTeam(), 'Funcionários',   APP.utilizadores.length, 'Registados',"App.nav('funcionarios')");
    html += _statCard('si-amber',  _svgTool(), 'Memorandos',     mAbertos,                'Pendentes', "App.nav('memorandos','sec2')");
    html += _statCard('si-purple', _svgCal(),  'Reservas Hoje',  reservasHoje,            'Agendadas hoje', "App.nav('reservas')");
    html += _statCard('si-teal',   _svgCal(),  'Reservas Semana', reservasSemana,         'Total da semana', "App.nav('reservas')");
    html += '</div>';

    // MAIN GRID
    html += '<div class="dash-grid">';

    // ESQUERDA
    html += '<div>';
    html += _renderSpotlight();
    html += _renderMemosRecentes();
    html += '</div>';

    // DIREITA
    html += '<div>';
    html += _renderReservas();
    html += _renderChecklists();
    html += _renderReparacoes();
    html += '</div>';

    html += '</div>'; // dash-grid

    return html;
  }

  // ── SPOTLIGHT ─────────────────────────────────────────────
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
    var tabs = ['Visão Geral', 'Reservas', 'Escala', 'Checklists', 'Reparações', 'Informações'];
    html += '<div class="eq-tabs" id="spot-tabs">';
    tabs.forEach(function(t, i) {
      html += '<div class="eq-tab' + (i === 0 ? ' active' : '') + '" onclick="Dashboard.switchTab(' + i + ')">' + t + '</div>';
    });
    html += '</div>';

    // TAB PANELS
    html += '<div id="spot-panels">';

    // Tab 0 - Visão Geral
    html += '<div class="eq-tab-panel active" id="spot-t0">';
    if (spotEq) {
      html += '<div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px;">';
      var rHoje = _contarReservasHojeEq(APP.spotEqId);
      var rSemana = _contarReservasSemanaEq(APP.spotEqId);
      html += _statCard('si-blue', _svgCal(), 'Reservas', rSemana, rHoje + ' hoje · ' + rSemana + ' esta semana', '');
      var funcsEq = APP.utilizadores.filter(function(u){return u.equipamento_id===spotEq.id && !u.isDds;}).length;
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
      html += '<div class="mod-ph"><div class="mod-ph-t">Sem equipamento seleccionado</div><div class="mod-ph-s">Seleccione um equipamento no dropdown acima ou na barra lateral.</div></div>';
    }
    html += '</div>';

    // Tab 2 - Escala
    html += '<div class="eq-tab-panel" id="spot-t2">';
    html += _renderEscala();
    html += '</div>';

    // Restantes tabs — placeholder
    [1,3,4,5].forEach(function(i) {
      var labels = { 1:'Reservas', 3:'Checklists', 4:'Reparações', 5:'Informações' };
      html += '<div class="eq-tab-panel" id="spot-t' + i + '">';
      if (i === 1) {
        // Reservas — mostrar próximas do equipamento
        html += _renderReservasTab(APP.spotEqId);
      } else if (i === 3) {
        html += '<div class="mod-ph"><div class="mod-ph-t">Checklists</div><div class="mod-ph-s">Em desenvolvimento.</div><span class="wip-badge">Em desenvolvimento</span></div>';
      } else {
        html += '<div class="mod-ph"><div class="mod-ph-t">' + labels[i] + '</div><div class="mod-ph-s">Em desenvolvimento.</div><span class="wip-badge">Em desenvolvimento</span></div>';
      }
      html += '</div>';
    });

    html += '</div>'; // spot-panels
    html += '</div>'; // eq-spotlight
    return html;
  }

  function _renderEscala() {
    var hours = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
    var days   = ['Seg 19','Ter 20','Qua 21','Qui 22','Sex 23','Sáb 24','Dom 25'];

    var html = '<div class="escala-controls">';
    html += '<div class="escala-nav">';
    html += '<div class="esc-nav-btn">‹</div>';
    html += '<div class="escala-week">📅 19 - 25 Maio 2026</div>';
    html += '<div class="esc-nav-btn">›</div>';
    html += '</div>';
    html += '<div class="btn-filter">▼ Filtros</div>';
    html += '</div>';

    html += '<div class="sched-wrap"><div class="sched-grid">';
    html += '<div class="sched-head"></div>';
    days.forEach(function(d, i) {
      html += '<div class="sched-head' + (i === 2 ? ' today' : '') + '">' + d + '</div>';
    });

    hours.forEach(function(h, hi) {
      var hourNum = 7 + hi;
      html += '<div class="sched-time">' + h + '</div>';
      for (var di = 0; di < 7; di++) {
        html += '<div class="sched-cell">';
        SCHED_EVENTS.forEach(function(ev) {
          if (ev.days.indexOf(di) >= 0 && hourNum === ev.start) {
            var cc = SCHED_COLORS[ev.color];
            var height = (ev.end - ev.start) * 26 - 3;
            html += '<div class="sched-event" style="background:' + cc.bg + ';color:' + cc.color + ';height:' + height + 'px;">';
            html += ev.name + '<br><span style="font-weight:400;opacity:.75;font-size:9.5px;">' + ev.sub + '</span>';
            html += '</div>';
          }
        });
        html += '</div>';
      }
    });
    html += '</div></div>'; // sched-grid + sched-wrap

    // Legenda
    html += '<div class="sched-legend">';
    for (var ck in SCHED_COLORS) {
      html += '<div class="legend-item"><div class="legend-dot" style="background:' + SCHED_COLORS[ck].color + ';"></div>' + SCHED_COLORS[ck].label + '</div>';
    }
    html += '</div>';

    // Footer
    html += '<div class="sched-footer">';
    html += '<a class="link-text">Ver escala completa →</a>';
    html += '<button class="btn btn-primary btn-sm">↓ Exportar escala</button>';
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
      // demo
      REPS_DEMO.forEach(function(r) {
        html += '<div class="memo-item">';
        html += '<div class="mi-icon"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>';
        html += '<div class="mi-body"><div class="mi-title">' + H(r.nome) + '</div><div class="mi-sub">' + H(r.local) + '</div></div>';
        html += '<div class="mi-right"><span class="bdg bdg-' + r.est + '"><span class="bdg-dot"></span>' + (r.est === 'pendente' ? 'Pendente' : r.est === 'reforco' ? 'Reforço' : 'Em andamento') + '</span></div>';
        html += '<div class="mi-arr">›</div></div>';
      });
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
    var reservas = APP.reservas || [];
    // próximas reservas de todos os equipamentos, hoje e amanhã
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

    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div class="panel-title">Próximas Reservas</div>';
    html += '<div class="panel-link" onclick="App.nav(\'reservas\')">Ver calendário</div></div>';

    if (!proximas.length) {
      html += '<div style="padding:14px 13px;font-size:12.5px;color:var(--text-3);text-align:center;">Sem reservas para hoje.</div>';
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
    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div class="panel-title">Checklists Pendentes</div><div class="panel-link">Ver todas</div></div>';
    CHECKS_DEMO.forEach(function(c) {
      html += '<div class="small-item">';
      html += '<div class="si-icon si-amber"><svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>';
      html += '<div class="si-body"><div class="si-title">' + H(c.nome) + '</div><div class="si-sub">' + H(c.sub) + '</div></div>';
      html += '<div class="si-right"><div class="si-time">' + c.hora + '</div><span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span></div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function _renderReparacoes() {
    var html = '<div class="panel-card">';
    html += '<div class="panel-head"><div class="panel-title">Reparações em Curso</div><div class="panel-link">Ver todas</div></div>';
    REPS_DEMO.forEach(function(r) {
      html += '<div class="small-item">';
      html += '<div class="si-icon si-amber"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>';
      html += '<div class="si-body"><div class="si-title">' + H(r.nome) + '</div><div class="si-sub">' + H(r.local) + '</div></div>';
      html += '<div class="si-right"><span class="bdg bdg-' + r.est + '"><span class="bdg-dot"></span>' + (r.est === 'pendente' ? 'Pendente' : r.est === 'reforco' ? 'Reforço' : 'Em andamento') + '</span></div>';
      html += '</div>';
    });
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
    if (dd) dd.classList.toggle('open');
  }

  function switchTab(i) {
    // tabs
    var tabs = document.querySelectorAll('#spot-tabs .eq-tab');
    tabs.forEach(function(t, idx) { t.classList.toggle('active', idx === i); });
    // panels
    for (var j = 0; j <= 5; j++) {
      var p = document.getElementById('spot-t' + j);
      if (p) p.classList.toggle('active', j === i);
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
    toggleSelector: toggleSelector,
    switchTab: switchTab
  };

})();

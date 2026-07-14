// ============================================================
// GestDDS — relatorios.js  v5.2
// Relatórios e Indicadores — memorandos + ocupação de reservas
// ============================================================

var Relatorios = (function() {

  var _periodo = 'semana'; // dia | semana | mes | ano
  var _eqFiltro = null;    // null = todos
  var _eqRel = null;       // equipamento em foco na aba "Equipamentos"
  var _indRel = null;      // indicador escolhido para o gráfico de evolução

  function render() {
    // funcionário não acede
    if (APP.isFuncionario()) {
      return '<div class="dash-greeting"><div><div class="dash-hello" style="font-size:18px;">Relatórios</div></div></div>' + accessDenied();
    }

    var aba = APP.repTab || 'indicadores';

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Relatórios e Indicadores</div>';
    html += '<div class="dash-sub">Actividade, ocupação e recursos da divisão.</div></div>';
    html += '</div>';

    // ── Abas ──
    html += '<div class="rep-tabs">';
    [['indicadores', 'Indicadores'], ['equipamentos', 'Equipamentos'], ['horas', 'Banco de Horas'], ['impressao', 'Imprimir / PDF']].forEach(function(t) {
      html += '<div class="rep-tab' + (aba === t[0] ? ' active' : '') + '" onclick="Relatorios.setTab(\'' + t[0] + '\')">' + t[1] + '</div>';
    });
    html += '</div>';

    // ── Barra de período (aplica-se a todos os relatórios) ──
    var anoW = APP.anoTrabalho || new Date().getFullYear();
    html += '<div class="rep-periodo">';
    html += '<span class="rep-periodo-l">Período</span>';
    html += '<button class="rep-mes' + (!APP.repMes ? ' active' : '') + '" onclick="Relatorios.setMes(null)">Ano ' + anoW + '</button>';
    for (var mi = 1; mi <= 12; mi++) {
      var nm = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mi - 1];
      html += '<button class="rep-mes' + (APP.repMes === mi ? ' active' : '') + '" onclick="Relatorios.setMes(' + mi + ')">' + nm + '</button>';
    }
    html += '</div>';

    if (aba === 'indicadores') {
      html += _renderResumoTopo();
      html += _renderFiltros();
      html += _renderOcupacao();
      html += _renderStatsGlobais();
      html += _renderMemoStats();
      html += _renderPorEquipamento();
    } else if (aba === 'equipamentos') {
      html += _renderEquipamentos();
    } else if (aba === 'horas') {
      html += _renderHorasIndicadores();
    } else {
      html += _renderListaFuncionarios();
    }

    return html;
  }

  function setTab(t) {
    APP.repTab = t;
    App.renderContent();
  }

  // ── RESUMO NO TOPO (cartões) ──────────────────────────────
  function _renderResumoTopo() {
    var U = APP.utilizadores, E = APP.equipamentos;
    // memorandos do período seleccionado
    var M = APP.memos.filter(function(m) { return _noPeriodo(m.created_at); });

    var nExt = U.filter(function(u){ return u.unidade === 'EXTERNA'; }).length;
    var nDds = U.length - nExt;
    var eAtivos = E.filter(function(e){ return e.estado === 'ativo'; }).length;
    var mAbertos = M.filter(function(m){ return m.estado !== 'concluido'; }).length;
    var taxa = M.length ? Math.round(M.filter(function(m){ return m.estado === 'concluido'; }).length / M.length * 100) : 0;

    var per = _perLabel();

    var h = '<div class="rep-cards">';
    h += _repCard(nDds, 'Funcionários DDS', nExt ? ('+' + nExt + ' de outras divisões') : 'Registados', '#15803D', '#DCFCE7');
    h += _repCard(E.length, 'Equipamentos', eAtivos + ' activos', '#1D4ED8', '#DBEAFE');
    h += _repCard(mAbertos, 'Memorandos em aberto', 'de ' + M.length + ' em ' + per, '#D97706', '#FEF3C7');
    h += _repCard(taxa + '%', 'Taxa de conclusão', 'memorandos de ' + per, '#7C3AED', '#EDE9FE');
    h += '</div>';
    return h;
  }

  function _repCard(v, t, sub, cor, bg) {
    var h = '<div class="rep-card">';
    h += '<div class="rep-card-v" style="color:' + cor + ';">' + v + '</div>';
    h += '<div class="rep-card-t">' + t + '</div>';
    h += '<div class="rep-card-s">' + sub + '</div>';
    h += '</div>';
    return h;
  }

  // ── INDICADORES DO BANCO DE HORAS ─────────────────────────
  function _renderHorasIndicadores() {
    if (typeof Horas === 'undefined') return '<div class="card">Módulo indisponível.</div>';

    var regs = Horas.registos();
    if (!regs.length) {
      return '<div class="card">' + emptyState('Sem registos', 'Ainda não há horas registadas no banco de horas.') + '</div>';
    }

    // âmbito conforme o perfil
    var uni = null;
    if (APP.user.perfil === 'supervisor_udaj') uni = 'UDAJ';
    if (APP.user.perfil === 'supervisor_uase') uni = 'UASE';

    var funcs = APP.utilizadores.filter(function(u) {
      if (u.unidade === 'EXTERNA') return true; // externos também podem ter horas
      return !uni || u.unidade === uni;
    });

    // totais — no período seleccionado
    var tEf = 0, tGo = 0, nPend = 0;
    regs.forEach(function(r) {
      var f = APP.utilizadores.filter(function(u){ return u.id === r.funcionario_id; })[0];
      if (uni && (!f || f.unidade !== uni)) return;

      // pendentes: contam sempre (são trabalho por despachar, não têm período)
      if (r.estado === 'pendente' || r.estado === 'validado_resp') { nPend++; return; }
      if (r.estado !== 'aprovado') return;

      // aprovados: só os do período escolhido
      if (!_noPeriodo(r.data)) return;

      if (r.tipo === 'gozada') tGo += parseFloat(r.horas) || 0;
      else                     tEf += parseFloat(r.horas) || 0;
    });

    var subPer = _perLabel();

    var h = '';
    h += '<div class="rep-cards">';
    h += _repCard(Horas.fmtH(tEf), 'Horas efectuadas', subPer + (uni ? ' · ' + uni : ''), '#15803D', '#DCFCE7');
    h += _repCard(Horas.fmtH(tGo), 'Horas gozadas', subPer + (uni ? ' · ' + uni : ''), '#D97706', '#FEF3C7');
    h += _repCard(Horas.fmtH(tEf - tGo), 'Movimento do período', 'efectuadas − gozadas', (tEf - tGo) > 0 ? '#B91C1C' : '#15803D', '#FEE2E2');
    h += _repCard(nPend, 'Por validar', 'registos pendentes', '#2563EB', '#DBEAFE');
    h += '</div>';

    // saldos por funcionário — movimento no período + saldo acumulado
    var linhas = funcs.map(function(f) {
      var s = Horas.saldoDe(f.id);   // acumulado (sempre total)

      // movimento só do período seleccionado
      var pEf = 0, pGo = 0;
      regs.forEach(function(r) {
        if (r.funcionario_id !== f.id) return;
        if (r.estado !== 'aprovado') return;
        if (!_noPeriodo(r.data)) return;
        if (r.tipo === 'gozada') pGo += parseFloat(r.horas) || 0;
        else                     pEf += parseFloat(r.horas) || 0;
      });

      return { f: f, s: s, pEf: pEf, pGo: pGo };
    }).filter(function(x) {
      // mostra quem tem movimento no período OU saldo pendente
      return x.pEf > 0 || x.pGo > 0 || x.s.saldo !== 0;
    }).sort(function(a, b) { return b.s.saldo - a.s.saldo; });

    h += '<div class="card" style="margin-top:14px;">';
    h += '<div class="sec-head"><div><div class="sec-title" style="font-size:14px;">Saldos por funcionário</div>';
    h += '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px;">Movimento em ' + H(subPer) + ' · saldo sempre acumulado</div></div>';
    h += '<button class="btn btn-secondary btn-sm" onclick="Relatorios.imprimir(\'horas\',\'' + (uni || '') + '\')">🖨️ Imprimir</button></div>';

    if (!linhas.length) {
      h += emptyState('Sem saldos', 'Nenhum funcionário tem horas neste período.');
    } else {
      h += '<div class="dtw"><table class="dt">';
      h += '<thead><tr><th>Funcionário</th><th>Unidade</th><th>Efectuadas</th><th>Gozadas</th><th>Saldo acumulado</th><th></th></tr></thead><tbody>';
      linhas.forEach(function(x) {
        var cor = x.s.saldo > 0 ? 'var(--green)' : (x.s.saldo < 0 ? 'var(--red)' : 'var(--text-2)');
        h += '<tr>';
        h += '<td><span class="td-p">' + H(x.f.nome) + '</span></td>';
        h += '<td class="td-m">' + H(x.f.unidade === 'EXTERNA' ? (x.f.divisao_origem || 'Externo') : (x.f.unidade || '—')) + '</td>';
        h += '<td class="td-m">' + (x.pEf ? Horas.fmtH(x.pEf) : '—') + '</td>';
        h += '<td class="td-m">' + (x.pGo ? Horas.fmtH(x.pGo) : '—') + '</td>';
        h += '<td><strong style="color:' + cor + ';">' + Horas.fmtH(x.s.saldo) + '</strong></td>';
        h += '<td style="text-align:right;"><button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'horas_ind\',\'' + x.f.id + '\')">Extrato</button></td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';
    return h;
  }

  function _renderFiltros() {
    var periodos = [
      { v:'dia',    l:'Hoje' },
      { v:'semana', l:'Esta semana' },
      { v:'mes',    l:'Este mês' },
      { v:'ano',    l:'Este ano' }
    ];
    var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">';
    html += '<span style="font-size:12px;font-weight:600;color:var(--text-3);">Período:</span>';
    periodos.forEach(function(p) {
      var active = _periodo === p.v;
      html += '<button class="btn btn-sm ' + (active ? 'btn-primary' : 'btn-ghost') + '" onclick="Relatorios.setPeriodo(\'' + p.v + '\')">' + p.l + '</button>';
    });

    // filtro de equipamento (só DDS vê todos)
    if (APP.isDds()) {
      html += '<span style="font-size:12px;font-weight:600;color:var(--text-3);margin-left:8px;">Equipamento:</span>';
      html += '<select class="fin" style="width:auto;max-width:200px;padding:5px 10px;font-size:12.5px;" onchange="Relatorios.setEqFiltro(this.value)">';
      html += '<option value="">Todos</option>';
      APP.equipamentos.forEach(function(e) {
        html += '<option value="' + e.id + '"' + (_eqFiltro === e.id ? ' selected' : '') + '>' + H(e.nome) + '</option>';
      });
      html += '</select>';
    }
    html += '</div>';
    return html;
  }

  // ── OCUPAÇÃO (números de pessoas) ─────────────────────────
  function _periodoRange() {
    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var inicio, fim;
    if (_periodo === 'dia') {
      inicio = new Date(hoje);
      fim = new Date(hoje); fim.setHours(23,59,59,0);
    } else if (_periodo === 'semana') {
      var ds = hoje.getDay();
      inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (ds===0?6:ds-1));
      fim = new Date(inicio); fim.setDate(inicio.getDate()+6); fim.setHours(23,59,59,0);
    } else if (_periodo === 'mes') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23,59,59);
    } else { // ano
      inicio = new Date(hoje.getFullYear(), 0, 1);
      fim = new Date(hoje.getFullYear(), 11, 31, 23,59,59);
    }
    return { inicio: inicio, fim: fim };
  }

  // expande reservas (incl. recorrentes) e conta ocorrências + pessoas no período
  function _ocupacaoData() {
    var range = _periodoRange();
    var reservas = (APP.reservas || []).filter(function(r) {
      if (r.estado === 'cancelada') return false;
      if (_eqFiltro && r.equipamento_id !== _eqFiltro) return false;
      // se não-DDS, só o seu equipamento
      if (!APP.isDds() && APP.user && r.equipamento_id !== APP.user.equipamento_id) return false;
      return true;
    });

    var porEspaco = {};  // espaco/eq -> { ocorrencias, pessoas, pessoas2 }
    var totalOcorrencias = 0, totalPessoas = 0;

    function addOcorrencia(r, chave, nome) {
      if (!porEspaco[chave]) porEspaco[chave] = { nome: nome, ocorrencias: 0, pessoas: 0, pessoas2: 0 };
      porEspaco[chave].ocorrencias++;
      porEspaco[chave].pessoas  += (r.num_pessoas  || 0);
      porEspaco[chave].pessoas2 += (r.num_pessoas2 || 0);
      totalOcorrencias++;
      totalPessoas += (r.num_pessoas || 0);
    }

    reservas.forEach(function(r) {
      var eq = getEq(r.equipamento_id);
      var espNome = r.espaco || (eq ? eq.nome : 'Sem espaço');
      var chave = (r.equipamento_id||'') + '|' + espNome;

      if (r.recorrente) {
        var dias = (r.dias_semana||'').split(',').map(function(x){return parseInt(x,10);});
        var pi = new Date(r.data_inicio_periodo), pf = new Date(r.data_fim_periodo);
        // iterar dias no range de análise
        var d = new Date(range.inicio);
        while (d <= range.fim) {
          var dN = new Date(d); dN.setHours(0,0,0,0);
          if (dias.indexOf(d.getDay()) >= 0 &&
              dN >= new Date(pi.getFullYear(),pi.getMonth(),pi.getDate()) &&
              dN <= new Date(pf.getFullYear(),pf.getMonth(),pf.getDate())) {
            addOcorrencia(r, chave, espNome);
          }
          d.setDate(d.getDate()+1);
        }
      } else {
        var di = new Date(r.data_inicio);
        if (di >= range.inicio && di <= range.fim) {
          addOcorrencia(r, chave, espNome);
        }
      }
    });

    return { porEspaco: porEspaco, totalOcorrencias: totalOcorrencias, totalPessoas: totalPessoas, range: range };
  }

  function _renderOcupacao() {
    var data = _ocupacaoData();
    var chaves = Object.keys(data.porEspaco);

    var periodoLabel = { dia:'hoje', semana:'esta semana', mes:'este mês', ano:'este ano' }[_periodo];

    var html = '<div class="sec-head"><div class="sec-title">Ocupação — ' + periodoLabel + '</div></div>';

    // cards resumo
    html += '<div class="stats-grid" data-x="grid3" style="margin-bottom:16px;">';
    html += _sCard('si-blue',  data.totalOcorrencias, 'Reservas',   'No período');
    html += _sCard('si-green', data.totalPessoas,     'Pessoas',    'Total registado');
    var media = data.totalOcorrencias ? Math.round(data.totalPessoas / data.totalOcorrencias) : 0;
    html += _sCard('si-purple', media,                'Média',      'Pessoas/reserva');
    html += '</div>';

    if (!chaves.length) {
      html += '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px;border:1px dashed var(--border);border-radius:var(--r);margin-bottom:20px;">Sem reservas registadas no período.</div>';
      return html;
    }

    // tabela por espaço
    html += '<div class="dtw" style="margin-bottom:20px;"><table class="dt">';
    html += '<thead><tr><th>Equipamento / Espaço</th><th>Reservas</th><th>Total pessoas</th><th>Média</th></tr></thead><tbody>';

    // ordenar por pessoas desc
    chaves.sort(function(a,b){ return data.porEspaco[b].pessoas - data.porEspaco[a].pessoas; });
    chaves.forEach(function(k) {
      var d = data.porEspaco[k];
      var eqId = k.split('|')[0];
      var eq = getEq(eqId);
      var med = d.ocorrencias ? Math.round(d.pessoas / d.ocorrencias) : 0;
      html += '<tr>';
      html += '<td class="td-p">' + H(d.nome);
      if (eq) html += '<div style="font-size:11px;color:var(--text-3);">' + H(eq.nome) + '</div>';
      html += '</td>';
      html += '<td class="td-mono">' + d.ocorrencias + '</td>';
      html += '<td><span style="font-weight:700;color:var(--accent);">' + d.pessoas + '</span>' + (d.pessoas2 ? ' <span style="font-size:11px;color:var(--text-3);">(+' + d.pessoas2 + ')</span>' : '') + '</td>';
      html += '<td class="td-m">' + med + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    return html;
  }

  // ── STATS MEMORANDOS ──────────────────────────────────────
  function _renderStatsGlobais() {
    var memos = (APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); }))
                .filter(function(m) { return _noPeriodo(m.created_at); });
    var total   = memos.length;
    var concl   = memos.filter(function(m) { return m.estado === 'concluido'; }).length;
    var abertos = total - concl;
    var reforcos = memos.filter(function(m) { return m.num_reforcos > 0; }).length;
    var txConcl  = total ? Math.round(concl / total * 100) : 0;

    var html = '<div class="sec-head"><div class="sec-title">Memorandos</div></div>';
    html += '<div class="stats-grid stats-grid-4" style="margin-bottom:16px;">';
    html += _sCard('si-amber',  abertos,  'Abertos',    'Em curso');
    html += _sCard('si-green',  concl,    'Concluídos', 'Taxa: ' + txConcl + '%');
    html += _sCard('si-red',    reforcos, 'Reforços',   'Insistências');
    html += _sCard('si-blue',   total,    'Total',      'Histórico');
    html += '</div>';
    return html;
  }

  function _renderMemoStats() {
    // evolução mensal: mostra sempre o ano inteiro (é esse o propósito do gráfico),
    // mas destaca o mês seleccionado
    var anoW = String(APP.anoTrabalho || new Date().getFullYear());
    var memos = (APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); }))
                .filter(function(m) { return String(m.created_at || '').slice(0,4) === anoW; });
    var porMes = {};
    memos.forEach(function(m) {
      var d   = new Date(m.created_at);
      var key = d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0');
      if (!porMes[key]) porMes[key] = { total:0, concl:0, reforco:0 };
      porMes[key].total++;
      if (m.estado === 'concluido') porMes[key].concl++;
      if (m.num_reforcos > 0) porMes[key].reforco++;
    });
    var keys = Object.keys(porMes).sort().reverse().slice(0, 6);
    if (!keys.length) return '';

    var html = '<div class="sec-head"><div class="sec-title">Memorandos por mês</div>';
    html += '<button class="btn btn-secondary btn-sm" onclick="Relatorios.exportarMemos()">↓ Exportar CSV</button></div>';
    html += '<div class="dtw" style="margin-bottom:20px;"><table class="dt">';
    html += '<thead><tr><th>Mês</th><th>Total</th><th>Concluídos</th><th>Reforço</th><th>Taxa</th></tr></thead><tbody>';
    keys.forEach(function(k) {
      var m = porMes[k];
      var pct = m.total ? Math.round(m.concl / m.total * 100) : 0;
      var data = new Date(k + '-01');
      var lbl = data.toLocaleDateString('pt-PT', { month:'long', year:'numeric' });
      var cor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
      html += '<tr><td class="td-p">' + H(lbl) + '</td>';
      html += '<td class="td-mono">' + m.total + '</td>';
      html += '<td><span style="color:var(--green);font-weight:600;">' + m.concl + '</span></td>';
      html += '<td>' + (m.reforco ? '<span style="color:var(--red);font-weight:600;">' + m.reforco + '</span>' : '0') + '</td>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;background:var(--border);border-radius:3px;min-width:40px;"><div style="width:' + pct + '%;height:100%;background:' + cor + ';border-radius:3px;"></div></div><span style="font-weight:700;color:' + cor + ';font-size:12px;">' + pct + '%</span></div></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function _renderPorEquipamento() {
    if (!APP.isDds()) return ''; // só DDS vê comparação entre equipamentos
    if (!APP.equipamentos.length) return '';

    var html = '<div class="sec-head"><div class="sec-title">Actividade por equipamento</div></div>';
    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Equipamento</th><th>Tipo</th><th>Memos abertos</th><th>Concluídos</th><th>Reservas</th><th>Estado</th></tr></thead><tbody>';
    APP.equipamentos.forEach(function(eq) {
      var tipo  = getTipo(eq.tipo_id);
      var memos = APP.memos.filter(function(m) {
        return m.equipamento_id === eq.id && _noPeriodo(m.created_at);
      });
      var ab    = memos.filter(function(m) { return m.estado !== 'concluido'; }).length;
      var co    = memos.filter(function(m) { return m.estado === 'concluido'; }).length;
      var res   = (APP.reservas||[]).filter(function(r) {
        return r.equipamento_id === eq.id && r.estado !== 'cancelada' && _noPeriodo(r.data_inicio);
      }).length;
      html += '<tr><td class="td-p">' + H(eq.nome) + '</td>';
      html += '<td><span style="background:var(--teal-bg);color:var(--teal);font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;">' + H(tipo ? tipo.nome : '—') + '</span></td>';
      html += '<td>' + (ab ? '<span style="color:var(--amber);font-weight:600;">' + ab + '</span>' : '0') + '</td>';
      html += '<td>' + (co ? '<span style="color:var(--green);font-weight:600;">' + co + '</span>' : '0') + '</td>';
      html += '<td class="td-mono">' + res + '</td>';
      html += '<td>' + badgeEqEstado(eq.estado) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function _sCard(ic, val, label, sub) {
    return '<div class="stat-card"><div class="stat-ic ' + ic + '"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>' +
      '<div class="stat-body"><div class="stat-lbl">' + H(label) + '</div><div class="stat-val">' + val + '</div><div class="stat-sub">' + H(sub) + '</div></div></div>';
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function setPeriodo(p) { _periodo = p; _rerender(); }
  function setEqFiltro(v) { _eqFiltro = v || null; _rerender(); }

  function _rerender() {
    var c = document.getElementById('main-content');
    if (c) c.innerHTML = render();
  }

  function exportarMemos() {
    var memos = (APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); }))
                .filter(function(m) { return _noPeriodo(m.created_at); });
    var linhas = ['Número,Descrição,Brigada,Equipamento,Data,Estado,Reforços'];
    memos.forEach(function(m) {
      var eq = m.equipamento_id ? getEq(m.equipamento_id) : null;
      linhas.push([
        m.numero || '',
        '"' + (m.descricao || '').replace(/"/g,'""') + '"',
        m.brigada || '',
        eq ? '"' + eq.nome + '"' : '',
        fData(m.created_at),
        m.estado || '',
        m.num_reforcos || 0
      ].join(','));
    });
    _downloadCSV(linhas.join('\n'), 'memorandos_' + new Date().toISOString().split('T')[0] + '.csv');
    toast('Exportado.', 'success');
  }

  function exportarOcupacao() {
    var data = _ocupacaoData();
    var linhas = ['Equipamento,Espaço,Reservas,Total Pessoas'];
    Object.keys(data.porEspaco).forEach(function(k) {
      var d = data.porEspaco[k];
      var eq = getEq(k.split('|')[0]);
      linhas.push([eq?'"'+eq.nome+'"':'', '"'+d.nome+'"', d.ocorrencias, d.pessoas].join(','));
    });
    _downloadCSV(linhas.join('\n'), 'ocupacao_' + _periodo + '.csv');
    toast('Exportado.', 'success');
  }

  function _downloadCSV(content, filename) {
    var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── RELATÓRIOS PARA IMPRESSÃO ─────────────────────────────
  function _renderListaFuncionarios() {
    var nFunc = APP.utilizadores.length;
    var nEq   = APP.equipamentos.length;
    var nMemo = APP.memos.length;

    var h = '<div class="card" style="margin-top:16px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Relatórios para apresentação</div></div>';
    h += '<p style="font-size:12.5px;color:var(--text-3);margin:2px 0 14px;line-height:1.5;">Documentos prontos a imprimir ou guardar em PDF, para apresentar à direção. Abre a folha de impressão do Safari — escolhe imprimir ou "Guardar em Ficheiros".</p>';

    // Resumo executivo
    h += '<div class="rep-grp"><div class="rep-grp-t">Resumo Executivo</div>';
    h += '<button class="btn btn-primary btn-sm" onclick="Relatorios.imprimir(\'resumo\',\'\')">📊 Resumo Executivo da DDS</button>';
    h += '</div>';

    // Funcionários
    var nExt = APP.utilizadores.filter(function(u){ return u.unidade === 'EXTERNA'; }).length;
    var nDds = nFunc - nExt;
    h += '<div class="rep-grp"><div class="rep-grp-t">Funcionários (' + nDds + ' DDS' + (nExt ? ' · ' + nExt + ' externos' : '') + ')</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'\')">Toda a DDS</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'UDAJ\')">UDAJ</button>';
    if (nExt) h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'EXTERNA\')">Outras divisões</button>';
    h += '</div>';

    // Equipamentos
    h += '<div class="rep-grp"><div class="rep-grp-t">Equipamentos (' + nEq + ') — quadro resumo</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'equipamentos\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'equipamentos\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'equipamentos\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    // Fichas de equipamento
    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha completa por equipamento (tudo)</div>';
    h += '<button class="btn btn-primary btn-sm" onclick="Relatorios.imprimir(\'ficha\',\'\')">📋 Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha de Operação (espaços, reservas, escala)</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha de Manutenção (memorandos, checklists)</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    // Ficha de um único equipamento
    var eqsOrd = APP.equipamentos.slice().sort(_ordEq);
    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha de um equipamento específico</div>';
    h += '<select id="rep-eq-sel" class="fin" style="max-width:340px;margin:0 8px 8px 0;">';
    h += '<option value="">Escolha o equipamento…</option>';
    eqsOrd.forEach(function(e) {
      h += '<option value="' + e.id + '">' + esc(e.nome) + (e.unidade ? ' (' + e.unidade + ')' : '') + '</option>';
    });
    h += '</select>';
    h += '<div><button class="btn btn-primary btn-sm" onclick="Relatorios.imprimirEqSel()">📋 Imprimir ficha do equipamento</button></div>';
    h += '</div>';

    // Memorandos
    h += '<div class="rep-grp"><div class="rep-grp-t">Memorandos (' + nMemo + ')</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'memorandos\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'memorandos\',\'ativos\')">Só em aberto</button>';
    h += '</div>';

    // Banco de horas
    h += '<div class="rep-grp"><div class="rep-grp-t">Banco de Horas — indicadores gerais</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'horas\',\'\')">Toda a DDS</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'horas\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'horas\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    // Extrato individual
    h += '<div class="rep-grp"><div class="rep-grp-t">Banco de Horas — extrato individual</div>';
    h += '<select id="rep-func-sel" class="fin" style="max-width:340px;margin:0 8px 8px 0;">';
    h += '<option value="">Escolha o funcionário…</option>';
    APP.utilizadores.slice().sort(function(a, b) { return (a.nome || '').localeCompare(b.nome || ''); })
      .forEach(function(u) {
        h += '<option value="' + u.id + '">' + esc(u.nome) + (u.unidade && u.unidade !== 'EXTERNA' ? ' (' + u.unidade + ')' : '') + '</option>';
      });
    h += '</select>';
    h += '<div><button class="btn btn-primary btn-sm" onclick="Relatorios.imprimirExtrato()">🖨️ Imprimir extrato do funcionário</button></div>';
    h += '</div>';

    h += '</div>';
    return h;
  }

  // Estado legível de um memorando
  function _estadoMemo(m) {
    if (m.estado === 'concluido')      return 'Concluído';
    if (m.estado === 'reforco_pedido') return 'Reforço pedido';
    if (m.data_envio_servicos)         return 'Em curso';
    if (m.aprovado_dds)                return 'A enviar';
    return 'Pendente';
  }

  // Router de impressão
  function imprimir(tipo, ambito) {
    var body = '';
    if (tipo === 'resumo')            body = _repResumo();
    else if (tipo === 'funcionarios') body = _repFuncionarios(ambito);
    else if (tipo === 'equipamentos') body = _repEquipamentos(ambito);
    else if (tipo === 'ficha')        body = _repFicha(ambito, 'full');
    else if (tipo === 'ficha_op')     body = _repFicha(ambito, 'operacao');
    else if (tipo === 'ficha_man')    body = _repFicha(ambito, 'manutencao');
    else if (tipo === 'memorandos')   body = _repMemorandos(ambito);
    else if (tipo === 'horas')        body = _repHoras(ambito);
    else if (tipo === 'horas_ind')    body = _repHorasIndividual(ambito);
    else return;

    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = body;
    window.print();
  }
  // manter compatibilidade com o botão antigo
  function imprimirFuncionarios(ambito) { imprimir('funcionarios', ambito); }

  // Ficha de um único equipamento
  function imprimirEq(eqId, modo) {
    var e = getEq(eqId);
    if (!e) { toast('Equipamento não encontrado.', 'error'); return; }
    var ano = APP.anoTrabalho || new Date().getFullYear();
    var body = _cabecalho('Ficha de Equipamento', esc(e.nome) + ' · Ano ' + ano) + _fichaEq(e, modo || 'full') + _rodape();
    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = body;
    window.print();
  }
  function imprimirEqSel() {
    var sel = document.getElementById('rep-eq-sel');
    if (!sel || !sel.value) { toast('Escolha primeiro um equipamento.', 'error'); return; }
    imprimirEq(sel.value, 'full');
  }

  function imprimirExtrato() {
    var sel = document.getElementById('rep-func-sel');
    if (!sel || !sel.value) { toast('Escolha primeiro um funcionário.', 'error'); return; }
    imprimir('horas_ind', sel.value);
  }

  // ── PERÍODO (todo o ano ou um mês) ────────────────────────
  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function _perLabel() {
    var ano = APP.anoTrabalho || new Date().getFullYear();
    var m = APP.repMes;
    return (m ? MESES[parseInt(m, 10) - 1] + ' de ' + ano : 'Ano de ' + ano);
  }

  // um registo (com campo de data) pertence ao período seleccionado?
  function _noPeriodo(iso) {
    if (!iso) return false;
    var ano = String(APP.anoTrabalho || new Date().getFullYear());
    var s = String(iso).slice(0, 10);
    if (s.slice(0, 4) !== ano) return false;
    if (!APP.repMes) return true;
    return s.slice(5, 7) === ('0' + APP.repMes).slice(-2);
  }

  function setMes(m) {
    APP.repMes = m || null;
    App.renderContent();
  }

  function _cabecalho(titulo, sub) {
    var hoje = new Date();
    var d = ('0' + hoje.getDate()).slice(-2) + '/' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '/' + hoje.getFullYear();
    var h = '<div class="pr-head">';
    h += '<div class="pr-head-top">';
    h += '<div>';
    h += '<div class="pr-org">Município de Cabeceiras de Basto · Divisão de Desenvolvimento Social</div>';
    h += '<div class="pr-title">' + esc(titulo) + '</div>';
    h += '<div class="pr-meta">' + (sub ? esc(sub) + ' · ' : '') + 'Emitido em ' + d + '</div>';
    h += '</div>';
    h += '<div class="pr-chip">' + esc(_perLabel()) + '</div>';
    h += '</div>';
    h += '</div>';
    return h;
  }
  function _rodape() {
    return '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';
  }

  // RESUMO EXECUTIVO
  function _repResumo() {
    var U = APP.utilizadores, E = APP.equipamentos;
    var M = APP.memos.filter(function(m) { return _noPeriodo(m.created_at); });
    var fUase = U.filter(function(u){ return u.unidade === 'UASE'; }).length;
    var fUdaj = U.filter(function(u){ return u.unidade === 'UDAJ'; }).length;
    var fExt  = U.filter(function(u){ return u.unidade === 'EXTERNA'; }).length;
    var fDds  = U.length - fExt;
    var eUase = E.filter(function(e){ return e.unidade === 'UASE'; }).length;
    var eUdaj = E.filter(function(e){ return e.unidade === 'UDAJ'; }).length;
    var eAtivos = E.filter(function(e){ return e.estado === 'ativo'; }).length;
    var eManut  = E.filter(function(e){ return e.estado === 'manutencao'; }).length;
    var mConcl = M.filter(function(m){ return m.estado === 'concluido'; }).length;
    var mCurso = M.filter(function(m){ return m.estado !== 'concluido' && m.data_envio_servicos; }).length;
    var mPend  = M.length - mConcl - mCurso;
    var taxa   = M.length ? Math.round(mConcl / M.length * 100) : 0;

    var h = _cabecalho('Resumo Executivo', 'Indicadores da Divisão');

    h += '<div class="pr-kpis">';
    h += _kpi(fDds, 'Funcionários DDS');
    h += _kpi(E.length, 'Equipamentos');
    h += _kpi(M.length, 'Memorandos');
    h += _kpi(taxa + '%', 'Taxa de conclusão');
    h += '</div>';

    h += '<div class="pr-sec">Recursos por unidade</div>';
    h += '<table class="pr-table"><thead><tr><th>Unidade</th><th>Funcionários</th><th>Equipamentos</th></tr></thead><tbody>';
    h += '<tr><td>UASE</td><td>' + fUase + '</td><td>' + eUase + '</td></tr>';
    h += '<tr><td>UDAJ</td><td>' + fUdaj + '</td><td>' + eUdaj + '</td></tr>';
    var fSem = fDds - fUase - fUdaj, eSem = E.length - eUase - eUdaj;
    if (fSem || eSem) h += '<tr><td>Sem unidade atribuída</td><td>' + fSem + '</td><td>' + eSem + '</td></tr>';
    h += '<tr class="pr-tot"><td>Total DDS</td><td>' + fDds + '</td><td>' + E.length + '</td></tr>';
    if (fExt) h += '<tr><td>Afectos de outras divisões (não DDS)</td><td>' + fExt + '</td><td>—</td></tr>';
    h += '</tbody></table>';

    h += '<div class="pr-sec">Estado dos equipamentos</div>';
    h += '<table class="pr-table"><thead><tr><th>Activos</th><th>Em manutenção</th><th>Inactivos</th></tr></thead><tbody>';
    h += '<tr><td>' + eAtivos + '</td><td>' + eManut + '</td><td>' + (E.length - eAtivos - eManut) + '</td></tr>';
    h += '</tbody></table>';

    h += '<div class="pr-sec">Memorandos de manutenção</div>';
    h += '<table class="pr-table"><thead><tr><th>Concluídos</th><th>Em curso</th><th>Pendentes</th><th>Taxa de conclusão</th></tr></thead><tbody>';
    h += '<tr><td>' + mConcl + '</td><td>' + mCurso + '</td><td>' + mPend + '</td><td>' + taxa + '%</td></tr>';
    h += '</tbody></table>';

    h += _rodape();
    return h;
  }
  function _kpi(v, l) {
    return '<div class="pr-kpi"><div class="pr-kpi-v">' + esc(v) + '</div><div class="pr-kpi-l">' + esc(l) + '</div></div>';
  }

  // FUNCIONÁRIOS
  function _repFuncionarios(unidade) {
    var lista = APP.utilizadores.slice();
    var soExternos = (unidade === 'EXTERNA');
    if (unidade) lista = lista.filter(function(u){ return u.unidade === unidade; });
    else lista = lista.filter(function(u){ return u.unidade !== 'EXTERNA'; }); // DDS não inclui externos
    lista.sort(function(a, b) {
      var ua = (a.unidade || 'zzz'), ub = (b.unidade || 'zzz');
      if (ua !== ub) return ua.localeCompare(ub);
      return (a.nome || '').localeCompare(b.nome || '');
    });
    var sub = soExternos ? 'Afectos de outras divisões' : (unidade ? ('Unidade ' + unidade) : 'Toda a DDS');
    var h = _cabecalho('Lista de Funcionários', sub);
    h += '<div class="pr-meta2">' + lista.length + ' funcionários</div>';
    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:4%"><col style="width:28%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:15%"><col style="width:15%"></colgroup>';
    h += '<thead><tr>';
    [ '#', 'Nome', 'Nº Mec.', soExternos ? 'Divisão' : 'Unidade', 'Função', 'Categoria', 'Vínculo'].forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    lista.forEach(function(u, i) {
      var col4 = soExternos ? (u.divisao_origem || 'Externa') : (u.unidade || '—');
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(u.nome) + '</td><td>' + esc(u.num_mecanografico || '—') + '</td><td>' + esc(col4) + '</td><td>' + esc(u.funcao || '—') + '</td><td>' + esc(u.categoria || '—') + '</td><td>' + esc(u.vinculo || '—') + '</td></tr>';
    });
    h += '</tbody></table>' + _rodape();
    return h;
  }

  // EQUIPAMENTOS — quadro resumo (enriquecido)
  function _repEquipamentos(unidade) {
    var lista = APP.equipamentos.slice();
    if (unidade) lista = lista.filter(function(e){ return e.unidade === unidade; });
    lista.sort(_ordEq);
    var estadoLbl = { ativo: 'Activo', manutencao: 'Manutenção', inativo: 'Inactivo' };
    var h = _cabecalho('Lista de Equipamentos', unidade ? ('Unidade ' + unidade) : 'Toda a DDS');
    h += '<div class="pr-meta2">' + lista.length + ' equipamentos</div>';
    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:4%"><col style="width:28%"><col style="width:20%"><col style="width:11%"><col style="width:23%"><col style="width:9%"><col style="width:5%"></colgroup>';
    h += '<thead><tr>';
    ['#', 'Equipamento', 'Tipo', 'Unidade', 'Responsável', 'Estado', 'Esp.'].forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    lista.forEach(function(e, i) {
      var tipo = getTipo(e.tipo_id);
      var resp = e.responsavel_id ? (APP.utilizadores.filter(function(u){ return u.id === e.responsavel_id; })[0] || {}).nome : null;
      var nEsp = (APP.espacos || []).filter(function(x){ return x.equipamento_id === e.id; }).length;
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(e.nome) + '</td><td>' + esc(tipo ? tipo.nome : '—') + '</td><td>' + esc(e.unidade || '—') + '</td><td>' + esc(resp || '—') + '</td><td>' + esc(estadoLbl[e.estado] || e.estado || '—') + '</td><td>' + nEsp + '</td></tr>';
    });
    h += '</tbody></table>' + _rodape();
    return h;
  }

  // FICHA por equipamento — modo: 'full' | 'operacao' | 'manutencao'
  function _repFicha(unidade, modo) {
    modo = modo || 'full';
    var titulos = { full: 'Ficha Completa de Equipamentos', operacao: 'Ficha de Operação — Equipamentos', manutencao: 'Ficha de Manutenção — Equipamentos' };
    var ano = APP.anoTrabalho || new Date().getFullYear();
    var lista = APP.equipamentos.slice();
    if (unidade) lista = lista.filter(function(e){ return e.unidade === unidade; });
    lista.sort(_ordEq);
    var sub = (unidade ? ('Unidade ' + unidade) : 'Toda a DDS') + ' · Ano ' + ano;
    var h = _cabecalho(titulos[modo] || titulos.full, sub);
    if (!lista.length) { h += '<div class="pr-empty">Sem equipamentos.</div>'; return h + _rodape(); }
    lista.forEach(function(e) { h += _fichaEq(e, modo); });
    h += _rodape();
    return h;
  }

  function _fichaEq(e, modo) {
    modo = modo || 'full';
    var mostraOp  = (modo === 'full' || modo === 'operacao');
    var mostraMan = (modo === 'full' || modo === 'manutencao');
    var tipo = getTipo(e.tipo_id);
    var estadoLbl = { ativo: 'Activo', manutencao: 'Em manutenção', inativo: 'Inactivo' };
    var resp = e.responsavel_id ? (APP.utilizadores.filter(function(u){ return u.id === e.responsavel_id; })[0] || {}).nome : null;

    var h = '<div class="pr-ficha">';
    h += '<div class="pr-eqname">' + esc(e.nome) + '</div>';
    h += '<div class="pr-eqsub">' + esc(tipo ? tipo.nome : 'Sem tipo') + (e.codigo ? ' · ' + esc(e.codigo) : '') + '</div>';

    h += '<div class="pr-grid">';
    h += '<div><b>Unidade:</b> ' + esc(e.unidade || '—') + '</div>';
    h += '<div><b>Responsável:</b> ' + esc(resp || '—') + '</div>';
    h += '<div><b>Estado:</b> ' + esc(estadoLbl[e.estado] || e.estado || '—') + '</div>';
    if (e.morada || e.localidade) h += '<div><b>Morada:</b> ' + esc([e.morada, e.localidade].filter(Boolean).join(', ')) + '</div>';
    if (e.telefone) h += '<div><b>Telefone:</b> ' + esc(e.telefone) + '</div>';
    h += '</div>';

    if (mostraOp) {
      var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === e.id; }).sort(function(a, b){ return (a.ordem || 0) - (b.ordem || 0); });
      h += '<div class="pr-sec">Espaços / Valências (' + espacos.length + ')</div>';
      h += espacos.length ? '<div>' + espacos.map(function(x){ return '<span class="pr-badge">' + esc(x.nome) + '</span>'; }).join('') + '</div>' : '<div class="pr-empty">Sem espaços registados.</div>';

      var reservas = (APP.reservas || []).filter(function(r) {
        return r.equipamento_id === e.id && _noPeriodo(r.data_inicio);
      });
      h += '<div class="pr-sec">Reservas em ' + esc(_perLabel()) + ' (' + reservas.length + ')</div>';
      if (reservas.length) {
        h += '<table class="pr-table"><colgroup><col style="width:30%"><col style="width:24%"><col style="width:18%"><col style="width:28%"></colgroup>';
        h += '<thead><tr><th>Título</th><th>Entidade</th><th>Espaço</th><th>Quando</th></tr></thead><tbody>';
        reservas.slice(0, 20).forEach(function(r) {
          var esp = r.espaco_id ? (APP.espacos.filter(function(x){ return x.id === r.espaco_id; })[0] || {}).nome : null;
          h += '<tr><td>' + esc(r.titulo || '—') + '</td><td>' + esc(r.entidade || '—') + '</td><td>' + esc(esp || '—') + '</td><td>' + esc(_quandoReserva(r)) + '</td></tr>';
        });
        h += '</tbody></table>';
        if (reservas.length > 20) h += '<div class="pr-empty">… e mais ' + (reservas.length - 20) + ' reservas.</div>';
      } else h += '<div class="pr-empty">Sem reservas registadas.</div>';

      var turnos = (APP.escalas || []).filter(function(t) {
        return t.equipamento_id === e.id && _noPeriodo(t.data_inicio);
      }).sort(function(a, b){ return new Date(b.data_inicio || 0) - new Date(a.data_inicio || 0); });
      h += '<div class="pr-sec">Escala — turnos (' + turnos.length + ')</div>';
      if (turnos.length) {
        h += '<table class="pr-table"><colgroup><col style="width:30%"><col style="width:18%"><col style="width:30%"><col style="width:22%"></colgroup>';
        h += '<thead><tr><th>Funcionário</th><th>Tipo</th><th>Período</th><th>Horas</th></tr></thead><tbody>';
        turnos.slice(0, 20).forEach(function(t) {
          var f = (APP.utilizadores.filter(function(u){ return u.id === t.funcionario_id; })[0] || {}).nome;
          var per = _fdata(t.data_inicio) + (t.data_fim && t.data_fim !== t.data_inicio ? ' → ' + _fdata(t.data_fim) : '');
          var horas = (t.hora_entrada ? t.hora_entrada.slice(0, 5) : '') + (t.hora_saida ? '–' + t.hora_saida.slice(0, 5) : '');
          h += '<tr><td>' + esc(f || '—') + '</td><td>' + esc(_turnoLbl(t.tipo_turno)) + '</td><td>' + esc(per) + '</td><td>' + esc(horas || '—') + '</td></tr>';
        });
        h += '</tbody></table>';
        if (turnos.length > 20) h += '<div class="pr-empty">… e mais ' + (turnos.length - 20) + ' turnos.</div>';
      } else h += '<div class="pr-empty">Sem turnos registados.</div>';
    }

    if (mostraMan) {
      var memos = (APP.memos || []).filter(function(m) {
        return m.equipamento_id === e.id && _noPeriodo(m.created_at);
      }).sort(function(a, b){ return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
      h += '<div class="pr-sec">Memorandos (' + memos.length + ')</div>';
      if (memos.length) {
        h += '<table class="pr-table"><colgroup><col style="width:12%"><col style="width:50%"><col style="width:20%"><col style="width:18%"></colgroup>';
        h += '<thead><tr><th>Nº</th><th>Descrição</th><th>Estado</th><th>Data</th></tr></thead><tbody>';
        memos.forEach(function(m) {
          h += '<tr><td>' + esc(m.numero || '—') + '</td><td>' + esc(m.descricao || '—') + '</td><td>' + esc(_estadoMemo(m)) + '</td><td>' + _fdata(m.created_at) + '</td></tr>';
        });
        h += '</tbody></table>';
      } else h += '<div class="pr-empty">Sem memorandos.</div>';

      var templates = (APP.checklist_templates || []).filter(function(t){ return t.equipamento_id === e.id; });
      h += '<div class="pr-sec">Checklists (' + templates.length + ')</div>';
      if (templates.length) {
        h += '<table class="pr-table"><colgroup><col style="width:40%"><col style="width:22%"><col style="width:12%"><col style="width:26%"></colgroup>';
        h += '<thead><tr><th>Checklist</th><th>Periodicidade</th><th>Itens</th><th>Últ. verificação</th></tr></thead><tbody>';
        templates.forEach(function(t) {
          var nItens = (APP.checklist_items || []).filter(function(i){ return i.template_id === t.id; }).length;
          var regs = (APP.checklist_registos || []).filter(function(r){ return r.template_id === t.id; }).sort(function(a, b){ return new Date(b.data_realizacao || b.created_at || 0) - new Date(a.data_realizacao || a.created_at || 0); });
          var ult = regs[0] ? _fdata(regs[0].data_realizacao || regs[0].created_at) : '—';
          h += '<tr><td>' + esc(t.nome) + (t.ativo === false ? ' (inactiva)' : '') + '</td><td>' + esc(t.periodicidade || '—') + '</td><td>' + nItens + '</td><td>' + esc(ult) + '</td></tr>';
        });
        h += '</tbody></table>';
      } else h += '<div class="pr-empty">Sem checklists.</div>';
    }

    h += '</div>';
    return h;
  }

  function _ordEq(a, b) {
    var ua = (a.unidade || 'zzz'), ub = (b.unidade || 'zzz');
    if (ua !== ub) return ua.localeCompare(ub);
    return (a.nome || '').localeCompare(b.nome || '');
  }
  function _fdata(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  var _TURNO_LBL = { normal: 'Normal', ferias: 'Férias', folga: 'Folga', feriado: 'Feriado', formacao: 'Formação', doenca: 'Doença' };
  function _turnoLbl(t) { return _TURNO_LBL[t] || t || 'Turno'; }
  var _DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  function _quandoReserva(r) {
    if (r.recorrente) {
      var dias = (r.dias_semana || '').split(',').filter(function(x){ return x !== ''; }).map(function(d){ return _DIAS[parseInt(d, 10)] || ''; }).join(', ');
      var horas = (r.hora_inicio ? r.hora_inicio.slice(0, 5) : '') + (r.hora_fim ? '–' + r.hora_fim.slice(0, 5) : '');
      return 'Semanal: ' + dias + (horas ? ' ' + horas : '');
    }
    var d = _fdata(r.data_inicio);
    var hi = r.data_inicio ? new Date(r.data_inicio) : null;
    var hora = hi && !isNaN(hi) ? (' ' + ('0' + hi.getHours()).slice(-2) + ':' + ('0' + hi.getMinutes()).slice(-2)) : '';
    return d + hora;
  }

  // MEMORANDOS
  function _repMemorandos(ambito) {
    var lista = APP.memos.filter(function(m) { return _noPeriodo(m.created_at); });
    if (ambito === 'ativos') lista = lista.filter(function(m){ return m.estado !== 'concluido'; });
    lista.sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });

    var h = _cabecalho('Memorandos de Manutenção', ambito === 'ativos' ? 'Apenas em aberto' : 'Todos');
    // resumo por estado
    var porEstado = {};
    APP.memos.forEach(function(m){ var e = _estadoMemo(m); porEstado[e] = (porEstado[e] || 0) + 1; });
    h += '<div class="pr-meta2">' + lista.length + ' memorandos listados · Total na divisão: ' + APP.memos.length + '</div>';
    h += '<table class="pr-table" style="margin-bottom:12px;"><thead><tr><th>Pendente</th><th>A enviar</th><th>Em curso</th><th>Reforço</th><th>Concluído</th></tr></thead><tbody><tr>';
    ['Pendente','A enviar','Em curso','Reforço pedido','Concluído'].forEach(function(k){ h += '<td>' + (porEstado[k] || 0) + '</td>'; });
    h += '</tr></tbody></table>';

    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:12%"><col style="width:44%"><col style="width:24%"><col style="width:10%"><col style="width:10%"></colgroup>';
    h += '<thead><tr>';
    ['Nº', 'Descrição', 'Equipamento', 'Estado', 'Data'].forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    lista.forEach(function(m) {
      var eq = m.equipamento_id ? (getEq(m.equipamento_id) || {}).nome : null;
      var dt = m.created_at ? new Date(m.created_at) : null;
      var dstr = dt ? ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + dt.getFullYear() : '—';
      h += '<tr><td>' + esc(m.numero || '—') + '</td><td>' + esc(m.descricao || '—') + '</td><td>' + esc(eq || '—') + '</td><td>' + esc(_estadoMemo(m)) + '</td><td>' + dstr + '</td></tr>';
    });
    h += '</tbody></table>' + _rodape();
    return h;
  }

  // BANCO DE HORAS
  function _repHoras(unidade) {
    if (typeof Horas === 'undefined') return _cabecalho('Banco de Horas', '—') + _rodape();
    var regs = Horas.registos();

    var funcs = APP.utilizadores.filter(function(u) {
      return !unidade || u.unidade === unidade;
    });

    var linhas = funcs.map(function(f) {
      return { f: f, s: Horas.saldoDe(f.id) };
    }).filter(function(x) {
      return x.s.efetuadas > 0 || x.s.gozadas > 0;
    }).sort(function(a, b) {
      var ua = (a.f.unidade || 'zzz'), ub = (b.f.unidade || 'zzz');
      if (ua !== ub) return ua.localeCompare(ub);
      return (a.f.nome || '').localeCompare(b.f.nome || '');
    });

    var tEf = 0, tGo = 0;
    linhas.forEach(function(x) { tEf += x.s.efetuadas; tGo += x.s.gozadas; });

    var h = _cabecalho('Banco de Horas', unidade ? ('Unidade ' + unidade) : 'Toda a DDS');

    h += '<div class="pr-kpis">';
    h += _kpi(Horas.fmtH(tEf), 'Efectuadas');
    h += _kpi(Horas.fmtH(tGo), 'Gozadas');
    h += _kpi(Horas.fmtH(tEf - tGo), 'Saldo');
    h += _kpi(linhas.length, 'Funcionários');
    h += '</div>';

    h += '<div class="pr-sec">Saldos por funcionário (apenas horas aprovadas)</div>';
    if (!linhas.length) {
      h += '<div class="pr-empty">Sem horas aprovadas.</div>';
      return h + _rodape();
    }

    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:5%"><col style="width:33%"><col style="width:14%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>';
    h += '<thead><tr><th>#</th><th>Funcionário</th><th>Unidade</th><th>Efectuadas</th><th>Gozadas</th><th>Saldo</th></tr></thead><tbody>';
    linhas.forEach(function(x, i) {
      var uni = x.f.unidade === 'EXTERNA' ? (x.f.divisao_origem || 'Externo') : (x.f.unidade || '—');
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(x.f.nome) + '</td><td>' + esc(uni) + '</td><td>' + Horas.fmtH(x.s.efetuadas) + '</td><td>' + Horas.fmtH(x.s.gozadas) + '</td><td><strong>' + Horas.fmtH(x.s.saldo) + '</strong></td></tr>';
    });
    h += '<tr class="pr-tot"><td></td><td>Total</td><td></td><td>' + Horas.fmtH(tEf) + '</td><td>' + Horas.fmtH(tGo) + '</td><td>' + Horas.fmtH(tEf - tGo) + '</td></tr>';
    h += '</tbody></table>';

    // detalhe dos movimentos (no período seleccionado)
    var movs = regs.filter(function(r) {
      if (r.estado !== 'aprovado') return false;
      if (!_noPeriodo(r.data)) return false;
      if (!unidade) return true;
      var f = APP.utilizadores.filter(function(u){ return u.id === r.funcionario_id; })[0];
      return f && f.unidade === unidade;
    }).sort(function(a, b) { return new Date(b.data || 0) - new Date(a.data || 0); });

    if (movs.length) {
      h += '<div class="pr-sec">Movimentos autorizados — ' + esc(_perLabel()) + ' (' + movs.length + ')</div>';
      h += '<table class="pr-table">';
      h += '<colgroup><col style="width:12%"><col style="width:28%"><col style="width:14%"><col style="width:12%"><col style="width:34%"></colgroup>';
      h += '<thead><tr><th>Data</th><th>Funcionário</th><th>Tipo</th><th>Horas</th><th>Motivo</th></tr></thead><tbody>';
      movs.slice(0, 60).forEach(function(r) {
        var f = APP.utilizadores.filter(function(u){ return u.id === r.funcionario_id; })[0];
        h += '<tr><td>' + _fdata(r.data) + '</td><td>' + esc(f ? f.nome : '?') + '</td><td>' + (r.tipo === 'gozada' ? 'Gozadas' : 'Efectuadas') + '</td><td>' + Horas.fmtH(r.horas) + '</td><td>' + esc(r.motivo || '—') + '</td></tr>';
      });
      h += '</tbody></table>';
      if (movs.length > 60) h += '<div class="pr-empty">… e mais ' + (movs.length - 60) + ' movimentos.</div>';
    }

    return h + _rodape();
  }

  // BANCO DE HORAS — extrato individual
  function _repHorasIndividual(funcId) {
    if (typeof Horas === 'undefined' || !funcId) return _cabecalho('Extrato de Banco de Horas', '—') + _rodape();
    var f = APP.utilizadores.filter(function(u) { return u.id === funcId; })[0];
    if (!f) return _cabecalho('Extrato de Banco de Horas', 'Funcionário não encontrado') + _rodape();

    var s = Horas.saldoDe(funcId);
    var uni = f.unidade === 'EXTERNA' ? (f.divisao_origem || 'Externo à DDS') : (f.unidade || '—');

    var h = _cabecalho('Extrato de Banco de Horas', esc(f.nome) + (f.num_mecanografico ? ' · Nº ' + esc(f.num_mecanografico) : ''));

    h += '<div class="pr-grid">';
    h += '<div><b>Unidade:</b> ' + esc(uni) + '</div>';
    if (f.funcao)    h += '<div><b>Função:</b> ' + esc(f.funcao) + '</div>';
    if (f.categoria) h += '<div><b>Categoria:</b> ' + esc(f.categoria) + '</div>';
    if (f.vinculo)   h += '<div><b>Vínculo:</b> ' + esc(f.vinculo) + '</div>';
    h += '</div>';

    h += '<div class="pr-kpis">';
    h += _kpi(Horas.fmtH(s.efetuadas), 'Horas efectuadas');
    h += _kpi(Horas.fmtH(s.gozadas),   'Horas gozadas');
    h += _kpi(Horas.fmtH(s.saldo),     'Saldo actual');
    h += '</div>';

    var movs = Horas.registos().filter(function(r) {
      return r.funcionario_id === funcId && r.estado === 'aprovado';
    }).sort(function(a, b) { return new Date(a.data || 0) - new Date(b.data || 0); });

    h += '<div class="pr-sec">Movimentos autorizados (' + movs.length + ')</div>';
    if (!movs.length) {
      h += '<div class="pr-empty">Sem movimentos autorizados.</div>';
      return h + _rodape();
    }

    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:11%"><col style="width:15%"><col style="width:10%"><col style="width:41%"><col style="width:11%"><col style="width:12%"></colgroup>';
    h += '<thead><tr><th>Data</th><th>Tipo</th><th>Horas</th><th>Justificação</th><th>Equipamento / Iniciativa</th><th>Saldo acum.</th></tr></thead><tbody>';

    var acum = 0;
    movs.forEach(function(r) {
      var hrs = parseFloat(r.horas) || 0;
      var gozada = r.tipo === 'gozada';
      acum += gozada ? -hrs : hrs;
      var eq = r.equipamento_id ? (getEq(r.equipamento_id) || {}).nome : null;
      var local = eq || r.iniciativa || '—';
      h += '<tr>';
      h += '<td>' + _fdata(r.data) + '</td>';
      var tipoTxt = gozada ? 'Gozar horas' : 'Horas extra';
      var perX = (typeof Horas.labelPeriodo === 'function') ? Horas.labelPeriodo(r) : '';
      if (perX) tipoTxt += '<div style="font-size:8px;color:#666;">' + esc(perX) + '</div>';
      h += '<td>' + tipoTxt + '</td>';
      h += '<td>' + (gozada ? '−' : '+') + Horas.fmtH(hrs) + '</td>';
      h += '<td>' + esc(r.motivo || '—') + '</td>';
      h += '<td>' + esc(local) + '</td>';
      h += '<td><strong>' + Horas.fmtH(acum) + '</strong></td>';
      h += '</tr>';
    });
    h += '<tr class="pr-tot"><td colspan="5">Saldo final</td><td>' + Horas.fmtH(s.saldo) + '</td></tr>';
    h += '</tbody></table>';

    // pedidos ainda em curso
    var pend = Horas.registos().filter(function(r) {
      return r.funcionario_id === funcId && (r.estado === 'pendente' || r.estado === 'validado_resp');
    });
    if (pend.length) {
      h += '<div class="pr-sec">Pedidos por autorizar (' + pend.length + ') — não contam no saldo</div>';
      h += '<table class="pr-table">';
      h += '<colgroup><col style="width:14%"><col style="width:18%"><col style="width:12%"><col style="width:36%"><col style="width:20%"></colgroup>';
      h += '<thead><tr><th>Data</th><th>Tipo</th><th>Horas</th><th>Justificação</th><th>Estado</th></tr></thead><tbody>';
      pend.forEach(function(r) {
        h += '<tr><td>' + _fdata(r.data) + '</td><td>' + (r.tipo === 'gozada' ? 'Gozar horas' : 'Horas extra') + '</td><td>' + Horas.fmtH(r.horas) + '</td><td>' + esc(r.motivo || '—') + '</td><td>' + (r.estado === 'pendente' ? 'Aguarda responsável' : 'Aguarda chefe unidade') + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    h += '<div style="margin-top:24px;display:flex;gap:40px;font-size:9px;">';
    h += '<div style="flex:1;border-top:1px solid #999;padding-top:4px;">O funcionário</div>';
    h += '<div style="flex:1;border-top:1px solid #999;padding-top:4px;">O chefe de unidade</div>';
    h += '</div>';

    return h + _rodape();
  }

  // ══════════════════════════════════════════════════════════
  // ABA "EQUIPAMENTOS" — o relatório mensal, pronto a imprimir
  // ══════════════════════════════════════════════════════════
  // Estadias, visitas e checklists só são carregadas para o equipamento
  // seleccionado. Para um relatório transversal é preciso carregar tudo.

  var _globaisEstado = null; // null = por carregar | 'a-carregar' | 'ok' | 'erro'
  var _globaisErro   = '';

  function _carregarGlobais() {
    if (_globaisEstado === 'a-carregar' || _globaisEstado === 'ok') return;
    _globaisEstado = 'a-carregar';

    var ano  = APP.anoTrabalho || new Date().getFullYear();
    var ini  = ano + '-01-01';
    var fim  = ano + '-12-31';

    Promise.all([
      sbGet('estadias', 'data_checkin=gte.' + ini + '&data_checkin=lte.' + fim + '&order=data_checkin.asc')
        .then(function(d) { APP.repEstadias = Array.isArray(d) ? d : []; }),
      sbGet('visitas', 'data=gte.' + ini + '&data=lte.' + fim + '&order=data.asc')
        .then(function(d) { APP.repVisitas = Array.isArray(d) ? d : []; }),
      sbGet('checklist_registos', 'data_registo=gte.' + ini + '&data_registo=lte.' + fim + '&order=data_registo.asc')
        .then(function(d) { APP.repChecks = Array.isArray(d) ? d : []; })
    ]).then(function() {
      _globaisEstado = 'ok';
      _rerender();
    }).catch(function(e) {
      // mostrar SEMPRE o erro real do Supabase
      _globaisEstado = 'erro';
      _globaisErro = (e && (e.code || e.message))
        ? [e.code, e.message, e.details, e.hint].filter(Boolean).join(' · ')
        : String(e);
      _rerender();
    });
  }

  // ── INDICADORES DE UM EQUIPAMENTO NO PERÍODO ──────────────
  function _pessoasReg(r) {
    return (parseInt(r.n_adultos, 10) || 0) + (parseInt(r.n_criancas, 10) || 0);
  }

  // noites de uma estadia (mesma regra do módulo Estadias)
  function _noitesEst(e) {
    if (!e.data_checkin) return 0;
    var i = new Date(e.data_checkin);
    var f = e.data_checkout_real ? new Date(e.data_checkout_real)
          : (e.estado === 'ativa' ? new Date()
          : (e.data_checkout_prev ? new Date(e.data_checkout_prev) : null));
    if (!f || isNaN(i) || isNaN(f)) return 0;
    var n = Math.round((f - i) / 86400000);
    return n > 0 ? n : (e.estado === 'ativa' ? 0 : 1);
  }

  // dormidas = pessoas × noites (indicador oficial de turismo)
  function _dormidasEst(e) { return _pessoasReg(e) * _noitesEst(e); }

  // Todos os indicadores de um equipamento, num mês (ou no ano se mes=null)
  function _indicadores(eqId, mes) {
    function noMes(iso) {
      if (!iso) return false;
      var ano = String(APP.anoTrabalho || new Date().getFullYear());
      var s = String(iso).slice(0, 10);
      if (s.slice(0, 4) !== ano) return false;
      if (!mes) return true;
      return s.slice(5, 7) === ('0' + mes).slice(-2);
    }
    function doEq(arr, campoData) {
      return (arr || []).filter(function(r) {
        return r.equipamento_id === eqId && noMes(r[campoData]);
      });
    }

    var reservas = doEq(APP.reservas, 'data_inicio').filter(function(r) { return r.estado !== 'cancelada'; });
    var memos    = doEq(APP.memos, 'created_at');
    var estadias = doEq(APP.repEstadias, 'data_checkin');
    var visitas  = doEq(APP.repVisitas, 'data');
    var checks   = doEq(APP.repChecks, 'data_registo');
    var turnos   = doEq(APP.escalas, 'data_inicio');

    var dormidas = 0, hospedes = 0;
    estadias.forEach(function(e) { dormidas += _dormidasEst(e); hospedes += _pessoasReg(e); });

    var visitantes = 0, vAd = 0, vCr = 0;
    visitas.forEach(function(v) {
      vAd += parseInt(v.n_adultos, 10) || 0;
      vCr += parseInt(v.n_criancas, 10) || 0;
    });
    visitantes = vAd + vCr;

    return {
      reservas:   reservas.length,
      memosAb:    memos.filter(function(m) { return m.estado !== 'concluido'; }).length,
      memosCo:    memos.filter(function(m) { return m.estado === 'concluido'; }).length,
      estadias:   estadias.length,
      dormidas:   dormidas,
      hospedes:   hospedes,
      estadiasL:  estadias,
      visitas:    visitas.length,
      visitantes: visitantes,
      vAdultos:   vAd,
      vCriancas:  vCr,
      visitasL:   visitas,
      checklists: checks.length,
      turnos:     turnos.length
    };
  }

  // ── GRÁFICOS (SVG puro — sem bibliotecas, imprime bem) ─────
  var CORES = { azul:'#2563EB', teal:'#0D9488', ambar:'#D97706', verde:'#16A34A', roxo:'#7C3AED', vermelho:'#DC2626' };

  // Barras verticais — evolução ao longo dos 12 meses.
  // compacto = versão para 3 gráficos lado a lado no relatório impresso:
  // usa a inicial do mês e fontes maiores, para continuar legível depois
  // de o SVG ser reduzido a um terço da largura da página.
  function _chartBarras(dados, cor, compacto) {
    var W  = compacto ? 300 : 380;
    var H  = compacto ? 172 : 150;
    var pb = compacto ? 26  : 22;
    var pt = compacto ? 20  : 16;
    var pl = 6;
    var fLbl = compacto ? 11   : 8.5;
    var fVal = compacto ? 10.5 : 8.5;

    var alt = H - pt - pb;
    var max = 1;
    dados.forEach(function(d) { if (d.v > max) max = d.v; });
    var n = dados.length || 1;
    var slot = (W - pl * 2) / n;
    var bw = Math.min(slot * 0.6, 26);

    var s = '<svg class="rchart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    [0, 0.5, 1].forEach(function(f) {
      var y = pt + alt * (1 - f);
      s += '<line x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (W - pl) + '" y2="' + y.toFixed(1) +
           '" stroke="#94A3B8" stroke-opacity="0.25" stroke-width="1"/>';
    });
    dados.forEach(function(d, i) {
      var h = alt * (d.v / max);
      var x = pl + slot * i + (slot - bw) / 2;
      var y = pt + alt - h;
      var rot = compacto ? String(d.l).charAt(0) : d.l;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
           '" height="' + Math.max(h, 0).toFixed(1) + '" rx="3" fill="' + cor +
           '" fill-opacity="' + (d.destaque ? '1' : '0.72') + '"><title>' + esc(d.l) + ': ' + d.v + '</title></rect>';
      if (d.v > 0) {
        s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) +
             '" text-anchor="middle" font-size="' + fVal + '" font-weight="700" fill="#334155">' + d.v + '</text>';
      }
      s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) +
           '" text-anchor="middle" font-size="' + fLbl + '" fill="#64748B">' + esc(rot) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  // Barras horizontais — comparação entre equipamentos (nomes longos)
  function _chartBarrasH(dados, cor) {
    if (!dados.length) return _chartVazio();
    var linha = 26, W = 380, pl = 118, pr = 34;
    var H = dados.length * linha + 8;
    var max = 1;
    dados.forEach(function(d) { if (d.v > max) max = d.v; });
    var larg = W - pl - pr;

    var s = '<svg class="rchart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
    dados.forEach(function(d, i) {
      var y = i * linha + 5;
      var w = larg * (d.v / max);
      var nome = d.l.length > 18 ? d.l.slice(0, 17) + '…' : d.l;
      s += '<text x="' + (pl - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="9.5" fill="#334155">' + esc(nome) + '</text>';
      s += '<rect x="' + pl + '" y="' + y + '" width="' + larg + '" height="15" rx="3" fill="#94A3B8" fill-opacity="0.12"/>';
      s += '<rect x="' + pl + '" y="' + y + '" width="' + Math.max(w, d.v > 0 ? 2 : 0).toFixed(1) +
           '" height="15" rx="3" fill="' + cor + '"><title>' + esc(d.l) + ': ' + d.v + '</title></rect>';
      s += '<text x="' + (W - pr + 6) + '" y="' + (y + 12) + '" font-size="9.5" font-weight="700" fill="#334155">' + d.v + '</text>';
    });
    s += '</svg>';
    return s;
  }

  // Donut — repartição (tipos de visitante, etc.)
  function _chartDonut(dados) {
    var total = 0;
    dados.forEach(function(d) { total += d.v; });
    if (!total) return _chartVazio();

    var cx = 62, cy = 62, R = 52, r = 32, ang = -Math.PI / 2;
    var s = '<div class="rdonut"><svg viewBox="0 0 124 124" class="rdonut-svg">';
    dados.forEach(function(d) {
      if (!d.v) return;
      var frac = d.v / total;
      var a2 = ang + frac * Math.PI * 2;
      // um único segmento a 100% não desenha arco — usar dois anéis
      if (frac >= 0.999) {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + d.c +
             '" stroke-width="' + (R - r) + '"><title>' + esc(d.l) + ': ' + d.v + '</title></circle>';
        ang = a2;
        return;
      }
      var grande = frac > 0.5 ? 1 : 0;
      var x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
      var x2 = cx + R * Math.cos(a2),  y2 = cy + R * Math.sin(a2);
      var x3 = cx + r * Math.cos(a2),  y3 = cy + r * Math.sin(a2);
      var x4 = cx + r * Math.cos(ang), y4 = cy + r * Math.sin(ang);
      s += '<path d="M' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
           ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) +
           ' L' + x3.toFixed(2) + ' ' + y3.toFixed(2) +
           ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2) + ' Z"' +
           ' fill="' + d.c + '"><title>' + esc(d.l) + ': ' + d.v + '</title></path>';
      ang = a2;
    });
    s += '<text x="' + cx + '" y="' + (cy + 1) + '" text-anchor="middle" font-size="19" font-weight="800" fill="#0F172A">' + total + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle" font-size="7.5" fill="#64748B">total</text>';
    s += '</svg><div class="rleg">';
    // Percentagens pelo método do maior resto: arredondar cada fatia por si
    // dava somas de 99% ou 101%. Distribui-se a diferença pelas maiores sobras.
    var vis = dados.filter(function(d) { return d.v > 0; });
    var pcts = vis.map(function(d) {
      var exato = d.v / total * 100;
      return { base: Math.floor(exato), resto: exato - Math.floor(exato) };
    });
    var soma = 0;
    pcts.forEach(function(p) { soma += p.base; });
    var faltam = 100 - soma;
    pcts.map(function(p, i) { return { i: i, r: p.resto }; })
        .sort(function(a, b) { return b.r - a.r; })
        .slice(0, Math.max(faltam, 0))
        .forEach(function(x) { pcts[x.i].base += 1; });

    vis.forEach(function(d, i) {
      s += '<div class="rleg-i"><span class="rleg-d" style="background:' + d.c + ';"></span>' +
           '<span class="rleg-l">' + esc(d.l) + '</span>' +
           '<span class="rleg-v">' + d.v + ' <em>' + pcts[i].base + '%</em></span></div>';
    });
    s += '</div></div>';
    return s;
  }

  function _chartVazio() {
    return '<div class="rchart-vazio">Sem dados no período seleccionado.</div>';
  }

  function _rcard(val, label, sub, cor) {
    return '<div class="rcard" style="border-top-color:' + cor + ';">' +
           '<div class="rcard-v">' + val + '</div>' +
           '<div class="rcard-l">' + esc(label) + '</div>' +
           '<div class="rcard-s">' + esc(sub || '') + '</div></div>';
  }

  function _bloco(titulo, corpo, sub) {
    return '<div class="rbloco"><div class="rbloco-h"><div class="rbloco-t">' + esc(titulo) + '</div>' +
           (sub ? '<div class="rbloco-s">' + esc(sub) + '</div>' : '') + '</div>' + corpo + '</div>';
  }

  // ── A PÁGINA ──────────────────────────────────────────────
  function _renderEquipamentos() {
    if (_globaisEstado === null) { _carregarGlobais(); }

    if (_globaisEstado === 'erro') {
      return '<div class="rbloco"><div class="rbloco-h"><div class="rbloco-t" style="color:var(--red);">Não foi possível carregar os dados</div></div>' +
             '<div style="padding:0 16px 16px;font-size:13px;color:var(--text-2);">' + esc(_globaisErro) + '</div>' +
             '<div style="padding:0 16px 16px;"><button class="btn btn-secondary btn-sm" onclick="Relatorios.recarregar()">Tentar de novo</button></div></div>';
    }
    if (_globaisEstado !== 'ok') {
      return '<div class="rchart-vazio" style="padding:40px;">A carregar estadias, visitas e checklists…</div>';
    }

    var eqs = (APP.equipamentos || []).filter(function(e) { return APP.podeVerEquipamento(e.id); });
    if (!eqs.length) return '<div class="rchart-vazio">Sem equipamentos.</div>';

    var eqId = _eqRel || eqs[0].id;
    if (!eqs.filter(function(e) { return e.id === eqId; }).length) eqId = eqs[0].id;
    var eq   = eqs.filter(function(e) { return e.id === eqId; })[0];
    var mes  = APP.repMes || null;
    var d    = _indicadores(eqId, mes);
    var tipo = getTipo(eq.tipo_id);

    var html = '';

    // Selector de equipamento + botão imprimir
    html += '<div class="rbar">';
    html += '<select class="eq-switch rbar-sel" onchange="Relatorios.setEqRel(this.value)">';
    eqs.forEach(function(e) {
      html += '<option value="' + e.id + '"' + (e.id === eqId ? ' selected' : '') + '>' + H(e.nome) + '</option>';
    });
    html += '</select>';
    html += '<button class="btn btn-primary btn-sm" onclick="Relatorios.imprimirMensal(\'' + eqId + '\')">🖨 Relatório mensal</button>';
    html += '</div>';

    // Cabeçalho do equipamento
    html += '<div class="rhead">';
    html += '<div class="rhead-n">' + H(eq.nome) + '</div>';
    html += '<div class="rhead-m">' + H(tipo ? tipo.nome : '—') + ' · ' + esc(_perLabel()) + '</div>';
    html += '</div>';

    // ── KPIs (só os módulos que o equipamento tem) ──
    html += '<div class="rgrid">';
    if (modAtivo(eq, 'estadias')) {
      html += _rcard(d.dormidas,   'Dormidas',    'pessoas × noites', CORES.teal);
      html += _rcard(d.estadias,   'Estadias',    d.hospedes + ' hóspedes', CORES.azul);
    }
    if (modAtivo(eq, 'visitas')) {
      html += _rcard(d.visitantes, 'Visitantes',  d.vAdultos + ' ad. · ' + d.vCriancas + ' cri.', CORES.roxo);
      html += _rcard(d.visitas,    'Visitas',     'grupos registados', CORES.azul);
    }
    if (modAtivo(eq, 'reservas'))  html += _rcard(d.reservas,   'Reservas',   'não canceladas', CORES.azul);
    if (modAtivo(eq, 'checklist')) html += _rcard(d.checklists, 'Checklists', 'registos preenchidos', CORES.verde);
    if (modAtivo(eq, 'escalas'))   html += _rcard(d.turnos,     'Turnos',     'na escala', CORES.teal);
    html += _rcard(d.memosAb, 'Reparações abertas', d.memosCo + ' concluídas', d.memosAb ? CORES.ambar : CORES.verde);
    html += '</div>';

    // ── Evolução mensal (o indicador principal do equipamento) ──
    var ind = _indicadorPrincipal(eq);
    var serie = [];
    for (var m = 1; m <= 12; m++) {
      var dm = _indicadores(eqId, m);
      serie.push({ l: MESES_C[m - 1], v: dm[ind.campo] || 0, destaque: (mes === m) });
    }
    html += _bloco('Evolução mensal — ' + ind.label,
                   _chipsInd(eq) + _chartBarras(serie, ind.cor),
                   'Ano de ' + (APP.anoTrabalho || new Date().getFullYear()) + (mes ? ' · mês seleccionado a cheio' : ''));

    // ── Repartição (donut) ──
    if (modAtivo(eq, 'visitas') && d.visitas) {
      var porTipo = {};
      d.visitasL.forEach(function(v) {
        var t = v.tipo_visitante || 'outro';
        porTipo[t] = (porTipo[t] || 0) + _pessoasReg(v);
      });
      var paleta = [CORES.azul, CORES.teal, CORES.ambar, CORES.roxo, CORES.verde, CORES.vermelho];
      var dd = Object.keys(porTipo).map(function(k, i) {
        return { l: _labelTipoVisita(k), v: porTipo[k], c: paleta[i % paleta.length] };
      }).sort(function(a, b) { return b.v - a.v; });
      html += _bloco('Visitantes por tipo', _chartDonut(dd), esc(_perLabel()));
    }

    if (modAtivo(eq, 'estadias') && d.estadias) {
      var ad = 0, cr = 0;
      d.estadiasL.forEach(function(e) {
        ad += parseInt(e.n_adultos, 10) || 0;
        cr += parseInt(e.n_criancas, 10) || 0;
      });
      html += _bloco('Hóspedes por escalão',
                     _chartDonut([{ l: 'Adultos', v: ad, c: CORES.azul }, { l: 'Crianças', v: cr, c: CORES.ambar }]),
                     esc(_perLabel()));
    }

    // ── Comparação — só com equipamentos comparáveis ──
    // Não basta o mesmo tipo: o "Complexo de Vinha de Mouros" agrupa o
    // campismo, o CEAVM e o hípico, e só o campismo tem hóspedes. Só se
    // compara quem tem o MESMO TIPO e o MÓDULO que gera este indicador.
    if (APP.isDds() && ind.mod) {
      var comparaveis = eqs.filter(function(e) {
        return e.tipo_id === eq.tipo_id && modAtivo(e, ind.mod);
      });
      if (comparaveis.length > 1) {
        var comp = comparaveis.map(function(e) {
          var de = _indicadores(e.id, mes);
          return { l: e.nome, v: de[ind.campo] || 0 };
        }).sort(function(a, b) { return b.v - a.v; });
        html += _bloco('Comparação — ' + ind.label,
                       _chartBarrasH(comp, ind.cor),
                       comparaveis.length + ' equipamentos comparáveis · ' + _perLabel());
      }
    }

    // ── Detalhe: reparações do período ──
    var memosP = (APP.memos || []).filter(function(m) {
      return m.equipamento_id === eqId && _noPeriodo(m.created_at);
    });
    if (memosP.length) {
      var t = '<div class="dtw"><table class="dt"><thead><tr><th>Data</th><th>Assunto</th><th>Estado</th></tr></thead><tbody>';
      memosP.slice(0, 15).forEach(function(m) {
        t += '<tr><td class="td-mono">' + _fdataC(m.created_at) + '</td>' +
             '<td class="td-p">' + H(m.assunto || m.titulo || '—') + '</td>' +
             '<td>' + _estadoMemo(m) + '</td></tr>';
      });
      t += '</tbody></table></div>';
      html += _bloco('Reparações e memorandos', t, memosP.length + ' no período');
    }

    return html;
  }

  // Indicadores que fazem sentido para este equipamento (o 1.º é o omissão)
  // 'mod' = módulo que gera o indicador — usado para saber com quem comparar
  function _indicadoresDisp(eq) {
    var l = [];
    if (modAtivo(eq, 'estadias')) {
      l.push({ campo: 'hospedes', label: 'Hóspedes', cor: CORES.teal,  mod: 'estadias' });
      l.push({ campo: 'estadias', label: 'Estadias', cor: CORES.azul,  mod: 'estadias' });
      l.push({ campo: 'dormidas', label: 'Dormidas', cor: CORES.verde, mod: 'estadias' });
    }
    if (modAtivo(eq, 'visitas')) {
      l.push({ campo: 'visitantes', label: 'Visitantes', cor: CORES.roxo, mod: 'visitas' });
      l.push({ campo: 'visitas',    label: 'Grupos',     cor: CORES.azul, mod: 'visitas' });
    }
    if (modAtivo(eq, 'reservas')) l.push({ campo: 'reservas', label: 'Reservas', cor: CORES.azul, mod: 'reservas' });
    if (!l.length) l.push({ campo: 'memosCo', label: 'Reparações concluídas', cor: CORES.verde, mod: null });
    return l;
  }

  // Qual o indicador a desenhar: o escolhido, se for válido aqui; senão o 1.º
  function _indicadorPrincipal(eq) {
    var disp = _indicadoresDisp(eq);
    var esc = disp.filter(function(i) { return i.campo === _indRel; })[0];
    return esc || disp[0];
  }

  // Botões de escolha do indicador
  function _chipsInd(eq) {
    var disp = _indicadoresDisp(eq);
    if (disp.length <= 1) return '';
    var atual = _indicadorPrincipal(eq).campo;
    var s = '<div class="rchips">';
    disp.forEach(function(i) {
      s += '<button class="rchip' + (i.campo === atual ? ' active' : '') +
           '" onclick="Relatorios.setInd(\'' + i.campo + '\')">' + esc(i.label) + '</button>';
    });
    s += '</div>';
    return s;
  }

  function setInd(c) { _indRel = c; _rerender(); }

  var MESES_C = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function _labelTipoVisita(t) {
    var m = { escola:'Escola', familia:'Família', grupo:'Grupo', particular:'Particular',
              instituicao:'Instituição', empresa:'Empresa', outro:'Outro' };
    return m[t] || t;
  }

  function _fdataC(iso) {
    if (!iso) return '—';
    var s = String(iso).slice(0, 10).split('-');
    if (s.length !== 3) return '—';
    return s[2] + '/' + s[1] + '/' + s[0];
  }

  function setEqRel(v) { _eqRel = v; _rerender(); }
  function recarregar() { _globaisEstado = null; _rerender(); }

  // ── RELATÓRIO MENSAL IMPRIMÍVEL ───────────────────────────
  function imprimirMensal(eqId) {
    var eq = getEq(eqId);
    if (!eq) { toast('Equipamento não encontrado.', 'error'); return; }
    if (_globaisEstado !== 'ok') { toast('Os dados ainda estão a carregar.', 'error'); return; }
    _print(_repEqMensal(eq));
  }

  function _repEqMensal(eq) {
    var mes  = APP.repMes || null;
    var d    = _indicadores(eq.id, mes);
    var tipo = getTipo(eq.tipo_id);

    var h = _cabecalho('Relatório de Actividade — ' + eq.nome, tipo ? tipo.nome : '');

    // Quadro de indicadores
    h += '<div class="pr-sec">Indicadores do período</div>';
    h += '<div class="pr-kpis">';
    if (modAtivo(eq, 'estadias')) {
      h += _kpi(d.dormidas, 'Dormidas');
      h += _kpi(d.estadias, 'Estadias');
      h += _kpi(d.hospedes, 'Hóspedes');
    }
    if (modAtivo(eq, 'visitas')) {
      h += _kpi(d.visitantes, 'Visitantes');
      h += _kpi(d.visitas, 'Grupos');
    }
    if (modAtivo(eq, 'reservas'))  h += _kpi(d.reservas, 'Reservas');
    if (modAtivo(eq, 'checklist')) h += _kpi(d.checklists, 'Checklists');
    h += _kpi(d.memosAb, 'Reparações abertas');
    h += _kpi(d.memosCo, 'Reparações concluídas');
    h += '</div>';

    // ── Gráficos de evolução, LADO A LADO ──
    var disp = _indicadoresDisp(eq);
    h += '<div class="pr-sec">Evolução mensal · ' + (APP.anoTrabalho || new Date().getFullYear()) + '</div>';
    h += '<div class="pr-charts" style="grid-template-columns:repeat(' + disp.length + ',1fr);">';
    disp.forEach(function(i) {
      var serie = [];
      for (var m = 1; m <= 12; m++) {
        serie.push({ l: MESES_C[m - 1], v: _indicadores(eq.id, m)[i.campo] || 0, destaque: (mes === m) });
      }
      h += '<div class="pr-chart"><div class="pr-chart-t">' + esc(i.label) + '</div>' +
           _chartBarras(serie, i.cor, true) + '</div>';
    });
    h += '</div>';

    // ── Repartição (donut) ──
    if (modAtivo(eq, 'visitas') && d.visitas) {
      var porTipo = {};
      d.visitasL.forEach(function(v) {
        var t = v.tipo_visitante || 'outro';
        porTipo[t] = (porTipo[t] || 0) + _pessoasReg(v);
      });
      var paleta = [CORES.azul, CORES.teal, CORES.ambar, CORES.roxo, CORES.verde, CORES.vermelho];
      var dd = Object.keys(porTipo).map(function(k, i2) {
        return { l: _labelTipoVisita(k), v: porTipo[k], c: paleta[i2 % paleta.length] };
      }).sort(function(a, b) { return b.v - a.v; });
      h += '<div class="pr-bloco"><div class="pr-sec">Visitantes por tipo</div>' +
           '<div class="pr-chart">' + _chartDonut(dd) + '</div></div>';
    }

    if (modAtivo(eq, 'estadias') && d.estadias) {
      var ad = 0, cr = 0;
      d.estadiasL.forEach(function(e) {
        ad += parseInt(e.n_adultos, 10) || 0;
        cr += parseInt(e.n_criancas, 10) || 0;
      });
      h += '<div class="pr-bloco"><div class="pr-sec">Hóspedes por escalão</div>' +
           '<div class="pr-chart">' +
           _chartDonut([{ l: 'Adultos', v: ad, c: CORES.azul }, { l: 'Crianças', v: cr, c: CORES.ambar }]) +
           '</div></div>';
    }

    // Reparações — só as do período, para não estourar a página
    var memosP = (APP.memos || []).filter(function(m) {
      return m.equipamento_id === eq.id && _noPeriodo(m.created_at);
    });
    if (memosP.length) {
      h += '<div class="pr-bloco"><div class="pr-sec">Reparações e memorandos (' + memosP.length + ')</div>';
      h += '<table class="pr-table"><thead><tr><th>Data</th><th>Assunto</th><th>Estado</th></tr></thead><tbody>';
      memosP.slice(0, 12).forEach(function(m) {
        h += '<tr><td>' + _fdataC(m.created_at) + '</td><td>' + esc(m.assunto || m.titulo || '—') + '</td>' +
             '<td>' + (m.estado === 'concluido' ? 'Concluído' : 'Em curso') + '</td></tr>';
      });
      h += '</tbody></table>';
      if (memosP.length > 12) {
        h += '<div class="pr-meta2">… e mais ' + (memosP.length - 12) + '. Lista completa no módulo Memorandos.</div>';
      }
      h += '</div>';
    }

    return h + _rodape();
  }

  function _print(body) {
    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = body;
    window.print();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init() {}

  return {
    render: render, init: init, setTab: setTab, setMes: setMes,
    setPeriodo: setPeriodo, setEqFiltro: setEqFiltro,
    exportarMemos: exportarMemos, exportarOcupacao: exportarOcupacao,
    imprimir: imprimir, imprimirFuncionarios: imprimirFuncionarios,
    imprimirEq: imprimirEq, imprimirEqSel: imprimirEqSel, imprimirExtrato: imprimirExtrato,
    setEqRel: setEqRel, setInd: setInd, recarregar: recarregar, imprimirMensal: imprimirMensal
  };

})();

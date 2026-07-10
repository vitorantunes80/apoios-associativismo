// ============================================================
// GestDDS — relatorios.js  v5.2
// Relatórios e Indicadores — memorandos + ocupação de reservas
// ============================================================

var Relatorios = (function() {

  var _periodo = 'semana'; // dia | semana | mes | ano
  var _eqFiltro = null;    // null = todos

  function render() {
    // funcionário não acede
    if (APP.isFuncionario()) {
      return '<div class="dash-greeting"><div><div class="dash-hello" style="font-size:18px;">Relatórios</div></div></div>' + accessDenied();
    }

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Relatórios e Indicadores</div>';
    html += '<div class="dash-sub">Actividade e ocupação da divisão.</div></div>';
    html += '</div>';

    // filtros
    html += _renderFiltros();

    // ocupação (números de pessoas nas reservas)
    html += _renderOcupacao();

    // lista de funcionários (imprimível)
    html += _renderListaFuncionarios();

    // memorandos
    html += _renderStatsGlobais();
    html += _renderMemoStats();
    html += _renderPorEquipamento();

    return html;
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
    var memos = APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); });
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
    var memos = APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); });
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
      var memos = APP.memos.filter(function(m) { return m.equipamento_id === eq.id; });
      var ab    = memos.filter(function(m) { return m.estado !== 'concluido'; }).length;
      var co    = memos.filter(function(m) { return m.estado === 'concluido'; }).length;
      var res   = (APP.reservas||[]).filter(function(r){ return r.equipamento_id === eq.id && r.estado !== 'cancelada'; }).length;
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
    var memos = APP.isDds() ? APP.memos : APP.memos.filter(function(m){ return m.equipamento_id === (APP.user&&APP.user.equipamento_id); });
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
    h += '<div class="rep-grp"><div class="rep-grp-t">Funcionários (' + nFunc + ')</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'\')">Toda a DDS</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'funcionarios\',\'UDAJ\')">UDAJ</button>';
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

    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha de Operação (módulos, espaços, reservas, escala)</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_op\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    h += '<div class="rep-grp"><div class="rep-grp-t">Ficha de Manutenção (memorandos, checklists)</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'UASE\')">UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'ficha_man\',\'UDAJ\')">UDAJ</button>';
    h += '</div>';

    // Memorandos
    h += '<div class="rep-grp"><div class="rep-grp-t">Memorandos (' + nMemo + ')</div>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'memorandos\',\'\')">Todos</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimir(\'memorandos\',\'ativos\')">Só em aberto</button>';
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
    else return;

    var root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = body;
    window.print();
  }
  // manter compatibilidade com o botão antigo
  function imprimirFuncionarios(ambito) { imprimir('funcionarios', ambito); }

  function _cabecalho(titulo, sub) {
    var hoje = new Date();
    var d = ('0' + hoje.getDate()).slice(-2) + '/' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '/' + hoje.getFullYear();
    var h = '<div class="pr-head">';
    h += '<div class="pr-org">Município de Cabeceiras de Basto · Divisão de Desenvolvimento Social</div>';
    h += '<div class="pr-title">' + esc(titulo) + '</div>';
    h += '<div class="pr-meta">' + (sub ? esc(sub) + ' · ' : '') + 'Emitido em ' + d + '</div>';
    h += '</div>';
    return h;
  }
  function _rodape() {
    return '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';
  }

  // RESUMO EXECUTIVO
  function _repResumo() {
    var U = APP.utilizadores, E = APP.equipamentos, M = APP.memos;
    var fUase = U.filter(function(u){ return u.unidade === 'UASE'; }).length;
    var fUdaj = U.filter(function(u){ return u.unidade === 'UDAJ'; }).length;
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
    h += _kpi(U.length, 'Funcionários');
    h += _kpi(E.length, 'Equipamentos');
    h += _kpi(M.length, 'Memorandos');
    h += _kpi(taxa + '%', 'Taxa de conclusão');
    h += '</div>';

    h += '<div class="pr-sec">Recursos por unidade</div>';
    h += '<table class="pr-table"><thead><tr><th>Unidade</th><th>Funcionários</th><th>Equipamentos</th></tr></thead><tbody>';
    h += '<tr><td>UASE</td><td>' + fUase + '</td><td>' + eUase + '</td></tr>';
    h += '<tr><td>UDAJ</td><td>' + fUdaj + '</td><td>' + eUdaj + '</td></tr>';
    var fSem = U.length - fUase - fUdaj, eSem = E.length - eUase - eUdaj;
    if (fSem || eSem) h += '<tr><td>Sem unidade atribuída</td><td>' + fSem + '</td><td>' + eSem + '</td></tr>';
    h += '<tr class="pr-tot"><td>Total</td><td>' + U.length + '</td><td>' + E.length + '</td></tr>';
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
    if (unidade) lista = lista.filter(function(u){ return u.unidade === unidade; });
    lista.sort(function(a, b) {
      var ua = (a.unidade || 'zzz'), ub = (b.unidade || 'zzz');
      if (ua !== ub) return ua.localeCompare(ub);
      return (a.nome || '').localeCompare(b.nome || '');
    });
    var h = _cabecalho('Lista de Funcionários', unidade ? ('Unidade ' + unidade) : 'Toda a DDS');
    h += '<div class="pr-meta2">' + lista.length + ' funcionários</div>';
    h += '<table class="pr-table">';
    h += '<colgroup><col style="width:4%"><col style="width:28%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:15%"><col style="width:15%"></colgroup>';
    h += '<thead><tr>';
    ['#', 'Nome', 'Nº Mec.', 'Unidade', 'Função', 'Categoria', 'Vínculo'].forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    lista.forEach(function(u, i) {
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(u.nome) + '</td><td>' + esc(u.num_mecanografico || '—') + '</td><td>' + esc(u.unidade || '—') + '</td><td>' + esc(u.funcao || '—') + '</td><td>' + esc(u.categoria || '—') + '</td><td>' + esc(u.vinculo || '—') + '</td></tr>';
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
    h += '<colgroup><col style="width:4%"><col style="width:26%"><col style="width:18%"><col style="width:10%"><col style="width:20%"><col style="width:11%"><col style="width:6%"><col style="width:5%"></colgroup>';
    h += '<thead><tr>';
    ['#', 'Equipamento', 'Tipo', 'Unidade', 'Responsável', 'Estado', 'Capac.', 'Esp.'].forEach(function(c){ h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    lista.forEach(function(e, i) {
      var tipo = getTipo(e.tipo_id);
      var resp = e.responsavel_id ? (APP.utilizadores.filter(function(u){ return u.id === e.responsavel_id; })[0] || {}).nome : null;
      var nEsp = (APP.espacos || []).filter(function(x){ return x.equipamento_id === e.id; }).length;
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(e.nome) + '</td><td>' + esc(tipo ? tipo.nome : '—') + '</td><td>' + esc(e.unidade || '—') + '</td><td>' + esc(resp || '—') + '</td><td>' + esc(estadoLbl[e.estado] || e.estado || '—') + '</td><td>' + esc(e.capacidade || '—') + '</td><td>' + nEsp + '</td></tr>';
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
    h += '<div><b>Capacidade:</b> ' + esc(e.capacidade || '—') + '</div>';
    if (e.morada || e.localidade) h += '<div><b>Morada:</b> ' + esc([e.morada, e.localidade].filter(Boolean).join(', ')) + '</div>';
    if (e.telefone) h += '<div><b>Telefone:</b> ' + esc(e.telefone) + '</div>';
    h += '</div>';

    if (mostraOp) {
      var modsOn = MOD_DEFS.filter(function(m){ return modAtivo(e, m.k); });
      h += '<div class="pr-sec">Módulos activos</div>';
      h += modsOn.length ? '<div>' + modsOn.map(function(m){ return '<span class="pr-badge">' + esc(m.l) + '</span>'; }).join('') + '</div>' : '<div class="pr-empty">Nenhum módulo activo.</div>';

      var espacos = (APP.espacos || []).filter(function(x){ return x.equipamento_id === e.id; }).sort(function(a, b){ return (a.ordem || 0) - (b.ordem || 0); });
      h += '<div class="pr-sec">Espaços / Valências (' + espacos.length + ')</div>';
      h += espacos.length ? '<div>' + espacos.map(function(x){ return '<span class="pr-badge">' + esc(x.nome) + '</span>'; }).join('') + '</div>' : '<div class="pr-empty">Sem espaços registados.</div>';

      var reservas = (APP.reservas || []).filter(function(r){ return r.equipamento_id === e.id; });
      h += '<div class="pr-sec">Reservas (' + reservas.length + ')</div>';
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

      var turnos = (APP.escalas || []).filter(function(t){ return t.equipamento_id === e.id; }).sort(function(a, b){ return new Date(b.data_inicio || 0) - new Date(a.data_inicio || 0); });
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
      var memos = (APP.memos || []).filter(function(m){ return m.equipamento_id === e.id; }).sort(function(a, b){ return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
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
    var lista = APP.memos.slice();
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init() {}

  return {
    render: render, init: init,
    setPeriodo: setPeriodo, setEqFiltro: setEqFiltro,
    exportarMemos: exportarMemos, exportarOcupacao: exportarOcupacao,
    imprimir: imprimir, imprimirFuncionarios: imprimirFuncionarios
  };

})();

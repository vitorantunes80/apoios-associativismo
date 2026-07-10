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

  // ── LISTA DE FUNCIONÁRIOS (imprimível) ────────────────────
  function _renderListaFuncionarios() {
    var total = APP.utilizadores.length;
    var nUase = APP.utilizadores.filter(function(u){ return u.unidade === 'UASE'; }).length;
    var nUdaj = APP.utilizadores.filter(function(u){ return u.unidade === 'UDAJ'; }).length;

    var h = '<div class="card" style="margin-top:16px;">';
    h += '<div class="sec-head"><div class="sec-title" style="font-size:14px;">Lista de Funcionários</div></div>';
    h += '<p style="font-size:12.5px;color:var(--text-3);margin:2px 0 12px;line-height:1.5;">' + total + ' funcionários registados na DDS · UASE: ' + nUase + ' · UDAJ: ' + nUdaj + '. Escolha o âmbito e imprima (ou guarde como PDF).</p>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
    h += '<button class="btn btn-primary btn-sm" onclick="Relatorios.imprimirFuncionarios(\'\')">🖨️ Toda a DDS</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimirFuncionarios(\'UASE\')">Imprimir UASE</button>';
    h += '<button class="btn btn-ghost btn-sm" onclick="Relatorios.imprimirFuncionarios(\'UDAJ\')">Imprimir UDAJ</button>';
    h += '</div></div>';
    return h;
  }

  function imprimirFuncionarios(unidade) {
    var lista = APP.utilizadores.slice();
    if (unidade) lista = lista.filter(function(u){ return u.unidade === unidade; });
    lista.sort(function(a, b) {
      var ua = (a.unidade || 'zzz'), ub = (b.unidade || 'zzz');
      if (ua !== ub) return ua.localeCompare(ub);
      return (a.nome || '').localeCompare(b.nome || '');
    });

    var root = document.getElementById('print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-root';
      document.body.appendChild(root);
    }
    root.innerHTML = _htmlImpressao(lista, unidade);
    window.print();
  }

  function _htmlImpressao(lista, unidade) {
    var hoje = new Date();
    var dataStr = ('0' + hoje.getDate()).slice(-2) + '/' + ('0' + (hoje.getMonth() + 1)).slice(-2) + '/' + hoje.getFullYear();
    var ambito = unidade ? ('Unidade ' + unidade) : 'Divisão de Desenvolvimento Social';

    var h = '<div class="pr-head">';
    h += '<div class="pr-org">Município de Cabeceiras de Basto</div>';
    h += '<div class="pr-title">Lista de Funcionários — ' + esc(ambito) + '</div>';
    h += '<div class="pr-meta">Emitido em ' + dataStr + ' · ' + lista.length + ' funcionários</div>';
    h += '</div>';

    h += '<table class="pr-table"><thead><tr>';
    ['#', 'Nome', 'Nº Mec.', 'Unidade', 'Função', 'Categoria', 'Vínculo'].forEach(function(c) {
      h += '<th>' + c + '</th>';
    });
    h += '</tr></thead><tbody>';
    lista.forEach(function(u, i) {
      h += '<tr>';
      h += '<td>' + (i + 1) + '</td>';
      h += '<td>' + esc(u.nome) + '</td>';
      h += '<td>' + esc(u.num_mecanografico || '—') + '</td>';
      h += '<td>' + esc(u.unidade || '—') + '</td>';
      h += '<td>' + esc(u.funcao || '—') + '</td>';
      h += '<td>' + esc(u.categoria || '—') + '</td>';
      h += '<td>' + esc(u.vinculo || '—') + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '<div class="pr-foot">GestDDS · Divisão de Desenvolvimento Social · Município de Cabeceiras de Basto</div>';
    return h;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init() {}

  return {
    render: render, init: init,
    setPeriodo: setPeriodo, setEqFiltro: setEqFiltro,
    exportarMemos: exportarMemos, exportarOcupacao: exportarOcupacao,
    imprimirFuncionarios: imprimirFuncionarios
  };

})();

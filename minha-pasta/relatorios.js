// ============================================================
// GestDDS — relatorios.js  v5.1
// Módulo de Relatórios e Indicadores
// ============================================================

var Relatorios = (function() {

  // ── RENDER ────────────────────────────────────────────────
  function render() {
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Relatórios e Indicadores</div>';
    html += '<div class="dash-sub">Resumos de actividade da divisão.</div></div>';
    html += '</div>';

    // Stats globais
    html += _renderStatsGlobais();

    // Memorandos por estado
    html += _renderMemoStats();

    // Por equipamento
    html += _renderPorEquipamento();

    return html;
  }

  function _renderStatsGlobais() {
    var total   = APP.memos.length;
    var concl   = APP.memos.filter(function(m) { return m.estado === 'concluido'; }).length;
    var abertos = total - concl;
    var reforcos = APP.memos.filter(function(m) { return m.num_reforcos > 0; }).length;
    var txConcl  = total ? Math.round(concl / total * 100) : 0;

    var html = '<div class="stats-grid" style="margin-bottom:20px;">';
    html += _sCard('si-blue',   abertos,  'Memorandos abertos',   'Em curso');
    html += _sCard('si-green',  concl,    'Memorandos concluídos','Taxa: ' + txConcl + '%');
    html += _sCard('si-amber',  reforcos, 'Com reforços',         'Pedidos de reforço');
    html += _sCard('si-purple', APP.equipamentos.filter(function(e){return e.estado==='ativo';}).length, 'Equipamentos activos', 'Em funcionamento');
    html += '</div>';
    return html;
  }

  function _renderMemoStats() {
    // Agrupar por mês
    var porMes = {};
    APP.memos.forEach(function(m) {
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
    html += '<thead><tr><th>Mês</th><th>Total</th><th>Concluídos</th><th>Com reforço</th><th>Taxa conclusão</th></tr></thead><tbody>';

    keys.forEach(function(k) {
      var m    = porMes[k];
      var pct  = m.total ? Math.round(m.concl / m.total * 100) : 0;
      var data = new Date(k + '-01');
      var lbl  = data.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      var cor  = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
      html += '<tr>';
      html += '<td class="td-p">' + H(lbl) + '</td>';
      html += '<td class="td-mono">' + m.total + '</td>';
      html += '<td><span style="color:var(--green);font-weight:600;">' + m.concl + '</span></td>';
      html += '<td>' + (m.reforco ? '<span style="color:var(--red);font-weight:600;">' + m.reforco + '</span>' : '<span class="td-m">0</span>') + '</td>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;">';
      html += '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;"><div style="width:' + pct + '%;height:100%;background:' + cor + ';border-radius:3px;"></div></div>';
      html += '<span style="font-weight:700;color:' + cor + ';font-size:12px;min-width:36px;">' + pct + '%</span>';
      html += '</div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _renderPorEquipamento() {
    if (!APP.equipamentos.length) return '';

    var html = '<div class="sec-head"><div class="sec-title">Actividade por equipamento</div></div>';
    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Equipamento</th><th>Tipo</th><th>Memos abertos</th><th>Memos concluídos</th><th>Reforços</th><th>Estado</th></tr></thead><tbody>';

    APP.equipamentos.forEach(function(eq) {
      var tipo  = getTipo(eq.tipo_id);
      var memos = APP.memos.filter(function(m) { return m.equipamento_id === eq.id; });
      var ab    = memos.filter(function(m) { return m.estado !== 'concluido'; }).length;
      var co    = memos.filter(function(m) { return m.estado === 'concluido'; }).length;
      var re    = memos.filter(function(m) { return m.num_reforcos > 0; }).length;

      html += '<tr>';
      html += '<td class="td-p">' + H(eq.nome) + '</td>';
      html += '<td><span style="background:var(--teal-bg);color:var(--teal);font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;">' + H(tipo ? tipo.nome : '—') + '</span></td>';
      html += '<td>' + (ab ? '<span style="color:var(--amber);font-weight:600;">' + ab + '</span>' : '<span class="td-m">0</span>') + '</td>';
      html += '<td>' + (co ? '<span style="color:var(--green);font-weight:600;">' + co + '</span>' : '<span class="td-m">0</span>') + '</td>';
      html += '<td>' + (re ? '<span style="color:var(--red);font-weight:600;">' + re + '</span>' : '<span class="td-m">0</span>') + '</td>';
      html += '<td>' + badgeEqEstado(eq.estado) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _sCard(ic, val, label, sub) {
    return '<div class="stat-card"><div class="stat-ic ' + ic + '"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>' +
      '<div class="stat-body"><div class="stat-lbl">' + H(label) + '</div><div class="stat-val">' + val + '</div><div class="stat-sub">' + H(sub) + '</div></div></div>';
  }

  // ── EXPORTAR CSV ──────────────────────────────────────────
  function exportarMemos() {
    var linhas = ['Número,Descrição,Brigada,Equipamento,Data,Estado,Dias,Reforços'];
    APP.memos.forEach(function(m) {
      var eq = m.equipamento_id ? getEq(m.equipamento_id) : null;
      var d  = diasDesde(m.created_at);
      linhas.push([
        m.numero || '',
        '"' + (m.descricao || '').replace(/"/g,'""') + '"',
        m.brigada || '',
        eq ? '"' + eq.nome + '"' : '',
        fData(m.created_at),
        m.estado || '',
        d,
        m.num_reforcos || 0
      ].join(','));
    });
    _downloadCSV(linhas.join('\n'), 'memorandos_' + new Date().toISOString().split('T')[0] + '.csv');
    toast('Exportado com sucesso.', 'success');
  }

  function _downloadCSV(content, filename) {
    var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function init() {}

  return { render: render, init: init, exportarMemos: exportarMemos };

})();

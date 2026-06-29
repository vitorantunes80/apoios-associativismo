// ============================================================
// GestDDS — funcionarios.js
// Módulo de Funcionários (escalas, afectações, fichas)
// ============================================================

var Funcionarios = (function() {

  function render(subview) {
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Funcionários</div>';
    html += '<div class="dash-sub">Gestão de funcionários, afectações e escalas.</div></div>';
    html += '</div>';

    // Se tivermos dados de utilizadores com perfil funcionário, mostrar
    var funcs = APP.utilizadores.filter(function(u) {
      return u.perfil === 'funcionario' || u.perfil === 'responsavel' || u.perfil === 'professor_responsavel';
    });

    if (!funcs.length) {
      return html + '<div class="mod-ph" style="margin-top:24px;">' +
        '<div class="mod-ph-t">Funcionários</div>' +
        '<div class="mod-ph-s">Gestão completa de funcionários com fichas individuais, afectações a equipamentos, escalas de turnos e gestão de férias será desenvolvida na próxima fase.</div>' +
        '<span class="wip-badge">Em desenvolvimento</span>' +
        '</div>';
    }

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Nome</th><th>Perfil</th><th>Equipamento afecto</th></tr></thead>';
    html += '<tbody>';
    funcs.forEach(function(u) {
      var eq = u.equipamento_id ? getEq(u.equipamento_id) : null;
      var pal = PERFIL_PALETTES[u.perfil] || ['#F1F5F9','#475569'];
      html += '<tr>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;">';
      html += '<div style="width:28px;height:28px;border-radius:50%;background:' + pal[0] + ';color:' + pal[1] + ';font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + iniciais(u.nome) + '</div>';
      html += '<span class="td-p">' + H(u.nome) + '</span></div></td>';
      html += '<td><span class="bdg" style="background:' + pal[0] + ';color:' + pal[1] + ';">' + H((u.perfil || '').replace(/_/g,' ')) + '</span></td>';
      html += '<td class="td-m">' + H(eq ? eq.nome : '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function init() {}

  return { render: render, init: init };

})();

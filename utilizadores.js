// ============================================================
// GestDDS — utilizadores.js
// Módulo de Utilizadores e perfis de acesso
// ============================================================

var Utilizadores = (function() {

  function render(subview) {
    if (!APP.isDds()) return accessDenied();

    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">Utilizadores</div>';
    html += '<div class="dash-sub">Gestão de contas e perfis de acesso à plataforma.</div></div>';
    html += '</div>';

    if (!APP.utilizadores.length) {
      return html + emptyState('Sem utilizadores', 'Nenhum utilizador registado na base de dados.');
    }

    html += '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Utilizador</th><th>Nome</th><th>Perfil</th><th>Equipamento</th><th>Estado</th></tr></thead>';
    html += '<tbody>';

    APP.utilizadores.forEach(function(u) {
      var pal = PERFIL_PALETTES[u.perfil] || ['#F1F5F9','#475569'];
      var ini = iniciais(u.nome);
      var eq  = u.equipamento_id ? getEq(u.equipamento_id) : null;

      html += '<tr>';
      html += '<td><div style="display:flex;align-items:center;gap:8px;">';
      html += '<div style="width:30px;height:30px;border-radius:50%;background:' + pal[0] + ';color:' + pal[1] + ';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ini + '</div>';
      html += '<span class="td-mono">' + H(u.username) + '</span></div></td>';
      html += '<td class="td-p">' + H(u.nome) + '</td>';
      html += '<td><span class="bdg" style="background:' + pal[0] + ';color:' + pal[1] + ';">' + H((u.perfil || '').replace(/_/g,' ')) + '</span></td>';
      html += '<td class="td-m">' + H(eq ? eq.nome : (u.isDds ? 'DDS — acesso global' : '—')) + '</td>';
      html += '<td>' + (u.ativo !== false ? '<span class="bdg bdg-ativo"><span class="bdg-dot"></span>Activo</span>' : '<span class="bdg bdg-inativo">Inactivo</span>') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function init() {}

  return { render: render, init: init };

})();

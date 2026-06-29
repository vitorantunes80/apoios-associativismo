// ============================================================
// GestDDS — avisos.js  v5.1
// Painel de notificações / avisos
// ============================================================

var Avisos = (function() {

  var _avisos = [];
  var _polling = null;

  // ── CARREGAR ──────────────────────────────────────────────
  function carregar() {
    if (!APP.user || !APP.user.id) return Promise.resolve();

    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRx.test(APP.user.id)) return Promise.resolve();

    return sbGet('avisos', 'destinatario_id=eq.' + APP.user.id + '&order=created_at.desc&limit=50')
      .then(function(data) {
        _avisos = Array.isArray(data) ? data : [];
        _updateBadge();
      })
      .catch(function() {
        _avisos = [];
      });
  }

  function _updateBadge() {
    var naoLidos = _avisos.filter(function(a) { return !a.lido; }).length;
    var badge = document.getElementById('sino-badge');
    if (badge) {
      badge.textContent = naoLidos;
      badge.style.display = naoLidos > 0 ? 'flex' : 'none';
    }
    var count = document.getElementById('avisos-count');
    if (count) {
      count.textContent = naoLidos;
      count.style.display = naoLidos > 0 ? 'inline-block' : 'none';
    }
  }

  // ── ABRIR PAINEL ──────────────────────────────────────────
  function abrir() {
    var overlay = document.getElementById('avisos-overlay');
    var panel   = document.getElementById('avisos-panel');
    if (overlay) overlay.classList.add('open');
    if (panel)   panel.classList.add('open');

    carregar().then(function() { _renderBody(); });
  }

  function fechar() {
    var overlay = document.getElementById('avisos-overlay');
    var panel   = document.getElementById('avisos-panel');
    if (overlay) overlay.classList.remove('open');
    if (panel)   panel.classList.remove('open');
  }

  // ── RENDER BODY ───────────────────────────────────────────
  function _renderBody() {
    var body = document.getElementById('avisos-body');
    if (!body) return;

    if (!_avisos.length) {
      body.innerHTML = '<div class="avisos-empty"><div class="avisos-empty-ic">🔔</div><div class="avisos-empty-t">Sem notificações</div><div class="avisos-empty-s">Não tem avisos pendentes.</div></div>';
      return;
    }

    var naoLidos = _avisos.filter(function(a) { return !a.lido; });
    var lidos    = _avisos.filter(function(a) { return a.lido; });

    var html = '';

    if (naoLidos.length) {
      html += '<div class="avisos-section-label">Não lidos — ' + naoLidos.length + '</div>';
      naoLidos.forEach(function(a) {
        html += _avisoItem(a, true);
      });
    }

    if (lidos.length) {
      html += '<div class="avisos-section-label" style="margin-top:4px;">Histórico</div>';
      lidos.forEach(function(a) {
        html += _avisoItem(a, false);
      });
    }

    body.innerHTML = html;
  }

  function _avisoItem(a, naoLido) {
    var tempo = _tempoRelativo(a.created_at);
    return '<div class="aviso-item' + (naoLido ? ' nao-lido' : '') + '" onclick="Avisos.marcarLido(\'' + a.id + '\')">' +
      '<div class="aviso-ic"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></div>' +
      '<div class="aviso-body">' +
        '<div class="aviso-titulo">' + H(a.titulo || 'Aviso') + '</div>' +
        '<div class="aviso-msg">' + H(a.mensagem || '') + '</div>' +
        '<div class="aviso-tempo">' + tempo + '</div>' +
      '</div>' +
      (naoLido ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>' : '') +
    '</div>';
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function marcarLido(id) {
    sbPatch('avisos', 'id=eq.' + id, { lido: true }).then(function() {
      // actualizar localmente
      _avisos.forEach(function(a) { if (a.id === id) a.lido = true; });
      _updateBadge();
      _renderBody();
    }).catch(function() {});
  }

  function marcarTodosLidos() {
    var naoLidos = _avisos.filter(function(a) { return !a.lido; });
    if (!naoLidos.length) return;

    var ids = naoLidos.map(function(a) { return a.id; }).join(',');
    sbPatch('avisos', 'id=in.(' + ids + ')', { lido: true }).then(function() {
      _avisos.forEach(function(a) { a.lido = true; });
      _updateBadge();
      _renderBody();
      toast('Todos os avisos marcados como lidos.', 'success');
    }).catch(function() {
      toast('Erro ao actualizar avisos.', 'error');
    });
  }

  // ── TEMPO RELATIVO ────────────────────────────────────────
  function _tempoRelativo(dateStr) {
    if (!dateStr) return '—';
    var diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60)   return 'Agora mesmo';
    if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd atrás';
    return fData(dateStr);
  }

  // ── POLLING ───────────────────────────────────────────────
  // verifica novos avisos a cada 60 segundos
  function _startPolling() {
    if (_polling) clearInterval(_polling);
    _polling = setInterval(function() {
      carregar();
    }, 60000);
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    carregar().then(function() {
      _startPolling();
    });
  }

  return {
    init: init,
    abrir: abrir,
    fechar: fechar,
    carregar: carregar,
    marcarLido: marcarLido,
    marcarTodosLidos: marcarTodosLidos
  };

})();

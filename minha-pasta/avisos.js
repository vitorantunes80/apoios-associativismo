// ============================================================
// GestDDS — avisos.js  v5.1
// Painel de notificações / avisos
// ============================================================

var Avisos = (function() {

  var _avisos = [];
  var _polling = null;
  var _modo = 'notificacao'; // 'notificacao' (sino) | 'mensagem' (envelope)

  // ── CARREGAR ──────────────────────────────────────────────
  function carregar() {
    if (!APP.user || !APP.user.id) return Promise.resolve();

    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRx.test(APP.user.id)) return Promise.resolve();

    return sbGet('avisos', 'destinatario_id=eq.' + APP.user.id + '&order=created_at.desc&limit=100')
      .then(function(data) {
        _avisos = Array.isArray(data) ? data : [];
        _updateBadge();
      })
      .catch(function() {
        _avisos = [];
      });
  }

  function _ehMensagem(a) { return a.tipo === 'mensagem'; }
  function _ehNotificacao(a) { return a.tipo !== 'mensagem'; }

  function _updateBadge() {
    // sino = notificações não lidas
    var notNaoLidas = _avisos.filter(function(a) { return !a.lido && _ehNotificacao(a); }).length;
    var sino = document.getElementById('sino-badge');
    if (sino) {
      sino.textContent = notNaoLidas;
      sino.style.display = notNaoLidas > 0 ? 'flex' : 'none';
    }
    // envelope = mensagens não lidas
    var msgNaoLidas = _avisos.filter(function(a) { return !a.lido && _ehMensagem(a); }).length;
    var env = document.getElementById('msg-badge');
    if (env) {
      env.textContent = msgNaoLidas;
      env.style.display = msgNaoLidas > 0 ? 'flex' : 'none';
    }
  }

  // ── ABRIR PAINÉIS ─────────────────────────────────────────
  function abrir() { _abrirModo('notificacao'); }        // sino
  function abrirMensagens() { _abrirModo('mensagem'); }  // envelope

  function _abrirModo(modo) {
    _modo = modo;
    var overlay = document.getElementById('avisos-overlay');
    var panel   = document.getElementById('avisos-panel');
    if (overlay) overlay.classList.add('open');
    if (panel)   panel.classList.add('open');

    // título do painel
    var titulo = document.getElementById('avisos-title');
    if (titulo) titulo.textContent = modo === 'mensagem' ? 'Mensagens' : 'Notificações';

    // botão nova mensagem só no modo mensagem e para admin/DDS
    var btn = document.getElementById('btn-nova-msg');
    if (btn) btn.style.display = (modo === 'mensagem' && (APP.isAdmin() || APP.isDds())) ? 'inline-flex' : 'none';

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

    // filtrar conforme o modo aberto
    var lista = _avisos.filter(_modo === 'mensagem' ? _ehMensagem : _ehNotificacao);

    if (!lista.length) {
      var ic = _modo === 'mensagem' ? '✉️' : '🔔';
      var t  = _modo === 'mensagem' ? 'Sem mensagens' : 'Sem notificações';
      var s  = _modo === 'mensagem' ? 'Não tem mensagens.' : 'Não tem avisos pendentes.';
      body.innerHTML = '<div class="avisos-empty"><div class="avisos-empty-ic">' + ic + '</div><div class="avisos-empty-t">' + t + '</div><div class="avisos-empty-s">' + s + '</div></div>';
      return;
    }

    var naoLidos = lista.filter(function(a) { return !a.lido; });
    var lidos    = lista.filter(function(a) { return a.lido; });

    var html = '';
    if (naoLidos.length) {
      html += '<div class="avisos-section-label">Não lidos — ' + naoLidos.length + '</div>';
      naoLidos.forEach(function(a) { html += _avisoItem(a, true); });
    }
    if (lidos.length) {
      html += '<div class="avisos-section-label" style="margin-top:4px;">Histórico</div>';
      lidos.forEach(function(a) { html += _avisoItem(a, false); });
    }
    body.innerHTML = html;
  }

  function _avisoItem(a, naoLido) {
    var tempo = _tempoRelativo(a.created_at);
    var remetente = a.remetente_nome ? '<span style="font-weight:600;color:var(--accent);">' + H(a.remetente_nome) + '</span> · ' : '';
    var html = '<div class="aviso-item' + (naoLido ? ' nao-lido' : '') + '">';
    html += '<div class="aviso-ic"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></div>';
    html += '<div class="aviso-body">';
    html += '<div class="aviso-titulo">' + H(a.titulo || 'Aviso') + '</div>';
    html += '<div class="aviso-msg">' + H(a.mensagem || '') + '</div>';
    html += '<div class="aviso-tempo">' + remetente + tempo + '</div>';
    if (naoLido) {
      html += '<button class="btn btn-primary btn-sm" style="margin-top:8px;font-size:11.5px;padding:5px 12px;" onclick="event.stopPropagation();Avisos.marcarLido(\'' + a.id + '\')">✓ Tomei conhecimento</button>';
    } else {
      html += '<div style="margin-top:6px;font-size:11px;color:var(--green);font-weight:600;">✓ Lido</div>';
    }
    html += '</div>';
    if (naoLido) html += '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>';
    html += '</div>';
    return html;
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

  // ── COMPOR E ENVIAR MENSAGENS (admin/DDS) ─────────────────
  function openCompor() {
    if (!APP.isAdmin() && !APP.isDds()) {
      toast('Sem permissão para enviar mensagens.', 'error');
      return;
    }
    // popular destinatários
    var sel = document.getElementById('msg-destino');
    if (sel) {
      sel.innerHTML = '';
      sel.innerHTML += '<option value="__todos">📢 Todos os utilizadores</option>';
      // por equipamento
      APP.equipamentos.forEach(function(eq) {
        sel.innerHTML += '<option value="eq:' + eq.id + '">🏢 ' + H(eq.nome) + ' (equipa)</option>';
      });
      // individuais
      sel.innerHTML += '<option value="" disabled>──────────</option>';
      APP.utilizadores.forEach(function(u) {
        if (u.id === APP.user.id) return;
        sel.innerHTML += '<option value="user:' + u.id + '">👤 ' + H(u.nome) + '</option>';
      });
    }
    var t = document.getElementById('msg-titulo'); if (t) t.value = '';
    var m = document.getElementById('msg-texto'); if (m) m.value = '';
    openModal('m-nova-msg');
  }

  function enviar() {
    var destino = (document.getElementById('msg-destino') || {}).value || '';
    var titulo  = (document.getElementById('msg-titulo') || {}).value || '';
    var texto   = (document.getElementById('msg-texto') || {}).value || '';

    if (!titulo.trim()) { toast('Escreva um título.', 'error'); return; }
    if (!texto.trim())  { toast('Escreva a mensagem.', 'error'); return; }
    if (!destino)       { toast('Escolha o destinatário.', 'error'); return; }

    // determinar lista de destinatários
    var destinatarios = [];
    if (destino === '__todos') {
      destinatarios = APP.utilizadores.filter(function(u){ return u.id !== APP.user.id; }).map(function(u){ return u.id; });
    } else if (destino.indexOf('eq:') === 0) {
      var eqId = destino.slice(3);
      destinatarios = APP.utilizadores.filter(function(u){ return u.equipamento_id === eqId && u.id !== APP.user.id; }).map(function(u){ return u.id; });
    } else if (destino.indexOf('user:') === 0) {
      destinatarios = [destino.slice(5)];
    }

    // nunca enviar a si próprio
    destinatarios = destinatarios.filter(function(uid) { return uid !== APP.user.id; });

    if (!destinatarios.length) { toast('Sem destinatários para este envio.', 'error'); return; }

    // criar um aviso por destinatário
    var envios = destinatarios.map(function(uid) {
      return sbPost('avisos', {
        destinatario_id: uid,
        titulo: titulo.trim(),
        mensagem: texto.trim(),
        lido: false,
        tipo: 'mensagem',
        remetente_id: APP.user.id,
        remetente_nome: APP.user.nome
      });
    });

    Promise.all(envios).then(function() {
      toast('Mensagem enviada a ' + destinatarios.length + ' destinatário(s).', 'success');
      closeModal('m-nova-msg');
    }).catch(function() {
      toast('Erro ao enviar mensagem.', 'error');
    });
  }

  // HTML do modal de composição (injectado no boot)
  function _modalHTML() {
    var html = '<div class="modal-bd" id="m-nova-msg">';
    html += '<div class="modal" style="max-width:480px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div><div><div class="modal-title">Nova mensagem</div><div class="modal-sub">Enviar aviso aos utilizadores</div></div><button class="modal-close" onclick="closeModal(\'m-nova-msg\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="fi"><label class="fl">Para</label><select id="msg-destino" class="fin"></select></div>';
    html += '<div class="fi"><label class="fl">Título</label><input type="text" id="msg-titulo" class="fin" placeholder="Assunto da mensagem"></div>';
    html += '<div class="fi"><label class="fl">Mensagem</label><textarea id="msg-texto" class="fin" rows="4" placeholder="Escreva a sua mensagem..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-nova-msg\')">Cancelar</button><button class="btn btn-primary" onclick="Avisos.enviar()">Enviar mensagem</button></div>';
    html += '</div></div>';
    return html;
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    // injectar modal de composição
    var host = document.getElementById('modals-host') || document.body;
    if (host && !document.getElementById('m-nova-msg')) {
      var div = document.createElement('div');
      div.innerHTML = _modalHTML();
      host.appendChild(div.firstChild);
    }
    carregar().then(function() {
      _startPolling();
    });
  }

  return {
    init: init,
    abrir: abrir,
    abrirMensagens: abrirMensagens,
    fechar: fechar,
    carregar: carregar,
    marcarLido: marcarLido,
    marcarTodosLidos: marcarTodosLidos,
    openCompor: openCompor,
    enviar: enviar
  };

})();

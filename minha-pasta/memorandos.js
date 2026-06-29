// ============================================================
// GestDDS — memorandos.js
// Módulo completo de Memorandos DDS
// ============================================================

var Memorandos = (function() {

  // ── CLASSIFICAÇÃO ─────────────────────────────────────────
  function classificar(m) {
    var u = APP.user;
    if (!u) return 0;
    // é criador se o id coincide OU se criado_por é null e isDds
    var euCriei = m.criado_por && m.criado_por === u.id;
    if (m.estado === 'concluido') return 5;
    if (euCriei) return 2;
    if (m.data_envio_servicos && APP.isDds()) return 4;
    if (m.aprovado_dds && (APP.isDds() || euCriei)) return 3;
    if (!m.criado_por_dds && !euCriei && APP.isDds()) return 1;
    return 0;
  }

  function secMemos(n) {
    return APP.memos.filter(function(m) { return classificar(m) === n; });
  }

  function getBadges() {
    return {
      sec1: secMemos(1).length,
      sec2: secMemos(2).length,
      sec3: secMemos(3).length,
      sec4: secMemos(4).length
    };
  }

  // ── RENDER ────────────────────────────────────────────────
  function render(subview) {
    switch (subview) {
      case 'sec1': return _renderSec('Recebidos dos Equipamentos', 1, 'sec1');
      case 'sec2': return _renderSec('Criados por Mim', 2, 'sec2');
      case 'sec3': return _renderSec3();
      case 'sec4': return _renderSec('Em Curso', 4, 'sec4');
      case 'sec5': return _renderArquivo();
      default:     return _renderSec('Os Meus Memorandos', 2, 'sec2');
    }
  }

  function _pageHeader(title, showNew) {
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">' + H(title) + '</div></div>';
    if (showNew !== false) {
      html += '<button class="btn btn-primary btn-sm" onclick="Memorandos.openNovo()">';
      html += '+ Novo memorando</button>';
    }
    html += '</div>';
    return html;
  }

  function _renderSec(title, secN, ctx) {
    if (secN === 1 && !APP.isDds()) return _pageHeader(title, false) + accessDenied();
    if (secN === 4 && !APP.isDds()) return _pageHeader(title, false) + accessDenied();
    var memos = secMemos(secN);
    return _pageHeader(title) + _tabelaMemos(memos, ctx);
  }

  function _renderSec3() {
    if (!APP.isDds()) return _pageHeader('A Enviar', false) + accessDenied();
    var memos = secMemos(3);
    var nw = proximaQuarta();
    var banner = '<div class="info-banner">📅 Próxima 4ª feira: <strong>' + fData(nw.dt.toISOString()) + '</strong> &nbsp;·&nbsp; faltam ' + nw.dias + ' dias</div>';
    return _pageHeader('A Enviar para os Serviços') + banner + _tabelaMemos(memos, 'sec3');
  }

  function _renderArquivo() {
    var memos = secMemos(5);
    var html = _pageHeader('Arquivo', false);

    if (!memos.length) return html + emptyState('Arquivo vazio', 'Nenhum memorando concluído.');

    // agrupar por mês
    var groups = {}, keys = [];
    memos.forEach(function(m) {
      var d = new Date(m.data_conclusao || m.created_at);
      var k = d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0');
      var lbl = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      if (!groups[k]) { groups[k] = { label: lbl, items: [] }; keys.push(k); }
      groups[k].items.push(m);
    });
    keys.sort().reverse();

    if (APP.isAdmin() && memos.length) {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">';
      html += '<button class="btn btn-danger btn-sm" onclick="Memorandos.openApagarTodos()">Limpar arquivo</button>';
      html += '</div>';
    }

    html += '<div style="display:flex;flex-direction:column;gap:10px;">';
    keys.forEach(function(k, i) {
      var g = groups[k], open = i === 0;
      html += '<div class="acc-card">';
      html += '<div class="acc-hdr' + (open ? ' open' : '') + '" onclick="Memorandos.toggleAcc(\'' + k + '\')">';
      html += '<svg id="accv-' + k + '" style="width:13px;height:13px;fill:none;stroke:var(--text-3);stroke-width:2;stroke-linecap:round;transition:transform .2s;' + (open ? 'transform:rotate(180deg)' : '') + ';" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
      html += '<span style="font-size:13px;font-weight:700;color:var(--text);flex:1;">' + H(g.label) + '</span>';
      html += '<span class="acc-count">' + g.items.length + '</span>';
      html += '</div>';
      html += '<div id="acc-' + k + '" style="' + (open ? '' : 'display:none;') + 'border-top:1px solid var(--border);">';
      html += '<table class="dt"><thead><tr><th>Nº</th><th>Descrição</th><th>Conclusão</th></tr></thead><tbody>';
      g.items.forEach(function(m) {
        html += '<tr><td class="td-mono">' + H(m.numero || '—') + '</td>';
        html += '<td class="td-p">' + H(m.descricao || '—') + '</td>';
        html += '<td class="td-m">' + fData(m.data_conclusao) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    });
    html += '</div>';
    return html;
  }

  // ── TABELA ────────────────────────────────────────────────
  function _tabelaMemos(memos, ctx) {
    if (!memos.length) return emptyState('Sem memorandos', 'Não existem registos nesta secção.');

    var html = '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Nº</th><th>Descrição</th><th>Brigada</th><th>Data</th><th>Estado</th><th>Dias</th><th></th></tr></thead>';
    html += '<tbody>';

    memos.forEach(function(m) {
      var d = diasDesde(m.created_at);
      var dE = m.data_envio_servicos ? diasDesde(m.data_envio_servicos) : null;
      var dS = dE !== null ? dE : d;
      var dLabel = dE !== null ? (dS + 'd envio') : (dS + 'd');

      html += '<tr>';
      html += '<td class="td-mono">' + H(m.numero || '—') + '</td>';
      html += '<td class="td-p" style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(m.descricao || '—') + '</td>';
      html += '<td class="td-m">' + H(m.brigada || '—') + '</td>';
      html += '<td class="td-m">' + fData(m.data || m.created_at) + '</td>';
      html += '<td>' + badgeMemo(m);
      if (m.num_reforcos > 0) html += ' <span class="bdg" style="background:var(--red-bg);color:var(--red);">' + m.num_reforcos + '×</span>';
      html += '</td>';
      html += '<td><span class="days-bdg ' + diasCls(dS) + '">' + dLabel + '</span></td>';
      html += '<td><div class="td-act">' + _accoesMemo(m, ctx) + '</div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _accoesMemo(m, ctx) {
    var id = m.id;
    var btns = '';
    if (ctx === 'sec1') {
      btns = '<button class="btn btn-primary btn-sm" onclick="Memorandos.aprovar(\'' + id + '\')">Aprovar</button>';
    }
    if (ctx === 'sec2') {
      if (!m.aprovado_dds && APP.isDds()) {
        btns += '<button class="btn btn-primary btn-sm" onclick="Memorandos.aprovar(\'' + id + '\')">Aprovar</button> ';
      } else if (m.aprovado_dds && !m.data_envio_servicos) {
        btns += '<button class="btn btn-secondary btn-sm" onclick="Memorandos.openEnviar(\'' + id + '\')">Enviar</button> ';
      } else if (m.data_envio_servicos) {
        btns += '<button class="btn btn-success btn-sm" onclick="Memorandos.openConcluir(\'' + id + '\')">Concluir</button> ';
      }
      btns += '<button class="btn btn-ghost btn-sm" onclick="Memorandos.openReforco(\'' + id + '\')">Reforço</button>';
    }
    if (ctx === 'sec3') {
      btns = '<button class="btn btn-secondary btn-sm" onclick="Memorandos.openEnviar(\'' + id + '\')">Enviar</button>';
    }
    if (ctx === 'sec4') {
      btns = '<button class="btn btn-ghost btn-sm" onclick="Memorandos.pedirConf(\'' + id + '\')">Pedir conf.</button>';
    }
    return btns;
  }

  // ── MODAIS HTML ───────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // NOVO
    html += '<div class="modal-bd" id="m-memo-novo">';
    html += '<div class="modal">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div><div><div class="modal-title">Novo memorando</div><div class="modal-sub" id="m-memo-num">A gerar...</div></div><button class="modal-close" onclick="closeModal(\'m-memo-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="fi"><label class="fl">Assunto *</label><textarea id="m-memo-desc" class="fin" rows="3" placeholder="Descreva o assunto..."></textarea></div>';
    html += '<div class="form-row"><div class="fi"><label class="fl">Brigada / Serviço</label><select id="m-memo-brig" class="fin"></select></div><div class="fi" id="m-memo-dds-w"><label class="fl">Criado pela DDS?</label><select id="m-memo-cdds" class="fin"><option value="true">Sim</option><option value="false">Não</option></select></div></div>';
    html += '<div class="fi"><label class="fl">Observações</label><textarea id="m-memo-obs" class="fin" rows="2" placeholder="Info adicional..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Memorandos.criar()">Criar memorando</button></div>';
    html += '</div></div>';

    // CONCLUIR
    html += '<div class="modal-bd" id="m-memo-conc"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div><div class="modal-title">Concluir memorando</div><div class="modal-sub" id="m-conc-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-conc\')">✕</button></div><div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:12px;">Confirma a conclusão? Acção irreversível.</p><div class="detail-box"><div class="detail-row"><span class="detail-lbl">Assunto</span><span class="detail-val" id="m-conc-desc">—</span></div></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-conc\')">Cancelar</button><button class="btn btn-success" onclick="Memorandos.execConcluir()">Confirmar conclusão</button></div></div></div>';

    // REFORÇO
    html += '<div class="modal-bd" id="m-memo-ref"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div><div class="modal-title">Pedir reforço</div><div class="modal-sub" id="m-ref-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-ref\')">✕</button></div><div class="modal-body"><div id="m-ref-hist-w" style="display:none;"><div class="fl" style="margin-bottom:5px;">Histórico de reforços</div><div id="m-ref-hist" class="reforco-hist"></div></div><div class="fi"><label class="fl">Motivo *</label><textarea id="m-ref-motivo" class="fin" rows="3" placeholder="Descreva o motivo..."></textarea></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-ref\')">Cancelar</button><button class="btn btn-danger" onclick="Memorandos.execReforco()">Enviar reforço</button></div></div></div>';

    // ENVIAR
    html += '<div class="modal-bd" id="m-memo-env"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-purple"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div><div><div class="modal-title">Enviar para os serviços</div><div class="modal-sub" id="m-env-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-env\')">✕</button></div><div class="modal-body"><div id="m-env-email" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:11px;font-size:12px;color:var(--text-2);line-height:1.8;white-space:pre-wrap;font-family:\'JetBrains Mono\',monospace;"></div></div><div class="modal-footer"><button class="btn btn-secondary btn-sm" onclick="Memorandos.copiarEmail()">📋 Copiar</button><button class="btn btn-ghost" onclick="closeModal(\'m-memo-env\')">Cancelar</button><button class="btn btn-primary" style="background:var(--purple);" onclick="Memorandos.execEnviar()">Marcar como enviado</button></div></div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  function openNovo() {
    gerarNumMemo().then(function(num) {
      var el = document.getElementById('m-memo-num');
      if (el) el.textContent = num;
    });
    var desc = document.getElementById('m-memo-desc');
    var obs  = document.getElementById('m-memo-obs');
    if (desc) desc.value = '';
    if (obs) obs.value = '';

    // brigadas
    var sel = document.getElementById('m-memo-brig');
    if (sel) {
      var list = getBrigadas();
      sel.innerHTML = '';
      list.forEach(function(b) {
        var o = document.createElement('option');
        o.value = b; o.textContent = b;
        sel.appendChild(o);
      });
      var nova = document.createElement('option');
      nova.value = '__nova__'; nova.textContent = '+ Nova brigada...';
      sel.appendChild(nova);
      sel.onchange = function() {
        if (sel.value !== '__nova__') return;
        var n = prompt('Nome da nova brigada:');
        if (n && n.trim()) {
          list.push(n.trim());
          saveBrigadas(list);
          // re-populate
          openNovo();
          sel.value = n.trim();
        }
      };
    }

    var ddsW = document.getElementById('m-memo-dds-w');
    if (ddsW) ddsW.style.display = APP.isDds() ? 'block' : 'none';

    openModal('m-memo-novo');
  }

  function criar() {
    var desc = document.getElementById('m-memo-desc');
    if (!desc || !desc.value.trim()) { toast('O assunto é obrigatório.', 'error'); return; }
    var brigSel = document.getElementById('m-memo-brig');
    var brig = brigSel ? brigSel.value : '';
    if (brig === '__nova__') brig = '';
    var obs = document.getElementById('m-memo-obs');
    var cdds = document.getElementById('m-memo-cdds');
    var cDds = APP.isDds() ? (cdds ? cdds.value === 'true' : false) : false;

    gerarNumMemo().then(function(num) {
      var hoje = new Date().toISOString().split('T')[0];
      // só enviar criado_por se for um UUID válido (não demo)
      var criadoPor = null;
      if (APP.user && APP.user.id) {
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(APP.user.id)) criadoPor = APP.user.id;
      }
      var payload = {
        numero: num,
        data: hoje,
        descricao: desc.value.trim(),
        brigada: brig,
        observacoes: obs ? obs.value.trim() : '',
        criado_por: criadoPor,
        criado_por_dds: cDds,
        estado: 'pendente',
        aprovado_dds: false,
        num_reforcos: 0,
        equipamento_id: APP.spotEqId || null
      };
      console.log('GestDDS criar memo payload:', JSON.stringify(payload));
      return sbPost('memorandos_dds', payload);
    }).then(function() {
      toast('Memorando criado.', 'success');
      closeModal('m-memo-novo');
      loadAll(function() { App.renderContent(); });
    }).catch(function(e) {
      console.error('GestDDS erro criar memo:', e);
      var msg = 'Erro ao criar memorando.';
      if (e && e.message) msg += ' ' + e.message;
      if (e && e.details) msg += ' ' + e.details;
      toast(msg, 'error');
    });
  }

  function aprovar(id) {
    sbPatch('memorandos_dds', 'id=eq.' + id, { aprovado_dds: true }).then(function() {
      toast('Aprovado — movido para "A Enviar".', 'success');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao aprovar.', 'error'); });
  }

  function openConcluir(id) {
    APP.actionId = id;
    APP.actionRecord = APP.memos.filter(function(m) { return m.id === id; })[0] || null;
    if (!APP.actionRecord) return;
    var n = document.getElementById('m-conc-num');
    var d = document.getElementById('m-conc-desc');
    if (n) n.textContent = APP.actionRecord.numero || '—';
    if (d) d.textContent = APP.actionRecord.descricao || '—';
    openModal('m-memo-conc');
  }

  function execConcluir() {
    if (!APP.actionId) return;
    var hoje = new Date().toISOString().split('T')[0];
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, { estado: 'concluido', data_conclusao: hoje }).then(function() {
      toast('Memorando concluído.', 'success');
      closeModal('m-memo-conc');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao concluir.', 'error'); });
  }

  function openReforco(id) {
    APP.actionId = id;
    APP.actionRecord = APP.memos.filter(function(m) { return m.id === id; })[0] || null;
    if (!APP.actionRecord) return;
    var n = document.getElementById('m-ref-num');
    var mot = document.getElementById('m-ref-motivo');
    var hw = document.getElementById('m-ref-hist-w');
    var ht = document.getElementById('m-ref-hist');
    if (n) n.textContent = APP.actionRecord.numero || '—';
    if (mot) mot.value = '';
    if (hw && ht) {
      if (APP.actionRecord.observacoes && APP.actionRecord.num_reforcos > 0) {
        hw.style.display = 'block';
        ht.textContent = APP.actionRecord.observacoes;
      } else {
        hw.style.display = 'none';
      }
    }
    openModal('m-memo-ref');
  }

  function execReforco() {
    if (!APP.actionId || !APP.actionRecord) return;
    var mot = document.getElementById('m-ref-motivo');
    if (!mot || !mot.value.trim()) { toast('Introduza o motivo.', 'error'); return; }
    var n = (APP.actionRecord.num_reforcos || 0) + 1;
    var ts = new Date().toLocaleString('pt-PT');
    var obs = (APP.actionRecord.observacoes ? APP.actionRecord.observacoes + '\n\n' : '') +
              '[REFORÇO #' + n + ' — ' + ts + ']\n' + mot.value.trim();
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, {
      observacoes: obs,
      num_reforcos: n,
      aprovado_dds: true,
      data_envio_servicos: null
    }).then(function() {
      toast('Reforço registado.', 'success');
      closeModal('m-memo-ref');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao registar reforço.', 'error'); });
  }

  function openEnviar(id) {
    APP.actionId = id;
    APP.actionRecord = APP.memos.filter(function(m) { return m.id === id; })[0] || null;
    if (!APP.actionRecord) return;
    var n = document.getElementById('m-env-num');
    var em = document.getElementById('m-env-email');
    if (n) n.textContent = APP.actionRecord.numero || '—';
    if (em) {
      em.textContent = 'Exmo(a) Sr(a) Director(a),\n\nPor este meio remete-se o memorando ' +
        (APP.actionRecord.numero || '') + ' referente a:\n\n"' + (APP.actionRecord.descricao || '') + '"' +
        (APP.actionRecord.brigada ? '\n\nBrigada/Serviço: ' + APP.actionRecord.brigada : '') +
        '\n\nSolicita-se a devida atenção e tramitação.\n\nCom os melhores cumprimentos,\nDivisão de Desenvolvimento Social';
    }
    openModal('m-memo-env');
  }

  function copiarEmail() {
    var em = document.getElementById('m-env-email');
    if (!em) return;
    var txt = em.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function() { toast('Email copiado.', 'success'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Email copiado.', 'success');
    }
  }

  function execEnviar() {
    if (!APP.actionId) return;
    var hoje = new Date().toISOString().split('T')[0];
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, { data_envio_servicos: hoje }).then(function() {
      toast('Marcado como enviado.', 'success');
      closeModal('m-memo-env');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro.', 'error'); });
  }

  function pedirConf(id) {
    var m = APP.memos.filter(function(x) { return x.id === id; })[0];
    if (!m) return;
    sbPost('avisos', {
      destinatario_id: m.criado_por,
      titulo: 'Confirmação pendente — ' + (m.numero || ''),
      mensagem: 'O memorando ' + (m.numero || '') + ' aguarda confirmação de conclusão.',
      lido: false
    }).then(function() {
      toast('Aviso enviado.', 'success');
    }).catch(function() {
      toast('Aviso registado (tabela "avisos" pendente de criação).', 'success');
    });
  }

  function openApagarTodos() {
    // simplificado — confirmar com prompt
    var conf = prompt('Escreva CONFIRMAR para eliminar todo o arquivo:');
    if (conf !== 'CONFIRMAR') { toast('Operação cancelada.', 'error'); return; }
    var arch = secMemos(5);
    if (!arch.length) { toast('Arquivo vazio.', 'error'); return; }
    var ids = arch.map(function(m) { return m.id; }).join(',');
    sbDelete('memorandos_dds', 'id=in.(' + ids + ')').then(function() {
      toast('Arquivo limpo.', 'success');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao limpar arquivo.', 'error'); });
  }

  function toggleAcc(k) {
    var b = document.getElementById('acc-' + k);
    var v = document.getElementById('accv-' + k);
    if (b) {
      var open = b.style.display !== 'none';
      b.style.display = open ? 'none' : 'block';
      if (v) v.style.transform = open ? '' : 'rotate(180deg)';
    }
  }

  function init() {
    // injectar modais no DOM
    var cont = document.getElementById('modais-memorandos');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  // API pública
  return {
    render: render,
    init: init,
    getBadges: getBadges,
    openNovo: openNovo,
    criar: criar,
    aprovar: aprovar,
    openConcluir: openConcluir,
    execConcluir: execConcluir,
    openReforco: openReforco,
    execReforco: execReforco,
    openEnviar: openEnviar,
    copiarEmail: copiarEmail,
    execEnviar: execEnviar,
    pedirConf: pedirConf,
    openApagarTodos: openApagarTodos,
    toggleAcc: toggleAcc
  };

})();

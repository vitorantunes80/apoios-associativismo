// ============================================================
// GestDDS — memorandos.js  v5.3
// Fluxo: Os Meus → A Enviar → Em Curso → Arquivo
// ============================================================

var Memorandos = (function() {

  // ── CLASSIFICAÇÃO ─────────────────────────────────────────
  // sec2 — Os Meus:    criados pelo utilizador actual, não concluídos, não enviados
  // sec3 — A Enviar:   aprovados, ainda não enviados (visível a DDS)
  // sec4 — Em Curso:   enviados, não concluídos (visível a DDS)
  // sec5 — Arquivo:    concluídos
  // sec1 — Recebidos:  criados por equipamento, não aprovados (só DDS vê)

  // Cada memo pode pertencer a múltiplas secções em simultâneo.
  // secMemos() filtra pela secção pedida com lógica própria por secção.

  function secMemos(n) {
    var u = APP.user;
    if (!u) return [];
    return APP.memos.filter(function(m) {
      var euCriei = m.criado_por && m.criado_por === u.id;
      // responsável/professor só vê memos do seu equipamento; DDS vê todos
      var meuAmbito = APP.isDds() || euCriei || (u.equipamento_id && m.equipamento_id === u.equipamento_id);

      if (m.estado === 'concluido') {
        // Arquivo — DDS vê todos os concluídos; responsável só os do seu âmbito
        return n === 5 && meuAmbito;
      }

      if (n === 5) return false;

      // sec2 — Os Meus: tudo o que criei, não concluído
      if (n === 2) return euCriei;

      // sec3 — A Enviar: aprovados não enviados (DDS vê todos; inclui os do próprio)
      if (n === 3) return APP.isDds() && m.aprovado_dds && !m.data_envio_servicos;

      // sec4 — Em Curso: enviados não concluídos (DDS vê todos)
      if (n === 4) return APP.isDds() && !!m.data_envio_servicos;

      // sec1 — Recebidos: criados por equipamento, não aprovados (só DDS)
      if (n === 1) return APP.isDds() && !m.criado_por_dds && !m.aprovado_dds && !euCriei;

      return false;
    });
  }

  function getBadges() {
    var u = APP.user;
    if (!u) return { sec1:0, sec2:0, sec3:0, sec4:0 };
    var s1=0, s2=0, s3=0, s4=0;
    APP.memos.forEach(function(m) {
      if (m.estado === 'concluido') return;
      var euCriei = m.criado_por && m.criado_por === u.id;
      if (euCriei) s2++;
      if (APP.isDds()) {
        if (!m.criado_por_dds && !m.aprovado_dds && !euCriei) s1++;
        if (m.aprovado_dds && !m.data_envio_servicos) s3++;
        if (m.data_envio_servicos) s4++;
      }
    });
    return { sec1:s1, sec2:s2, sec3:s3, sec4:s4 };
  }

  // ── RENDER ────────────────────────────────────────────────
  function render(subview) {
    // funcionário simples não acede aos memorandos
    if (!APP.podeCriarMemorandos()) {
      return _pageHeader('Memorandos', false) + accessDenied();
    }
    switch (subview) {
      case 'sec1': return _renderSec1();
      case 'sec2': return _renderSec2();
      case 'sec3': return _renderSec3();
      case 'sec4': return _renderSec4();
      case 'sec5': return _renderArquivo();
      default:     return _renderSec2();
    }
  }

  function _pageHeader(title, showNew) {
    var html = '<div class="dash-greeting">';
    html += '<div><div class="dash-hello" style="font-size:18px;">' + H(title) + '</div></div>';
    if (showNew !== false) {
      html += '<button class="btn btn-primary btn-sm" onclick="Memorandos.openNovo()">+ Novo memorando</button>';
    }
    html += '</div>';
    return html;
  }

  // SEC 1 — Recebidos dos equipamentos (só DDS)
  function _renderSec1() {
    if (!APP.isDds()) return _pageHeader('Recebidos', false) + accessDenied();
    var memos = secMemos(1);
    var html = _pageHeader('Recebidos dos Equipamentos', false);
    if (!memos.length) return html + emptyState('Sem memorandos recebidos', 'Não existem memorandos por aprovar.');
    return html + _tabela(memos, 'sec1');
  }

  // SEC 2 — Os Meus (criados pelo utilizador actual)
  function _renderSec2() {
    var memos = secMemos(2);
    var html = _pageHeader('Os Meus Memorandos');
    if (!memos.length) return html + emptyState('Sem memorandos', 'Crie o primeiro memorando.');
    return html + _tabela(memos, 'sec2');
  }

  // SEC 3 — A Enviar (aprovados, aguardam 4ª feira)
  function _renderSec3() {
    if (!APP.isDds()) return _pageHeader('A Enviar', false) + accessDenied();
    var memos = secMemos(3);
    var nw = proximaQuarta();
    var html = _pageHeader('A Enviar para os Serviços', false);
    html += '<div class="info-banner">📅 Próxima 4ª feira: <strong>' + fData(nw.dt.toISOString()) + '</strong> &nbsp;·&nbsp; faltam ' + nw.dias + ' dia(s)</div>';
    if (!memos.length) return html + emptyState('Sem memorandos a enviar', 'Nenhum memorando aprovado pendente de envio.');

    // acções: preparar o texto para o email (editável antes de copiar)
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">';
    html += '<button class="btn btn-primary btn-sm" onclick="Memorandos.preverEmail()">✉️ Preparar email (' + memos.length + ')</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="Memorandos.copiarDirecto()">📋 Copiar já</button>';
    html += '<span style="font-size:11.5px;color:var(--text-3);">Prepare para rever e editar; ou copie directamente.</span>';
    html += '</div>';

    return html + _tabela(memos, 'sec3');
  }

  // ── Texto para email ──────────────────────────────────────
  function _textoEmail() {
    var memos = secMemos(3);
    var L = [];
    L.push('Exmos. Senhores,');
    L.push('');
    L.push('Junto se remetem os memorandos da Divisão de Desenvolvimento Social para intervenção dos serviços:');
    L.push('');

    // agrupar por brigada, que é como os serviços trabalham
    var porBrig = {};
    memos.forEach(function(m) {
      var b = m.brigada || 'Sem brigada atribuída';
      if (!porBrig[b]) porBrig[b] = [];
      porBrig[b].push(m);
    });

    Object.keys(porBrig).sort().forEach(function(b) {
      L.push('── ' + b.toUpperCase() + ' ──');
      L.push('');
      porBrig[b].forEach(function(m) {
        var eq = m.equipamento_id ? getEq(m.equipamento_id) : null;
        L.push('Local: ' + (eq ? eq.nome : '—'));
        L.push('Descrição: ' + (m.descricao || '—'));
        if (m.observacoes) L.push('Observações: ' + m.observacoes);
        if (m.num_reforcos > 0) L.push('*** REFORÇO (' + m.num_reforcos + '.ª insistência) ***');
        L.push('');
      });
    });

    L.push('Total: ' + memos.length + ' memorando(s).');
    L.push('');
    L.push('Com os melhores cumprimentos,');
    L.push('Divisão de Desenvolvimento Social');
    L.push('Município de Cabeceiras de Basto');

    return L.join('\n');
  }

  function copiarEmail() {
    var memos = secMemos(3);
    if (!memos.length) { toast('Não há memorandos a enviar.', 'error'); return; }

    // Se a caixa de pré-visualização tem texto, é essa que vale —
    // assim respeitamos as alterações feitas à mão.
    var box = document.getElementById('m-email-txt');
    var txt = (box && box.value && box.value.trim()) ? box.value : _textoEmail();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function() {
        toast('Texto copiado. Cole no email.', 'success');
      }).catch(function() {
        _copiarFallback(txt);
      });
    } else {
      _copiarFallback(txt);
    }
  }

  // alternativa: selecciona o texto para o utilizador copiar à mão
  function _copiarFallback(txt) {
    var box = document.getElementById('m-email-txt');
    var modal = document.getElementById('m-memo-email');
    var aberto = modal && modal.classList && modal.classList.contains('open');

    // se a caixa já está à vista, basta seleccioná-la
    if (aberto && box) {
      box.focus();
      box.select();
      var ok1 = false;
      try { ok1 = document.execCommand('copy'); } catch (e) { ok1 = false; }
      toast(ok1 ? 'Texto copiado. Cole no email.' : 'Texto seleccionado — copie com o teclado.', ok1 ? 'success' : 'error');
      return;
    }

    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);

    if (ok) {
      toast('Texto copiado. Cole no email.', 'success');
    } else {
      preverEmail();
      toast('Copie o texto da caixa.', 'error');
    }
  }

  // "Copiar já" — ignora edições anteriores e copia o texto original
  function copiarDirecto() {
    var memos = secMemos(3);
    if (!memos.length) { toast('Não há memorandos a enviar.', 'error'); return; }
    var box = document.getElementById('m-email-txt');
    if (box) box.value = '';           // limpa, para gerar de novo
    copiarEmail();
  }

  function preverEmail() {
    var memos = secMemos(3);
    if (!memos.length) { toast('Não há memorandos a enviar.', 'error'); return; }
    var box = document.getElementById('m-email-txt');
    if (box) box.value = _textoEmail();
    openModal('m-memo-email');
  }

  // repor o texto original, desfazendo as alterações
  function reporEmail() {
    var box = document.getElementById('m-email-txt');
    if (box) box.value = _textoEmail();
    toast('Texto reposto.', 'success');
  }


  // SEC 4 — Em Curso (enviados, aguardam conclusão)
  function _renderSec4() {
    if (!APP.isDds()) return _pageHeader('Em Curso', false) + accessDenied();
    var memos = secMemos(4);
    var html = _pageHeader('Em Curso', false);
    if (!memos.length) return html + emptyState('Sem memorandos em curso', 'Nenhum memorando enviado pendente de conclusão.');
    return html + _tabela(memos, 'sec4');
  }

  // SEC 5 — Arquivo agrupado por mês
  function _renderArquivo() {
    // secMemos(5) já limita ao âmbito do utilizador (DDS vê tudo; os restantes
    // só o seu equipamento). Ler APP.memos directamente expunha os concluídos
    // de todos os equipamentos.
    var memos = secMemos(5);
    var html = _pageHeader('Arquivo', false);

    if (APP.isAdmin() && memos.length) {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">';
      html += '<button class="btn btn-danger btn-sm" onclick="Memorandos.openApagarTodos()">Limpar arquivo</button>';
      html += '</div>';
    }

    if (!memos.length) return html + emptyState('Arquivo vazio', 'Nenhum memorando concluído ainda.');

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

    html += '<div style="display:flex;flex-direction:column;gap:10px;">';
    keys.forEach(function(k, i) {
      var g = groups[k], open = i === 0;
      html += '<div class="acc-card">';
      html += '<div class="acc-hdr" onclick="Memorandos.toggleAcc(\'' + k + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 15px;cursor:pointer;user-select:none;">';
      html += '<svg id="accv-' + k + '" style="width:13px;height:13px;fill:none;stroke:var(--text-3);stroke-width:2;stroke-linecap:round;transition:transform .2s;' + (open ? 'transform:rotate(180deg)' : '') + ';" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
      html += '<span style="font-size:13px;font-weight:700;color:var(--text);flex:1;">' + H(g.label) + '</span>';
      html += '<span class="acc-count">' + g.items.length + '</span>';
      html += '</div>';
      html += '<div id="acc-' + k + '" style="' + (open ? '' : 'display:none;') + 'border-top:1px solid var(--border);">';
      html += _tabela(g.items, 'sec5');
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  // ── TABELA ────────────────────────────────────────────────
  function _tabela(memos, ctx) {
    if (!memos.length) return emptyState('Sem memorandos', 'Não existem registos.');

    var html = '<div class="dtw"><table class="dt">';
    html += '<thead><tr><th>Nº</th><th>Descrição</th><th>Equipamento</th><th>Brigada</th><th>Data</th><th>Estado</th><th>Dias</th><th></th></tr></thead>';
    html += '<tbody>';

    memos.forEach(function(m) {
      var dCriacao = diasDesde(m.created_at);
      var dEnvio   = m.data_envio_servicos ? diasDesde(m.data_envio_servicos) : null;
      // mostrar dias desde envio se enviado, senão desde criação
      var dShow  = dEnvio !== null ? dEnvio : dCriacao;
      var dLabel = dEnvio !== null ? (dShow + 'd envio') : (dShow + 'd');

      html += '<tr>';
      html += '<td class="td-mono">' + H(m.numero || '—') + '</td>';
      html += '<td class="td-p" style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + H(m.descricao || '—') + '</td>';
      var eqMemo = m.equipamento_id ? getEq(m.equipamento_id) : null;
      html += '<td class="td-m">' + H(eqMemo ? eqMemo.nome : '—') + '</td>';
      html += '<td class="td-m">' + H(m.brigada || '—') + '</td>';
      html += '<td class="td-m">' + fData(m.data || m.created_at) + '</td>';
      html += '<td>' + _badgeMemoEstado(m);
      if (m.num_reforcos > 0) html += ' <span class="bdg" style="background:var(--red-bg);color:var(--red);">' + m.num_reforcos + '× reforço</span>';
      html += '</td>';
      html += '<td><span class="days-bdg ' + diasCls(dShow) + '">' + dLabel + '</span></td>';
      html += '<td><div class="td-act">' + _acoes(m, ctx) + '</div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function _badgeMemoEstado(m) {
    if (m.estado === 'concluido')         return '<span class="bdg bdg-concluido"><span class="bdg-dot"></span>Concluído</span>';
    if (m.estado === 'reforco_pedido')    return '<span class="bdg bdg-reforco"><span class="bdg-dot"></span>Reforço</span>';
    if (m.data_envio_servicos)            return '<span class="bdg bdg-andamento"><span class="bdg-dot"></span>Em curso</span>';
    if (m.aprovado_dds)                   return '<span class="bdg bdg-enviado"><span class="bdg-dot"></span>A enviar</span>';
    return '<span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span>';
  }

  // ── ACÇÕES POR SECÇÃO ─────────────────────────────────────
  function _acoes(m, ctx) {
    var id = m.id;
    var isAdmin  = APP.isAdmin();
    var isDds    = APP.isDds();
    var euCriei  = APP.user && m.criado_por === APP.user.id;
    var podeConcluir = euCriei || isAdmin;

    // reforço só disponível 15+ dias após envio
    var diasEnvio = m.data_envio_servicos ? diasDesde(m.data_envio_servicos) : 0;
    var podeReforco = m.data_envio_servicos && diasEnvio >= 15;

    var btns = '';

    // SEC 1 — Recebidos: DDS aprova
    if (ctx === 'sec1') {
      btns += '<button class="btn btn-primary btn-sm" onclick="Memorandos.aprovar(\'' + id + '\')">Aprovar para envio</button>';
      if (isAdmin) btns += ' <button class="btn btn-success btn-sm" onclick="Memorandos.openConcluir(\'' + id + '\')">Concluir</button>';
    }

    // SEC 2 — Os Meus: criador acompanha em todas as fases
    if (ctx === 'sec2') {
      if (!m.aprovado_dds) {
        // Fase 1: pendente, aguarda aprovação DDS
        btns += '<span style="font-size:11.5px;color:var(--text-3);">Aguarda aprovação DDS</span>';
      } else if (!m.data_envio_servicos) {
        // Fase 2: aprovado, aguarda envio na 4ª feira
        btns += '<span style="font-size:11.5px;color:var(--purple);font-weight:600;">✓ Aprovado — a aguardar envio</span>';
      } else if (m.data_envio_servicos && podeConcluir) {
        // Fase 3: enviado, pode concluir
        btns += '<button class="btn btn-success btn-sm" onclick="Memorandos.openConcluir(\'' + id + '\')">Concluir</button>';
      } else if (m.data_envio_servicos) {
        // Fase 3: enviado, sem permissão para concluir
        btns += '<span style="font-size:11.5px;color:var(--text-3);">Enviado — em curso</span>';
      }
      // reforço só após 15 dias do envio
      if (podeReforco) {
        btns += ' <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Memorandos.openReforco(\'' + id + '\')">Reforço</button>';
      }
    }

    // SEC 3 — A Enviar: DDS envia para serviços
    if (ctx === 'sec3') {
      btns += '<button class="btn btn-secondary btn-sm" onclick="Memorandos.openEnviar(\'' + id + '\')">Marcar como enviado</button>';
    }

    // SEC 4 — Em Curso: pode pedir confirmação ou concluir
    if (ctx === 'sec4') {
      if (isDds) btns += '<button class="btn btn-ghost btn-sm" onclick="Memorandos.pedirConf(\'' + id + '\')">Pedir conf.</button> ';
      if (podeConcluir) btns += '<button class="btn btn-success btn-sm" onclick="Memorandos.openConcluir(\'' + id + '\')">Concluir</button>';
      if (podeReforco) btns += ' <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="Memorandos.openReforco(\'' + id + '\')">Reforço</button>';
    }

    return btns;
  }

  // ── MODAIS HTML ───────────────────────────────────────────
  function getModaisHTML() {
    var html = '';

    // NOVO
    // ── Pré-visualização / cópia para email ──
    html += '<div class="modal-bd" id="m-memo-email">';
    html += '<div class="modal" style="max-width:620px;">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>';
    html += '<div><div class="modal-title">Texto para email</div><div class="modal-sub">Memorandos a enviar aos serviços</div></div>';
    html += '<button class="modal-close" onclick="closeModal(\'m-memo-email\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<p style="font-size:12.5px;color:var(--text-2);line-height:1.6;margin:0 0 10px;">Pode <strong>editar o texto</strong> antes de copiar — o botão Copiar leva as suas alterações.</p>';
    html += '<textarea id="m-email-txt" class="fin" rows="16" style="font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.55;"></textarea>';
    html += '</div>';
    html += '<div class="modal-footer">';
    html += '<button class="btn btn-ghost btn-sm" onclick="Memorandos.reporEmail()">Repor original</button>';
    html += '<button class="btn btn-ghost" onclick="closeModal(\'m-memo-email\')">Fechar</button>';
    html += '<button class="btn btn-primary" onclick="Memorandos.copiarEmail()">📋 Copiar</button></div>';
    html += '</div></div>';

    html += '<div class="modal-bd" id="m-memo-novo">';
    html += '<div class="modal">';
    html += '<div class="modal-header"><div class="mh-ic mhi-blue"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div><div><div class="modal-title">Novo memorando</div><div class="modal-sub" id="m-memo-num">A gerar...</div></div><button class="modal-close" onclick="closeModal(\'m-memo-novo\')">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="fi"><label class="fl">Assunto *</label><textarea id="m-memo-desc" class="fin" rows="3" placeholder="Descreva o assunto..."></textarea></div>';
    html += '<div class="form-row">';
    html += '<div class="fi"><label class="fl">Equipamento</label><select id="m-memo-eq" class="fin" onchange="Memorandos.onEqChange()"><option value="">Sem equipamento associado</option></select></div>';
    html += '<div class="fi" id="m-memo-eq-outro-wrap" style="display:none;"><label class="fl">Qual? *</label>';
    html += '<input type="text" id="m-memo-eq-outro" class="fin" placeholder="ex: Centro Hípico — picadeiro coberto">';
    html += '<p style="font-size:11.5px;color:var(--text-3);margin:4px 0 0;line-height:1.4;">Indique o local ou equipamento a que o memorando diz respeito.</p></div>';
    html += '<div class="fi"><label class="fl">Brigada / Serviço</label><select id="m-memo-brig" class="fin"></select></div>';
    html += '</div>';
    html += '<div class="fi"><label class="fl">Observações</label><textarea id="m-memo-obs" class="fin" rows="2" placeholder="Info adicional..."></textarea></div>';
    html += '</div>';
    html += '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-novo\')">Cancelar</button><button class="btn btn-primary" onclick="Memorandos.criar()">Criar memorando</button></div>';
    html += '</div></div>';

    // CONCLUIR
    html += '<div class="modal-bd" id="m-memo-conc"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-green"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div><div class="modal-title">Concluir memorando</div><div class="modal-sub" id="m-conc-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-conc\')">✕</button></div><div class="modal-body"><p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:12px;">Confirma a conclusão? Esta acção é irreversível.</p><div class="detail-box"><div class="detail-row"><span class="detail-lbl">Assunto</span><span class="detail-val" id="m-conc-desc">—</span></div></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-conc\')">Cancelar</button><button class="btn btn-success" onclick="Memorandos.execConcluir()">Confirmar conclusão</button></div></div></div>';

    // REFORÇO
    html += '<div class="modal-bd" id="m-memo-ref"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-red"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div><div class="modal-title">Pedir reforço</div><div class="modal-sub" id="m-ref-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-ref\')">✕</button></div><div class="modal-body"><div id="m-ref-hist-w" style="display:none;"><div class="fl" style="margin-bottom:5px;">Histórico de reforços</div><div id="m-ref-hist" class="reforco-hist"></div></div><div class="fi"><label class="fl">Motivo *</label><textarea id="m-ref-motivo" class="fin" rows="3" placeholder="Descreva o motivo do reforço..."></textarea></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'m-memo-ref\')">Cancelar</button><button class="btn btn-danger" onclick="Memorandos.execReforco()">Enviar reforço</button></div></div></div>';

    // ENVIAR
    html += '<div class="modal-bd" id="m-memo-env"><div class="modal"><div class="modal-header"><div class="mh-ic mhi-purple"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div><div><div class="modal-title">Marcar como enviado</div><div class="modal-sub" id="m-env-num">—</div></div><button class="modal-close" onclick="closeModal(\'m-memo-env\')">✕</button></div><div class="modal-body"><p style="font-size:13px;color:var(--text-3);margin-bottom:10px;">Texto de email gerado automaticamente:</p><div id="m-env-email" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:11px;font-size:12px;color:var(--text-2);line-height:1.8;white-space:pre-wrap;font-family:\'JetBrains Mono\',monospace;"></div></div><div class="modal-footer"><button class="btn btn-secondary btn-sm" onclick="Memorandos.copiarEndereco()">📋 Copiar email</button><button class="btn btn-ghost" onclick="closeModal(\'m-memo-env\')">Cancelar</button><button class="btn btn-primary" style="background:var(--purple);" onclick="Memorandos.execEnviar()">Confirmar envio</button></div></div></div>';

    return html;
  }

  // ── ACÇÕES ────────────────────────────────────────────────
  // mostra o campo de texto quando se escolhe "Outro"
  function onEqChange() {
    var sel = document.getElementById('m-memo-eq');
    var wrap = document.getElementById('m-memo-eq-outro-wrap');
    if (!sel || !wrap) return;
    wrap.style.display = (sel.value === '__outro__') ? 'block' : 'none';
  }

  function openNovo() {
    gerarNumMemo().then(function(num) {
      var el = document.getElementById('m-memo-num');
      if (el) el.textContent = num;
    });
    var desc = document.getElementById('m-memo-desc');
    var obs  = document.getElementById('m-memo-obs');
    if (desc) desc.value = '';
    if (obs)  obs.value  = '';

    // equipamentos — cada perfil só vê aqueles a que tem acesso
    var eqSel = document.getElementById('m-memo-eq');
    if (eqSel) {
      eqSel.innerHTML = '<option value="">Seleccione o equipamento...</option>';

      var eqList = (APP.equipamentos || []).filter(function(e) {
        return APP.podeVerEquipamento(e.id);
      });

      // fallback: se ainda não tem nenhum atribuído, mostra o seu (se existir)
      if (!eqList.length && APP.user && APP.user.equipamento_id) {
        eqList = (APP.equipamentos || []).filter(function(e) { return e.id === APP.user.equipamento_id; });
      }

      eqList.forEach(function(e) {
        var o = document.createElement('option');
        o.value = e.id;
        o.textContent = e.nome;
        // pré-seleccionar o spotlight ou o equipamento do utilizador
        if (e.id === APP.spotEqId || e.id === (APP.user && APP.user.equipamento_id)) {
          o.selected = true;
        }
        eqSel.appendChild(o);
      });

      // "Outro" — para situações fora dos equipamentos a que tem acesso
      var oOutro = document.createElement('option');
      oOutro.value = '__outro__';
      oOutro.textContent = 'Outro (indicar)…';
      eqSel.appendChild(oOutro);

      // esconder o campo de texto livre ao abrir
      var wo = document.getElementById('m-memo-eq-outro-wrap');
      if (wo) wo.style.display = 'none';
      var io = document.getElementById('m-memo-eq-outro');
      if (io) io.value = '';
    }

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
          openNovo();
          setTimeout(function() { sel.value = n.trim(); }, 50);
        }
      };
    }
    openModal('m-memo-novo');
  }

  function criar() {
    var desc = document.getElementById('m-memo-desc');
    if (!desc || !desc.value.trim()) { toast('O assunto é obrigatório.', 'error'); return; }

    // equipamento opcional se não houver nenhum criado ainda

    var brigSel = document.getElementById('m-memo-brig');
    var brig = brigSel ? brigSel.value : '';
    if (brig === '__nova__') brig = '';
    var obs = document.getElementById('m-memo-obs');

    // criado_por_dds = true se o utilizador for DDS
    var cDds = APP.isDds();

    // UUID válido
    var criadoPor = null;
    if (APP.user && APP.user.id) {
      var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRx.test(APP.user.id)) criadoPor = APP.user.id;
    }

    gerarNumMemo().then(function(num) {
      var hoje = new Date().toISOString().split('T')[0];

      // equipamento: pode ser um da lista, "Outro" (texto livre), ou nenhum
      var eqEl  = document.getElementById('m-memo-eq');
      var eqVal = eqEl ? eqEl.value : '';
      var eqId  = null;
      var obsTxt = obs ? obs.value.trim() : '';

      if (eqVal === '__outro__') {
        var outro = (document.getElementById('m-memo-eq-outro') || {}).value || '';
        outro = outro.trim();
        if (!outro) {
          toast('Indique a que equipamento ou local se refere.', 'error');
          throw new Error('__validacao__');
        }
        // não é uma FK válida — fica registado nas observações
        obsTxt = 'Local: ' + outro + (obsTxt ? '\n' + obsTxt : '');
      } else if (eqVal) {
        eqId = eqVal;
      } else {
        eqId = APP.spotEqId || null;
      }

      return sbPost('memorandos_dds', {
        numero:         num,
        data:           hoje,
        descricao:      desc.value.trim(),
        brigada:        brig,
        observacoes:    obsTxt,
        criado_por:     criadoPor,
        criado_por_dds: cDds,
        estado:         'pendente',
        // se criado por DDS, aprovado automaticamente → vai directo para A Enviar
        aprovado_dds:   cDds,
        num_reforcos:   0,
        equipamento_id: eqId
      });
    }).then(function() {
      toast('Memorando criado.', 'success');
      closeModal('m-memo-novo');
      loadAll(function() { App.renderContent(); });
    }).catch(function(e) {
      if (e && e.message === '__validacao__') return;  // já foi avisado
      console.error('Erro criar memo:', e);
      toast('Erro ao criar. ' + (e && e.message ? e.message : ''), 'error');
    });
  }

  function aprovar(id) {
    sbPatch('memorandos_dds', 'id=eq.' + id, { aprovado_dds: true })
      .then(function() {
        toast('Aprovado — movido para "A Enviar".', 'success');
        loadAll(function() { App.renderContent(); });
      })
      .catch(function() { toast('Erro ao aprovar.', 'error'); });
  }

  function openConcluir(id) {
    APP.actionId     = id;
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
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, { estado: 'concluido', data_conclusao: hoje })
      .then(function() {
        toast('Memorando concluído.', 'success');
        closeModal('m-memo-conc');
        loadAll(function() { App.renderContent(); });
      })
      .catch(function() { toast('Erro ao concluir.', 'error'); });
  }

  function openReforco(id) {
    APP.actionId     = id;
    APP.actionRecord = APP.memos.filter(function(m) { return m.id === id; })[0] || null;
    if (!APP.actionRecord) return;

    // verificar 15 dias
    var diasEnvio = APP.actionRecord.data_envio_servicos ? diasDesde(APP.actionRecord.data_envio_servicos) : 0;
    if (diasEnvio < 15) {
      toast('O reforço só está disponível 15 dias após o envio. Faltam ' + (15 - diasEnvio) + ' dias.', 'error');
      return;
    }

    var n   = document.getElementById('m-ref-num');
    var mot = document.getElementById('m-ref-motivo');
    var hw  = document.getElementById('m-ref-hist-w');
    var ht  = document.getElementById('m-ref-hist');
    if (n)   n.textContent = APP.actionRecord.numero || '—';
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
    var n   = (APP.actionRecord.num_reforcos || 0) + 1;
    var ts  = new Date().toLocaleString('pt-PT');
    var obs = (APP.actionRecord.observacoes ? APP.actionRecord.observacoes + '\n\n' : '') +
              '[REFORÇO #' + n + ' — ' + ts + ']\n' + mot.value.trim();
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, {
      observacoes:         obs,
      num_reforcos:        n,
      estado:              'reforco_pedido',
      aprovado_dds:        true,
      data_envio_servicos: null
    }).then(function() {
      toast('Reforço registado — memorando volta para "A Enviar".', 'success');
      closeModal('m-memo-ref');
      loadAll(function() { App.renderContent(); });
    }).catch(function() { toast('Erro ao registar reforço.', 'error'); });
  }

  function openEnviar(id) {
    APP.actionId     = id;
    APP.actionRecord = APP.memos.filter(function(m) { return m.id === id; })[0] || null;
    if (!APP.actionRecord) return;
    var n  = document.getElementById('m-env-num');
    var em = document.getElementById('m-env-email');
    if (n) n.textContent = APP.actionRecord.numero || '—';
    if (em) {
      em.textContent =
        'Exmo(a) Sr(a) Director(a),\n\n' +
        'Por este meio remete-se o memorando ' + (APP.actionRecord.numero || '') +
        ' referente a:\n\n"' + (APP.actionRecord.descricao || '') + '"' +
        (APP.actionRecord.brigada ? '\n\nBrigada/Serviço: ' + APP.actionRecord.brigada : '') +
        '\n\nSolicita-se a devida atenção e tramitação.\n\n' +
        'Com os melhores cumprimentos,\nDivisão de Desenvolvimento Social';
    }
    openModal('m-memo-env');
  }

  // copia o ENDEREÇO de email (no modal "Marcar como enviado")
  function copiarEndereco() {
    var em = document.getElementById('m-env-email');
    if (!em) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(em.textContent).then(function() { toast('Endereço copiado.', 'success'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = em.textContent;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('Endereço copiado.', 'success');
    }
  }

  function execEnviar() {
    if (!APP.actionId) return;
    var hoje = new Date().toISOString().split('T')[0];
    sbPatch('memorandos_dds', 'id=eq.' + APP.actionId, { data_envio_servicos: hoje })
      .then(function() {
        toast('Marcado como enviado — movido para "Em Curso".', 'success');
        closeModal('m-memo-env');
        loadAll(function() { App.renderContent(); });
      })
      .catch(function() { toast('Erro ao marcar como enviado.', 'error'); });
  }

  function pedirConf(id) {
    var m = APP.memos.filter(function(x) { return x.id === id; })[0];
    if (!m) return;
    var uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // destinatário: criador do memorando
    // se criado_por for null (memos antigos), usar o utilizador actual
    var destId = null;
    if (m.criado_por && uuidRx.test(m.criado_por)) {
      destId = m.criado_por;
    } else if (APP.user && APP.user.id && uuidRx.test(APP.user.id)) {
      destId = APP.user.id;
    }

    if (!destId) {
      toast('Não foi possível identificar o destinatário.', 'error');
      return;
    }

    sbPost('avisos', {
      destinatario_id: destId,
      titulo: 'Confirmação pendente — ' + (m.numero || ''),
      mensagem: 'O memorando ' + (m.numero || '') + ' foi enviado para os serviços e aguarda confirmação de conclusão.',
      lido: false
    }).then(function() {
      toast('Aviso enviado.', 'success');
      // actualizar o sino imediatamente
      if (typeof Avisos !== 'undefined') Avisos.carregar();
    }).catch(function() {
      toast('Erro ao enviar aviso.', 'error');
    });
  }

  function openApagarTodos() {
    var conf = prompt('Escreva CONFIRMAR para eliminar todo o arquivo:');
    if (conf !== 'CONFIRMAR') return;
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
    var cont = document.getElementById('modais-memorandos');
    if (cont) cont.innerHTML = getModaisHTML();
  }

  return {
    copiarEmail: copiarEmail, copiarDirecto: copiarDirecto,
    preverEmail: preverEmail, reporEmail: reporEmail,
    onEqChange: onEqChange,
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
    copiarEndereco: copiarEndereco,
    execEnviar: execEnviar,
    pedirConf: pedirConf,
    openApagarTodos: openApagarTodos,
    toggleAcc: toggleAcc
  };

})();

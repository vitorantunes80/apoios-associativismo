// ============================================================
// GestDDS — config.js
// Estado global, Supabase, utilitários partilhados
// ============================================================

var APP_VERSION = 'v5.0';
var SB_URL = 'https://mmhmiuxfhwwalwnegrlg.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1taG1pdXhmaHd3YWx3bmVncmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjI3MTEsImV4cCI6MjA5ODIzODcxMX0.4_AdbI8K-fWXaIB0VOmV2Ld8Kh-pzVU9PypeoGUJdAU';

// ── ESTADO GLOBAL ──────────────────────────────────────────
var APP = {
  user: null,           // row da tabela utilizadores
  view: 'dashboard',    // vista actual
  subview: null,        // sub-vista (ex: 'sec1', 'lista', 'tipos')

  // dados em cache
  memos: [],
  equipamentos: [],
  tiposEq: [],
  utilizadores: [],
  funcionarios: [],
  reservas: [],
  escalas: [],
  espacos: [],
  checklist_templates: [],
  checklist_items: [],
  checklist_registos: [],
  checklist_respostas: [],

  // spotlight no dashboard
  spotEqId: null,

  // ano de trabalho (filtra reservas/escalas/memorandos)
  anoTrabalho: new Date().getFullYear(),

  // acções pendentes (modais)
  actionId: null,
  actionRecord: null,
  editId: null,

  // helpers de perfil
  isDds: function() { return APP.user && APP.user.isDds; },
  isAdmin: function() { return APP.user && APP.user.perfil === 'admin'; },

  // ── ACESSOS PERSONALIZADOS ────────────────────────────────
  // permissoes_extra (jsonb em utilizadores) guarda só excepções:
  //   { "reservas": true }    → forçar acesso (mesmo sem o perfil ter)
  //   { "relatorios": false } → bloquear acesso (mesmo que o perfil tenha)
  //   chave ausente           → segue as regras normais do perfil

  // valor da excepção para um menu (true/false) ou null se não há excepção
  _extraMenu: function(menu) {
    var ex = APP.user && APP.user.permissoes_extra;
    if (!ex || typeof ex !== 'object') return null;
    if (ex[menu] === true) return true;
    if (ex[menu] === false) return false;
    return null;
  },

  // acesso por defeito do perfil a cada menu
  _menuPorPerfil: function(menu) {
    if (!APP.user) return false;
    var p = APP.user.perfil;
    if (p === 'admin') return true;
    switch (menu) {
      case 'memorandos':   return p !== 'funcionario';
      case 'relatorios':   return !!APP.user.isDds || APP.isResponsavel();
      case 'funcionarios': return !!APP.user.isDds || APP.isResponsavel();
      // checklists: responsabilidade de quem gere o equipamento.
      // Um funcionário só acede se lhe for atribuído acesso (permissoes_extra).
      case 'checklists':   return !!APP.user.isDds || APP.isResponsavel();
      case 'utilizadores': return false; // só admin
      default:             return true;  // reservas, escalas, ferias, horas, dashboard
    }
  },

  // FUNÇÃO CENTRAL — sidebar e navegação usam esta
  acessoMenu: function(menu) {
    if (!APP.user) return false;
    if (APP.user.perfil === 'admin') return true; // admin nunca fica bloqueado
    if (menu === 'utilizadores') return false;    // gestão de utilizadores é sempre só admin
    var ex = APP._extraMenu(menu);
    if (ex !== null) return ex;
    return APP._menuPorPerfil(menu);
  },

  // perfil do utilizador actual
  perfil: function() { return APP.user ? APP.user.perfil : null; },

  // é responsável de equipamento (gere o seu equipamento)
  isResponsavel: function() {
    return APP.user && ['responsavel','professor_responsavel'].indexOf(APP.user.perfil) >= 0;
  },
  // é funcionário simples (acesso limitado)
  isFuncionario: function() {
    return APP.user && APP.user.perfil === 'funcionario';
  },

  // ── NÍVEIS DE ACESSO ──────────────────────────────────────
  // vê e gere TUDO na DDS (Admin e Responsável DDS)
  _veTudo: function() {
    if (!APP.user) return false;
    return APP.user.perfil === 'admin' || APP.user.perfil === 'responsavel_dds';
  },
  // unidade de um Chefe de Unidade ('UDAJ' / 'UASE'), ou null
  _unidadeChefe: function() {
    if (!APP.user) return null;
    if (APP.user.perfil === 'supervisor_udaj') return 'UDAJ';
    if (APP.user.perfil === 'supervisor_uase') return 'UASE';
    return null;
  },
  // é responsável (perfil de responsável de equipamento)
  _ehPerfilResponsavel: function() {
    return APP.user && ['responsavel','professor_responsavel'].indexOf(APP.user.perfil) >= 0;
  },
  // este utilizador é responsável POR este equipamento?
  _ehResponsavelDe: function(eqId) {
    if (!APP.user) return false;
    var eq = getEq(eqId);
    if (eq && eq.responsavel_id && eq.responsavel_id === APP.user.id) return true;
    return funcNoEq(APP.user, eqId);
  },
  // o equipamento pertence à unidade do Chefe actual?
  _eqNaMinhaUnidade: function(eqId) {
    var uni = APP._unidadeChefe();
    if (!uni) return false;
    var eq = getEq(eqId);
    return !!(eq && eq.unidade === uni);
  },

  // pode gerir (criar/editar/apagar) um equipamento específico?
  podeGerirEquipamento: function(eqId) {
    if (!APP.user) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    return false; // funcionário não gere
  },

  // pode ver um equipamento específico?
  podeVerEquipamento: function(eqId) {
    if (!APP.user) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    return funcNoEq(APP.user, eqId); // funcionário: os equipamentos onde trabalha
  },

  // pode criar memorandos? (respeita acessos personalizados)
  podeCriarMemorandos: function() {
    if (!APP.user) return false;
    return APP.acessoMenu('memorandos');
  },

  // pode gerir reservas de um equipamento?
  podeGerirReservas: function(eqId) {
    if (!APP.user) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    return false; // funcionário só vê
  },

  // pode gerir escalas de um equipamento?
  podeGerirEscalas: function(eqId) {
    if (!APP.user) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    return false;
  },

  // pode preencher checklists? (funcionário só se lhe for atribuído acesso)
  podePreencherChecklist: function(eqId) {
    if (!APP.user) return false;
    if (!APP.acessoMenu('checklists')) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    // funcionário com acesso atribuído: só nos equipamentos onde trabalha
    return funcNoEq(APP.user, eqId);
  },

  // pode gerir templates de checklist?
  podeGerirTemplates: function(eqId) {
    if (!APP.user) return false;
    if (APP._veTudo()) return true;
    if (APP._unidadeChefe()) return APP._eqNaMinhaUnidade(eqId);
    if (APP._ehPerfilResponsavel()) return APP._ehResponsavelDe(eqId);
    return false;
  },

  // pode gerir utilizadores? (só admin)
  podeGerirUtilizadores: function() {
    return APP.user && APP.user.perfil === 'admin';
  },

  nomeUtilizador: function() {
    if (!APP.user) return 'Utilizador';
    return APP.user.nome || APP.user.username || 'Utilizador';
  },

  // label legível do perfil
  perfilLabel: function() {
    if (!APP.user) return '';
    var labels = {
      admin: 'Administrador',
      responsavel_dds: 'Responsável DDS',
      supervisor_udaj: 'Supervisor UDAJ',
      supervisor_uase: 'Supervisor UASE',
      responsavel: 'Responsável de Equipamento',
      professor_responsavel: 'Professor Responsável',
      funcionario: 'Funcionário'
    };
    return labels[APP.user.perfil] || APP.user.perfil || '';
  }
};

// Autenticação por código — gerida directamente no Supabase
// Login: utilizador introduz o código → app busca na tabela utilizadores

// Cores para equipamentos na sidebar
var EQ_COLORS = ['#3B82F6','#8B5CF6','#F59E0B','#06B6D4','#10B981','#EF4444','#EC4899','#6366F1'];

// Paleta de cores por perfil
var PERFIL_PALETTES = {
  admin:            ['#DBEAFE','#1D4ED8'],
  responsavel_dds:  ['#EDE9FE','#5B21B6'],
  supervisor_udaj:  ['#DCFCE7','#15803D'],
  supervisor_uase:  ['#FEF3C7','#92400E'],
  responsavel:      ['#FEE2E2','#B91C1C'],
  professor_responsavel: ['#FFF7ED','#C2410C'],
  funcionario:      ['#F1F5F9','#475569']
};

// Definições de módulos de equipamento
var MOD_DEFS = [
  { k: 'reservas',     l: 'Reservas',              s: 'Agendamento de utilizações',       c: 'si-blue' },
  { k: 'aulas',        l: 'Aulas / Actividades',   s: 'Programação e horários',            c: 'si-purple' },
  { k: 'escalas',      l: 'Escalas',               s: 'Turnos, folgas e férias',           c: 'si-amber' },
  { k: 'checklist',    l: 'Checklist',             s: 'Inspecções e conformidade',         c: 'si-green' },
  { k: 'funcionarios', l: 'Funcionários Afectos',  s: 'Pessoal associado',                 c: 'si-teal' },
  { k: 'responsavel',  l: 'Responsável',           s: 'Responsável técnico atribuído',     c: 'si-red' },
  { k: 'documentos',   l: 'Documentos',            s: 'Gestão documental e anexos',        c: 'si-teal' }
];

// ── SUPABASE ───────────────────────────────────────────────
function sbHeaders() {
  return {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

// Safari-compatible fetch wrapper
function safeFetch(url, opts) {
  // Safari requer mode:'cors' explícito
  opts = opts || {};
  opts.mode = 'cors';
  opts.credentials = 'omit';
  return fetch(url, opts);
}

function sbGet(table, query) {
  return safeFetch(SB_URL + '/rest/v1/' + table + '?' + (query || ''), {
    method: 'GET',
    headers: sbHeaders()
  }).then(function(r) { return r.json(); });
}

function sbPost(table, body) {
  return safeFetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(body)
  }).then(function(r) {
    if (r.status === 201 || r.ok) return r.json();
    return r.json().then(function(e) { throw e; });
  });
}

function sbPatch(table, filter, body) {
  return safeFetch(SB_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body)
  }).then(function(r) {
    if (r.ok || r.status === 204) return true;
    return r.json().then(function(e) { throw e; });
  });
}

function sbDelete(table, filter) {
  return safeFetch(SB_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE',
    headers: sbHeaders()
  }).then(function(r) {
    if (r.ok || r.status === 204) return true;
    return r.json().then(function(e) { throw e; }).catch(function(e) { throw e; });
  });
}

// ── HELPERS GLOBAIS ────────────────────────────────────────

// Escape HTML
function H(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Dias desde uma data
function diasDesde(d) {
  if (!d) return 0;
  return Math.floor((new Date() - new Date(d)) / 86400000);
}

// Classe CSS para contador de dias
function diasCls(n) {
  return n <= 10 ? 'd-ok' : n <= 21 ? 'd-warn' : 'd-crit';
}

// Formatar data PT
function fData(d) {
  if (!d) return '—';
  var dt = new Date(d);
  return [
    dt.getDate().toString().padStart(2,'0'),
    (dt.getMonth()+1).toString().padStart(2,'0'),
    dt.getFullYear()
  ].join('/');
}

// Próxima 4ª feira
function proximaQuarta() {
  var hoje = new Date();
  var diff = (3 - hoje.getDay() + 7) % 7 || 7;
  return { dt: new Date(hoje.getTime() + diff * 86400000), dias: diff };
}

// Saudação por hora
function saudacao() {
  var h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// Data de hoje formatada por extenso
function hojeExtenso() {
  return new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Iniciais de um nome
function iniciais(nome) {
  return String(nome || '').split(' ').map(function(w) { return w[0]; }).join('').substring(0,2).toUpperCase();
}

// Badge de memorando
function badgeMemo(m) {
  if (m.estado === 'reforco_pedido') return '<span class="bdg bdg-reforco"><span class="bdg-dot"></span>Reforço</span>';
  if (m.data_envio_servicos) return '<span class="bdg bdg-enviado"><span class="bdg-dot"></span>Enviado</span>';
  if (m.aprovado_dds) return '<span class="bdg bdg-andamento"><span class="bdg-dot"></span>A enviar</span>';
  return '<span class="bdg bdg-pendente"><span class="bdg-dot"></span>Pendente</span>';
}

// Badge de equipamento
function badgeEqEstado(estado) {
  if (estado === 'ativo')       return '<span class="bdg bdg-ativo"><span class="bdg-dot"></span>Activo</span>';
  if (estado === 'inativo')     return '<span class="bdg bdg-inativo">Inactivo</span>';
  return '<span class="bdg bdg-andamento"><span class="bdg-dot"></span>Manutenção</span>';
}

// Lookup helpers
function getEq(id) {
  return APP.equipamentos.filter(function(e) { return e.id === id; })[0] || null;
}
// Um funcionário está afecto a este equipamento?
// Conta o equipamento principal E os equipamentos adicionais (equipamentos_extra).
// Um funcionário pode desempenhar funções noutros equipamentos além do seu.
function funcNoEq(u, eqId) {
  if (!u || !eqId) return false;
  if (u.equipamento_id === eqId) return true;
  var extra = u.equipamentos_extra;
  if (Array.isArray(extra)) return extra.indexOf(eqId) >= 0;
  return false;
}

// Todos os funcionários afectos a um equipamento (principal + adicionais)
function funcsDoEq(eqId) {
  return (APP.utilizadores || []).filter(function(u) { return funcNoEq(u, eqId); });
}

// Todos os equipamentos de um funcionário (principal + adicionais)
function eqsDoFunc(u) {
  var ids = [];
  if (!u) return ids;
  if (u.equipamento_id) ids.push(u.equipamento_id);
  if (Array.isArray(u.equipamentos_extra)) {
    u.equipamentos_extra.forEach(function(id) { if (ids.indexOf(id) < 0) ids.push(id); });
  }
  return ids;
}

function getTipo(id) {
  return APP.tiposEq.filter(function(t) { return t.id === id; })[0] || null;
}

// Um módulo (reservas, aulas, escalas, checklist...) está activo num equipamento?
// Prioridade: definição do próprio equipamento (eq.modulos) → definição do tipo.
//   eq.modulos[k] === true  → forçar ligado
//   eq.modulos[k] === false → forçar desligado
//   ausente                 → herda do tipo (mod_<k>)
function modAtivo(eq, k) {
  if (!eq) return false;
  var ov = eq.modulos && typeof eq.modulos === 'object' ? eq.modulos[k] : undefined;
  if (ov === true) return true;
  if (ov === false) return false;
  var tipo = getTipo(eq.tipo_id);
  return !!(tipo && tipo['mod_' + k]);
}

// Chips de módulos activos de um tipo
function modChips(tipo) {
  if (!tipo) return '<span class="td-m">—</span>';
  var chips = '';
  MOD_DEFS.forEach(function(m) {
    if (tipo['mod_' + m.k]) {
      chips += '<span class="chip-mod">' + m.l + '</span>';
    }
  });
  return chips || '<span class="td-m">Sem módulos</span>';
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  var icon = type === 'error'
    ? '<svg class="ti" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : '<svg class="ti" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  el.innerHTML = icon + H(msg);
  var c = document.getElementById('toast-wrap');
  if (c) c.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3400);
}

// ── MODAL ──────────────────────────────────────────────────
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Fechar modal ao clicar no backdrop
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-bd')) {
    e.target.classList.remove('open');
  }
});

// ── CARREGAR DADOS ─────────────────────────────────────────
function mudarAnoTrabalho(ano, cb) {
  APP.anoTrabalho = parseInt(ano, 10) || new Date().getFullYear();
  loadAll(function() {
    if (typeof App !== 'undefined' && App.renderContent) App.renderContent();
    if (cb) cb();
  });
}

function loadAll(cb) {
  var _loadDone = false;

  // Ano de trabalho (por defeito o ano corrente). Filtra as tabelas que crescem.
  var ano = APP.anoTrabalho || new Date().getFullYear();
  var iniAno = ano + '-01-01';
  var fimAno = ano + '-12-31';
  // memorandos usa created_at; reservas/escalas usam data_inicio
  var filtroData = 'data_inicio=gte.' + iniAno + '&data_inicio=lte.' + fimAno;
  var filtroCriado = 'created_at=gte.' + iniAno + '&created_at=lte.' + fimAno + 'T23:59:59';

  Promise.all([
    sbGet('memorandos_dds', filtroCriado + '&order=created_at.desc').then(function(d) {
      APP.memos = Array.isArray(d) ? d : [];
    }).catch(function() { APP.memos = []; }),

    sbGet('equipamentos', 'order=nome.asc').then(function(d) {
      APP.equipamentos = Array.isArray(d) ? d : [];
      // escolher o equipamento em destaque — nunca um a que o utilizador não tem acesso
      var visiveis = APP.equipamentos.filter(function(e) { return APP.podeVerEquipamento(e.id); });
      var atualOk = APP.spotEqId && visiveis.some(function(e) { return e.id === APP.spotEqId; });
      if (!atualOk) {
        // 1º o seu equipamento principal, se o puder ver
        if (APP.user && APP.user.equipamento_id && visiveis.some(function(e) { return e.id === APP.user.equipamento_id; })) {
          APP.spotEqId = APP.user.equipamento_id;
        // 2º um equipamento de que seja responsável
        } else if (APP.user && visiveis.length) {
          var meu = visiveis.filter(function(e) { return e.responsavel_id === APP.user.id; })[0];
          APP.spotEqId = meu ? meu.id : visiveis[0].id;
        } else {
          APP.spotEqId = null;
        }
      }
    }).catch(function() { APP.equipamentos = []; }),

    sbGet('tipos_equipamento', 'order=nome.asc').then(function(d) {
      APP.tiposEq = Array.isArray(d) ? d : [];
    }).catch(function() { APP.tiposEq = []; }),

    sbGet('utilizadores', 'order=nome.asc').then(function(d) {
      APP.utilizadores = Array.isArray(d) ? d : [];
    }).catch(function() { APP.utilizadores = []; }),

    // reservas do ano — mas incluir recorrentes (que podem começar antes)
    sbGet('reservas', 'or=(and(data_inicio.gte.' + iniAno + ',data_inicio.lte.' + fimAno + '),recorrente.eq.true)&order=data_inicio.asc').then(function(d) {
      APP.reservas = Array.isArray(d) ? d : [];
    }).catch(function() {
      // fallback: se o filtro OR falhar, traz só as do ano
      return sbGet('reservas', filtroData + '&order=data_inicio.asc').then(function(d) {
        APP.reservas = Array.isArray(d) ? d : [];
      }).catch(function() { APP.reservas = []; });
    }),

    sbGet('escalas', filtroData + '&order=data_inicio.asc').then(function(d) {
      APP.escalas = Array.isArray(d) ? d : [];
    }).catch(function() { APP.escalas = []; }),

    sbGet('equipamento_espacos', 'order=ordem.asc').then(function(d) {
      APP.espacos = Array.isArray(d) ? d : [];
    }).catch(function() { APP.espacos = []; }),

    sbGet('checklist_templates', 'order=created_at.asc').then(function(d) {
      APP.checklist_templates = Array.isArray(d) ? d : [];
    }).catch(function() { APP.checklist_templates = []; }),

    sbGet('checklist_registos', 'order=data_registo.desc&limit=100').then(function(d) {
      APP.checklist_registos = Array.isArray(d) ? d : [];
    }).catch(function() { APP.checklist_registos = []; }),

    sbGet('avisos', 'destinatario_id=eq.' + (APP.user ? APP.user.id : '00000000-0000-0000-0000-000000000000') + '&order=created_at.desc&limit=50').then(function(d) {
      APP.avisos = Array.isArray(d) ? d : [];
    }).catch(function() { APP.avisos = []; })
  ]).then(function() {
    APP.funcionarios = [];
    if (typeof App !== 'undefined') {
      if (App.buildSidebar) App.buildSidebar();
      if (App.updateBadges) App.updateBadges();
    }
    if (!_loadDone) { _loadDone = true; if (cb) cb(null); }
  }).catch(function(err) {
    console.error('loadAll erro:', err);
    if (!_loadDone) { _loadDone = true; if (cb) cb(err); }
  });

  // rede de segurança — nunca ficar preso em "a carregar"
  setTimeout(function() {
    if (!_loadDone) {
      _loadDone = true;
      console.warn('loadAll timeout — a abrir na mesma');
      APP.memos = APP.memos || [];
      APP.equipamentos = APP.equipamentos || [];
      APP.tiposEq = APP.tiposEq || [];
      APP.utilizadores = APP.utilizadores || [];
      APP.reservas = APP.reservas || [];
      APP.escalas = APP.escalas || [];
      APP.espacos = APP.espacos || [];
      APP.funcionarios = [];
      if (typeof App !== 'undefined' && App.buildSidebar) App.buildSidebar();
      if (cb) cb(null);
    }
  }, 6000);
}

// ── GERADOR DE NÚMERO DE MEMORANDO ────────────────────────
function gerarNumMemo() {
  var agora = new Date();
  var ano = agora.getFullYear();
  var mes = (agora.getMonth() + 1).toString().padStart(2, '0');
  var pattern = 'MEM/' + ano + '/' + mes + '/*';
  return sbGet('memorandos_dds', 'numero=like.' + pattern + '&select=numero&order=numero.desc&limit=1')
    .then(function(rows) {
      var seq = 1;
      if (rows && rows.length) {
        var parts = rows[0].numero.split('/');
        seq = parseInt(parts[parts.length - 1], 10) + 1;
      }
      return 'MEM/' + ano + '/' + mes + '/' + seq.toString().padStart(3, '0');
    });
}

// ── BRIGADAS (localStorage) ────────────────────────────────
var BRIGADAS_KEY = 'gestdds_brigadas';

function getBrigadas() {
  var saved = localStorage.getItem(BRIGADAS_KEY);
  return saved ? JSON.parse(saved) : ['Brigada A', 'Brigada B', 'Manutenção', 'Limpeza'];
}

function saveBrigadas(list) {
  localStorage.setItem(BRIGADAS_KEY, JSON.stringify(list));
}

// ── EMPTY STATE ────────────────────────────────────────────
function emptyState(title, sub) {
  return '<div class="empty-wrap">' +
    '<div class="empty-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
    '<div class="empty-title">' + H(title) + '</div>' +
    '<p class="empty-sub">' + H(sub) + '</p>' +
    '</div>';
}

// ── ACCESS DENIED ──────────────────────────────────────────
function accessDenied() {
  return emptyState('Acesso restrito', 'Não tem permissões para aceder a esta secção.');
}

// ── LOADING ────────────────────────────────────────────────
function loadingState() {
  return '<div class="loading-wrap"><div class="spinner"></div> A carregar...</div>';
}

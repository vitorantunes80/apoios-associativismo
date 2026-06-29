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

  // spotlight no dashboard
  spotEqId: null,

  // acções pendentes (modais)
  actionId: null,
  actionRecord: null,
  editId: null,

  // helpers de perfil
  isDds: function() { return APP.user && APP.user.isDds; },
  isAdmin: function() { return APP.user && APP.user.perfil === 'admin'; },
  nomeUtilizador: function() {
    if (!APP.user) return 'Utilizador';
    return APP.user.nome || APP.user.username || 'Utilizador';
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
  }).then(function(r) { return r.ok || r.status === 204; });
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
function getTipo(id) {
  return APP.tiposEq.filter(function(t) { return t.id === id; })[0] || null;
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
function loadAll(cb) {
  Promise.all([
    sbGet('memorandos_dds', 'order=created_at.desc').then(function(d) {
      APP.memos = Array.isArray(d) ? d : [];
    }),
    sbGet('equipamentos', 'order=nome.asc').then(function(d) {
      APP.equipamentos = Array.isArray(d) ? d : [];
      // definir spotlight inicial
      if (!APP.spotEqId) {
        if (APP.user && !APP.isDds() && APP.user.equipamento_id) {
          APP.spotEqId = APP.user.equipamento_id;
        } else if (APP.equipamentos.length) {
          APP.spotEqId = APP.equipamentos[0].id;
        }
      }
    }),
    sbGet('tipos_equipamento', 'order=nome.asc').then(function(d) {
      APP.tiposEq = Array.isArray(d) ? d : [];
    }),
    sbGet('utilizadores', 'order=nome.asc').then(function(d) {
      APP.utilizadores = Array.isArray(d) ? d : [];
    }),
    Promise.resolve().then(function() {
      APP.funcionarios = []; // gerido pela tabela utilizadores
    })
  ]).then(function() {
    // actualizar badges no menu sempre que dados são carregados
    if (typeof App !== 'undefined' && App.updateBadges) App.updateBadges();
    if (cb) cb(null);
  }).catch(function(err) {
    if (cb) cb(err);
  });
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

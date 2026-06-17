// ═══════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════
const SB='https://oydylfjnxoyxglxswlcr.supabase.co';
const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95ZHlsZmpueG95eGdseHN3bGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjk3NzIsImV4cCI6MjA5NzIwNTc3Mn0.Gp_RhSztkeK6bccouo3yF6EnMGN1vSdwOfVqXhhIWL0';
const H={'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=representation'};

async function sbGet(t,q=''){
  try{const r=await fetch(`${SB}/rest/v1/${t}?${q}`,{headers:H});return r.ok?r.json():[];}
  catch{return [];}
}
async function sbPost(t,b){
  try{const r=await fetch(`${SB}/rest/v1/${t}`,{method:'POST',headers:H,body:JSON.stringify(b)});return r.ok?r.json():null;}
  catch{return null;}
}
async function sbPatch(t,q,b){
  try{const r=await fetch(`${SB}/rest/v1/${t}?${q}`,{method:'PATCH',headers:H,body:JSON.stringify(b)});return r.ok?r.json():null;}
  catch{return null;}
}
async function sbDel(t,q){
  try{await fetch(`${SB}/rest/v1/${t}?${q}`,{method:'DELETE',headers:H});}
  catch{}
}
async function sbUpsert(t,b,onConflict){
  const h={...H,'Prefer':'resolution=merge-duplicates,return=representation'};
  try{const r=await fetch(`${SB}/rest/v1/${t}?on_conflict=${onConflict}`,{method:'POST',headers:h,body:JSON.stringify(b)});return r.ok?r.json():null;}
  catch{return null;}
}

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let CU=null;            // utilizador atual (professor logado)
let ANO_ATIVO=null;      // ano letivo ativo
let PERIODOS=[];         // períodos do ano ativo
let TURMAS=[];           // turmas do professor (ano ativo, não arquivadas)
let CURRENT_TURMA_ID=null;
let ALUNOS_TURMA=[];     // alunos (com matricula) da turma aberta
let UDS_TURMA=[];        // unidades didáticas da turma aberta

function papel(){return CU?.papel||'professor';}
function isAdmin(){return papel()==='admin';}

const DIAS_SEMANA=['','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira'];
const DIAS_SEMANA_ABR=['','Seg','Ter','Qua','Qui','Sex'];

function fmtHora(t){ return t ? t.slice(0,5) : ''; }
function fmtData(d){
  if(!d) return '';
  const [y,m,day]=d.split('-');
  return `${day}/${m}/${y}`;
}
function escapeHtml(s){
  if(s==null) return '';
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ═══════════════════════════════════════════════════
// LOGIN / LOGOUT
// ═══════════════════════════════════════════════════
document.getElementById('login-code').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

async function doLogin(){
  const code=document.getElementById('login-code').value.trim();
  if(!code)return;
  const rows=await sbGet('utilizadores',`codigo=eq.${encodeURIComponent(code)}&estado=eq.ativo&select=*`);
  if(!rows.length){
    document.getElementById('login-err').style.display='block';
    return;
  }
  CU=rows[0];
  document.getElementById('login-err').style.display='none';
  document.getElementById('login-screen').classList.remove('show');
  document.getElementById('app').classList.add('show');
  document.getElementById('user-nome').textContent=CU.nome;
  document.getElementById('papel-dot').style.background= isAdmin() ? '#c41a1a' : '#1a7a45';
  document.getElementById('nav-admin').style.display= isAdmin() ? '' : 'none';
  await initApp();
}

function doLogout(){
  CU=null;ANO_ATIVO=null;PERIODOS=[];TURMAS=[];CURRENT_TURMA_ID=null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('login-screen').classList.add('show');
  document.getElementById('login-code').value='';
}

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
async function initApp(){
  const anos=await sbGet('anos_letivos','ativo=eq.true&limit=1');
  ANO_ATIVO=anos[0]||null;
  document.getElementById('ano-badge').textContent= ANO_ATIVO ? ANO_ATIVO.nome : 'Sem ano letivo ativo';
  if(ANO_ATIVO){
    PERIODOS=await sbGet('periodos',`ano_letivo_id=eq.${ANO_ATIVO.id}&order=numero`);
  }
  await loadTurmas();
  renderHorario();
  renderTurmasList();
  if(isAdmin()){
    await loadAdminNav();
  }
}

async function loadAdminNav(){
  // adiciona o separador Histórico ao nav se ainda não existir
  if(!document.querySelector('[data-page="historico"]')){
    const btn=document.createElement('button');
    btn.className='nav-btn';
    btn.dataset.page='historico';
    btn.textContent='🗄️ Histórico';
    btn.onclick=()=>showPage('historico');
    document.getElementById('nav-row').insertBefore(btn,document.getElementById('nav-admin'));
  }
}

// ═══════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  const btn=document.querySelector(`.nav-btn[data-page="${name}"]`);
  if(btn)btn.classList.add('active');
  if(name==='admin') loadAdmin();
  if(name==='historico') loadHistorico();
}

function showSubpage(name){
  const ficha=document.getElementById('page-ficha-turma');
  ficha.querySelectorAll('.subpage').forEach(p=>p.classList.remove('active'));
  ficha.querySelectorAll('.subtab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('sub-'+name).classList.add('active');
  document.querySelector(`.subtab-btn[data-sub="${name}"]`).classList.add('active');
  if(name==='assiduidade') renderAssiduidade();
  if(name==='unidades') renderUnidadesDidaticas();
  if(name==='avaliacao') renderAvaliacaoPeriodo();
}

function closeModal(id){
  document.getElementById(id).classList.remove('open');
}
function openModal(id){
  document.getElementById(id).classList.add('open');
}

// ═══════════════════════════════════════════════════
// TURMAS — carregar
// ═══════════════════════════════════════════════════
async function loadTurmas(){
  if(!ANO_ATIVO){TURMAS=[];return;}
  TURMAS=await sbGet('turmas',`professor_id=eq.${CU.id}&ano_letivo_id=eq.${ANO_ATIVO.id}&arquivada=eq.false&order=nome`);
  // carregar horário de cada turma
  for(const t of TURMAS){
    t.horario=await sbGet('turma_horario',`turma_id=eq.${t.id}&order=dia_semana,hora_inicio`);
  }
}

function nivelLabel(n){
  return {'2_ciclo':'2º ciclo','3_ciclo':'3º ciclo','secundario':'Secundário'}[n]||n;
}

// ═══════════════════════════════════════════════════
// HORÁRIO — lista de turmas do professor por dia/hora
// ═══════════════════════════════════════════════════
function renderHorario(){
  const el=document.getElementById('horario-list');
  if(!ANO_ATIVO){
    el.innerHTML='<div class="empty">Não há nenhum ano letivo ativo. Contacte o administrador.</div>';
    return;
  }
  // agrupar blocos de horário por dia da semana
  const porDia={1:[],2:[],3:[],4:[],5:[]};
  TURMAS.forEach(t=>{
    (t.horario||[]).forEach(h=>{
      porDia[h.dia_semana].push({turma:t,bloco:h});
    });
  });
  let html='';
  let temAlgo=false;
  for(let d=1;d<=5;d++){
    const blocos=porDia[d].sort((a,b)=>a.bloco.hora_inicio.localeCompare(b.bloco.hora_inicio));
    if(!blocos.length) continue;
    temAlgo=true;
    html+=`<div class="hor-dia"><div class="hor-dia-lbl">${DIAS_SEMANA[d]}</div>`;
    blocos.forEach(({turma,bloco})=>{
      html+=`<div class="hor-turma-card" onclick="abrirFichaTurma('${turma.id}')">
        <div class="hor-hora">${fmtHora(bloco.hora_inicio)}–${fmtHora(bloco.hora_fim)}</div>
        <div class="hor-info">
          <div class="hor-nome">${escapeHtml(turma.nome)}</div>
          <div class="hor-meta">${nivelLabel(turma.nivel_ensino)}${bloco.local?' · '+escapeHtml(bloco.local):''}</div>
        </div>
      </div>`;
    });
    html+='</div>';
  }
  el.innerHTML = temAlgo ? html : '<div class="empty">Ainda não definiu horário para nenhuma turma. Vá a Turmas → Nova turma para adicionar blocos de horário.</div>';
}

// ═══════════════════════════════════════════════════
// TURMAS — lista
// ═══════════════════════════════════════════════════
function renderTurmasList(){
  const el=document.getElementById('turmas-list');
  if(!ANO_ATIVO){
    el.innerHTML='<div class="empty">Não há nenhum ano letivo ativo. Contacte o administrador.</div>';
    return;
  }
  if(!TURMAS.length){
    el.innerHTML='<div class="empty">Ainda não tem turmas criadas.</div>';
    return;
  }
  let html='<div class="grid3">';
  TURMAS.forEach(t=>{
    const horarioStr=(t.horario||[]).map(h=>`${DIAS_SEMANA_ABR[h.dia_semana]} ${fmtHora(h.hora_inicio)}`).join(', ')||'Sem horário';
    html+=`<div class="card" style="cursor:pointer;margin-bottom:0" onclick="abrirFichaTurma('${t.id}')">
      <div class="card-body">
        <div style="font-weight:700;font-size:1rem;color:var(--brand)">${escapeHtml(t.nome)}</div>
        <div style="font-size:.78rem;color:var(--text3);margin-top:4px">${nivelLabel(t.nivel_ensino)}</div>
        <div style="font-size:.72rem;color:var(--text3);margin-top:8px">${horarioStr}</div>
      </div>
    </div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}

// ═══════════════════════════════════════════════════
// MODAL TURMA (criar/editar + horário)
// ═══════════════════════════════════════════════════
let _horarioRows=[];

function openModalTurma(turmaId){
  document.getElementById('mt-id').value=turmaId||'';
  _horarioRows=[];
  if(turmaId){
    const t=TURMAS.find(x=>x.id===turmaId);
    document.getElementById('mt-title').textContent='Editar Turma';
    document.getElementById('mt-nome').value=t.nome;
    document.getElementById('mt-nivel').value=t.nivel_ensino;
    document.getElementById('mt-ano-escolaridade').value=t.ano_escolaridade||'';
    _horarioRows=(t.horario||[]).map(h=>({id:h.id,dia_semana:h.dia_semana,hora_inicio:fmtHora(h.hora_inicio),hora_fim:fmtHora(h.hora_fim),local:h.local||''}));
  }else{
    document.getElementById('mt-title').textContent='Nova Turma';
    document.getElementById('mt-nome').value='';
    document.getElementById('mt-nivel').value='3_ciclo';
    document.getElementById('mt-ano-escolaridade').value='';
  }
  if(!_horarioRows.length) _horarioRows.push({dia_semana:1,hora_inicio:'',hora_fim:'',local:''});
  renderHorarioRows();
  openModal('modal-turma');
}

function renderHorarioRows(){
  const el=document.getElementById('mt-horario-rows');
  el.innerHTML=_horarioRows.map((r,i)=>`
    <div class="grid4" style="margin-bottom:6px;align-items:end">
      <div><select class="inp inp-sm select" onchange="_horarioRows[${i}].dia_semana=parseInt(this.value)">
        ${[1,2,3,4,5].map(d=>`<option value="${d}" ${r.dia_semana===d?'selected':''}>${DIAS_SEMANA_ABR[d]}</option>`).join('')}
      </select></div>
      <div><input class="inp inp-sm" type="time" value="${r.hora_inicio}" onchange="_horarioRows[${i}].hora_inicio=this.value"></div>
      <div><input class="inp inp-sm" type="time" value="${r.hora_fim}" onchange="_horarioRows[${i}].hora_fim=this.value"></div>
      <div class="flex" style="gap:4px">
        <input class="inp inp-sm" placeholder="Local" value="${escapeHtml(r.local)}" onchange="_horarioRows[${i}].local=this.value">
        <button class="btn btn-danger btn-xs" onclick="removeHorarioRow(${i})">✕</button>
      </div>
    </div>`).join('');
}
function addHorarioRow(){
  _horarioRows.push({dia_semana:1,hora_inicio:'',hora_fim:'',local:''});
  renderHorarioRows();
}
function removeHorarioRow(i){
  _horarioRows.splice(i,1);
  renderHorarioRows();
}

async function saveTurma(){
  const id=document.getElementById('mt-id').value;
  const nome=document.getElementById('mt-nome').value.trim();
  if(!nome){alert('Indique o nome da turma.');return;}
  const body={
    nome,
    nivel_ensino:document.getElementById('mt-nivel').value,
    ano_escolaridade:parseInt(document.getElementById('mt-ano-escolaridade').value)||null,
  };
  let turmaId=id;
  if(id){
    await sbPatch('turmas',`id=eq.${id}`,body);
  }else{
    body.ano_letivo_id=ANO_ATIVO.id;
    body.professor_id=CU.id;
    const r=await sbPost('turmas',body);
    turmaId=r[0].id;
  }
  // sincronizar horário: apagar blocos antigos e recriar (simples e robusto)
  await sbDel('turma_horario',`turma_id=eq.${turmaId}`);
  const blocosValidos=_horarioRows.filter(r=>r.hora_inicio&&r.hora_fim);
  for(const r of blocosValidos){
    await sbPost('turma_horario',{turma_id:turmaId,dia_semana:r.dia_semana,hora_inicio:r.hora_inicio,hora_fim:r.hora_fim,local:r.local||null});
  }
  closeModal('modal-turma');
  await loadTurmas();
  renderHorario();
  renderTurmasList();
  if(CURRENT_TURMA_ID===turmaId) abrirFichaTurma(turmaId);
}

async function arquivarTurma(turmaId){
  if(!confirm('Arquivar esta turma? Deixará de aparecer na lista de turmas ativas, mas o histórico fica guardado.'))return;
  await sbPatch('turmas',`id=eq.${turmaId}`,{arquivada:true});
  await loadTurmas();
  renderHorario();
  renderTurmasList();
  showPage('turmas');
}

// ═══════════════════════════════════════════════════
// FICHA DE TURMA
// ═══════════════════════════════════════════════════
async function abrirFichaTurma(turmaId){
  CURRENT_TURMA_ID=turmaId;
  const t=TURMAS.find(x=>x.id===turmaId);
  if(!t)return;
  document.getElementById('ft-nome').textContent=t.nome;
  const horarioStr=(t.horario||[]).map(h=>`${DIAS_SEMANA_ABR[h.dia_semana]} ${fmtHora(h.hora_inicio)}-${fmtHora(h.hora_fim)}`).join(' · ');
  document.getElementById('ft-meta').textContent=`${nivelLabel(t.nivel_ensino)}${t.ano_escolaridade?' · '+t.ano_escolaridade+'º ano':''}${horarioStr?' · '+horarioStr:''}`;
  showPage('ficha-turma');
  showSubpage('alunos');
  document.getElementById('assid-data').value=hoje();
  await loadAlunosTurma();
  renderAlunosTurma();
  await populatePeriodoSelect();
}

function hoje(){
  return new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Lisbon'});
}

async function loadAlunosTurma(){
  const matriculas=await sbGet('matriculas',`turma_id=eq.${CURRENT_TURMA_ID}&estado=eq.ativo&select=*,alunos(*)`);
  ALUNOS_TURMA=matriculas.map(m=>({...m.alunos,matricula_id:m.id,matricula_estado:m.estado})).sort((a,b)=>a.nome.localeCompare(b.nome));
}

// ── ALUNOS ──
function renderAlunosTurma(){
  const search=(document.getElementById('aluno-search').value||'').toLowerCase();
  const filtrados=ALUNOS_TURMA.filter(a=>a.nome.toLowerCase().includes(search));
  const tb=document.getElementById('alunos-tb');
  if(!filtrados.length){
    tb.innerHTML='<tr><td colspan="6"><div class="empty">Nenhum aluno encontrado.</div></td></tr>';
    return;
  }
  tb.innerHTML=filtrados.map(a=>`
    <tr>
      <td>${escapeHtml(a.numero||'—')}</td>
      <td>${escapeHtml(a.nome)}</td>
      <td>${fmtData(a.data_nascimento)||'—'}</td>
      <td>${a.sexo||'—'}</td>
      <td><span class="badge" style="background:var(--green-light);color:var(--green)">${a.matricula_estado}</span></td>
      <td><button class="btn btn-outline btn-xs" onclick="editarAluno('${a.id}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="removerAlunoTurma('${a.matricula_id}','${escapeHtml(a.nome)}')">Remover</button></td>
    </tr>`).join('');
}

function editarAluno(alunoId){
  const a=ALUNOS_TURMA.find(x=>x.id===alunoId);
  document.getElementById('ma-id').value=a.id;
  document.getElementById('ma-nome').value=a.nome;
  document.getElementById('ma-numero').value=a.numero||'';
  document.getElementById('ma-sexo').value=a.sexo||'';
  document.getElementById('ma-nascimento').value=a.data_nascimento||'';
  document.getElementById('ma-obs').value=a.observacoes||'';
  openModal('modal-aluno');
}

function openModalAluno(){
  document.getElementById('ma-id').value='';
  document.getElementById('ma-nome').value='';
  document.getElementById('ma-numero').value='';
  document.getElementById('ma-sexo').value='';
  document.getElementById('ma-nascimento').value='';
  document.getElementById('ma-obs').value='';
  openModal('modal-aluno');
}

async function saveAluno(){
  const id=document.getElementById('ma-id').value;
  const nome=document.getElementById('ma-nome').value.trim();
  if(!nome){alert('Indique o nome do aluno.');return;}
  const body={
    nome,
    numero:document.getElementById('ma-numero').value.trim()||null,
    sexo:document.getElementById('ma-sexo').value||null,
    data_nascimento:document.getElementById('ma-nascimento').value||null,
    observacoes:document.getElementById('ma-obs').value.trim()||null,
  };
  if(id){
    await sbPatch('alunos',`id=eq.${id}`,body);
  }else{
    const r=await sbPost('alunos',body);
    const alunoId=r[0].id;
    await sbPost('matriculas',{aluno_id:alunoId,turma_id:CURRENT_TURMA_ID});
  }
  closeModal('modal-aluno');
  await loadAlunosTurma();
  renderAlunosTurma();
}

async function removerAlunoTurma(matriculaId,nome){
  if(!confirm(`Remover "${nome}" desta turma? O aluno mantém-se no sistema mas deixa de estar matriculado nesta turma.`))return;
  await sbPatch('matriculas',`id=eq.${matriculaId}`,{estado:'transferido'});
  await loadAlunosTurma();
  renderAlunosTurma();
}

// ── ASSIDUIDADE ──
async function renderAssiduidade(){
  const data=document.getElementById('assid-data').value||hoje();
  const registos=await sbGet('assiduidade',`turma_id=eq.${CURRENT_TURMA_ID}&data=eq.${data}`);
  const porAluno={};
  registos.forEach(r=>porAluno[r.aluno_id]=r);

  const tb=document.getElementById('assid-tb');
  if(!ALUNOS_TURMA.length){
    tb.innerHTML='<tr><td colspan="3"><div class="empty">Sem alunos nesta turma.</div></td></tr>';
    document.getElementById('assid-stats').innerHTML='';
    return;
  }
  tb.innerHTML=ALUNOS_TURMA.map(a=>{
    const reg=porAluno[a.id];
    const estadoAtual=reg?reg.estado:'presente';
    return `<tr>
      <td>${escapeHtml(a.nome)}</td>
      <td>
        <div class="flex-wrap" style="gap:4px" data-aluno="${a.id}">
          ${['presente','falta','falta_justificada','atraso'].map(e=>`
            <button class="estado-btn ${e} ${estadoAtual===e?'active':''}" onclick="setAssiduidade('${a.id}','${e}')">${estadoLabel(e)}</button>
          `).join('')}
        </div>
      </td>
      <td><input class="inp inp-sm" value="${escapeHtml(reg?.observacoes||'')}" placeholder="—" onchange="setAssiduidadeObs('${a.id}',this.value)"></td>
    </tr>`;
  }).join('');

  // stats
  const total=ALUNOS_TURMA.length;
  const presentes=ALUNOS_TURMA.filter(a=>(porAluno[a.id]?.estado||'presente')==='presente').length;
  const faltas=ALUNOS_TURMA.filter(a=>porAluno[a.id]?.estado==='falta').length;
  const justificadas=ALUNOS_TURMA.filter(a=>porAluno[a.id]?.estado==='falta_justificada').length;
  document.getElementById('assid-stats').innerHTML=`
    <div class="stat g"><div class="stat-val">${presentes}</div><div class="stat-lbl">Presentes</div></div>
    <div class="stat r"><div class="stat-val">${faltas}</div><div class="stat-lbl">Faltas</div></div>
    <div class="stat y"><div class="stat-val">${justificadas}</div><div class="stat-lbl">Just.</div></div>
    <div class="stat"><div class="stat-val">${total}</div><div class="stat-lbl">Total</div></div>
  `;
}
function estadoLabel(e){
  return {presente:'Presente',falta:'Falta',falta_justificada:'Just.',atraso:'Atraso'}[e];
}
async function setAssiduidade(alunoId,estado){
  const data=document.getElementById('assid-data').value||hoje();
  await sbUpsert('assiduidade',{turma_id:CURRENT_TURMA_ID,aluno_id:alunoId,data,estado},'turma_id,aluno_id,data');
  renderAssiduidade();
}
async function setAssiduidadeObs(alunoId,observacoes){
  const data=document.getElementById('assid-data').value||hoje();
  const existentes=await sbGet('assiduidade',`turma_id=eq.${CURRENT_TURMA_ID}&aluno_id=eq.${alunoId}&data=eq.${data}`);
  const estado=existentes[0]?.estado||'presente';
  await sbUpsert('assiduidade',{turma_id:CURRENT_TURMA_ID,aluno_id:alunoId,data,estado,observacoes:observacoes||null},'turma_id,aluno_id,data');
}

// ═══════════════════════════════════════════════════
// UNIDADES DIDÁTICAS + GRELHA DE CRITÉRIOS
// ═══════════════════════════════════════════════════
function periodoLabel(p){
  return p ? `${p.nome} (${fmtData(p.data_inicio)} - ${fmtData(p.data_fim)})` : '—';
}

async function renderUnidadesDidaticas(){
  UDS_TURMA=await sbGet('unidades_didaticas',`turma_id=eq.${CURRENT_TURMA_ID}&order=data_inicio`);
  const el=document.getElementById('ud-list');
  if(!UDS_TURMA.length){
    el.innerHTML='<div class="empty">Ainda não criou nenhuma unidade didática para esta turma.</div>';
    return;
  }
  let html='';
  for(const ud of UDS_TURMA){
    const periodo=PERIODOS.find(p=>p.id===ud.periodo_id);
    html+=`<div class="card">
      <div class="card-hdr">
        <div><h2>${escapeHtml(ud.modalidade)}</h2><p>${periodoLabel(periodo)}${ud.data_inicio?' · '+fmtData(ud.data_inicio)+' a '+fmtData(ud.data_fim):''}</p></div>
        <div class="flex-wrap">
          <button class="btn btn-outline btn-xs" onclick="abrirGrelha('${ud.id}')">Grelha de avaliação</button>
          <button class="btn btn-outline btn-xs" onclick="editarUD('${ud.id}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="apagarUD('${ud.id}')">Apagar</button>
        </div>
      </div>
    </div>`;
  }
  el.innerHTML=html;
}

let _criterioRows=[];
async function openModalUD(){
  document.getElementById('mud-id').value='';
  document.getElementById('mud-title').textContent='Nova Unidade Didática';
  document.getElementById('mud-modalidade').value='';
  document.getElementById('mud-inicio').value='';
  document.getElementById('mud-fim').value='';
  document.getElementById('mud-aulas').value='';
  populateModalPeriodoSelect();
  _criterioRows=[{nome:''}];
  renderCriterioRows();
  openModal('modal-ud');
}

async function editarUD(udId){
  const ud=UDS_TURMA.find(x=>x.id===udId);
  document.getElementById('mud-id').value=ud.id;
  document.getElementById('mud-title').textContent='Editar Unidade Didática';
  document.getElementById('mud-modalidade').value=ud.modalidade;
  document.getElementById('mud-inicio').value=ud.data_inicio||'';
  document.getElementById('mud-fim').value=ud.data_fim||'';
  document.getElementById('mud-aulas').value=ud.numero_aulas_previstas||'';
  populateModalPeriodoSelect(ud.periodo_id);
  const criterios=await sbGet('criterios_avaliacao',`unidade_didatica_id=eq.${udId}&order=ordem`);
  _criterioRows=criterios.length?criterios.map(c=>({id:c.id,nome:c.nome})):[{nome:''}];
  renderCriterioRows();
  openModal('modal-ud');
}

function populateModalPeriodoSelect(selectedId){
  const sel=document.getElementById('mud-periodo');
  sel.innerHTML=PERIODOS.map(p=>`<option value="${p.id}" ${p.id===selectedId?'selected':''}>${escapeHtml(periodoLabel(p))}</option>`).join('');
}

function renderCriterioRows(){
  const el=document.getElementById('mud-criterios-rows');
  el.innerHTML=_criterioRows.map((c,i)=>`
    <div class="flex" style="margin-bottom:6px">
      <input class="inp inp-sm" placeholder="Ex: Receção" value="${escapeHtml(c.nome)}" onchange="_criterioRows[${i}].nome=this.value">
      <button class="btn btn-danger btn-xs" onclick="removeCriterioRow(${i})">✕</button>
    </div>`).join('');
}
function addCriterioRow(){_criterioRows.push({nome:''});renderCriterioRows();}
function removeCriterioRow(i){_criterioRows.splice(i,1);renderCriterioRows();}

async function saveUD(){
  const id=document.getElementById('mud-id').value;
  const modalidade=document.getElementById('mud-modalidade').value.trim();
  if(!modalidade){alert('Indique a modalidade.');return;}
  const periodoId=document.getElementById('mud-periodo').value;
  if(!periodoId){alert('Não há períodos disponíveis. Crie um ano letivo com períodos primeiro.');return;}
  const body={
    modalidade,
    periodo_id:periodoId,
    data_inicio:document.getElementById('mud-inicio').value||null,
    data_fim:document.getElementById('mud-fim').value||null,
    numero_aulas_previstas:parseInt(document.getElementById('mud-aulas').value)||null,
  };
  let udId=id;
  if(id){
    await sbPatch('unidades_didaticas',`id=eq.${id}`,body);
  }else{
    body.turma_id=CURRENT_TURMA_ID;
    const r=await sbPost('unidades_didaticas',body);
    udId=r[0].id;
  }
  // sincronizar critérios: apagar e recriar
  await sbDel('criterios_avaliacao',`unidade_didatica_id=eq.${udId}`);
  const nomesValidos=_criterioRows.filter(c=>c.nome.trim());
  for(let i=0;i<nomesValidos.length;i++){
    await sbPost('criterios_avaliacao',{unidade_didatica_id:udId,nome:nomesValidos[i].nome.trim(),ordem:i});
  }
  closeModal('modal-ud');
  renderUnidadesDidaticas();
}

async function apagarUD(udId){
  if(!confirm('Apagar esta unidade didática e a respetiva grelha de avaliação?'))return;
  await sbDel('unidades_didaticas',`id=eq.${udId}`);
  renderUnidadesDidaticas();
}

// ── GRELHA DE AVALIAÇÃO POR CRITÉRIO (níveis PNEF) ──
async function abrirGrelha(udId){
  const ud=UDS_TURMA.find(x=>x.id===udId);
  document.getElementById('mg-title').textContent=`Grelha — ${ud.modalidade}`;
  const criterios=await sbGet('criterios_avaliacao',`unidade_didatica_id=eq.${udId}&order=ordem`);
  if(!criterios.length){
    document.getElementById('mg-table').innerHTML='<tr><td><div class="empty">Esta unidade didática não tem critérios definidos. Edite-a para adicionar critérios.</div></td></tr>';
    openModal('modal-grelha');
    return;
  }
  // carregar todas as avaliações destes critérios de uma vez
  const criterioIds=criterios.map(c=>c.id).join(',');
  const avals=await sbGet('avaliacoes_criterio',`criterio_id=in.(${criterioIds})`);
  const mapa={}; // mapa[criterio_id][aluno_id] = nivel_pnef
  avals.forEach(a=>{ (mapa[a.criterio_id]=mapa[a.criterio_id]||{})[a.aluno_id]=a.nivel_pnef; });

  let html='<thead><tr><th>Aluno</th>'+criterios.map(c=>`<th>${escapeHtml(c.nome)}</th>`).join('')+'</tr></thead><tbody>';
  ALUNOS_TURMA.forEach(a=>{
    html+=`<tr><td>${escapeHtml(a.nome)}</td>`;
    criterios.forEach(c=>{
      const atual=mapa[c.id]?.[a.id];
      html+=`<td><div class="nivel-row">`+
        [1,2,3,4,5].map(n=>`<button class="nivel-pill ${atual===n?'active':''}" onclick="setNivelCriterio('${c.id}','${a.id}',${n},this)">${n}</button>`).join('')+
        `</div></td>`;
    });
    html+='</tr>';
  });
  html+='</tbody>';
  document.getElementById('mg-table').innerHTML=html;
  openModal('modal-grelha');
}

async function setNivelCriterio(criterioId,alunoId,nivel,btnEl){
  await sbUpsert('avaliacoes_criterio',{criterio_id:criterioId,aluno_id:alunoId,nivel_pnef:nivel},'criterio_id,aluno_id');
  // feedback visual imediato sem recarregar tudo
  const row=btnEl.closest('.nivel-row');
  row.querySelectorAll('.nivel-pill').forEach(b=>b.classList.remove('active'));
  btnEl.classList.add('active');
}

// ═══════════════════════════════════════════════════
// AVALIAÇÃO POR PERÍODO (nota final)
// ═══════════════════════════════════════════════════
async function populatePeriodoSelect(){
  const sel=document.getElementById('aval-periodo');
  sel.innerHTML=PERIODOS.map(p=>`<option value="${p.id}">${escapeHtml(periodoLabel(p))}</option>`).join('');
}

async function renderAvaliacaoPeriodo(){
  const periodoId=document.getElementById('aval-periodo').value;
  if(!periodoId)return;
  const turma=TURMAS.find(t=>t.id===CURRENT_TURMA_ID);
  const usaPNEF = turma.nivel_ensino!=='secundario';
  document.getElementById('aval-th-nota').textContent = usaPNEF ? 'Nível PNEF (1-5)' : 'Nota (0-20)';

  const registos=await sbGet('avaliacoes_periodo',`turma_id=eq.${CURRENT_TURMA_ID}&periodo_id=eq.${periodoId}`);
  const porAluno={};
  registos.forEach(r=>porAluno[r.aluno_id]=r);

  const tb=document.getElementById('aval-tb');
  if(!ALUNOS_TURMA.length){
    tb.innerHTML='<tr><td colspan="3"><div class="empty">Sem alunos nesta turma.</div></td></tr>';
    return;
  }
  tb.innerHTML=ALUNOS_TURMA.map(a=>{
    const reg=porAluno[a.id];
    const valorAtual = usaPNEF ? (reg?.nivel_pnef??'') : (reg?.nota_quantitativa??'');
    return `<tr>
      <td>${escapeHtml(a.nome)}</td>
      <td>
        ${usaPNEF
          ? `<div class="nivel-row">${[1,2,3,4,5].map(n=>`<button class="nivel-pill ${valorAtual===n?'active':''}" onclick="setNotaPeriodo('${a.id}','${periodoId}',true,${n},this)">${n}</button>`).join('')}</div>`
          : `<input class="inp inp-sm" style="max-width:90px" type="number" min="0" max="20" step="0.5" value="${valorAtual}" onchange="setNotaPeriodo('${a.id}','${periodoId}',false,this.value)">`
        }
      </td>
      <td><input class="inp inp-sm" value="${escapeHtml(reg?.observacoes||'')}" onchange="setNotaPeriodoObs('${a.id}','${periodoId}',this.value)"></td>
    </tr>`;
  }).join('');
}

async function setNotaPeriodo(alunoId,periodoId,isPNEF,valor,btnEl){
  const body={aluno_id:alunoId,turma_id:CURRENT_TURMA_ID,periodo_id:periodoId};
  if(isPNEF){ body.nivel_pnef=valor; body.nota_quantitativa=null; }
  else{ body.nota_quantitativa=valor===''?null:parseFloat(valor); body.nivel_pnef=null; }
  await sbUpsert('avaliacoes_periodo',body,'aluno_id,periodo_id');
  if(btnEl){
    const row=btnEl.closest('.nivel-row');
    row.querySelectorAll('.nivel-pill').forEach(b=>b.classList.remove('active'));
    btnEl.classList.add('active');
  }
}
async function setNotaPeriodoObs(alunoId,periodoId,observacoes){
  const existentes=await sbGet('avaliacoes_periodo',`aluno_id=eq.${alunoId}&periodo_id=eq.${periodoId}`);
  const base=existentes[0]||{aluno_id:alunoId,turma_id:CURRENT_TURMA_ID,periodo_id:periodoId,nivel_pnef:null,nota_quantitativa:null};
  base.observacoes=observacoes||null;
  await sbUpsert('avaliacoes_periodo',base,'aluno_id,periodo_id');
}

// ═══════════════════════════════════════════════════
// ADMIN — professores e anos letivos
// ═══════════════════════════════════════════════════
async function loadAdmin(){
  await renderUtilizadores();
  await renderAnosLetivos();
}

async function renderUtilizadores(){
  const utils=await sbGet('utilizadores','order=papel,nome');
  const tb=document.getElementById('utilizadores-tb');
  tb.innerHTML=utils.map(u=>`
    <tr>
      <td>${escapeHtml(u.nome)}</td>
      <td><span style="font-family:var(--mono);font-size:.75rem">${escapeHtml(u.codigo)}</span></td>
      <td><span class="badge" style="background:${u.papel==='admin'?'var(--red-light)':'var(--brand-light)'};color:${u.papel==='admin'?'var(--red)':'var(--brand)'}">${u.papel}</span></td>
      <td><span class="badge" style="background:${u.estado==='ativo'?'var(--green-light)':'var(--gray-light)'};color:${u.estado==='ativo'?'var(--green)':'var(--text3)'}">${u.estado}</span></td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="toggleEstadoUtilizador('${u.id}','${u.estado}')">${u.estado==='ativo'?'Desativar':'Ativar'}</button>
        <button class="btn btn-danger btn-xs" onclick="apagarUtilizador('${u.id}','${escapeHtml(u.nome)}')">Apagar</button>
      </td>
    </tr>`).join('');
}

function openModalUtilizador(){
  document.getElementById('mu-nome').value='';
  document.getElementById('mu-codigo').value='';
  document.getElementById('mu-papel').value='professor';
  openModal('modal-utilizador');
}

async function saveUtilizador(){
  const nome=document.getElementById('mu-nome').value.trim();
  const codigo=document.getElementById('mu-codigo').value.trim();
  const papelSel=document.getElementById('mu-papel').value;
  if(!nome||!codigo){alert('Indique nome e código.');return;}
  const existe=await sbGet('utilizadores',`codigo=eq.${encodeURIComponent(codigo)}`);
  if(existe.length){alert('Já existe um utilizador com esse código.');return;}
  await sbPost('utilizadores',{nome,codigo,papel:papelSel,estado:'ativo'});
  closeModal('modal-utilizador');
  renderUtilizadores();
}

async function toggleEstadoUtilizador(id,estadoAtual){
  const novo=estadoAtual==='ativo'?'inativo':'ativo';
  await sbPatch('utilizadores',`id=eq.${id}`,{estado:novo});
  renderUtilizadores();
}

async function apagarUtilizador(id,nome){
  if(!confirm(`Apagar o utilizador "${nome}"? As turmas que lhe pertencem não são apagadas, mas ficarão sem professor associado.`))return;
  await sbDel('utilizadores',`id=eq.${id}`);
  renderUtilizadores();
}

async function renderAnosLetivos(){
  const anos=await sbGet('anos_letivos','order=data_inicio.desc');
  const tb=document.getElementById('anos-tb');
  tb.innerHTML=anos.map(a=>`
    <tr>
      <td>${escapeHtml(a.nome)}</td>
      <td>${fmtData(a.data_inicio)}</td>
      <td>${fmtData(a.data_fim)}</td>
      <td><span class="badge" style="background:${a.ativo?'var(--green-light)':'var(--gray-light)'};color:${a.ativo?'var(--green)':'var(--text3)'}">${a.ativo?'Ativo':'Inativo'}</span></td>
      <td>${a.ativo?'':`<button class="btn btn-outline btn-xs" onclick="ativarAnoLetivo('${a.id}')">Ativar</button>`}</td>
    </tr>`).join('');
}

function openModalAnoLetivo(){
  document.getElementById('mal-nome').value='';
  document.getElementById('mal-inicio').value='';
  document.getElementById('mal-fim').value='';
  openModal('modal-ano-letivo');
}

async function saveAnoLetivo(){
  const nome=document.getElementById('mal-nome').value.trim();
  const inicio=document.getElementById('mal-inicio').value;
  const fim=document.getElementById('mal-fim').value;
  if(!nome||!inicio||!fim){alert('Preencha todos os campos.');return;}
  const r=await sbPost('anos_letivos',{nome,data_inicio:inicio,data_fim:fim,ativo:false});
  const anoId=r[0].id;
  // criar 3 períodos distribuídos igualmente entre as datas
  const dIni=new Date(inicio+'T00:00:00');
  const dFim=new Date(fim+'T00:00:00');
  const totalDias=(dFim-dIni)/(1000*60*60*24);
  const passo=Math.floor(totalDias/3);
  for(let i=0;i<3;i++){
    const pIni=new Date(dIni); pIni.setDate(pIni.getDate()+i*passo+(i>0?1:0));
    const pFim=i<2 ? new Date(dIni.getTime()+ (i+1)*passo*86400000) : dFim;
    await sbPost('periodos',{
      ano_letivo_id:anoId,numero:i+1,nome:`${i+1}º Período`,
      data_inicio:pIni.toISOString().slice(0,10),
      data_fim:pFim.toISOString().slice(0,10),
    });
  }
  closeModal('modal-ano-letivo');
  renderAnosLetivos();
}

async function ativarAnoLetivo(id){
  if(!confirm('Ativar este ano letivo? O ano letivo atualmente ativo será desativado.'))return;
  await sbPatch('anos_letivos','ativo=eq.true',{ativo:false});
  await sbPatch('anos_letivos',`id=eq.${id}`,{ativo:true});
  alert('Ano letivo ativado. A página vai recarregar.');
  location.reload();
}

// ═══════════════════════════════════════════════════
// HISTÓRICO — turmas arquivadas
// ═══════════════════════════════════════════════════
async function loadHistorico(){
  const filtro = isAdmin() ? '' : `&professor_id=eq.${CU.id}`;
  const turmas=await sbGet('turmas',`arquivada=eq.true${filtro}&select=*,anos_letivos(nome)&order=nome`);
  const el=document.getElementById('historico-list');
  if(!turmas.length){
    el.innerHTML='<div class="empty">Sem turmas arquivadas.</div>';
    return;
  }
  el.innerHTML='<div class="tbl-wrap"><table><thead><tr><th>Turma</th><th>Ano letivo</th><th>Nível</th><th></th></tr></thead><tbody>'+
    turmas.map(t=>`<tr>
      <td>${escapeHtml(t.nome)}</td>
      <td>${escapeHtml(t.anos_letivos?.nome||'—')}</td>
      <td>${nivelLabel(t.nivel_ensino)}</td>
      <td><button class="btn btn-outline btn-xs" onclick="restaurarTurma('${t.id}')">Restaurar</button></td>
    </tr>`).join('')+
    '</tbody></table></div>';
}

async function restaurarTurma(turmaId){
  if(!confirm('Restaurar esta turma para a lista de turmas ativas?'))return;
  await sbPatch('turmas',`id=eq.${turmaId}`,{arquivada:false});
  await loadTurmas();
  renderHorario();
  renderTurmasList();
  loadHistorico();
}

// ═══════════════════════════════════════════════════
// RELATÓRIOS — exportação CSV
// ═══════════════════════════════════════════════════
function csvEscape(v){
  if(v==null) return '';
  const s=String(v);
  return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function downloadCsv(filename,rows){
  const csv=rows.map(r=>r.map(csvEscape).join(';')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
}

async function exportarRelatorio(tipo){
  if(!ANO_ATIVO){alert('Sem ano letivo ativo.');return;}
  if(tipo==='turmas'){
    const rows=[['Turma','Nível','Aluno','Número']];
    for(const t of TURMAS){
      const matriculas=await sbGet('matriculas',`turma_id=eq.${t.id}&estado=eq.ativo&select=*,alunos(*)`);
      matriculas.forEach(m=>rows.push([t.nome,nivelLabel(t.nivel_ensino),m.alunos.nome,m.alunos.numero||'']));
    }
    downloadCsv('turmas.csv',rows);
  }else if(tipo==='assiduidade'){
    const rows=[['Turma','Data','Aluno','Estado','Observações']];
    for(const t of TURMAS){
      const registos=await sbGet('assiduidade',`turma_id=eq.${t.id}&select=*,alunos(nome)&order=data`);
      registos.forEach(r=>rows.push([t.nome,fmtData(r.data),r.alunos.nome,estadoLabel(r.estado),r.observacoes||'']));
    }
    downloadCsv('assiduidade.csv',rows);
  }else if(tipo==='avaliacao'){
    const rows=[['Turma','Período','Aluno','Nível PNEF','Nota (0-20)','Observações']];
    for(const t of TURMAS){
      const registos=await sbGet('avaliacoes_periodo',`turma_id=eq.${t.id}&select=*,alunos(nome),periodos(nome)`);
      registos.forEach(r=>rows.push([t.nome,r.periodos?.nome||'',r.alunos.nome,r.nivel_pnef??'',r.nota_quantitativa??'',r.observacoes||'']));
    }
    downloadCsv('avaliacao.csv',rows);
  }
}

// ═══════════════════════════════════════════════════
// LOADING OVERLAY
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('login-screen').classList.add('show');
  setTimeout(()=>document.getElementById('loading').classList.add('hide'),500);
});

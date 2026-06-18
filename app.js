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
  if(name==='relatorios') populateRelatoriosFiltros();
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
// HORÁRIO — grelha de calendário semanal (estilo Piscinas)
// ═══════════════════════════════════════════════════
const CORES_TURMA=['#1a56a0','#1a7a45','#c45c1a','#a07a1a','#7c3aed','#c41a1a','#0e7490','#be185d'];
function corTurma(turmaId){
  // cor estável por turma, baseada no id
  let hash=0;
  for(let i=0;i<turmaId.length;i++) hash=(hash*31+turmaId.charCodeAt(i))>>>0;
  return CORES_TURMA[hash%CORES_TURMA.length];
}

function renderHorario(){
  const el=document.getElementById('horario-list');
  if(!ANO_ATIVO){
    el.innerHTML='<div class="empty">Não há nenhum ano letivo ativo. Contacte o administrador.</div>';
    return;
  }
  // recolher todos os blocos de horário com a turma associada
  const blocos=[];
  TURMAS.forEach(t=>{
    (t.horario||[]).forEach(h=>blocos.push({turma:t,bloco:h}));
  });
  if(!blocos.length){
    el.innerHTML='<div class="empty">Ainda não definiu horário para nenhuma turma. Vá a Turmas → Nova turma para adicionar blocos de horário.</div>';
    return;
  }

  const hToM=s=>{ const [h,m]=(s||'0:0').split(':'); return parseInt(h)*60+parseInt(m); };
  let mnM=24*60, mxM=0;
  blocos.forEach(({bloco})=>{
    const s=hToM(bloco.hora_inicio), e=hToM(bloco.hora_fim);
    if(s<mnM) mnM=s;
    if(e>mxM) mxM=e;
  });
  const PX_H=60; // pixels por hora
  const startH=Math.floor(mnM/60), endH=Math.ceil(mxM/60);
  const totalPx=(endH-startH)*PX_H;
  const diasNm=['Seg','Ter','Qua','Qui','Sex'];

  // agrupar por dia para detetar sobreposições e atribuir sub-colunas
  function subColsParaDia(d){
    const doDia=blocos.filter(b=>b.bloco.dia_semana===d).sort((a,b)=>hToM(a.bloco.hora_inicio)-hToM(b.bloco.hora_inicio));
    const colEnd=[]; // fim (em minutos) de cada sub-coluna ocupada
    const assign={};
    doDia.forEach(b=>{
      const s=hToM(b.bloco.hora_inicio), e=hToM(b.bloco.hora_fim);
      let col=colEnd.findIndex(fim=>fim<=s);
      if(col===-1){ col=colEnd.length; colEnd.push(e); }
      else colEnd[col]=e;
      assign[b.bloco.id]=col;
    });
    return {nCols:Math.max(colEnd.length,1),assign};
  }

  let h='<div class="cal-wrap"><div class="cal-scroll"><div class="cal-inner">';
  h+='<div class="cal-head"><div class="cal-th-hora" style="width:0"></div>';
  for(let d=1;d<=5;d++) h+=`<div class="cal-th">${diasNm[d-1]}</div>`;
  h+='</div>';

  h+=`<div class="cal-body"><div class="cal-hora-col" style="height:${totalPx}px">`;
  for(let hi=startH;hi<=endH;hi++){
    h+=`<div class="cal-hora-lbl" style="top:${(hi-startH)*PX_H-7}px">${String(hi).padStart(2,'0')}:00</div>`;
  }
  h+=`</div><div class="cal-dias-wrap" style="height:${totalPx}px">`;

  for(let hi=startH;hi<=endH;hi++) h+=`<div class="cal-hline" style="top:${(hi-startH)*PX_H}px"></div>`;
  for(let hi=startH;hi<endH;hi++) h+=`<div class="cal-hline cal-hline-half" style="top:${(hi-startH)*PX_H+PX_H/2}px"></div>`;

  for(let d=1;d<=5;d++){
    const {nCols,assign}=subColsParaDia(d);
    const leftPct=((d-1)/5*100).toFixed(3);
    const widPct=(1/5*100).toFixed(3);
    h+=`<div class="cal-dia-col" style="left:${leftPct}%;width:${widPct}%">`;
    h+='<div class="cal-dia-sep"></div>';
    blocos.filter(b=>b.bloco.dia_semana===d).forEach(({turma,bloco})=>{
      const col=assign[bloco.id]||0;
      const lft=(col/nCols*100).toFixed(2)+'%';
      const wid=(1/nCols*100).toFixed(2)+'%';
      const s=hToM(bloco.hora_inicio), e=hToM(bloco.hora_fim);
      const top=((s/60)-startH)*PX_H;
      const ht=Math.max(((e-s)/60)*PX_H-2,20);
      const cor=corTurma(turma.id);
      h+=`<div class="cal-ev" style="top:${top}px;height:${ht}px;left:${lft};width:${wid};background:${cor}" onclick="abrirFichaTurma('${turma.id}')">
        <div class="cal-ev-nome">${escapeHtml(turma.nome)}</div>
        <div class="cal-ev-hora">${fmtHora(bloco.hora_inicio)}–${fmtHora(bloco.hora_fim)}</div>
        ${bloco.local?`<div class="cal-ev-local">${escapeHtml(bloco.local)}</div>`:''}
      </div>`;
    });
    h+='</div>';
  }
  h+='</div></div></div></div></div>';
  el.innerHTML=h;
  renderHorarioStats();
}

async function renderHorarioStats(){
  const el=document.getElementById('horario-stats');
  if(!el) return;
  if(!ANO_ATIVO||!TURMAS.length){ el.innerHTML=''; return; }

  const totalTurmas=TURMAS.length;
  let totalAlunos=0;
  for(const t of TURMAS){
    const ms=await sbGet('matriculas',`turma_id=eq.${t.id}&estado=eq.ativo&select=id`);
    totalAlunos+=ms.length;
  }

  // % de faltas nos últimos 30 dias, across todas as turmas do professor
  const desde=new Date(); desde.setDate(desde.getDate()-30);
  const desdeStr=desde.toISOString().slice(0,10);
  let totalRegistos=0,totalFaltas=0;
  for(const t of TURMAS){
    const regs=await sbGet('assiduidade',`turma_id=eq.${t.id}&data=gte.${desdeStr}&select=estado`);
    totalRegistos+=regs.length;
    totalFaltas+=regs.filter(r=>r.estado==='falta'||r.estado==='falta_justificada').length;
  }
  const pctFaltas = totalRegistos ? ((totalFaltas/totalRegistos)*100).toFixed(1) : '—';

  // total de blocos de horário (aulas semanais)
  const totalBlocos=TURMAS.reduce((acc,t)=>acc+(t.horario||[]).length,0);

  el.innerHTML=`
    <div class="stat"><div class="stat-val">${totalTurmas}</div><div class="stat-lbl">Turmas</div></div>
    <div class="stat g"><div class="stat-val">${totalAlunos}</div><div class="stat-lbl">Alunos</div></div>
    <div class="stat o"><div class="stat-val">${totalBlocos}</div><div class="stat-lbl">Aulas / semana</div></div>
    <div class="stat r"><div class="stat-val">${pctFaltas}${pctFaltas!=='—'?'%':''}</div><div class="stat-lbl">Faltas (30 dias)</div></div>
  `;
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
  const avisoEl=document.getElementById('ud-pesos-aviso');
  if(!UDS_TURMA.length){
    el.innerHTML='<div class="empty">Ainda não criou nenhuma unidade didática para esta turma.</div>';
    if(avisoEl)avisoEl.innerHTML='';
    return;
  }

  const componentesSoltos = ANO_ATIVO ? await sbGet('componentes_soltos',`ano_letivo_id=eq.${ANO_ATIVO.id}`) : [];
  const somaComponentesSoltos=componentesSoltos.reduce((acc,c)=>acc+(parseFloat(c.peso)||0),0);

  // agrupar por período para mostrar a soma de pesos de cada um
  const porPeriodo={};
  UDS_TURMA.forEach(ud=>{ (porPeriodo[ud.periodo_id]=porPeriodo[ud.periodo_id]||[]).push(ud); });

  let avisoHtml='';
  Object.entries(porPeriodo).forEach(([periodoId,uds])=>{
    const periodo=PERIODOS.find(p=>p.id===periodoId);
    const somaModalidades=uds.reduce((acc,u)=>acc+(parseFloat(u.peso_periodo)||0),0);
    const total=somaModalidades+somaComponentesSoltos;
    const ok=Math.abs(total-100)<0.01;
    avisoHtml+=`<div class="card" style="margin-bottom:10px;border-left:3px solid ${ok?'var(--green)':'var(--orange)'}">
      <div class="card-body" style="padding:10px 14px;font-size:.78rem">
        <strong>${periodo?escapeHtml(periodo.nome):'Período'}:</strong>
        modalidades ${somaModalidades.toFixed(1)}% + componentes do ano ${somaComponentesSoltos.toFixed(1)}% = ${total.toFixed(1)}%
        ${ok?' <span style="color:var(--green)">✓ pronto para calcular nota final</span>':' <span style="color:var(--orange)">(tem de somar 100% para a nota final ser calculada)</span>'}
      </div>
    </div>`;
  });
  if(avisoEl)avisoEl.innerHTML=avisoHtml;

  let html='';
  for(const ud of UDS_TURMA){
    const periodo=PERIODOS.find(p=>p.id===ud.periodo_id);
    html+=`<div class="card">
      <div class="card-hdr">
        <div><h2>${escapeHtml(ud.modalidade)} ${ud.peso_periodo!=null?`<span class="badge" style="background:var(--brand-light);color:var(--brand);margin-left:6px">${ud.peso_periodo}%</span>`:''}</h2><p>${periodoLabel(periodo)}${ud.data_inicio?' · '+fmtData(ud.data_inicio)+' a '+fmtData(ud.data_fim):''}</p></div>
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
  document.getElementById('mud-peso').value='';
  populateModalPeriodoSelect();
  _criterioRows=[{nome:'',peso:0}];
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
  document.getElementById('mud-peso').value=ud.peso_periodo??'';
  populateModalPeriodoSelect(ud.periodo_id);
  const criterios=await sbGet('criterios_avaliacao',`unidade_didatica_id=eq.${udId}&order=ordem`);
  _criterioRows=criterios.length?criterios.map(c=>({id:c.id,nome:c.nome,peso:c.peso||0})):[{nome:'',peso:0}];
  renderCriterioRows();
  openModal('modal-ud');
}

function populateModalPeriodoSelect(selectedId){
  const sel=document.getElementById('mud-periodo');
  sel.innerHTML=PERIODOS.map(p=>`<option value="${p.id}" ${p.id===selectedId?'selected':''}>${escapeHtml(periodoLabel(p))}</option>`).join('');
}

function renderCriterioRows(){
  const el=document.getElementById('mud-criterios-rows');
  const somaPesos=_criterioRows.reduce((acc,c)=>acc+(parseFloat(c.peso)||0),0);
  el.innerHTML=_criterioRows.map((c,i)=>`
    <div class="flex" style="margin-bottom:6px">
      <input class="inp inp-sm" placeholder="Ex: Receção" value="${escapeHtml(c.nome)}" onchange="_criterioRows[${i}].nome=this.value" style="flex:2">
      <input class="inp inp-sm" type="number" min="0" max="100" step="0.1" placeholder="Peso %" value="${c.peso||''}" onchange="_criterioRows[${i}].peso=parseFloat(this.value)||0;renderCriterioRows()" style="flex:1;max-width:90px">
      <button class="btn btn-danger btn-xs" onclick="removeCriterioRow(${i})">✕</button>
    </div>`).join('')+
    `<div style="font-size:.72rem;margin-top:4px;color:${Math.abs(somaPesos-100)<0.01?'var(--green)':'var(--red)'}">Soma dos pesos: ${somaPesos.toFixed(1)}% ${Math.abs(somaPesos-100)<0.01?'✓':'(tem de somar 100%)'}</div>`;
}
function addCriterioRow(){_criterioRows.push({nome:'',peso:0});renderCriterioRows();}
function removeCriterioRow(i){_criterioRows.splice(i,1);renderCriterioRows();}

async function saveUD(){
  const id=document.getElementById('mud-id').value;
  const modalidade=document.getElementById('mud-modalidade').value.trim();
  if(!modalidade){alert('Indique a modalidade.');return;}
  const periodoId=document.getElementById('mud-periodo').value;
  if(!periodoId){alert('Não há períodos disponíveis. Crie um ano letivo com períodos primeiro.');return;}
  const pesoPeriodo=document.getElementById('mud-peso').value;
  const nomesValidos=_criterioRows.filter(c=>c.nome.trim());
  if(nomesValidos.length){
    const somaPesos=nomesValidos.reduce((acc,c)=>acc+(parseFloat(c.peso)||0),0);
    if(Math.abs(somaPesos-100)>0.01){alert(`Os pesos dos critérios têm de somar 100%. Atualmente somam ${somaPesos.toFixed(1)}%.`);return;}
  }
  const body={
    modalidade,
    periodo_id:periodoId,
    data_inicio:document.getElementById('mud-inicio').value||null,
    data_fim:document.getElementById('mud-fim').value||null,
    numero_aulas_previstas:parseInt(document.getElementById('mud-aulas').value)||null,
    peso_periodo:pesoPeriodo===''?null:parseFloat(pesoPeriodo),
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
  for(let i=0;i<nomesValidos.length;i++){
    await sbPost('criterios_avaliacao',{unidade_didatica_id:udId,nome:nomesValidos[i].nome.trim(),peso:parseFloat(nomesValidos[i].peso)||0,ordem:i});
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

// converte nível 1-5 para escala 0-20
function nivelParaVinte(nivel){
  if(nivel==null) return null;
  return ((nivel-1)/4)*20;
}

// Calcula a nota de uma modalidade (0-20) a partir dos critérios ponderados, para um aluno
function calcularNotaModalidade(criterios,avaliacoesCriterio,alunoId){
  let somaPesoUsado=0,somaPonderada=0,faltaAlgum=false;
  criterios.forEach(c=>{
    const nivel=avaliacoesCriterio[c.id]?.[alunoId];
    const peso=parseFloat(c.peso)||0;
    if(nivel==null){ faltaAlgum=true; return; }
    somaPonderada+=nivelParaVinte(nivel)*(peso/100);
    somaPesoUsado+=peso;
  });
  if(faltaAlgum||!criterios.length) return null; // só calcula quando todos os critérios estão avaliados
  return somaPonderada;
}

// Carrega tudo o que é preciso para calcular as notas finais de um período, para todas as UDs desse período
async function carregarDadosCalculoPeriodo(periodoId){
  const udsPeriodo=UDS_TURMA.filter(u=>u.periodo_id===periodoId);
  const componentesSoltos = ANO_ATIVO ? await sbGet('componentes_soltos',`ano_letivo_id=eq.${ANO_ATIVO.id}&order=ordem`) : [];

  const udsComCriterios=[];
  for(const ud of udsPeriodo){
    const criterios=await sbGet('criterios_avaliacao',`unidade_didatica_id=eq.${ud.id}&order=ordem`);
    let avaliacoesCriterio={};
    if(criterios.length){
      const ids=criterios.map(c=>c.id).join(',');
      const avals=await sbGet('avaliacoes_criterio',`criterio_id=in.(${ids})`);
      avals.forEach(a=>{ (avaliacoesCriterio[a.criterio_id]=avaliacoesCriterio[a.criterio_id]||{})[a.aluno_id]=a.nivel_pnef; });
    }
    udsComCriterios.push({ud,criterios,avaliacoesCriterio});
  }

  let avaliacoesComponentes={};
  if(componentesSoltos.length){
    const ids=componentesSoltos.map(c=>c.id).join(',');
    const avals=await sbGet('avaliacoes_componente_solto',`componente_id=in.(${ids})&periodo_id=eq.${periodoId}`);
    avals.forEach(a=>{ (avaliacoesComponentes[a.componente_id]=avaliacoesComponentes[a.componente_id]||{})[a.aluno_id]=a.nivel_pnef; });
  }

  const somaModalidades=udsPeriodo.reduce((acc,u)=>acc+(parseFloat(u.peso_periodo)||0),0);
  const somaComponentes=componentesSoltos.reduce((acc,c)=>acc+(parseFloat(c.peso)||0),0);
  const pesosOk=Math.abs(somaModalidades+somaComponentes-100)<0.01;

  return {udsComCriterios,componentesSoltos,avaliacoesComponentes,pesosOk,somaModalidades,somaComponentes};
}

// Calcula a nota final (0-20) de um aluno num período, ou null se faltar avaliar algo
function calcularNotaFinalAluno(alunoId,dados){
  const {udsComCriterios,componentesSoltos,avaliacoesComponentes,pesosOk}=dados;
  if(!pesosOk) return {nota:null,motivo:'pesos'};

  let soma=0,faltaAlgum=false;
  const detalhe=[];

  udsComCriterios.forEach(({ud,criterios,avaliacoesCriterio})=>{
    const notaMod=calcularNotaModalidade(criterios,avaliacoesCriterio,alunoId);
    const peso=parseFloat(ud.peso_periodo)||0;
    if(notaMod==null){ faltaAlgum=true; detalhe.push(`${ud.modalidade}: pendente`); return; }
    soma+=notaMod*(peso/100);
    detalhe.push(`${ud.modalidade}: ${notaMod.toFixed(1)} (${peso}%)`);
  });

  componentesSoltos.forEach(c=>{
    const nivel=avaliacoesComponentes[c.id]?.[alunoId];
    const peso=parseFloat(c.peso)||0;
    if(nivel==null){ faltaAlgum=true; detalhe.push(`${c.nome}: pendente`); return; }
    const nota20=nivelParaVinte(nivel);
    soma+=nota20*(peso/100);
    detalhe.push(`${c.nome}: nível ${nivel} (${peso}%)`);
  });

  if(faltaAlgum) return {nota:null,motivo:'incompleto',detalhe};
  return {nota:soma,motivo:null,detalhe};
}

async function renderAvaliacaoPeriodo(){
  const periodoId=document.getElementById('aval-periodo').value;
  if(!periodoId)return;
  const turma=TURMAS.find(t=>t.id===CURRENT_TURMA_ID);
  const usaPNEF = turma.nivel_ensino!=='secundario';
  document.getElementById('aval-th-nota').textContent = 'Nota final (0-20)';

  const dados=await carregarDadosCalculoPeriodo(periodoId);
  const avisoEl=document.getElementById('aval-pesos-aviso');
  if(!dados.pesosOk){
    avisoEl.innerHTML=`<div class="card" style="border-left:3px solid var(--orange);margin-bottom:14px"><div class="card-body" style="padding:10px 14px;font-size:.78rem;color:var(--orange)">
      Os pesos deste período ainda não somam 100% (modalidades ${dados.somaModalidades.toFixed(1)}% + componentes ${dados.somaComponentes.toFixed(1)}%). Ajuste os pesos em Unidades Didáticas e em Admin → Componentes de avaliação antes de calcular as notas finais.
    </div></div>`;
  }else{
    avisoEl.innerHTML='';
  }

  renderComponentesSoltosAvaliacao(periodoId,dados);

  const registos=await sbGet('avaliacoes_periodo',`turma_id=eq.${CURRENT_TURMA_ID}&periodo_id=eq.${periodoId}`);
  const porAluno={};
  registos.forEach(r=>porAluno[r.aluno_id]=r);

  const tb=document.getElementById('aval-tb');
  if(!ALUNOS_TURMA.length){
    tb.innerHTML='<tr><td colspan="4"><div class="empty">Sem alunos nesta turma.</div></td></tr>';
    return;
  }

  tb.innerHTML=ALUNOS_TURMA.map(a=>{
    const resultado=calcularNotaFinalAluno(a.id,dados);
    const reg=porAluno[a.id];
    let notaDisplay;
    if(resultado.nota==null){
      notaDisplay=`<span style="color:var(--text3);font-size:.75rem">${resultado.motivo==='pesos'?'pesos incompletos':'avaliação incompleta'}</span>`;
    }else{
      const nota20=resultado.nota;
      const notaFmt = usaPNEF ? `${(1+(nota20/20)*4).toFixed(1)} (PNEF)` : nota20.toFixed(1);
      notaDisplay=`<strong>${notaFmt}</strong>`;
      // guardar/atualizar automaticamente a nota calculada
      const bodyCalc={aluno_id:a.id,turma_id:CURRENT_TURMA_ID,periodo_id:periodoId};
      if(usaPNEF){ bodyCalc.nivel_pnef=Math.round((1+(nota20/20)*4)*10)/10; bodyCalc.nota_quantitativa=Math.round(nota20*10)/10; }
      else{ bodyCalc.nota_quantitativa=Math.round(nota20*10)/10; bodyCalc.nivel_pnef=null; }
      if(reg) bodyCalc.observacoes=reg.observacoes;
      sbUpsert('avaliacoes_periodo',bodyCalc,'aluno_id,periodo_id');
    }
    const detalheStr=resultado.detalhe?resultado.detalhe.join(' · '):'';
    return `<tr>
      <td>${escapeHtml(a.nome)}</td>
      <td>${notaDisplay}</td>
      <td style="font-size:.68rem;color:var(--text3)">${escapeHtml(detalheStr)}</td>
      <td><input class="inp inp-sm" value="${escapeHtml(reg?.observacoes||'')}" onchange="setNotaPeriodoObs('${a.id}','${periodoId}',this.value)"></td>
    </tr>`;
  }).join('');
}

async function setNotaPeriodoObs(alunoId,periodoId,observacoes){
  const existentes=await sbGet('avaliacoes_periodo',`aluno_id=eq.${alunoId}&periodo_id=eq.${periodoId}`);
  const base=existentes[0]||{aluno_id:alunoId,turma_id:CURRENT_TURMA_ID,periodo_id:periodoId,nivel_pnef:null,nota_quantitativa:null};
  base.observacoes=observacoes||null;
  await sbUpsert('avaliacoes_periodo',base,'aluno_id,periodo_id');
}

// ── Avaliação dos componentes soltos (Comportamento, Assiduidade...) por aluno, por período ──
function renderComponentesSoltosAvaliacao(periodoId,dados){
  const el=document.getElementById('aval-componentes-soltos');
  const {componentesSoltos,avaliacoesComponentes}=dados;
  if(!componentesSoltos.length){ el.innerHTML=''; return; }
  let html='';
  componentesSoltos.forEach(c=>{
    html+=`<div class="card">
      <div class="card-hdr"><h2>${escapeHtml(c.nome)} <span class="badge" style="background:var(--brand-light);color:var(--brand);margin-left:6px">${c.peso}%</span></h2></div>
      <div class="card-body" style="padding:0"><div class="tbl-wrap"><table>
        <thead><tr><th>Aluno</th><th>Nível (1-5)</th></tr></thead>
        <tbody>`;
    ALUNOS_TURMA.forEach(a=>{
      const atual=avaliacoesComponentes[c.id]?.[a.id];
      html+=`<tr><td>${escapeHtml(a.nome)}</td><td><div class="nivel-row">`+
        [1,2,3,4,5].map(n=>`<button class="nivel-pill ${atual===n?'active':''}" onclick="setNivelComponenteSolto('${c.id}','${a.id}','${periodoId}',${n},this)">${n}</button>`).join('')+
        `</div></td></tr>`;
    });
    html+='</tbody></table></div></div></div>';
  });
  el.innerHTML=html;
}

async function setNivelComponenteSolto(componenteId,alunoId,periodoId,nivel,btnEl){
  await sbUpsert('avaliacoes_componente_solto',{componente_id:componenteId,aluno_id:alunoId,periodo_id:periodoId,nivel_pnef:nivel},'componente_id,aluno_id,periodo_id');
  const row=btnEl.closest('.nivel-row');
  row.querySelectorAll('.nivel-pill').forEach(b=>b.classList.remove('active'));
  btnEl.classList.add('active');
  // recalcular notas finais já que este valor influencia o cálculo
  renderAvaliacaoPeriodo();
}

// ═══════════════════════════════════════════════════
// ADMIN — professores e anos letivos
// ═══════════════════════════════════════════════════
async function loadAdmin(){
  await renderUtilizadores();
  await renderAnosLetivos();
  await renderComponentesSoltos();
}

// ── COMPONENTES DE AVALIAÇÃO SOLTOS (Comportamento, Assiduidade...) ──
async function renderComponentesSoltos(){
  const tb=document.getElementById('componentes-soltos-tb');
  const avisoEl=document.getElementById('componentes-soltos-aviso');
  if(!ANO_ATIVO){ tb.innerHTML='<tr><td colspan="3"><div class="empty">Sem ano letivo ativo.</div></td></tr>'; avisoEl.innerHTML=''; return; }
  const componentes=await sbGet('componentes_soltos',`ano_letivo_id=eq.${ANO_ATIVO.id}&order=ordem`);
  window._componentesSoltosCache=componentes;
  if(!componentes.length){
    tb.innerHTML='<tr><td colspan="3"><div class="empty">Nenhum componente criado para este ano letivo.</div></td></tr>';
  }else{
    tb.innerHTML=componentes.map(c=>`
      <tr>
        <td>${escapeHtml(c.nome)}</td>
        <td>${c.peso}%</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="editarComponenteSolto('${c.id}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="apagarComponenteSolto('${c.id}','${escapeHtml(c.nome)}')">Apagar</button>
        </td>
      </tr>`).join('');
  }
  const soma=componentes.reduce((acc,c)=>acc+(parseFloat(c.peso)||0),0);
  avisoEl.innerHTML=`<div style="font-size:.78rem;color:var(--text2)">Soma dos pesos destes componentes: <strong>${soma.toFixed(1)}%</strong> (o restante até 100% deve vir das modalidades de cada período)</div>`;
}

function openModalComponenteSolto(){
  document.getElementById('mcs-id').value='';
  document.getElementById('mcs-title').textContent='Novo Componente de Avaliação';
  document.getElementById('mcs-nome').value='';
  document.getElementById('mcs-peso').value='';
  openModal('modal-componente-solto');
}

function editarComponenteSolto(id){
  const c=(window._componentesSoltosCache||[]).find(x=>x.id===id);
  if(!c)return;
  document.getElementById('mcs-id').value=c.id;
  document.getElementById('mcs-title').textContent='Editar Componente de Avaliação';
  document.getElementById('mcs-nome').value=c.nome;
  document.getElementById('mcs-peso').value=c.peso;
  openModal('modal-componente-solto');
}

async function saveComponenteSolto(){
  if(!ANO_ATIVO){alert('Sem ano letivo ativo.');return;}
  const id=document.getElementById('mcs-id').value;
  const nome=document.getElementById('mcs-nome').value.trim();
  const peso=parseFloat(document.getElementById('mcs-peso').value);
  if(!nome||isNaN(peso)){alert('Indique nome e peso.');return;}
  if(id){
    await sbPatch('componentes_soltos',`id=eq.${id}`,{nome,peso});
  }else{
    const existentes=window._componentesSoltosCache||[];
    await sbPost('componentes_soltos',{ano_letivo_id:ANO_ATIVO.id,nome,peso,ordem:existentes.length});
  }
  closeModal('modal-componente-solto');
  renderComponentesSoltos();
}

async function apagarComponenteSolto(id,nome){
  if(!confirm(`Apagar o componente "${nome}"? Isto também remove as avaliações já lançadas para ele.`))return;
  await sbDel('componentes_soltos',`id=eq.${id}`);
  renderComponentesSoltos();
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
        <button class="btn btn-outline btn-xs" onclick="editarUtilizador('${u.id}')">Editar</button>
        <button class="btn btn-outline btn-xs" onclick="toggleEstadoUtilizador('${u.id}','${u.estado}')">${u.estado==='ativo'?'Desativar':'Ativar'}</button>
        <button class="btn btn-danger btn-xs" onclick="apagarUtilizador('${u.id}','${escapeHtml(u.nome)}')">Apagar</button>
      </td>
    </tr>`).join('');
  window._utilizadoresCache=utils;
}

function openModalUtilizador(){
  document.getElementById('mu-id').value='';
  document.getElementById('mu-title').textContent='Novo Professor';
  document.getElementById('mu-nome').value='';
  document.getElementById('mu-codigo').value='';
  document.getElementById('mu-papel').value='professor';
  openModal('modal-utilizador');
}

function editarUtilizador(id){
  const u=(window._utilizadoresCache||[]).find(x=>x.id===id);
  if(!u)return;
  document.getElementById('mu-id').value=u.id;
  document.getElementById('mu-title').textContent='Editar Professor';
  document.getElementById('mu-nome').value=u.nome;
  document.getElementById('mu-codigo').value=u.codigo;
  document.getElementById('mu-papel').value=u.papel;
  openModal('modal-utilizador');
}

async function saveUtilizador(){
  const id=document.getElementById('mu-id').value;
  const nome=document.getElementById('mu-nome').value.trim();
  const codigo=document.getElementById('mu-codigo').value.trim();
  const papelSel=document.getElementById('mu-papel').value;
  if(!nome||!codigo){alert('Indique nome e código.');return;}
  const existe=await sbGet('utilizadores',`codigo=eq.${encodeURIComponent(codigo)}`);
  const conflito=existe.find(u=>u.id!==id);
  if(conflito){alert('Já existe um utilizador com esse código.');return;}
  if(id){
    await sbPatch('utilizadores',`id=eq.${id}`,{nome,codigo,papel:papelSel});
    if(CU&&CU.id===id){ CU.nome=nome;CU.codigo=codigo;CU.papel=papelSel; document.getElementById('user-nome').textContent=nome; }
  }else{
    await sbPost('utilizadores',{nome,codigo,papel:papelSel,estado:'ativo'});
  }
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

// ── PERFIL (qualquer professor pode mudar o seu próprio código) ──
function openModalPerfil(){
  document.getElementById('mp-nome').value=CU.nome;
  document.getElementById('mp-codigo').value=CU.codigo;
  openModal('modal-perfil');
}

async function savePerfil(){
  const nome=document.getElementById('mp-nome').value.trim();
  const codigo=document.getElementById('mp-codigo').value.trim();
  if(!nome||!codigo){alert('Indique nome e código.');return;}
  if(codigo!==CU.codigo){
    const existe=await sbGet('utilizadores',`codigo=eq.${encodeURIComponent(codigo)}`);
    if(existe.length){alert('Já existe um utilizador com esse código. Escolha outro.');return;}
  }
  await sbPatch('utilizadores',`id=eq.${CU.id}`,{nome,codigo});
  CU.nome=nome;CU.codigo=codigo;
  document.getElementById('user-nome').textContent=nome;
  closeModal('modal-perfil');
  alert('Perfil atualizado.');
}

async function renderAnosLetivos(){
  const anos=await sbGet('anos_letivos','order=data_inicio.desc');
  const tb=document.getElementById('anos-tb');
  tb.innerHTML=anos.map(a=>`
    <tr>
      <td>${escapeHtml(a.nome)}</td>
      <td>${fmtData(a.data_inicio)}</td>
      <td>${fmtData(a.data_fim)}</td>
      <td>${a.tipo_periodo==='semestre'?'2 períodos':'3 períodos'}</td>
      <td><span class="badge" style="background:${a.ativo?'var(--green-light)':'var(--gray-light)'};color:${a.ativo?'var(--green)':'var(--text3)'}">${a.ativo?'Ativo':'Inativo'}</span></td>
      <td>
        ${a.ativo?'':`<button class="btn btn-outline btn-xs" onclick="ativarAnoLetivo('${a.id}')">Ativar</button>`}
        <button class="btn btn-outline btn-xs" onclick="editarAnoLetivo('${a.id}')">Editar</button>
        <button class="btn btn-outline btn-xs" onclick="abrirModalPeriodos('${a.id}')">Períodos</button>
        ${a.ativo?'':`<button class="btn btn-danger btn-xs" onclick="apagarAnoLetivo('${a.id}','${escapeHtml(a.nome)}')">Apagar</button>`}
      </td>
    </tr>`).join('');
  window._anosCache=anos;
}

function openModalAnoLetivo(){
  document.getElementById('mal-id').value='';
  document.getElementById('mal-title').textContent='Novo Ano Letivo';
  document.getElementById('mal-nome').value='';
  document.getElementById('mal-inicio').value='';
  document.getElementById('mal-fim').value='';
  document.getElementById('mal-tipo-periodo').value='trimestre';
  document.getElementById('mal-tipo-periodo').disabled=false;
  document.getElementById('mal-aviso').textContent='Serão criados os períodos automaticamente com base nestas datas; pode ajustar as datas de cada período depois, no botão "Períodos".';
  openModal('modal-ano-letivo');
}

function editarAnoLetivo(id){
  const a=(window._anosCache||[]).find(x=>x.id===id);
  if(!a)return;
  document.getElementById('mal-id').value=a.id;
  document.getElementById('mal-title').textContent='Editar Ano Letivo';
  document.getElementById('mal-nome').value=a.nome;
  document.getElementById('mal-inicio').value=a.data_inicio;
  document.getElementById('mal-fim').value=a.data_fim;
  document.getElementById('mal-tipo-periodo').value=a.tipo_periodo||'trimestre';
  // não permite mudar o tipo de período depois de criado, para não invalidar avaliações já feitas
  document.getElementById('mal-tipo-periodo').disabled=true;
  document.getElementById('mal-aviso').textContent='O tipo de avaliação (2 ou 3 períodos) não pode ser alterado depois de criado o ano letivo, para não afetar avaliações já lançadas. Para mudar, apague este ano letivo e crie um novo.';
  openModal('modal-ano-letivo');
}

async function saveAnoLetivo(){
  const id=document.getElementById('mal-id').value;
  const nome=document.getElementById('mal-nome').value.trim();
  const inicio=document.getElementById('mal-inicio').value;
  const fim=document.getElementById('mal-fim').value;
  const tipoPeriodo=document.getElementById('mal-tipo-periodo').value;
  if(!nome||!inicio||!fim){alert('Preencha todos os campos.');return;}

  if(id){
    // apenas editar nome/datas; tipo_periodo e períodos mantêm-se
    await sbPatch('anos_letivos',`id=eq.${id}`,{nome,data_inicio:inicio,data_fim:fim});
    closeModal('modal-ano-letivo');
    renderAnosLetivos();
    return;
  }

  const r=await sbPost('anos_letivos',{nome,data_inicio:inicio,data_fim:fim,ativo:false,tipo_periodo:tipoPeriodo});
  const anoId=r[0].id;
  const nPeriodos = tipoPeriodo==='semestre' ? 2 : 3;
  const nomesPeriodos = tipoPeriodo==='semestre' ? ['1º Semestre','2º Semestre'] : ['1º Período','2º Período','3º Período'];
  // criar períodos distribuídos igualmente entre as datas
  const dIni=new Date(inicio+'T00:00:00');
  const dFim=new Date(fim+'T00:00:00');
  const totalDias=(dFim-dIni)/(1000*60*60*24);
  const passo=Math.floor(totalDias/nPeriodos);
  for(let i=0;i<nPeriodos;i++){
    const pIni=new Date(dIni); pIni.setDate(pIni.getDate()+i*passo+(i>0?1:0));
    const pFim=i<nPeriodos-1 ? new Date(dIni.getTime()+ (i+1)*passo*86400000) : dFim;
    await sbPost('periodos',{
      ano_letivo_id:anoId,numero:i+1,nome:nomesPeriodos[i],
      data_inicio:pIni.toISOString().slice(0,10),
      data_fim:pFim.toISOString().slice(0,10),
    });
  }
  closeModal('modal-ano-letivo');
  renderAnosLetivos();
}

// ── PERÍODOS EDITÁVEIS (datas definidas pelo professor) ──
let _periodosRows=[];
async function abrirModalPeriodos(anoId){
  const ano=(window._anosCache||[]).find(a=>a.id===anoId);
  document.getElementById('mper-ano-id').value=anoId;
  document.getElementById('mper-title').textContent=`Períodos — ${ano?escapeHtml(ano.nome):''}`;
  const periodos=await sbGet('periodos',`ano_letivo_id=eq.${anoId}&order=numero`);
  _periodosRows=periodos.map(p=>({id:p.id,numero:p.numero,nome:p.nome,data_inicio:p.data_inicio,data_fim:p.data_fim}));
  renderPeriodosRows();
  openModal('modal-periodos');
}

function renderPeriodosRows(){
  const el=document.getElementById('mper-rows');
  el.innerHTML=_periodosRows.map((p,i)=>`
    <div class="grid3" style="margin-bottom:10px;align-items:end">
      <div style="font-weight:600;font-size:.82rem;padding-bottom:8px">${escapeHtml(p.nome)}</div>
      <div><label style="display:block;font-size:.68rem;color:var(--text3);margin-bottom:3px">Início</label>
        <input class="inp inp-sm" type="date" value="${p.data_inicio||''}" onchange="_periodosRows[${i}].data_inicio=this.value">
      </div>
      <div><label style="display:block;font-size:.68rem;color:var(--text3);margin-bottom:3px">Fim</label>
        <input class="inp inp-sm" type="date" value="${p.data_fim||''}" onchange="_periodosRows[${i}].data_fim=this.value">
      </div>
    </div>`).join('');
}

async function savePeriodos(){
  for(const p of _periodosRows){
    if(!p.data_inicio||!p.data_fim){alert(`Preencha as datas de início e fim do "${p.nome}".`);return;}
    if(p.data_fim<p.data_inicio){alert(`No "${p.nome}", a data de fim não pode ser anterior à data de início.`);return;}
  }
  for(const p of _periodosRows){
    await sbPatch('periodos',`id=eq.${p.id}`,{data_inicio:p.data_inicio,data_fim:p.data_fim});
  }
  closeModal('modal-periodos');
  // se o ano editado for o ativo, refrescar PERIODOS em memória para refletir nas avaliações
  const anoId=document.getElementById('mper-ano-id').value;
  if(ANO_ATIVO&&ANO_ATIVO.id===anoId){
    PERIODOS=await sbGet('periodos',`ano_letivo_id=eq.${anoId}&order=numero`);
  }
  alert('Períodos atualizados.');
}

async function apagarAnoLetivo(id,nome){
  if(!confirm(`Apagar o ano letivo "${nome}"? Isto apaga também os seus períodos, turmas, alunos matriculados nessas turmas e respetivas avaliações/assiduidade. Esta ação não pode ser desfeita.`))return;
  await sbDel('anos_letivos',`id=eq.${id}`);
  renderAnosLetivos();
}

async function ativarAnoLetivo(id){
  if(!confirm('Ativar este ano letivo? O ano letivo atualmente ativo será desativado e todas as suas turmas (com alunos, assiduidade e avaliações) ficam arquivadas automaticamente, disponíveis em Histórico.'))return;
  const anoAtivoAtual=(window._anosCache||[]).find(a=>a.ativo);
  if(anoAtivoAtual){
    // arquivar automaticamente todas as turmas do ano que está a deixar de ser ativo
    await sbPatch('turmas',`ano_letivo_id=eq.${anoAtivoAtual.id}`,{arquivada:true});
  }
  await sbPatch('anos_letivos','ativo=eq.true',{ativo:false});
  await sbPatch('anos_letivos',`id=eq.${id}`,{ativo:true});
  alert('Ano letivo ativado. As turmas do ano anterior foram arquivadas automaticamente. A página vai recarregar.');
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

async function populateRelatoriosFiltros(){
  const optsTurmas='<option value="">Todas</option>'+TURMAS.map(t=>`<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
  document.getElementById('rel-turmas-turma').innerHTML='<option value="">Todas as turmas</option>'+TURMAS.map(t=>`<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
  document.getElementById('rel-assid-turma').innerHTML=optsTurmas;
  document.getElementById('rel-aval-turma').innerHTML=optsTurmas;
  document.getElementById('rel-aval-periodo').innerHTML='<option value="">Todos</option>'+PERIODOS.map(p=>`<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');

  // alunos: carregar todos os alunos matriculados em qualquer turma do professor
  const todasMatriculas=[];
  for(const t of TURMAS){
    const ms=await sbGet('matriculas',`turma_id=eq.${t.id}&estado=eq.ativo&select=*,alunos(*)`);
    ms.forEach(m=>todasMatriculas.push({turma_id:t.id,...m.alunos}));
  }
  const optsAlunos='<option value="">Todos</option>'+todasMatriculas.sort((a,b)=>a.nome.localeCompare(b.nome)).map(a=>`<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join('');
  document.getElementById('rel-assid-aluno').innerHTML=optsAlunos;
  document.getElementById('rel-aval-aluno').innerHTML=optsAlunos;
}

async function exportarRelatorio(tipo){
  if(!ANO_ATIVO){alert('Sem ano letivo ativo.');return;}

  if(tipo==='turmas'){
    const turmaId=document.getElementById('rel-turmas-turma').value;
    const turmasFiltradas = turmaId ? TURMAS.filter(t=>t.id===turmaId) : TURMAS;
    const rows=[['Turma','Nível','Aluno','Número']];
    for(const t of turmasFiltradas){
      const matriculas=await sbGet('matriculas',`turma_id=eq.${t.id}&estado=eq.ativo&select=*,alunos(*)`);
      matriculas.forEach(m=>rows.push([t.nome,nivelLabel(t.nivel_ensino),m.alunos.nome,m.alunos.numero||'']));
    }
    downloadCsv('turmas.csv',rows);

  }else if(tipo==='assiduidade'){
    const turmaId=document.getElementById('rel-assid-turma').value;
    const alunoId=document.getElementById('rel-assid-aluno').value;
    const de=document.getElementById('rel-assid-de').value;
    const ate=document.getElementById('rel-assid-ate').value;
    const turmasFiltradas = turmaId ? TURMAS.filter(t=>t.id===turmaId) : TURMAS;
    const rows=[['Turma','Data','Aluno','Estado','Observações']];
    for(const t of turmasFiltradas){
      let q=`turma_id=eq.${t.id}&select=*,alunos(nome)&order=data`;
      if(alunoId) q+=`&aluno_id=eq.${alunoId}`;
      if(de) q+=`&data=gte.${de}`;
      if(ate) q+=`&data=lte.${ate}`;
      const registos=await sbGet('assiduidade',q);
      registos.forEach(r=>rows.push([t.nome,fmtData(r.data),r.alunos.nome,estadoLabel(r.estado),r.observacoes||'']));
    }
    downloadCsv('assiduidade.csv',rows);

  }else if(tipo==='avaliacao'){
    const turmaId=document.getElementById('rel-aval-turma').value;
    const alunoId=document.getElementById('rel-aval-aluno').value;
    const periodoId=document.getElementById('rel-aval-periodo').value;
    const turmasFiltradas = turmaId ? TURMAS.filter(t=>t.id===turmaId) : TURMAS;
    const rows=[['Turma','Período','Aluno','Nível PNEF','Nota (0-20)','Observações']];
    for(const t of turmasFiltradas){
      let q=`turma_id=eq.${t.id}&select=*,alunos(nome),periodos(nome)`;
      if(alunoId) q+=`&aluno_id=eq.${alunoId}`;
      if(periodoId) q+=`&periodo_id=eq.${periodoId}`;
      const registos=await sbGet('avaliacoes_periodo',q);
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

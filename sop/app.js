/* Evolve staff SOP page (static, GitHub Pages). Built from portal/own/SopPortalIndex.html by tools/build_pages.js: the same app
   as the Apps Script portal. No third-party scripts, no secrets. Calls the portal JSON API with credentials:'omit'. */
(function () {
var framed = true; try { framed = (window.top !== window.self); } catch (e) { framed = true; }
if (framed) { try { window.top.location = window.self.location.href; } catch (e) { /* blocked: stay blank */ } return; }
document.documentElement.classList.remove('fb-wait');
const S={token:'',me:null,data:null,run:null,view:'signin',busy:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return sessionStorage.getItem(k)||localStorage.getItem(k)||''}catch(e){return S['m_'+k]||''}},
  set(k,v,keep){try{(keep?localStorage:sessionStorage).setItem(k,v)}catch(e){S['m_'+k]=v}},
  del(k){try{sessionStorage.removeItem(k);localStorage.removeItem(k)}catch(e){delete S['m_'+k]}}};
// SOP-3 (fix round): one known-device token PER USER ID on this browser (like EE's ee_dev:<uid>), so on a shared tablet staff
// signing in one after another never overwrite each other's token and an attack on one user ID can't lock anyone else out.
const devKey=u=>'sop_dev:'+String(u||'').trim().toLowerCase();
const dev={get(u){try{return localStorage.getItem(devKey(u))||''}catch(e){return S['m_'+devKey(u)]||''}},
  set(u,v){if(!u||!v)return;try{localStorage.setItem(devKey(u),v);localStorage.removeItem('sop_dev')}catch(e){S['m_'+devKey(u)]=v}}};
// Two hosts, one app: inside Apps Script -> google.script.run; on the static page (GitHub Pages) -> the portal's JSON API
// (POST text/plain, credentials:'omit': no Google cookies are ever sent, so phones with several Google accounts work).
const API=(typeof window!=='undefined'&&window.SOP_API_URL)||'';
const HAS_GSR=typeof google!=='undefined'&&google.script&&google.script.run;
const MAP={sopPortalLogin:(u,p,k,d)=>({action:'login',userId:u,password:p,keep:k===true,deviceToken:d||''}),
  sopPortalLogout:t=>({action:'logout',token:t}),sopPortalChangePassword:(t,c,n)=>({action:'changePassword',token:t,currentPassword:c,newPassword:n}),
  sopPortalToday:t=>({action:'today',token:t}),sopPortalAction:(t,a,args)=>({action:'action',token:t,step:a,args:args||{}}),sopPortalTraining:t=>({action:'training',token:t})};
async function apiCall(fn,...a){
  if(!API) return {ok:false,error:'This page is not connected yet. Ask Patrick.'};
  const r=await fetch(API,{method:'POST',credentials:'omit',redirect:'follow',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(MAP[fn](...a))});
  if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
function call(fn,...a){ if(HAS_GSR) return new Promise((res,rej)=>google.script.run.withSuccessHandler(res).withFailureHandler(e=>rej(e))[fn](...a)); return apiCall(fn,...a); }
function signedOut(r){ if(r&&r.code==='SIGNED_OUT'){ store.del('sop_tok'); store.del('sop_uid'); S.token=''; S.view='signin'; render('Please sign in again.'); return true; }
  if(r&&r.code==='CHANGE_PASSWORD'){ S.view='pw'; render(); return true; } return false; }
function chip(r){const ready=r.status==='Open'&&r.total&&r.done+r.skipped===r.total&&r.state==='in progress'; if(ready) return '<span class="chip prog">ready to close</span>'; const c={late:'late',missed:'missed',done:'done','done late':'late','in progress':'prog'}[r.state]||''; return `<span class="chip ${c}">${esc(r.state)}</span>`+(r.unassigned&&r.status==='Open'?' <span class="chip un">Unassigned</span>':r.pool&&r.status==='Open'?' <span class="chip un">Either can take it</span>':'');}
function render(msg){
  const app=$('app'); $('out').classList.toggle('hide',!S.token);
  if(S.view==='signin'){
    app.innerHTML=`<div class="card"><h2 class="mt0">Sign in</h2><p class="meta">Use your own staff user ID. Ask Ariana or Jess if you don't have one.</p>
    <label for="u">User ID</label><input type="text" id="u" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="p">Password</label><input type="password" id="p" autocomplete="current-password">
    <label class="chk"><input type="checkbox" id="keep"> Keep me signed in on this device (my own phone only)</label>
    <button class="p w mt12" id="go">Sign in</button><div class="err" id="e">${esc(msg||'')}</div></div>`;
    $('go').onclick=login; $('p').onkeydown=e=>{if(e.key==='Enter')login();}; return;
  }
  if(S.view==='pw'){
    app.innerHTML=`<div class="card"><h2 class="mt0">Choose your password</h2><p class="meta">Your temporary password works once. Pick a new one (8+ characters) that only you know.</p>
    <label for="c">Temporary / current password</label><input type="password" id="c" autocomplete="current-password">
    <label for="n">New password</label><input type="password" id="n" autocomplete="new-password">
    <label for="n2">New password again</label><input type="password" id="n2" autocomplete="new-password">
    <button class="p w mt12" id="go">Save password</button><div class="err" id="e">${esc(msg||'')}</div></div>`;
    $('go').onclick=changePw; return;
  }
  if(S.view==='today') return renderToday(msg);
  if(S.view==='run') return renderRun(msg);
  if(S.view==='training') return renderTraining();
}
async function login(){
  const u=$('u').value.trim(), p=$('p').value, keep=$('keep').checked; if(!u||!p){$('e').textContent='Enter your user ID and password.';return;}
  $('go').disabled=true; $('e').textContent='';
  try{ const r=await call('sopPortalLogin',u,p,keep,dev.get(u));
    if(!r.ok){ $('e').textContent=r.error; $('go').disabled=false; return; }
    S.token=r.token; S.uid=u; store.set('sop_tok',r.token,keep); store.set('sop_uid',u,keep); if(r.deviceToken) dev.set(u,r.deviceToken);
    S.view=r.mustChange?'pw':'today'; if(!r.mustChange){ await load(); openDeep(); } else render();
  }catch(e){ $('e').textContent='Could not reach the server. Try again.'; $('go').disabled=false; }
}
async function changePw(){
  const c=$('c').value,n=$('n').value,n2=$('n2').value; if(n!==n2){$('e').textContent='The two new passwords don\u2019t match.';return;}
  const r=await call('sopPortalChangePassword',S.token,c,n); if(signedOut(r))return;
  if(!r.ok){$('e').textContent=r.error;return;} S.token=r.token; store.set('sop_tok',r.token,!!localStorage.getItem('sop_tok')); if(r.deviceToken) dev.set(S.uid||store.get('sop_uid'),r.deviceToken); S.view='today'; await load('Password saved.');
}
async function load(msg){
  const r=await call('sopPortalToday',S.token); if(signedOut(r))return;
  if(!r.ok){ S.view='today'; S.data={runs:[],roster:[],me:{name:''},today:''}; render(r.error); return; }
  S.data=r; if(S.run){ S.run=r.runs.find(x=>x.id===S.run.id)||null; if(!S.run) S.view='today'; }
  if(S.view!=='run') S.view='today'; render(msg);
}
function dayLabel(iso){ if(!iso) return ''; const d=new Date(iso+'T12:00:00'); return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }
function runCard(r){ const pct=r.total?Math.round(100*(r.done+r.skipped)/r.total):0;
  return `<div class="card run" data-run="${esc(r.id)}" role="button" tabindex="0"><div class="top"><h3>${esc(r.name)}</h3>${chip(r)}</div>
  <div class="meta">${esc(r.window)} · ${esc(r.hours)}${r.station?' · '+esc(r.station):''}</div>
  <div class="meta">${r.mine?'Assigned to you':'Assigned: '+esc(r.assigned)}</div>
  <div class="bar"><i class="w${pct}"></i></div><div class="meta">${prog(r)}${r.minutes!=null?' · '+r.minutes+' min':''}</div></div>`; }
function prog(r){ return `${r.done+r.skipped} of ${r.total} steps`+(r.skipped?` (${r.skipped} can\u2019t do)`:''); }
function renderToday(msg){
  const d=S.data||{runs:[]}, mine=d.runs.filter(r=>r.mine), open=d.runs.filter(r=>!r.mine&&r.canAct), other=d.runs.filter(r=>!r.mine&&!r.canAct);
  $('app').innerHTML=`<div class="top"><div><b>Hi ${esc(d.me&&d.me.name||'')}</b><div class="meta">${esc(dayLabel(d.today))} · ${esc(d.me&&d.me.kind||'')}</div></div><button class="sm" id="rf">Refresh</button></div>
   ${msg?`<div class="ok">${esc(msg)}</div>`:''}
   <h2>My runs</h2>${mine.map(runCard).join('')||'<div class="empty">Nothing assigned to you yet today.</div>'}
   ${open.length?`<h2>You can take these</h2>${open.map(runCard).join('')}`:''}
   ${other.length?`<h2>Other runs today</h2>${other.map(runCard).join('')}`:''}
   <h2>Training</h2><button class="w" id="tr">Read the SOP checklists (training)</button>`;
  $('rf').onclick=()=>load(); $('tr').onclick=openTraining;
  document.querySelectorAll('[data-run]').forEach(el=>el.onclick=()=>{ S.run=d.runs.find(x=>x.id===el.dataset.run); S.view='run'; render(); });
}
function renderRun(msg){
  const r=S.run; if(!r){S.view='today';return render();}
  const act=r.canAct, left=r.total-r.done-r.skipped;
  const steps=r.steps.map(s=>{
    const who=[s.startedAt?`Started ${esc(s.startedAt)}${s.startedBy?' by '+esc(s.startedBy):''}`:'', s.doneAt?`${s.status==='Skipped'?'Can\u2019t do':'Done'} ${esc(s.doneAt)}${s.doneBy?' by '+esc(s.doneBy):''}`:''].filter(Boolean).join(' · ');
    let b='';
    if(act){ if(!s.status) b+=`<button class="sm" data-a="start" data-s="${esc(s.id)}">Start</button>`;
      if(s.status!=='Done'&&s.status!=='Skipped') b+=`<button class="sm p" data-a="done" data-s="${esc(s.id)}">Done</button><button class="sm" data-a="skip" data-s="${esc(s.id)}">Can't do</button>`;
      else if(s.mine) b+=`<button class="sm" data-a="undo" data-s="${esc(s.id)}">Undo</button>`;
      b+=`<button class="sm" data-a="note" data-s="${esc(s.id)}">${s.note?'Edit note':'Note'}</button>`; }
    return `<div class="step ${esc(s.status)}"><div class="t"><span class="n">${s.n}.</span><span class="tx">${esc(s.text)}</span></div>
      ${who?`<div class="who">${who}</div>`:''}${s.note?`<div class="note">📝 ${esc(s.note)}${s.noteBy?' — '+esc(s.noteBy):''}</div>`:''}${b?`<div class="acts">${b}</div>`:''}</div>`;}).join('');
  $('app').innerHTML=`<button class="back" id="bk">‹ Today</button>
   <div class="card run"><div class="top"><h3>${esc(r.name)}</h3>${chip(r)}</div><div class="meta">${esc(r.window)} · ${esc(r.hours)}${r.station?' · '+esc(r.station):''}</div>
   <div class="meta">${r.mine?'Assigned to you':'Assigned: '+esc(r.assigned)}${r.handoffs?' · handed off '+r.handoffs+'×':''}</div>
   <div class="bar"><i class="w${r.total?Math.round(100*(r.done+r.skipped)/r.total):0}"></i></div><div class="meta">${prog(r)}</div></div>
   ${msg?`<div class="${/^(Saved|Run closed|Handed)/.test(msg)?'ok':'err'}">${esc(msg)}</div>`:''}
   <div class="card">${steps}</div>
   ${r.status==='Done'?`<div class="card"><b>Closed</b> ${esc(r.doneAt)}${r.doneBy?' by '+esc(r.doneBy):''}<div class="note ml0">${esc(r.closingNote)}</div></div>`:''}
   ${r.canTakeOver?`<button class="w p mb8" id="tko">Take over this run (${r.lateMin} min late)</button><div class="meta tkn">It\u2019s more than 30 minutes late, so anyone on shift can take it over. Steps already checked keep their names.</div>`:''}
   ${act&&!r.mine&&r.status==='Open'&&(r.unassigned||r.pool)?`<button class="w mb8" id="claim">Take this run</button><div class="meta tkn">Take it first to hand it off. Checking a step also takes it.</div>`:''}
   ${act?`<div class="row">${r.mine?'<button id="ho">Hand off</button>':''}<button class="p" id="cl" ${left?'disabled':''}>Close run</button></div>${left?`<div class="meta mt6">Close run unlocks when every step is done or marked “can’t do”.</div>`:''}`:(r.status==='Open'&&!r.canTakeOver?`<div class="meta">View only. ${esc(r.assigned)} has this run.</div>`:'')}`;
  $('bk').onclick=()=>{S.view='today';S.run=null;render();};
  document.querySelectorAll('[data-a]').forEach(el=>el.onclick=()=>stepAct(el.dataset.a,el.dataset.s));
  if($('ho')) $('ho').onclick=openHandoff; if($('cl')) $('cl').onclick=openClose; if($('tko')) $('tko').onclick=()=>doAct('takeover',{runId:r.id},'Saved: you took over this run.'); if($('claim')) $('claim').onclick=()=>doAct('claim',{runId:r.id},'Saved: the run is yours.');
}
async function doAct(a,args,okMsg){
  if(S.busy) return; S.busy=true;
  try{ const r=await call('sopPortalAction',S.token,a,args); if(signedOut(r))return;
    if(!r.ok){ render(r.error); return; } S.run=r.run; hideSheet(); const d=S.data; if(d){ const i=d.runs.findIndex(x=>x.id===r.run.id); if(i>=0) d.runs[i]=r.run; } render(okMsg||'');
  }catch(e){ render('Could not reach the server. Try again.'); } finally{ S.busy=false; }
}
function stepAct(a,id){
  if(a==='skip'||a==='note'){ const s=S.run.steps.find(x=>x.id===id);
    sheet(`<b>${a==='skip'?'Can\u2019t do this step':'Note'}</b><div class="meta">${esc(s.n+'. '+s.text)}</div><label for="nt">${a==='skip'?'Why? (required)':'Note (optional; no prices or amounts)'}</label><textarea id="nt" maxlength="300">${a==='note'?esc(s.note||''):''}</textarea>
      <div class="row mt10"><button id="sx">Cancel</button><button class="p" id="sok">Save</button></div><div class="err" id="se"></div>`);
    $('sx').onclick=hideSheet; $('sok').onclick=()=>{ const v=$('nt').value.trim(); if(a==='skip'&&v.length<3){$('se').textContent='Say why.';return;} doAct(a,{stepId:id,note:v},'Saved.'); }; return; }
  doAct(a,{stepId:id},'');
}
function openHandoff(){
  const ro=(S.data&&S.data.roster)||[];
  sheet(`<b>Hand off this run</b><div class="meta">The steps you already checked stay yours. The rest goes to the person you pick.</div>
   ${ro.length?`<label for="to">Hand off to</label><select id="to">${ro.map(p=>`<option value="${esc(p.personId)}">${esc(p.name)}</option>`).join('')}</select>
   <label for="hn">Note for them (optional)</label><textarea id="hn" maxlength="300" placeholder="e.g. Towels are in the dryer"></textarea>`:'<div class="empty">Nobody else who can sign in is on shift today. Ask a manager.</div>'}
   <div class="row mt10"><button id="sx">Cancel</button>${ro.length?'<button class="p" id="sok">Hand off</button>':''}</div>`);
  $('sx').onclick=hideSheet; if($('sok')) $('sok').onclick=()=>doAct('handoff',{runId:S.run.id,toPersonId:$('to').value,note:$('hn').value.trim()},'Handed off.');
}
function openClose(){
  sheet(`<b>Close this run</b><div class="meta">${esc(S.run.name)} · ${esc(S.run.hours)}</div><label for="cn">Closing note (required)</label>
   <textarea id="cn" maxlength="1000" placeholder="Anything the next shift or a manager should know"></textarea>
   <div class="row mt10"><button id="sx">Cancel</button><button class="p" id="sok">Close run</button></div><div class="err" id="se"></div>`);
  $('sx').onclick=hideSheet; $('sok').onclick=()=>{ const v=$('cn').value.trim(); if(v.length<3){$('se').textContent='Add a closing note.';return;} doAct('close',{runId:S.run.id,note:v},'Run closed. Thank you!'); };
}
async function openTraining(){ const r=await call('sopPortalTraining',S.token); if(signedOut(r))return; S.training=r.ok?r.templates:[]; S.view='training'; render(); }
function renderTraining(){
  $('app').innerHTML=`<button class="back" id="bk">‹ Today</button><h2>SOP checklists (read only)</h2>`+((S.training||[]).map(t=>`<div class="card"><h3 class="m0">${esc(t.name)}</h3>
   <div class="meta">${esc(t.window)}${t.station?' · '+esc(t.station):''}${t.bar?' · training only until '+esc(t.dailyFrom):''}</div><ol>${t.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')||'<div class="empty">No checklists yet.</div>');
  $('bk').onclick=()=>{S.view='today';render();};
}
function sheet(html){ $('sheetIn').innerHTML=html; $('sheet').style.display='flex'; }
function hideSheet(){ $('sheet').style.display='none'; }
$('out').onclick=async()=>{ const t=S.token; S.token=''; store.del('sop_tok'); store.del('sop_uid'); S.view='signin'; render('Signed out.'); try{ await call('sopPortalLogout',t);}catch(e){} };
function openDeep(){ if(!S.deep||!S.data) return; const r=S.data.runs.find(x=>x.id===S.deep); S.deep=''; if(r){ S.run=r; S.view='run'; render(); } }
(async function init(){
  const okRun=v=>v&&/^R\d{8}-[A-Za-z]+-TPL-\d+$/.test(v);
  try{ if(HAS_GSR&&google.script.url) google.script.url.getLocation(l=>{ const v=l&&l.parameter&&l.parameter.run; if(okRun(v)){ S.deep=v; openDeep(); } });
    else { const v=new URLSearchParams(location.search).get('run'); if(okRun(v)) S.deep=v; } }catch(e){}
  S.token=store.get('sop_tok'); S.uid=store.get('sop_uid'); if(S.token){ S.view='today'; await load(); openDeep(); } else render(); })();
})();

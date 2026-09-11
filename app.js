/* ===========================================================
   Pooja's Mentor — app.js
   Personal mentor + career + wellness + learning + business tracker.
   Data is stored in the browser's localStorage — it stays on this
   device, in this browser, until you clear site data or export it.
=========================================================== */

const STORAGE_KEY = 'poojamentor:data';
let state = null;
let currentView = 'home';
let careerUI = { search:'', filter:'All', sort:'newest' };
let pendingPhotoDataUrl = null;

/* ---------------- helpers ---------------- */
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function monthKeyOf(dateStr){ return (dateStr||todayISO()).slice(0,7); }
function currentMonthKey(){ return monthKeyOf(todayISO()); }
function fmtDate(d){ if(!d) return '—'; const dt=new Date(d+'T00:00:00'); if(isNaN(dt)) return d; return dt.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function monthLabel(mk){ const [y,m]=mk.split('-'); return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'}); }
function esc(s){ return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateMinus(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function lastNDates(n){ const arr=[]; for(let i=0;i<n;i++) arr.push(dateMinus(i)); return arr; }

function defaultState(){
  return {
    settings:{
      backendUrl:'',
      notifications:{ enabled:false, categories:{morning:true, water:true, career:true, learning:true, night:true}, quietStart:'22:00', quietEnd:'07:00', sentLog:{} }
    },
    food:{ entries:[], water:{}, routine:{} },
    jobs:[],
    skills:[],
    tasks:{},
    goals:{},
    business:{ inputs:{skills:'',budget:'',time:'',interests:''}, ideas:[] },
    gamification:{ bonusXp:0, unlocked:{} },
    chat:{ messages:[] }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : defaultState();
  }catch(e){ state = defaultState(); }
  // defensive backfill so upgrades never break existing saved data
  const d = defaultState();
  for(const k in d){ if(!(k in state)) state[k]=d[k]; }
  if(!state.settings) state.settings = d.settings;
  if(!state.settings.notifications) state.settings.notifications = d.settings.notifications;
  if(!state.settings.notifications.categories) state.settings.notifications.categories = d.settings.notifications.categories;
  if(!state.settings.notifications.sentLog) state.settings.notifications.sentLog = {};
  if(!state.gamification) state.gamification = d.gamification;
  if(!state.gamification.unlocked) state.gamification.unlocked = {};
  if(typeof state.gamification.bonusXp !== 'number') state.gamification.bonusXp = 0;
  if(!state.chat) state.chat = { messages:[] };
  if(!Array.isArray(state.chat.messages)) state.chat.messages = [];
}
let saveTimer=null;
function saveState(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ showToast('Could not save — storage may be full'); }
  }, 150);
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------------- modal ---------------- */
function openModal(html){
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }
document.getElementById('modalBg').addEventListener('click', e=>{ if(e.target.id==='modalBg') closeModal(); });

/* ---------------- nav ---------------- */
document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab-btn');
  if(!btn) return;
  setView(btn.dataset.view);
});
function setView(v){
  currentView = v;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active', s.id==='view-'+v));
  renderAll();
  window.scrollTo({top:0,behavior:'instant'});
}
function renderAll(){
  if(currentView==='home') renderHome();
  if(currentView==='food') renderFood();
  if(currentView==='career') renderCareer();
  if(currentView==='skills') renderSkills();
  if(currentView==='tasks') renderTasks();
  if(currentView==='goals') renderGoals();
  if(currentView==='business') renderBusiness();
  if(currentView==='chat') renderChat();
}

/* ---------------- greeting + mentor line ---------------- */
function timeGreeting(){
  const h = new Date().getHours();
  if(h<5) return 'Good night';
  if(h<12) return 'Good morning';
  if(h<17) return 'Good afternoon';
  if(h<21) return 'Good evening';
  return 'Good night';
}
function setGreeting(){
  document.getElementById('greetingText').textContent = `Hi Pooja ❤️ ${timeGreeting()}`;
  document.getElementById('mentorLine').textContent = mentorLine();
}
function mentorLine(){
  const t = todayISO();
  const jobsToday = state.jobs.filter(j=>j.dateApplied===t).length;
  const jobsWeek = state.jobs.filter(j=>lastNDates(7).includes(j.dateApplied)).length;
  const foodToday = state.food.entries.filter(e=>e.date===t).length;
  const hoursToday = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0);
  const dayTasks = state.tasks[t];
  const top3Done = dayTasks ? dayTasks.top3.filter(x=>x.done && x.text).length : 0;

  if(jobsWeek>=3 && jobsToday===0) return `You applied to ${jobsWeek} jobs this week — keep going.`;
  if(hoursToday===0 && new Date().getHours()>=10) return "You haven't studied today yet. Let's do just 30 minutes.";
  if(foodToday===0 && new Date().getHours()>=11) return "No meals logged yet — even a quick note helps you see patterns.";
  if(top3Done>0) return "You're building your career one day at a time. ❤️";
  return "Small progress today still counts. ❤️";
}

/* Today's Score (0-100) — see computeScoreBreakdown()/computeScore() further
   below in the Mentor Engine section; kept together with the achievement
   and XP logic so the scoring is defined in exactly one place. */

function ringSvg(pct, size, color){
  const r = size/2 - 8;
  const c = 2*Math.PI*r;
  const offset = c - (Math.min(100,pct)/100)*c;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-alt)" stroke-width="8"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
  </svg>`;
}

/* ================================================================
   HOME
================================================================= */
function renderHome(){
  const t = todayISO();
  const water = state.food.water[t]||0;
  const routine = state.food.routine[t]||{hairAM:false,hairPM:false,skinAM:false,skinPM:false};
  const routineDone = [routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  const foodToday = state.food.entries.filter(e=>e.date===t).length;
  const dayTasks = getDayTasks(t);

  const score = computeScore(t);
  const yScore = computeScore(dateMinus(1));
  const scoreCompare = score>yScore ? `You're doing better than yesterday (${yScore}) ❤️` : (score===yScore ? "Same steady pace as yesterday." : `Yesterday was ${yScore} — let's build back up.`);

  const mk = currentMonthKey();
  const jobsThisMonth = jobsAppliedThisMonth();
  const interviews = state.jobs.filter(j=>j.status==='Interview').length;
  const followUpsDue = state.jobs.filter(j=>needsFollowup(j)).length;
  const avgSkillProgress = state.skills.length ? Math.round(state.skills.reduce((a,s)=>a+(s.completion||0),0)/state.skills.length) : 0;

  const goal = state.goals[mk] || {};
  const goalRows = [
    ['Jobs applied', jobsThisMonth, goal.jobsTarget],
    ['Hours studied', hoursStudiedInMonth(mk), goal.hoursTarget],
    ['Skills completed', skillsCompletedInMonth(mk), goal.skillsTarget],
    ['Projects done', projectsCompletedInMonth(mk), goal.projectsTarget],
  ].filter(r=>r[2]!==undefined && r[2]!=='' && r[2]!=null);

  const activeIdea = state.business.ideas.find(i=>i.status==='active');
  const totalRevenue = state.business.ideas.reduce((a,i)=>a+(Number(i.revenue)||0),0);

  const inactiveDays = daysSinceLastActivity();
  const xpInfo = computeXP();
  const reaction = avatarReaction(score, inactiveDays);
  const read = todaysRead(t);
  const wins = todaysWins(t);
  const missed = todaysMissed(t);
  const attention = todaysAttention();
  const oneThing = mentorFocusList(t)[0] || "You're all caught up — enjoy the evening. ❤️";
  runAchievementCheck(); // may open an unlock modal

  document.getElementById('view-home').innerHTML = `
    ${ghostBannerHtml(inactiveDays)}

    <div class="card glow-gold">
      <div class="avatar-hero">
        <div class="avatar-ring">
          <img src="avatar/avatar-small.png" alt="Pooja" onerror="this.style.display='none'">
          <div class="avatar-badge">Lv ${xpInfo.level}</div>
        </div>
        <div style="flex:1;">
          <div class="avatar-reaction">${esc(reaction)}</div>
          <div class="avatar-sub">${esc(xpInfo.title)}</div>
        </div>
      </div>
      <div class="xp-row">
        <span class="level-chip">Lv ${xpInfo.level}</span>
        <div class="xp-track">
          <div class="xp-label"><span>${xpInfo.xp} XP</span><span>${xpInfo.xpToNext} XP to Lv ${xpInfo.level+1}</span></div>
          <div class="track"><div class="fill" style="width:${xpInfo.pct}%"></div></div>
        </div>
      </div>
    </div>

    <div class="card glow-gold" onclick="openScoreBreakdown()" style="cursor:pointer;">
      <div class="score-wrap">
        <div class="ring">
          ${ringSvg(score,96,'var(--gold)')}
          <div class="ring-num"><span class="n">${score}</span><span class="d">/ 100</span></div>
        </div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14.5px;margin-bottom:3px;">Today's Score</div>
          <div class="small muted">${scoreCompare}</div>
          <div class="small ghost" style="color:var(--gold);margin-top:4px;">Tap to see how it's calculated →</div>
        </div>
      </div>
    </div>

    <div class="one-thing-card card">
      <div class="one-thing-label">🎯 DO THIS NOW</div>
      <div class="one-thing-text">${esc(oneThing)}</div>
    </div>

    <div class="mentor-box card">
      <div class="mentor-title">❤️ Your Mentor</div>
      <div class="small muted" style="margin-bottom:6px;">${esc(timeGreeting())} Pooja 👋</div>
      <div class="mentor-subhead">Today's read</div>
      <div class="read-grid">
        <div class="read-item"><span>Career</span><span>${read.career}</span></div>
        <div class="read-item"><span>Self-care</span><span>${read.selfcare}</span></div>
        <div class="read-item"><span>Learning</span><span>${read.learning}</span></div>
        <div class="read-item"><span>Goals</span><span>${read.goals}</span></div>
      </div>
      <div class="mentor-subhead">What you did well</div>
      <div class="mentor-line-item">${wins.length? esc(wins.join(' · ')) : 'Nothing logged yet — let us change that.'}</div>
      <div class="mentor-subhead">What you missed</div>
      <div class="mentor-line-item">${missed.length? esc(missed.join(' · ')) : 'Nothing — solid day so far.'}</div>
      <div class="mentor-subhead">Needs attention</div>
      <div class="mentor-line-item">${attention.length? esc(attention.join(' · ')) : 'Nothing urgent right now.'}</div>
      <div class="mentor-subhead">Your mentor says…</div>
      <div class="mentor-line-item">${esc(mentorLine())}</div>
      <div class="btn-row"><button class="btn secondary" onclick="setView('chat')">💬 Talk to your Mentor</button></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>DREAM UNLOCKS</div>
    <div class="unlock-row">${ACHIEVEMENTS.map(unlockChipHtml).join('')}</div>

    <div class="section-title"><span class="dot" style="background:var(--blush)"></span>TODAY</div>
    <div class="card accent-blush">
      <div class="stat-grid cols-3">
        <div class="stat-box"><div class="stat-num">${water}/8</div><div class="stat-label">Water glasses</div></div>
        <div class="stat-box"><div class="stat-num">${foodToday}</div><div class="stat-label">Food entries</div></div>
        <div class="stat-box"><div class="stat-num">${routineDone}/4</div><div class="stat-label">Hair/skin routine</div></div>
      </div>
      <div class="divider"></div>
      <div class="small muted" style="margin-bottom:6px;font-weight:600;">Top 3 priorities</div>
      ${dayTasks.top3.some(x=>x.text) ? dayTasks.top3.filter(x=>x.text).map(x=>`<div class="small" style="padding:4px 0;">${x.done?'✅':'⬜️'} ${esc(x.text)}</div>`).join('') : `<div class="small muted">Not set yet — add them in Today →</div>`}
      <div class="btn-row"><button class="btn secondary" onclick="setView('tasks')">Open Today</button></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--teal)"></span>CAREER</div>
    <div class="card accent-teal">
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-num">${jobsThisMonth}</div><div class="stat-label">Applications this month</div></div>
        <div class="stat-box"><div class="stat-num">${interviews}</div><div class="stat-label">Interviews</div></div>
        <div class="stat-box"><div class="stat-num">${followUpsDue}</div><div class="stat-label">Follow-ups due</div></div>
        <div class="stat-box"><div class="stat-num">${avgSkillProgress}%</div><div class="stat-label">Avg skill progress</div></div>
      </div>
      <div class="btn-row"><button class="btn secondary" onclick="setView('career')">Open Career Tracker</button></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>GOALS — ${monthLabel(mk)}</div>
    <div class="card accent-gold">
      ${goalRows.length? goalRows.map(([label,actual,target])=>`
        <div style="margin-bottom:10px;">
          <div class="row small"><span>${label}</span><span class="muted">${actual} / ${target}</span></div>
          <div class="track"><div class="fill" style="width:${Math.min(100, target?Math.round(actual/target*100):0)}%"></div></div>
        </div>`).join('') : `<div class="empty small">No monthly targets set yet.<br><button class="btn ghost" onclick="setView('goals')">Set goals →</button></div>`}
    </div>

    <div class="section-title"><span class="dot" style="background:var(--coral)"></span>BUSINESS</div>
    <div class="card accent-coral">
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-num">${state.business.ideas.length}</div><div class="stat-label">Ideas saved</div></div>
        <div class="stat-box"><div class="stat-num">$${totalRevenue}</div><div class="stat-label">Revenue logged</div></div>
      </div>
      ${activeIdea? `<div class="divider"></div><div class="small"><span class="muted">Active experiment:</span> <b>${esc(activeIdea.title)}</b></div>` : `<div class="small muted" style="margin-top:10px;">No active experiment yet.</div>`}
      <div class="btn-row"><button class="btn secondary" onclick="setView('business')">Open Business Lab</button></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>YOUR WEEK</div>
    ${weeklyReviewCard()}

    <div class="section-title"><span class="dot" style="background:var(--coral)"></span>🌙 BEFORE YOU GO</div>
    <div class="card eod-card">
      <div class="eod-title">${endOfDayTitle(score)}</div>
      <div class="eod-body">${esc(endOfDayMessage(score, t))}</div>
    </div>
  `;
}

function mentorFocusList(t){
  const items = [];
  const dayTasks = getDayTasks(t);
  const top3Open = dayTasks.top3.filter(x=>x.text && !x.done);
  if(top3Open.length) items.push(`Finish: ${top3Open[0].text}`);

  const mk = currentMonthKey();
  const goal = state.goals[mk] || {};
  if(goal.jobsTarget){
    const remaining = goal.jobsTarget - jobsAppliedThisMonth();
    const daysLeftInMonth = daysRemainingInMonth();
    const pace = daysLeftInMonth>0 ? Math.ceil(remaining/daysLeftInMonth) : remaining;
    if(remaining>0) items.push(`Apply to ${Math.max(1,Math.min(remaining, pace===0?1:pace))} job${pace>1?'s':''} today`);
  } else {
    const jobsToday = state.jobs.filter(j=>j.dateApplied===t).length;
    if(jobsToday===0) items.push('Apply to at least 1–2 jobs today');
  }

  const hoursToday = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0);
  if(hoursToday===0){
    const nextSkill = state.skills.find(s=>s.completion<100);
    items.push(nextSkill ? `Study ${nextSkill.skill} for 30–60 min` : 'Study a skill for 30–60 min');
  }

  const water = state.food.water[t]||0;
  if(water<4 && items.length<3) items.push('Drink a few glasses of water');

  if(!items.length) return ["You've covered your focus areas today — great work. Rest well. ❤️"];
  return items.slice(0,3);
}

function weeklyReviewCard(){
  const week = lastNDates(7);
  const apps = state.jobs.filter(j=>week.includes(j.dateApplied)).length;
  const studyH = Math.round(state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>week.includes(l.date)).reduce((x,l)=>x+Number(l.hours||0),0),0)*10)/10;
  let tasksDone = 0;
  week.forEach(d=>{ const dt=state.tasks[d]; if(dt){ tasksDone += [...dt.job,...dt.learning,...dt.personal].filter(x=>x.done).length + dt.habits.filter(h=>h.done).length + dt.top3.filter(x=>x.done).length; } });
  const waterAvg = (week.reduce((a,d)=>a+(state.food.water[d]||0),0)/7).toFixed(1);
  const routineDays = week.filter(d=>{ const r=state.food.routine[d]; return r && [r.hairAM,r.hairPM,r.skinAM,r.skinPM].filter(Boolean).length>0; }).length;

  const wins = [];
  const attention = [];
  if(apps>=5) wins.push(`${apps} job applications this week`);
  else attention.push('Job applications were light this week');
  if(studyH>=5) wins.push(`${studyH}h of focused study`);
  else attention.push('Try to fit in more study time next week');
  if(routineDays>=5) wins.push(`Hair/skin routine on ${routineDays}/7 days`);
  else attention.push('Routine consistency could improve');

  const nextFocus = attention.length ? attention[0].replace('Try to ','').replace(/^./,c=>c.toUpperCase()) : 'Keep the same momentum going';

  return `
  <div class="card accent-lavender">
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${apps}</div><div class="stat-label">Applications</div></div>
      <div class="stat-box"><div class="stat-num">${studyH}h</div><div class="stat-label">Study</div></div>
      <div class="stat-box"><div class="stat-num">${tasksDone}</div><div class="stat-label">Tasks completed</div></div>
      <div class="stat-box"><div class="stat-num">${waterAvg}/8</div><div class="stat-label">Water average</div></div>
    </div>
    <div class="divider"></div>
    <div class="small" style="margin-bottom:6px;"><b>Wins ❤️</b> ${wins.length? esc(wins.join(' · ')) : 'Keep going — next week is a fresh start.'}</div>
    <div class="small" style="margin-bottom:6px;"><b>Needs attention</b> ${attention.length? esc(attention.join(' · ')) : 'Nothing major — nicely balanced week.'}</div>
    <div class="small"><b>Next week's focus</b> ${esc(nextFocus)}</div>
  </div>`;
}
function daysRemainingInMonth(){
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  return last - d.getDate() + 1;
}

/* ================================================================
   FOOD, SKIN & HAIR
================================================================= */
function renderFood(){
  const t = todayISO();
  const water = state.food.water[t]||0;
  const routine = state.food.routine[t]||{hairAM:false,hairPM:false,skinAM:false,skinPM:false};
  const routineDone = [routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  const entriesToday = state.food.entries.filter(e=>e.date===t).sort((a,b)=>b.createdAt-a.createdAt);
  const streak = routineStreak();

  const weekDates = lastNDates(7);
  const weekEntries = state.food.entries.filter(e=>weekDates.includes(e.date));
  const avgSkin = weekEntries.length? (weekEntries.reduce((a,e)=>a+e.skin,0)/weekEntries.length).toFixed(1) : '—';
  const avgHair = weekEntries.length? (weekEntries.reduce((a,e)=>a+e.hair,0)/weekEntries.length).toFixed(1) : '—';
  const avgWater = (weekDates.reduce((a,d)=>a+(state.food.water[d]||0),0)/7).toFixed(1);
  const nutrientCounts = {};
  weekEntries.forEach(e=>(e.nutrients||[]).forEach(n=>nutrientCounts[n]=(nutrientCounts[n]||0)+1));
  const topNutrients = Object.entries(nutrientCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const waterPct = Math.round((water/8)*100);
  const waterMsg = water>=8 ? "Goal reached — beautifully hydrated. ✨" : `${8-water} more glass${8-water===1?'':'es'} to reach today's goal.`;

  document.getElementById('view-food').innerHTML = `
    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Log a meal</div>
    <div class="card accent-gold">
      <div class="photo-upload" id="photoUploadBox">
        📷 Tap to add a photo of your meal<br><span class="small muted">or just describe it below</span>
      </div>
      <input type="file" id="photoInput" accept="image/*" capture="environment" style="display:none;">
      <img id="photoPreview" class="photo-preview" style="display:none;">
      <label>What did you eat? (optional if you added a photo)</label>
      <input type="text" id="foodDesc" placeholder="e.g. grilled salmon, spinach, brown rice">
      <div class="btn-row">
        <button class="btn block fab" id="analyzeBtn" onclick="analyzeFood()">✨ Analyze meal</button>
      </div>
      <button class="btn ghost" onclick="openManualFoodEntry(document.getElementById('foodDesc').value)">or add manually instead</button>
      <p class="disclaimer">General wellness guidance only — not medical advice. For skin or hair conditions, please see a dermatologist or doctor.</p>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--teal)"></span>Hydration</div>
    <div class="card accent-teal">
      <div class="row"><div class="stat-num">💧 ${water} / 8</div><div class="small muted">${waterPct}%</div></div>
      <div class="track"><div class="fill" style="width:${waterPct}%;background:linear-gradient(90deg,var(--teal),var(--sage))"></div></div>
      <div class="small muted" style="margin-top:8px;">${waterMsg}</div>
      <div class="water-row" id="waterRow"></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>Hair & skin care today</div>
    <div class="card accent-lavender">
      <div class="row" style="margin-bottom:6px;">
        <span class="small muted">${routineDone} / 4 completed</span>
        ${streak>=2? `<span class="streak-badge">🔥 ${streak}-day streak</span>` : ''}
      </div>
      <div class="track" style="margin-bottom:8px;"><div class="fill" style="width:${routineDone/4*100}%;background:linear-gradient(90deg,var(--lavender),var(--blush))"></div></div>
      <div class="chip-check ${routine.hairAM?'done':''}"><input type="checkbox" id="hairAM" ${routine.hairAM?'checked':''} onchange="toggleRoutine('hairAM')"><label for="hairAM">Hair care — morning</label></div>
      <div class="chip-check ${routine.hairPM?'done':''}"><input type="checkbox" id="hairPM" ${routine.hairPM?'checked':''} onchange="toggleRoutine('hairPM')"><label for="hairPM">Hair care — evening</label></div>
      <div class="chip-check ${routine.skinAM?'done':''}"><input type="checkbox" id="skinAM" ${routine.skinAM?'checked':''} onchange="toggleRoutine('skinAM')"><label for="skinAM">Skin care — morning</label></div>
      <div class="chip-check ${routine.skinPM?'done':''}"><input type="checkbox" id="skinPM" ${routine.skinPM?'checked':''} onchange="toggleRoutine('skinPM')"><label for="skinPM">Skin care — evening</label></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--sage)"></span>Today's meals</div>
    ${entriesToday.length? entriesToday.map(foodEntryCard).join('') : `<div class="empty">🍽️<span class="big"></span>No meals logged yet today.</div>`}

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Weekly nutrition summary</div>
    <div class="card">
      <div class="stat-grid cols-3">
        <div class="stat-box"><div class="stat-num">🍓 ${avgSkin}</div><div class="stat-label">Avg skin score</div></div>
        <div class="stat-box"><div class="stat-num">💜 ${avgHair}</div><div class="stat-label">Avg hair score</div></div>
        <div class="stat-box"><div class="stat-num">💧 ${avgWater}</div><div class="stat-label">Avg water/day</div></div>
      </div>
      ${topNutrients.length? `<div class="divider"></div><div class="small muted" style="margin-bottom:6px;font-weight:600;">Most common highlights this week</div><div class="nutrient-tags">${topNutrients.map(([n,c])=>`<span class="tag">${esc(n)} ×${c}</span>`).join('')}</div>` : ''}
    </div>
  `;

  const wr = document.getElementById('waterRow');
  for(let i=1;i<=8;i++){
    const d = document.createElement('div');
    d.className = 'drop'+(i<=water?' filled':'');
    d.textContent = '💧';
    d.onclick = ()=> setWater(i===water?i-1:i);
    wr.appendChild(d);
  }
  document.getElementById('photoUploadBox').onclick = ()=>document.getElementById('photoInput').click();
  document.getElementById('photoInput').onchange = handlePhotoSelect;
}

function routineStreak(){
  let streak=0;
  for(let i=0;i<60;i++){
    const d = dateMinus(i);
    const r = state.food.routine[d];
    const done = r && [r.hairAM,r.hairPM,r.skinAM,r.skinPM].filter(Boolean).length>0;
    if(done) streak++;
    else { if(i===0) continue; break; } // allow today to still be empty without breaking streak
  }
  return streak;
}

function setWater(n){
  const v = Math.max(0, Math.min(8,n));
  state.food.water[todayISO()] = v;
  saveState(); renderFood();
  if(v>0) showToast(waterMentorComment(v));
}
function toggleRoutine(field){
  const t = todayISO();
  if(!state.food.routine[t]) state.food.routine[t]={hairAM:false,hairPM:false,skinAM:false,skinPM:false};
  state.food.routine[t][field] = !state.food.routine[t][field];
  saveState(); renderFood();
  showToast(routineMentorComment(field, state.food.routine[t][field]));
}

function handlePhotoSelect(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    resizeImage(ev.target.result, 500, 0.7, (dataUrl)=>{
      pendingPhotoDataUrl = dataUrl;
      const prev = document.getElementById('photoPreview');
      prev.src = dataUrl; prev.style.display='block';
    });
  };
  reader.readAsDataURL(file);
}
function resizeImage(dataUrl, maxDim, quality, cb){
  const img = new Image();
  img.onload = function(){
    let w=img.width, h=img.height;
    if(w>h){ if(w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; } }
    else { if(h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; } }
    const canvas = document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    canvas.getContext('2d').drawImage(img,0,0,w,h);
    cb(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = dataUrl;
}

async function analyzeFood(){
  const desc = document.getElementById('foodDesc').value.trim();
  if(!desc && !pendingPhotoDataUrl){ showToast('Add a photo or describe the meal first'); return; }

  const backendUrl = (state.settings.backendUrl||'').trim();
  if(!backendUrl){
    showToast('AI analysis is not set up yet — add it manually');
    openManualFoodEntry(desc);
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analyzing…';

  const contentBlocks = [];
  if(pendingPhotoDataUrl){
    const base64 = pendingPhotoDataUrl.split(',')[1];
    contentBlocks.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data: base64}});
  }
  contentBlocks.push({type:'text', text: desc ? `Meal description: ${desc}` : 'Analyze the meal shown in the photo.'});

  try{
    // NOTE: backendUrl should point to YOUR OWN serverless proxy (see backend/ folder)
    // which holds your Anthropic API key server-side. Never put a secret key here.
    const response = await fetch(backendUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ content: contentBlocks })
    });
    if(!response.ok) throw new Error('Backend error');
    const data = await response.json();
    let text = (data.content||[]).map(b=>b.text||'').join('').trim();
    text = text.replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();
    const parsed = JSON.parse(text);

    const entry = {
      id: uid(), date: todayISO(), createdAt: Date.now(),
      photo: pendingPhotoDataUrl || null,
      name: parsed.name || (desc||'Meal'),
      skin: Math.max(0,Math.min(10, Math.round(parsed.skin))),
      hair: Math.max(0,Math.min(10, Math.round(parsed.hair))),
      nutrients: Array.isArray(parsed.nutrients)? parsed.nutrients.slice(0,4) : [],
      good: parsed.good || '', improve: parsed.improve || '', suggestion: parsed.suggestion || ''
    };
    state.food.entries.unshift(entry);
    saveState();
    pendingPhotoDataUrl = null;
    document.getElementById('foodDesc').value='';
    renderFood();
    showToast(foodMentorComment(entry));
  }catch(err){
    showToast('AI analysis failed — add it manually instead');
    openManualFoodEntry(desc);
  }finally{
    if(document.getElementById('analyzeBtn')){
      btn.disabled=false; btn.innerHTML='✨ Analyze meal';
    }
  }
}

function openManualFoodEntry(desc){
  openModal(`
    <div class="modal-head"><h3>Add meal manually</h3><button class="x-btn" onclick="closeModal()">✕</button></div>
    <label>Meal name</label><input type="text" id="mName" value="${esc(desc||'')}">
    <div class="form-grid-2">
      <div><label>🍓 Skin score (0–10)</label><input type="number" id="mSkin" min="0" max="10" value="6"></div>
      <div><label>💜 Hair score (0–10)</label><input type="number" id="mHair" min="0" max="10" value="6"></div>
    </div>
    <label>Nutrition highlights (comma separated)</label><input type="text" id="mNutrients" placeholder="High protein, Good fibre">
    <label>Why it's good</label><textarea id="mGood"></textarea>
    <label>What could improve</label><textarea id="mImprove"></textarea>
    <label>What to eat/add next</label><input type="text" id="mSuggestion">
    <div class="btn-row"><button class="btn block" onclick="saveManualFood()">Save meal</button></div>
  `);
}
function saveManualFood(){
  const entry = {
    id: uid(), date: todayISO(), createdAt: Date.now(), photo: pendingPhotoDataUrl || null,
    name: document.getElementById('mName').value.trim() || 'Meal',
    skin: Number(document.getElementById('mSkin').value)||0,
    hair: Number(document.getElementById('mHair').value)||0,
    nutrients: document.getElementById('mNutrients').value.split(',').map(s=>s.trim()).filter(Boolean),
    good: document.getElementById('mGood').value.trim(),
    improve: document.getElementById('mImprove').value.trim(),
    suggestion: document.getElementById('mSuggestion').value.trim(),
  };
  state.food.entries.unshift(entry);
  saveState(); pendingPhotoDataUrl=null; closeModal(); renderFood();
  showToast(foodMentorComment(entry));
}

function foodEntryCard(e){
  return `
  <div class="card food-entry" style="align-items:flex-start;">
    ${e.photo? `<img src="${e.photo}">` : `<div style="width:66px;height:66px;border-radius:12px;background:var(--surface-alt);display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 auto;">🍽️</div>`}
    <div style="flex:1;min-width:0;">
      <div class="row"><h4 style="margin:0;font-size:14.5px;">${esc(e.name)}</h4>
        <button class="x-btn" style="font-size:16px;" onclick="deleteFoodEntry('${e.id}')">✕</button></div>
      <div class="score-badges">
        <span class="score-badge skin">🍓 Skin ${e.skin}/10</span>
        <span class="score-badge hair">💜 Hair ${e.hair}/10</span>
      </div>
      ${e.nutrients&&e.nutrients.length? `<div class="nutrient-tags">${e.nutrients.map(n=>`<span class="tag">${esc(n)}</span>`).join('')}</div>` : ''}
      ${e.good? `<div class="small" style="margin-top:6px;"><b>Good:</b> ${esc(e.good)}</div>`:''}
      ${e.improve? `<div class="small" style="margin-top:3px;"><b>Improve:</b> ${esc(e.improve)}</div>`:''}
      ${e.suggestion? `<div class="small muted" style="margin-top:3px;">💡 ${esc(e.suggestion)}</div>`:''}
    </div>
  </div>`;
}
function deleteFoodEntry(id){
  state.food.entries = state.food.entries.filter(e=>e.id!==id);
  saveState(); renderFood();
}

/* ================================================================
   CAREER
================================================================= */
const STATUSES = ['Applied','Assessment','Interview','HR','Selected','Rejected','Withdrawn'];

function needsFollowup(j){
  const t = todayISO();
  return j.followUpDate && j.followUpDate<=t && !['Rejected','Withdrawn','Selected'].includes(j.status);
}

function renderCareer(){
  let jobs = [...state.jobs];

  if(careerUI.search){
    const q = careerUI.search.toLowerCase();
    jobs = jobs.filter(j=> (j.company||'').toLowerCase().includes(q) || (j.title||'').toLowerCase().includes(q));
  }
  if(careerUI.filter!=='All') jobs = jobs.filter(j=>j.status===careerUI.filter);
  if(careerUI.sort==='newest') jobs.sort((a,b)=>(b.dateApplied||'').localeCompare(a.dateApplied||''));
  if(careerUI.sort==='oldest') jobs.sort((a,b)=>(a.dateApplied||'').localeCompare(b.dateApplied||''));
  if(careerUI.sort==='company') jobs.sort((a,b)=>(a.company||'').localeCompare(b.company||''));
  if(careerUI.sort==='status') jobs.sort((a,b)=>STATUSES.indexOf(a.status)-STATUSES.indexOf(b.status));

  const all = state.jobs;
  const mk = currentMonthKey();
  const total = all.length;
  const thisMonth = jobsAppliedThisMonth();
  const thisWeek = all.filter(j=>lastNDates(7).includes(j.dateApplied)).length;
  const interviews = all.filter(j=>j.status==='Interview').length;
  const assessments = all.filter(j=>j.status==='Assessment').length;
  const offers = all.filter(j=>j.status==='Selected').length;
  const rejections = all.filter(j=>j.status==='Rejected').length;
  const interviewedOrBeyond = all.filter(j=>['Interview','HR','Selected'].includes(j.status)).length;
  const rate = total? Math.round(interviewedOrBeyond/total*100) : 0;
  const followUps = all.filter(needsFollowup);

  const goal = state.goals[mk] || {};
  const targetMsg = goal.jobsTarget ? (goal.jobsTarget-thisMonth>0 ? `You need to apply to ${goal.jobsTarget-thisMonth} more job${goal.jobsTarget-thisMonth===1?'':'s'} to reach this month's target.` : `Target reached for ${monthLabel(mk)} 🎉`) : '';

  const byMonth = {};
  all.forEach(j=>{ if(j.dateApplied){ const k=monthKeyOf(j.dateApplied); byMonth[k]=(byMonth[k]||0)+1; } });
  const months = Object.keys(byMonth).sort().slice(-6);
  const maxCount = Math.max(1, ...months.map(m=>byMonth[m]));

  const pipeline = [
    ['Applied',all.filter(j=>j.status==='Applied').length,'var(--text-muted)'],
    ['Assessment',assessments,'var(--lavender)'],
    ['Interview',interviews,'var(--gold)'],
    ['HR',all.filter(j=>j.status==='HR').length,'var(--teal)'],
    ['Selected',offers,'var(--sage)'],
    ['Rejected',rejections,'var(--rose-red)'],
  ];

  document.getElementById('view-career').innerHTML = `
    <div class="btn-row" style="margin-top:0;"><button class="btn block fab" onclick="openJobForm()">+ Apply to a Job</button></div>

    <div class="section-title"><span class="dot" style="background:var(--teal)"></span>Career dashboard</div>
    <div class="card accent-teal">
      <div class="pipeline-row">
        ${pipeline.map(([label,n,c])=>`<div class="pipe-chip"><div class="pipe-num" style="color:${c}">${n}</div><div class="pipe-label">${label}</div></div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="stat-grid cols-3">
        <div class="stat-box"><div class="stat-num">${total}</div><div class="stat-label">Total</div></div>
        <div class="stat-box"><div class="stat-num">${thisMonth}</div><div class="stat-label">This month</div></div>
        <div class="stat-box"><div class="stat-num">${thisWeek}</div><div class="stat-label">This week</div></div>
      </div>
      <div class="divider"></div>
      <div class="row small"><span>Application → interview rate</span><b>${rate}%</b></div>
      <div class="track"><div class="fill" style="width:${rate}%;background:linear-gradient(90deg,var(--teal),var(--sage))"></div></div>
      ${targetMsg? `<div class="small" style="margin-top:10px;color:var(--gold);font-weight:600;">🎯 ${esc(targetMsg)}</div>`:''}
      ${months.length? `
      <div class="divider"></div>
      <div class="small muted" style="font-weight:600;margin-bottom:2px;">Applications by month</div>
      <div class="bars">${months.map(m=>`<div class="bar-col"><div class="bar" style="height:${byMonth[m]/maxCount*60+4}px"></div><div class="bar-label">${m.slice(5)}</div><div class="bar-label">${byMonth[m]}</div></div>`).join('')}</div>` : ''}
    </div>

    ${followUps.length? `
    <div class="section-title"><span class="dot" style="background:var(--blush)"></span>Follow-ups due (${followUps.length})</div>
    ${followUps.map(j=>jobCard(j,true)).join('')}` : ''}

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Applications (${jobs.length})</div>
    <div class="search-row">
      <input type="text" placeholder="Search company or role…" value="${esc(careerUI.search)}" oninput="careerUI.search=this.value; renderCareer()">
    </div>
    <div class="search-row">
      <select onchange="careerUI.filter=this.value; renderCareer()">
        <option ${careerUI.filter==='All'?'selected':''}>All</option>
        ${STATUSES.map(s=>`<option ${careerUI.filter===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <select onchange="careerUI.sort=this.value; renderCareer()">
        <option value="newest" ${careerUI.sort==='newest'?'selected':''}>Newest first</option>
        <option value="oldest" ${careerUI.sort==='oldest'?'selected':''}>Oldest first</option>
        <option value="company" ${careerUI.sort==='company'?'selected':''}>Company A–Z</option>
        <option value="status" ${careerUI.sort==='status'?'selected':''}>By status</option>
      </select>
    </div>
    ${jobs.length? jobs.map(j=>jobCard(j,false)).join('') : `<div class="empty">📋<span class="big"></span>No applications match — try adding one or clearing filters.</div>`}
  `;
}

function jobCard(j, highlight){
  return `
  <div class="card job-card ${highlight?'followup':''}">
    <div class="job-top">
      <div>
        <h4>${esc(j.title||'Untitled role')}</h4>
        <div class="job-meta">${esc(j.company||'—')}${j.location? ' · '+esc(j.location):''}</div>
      </div>
      <span class="pill ${j.status}">${j.status}</span>
    </div>
    ${highlight? `<div class="followup-tag">⏰ Follow up — was due ${fmtDate(j.followUpDate)}</div>`:''}
    <div class="job-dates">
      <span>Applied <b>${fmtDate(j.dateApplied)}</b></span>
      ${j.assessmentDate? `<span>Assessment <b>${fmtDate(j.assessmentDate)}</b></span>`:''}
      ${j.interviewDate? `<span>Interview <b>${fmtDate(j.interviewDate)}</b></span>`:''}
      ${j.followUpDate? `<span>Follow-up <b>${fmtDate(j.followUpDate)}</b></span>`:''}
    </div>
    ${j.notes? `<div class="small muted" style="margin-top:8px;">${esc(j.notes)}</div>`:''}
    <div class="btn-row">
      ${j.link? `<a class="btn secondary" style="text-decoration:none;" href="${esc(j.link)}" target="_blank" rel="noopener">Open link</a>`:''}
      <button class="btn secondary" onclick="openJobForm('${j.id}')">Edit</button>
      <button class="btn danger" onclick="deleteJob('${j.id}')">Delete</button>
    </div>
  </div>`;
}

function jobsAppliedThisMonth(){
  const mk = currentMonthKey();
  return state.jobs.filter(j=>monthKeyOf(j.dateApplied)===mk).length;
}

function openJobForm(id){
  const j = id? state.jobs.find(x=>x.id===id) : { id:uid(), company:'',title:'',location:'',dateApplied:todayISO(),link:'',status:'Applied',assessmentDate:'',interviewDate:'',followUpDate:'',notes:''};
  const isNew = !id;
  openModal(`
    <div class="modal-head"><h3>${isNew?'Apply to a job':'Edit application'}</h3><button class="x-btn" onclick="closeModal()">✕</button></div>
    <label>Company *</label><input type="text" id="jCompany" value="${esc(j.company)}" placeholder="Required">
    <label>Job title *</label><input type="text" id="jTitle" value="${esc(j.title)}" placeholder="Required">
    <div class="form-grid-2">
      <div><label>Date applied *</label><input type="date" id="jDateApplied" value="${j.dateApplied||todayISO()}"></div>
      <div><label>Status *</label>
        <select id="jStatus">${STATUSES.map(s=>`<option ${s===j.status?'selected':''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="divider"></div>
    <div class="small muted" style="font-weight:600;margin-bottom:4px;">Optional details</div>
    <label>Location</label><input type="text" id="jLocation" value="${esc(j.location)}">
    <label>Application link</label><input type="url" id="jLink" value="${esc(j.link)}" placeholder="https://">
    <div class="form-grid-2">
      <div><label>Assessment date</label><input type="date" id="jAssessment" value="${j.assessmentDate||''}"></div>
      <div><label>Interview date</label><input type="date" id="jInterview" value="${j.interviewDate||''}"></div>
    </div>
    <label>Follow-up date</label><input type="date" id="jFollowUp" value="${j.followUpDate||''}">
    <label>Notes</label><textarea id="jNotes">${esc(j.notes)}</textarea>
    <div class="btn-row"><button class="btn block" onclick="saveJob('${j.id}', ${isNew})">Save application</button></div>
  `);
}
function saveJob(id, isNew){
  const company = document.getElementById('jCompany').value.trim();
  const title = document.getElementById('jTitle').value.trim();
  const dateApplied = document.getElementById('jDateApplied').value;
  if(!company || !title || !dateApplied){ showToast('Company, title and date applied are required'); return; }
  const job = {
    id, company, title,
    location: document.getElementById('jLocation').value.trim(),
    dateApplied,
    status: document.getElementById('jStatus').value,
    link: document.getElementById('jLink').value.trim(),
    assessmentDate: document.getElementById('jAssessment').value,
    interviewDate: document.getElementById('jInterview').value,
    followUpDate: document.getElementById('jFollowUp').value,
    notes: document.getElementById('jNotes').value.trim(),
  };
  if(isNew) state.jobs.unshift(job);
  else { const idx=state.jobs.findIndex(x=>x.id===id); state.jobs[idx]=job; }
  saveState(); closeModal(); renderCareer();
  showToast(isNew ? careerMentorComment() : 'Application updated');
}
function deleteJob(id){
  if(!confirm('Delete this application? This cannot be undone.')) return;
  state.jobs = state.jobs.filter(j=>j.id!==id);
  saveState(); renderCareer();
  showToast('Application deleted');
}

/* ================================================================
   SKILLS
================================================================= */
function renderSkills(){
  const skills = state.skills;
  const totalHours = skills.reduce((a,s)=>a+sumLogs(s),0);
  const weekDates = lastNDates(7);
  const weekHours = skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>weekDates.includes(l.date)).reduce((x,l)=>x+l.hours,0),0);
  const monthHours = hoursStudiedInMonth(currentMonthKey());
  const completedCount = skills.filter(s=>s.completion>=100).length;

  document.getElementById('view-skills').innerHTML = `
    <div class="btn-row" style="margin-top:0;"><button class="btn block fab" onclick="openSkillForm()">+ Add skill</button></div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>Learning stats</div>
    <div class="card accent-lavender">
      <div class="stat-grid cols-3">
        <div class="stat-box"><div class="stat-num">${Math.round(weekHours*10)/10}h</div><div class="stat-label">This week</div></div>
        <div class="stat-box"><div class="stat-num">${monthHours}h</div><div class="stat-label">This month</div></div>
        <div class="stat-box"><div class="stat-num">${Math.round(totalHours*10)/10}h</div><div class="stat-label">All time</div></div>
      </div>
      <div class="divider"></div>
      <div class="small muted">${completedCount} of ${skills.length} skills completed</div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Skills (${skills.length})</div>
    ${skills.length? skills.map(skillCard).join('') : `<div class="empty">📚<span class="big"></span>No skills tracked yet.</div>`}
  `;
}
function sumLogs(s){ return (s.logs||[]).reduce((a,l)=>a+(Number(l.hours)||0),0); }
function nextStepFor(s){
  if(s.completion>=100) return "Completed — consider starting a project to apply it.";
  if(s.completion===0) return `Start with the basics of ${s.topic||s.skill}.`;
  if(s.completion<50) return `Keep building fundamentals — try a small exercise in ${s.topic||s.skill}.`;
  if(s.completion<85) return "You're past the halfway mark — try applying it in a mini project.";
  return "Almost there — polish and complete your certificate/project.";
}

function skillCard(s){
  const hours = sumLogs(s);
  const weekH = (s.logs||[]).filter(l=>lastNDates(7).includes(l.date)).reduce((a,l)=>a+Number(l.hours||0),0);
  return `
  <div class="card accent-lavender">
    <div class="row"><h4 style="margin:0;font-size:15px;">${esc(s.skill)}</h4><span class="small muted">${s.completion||0}%</span></div>
    <div class="small muted">${esc(s.topic||'')}</div>
    <div class="track"><div class="fill" style="width:${s.completion||0}%;background:linear-gradient(90deg,var(--lavender),var(--blush))"></div></div>
    <div class="small muted" style="margin-top:8px;">${Math.round(hours*10)/10}h total · ${Math.round(weekH*10)/10}h this week${s.startDate? ' · started '+fmtDate(s.startDate):''}</div>
    ${s.course? `<div class="small" style="margin-top:3px;">📘 ${esc(s.course)}</div>`:''}
    ${s.certificate? `<div class="small">🏅 ${esc(s.certificate)}</div>`:''}
    ${s.project? `<div class="small">🛠️ ${esc(s.project)}</div>`:''}
    <div class="small" style="margin-top:8px;color:var(--lavender);">➡️ ${esc(nextStepFor(s))}</div>
    <div class="btn-row">
      <button class="btn secondary" onclick="openLogHours('${s.id}')">Log hours</button>
      <button class="btn secondary" onclick="openSkillForm('${s.id}')">Edit</button>
      <button class="btn danger" onclick="deleteSkill('${s.id}')">Delete</button>
    </div>
  </div>`;
}

function openSkillForm(id){
  const s = id? state.skills.find(x=>x.id===id) : {id:uid(),skill:'',topic:'',startDate:todayISO(),completion:0,course:'',certificate:'',project:'',logs:[]};
  const isNew = !id;
  openModal(`
    <div class="modal-head"><h3>${isNew?'Add':'Edit'} skill</h3><button class="x-btn" onclick="closeModal()">✕</button></div>
    <label>Skill *</label><input type="text" id="sSkill" value="${esc(s.skill)}" placeholder="e.g. Data Analysis">
    <label>Topic / focus</label><input type="text" id="sTopic" value="${esc(s.topic)}" placeholder="e.g. SQL joins & window functions">
    <label>Start date</label><input type="date" id="sStart" value="${s.startDate||''}">
    <label>Completion — <span id="sCompVal">${s.completion||0}</span>%</label>
    <input type="range" id="sCompletion" min="0" max="100" value="${s.completion||0}" oninput="document.getElementById('sCompVal').textContent=this.value">
    <label>Course</label><input type="text" id="sCourse" value="${esc(s.course)}">
    <label>Certificate</label><input type="text" id="sCert" value="${esc(s.certificate)}">
    <label>Project created</label><input type="text" id="sProject" value="${esc(s.project)}">
    <div class="btn-row"><button class="btn block" onclick="saveSkill('${s.id}', ${isNew})">Save</button></div>
  `);
}
function saveSkill(id, isNew){
  const skillName = document.getElementById('sSkill').value.trim();
  if(!skillName){ showToast('Skill name is required'); return; }
  const existing = isNew? {logs:[], completedAt:null} : state.skills.find(x=>x.id===id);
  const newCompletion = Number(document.getElementById('sCompletion').value);
  const skill = {
    id, skill: skillName,
    topic: document.getElementById('sTopic').value.trim(),
    startDate: document.getElementById('sStart').value,
    completion: newCompletion,
    course: document.getElementById('sCourse').value.trim(),
    certificate: document.getElementById('sCert').value.trim(),
    project: document.getElementById('sProject').value.trim(),
    logs: existing.logs || [],
    completedAt: existing.completedAt || null,
  };
  if(newCompletion>=100 && !skill.completedAt) skill.completedAt = todayISO();
  if(newCompletion<100) skill.completedAt = null;
  if(isNew) state.skills.unshift(skill);
  else { const idx=state.skills.findIndex(x=>x.id===id); state.skills[idx]=skill; }
  saveState(); closeModal(); renderSkills();
  showToast('Skill saved');
}
function deleteSkill(id){
  if(!confirm('Delete this skill? This cannot be undone.')) return;
  state.skills = state.skills.filter(s=>s.id!==id);
  saveState(); renderSkills();
}
function openLogHours(id){
  openModal(`
    <div class="modal-head"><h3>Log study hours</h3><button class="x-btn" onclick="closeModal()">✕</button></div>
    <label>Date</label><input type="date" id="lDate" value="${todayISO()}">
    <label>Hours</label><input type="number" id="lHours" min="0" step="0.25" value="1">
    <div class="btn-row"><button class="btn block" onclick="saveLogHours('${id}')">Add</button></div>
  `);
}
function saveLogHours(id){
  const s = state.skills.find(x=>x.id===id);
  const date = document.getElementById('lDate').value || todayISO();
  const hours = Number(document.getElementById('lHours').value)||0;
  if(hours<=0){ showToast('Enter hours greater than 0'); return; }
  if(!s.logs) s.logs=[];
  s.logs.push({date, hours});
  saveState(); closeModal(); renderSkills();
  showToast(skillsMentorComment(hours));
}

/* ================================================================
   TASKS (TODAY)
================================================================= */
function getDayTasks(date){
  if(!state.tasks[date]) state.tasks[date] = {top3:[{text:'',done:false},{text:'',done:false},{text:'',done:false}], job:[], learning:[], personal:[], habits:[]};
  const d = state.tasks[date];
  if(!d.top3 || typeof d.top3[0]==='string') d.top3=[{text:'',done:false},{text:'',done:false},{text:'',done:false}];
  if(!d.job) d.job=[]; if(!d.learning) d.learning=[]; if(!d.personal) d.personal=[]; if(!d.habits) d.habits=[];
  return d;
}

function renderTasks(){
  const t = todayISO();
  const d = getDayTasks(t);
  const allItems = [...d.job,...d.learning,...d.personal];
  const doneCount = allItems.filter(x=>x.done).length + d.habits.filter(h=>h.done).length;
  const totalCount = allItems.length + d.habits.length;

  document.getElementById('view-tasks').innerHTML = `
    <div class="card accent-blush">
      <div class="row"><span style="font-weight:700;">Today's progress</span><span class="muted small">${doneCount} / ${totalCount||0} tasks completed</span></div>
      <div class="track"><div class="fill" style="width:${totalCount? Math.round(doneCount/totalCount*100):0}%;background:linear-gradient(90deg,var(--blush),var(--gold))"></div></div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Top 3 priorities today</div>
    <div class="card accent-gold">
      ${[0,1,2].map(i=>`
        <div class="chip-check ${d.top3[i].done?'done':''}" style="gap:10px;">
          <input type="checkbox" id="top3-${i}" ${d.top3[i].done?'checked':''} ${d.top3[i].text?'':'disabled'} onchange="toggleTop3(${i})">
          <input type="text" style="flex:1;border:none;background:transparent;padding:6px 0;" placeholder="Priority ${i+1}" value="${esc(d.top3[i].text)}" onchange="setTop3Text(${i}, this.value)">
        </div>`).join('')}
    </div>

    <div class="section-title"><span class="dot" style="background:var(--teal)"></span>💼 Career</div>
    <div class="card accent-teal">${taskListHtml(d.job,'job')}</div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>📚 Learning</div>
    <div class="card accent-lavender">${taskListHtml(d.learning,'learning')}</div>

    <div class="section-title"><span class="dot" style="background:var(--sage)"></span>🏠 Personal</div>
    <div class="card accent-sage">${taskListHtml(d.personal,'personal')}</div>

    <div class="section-title"><span class="dot" style="background:var(--coral)"></span>🔥 Habits</div>
    <div class="card accent-coral">${habitListHtml(d.habits)}</div>
  `;
}
function setTop3Text(i,val){
  const d = getDayTasks(todayISO()); d.top3[i].text=val; if(!val) d.top3[i].done=false; saveState(); renderTasks();
}
function toggleTop3(i){
  const d = getDayTasks(todayISO()); d.top3[i].done = !d.top3[i].done; saveState(); renderTasks();
}
function taskListHtml(list, group){
  const rows = list.map((item,idx)=>`
    <div class="chip-check ${item.done?'done':''}">
      <input type="checkbox" id="${group}${idx}" ${item.done?'checked':''} onchange="toggleTask('${group}',${idx})">
      <label for="${group}${idx}">${esc(item.text)}</label>
      <button class="x-btn" style="font-size:15px;padding:0 4px;" onclick="removeTask('${group}',${idx})">✕</button>
    </div>`).join('');
  return rows + `
    <div style="display:flex;gap:6px;margin-top:8px;">
      <input type="text" id="new-${group}" placeholder="Add a task…" style="flex:1;" onkeydown="if(event.key==='Enter') addTask('${group}')">
      <button class="btn secondary" onclick="addTask('${group}')">Add</button>
    </div>`;
}
function addTask(group){
  const input = document.getElementById('new-'+group);
  const text = input.value.trim();
  if(!text) return;
  const d = getDayTasks(todayISO());
  d[group].push({text, done:false});
  saveState(); renderTasks();
}
function toggleTask(group, idx){
  const d = getDayTasks(todayISO());
  d[group][idx].done = !d[group][idx].done;
  saveState(); renderTasks();
}
function removeTask(group, idx){
  const d = getDayTasks(todayISO());
  d[group].splice(idx,1);
  saveState(); renderTasks();
}
function habitListHtml(habits){
  const rows = habits.map((h,idx)=>`
    <div class="chip-check ${h.done?'done':''}">
      <input type="checkbox" id="hab${idx}" ${h.done?'checked':''} onchange="toggleHabit(${idx})">
      <label for="hab${idx}">${esc(h.name)}</label>
      <button class="x-btn" style="font-size:15px;padding:0 4px;" onclick="removeHabit(${idx})">✕</button>
    </div>`).join('');
  return rows + `
    <div style="display:flex;gap:6px;margin-top:8px;">
      <input type="text" id="new-habit" placeholder="Add a habit… (e.g. Read 20 min)" style="flex:1;" onkeydown="if(event.key==='Enter') addHabit()">
      <button class="btn secondary" onclick="addHabit()">Add</button>
    </div>`;
}
function addHabit(){
  const input = document.getElementById('new-habit');
  const name = input.value.trim();
  if(!name) return;
  const d = getDayTasks(todayISO());
  d.habits.push({name, done:false});
  saveState(); renderTasks();
}
function toggleHabit(idx){
  const d = getDayTasks(todayISO());
  d.habits[idx].done = !d.habits[idx].done;
  saveState(); renderTasks();
}
function removeHabit(idx){
  const d = getDayTasks(todayISO());
  d.habits.splice(idx,1);
  saveState(); renderTasks();
}

/* ================================================================
   GOALS
================================================================= */
function hoursStudiedInMonth(mk){
  let total=0;
  state.skills.forEach(s=>(s.logs||[]).forEach(l=>{ if(monthKeyOf(l.date)===mk) total+=Number(l.hours)||0; }));
  return Math.round(total*10)/10;
}
function skillsCompletedInMonth(mk){
  return state.skills.filter(s=>s.completedAt && monthKeyOf(s.completedAt)===mk).length;
}
function projectsCompletedInMonth(mk){
  return state.skills.filter(s=>s.project && s.completedAt && monthKeyOf(s.completedAt)===mk).length;
}
function businessExperimentsInMonth(mk){
  return state.business.ideas.filter(i=>i.startedAt && monthKeyOf(new Date(i.startedAt).toISOString().slice(0,10))===mk).length;
}
function habitCompletionsInMonth(mk){
  let total=0;
  Object.keys(state.tasks).forEach(date=>{
    if(monthKeyOf(date)===mk){ total += (state.tasks[date].habits||[]).filter(h=>h.done).length; }
  });
  return total;
}

function renderGoals(){
  const mk = currentMonthKey();
  const goal = state.goals[mk] || {};
  const rows = [
    {key:'jobsTarget', icon:'💼', label:'Apply to jobs', actual: jobsAppliedThisMonth()},
    {key:'hoursTarget', icon:'📚', label:'Study hours', actual: hoursStudiedInMonth(mk)},
    {key:'skillsTarget', icon:'🎓', label:'Complete skills', actual: skillsCompletedInMonth(mk)},
    {key:'projectsTarget', icon:'🛠️', label:'Build projects', actual: projectsCompletedInMonth(mk)},
    {key:'businessTarget', icon:'💡', label:'Test business ideas', actual: businessExperimentsInMonth(mk)},
    {key:'habitsTarget', icon:'🔥', label:'Habit check-ins', actual: habitCompletionsInMonth(mk)},
  ];
  const activeRows = rows.filter(r=>goal[r.key]);
  const overallPct = activeRows.length ? Math.round(activeRows.reduce((a,r)=>a+Math.min(1,r.actual/goal[r.key]),0)/activeRows.length*100) : 0;

  document.getElementById('view-goals').innerHTML = `
    <div class="card glow-gold">
      <div class="score-wrap">
        <div class="ring">${ringSvg(overallPct,88,'var(--gold)')}<div class="ring-num"><span class="n">${overallPct}%</span><span class="d">COMPLETE</span></div></div>
        <div>
          <div style="font-family:'Fraunces',serif;font-size:16px;font-weight:600;">${monthLabel(mk)}</div>
          <div class="small muted">${activeRows.length? 'Overall progress toward your monthly targets' : 'Set your targets below to start tracking'}</div>
        </div>
      </div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Targets</div>
    <div class="card accent-gold">
      ${rows.map(r=>`
        <div style="margin-bottom:14px;">
          <div class="row small" style="margin-bottom:4px;">
            <span>${r.icon} ${r.label}</span>
            <span class="muted">${r.actual} / <input type="number" min="0" style="width:56px;display:inline-block;padding:3px 6px;" value="${goal[r.key]??''}" onchange="setGoalTarget('${r.key}', this.value)"></span>
          </div>
          <div class="track"><div class="fill" style="width:${goal[r.key]?Math.min(100,Math.round(r.actual/goal[r.key]*100)):0}%"></div></div>
        </div>`).join('')}
      <p class="disclaimer">Progress updates automatically from your Career, Skills, Business and Today tabs.</p>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>Monthly review</div>
    ${monthlyReviewCard(mk, rows)}
  `;
}
function setGoalTarget(key, val){
  const mk = currentMonthKey();
  if(!state.goals[mk]) state.goals[mk]={};
  state.goals[mk][key] = val===''? undefined : Number(val);
  saveState(); renderGoals();
}
function monthlyReviewCard(mk, rows){
  const goal = state.goals[mk] || {};
  const active = rows.filter(r=>goal[r.key]);
  if(!active.length) return `<div class="card"><div class="empty small">Set at least one target to see your monthly review.</div></div>`;
  const completed = active.filter(r=>r.actual>=goal[r.key]);
  const missed = active.filter(r=>r.actual<goal[r.key]);
  const best = [...active].sort((a,b)=> (b.actual/goal[b.key]) - (a.actual/goal[a.key]))[0];
  const focus = missed.length ? missed.sort((a,b)=>(a.actual/goal[a.key])-(b.actual/goal[b.key]))[0] : null;
  return `
  <div class="card accent-lavender">
    <div class="small" style="margin-bottom:6px;"><b>✅ Completed</b> ${completed.length? esc(completed.map(r=>r.label).join(', ')) : 'None yet — keep going.'}</div>
    <div class="small" style="margin-bottom:6px;"><b>⏳ Missed / in progress</b> ${missed.length? esc(missed.map(r=>r.label).join(', ')) : 'Nothing — you are on track everywhere.'}</div>
    <div class="small" style="margin-bottom:6px;"><b>🏆 Best achievement</b> ${best? esc(best.label)+` (${Math.round(best.actual/goal[best.key]*100)}%)` : '—'}</div>
    <div class="small"><b>➡️ Suggested focus for next month</b> ${focus? esc(focus.label) : 'Keep the same balance going.'}</div>
  </div>`;
}

/* ================================================================
   BUSINESS IDEA LAB
================================================================= */
const IDEA_TEMPLATES = [
  {tags:['writing','content','marketing','social media','communication'], title:'Freelance content & copywriting',
   problem:'Small businesses need consistent social posts, blogs and emails but do not have time to write them.',
   targetCustomer:'Local small businesses, solo coaches, and small e-commerce shops',
   solution:'Offer a simple monthly content package: posts, captions and one blog/newsletter.',
   startupCost:'$0–$20 (just a laptop + free tools)', difficulty:'Easy',
   revenueModel:'Flat monthly retainer per client (e.g. $50–$200/month) or per-piece pricing',
   firstCustomer:'Message 10 local business owners you already know or follow on Instagram, offer one free sample post.',
   mvp:'Write 3 sample posts for a real local business as a portfolio piece before pitching paid work.'},
  {tags:['design','art','visual','photography','social media'], title:'Social media design service',
   problem:'Local shops and creators have inconsistent, unpolished visuals.',
   targetCustomer:'Cafes, boutiques, personal trainers, small event organizers',
   solution:'Design a month of branded social templates using free tools like Canva.',
   startupCost:'$0 (Canva free tier)', difficulty:'Easy',
   revenueModel:'Monthly package ($30–$150) or one-off template packs',
   firstCustomer:'Offer a free redesign of one post to 5 businesses with weak Instagram feeds, then pitch the package.',
   mvp:'Create a 5-post template set for one real business as a demo.'},
  {tags:['coding','programming','tech','software','web','data'], title:'Micro web tools for local businesses',
   problem:'Many small businesses still do not have a booking page, simple website, or basic automation.',
   targetCustomer:'Local service businesses without a working website (salons, tutors, repair shops)',
   solution:'Build simple, fast one-page sites or booking forms using free/low-cost no-code or code tools.',
   startupCost:'$0–$15/month for hosting', difficulty:'Medium',
   revenueModel:'One-time build fee ($50–$300) plus optional small monthly maintenance fee',
   firstCustomer:'Search Google Maps for local businesses with no website or a broken one, send a short offer email.',
   mvp:'Build one free demo site for a real local business to use as your portfolio piece.'},
  {tags:['teaching','tutoring','education','coaching','mentoring'], title:'Micro-tutoring or coaching sessions',
   problem:'People want quick, affordable 1:1 help in a specific skill but cannot commit to expensive courses.',
   targetCustomer:'Students, career switchers, or hobbyists in your area of expertise',
   solution:'Offer focused 30–45 minute sessions on a specific skill you already have.',
   startupCost:'$0', difficulty:'Easy',
   revenueModel:'Pay-per-session ($10–$40/hour to start) via bank transfer or a free scheduling link',
   firstCustomer:'Post in a relevant Facebook/Discord/WhatsApp community offering your first 3 sessions at a discount.',
   mvp:'Run one free trial session with a friend or acquaintance and ask for a testimonial.'},
  {tags:['ecommerce', 'reselling', 'products', 'handmade', 'crafts'], title:'Curated reselling or handmade micro-shop',
   problem:'People want unique or convenient products but do not want to search everywhere for them.',
   targetCustomer:'Local buyers or a specific online niche community',
   solution:'Source or make a small batch of products and sell through Instagram/Marketplace, no inventory upfront if using pre-orders.',
   startupCost:'$20–$100 for first small batch', difficulty:'Medium',
   revenueModel:'Per-item margin, start with pre-orders to avoid holding stock',
   firstCustomer:'Post the first 5 items to your personal network and a local buy/sell group, take pre-orders.',
   mvp:'Make or source 3 sample products and test demand with a simple pre-order post.'},
  {tags:['fitness', 'health', 'wellness', 'nutrition'], title:'Simple accountability coaching',
   problem:'People starting a fitness or habit goal often quit from lack of accountability.',
   targetCustomer:'Beginners wanting a simple habit or fitness check-in system',
   solution:'Offer a lightweight weekly check-in service (messages + a simple plan), no gym or equipment needed.',
   startupCost:'$0', difficulty:'Easy',
   revenueModel:'Weekly or monthly flat fee ($15–$50/month)',
   firstCustomer:'Offer 2 weeks free to 3 people in your network in exchange for honest feedback.',
   mvp:'Run a 2-week free pilot with one person and document the results.'},
  {tags:['organizing', 'admin', 'virtual assistant', 'operations'], title:'Virtual assistant for small business owners',
   problem:'Solo founders drown in admin: inbox, scheduling, data entry, research.',
   targetCustomer:'Solo founders, consultants, real estate agents, coaches',
   solution:'Offer a few hours a week of remote admin support.',
   startupCost:'$0', difficulty:'Easy',
   revenueModel:'Hourly rate ($8–$25/hr depending on market) or a small weekly retainer',
   firstCustomer:'Reach out to 10 solo founders/consultants on LinkedIn offering 2 free hours of help.',
   mvp:'Complete one real admin task for a business contact for free to build a case study.'},
  {tags:['video', 'editing', 'youtube', 'content'], title:'Short-form video editing service',
   problem:'Creators and small brands know they need Reels/TikTok/Shorts but do not have time to edit.',
   targetCustomer:'Small content creators, local businesses starting on social video',
   solution:'Offer to edit raw footage into 3–5 short clips per week using free/cheap editing tools.',
   startupCost:'$0 (CapCut free) – $10/month for a pro tool', difficulty:'Medium',
   revenueModel:'Per-video pricing ($5–$20) or a weekly package',
   firstCustomer:'Offer to edit one free video for a creator or business you follow, then pitch ongoing work.',
   mvp:'Edit one sample reel from free stock or your own footage to show your style.'},
];

function renderBusiness(){
  const inputs = state.business.inputs;
  const ideas = [...state.business.ideas].sort((a,b)=>b.createdAt-a.createdAt);
  const mk = currentMonthKey();
  const expThisMonth = businessExperimentsInMonth(mk);
  const totalRevenue = state.business.ideas.reduce((a,i)=>a+(Number(i.revenue)||0),0);

  document.getElementById('view-business').innerHTML = `
    <div class="section-title"><span class="dot" style="background:var(--coral)"></span>Business stats</div>
    <div class="card accent-coral">
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-num">${expThisMonth}</div><div class="stat-label">Experiments this month</div></div>
        <div class="stat-box"><div class="stat-num">$${totalRevenue}</div><div class="stat-label">Revenue generated</div></div>
      </div>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--coral)"></span>Tell us about you</div>
    <div class="card accent-coral">
      <label>Your skills</label><input type="text" id="biSkills" value="${esc(inputs.skills)}" placeholder="e.g. writing, design, coding, cooking">
      <label>Available budget</label><input type="text" id="biBudget" value="${esc(inputs.budget)}" placeholder="e.g. under $50">
      <label>Time available per week</label><input type="text" id="biTime" value="${esc(inputs.time)}" placeholder="e.g. 5 hours">
      <label>Interests</label><input type="text" id="biInterests" value="${esc(inputs.interests)}" placeholder="e.g. fitness, tech, teaching">
      <div class="btn-row"><button class="btn block fab" onclick="generateIdeas()">✨ Generate business ideas</button></div>
      <p class="disclaimer">Ideas are generated from a curated set of low-cost, beginner-friendly business patterns — a starting point to research and validate yourself, not financial advice.</p>
    </div>

    <div class="section-title"><span class="dot" style="background:var(--gold)"></span>Your ideas (${ideas.length})</div>
    ${ideas.length? ideas.map(ideaCard).join('') : `<div class="empty">💡<span class="big"></span>No ideas yet — fill in the form above and generate some.</div>`}
  `;
}

function generateIdeas(){
  const inputs = {
    skills: document.getElementById('biSkills').value.trim(),
    budget: document.getElementById('biBudget').value.trim(),
    time: document.getElementById('biTime').value.trim(),
    interests: document.getElementById('biInterests').value.trim(),
  };
  state.business.inputs = inputs;
  const text = (inputs.skills+' '+inputs.interests).toLowerCase();

  let scored = IDEA_TEMPLATES.map(t=>{
    const score = t.tags.reduce((a,tag)=> a + (text.includes(tag)?1:0), 0);
    return {t, score};
  }).sort((a,b)=>b.score-a.score);

  let chosen = scored.filter(s=>s.score>0).slice(0,3).map(s=>s.t);
  if(chosen.length<3){
    const remaining = IDEA_TEMPLATES.filter(t=>!chosen.includes(t));
    chosen = chosen.concat(remaining.slice(0, 3-chosen.length));
  }

  const budgetNote = inputs.budget || 'a small budget';
  const timeNote = inputs.time || 'a few hours a week';

  chosen.forEach(t=>{
    state.business.ideas.unshift({
      id: uid(), createdAt: Date.now(), status:'saved', startedAt:null, revenue:0,
      title: t.title, problem: t.problem, targetCustomer: t.targetCustomer, solution: t.solution,
      startupCost: t.startupCost, difficulty: t.difficulty, revenueModel: t.revenueModel,
      firstCustomer: t.firstCustomer,
      validationPlan: `Day 1–2: Message or post to 10 potential customers describing the idea. Day 3–4: ${t.mvp} Day 5: Share it with 5 more people and ask if they would pay. Day 6: Adjust the offer based on feedback. Day 7: Try to get one real "yes" — a payment, deposit, or firm commitment, working within ${timeNote} and ${budgetNote}.`,
      mvp: t.mvp,
    });
  });
  saveState(); renderBusiness();
  showToast('3 ideas generated');
}

const IDEA_STATUS_LABEL = {saved:'Saved', active:'Active experiment', completed:'Completed'};
const IDEA_STATUS_COLOR = {saved:'var(--text-muted)', active:'var(--gold)', completed:'var(--sage)'};

function ideaCard(i){
  const status = i.status || 'saved';
  return `
  <div class="card idea-card accent-coral">
    <div class="row">
      <h4>💡 ${esc(i.title)}</h4>
      <button class="x-btn" onclick="deleteIdea('${i.id}')">✕</button>
    </div>
    <span class="idea-status-badge" style="background:rgba(255,255,255,0.06);color:${IDEA_STATUS_COLOR[status]}">${IDEA_STATUS_LABEL[status]}</span>
    <div class="idea-field"><div class="k">🎯 Problem</div><div class="v">${esc(i.problem)}</div></div>
    <div class="idea-field"><div class="k">👥 Target customer</div><div class="v">${esc(i.targetCustomer)}</div></div>
    <div class="idea-field"><div class="k">🛠️ Solution</div><div class="v">${esc(i.solution)}</div></div>
    <div class="form-grid-2" style="margin-top:8px;">
      <div class="idea-field"><div class="k">💰 Startup cost</div><div class="v">${esc(i.startupCost)}</div></div>
      <div class="idea-field"><div class="k">Difficulty</div><div class="v">${esc(i.difficulty)}</div></div>
    </div>
    <div class="idea-field"><div class="k">💵 Revenue model</div><div class="v">${esc(i.revenueModel)}</div></div>
    <div class="idea-field"><div class="k">🚀 First customer</div><div class="v">${esc(i.firstCustomer)}</div></div>
    <div class="idea-field"><div class="k">📅 7-day validation plan</div><div class="v">${esc(i.validationPlan)}</div></div>
    <div class="idea-field"><div class="k">🧪 MVP</div><div class="v">${esc(i.mvp)}</div></div>
    <div class="divider"></div>
    <label>Revenue logged ($)</label>
    <input type="number" min="0" value="${i.revenue||0}" onchange="setIdeaRevenue('${i.id}', this.value)">
    <div class="btn-row">
      ${status==='saved'? `<button class="btn secondary" onclick="setIdeaStatus('${i.id}','active')">Start experiment</button>`:''}
      ${status==='active'? `<button class="btn secondary" onclick="setIdeaStatus('${i.id}','completed')">Mark completed</button>`:''}
      ${status==='completed'? `<button class="btn secondary" onclick="setIdeaStatus('${i.id}','saved')">Reopen</button>`:''}
      <button class="btn danger" onclick="deleteIdea('${i.id}')">Delete</button>
    </div>
  </div>`;
}
function setIdeaStatus(id, status){
  const i = state.business.ideas.find(x=>x.id===id);
  if(status==='active'){ state.business.ideas.forEach(x=>{ if(x.status==='active') x.status='saved'; }); i.startedAt = Date.now(); }
  i.status = status;
  saveState(); renderBusiness();
  showToast(status==='active'? 'Experiment started ✨' : status==='completed'? 'Marked as completed 🎉' : 'Idea reopened');
}
function setIdeaRevenue(id, val){
  const i = state.business.ideas.find(x=>x.id===id);
  i.revenue = Number(val)||0;
  saveState(); renderBusiness();
}
function deleteIdea(id){
  if(!confirm('Delete this idea?')) return;
  state.business.ideas = state.business.ideas.filter(i=>i.id!==id);
  saveState(); renderBusiness();
}

/* ================================================================
   SETTINGS (backend URL, backup/restore, reset)
================================================================= */
document.getElementById('settingsBtn').addEventListener('click', openSettings);
function openSettings(){
  const n = state.settings.notifications;
  const catLabels = {morning:'☀️ Morning check-in', water:'💧 Hydration check', career:'💼 Career nudge', learning:'📚 Learning reminder', night:'🌙 Night wrap-up'};
  const notifSupported = (typeof window.Notification !== 'undefined' && window.Notification !== null);
  let permission = 'unsupported';
  if(notifSupported){ try{ permission = window.Notification.permission; }catch(e){ permission = 'unsupported'; } }

  openModal(`
    <div class="modal-head"><h3>⚙️ Settings</h3><button class="x-btn" onclick="closeModal()">✕</button></div>

    <div class="small muted" style="font-weight:700;margin-bottom:4px;">AI Mentor backend (optional)</div>
    <p class="disclaimer">Powers real AI food-photo analysis and richer chat replies via <code>/backend</code> (your API key stays server-side, never in this app). Leave blank and everything still works — manual food entry + the built-in local mentor engine.</p>
    <label>Backend URL</label>
    <input type="url" id="setBackendUrl" value="${esc(state.settings.backendUrl)}" placeholder="https://your-worker.example.workers.dev">
    <div class="btn-row"><button class="btn secondary" onclick="saveBackendUrl()">Save</button></div>

    <div class="divider"></div>
    <div class="small muted" style="font-weight:700;margin-bottom:4px;">Reminders (optional)</div>
    <p class="disclaimer">${notifSupported? 'These fire while this app is open, installed, or running in the background on supported browsers. True background push on a closed iPhone app needs a push server — see the README for details.' : 'Notifications are not supported in this browser.'}</p>
    ${notifSupported? `
      <div class="row" style="margin:8px 0;">
        <span class="small">${n.enabled? 'Reminders are ON' : 'Reminders are OFF'} ${permission==='denied'? '(blocked in browser settings)':''}</span>
        ${n.enabled
          ? `<button class="btn secondary" onclick="disableNotifications()">Turn off</button>`
          : `<button class="btn secondary" onclick="enableNotifications()">Turn on</button>`}
      </div>
      <div class="card" style="padding:12px 14px;margin-top:6px;">
        ${Object.keys(catLabels).map(cat=>`
          <div class="notif-cat-row">
            <span class="small">${catLabels[cat]}</span>
            <label class="switch"><input type="checkbox" ${n.categories[cat]?'checked':''} onchange="toggleNotifCategory('${cat}')"><span class="slider"></span></label>
          </div>`).join('')}
      </div>
      <div class="form-grid-2" style="margin-top:10px;">
        <div><label>Quiet hours from</label><input type="text" id="quietStart" value="${esc(n.quietStart)}" placeholder="22:00" onchange="setQuietHours(this.value, document.getElementById('quietEnd').value)"></div>
        <div><label>to</label><input type="text" id="quietEnd" value="${esc(n.quietEnd)}" placeholder="07:00" onchange="setQuietHours(document.getElementById('quietStart').value, this.value)"></div>
      </div>
    ` : ''}

    <div class="divider"></div>
    <div class="small muted" style="font-weight:700;margin-bottom:8px;">Your data</div>
    <div class="btn-row" style="margin-top:0;">
      <button class="btn secondary" onclick="exportData()">⬇️ Backup as JSON</button>
      <label class="btn secondary" style="margin:0;">⬆️ Restore backup
        <input type="file" accept="application/json" style="display:none;" onchange="importData(this.files[0])">
      </label>
    </div>

    <div class="divider"></div>
    <button class="btn danger block" onclick="resetAllData()">Reset all data</button>
    <p class="disclaimer">This app stores everything privately in this browser only. Back up regularly if you switch phones or clear browser data.</p>
  `);
}
function saveBackendUrl(){
  state.settings.backendUrl = document.getElementById('setBackendUrl').value.trim();
  saveState(); closeModal();
  showToast('Settings saved');
}
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `poojas-mentor-backup-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}
function importData(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const parsed = JSON.parse(e.target.result);
      if(!confirm('This will replace all current data with the backup. Continue?')) return;
      state = parsed;
      const d = defaultState();
      for(const k in d){ if(!(k in state)) state[k]=d[k]; }
      if(!state.settings) state.settings = {backendUrl:''};
      saveState(); closeModal(); renderAll(); setGreeting();
      showToast('Backup restored');
    }catch(err){ showToast('That file could not be read'); }
  };
  reader.readAsText(file);
}
function resetAllData(){
  if(!confirm('This will permanently delete all your data in this browser. Continue?')) return;
  if(!confirm('Are you absolutely sure? This cannot be undone.')) return;
  state = defaultState();
  saveState(); closeModal(); renderAll(); setGreeting();
  showToast('All data cleared');
}

/* ================================================================
   MENTOR ENGINE — personality, XP/levels, streaks, achievements,
   ghost mode, score breakdown, chat. All rule-based (Level 1) and
   works with zero external dependencies. See buildMentorContext()
   for how an optional AI backend (Level 2) can be plugged in.
================================================================= */

function pickName(){
  const pool = ['Pooja','babe','Poju','babe','Pooja','girl'];
  const dayIndex = new Date().getDate() + new Date().getHours();
  return pool[dayIndex % pool.length];
}
function hoursStudiedTotal(){ return state.skills.reduce((a,s)=>a+sumLogs(s),0); }

/* ---------- score breakdown (transparent, never faked) ---------- */
function computeScoreBreakdown(date){
  const water = Math.min(8, state.food.water[date]||0);
  const waterPts = Math.round((water/8)*20);

  const foodCount = state.food.entries.filter(e=>e.date===date).length;
  const foodPts = Math.round(Math.min(1, foodCount/2)*15);

  const routine = state.food.routine[date] || {hairAM:false,hairPM:false,skinAM:false,skinPM:false};
  const routineDone = [routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  const routinePts = Math.round((routineDone/4)*15);

  const dayTasks = state.tasks[date];
  const top3 = dayTasks ? dayTasks.top3 : [];
  const top3Filled = top3.filter(x=>x && x.text);
  const top3Done = top3.filter(x=>x && x.done).length;
  const top3Pts = top3Filled.length ? Math.round((top3Done/3)*20) : 0;

  const hours = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===date).reduce((x,l)=>x+Number(l.hours||0),0),0);
  const learningPts = Math.round(Math.min(1, hours/1)*15);

  const jobGroup = dayTasks ? dayTasks.job : [];
  const jobPts = jobGroup.length ? Math.round((jobGroup.filter(x=>x.done).length/jobGroup.length)*15) : (state.jobs.filter(j=>j.dateApplied===date).length>0 ? 15 : 0);

  const items = [
    {label:'💧 Water', points:waterPts, max:20},
    {label:'🍽️ Food logged', points:foodPts, max:15},
    {label:'✨ Routine', points:routinePts, max:15},
    {label:'🎯 Top 3 priorities', points:top3Pts, max:20},
    {label:'📚 Learning', points:learningPts, max:15},
    {label:'💼 Career task', points:jobPts, max:15},
  ];
  return { items, total: items.reduce((a,i)=>a+i.points,0) };
}
function computeScore(date){ return computeScoreBreakdown(date).total; }
function openScoreBreakdown(){
  const t = todayISO();
  const { items, total } = computeScoreBreakdown(t);
  openModal(`
    <div class="modal-head"><h3>Today's Score — ${total}/100</h3><button class="x-btn" onclick="closeModal()">✕</button></div>
    ${items.map(i=>`
      <div style="margin-bottom:12px;">
        <div class="row small"><span>${i.label}</span><span class="muted">${i.points}/${i.max}</span></div>
        <div class="track"><div class="fill" style="width:${i.max? Math.round(i.points/i.max*100):0}%"></div></div>
      </div>`).join('')}
    <p class="disclaimer">This score is fully calculated from your real data — nothing here is randomized or faked.</p>
  `);
}

/* ---------- XP / Levels ---------- */
function xpForLevel(n){ return Math.max(0, (n-1)*150); }
const XP_MILESTONES = [
  [1,'Starting Point 🌱'], [5,'Consistency Era 🌿'], [10,'Glow-Up Era 🌸'],
  [20,'Career Mode Activated 🔥'], [30,'Main Character Mode 👑'], [40,'Dream Life Mode 💎']
];
function computeXP(){
  let xp = 0;
  try{
    xp += (state.jobs||[]).length * 20;
    xp += (state.jobs||[]).filter(j=>['Interview','HR','Selected'].includes(j.status)).length * 30;
    (state.skills||[]).forEach(s=>{ xp += (s.logs||[]).length * 20; if((s.completion||0)>=100) xp += 50; });
    Object.values(state.food.water||{}).forEach(v=>{ if(v>=8) xp += 10; });
    Object.values(state.food.routine||{}).forEach(r=>{ xp += [r.hairAM,r.hairPM,r.skinAM,r.skinPM].filter(Boolean).length * 10; });
    Object.values(state.tasks||{}).forEach(d=>{
      xp += [...(d.job||[]),...(d.learning||[]),...(d.personal||[])].filter(x=>x.done).length * 5;
      xp += (d.habits||[]).filter(h=>h.done).length * 5;
      xp += (d.top3||[]).filter(x=>x.done).length * 5;
    });
    xp += (state.business.ideas||[]).filter(i=>i.status==='completed').length * 100;
    xp += state.gamification.bonusXp || 0;
  }catch(e){ /* never let gamification break the app */ }

  let level = 1;
  while(xp >= xpForLevel(level+1) && level < 200) level++;
  const cur = xpForLevel(level), next = xpForLevel(level+1);
  const pct = Math.max(0, Math.min(100, Math.round(((xp-cur)/(next-cur))*100)));
  let title = XP_MILESTONES[0][1];
  XP_MILESTONES.forEach(([lvl,t])=>{ if(level>=lvl) title=t; });
  return { xp, level, pct, xpToNext: next-xp, title };
}

/* ---------- Dream Unlocks (achievements) ---------- */
const ACHIEVEMENTS = [
  {id:'glow_era', icon:'🌸', title:'Glow Era', check:()=>routineStreak()>=7,
    locked:'Keep your self-care streak going to unlock this.', unlockedMsg:"You showed up consistently. That's the real glow-up. ❤️"},
  {id:'dream_career', icon:'💼', title:'Dream Career', check:()=>(state.jobs||[]).length>=10 && hoursStudiedTotal()>=5,
    locked:'Keep building your application + learning streak.', unlockedMsg:'You kept building toward your career. Be proud of yourself. 🔥'},
  {id:'skill_master', icon:'🧠', title:'Skill Master', check:()=>(state.skills||[]).some(s=>(s.completion||0)>=100),
    locked:'Complete your learning milestones.', unlockedMsg:"You didn't just learn it. You stayed consistent."},
  {id:'business_era', icon:'🚀', title:'Business Era', check:()=>(state.business.ideas||[]).some(i=>i.status==='completed'),
    locked:'Validate your idea and get your first real-world result.', unlockedMsg:"From idea to action. That's how it starts."},
  {id:'main_character', icon:'👑', title:'Main Character', check:()=>computeXP().level>=20,
    locked:'Reach Level 20 through consistent daily progress.', unlockedMsg:'Look at you actually keeping promises to yourself. 👑'},
  {id:'dream_life', icon:'💎', title:'Dream Life', check:()=>computeXP().level>=40,
    locked:'Keep going across every area to unlock this.', unlockedMsg:"Look how far you've come. 🥹❤️"},
];
function unlockChipHtml(a){
  const isUnlocked = !!(state.gamification.unlocked && state.gamification.unlocked[a.id]);
  return `<div class="unlock-card ${isUnlocked?'unlocked':''}" onclick='openUnlockInfo(${JSON.stringify(a.id)})'>
    <div class="unlock-icon">${a.icon}</div>
    <div class="unlock-title">${esc(a.title)}</div>
    <div class="unlock-status">${isUnlocked? 'Unlocked ✨' : 'Locked 🔒'}</div>
  </div>`;
}
function openUnlockInfo(id){
  const a = ACHIEVEMENTS.find(x=>x.id===id);
  if(!a) return;
  const isUnlocked = !!(state.gamification.unlocked && state.gamification.unlocked[a.id]);
  openModal(`
    <div class="unlock-celebrate">
      <div style="font-size:40px;margin-bottom:8px;">${a.icon}</div>
      <div class="unlock-big-title">${esc(a.title)}</div>
      <div class="unlock-msg">${isUnlocked? esc(a.unlockedMsg) : esc(a.locked)}</div>
      ${isUnlocked? `<div class="unlock-xp">Unlocked ✨</div>` : `<div class="small faint">🔒 Still locked</div>`}
      <div class="btn-row" style="justify-content:center;"><button class="btn secondary" onclick="closeModal()">Close</button></div>
    </div>
  `);
}
function runAchievementCheck(){
  if(!state.gamification.unlocked) state.gamification.unlocked = {};
  for(const a of ACHIEVEMENTS){
    try{
      if(!state.gamification.unlocked[a.id] && a.check()){
        state.gamification.unlocked[a.id] = Date.now();
        state.gamification.bonusXp = (state.gamification.bonusXp||0) + 100;
        saveState();
        showUnlockCelebration(a);
        break; // celebrate one at a time; the rest will show on the next visit
      }
    }catch(e){ /* a broken achievement check should never break Home */ }
  }
}
function showUnlockCelebration(a){
  openModal(`
    <div class="unlock-celebrate">
      <div class="avatar-ring"><img src="avatar/avatar-small.png" alt="Pooja" onerror="this.style.display='none'"></div>
      <div class="small muted" style="letter-spacing:.06em;font-weight:700;">✨ NEW UNLOCK ✨</div>
      <div class="unlock-big-title">${a.icon} ${esc(a.title)}</div>
      <div class="unlock-msg">${esc(a.unlockedMsg)}</div>
      <div class="unlock-xp">+100 XP</div>
      <div class="btn-row" style="justify-content:center;"><button class="btn" onclick="closeModal()">Continue</button></div>
    </div>
  `);
}

/* ---------- Ghost mode (inactivity) ---------- */
function daysSinceLastActivity(){
  try{
    const dates = [];
    (state.jobs||[]).forEach(j=>{ if(j.dateApplied) dates.push(j.dateApplied); });
    (state.food.entries||[]).forEach(e=>dates.push(e.date));
    Object.entries(state.food.water||{}).forEach(([d,v])=>{ if(v>0) dates.push(d); });
    Object.entries(state.food.routine||{}).forEach(([d,r])=>{ if([r.hairAM,r.hairPM,r.skinAM,r.skinPM].some(Boolean)) dates.push(d); });
    (state.skills||[]).forEach(s=>(s.logs||[]).forEach(l=>dates.push(l.date)));
    Object.entries(state.tasks||{}).forEach(([d,dt])=>{
      const anyDone = [...(dt.job||[]),...(dt.learning||[]),...(dt.personal||[])].some(x=>x.done) || (dt.habits||[]).some(h=>h.done) || (dt.top3||[]).some(x=>x.done);
      if(anyDone) dates.push(d);
    });
    if(!dates.length) return 0;
    dates.sort();
    const last = dates[dates.length-1];
    const diff = Math.round((new Date(todayISO()) - new Date(last)) / 86400000);
    return Math.max(0, diff);
  }catch(e){ return 0; }
}
function ghostBannerHtml(days){
  if(days < 3) return '';
  let msg;
  if(days>=30) msg = "THE COMEBACK IS REQUIRED. Do ONE thing today to break the ghost streak.";
  else if(days>=14) msg = "Your goals are asking where you are 👀 Do ONE thing today to break the ghost streak.";
  else if(days>=7) msg = "Girl... we've been ghosted for a WEEK 😂 Do ONE thing today to break the ghost streak.";
  else msg = "Pooja has entered ghost mode 👻 Do ONE thing today to break the ghost streak.";
  return `<div class="ghost-banner">👻 ${esc(msg)}</div>`;
}
function avatarReaction(score, inactiveDays){
  if(inactiveDays>=30) return "THE COMEBACK IS REQUIRED. 👀";
  if(inactiveDays>=14) return "Your goals are asking where you are 👀";
  if(inactiveDays>=7) return "Girl... we've been ghosted for a WEEK 😂";
  if(inactiveDays>=3) return "Pooja has entered ghost mode 👻";
  if(inactiveDays>=1) return "Quiet day 👀";
  if(score>=85) return "Pooja is ON FIRE 🔥";
  if(score>=60) return "Keep going ❤️";
  if(score>=30) return "I'm waiting for you 👀";
  return "Babe… what happened today? 😂";
}

/* ---------- Today's read / wins / missed / attention ---------- */
function todaysRead(t){
  const jobsToday = state.jobs.filter(j=>j.dateApplied===t).length;
  const jobsWeek = state.jobs.filter(j=>lastNDates(7).includes(j.dateApplied)).length;
  const career = jobsToday>0?'🔥':(jobsWeek>0?'🟢':'⚠️');

  const routine = state.food.routine[t]||{};
  const routineDone = [routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  const selfcare = routineDone>=3?'🔥':routineDone>=1?'🟢':'⚠️';

  const hoursToday = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0);
  const learning = hoursToday>=1?'🔥':hoursToday>0?'🟢':'⚠️';

  const mk = currentMonthKey(); const goal = state.goals[mk]||{};
  const actualMap = {jobsTarget:jobsAppliedThisMonth(), hoursTarget:hoursStudiedInMonth(mk), skillsTarget:skillsCompletedInMonth(mk), projectsTarget:projectsCompletedInMonth(mk)};
  const activeKeys = Object.keys(actualMap).filter(k=>goal[k]);
  let goalsEmoji = '🟢';
  if(activeKeys.length){
    const avgPct = activeKeys.reduce((a,k)=>a+Math.min(1, actualMap[k]/goal[k]), 0) / activeKeys.length;
    goalsEmoji = avgPct>=0.7?'🔥':avgPct>=0.3?'🟢':'⚠️';
  }
  return { career, selfcare, learning, goals: goalsEmoji };
}
function todaysWins(t){
  const wins = [];
  const water = state.food.water[t]||0; if(water>=8) wins.push('Hit your water goal 💧');
  const routine = state.food.routine[t]||{}; const rd=[routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  if(rd>=3) wins.push('Routine nearly complete ✨');
  const jobsToday = state.jobs.filter(j=>j.dateApplied===t).length; if(jobsToday>0) wins.push(`${jobsToday} job application${jobsToday>1?'s':''} 💼`);
  const hoursToday = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0);
  if(hoursToday>0) wins.push(`${Math.round(hoursToday*10)/10}h studied 📚`);
  const dt = getDayTasks(t); const top3Done = dt.top3.filter(x=>x.done).length; if(top3Done>0) wins.push(`${top3Done} top priorit${top3Done>1?'ies':'y'} done ✅`);
  return wins;
}
function todaysMissed(t){
  const missed = [];
  if((state.food.water[t]||0)===0) missed.push('No water logged yet 💧');
  if(state.food.entries.filter(e=>e.date===t).length===0) missed.push('No meals logged 🍽️');
  const routine = state.food.routine[t]||{}; const rd=[routine.hairAM,routine.hairPM,routine.skinAM,routine.skinPM].filter(Boolean).length;
  if(rd===0) missed.push('Routine not started ✨');
  if(state.jobs.filter(j=>j.dateApplied===t).length===0) missed.push('No applications today 💼');
  const hoursToday = state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0);
  if(hoursToday===0) missed.push('No study logged 📚');
  return missed;
}
function todaysAttention(){
  const items = [];
  const overdue = state.jobs.filter(needsFollowup).length;
  if(overdue>0) items.push(`${overdue} follow-up${overdue>1?'s':''} overdue ⏰`);
  const mk = currentMonthKey(); const goal = state.goals[mk]||{};
  if(goal.jobsTarget){
    const remaining = goal.jobsTarget - jobsAppliedThisMonth();
    const daysLeft = daysRemainingInMonth();
    if(remaining>0 && daysLeft>0 && remaining>daysLeft) items.push('Behind pace on jobs goal 📉');
  }
  return items;
}

/* ---------- End of day card ---------- */
function endOfDayTitle(score){
  if(score>=80) return 'YOU ATE TODAY 😭🔥';
  if(score>=40) return 'Not perfect, but progress.';
  return 'Okay… today was a little ghosted 😂';
}
function endOfDayMessage(score){
  if(score>=80) return 'Nothing to fix.\nGo sleep. You earned it. ❤️';
  if(score>=40) return "Tomorrow we improve one thing. ❤️";
  return "Tomorrow we restart.\nOne task. That's all I need from you.";
}

/* ---------- Mentor comments used across pages (smart suggestions) ---------- */
function waterMentorComment(n){
  if(n>=8) return "Goal reached — beautifully hydrated ✨";
  if(n<=4) return `Only ${n}/8 glasses? Where did the other ${8-n} disappear? 😂💧`;
  return `${n}/8 💧 Almost there. ${8-n} more.`;
}
function routineMentorComment(field, done){
  if(!done) return "Noted — you can always catch up later today.";
  if(field.startsWith('skin')) return "Skincare completed ✅ Future glow loading ✨";
  return "Hair-care logged 💇‍♀️✨ Future Rapunzel is loading… 👑";
}
function careerMentorComment(){
  const t = todayISO();
  const jobsToday = state.jobs.filter(j=>j.dateApplied===t).length;
  if(jobsToday===1) return "Application sent ✅ Now don't forget the follow-up.";
  if(jobsToday>=3) return `You applied to ${jobsToday} jobs today. Future employee loading… 💼🔥`;
  return "Application saved.";
}
function skillsMentorComment(hours){
  if(hours<0.5) return `Only ${Math.round(hours*60)} minutes today 👀. Better than zero. Tomorrow we push harder.`;
  return "Another learning session completed. Skill level increased 🔥";
}
function foodMentorComment(entry){
  if(entry.skin>=8 && entry.hair>=8) return "Great choice for both skin and hair — keep this up ✨";
  if(entry.skin>=7 || entry.hair>=7) return "Solid pick — small tweaks could make it even better.";
  return "Logged either way — every meal you track helps you see your patterns.";
}

/* ================================================================
   MENTOR CHAT — Level 1 local engine, Level 2 optional AI backend
================================================================= */
function buildMentorContext(){
  const t = todayISO();
  return {
    date:t,
    score: computeScore(t),
    jobsToday: state.jobs.filter(j=>j.dateApplied===t).length,
    jobsWeek: state.jobs.filter(j=>lastNDates(7).includes(j.dateApplied)).length,
    hoursToday: state.skills.reduce((a,s)=>a+(s.logs||[]).filter(l=>l.date===t).reduce((x,l)=>x+Number(l.hours||0),0),0),
    water: state.food.water[t]||0,
    routineDone: (()=>{ const r=state.food.routine[t]||{}; return [r.hairAM,r.hairPM,r.skinAM,r.skinPM].filter(Boolean).length; })(),
    inactiveDays: daysSinceLastActivity(),
    level: computeXP().level,
  };
}
function localMentorReply(text){
  const q = (text||'').toLowerCase();
  const ctx = buildMentorContext();
  if(/lazy|unmotivated|don.?t feel like/.test(q)) return "Babe, that's allowed sometimes. But let's not make it a habit — pick ONE tiny thing you can finish in the next 10 minutes. That's all I need from you right now.";
  if(/didn.?t study|no study|skip.*study/.test(q)) return ctx.hoursToday>0 ? "Wait — you actually did log some study time today. Don't be so hard on yourself ❤️" : "I saw that 😂 Zero minutes today. Even 20 minutes tonight keeps the streak alive — want to try?";
  if(/tomorrow/.test(q)) return "Here's tomorrow's plan, Pooja:\n💼 Apply to 1–2 jobs\n📚 Study for 30 mins\n💧 Finish your water goal\n🧴 Complete your routine\nOne thing at a time. ❤️";
  if(/today.?s plan|plan for today/.test(q)) return `Today so far: ${ctx.jobsToday} application${ctx.jobsToday===1?'':'s'}, ${Math.round(ctx.hoursToday*10)/10}h studied, ${ctx.water}/8 water, ${ctx.routineDone}/4 routine. Score is at ${ctx.score}/100 — pick the lowest one and fix it first.`;
  if(/completed everything|did everything|finished everything/.test(q)) return "GIRL 😭❤️ You actually did everything today. I'm impressed. Main character behaviour detected 👑";
  if(/should i apply/.test(q)) return "If it's even 60% a fit — apply. Applications are free, overthinking is not. Go for it. 💼";
  if(/what should i learn/.test(q)){
    const next = state.skills.find(s=>(s.completion||0)<100);
    return next ? `Keep pushing on ${next.skill} — you're already building momentum there.` : "Pick one skill that scares you a little. That's usually the right one.";
  }
  if(/feel|sad|stressed|overwhelm/.test(q)) return "Hey babe, not every day has to be perfect. Just don't give up on yourself. I'm right here. ❤️";
  if(ctx.inactiveDays>=3) return "Poju??? 👻 Where have you been? Let's do ONE small thing today to break the streak.";
  const defaults = ["Tell me more, babe — what's going on?", "I'm listening ❤️ What do you want to focus on?", "Okay Poju, what's the one thing on your mind?"];
  return defaults[Math.floor(Math.random()*defaults.length)];
}
function renderChat(){
  const msgs = state.chat.messages;
  const quickChips = ["I didn't study today.","I'm feeling lazy.","What should I do tomorrow?","Give me today's plan.","I completed everything today."];
  document.getElementById('view-chat').innerHTML = `
    <div class="section-title"><span class="dot" style="background:var(--lavender)"></span>💬 Talk to your Mentor</div>
    <div class="chat-wrap card" style="padding:14px;">
      <div class="chat-scroll" id="chatScroll">
        ${msgs.length? msgs.map(m=>`<div class="chat-bubble ${m.role==='user'?'user':'mentor'}">${esc(m.text)}</div>`).join('') : `<div class="chat-bubble mentor">Hey Pooja ❤️ What's on your mind today?</div>`}
      </div>
      <div class="chat-chips">
        ${quickChips.map(c=>`<span class="chat-chip" onclick='sendChatMessage(${JSON.stringify(c)})'>${esc(c)}</span>`).join('')}
      </div>
      <div class="chat-input-row">
        <textarea id="chatInput" placeholder="Type to your mentor…" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); sendChatFromInput();}"></textarea>
        <button class="btn" onclick="sendChatFromInput()">Send</button>
      </div>
      <p class="disclaimer">Your mentor uses your real dashboard data. Without an AI backend configured in Settings, replies come from a built-in local mentor engine — always available, never dependent on a paid API.</p>
    </div>
  `;
  const scroll = document.getElementById('chatScroll');
  if(scroll) scroll.scrollTop = scroll.scrollHeight;
}
function sendChatFromInput(){
  const input = document.getElementById('chatInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  sendChatMessage(text);
}
async function sendChatMessage(text){
  state.chat.messages.push({role:'user', text, ts:Date.now()});
  if(state.chat.messages.length>200) state.chat.messages = state.chat.messages.slice(-200);
  saveState(); renderChat();

  const backendUrl = (state.settings.backendUrl||'').trim();
  let reply = null;
  if(backendUrl){
    try{
      const res = await fetch(backendUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'chat', message:text, context: buildMentorContext(), history: state.chat.messages.slice(-8) })
      });
      if(res.ok){
        const data = await res.json();
        reply = (data.content||[]).map(b=>b.text||'').join('').trim() || data.reply || null;
      }
    }catch(e){ reply = null; }
  }
  if(!reply) reply = localMentorReply(text);
  state.chat.messages.push({role:'mentor', text:reply, ts:Date.now()});
  saveState(); renderChat();
}

/* ================================================================
   NOTIFICATIONS — optional, local, foreground/installed-app only.
   iOS Safari can only deliver true background push through a real
   push server (Web Push + APNs), which is outside a free static
   site. This scheduler fires while the app/tab is open or the
   installed PWA is running, and is fully documented in the README.
================================================================= */
function inQuietHours(hhmm, start, end){
  if(!start || !end) return false;
  if(start < end) return hhmm>=start && hhmm<end;
  return hhmm>=start || hhmm<end; // wraps past midnight
}
function fireNotification(title, body){
  try{
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>{
        if(reg && reg.showNotification) reg.showNotification(title, {body, icon:'icons/icon-192.png', badge:'icons/icon-192.png'});
        else new Notification(title, {body, icon:'icons/icon-192.png'});
      }).catch(()=>{ try{ new Notification(title, {body}); }catch(e){} });
    } else if('Notification' in window) {
      new Notification(title, {body, icon:'icons/icon-192.png'});
    }
  }catch(e){ /* never break the app over a notification */ }
}
function checkNotifications(){
  try{
    const settings = state.settings.notifications;
    if(!settings || !settings.enabled) return;
    if(typeof window.Notification === 'undefined' || window.Notification.permission!=='granted') return;
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    if(inQuietHours(hhmm, settings.quietStart, settings.quietEnd)) return;
    const t = todayISO();
    if(!settings.sentLog[t]) settings.sentLog[t] = [];
    const sentToday = settings.sentLog[t];
    const windows = [
      {cat:'morning', from:'08:30', to:'09:30', title:'Good morning babe ❤️', body:"What are your top 3 today?"},
      {cat:'water', from:'14:00', to:'15:00', title:'Hydration check 💧', body:'Babe, how many glasses so far?'},
      {cat:'career', from:'17:00', to:'18:00', title:'Career check 💼', body:'Have we applied to any jobs today?'},
      {cat:'learning', from:'19:00', to:'20:00', title:'Learning time 📚', body:'30 minutes today can move your future forward.'},
      {cat:'night', from:'21:00', to:'22:00', title:'Daily check-in ❤️', body:"Let's see what you accomplished today."},
    ];
    windows.forEach(w=>{
      if(!settings.categories[w.cat] || sentToday.includes(w.cat)) return;
      if(hhmm>=w.from && hhmm<=w.to){
        fireNotification(w.title, w.body);
        sentToday.push(w.cat);
        saveState();
      }
    });
  }catch(e){ /* defensive: notifications must never crash the app */ }
}
function startNotificationScheduler(){
  checkNotifications();
  setInterval(checkNotifications, 60*1000);
}
async function enableNotifications(){
  if(typeof window.Notification === 'undefined'){ showToast('Notifications are not supported in this browser'); return; }
  try{
    const perm = await window.Notification.requestPermission();
    state.settings.notifications.enabled = (perm === 'granted');
    saveState();
    showToast(perm==='granted' ? 'Reminders enabled ❤️' : 'Permission was not granted');
  }catch(e){ showToast('Could not request notification permission'); }
  closeModal(); openSettings();
}
function disableNotifications(){
  state.settings.notifications.enabled = false;
  saveState(); closeModal(); openSettings();
  showToast('Reminders turned off');
}
function toggleNotifCategory(cat){
  state.settings.notifications.categories[cat] = !state.settings.notifications.categories[cat];
  saveState();
}
function setQuietHours(start, end){
  state.settings.notifications.quietStart = start;
  state.settings.notifications.quietEnd = end;
  saveState();
}

/* ================================================================
   INIT + PWA
================================================================= */
function init(){
  loadState();
  setGreeting();
  setView('home');
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
  try{ startNotificationScheduler(); }catch(e){}
}
init();

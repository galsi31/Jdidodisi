(() => {
  "use strict";

  const STORAGE_KEY = "maxim-100k-rpg-v1";
  const VERSION = 1;
  const COLORS = ["#3de8ff","#b9ff3b","#b66eff","#ffd34e","#ff4f70","#ff9d3f","#39e6a5","#4c8dff"];
  const CATEGORY_ICONS = {finance:"💰",appearance:"✨",health:"🔥",productivity:"⚡",custom:"◈"};
  const CATEGORY_NAMES = {all:"Все",finance:"Финансы",appearance:"Внешность",health:"Тело",productivity:"Продуктивность",custom:"Другое",paused:"На паузе"};
  const DIFFICULTY = {
    easy:{label:"Лёгкий",xp:25,icon:"🟢"},
    normal:{label:"Обычный",xp:60,icon:"🔵"},
    hard:{label:"Сложный",xp:130,icon:"🟣"},
    boss:{label:"БОСС",xp:300,icon:"💀"}
  };

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
  const todayISO = () => {
    const d = new Date();
    return localISO(d);
  };
  const localISO = d => {
    const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const parseDate = s => new Date(`${s}T12:00:00`);
  const addDays = (s,n) => { const d=parseDate(s); d.setDate(d.getDate()+n); return localISO(d); };
  const startOfToday = () => parseDate(todayISO());
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const fmtMoney = n => `${Math.round(Number(n)||0).toLocaleString("ru-RU")} ₽`;
  const fmtNum = n => Math.round(Number(n)||0).toLocaleString("ru-RU");
  const fmtDate = s => s ? parseDate(s).toLocaleDateString("ru-RU",{day:"numeric",month:"short"}) : "—";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  const defaultState = () => {
    const start = todayISO();
    return {
      version: VERSION,
      initialized: false,
      profile: {
        name:"Максим",
        cycleStart:start,
        sounds:true,
        haptics:true,
        pinEnabled:false,
        pinHash:""
      },
      goals: [
        {id:uid(),title:"100К за 7 дней",category:"finance",icon:"⚔",color:"#ff4f70",mode:"money_cycle",target:100000,unit:"₽",increment:5000,featured:true,role:"weekly_income",active:true,createdAt:start},
        {id:uid(),title:"Фонд на отъезд",category:"finance",icon:"🚀",color:"#ffd34e",mode:"money_savings",target:300000,unit:"₽",increment:10000,featured:true,role:"relocation",active:true,createdAt:start},
        {id:uid(),title:"Сжечь 50 000 ккал",category:"health",icon:"🔥",color:"#ff9d3f",mode:"sum_all",target:50000,unit:"ккал",increment:300,featured:true,role:"burn_calories",active:true,createdAt:start},
        {id:uid(),title:"Силовые тренировки",category:"health",icon:"🏋",color:"#39e6a5",mode:"count_cycle",target:3,unit:"трен.",increment:1,featured:true,role:"workout",active:true,createdAt:start},
        {id:uid(),title:"Миноксидил",category:"appearance",icon:"🧴",color:"#3de8ff",mode:"count_daily",target:2,unit:"раза",increment:1,featured:true,role:"minoxidil",active:true,createdAt:start}
      ],
      quests: [
        {id:uid(),title:"Разобрать amoCRM",category:"productivity",difficulty:"hard",status:"active",deadline:addDays(start,1),createdAt:start,completedAt:null,notes:"Пройти интерфейс и понять основные воронки."},
        {id:uid(),title:"Запустить рекламу на себя",category:"finance",difficulty:"boss",status:"active",deadline:addDays(start,1),createdAt:start,completedAt:null,notes:"Оффер → креатив → аудитория → запуск."}
      ],
      transactions: [],
      goalLogs: [],
      dayLogs: {},
      rewards: [
        {id:uid(),title:"Свободный вечер без чувства вины",icon:"🌙",cost:20,active:true},
        {id:uid(),title:"Покупка для внешности или стиля",icon:"✨",cost:60,active:true},
        {id:uid(),title:"Полностью свободный день",icon:"🛌",cost:100,active:true},
        {id:uid(),title:"Большая награда после сильного месяца",icon:"👑",cost:200,active:true}
      ],
      purchases: [],
      ui:{goalFilter:"all",questFilter:"active"}
    };
  };

  let state = loadState();
  let currentPage = "dashboard";
  let previousLevel = 1;

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrate(JSON.parse(raw)) : defaultState();
    }catch(e){
      console.error(e);
      return defaultState();
    }
  }
  function migrate(s){
    return Object.assign(defaultState(), s, {version:VERSION});
  }
  function saveState({silent=false}={}){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if(!silent) renderAll();
  }

  async function hashText(text){
    if(window.crypto?.subtle){
      const data = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
    }
    return btoa(text);
  }

  function cycleInfo(date=todayISO()){
    const base = parseDate(state.profile.cycleStart);
    const target = parseDate(date);
    const diff = Math.floor((target-base)/86400000);
    const index = Math.max(0,Math.floor(diff/7));
    const start = addDays(state.profile.cycleStart,index*7);
    return {index,start,end:addDays(start,6)};
  }
  function inRange(date,start,end){ return date>=start && date<=end; }
  function transactionsInCycle(cycle=cycleInfo()){
    return state.transactions.filter(t=>inRange(t.date,cycle.start,cycle.end));
  }
  function incomeInCycle(cycle=cycleInfo()){
    return transactionsInCycle(cycle).filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount),0);
  }
  function expenseInCycle(cycle=cycleInfo()){
    return transactionsInCycle(cycle).filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount),0);
  }
  function totalSavings(){
    return state.transactions.filter(t=>t.type==="saving").reduce((a,t)=>a+Number(t.amount),0);
  }
  function goalLogs(id, predicate=()=>true){
    return state.goalLogs.filter(l=>l.goalId===id && predicate(l));
  }
  function goalProgress(goal, date=todayISO()){
    const cycle = cycleInfo(date);
    if(goal.mode==="money_cycle") return incomeInCycle(cycle);
    if(goal.mode==="money_savings") return totalSavings();
    if(goal.mode==="sum_all") return Math.max(0,goalLogs(goal.id).reduce((a,l)=>a+Number(l.value),0));
    if(goal.mode==="sum_cycle") return Math.max(0,goalLogs(goal.id,l=>inRange(l.date,cycle.start,cycle.end)).reduce((a,l)=>a+Number(l.value),0));
    if(goal.mode==="count_cycle") return Math.max(0,goalLogs(goal.id,l=>inRange(l.date,cycle.start,cycle.end)).reduce((a,l)=>a+Number(l.value),0));
    if(goal.mode==="count_daily") return Math.max(0,goalLogs(goal.id,l=>l.date===date).reduce((a,l)=>a+Number(l.value),0));
    return 0;
  }
  function activeGoals(){ return state.goals.filter(g=>g.active); }
  function getGoalByRole(role){ return activeGoals().find(g=>g.role===role); }
  function currentBossGoal(){ return getGoalByRole("weekly_income") || activeGoals().find(g=>g.mode==="money_cycle"); }
  function dayLog(date=todayISO(), create=true){
    if(!state.dayLogs[date] && create){
      state.dayLogs[date]={moneyAction:false,mainTask:false,caloriesIn:0,caloriesOut:0};
    }
    return state.dayLogs[date] || {moneyAction:false,mainTask:false,caloriesIn:0,caloriesOut:0};
  }
  function dailyGoals(){
    return activeGoals().filter(g=>g.mode==="count_daily");
  }
  function perfectDay(date=todayISO()){
    const d = dayLog(date, false);
    const habits = dailyGoals().every(g=>goalProgress(g,date)>=g.target);
    return Boolean(d.moneyAction && d.mainTask && habits);
  }
  function currentCombo(){
    let combo=0;
    for(let i=0;i<365;i++){
      const date=addDays(todayISO(),-i);
      if(perfectDay(date)) combo++;
      else if(i===0) continue;
      else break;
    }
    return combo;
  }
  function questXP(q){
    const base=DIFFICULTY[q.difficulty]?.xp||60;
    if(q.status!=="done") return 0;
    const speed=q.deadline && q.completedAt && q.completedAt<=q.deadline ? Math.round(base*.25):0;
    return base+speed;
  }
  function dayXP(date){
    const d=dayLog(date);
    let xp=0;
    if(d.moneyAction) xp+=40;
    if(d.mainTask) xp+=35;
    if(Number(d.caloriesIn)>0) xp+=10;
    xp+=Math.min(25,Math.round(Number(d.caloriesOut||0)/40));
    dailyGoals().forEach(g=>{
      const p=goalProgress(g,date);
      xp+=Math.min(g.target,p)*12;
    });
    if(perfectDay(date)) xp+=70;
    return xp;
  }
  function allXP(){
    const days=Object.keys(state.dayLogs).reduce((a,d)=>a+dayXP(d),0);
    const quests=state.quests.reduce((a,q)=>a+questXP(q),0);
    const income=state.transactions.filter(t=>t.type==="income").reduce((a,t)=>a+Math.floor(Number(t.amount)/1000)*4,0);
    const savings=state.transactions.filter(t=>t.type==="saving").reduce((a,t)=>a+Math.floor(Number(t.amount)/1000)*6,0);
    const seasonWins=allSeasons().filter(s=>s.income>=s.target).length*500;
    const trophyXP=achievements().filter(a=>a.unlocked).reduce((sum,a)=>sum+a.xp,0);
    return days+quests+income+savings+seasonWins+trophyXP;
  }
  function levelInfo(){
    const xp=allXP(), per=500, level=Math.floor(xp/per)+1, inside=xp%per;
    const rank = level>=50?"АРХИТЕКТОР СВОБОДЫ":level>=30?"ТИТАН":level>=20?"КОМАНДИР":level>=10?"СТРАТЕГ":level>=5?"ОХОТНИК":"НОВИЧОК";
    return {xp,per,level,inside,rank};
  }
  function coins(){
    return Math.max(0,Math.floor(allXP()/100)-state.purchases.reduce((a,p)=>a+Number(p.cost),0));
  }
  function allSeasons(){
    const now=cycleInfo().index;
    const boss=currentBossGoal();
    const target=Number(boss?.target||100000);
    return Array.from({length:now+1},(_,i)=>{
      const start=addDays(state.profile.cycleStart,i*7),end=addDays(start,6);
      const cycle={index:i,start,end};
      const income=incomeInCycle(cycle);
      const expense=expenseInCycle(cycle);
      const quests=state.quests.filter(q=>q.completedAt && inRange(q.completedAt,start,end));
      const perfect=Array.from({length:7},(_,j)=>addDays(start,j)).filter(d=>perfectDay(d)).length;
      const workout=getGoalByRole("workout");
      const workouts=workout?goalProgressForCycle(workout,cycle):0;
      const questScore=Math.min(15,quests.reduce((a,q)=>a+questXP(q),0)/300*15);
      const moneyScore=Math.min(60,income/target*60);
      const workoutScore=workout?Math.min(10,workouts/workout.target*10):10;
      const perfectScore=Math.min(15,perfect/7*15);
      const score=Math.round(moneyScore+questScore+workoutScore+perfectScore);
      const rank=score>=90?"S":score>=80?"A":score>=65?"B":score>=50?"C":"D";
      return {index,start,end,income,expense,net:income-expense,perfect,workouts,score,rank,target};
    }).reverse();
  }
  function goalProgressForCycle(goal,cycle){
    if(goal.mode==="money_cycle") return incomeInCycle(cycle);
    return goalLogs(goal.id,l=>inRange(l.date,cycle.start,cycle.end)).reduce((a,l)=>a+Number(l.value),0);
  }
  function currentSeason(){ return allSeasons()[0]; }

  function achievements(){
    const wins=allSeasons().filter(s=>s.income>=s.target).length;
    const maxStreak=winningStreak();
    const totalIncome=state.transactions.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount),0);
    const burned=getGoalByRole("burn_calories");
    const burnedValue=burned?goalProgress(burned):0;
    const workout=getGoalByRole("workout");
    const workouts=workout?goalLogs(workout.id).reduce((a,l)=>a+Number(l.value),0):0;
    const perfect=Object.keys(state.dayLogs).filter(d=>perfectDay(d)).length;
    const savingTarget=getGoalByRole("relocation")?.target||300000;
    return [
      {id:"first-income",icon:"🩸",title:"Первая кровь",desc:"Получить первый доход",progress:Math.min(1,totalIncome/1),xp:50},
      {id:"10k",icon:"⚡",title:"Разгон",desc:"Заработать суммарно 10 000 ₽",progress:Math.min(1,totalIncome/10000),xp:100},
      {id:"boss",icon:"💀",title:"Убийца босса",desc:"Закрыть сезон на 100К",progress:Math.min(1,wins),xp:500},
      {id:"streak3",icon:"🔥",title:"Тройное комбо",desc:"3 победных сезона подряд",progress:Math.min(1,maxStreak/3),xp:750},
      {id:"freedom",icon:"🚀",title:"Билет на свободу",desc:`Накопить ${fmtMoney(savingTarget)}`,progress:Math.min(1,totalSavings()/savingTarget),xp:1000},
      {id:"burn",icon:"☄️",title:"Реактор",desc:"Сжечь 50 000 ккал",progress:Math.min(1,burnedValue/50000),xp:500},
      {id:"iron",icon:"🏋",title:"Железо",desc:"Провести 10 силовых",progress:Math.min(1,workouts/10),xp:200},
      {id:"perfect7",icon:"⭐",title:"Машина",desc:"Закрыть 7 идеальных дней",progress:Math.min(1,perfect/7),xp:250},
      {id:"million",icon:"👑",title:"Миллионерский режим",desc:"Заработать суммарно 1 000 000 ₽",progress:Math.min(1,totalIncome/1000000),xp:2000}
    ].map(a=>({...a,unlocked:a.progress>=1}));
  }
  function winningStreak(){
    const seasons=allSeasons().slice().reverse();
    let streak=0,max=0;
    seasons.forEach(s=>{ if(s.income>=s.target){streak++;max=Math.max(max,streak)}else streak=0; });
    return max;
  }

  function init(){
    const dateInput=$("#onboarding-cycle");
    dateInput.value=todayISO();

    if(!state.initialized){
      $("#onboarding").classList.remove("hidden");
    }else if(state.profile.pinEnabled && state.profile.pinHash){
      $("#lock-screen").classList.remove("hidden");
    }else{
      openApp();
    }

    bindEvents();
    if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  }
  function openApp(){
    $("#app").classList.remove("hidden");
    $("#onboarding").classList.add("hidden");
    $("#lock-screen").classList.add("hidden");
    previousLevel=levelInfo().level;
    renderAll();
  }

  function bindEvents(){
    document.addEventListener("click",e=>{
      const nav=e.target.closest("[data-nav]");
      if(nav){ navigate(nav.dataset.nav); closeSheets(); }
      const action=e.target.closest("[data-action]");
      if(action){ handleAction(action.dataset.action,action); closeSheets(); }
      if(e.target.closest("[data-close-sheet]")) closeSheets();
      if(e.target.closest("[data-close-modal]")) closeModal();
    });

    $("#quick-add-btn").addEventListener("click",()=>$("#quick-menu").classList.remove("hidden"));
    $("#start-game-btn").addEventListener("click",()=>{
      state.profile.name=$("#onboarding-name").value.trim()||"Игрок";
      state.profile.cycleStart=$("#onboarding-cycle").value||todayISO();
      state.initialized=true;
      saveState({silent:true});
      openApp();
      toast("🎮 Новая игра началась");
    });
    $("#unlock-btn").addEventListener("click",unlock);
    $("#pin-input").addEventListener("keydown",e=>{if(e.key==="Enter")unlock()});

    $("#save-calories-btn").addEventListener("click",()=>{
      const d=dayLog();
      d.caloriesIn=Number($("#calories-in").value)||0;
      d.caloriesOut=Number($("#calories-out").value)||0;
      const burn=getGoalByRole("burn_calories");
      if(burn){
        state.goalLogs=state.goalLogs.filter(l=>!(l.goalId===burn.id && l.date===todayISO() && l.source==="calories"));
        if(d.caloriesOut>0) state.goalLogs.push({id:uid(),goalId:burn.id,date:todayISO(),value:d.caloriesOut,source:"calories"});
      }
      saveState();
      toast("🔥 Калории сохранены");
    });
    $("#quick-workout-btn").addEventListener("click",()=>{
      const goal=getGoalByRole("workout")||activeGoals().find(g=>g.mode==="count_cycle");
      if(goal) addGoalProgress(goal,1);
      else toast("Сначала добавьте цель силовых тренировок");
    });

    $("#save-profile-btn").addEventListener("click",()=>{
      state.profile.name=$("#settings-name").value.trim()||"Игрок";
      state.profile.cycleStart=$("#settings-cycle-start").value||state.profile.cycleStart;
      saveState();
      toast("Профиль сохранён");
    });
    $("#pin-toggle").addEventListener("change",e=>$("#pin-settings").classList.toggle("hidden",!e.target.checked));
    $("#save-security-btn").addEventListener("click",saveSecurity);
    $("#export-btn").addEventListener("click",exportData);
    $("#import-input").addEventListener("change",importData);
    $("#reset-btn").addEventListener("click",resetData);

    $("#goal-filters").addEventListener("click",e=>{
      const b=e.target.closest("[data-goal-filter]"); if(!b)return;
      state.ui.goalFilter=b.dataset.goalFilter; saveState();
    });
    $("#quest-tabs").addEventListener("click",e=>{
      const b=e.target.closest("[data-quest-filter]"); if(!b)return;
      state.ui.questFilter=b.dataset.questFilter; saveState();
    });
  }

  async function unlock(){
    const candidate=await hashText($("#pin-input").value);
    if(candidate===state.profile.pinHash){$("#pin-error").textContent="";openApp()}
    else{$("#pin-error").textContent="Неверный PIN";haptic([30,40,30])}
  }

  function navigate(page){
    currentPage=page;
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
    $$(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));
    const titles={dashboard:"КОМАНДНЫЙ ЦЕНТР",daily:"ТРЕНИРОВОЧНАЯ АРЕНА",goals:"КАРТА ПРОКАЧКИ",money:"ЗОЛОТОЕ ХРАНИЛИЩЕ",quests:"ЖУРНАЛ КВЕСТОВ",seasons:"АРЕНА СЕЗОНОВ",rewards:"МАГАЗИН НАГРАД",profile:"ПРОФИЛЬ"};
    $("#top-title").textContent=titles[page]||"100K RPG";
    window.scrollTo({top:0,behavior:"smooth"});
    renderAll();
  }
  function closeSheets(){$("#quick-menu").classList.add("hidden")}
  function openModal(html){$("#modal-content").innerHTML=html;$("#modal").classList.remove("hidden")}
  function closeModal(){$("#modal").classList.add("hidden");$("#modal-content").innerHTML=""}

  function handleAction(action,el){
    if(action==="income") openTransactionModal("income");
    if(action==="expense") openTransactionModal("expense");
    if(action==="saving") openTransactionModal("saving");
    if(action==="new-goal") openGoalModal();
    if(action==="new-quest") openQuestModal();
    if(action==="new-reward") openRewardModal();
    if(action==="toggle-day"){
      const key=el.dataset.key; dayLog()[key]=!dayLog()[key]; saveState(); haptic(15);
    }
    if(action==="habit-plus"){
      const goal=state.goals.find(g=>g.id===el.dataset.id); if(goal)addGoalProgress(goal,Number(goal.increment)||1);
    }
    if(action==="habit-cycle"){
      const goal=state.goals.find(g=>g.id===el.dataset.id);
      if(goal){
        const current=goalProgress(goal);
        if(current>=goal.target){
          state.goalLogs=state.goalLogs.filter(l=>!(l.goalId===goal.id && l.date===todayISO()));
          saveState(); toast(`${goal.icon} Сегодняшний прогресс сброшен`);
        }else addGoalProgress(goal,Math.min(Number(goal.increment)||1,goal.target-current));
      }
    }
    if(action==="delete-transaction"){
      deleteTransaction(el.dataset.id);
    }
    if(action==="reopen-quest"){
      const q=state.quests.find(q=>q.id===el.dataset.id);
      if(q){q.status="active";q.completedAt=null;saveState();toast("Квест снова активен")}
    }
    if(action==="goal-log"){
      const goal=state.goals.find(g=>g.id===el.dataset.id); if(goal)openGoalLogModal(goal);
    }
    if(action==="edit-goal"){
      const goal=state.goals.find(g=>g.id===el.dataset.id); if(goal)openGoalModal(goal);
    }
    if(action==="edit-quest"){
      const q=state.quests.find(q=>q.id===el.dataset.id); if(q)openQuestModal(q);
    }
    if(action==="complete-quest") completeQuest(el.dataset.id);
    if(action==="delete-quest") deleteQuest(el.dataset.id);
    if(action==="buy-reward") buyReward(el.dataset.id);
  }

  function addGoalProgress(goal,value,date=todayISO()){
    state.goalLogs.push({id:uid(),goalId:goal.id,date,value:Number(value)||0,source:"manual"});
    saveState();
    haptic(20);
    toast(`${goal.icon} +${fmtNum(value)} ${goal.unit}`);
  }

  function renderAll(){
    if(!state.initialized)return;
    renderHeader();
    renderDashboard();
    renderDaily();
    renderGoals();
    renderMoney();
    renderQuests();
    renderSeasons();
    renderRewards();
    renderProfile();
    const nowLevel=levelInfo().level;
    if(nowLevel>previousLevel){levelFX();previousLevel=nowLevel}
  }
  function renderHeader(){
    const info=cycleInfo();
    $("#avatar-letter").textContent=(state.profile.name||"M")[0].toUpperCase();
    $("#top-subtitle").textContent=`Сезон ${info.index+1}`;
  }

  function renderDashboard(){
    const cycle=cycleInfo(), boss=currentBossGoal(), target=Number(boss?.target||100000);
    const income=incomeInCycle(cycle), left=Math.max(0,target-income);
    const today=parseDate(todayISO()), end=parseDate(cycle.end);
    const days=Math.max(1,Math.floor((end-today)/86400000)+1);
    const li=levelInfo(), season=currentSeason();

    $("#boss-title").textContent=fmtMoney(target);
    $("#cycle-range").textContent=`${fmtDate(cycle.start)} — ${fmtDate(cycle.end)} · сезон ${cycle.index+1}`;
    $("#boss-damage").textContent=fmtMoney(income);
    $("#boss-left").textContent=fmtMoney(left);
    $("#boss-daily").textContent=fmtMoney(left/days);
    $("#days-left").textContent=days;
    $("#boss-hp-bar").style.width=`${clamp(income/target*100,0,100)}%`;
    $("#boss-face").textContent=income>=target?"💀":income>=target*.75?"👹":income>=target*.5?"👺":income>0?"🐲":"🐉";

    $("#player-name").textContent=state.profile.name;
    $("#player-level").textContent=li.level;
    $("#rank-badge").textContent=li.rank;
    $(".character-core").textContent=(state.profile.name||"M")[0].toUpperCase();
    $("#xp-bar").style.width=`${li.inside/li.per*100}%`;
    $("#xp-current").textContent=`${fmtNum(li.xp)} XP`;
    $("#xp-next").textContent=`${fmtNum(li.per-li.inside)} до уровня`;
    $("#combo-value").textContent=currentCombo();
    $("#coin-value").textContent=coins();
    $("#trophy-value").textContent=achievements().filter(a=>a.unlocked).length;

    const d=dayLog();
    const missions=[
      {icon:"💰",title:"Денежное действие",desc:"Сделать действие, которое может принести деньги",done:d.moneyAction,key:"moneyAction"},
      {icon:"🎯",title:"Главная задача",desc:"Закрыть самое важное действие дня",done:d.mainTask,key:"mainTask"},
      ...dailyGoals().map(g=>({icon:g.icon,title:g.title,desc:`${fmtNum(goalProgress(g))}/${fmtNum(g.target)} ${g.unit}`,progress:goalProgress(g),done:goalProgress(g)>=g.target,goal:g}))
    ];
    $("#today-missions").innerHTML=missions.map(m=>`
      <div class="mission-card">
        <div class="mission-icon">${m.icon}</div>
        <div><h4>${escapeHtml(m.title)}</h4><p>${escapeHtml(m.desc)}</p></div>
        ${m.goal?`<button class="check-btn ${m.done?"done":""}" data-action="habit-cycle" data-id="${m.goal.id}">${m.done?"✓":`${fmtNum(m.progress)}/${fmtNum(m.goal.target)}`}</button>`:
        `<button class="check-btn ${m.done?"done":""}" data-action="toggle-day" data-key="${m.key}">${m.done?"✓":""}</button>`}
      </div>`).join("");

    const featured=activeGoals().filter(g=>g.featured).slice(0,4);
    $("#featured-goals").innerHTML=featured.map(g=>goalCard(g,true)).join("");

    $("#season-rank").textContent=`Ранг ${season.rank}`;
    $("#season-score").textContent=season.score;
    $("#season-bar").style.width=`${season.score}%`;
    const cycleQuests=state.quests.filter(q=>q.completedAt&&inRange(q.completedAt,cycle.start,cycle.end)).reduce((a,q)=>a+questXP(q),0);
    $("#season-quests").textContent=`${fmtNum(cycleQuests)} XP`;
    $("#season-perfect").textContent=`${season.perfect}/7`;
    const wg=getGoalByRole("workout");
    $("#season-workouts").textContent=wg?`${fmtNum(season.workouts)}/${fmtNum(wg.target)}`:"—";
  }

  function renderDaily(){
    const d=dayLog();
    $("#daily-date").textContent=parseDate(todayISO()).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
    $("#calories-in").value=d.caloriesIn||"";
    $("#calories-out").value=d.caloriesOut||"";
    const items=[
      {icon:"💰",title:"Денежное действие",desc:"Любое действие, способное приблизить оплату",done:d.moneyAction,key:"moneyAction"},
      {icon:"🎯",title:"Главная задача",desc:"Самое важное дело текущего дня",done:d.mainTask,key:"mainTask"},
      ...dailyGoals().map(g=>({icon:g.icon,title:g.title,desc:`Цель: ${g.target} ${g.unit} в день`,progress:goalProgress(g),done:goalProgress(g)>=g.target,goal:g}))
    ];
    $("#daily-habits").innerHTML=items.map(m=>`
      <div class="daily-item">
        <div class="mission-icon">${m.icon}</div>
        <div><h4>${escapeHtml(m.title)}</h4><p>${escapeHtml(m.desc)}${m.goal?` · ${fmtNum(goalProgress(m.goal))}/${fmtNum(m.goal.target)}`:""}</p></div>
        ${m.goal?`<button class="check-btn ${m.done?"done":""}" data-action="habit-cycle" data-id="${m.goal.id}">${m.done?"✓":`${fmtNum(m.progress)}/${fmtNum(m.goal.target)}`}</button>`:
        `<button class="check-btn ${m.done?"done":""}" data-action="toggle-day" data-key="${m.key}">${m.done?"✓":""}</button>`}
      </div>`).join("");
    const xp=dayXP(todayISO());
    $("#daily-xp-ring span").textContent=xp;
    $("#daily-xp-ring").style.background=`conic-gradient(var(--cyan) ${Math.min(360,xp/250*360)}deg,#111b2d 0deg)`;
    const perfect=perfectDay();
    $("#perfect-status").textContent=perfect?`Закрыт · комбо ${currentCombo()}`:"Пока не закрыт";
    $(".perfect-card").style.borderColor=perfect?"rgba(255,211,78,.55)":"rgba(105,139,190,.2)";
  }

  function goalCard(g,featured=false){
    const progress=goalProgress(g), pct=clamp(progress/g.target*100,0,100);
    return `<div class="goal-card ${featured?"featured":""} ${g.active?"":"paused"}" style="--goal-color:${g.color}">
      <button class="goal-edit" data-action="edit-goal" data-id="${g.id}">•••</button>
      <div class="goal-icon" style="color:${g.color};border-color:${g.color}44;background:${g.color}12">${g.icon}</div>
      <h4>${escapeHtml(g.title)}</h4>
      <p>${escapeHtml(modeLabel(g.mode))}</p>
      <div class="goal-progress">
        <div class="meter"><span style="width:${pct}%"></span></div>
        <div class="goal-values"><strong>${formatGoalValue(g,progress)}</strong><span>${formatGoalValue(g,g.target)}</span></div>
      </div>
      ${featured?"":`<div class="goal-actions">
        <button class="accent" data-action="${g.mode==="count_daily"?"habit-cycle":"goal-log"}" data-id="${g.id}">＋ Прогресс</button>
        <button data-action="edit-goal" data-id="${g.id}">Изменить</button>
      </div>`}
    </div>`;
  }
  function modeLabel(mode){
    return {money_cycle:"Повторяется каждые 7 дней",money_savings:"Накопительная финансовая цель",sum_all:"Накопительный прогресс",sum_cycle:"Сумма за 7 дней",count_cycle:"Количество за 7 дней",count_daily:"Ежедневная привычка"}[mode]||"Гибкая цель";
  }
  function formatGoalValue(g,v){return g.unit==="₽"?fmtMoney(v):`${fmtNum(v)} ${g.unit}`}

  function renderGoals(){
    const cats=["all","finance","appearance","health","productivity","custom","paused"];
    $("#goal-filters").innerHTML=cats.map(c=>`<button class="chip ${state.ui.goalFilter===c?"active":""}" data-goal-filter="${c}">${CATEGORY_NAMES[c]}</button>`).join("");
    let list;
    if(state.ui.goalFilter==="paused") list=state.goals.filter(g=>!g.active);
    else list=state.goals.filter(g=>g.active && (state.ui.goalFilter==="all"||g.category===state.ui.goalFilter));
    $("#goals-list").innerHTML=list.length?list.map(g=>goalCard(g,false)).join(""):`<div class="mission-card"><div class="mission-icon">◈</div><div><h4>Здесь пока пусто</h4><p>Добавь новую цель и настрой её под текущий план.</p></div></div>`;
  }

  function renderMoney(){
    const cycle=cycleInfo();
    $("#money-cycle-income").textContent=fmtMoney(incomeInCycle(cycle));
    $("#money-cycle-expense").textContent=fmtMoney(expenseInCycle(cycle));
    $("#money-savings").textContent=fmtMoney(totalSavings());
    const items=[...state.transactions].sort((a,b)=>(b.date+b.createdAt).localeCompare(a.date+a.createdAt)).slice(0,30);
    $("#transactions-list").innerHTML=items.length?items.map(t=>`
      <div class="transaction-card">
        <div class="transaction-icon">${t.type==="income"?"⚔":t.type==="expense"?"💸":"🚀"}</div>
        <div><h4>${escapeHtml(t.note||transactionTypeName(t.type))}</h4><p>${fmtDate(t.date)} · ${escapeHtml(t.category||"Без категории")}</p></div>
        <div class="transaction-amount"><strong class="${t.type==="income"?"positive":t.type==="expense"?"negative":"saving"}">${t.type==="expense"?"−":"＋"}${fmtMoney(t.amount)}</strong><button data-action="delete-transaction" data-id="${t.id}" aria-label="Удалить">×</button></div>
      </div>`).join(""):`<div class="mission-card"><div class="mission-icon">💰</div><div><h4>Операций ещё нет</h4><p>Первый доход нанесёт боссу первый урон.</p></div></div>`;
  }
  function transactionTypeName(type){return {income:"Доход",expense:"Расход",saving:"В фонд"}[type]}
  function deleteTransaction(id){
    if(confirm("Удалить эту финансовую операцию?")){
      state.transactions=state.transactions.filter(t=>t.id!==id);
      saveState();toast("Операция удалена");
    }
  }

  function renderQuests(){
    const filter=state.ui.questFilter;
    $$("#quest-tabs .chip").forEach(b=>b.classList.toggle("active",b.dataset.questFilter===filter));
    let list=[...state.quests];
    if(filter==="active")list=list.filter(q=>q.status!=="done");
    if(filter==="done")list=list.filter(q=>q.status==="done");
    list.sort((a,b)=>(a.status==="done")-(b.status==="done") || (a.deadline||"9999").localeCompare(b.deadline||"9999"));
    $("#quests-list").innerHTML=list.length?list.map(q=>{
      const diff=DIFFICULTY[q.difficulty]||DIFFICULTY.normal;
      return `<div class="quest-card ${q.difficulty==="boss"?"boss":""}">
        <div class="quest-icon">${diff.icon}</div>
        <div>
          <h4>${escapeHtml(q.title)}</h4>
          <p>${escapeHtml(q.notes||"Без описания")}</p>
          <div class="quest-meta">
            <span class="tag ${q.difficulty==="boss"?"boss":""}">${diff.label}</span>
            <span class="tag">＋${questXP({...q,status:"done"})} XP</span>
            ${q.deadline?`<span class="tag">⏳ ${fmtDate(q.deadline)}</span>`:""}
            ${q.status==="done"?`<span class="tag">✅ Готово</span>`:""}
          </div>
          <div class="quest-buttons">
            ${q.status!=="done"?`<button class="complete" data-action="complete-quest" data-id="${q.id}">Завершить</button>`:`<button class="complete" data-action="reopen-quest" data-id="${q.id}">Вернуть</button>`}
            <button data-action="edit-quest" data-id="${q.id}">Изменить</button>
            <button class="delete" data-action="delete-quest" data-id="${q.id}">Удалить</button>
          </div>
        </div>
      </div>`}).join(""):`<div class="mission-card"><div class="mission-icon">⚔</div><div><h4>Нет квестов</h4><p>Создай миссию и назначь ей сложность.</p></div></div>`;
  }

  function renderSeasons(){
    $("#seasons-list").innerHTML=allSeasons().map(s=>`
      <div class="season-card">
        <div class="season-rank-badge ${s.rank}">${s.rank}</div>
        <div><h4>Сезон ${s.index+1} · ${fmtDate(s.start)} — ${fmtDate(s.end)}</h4>
          <p>${s.income>=s.target?"💀 Босс уничтожен":"🐉 Босс выжил"} · ${s.perfect} идеальных дней · ${fmtNum(s.workouts)} силовых</p></div>
        <strong>${fmtMoney(s.income)}</strong>
      </div>`).join("");
  }

  function renderRewards(){
    $("#reward-coins").textContent=coins();
    $("#rewards-list").innerHTML=state.rewards.filter(r=>r.active).map(r=>`
      <div class="reward-card">
        <div class="reward-icon">${r.icon}</div>
        <h4>${escapeHtml(r.title)}</h4>
        <p>Цена: ${r.cost} монет</p>
        <button class="reward-buy" data-action="buy-reward" data-id="${r.id}" ${coins()<r.cost?"disabled":""}>Купить за ${r.cost} 🪙</button>
      </div>`).join("");
    $("#achievements-list").innerHTML=achievements().map(a=>`
      <div class="achievement-card ${a.unlocked?"":"locked"}">
        <div class="achievement-icon">${a.icon}</div>
        <h4>${escapeHtml(a.title)}</h4>
        <p>${escapeHtml(a.desc)} · ${a.xp} XP</p>
        <div class="achievement-progress"><div class="meter"><span style="width:${a.progress*100}%"></span></div></div>
      </div>`).join("");
  }

  function renderProfile(){
    const li=levelInfo(), letter=(state.profile.name||"M")[0].toUpperCase();
    $("#profile-letter").textContent=letter;
    $("#profile-name").textContent=state.profile.name;
    $("#profile-rank").textContent=`${li.rank} · уровень ${li.level}`;
    $("#settings-name").value=state.profile.name;
    $("#settings-cycle-start").value=state.profile.cycleStart;
    $("#sounds-toggle").checked=state.profile.sounds;
    $("#haptics-toggle").checked=state.profile.haptics;
    $("#pin-toggle").checked=state.profile.pinEnabled;
    $("#pin-settings").classList.toggle("hidden",!state.profile.pinEnabled);
  }

  function openTransactionModal(type){
    const labels={income:["Нанести денежный урон","⚔"],expense:["Записать расход","💸"],saving:["Пополнить фонд свободы","🚀"]};
    openModal(`<h2>${labels[type][1]} ${labels[type][0]}</h2>
      <form id="transaction-form">
        <div class="form-grid">
          <label>Сумма<input name="amount" type="number" min="1" inputmode="decimal" required autofocus /></label>
          <label>Дата<input name="date" type="date" value="${todayISO()}" required /></label>
          <label class="full">Категория<select name="category">
            <option>Клиенты</option><option>Реклама</option><option>Работа</option><option>Сервисы</option><option>Еда</option><option>Транспорт</option><option>Внешность</option><option>Обучение</option><option>Другое</option>
          </select></label>
          <label class="full">Комментарий<input name="note" placeholder="Например: новый клиент" /></label>
        </div>
        <button class="primary-btn wide">${labels[type][0]}</button>
      </form>`);
    $("#transaction-form").addEventListener("submit",e=>{
      e.preventDefault();
      const f=new FormData(e.target), amount=Number(f.get("amount"));
      state.transactions.push({id:uid(),type,amount,date:f.get("date"),category:f.get("category"),note:f.get("note"),createdAt:new Date().toISOString()});
      saveState(); closeModal();
      if(type==="income"){damageFX(amount);dayLog().moneyAction=true;saveState()}
      else if(type==="saving")confettiFX();
      toast(type==="income"?`💥 ${fmtMoney(amount)} урона`:"Операция сохранена");
    });
  }

  function openGoalModal(goal=null){
    const g=goal||{id:"",title:"",category:"appearance",icon:"✨",color:COLORS[0],mode:"sum_all",target:1,unit:"раз",increment:1,featured:true,active:true,role:""};
    openModal(`<h2>${goal?"Изменить цель":"Новая цель"}</h2>
      <form id="goal-form">
        <div class="form-grid">
          <label class="full">Название<input name="title" value="${escapeHtml(g.title)}" required /></label>
          <label>Категория<select name="category">${Object.entries(CATEGORY_NAMES).filter(([k])=>!["all","paused"].includes(k)).map(([k,v])=>`<option value="${k}" ${g.category===k?"selected":""}>${v}</option>`).join("")}</select></label>
          <label>Иконка<input name="icon" value="${escapeHtml(g.icon)}" maxlength="4" /></label>
          <label class="full">Тип цели<select name="mode">
            ${[
              ["money_cycle","Доход за каждые 7 дней"],
              ["money_savings","Накопление денег"],
              ["sum_all","Накопительная числовая цель"],
              ["sum_cycle","Сумма за каждые 7 дней"],
              ["count_cycle","Количество раз за 7 дней"],
              ["count_daily","Количество раз каждый день"]
            ].map(([k,v])=>`<option value="${k}" ${g.mode===k?"selected":""}>${v}</option>`).join("")}
          </select></label>
          <label>Цель<input name="target" type="number" min="0.01" step="any" value="${g.target}" required /></label>
          <label>Единица<input name="unit" value="${escapeHtml(g.unit)}" placeholder="₽, ккал, раза..." /></label>
          <label>Шаг кнопки ＋<input name="increment" type="number" min="0.01" step="any" value="${g.increment||1}" /></label>
          <label>Роль системы<select name="role">
            <option value="">Обычная цель</option>
            <option value="weekly_income" ${g.role==="weekly_income"?"selected":""}>Главный денежный босс</option>
            <option value="relocation" ${g.role==="relocation"?"selected":""}>Фонд переезда</option>
            <option value="burn_calories" ${g.role==="burn_calories"?"selected":""}>Сожжённые калории</option>
            <option value="workout" ${g.role==="workout"?"selected":""}>Силовые тренировки</option>
            <option value="minoxidil" ${g.role==="minoxidil"?"selected":""}>Миноксидил</option>
          </select></label>
          <label class="full">Цвет<div class="color-grid">${COLORS.map(c=>`<button type="button" class="color-dot ${g.color===c?"selected":""}" data-color="${c}" style="background:${c};color:${c}"></button>`).join("")}</div><input type="hidden" name="color" value="${g.color}" /></label>
          <label class="switch-row full"><span>Показывать на главном экране</span><input name="featured" type="checkbox" ${g.featured?"checked":""}></label>
          ${goal?`<label class="switch-row full"><span>Цель активна</span><input name="active" type="checkbox" ${g.active?"checked":""}></label>`:""}
        </div>
        <button class="primary-btn wide">${goal?"Сохранить":"Создать цель"}</button>
        ${goal?`<button type="button" id="delete-goal-btn" class="danger-btn wide">Удалить цель и её историю</button>`:""}
      </form>`);
    $$(".color-dot").forEach(b=>b.addEventListener("click",()=>{
      $$(".color-dot").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");$('[name="color"]').value=b.dataset.color;
    }));
    if(goal){
      $("#delete-goal-btn").addEventListener("click",()=>{
        if(confirm("Удалить цель и весь записанный по ней прогресс?")){
          state.goals=state.goals.filter(x=>x.id!==goal.id);
          state.goalLogs=state.goalLogs.filter(l=>l.goalId!==goal.id);
          saveState();closeModal();toast("Цель удалена");
        }
      });
    }
    $("#goal-form").addEventListener("submit",e=>{
      e.preventDefault();const f=new FormData(e.target);
      const data={
        id:goal?.id||uid(),title:f.get("title"),category:f.get("category"),icon:f.get("icon")||CATEGORY_ICONS[f.get("category")],
        color:f.get("color"),mode:f.get("mode"),target:Number(f.get("target")),unit:f.get("unit")||"ед.",increment:Number(f.get("increment"))||1,
        featured:f.get("featured")==="on",active:goal?f.get("active")==="on":true,role:f.get("role"),createdAt:goal?.createdAt||todayISO()
      };
      if(data.role==="weekly_income"){data.mode="money_cycle";data.unit="₽"}
      if(data.role==="relocation"){data.mode="money_savings";data.unit="₽"}
      if(data.role==="burn_calories"){data.mode="sum_all";data.unit="ккал"}
      if(data.role==="workout"){data.mode="count_cycle"}
      if(data.role==="minoxidil"){data.mode="count_daily"}
      if(data.role)state.goals.forEach(x=>{if(x.id!==data.id&&x.role===data.role)x.role=""});
      if(goal)state.goals=state.goals.map(x=>x.id===goal.id?data:x);else state.goals.push(data);
      saveState();closeModal();toast("◈ Цель сохранена");
    });
  }

  function openGoalLogModal(goal){
    openModal(`<h2>${goal.icon} Добавить прогресс</h2>
      <form id="goal-log-form">
        <label>Значение<input name="value" type="number" step="any" value="${goal.increment||1}" required /><small style="display:block;margin-top:6px;color:var(--muted)">Для исправления ошибки можно ввести отрицательное значение, например −1.</small></label>
        <label>Дата<input name="date" type="date" value="${todayISO()}" /></label>
        <button class="primary-btn wide">Добавить к цели</button>
      </form>`);
    $("#goal-log-form").addEventListener("submit",e=>{
      e.preventDefault();const f=new FormData(e.target);addGoalProgress(goal,Number(f.get("value")),f.get("date"));closeModal();
    });
  }

  function openQuestModal(q=null){
    const x=q||{title:"",category:"productivity",difficulty:"normal",deadline:addDays(todayISO(),1),notes:""};
    openModal(`<h2>${q?"Изменить квест":"Новый квест"}</h2>
      <form id="quest-form">
        <div class="form-grid">
          <label class="full">Название<input name="title" value="${escapeHtml(x.title)}" required /></label>
          <label>Категория<select name="category">${Object.entries(CATEGORY_NAMES).filter(([k])=>!["all","paused"].includes(k)).map(([k,v])=>`<option value="${k}" ${x.category===k?"selected":""}>${v}</option>`).join("")}</select></label>
          <label>Сложность<select name="difficulty">${Object.entries(DIFFICULTY).map(([k,v])=>`<option value="${k}" ${x.difficulty===k?"selected":""}>${v.label} · ${v.xp} XP</option>`).join("")}</select></label>
          <label class="full">Дедлайн<input name="deadline" type="date" value="${x.deadline||""}" /></label>
          <label class="full">Описание<textarea name="notes">${escapeHtml(x.notes||"")}</textarea></label>
        </div>
        <button class="primary-btn wide">${q?"Сохранить":"Добавить квест"}</button>
      </form>`);
    $("#quest-form").addEventListener("submit",e=>{
      e.preventDefault();const f=new FormData(e.target);
      const data={...x,id:q?.id||uid(),title:f.get("title"),category:f.get("category"),difficulty:f.get("difficulty"),deadline:f.get("deadline"),notes:f.get("notes"),status:q?.status||"active",createdAt:q?.createdAt||todayISO(),completedAt:q?.completedAt||null};
      if(q)state.quests=state.quests.map(v=>v.id===q.id?data:v);else state.quests.push(data);
      saveState();closeModal();toast("⚔ Квест сохранён");
    });
  }
  function completeQuest(id){
    const q=state.quests.find(q=>q.id===id);if(!q)return;
    q.status="done";q.completedAt=todayISO();saveState();confettiFX();toast(`🏆 Квест завершён · +${questXP(q)} XP`);
  }
  function deleteQuest(id){
    if(confirm("Удалить этот квест?")){state.quests=state.quests.filter(q=>q.id!==id);saveState()}
  }

  function openRewardModal(){
    openModal(`<h2>Новая награда</h2><form id="reward-form">
      <div class="form-grid">
        <label class="full">Название<input name="title" required /></label>
        <label>Иконка<input name="icon" value="🎁" maxlength="4" /></label>
        <label>Цена в монетах<input name="cost" type="number" min="1" value="30" required /></label>
      </div><button class="primary-btn wide">Добавить</button></form>`);
    $("#reward-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target);state.rewards.push({id:uid(),title:f.get("title"),icon:f.get("icon")||"🎁",cost:Number(f.get("cost")),active:true});saveState();closeModal()});
  }
  function buyReward(id){
    const r=state.rewards.find(r=>r.id===id);if(!r||coins()<r.cost)return;
    if(confirm(`Потратить ${r.cost} монет на «${r.title}»?`)){
      state.purchases.push({id:uid(),rewardId:r.id,title:r.title,cost:r.cost,date:todayISO()});saveState();confettiFX();toast("🎁 Награда разблокирована");
    }
  }

  async function saveSecurity(){
    state.profile.sounds=$("#sounds-toggle").checked;
    state.profile.haptics=$("#haptics-toggle").checked;
    const wantsPin=$("#pin-toggle").checked;
    if(wantsPin){
      const pin=$("#new-pin").value.trim();
      if(pin && !/^\d{4,8}$/.test(pin)){toast("PIN должен состоять из 4–8 цифр");return}
      if(pin)state.profile.pinHash=await hashText(pin);
      if(!state.profile.pinHash){toast("Введите новый PIN");return}
      state.profile.pinEnabled=true;
    }else{
      state.profile.pinEnabled=false;state.profile.pinHash="";
    }
    saveState();toast("Безопасность сохранена");
  }
  function exportData(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`100K-RPG-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Резервная копия создана");
  }
  function importData(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{try{state=migrate(JSON.parse(reader.result));saveState();toast("Сохранение восстановлено")}catch{toast("Не удалось прочитать файл")}};
    reader.readAsText(file);
  }
  function resetData(){
    if(confirm("Удалить все данные приложения без возможности восстановления?")){
      localStorage.removeItem(STORAGE_KEY);location.reload();
    }
  }

  function toast(text){
    const el=$("#toast");el.textContent=text;el.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add("hidden"),2600);
    sound("tick");
  }
  function haptic(pattern=20){if(state.profile.haptics&&navigator.vibrate)navigator.vibrate(pattern)}
  function sound(type){
    if(!state.profile.sounds)return;
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)(),o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=type==="hit"?120:type==="level"?620:340;
      o.type=type==="hit"?"sawtooth":"sine";
      g.gain.setValueAtTime(.05,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);
      o.start();o.stop(ctx.currentTime+.17);
    }catch{}
  }
  function damageFX(amount){
    const card=$(".boss-card");card.classList.remove("boss-hit");void card.offsetWidth;card.classList.add("boss-hit");
    const n=document.createElement("div");n.className="damage-number";n.textContent=`−${fmtNum(amount)} HP`;n.style.left=`${25+Math.random()*50}%`;n.style.top="32%";$("#fx-layer").appendChild(n);setTimeout(()=>n.remove(),1300);
    sound("hit");haptic([50,40,80]);
    if(incomeInCycle()>=Number(currentBossGoal()?.target||100000))setTimeout(confettiFX,350);
  }
  function confettiFX(){
    for(let i=0;i<45;i++){const c=document.createElement("i");c.className="confetti";c.style.left=`${Math.random()*100}%`;c.style.top="-30px";c.style.background=COLORS[i%COLORS.length];c.style.setProperty("--x",`${(Math.random()-.5)*240}px`);c.style.animationDelay=`${Math.random()*.35}s`;$("#fx-layer").appendChild(c);setTimeout(()=>c.remove(),2400)}
    sound("level");haptic([30,30,30,30,100]);
  }
  function levelFX(){document.body.classList.add("level-flash");confettiFX();setTimeout(()=>document.body.classList.remove("level-flash"),1350)}

  init();
})();
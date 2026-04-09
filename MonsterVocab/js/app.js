/* ═══════════════════════════════════════════════
   1. PWA 离线应用注册引擎
   ═══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW 注册成功', reg.scope))
      .catch(err => console.log('SW 注册失败', err));
  });
}

/* ═══════════════════════════════════════════════
   2. 全新 Dialog 异步弹窗系统 (美化与防卡死)
   ═══════════════════════════════════════════════ */
const Dialog = {
    show(title, type, defaultVal = '') {
        return new Promise(resolve => {
            const m = document.getElementById('sysModal');
            const c = document.getElementById('sysModalContent');
            const t = document.getElementById('sysModalTitle');
            const i = document.getElementById('sysModalInput');
            const btnCancel = document.getElementById('sysModalCancel');
            const btnConfirm = document.getElementById('sysModalConfirm');

            t.innerText = title; // 支持多行文本
            m.classList.remove('hidden'); m.classList.add('flex');
            setTimeout(() => { c.classList.remove('scale-95'); c.classList.add('scale-100'); }, 10);

            i.classList.add('hidden'); btnCancel.classList.add('hidden');
            i.value = defaultVal;

            if(type === 'prompt') { i.classList.remove('hidden'); btnCancel.classList.remove('hidden'); i.focus(); } 
            else if(type === 'confirm') { btnCancel.classList.remove('hidden'); }

            const cleanup = () => {
                m.classList.remove('flex');  m.classList.add('hidden');
                c.classList.remove('scale-100'); c.classList.add('scale-95');
                btnCancel.onclick = null; btnConfirm.onclick = null;
            };

            btnCancel.onclick = () => { cleanup(); resolve(false); };
            btnConfirm.onclick = () => { cleanup(); resolve(type === 'prompt' ? i.value : true); };
        });
    },
    alert(title)   { return this.show(title, 'alert'); },
    confirm(title) { return this.show(title, 'confirm'); },
    prompt(title, def) { return this.show(title, 'prompt', def); }
};

/* ═══════════════════════════════════════════════
   3. 基础配置与发音、出厂种子字典
   ═══════════════════════════════════════════════ */
let ttsAccent = parseInt(localStorage.getItem('mw_accent') || '2'); 

function toggleAccent() {
  ttsAccent = ttsAccent === 2 ? 1 : 2;
  localStorage.setItem('mw_accent', ttsAccent);
  document.getElementById('accentBtn').textContent = ttsAccent === 2 ? '🇺🇸 美式' : '🇬🇧 英式';
}

const PET_ICO = ['🥚','🐣','🐥','🐓','🐉'];
const PET_NM  = ['小蛋蛋','小雏雏','小黄鸭','大公鸡','小飞龙'];
const PET_SUB = ['刚刚出生～','破壳啦！','软软的毛～','威风凛凛！','龙神降临！'];
const EXP_CAP = 100;
const SEED    = [
  {english:'apple',   chinese:'苹果',  emoji:'🍎'},
  {english:'banana',  chinese:'香蕉',  emoji:'🍌'},
  {english:'cat',     chinese:'猫咪',  emoji:'🐱'},
  {english:'dog',     chinese:'狗狗',  emoji:'🐶'},
  {english:'elephant',chinese:'大象',  emoji:'🐘'},
  {english:'fish',    chinese:'鱼',    emoji:'🐟'},
  {english:'giraffe', chinese:'长颈鹿',emoji:'🦒'},
  {english:'hat',     chinese:'帽子',  emoji:'🎩'},
  {english:'ice cream',chinese:'冰淇淋',emoji:'🍦'},
  {english:'juice',   chinese:'果汁',  emoji:'🧃'}
];

const USERS = [
  { uid:'u1', name:'大宝', ico:'👦' },
  { uid:'u2', name:'二宝', ico:'👧' },
];

let currentUid = localStorage.getItem('mw_cur') || 'u1';
function wKey(uid) { return 'mw_w_'+uid; }
function pKey(uid) { return 'mw_p_'+uid; }

/* ═══════════════════════════════════════════════
   4. 全局核心状态 (新增打卡与连胜字段)
   ═══════════════════════════════════════════════ */
let words         = [];
// player 新增字段：streak(连胜天数), lastCheckIn(上次打卡日期)
let player        = {exp:0, petLevel:0, dailyNew: 10, dailyRev: 30, lastDate: '', todayNew: 0, todayRev: 0, streak: 0, lastCheckIn: ''};
let books         = [];
let currentBookId = 'default';
let queue         = [];
let qi            = 0;
let shown         = false;

/* ═══════════════════════════════════════════════
   5. 数据加载与持久化
   ═══════════════════════════════════════════════ */
const saveW     = () => localStorage.setItem(wKey(currentUid), JSON.stringify(words));
const saveP     = () => localStorage.setItem(pKey(currentUid), JSON.stringify(player));
const saveBooks = () => localStorage.setItem('mw_books', JSON.stringify(books));

function loadBooks() {
  try {
    const bs = localStorage.getItem('mw_books');
    books = bs ? JSON.parse(bs) : [{id:'default', name:'默认词库'}];
    if (!books.find(b => b.id==='default')) books.unshift({id:'default', name:'默认词库'});
  } catch (e) { books = [{id:'default', name:'默认词库'}]; }
}

function loadUser(uid) {
  currentUid = uid; localStorage.setItem('mw_cur', uid);
  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    words = JSON.parse(ws);
    words.forEach(w => { if (!w.bookId) w.bookId='default'; }); saveW();
  } else {
    words = SEED.map((s,i) => ({id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji, level:0, nextReview:Date.now(), bookId:'default'}));
    saveW();
  }

  const ps = localStorage.getItem(pKey(uid));
  player = ps ? JSON.parse(ps) : {exp:0, petLevel:0};
  
  if(player.dailyNew === undefined) player.dailyNew = 10;
  if(player.dailyRev === undefined) player.dailyRev = 30;
  if(player.streak === undefined) player.streak = 0; // 连胜初始化

  currentBookId = localStorage.getItem('mw_cbook_'+uid) || 'default';
}

/* ═══════════════════════════════════════════════
   6. 🎯 核心算法：限量出题构建 (阶段一成果)
   ═══════════════════════════════════════════════ */
function buildQueue(forceRebuild = false) {
  const now = Date.now();
  const today = new Date().toDateString();

  // 跨天或强制重洗，清空今日进度
  if (player.lastDate !== today || forceRebuild) {
    if (player.lastDate !== today) { player.todayNew = 0; player.todayRev = 0; }
    player.lastDate = today; saveP();
  }

  let candNew = []; let candRev = [];
  words.forEach((w, i) => {
    if (w.bookId === currentBookId && (w.nextReview || 0) <= now) {
      if (w.level === 0) candNew.push(i);
      else candRev.push(i);
    }
  });

  candNew.sort(() => Math.random() - 0.5); candRev.sort(() => Math.random() - 0.5);

  const needNew = Math.max(0, (player.dailyNew || 10) - (player.todayNew || 0));
  const needRev = Math.max(0, (player.dailyRev || 30) - (player.todayRev || 0));

  let finalNew = candNew.slice(0, needNew);
  let finalRev = candRev.slice(0, needRev);
  let q = [...finalNew, ...finalRev].sort(() => Math.random() - 0.5);

  return q;
}

function interval(level, action) {
  if (level === 1) return 12 * 3600000; 
  if (level === 2) return 24 * 3600000; 
  if (level === 3) return 2 * 24 * 3600000; 
  if (level === 4) return 4 * 24 * 3600000; 
  return 7 * 24 * 3600000; 
}

/* ═══════════════════════════════════════════════
   7. 🔁 核心行为：错题不死不休 (无限插队)
   ═══════════════════════════════════════════════ */
function act(action) {
  if (qi >= queue.length) return;
  const idx = queue[qi];
  const w = words[idx];
  const isNewWord = (w.level === 0);

  if (action === 'know' || action === 'master') {
    if (isNewWord) player.todayNew = (player.todayNew || 0) + 1;
    else player.todayRev = (player.todayRev || 0) + 1;

    if (action === 'know') {
      w.level = Math.max(1, w.level + 1); 
      w.nextReview = Date.now() + interval(w.level, 'know');
      addExp(20);
    } else {
      w.level = 5; w.nextReview = Date.now() + 7 * 24 * 3600000; addExp(30);
    }
  } else {
    // 答错逻辑：倒退记忆，且强制塞回今日列队尾部！
    if (action === 'fuzzy') { w.level = Math.max(1, w.level); addExp(5); } 
    else { w.level = 0; }
    queue.push(idx); // 永不放过！
  }

  saveW(); qi++; 
  setTimeout(showCard, 150);
}

/* ═══════════════════════════════════════════════
   8. 🔥 【新系统】每日连胜打卡结算引擎
   ═══════════════════════════════════════════════ */
async function processDailyCheckIn() {
    const todayStr = new Date().toDateString();
    
    // 如果今天已经打过卡了，就不再重复增加火苗
    if (player.lastCheckIn === todayStr) return;

    // 检查昨天是否有打卡（用于判断是否断连）
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (player.lastCheckIn === yesterday) {
        player.streak = (player.streak || 0) + 1; // 完美衔接，连胜+1
    } else {
        player.streak = 1; // 断掉了，或者第一次使用，从1开始
    }
    
    player.lastCheckIn = todayStr;
    saveP();
    renderStreakBadge(); // 触发界面火苗刷新

    // 用超强的仪式感弹窗奖励孩子！
    setTimeout(() => {
        Dialog.alert(`🌟 恭喜宝宝！\n\n今日所有的学习任务已全部达成！\n\n🔥 当前达成了【 ${player.streak} 天 】连胜记录！\n小怪兽为你感到骄傲，明天也要继续来哦！`);
    }, 1500);
}

/* ═══════════════════════════════════════════════
   9. 界面动态渲染大全
   ═══════════════════════════════════════════════ */
function renderPet() {
  const lv = Math.min(player.petLevel, PET_ICO.length-1);
  const e  = player.exp % EXP_CAP;
  document.getElementById('petIco').textContent  = PET_ICO[lv];
  document.getElementById('petName').textContent = PET_NM[lv]+' Lv.'+(lv+1);
  document.getElementById('expBar').style.width  = e+'%';
  document.getElementById('expTxt').textContent  = e+' / '+EXP_CAP+' EXP';
  const u = USERS.find(u=>u.uid===currentUid);
  document.getElementById('userBadge').textContent = u.ico+' '+u.name;
  
  // 顺便把连胜徽章渲染出来
  renderStreakBadge();
}

function renderStreakBadge() {
    // 黑魔法：如果 HTML 没有写这个元素，我们就用 JS 动态给它安上一个！
    const actsContainer = document.querySelector('.bar > div:last-child');
    if(!actsContainer) return;
    
    let streakEl = document.getElementById('topStreakBadge');
    if(!streakEl) {
        streakEl = document.createElement('span');
        streakEl.id = 'topStreakBadge';
        // Tailwind 超炫酷动态渐变标签
        streakEl.className = 'text-xs md:text-sm font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-md animate-pulse cursor-default';
        actsContainer.insertBefore(streakEl, actsContainer.firstChild);
    }
    // 只有连胜大于0才显示
    if((player.streak || 0) > 0) {
        streakEl.style.display = 'inline-block';
        streakEl.textContent = `🔥 ${player.streak} 天`;
    } else {
        streakEl.style.display = 'none';
    }
}

function renderStats() {
  const bw = words.filter(w => w.bookId === currentBookId);
  const qRem = Math.max(0, queue.length - qi);
  document.getElementById('sTodo').textContent = qRem; 
  document.getElementById('sTotal').textContent = `${player.todayNew || 0}/${player.dailyNew || 10}`;
  document.getElementById('sTotal').nextElementSibling.textContent = '今日新词';
  document.getElementById('sMast').textContent = bw.filter(w=>w.level>=5).length;
  const cb = books.find(b=>b.id===currentBookId);
  document.getElementById('curBookLabel').textContent = cb ? cb.name : '默认词库';
}

function renderDots() {
  const el=document.getElementById('dots'), n=queue.length;
  const show=Math.min(n,12), s=Math.max(0,Math.min(qi-5,n-show));
  el.innerHTML='';
  for(let i=s;i<s+show;i++){
    const d=document.createElement('div');
    d.className='dot'+(i===qi?' cur':i<qi?' done':'');
    el.appendChild(d);
  }
}

/* ═══════════════════════════════════════════════
   10. 翻卡与完成动画
   ═══════════════════════════════════════════════ */
function showCard() {
  if (qi >= queue.length) { showDone(); return; }
  const w = words[queue[qi]]; shown = false;
  
  document.getElementById('wEmo').textContent = w.emoji || '📝'; document.getElementById('wEmo').classList.add('off');       
  document.getElementById('wEn').textContent  = w.english;
  document.getElementById('wPh').textContent  = getPhonics(w.english);
  document.getElementById('wZh').textContent  = w.chinese; document.getElementById('wZh').classList.add('off');        
  document.getElementById('hint').style.opacity = '1';
  document.getElementById('lvBadge').textContent= 'Lv.'+w.level;
  document.getElementById('acts').removeAttribute('hidden');
  document.getElementById('sndBtn').style.display='flex';
  
  renderDots(); renderStats();
  const c=document.getElementById('card');
  c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  
  setTimeout(async () => { await autoSpeak(w.english); }, 350);
}

function showDone() {
  document.getElementById('wEmo').textContent  = '🏆'; document.getElementById('wEmo').classList.remove('off');
  document.getElementById('wEn').textContent   = '太棒啦！';
  document.getElementById('wPh').textContent   = '';
  document.getElementById('wZh').textContent   = '今天的死磕终于成功了 💪'; document.getElementById('wZh').classList.remove('off');
  document.getElementById('hint').style.opacity= '0';
  document.getElementById('lvBadge').textContent='✨';
  document.getElementById('acts').setAttribute('hidden','');
  document.getElementById('sndBtn').style.display='none';
  document.getElementById('dots').innerHTML='';
  renderStats();
  
  const c=document.getElementById('card');
  c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  setTimeout(fireworks, 420);
  
  // 触发今日打卡判定！
  processDailyCheckIn();
}

function cardTap() {
  if (qi >= queue.length) return;
  shown=!shown;
  document.getElementById('wEmo').classList.toggle('off',!shown);
  document.getElementById('wZh').classList.toggle('off',!shown);
  document.getElementById('hint').style.opacity=shown?'0':'1';
  
  if (shown) {
    const w = words[queue[qi]];
    if (w && w.chinese && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(w.chinese);
      const voices = window.speechSynthesis.getVoices();
      let zhV = voices.find(v => v.lang.includes('zh'));
      if (zhV) u.voice = zhV; else u.lang = 'zh-CN';
      u.rate = 0.9; window.speechSynthesis.speak(u);
    }
  }
}

function prevWord(e) { e.stopPropagation(); if (qi > 0) { qi--; showCard(); } }

function addExp(n) {
  const oldLv=Math.min(Math.floor(player.exp/EXP_CAP),PET_ICO.length-1);
  player.exp+=n;
  const newLv=Math.min(Math.floor(player.exp/EXP_CAP),PET_ICO.length-1);
  player.petLevel=newLv; saveP(); renderPet();
  if (newLv>oldLv) showLevelUp(newLv);
}

function showLevelUp(lv) {
  lv=Math.min(lv,PET_ICO.length-1);
  document.getElementById('lutIco').textContent=PET_ICO[lv]; document.getElementById('lutTtl').textContent=PET_NM[lv]+' 进化了！';
  document.getElementById('lutSub').textContent=PET_SUB[lv];
  const t=document.getElementById('lut'); t.classList.add('show');
  try{ confetti({particleCount:55,spread:65,origin:{y:.5},colors:['#FFB3C6','#C8B6FF','#B5EAD7','#FFEAA7']}); }catch(e){}
  setTimeout(()=>t.classList.remove('show'),2700);
}

function fireworks() {
  const cols=['#FFB3C6','#C8B6FF','#BBD0FF','#B5EAD7','#FFEAA7','#FFCBA4'];
  const end=Date.now()+3200;
  (function burst(){
    try{
        confetti({particleCount:5,angle:58, spread:54,origin:{x:0},colors:cols});
        confetti({particleCount:5,angle:122,spread:54,origin:{x:1},colors:cols});
    }catch(e){}
    if(Date.now()<end) requestAnimationFrame(burst);
  })();
}

/* ═══════════════════════════════════════════════
   11. 发音引擎与其他基础功能
   ═══════════════════════════════════════════════ */
async function autoSpeak(word) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${ttsAccent}`;
  try { const audio = new Audio(url); await audio.play(); } 
  catch(err) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(word);
      u.lang='en-US'; u.rate=0.82; u.pitch=1.25; window.speechSynthesis.speak(u);
    }
  }
}
async function speak(e) { e.stopPropagation(); if (qi >= queue.length) return; await autoSpeak(words[queue[qi]].english); }

/* 家长控制台相关 */
function openGear() {
  renderUserCards(); renderBookTabs(); refreshList();
  document.getElementById('ta').value=''; document.getElementById('mmsg').innerHTML='';
  document.getElementById('ov').classList.add('open');
}
function closeOv() { document.getElementById('ov').classList.remove('open'); }
function ovClick(e) { if(e.target.id==='ov') closeOv(); }

async function setDailyPlan(type) {
    const isNew = type === 'new';
    const title = isNew ? '🎯 请输入每天新词限额：(建议5-15)' : '🔄 请输入每天复习上限：(建议30-50)';
    const curVal = isNew ? (player.dailyNew || 10) : (player.dailyRev || 30);
    
    let num = await Dialog.prompt(title, curVal);
    if(num === null || num.trim()==='') return;
    num = parseInt(num); if(isNaN(num) || num < 1) { await Dialog.alert('❌ 无效数字！'); return; }
    
    if(isNew) player.dailyNew = num; else player.dailyRev = num;
    saveP(); renderUserCards();
    
    if(await Dialog.confirm('✅ 计划已保存！\n是否立刻生效并重置今天的卡片队伍？')) {
        queue = buildQueue(true); qi = 0; showCard();
    }
}

function renderUserCards() {
  document.getElementById('userCards').innerHTML = USERS.map(u => {
    const ps = localStorage.getItem(pKey(u.uid));
    const pObj  = ps ? JSON.parse(ps) : {exp:0,petLevel:0, dailyNew:10, dailyRev:30, streak:0};
    const lv    = Math.min(pObj.petLevel, PET_ICO.length-1);
    const isMe  = u.uid === currentUid;
    
    return `
    <div class="uc${isMe?' active-uc':''}">
      <div class="uc-head">
        <span class="uc-ico">${u.ico}</span><span class="uc-name">${u.name}</span>
        ${isMe?'<span class="uc-tag">当前使用</span>':''}
      </div>
      <div class="uc-stats" style="flex-direction:column; gap:4px">
        <div>📈 ${PET_ICO[lv]} Lv.${lv+1} (${pObj.exp} EXP) | 🔥 连胜：${pObj.streak||0} 天</div>
        <div class="flex gap-2 mt-2">
            <button class="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs" onclick="setDailyPlan('new')">🎯 新词: ${pObj.dailyNew || 10} ✎</button>
            <button class="bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg font-bold text-xs" onclick="setDailyPlan('rev')">🔄 复习: ${pObj.dailyRev || 30} ✎</button>
        </div>
      </div>
      <div class="uc-btns mt-3">
        ${!isMe ? `<button class="uc-btn sw" onclick="switchUser('${u.uid}')">🔄 切换用户</button>` : '<button class="uc-btn sw" style="opacity:.4;cursor:default">✅ 当前用户</button>'}
        <button class="uc-btn cl" onclick="clearUserStep1('${u.uid}','${u.name}')">🗑️ 清除记录</button>
      </div>
    </div>`;
  }).join('');
}

function switchUser(uid) {
  loadBooks(); loadUser(uid); queue=buildQueue(); qi=0;
  renderPet(); renderBookTabs(); showCard(); renderStats(); renderUserCards(); refreshList();
}

async function clearUserStep1(uid, name) {
  if (!(await Dialog.confirm(`确定清除【${name}】的记录？进度将归零。`))) return;
  const t = await Dialog.prompt(`输入「${name}」确认：`);
  if (t !== name) { await Dialog.alert('❌ 输入错误'); return; }
  
  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    const wd = JSON.parse(ws); wd.forEach(w => { w.level = 0; w.nextReview = Date.now(); });
    localStorage.setItem(wKey(uid), JSON.stringify(wd));
  }
  localStorage.removeItem(pKey(uid)); loadBooks();
  if (uid === currentUid) { loadUser(uid); queue=buildQueue(true); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); }
  renderUserCards(); refreshList(); await Dialog.alert(`✅ 已清空！`);
}

function refreshList() {
  const cb = books.find(b=>b.id===currentBookId);
  const bw = words.filter(w => w.bookId === currentBookId);
  document.getElementById('wcnt').textContent = bw.length;
  document.getElementById('wcntBook').textContent = cb ? cb.name : '默认';
  document.getElementById('wlist').innerHTML = bw.map(w => `<div class="wi"><span class="we">${w.emoji||'📝'}</span><span class="wn">${w.english}</span><span class="wz">${w.chinese}</span><span class="ws">${'⭐'.repeat(Math.min(w.level,5))}</span><button class="we-btn" onclick="editWord('${w.id}')">改</button><button class="wd" onclick="deleteWord('${w.id}')">删</button></div>`).join('');
}

async function editWord(id) {
  const w = words.find(w => w.id === id); if (!w) return;
  const ne = await Dialog.prompt('英文：', w.english); if (ne === null) return;
  const nz = await Dialog.prompt('中文：', w.chinese); if (nz === null) return;
  const nEmo = await Dialog.prompt('Emoji：', w.emoji); if (nEmo === null) return;

  const en = ne.trim() || w.english, zh = nz.trim() || w.chinese, emo = nEmo.trim() || autoEmoji(en);
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return;
    const arr = JSON.parse(ws); const idx = arr.findIndex(x => x.id === id); if (idx === -1) return;
    arr[idx].english = en; arr[idx].chinese = zh; arr[idx].emoji = emo;
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if (u.uid === currentUid) words = arr;
  });
  if (queue[qi] !== undefined && words[queue[qi]]?.id === id) showCard();
  refreshList(); renderStats();
}

async function deleteWord(id) {
  if(!(await Dialog.confirm('确定删除吗？'))) return;
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return;
    const arr = JSON.parse(ws).filter(w => w.id !== id);
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if (u.uid === currentUid) words = arr;
  });
  queue = buildQueue(); qi = 0; refreshList(); renderStats(); showCard();
}

function importWords() {
  const raw = document.getElementById('ta').value.trim(); if (!raw) return;
  let ok=0; const p = [];
  raw.split('\n').forEach(l => { const pp = l.trim().split(/[,，]/); if(pp.length>=2) p.push({ en:pp[0].trim(), zh:pp[1].trim(), emo:pp[2]?.trim()||autoEmoji(pp[0]) }); });
  if (!p.length) return;

  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    const arr = ws ? JSON.parse(ws) : [];
    p.forEach(({en, zh, emo}) => {
      const dup = arr.find(w => w.english.toLowerCase()===en.toLowerCase() && w.bookId===currentBookId);
      if (!dup) { arr.push({ id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2), english:en, chinese:zh, emoji:emo, level:0, nextReview:Date.now(), bookId:currentBookId }); if(u.uid===currentUid) ok++; }
    });
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if(u.uid===currentUid) words = arr;
  });
  document.getElementById('ta').value = '';
  document.getElementById('mmsg').innerHTML = `<div class="m-msg m-ok">✅ 成功导入 ${ok} 个新词</div>`;
  setTimeout(() => document.getElementById('mmsg').innerHTML = '', 2500);
  refreshList(); queue = buildQueue(); qi = 0; showCard(); renderStats();
}

function renderBookTabs() {
  document.getElementById('bookTabs').innerHTML = books.map(b => `<button class="btab${b.id===currentBookId?' active':''}" onclick="switchBook('${b.id}')">${b.name} (${words.filter(w=>w.bookId===b.id).length})</button>`).join('');
  document.getElementById('curBookLabel').textContent = books.find(b=>b.id===currentBookId)?.name || '默认';
}
function switchBook(id) { currentBookId = id; localStorage.setItem('mw_cbook_'+currentUid, id); queue=buildQueue(); qi=0; renderBookTabs(); refreshList(); renderStats(); showCard(); }
async function createBook() { const n=await Dialog.prompt('新词库名：'); if(!n||!n.trim())return; const id='b_'+Date.now(); books.push({id, name:n.trim()}); saveBooks(); switchBook(id); }
async function renameBook() { const cb=books.find(b=>b.id===currentBookId); if(!cb)return; const n=await Dialog.prompt('重命名：',cb.name); if(n&&n.trim()){cb.name=n.trim(); saveBooks(); renderBookTabs();} }
async function deleteBook() { 
  if(books.length<=1){await Dialog.alert('至少保留1个词库');return;} 
  if(!(await Dialog.confirm('⚠️ 删除词库及所有词？'))) return;
  USERS.forEach(u=>{
    const ws=localStorage.getItem(wKey(u.uid)); if(ws){
      const arr=JSON.parse(ws).filter(w=>w.bookId!==currentBookId); localStorage.setItem(wKey(u.uid),JSON.stringify(arr)); if(u.uid===currentUid)words=arr;
    }
  });
  books=books.filter(b=>b.id!==currentBookId); saveBooks(); currentBookId=books[0].id; localStorage.setItem('mw_cbook_',currentBookId); queue=buildQueue(); qi=0; renderBookTabs(); refreshList(); renderStats(); showCard();
}

/* ═══════════════════════════════════════════════
   12. 初始化收尾
   ═══════════════════════════════════════════════ */
const EMOJI = { apple:'🍎',banana:'🍌',cat:'🐱',dog:'🐶',elephant:'🐘',fish:'🐟',giraffe:'🦒',hat:'🎩','ice cream':'🍦',juice:'🧃' };
function autoEmoji(en) { return EMOJI[en.toLowerCase().trim()] || '📝'; }
function getPhonics(en) { return ''; } 

function spawnPts() {
  const b=['⭐','✨','💫','🎵','💝','🌈','🎀','🫧','🍭','🎊']; const w=document.getElementById('pts');
  for(let i=0;i<10;i++){ const p=document.createElement('div'); p.className='pt'; p.textContent=b[i%10]; p.style.left=(Math.random()*97)+'vw'; p.style.fontSize=(.9+Math.random())+'rem'; p.style.animationDuration=(10+Math.random()*10)+'s'; p.style.animationDelay=(-Math.random()*15)+'s'; w.appendChild(p); }
}

function init() {
  loadBooks(); loadUser(currentUid); renderPet(); spawnPts();
  document.getElementById('accentBtn').textContent = ttsAccent===2 ? '🇺🇸 美式' : '🇬🇧 英式';
  queue=buildQueue(); qi=0; showCard(); renderStats();
}
init(); // ⚠️ 完美收尾！
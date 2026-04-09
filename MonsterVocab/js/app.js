/* ═══════════════════════════════════════════════
   PWA 注册 (保持原样)
   ═══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW 注册成功', reg.scope))
      .catch(err => console.log('SW 注册失败', err));
  });
}

/* ═══════════════════════════════════════════════
   全新 Dialog 异步弹窗系统 (替代原生丑陋弹窗)
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

            t.textContent = title;
            m.classList.remove('hidden');
            m.classList.add('flex');
            setTimeout(() => { c.classList.remove('scale-95'); c.classList.add('scale-100'); }, 10);

            i.classList.add('hidden');
            btnCancel.classList.add('hidden');
            i.value = defaultVal;

            if(type === 'prompt') {
                i.classList.remove('hidden');
                btnCancel.classList.remove('hidden');
                i.focus();
            } else if(type === 'confirm') {
                btnCancel.classList.remove('hidden');
            }

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
   基础配置与种子字典
   ═══════════════════════════════════════════════ */
let ttsAccent = parseInt(localStorage.getItem('mw_accent') || '2'); // 2=美式 1=英式

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
  {english:'juice',   chinese:'果汁',  emoji:'🧃'},
];

const USERS = [
  { uid:'u1', name:'山山', ico:'👦' },
  { uid:'u2', name:'水水', ico:'👧' },
];

let currentUid = localStorage.getItem('mw_cur') || 'u1';
function wKey(uid) { return 'mw_w_'+uid; }
function pKey(uid) { return 'mw_p_'+uid; }

/* ═══════════════════════════════════════════════
   全局状态
   ═══════════════════════════════════════════════ */
let words         = [];
let player        = {exp:0, petLevel:0, dailyNew: 10, dailyRev: 30, lastDate: '', todayNew: 0, todayRev: 0};
let books         = [];
let currentBookId = 'default';
let queue         = [];
let qi            = 0;
let shown         = false;

/* ═══════════════════════════════════════════════
   持久化存储
   ═══════════════════════════════════════════════ */
const saveW     = () => localStorage.setItem(wKey(currentUid), JSON.stringify(words));
const saveP     = () => localStorage.setItem(pKey(currentUid), JSON.stringify(player));
const saveBooks = () => localStorage.setItem('mw_books', JSON.stringify(books));

function loadBooks() {
  try {
    const bs = localStorage.getItem('mw_books');
    if (bs) {
      books = JSON.parse(bs);
      if (!Array.isArray(books)) books = [{id:'default', name:'默认词库'}];
    } else {
      books = [{id:'default', name:'默认词库'}];
    }
    if (!books.find(b => b.id==='default')) books.unshift({id:'default', name:'默认词库'});
  } catch (error) {
    books = [{id:'default', name:'默认词库'}];
  }
}

function loadUser(uid) {
  currentUid = uid;
  localStorage.setItem('mw_cur', uid);

  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    words = JSON.parse(ws);
    let migrated = false;
    words.forEach(w => { if (!w.bookId) { w.bookId='default'; migrated=true; } });
    if (migrated) saveW();
  } else {
    words = SEED.map((s,i) => ({
      id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji,
      level:0, nextReview:Date.now(), bookId:'default'
    }));
    saveW();
  }

  const ps = localStorage.getItem(pKey(uid));
  player = ps ? JSON.parse(ps) : {exp:0, petLevel:0};
  
  // 兼容老数据：如果没有设定每日配额，注入默认值
  if(player.dailyNew === undefined) player.dailyNew = 10;
  if(player.dailyRev === undefined) player.dailyRev = 30;

  currentBookId = localStorage.getItem('mw_cbook_'+uid) || 'default';
}

/* ═══════════════════════════════════════════════
   【重构核心】智能列队系统 (每日限量引擎)
   ═══════════════════════════════════════════════ */
function buildQueue(forceRebuild = false) {
  const now = Date.now();
  const today = new Date().toDateString(); // 当前日期字符串

  // 如果跨天了，或者强制重置，清零今日已学计数
  if (player.lastDate !== today || forceRebuild) {
    if (player.lastDate !== today) {
      player.todayNew = 0;
      player.todayRev = 0;
    }
    player.lastDate = today;
    saveP();
  }

  const limitNew = player.dailyNew || 10;
  const limitRev = player.dailyRev || 30;

  let candNew = [];
  let candRev = [];

  // 扫描词库：筛选出到期需要复习和全新的词
  words.forEach((w, i) => {
    if (w.bookId === currentBookId && (w.nextReview || 0) <= now) {
      if (w.level === 0) candNew.push(i);
      else candRev.push(i);
    }
  });

  // 打乱候选池
  candNew.sort(() => Math.random() - 0.5);
  candRev.sort(() => Math.random() - 0.5);

  // 核心逻辑：只截取 [今天剩余名额] 的卡片放入列队
  const needNew = Math.max(0, limitNew - (player.todayNew || 0));
  const needRev = Math.max(0, limitRev - (player.todayRev || 0));

  let finalNew = candNew.slice(0, needNew);
  let finalRev = candRev.slice(0, needRev);

  // 合并复习词和新词，乱序后展示给孩子
  let q = [...finalNew, ...finalRev];
  q.sort(() => Math.random() - 0.5);

  return q;
}

// 艾宾浩斯间隔算法
function interval(level, action) {
  // 修改为更科学的短期记忆间隔
  if (level === 1) return 12 * 3600000; // 12小时
  if (level === 2) return 24 * 3600000; // 1天
  if (level === 3) return 2 * 24 * 3600000; // 2天
  if (level === 4) return 4 * 24 * 3600000; // 4天
  return 7 * 24 * 3600000; // 7天
}

/* ═══════════════════════════════════════════════
   【重构核心】行为反馈 (错题无限重做流)
   ═══════════════════════════════════════════════ */
function act(action) {
  if (qi >= queue.length) return;
  const idx = queue[qi];
  const w = words[idx];
  const isNewWord = (w.level === 0);

  if (action === 'know' || action === 'master') {
    // 答对了，推进进度，并计算进今日完成限额指标！
    if (isNewWord) {
      player.todayNew = (player.todayNew || 0) + 1;
    } else {
      player.todayRev = (player.todayRev || 0) + 1;
    }

    if (action === 'know') {
      w.level = Math.max(1, w.level + 1); // 至少变为1级
      w.nextReview = Date.now() + interval(w.level, 'know');
      addExp(20);
    } else {
      w.level = 5; // 彻底掌握
      w.nextReview = Date.now() + 7 * 24 * 3600000;
      addExp(30);
    }
  } 
  else {
    // 答错了或者模糊！
    if (action === 'fuzzy') {
      w.level = Math.max(1, w.level); // 保持级别不坠到底，但增加经验鼓励
      addExp(5);
    } else {
      w.level = 0; // 彻底忘了，归零
    }
    
    // 🌟 魔鬼算法核心：做错了？立刻把这道题按插在今天的队伍最后面！
    // 不记录“下一次复习时间”，而是强制今天必须“打败”它！
    queue.push(idx);
  }

  saveW(); 
  qi++; // 指针推向下一个卡片
  setTimeout(showCard, 150);
}

/* ═══════════════════════════════════════════════
   渲染数据看板
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
}

function renderStats() {
  const bw = words.filter(w => w.bookId === currentBookId);
  const qRem = Math.max(0, queue.length - qi);
  document.getElementById('sTodo').textContent = qRem; // 今日队伍剩余
  
  // 动态修改原来本册总数的栏位，变为更实用的“今日完成情况”
  const tNew = player.todayNew || 0;
  const dNew = player.dailyNew || 10;
  document.getElementById('sTotal').textContent = `${tNew}/${dNew}`;
  document.getElementById('sTotal').nextElementSibling.textContent = '新词完成';
  
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
   展示卡片控制
   ═══════════════════════════════════════════════ */
function showCard() {
  if (qi >= queue.length) { showDone(); return; }
  const w = words[queue[qi]];
  shown = false;
  
  document.getElementById('wEmo').textContent = w.emoji || '📝';
  document.getElementById('wEmo').classList.add('off');       
  document.getElementById('wEn').textContent    = w.english;
  document.getElementById('wPh').textContent    = getPhonics(w.english);
  document.getElementById('wZh').textContent    = w.chinese;
  document.getElementById('wZh').classList.add('off');        
  document.getElementById('hint').style.opacity = '1';
  document.getElementById('lvBadge').textContent= 'Lv.'+w.level;
  document.getElementById('acts').removeAttribute('hidden');
  document.getElementById('sndBtn').style.display='flex';
  
  renderDots(); 
  renderStats();
  
  const c=document.getElementById('card');
  c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  
  setTimeout(async () => {
    await autoSpeak(w.english);
  }, 350);
}

function showDone() {
  document.getElementById('wEmo').textContent  = '🎉';
  document.getElementById('wEmo').classList.remove('off');
  document.getElementById('wEn').textContent   = '太棒啦！';
  document.getElementById('wPh').textContent   = '';
  document.getElementById('wZh').textContent   = '今日学习目标全部完成 💪';
  document.getElementById('wZh').classList.remove('off');
  document.getElementById('hint').style.opacity= '0';
  document.getElementById('lvBadge').textContent='✨';
  document.getElementById('acts').setAttribute('hidden','');
  document.getElementById('sndBtn').style.display='none';
  document.getElementById('dots').innerHTML='';
  renderStats();
  
  const c=document.getElementById('card');
  c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  setTimeout(fireworks, 420);
}

function cardTap() {
  if (qi >= queue.length) return;
  shown=!shown;
  document.getElementById('wEmo').classList.toggle('off',!shown);
  document.getElementById('wZh').classList.toggle('off',!shown);
  document.getElementById('hint').style.opacity=shown?'0':'1';
  
  // 翻看中文时朗读中文
  if (shown) {
    const w = words[queue[qi]];
    if (w && w.chinese && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(w.chinese);
      const voices = window.speechSynthesis.getVoices();
      let chineseVoice = voices.find(v => v.lang.includes('zh'));
      if (chineseVoice) utterance.voice = chineseVoice;
      else utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }
}

function prevWord(e) {
  e.stopPropagation();
  if (qi > 0) { qi--; showCard(); }
}

function addExp(n) {
  const oldLv=Math.min(Math.floor(player.exp/EXP_CAP),PET_ICO.length-1);
  player.exp+=n;
  const newLv=Math.min(Math.floor(player.exp/EXP_CAP),PET_ICO.length-1);
  player.petLevel=newLv;
  saveP(); renderPet();
  if (newLv>oldLv) showLevelUp(newLv);
}

function showLevelUp(lv) {
  lv=Math.min(lv,PET_ICO.length-1);
  document.getElementById('lutIco').textContent=PET_ICO[lv];
  document.getElementById('lutTtl').textContent=PET_NM[lv]+' 出生了！';
  document.getElementById('lutSub').textContent=PET_SUB[lv];
  const t=document.getElementById('lut');
  t.classList.add('show');
  confetti({particleCount:55,spread:65,origin:{y:.5},colors:['#FFB3C6','#C8B6FF','#B5EAD7','#FFEAA7']});
  setTimeout(()=>t.classList.remove('show'),2700);
}

function fireworks() {
  const cols=['#FFB3C6','#C8B6FF','#BBD0FF','#B5EAD7','#FFEAA7','#FFCBA4'];
  const end=Date.now()+3200;
  (function burst(){
    confetti({particleCount:5,angle:58, spread:54,origin:{x:0},colors:cols});
    confetti({particleCount:5,angle:122,spread:54,origin:{x:1},colors:cols});
    if(Date.now()<end) requestAnimationFrame(burst);
  })();
}

/* ═══════════════════════════════════════════════
   TTS 发音引擎
   ═══════════════════════════════════════════════ */
async function autoSpeak(word) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${ttsAccent}`;
  try {
    const audio = new Audio(url);
    await audio.play();
  } catch(err) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang='en-US'; u.rate=0.82; u.pitch=1.25;
      window.speechSynthesis.speak(u);
    }
  }
}
async function speak(e) {
  e.stopPropagation();
  if (qi >= queue.length) return;
  await autoSpeak(words[queue[qi]].english);
}

/* ═══════════════════════════════════════════════
   家长控制台 (加入学习计划配置)
   ═══════════════════════════════════════════════ */
function openGear() {
  renderUserCards();
  renderBookTabs();
  refreshList();
  document.getElementById('ta').value='';
  document.getElementById('mmsg').innerHTML='';
  document.getElementById('ov').classList.add('open');
}

function closeOv() { document.getElementById('ov').classList.remove('open'); }
function ovClick(e) { if(e.target.id==='ov') closeOv(); }

// 设置每日计划
async function setDailyPlan(type) {
    const isNew = type === 'new';
    const title = isNew ? '🎯 请输入每天学习【新单词】的最高限额：\n(为了保护兴趣，建议设为 5 - 15个)' : '🔄 请输入每天【历史复习】的最高限额：\n(建议设为 30 - 50个)';
    const curVal = isNew ? (player.dailyNew || 10) : (player.dailyRev || 30);
    
    let num = await Dialog.prompt(title, curVal);
    if(num === null || num.trim()==='') return;
    num = parseInt(num);
    if(isNaN(num) || num < 1) { await Dialog.alert('❌ 请输入有效的数字！'); return; }
    
    if(isNew) player.dailyNew = num;
    else player.dailyRev = num;
    
    saveP();
    renderUserCards(); // 刷新卡片显示
    
    const r = await Dialog.confirm('✅ 计划已保存生效！\n\n是否要立刻用新配额重置今天的学习队伍？\n(点确定会洗牌重来，今日已学新词数量归零)');
    if(r) {
        queue = buildQueue(true); // 传入 true 强行重置今天状态
        qi = 0;
        showCard();
    }
}

function renderUserCards() {
  document.getElementById('userCards').innerHTML = USERS.map(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    const ps = localStorage.getItem(pKey(u.uid));
    const wArr  = ws ? JSON.parse(ws) : [];
    const pObj  = ps ? JSON.parse(ps) : {exp:0,petLevel:0, dailyNew:10, dailyRev:30};
    const lv    = Math.min(pObj.petLevel, PET_ICO.length-1);
    const isMe  = u.uid === currentUid;
    
    return `
    <div class="uc${isMe?' active-uc':''}">
      <div class="uc-head">
        <span class="uc-ico">${u.ico}</span>
        <span class="uc-name">${u.name}</span>
        ${isMe?'<span class="uc-tag">当前使用</span>':''}
      </div>
      <div class="uc-stats" style="flex-direction:column; gap:4px">
        <div>📈 等级：${PET_ICO[lv]} Lv.${lv+1} (${pObj.exp} EXP)</div>
        <div class="flex gap-2 mt-2">
            <button class="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs" onclick="setDailyPlan('new')">🎯 新词上限: ${pObj.dailyNew || 10}个/天 ✎</button>
            <button class="bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg font-bold text-xs" onclick="setDailyPlan('rev')">🔄 复习上限: ${pObj.dailyRev || 30}个/天 ✎</button>
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
  const r1 = await Dialog.confirm(`确定要清除【${name}】的所有学习记录吗？\n\n进度将全部归零，无法恢复。`);
  if (!r1) return;
  const typed = await Dialog.prompt(`请输入用户名「${name}」以最终确认清除：`);
  if (typed === null) return;
  if (typed.trim() !== name) { await Dialog.alert('❌ 用户名不匹配，已取消'); return; }
  
  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    const wordsData = JSON.parse(ws);
    wordsData.forEach(w => { w.level = 0; w.nextReview = Date.now(); });
    localStorage.setItem(wKey(uid), JSON.stringify(wordsData));
  }
  localStorage.removeItem(pKey(uid));
  loadBooks();
  if (uid === currentUid) { loadUser(uid); queue=buildQueue(); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); }
  renderUserCards(); refreshList();
  await Dialog.alert(`✅ 【${name}】的记录已清除，进度和经验已重置！`);
}

function refreshList() {
  const cb = books.find(b=>b.id===currentBookId);
  const bw = words.filter(w => w.bookId === currentBookId);
  document.getElementById('wcnt').textContent     = bw.length;
  document.getElementById('wcntBook').textContent = cb ? cb.name : '默认词库';
  document.getElementById('wlist').innerHTML = bw.map(w => {
    const emojiHtml = w.emoji || '📝';
    return `<div class="wi">
      <span class="we">${emojiHtml}</span>
      <span class="wn">${w.english}</span>
      <span class="wz">${w.chinese}</span>
      <span class="ws">${'⭐'.repeat(Math.min(w.level,5))||'·'}</span>
      <button class="we-btn" onclick="editWord('${w.id}')">修改</button>
      <button class="wd"     onclick="deleteWord('${w.id}')">删除</button>
    </div>`;
  }).join('');
}

async function editWord(id) {
  const w = words.find(w => w.id === id);
  if (!w) return;
  const newEn = await Dialog.prompt('✏️ 修改英文（当前：' + w.english + '）：', w.english);
  if (newEn === null) return;
  const newZh = await Dialog.prompt('✏️ 修改中文（当前：' + w.chinese + '）：', w.chinese);
  if (newZh === null) return;
  const newEmo = await Dialog.prompt('✏️ 修改Emoji：', w.emoji);
  if (newEmo === null) return;

  const en  = newEn.trim()  || w.english;
  const zh  = newZh.trim()  || w.chinese;
  const emo = newEmo.trim() || autoEmoji(en);

  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return;
    arr[idx].english = en; arr[idx].chinese = zh; arr[idx].emoji = emo;
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid === currentUid) words = arr;
  });

  if (queue[qi] !== undefined && words[queue[qi]]?.id === id) showCard();
  refreshList(); renderStats();
}

async function deleteWord(id) {
  if(!(await Dialog.confirm('确定要删除这个单词吗？'))) return;
  USERS.forEach(u => {
    const ws  = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws).filter(w => w.id !== id);
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid === currentUid) words = arr;
  });
  queue = buildQueue(); qi = 0;
  refreshList(); renderStats(); showCard();
}

function importWords() {
  const raw = document.getElementById('ta').value.trim();
  if (!raw) return;
  let ok=0, skip=0;
  const parsed = [];
  raw.split('\n').forEach(line => {
    const p = line.trim().split(/[,，]/).map(s => s.trim());
    if (p.length < 2 || !p[0]) return;
    parsed.push({ english:p[0], chinese:p[1], emoji:p[2] || autoEmoji(p[0]) });
  });

  if (parsed.length === 0) {
    document.getElementById('mmsg').innerHTML = '<div class="m-msg m-er">❌ 没有识别到有效单词，请检查格式</div>';
    setTimeout(()=>document.getElementById('mmsg').innerHTML='', 3000);
    return;
  }

  USERS.forEach(u => {
    const ws  = localStorage.getItem(wKey(u.uid));
    const arr = ws ? JSON.parse(ws) : SEED.map((s,i) => ({
      id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji,
      level:0, nextReview:Date.now(), bookId:'default'
    }));
    parsed.forEach(({english, chinese, emoji}) => {
      const dup = arr.find(w => w.english.toLowerCase()===english.toLowerCase() && w.bookId===currentBookId);
      if (dup) { if (u.uid===currentUid) skip++; return; }
      arr.push({ id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
        english, chinese, emoji, level:0, nextReview:Date.now(), bookId:currentBookId });
      if (u.uid===currentUid) ok++;
    });
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid===currentUid) words = arr;
  });

  document.getElementById('ta').value = '';
  document.getElementById('mmsg').innerHTML = `<div class="m-msg m-ok">✅ 导入 ${ok} 词${skip?' | 跳过重复 '+skip+' 个':''}</div>`;
  setTimeout(() => document.getElementById('mmsg').innerHTML = '', 3500);
  refreshList(); queue = buildQueue(); qi = 0; showCard(); renderStats();
}

function renderBookTabs() {
  document.getElementById('bookTabs').innerHTML = books.map(b => {
    const count = words.filter(w => w.bookId === b.id).length;
    return `<button class="btab${b.id===currentBookId?' active':''}" onclick="switchBook('${b.id}')">${b.name} (${count})</button>`;
  }).join('');
  const cb = books.find(b=>b.id===currentBookId);
  document.getElementById('curBookLabel').textContent = cb ? cb.name : '默认词库';
  document.getElementById('wcntBook').textContent     = cb ? cb.name : '默认词库';
}

function switchBook(id) {
  currentBookId = id;
  localStorage.setItem('mw_cbook_'+currentUid, id);
  queue=buildQueue(); qi=0;
  renderBookTabs(); refreshList(); renderStats(); showCard();
}

async function createBook() {
  const name = await Dialog.prompt('📚 请输入新词库名称：');
  if (!name || !name.trim()) return;
  const id = 'b_'+Date.now();
  books.push({id, name:name.trim()});
  saveBooks(); switchBook(id);
}

async function renameBook() {
  const cb = books.find(b=>b.id===currentBookId);
  if (!cb) return;
  const name = await Dialog.prompt('✏️ 重命名词库（当前：'+cb.name+'）：', cb.name);
  if (!name || !name.trim()) return;
  cb.name = name.trim();
  saveBooks(); renderBookTabs(); refreshList(); renderStats();
}

async function deleteBook() {
  if (books.length <= 1) { await Dialog.alert('❌ 至少保留一个词库，无法删除'); return; }
  const cb = books.find(b=>b.id===currentBookId);
  if (!(await Dialog.confirm('⚠️ 确定删除词库「'+cb.name+'」？\n里面所有单词将被永久删除！'))) return;
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws).filter(w => w.bookId !== currentBookId);
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid===currentUid) words = arr;
  });
  books = books.filter(b=>b.id!==currentBookId);
  saveBooks(); currentBookId = books[0].id;
  localStorage.setItem('mw_cbook_'+currentUid, currentBookId);
  queue=buildQueue(); qi=0;
  renderBookTabs(); refreshList(); renderStats(); showCard();
}

/* ═══════════════════════════════════════════════
   字典辅助 (保持原版简化)
   ═══════════════════════════════════════════════ */
const EMOJI_MAP = {
  apple:'🍎',banana:'🍌',cat:'🐱',dog:'🐶',elephant:'🐘',fish:'🐟',giraffe:'🦒',
  hat:'🎩','ice cream':'🍦',juice:'🧃', school:'🏫', book:'📚', teacher:'👩‍🏫',
  color:'🎨', red:'🔴', blue:'🔵', green:'🟢', happy:'😊', sad:'😢', tiger:'🐯'
};
function autoEmoji(en) { const k = en.toLowerCase().trim(); return EMOJI_MAP[k] || '📝'; }
function getPhonics(en) { return ''; } // 可选：这里你可以接回我们之前的长长的音标字典

/* ═══════════════════════════════════════════════
   背景与初始化
   ═══════════════════════════════════════════════ */
function spawnPts() {
  const bag=['⭐','✨','💫','🌟','🎵','💝','🌈','🎀','🫧','🍭','🎊'];
  const wrap=document.getElementById('pts');
  for(let i=0;i<11;i++){
    const p=document.createElement('div');
    p.className='pt'; p.textContent=bag[i%bag.length]; p.style.left=(Math.random()*97)+'vw';
    p.style.fontSize=(.85+Math.random()*1.25)+'rem'; p.style.animationDuration=(9+Math.random()*14)+'s';
    p.style.animationDelay=(-Math.random()*18)+'s'; wrap.appendChild(p);
  }
}

function init() {
  loadBooks();
  loadUser(currentUid);
  renderPet();
  spawnPts();
  document.getElementById('accentBtn').textContent = ttsAccent===2 ? '🇺🇸 美式' : '🇬🇧 英式';
  queue=buildQueue(); qi=0;
  showCard(); renderStats();
}
init();

/* ═══════════════════════════════════════════════
   1. PWA 注册工作线程
   ═══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW 注册成功', reg.scope))
      .catch(err => console.log('SW 注册失败', err));
  });
}

/* ═══════════════════════════════════════════════
   2. System Dialog 异步弹窗
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

            t.innerHTML = title; // 允许渲染 HTML，方便我们做花哨的弹窗
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
   3. 全局常量、发音与字典
   ═══════════════════════════════════════════════ */
let ttsAccent = parseInt(localStorage.getItem('mw_accent') || '2'); 
function toggleAccent() { ttsAccent = ttsAccent === 2 ? 1 : 2; localStorage.setItem('mw_accent', ttsAccent); document.getElementById('accentBtn').textContent = ttsAccent === 2 ? 'US' : 'UK'; }

// 🌟 动物 5 阶图鉴与升级阈值 (对应 totalFed 累计饱食度)
const PET_STAGES = [
  { level: 1, text: 'Lv.1 魔法神蛋', ico: '🥚', sub: '刚刚出生，急需营养～', threshold: 0 },
  { level: 2, text: 'Lv.2 贪吃小恐龙', ico: '🦖', sub: '破壳而出！解锁商店头部装饰！', threshold: 50 },
  { level: 3, text: 'Lv.3 快乐独角兽', ico: '🦄', sub: '神奇魔法觉醒！记忆护航开启！', threshold: 3000 },
  { level: 4, text: 'Lv.4 巡洋大头鲨', ico: '🦈', sub: '天生富豪！答题金币收益翻倍！', threshold: 8000 },
  { level: 5, text: 'Lv.5 许愿神龙', ico: '🐉', sub: '最高级形态！快去召唤爸妈许愿吧！', threshold: 25000 }
];
const FULLNESS_CAP = 300; // 每天饱食度最多到 300，逼迫玩家把剩下的钱存起来换现实特权

const SEED = [
  {english:'apple', chinese:'苹果', emoji:'🍎'}, {english:'banana', chinese:'香蕉', emoji:'🍌'},
  {english:'cat', chinese:'猫咪', emoji:'🐱'}, {english:'dog', chinese:'狗狗', emoji:'🐶'},
  {english:'elephant', chinese:'大象', emoji:'🐘'}, {english:'fish', chinese:'鱼', emoji:'🐟'}
];

const USERS = [ { uid:'u1', name:'大宝', ico:'👦' }, { uid:'u2', name:'二宝', ico:'👧' } ];
let currentUid = localStorage.getItem('mw_cur') || 'u1';
function wKey(uid) { return 'mw_w_'+uid; }
function pKey(uid) { return 'mw_p_'+uid; }

/* ═══════════════════════════════════════════════
   4. 核心状态与存档
   ═══════════════════════════════════════════════ */
let words = [];
// 🌟 玩家数据大地震：增加 coins, fullness, totalFed, crowns
let player = { 
    exp: 0, petLevel: 0, dailyNew: 10, dailyRev: 30, lastDate: '', todayNew: 0, todayRev: 0, 
    streak: 0, lastCheckIn: '',
    coins: 0, fullness: 0, totalFed: 0, ownsCrown: false 
};
let books = []; let currentBookId = 'default';
let queue = []; let qi = 0; let shown = false;

const saveW     = () => localStorage.setItem(wKey(currentUid), JSON.stringify(words));
const saveP     = () => localStorage.setItem(pKey(currentUid), JSON.stringify(player));
const saveBooks = () => localStorage.setItem('mw_books', JSON.stringify(books));

function loadBooks() {
  try { const bs = localStorage.getItem('mw_books'); books = bs ? JSON.parse(bs) : [{id:'default', name:'默认词库'}];
    if (!books.find(b => b.id==='default')) books.unshift({id:'default', name:'默认词库'});
  } catch (e) { books = [{id:'default', name:'默认词库'}]; }
}

function loadUser(uid) {
  currentUid = uid; localStorage.setItem('mw_cur', uid);
  const ws = localStorage.getItem(wKey(uid));
  if (ws) { words = JSON.parse(ws); words.forEach(w => { if (!w.bookId) w.bookId='default'; }); saveW(); } 
  else { words = SEED.map((s,i) => ({id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji, level:0, nextReview:Date.now(), bookId:'default'})); saveW(); }

  const ps = localStorage.getItem(pKey(uid));
  player = ps ? JSON.parse(ps) : {};
  
  // 存档防断层（兼容老数据）
  if(player.dailyNew===undefined) player.dailyNew = 10; if(player.dailyRev===undefined) player.dailyRev = 30;
  if(player.streak===undefined) player.streak = 0;
  if(player.coins===undefined) player.coins = 0;
  if(player.fullness===undefined) player.fullness = 0;
  if(player.totalFed===undefined) player.totalFed = 0;
  if(player.ownsCrown===undefined) player.ownsCrown = false;

  currentBookId = localStorage.getItem('mw_cbook_'+uid) || 'default';
}

/* ═══════════════════════════════════════════════
   5. 每日任务队伍生成
   ═══════════════════════════════════════════════ */
function buildQueue(forceRebuild = false) {
  const now = Date.now(); const today = new Date().toDateString();
  if (player.lastDate !== today || forceRebuild) {
    if (player.lastDate !== today) { 
        player.todayNew = 0; player.todayRev = 0; 
        // 👇 每天早上起来，怪兽肚子空空！
        player.fullness = 0; 
    }
    player.lastDate = today; saveP();
  }

  let candNew = []; let candRev = [];
  words.forEach((w, i) => {
    if (w.bookId === currentBookId && (w.nextReview || 0) <= now) {
      if (w.level === 0) candNew.push(i); else candRev.push(i);
    }
  });

  candNew.sort(() => Math.random() - 0.5); candRev.sort(() => Math.random() - 0.5);
  const needNew = Math.max(0, (player.dailyNew || 10) - (player.todayNew || 0));
  const needRev = Math.max(0, (player.dailyRev || 30) - (player.todayRev || 0));
  return [...candNew.slice(0, needNew), ...candRev.slice(0, needRev)].sort(() => Math.random() - 0.5);
}

function interval(lvl) {
  if (lvl === 1) return 12 * 3600000; if (lvl === 2) return 24 * 3600000; 
  if (lvl === 3) return 2 * 24 * 3600000; if (lvl === 4) return 4 * 24 * 3600000; 
  return 7 * 24 * 3600000; 
}

/* ═══════════════════════════════════════════════
   6. 💰 赚钱算法（行为反馈）
   ═══════════════════════════════════════════════ */
// 计算当前宠物的能力特权
function getPetStage() {
    let currentStage = PET_STAGES[0];
    for(let i = 0; i < PET_STAGES.length; i++){
        if(player.totalFed >= PET_STAGES[i].threshold) currentStage = PET_STAGES[i];
    }
    return currentStage;
}

function act(action) {
  if (qi >= queue.length) return;
  const idx = queue[qi]; const w = words[idx]; const isNewWord = (w.level === 0);
  
  const stage = getPetStage();
  const coinMult = (stage.level >= 4) ? 2 : 1; // 鲨鱼特权：翻倍金币

  if (action === 'know' || action === 'master') {
    if (isNewWord) player.todayNew = (player.todayNew || 0) + 1; else player.todayRev = (player.todayRev || 0) + 1;

    if (action === 'know') {
      w.level = Math.max(1, w.level + 1); w.nextReview = Date.now() + interval(w.level);
      // 答对给金币
      earnCoins(2 * coinMult);
    } else {
      w.level = 5; w.nextReview = Date.now() + 7 * 24 * 3600000; 
      // 满星给暴击金币
      earnCoins(10 * coinMult);
    }
  } else {
    // 答错
    if (action === 'fuzzy') { 
        w.level = Math.max(1, w.level); 
        // 独角兽特权：错题减免（依然给点安慰金币）
        if(stage.level >= 3) earnCoins(1); 
    } else { w.level = 0; }
    queue.push(idx); // 错题不过夜！
  }

  saveW(); qi++; setTimeout(showCard, 100);
}

function earnCoins(amount) {
    player.coins += amount;
    saveP();
    renderPet(); // 刷新顶部的金币显示
    
    // 飞金币动画
    const coinEl = document.createElement('div');
    coinEl.textContent = `+${amount}💰`;
    coinEl.style.position = 'absolute'; coinEl.style.left = '50%'; coinEl.style.top = '40%';
    coinEl.style.transform = 'translate(-50%, -50%)'; coinEl.style.color = '#eab308';
    coinEl.style.fontWeight = '900'; coinEl.style.fontSize = '2rem';
    coinEl.style.textShadow = '0 2px 4px rgba(0,0,0,0.2)'; coinEl.style.zIndex = '99';
    coinEl.style.animation = 'flyup 0.8s ease-out forwards';
    document.body.appendChild(coinEl);
    setTimeout(() => coinEl.remove(), 800);
}

/* ═══════════════════════════════════════════════
   7. 🔥 连胜全勤发薪系统 (核心阶梯算法)
   ═══════════════════════════════════════════════ */
async function processDailyCheckIn() {
    const todayStr = new Date().toDateString();
    if (player.lastCheckIn === todayStr) return;

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (player.lastCheckIn === yesterday) { player.streak = (player.streak || 0) + 1; } 
    else { player.streak = 1; }
    
    player.lastCheckIn = todayStr;
    
    // 阶梯打卡发薪！
    let bonus = 10;
    if(player.streak === 2) bonus = 30;
    if(player.streak >= 3) {
        bonus = player.ownsCrown ? 80 : 50; // 👑 理财印钞机特权
    }
    
    player.coins += bonus;
    saveP(); renderPet();

    setTimeout(() => {
        let msg = `<span class="text-3xl">🔥</span> 连胜 <b>${player.streak}</b> 天！<br><br>获得全勤奖：<b class="text-yellow-600">+${bonus} 金币</b>！`;
        if(player.streak < 3) msg += `<br><br><span class="text-xs text-slate-500">明天继续来，全勤奖会越来越高哦！</span>`;
        else if(player.ownsCrown) msg += `<br><br><span class="text-xs text-rose-500">👑 皇冠理财理财印钞机已生效！</span>`;
        Dialog.alert(msg);
    }, 1500);
}

/* ═══════════════════════════════════════════════
   8. 🛒 杂货铺买卖逻辑与喂食进化
   ═══════════════════════════════════════════════ */
const SHOP_ITEMS = [
    { id: 'f1', type: 'food', icon: '🍪', name: '怪兽小饼干', desc: '+20 饱食 (用于升级)', price: 10, val: 20 },
    { id: 'f2', type: 'food', icon: '🍎', name: '魔法红苹果', desc: '+60 饱食 (用于升级)', price: 25, val: 60 },
    { id: 'o1', type: 'o2o',  icon: '📺', name: '10 分钟动画片', desc: '购买后展示给爸妈核销', price: 80 },
    { id: 'o2', type: 'o2o',  icon: '⭐', name: '1 颗家庭积分星', desc: '可兑换现实大玩具！', price: 100 },
    { id: 'c1', type: 'crown',icon: '👑', name: '国王皇冠 (特权)', desc: '永久印钞机！全勤奖飙升到 80！', price: 800 }
];

function openShop() {
    document.getElementById('shopCoinDisplay').textContent = player.coins;
    const list = document.getElementById('shopRenderArea');
    list.innerHTML = '';
    
    SHOP_ITEMS.forEach(it => {
        // 如果买了王冠，就隐藏王冠
        if(it.type === 'crown' && player.ownsCrown) return;
        
        const canBuy = player.coins >= it.price;
        const btnCls = canBuy ? 'buy-btn' : 'buy-btn opacity-50 cursor-not-allowed';
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="text-3xl">${it.icon}</div>
                <div>
                    <div class="font-bold text-slate-800">${it.name}</div>
                    <div class="text-xs text-slate-500">${it.desc}</div>
                </div>
            </div>
            <button class="${btnCls}" ${canBuy ? `onclick="buyItem('${it.id}')"` : 'disabled'}>${it.price} 币</button>
        `;
        list.appendChild(div);
    });
    
    document.getElementById('shopOv').classList.add('open');
}

function closeShop() { document.getElementById('shopOv').classList.remove('open'); }

async function buyItem(id) {
    const item = SHOP_ITEMS.find(x => x.id === id);
    if(player.coins < item.price) return;
    
    // 喂食逻辑
    if(item.type === 'food') {
        if(player.fullness >= FULLNESS_CAP) {
            await Dialog.alert("✋ 怪兽的肚子圆滚滚啦！<br>今天吃不下了，明天再喂吧！<br><br><span class='text-xs text-slate-500'>(是时候把剩下的钱存起来，兑换积分或买皇冠啦！)</span>");
            return;
        }
        
        let oldStage = getPetStage();
        
        // 扣钱加饱食度
        player.coins -= item.price;
        let actualEat = Math.min(item.val, FULLNESS_CAP - player.fullness);
        player.fullness += actualEat;
        player.totalFed += actualEat; // 永久累计，用于进化
        saveP(); renderPet();
        
        // 吃饭动画
        closeShop();
        const foodEl = document.createElement('div');
        foodEl.textContent = item.icon;
        foodEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:5rem;z-index:999;animation:dropFade 1s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275);';
        document.body.appendChild(foodEl);
        
        let newStage = getPetStage();
        setTimeout(async () => {
            foodEl.remove();
            if(newStage.level > oldStage.level) {
                // 触发进化事件！
                document.getElementById('lutIco').textContent = newStage.ico;
                document.getElementById('lutTtl').textContent = newStage.text + ' 降临！';
                document.getElementById('lutSub').textContent = newStage.sub;
                document.getElementById('lut').classList.add('show');
                try { confetti({particleCount:80, spread:100, origin:{y:.5}, colors:['#FFB3C6','#C8B6FF','#BBD0FF','#FFEAA7']}); } catch(e){}
            } else {
                await Dialog.show(`😋 吃的好饱！<br>怪兽开心极了！<br>当前总喂食进度: ${player.totalFed}`, 'alert');
            }
        }, 1100);
    }
    
    // O2O 核销逻辑
    else if(item.type === 'o2o') {
        const confirm = await Dialog.confirm(`⚠️ 准备兑换【${item.name}】？<br><br>买了之后这笔钱就没了！<b>请务必和爸爸妈妈一起确认兑换！</b>`);
        if(confirm) {
            player.coins -= item.price; saveP(); renderPet(); closeShop();
            try { confetti({particleCount:150, zIndex: 9999, spread:120, origin:{y:.5}}); } catch(e){}
            await Dialog.alert(`<span class="text-4xl block mb-4 mt-2">🎉 兑换成功！</span><br><b class="text-rose-600 text-xl">请马上向爸爸妈妈展示此画面！</b><br><br>【已核销商品】：${item.name}`);
        }
    }
    
    // 皇冠逻辑
    else if(item.type === 'crown') {
        const confirm = await Dialog.confirm(`👑 是否花费天价 800 币购买皇冠？<br><br>以后打卡全勤每天暴涨至 80 币！`);
        if(confirm) {
            player.coins -= item.price; player.ownsCrown = true; saveP(); renderPet(); closeShop();
            try { confetti({particleCount:200, zIndex: 9999, spread:160, origin:{y:.5}}); } catch(e){}
            await Dialog.alert(`👑👑👑<br>财富自由！<br>已为您的小怪兽戴上皇冠！你是个理财大师！`);
        }
    }
}

// 全局浮动动画定义
const keyf = document.createElement('style');
keyf.innerHTML = `@keyframes flyup { 0%{opacity:1; transform:translate(-50%,-50%) scale(1);} 100%{opacity:0; transform:translate(-50%,-150%) scale(1.5);} } @keyframes dropFade { 0%{opacity:0;transform:translate(-50%,-100vh) scale(0.5)} 30%{opacity:1;transform:translate(-50%,-50%) scale(1.2)} 70%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%, -50%) scale(0)} }`;
document.head.appendChild(keyf);

/* ═══════════════════════════════════════════════
   9. 🎨 界面渲染系统
   ═══════════════════════════════════════════════ */
function renderPet() {
  const st = getPetStage();
  document.getElementById('petIco').textContent  = st.ico;
  document.getElementById('petName').textContent = `${st.text} (连胜 ${player.streak || 0})`;
  
  // 饱食度条
  const fullPct = Math.min((player.fullness / FULLNESS_CAP) * 100, 100);
  document.getElementById('fullnessBar').style.width = fullPct + '%';
  document.getElementById('fullnessTxt').textContent = `${player.fullness} / ${FULLNESS_CAP} 饱食度`;
  
  // 金币与皇冠
  document.getElementById('coinAmo').textContent = player.coins;
  document.getElementById('shopCoinDisplay').textContent = player.coins;
  document.getElementById('petCrown').style.display = player.ownsCrown ? 'block' : 'none';

  const u = USERS.find(u=>u.uid===currentUid);
  document.getElementById('userBadge').textContent = u.ico+' '+u.name;
}

function renderStats() {
  const bw = words.filter(w => w.bookId === currentBookId);
  const qRem = Math.max(0, queue.length - qi);
  document.getElementById('sTodo').textContent = qRem; 
  document.getElementById('sTotal').textContent = `${player.todayNew || 0}/${player.dailyNew || 10}`;
  document.getElementById('sMast').textContent = bw.filter(w=>w.level>=5).length;
  document.getElementById('curBookLabel').textContent = books.find(b=>b.id===currentBookId)?.name || '默认词库';
}

function renderDots() {
  const el=document.getElementById('dots'), n=queue.length; const show=Math.min(n,12), s=Math.max(0,Math.min(qi-5,n-show));
  el.innerHTML=''; for(let i=s;i<s+show;i++){ const d=document.createElement('div'); d.className='dot'+(i===qi?' cur':i<qi?' done':''); el.appendChild(d); }
}

function showCard() {
  if (qi >= queue.length) { showDone(); return; }
  const w = words[queue[qi]]; shown = false;
  document.getElementById('wEmo').textContent = w.emoji || '📝'; document.getElementById('wEmo').classList.add('off');       
  document.getElementById('wEn').textContent  = w.english; document.getElementById('wPh').textContent  = getPhonics(w.english);
  document.getElementById('wZh').textContent  = w.chinese; document.getElementById('wZh').classList.add('off');        
  document.getElementById('hint').style.opacity = '1'; document.getElementById('lvBadge').textContent= 'Lv.'+w.level;
  document.getElementById('acts').removeAttribute('hidden'); document.getElementById('sndBtn').style.display='flex';
  
  renderDots(); renderStats();
  const c=document.getElementById('card'); c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  setTimeout(async () => { await autoSpeak(w.english); }, 350);
}

function showDone() {
  document.getElementById('wEmo').textContent  = '🏆'; document.getElementById('wEmo').classList.remove('off');
  document.getElementById('wEn').textContent   = '太棒啦！'; document.getElementById('wPh').textContent   = '';
  document.getElementById('wZh').textContent   = '快去杂货铺买点东西喂怪兽吧！'; document.getElementById('wZh').classList.remove('off');
  document.getElementById('hint').style.opacity= '0'; document.getElementById('lvBadge').textContent='✨';
  document.getElementById('acts').setAttribute('hidden',''); document.getElementById('sndBtn').style.display='none';
  document.getElementById('dots').innerHTML=''; renderStats();
  
  const c=document.getElementById('card'); c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  setTimeout(fireworks, 420);
  
  processDailyCheckIn(); // 触发神圣的发薪仪式
}

function cardTap() {
  if (qi >= queue.length) return; shown=!shown;
  document.getElementById('wEmo').classList.toggle('off',!shown); document.getElementById('wZh').classList.toggle('off',!shown); document.getElementById('hint').style.opacity=shown?'0':'1';
  if (shown) {
    const w = words[queue[qi]];
    if (w && w.chinese && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(w.chinese);
      const voices = window.speechSynthesis.getVoices(); let zhV = voices.find(v => v.lang.includes('zh'));
      if (zhV) u.voice = zhV; else u.lang = 'zh-CN'; u.rate = 0.9; window.speechSynthesis.speak(u);
    }
  }
}
function prevWord(e) { e.stopPropagation(); if (qi > 0) { qi--; showCard(); } }

function fireworks() {
  const cols=['#FFB3C6','#C8B6FF','#BBD0FF','#B5EAD7','#FFEAA7','#FFCBA4']; const end=Date.now()+3200;
  (function burst(){ try{ confetti({particleCount:5,angle:58, spread:54,origin:{x:0},colors:cols}); confetti({particleCount:5,angle:122,spread:54,origin:{x:1},colors:cols}); }catch(e){}
    if(Date.now()<end) requestAnimationFrame(burst); })();
}

async function autoSpeak(word) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${ttsAccent}`;
  try { const audio = new Audio(url); await audio.play(); } 
  catch(err) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(word); u.lang='en-US'; u.rate=0.82; u.pitch=1.25; window.speechSynthesis.speak(u); } }
}
async function speak(e) { e.stopPropagation(); if (qi >= queue.length) return; await autoSpeak(words[queue[qi]].english); }

/* ═══════════════════════════════════════════════
   10. ⚙️ 家长控制中心 (保持不动)
   ═══════════════════════════════════════════════ */
function openGear() { renderUserCards(); renderBookTabs(); refreshList(); document.getElementById('ta').value=''; document.getElementById('mmsg').innerHTML=''; document.getElementById('ov').classList.add('open'); }
function closeOv() { document.getElementById('ov').classList.remove('open'); }
function ovClick(e) { if(e.target.id==='ov') closeOv(); }

async function setDailyPlan(type) {
    const isNew = type === 'new'; const t = isNew ? '🎯 每日新词限额：(建议5-15)' : '🔄 每日复习上限：(建议15-30)';
    const cur = isNew ? (player.dailyNew || 10) : (player.dailyRev || 30);
    let num = await Dialog.prompt(t, cur); if(num === null || num.trim()==='') return; num = parseInt(num); if(isNaN(num) || num < 1) { await Dialog.alert('❌ 无效数字！'); return; }
    if(isNew) player.dailyNew = num; else player.dailyRev = num;
    saveP(); renderUserCards();
    if(await Dialog.confirm('✅ 计划已保存！立刻重组今天的卡片队伍？')) { queue = buildQueue(true); qi = 0; showCard(); }
}

function renderUserCards() {
  document.getElementById('userCards').innerHTML = USERS.map(u => {
    const ps = localStorage.getItem(pKey(u.uid)); const pObj = ps ? JSON.parse(ps) : {dailyNew:10, dailyRev:30, streak:0, coins:0}; const isMe = u.uid === currentUid;
    return `
    <div class="uc${isMe?' active-uc':''}" style="background:white;padding:12px;border-radius:12px;border:1px solid #e2e8f0;">
      <div class="flex justify-between border-b pb-2 mb-2"><strong class="text-lg">${u.ico} ${u.name}</strong> ${isMe?'<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">当前</span>':''}</div>
      <div class="text-sm space-y-1 mb-3 text-slate-600">
        <div>🔥 连胜：<b class="text-rose-500">${pObj.streak||0} 天</b> | 💰 金币：<b class="text-amber-500">${pObj.coins||0}</b></div>
        <div class="flex gap-2">
            <button class="bg-slate-100 text-slate-700 px-2 py-1 rounded shadow-sm text-xs" onclick="setDailyPlan('new')">🎯新词:${pObj.dailyNew||10} ✎</button>
            <button class="bg-slate-100 text-slate-700 px-2 py-1 rounded shadow-sm text-xs" onclick="setDailyPlan('rev')">🔄复习:${pObj.dailyRev||30} ✎</button>
        </div>
      </div>
      <div class="flex gap-2">
        ${!isMe ? `<button class="flex-1 bg-indigo-600 text-white font-bold py-1.5 rounded text-sm shadow" onclick="switchUser('${u.uid}')">🔄 切换</button>` : ''}
        <button class="flex-1 bg-rose-100 text-rose-700 font-bold py-1.5 rounded text-sm shadow-sm" onclick="clearUserStep1('${u.uid}','${u.name}')">🗑️ 清除记录</button>
      </div>
    </div>`;
  }).join('');
}

function switchUser(uid) { loadBooks(); loadUser(uid); queue=buildQueue(); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); renderUserCards(); refreshList(); }

async function clearUserStep1(uid, name) {
  if (!(await Dialog.confirm(`确定清除【${name}】的记录？金币、背包和进度将全毁。`))) return;
  const t = await Dialog.prompt(`输入「${name}」确认：`); if (t !== name) { await Dialog.alert('❌ 输入错误'); return; }
  const ws = localStorage.getItem(wKey(uid)); if (ws) { const wd = JSON.parse(ws); wd.forEach(w => { w.level = 0; w.nextReview = Date.now(); }); localStorage.setItem(wKey(uid), JSON.stringify(wd)); }
  localStorage.removeItem(pKey(uid)); loadBooks();
  if (uid === currentUid) { loadUser(uid); queue=buildQueue(true); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); }
  renderUserCards(); refreshList(); await Dialog.alert(`✅ 已彻底清空！`);
}

function refreshList() {
  const cb = books.find(b=>b.id===currentBookId); const bw = words.filter(w => w.bookId === currentBookId);
  document.getElementById('wcnt').textContent = bw.length; document.getElementById('wcntBook').textContent = cb ? cb.name : '默认';
  document.getElementById('wlist').innerHTML = bw.map(w => `<div class="wi"><span class="we">${w.emoji||'📝'}</span><span class="wn">${w.english}</span><span class="wz">${w.chinese}</span><span class="ws">${'⭐'.repeat(Math.min(w.level,5))}</span><button class="we-btn" onclick="editWord('${w.id}')">改</button><button class="wd" onclick="deleteWord('${w.id}')">删</button></div>`).join('');
}

async function editWord(id) {
  const w = words.find(w => w.id === id); if (!w) return;
  const ne = await Dialog.prompt('英文：', w.english); if (ne === null) return;
  const nz = await Dialog.prompt('中文：', w.chinese); if (nz === null) return;
  const nEmo = await Dialog.prompt('Emoji：', w.emoji); if (nEmo === null) return;
  const en = ne.trim() || w.english, zh = nz.trim() || w.chinese, emo = nEmo.trim() || autoEmoji(en);
  USERS.forEach(u => { const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return; const arr = JSON.parse(ws); const idx = arr.findIndex(x => x.id === id); if (idx === -1) return; arr[idx].english = en; arr[idx].chinese = zh; arr[idx].emoji = emo; localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if (u.uid === currentUid) words = arr; });
  if (queue[qi] !== undefined && words[queue[qi]]?.id === id) showCard(); refreshList(); renderStats();
}

async function deleteWord(id) {
  if(!(await Dialog.confirm('确定删除吗？'))) return;
  USERS.forEach(u => { const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return; const arr = JSON.parse(ws).filter(w => w.id !== id); localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if (u.uid === currentUid) words = arr; });
  queue = buildQueue(); qi = 0; refreshList(); renderStats(); showCard();
}

function importWords() {
  const raw = document.getElementById('ta').value.trim(); if (!raw) return; let ok=0; const p = [];
  raw.split('\n').forEach(l => { const pp = l.trim().split(/[,，]/); if(pp.length>=2) p.push({ en:pp[0].trim(), zh:pp[1].trim(), emo:pp[2]?.trim()||autoEmoji(pp[0]) }); });
  if (!p.length) return;
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid)); const arr = ws ? JSON.parse(ws) : [];
    p.forEach(({en, zh, emo}) => { const dup = arr.find(w => w.english.toLowerCase()===en.toLowerCase() && w.bookId===currentBookId);
      if (!dup) { arr.push({ id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2), english:en, chinese:zh, emoji:emo, level:0, nextReview:Date.now(), bookId:currentBookId }); if(u.uid===currentUid) ok++; } });
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); if(u.uid===currentUid) words = arr;
  });
  document.getElementById('ta').value = ''; Dialog.alert(`✅ 成功导入 ${ok} 个新词`); refreshList(); queue = buildQueue(); qi = 0; showCard(); renderStats();
}

function renderBookTabs() { document.getElementById('bookTabs').innerHTML = books.map(b => `<button class="bg-slate-100 px-3 py-1 rounded font-bold text-slate-700${b.id===currentBookId?' ring-2 ring-indigo-400':''}" onclick="switchBook('${b.id}')">${b.name} (${words.filter(w=>w.bookId===b.id).length})</button>`).join(''); document.getElementById('curBookLabel').textContent = books.find(b=>b.id===currentBookId)?.name || '默认'; }
function switchBook(id) { currentBookId = id; localStorage.setItem('mw_cbook_'+currentUid, id); queue=buildQueue(); qi=0; renderBookTabs(); refreshList(); renderStats(); showCard(); }
async function createBook() { const n=await Dialog.prompt('新词库名：'); if(!n||!n.trim())return; const id='b_'+Date.now(); books.push({id, name:n.trim()}); saveBooks(); switchBook(id); }
async function renameBook() { const cb=books.find(b=>b.id===currentBookId); if(!cb)return; const n=await Dialog.prompt('重命名：',cb.name); if(n&&n.trim()){cb.name=n.trim(); saveBooks(); renderBookTabs();} }
async function deleteBook() { 
  if(books.length<=1){await Dialog.alert('至少保留1个词库');return;} 
  if(!(await Dialog.confirm('⚠️ 删除词库及所有词？'))) return;
  USERS.forEach(u=>{ const ws=localStorage.getItem(wKey(u.uid)); if(ws){ const arr=JSON.parse(ws).filter(w=>w.bookId!==currentBookId); localStorage.setItem(wKey(u.uid),JSON.stringify(arr)); if(u.uid===currentUid)words=arr; } });
  books=books.filter(b=>b.id!==currentBookId); saveBooks(); currentBookId=books[0].id; localStorage.setItem('mw_cbook_',currentBookId); queue=buildQueue(); qi=0; renderBookTabs(); refreshList(); renderStats(); showCard();
}

/* ═══════════════════════════════════════════════
   11. 初始化启动
   ═══════════════════════════════════════════════ */
const EMOJI = { apple:'🍎',banana:'🍌',cat:'🐱',dog:'🐶',elephant:'🐘',fish:'🐟',giraffe:'🦒',hat:'🎩','ice cream':'🍦',juice:'🧃' };
function autoEmoji(en) { return EMOJI[en.toLowerCase().trim()] || '📝'; }
function getPhonics(en) { return ''; } 

// 新增彩蛋：点怪兽会说话
function petTap() {
    const st = getPetStage();
    const msgs = ['哎呀，点我干嘛！', '想买零食吗？快去背单词吧！', '我有点饿了呢...', '记得每天都要来看看我哦！', '我要长金币了！'];
    if(player.ownsCrown) msgs.push('膜拜吧！理财带师！💰');
    if(st.level >= 4) msgs.push('鲨鱼不发威，当我是咸鱼啊！🦈');
    
    // 简单漂浮字动画
    const m = msgs[Math.floor(Math.random() * msgs.length)];
    const el = document.createElement('div');
    el.textContent = m;
    el.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:white; color:#333; font-weight:bold; padding:10px 20px; border-radius:20px; box-shadow:0 10px 20px rgba(0,0,0,0.1); z-index:9999; animation:flyup 1.5s forwards; font-size:0.9rem;';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1500);
}

function init() {
  loadBooks(); loadUser(currentUid); renderPet();
  document.getElementById('accentBtn').textContent = ttsAccent===2 ? 'US' : 'UK';
  queue=buildQueue(); qi=0; showCard(); renderStats();
}

init();
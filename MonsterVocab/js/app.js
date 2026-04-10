/* ═══════════════════════════════════════════════
   0. 🚨 黑匣子报错系统（拦截一切死机问题）
   ═══════════════════════════════════════════════ */
window.onerror = function(message, source, lineno, colno, error) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; padding:15px; background-color:#ef4444; color:white; font-size:12px; z-index:99999; word-break:break-all; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3);';
    errDiv.innerHTML = `⚠️ <b>系统崩溃拦截：</b><br>${message}<br>请截图反馈！(行: ${lineno})`;
    document.body.appendChild(errDiv);
    // 强行清理一次可能导致崩溃的缓存
    localStorage.removeItem('mw_mic');
};

/* ═══════════════════════════════════════════════
   1. 🧨 PWA 缓存粉碎机 (强行注销旧版保安)
   ═══════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let i = 0; i < registrations.length; i++) { registrations[i].unregister(); }
    }).catch(function(e){ console.log(e); });
}

/* ═══════════════════════════════════════════════
   2. 全局弹窗与核心 CSS 样式 
   ═══════════════════════════════════════════════ */
const Dialog = { 
    show: function(title, type, defaultVal) { 
        if (defaultVal === undefined) defaultVal = '';
        return new Promise(function(resolve) { 
            const m = document.getElementById('sysModal'); const c = document.getElementById('sysModalContent'); 
            const t = document.getElementById('sysModalTitle'); const i = document.getElementById('sysModalInput'); 
            const btnCancel = document.getElementById('sysModalCancel'); const btnConfirm = document.getElementById('sysModalConfirm'); 
            t.innerHTML = title; m.classList.remove('hidden'); m.classList.add('flex'); 
            setTimeout(function() { c.classList.remove('scale-95'); c.classList.add('scale-100'); }, 10); 
            i.classList.add('hidden'); btnCancel.classList.add('hidden'); i.value = defaultVal; 
            if(type === 'prompt') { i.classList.remove('hidden'); btnCancel.classList.remove('hidden'); i.focus(); } 
            else if(type === 'confirm') { btnCancel.classList.remove('hidden'); } 
            const cleanup = function() { m.classList.remove('flex'); m.classList.add('hidden'); c.classList.remove('scale-100'); c.classList.add('scale-95'); btnCancel.onclick = null; btnConfirm.onclick = null; }; 
            btnCancel.onclick = function() { cleanup(); resolve(false); }; 
            btnConfirm.onclick = function() { cleanup(); resolve(type === 'prompt' ? i.value : true); }; 
        }); 
    }, 
    alert: function(title) { return this.show(title, 'alert'); }, 
    confirm: function(title) { return this.show(title, 'confirm'); }, 
    prompt: function(title, def) { return this.show(title, 'prompt', def); } 
};

const keyf = document.createElement('style');
keyf.innerHTML = `
.w-emo.off { opacity: 0 !important; filter: none !important; transform: scale(0.5) !important; pointer-events: none; }
.w-zh.off { opacity: 0 !important; transform: translateY(15px) !important; pointer-events: none; }
.w-emo, .w-zh { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
@keyframes flyup { 0%{opacity:1; transform:translate(-50%,-50%) scale(1);} 100%{opacity:0; transform:translate(-50%,-150%) scale(1.5);} } 
@keyframes dropFade { 0%{opacity:0;transform:translate(-50%,-100vh) scale(0.5)} 30%{opacity:1;transform:translate(-50%,-50%) scale(1.2)} 70%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%, -50%) scale(0)} }
`;
document.head.appendChild(keyf);

/* ═══════════════════════════════════════════════
   3. 维基百科溯源引擎 (向下兼容写法)
   ═══════════════════════════════════════════════ */
const EMOJI = { apple:'🍎',banana:'🍌',cat:'🐱',dog:'🐶',elephant:'🐘',fish:'🐟',tiger:'🐅',lion:'🐅',car:'🚗',bus:'🚌' }; 
function autoEmoji(en) { return EMOJI[en.toLowerCase().trim()] || '📝'; }

async function fetchWikiImage(word) { 
    try { 
        const queryWord = encodeURIComponent(word.trim().toLowerCase()); 
        const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${queryWord}&prop=pageimages&format=json&pithumbsize=400&origin=*`); 
        const data = await res.json(); 
        if(data && data.query && data.query.pages) {
            const pages = data.query.pages; 
            const pageId = Object.keys(pages)[0]; 
            if (pageId !== '-1' && pages[pageId] && pages[pageId].thumbnail) { 
                return pages[pageId].thumbnail.source; 
            } 
        }
    } catch(e) { console.warn('维基获取失败:', e); } 
    return null; 
}

/* ═══════════════════════════════════════════════
   4. 核心系统与储存引擎 (全面移除 ?. 可选链语法)
   ═══════════════════════════════════════════════ */
// 安全的数据解析
function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch (e) { return fallback; }
}

let ttsAccent = parseInt(localStorage.getItem('mw_accent') || '2'); 
function toggleAccent() { ttsAccent = ttsAccent === 2 ? 1 : 2; localStorage.setItem('mw_accent', ttsAccent); document.getElementById('accentBtn').textContent = ttsAccent === 2 ? 'US' : 'UK'; }

const PET_STAGES = [ { level: 1, text: 'Lv.1 魔法神蛋', ico: '🥚', sub: '刚出生，急需营养～', threshold: 0 }, { level: 2, text: 'Lv.2 贪吃小恐龙', ico: '🦖', sub: '破壳啦！解锁商店装备！', threshold: 50 }, { level: 3, text: 'Lv.3 快乐独角兽', ico: '🦄', sub: '神奇魔法觉醒！', threshold: 3000 }, { level: 4, text: 'Lv.4 巡洋大头鲨', ico: '🦈', sub: '大富翁！金币收益翻倍！', threshold: 8000 }, { level: 5, text: 'Lv.5 许愿神龙', ico: '🐉', sub: '巅峰连胜！去找爸妈许愿！', threshold: 25000 } ]; 
const FULLNESS_CAP = 300; 

let USERS = []; 
function loadUsersData() { 
    const raw = localStorage.getItem('mw_users_v2'); 
    USERS = safeParseJSON(raw, null);
    if(!USERS || !USERS.length) { 
        USERS = [ { uid:'u1', name:'大宝', ico:'👦' }, { uid:'u2', name:'二宝', ico:'👧' } ]; 
        saveUsersData(); 
    } 
} 
function saveUsersData() { localStorage.setItem('mw_users_v2', JSON.stringify(USERS)); }

let currentUid = localStorage.getItem('mw_cur') || 'u1'; 
function wKey(uid) { return 'mw_w_'+uid; } 
function pKey(uid) { return 'mw_p_'+uid; }
let words = []; let player = {}; let books = []; let currentBookId = 'default'; let queue = []; let qi = 0; let shown = false;

const saveW = function() { localStorage.setItem(wKey(currentUid), JSON.stringify(words)); };
const saveP = function() { localStorage.setItem(pKey(currentUid), JSON.stringify(player)); };
const saveBooks = function() { localStorage.setItem('mw_books', JSON.stringify(books)); };

function loadBooks() { 
    books = safeParseJSON(localStorage.getItem('mw_books'), [{id:'default', name:'默认词库'}]);
    let hasDefault = false;
    for(let i=0; i<books.length; i++) { if(books[i].id === 'default') hasDefault = true; }
    if (!hasDefault) books.unshift({id:'default', name:'默认词库'});
}

function loadUser(uid) { 
    currentUid = uid; localStorage.setItem('mw_cur', uid); 
    const ws = localStorage.getItem(wKey(uid)); 
    if (ws) { 
        words = safeParseJSON(ws, []); 
        words.forEach(function(w) { if (!w.bookId) w.bookId='default'; }); 
        saveW(); 
    } else { 
        words = []; saveW(); 
    } 
    const ps = localStorage.getItem(pKey(uid)); 
    player = safeParseJSON(ps, {}); 
    if(player.dailyNew===undefined) player.dailyNew = 10; 
    if(player.dailyRev===undefined) player.dailyRev = 30; 
    if(player.streak===undefined) player.streak = 0; 
    if(player.coins===undefined) player.coins = 0; 
    if(player.fullness===undefined) player.fullness = 0; 
    if(player.totalFed===undefined) player.totalFed = 0; 
    if(player.quizMode===undefined) player.quizMode = 'en2zh'; 
    currentBookId = localStorage.getItem('mw_cbook_'+uid) || 'default'; 
}

function buildQueue(forceRebuild) { 
    const now = Date.now(); const today = new Date().toDateString(); 
    if (player.lastDate !== today || forceRebuild) { 
        if (player.lastDate !== today) { player.todayNew = 0; player.todayRev = 0; player.fullness = 0; } 
        player.lastDate = today; saveP(); 
    } 
    let candNew = []; let candRev = []; 
    words.forEach(function(w, i) { 
        if (w.bookId === currentBookId && (w.nextReview || 0) <= now) { 
            if (w.level === 0) candNew.push(i); else candRev.push(i); 
        } 
    }); 
    candNew.sort(function() { return Math.random() - 0.5; }); 
    candRev.sort(function() { return Math.random() - 0.5; }); 
    const finalNew = candNew.slice(0, Math.max(0, (player.dailyNew || 10) - (player.todayNew || 0)));
    const finalRev = candRev.slice(0, Math.max(0, (player.dailyRev || 30) - (player.todayRev || 0)));
    return finalNew.concat(finalRev).sort(function() { return Math.random() - 0.5; }); 
}
function interval(lvl) { 
    if (lvl === 1) return 12 * 3600000; 
    if (lvl === 2) return 24 * 3600000; 
    if (lvl === 3) return 2 * 24 * 3600000; 
    if (lvl === 4) return 4 * 24 * 3600000; 
    return 7 * 24 * 3600000; 
}

/* ═══════════════════════════════════════════════
   5. 💰 金库、打卡、杂货铺逻辑 
   ═══════════════════════════════════════════════ */
function getPetStage() { let cs = PET_STAGES[0]; for(let i = 0; i < PET_STAGES.length; i++) { if(player.totalFed >= PET_STAGES[i].threshold) cs = PET_STAGES[i]; } return cs; }

function act(action) { 
    if (qi >= queue.length) return; 
    const idx = queue[qi]; const w = words[idx]; const isNewWord = (w.level === 0); const stage = getPetStage(); const coinMult = (stage.level >= 4) ? 2 : 1; 
    if (action === 'know' || action === 'master') { 
        if (isNewWord) player.todayNew = (player.todayNew || 0) + 1; else player.todayRev = (player.todayRev || 0) + 1; 
        if (action === 'know') { w.level = Math.max(1, w.level + 1); w.nextReview = Date.now() + interval(w.level); earnCoins(2 * coinMult); } 
        else { w.level = 5; w.nextReview = Date.now() + 7 * 24 * 3600000; earnCoins(10 * coinMult); } 
    } else { 
        if (action === 'fuzzy') { w.level = Math.max(1, w.level); if(stage.level >= 3) earnCoins(1); } else { w.level = 0; } 
        queue.push(idx); 
    } 
    saveW(); qi++; setTimeout(showCard, 100); 
}

function earnCoins(amount) { 
    player.coins += amount; saveP(); renderPet(); 
    const el = document.createElement('div'); el.textContent = `+${amount}💰`; 
    el.style.cssText = 'position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);color:#eab308;font-weight:900;font-size:2rem;text-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:99;animation:flyup 0.8s ease-out forwards;pointer-events:none;'; 
    document.body.appendChild(el); setTimeout(function() { el.remove(); }, 800); 
}

async function processDailyCheckIn() { 
    const todayStr = new Date().toDateString(); 
    if (player.lastCheckIn === todayStr) return; 
    const yesterday = new Date(Date.now() - 86400000).toDateString(); 
    if (player.lastCheckIn === yesterday) { player.streak = (player.streak || 0) + 1; } else { player.streak = 1; } 
    player.lastCheckIn = todayStr; let bonus = 10; 
    if(player.streak === 2) bonus = 30; if(player.streak >= 3) bonus = player.ownsCrown ? 80 : 50; 
    player.coins += bonus; saveP(); renderPet(); 
    setTimeout(function() { Dialog.alert(`<span class="text-3xl">🔥</span> 连胜 <b>${player.streak}</b> 天！<br><br>获得：<b class="text-yellow-600">+${bonus} 金币</b>！<br><span class="text-xs text-slate-500">${player.ownsCrown ? '👑 皇家特权生效' : ''}</span>`); }, 1500); 
}

const SHOP_ITEMS = [ { id: 'f1', type: 'food', icon: '🍪', name: '怪兽小饼干', desc: '充饥变大', price: 10, val: 20 }, { id: 'f2', type: 'food', icon: '🍎', name: '魔法红苹果', desc: '大量充饥', price: 25, val: 60 }, { id: 'o1', type: 'o2o',  icon: '📺', name: '10 分钟动画片', desc: '兑现实特权', price: 80 }, { id: 'o2', type: 'o2o',  icon: '⭐', name: '家庭积分星', desc: '换实物大奖', price: 100 }, { id: 'c1', type: 'crown',icon: '👑', name: '永久国王皇冠', desc: '全勤暴增神装', price: 800 } ];

function openShop() { 
    document.getElementById('shopCoinDisplay').textContent = player.coins; 
    const list = document.getElementById('shopRenderArea'); list.innerHTML = ''; 
    SHOP_ITEMS.forEach(function(it) { 
        if(it.type === 'crown' && player.ownsCrown) return; 
        const canBuy = player.coins >= it.price; const div = document.createElement('div'); div.className = 'shop-item'; 
        div.innerHTML = `<div class="flex items-center gap-3"><div class="text-3xl">${it.icon}</div><div><div class="font-bold text-slate-800">${it.name}</div><div class="text-xs text-slate-500">${it.desc}</div></div></div><button class="buy-btn ${canBuy?'':'opacity-50 cursor-not-allowed'}" ${canBuy ? `onclick="buyItem('${it.id}')"` : 'disabled'}>${it.price} 币</button>`; 
        list.appendChild(div); 
    }); 
    document.getElementById('shopOv').classList.add('open'); 
}

function closeShop() { document.getElementById('shopOv').classList.remove('open'); }

async function buyItem(id) { 
    // 下面不再使用高级箭头函数查找，改为基础循环寻找确保老平板不崩溃
    let item = null;
    for(let i=0; i<SHOP_ITEMS.length; i++) { if(SHOP_ITEMS[i].id === id) item = SHOP_ITEMS[i]; }
    if(!item || player.coins < item.price) return; 
    
    if(item.type === 'food') { 
        if(player.fullness >= FULLNESS_CAP) { await Dialog.alert("✋ 肚子圆滚滚啦，吃不下啦！"); return; } 
        let oS = getPetStage(); player.coins -= item.price; let eat = Math.min(item.val, FULLNESS_CAP - player.fullness); player.fullness += eat; player.totalFed += eat; saveP(); renderPet(); closeShop(); 
        const fEl = document.createElement('div'); fEl.textContent = item.icon; fEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:5rem;z-index:999;animation:dropFade 1s forwards cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events:none;'; document.body.appendChild(fEl); 
        let nS = getPetStage(); 
        setTimeout(async function() { 
            fEl.remove(); 
            if(nS.level > oS.level) { 
                document.getElementById('lutIco').textContent = nS.ico; document.getElementById('lutTtl').textContent = nS.text + ' 降临！'; document.getElementById('lutSub').textContent = nS.sub; document.getElementById('lut').classList.add('show'); 
                try { confetti({particleCount:80, spread:100, origin:{y:.5}, colors:['#FFB3C6','#C8B6FF','#BBD0FF','#FFEAA7']}); } catch(e){} 
            } else { await Dialog.show(`😋 吃饱了！<br>当前总重: ${player.totalFed}`, 'alert'); } 
        }, 1100); 
    } else if(item.type === 'o2o') { 
        if(await Dialog.confirm(`⚠️ 消 ${item.price} 金币兑换【${item.name}】？`)) { 
            player.coins -= item.price; saveP(); renderPet(); closeShop(); 
            try { confetti({particleCount:150, zIndex: 9999, spread:120, origin:{y:.5}}); } catch(e){} 
            await Dialog.alert(`<span class="text-4xl block mb-4 mt-2">🎉 兑换成功！</span><br><b class="text-rose-600 outline px-2 shadow">请向爸妈展示本界面核销！</b><br><br>【${item.name}】`); 
        } 
    } else if(item.type === 'crown') { 
        if(await Dialog.confirm(`👑 800币购买皇冠发财机？`)) { 
            player.coins -= item.price; player.ownsCrown = true; saveP(); renderPet(); closeShop(); 
            try { confetti({particleCount:200, zIndex: 9999, spread:160, origin:{y:.5}}); } catch(e){} 
            await Dialog.alert(`👑👑👑<br>王登基了！`); 
        } 
    } 
}

/* ═══════════════════════════════════════════════
   6. 🔊 纯净原生发音引擎
   ═══════════════════════════════════════════════ */
function getPhonics(en) { return ''; } 
async function autoSpeakEn(text) { return new Promise(function(r) { const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${ttsAccent}`; try { const a = new Audio(url); a.onended=r; a.onerror=r; a.play().catch(r); } catch(err) { r(); } setTimeout(r, 1500); }); }
async function autoSpeakZh(text) { return new Promise(function(r) { const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`; try { const a = new Audio(url); a.onended=r; a.onerror=r; a.play().catch(r); } catch(err) { r(); } setTimeout(r, 1500); }); }
async function speak(e) { e.stopPropagation(); if (qi >= queue.length) return; const w = words[queue[qi]]; if(player.quizMode === 'zh2en') { if(!shown) await autoSpeakZh(w.chinese); else await autoSpeakEn(w.english); } else { if(!shown) await autoSpeakEn(w.english); else await autoSpeakZh(w.chinese); } }

/* ═══════════════════════════════════════════════
   7. 🎨 视图渲染主控：完全去除废弃权限逻辑
   ═══════════════════════════════════════════════ */
function renderPet() { 
    const st = getPetStage(); document.getElementById('petIco').textContent = st.ico; 
    document.getElementById('petName').textContent = `${st.text} (连胜 ${player.streak || 0})`; 
    document.getElementById('fullnessBar').style.width = Math.min((player.fullness / FULLNESS_CAP) * 100, 100) + '%'; 
    document.getElementById('fullnessTxt').textContent = `${player.fullness} / ${FULLNESS_CAP} 饱食度`; 
    document.getElementById('coinAmo').textContent = player.coins; 
    if(document.getElementById('shopCoinDisplay')) document.getElementById('shopCoinDisplay').textContent = player.coins; 
    document.getElementById('petCrown').style.display = player.ownsCrown ? 'block' : 'none'; 
    let u = null; for(let i=0; i<USERS.length; i++) { if(USERS[i].uid === currentUid) u = USERS[i];}
    if(u) { document.getElementById('userBadge').textContent = u.ico+' '+u.name; }
}

function renderStats() { 
    let bwCounter = 0; let masterCounter = 0;
    for(let i=0; i<words.length; i++) { 
        if(words[i].bookId === currentBookId) {
            bwCounter++; 
            if(words[i].level >= 5) masterCounter++;
        }
    }
    const qRem = Math.max(0, queue.length - qi); 
    document.getElementById('sTodo').textContent = qRem; 
    document.getElementById('sTotal').textContent = `${player.todayNew || 0}/${player.dailyNew || 10}`; 
    document.getElementById('sMast').textContent = masterCounter; 
    
    let curBookName = '默认词库';
    for(let i=0; i<books.length; i++) { if(books[i].id === currentBookId) curBookName = books[i].name; }
    document.getElementById('curBookLabel').textContent = curBookName; 
}

function renderDots() { 
    const el=document.getElementById('dots'), n=queue.length; 
    const show=Math.min(n,12), s=Math.max(0,Math.min(qi-5,n-show)); 
    el.innerHTML=''; 
    for(let i=s;i<s+show;i++){ 
        const d=document.createElement('div'); d.className='dot'+(i===qi?' cur':i<qi?' done':''); 
        el.appendChild(d); 
    } 
}

function showCard() {
  if (qi >= queue.length) { showDone(); return; }
  const w = words[queue[qi]]; shown = false;
  
  const wEmo = document.getElementById('wEmo'); const wEn = document.getElementById('wEn'); 
  const wPh = document.getElementById('wPh'); const wZh = document.getElementById('wZh');
  
  if (w.emoji && w.emoji.indexOf('http') === 0) { 
      wEmo.innerHTML = `<img src="${w.emoji}" class="w-32 h-32 md:w-40 md:h-40 rounded-[28px] object-cover border-4 border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.15)] mx-auto">`; 
  } else { 
      wEmo.innerHTML = `<span style="font-size: 5rem;">${w.emoji || '📝'}</span>`; 
  }
  
  wEn.textContent = w.english; wPh.textContent = getPhonics(w.english); wZh.textContent = w.chinese;
  document.getElementById('lvBadge').textContent= 'Lv.'+w.level; 
  document.getElementById('acts').removeAttribute('hidden'); 
  document.getElementById('sndBtn').style.display='flex';
  
  const hintContainer = document.getElementById('hint');
  hintContainer.innerHTML = '<span class="text-slate-400 font-bold text-sm tracking-wide">👆 点击卡片翻看答案</span>';
  hintContainer.style.opacity = '1';

  if (player.quizMode === 'zh2en') {
      wEmo.classList.remove('off'); wZh.classList.remove('off'); 
      wEn.style.opacity = '0'; wEn.style.transform = 'translateY(10px)'; wPh.style.opacity = '0';
      autoSpeakZh(w.chinese);
  } else {
      wEn.style.opacity = '1'; wEn.style.transform = 'translateY(0)'; wPh.style.opacity = '1'; 
      wEmo.classList.add('off'); wZh.classList.add('off'); 
      autoSpeakEn(w.english);
  }
  
  renderDots(); renderStats(); 
  const c=document.getElementById('card'); c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
}

function cardTap() {
  if (qi >= queue.length) return; shown = !shown;
  
  const w = words[queue[qi]]; 
  const wEmo = document.getElementById('wEmo'); const wEn = document.getElementById('wEn'); 
  const wPh = document.getElementById('wPh'); const wZh = document.getElementById('wZh');
  document.getElementById('hint').style.opacity = shown ? '0' : '1';

  if (player.quizMode === 'zh2en') {
      wEn.style.opacity = shown ? '1' : '0'; wEn.style.transform = shown ? 'translateY(0)' : 'translateY(10px)'; 
      wPh.style.opacity = shown ? '1' : '0';
      if (shown) autoSpeakEn(w.english);
  } else {
      if(shown) { wEmo.classList.remove('off'); wZh.classList.remove('off'); } 
      else { wEmo.classList.add('off'); wZh.classList.add('off'); }
      if (shown) autoSpeakZh(w.chinese);
  }
}

function prevWord(e) { e.stopPropagation(); if (qi > 0) { qi--; showCard(); } }

function showDone() { 
    document.getElementById('wEmo').innerHTML='<span style="font-size: 5rem;">🏆</span>'; 
    document.getElementById('wEmo').classList.remove('off'); document.getElementById('wEn').textContent='太棒啦！'; 
    document.getElementById('wPh').textContent=''; document.getElementById('wZh').textContent='快去给小怪兽买点零食！'; 
    document.getElementById('wZh').classList.remove('off'); document.getElementById('hint').style.opacity= '0'; 
    document.getElementById('lvBadge').textContent='✨'; document.getElementById('wEn').style.opacity = '1'; 
    document.getElementById('wEn').style.transform = 'translateY(0)'; document.getElementById('acts').setAttribute('hidden',''); 
    document.getElementById('sndBtn').style.display='none'; document.getElementById('dots').innerHTML=''; 
    renderStats(); const c=document.getElementById('card'); c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin'); 
    setTimeout(fireworks, 420); processDailyCheckIn(); 
}

function fireworks() { 
    const cols=['#FFB3C6','#C8B6FF','#BBD0FF','#B5EAD7','#FFEAA7','#FFCBA4']; const end=Date.now()+3200; 
    (function burst(){ try{ confetti({particleCount:5,angle:58, spread:54,origin:{x:0},colors:cols}); confetti({particleCount:5,angle:122,spread:54,origin:{x:1},colors:cols}); }catch(e){} if(Date.now()<end) requestAnimationFrame(burst); })(); 
}

/* ═══════════════════════════════════════════════
   8. ⚙️ 家长后勤系统 (支持纯净词库管理，无 ?. 语法)
   ═══════════════════════════════════════════════ */
function openGear() { renderUserCards(); renderBookTabs(); refreshList(); document.getElementById('ov').classList.add('open'); } 
function closeOv() { document.getElementById('ov').classList.remove('open'); } 
function ovClick(e) { if(e.target.id==='ov') closeOv(); }

async function renameUser(uid) { 
    let u = null; for(let i=0; i<USERS.length; i++) { if(USERS[i].uid === uid) u = USERS[i]; }
    if(!u) return; 
    const n = await Dialog.prompt(`修改宝宝昵称：`, u.name); 
    if(n && n.trim() && n.trim() !== u.name) { u.name = n.trim(); saveUsersData(); renderUserCards(); renderPet(); } 
}

async function toggleMode() { 
    player.quizMode = (player.quizMode === 'zh2en') ? 'en2zh' : 'zh2en'; 
    saveP(); renderUserCards(); showCard(); 
    if(player.quizMode === 'zh2en') Dialog.alert('🌟 难度飙升！<br>模式：【看中文想英文】'); 
    else Dialog.alert('📖 回到基础！<br>模式：【看英文认中文】'); 
}

async function setDailyPlan(type) { 
    const isNew = type === 'new'; const t = isNew ? '🎯 每日新词限额：(建议5-15)' : '🔄 每日复习上限：(建议15-30)'; 
    const cur = isNew ? (player.dailyNew || 10) : (player.dailyRev || 30); 
    let num = await Dialog.prompt(t, cur); 
    if(num === null || num.trim()==='') return; 
    num = parseInt(num); if(isNaN(num) || num < 1) { await Dialog.alert('❌ 无效数字！'); return; } 
    if(isNew) player.dailyNew = num; else player.dailyRev = num; 
    saveP(); renderUserCards(); 
    if(await Dialog.confirm('✅ 自定义保存成功。立即刷新牌堆？')) { queue = buildQueue(true); qi = 0; showCard(); } 
}

function renderUserCards() { 
    document.getElementById('userCards').innerHTML = USERS.map(function(u) { 
        const pObj = safeParseJSON(localStorage.getItem(pKey(u.uid)), {dailyNew:10, dailyRev:30, streak:0, coins:0, quizMode:'en2zh'}); 
        const isMe = u.uid === currentUid; const modeBtnStr = (pObj.quizMode === 'zh2en') ? '中译英' : '英译中'; 
        return `<div class="uc${isMe?' active-uc':''}" style="background:white;padding:12px;border-radius:12px;border:1px solid #e2e8f0;"><div class="flex justify-between items-center border-b pb-2 mb-2"><strong class="text-lg flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition" onclick="renameUser('${u.uid}')">${u.ico} ${u.name} <span class="text-xs text-sky-500 font-normal">✎编辑</span></strong> ${isMe?'<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">当前</span>':''}</div><div class="text-sm space-y-2 mb-3 text-slate-600"><div>🔥 连胜：<b class="text-rose-500">${pObj.streak||0} 天</b> | 💰 金币：<b class="text-amber-500">${pObj.coins||0}</b></div><div class="flex flex-wrap gap-2 pt-1 border-t border-slate-50 border-dashed"><button class="bg-slate-100 text-slate-700 px-2 py-1 rounded shadow-sm text-xs font-bold" onclick="setDailyPlan('new')">🎯新词 ${pObj.dailyNew||10}</button><button class="bg-slate-100 text-slate-700 px-2 py-1 rounded shadow-sm text-xs font-bold" onclick="setDailyPlan('rev')">🔄复习 ${pObj.dailyRev||30}</button>${isMe ? `<button class="bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-800 px-2 py-1 rounded shadow-sm text-xs font-bold border border-purple-200" onclick="toggleMode()">难度：${modeBtnStr} 🔄</button>` : ''}</div></div><div class="flex gap-2">${!isMe ? `<button class="flex-1 bg-indigo-600 text-white font-bold py-2 rounded text-sm shadow mb-0" onclick="switchUser('${u.uid}')">🔄 登录</button>` : ''}<button class="flex-1 bg-rose-100 text-rose-700 font-bold py-2 rounded text-sm shadow-sm mb-0" onclick="clearUserStep1('${u.uid}','${u.name}')">🗑️ 清空进度</button></div></div>`; 
    }).join(''); 
}

function switchUser(uid) { loadBooks(); loadUser(uid); queue=buildQueue(); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); renderUserCards(); refreshList(); }

async function clearUserStep1(uid, name) { 
    if (!(await Dialog.confirm(`确定清除【${name}】所有的学习进度？`))) return; 
    const t = await Dialog.prompt(`为防止误触，请输入「${name}」以确认：`); 
    if (t !== name) { await Dialog.alert('❌ 校验失败'); return; } 
    const ws = localStorage.getItem(wKey(uid)); 
    if (ws) { 
        const wd = safeParseJSON(ws, []); 
        wd.forEach(function(w) { w.level = 0; w.nextReview = Date.now(); }); 
        localStorage.setItem(wKey(uid), JSON.stringify(wd)); 
    } 
    localStorage.removeItem(pKey(uid)); loadBooks(); 
    if (uid === currentUid) { loadUser(uid); queue=buildQueue(true); qi=0; renderPet(); renderBookTabs(); showCard(); renderStats(); } 
    renderUserCards(); refreshList(); await Dialog.alert(`✅ 已彻底清空本帐号！`); 
}

function refreshList() { 
    let cb = null; for(let i=0; i<books.length; i++) { if(books[i].id === currentBookId) cb = books[i]; }
    let bw = []; for(let i=0; i<words.length; i++) { if(words[i].bookId === currentBookId) bw.push(words[i]); }
    
    document.getElementById('wcnt').textContent = bw.length; 
    document.getElementById('wcntBook').textContent = cb ? cb.name : '默认'; 
    document.getElementById('wlist').innerHTML = bw.map(function(w) { 
        let eHtml = (w.emoji && w.emoji.indexOf('http') === 0) ? `<img src="${w.emoji}" class="w-6 h-6 rounded-full object-cover border border-slate-200">` : `<span class="w-6 h-6 inline-block text-center">${w.emoji||'📝'}</span>`; 
        return `<div class="wi"><span class="we flex items-center justify-center">${eHtml}</span><span class="wn">${w.english}</span><span class="wz">${w.chinese}</span><span class="ws">${'⭐'.repeat(Math.min(w.level,5))}</span><button class="we-btn" onclick="editWord('${w.id}')">改</button><button class="wd" onclick="deleteWord('${w.id}')">删</button></div>`; 
    }).join(''); 
}

async function editWord(id) { 
    let w = null; for(let i=0; i<words.length; i++) { if(words[i].id === id) w = words[i]; }
    if (!w) return; 
    const ne = await Dialog.prompt('英文：', w.english); if (ne === null) return; 
    const nz = await Dialog.prompt('中文：', w.chinese); if (nz === null) return; 
    const nEmo = await Dialog.prompt('图(填链接或直接留空以搜图)：', w.emoji); if (nEmo === null) return; 
    let en = ne.trim() || w.english, zh = nz.trim() || w.chinese, emo = nEmo.trim(); 
    if (!emo) { Dialog.alert('⏳ 正在维基百科找图中...'); emo = await fetchWikiImage(en) || autoEmoji(en); } 
    USERS.forEach(function(u) { 
        const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return; 
        const arr = safeParseJSON(ws, []); 
        let idx = -1; for(let i=0; i<arr.length; i++) { if(arr[i].id === id) idx = i; }
        if (idx === -1) return; 
        arr[idx].english = en; arr[idx].chinese = zh; arr[idx].emoji = emo; 
        localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); 
        if (u.uid === currentUid) words = arr; 
    }); 
    if (queue[qi] !== undefined && words[queue[qi]] && words[queue[qi]].id === id) showCard(); 
    refreshList(); renderStats(); 
}

async function deleteWord(id) { 
    if(!(await Dialog.confirm('确定删除吗？'))) return; 
    USERS.forEach(function(u) { 
        const ws = localStorage.getItem(wKey(u.uid)); if (!ws) return; 
        const arr = safeParseJSON(ws, []).filter(function(w) { return w.id !== id; }); 
        localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); 
        if (u.uid === currentUid) words = arr; 
    }); 
    queue = buildQueue(); qi = 0; refreshList(); renderStats(); showCard(); 
}

async function importWords() { 
    const raw = document.getElementById('ta').value.trim(); if (!raw) return; 
    Dialog.alert('🔍 正在全网下载高清网图，请勿刷新...', 'alert'); 
    let ok=0; const p = []; 
    raw.split('\n').forEach(function(l) { 
        const pp = l.trim().split(/[,，]/); 
        if(pp.length>=2) p.push({ en:pp[0].trim(), zh:pp[1].trim(), emo: (pp[2] ? pp[2].trim() : '') }); 
    }); 
    if (!p.length) return; 
    for (let i = 0; i < p.length; i++) { 
        if (!p[i].emo) p[i].emo = await fetchWikiImage(p[i].en) || autoEmoji(p[i].en); 
    } 
    USERS.forEach(function(u) { 
        const ws = localStorage.getItem(wKey(u.uid)); 
        const arr = safeParseJSON(ws, []); 
        p.forEach(function(item) { 
            let dup = false; 
            for(let i=0; i<arr.length; i++) { 
                if(arr[i].english.toLowerCase() === item.en.toLowerCase() && arr[i].bookId === currentBookId) dup = true; 
            }
            if (!dup) { 
                arr.push({ id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2), english:item.en, chinese:item.zh, emoji:item.emo, level:0, nextReview:Date.now(), bookId:currentBookId }); 
                if(u.uid===currentUid) ok++; 
            } 
        }); 
        localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); 
        if(u.uid===currentUid) words = arr; 
    }); 
    document.getElementById('ta').value = ''; Dialog.alert(`✅ 导入 ${ok} 个新词，配图已保存！`); 
    refreshList(); queue = buildQueue(); qi = 0; showCard(); renderStats(); 
}

function renderBookTabs() { 
    document.getElementById('bookTabs').innerHTML = books.map(function(b) { 
        let count = 0; for(let i=0; i<words.length; i++) { if(words[i].bookId === b.id) count++; }
        return `<button class="bg-slate-100 px-3 py-1 rounded font-bold text-slate-700${b.id===currentBookId?' ring-2 ring-indigo-400':''}" onclick="switchBook('${b.id}')">${b.name} (${count})</button>`;
    }).join(''); 
    
    let curName = '默认';
    for(let i=0; i<books.length; i++) { if(books[i].id === currentBookId) curName = books[i].name; }
    document.getElementById('curBookLabel').textContent = curName; 
}

function switchBook(id) { currentBookId = id; localStorage.setItem('mw_cbook_'+currentUid, id); queue=buildQueue(); qi=0; renderBookTabs(); refreshList(); renderStats(); showCard(); }
async function createBook() { const n=await Dialog.prompt('新词库名：'); if(!n||!n.trim())return; const id='b_'+Date.now(); books.push({id: id, name:n.trim()}); saveBooks(); switchBook(id); }
async function renameBook() { 
    let cb = null; for(let i=0; i<books.length; i++) { if(books[i].id === currentBookId) cb = books[i]; }
    if(!cb) return; 
    const n=await Dialog.prompt('改名：',cb.name); 
    if(n&&n.trim()){ cb.name=n.trim(); saveBooks(); renderBookTabs(); } 
}
async function deleteBook() { 
    if(books.length <= 1){ await Dialog.alert('至少保留1个系统词库哦'); return; } 
    if(currentBookId === 'default') { await Dialog.alert('这个默认库不可删！'); return; } 
    if(!(await Dialog.confirm('⚠️ 警告：删除该库会清空里面所有的单词？'))) return; 
    
    USERS.forEach(function(u) { 
        const ws = localStorage.getItem(wKey(u.uid)); 
        if(ws) { 
            const arr = safeParseJSON(ws, []).filter(function(w) { return w.bookId !== currentBookId; }); 
            localStorage.setItem(wKey(u.uid), JSON.stringify(arr)); 
            if(u.uid === currentUid) words = arr; 
        } 
    }); 
    
    books = books.filter(function(b) { return b.id !== currentBookId; }); 
    saveBooks(); currentBookId = books[0].id; localStorage.setItem('mw_cbook_', currentBookId); 
    queue = buildQueue(); qi = 0; renderBookTabs(); refreshList(); renderStats(); showCard(); 
}

function petTap() { 
    const st = getPetStage(); const msgs = ['哎呀，别戳我！', '金币能让小怪兽长大！', '快去买零食喂我！']; 
    if(player.ownsCrown) msgs.push('膜拜土豪理财大师💰'); 
    if(st.level >= 4) msgs.push('大鲨鱼饿啦！🦈'); 
    const el = document.createElement('div'); el.textContent = msgs[Math.floor(Math.random() * msgs.length)]; 
    el.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:white; color:#333; font-weight:bold; padding:10px 20px; border-radius:16px; box-shadow:0 10px 20px rgba(0,0,0,0.1); z-index:9999; animation:flyup 1.8s forwards; font-size:0.9rem; pointer-events:none;'; 
    document.body.appendChild(el); setTimeout(function() { el.remove(); }, 1800); 
}

function init() { 
    try {
        loadUsersData(); loadBooks(); loadUser(currentUid); renderPet(); 
        document.getElementById('accentBtn').textContent = ttsAccent===2 ? 'US' : 'UK'; 
        queue = buildQueue(); qi = 0; showCard(); renderStats(); 
    } catch(err) {
        // 如果 init 阶段依然崩溃，强制调用报错仪！
        window.onerror("Init 致命启动错误: " + err.message, "app.js", 0);
    }
}

init();

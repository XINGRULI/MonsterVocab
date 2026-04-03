/* ═══════════════════════════════════════════════
   语音配置 — 有道词典公开音频接口
   type=1 英式  type=2 美式
   ═══════════════════════════════════════════════ */
let ttsAccent = parseInt(localStorage.getItem('mw_accent') || '2'); // 2=美式 默认

function toggleAccent() {
  ttsAccent = ttsAccent === 2 ? 1 : 2;
  localStorage.setItem('mw_accent', ttsAccent);
  document.getElementById('accentBtn').textContent = ttsAccent === 2 ? '🇺🇸 美式' : '🇬🇧 英式';
}

/* ═══════════════════════════════════════════════
   常量
   ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   双用户配置
   uid: 'u1' | 'u2'
   ═══════════════════════════════════════════════ */
const USERS = [
  { uid:'u1', name:'山山', ico:'👦' },
  { uid:'u2', name:'水水', ico:'👧' },
];

let currentUid = localStorage.getItem('mw_cur') || 'u1';

function wKey(uid) { return 'mw_w_'+uid; }
function pKey(uid) { return 'mw_p_'+uid; }

/* ═══════════════════════════════════════════════
   状态
   ═════════════════════════════   ═════════════════ */
let words         = [];
let player        = {exp:0, petLevel:0};
let books         = [];
let currentBookId = 'default';
let queue         = [];
let qi            = 0;
let shown         = false;

/* ═══════════════════════════════════════════════
   持久化
   ═══════════════════════════════════════════════ */
const saveW     = () => localStorage.setItem(wKey(currentUid), JSON.stringify(words));
const saveP     = () => localStorage.setItem(pKey(currentUid), JSON.stringify(player));
const saveBooks = () => localStorage.setItem('mw_books', JSON.stringify(books));

function loadBooks() {
  try {
    const bs = localStorage.getItem('mw_books');
    if (bs) {
      books = JSON.parse(bs);
      // 确保books是数组
      if (!Array.isArray(books)) {
        books = [{id:'default', name:'默认词库'}];
      }
    } else {
      books = [{id:'default', name:'默认词库'}];
    }
    // 确保默认词库存在
    if (!books.find(b => b.id==='default')) {
      books.unshift({id:'default', name:'默认词库'});
    }
    console.log('词库加载成功:', books);
  } catch (error) {
    console.error('词库加载失败:', error);
    // 加载失败时初始化默认词库
    books = [{id:'default', name:'默认词库'}];
  }
}

function loadUser(uid) {
  currentUid = uid;
  localStorage.setItem('mw_cur', uid);

  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    words = JSON.parse(ws);
    // 迁移旧数据：给没有 bookId 的单词补 default
    let migrated = false;
    words.forEach(w => { if (!w.bookId) { w.bookId='default'; migrated=true; } });
    if (migrated) saveW();
  } else {
    // 初始化用户数据时，只为默认词库添加种子单词
    // 其他词库保持为空，这样词库结构仍然可见
    words = SEED.map((s,i) => ({
      id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji,
      level:0, nextReview:Date.now(), bookId:'default'
    }));
    saveW();
  }

  const ps = localStorage.getItem(pKey(uid));
  player = ps ? JSON.parse(ps) : {exp:0, petLevel:0};

  currentBookId = localStorage.getItem('mw_cbook_'+uid) || 'default';
}

/* ═══════════════════════════════════════════════
   SRS 间隔
   ═══════════════════════════════════════════════ */
function interval(level, action) {
  if (action === 'know')  return Math.pow(2, level) * 86400000;
  if (action === 'fuzzy') return 43200000;
  return 3600000;
}

function buildQueue() {
  const now = Date.now(), q = [];
  for (let i=0; i<words.length; i++)
    if ((words[i].nextReview||0) <= now && words[i].bookId === currentBookId) q.push(i);
  for (let i=q.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [q[i],q[j]] = [q[j],q[i]];
  }
  return q;
}

/* ═══════════════════════════════════════════════
   渲染宠物 / 经验 / 用户标签
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
  document.getElementById('sTodo').textContent  = Math.max(0, queue.length-qi);
  document.getElementById('sTotal').textContent = bw.length;
  document.getElementById('sMast').textContent  = bw.filter(w=>w.level>=5).length;
  const cb = books.find(b=>b.id===currentBookId);
  const lbl = cb ? cb.name : '默认词库';
  document.getElementById('curBookLabel').textContent = lbl;
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
   展示单词 / 完成
   ═══════════════════════════════════════════════ */
function showCard() {
  if (qi >= queue.length) { showDone(); return; }
  const w = words[queue[qi]];
  shown = false;
  
  document.getElementById('wEmo').textContent = w.emoji || '📝';
  
  document.getElementById('wEmo').classList.add('off');       // 默认隐藏图片
  document.getElementById('wEn').textContent    = w.english;
  document.getElementById('wPh').textContent    = getPhonics(w.english);
  document.getElementById('wZh').textContent    = w.chinese;
  document.getElementById('wZh').classList.add('off');        // 默认隐藏中文
  document.getElementById('hint').style.opacity = '1';
  document.getElementById('lvBadge').textContent= 'Lv.'+w.level;
  document.getElementById('acts').removeAttribute('hidden');
  document.getElementById('sndBtn').style.display='flex';
  renderDots(); renderStats();
  const c=document.getElementById('card');
  c.classList.remove('cin'); void c.offsetWidth; c.classList.add('cin');
  // 自动发音（稍延迟等动画完成）
  setTimeout(async () => {
    await autoSpeak(w.english);
    // 禁用语音识别功能，避免麦克风权限请求
    // startVoiceRecognition(w);
  }, 350);
}

function showDone() {
  document.getElementById('wEmo').textContent  = '🎉';
  document.getElementById('wEmo').classList.remove('off');
  document.getElementById('wEn').textContent   = '太棒啦！';
  document.getElementById('wPh').textContent   = '';
  document.getElementById('wZh').textContent   = '今日单词全部完成 💪';
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
  
  // 当显示中文时，自动朗读中文意思
  if (shown) {
    const w = words[queue[qi]];
    console.log('当前单词:', w);
    if (w && w.chinese) {
      console.log('准备朗读中文:', w.chinese);
      // 确保语音合成引擎准备就绪
      if ('speechSynthesis' in window) {
        // 取消之前的朗读
        window.speechSynthesis.cancel();
        
        // 创建语音对象
        const utterance = new SpeechSynthesisUtterance(w.chinese);
        
        // 尝试不同的中文语言代码，增加兼容性
        const langOptions = ['zh-CN', 'zh', 'zh-TW', 'zh-HK'];
        
        // 检查可用的语音
        const voices = window.speechSynthesis.getVoices();
        console.log('可用语音:', voices);
        
        // 尝试找到中文语音
        let chineseVoice = null;
        for (const voice of voices) {
          if (voice.lang.includes('zh')) {
            chineseVoice = voice;
            break;
          }
        }
        
        if (chineseVoice) {
          console.log('找到中文语音:', chineseVoice.name);
          utterance.voice = chineseVoice;
        } else {
          console.log('未找到中文语音，使用默认语音');
          // 尝试设置语言
          for (const lang of langOptions) {
            try {
              utterance.lang = lang;
              break;
            } catch (e) {
              console.log('语言设置失败:', lang);
            }
          }
        }
        
        // 设置参数
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        
        // 添加事件监听
        utterance.onstart = function() {
          console.log('开始朗读中文:', w.chinese);
        };
        
        utterance.onend = function() {
          console.log('朗读完成');
        };
        
        utterance.onerror = function(event) {
          console.error('朗读出错:', event);
        };
        
        // 开始朗读
        try {
          window.speechSynthesis.speak(utterance);
          console.log('已触发朗读');
        } catch (error) {
          console.error('朗读失败:', error);
        }
      } else {
        console.log('浏览器不支持语音合成');
      }
    } else {
      console.log('没有中文内容可朗读');
    }
  }
}

// 回到上一个单词
function prevWord(e) {
  e.stopPropagation();
  if (qi > 0) {
    qi--;
    showCard();
  }
}

/* ═══════════════════════════════════════════════
   动作
   ═══════════════════════════════════════════════ */
function act(action) {
  if (qi >= queue.length) return;
  const idx=queue[qi], w=words[idx];
  if (action==='know') {
    w.level+=1;
    w.nextReview=Date.now()+interval(w.level,'know');
    addExp(20);
  } else if (action==='fuzzy') {
    w.nextReview=Date.now()+interval(w.level,'fuzzy');
    addExp(5);
  } else if (action==='master') {
    // 直接标记为完全掌握（5级）
    w.level=5;
    // 设置一个较长的复习间隔（7天）
    w.nextReview=Date.now()+7*24*60*60*1000;
    // 给予更多经验值
    addExp(30);
  } else {
    w.level=0;
    w.nextReview=Date.now()+interval(0,'forgot');
  }
  saveW(); qi++;
  setTimeout(showCard, 170);
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
  confetti({particleCount:55,spread:65,origin:{y:.5},
    colors:['#FFB3C6','#C8B6FF','#B5EAD7','#FFEAA7']});
  setTimeout(()=>t.classList.remove('show'),2700);
}

/* ═══════════════════════════════════════════════
   烟花
   ═══════════════════════════════════════════════ */
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
   TTS — 有道词典音频，降级到 speechSynthesis
   ═══════════════════════════════════════════════ */
async function autoSpeak(word) {
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${ttsAccent}`;
  try {
    await new Audio(url).play();
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

// 语音识别功能
function startVoiceRecognition(word) {
  // 检查语音识别是否启用
  const voiceRecognitionEnabled = localStorage.getItem('voiceRecognitionEnabled') === 'true';
  if (!voiceRecognitionEnabled) {
    console.log('语音识别未启用');
    return;
  }

  // 检查浏览器是否支持语音识别
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('浏览器不支持语音识别');
    return;
  }

  // 检查用户是否已经看到过权限提示
  const hasSeenPermissionHint = localStorage.getItem('hasSeenPermissionHint');
  if (!hasSeenPermissionHint) {
    // 显示权限提示
    showPermissionHint();
    localStorage.setItem('hasSeenPermissionHint', 'true');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  // 设置为中文识别
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;

  // 显示语音识别提示
  const hintEl = document.getElementById('hint');
  const originalHint = hintEl.textContent;
  hintEl.textContent = '🎤 请说出中文意思...';

  // 语音识别结果
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript.trim();
    console.log('识别结果:', transcript);
    
    // 比较识别结果与正确答案
    const correctAnswer = word.chinese.trim();
    const isCorrect = compareAnswers(transcript, correctAnswer);
    
    if (isCorrect) {
      // 正确，标记为认识
      hintEl.textContent = '✅ 正确！';
      setTimeout(() => {
        act('know');
        hintEl.textContent = originalHint;
      }, 1000);
    } else {
      // 错误，提示再试一次
      hintEl.textContent = '❌ 再试一次...';
      setTimeout(() => {
        hintEl.textContent = originalHint;
      }, 1500);
    }
  };

  // 语音识别错误
  recognition.onerror = function(event) {
    console.error('语音识别错误:', event.error);
    hintEl.textContent = originalHint;
  };

  // 语音识别结束
  recognition.onend = function() {
    // 语音识别自动结束后，恢复原提示
    setTimeout(() => {
      if (hintEl.textContent === '🎤 请说出中文意思...') {
        hintEl.textContent = originalHint;
      }
    }, 2000);
  };

  // 开始语音识别
  try {
    recognition.start();
    console.log('语音识别已启动');
  } catch (error) {
    console.error('启动语音识别失败:', error);
    hintEl.textContent = originalHint;
  }
}

// 显示权限提示
function showPermissionHint() {
  // 创建权限提示元素
  const hintDiv = document.createElement('div');
  hintDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 20px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 2000;
  `;

  hintDiv.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 16px; text-align: center; color: #333;">🎤 麦克风权限设置</h3>
    <p style="margin-bottom: 16px; line-height: 1.5;">为了使用语音识别功能，需要您允许浏览器访问麦克风。</p>
    <p style="margin-bottom: 16px; line-height: 1.5;"><strong>在 Microsoft Edge 浏览器中：</strong></p>
    <ol style="margin-bottom: 20px; padding-left: 20px;">
      <li>当浏览器弹出权限请求时，点击<strong>允许</strong></li>
      <li>勾选<strong>记住我的选择</strong>选项</li>
      <li>点击<strong>完成</strong>按钮</li>
    </ol>
    <p style="margin-bottom: 20px; font-size: 14px; color: #666;">这样设置后，后续使用时就不会再弹出权限请求了。</p>
    <button id="permissionConfirm" style="width: 100%; padding: 12px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">我知道了</button>
  `;

  document.body.appendChild(hintDiv);

  // 点击确认按钮
  document.getElementById('permissionConfirm').addEventListener('click', function() {
    document.body.removeChild(hintDiv);
    // 重新启动语音识别
    if (queue[qi] !== undefined) {
      const w = words[queue[qi]];
      startVoiceRecognition(w);
    }
  });
}

// 比较答案函数
function compareAnswers(userAnswer, correctAnswer) {
  // 简单的文本匹配
  if (userAnswer === correctAnswer) {
    return true;
  }
  
  // 去除空格和标点符号后比较
  const cleanUser = userAnswer.replace(/[\s\p{P}]/gu, '');
  const cleanCorrect = correctAnswer.replace(/[\s\p{P}]/gu, '');
  if (cleanUser === cleanCorrect) {
    return true;
  }
  
  // 检查是否包含正确答案的关键词
  if (userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
    return true;
  }
  
  return false;
}

/* ═══════════════════════════════════════════════
   家长模式
   ═══════════════════════════════════════════════ */
function openGear() {
  renderUserCards();
  renderBookTabs();
  refreshList();
  document.getElementById('ta').value='';
  document.getElementById('mmsg').innerHTML='';
  
  // 确保语音识别开关元素存在
  const voiceToggle = document.getElementById('voiceRecognitionToggle');
  if (voiceToggle) {
    // 加载语音识别设置
    const voiceRecognitionEnabled = localStorage.getItem('voiceRecognitionEnabled') === 'true';
    voiceToggle.checked = voiceRecognitionEnabled;
    
    // 添加语音识别开关事件监听
    voiceToggle.addEventListener('change', function() {
      const enabled = this.checked;
      localStorage.setItem('voiceRecognitionEnabled', enabled.toString());
    });
  } else {
    console.error('语音识别开关元素未找到');
  }
  
  document.getElementById('ov').classList.add('open');
}

function closeOv() { document.getElementById('ov').classList.remove('open'); }
function ovClick(e) { if(e.target.id==='ov') closeOv(); }

/* ── 渲染用户卡片 ── */
function renderUserCards() {
  document.getElementById('userCards').innerHTML = USERS.map(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    const ps = localStorage.getItem(pKey(u.uid));
    const wArr  = ws ? JSON.parse(ws) : [];
    const pObj  = ps ? JSON.parse(ps) : {exp:0,petLevel:0};
    const lv    = Math.min(pObj.petLevel, PET_ICO.length-1);
    const mast  = wArr.filter(w=>w.level>=5).length;
    const isMe  = u.uid === currentUid;
    return `
    <div class="uc${isMe?' active-uc':''}">
      <div class="uc-head">
        <span class="uc-ico">${u.ico}</span>
        <span class="uc-name">${u.name}</span>
        ${isMe?'<span class="uc-tag">当前</span>':''}
      </div>
      <div class="uc-stats">
        <span>📚 ${wArr.length} 词</span>
        <span>⭐ ${mast} 已掌握</span>
        <span>${PET_ICO[lv]} Lv.${lv+1} · ${pObj.exp} EXP</span>
      </div>
      <div class="uc-btns">
        ${!isMe ? `<button class="uc-btn sw" onclick="switchUser('${u.uid}')">🔄 切换到此用户</button>` : '<button class="uc-btn sw" style="opacity:.4;cursor:default">✅ 已在使用</button>'}
        <button class="uc-btn cl" onclick="clearUserStep1('${u.uid}','${u.name}')">🗑️ 清除记录</button>
      </div>
    </div>`;
  }).join('');
}

/* ── 切换用户 ── */
function switchUser(uid) {
  loadBooks(); // 重新加载词库，确保所有用户看到相同的词库列表
  loadUser(uid);
  queue=buildQueue(); qi=0;
  renderPet(); renderBookTabs(); showCard(); renderStats();
  renderUserCards(); refreshList();
}

/* ── 清除记录：两次确认 ── */
function clearUserStep1(uid, name) {
  // 第一次确认
  const r1 = confirm(`⚠️ 第 1/2 步确认\n\n确定要清除【${name}】的所有学习记录吗？\n\n单词进度和经验值将全部归零，无法恢复。`);
  if (!r1) return;
  // 第二次确认（要求输入用户名）
  const typed = prompt(`⚠️ 第 2/2 步确认\n\n请输入用户名「${name}」以最终确认清除：`);
  if (typed === null) return;
  if (typed.trim() !== name) { alert('❌ 用户名不匹配，已取消'); return; }
  // 执行清除：只清除学习进度和经验值，保留单词数据
  const ws = localStorage.getItem(wKey(uid));
  if (ws) {
    const wordsData = JSON.parse(ws);
    // 重置所有单词的学习进度
    wordsData.forEach(word => {
      word.level = 0;
      word.nextReview = Date.now();
    });
    // 保存重置后的单词数据
    localStorage.setItem(wKey(uid), JSON.stringify(wordsData));
  }
  // 清除经验值数据
  localStorage.removeItem(pKey(uid));
  // 重新加载词库结构，确保词库不会被删除
  loadBooks();
  // 如果清除的是当前用户，重新加载
  if (uid === currentUid) {
    loadUser(uid);
    queue=buildQueue(); qi=0;
    renderPet(); renderBookTabs(); showCard(); renderStats();
  }
  renderUserCards(); refreshList();
  alert(`✅ 【${name}】的记录已清除，学习进度和经验值已重置`);
}

/* ── 词库列表（仅显示当前词库）── */
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

function editWord(id) {
  // 找到这个单词（从当前用户词库）
  const w = words.find(w => w.id === id);
  if (!w) return;

  const newEn = prompt('✏️ 修改英文（当前：' + w.english + '）：', w.english);
  if (newEn === null) return;
  const newZh = prompt('✏️ 修改中文（当前：' + w.chinese + '）：', w.chinese);
  if (newZh === null) return;
  const newEmo = prompt('✏️ 修改图片Emoji（当前：' + w.emoji + '，留空自动匹配）：', w.emoji);
  if (newEmo === null) return;

  const en  = newEn.trim()  || w.english;
  const zh  = newZh.trim()  || w.chinese;
  const emo = newEmo.trim() || autoEmoji(en);

  // 同步更新所有用户词库中相同 id 的单词
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return;
    arr[idx].english = en;
    arr[idx].chinese = zh;
    arr[idx].emoji   = emo;
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid === currentUid) words = arr;
  });

  // 如果当前正在学这个单词，刷新卡片显示
  if (queue[qi] !== undefined && words[queue[qi]]?.id === id) showCard();
  refreshList(); renderStats();
}

function deleteWord(id) {
  // 同步从所有用户词库删除
  USERS.forEach(u => {
    const ws  = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws).filter(w => w.id !== id);
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid === currentUid) words = arr;
  });
  // 重建队列，防止指针越界
  queue = buildQueue(); qi = 0;
  refreshList(); renderStats(); showCard();
}

/* ═══════════════════════════════════════════════
   音标字典（美式 IPA）
   ═══════════════════════════  ═══════════════════ */
const PHONICS_MAP = {
  // 种子词
  apple:'/ ˈæp.əl /',banana:'/ bəˈnɑː.nə /',cat:'/ kæt /',dog:'/ dɔːɡ /',
  elephant:'/ ˈel.ɪ.fənt /',fish:'/ fɪʃ /',giraffe:'/ dʒɪˈræf /',
  hat:'/ hæt /','ice cream':'/ ˈaɪs kriːm /',juice:'/ dʒuːs /',
  // 动物
  bird:'/ bɜːrd /',rabbit:'/ ˈræb.ɪt /',bear:'/ ber /',panda:'/ ˈpæn.də /',
  tiger:'/ ˈtaɪ.ɡər /',lion:'/ ˈlaɪ.ən /',monkey:'/ ˈmʌŋ.ki /',cow:'/ kaʊ /',
  pig:'/ pɪɡ /',sheep:'/ ʃiːp /',horse:'/ hɔːrs /',chicken:'/ ˈtʃɪk.ɪn /',
  duck:'/ dʌk /',penguin:'/ ˈpeŋ.ɡwɪn /',owl:'/ aʊl /',eagle:'/ ˈiː.ɡəl /',
  snake:'/ sneɪk /',frog:'/ frɑːɡ /',turtle:'/ ˈtɜːr.t̬əl /',
  dolphin:'/ ˈdɑːl.fɪn /',whale:'/ weɪl /',shark:'/ ʃɑːrk /',
  wolf:'/ wʊlf /',fox:'/ fɑːks /',deer:'/ dɪr /',zebra:'/ ˈziː.brə /',
  koala:'/ koʊˈɑː.lə /',parrot:'/ ˈper.ət /',
  // 食物
  orange:'/ ˈɔːr.ɪndʒ /',grape:'/ ɡreɪp /',strawberry:'/ ˈstrɔː.ber.i /',
  watermelon:'/ ˈwɔː.t̬ər.mel.ən /',pineapple:'/ ˈpaɪn.æp.əl /',
  mango:'/ ˈmæŋ.ɡoʊ /',peach:'/ piːtʃ /',cherry:'/ ˈtʃer.i /',
  lemon:'/ ˈlem.ən /',coconut:'/ ˈkoʊ.kə.nʌt /',tomato:'/ təˈmeɪ.t̬oʊ /',
  carrot:'/ ˈker.ət /',corn:'/ kɔːrn /',potato:'/ pəˈteɪ.t̬oʊ /',
  bread:'/ bred /',pizza:'/ ˈpiːt.sə /',hamburger:'/ ˈhæm.bɜːr.ɡər /',
  sandwich:'/ ˈsænd.wɪtʃ /',rice:'/ raɪs /',soup:'/ suːp /',
  cake:'/ keɪk /',cookie:'/ ˈkʊk.i /',chocolate:'/ ˈtʃɑːk.lɪt /',
  candy:'/ ˈkæn.di /',donut:'/ ˈdoʊ.nʌt /',coffee:'/ ˈkɑː.fi /',
  tea:'/ tiː /',milk:'/ mɪlk /',water:'/ ˈwɔː.t̬ər /',egg:'/ eɡ /',
  cheese:'/ tʃiːz /',honey:'/ ˈhʌn.i /',
  // 自然
  sun:'/ sʌn /',moon:'/ muːn /',star:'/ stɑːr /',cloud:'/ klaʊd /',
  rain:'/ reɪn /',snow:'/ snoʊ /',fire:'/ faɪər /',flower:'/ ˈflaʊ.ər /',
  rose:'/ roʊz /',tree:'/ triː /',leaf:'/ liːf /',grass:'/ ɡræs /',
  mountain:'/ ˈmaʊn.tən /',ocean:'/ ˈoʊ.ʃən /',river:'/ ˈrɪv.ər /',
  rainbow:'/ ˈreɪn.boʊ /',
  // 颜色
  red:'/ red /',blue:'/ bluː /',green:'/ ɡriːn /',yellow:'/ ˈjel.oʊ /',
  white:'/ waɪt /',black:'/ blæk /',pink:'/ pɪŋk /',brown:'/ braʊn /',
  purple:'/ ˈpɜːr.pəl /',
  // 人物
  baby:'/ ˈbeɪ.bi /',boy:'/ bɔɪ /',girl:'/ ɡɜːrl /',man:'/ mæn /',
  woman:'/ ˈwʊm.ən /',family:'/ ˈfæm.ɪ.li /',doctor:'/ ˈdɑːk.tər /',
  teacher:'/ ˈtiː.tʃər /',
  // 交通
  car:'/ kɑːr /',bus:'/ bʌs /',train:'/ treɪn /',plane:'/ pleɪn /',
  ship:'/ ʃɪp /',bicycle:'/ ˈbaɪ.sɪ.kəl /',truck:'/ trʌk /',
  taxi:'/ ˈtæk.si /',rocket:'/ ˈrɑːk.ɪt /',boat:'/ boʊt /',
  // 建筑
  house:'/ haʊs /',school:'/ skuːl /',hospital:'/ ˈhɑːs.pɪ.t̬əl /',
  // 物品
  book:'/ bʊk /',pencil:'/ ˈpen.səl /',pen:'/ pen /',umbrella:'/ ʌmˈbrel.ə /',
  glasses:'/ ˈɡlæs.ɪz /',phone:'/ foʊn /',computer:'/ kəmˈpjuː.t̬ər /',
  camera:'/ ˈkæm.ər.ə /',key:'/ kiː /',lamp:'/ læmp /',clock:'/ klɑːk /',
  // 运动
  football:'/ ˈfʊt.bɔːl /',soccer:'/ ˈsɑː.kər /',basketball:'/ ˈbæs.kɪt.bɔːl /',
  baseball:'/ ˈbeɪs.bɔːl /',tennis:'/ ˈten.ɪs /',swimming:'/ ˈswɪm.ɪŋ /',
  running:'/ ˈrʌn.ɪŋ /',trophy:'/ ˈtroʊ.fi /',
  // 感情
  happy:'/ ˈhæp.i /',sad:'/ sæd /',angry:'/ ˈæŋ.ɡri /',love:'/ lʌv /',
  // 常见动词/形容词
  big:'/ bɪɡ /',small:'/ smɔːl /',fast:'/ fæst /',slow:'/ sloʊ /',
  hot:'/ hɑːt /',cold:'/ koʊld /',old:'/ oʊld /',new:'/ njuː /',
  good:'/ ɡʊd /',bad:'/ bæd /',open:'/ ˈoʊ.pən /',close:'/ kloʊz /',
  run:'/ rʌn /',walk:'/ wɔːk /',jump:'/ dʒʌmp /',fly:'/ flaɪ /',
  eat:'/ iːt /',drink:'/ drɪŋk /',sleep:'/ sliːp /',play:'/ pleɪ /',
  read:'/ riːd /',write:'/ raɪt /',draw:'/ drɔː /',sing:'/ sɪŋ /',
  dance:'/ dæns /',swim:'/ swɪm /',climb:'/ klaɪm /',
  // 数字
  one:'/ wʌn /',two:'/ tuː /',three:'/ θriː /',four:'/ fɔːr /',
  five:'/ faɪv /',six:'/ sɪks /',seven:'/ ˈsev.ən /',eight:'/ eɪt /',
  nine:'/ naɪn /',ten:'/ ten /',
};

function getPhonics(english) {
  const key = english.toLowerCase().trim();
  return PHONICS_MAP[key] || '';
}
const EMOJI_MAP = {
  // 动物
  cat:'🐱',dog:'🐶',fish:'🐟',bird:'🐦',rabbit:'🐰',bear:'🐻',panda:'🐼',
  tiger:'🐯',lion:'🦁',elephant:'🐘',giraffe:'🦒',monkey:'🐒',cow:'🐮',
  pig:'🐷',sheep:'🐑',horse:'🐴',chicken:'🐔',duck:'🦆',penguin:'🐧',
  owl:'🦉',eagle:'🦅',snake:'🐍',frog:'🐸',turtle:'🐢',dolphin:'🐬',
  whale:'🐳',shark:'🦈',crab:'🦀',shrimp:'🦐',snail:'🐌',butterfly:'🦋',
  bee:'🐝',ant:'🐜',ladybug:'🐞',spider:'🕷',wolf:'🐺',fox:'🦊',
  deer:'🦌',zebra:'🦓',hippo:'🦛',rhino:'🦏',gorilla:'🦍',kangaroo:'🦘',
  koala:'🐨',crocodile:'🐊',parrot:'🦜',flamingo:'🦩',peacock:'🦚',
  // 身体部位
  head:'👤',face:'😊',eye:'👁',ear:'👂',nose:'👃',mouth:'👄',
  tooth:'🦷',tongue:'👅',hand:'✋',arm:'💪',foot:'🦶',leg:'🦵',
  body:'👤',hair:'💇',beard:'👴',mustache:'👨',tail:'🐾',wing:'🦅',
  feather:'🪶',scale:'🐟',fur:'🐻',skin:'👤',bone:'🦴',blood:'🩸',
  // 食物
  apple:'🍎',banana:'🍌',orange:'🍊',grape:'🍇',strawberry:'🍓',
  watermelon:'🍉',pineapple:'🍍',mango:'🥭',peach:'🍑',cherry:'🍒',
  lemon:'🍋',coconut:'🥥',kiwi:'🥝',tomato:'🍅',carrot:'🥕',corn:'🌽',
  potato:'🥔',broccoli:'🥦',cucumber:'🥒',pepper:'🌶',onion:'🧅',
  garlic:'🧄',mushroom:'🍄',bread:'🍞',pizza:'🍕',hamburger:'🍔',
  hotdog:'🌭',sandwich:'🥪',taco:'🌮',rice:'🍚',noodle:'🍜',noodles:'🍜',
  spaghetti:'🍝',soup:'🍲',salad:'🥗',sushi:'🍣',cake:'🎂',cookie:'🍪',
  chocolate:'🍫',candy:'🍬',icecream:'🍦','ice cream':'🍦',donut:'🍩',
  coffee:'☕',tea:'🍵',milk:'🥛',juice:'🧃',water:'💧',beer:'🍺',
  wine:'🍷',egg:'🥚',cheese:'🧀',butter:'🧈',honey:'🍯',
  // 水果扩展
  blueberry:'🫐',avocado:'🥑',raspberry:'🫐',strawberries:'🍓',
  // 自然
  sun:'☀️',moon:'🌙',star:'⭐',cloud:'☁️',rain:'🌧',snow:'❄️',
  wind:'💨',fire:'🔥',water:'💧',earth:'🌍',flower:'🌸',rose:'🌹',
  tree:'🌳',leaf:'🍃',grass:'🌿',mountain:'⛰',beach:'🏖',ocean:'🌊',
  river:'🏞',forest:'🌲',desert:'🏜',rainbow:'🌈',lightning:'⚡',
  volcano:'🌋',island:'🏝',
  // 颜色
  red:'🔴',blue:'🔵',green:'🟢',yellow:'🟡',orange:'🟠',purple:'🟣',
  white:'⬜',black:'⬛',pink:'🩷',brown:'🟤',
  // 身体/人物
  baby:'👶',boy:'👦',girl:'👧',man:'👨',woman:'👩',family:'👨‍👩‍👧',
  king:'👑',queen:'👸',doctor:'👨‍⚕️',teacher:'👨‍🏫',farmer:'👨‍🌾',
  chef:'👨‍🍳',police:'👮',firefighter:'👨‍🚒',astronaut:'👨‍🚀',
  eye:'👁',ear:'👂',nose:'👃',mouth:'👄',hand:'✋',foot:'🦶',
  heart:'❤️',brain:'🧠',tooth:'🦷',bone:'🦴',
  // 交通
  car:'🚗',bus:'🚌',train:'🚂',plane:'✈️',ship:'🚢',bicycle:'🚲',
  motorcycle:'🏍',truck:'🚚',taxi:'🚕',rocket:'🚀',helicopter:'🚁',
  boat:'⛵',submarine:'🤿',
  // 建筑/地点
  house:'🏠',school:'🏫',hospital:'🏥',bank:'🏦',hotel:'🏨',
  church:'⛪',castle:'🏰',tower:'🗼',bridge:'🌉',stadium:'🏟',
  // 物品
  book:'📚',pencil:'✏️',pen:'🖊',scissors:'✂️',ruler:'📏',
  backpack:'🎒',umbrella:'☂️',glasses:'👓',hat:'🎩',shirt:'👕',
  shoes:'👟',sock:'🧦',dress:'👗',ring:'💍',watch:'⌚',
  phone:'📱',computer:'💻',keyboard:'⌨️',mouse:'🖱',camera:'📷',
  television:'📺',tv:'📺',radio:'📻',microphone:'🎤',headphone:'🎧',
  headphones:'🎧',battery:'🔋',lamp:'💡',candle:'🕯',key:'🔑',
  lock:'🔒',hammer:'🔨',wrench:'🔧',scissors:'✂️',needle:'🪡',
  // 运动
  football:'⚽',soccer:'⚽',basketball:'🏀',baseball:'⚾',tennis:'🎾',
  golf:'⛳',swimming:'🏊',running:'🏃',cycling:'🚴',skiing:'⛷',
  boxing:'🥊',trophy:'🏆',medal:'🥇',
  // 音乐/艺术
  music:'🎵',guitar:'🎸',piano:'🎹',violin:'🎻',drum:'🥁',trumpet:'🎺',
  painting:'🎨',theater:'🎭',
  // 感情/表情
  happy:'😊',sad:'😢',angry:'😠',surprised:'😲',scared:'😱',
  love:'❤️',laugh:'😂',cry:'😭',smile:'😊',
  // 学习相关
  math:'➕',science:'🔬',history:'📜',geography:'🌍',art:'🎨',
  music:'🎵',sport:'⚽',english:'🔤',chinese:'🀄',
  // 数字/符号
  one:'1️⃣',two:'2️⃣',three:'3️⃣',four:'4️⃣',five:'5️⃣',
  six:'6️⃣',seven:'7️⃣',eight:'8️⃣',nine:'9️⃣',ten:'🔟',
  // 天气/时间
  morning:'🌅',evening:'🌆',night:'🌃',day:'☀️',
  spring:'🌸',summer:'☀️',autumn:'🍂',fall:'🍂',winter:'❄️',
  monday:'📅',tuesday:'📅',wednesday:'📅',thursday:'📅',friday:'📅',saturday:'📅',sunday:'📅',
  // 其他常用
  gift:'🎁',balloon:'🎈',party:'🎉',birthday:'🎂',christmas:'🎄',
  flag:'🚩',map:'🗺',compass:'🧭',clock:'🕐',calendar:'📅',
  money:'💰',coin:'🪙',diamond:'💎',crown:'👑',sword:'⚔️',shield:'🛡',
  magic:'🪄',robot:'🤖',alien:'👽',ghost:'👻',zombie:'🧟',
  // 扩展词汇
  schoolbag:'🎒',backpack:'🎒',pencilcase:'📚',pencilcase:'📁',
  notebook:'📓',textbook:'📖',eraser:'🧽',sharpener:'✏️',
  calculator:'🧮',ruler:'📏',protractor:'📐',scissors:'✂️',
  glue:'🖍',tape:'📏',stapler:'🖇',paper:'📄',
  desk:'🪑',chair:'🪑',table:'📋',blackboard:'📋',
  whiteboard:'📋',chalk:'🖍',marker:'🖍',sticker:'🎨',
  homework:'📝',assignment:'📝',test:'📝',exam:'📝',
  study:'📚',learn:'📚',read:'📚',write:'✏️',
  draw:'🎨',paint:'🎨',sing:'🎤',dance:'💃',
  play:'🎮',game:'🎮',toy:'🧸',doll:'🧸',
  ball:'⚽',balloon:'🎈',kite:'🪁',bicycle:'🚲',
  car:'🚗',bus:'🚌',train:'🚂',plane:'✈️',
  ship:'🚢',boat:'⛵',rocket:'🚀',helicopter:'🚁',
  food:'🍽',meal:'🍽',breakfast:'🍳',lunch:'🍱',dinner:'🍽',
  fruit:'🍎',vegetable:'🥦',meat:'🥩',fish:'🐟',
  drink:'🥤',water:'💧',juice:'🧃',milk:'🥛',
  coffee:'☕',tea:'🍵',soda:'🥤',beer:'🍺',
  wine:'🍷',alcohol:'🍺',
  // 动词扩展
  run:'🏃',walk:'🚶',jump:'🏃',hop:'🦘',
  skip:'🏃',climb:'🧗',swim:'🏊',dive:'🤿',
  fly:'✈️',drive:'🚗',ride:'🚴',
  eat:'🍽',drink:'🥤',cook:'🍳',bake:'🍰',
  sleep:'😴',rest:'😴',work:'💼',study:'📚',
  play:'🎮',game:'🎮',sport:'⚽',exercise:'💪',
  read:'📚',write:'✏️',draw:'🎨',paint:'🎨',
  sing:'🎤',dance:'💃',music:'🎵',
  // 形容词扩展
  big:'📏',large:'📏',huge:'📏',
  small:'📏',tiny:'📏',little:'📏',
  tall:'📏',short:'📏',
  long:'📏',short:'📏',
  wide:'📏',narrow:'📏',
  high:'📏',low:'📏',
  fast:'⚡',quick:'⚡',speedy:'⚡',
  slow:'🐌',sluggish:'🐌',
  hot:'🔥',warm:'🔥',
  cold:'❄️',cool:'❄️',
  old:'👴',ancient:'🏛',
  new:'🆕',modern:'🆕',
  good:'👍',great:'👍',excellent:'⭐',
  bad:'👎',terrible:'👎',awful:'👎',
  happy:'😊',glad:'😊',joyful:'😊',
  sad:'😢',unhappy:'😢',depressed:'😢',
  angry:'😠',mad:'😠',furious:'😠',
  scared:'😱',afraid:'😱',frightened:'😱',
  brave:'🦸',courageous:'🦸',
  smart:'🧠',intelligent:'🧠',clever:'🧠',
  dumb:'🤪',stupid:'🤪',foolish:'🤪',
  // 复合词处理
  'ice cream':'🍦','ice-cream':'🍦',
  'hot dog':'🌭','hot-dog':'🌭',
  'base ball':'⚾','base-ball':'⚾',
  'basket ball':'🏀','basket-ball':'🏀',
  'foot ball':'⚽','foot-ball':'⚽',
  'tennis ball':'🎾','tennis-ball':'🎾',
  'golf ball':'⛳','golf-ball':'⛳',
  'school bag':'🎒','school-bag':'🎒',
  'pencil case':'📁','pencil-case':'📁',
  'note book':'📓','note-book':'📓',
  'text book':'📖','text-book':'📖',
  'white board':'📋','white-board':'📋',
  'black board':'📋','black-board':'📋',
  'home work':'📝','home-work':'📝',
  'birth day':'🎂','birth-day':'🎂',
  'christ mas':'🎄','christ-mas':'🎄',
  // 常见错误处理
  'colour':'🎨','color':'🎨',
  'centre':'🏛','center':'🏛',
  'theatre':'🎭','theater':'🎭',
  'favourite':'❤️','favorite':'❤️',
  'neighbour':'👥','neighbor':'👥',
  'honour':'🏆','honor':'🏆',
  'labour':'💪','labor':'💪',
  'organise':'📋','organize':'📋',
  'realise':'🧠','realize':'🧠',
  'analyse':'🔬','analyze':'🔬',
};

function autoEmoji(english) {
  const key = english.toLowerCase().trim();
  
  // 1. 直接匹配
  if (EMOJI_MAP[key]) return EMOJI_MAP[key];
  
  // 2. 处理复合词：尝试不同形式
  const variations = [
    key.replace(/\s+/g, '-'),  // 空格转连字符
    key.replace(/-/g, ' '),    // 连字符转空格
    key.replace(/\s+/g, ''),   // 移除空格
    key.replace(/-/g, '')      // 移除连字符
  ];
  
  for (const varKey of variations) {
    if (EMOJI_MAP[varKey]) return EMOJI_MAP[varKey];
  }
  
  // 3. 处理单复数
  if (key.endsWith('s') && key.length > 3) {
    const singular = key.slice(0, -1);
    if (EMOJI_MAP[singular]) return EMOJI_MAP[singular];
  }
  if (key.endsWith('es') && key.length > 4) {
    const singular = key.slice(0, -2);
    if (EMOJI_MAP[singular]) return EMOJI_MAP[singular];
  }
  if (key.endsWith('ies') && key.length > 4) {
    const singular = key.slice(0, -3) + 'y';
    if (EMOJI_MAP[singular]) return EMOJI_MAP[singular];
  }
  
  // 4. 尝试匹配第一个单词
  const first = key.split(/[\s-]/)[0];
  if (EMOJI_MAP[first]) return EMOJI_MAP[first];
  
  // 5. 尝试匹配最后一个单词（对于类似 'apple pie' 这样的复合词）
  const parts = key.split(/[\s-]/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (EMOJI_MAP[last]) return EMOJI_MAP[last];
  }
  
  // 6. 处理常见拼写变体
  const spellVariations = {
    'colour': 'color',
    'centre': 'center',
    'theatre': 'theater',
    'favourite': 'favorite',
    'neighbour': 'neighbor',
    'honour': 'honor',
    'labour': 'labor',
    'organise': 'organize',
    'realise': 'realize',
    'analyse': 'analyze'
  };
  
  if (spellVariations[key]) {
    const variant = spellVariations[key];
    if (EMOJI_MAP[variant]) return EMOJI_MAP[variant];
  }
  
  // 7. 处理常见前缀
  const prefixes = ['un', 're', 'in', 'im', 'dis', 'en', 'em', 'non', 'pre', 'post'];
  for (const prefix of prefixes) {
    if (key.startsWith(prefix) && key.length > prefix.length + 2) {
      const root = key.slice(prefix.length);
      if (EMOJI_MAP[root]) return EMOJI_MAP[root];
    }
  }
  
  // 8. 处理常见后缀
  const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'ful', 'less'];
  for (const suffix of suffixes) {
    if (key.endsWith(suffix) && key.length > suffix.length + 2) {
      const root = key.slice(0, -suffix.length);
      if (EMOJI_MAP[root]) return EMOJI_MAP[root];
    }
  }
  
  // 9. 没有找到匹配的emoji，返回默认值
  return '📝';
}

function importWords() {
  const raw = document.getElementById('ta').value.trim();
  if (!raw) return;
  let ok=0, skip=0;

  // 解析每一行，同时兼容全角逗号「，」和半角逗号「,」
  const parsed = [];
  raw.split('\n').forEach(line => {
    const p = line.trim().split(/[,，]/).map(s => s.trim());
    if (p.length < 2 || !p[0]) return;
    parsed.push({ english:p[0], chinese:p[1], emoji:p[2] || autoEmoji(p[0]) });
  });

  if (parsed.length === 0) {
    document.getElementById('mmsg').innerHTML =
      '<div class="m-msg m-er">❌ 没有识别到有效单词，请检查格式</div>';
    setTimeout(()=>document.getElementById('mmsg').innerHTML='', 3000);
    return;
  }

  // 同步写入所有用户，新词打上当前 bookId
  USERS.forEach(u => {
    const ws  = localStorage.getItem(wKey(u.uid));
    const arr = ws ? JSON.parse(ws) : SEED.map((s,i) => ({
      id:'seed_'+i, english:s.english, chinese:s.chinese, emoji:s.emoji,
      level:0, nextReview:Date.now(), bookId:'default'
    }));
    parsed.forEach(({english, chinese, emoji}) => {
      // 同一词库内不重复；不同词库允许同一单词存在
      const dup = arr.find(w => w.english.toLowerCase()===english.toLowerCase()
                              && w.bookId===currentBookId);
      if (dup) { if (u.uid===currentUid) skip++; return; }
      arr.push({ id:'w_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
        english, chinese, emoji, level:0, nextReview:Date.now(), bookId:currentBookId });
      if (u.uid===currentUid) ok++;
    });
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid===currentUid) words = arr;
  });

  document.getElementById('ta').value = '';
  const msg = document.getElementById('mmsg');
  msg.innerHTML = `<div class="m-msg m-ok">✅ 导入 ${ok} 个，山山和水水都已同步${skip?' | 跳过重复 '+skip+' 个':''}</div>`;
  setTimeout(() => msg.innerHTML = '', 3500);
  refreshList();
  queue = buildQueue(); qi = 0;
  showCard(); renderStats();
}

/* ═══════════════════════════════════════════════
   词库 CRUD
   ═══════════════════════════════════════════════ */
function renderBookTabs() {
  document.getElementById('bookTabs').innerHTML = books.map(b => {
    // 计算当前词库的单词数量
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

function createBook() {
  const name = prompt('📚 请输入新词库名称：');
  if (!name || !name.trim()) return;
  const id = 'b_'+Date.now();
  books.push({id, name:name.trim()});
  saveBooks();
  switchBook(id);
  renderBookTabs(); refreshList();
}

function renameBook() {
  const cb = books.find(b=>b.id===currentBookId);
  if (!cb) return;
  const name = prompt('✏️ 重命名词库（当前：'+cb.name+'）：', cb.name);
  if (!name || !name.trim()) return;
  cb.name = name.trim();
  saveBooks();
  renderBookTabs(); refreshList(); renderStats();
}

function deleteBook() {
  if (books.length <= 1) { alert('❌ 至少保留一个词库，无法删除'); return; }
  const cb = books.find(b=>b.id===currentBookId);
  if (!confirm('⚠️ 确定删除词库「'+cb.name+'」？\n该词库内所有单词将被删除，无法恢复！')) return;
  // 从所有用户删除该词库的单词
  USERS.forEach(u => {
    const ws = localStorage.getItem(wKey(u.uid));
    if (!ws) return;
    const arr = JSON.parse(ws).filter(w => w.bookId !== currentBookId);
    localStorage.setItem(wKey(u.uid), JSON.stringify(arr));
    if (u.uid===currentUid) words = arr;
  });
  books = books.filter(b=>b.id!==currentBookId);
  saveBooks();
  currentBookId = books[0].id;
  localStorage.setItem('mw_cbook_'+currentUid, currentBookId);
  queue=buildQueue(); qi=0;
  renderBookTabs(); refreshList(); renderStats(); showCard();
}

/* ═══════════════════════════════════════════════
   浮动粒子背景
   ═══════════════════════════════════════════════ */
function spawnPts() {
  const bag=['⭐','✨','💫','🌟','🎵','💝','🌈','🎀','🫧','🍭','🎊'];
  const wrap=document.getElementById('pts');
  for(let i=0;i<11;i++){
    const p=document.createElement('div');
    p.className='pt';
    p.textContent=bag[i%bag.length];
    p.style.left=(Math.random()*97)+'vw';
    p.style.fontSize=(.85+Math.random()*1.25)+'rem';
    p.style.animationDuration=(9+Math.random()*14)+'s';
    p.style.animationDelay=(-Math.random()*18)+'s';
    wrap.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════
   启动
   ═══════════════════════════════════════════════ */
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

// 全局变量
let allWords = [];
let filteredWords = [];
let currentIdx = 0;
let currentFileName = "";
let currentLevel = "";
const synth = window.speechSynthesis;

// ====================== 工具函数 ======================
/**
 * 移除文件名的.xlsx后缀
 * @param {string} filename - 完整文件名
 * @returns {string} 无后缀的文件名
 */
function removeFileExtension(filename) {
  return filename.replace(/\.xlsx$/i, '');
}

/**
 * 构建fileList.json的URL
 * @param {string} level - P1/P2
 * @returns {string} 配置文件URL
 */
function getFileListUrl(level) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/fileList.json`;
}

/**
 * 构建XLSX文件的URL
 * @param {string} level - P1/P2
 * @param {string} filename - 文件名
 * @returns {string} XLSX文件URL
 */
function getXlsxFileUrl(level, filename) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/${filename}`;
}

// ====================== 加载文件列表 ======================
/**
 * 根据选中的Level加载对应目录的文件列表
 * @param {string} level - P1/P2
 */
async function loadFileListByLevel(level) {
  const fileSelect = document.getElementById('fileSelect');
  const fileRow = document.getElementById('fileRow');
  
  fileSelect.innerHTML = '<option value="">Loading...</option>';
  fileRow.style.display = 'flex';
  
  try {
    const res = await fetch(getFileListUrl(level));
    if (!res.ok) throw new Error(`No file list for ${level}`);
    
    const config = await res.json();
    const files = config.files || [];
    
    fileSelect.innerHTML = '';
    if (files.length === 0) {
      fileSelect.innerHTML = '<option value="">No files</option>';
      return;
    }
    
    // 加载文件列表（显示无后缀名）
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = removeFileExtension(file);
      fileSelect.appendChild(option);
    });
  } catch (e) {
    fileSelect.innerHTML = '<option value="">Load error</option>';
  }
}

// ====================== 加载选中的XLSX文件 ======================
/**
 * 加载选中的单词文件
 * @param {string} filename - 选中的文件名
 */
async function loadSelectedFile(filename) {
  if (!filename || !currentLevel) return;
  
  currentFileName = filename;
  document.getElementById("wordContent").innerHTML = '<p style="color:#3b82f6;">Loading...</p>';
  document.getElementById("dayRow").style.display = 'flex';
  
  try {
    const url = getXlsxFileUrl(currentLevel, filename);
    const res = await fetch(url);
    if (!res.ok) throw new Error("File not found");
    
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    
    // 过滤有效单词并格式化
    allWords = data.filter(x => x.word && x.meaning && x.day).map(x => ({
      word: x.word,
      meaning: x.meaning,
      day: Number(x.day)
    }));
    
    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();
  } catch (e) {
    document.getElementById("wordContent").innerHTML = '<p style="color:#ef4444;">Load failed</p>';
  }
}

// ====================== 筛选Day ======================
/**
 * 根据输入的Day筛选单词
 */
function filterByDay() {
  const day = Number(document.getElementById("dayNum").value);
  if (isNaN(day) || day < 1) {
    alert('Please enter a valid day!');
    return;
  }
  
  filteredWords = allWords.filter(x => x.day === day);
  currentIdx = 0;
  showWord();
}

// ====================== 语音朗读功能 ======================
/**
 * 获取语音合成的可用语音
 * @returns {Promise<SpeechSynthesisVoice[]>} 语音列表
 */
function getVoices() {
  return new Promise(resolve => {
    let v = synth.getVoices();
    if (v.length) resolve(v);
    else synth.onvoiceschanged = () => resolve(synth.getVoices());
  });
}

/**
 * 朗读指定单词
 * @param {string} word - 要朗读的单词
 */
async function speak(word) {
  const voices = await getVoices();
  synth.cancel();
  
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.8;
  
  // 优先选择女性英文语音
  const femaleVoice = voices.find(v =>
    v.lang.includes("en") &&
    (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google"))
  );
  if (femaleVoice) u.voice = femaleVoice;
  
  synth.speak(u);
}

/**
 * 连续朗读单词3次（间隔2秒）
 * @param {string} word - 要朗读的单词
 */
function read3Times(word) {
  clearInterval(window.readTimer);
  let count = 0;
  
  // 第一次朗读
  speak(word);
  count++;
  
  // 后续两次朗读（间隔2秒）
  window.readTimer = setInterval(() => {
    if (count < 3) {
      speak(word);
      count++;
    } else {
      clearInterval(window.readTimer);
    }
  }, 2000);
}

// ====================== 单词导航 ======================
/**
 * 切换到上一个单词
 */
function prevWord() {
  if (currentIdx <= 0) return;
  currentIdx--;
  showWord();
}

/**
 * 切换到下一个单词
 */
function nextWord() {
  currentIdx++;
  showWord();
}

// ====================== 显示单词（核心） ======================
/**
 * 显示当前单词（默认隐藏英文，点击Show Word才显示）
 */
function showWord() {
  clearInterval(window.readTimer);
  const el = document.getElementById("wordContent");
  
  // 无单词数据
  if (filteredWords.length === 0) {
    el.innerHTML = '<p style="color:#ef4444;">No words for this day</p>';
    return;
  }
  
  // 练习完成
  if (currentIdx >= filteredWords.length) {
    el.innerHTML = '<p style="color:#22c55e; font-size:24px;">🎉 Practice Complete!</p>';
    return;
  }
  
  const wordData = filteredWords[currentIdx];
  const isFirstWord = currentIdx <= 0;
  const displayFileName = removeFileExtension(currentFileName);
  
  // 渲染单词界面
  el.innerHTML = `
    <div class="meaning">💡 ${wordData.meaning}</div>
    <div class="word" id="currentWord" style="display:none;">${wordData.word.toUpperCase()}</div>
    <div class="btn-group">
      <button class="btn-show" onclick="document.getElementById('currentWord').style.display='block'">👀 Show Word</button>
      <button class="btn-read" onclick="read3Times('${wordData.word}')">🔊 Read 3x</button>
      <button class="btn-prev" onclick="prevWord()" ${isFirstWord ? "disabled" : ""}>⬅️ Previous</button>
      <button class="btn-next" onclick="nextWord()">➡️ Next</button>
    </div>
    <div class="tip">Level: ${currentLevel} | File: ${displayFileName} | Day: ${wordData.day} | ${currentIdx + 1}/${filteredWords.length}</div>
  `;
}

// ====================== 初始化事件绑定 ======================
document.addEventListener('DOMContentLoaded', () => {
  // Level选择确认
  document.getElementById("levelConfirm").addEventListener('click', () => {
    const level = document.getElementById("levelSelect").value;
    if (!level) {
      alert('Please select P1/P2!');
      return;
    }
    currentLevel = level;
    loadFileListByLevel(level);
  });

  // 文件选择确认
  document.getElementById("fileConfirm").addEventListener('click', () => {
    const file = document.getElementById("fileSelect").value;
    loadSelectedFile(file);
  });

  // Day筛选
  document.getElementById("filterBtn").addEventListener('click', filterByDay);
});

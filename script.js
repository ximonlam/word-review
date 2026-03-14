// 全局状态变量
let allWords = [];          // 存储当前文件的所有单词
let filteredWords = [];     // 存储筛选后的单词（按Day/All）
let currentIdx = 0;         // 当前显示的单词索引
let currentFileName = "";   // 当前选中的文件名
let currentLevel = "";      // 当前选中的级别(P1/P2)
const synth = window.speechSynthesis; // 语音合成API

// ====================== 工具函数 ======================
/**
 * 移除文件名的.xlsx扩展名
 * @param {string} filename - 带扩展名的文件名
 * @returns {string} 纯文件名
 */
function removeFileExtension(filename) {
  return filename.replace(/\.xlsx$/i, '');
}

/**
 * 获取对应级别的文件列表JSON地址
 * @param {string} level - P1/P2
 * @returns {string} JSON文件URL
 */
function getFileListUrl(level) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/fileList.json`;
}

/**
 * 获取Excel文件的完整URL
 * @param {string} level - P1/P2
 * @param {string} filename - Excel文件名
 * @returns {string} Excel文件URL
 */
function getXlsxFileUrl(level, filename) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/${filename}`;
}

/**
 * 初始化Day选择框切换逻辑（All/Custom）
 */
function initDaySelectToggle() {
  const daySelect = document.getElementById('daySelect');
  const dayNum = document.getElementById('dayNum');
  
  // 切换下拉选项时显示/隐藏数字输入框
  daySelect.addEventListener('change', function() {
    if (this.value === 'all') {
      dayNum.classList.add('hidden');
    } else {
      dayNum.classList.remove('hidden');
    }
  });
}

// ====================== 数据加载逻辑 ======================
/**
 * 根据级别加载文件列表
 * @param {string} level - P1/P2
 */
async function loadFileListByLevel(level) {
  const fileSelect = document.getElementById('fileSelect');
  const fileRow = document.getElementById('fileRow');
  
  // 重置文件选择框并显示
  fileSelect.innerHTML = '<option value="">Loading...</option>';
  fileRow.style.display = 'flex';
  
  try {
    const res = await fetch(getFileListUrl(level));
    if (!res.ok) throw new Error(`HTTP ${res.status}: 无法加载文件列表`);
    
    const config = await res.json();
    const files = config.files || [];
    
    // 填充文件选项
    fileSelect.innerHTML = '';
    if (files.length === 0) {
      fileSelect.innerHTML = '<option value="">No files available</option>';
      return;
    }
    
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = removeFileExtension(file);
      fileSelect.appendChild(option);
    });
  } catch (e) {
    fileSelect.innerHTML = '<option value="">Load failed</option>';
    console.error("文件列表加载失败:", e);
    alert(`加载文件列表失败: ${e.message}`);
  }
}

/**
 * 加载并解析选中的Excel文件
 * @param {string} filename - Excel文件名
 */
async function loadSelectedFile(filename) {
  if (!filename || !currentLevel) return;
  
  currentFileName = filename;
  const wordContent = document.getElementById("wordContent");
  wordContent.innerHTML = '<p style="color:#3b82f6;">Loading words...</p>';
  document.getElementById("dayRow").style.display = 'flex';
  
  try {
    // 加载Excel文件
    const url = getXlsxFileUrl(currentLevel, filename);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`文件不存在 (${res.status})`);
    
    // 解析Excel
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    
    // 过滤并格式化数据（确保包含day/word/meaning）
    allWords = rawData.filter(item => item.word && item.meaning && item.day).map(item => ({
      word: String(item.word).trim(),
      meaning: String(item.meaning).trim(),
      day: Number(item.day)
    }));
    
    // 初始化筛选列表
    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();
    
    // 显示"显示所有单词"按钮
    document.getElementById('showAllBtn').style.display = 'inline-block';
    
  } catch (e) {
    wordContent.innerHTML = '<p style="color:#ef4444;">Failed to load words</p>';
    document.getElementById('showAllBtn').style.display = 'none';
    console.error("单词文件加载失败:", e);
    alert(`加载单词失败: ${e.message}`);
  }
}

// ====================== 筛选逻辑（Day/All） ======================
/**
 * 按Day或All筛选单词
 */
function filterByDay() {
  const daySelect = document.getElementById('daySelect');
  const dayNum = document.getElementById('dayNum');
  
  // 选择All时加载所有单词
  if (daySelect.value === 'all') {
    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();
    return;
  }
  
  // 按数字Day筛选
  const day = Number(dayNum.value);
  if (isNaN(day) || day < 1) {
    alert('Please enter a valid day number (≥1)!');
    dayNum.focus();
    return;
  }
  
  filteredWords = allWords.filter(item => item.day === day);
  currentIdx = 0;
  showWord();
}

// ====================== 语音朗读功能 ======================
/**
 * 获取可用的语音合成声音列表
 * @returns {Promise<SpeechSynthesisVoice[]>} 声音列表
 */
function getVoices() {
  return new Promise(resolve => {
    let voices = synth.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      // 等待声音加载完成
      const onVoicesChanged = () => {
        resolve(synth.getVoices());
        synth.onvoiceschanged = null; // 移除监听避免重复触发
      };
      synth.onvoiceschanged = onVoicesChanged;
    }
  });
}

/**
 * 朗读指定文本
 * @param {string} text - 要朗读的文本
 */
async function speak(text) {
  if (!text) return;
  synth.cancel(); // 停止之前的朗读
  
  const voices = await getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 配置朗读参数
  utterance.lang = "en-US";
  utterance.rate = 0.8;    // 语速（0.1-10）
  utterance.volume = 1;    // 音量（0-1）
  utterance.pitch = 1;     // 音调（0-2）
  
  // 优先选择英文女性声音
  const femaleVoice = voices.find(voice => 
    voice.lang.includes("en") && 
    (voice.name.includes("Female") || voice.name.includes("Samantha") || voice.name.includes("Google") || voice.name.includes("Microsoft"))
  );
  if (femaleVoice) utterance.voice = femaleVoice;
  
  synth.speak(utterance);
}

/**
 * 重复朗读指定文本3次（间隔2秒）
 * @param {string} word - 要朗读的单词
 */
function read3Times(word) {
  clearInterval(window.readTimer); // 清除之前的定时器
  let count = 0;
  
  // 第一次朗读
  speak(word);
  count++;
  
  // 定时重复朗读
  window.readTimer = setInterval(() => {
    if (count < 3) {
      speak(word);
      count++;
    } else {
      clearInterval(window.readTimer);
    }
  }, 2000);
}

// ====================== 单词导航逻辑 ======================
/**
 * 上一个单词
 */
function prevWord() {
  if (currentIdx <= 0) return;
  currentIdx--;
  showWord();
}

/**
 * 下一个单词
 */
function nextWord() {
  currentIdx++;
  showWord();
}

/**
 * 显示当前单词（核心渲染函数）
 */
function showWord() {
  clearInterval(window.readTimer); // 清除朗读定时器
  const el = document.getElementById("wordContent");
  
  // 无筛选结果
  if (filteredWords.length === 0) {
    el.innerHTML = '<p style="color:#ef4444;">No words for this day</p>';
    return;
  }
  
  // 练习完成
  if (currentIdx >= filteredWords.length) {
    el.innerHTML = '<p style="color:#22c55e; font-size:24px;">🎉 Practice Complete!</p>';
    return;
  }
  
  // 渲染当前单词
  const wordData = filteredWords[currentIdx];
  const isFirstWord = currentIdx <= 0;
  const displayFileName = removeFileExtension(currentFileName);
  
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

// ====================== 显示所有单词（新窗口） ======================
function showAllWords() {
  if (allWords.length === 0) return;

  // 构建新窗口的HTML
  const allWordsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All Words - ${removeFileExtension(currentFileName)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          line-height: 1.8;
          background: #f0f4f8;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        h1 {
          color: #ff9a56;
          text-align: center;
          margin-bottom: 20px;
          font-size: 22px;
        }
        .word-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .word-table th, .word-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .word-table th {
          background: #f8fafc;
          color: #333;
        }
        .close-btn {
          display: block;
          margin: 20px auto 0;
          padding: 10px 20px;
          background: #ff9a56;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        }
        .close-btn:hover {
          background: #ff6b35;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>All Words - ${currentLevel} | ${removeFileExtension(currentFileName)}</h1>
        <table class="word-table">
          <tr>
            <th>Day</th>
            <th>English Word</th>
            <th>Chinese Meaning</th>
          </tr>
          ${allWords.map(word => `
            <tr>
              <td>${word.day}</td>
              <td><strong>${word.word.toUpperCase()}</strong></td>
              <td>${word.meaning}</td>
            </tr>
          `).join('')}
        </table>
        <button class="close-btn" onclick="window.close()">❌ Close Window</button>
      </div>
    </body>
    </html>
  `;

  // 打开新窗口并写入内容
  const newWindow = window.open('', '_blank', 'width=900,height=700');
  newWindow.document.write(allWordsHtml);
  newWindow.document.close();
}

// ====================== 初始化事件绑定 ======================
document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('showAllBtn');
  
  // 初始化Day选择框切换逻辑
  initDaySelectToggle();

  // Level确认按钮
  document.getElementById('levelConfirm').addEventListener('click', function() {
    // 点击反馈
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    
    const level = document.getElementById('levelSelect').value;
    if (!level) {
      alert('Please select P1 or P2 first!');
      return;
    }
    currentLevel = level;
    loadFileListByLevel(level);
    showAllBtn.style.display = 'none';
  });

  // File确认按钮
  document.getElementById('fileConfirm').addEventListener('click', function() {
    // 点击反馈
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    
    const file = document.getElementById('fileSelect').value;
    const invalidValues = ["", "Loading...", "No files available", "Load failed"];
    if (invalidValues.includes(file)) {
      alert('Please select a valid file first!');
      return;
    }
    loadSelectedFile(file);
  });

  // Filter按钮（Day/All）
  document.getElementById('filterBtn').addEventListener('click', function() {
    // 点击反馈
    this.style.opacity = '0.7';
    setTimeout(() => this.style.opacity = '1', 200);
    
    filterByDay();
  });

  // 显示所有单词按钮
  showAllBtn.addEventListener('click', showAllWords);
});

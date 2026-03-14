// 全局变量
let allWords = [];
let filteredWords = [];
let currentIdx = 0;
let currentFileName = "";
let currentLevel = "";
const synth = window.speechSynthesis;

// ====================== 工具函数 ======================
function removeFileExtension(filename) {
  return filename.replace(/\.xlsx$/i, '');
}

function getFileListUrl(level) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/fileList.json`;
}

function getXlsxFileUrl(level, filename) {
  return `https://raw.githubusercontent.com/ximonlam/word-review/main/data/${level}/${filename}`;
}

// ====================== 加载文件列表 ======================
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
    
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = removeFileExtension(file);
      fileSelect.appendChild(option);
    });
  } catch (e) {
    fileSelect.innerHTML = '<option value="">Load error</option>';
    console.error("File list load error:", e);
  }
}

// ====================== 加载选中的XLSX文件 ======================
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
    
    allWords = data.filter(x => x.word && x.meaning && x.day).map(x => ({
      word: x.word,
      meaning: x.meaning,
      day: Number(x.day)
    }));
    
    filteredWords = [...allWords];
    currentIdx = 0;
    showWord();
    
    // ✅ Show the button ONLY after successful file load
    document.getElementById('showAllBtn').style.display = 'inline-block';
    
  } catch (e) {
    document.getElementById("wordContent").innerHTML = '<p style="color:#ef4444;">Load failed</p>';
    document.getElementById('showAllBtn').style.display = 'none';
    console.error("File load error:", e);
  }
}

// ====================== 筛选Day ======================
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
function getVoices() {
  return new Promise(resolve => {
    let v = synth.getVoices();
    if (v.length) resolve(v);
    else synth.onvoiceschanged = () => resolve(synth.getVoices());
  });
}

async function speak(word) {
  const voices = await getVoices();
  synth.cancel();
  
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.8;
  
  const femaleVoice = voices.find(v =>
    v.lang.includes("en") &&
    (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google"))
  );
  if (femaleVoice) u.voice = femaleVoice;
  
  synth.speak(u);
}

function read3Times(word) {
  clearInterval(window.readTimer);
  let count = 0;
  
  speak(word);
  count++;
  
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
function prevWord() {
  if (currentIdx <= 0) return;
  currentIdx--;
  showWord();
}

function nextWord() {
  currentIdx++;
  showWord();
}

// ====================== 显示单词（核心） ======================
function showWord() {
  clearInterval(window.readTimer);
  const el = document.getElementById("wordContent");
  
  if (filteredWords.length === 0) {
    el.innerHTML = '<p style="color:#ef4444;">No words for this day</p>';
    return;
  }
  
  if (currentIdx >= filteredWords.length) {
    el.innerHTML = '<p style="color:#22c55e; font-size:24px;">🎉 Practice Complete!</p>';
    return;
  }
  
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

// ====================== Show All Words Function ======================
function showAllWords() {
  if (allWords.length === 0) return;

  let allWordsHtml = `
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

  const newWindow = window.open('', '_blank', 'width=900,height=700');
  newWindow.document.write(allWordsHtml);
  newWindow.document.close();
}

// ====================== Initialize Events (FIXED) ======================
document.addEventListener('DOMContentLoaded', () => {
  const showAllBtn = document.getElementById('showAllBtn');
  const levelConfirmBtn = document.getElementById('levelConfirm');
  const fileConfirmBtn = document.getElementById('fileConfirm');
  const filterBtn = document.getElementById('filterBtn');
  
  // Fix Level Confirm Button (100% responsive)
  levelConfirmBtn.addEventListener('click', () => {
    const level = document.getElementById('levelSelect').value;
    if (!level) {
      alert('Please select P1 or P2 first!');
      return;
    }
    currentLevel = level;
    loadFileListByLevel(level);
    showAllBtn.style.display = 'none'; // Keep hidden
  });

  // Fix File Confirm Button (100% responsive)
  fileConfirmBtn.addEventListener('click', () => {
    const file = document.getElementById('fileSelect').value;
    if (!file || file === "Loading..." || file === "No files" || file === "Load error") {
      alert('Please select a valid file first!');
      return;
    }
    loadSelectedFile(file);
  });

  // Fix Filter Button
  filterBtn.addEventListener('click', filterByDay);

  // Show All Words Button Click
  showAllBtn.addEventListener('click', showAllWords);
});

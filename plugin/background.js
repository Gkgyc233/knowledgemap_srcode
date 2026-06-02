// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveSelectedTextWithAnnotation",
    title: "保存选中文字到本地（可写批注）",
    contexts: ["selection"]
  });
});

// 监听菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "saveSelectedTextWithAnnotation") return;

  const selectedText = info.selectionText;
  if (!selectedText || selectedText.trim() === "") {
    console.warn("未选中任何文字");
    return;
  }

  const annotation = await getUserAnnotation(tab.id);
  if (annotation === null) {
    console.log("用户取消了保存");
    return;
  }

  const data = {
    text: selectedText,
    annotation: annotation,
    savedAt: new Date().toISOString(),
    url: tab.url,
    title: tab.title
  };

  saveToFile(data);
});

async function getUserAnnotation(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.5); display: flex;
          justify-content: center; align-items: center;
          z-index: 999999; font-family: system-ui, sans-serif;
        `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
          background: white; padding: 20px; border-radius: 8px;
          width: 400px; max-width: 80%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        dialog.innerHTML = `
          <h3 style="margin-top:0">添加批注（可选）</h3>
          <textarea id="annotationInput" style="width:100%; height:120px; padding:8px; font-size:14px; box-sizing:border-box; resize:vertical;" placeholder="在这里写批注..."></textarea>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
            <button id="cancelBtn" style="padding:6px 12px;">取消</button>
            <button id="okBtn" style="padding:6px 12px; background:#1a73e8; color:white; border:none; border-radius:4px;">确认</button>
          </div>
        `;
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        const textarea = dialog.querySelector('#annotationInput');
        const okBtn = dialog.querySelector('#okBtn');
        const cancelBtn = dialog.querySelector('#cancelBtn');
        const cleanup = () => modal.remove();
        okBtn.onclick = () => { const val = textarea.value; cleanup(); resolve(val); };
        cancelBtn.onclick = () => { cleanup(); resolve(null); };
        modal.onclick = (e) => { if (e.target === modal) { cleanup(); resolve(null); } };
        textarea.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') okBtn.click(); });
        textarea.focus();
      });
    }
  });
  return results[0].result;
}

function saveToFile(data) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const fileName = `selected_text_${timestamp}.json`;
  const subDir = "fresh";
  const fullFileName = `${subDir}/${fileName}`;

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const reader = new FileReader();
  reader.onloadend = function() {
    const dataUrl = reader.result;
    chrome.downloads.download({
      url: dataUrl,
      filename: fullFileName,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("下载失败:", chrome.runtime.lastError.message);
      } else {
        console.log("保存成功，ID:", downloadId);
      }
    });
  };
  reader.onerror = () => console.error("生成 JSON 文件失败");
  reader.readAsDataURL(blob);
}

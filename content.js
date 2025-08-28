console.log('Content script loaded');

let popupVisible = false;
let isProcessing = false;

function createFloatingPopup() {
  console.log('Creating minimal popup');
  
  const existingPopup = document.getElementById('ai-extractor-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement('div');
  popup.id = 'ai-extractor-popup';
  popup.innerHTML = `
    <div class="answer-area" id="answer-area">Loading...</div>
    <div class="button-grid">
      <button id="start-btn" class="mini-btn">Start</button>
      <button id="screenshot-btn" class="mini-btn">Screenshot</button>
      <button id="test-btn" class="mini-btn">Test</button>
      <button id="close-btn" class="mini-btn close-btn">Close</button>
    </div>
  `;

  document.body.appendChild(popup);
  popupVisible = true;
  
  // Make popup draggable
  makeDraggable(popup);
  
  attachEventListeners();
  updateAnswer('Ready');
}

// Draggable functionality
function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    
    // Only allow dragging if clicking on the popup background (not buttons)
    if (e.target.tagName === 'BUTTON' || e.target.className.includes('mini-btn')) {
      return;
    }
    
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    
    // Change cursor to indicate dragging
    element.style.cursor = 'grabbing';
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Calculate new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Calculate new position
    let newTop = element.offsetTop - pos2;
    let newLeft = element.offsetLeft - pos1;
    
    // Keep popup within viewport bounds
    const maxTop = window.innerHeight - element.offsetHeight;
    const maxLeft = window.innerWidth - element.offsetWidth;
    
    newTop = Math.max(0, Math.min(newTop, maxTop));
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    
    // Set new position
    element.style.top = newTop + 'px';
    element.style.left = newLeft + 'px';
    element.style.right = 'auto'; // Remove right positioning
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    element.style.cursor = 'grab';
  }
}

function attachEventListeners() {
  const startBtn = document.getElementById('start-btn');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const testBtn = document.getElementById('test-btn');
  const closeBtn = document.getElementById('close-btn');
  
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag when clicking button
      console.log('Start clicked');
      updateAnswer('Ready for screenshot');
    });
  }
  
  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Screenshot clicked');
      handleScreenshot();
    });
  }
  
  if (testBtn) {
    testBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Test clicked');
      handleTest();
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Close clicked');
      hidePopup();
    });
  }
}

function showPopup() {
  if (!popupVisible) {
    createFloatingPopup();
  } else {
    const popup = document.getElementById('ai-extractor-popup');
    if (popup) {
      popup.style.display = 'block';
    }
  }
}

function hidePopup() {
  const popup = document.getElementById('ai-extractor-popup');
  if (popup) {
    popup.style.display = 'none';
    popupVisible = false;
  }
}

function updateAnswer(text) {
  const answerArea = document.getElementById('answer-area');
  if (answerArea) {
    answerArea.textContent = text;
  }
}

async function handleScreenshot() {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    updateAnswer('Capturing...');
    
    const screenshotResult = await sendMessageToBackground('takeScreenshot');
    if (!screenshotResult.success) {
      throw new Error(screenshotResult.error);
    }
    
    updateAnswer('Processing...');
    
    const aiResult = await sendMessageToBackground('processWithGemini', {
      imageData: screenshotResult.dataUrl
    });
    
    if (!aiResult.success) {
      throw new Error(aiResult.error);
    }
    
    // Extract clean answer text
    let answerText = 'No answer found';
    if (aiResult.data && aiResult.data.correct_option) {
      const option = aiResult.data.correct_option;
      const match = option.match(/^[A-D]\)\s*(.+)$/);
      if (match) {
        answerText = match[1];
      } else {
        answerText = option;
      }
    }
    
    updateAnswer('Saving...');
    await sendToServer(aiResult.data, screenshotResult.dataUrl);
    
    updateAnswer(`Answer: ${answerText}`);
    
  } catch (error) {
    console.error('Screenshot failed:', error);
    updateAnswer('Error occurred');
  } finally {
    isProcessing = false;
  }
}

async function handleTest() {
  try {
    updateAnswer('Testing...');
    const result = await sendMessageToBackground('testServer');
    
    if (result.success) {
      updateAnswer('Answer: 4');
    } else {
      updateAnswer('Test failed');
    }
  } catch (error) {
    updateAnswer('Test error');
  }
}

async function sendMessageToBackground(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({action, ...data}, (response) => {
      if (chrome.runtime.lastError) {
        resolve({success: false, error: chrome.runtime.lastError.message});
      } else {
        resolve(response || {success: false, error: 'No response'});
      }
    });
  });
}

async function sendToServer(questionData, screenshotUrl) {
  try {
    const payload = {
      ...questionData,
      screenshot_url: screenshotUrl,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch('https://aqe.onrender.com/submit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error('Server error');
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showPopup') {
    showPopup();
    sendResponse({success: true});
  }
  return true;
});


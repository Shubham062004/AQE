console.log('Content script loaded');
let popupVisible = false;
let isProcessing = false;

function createFloatingPopup() {
    console.log('Creating minimal popup');
    
    // Remove existing popup if any
    const existingPopup = document.getElementById('ai-extractor-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create main popup container
    const popup = document.createElement('div');
    popup.id = 'ai-extractor-popup';

    // Add popup content
    popup.innerHTML = `
        <div class="answer-area">Click Start to begin extraction</div>
        <div class="button-grid">
            <button class="mini-btn" id="start-btn">📸 Start</button>
            <button class="mini-btn" id="settings-btn">⚙️ Settings</button>
            <button class="mini-btn" id="history-btn">📋 History</button>
            <button class="mini-btn" id="help-btn">❓ Help</button>
            <button class="mini-btn close-btn" id="close-btn">❌ Close</button>
        </div>
    `;

    document.body.appendChild(popup);

    // Make popup draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    popup.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);

    function dragStart(e) {
        if (e.target.closest('.mini-btn')) return;
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === popup || popup.contains(e.target)) {
            isDragging = true;
        }
    }

    function dragMove(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            popup.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    // Button handlers
    const startBtn = popup.querySelector('#start-btn');
    const settingsBtn = popup.querySelector('#settings-btn');
    const historyBtn = popup.querySelector('#history-btn');
    const helpBtn = popup.querySelector('#help-btn');
    const closeBtn = popup.querySelector('#close-btn');
    const answerArea = popup.querySelector('.answer-area');

    startBtn.addEventListener('click', async () => {
        console.log('Start clicked');
        if (isProcessing) return;
        
        isProcessing = true;
        startBtn.textContent = '⏳ Processing...';
        answerArea.textContent = 'Taking screenshot...';

        try {
            console.log('Screenshot clicked');
            
            // Take screenshot
            console.log('Sending screenshot request to background');
            const screenshotResult = await new Promise((resolve) => {
                chrome.runtime.sendMessage({action: 'takeScreenshot'}, (response) => {
                    console.log('Screenshot response:', response);
                    resolve(response);
                });
            });

            if (!screenshotResult.success) {
                throw new Error(screenshotResult.error);
            }

            answerArea.textContent = 'Processing with AI...';
            
            // Process with Gemini
            const geminiResult = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'processWithGemini', 
                    imageData: screenshotResult.dataUrl
                }, resolve);
            });

            if (!geminiResult.success) {
                throw new Error(geminiResult.error);
            }

            // Display results
            const data = geminiResult.data;
            answerArea.innerHTML = `
                <strong>Q:</strong> ${data.question}<br><br>
                <strong>Options:</strong><br>${data.options.join('<br>')}<br><br>
                <strong style="color: #4CAF50;">Answer: ${data.correct_option}</strong>
            `;

        } catch (error) {
            console.log('Processing error:', error);
            answerArea.textContent = `Error: ${error.message}`;
        } finally {
            isProcessing = false;
            startBtn.textContent = '📸 Start';
        }
    });

    closeBtn.addEventListener('click', () => {
        popup.remove();
        popupVisible = false;
    });

    settingsBtn.addEventListener('click', () => {
        answerArea.textContent = 'Settings: Configure your preferences here';
    });

    historyBtn.addEventListener('click', () => {
        answerArea.textContent = 'History: View previous extractions';
    });

    helpBtn.addEventListener('click', () => {
        answerArea.textContent = 'Help: 1) Click Start 2) Extension captures screen 3) AI extracts question';
    });

    popupVisible = true;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received:', request.action);
    
    if (request.action === 'showPopup') {
        if (!popupVisible) {
            createFloatingPopup();
            sendResponse({success: true});
        } else {
            sendResponse({success: false, message: 'Popup already visible'});
        }
    }
    
    return true;
});

console.log('Content script ready');

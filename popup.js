console.log('Extension popup loaded');

document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('start-btn');
  const testBtn = document.getElementById('test-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const statusDiv = document.getElementById('status');

  function showStatus(isSuccess, message) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${isSuccess ? 'success' : 'error'}`;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
  }

  startBtn?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab || !tab.url) return showStatus(false, 'No active tab');
      if (tab.url.startsWith('chrome://')) return showStatus(false, 'Cannot run on browser pages');
      chrome.tabs.sendMessage(tab.id, {action: 'showPopup'}, (response) => {
        if (chrome.runtime.lastError) return showStatus(false, 'Refresh page and try again');
        if (response && response.success) { showStatus(true, 'Started'); setTimeout(() => window.close(), 1000); }
        else showStatus(false, 'Failed to start');
      });
    } catch (e) { showStatus(false, 'Error'); }
  });

  testBtn?.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({action: 'testServer'});
      if (response && response.success) showStatus(true, 'Server OK');
      else showStatus(false, 'Server failed');
    } catch (e) { showStatus(false, 'Test error'); }
  });

  dashboardBtn?.addEventListener('click', () => {
    chrome.tabs.create({url: 'https://aqe.onrender.com'});
    window.close();
  });
});


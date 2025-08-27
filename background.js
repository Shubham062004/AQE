console.log('Background script loaded');

// REPLACE WITH YOUR ACTUAL GEMINI API KEY FROM https://aistudio.google.com/
const GEMINI_API_KEY = 'AIzaSyAflVg0RPeRR84gLhGmrDMljkbnv-FoAqQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'takeScreenshot') {
    takeScreenshot()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
  
  if (request.action === 'processWithGemini') {
    processWithGemini(request.imageData)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
  
  if (request.action === 'testServer') {
    testServer()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

async function takeScreenshot() {
  console.log('Taking screenshot...');
  
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, {format: 'png', quality: 100}, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot failed:', chrome.runtime.lastError.message);
        resolve({success: false, error: chrome.runtime.lastError.message});
      } else if (!dataUrl) {
        resolve({success: false, error: 'No screenshot data'});
      } else {
        console.log('Screenshot captured successfully');
        resolve({success: true, dataUrl: dataUrl});
      }
    });
  });
}

async function processWithGemini(imageDataUrl) {
  console.log('Processing with Gemini AI...');
  
  try {
    // Validate API key
    if (!GEMINI_API_KEY || 
        GEMINI_API_KEY === 'AIzaSyC-your-actual-api-key-here' ||
        !GEMINI_API_KEY.startsWith('AIza')) {
      throw new Error('Please set a valid Gemini API key in background.js');
    }
    
    const base64Data = imageDataUrl.split(',')[1];
    console.log('Image data size:', Math.round(base64Data.length / 1024), 'KB');
    
    const requestPayload = {
      contents: [{
        parts: [
          {
            text: `Extract the question and answer options from this image.
Return only valid JSON in this format:
{
  "question": "Full question text",
  "options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
  "correct_option": "B) Option two"
}

Rules:
- Extract exact text as shown in the image
- Include A), B), C), D) prefixes in options
- Identify the correct option (usually highlighted)
- Return only JSON, no other text`
          },
          {
            inline_data: {
              mime_type: "image/png",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024
      }
    };
    
    console.log('Sending request to Gemini API...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestPayload)
    });
    
    console.log('Gemini response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error (${response.status}): Check your API key`);
    }
    
    const responseData = await response.json();
    console.log('Gemini response received');
    
    if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }
    
    let extractedText = responseData.candidates[0].content.parts[0].text;
    console.log('Raw text from Gemini:', extractedText);
    
    // Parse JSON from response
    let questionData = null;
    const attempts = [
      extractedText.trim(),
      extractedText.replace(/``````/g, '').trim(),
      extractedText.substring(extractedText.indexOf('{'), extractedText.lastIndexOf('}') + 1)
    ];
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        const cleanText = attempts[i];
        if (cleanText.length < 10) continue;
        
        const parsed = JSON.parse(cleanText);
        if (parsed.question && Array.isArray(parsed.options) && parsed.correct_option) {
          questionData = parsed;
          console.log('Successfully parsed JSON on attempt', i + 1);
          break;
        }
      } catch (parseError) {
        console.warn('Parse attempt', i + 1, 'failed:', parseError.message);
      }
    }
    
    if (!questionData) {
      questionData = {
        question: "Failed to extract question from image",
        options: ["A) Image unclear", "B) Try again", "C) Check quality", "D) Different image"],
        correct_option: "B) Try again"
      };
    }
    
    console.log('Final question data:', questionData);
    return { success: true, data: questionData };
    
  } catch (error) {
    console.error('Gemini processing failed:', error);
    return { success: false, error: error.message };
  }
}

async function testServer() {
  console.log('Testing server connection...');
  
  try {
    const response = await fetch('https://aqe.onrender.com/submit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        question: "Test: What is 2+2?",
        options: ["A) 3", "B) 4", "C) 5", "D) 6"],
        correct_option: "B) 4",
        screenshot_url: "data:image/png;base64,test"
      })
    });
    
    const data = await response.json();
    console.log('Server test successful');
    return { success: true, data: data };
    
  } catch (error) {
    console.error('Server test failed:', error);
    return { success: false, error: error.message };
  }
}

console.log('Background script setup complete');


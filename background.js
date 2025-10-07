console.log('Background script loaded');

// FIXED: Replace process.env with your actual API key
const GEMINI_API_KEY = 'AIzaSyCvn5IUYoNP5zEmcxePzxmvORNLzhH8Ze0';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request.action);

    if (request.action === 'takeScreenshot') {
        takeScreenshot()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    } // FIXED: Added missing closing bracket

    if (request.action === 'processWithGemini') {
        processWithGemini(request.imageData)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    } // FIXED: Added missing closing bracket

    if (request.action === 'testServer') {
        testServer()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    } // FIXED: Added missing closing bracket
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
        if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIza')) {
            throw new Error('Invalid Gemini API key');
        }

        const base64Data = imageDataUrl.split(',')[1];
        console.log('Image data size:', Math.round(base64Data.length / 1024), 'KB');

        const requestPayload = {
            contents: [{
                parts: [
                    {
                        text: `Extract the question and answer options from this image. Return only valid JSON in this format:
{
"question": "Full question text",
"options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
"correct_option": "B) Option two"
}`
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

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            throw new Error(`Gemini API error (${response.status}): Check your API key`);
        }

        const responseData = await response.json();
        
        if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response from Gemini API');
        }

        let extractedText = responseData.candidates[0].content.parts[0].text;
        
        // Parse JSON from response
        try {
            const cleanText = extractedText.replace(/``````/g, '').trim();
            const questionData = JSON.parse(cleanText);
            return { success: true, data: questionData };
        } catch (parseError) {
            // Fallback parsing
            const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const questionData = JSON.parse(jsonMatch[0]);
                return { success: true, data: questionData };
            }
            throw new Error('Could not parse AI response');
        }

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
        return { success: true, data: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

console.log('Background script setup complete');

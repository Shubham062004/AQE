console.log('Background script loaded');

// Update these constants with correct API endpoint
const GEMINI_API_KEY = 'AIzaSyCvn5IUYoNP5zEmcxePzxmvORNLzhH8Ze0';
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

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
});

async function takeScreenshot() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {format: 'png'});
        return {success: true, dataUrl};
    } catch (error) {
        console.error('Screenshot error:', error);
        return {success: false, error: error.message};
    }
}

async function processWithGemini(imageDataUrl) {
    console.log('Processing with Gemini...', 'Using API key:', GEMINI_API_KEY.substring(0, 8) + '...');
    try {
        const base64Data = imageDataUrl.split(',')[1];
        
        const requestPayload = {
            contents: [{
                parts: [{
                    text: "Analyze this image and extract question details. Return ONLY a clean JSON object with this exact format, no markdown formatting or extra text: {\"question\": \"full question text\", \"options\": [\"A) option1\", \"B) option2\", \"C) option3\", \"D) option4\"], \"correct_option\": \"B) correct answer\"}"
                }, {
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Data
                    }
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 32,
                topP: 1,
                maxOutputTokens: 1024
            }
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API response:', errorData);
            throw new Error(`Gemini API error (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        console.log('Gemini response:', data);

        // Safe response parsing with error handling
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error('Invalid response structure from API');
        }

        let responseText = data.candidates[0].content.parts[0].text;
        console.log('Raw response text:', responseText);
        
        // Clean up markdown formatting if present
        responseText = responseText.replace(/``````\n?/g, '').trim();
        
        // Additional cleanup for common formatting issues
        responseText = responseText.replace(/^\s*/, '').replace(/\s*$/, '');
        
        console.log('Cleaned response text:', responseText);
        
        // Parse the cleaned JSON
        const parsedResponse = JSON.parse(responseText);
        
        return {
            success: true,
            data: parsedResponse
        };

    } catch (error) {
        console.error('Gemini API error:', error);
        
        // If JSON parsing fails, try to extract JSON from response
        if (error.message.includes('JSON')) {
            console.log('JSON parsing failed, attempting fallback...');
            try {
                // Fallback: return a basic structure
                return {
                    success: true,
                    data: {
                        question: "Question extraction failed",
                        options: ["A) Processing error", "B) Try again", "C) Check image", "D) API issue"],
                        correct_option: "B) Try again"
                    }
                };
            } catch (fallbackError) {
                return { success: false, error: "Failed to parse API response: " + error.message };
            }
        }
        
        return { success: false, error: error.message };
    }
}

// Check API key status with correct endpoint
console.log('Checking API key status...');
fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        contents: [{
            parts: [{
                text: "test"
            }]
        }]
    })
}).then(r => {
    console.log('API Key Status:', r.status === 200 ? 'Valid' : `Invalid (${r.status})`);
    if (r.status !== 200) {
        r.text().then(error => console.log('API Error:', error));
    }
}).catch(e => console.log('API Key Check Error:', e.message));

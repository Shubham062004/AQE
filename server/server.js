console.log('AI Question Extractor Server Starting...');

// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Get API key from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Validate API key on startup
if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env file!');
    console.log('Please add GEMINI_API_KEY=your_api_key_here to your .env file');
} else {
    console.log('✅ Gemini API key loaded successfully');
}

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let extractedQuestions = [];
console.log('Server middleware configured');

// NEW: AI Processing endpoint
app.post('/process-image', async (req, res) => {
    console.log('AI image processing request received');
    
    try {
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({
                success: false,
                error: 'No image data provided'
            });
        }

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'API key not configured'
            });
        }

        // Process with Gemini AI
        const result = await processWithGeminiAPI(imageData);
        
        if (result.success) {
            // Auto-store the extracted question
            const questionData = {
                id: Date.now(),
                question: result.data.question,
                options: result.data.options,
                correct_option: result.data.correct_option,
                screenshot_url: imageData.substring(0, 100) + '...',
                timestamp: new Date().toISOString(),
                created_at: new Date().toLocaleString(),
                processed_by_ai: true
            };

            extractedQuestions.unshift(questionData);
            console.log('AI extracted question stored, ID:', questionData.id);
            
            res.json({
                success: true,
                data: result.data,
                id: questionData.id,
                message: 'Question extracted and stored successfully'
            });
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('AI processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// AI Processing function
async function processWithGeminiAPI(imageDataUrl) {
    console.log('Processing with Gemini AI...');
    
    try {
        const base64Data = imageDataUrl.split(',')[1];
        console.log('Image data size:', Math.round(base64Data.length / 1024), 'KB');

        const requestPayload = {
            contents: [{
                parts: [
                    {
                        text: `Extract the question and answer options from this image.
Return only valid JSON in this exact format:
{
  "question": "Full question text here",
  "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
  "correct_option": "B) Second option"
}

Rules:
- Extract exact text as shown in the image
- Include A), B), C), D) prefixes in options
- Identify the correct option if highlighted/marked
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        console.log('Gemini response received');

        if (!responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response from Gemini API');
        }

        let extractedText = responseData.candidates[0].content.parts[0].text;
        console.log('Raw AI response:', extractedText);

        // Parse JSON response
        try {
            const cleanText = extractedText.replace(/``````/g, '').trim();
            const questionData = JSON.parse(cleanText);
            
            if (questionData.question && Array.isArray(questionData.options)) {
                console.log('✅ Successfully parsed question data');
                return { success: true, data: questionData };
            } else {
                throw new Error('Invalid question format');
            }
        } catch (parseError) {
            console.warn('JSON parse failed, trying fallback...');
            
            // Fallback: Extract JSON from response
            const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const questionData = JSON.parse(jsonMatch[0]);
                return { success: true, data: questionData };
            }
            
            throw new Error('Could not parse AI response as JSON');
        }

    } catch (error) {
        console.error('Gemini processing failed:', error);
        return { success: false, error: error.message };
    }
}

// Original endpoints
app.post('/submit', (req, res) => {
    console.log('Question submission received');
    try {
        const { question, options, correct_option, screenshot_url } = req.body;

        if (!question || !options) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const questionData = {
            id: Date.now(),
            question,
            options: Array.isArray(options) ? options : [],
            correct_option,
            screenshot_url,
            timestamp: new Date().toISOString(),
            created_at: new Date().toLocaleString(),
            processed_by_ai: false
        };

        extractedQuestions.unshift(questionData);
        console.log('Question stored, ID:', questionData.id);

        res.json({
            success: true,
            id: questionData.id,
            message: 'Question stored successfully'
        });

    } catch (error) {
        console.error('Error storing question:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

app.get('/questions', (req, res) => {
    console.log('Retrieving all questions');
    res.json({
        success: true,
        count: extractedQuestions.length,
        questions: extractedQuestions
    });
});

app.delete('/questions', (req, res) => {
    console.log('Clearing all questions');
    const count = extractedQuestions.length;
    extractedQuestions = [];
    res.json({
        success: true,
        message: `Cleared ${count} questions`
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        questions_count: extractedQuestions.length,
        ai_enabled: !!GEMINI_API_KEY
    });
});

app.listen(PORT, () => {
    console.log('🚀 Server is running!');
    console.log('📍 URL: http://localhost:' + PORT);
    console.log('📊 Dashboard: http://localhost:' + PORT);
    console.log('🤖 AI Processing:', GEMINI_API_KEY ? 'Enabled' : 'Disabled');
    console.log('✅ Ready to receive requests!');
});

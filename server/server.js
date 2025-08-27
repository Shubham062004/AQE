console.log('AI Question Extractor Server Starting...');

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let extractedQuestions = [];

console.log('Server middleware configured');

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
      created_at: new Date().toLocaleString()
    };
    
    extractedQuestions.unshift(questionData);
    
    console.log('Question stored, ID:', questionData.id);
    console.log('Total questions:', extractedQuestions.length);
    
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
    questions_count: extractedQuestions.length
  });
});

app.listen(PORT, () => {
  console.log('Server is running!');
  console.log('URL: http://localhost:' + PORT);
  console.log('Dashboard: http://localhost:' + PORT);
  console.log('Ready to receive requests!');
});


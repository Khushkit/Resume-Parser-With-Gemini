const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cors = require('cors');

require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.static('public'));

const PROMPT = `Summarize the resume below into a JSON with exactly the following structure {basic_info: {first_name, last_name, full_name, email, phone_number, location, portfolio_website_url, linkedin_url, github_main_page_url, university, education_level (BS, MS, or PhD), graduation_year, graduation_month, majors, GPA}, work_experience: [{job_title, company, location, duration, job_summary}], project_experience:[{project_name, project_description}]}`;

app.post('/api/parse', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF uploaded' });
  }

  try {
    const pdfText = (await pdfParse(req.file.buffer)).text;
    const prompt = PROMPT + '\n' + pdfText;

    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    let geminiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let jsonResult = null;
    try {
      jsonResult = JSON.parse(geminiText);
    } catch (e) {
      // Try to extract JSON from text if not pure JSON
      const match = geminiText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          jsonResult = JSON.parse(match[0]);
        } catch (err) {}
      }
    }
    res.json({ raw: geminiText, parsed: jsonResult });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process PDF or call Gemini', details: err.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

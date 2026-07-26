/**
 * test_groq.js — Directly tests GROQ API key works
 * Run: node scripts/test_groq.js
 */
const path = require('path');
const fs = require('fs');

function loadEnvLocal() {
  ['.env.local', '.env'].forEach(fname => {
    const p = path.join(process.cwd(), fname);
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1').replace(/\n/g, '');
      if (!process.env[key]) process.env[key] = value;
    });
  });
}

loadEnvLocal();

const key = process.env.GROQ_API_KEY || '';
console.log('\n🔑 GROQ_API_KEY present:', !!key);
console.log('🔑 Key starts with gsk_:', key.startsWith('gsk_'));
console.log('🔑 Has newline:', key.includes('\n') || key.includes('\r'));

if (!key) {
  console.error('❌ GROQ_API_KEY is empty or not loaded!');
  process.exit(1);
}

const cleanKey = key.replace(/[\r\n]/g, '').trim();

async function testGroq() {
  console.log('\n📡 Testing Groq API with llama-3.1-8b-instant...');
  
  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You generate educational questions. Return JSON.' },
      { role: 'user', content: 'Generate 1 MCQ about Kinematics. Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":"A"}]}' }
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 300,
  };

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    
    if (!resp.ok) {
      console.error('❌ Groq API Error:', resp.status, JSON.stringify(data, null, 2));
      process.exit(1);
    }

    const content = data?.choices?.[0]?.message?.content || '';
    console.log('✅ Groq API works!');
    console.log('📝 Response:', content.slice(0, 300));
    console.log('📊 Model used:', data?.model);
    console.log('📊 Tokens used:', data?.usage?.total_tokens);
    process.exit(0);
  } catch (err) {
    console.error('❌ Network error:', err.message);
    process.exit(1);
  }
}

testGroq();

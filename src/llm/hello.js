require('dotenv').config();
const OpenAI = require('openai');

async function main() {
  const baseURL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'openai/gpt-oss-120b';

  if (!baseURL || !apiKey) {
    console.log('LLM not configured: set LLM_BASE_URL and LLM_API_KEY in .env');
    return;
  }

  const client = new OpenAI({
    baseURL,
    apiKey,
  });

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
    temperature: 0,
  });

  const responseText = completion?.choices?.[0]?.message?.content ?? '';
  console.log(JSON.stringify({ model, response: responseText }, null, 2));
}

main().catch((error) => {
  console.error('LLM hello failed:', error?.message || error);
  process.exitCode = 1;
});

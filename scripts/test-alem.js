#!/usr/bin/env node
// Простой тестовый скрипт для проверки доступа к ALEM (llm.alem.ai).
// Запуск: ALEM_API_KEY=sk-... node scripts/test-alem.js

const key = process.env.ALEM_API_KEY || process.env.VITE_ALEM_API_KEY;
if (!key) {
  console.error('ALEM_API_KEY не задан. Установите переменную окружения ALEM_API_KEY.');
  process.exit(1);
}

async function run() {
  try {
    const res = await fetch('https://llm.alem.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Ты — тестовый агент. Коротко ответь OK.' },
          { role: 'user', content: 'Проверка доступа к ALEM API. Ответь одной фразой.' },
        ],
        max_tokens: 60,
      }),
    });

    const text = await res.text();
    console.log('HTTP', res.status);
    try { console.log(JSON.parse(text)); } catch { console.log(text); }
  } catch (e) {
    console.error('Ошибка запроса:', e);
    process.exit(2);
  }
}

run();

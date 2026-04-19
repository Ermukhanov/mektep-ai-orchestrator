// Node 18+ script to test local function endpoints that call ALEM
// Usage: BASE=http://localhost:8787 node scripts/test-endpoints.js

const BASE = process.env.BASE || 'http://localhost:8787';

async function post(fn, body, auth) {
  const url = `${BASE}/functions/${fn}`;
  console.log('\n==> POST', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: auth } : {}),
      body: JSON.stringify(body || {}),
    });
    const text = await res.text();
    console.log('HTTP', res.status);
    try { console.log(JSON.parse(text)); } catch { console.log(text); }
  } catch (e) {
    console.error('Request failed:', e);
  }
}

(async () => {
  console.log('Base URL:', BASE);

  // 1) generate-schedule
  await post('generate-schedule', { prompt: 'Тест: сгенерируй простое расписание для всех классов', day_of_week: 'monday' });

  // 2) legal-chat (generate document)
  await post('legal-chat', { prompt: 'Сгенерируй приказ по форме 130 о назначении ответственного за аттестацию', order_type: '130', language: 'ru' });

  // 3) voice-task (requires Authorization header; use demo token if local mock accepts it)
  await post('voice-task', { transcript: 'Создать приказ 130 и назначить ответственного', language: 'ru' }, 'Bearer demo-token');

  console.log('\nFinished tests.');
})();

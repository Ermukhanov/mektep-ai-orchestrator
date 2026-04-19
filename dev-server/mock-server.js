import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.MOCK_PORT || 8787;
const dataFile = path.join(process.cwd(), 'dev-server', 'data', 'slots.json');

function readJSON() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (e) { return { slots: [] }; }
}
function writeJSON(obj) {
  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info, x-client-session, range, accept-profile, Accept-Profile, prefer, x-retry-count, accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  if (req.url === '/functions/get-slots' && req.method === 'GET') {
    const json = readJSON();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(json));
  }

  // normalize supabase functions path: allow /functions/v1/... and /functions/...
  const fnPath = req.url.startsWith('/functions/v1/') ? req.url.replace('/functions/v1/', '/functions/') : req.url;

  if (fnPath === '/functions/get-messages' && req.method === 'GET') {
    const msgFile = path.join(process.cwd(), 'dev-server', 'data', 'messages.json');
    try {
      const msgs = JSON.parse(fs.readFileSync(msgFile, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(msgs));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'cannot read messages' }));
    }
  }

  if (fnPath === '/functions/seed-demo-data' && req.method === 'POST') {
    // generate demo data: classes 1-11 (A,B), profiles, attendance summary, slots, tasks
    try {
      const classes = [];
      for (let grade = 1; grade <= 11; grade++) {
        ['A','B'].forEach(sec => classes.push({ name: `${grade}${sec}`, student_count: 20 + Math.floor(Math.random()*6) }));
      }

      const profiles = [];
      const attendanceEvents = { events: [] };
      let studentId = 1;
      for (const cls of classes) {
        const total = cls.student_count;
        const absent = Math.floor(Math.random() * Math.min(6, Math.floor(total/4)) );
        const present = total - absent;
        // create student profiles
        for (let i = 0; i < total; i++) {
          const sid = `s-${studentId}`;
          profiles.push({ id: sid, full_name: `Ученик ${studentId}`, class_name: cls.name, uid: `uid-${studentId}` });
          // mark present for most, absent for some
          const isAbsent = i < absent;
          if (!isAbsent) {
            attendanceEvents.events.push({ id: `a-${Date.now()}-${studentId}`, student_id: sid, class_name: cls.name, status: 'present', created_at: new Date(Date.now() - (studentId%60)*60000).toISOString() });
          } else {
            attendanceEvents.events.push({ id: `a-${Date.now()}-${studentId}`, student_id: sid, class_name: cls.name, status: 'absent', created_at: new Date(Date.now() - (studentId%60)*60000).toISOString() });
          }
          studentId++;
        }
      }

      // write classes file
      const classesFile = path.join(process.cwd(), 'dev-server', 'data', 'classes.json');
      fs.writeFileSync(classesFile, JSON.stringify({ classes }, null, 2), 'utf8');

      // write profiles
      const profilesFile = path.join(process.cwd(), 'dev-server', 'data', 'profiles.json');
      fs.writeFileSync(profilesFile, JSON.stringify({ profiles }, null, 2), 'utf8');

      // write attendance
      const attFile = path.join(process.cwd(), 'dev-server', 'data', 'attendance.json');
      fs.writeFileSync(attFile, JSON.stringify(attendanceEvents, null, 2), 'utf8');

      // write slots demo (simple schedule placeholders)
      const slots = { slots: [] };
      let sidc = 1;
      for (const cls of classes) {
        for (let p = 1; p <= 6; p++) {
          slots.slots.push({ id: `slot-${sidc}`, class_name: cls.name, period: p, subject: ['Math','English','Science','History','PE'][sidc%5], teacher: `T${(sidc%12)+1}`, room: String(100 + (sidc%20)) });
          sidc++;
        }
      }
      const slotsFile = path.join(process.cwd(), 'dev-server', 'data', 'slots.json');
      fs.writeFileSync(slotsFile, JSON.stringify(slots, null, 2), 'utf8');

      // tasks file
      const tasks = { tasks: [ { id: 'task-demo-1', title: 'Проверить посещаемость', created_at: new Date().toISOString(), assignee: 'завхоз' } ] };
      const tasksFile = path.join(process.cwd(), 'dev-server', 'data', 'tasks.json');
      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, classes_count: classes.length, students: studentId-1 }));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
  }

  if (fnPath === '/functions/parse-messages' && req.method === 'POST') {
    // simple parser: extract cafeteria counts and incidents
    const msgFile = path.join(process.cwd(), 'dev-server', 'data', 'messages.json');
    const tasksFile = path.join(process.cwd(), 'dev-server', 'data', 'tasks.json');
    try {
      const msgs = JSON.parse(fs.readFileSync(msgFile, 'utf8')) || [];
      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8')) || { tasks: [] };
      // parse cafeteria lines like "1A - 25 детей, 2 болеют"
      let totalPortions = 0;
      let totalAbsent = 0;
      for (const m of msgs.messages || []) {
        const text = (m.text || '').toLowerCase();
        // cafeteria pattern
        const cafMatch = text.match(/(\d+\w?)\s*-\s*(\d+)\s*дет/i);
        if (cafMatch) {
          totalPortions += Number(cafMatch[2] || 0);
        }
        const absentMatch = text.match(/(\d+)\s*болеют|отсутствуют|пропуск/i);
        if (absentMatch) totalAbsent += Number(absentMatch[1] || 0);
        // incident detection: look for keywords
        if (/сломал|сломалась|сломалась|пожар|утечка|протечка|сломал[а-я]/i.test(text) || /сломалась|сломал/i.test(text)) {
          // create task
          tasks.tasks.push({ id: `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title: 'Инцидент: ' + (m.text || '').slice(0,120), description: m.text, created_at: new Date().toISOString(), assignee: 'zavhoz' });
        }
      }
      const report = { generated_at: new Date().toISOString(), totalPortions, totalAbsent };
      fs.writeFileSync(path.join(process.cwd(), 'dev-server', 'data', 'report.json'), JSON.stringify(report, null, 2), 'utf8');
      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, report, tasks }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (fnPath === '/functions/get-tasks' && req.method === 'GET') {
    const tasksFile = path.join(process.cwd(), 'dev-server', 'data', 'tasks.json');
    try {
      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(tasks));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'cannot read tasks' }));
    }
  }

  if (fnPath === '/functions/voice-task' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        let { transcript, language, audio_base64 } = payload;
        // if audio was sent (base64), simulate transcription
        if (!transcript && audio_base64) {
          transcript = `Тестовая расшифровка аудио, получено ${new Date().toISOString()}`;
        }
        const tasksFile = path.join(process.cwd(), 'dev-server', 'data', 'tasks.json');
        const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8')) || { tasks: [] };

        // Simple splitting heuristics: split by sentences and commas and 'и' (and)
        const parts = (transcript || '').split(/[\.\n\,\;]+/i).map(s => s.trim()).filter(Boolean);
        const created = [];
        for (const p of parts) {
          // try to find assignee name by matching known staff names in data/staff.json if exists
          const assignee = /айгерим|назкен|завхоз|sluzhba|zavhoz/i.test(p) ? 'zavhoz' : 'unk';
          const t = { id: `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title: p.slice(0,80), description: p, created_at: new Date().toISOString(), assignee };
          tasks.tasks.push(t);
          created.push(t);
        }
        fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, created, confirmations: ['Задачи созданы'] }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (fnPath === '/functions/parse-chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { message_id, chat_id, text } = JSON.parse(body || '{}');
        const chatsFile = path.join(process.cwd(), 'dev-server', 'data', 'chats.json');
        let chats = { chats: [] };
        try { chats = JSON.parse(fs.readFileSync(chatsFile, 'utf8')); } catch {}
        // append an auto reply
        const reply = { id: `m-${Date.now()}`, chat_id: chat_id || 'c-1', text: (text ? `Автоответ: ${text}` : 'Автоответ'), from: 'assistant', created_at: new Date().toISOString() };
        chats.chats.push(reply);
        fs.writeFileSync(chatsFile, JSON.stringify(chats, null, 2), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, reply }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/decide-action' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        // simple mock: always suggest creating a task
        const action = { type: 'create_task', title: 'Follow up', description: payload.text || 'Auto-generated task' };
        return res.end(JSON.stringify({ ok: true, action }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/legal-templates' && req.method === 'GET') {
    const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
    try {
      const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8')) || { orders: [] };
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, templates: rag.orders }));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'cannot read templates' })); }
  }

  if (fnPath === '/functions/legal-search' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { q } = JSON.parse(body || '{}');
        const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
        const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8')) || { orders: [] };
        const found = rag.orders.filter(o => (o.title + ' ' + o.body).toLowerCase().includes(String(q||'').toLowerCase()));
        return res.end(JSON.stringify({ ok: true, results: found }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/rag-ingest-legal' && req.method === 'POST') {
    // noop for mock
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  if (fnPath === '/functions/legal-rag-query' && req.method === 'POST') {
    // alias to rag-query
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
        const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8')) || { orders: [] };
        let found = null;
        if (payload.id) found = rag.orders.find(o => String(o.id) === String(payload.id));
        if (!found && payload.q) found = rag.orders.find(o => (o.title + ' ' + o.body).toLowerCase().includes(String(payload.q).toLowerCase()));
        if (!found) return res.end(JSON.stringify({ ok: false, error: 'not found' }));
        return res.end(JSON.stringify({ ok: true, order: found }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/greenapi-webhook' && req.method === 'POST') {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const action = urlObj.searchParams.get('action') || req.headers['x-action'] || 'send';
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        // log WA outbound
        const f = path.join(process.cwd(), 'dev-server', 'data', 'wa_outbound_logs.json');
        let j = { logs: [] };
        try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
        const rec = { id: `w-${Date.now()}`, chat_id: payload.chat_id || payload.to || '+7700', message: payload.message || payload.text || 'тест', response: { status: 'sent' }, created_at: new Date().toISOString() };
        j.logs.push(rec);
        fs.writeFileSync(f, JSON.stringify(j, null, 2), 'utf8');
        return res.end(JSON.stringify({ ok: true, result: rec }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/smart-substitute' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        // return prettier mock suggestions
        const suggestions = [
          { substitution: { id: 'sub-1', absence_id: 'abs-1' }, candidate: { full_name: 'Сапарова Аяулым', subjects: ['Математика'] } },
          { substitution: { id: 'sub-2', absence_id: 'abs-2' }, candidate: { full_name: 'Ибраимов Руслан', subjects: ['Английский'] } }
        ];
        return res.end(JSON.stringify({ ok: true, suggestions }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/confirm-substitution' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try { return res.end(JSON.stringify({ ok: true })); } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // RAG endpoints
  if (fnPath === '/functions/rag-list' && req.method === 'GET') {
    const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
    try {
      const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8'));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(rag));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'cannot read rag' })); }
  }

  if (fnPath === '/functions/rag-query' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { q, id } = JSON.parse(body || '{}');
        const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
        const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8')) || { orders: [] };
        let found = null;
        if (id) found = rag.orders.find(o => String(o.id) === String(id));
        if (!found && q) found = rag.orders.find(o => (o.title + ' ' + o.body).toLowerCase().includes(String(q).toLowerCase()));
        if (!found) return res.end(JSON.stringify({ ok: false, error: 'not found' }));
        return res.end(JSON.stringify({ ok: true, order: found }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/generate-order' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { order_id, fields } = JSON.parse(body || '{}');
        const ragFile = path.join(process.cwd(), 'dev-server', 'data', 'rag.json');
        const rag = JSON.parse(fs.readFileSync(ragFile, 'utf8')) || { orders: [] };
        const order = rag.orders.find(o => String(o.id) === String(order_id));
        if (!order) return res.end(JSON.stringify({ ok: false, error: 'order not found' }));
        // simple template replace {{field}}
        let doc = order.template || order.body || '';
        if (fields) {
          for (const k of Object.keys(fields)) doc = doc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), fields[k]);
        }
        const filename = `order_${order_id}_${new Date().toISOString().slice(0,10)}.txt`;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, doc, filename }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/generate-schedule' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = payload.prompt || 'demo';
        // create improved demo schedule with simple "lenta" (lens) grouping for English
        const slots = [];
        const classes = ['1A','1B','2A','2B','3A','3B','4A','4B'];
        const subjects = ['Math','English','Science','History','PE'];
        let idc = 1;
        for (const cls of classes) {
          for (let p = 1; p <= 6; p++) {
            const sub = subjects[(idc + p) % subjects.length];
            slots.push({ id: `s${idc}`, class_name: cls, period: p, subject: sub, subject_raw: sub, subject_norm: sub.toLowerCase(), teacher: `T${(idc%7)+1}`, teacher_id: `t-${(idc%7)+1}`, room: `${100 + (idc%10)}`, is_lens: false, lens_group: null });
            idc++;
          }
        }

        // Build lens blocks: for subject 'English' create parallel groups across periods
        const lens_blocks = [];
        const englishClasses = classes.slice(0); // all classes considered
        // create 2-3 groups depending on total classes
        const groupsCount = englishClasses.length <= 6 ? 2 : 3;
        for (let p = 1; p <= 6; p++) {
          // pick classes for this period to be in lens
          const perPeriod = englishClasses.filter((_, idx) => (idx + p) % 2 === 0);
          if (perPeriod.length === 0) continue;
          const blockGroups = [];
          // split into groupsCount groups
          for (let g = 0; g < groupsCount; g++) {
            const groupClasses = perPeriod.filter((_, idx) => idx % groupsCount === g);
            if (groupClasses.length === 0) continue;
            const teacher = `Eng-T${g+1}`;
            const room = 200 + g;
            blockGroups.push({ level: g === 0 ? 'intermediate' : g === 1 ? 'pre_intermediate' : 'beginner', teacher, room: String(room), classes_included: groupClasses });
            // mark slots as lens
            for (const cls of groupClasses) {
              const s = slots.find(x => x.class_name === cls && x.period === p);
              if (s) { s.is_lens = true; s.lens_group = `${p}-g${g+1}`; s.subject = 'English'; s.subject_raw = 'English'; s.subject_norm = 'english'; }
            }
          }
          if (blockGroups.length) {
            lens_blocks.push({ period: p, parallel: `P${p}`, subject: 'English', groups: blockGroups });
          }
        }

        const doc = 'Class,Period,Subject,Teacher,Room\n' + slots.map(s => `${s.class_name},${s.period},${s.subject},${s.teacher},${s.room}`).join('\n');
        return res.end(JSON.stringify({ ok: true, slots, lens_blocks, ai_notes: 'Demo schedule generated (improved lents)', elapsedMs: 1200, doc, filename: `schedule_${new Date().toISOString().slice(0,10)}.csv` }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/daily-report' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        // simple morning report: include attendance count and WA logs summary
        const attFile = path.join(process.cwd(), 'dev-server', 'data', 'attendance.json');
        const waFile = path.join(process.cwd(), 'dev-server', 'data', 'wa_outbound_logs.json');
        let att = { events: [] };
        let wa = { logs: [] };
        try { att = JSON.parse(fs.readFileSync(attFile, 'utf8')); } catch {}
        try { wa = JSON.parse(fs.readFileSync(waFile, 'utf8')); } catch {}
        const now = new Date().toISOString();
        const totalAttendance = (att.events || []).length;
        const waCount = (wa.logs || []).length;
        const doc = `generated_at,attendance_count,wa_outbound_count\n${now},${totalAttendance},${waCount}\n`;
        const filename = `daily_report_${new Date().toISOString().slice(0,10)}.csv`;
        return res.end(JSON.stringify({ ok: true, doc, filename }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/nfc-scan' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { uid, student_id, device } = payload;
        if (!uid) return res.end(JSON.stringify({ error: 'uid required' }));
        const attFile = path.join(process.cwd(), 'dev-server', 'data', 'attendance.json');
        let db = { events: [] };
        try { db = JSON.parse(fs.readFileSync(attFile, 'utf8')); } catch (e) { db = { events: [] }; }
        const rec = { id: `a-${Date.now()}`, uid, student_id: student_id || null, device: device || 'test-device', created_at: new Date().toISOString() };
        db.events.push(rec);
        fs.writeFileSync(attFile, JSON.stringify(db, null, 2), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, event: rec }));
      } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  if (fnPath === '/functions/get-attendance' && req.method === 'GET') {
    const attFile = path.join(process.cwd(), 'dev-server', 'data', 'attendance.json');
    try {
      const db = JSON.parse(fs.readFileSync(attFile, 'utf8')) || { events: [] };
      // Refresh timestamps to be near-current each time the tab is opened
      const now = Date.now();
      db.events = (db.events || []).map((e, idx) => ({
        ...e,
        created_at: new Date(now - idx * 60 * 1000).toISOString()
      }));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(db));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'cannot read attendance' })); }
  }

  // Basic REST v1 emulation for `supabase.from(...)` calls in mock mode
  if (req.url.startsWith('/rest/v1/') && req.method === 'GET') {
    // e.g. /rest/v1/profiles?select=user_id,full_name&user_id=eq.local-... 
    const urlParts = req.url.split('?');
    const tablePath = decodeURIComponent(urlParts[0].replace('/rest/v1/', ''));
    const q = new URLSearchParams((urlParts[1] || ''));
    const select = q.get('select');
    // support equality filter user_id=eq.<val>
    const filters = {};
    for (const [k,v] of q.entries()) {
      if (k.includes('=')) continue;
      // v might be like 'eq.local-...'
      const [op,val] = (v || '').split('.');
      if (op === 'eq') filters[k] = val;
      else if (v.startsWith('eq.')) filters[k] = v.replace('eq.', '');
    }

    const dataFile = path.join(process.cwd(), 'dev-server', 'data', `${tablePath}.json`);
    try {
      let j = JSON.parse(fs.readFileSync(dataFile, 'utf8')) || {};
      // if file contains object with key matching table (e.g., { "profiles": [...] }) unwrap
      if (j[tablePath]) j = j[tablePath];
      // j should be an array
      if (!Array.isArray(j)) j = Array.isArray(j.items) ? j.items : [];
      let rows = j;
      // apply filters
      for (const fk of Object.keys(filters)) {
        rows = rows.filter(r => String(r[fk]) === String(filters[fk]));
      }
      // map select columns
      if (select) {
        const cols = select.split(',').map(s => s.trim());
        rows = rows.map(r => {
          const o = {};
          for (const c of cols) if (r[c] !== undefined) o[c] = r[c];
          return o;
        });
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(rows));
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([]));
    }
  }

  if (fnPath === '/functions/get-wa-logs' && req.method === 'GET') {
    const f = path.join(process.cwd(), 'dev-server', 'data', 'wa_outbound_logs.json');
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8')) || { logs: [] };
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(j));
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'cannot read wa logs' })); }
  }

  if (req.url === '/functions/update-slot' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { slot_id, new_period, new_class, new_room, new_teacher_id } = payload;
        if (!slot_id || !new_period || !new_class) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'slot_id, new_period and new_class required' }));
        }
        const db = readJSON();
        const idx = db.slots.findIndex(s => s.id === slot_id);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'slot not found' }));
        }
        db.slots[idx].period = new_period;
        db.slots[idx].class_name = new_class;
        if (new_room) db.slots[idx].room = new_room;
        if (new_teacher_id) db.slots[idx].teacher_id = new_teacher_id;
        writeJSON(db);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, slot: db.slots[idx] }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // fallback: serve README
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => console.log(`Mock server listening on http://localhost:${PORT}`));

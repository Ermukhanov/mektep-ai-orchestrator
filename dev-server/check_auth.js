const fs = require('fs');
(async () => {
  try {
    const envRaw = fs.readFileSync('.env', 'utf8');
    const env = envRaw.split(/\r?\n/).reduce((acc, l) => {
      const m = l.match(/^(\w+)=(?:"|')?(.*?)(?:"|')?$/);
      if (m) acc[m[1]] = m[2];
      return acc;
    }, {});
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    console.log('URL=', url);
    console.log('KEY present=', !!key);
    const email = 'demo+test@example.com';
    const password = 'Password123!';

    console.log('\n-- SIGNUP --');
    let res = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ email, password }),
    });
    console.log('STATUS', res.status);
    console.log('BODY', await res.text());

    console.log('\n-- TOKEN --');
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ email, password }),
    });
    console.log('STATUS', res.status);
    console.log('BODY', await res.text());
  } catch (e) {
    console.error(e);
  }
})();

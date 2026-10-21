// monitor.js
const fs = require('fs');
const path = require('path');

//example for testing
const targets = [
  {
    name: 'Steam Storefront',
    url: 'https://store.steampowered.com/',
    method: 'HEAD',
    expectedStatuses: [200],
  },
  {
    name: 'Steam CM List (Connection Service)',
    url: 'https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0',
    method: 'GET',
    expectedStatuses: [200],
    validateJson: (data) => {
      const count = data?.response?.serverlist?.length || 0;
      return { ok: count > 0, detail: `พบโหนดเซิร์ฟเวอร์ ${count} จุด` };
    }
  },
  {
    name: 'GitHub Status API',
    url: 'https://www.githubstatus.com/api/v2/components.json',
    method: 'GET',
    expectedStatuses: [200],
    validateJson: (data) => {
      const issues = data.components.filter(c => c.status !== 'operational' && !c.name.includes('Visit'));
      return { ok: issues.length === 0, detail: issues.length === 0 ? 'ทุกระบบย่อยปกติ' : `พบปัญหา: ${issues.map(i => i.name).join(', ')}` };
    }
  }
];

async function checkTarget(t) {
  const start = performance.now();
  try {
    const res = await fetch(t.url, {
      method: t.method || 'GET',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'StatusMonitorBot/1.0' }
    });
    const latency = Math.round(performance.now() - start);
    
    if (!t.expectedStatuses.includes(res.status)) {
      return { name: t.name, status: 'DOWN', latency, reason: `HTTP ${res.status}` };
    }

    if (t.validateJson && t.method !== 'HEAD') {
      const json = await res.json();
      const val = t.validateJson(json);
      return { name: t.name, status: val.ok ? 'UP' : 'DEGRADED', latency, reason: val.detail };
    }

    return { name: t.name, status: 'UP', latency, reason: `HTTP ${res.status}` };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return { name: t.name, status: 'DOWN', latency, reason: err.name === 'TimeoutError' ? 'Timeout' : 'Connection Failed' };
  }
}

async function run() {
  console.log('Starting health check...');
  const results = await Promise.all(targets.map(checkTarget));
  
  const output = {
    timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    results
  };

  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(output, null, 2));
  console.log('Status updated successfully.');
}

run();
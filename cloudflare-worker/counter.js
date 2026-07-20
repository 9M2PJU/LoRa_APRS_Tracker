// Cloudflare Worker — multi-project install/download counter using KV storage.
// Not blocked by ad blockers (unlike counterapi.dev).
//
// URL scheme:
//   GET /                  → HTML stats page (card grid + table + bar chart)
//   GET /api/              → JSON map of all project counts
//   GET /<project>/        → return current count for <project> (no increment)
//   GET /<project>/up      → increment <project> counter by 1, return new count
//
// Project types:
//   install  = counted on real successful browser flash (ESP32 firmware)
//   download = counted on download button click (DroidStar APK/Linux packages)
//
// Project names: lowercase letters, digits, hyphens. Stored in KV as
// "project:<name>". KV keys are namespaced so projects never collide.

const PROJECT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Project metadata — display name, page URL, description, type, and category.
//   type:     'install'  = counted on real successful browser flash
//             'download' = counted on download button click
//   category: grouping label for the stats page
// Unknown projects (not in this map) get auto-generated defaults.
const PROJECT_META = {
  'lora-tracker': {
    name: 'LoRa APRS Tracker',
    url: 'https://lora.hamradio.my/',
    desc: 'ESP32 LoRa APRS tracker firmware (Heltec Wireless Tracker)',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'esp32-dx-cluster': {
    name: 'ESP32 DX Cluster Client',
    url: 'https://esp32dxcluster.hamradio.my/',
    desc: 'Standalone DX cluster client firmware for 22 ESP32 boards',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'esp32-fox-hunt': {
    name: 'ESP32 Fox Hunt Beacon',
    url: 'https://fox.hamradio.my/',
    desc: 'Fox hunting beacon firmware for 32 ESP32 boards',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'droidstar-android-stable': {
    name: 'DroidStar Android (Stable)',
    url: 'https://droidstar.hamradio.my/',
    desc: 'Android digital voice client — stable build APK',
    type: 'download',
    category: 'Android App',
  },
  'droidstar-android-experimental': {
    name: 'DroidStar Android (Experimental)',
    url: 'https://droidstar.hamradio.my/',
    desc: 'Android digital voice client — experimental redesigned UI APK',
    type: 'download',
    category: 'Android App',
  },
  'droidstar-linux-deb': {
    name: 'DroidStar Linux (.deb)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Debian/Ubuntu package (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-rpm': {
    name: 'DroidStar Linux (.rpm)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Fedora/RHEL package (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-pkg': {
    name: 'DroidStar Linux (Arch .pkg.tar.zst)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Arch Linux package (x86_64 + aarch64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-appimage': {
    name: 'DroidStar Linux (AppImage)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Portable AppImage (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-flatpak': {
    name: 'DroidStar Linux (Flatpak)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Sandboxed Flatpak (x86_64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-snap': {
    name: 'DroidStar Linux (Snap)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Ubuntu Snap package (x86_64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-tarball': {
    name: 'DroidStar Linux (.tar.gz)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Manual install tarball (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderStatsPage(counts) {
  const projects = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = projects.reduce((sum, [, c]) => sum + c, 0);
  const maxCount = projects.length ? Math.max(...projects.map(([, c]) => c), 1) : 1;

  // Group projects by category
  const categories = {};
  projects.forEach(([key, count]) => {
    const meta = PROJECT_META[key] || { name: key, url: null, desc: '', type: 'download', category: 'Other' };
    if (!categories[meta.category]) categories[meta.category] = [];
    categories[meta.category].push({ key, count, meta });
  });
  const categoryOrder = ['ESP32 Firmware', 'Android App', 'Linux Packages', 'Other'];
  const sortedCategories = Object.keys(categories).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  // Cards grouped by category
  const cardsByCategory = sortedCategories.map(cat => {
    const cards = categories[cat].map(({ key, count, meta }) => {
      const noun = meta.type === 'install' ? 'installs' : 'downloads';
      const link = meta.url
        ? `<a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener" class="card-link">Open page &rarr;</a>`
        : '';
      return `<div class="card">
        <div class="card-name">${escapeHtml(meta.name)}</div>
        <div class="card-count">${count}</div>
        <div class="card-unit">${noun}</div>
        <div class="card-desc">${escapeHtml(meta.desc)}</div>
        ${link}
      </div>`;
    }).join('\n');
    return `<h2>${escapeHtml(cat)}</h2><div class="card-grid">${cards}</div>`;
  }).join('\n');

  // Table rows grouped by category
  const tableRowsByCategory = sortedCategories.map(cat => {
    const rows = categories[cat].map(({ key, count, meta }) => {
      const noun = meta.type === 'install' ? 'installs' : 'downloads';
      const link = meta.url
        ? `<a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener">${escapeHtml(meta.name)}</a>`
        : escapeHtml(meta.name);
      return `<tr><td>${link}</td><td class="type">${noun}</td><td class="num">${count}</td></tr>`;
    }).join('');
    return `<tr class="cat-row"><td colspan="3">${escapeHtml(cat)}</td></tr>${rows}`;
  }).join('');

  // Bar chart grouped by category
  const barsByCategory = sortedCategories.map(cat => {
    const bars = categories[cat].map(({ key, count, meta }) => {
      const pct = Math.round((count / maxCount) * 100);
      const link = meta.url
        ? `<a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener" class="bar-label">${escapeHtml(meta.name)}</a>`
        : `<span class="bar-label">${escapeHtml(meta.name)}</span>`;
      return `<div class="bar-row">
        <div class="bar-label-wrap">${link}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-count">${count}</div>
      </div>`;
    }).join('');
    return `<div class="bar-cat-label">${escapeHtml(cat)}</div><div class="bar-chart">${bars}</div>`;
  }).join('');

  const emptyMsg = projects.length === 0
    ? '<p class="empty">No activity yet. Counts will appear here after the first install or download.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>9M2PJU Project Stats — Downloads &amp; Installs</title>
<link rel="icon" type="image/png" href="https://lora.hamradio.my/favicon.png">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: linear-gradient(135deg, #0d1b2a 0%, #050f1a 100%);
    color: #e0e0e0;
    min-height: 100vh;
    padding: 20px;
  }
  .container { max-width: 1100px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 40px; }
  header h1 {
    font-size: 2rem;
    color: #07b6d3;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }
  header .total {
    font-size: 1.1rem;
    color: #8ab8f0;
  }
  header .total strong {
    font-size: 1.8rem;
    color: #6ab0ff;
    display: block;
    margin-top: 4px;
  }
  header .refresh-indicator {
    font-size: 0.75rem;
    color: #506080;
    margin-top: 10px;
  }
  header .note {
    font-size: 0.75rem;
    color: #506080;
    margin-top: 6px;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
  h2 {
    color: #07b6d3;
    font-size: 1.2rem;
    margin: 40px 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #1e293b;
  }

  /* Card grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .card {
    background: #111827;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 20px;
    transition: border-color 0.2s, transform 0.2s;
  }
  .card:hover {
    border-color: #07b6d3;
    transform: translateY(-2px);
  }
  .card-name {
    font-size: 1rem;
    color: #e0e0e0;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .card-count {
    font-size: 2.5rem;
    font-weight: bold;
    color: #6ab0ff;
    line-height: 1;
    display: inline-block;
  }
  .card-unit {
    font-size: 0.85rem;
    color: #64748b;
    display: inline-block;
    margin-left: 6px;
  }
  .card-desc {
    font-size: 0.8rem;
    color: #64748b;
    margin: 8px 0 12px;
    min-height: 2.4em;
  }
  .card-link {
    font-size: 0.8rem;
    color: #07b6d3;
    text-decoration: none;
  }
  .card-link:hover { text-decoration: underline; }

  /* Table */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    border: 1px solid #1e293b;
    padding: 10px 14px;
    text-align: left;
  }
  th {
    background: #111827;
    color: #07b6d3;
    font-weight: 600;
  }
  td { color: #cbd5e1; }
  td.type {
    color: #64748b;
    font-size: 0.8rem;
  }
  td.num {
    text-align: right;
    font-weight: bold;
    color: #6ab0ff;
    font-size: 1.1rem;
  }
  tr.cat-row td {
    background: #0d1526;
    color: #07b6d3;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  tr:nth-child(even):not(.cat-row) { background: #0d1526; }
  table a { color: #07b6d3; text-decoration: none; }
  table a:hover { text-decoration: underline; }

  /* Bar chart */
  .bar-cat-label {
    color: #07b6d3;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 20px 0 10px;
  }
  .bar-chart { display: flex; flex-direction: column; gap: 12px; }
  .bar-row {
    display: grid;
    grid-template-columns: 200px 1fr 50px;
    align-items: center;
    gap: 12px;
  }
  .bar-label-wrap { text-align: right; font-size: 0.85rem; }
  .bar-label { color: #cbd5e1; text-decoration: none; }
  a.bar-label:hover { color: #07b6d3; text-decoration: underline; }
  .bar-track {
    background: #111827;
    border: 1px solid #1e293b;
    border-radius: 4px;
    height: 24px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #07b6d3, #6ab0ff);
    border-radius: 3px;
    transition: width 0.8s ease;
    min-width: 2px;
  }
  .bar-count {
    font-weight: bold;
    color: #6ab0ff;
    font-size: 0.95rem;
    text-align: left;
  }

  .empty {
    text-align: center;
    color: #506080;
    padding: 40px;
    font-size: 0.9rem;
  }

  footer {
    text-align: center;
    margin-top: 50px;
    padding-top: 20px;
    border-top: 1px solid #1e293b;
    font-size: 0.8rem;
    color: #506080;
  }
  footer a { color: #07b6d3; text-decoration: none; }
  footer a:hover { text-decoration: underline; }

  @media (max-width: 600px) {
    .bar-row { grid-template-columns: 120px 1fr 40px; }
    .bar-label-wrap { font-size: 0.75rem; }
    header h1 { font-size: 1.5rem; }
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>9M2PJU Project Stats</h1>
    <div class="total">Total downloads and installs across all projects
      <strong>${total}</strong>
    </div>
    <div class="refresh-indicator">Auto-refreshing every 30s</div>
    <div class="note">
      ESP32 firmware counts reflect <strong>successful browser flashes</strong>.
      DroidStar counts reflect <strong>download button clicks</strong> (the actual
      file is fetched from GitHub Releases and cannot be verified by this counter).
    </div>
  </header>

  ${emptyMsg}

  ${cardsByCategory}

  <h2>Summary Table</h2>
  <table>
    <thead><tr><th>Project</th><th>Type</th><th>Count</th></tr></thead>
    <tbody>${tableRowsByCategory}</tbody>
  </table>

  <h2>Comparison Chart</h2>
  ${barsByCategory}

  <footer>
    Powered by <a href="https://counter.hamradio.my/">counter.hamradio.my</a>
  </footer>
</div>

<script>
(function() {
  function refresh() {
    fetch('/api/')
      .then(function(r) { return r.json(); })
      .then(function() { location.reload(); })
      .catch(function() {});
  }
  setInterval(refresh, 30000);
})();
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // GET /api/ → JSON map of all project counts
    if (parts.length === 1 && parts[0] === 'api') {
      const list = await env.COUNTER_KV.list({ prefix: 'project:' });
      const entries = await Promise.all(
        list.keys.map(async (k) => {
          const name = k.name.slice('project:'.length);
          const val = await env.COUNTER_KV.get(k.name);
          return [name, parseInt(val || '0', 10)];
        })
      );
      const map = Object.fromEntries(entries);
      return new Response(JSON.stringify(map), { headers: corsHeaders });
    }

    // GET / → HTML stats page
    if (parts.length === 0) {
      const list = await env.COUNTER_KV.list({ prefix: 'project:' });
      const entries = await Promise.all(
        list.keys.map(async (k) => {
          const name = k.name.slice('project:'.length);
          const val = await env.COUNTER_KV.get(k.name);
          return [name, parseInt(val || '0', 10)];
        })
      );
      const counts = Object.fromEntries(entries);
      const html = renderStatsPage(counts);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // /<project> or /<project>/up
    const project = parts[0];
    if (!PROJECT_RE.test(project)) {
      return new Response(JSON.stringify({ error: 'invalid project name' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const key = 'project:' + project;
    const action = parts[1] || '';

    if (action === 'up') {
      let current = parseInt(await env.COUNTER_KV.get(key) || '0', 10);
      current += 1;
      await env.COUNTER_KV.put(key, current.toString());
      return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
    }

    // Default: return current count (no increment)
    let current = parseInt(await env.COUNTER_KV.get(key) || '0', 10);
    return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
  },
};

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
  '9m2pju-mod-lora-tracker-firmware': {
    name: '9M2PJU-Mod-LoRa-APRS-Tracker',
    url: 'https://lora.hamradio.my/',
    desc: 'ESP32 LoRa APRS tracker firmware (Heltec Wireless Tracker)',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'esp32-dx-cluster': {
    name: '9M2PJU-ESP32-DX-Cluster-Client',
    url: 'https://esp32dxcluster.hamradio.my/',
    desc: 'Standalone DX cluster client firmware for 22 ESP32 boards',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'esp32-fox-hunt': {
    name: '9M2PJU-ESP32-Fox-Hunt-Beacon',
    url: 'https://fox.hamradio.my/',
    desc: 'Fox hunting beacon firmware for 32 ESP32 boards',
    type: 'install',
    category: 'ESP32 Firmware',
  },
  'droidstar-android-stable': {
    name: 'DroidStar-9M2PJU-Mod (Stable)',
    url: 'https://droidstar.hamradio.my/',
    desc: 'Android digital voice client — stable build APK',
    type: 'download',
    category: 'Android App',
  },
  'droidstar-android-experimental': {
    name: 'DroidStar-9M2PJU-Mod (Experimental)',
    url: 'https://droidstar.hamradio.my/',
    desc: 'Android digital voice client — experimental redesigned UI APK',
    type: 'download',
    category: 'Android App',
  },
  'droidstar-linux-deb': {
    name: 'DroidStar-Linux (.deb)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Debian/Ubuntu package (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-rpm': {
    name: 'DroidStar-Linux (.rpm)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Fedora/RHEL package (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-pkg': {
    name: 'DroidStar-Linux (Arch .pkg.tar.zst)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Arch Linux package (x86_64 + aarch64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-appimage': {
    name: 'DroidStar-Linux (AppImage)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Portable AppImage (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-flatpak': {
    name: 'DroidStar-Linux (Flatpak)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Sandboxed Flatpak (x86_64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-snap': {
    name: 'DroidStar-Linux (Snap)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Ubuntu Snap package (x86_64)',
    type: 'download',
    category: 'Linux Packages',
  },
  'droidstar-linux-tarball': {
    name: 'DroidStar-Linux (.tar.gz)',
    url: 'https://droidstar-linux.hamradio.my/',
    desc: 'Manual install tarball (amd64 + arm64)',
    type: 'download',
    category: 'Linux Packages',
  },
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Convert ISO 3166-1 alpha-2 country code to emoji flag.
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  const A = 0x1F1E6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

// Parse User-Agent into a compact "Browser/OS" label.
// Only categorizes into major browsers and OSes — no version numbers stored.
function parseUserAgent(ua) {
  if (!ua) return 'Other/Other';
  let browser = 'Other', os = 'Other';
  // OS detection (order matters — check mobile first)
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  // Browser detection (order matters — check Edge/Opera before Chrome)
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  return browser + '/' + os;
}

// Country code → short display name (for tooltip/title attr).
// Falls back to the raw code if unknown.
const COUNTRY_NAMES = {
  MY:'Malaysia', US:'United States', GB:'United Kingdom', JP:'Japan',
  DE:'Germany', FR:'France', AU:'Australia', CA:'Canada', BR:'Brazil',
  IN:'India', ID:'Indonesia', TH:'Thailand', SG:'Singapore', PH:'Philippines',
  VN:'Vietnam', CN:'China', KR:'South Korea', TW:'Taiwan', HK:'Hong Kong',
  NL:'Netherlands', ES:'Spain', IT:'Italy', RU:'Russia', SE:'Sweden',
  NO:'Norway', FI:'Finland', DK:'Denmark', PL:'Poland', TR:'Turkey',
  ZA:'South Africa', MX:'Mexico', AR:'Argentina', NZ:'New Zealand',
  AE:'UAE', SA:'Saudi Arabia', EG:'Egypt', NG:'Nigeria', KE:'Kenya',
  PT:'Portugal', BE:'Belgium', CH:'Switzerland', AT:'Austria', IE:'Ireland',
  CZ:'Czechia', RO:'Romania', HU:'Hungary', GR:'Greece', IL:'Israel',
  PK:'Pakistan', BD:'Bangladesh', LK:'Sri Lanka', MM:'Myanmar', KH:'Cambodia',
  LA:'Laos', BN:'Brunei', ET:'Ethiopia', GH:'Ghana', TZ:'Tanzania',
  UG:'Uganda', MA:'Morocco', DZ:'Algeria', TN:'Tunisia', UA:'Ukraine',
  HR:'Croatia', SK:'Slovakia', SI:'Slovenia', BG:'Bulgaria', RS:'Serbia',
  LT:'Lithuania', LV:'Latvia', EE:'Estonia', IS:'Iceland', LU:'Luxembourg',
  MT:'Malta', CY:'Cyprus', CO:'Colombia', CL:'Chile', PE:'Peru', VE:'Venezuela',
  EC:'Ecuador', UY:'Uruguay', PY:'Paraguay', BO:'Bolivia', CR:'Costa Rica',
  PA:'Panama', GT:'Guatemala', CU:'Cuba', DO:'Dominican Rep', JM:'Jamaica',
};

function renderStatsPage(counts, analytics) {
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
      // Analytics: top countries (flags) + device breakdown
      const an = analytics[key] || { countries: {}, devices: {} };
      const topCountries = Object.entries(an.countries || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 8);
      const countryFlags = topCountries.length
        ? '<div class="card-flags">' + topCountries.map(([cc, n]) => {
            const flag = countryFlag(cc);
            const name = COUNTRY_NAMES[cc] || cc;
            return `<span class="flag" title="${escapeHtml(name)}: ${n}">${flag}<sup>${n}</sup></span>`;
          }).join('') + '</div>'
        : '';
      const topDevices = Object.entries(an.devices || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 5);
      const deviceList = topDevices.length
        ? '<div class="card-devices">' + topDevices.map(([d, n]) =>
            `<span class="dev">${escapeHtml(d)} <em>${n}</em></span>`
          ).join('') + '</div>'
        : '';
      return `<div class="card">
        <div class="card-name">${escapeHtml(meta.name)}</div>
        <div class="card-count">${count}</div>
        <div class="card-unit">${noun}</div>
        <div class="card-desc">${escapeHtml(meta.desc)}</div>
        ${countryFlags}
        ${deviceList}
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
<title>9M2PJU Open Source Ham Radio Project Stats — Live Download &amp; Install Counters</title>
<meta name="description" content="Live download and install counters for 9M2PJU open source amateur radio projects: LoRa APRS Tracker, ESP32 DX Cluster Client, ESP32 Fox Hunt Beacon, DroidStar Android, and DroidStar Linux. Real-time stats powered by Cloudflare.">
<meta name="keywords" content="9M2PJU, amateur radio, ham radio, APRS, LoRa, ESP32, firmware, DroidStar, DMR, M17, YSF, P25, NXDN, open source, download counter, install stats, fox hunting, DX cluster, Malaysia ham radio">
<meta name="author" content="9M2PJU">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0d1b2a">
<link rel="canonical" href="https://counter.hamradio.my/">
<link rel="icon" type="image/png" href="https://lora.hamradio.my/favicon.png">
<link rel="apple-touch-icon" href="https://lora.hamradio.my/logo.png">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="9M2PJU Ham Radio Projects">
<meta property="og:title" content="9M2PJU Open Source Ham Radio Project Stats — Live Counters">
<meta property="og:description" content="Live download and install counters for 9M2PJU amateur radio firmware and apps: LoRa APRS Tracker, ESP32 DX Cluster, ESP32 Fox Hunt Beacon, DroidStar Android &amp; Linux. ${total} total installs and downloads.">
<meta property="og:url" content="https://counter.hamradio.my/">
<meta property="og:image" content="https://lora.hamradio.my/logo.png">
<meta property="og:image:alt" content="9M2PJU amateur radio open source projects">
<meta property="og:locale" content="en_US">

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@9M2PJU">
<meta name="twitter:creator" content="@9M2PJU">
<meta name="twitter:title" content="9M2PJU Open Source Ham Radio Project Stats">
<meta name="twitter:description" content="Live download and install counters for 9M2PJU amateur radio firmware and apps. ${total} total installs and downloads across all projects.">
<meta name="twitter:image" content="https://lora.hamradio.my/logo.png">
<meta name="twitter:image:alt" content="9M2PJU amateur radio open source projects">

<!-- Structured data for search engines -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "9M2PJU Project Stats",
  "url": "https://counter.hamradio.my/",
  "description": "Live download and install counters for 9M2PJU open source amateur radio projects",
  "publisher": {
    "@type": "Person",
    "name": "9M2PJU",
    "url": "https://hamradio.my/"
  },
  "about": [
    {"@type": "SoftwareApplication", "name": "LoRa_APRS_Tracker", "applicationCategory": "Firmware", "operatingSystem": "ESP32"},
    {"@type": "SoftwareApplication", "name": "9M2PJU-ESP32-DX-Cluster-Client", "applicationCategory": "Firmware", "operatingSystem": "ESP32"},
    {"@type": "SoftwareApplication", "name": "9M2PJU-ESP32-Fox-Hunt-Beacon", "applicationCategory": "Firmware", "operatingSystem": "ESP32"},
    {"@type": "SoftwareApplication", "name": "DroidStar-9M2PJU-Mod", "applicationCategory": "Android App", "operatingSystem": "Android"},
    {"@type": "SoftwareApplication", "name": "DroidStar-Linux", "applicationCategory": "Linux Application", "operatingSystem": "Linux"}
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is counter.hamradio.my?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "counter.hamradio.my is a live stats dashboard showing download and install counts for 9M2PJU open source amateur radio projects, including ESP32 firmware (LoRa APRS Tracker, DX Cluster Client, Fox Hunt Beacon) and the DroidStar digital voice client for Android and Linux."
      }
    },
    {
      "@type": "Question",
      "name": "How are installs counted?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ESP32 firmware counts reflect successful browser flashes verified by the ESP Web Tools dialog. DroidStar counts reflect download button clicks on the project pages. All counts are stored in Cloudflare KV storage and update in real time."
      }
    },
    {
      "@type": "Question",
      "name": "Are these open source projects free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, all 9M2PJU amateur radio projects are open source and free to download. ESP32 firmware is flashed directly from the browser, and DroidStar is available as an Android APK or Linux packages (deb, rpm, AppImage, Flatpak, Snap, Arch pkg)."
      }
    }
  ]
}
</script>
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
  .card-flags {
    font-size: 1.3rem;
    margin: 8px 0 6px;
    line-height: 1.4;
    letter-spacing: 1px;
  }
  .card-flags .flag {
    margin-right: 6px;
    display: inline-block;
  }
  .card-flags .flag sup {
    font-size: 0.6rem;
    color: #6ab0ff;
    font-weight: 600;
    margin-left: 1px;
  }
  .card-devices {
    font-size: 0.7rem;
    color: #64748b;
    margin-bottom: 10px;
    line-height: 1.5;
  }
  .card-devices .dev {
    display: inline-block;
    margin-right: 8px;
    background: #0d1526;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid #1e293b;
  }
  .card-devices .dev em {
    color: #6ab0ff;
    font-style: normal;
    font-weight: 600;
  }

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

  /* Visually hidden but crawlable by search engines (sr-only pattern).
     Google ignores display:none and visibility:hidden content, but
     indexes content positioned off-screen with aria-label. */
  .seo-content {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .seo-content h2,
  .seo-content h3 { margin-top: 1.2em; }
  .seo-content p { margin: 0.6em 0; }
  .seo-content ul { padding-left: 1.5em; }
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

  <!-- Crawlable descriptive content for search engines (visually hidden but
       indexed). The dashboard above is mostly numbers; this gives Google/Bing
       real text content to rank the page by. -->
  <section class="seo-content" aria-label="About these projects">
    <h2>9M2PJU Open Source Amateur Radio Projects</h2>
    <p>
      <strong>9M2PJU</strong> is an amateur radio operator and open source
      developer based in Malaysia, building free firmware and apps for the
      ham radio community. This page shows <strong>live download and install
      counters</strong> for all released projects, updated in real time via
      Cloudflare Workers and KV storage.
    </p>

    <h3>LoRa APRS Tracker Firmware (LoRa_APRS_Tracker)</h3>
    <p>
      An ESP32 LoRa APRS tracker firmware for the Heltec Wireless Tracker
      board. Forked from CA2RXU's LoRa APRS Tracker and tuned for Malaysian
      use cases &mdash; smart beaconing presets for hiking/SOTA, motorcycle,
      and car, with battery-preserving transmission rates. Supports APRS
      messaging, Winlink, BLN bulletins, SOTA/POTA reports, and the APRSMY
      Sunday Net check-in. Install directly from the browser at
      <a href="https://lora.hamradio.my/">lora.hamradio.my</a> &mdash; no
      app or USB driver setup required.
    </p>

    <h3>ESP32 DX Cluster Client (9M2PJU-ESP32-DX-Cluster-Client)</h3>
    <p>
      A standalone DX cluster client firmware that runs on 22 popular ESP32
      boards with a built-in screen (LilyGO, M5Stack, Heltec, Sunton,
      Waveshare). Connects to any DXSpider-compatible DX cluster over telnet
      and shows live DX spots on the display with band colours, battery
      monitoring, and a one-button command menu. Flash from the browser at
      <a href="https://esp32dxcluster.hamradio.my/">esp32dxcluster.hamradio.my</a>.
    </p>

    <h3>ESP32 Fox Hunt Beacon (9M2PJU-ESP32-Fox-Hunt-Beacon)</h3>
    <p>
      A fox hunting beacon firmware for 32 ESP32 boards. Transmits a
      periodic carrier or message on a configured frequency so radio fox
      hunters can direction-find it. Supports multiple beacon modes,
      scheduled transmissions, and battery-eco mode. Flash from the browser
      at <a href="https://fox.hamradio.my/">fox.hamradio.my</a>.
    </p>

    <h3>DroidStar 9M2PJU Mod (Android)</h3>
    <p>
      A modified build of Doug McLain's DroidStar digital voice client for
      Android, supporting DMR, M17, YSF, P25, and NXDN reflectors. Available
      as a stable build (original UI) and an experimental build (redesigned
      modern UI with bottom navigation and card layouts). Download the APK
      at <a href="https://droidstar.hamradio.my/">droidstar.hamradio.my</a>.
      Requires Android 12 or later, no root needed.
    </p>

    <h3>DroidStar Linux</h3>
    <p>
      The DroidStar digital voice client packaged for Linux, available in
      seven formats: <strong>.deb</strong> (Debian/Ubuntu),
      <strong>.rpm</strong> (Fedora/RHEL), <strong>Arch .pkg.tar.zst</strong>,
      <strong>AppImage</strong> (portable), <strong>Flatpak</strong>
      (sandboxed), <strong>Snap</strong> (Ubuntu), and
      <strong>.tar.gz</strong> (manual install). Both amd64 (x86_64) and
      arm64 (aarch64) architectures are supported where applicable. Download
      at <a href="https://droidstar-linux.hamradio.my/">droidstar-linux.hamradio.my</a>.
    </p>

    <h3>How the counters work</h3>
    <p>
      ESP32 firmware counters increment only when a user successfully
      completes a browser flash &mdash; the ESP Web Tools dialog must report
      <code>state === 'finished'</code>. Cancelled or failed installs are
      not counted. DroidStar counters increment on download button clicks;
      the actual file is fetched from GitHub Releases and cannot be verified
      by this counter, so those numbers reflect download intent rather than
      completed downloads. All counts are stored in
      <strong>Cloudflare KV</strong> storage and served by a
      <strong>Cloudflare Worker</strong> at counter.hamradio.my &mdash; this
      domain is not on any ad blocker filter list, so counts work even when
      uBlock Origin or similar extensions are enabled.
    </p>

    <h3>Links</h3>
    <ul>
      <li><a href="https://hamradio.my/">9M2PJU Ham Radio homepage</a></li>
      <li><a href="https://lora.hamradio.my/">LoRa APRS Tracker web flasher</a></li>
      <li><a href="https://esp32dxcluster.hamradio.my/">ESP32 DX Cluster Client web flasher</a></li>
      <li><a href="https://fox.hamradio.my/">ESP32 Fox Hunt Beacon web flasher</a></li>
      <li><a href="https://droidstar.hamradio.my/">DroidStar Android download page</a></li>
      <li><a href="https://droidstar-linux.hamradio.my/">DroidStar Linux download page</a></li>
      <li><a href="https://github.com/9M2PJU">9M2PJU on GitHub</a></li>
    </ul>
  </section>
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

    // GET /robots.txt → allow all crawlers, point to sitemap
    if (parts.length === 1 && parts[0] === 'robots.txt') {
      const body = 'User-agent: *\nAllow: /\n\nSitemap: https://counter.hamradio.my/sitemap.xml\n';
      return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // GET /sitemap.xml → sitemap for search engines
    if (parts.length === 1 && parts[0] === 'sitemap.xml') {
      const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n' +
        '    <loc>https://counter.hamradio.my/</loc>\n' +
        '    <changefreq>hourly</changefreq>\n' +
        '    <priority>1.0</priority>\n' +
        '  </url>\n' +
        '</urlset>\n';
      return new Response(body, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
      });
    }

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
      const projectKeys = list.keys
        .map(k => k.name.slice('project:'.length))
        .filter(name => !name.includes(':')); // skip non-project keys
      const [countEntries, analyticsEntries] = await Promise.all([
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('project:' + name);
          return [name, parseInt(val || '0', 10)];
        })),
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('analytics:' + name);
          return [name, val ? JSON.parse(val) : { countries: {}, devices: {} }];
        })),
      ]);
      const counts = Object.fromEntries(countEntries);
      const analytics = Object.fromEntries(analyticsEntries);
      const html = renderStatsPage(counts, analytics);
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
      // Increment count
      let current = parseInt(await env.COUNTER_KV.get(key) || '0', 10);
      current += 1;
      await env.COUNTER_KV.put(key, current.toString());

      // Record analytics: country (from Cloudflare geoip) + device (from UA)
      // No IP address or raw UA string is stored — only aggregated counts.
      const country = (request.cf && request.cf.country) || null;
      const device = parseUserAgent(request.headers.get('User-Agent') || '');
      const aKey = 'analytics:' + project;
      let an = { countries: {}, devices: {} };
      try {
        const raw = await env.COUNTER_KV.get(aKey);
        if (raw) an = JSON.parse(raw);
      } catch (e) {}
      if (country) an.countries[country] = (an.countries[country] || 0) + 1;
      an.devices[device] = (an.devices[device] || 0) + 1;
      await env.COUNTER_KV.put(aKey, JSON.stringify(an));

      return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
    }

    // Default: return current count (no increment)
    let current = parseInt(await env.COUNTER_KV.get(key) || '0', 10);
    return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
  },
};

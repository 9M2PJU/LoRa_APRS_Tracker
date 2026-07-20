// Cloudflare Worker — multi-project install/download counter using KV storage.
// Not blocked by ad blockers (unlike counterapi.dev).
//
// URL scheme:
//   GET /                       → HTML stats page (card grid + table + bar chart)
//   GET /api/                   → JSON map of all project counts
//   GET /api/recent             → JSON array of recent activity events
//   GET /<project>/             → return current count for <project> (no increment)
//   GET /<project>/up           → increment <project> counter by 1, return new count
//   GET /badge/<project>.svg    → shields.io-style SVG badge
//
// Project types:
//   install  = counted on real successful browser flash (ESP32 firmware)
//   download = counted on download button click (DroidStar APK/Linux packages)
//
// Project names: lowercase letters, digits, hyphens. Stored in KV as
// "project:<name>". KV keys are namespaced so projects never collide.
//
// Additional KV keys (written on each /up):
//   first_install:<project>  → ISO timestamp of first install
//   trend:<project>          → JSON array of last 30 daily counts
//   analytics:<project>      → { countries: {}, devices: {} }
//   recent_activity          → JSON array of last 50 events
//   map_dots                 → JSON array of last 200 location dots

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

// Milestone thresholds: count → { label, color }
const MILESTONES = [
  { n: 5000, label: 'Platinum', color: '#e5e4e2' },
  { n: 1000, label: 'Gold', color: '#ffd700' },
  { n: 500, label: 'Silver', color: '#c0c0c0' },
  { n: 100, label: 'Bronze', color: '#cd7f32' },
];

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

// Format an ISO timestamp into "Mon YYYY" (e.g. "Jul 2026").
function formatSinceMonth(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Format a timestamp into a relative time string.
function formatRelativeTime(ts) {
  if (!ts) return 'just now';
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + ' min ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' hr ago';
  const days = Math.floor(hr / 24);
  return days + 'd ago';
}

// Return the highest milestone reached for a given count, or null.
function getMilestone(count) {
  for (const m of MILESTONES) {
    if (count >= m.n) return m;
  }
  return null;
}

// Render a mini sparkline SVG (60x20) from a trend array of {d, n}.
function renderSparkline(trend) {
  if (!trend || trend.length < 2) return '';
  const ns = trend.map(e => e.n || 0);
  const max = Math.max(...ns, 1);
  const min = Math.min(...ns, 0);
  const range = Math.max(1, max - min);
  const w = 60, h = 20, pad = 2;
  const step = (w - pad * 2) / (ns.length - 1);
  const points = ns.map((n, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (n - min) / range);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return `<svg class="sparkline" width="60" height="20" viewBox="0 0 60 20" xmlns="http://www.w3.org/2000/svg"><polyline points="${points}" fill="none" stroke="#6ab0ff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// Render a shields.io-style SVG badge for a project.
function renderBadge(project, count) {
  const meta = PROJECT_META[project] || { type: 'download' };
  const label = meta.type === 'install' ? 'installs' : 'downloads';
  const valStr = String(count);
  const labelW = 58;
  const valW = Math.max(32, valStr.length * 8 + 14);
  const totalW = labelW + valW;
  const h = 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}">
<linearGradient id="bg" x2="0" y2="1">
<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
<stop offset="1" stop-color="#000" stop-opacity=".1"/>
</linearGradient>
<rect rx="4" width="${totalW}" height="${h}" fill="#4a4a4a"/>
<rect x="${labelW}" width="${valW}" height="${h}" fill="#07b6d3"/>
<rect rx="4" width="${totalW}" height="${h}" fill="url(#bg)"/>
<text x="${labelW / 2}" y="14" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" fill="#fff">${escapeHtml(label)}</text>
<text x="${labelW + valW / 2}" y="14" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" fill="#fff">${escapeHtml(valStr)}</text>
</svg>`;
  return svg;
}

// Render the world map SVG (800x400) with graticule grid + plotted dots.
function renderWorldMap(dots) {
  // Render a container div; Leaflet + OSM heatmap is initialized client-side.
  // Dots data is embedded as JSON for the init script to pick up.
  const safeDots = Array.isArray(dots) ? dots.slice(-200) : [];
  const heatPoints = safeDots
    .filter(d => typeof d.lat === 'number' && typeof d.lng === 'number')
    .map(d => [d.lat, d.lng, 0.5]); // [lat, lng, intensity]
  return `<div id="heatmap" class="world-map" role="img" aria-label="World map showing install locations"></div>
<script id="heatmapData" type="application/json">${JSON.stringify(heatPoints)}</script>`;
}

function renderStatsPage(counts, analytics, trends, recentActivity, mapDots, firstInstalls) {
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

  // Live Activity feed (last 20 events)
  const safeActivity = Array.isArray(recentActivity) ? recentActivity.slice(0, 20) : [];
  const activityItems = safeActivity.map(ev => {
    const meta = PROJECT_META[ev.project] || { name: ev.project, type: 'download' };
    const noun = meta.type === 'install' ? 'install' : 'download';
    const flag = countryFlag(ev.country);
    const rel = formatRelativeTime(ev.ts);
    return `<div class="activity-item">
      <span class="activity-time">${escapeHtml(rel)}</span>
      <span class="activity-sep">&mdash;</span>
      <span class="activity-project">${escapeHtml(meta.name)}</span>
      <span class="activity-type">${escapeHtml(noun)}</span>
      <span class="activity-from">from ${flag}</span>
      <span class="activity-device">on ${escapeHtml(ev.device || '')}</span>
    </div>`;
  }).join('');
  const activitySection = safeActivity.length
    ? `<h2>Live Activity</h2><div class="activity-feed" id="activityFeed">${activityItems}</div>`
    : '';

  // Global install map
  const dotCount = Array.isArray(mapDots) ? mapDots.length : 0;
  const mapSection = dotCount > 0
    ? `<h2>Global Installs <span class="map-count">${dotCount} dots</span></h2>${renderWorldMap(mapDots)}`
    : '';

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
      // First install date
      const sinceStr = formatSinceMonth(firstInstalls[key]);
      const sinceEl = sinceStr ? `<div class="since-date">Since: ${escapeHtml(sinceStr)}</div>` : '';
      // Milestone badge
      const ms = getMilestone(count);
      const msEl = ms ? `<span class="milestone-badge" title="${escapeHtml(ms.label)}: ${count} ${noun}" style="background:${ms.color}"></span>` : '';
      // Sparkline
      const trend = trends[key];
      const sparkEl = renderSparkline(trend);
      return `<div class="card">
        <div class="card-name">${escapeHtml(meta.name)}</div>
        <div class="card-count-row">
          <span class="card-count">${count}</span>${msEl}
          <span class="card-unit">${noun}</span>
        </div>
        ${sinceEl}
        ${sparkEl}
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

<!-- Leaflet + OSM heatmap (unpkg CDN, pinned versions) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/leaflet-heat.js"></script>

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
  h2 .map-count {
    font-size: 0.75rem;
    color: #6ab0ff;
    font-weight: normal;
    margin-left: 8px;
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
  .card-count-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .card-count {
    font-size: 2.5rem;
    font-weight: bold;
    color: #6ab0ff;
    line-height: 1;
  }
  .card-unit {
    font-size: 0.85rem;
    color: #64748b;
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

  /* Since date */
  .since-date {
    font-size: 0.72rem;
    color: #506080;
    margin-top: 4px;
  }

  /* Milestone badge (medal dot) */
  .milestone-badge {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
    box-shadow: 0 0 6px rgba(255,255,255,0.25);
    flex-shrink: 0;
  }

  /* Sparkline */
  .sparkline {
    display: block;
    margin: 8px 0 4px;
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

  /* Live activity feed */
  .activity-feed {
    background: #111827;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 12px 16px;
    max-height: 320px;
    overflow-y: auto;
  }
  .activity-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    border-bottom: 1px solid #16213a;
    font-size: 0.82rem;
    color: #cbd5e1;
    animation: fadeIn 0.5s ease;
  }
  .activity-item:last-child { border-bottom: none; }
  .activity-time { color: #6ab0ff; font-weight: 600; min-width: 90px; }
  .activity-sep { color: #506080; }
  .activity-project { color: #07b6d3; font-weight: 600; }
  .activity-type { color: #64748b; font-size: 0.75rem; }
  .activity-from { color: #cbd5e1; }
  .activity-device { color: #64748b; font-size: 0.75rem; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* World map (Leaflet container) */
  .world-map {
    width: 100%;
    height: 400px;
    border: 1px solid #1e293b;
    border-radius: 6px;
    background: #0a1628;
  }
  /* Dark theme for Leaflet tiles + controls */
  .leaflet-container { background: #0a1628 !important; }
  .leaflet-control-attribution {
    background: rgba(13, 27, 42, 0.8) !important;
    color: #506080 !important;
  }
  .leaflet-control-attribution a { color: #07b6d3 !important; }
  .leaflet-control-zoom a {
    background: #111827 !important;
    color: #e0e0e0 !important;
    border-color: #1e293b !important;
  }
  .leaflet-control-zoom a:hover { background: #1e293b !important; }

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

  /* Tablet (≤768px) */
  @media (max-width: 768px) {
    .container { padding: 0 8px; }
    body { padding: 12px; }
    header h1 { font-size: 1.6rem; }
    header .total { font-size: 1rem; }
    header .total strong { font-size: 1.5rem; }
    header .note { font-size: 0.7rem; }
    h2 { font-size: 1.1rem; margin: 30px 0 12px; }
    /* Cards: 1 column on tablet portrait, 2 on landscape */
    .card-grid {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .card { padding: 16px; }
    .card-count { font-size: 2rem; }
    .card-name { font-size: 0.9rem; }
    .card-desc { font-size: 0.75rem; min-height: 2em; }
    .card-flags { font-size: 1.1rem; }
    .card-devices { font-size: 0.65rem; }
    /* Bar chart: narrower label column */
    .bar-row { grid-template-columns: 140px 1fr 40px; gap: 8px; }
    .bar-label-wrap { font-size: 0.75rem; }
    .bar-count { font-size: 0.85rem; }
    /* Table: smaller padding */
    th, td { padding: 8px 10px; font-size: 0.8rem; }
    td.num { font-size: 1rem; }
    /* Activity feed */
    .activity-item { padding: 8px 10px; font-size: 0.8rem; }
    .activity-time { min-width: 70px; font-size: 0.75rem; }
    /* World map: shorter on mobile */
    .world-map { height: 300px; }
  }

  /* Mobile (≤480px) */
  @media (max-width: 480px) {
    body { padding: 8px; }
    header { margin-bottom: 24px; }
    header h1 { font-size: 1.3rem; letter-spacing: 0; }
    header .total { font-size: 0.9rem; }
    header .total strong { font-size: 1.3rem; }
    header .note { font-size: 0.65rem; line-height: 1.4; }
    header .refresh-indicator { font-size: 0.7rem; }
    h2 { font-size: 1rem; margin: 24px 0 10px; }
    /* Cards: single column on mobile */
    .card-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .card { padding: 14px; }
    .card-count { font-size: 1.8rem; }
    .card-name { font-size: 0.85rem; }
    .card-desc { font-size: 0.7rem; min-height: 1.8em; margin: 6px 0 8px; }
    .card-flags { font-size: 1rem; margin: 6px 0 4px; }
    .card-flags .flag { margin-right: 4px; }
    .card-flags .flag sup { font-size: 0.55rem; }
    .card-devices { font-size: 0.6rem; }
    .card-devices .dev { padding: 1px 4px; margin-right: 4px; }
    .card-link { font-size: 0.75rem; }
    .sparkline { width: 50px; height: 16px; }
    .since-date { font-size: 0.65rem; }
    /* Bar chart: very narrow label, hide overflow */
    .bar-row { grid-template-columns: 100px 1fr 36px; gap: 6px; }
    .bar-label-wrap { font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { height: 20px; }
    .bar-count { font-size: 0.8rem; }
    /* Table: compact */
    table { font-size: 0.75rem; }
    th, td { padding: 6px 8px; }
    td.num { font-size: 0.9rem; }
    td.type { font-size: 0.7rem; }
    tr.cat-row td { font-size: 0.75rem; }
    /* Activity feed: tighter */
    .activity-feed { max-height: 280px; }
    .activity-item { padding: 6px 8px; font-size: 0.75rem; flex-wrap: wrap; gap: 4px; }
    .activity-time { min-width: 60px; font-size: 0.7rem; }
    /* World map: even shorter */
    .world-map { height: 220px; }
    /* Footer */
    footer { font-size: 0.7rem; margin-top: 30px; }
    /* SEO content hidden on mobile (already sr-only, but ensure) */
    .seo-content { display: none; }
  }

  /* Small mobile (≤360px) */
  @media (max-width: 360px) {
    header h1 { font-size: 1.1rem; }
    .card-count { font-size: 1.5rem; }
    .bar-row { grid-template-columns: 80px 1fr 30px; }
    .bar-label-wrap { font-size: 0.65rem; }
    .world-map { height: 180px; }
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

  ${activitySection}

  ${mapSection}

  ${cardsByCategory}

  <h2>Summary Table</h2>
  <table>
    <thead><tr><th>Project</th><th>Type</th><th>Count</th></tr></thead>
    <tbody>${tableRowsByCategory}</tbody>
  </table>

  <h2>Comparison Chart</h2>
  ${barsByCategory}

  <footer>
    Powered by <a href="https://hamradio.my">9M2PJU</a>
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
  // Full-page refresh every 30s (existing behaviour)
  function refresh() {
    fetch('/api/')
      .then(function(r) { return r.json(); })
      .then(function() { location.reload(); })
      .catch(function() {});
  }
  setInterval(refresh, 30000);

  // Live activity feed — updates every 10s without page reload
  function fmtRel(ts) {
    if (!ts) return 'just now';
    var diff = Math.max(0, Date.now() - ts);
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' hr ago';
    return Math.floor(hr / 24) + 'd ago';
  }

  function updateFeed() {
    fetch('/api/recent')
      .then(function(r) { return r.json(); })
      .then(function(events) {
        var feed = document.getElementById('activityFeed');
        if (!feed || !events || !events.length) return;
        var html = '';
        for (var i = 0; i < Math.min(20, events.length); i++) {
          var ev = events[i];
          var proj = ev.projectName || ev.project;
          var noun = ev.type || 'download';
          var flag = ev.countryFlag || '';
          var rel = fmtRel(ev.ts);
          html += '<div class="activity-item">' +
            '<span class="activity-time">' + rel + '</span>' +
            '<span class="activity-sep">&mdash;</span>' +
            '<span class="activity-project">' + proj + '</span>' +
            '<span class="activity-type">' + noun + '</span>' +
            '<span class="activity-from">from ' + flag + '</span>' +
            '<span class="activity-device">on ' + (ev.device || '') + '</span>' +
            '</div>';
        }
        feed.innerHTML = html;
      })
      .catch(function() {});
  }
  setInterval(updateFeed, 10000);
})();

// Initialize Leaflet + OSM heatmap
(function() {
  var mapEl = document.getElementById('heatmap');
  var dataEl = document.getElementById('heatmapData');
  if (!mapEl || !dataEl || typeof L === 'undefined') return;
  var points = [];
  try { points = JSON.parse(dataEl.textContent) || []; } catch (e) {}

  var map = L.map('heatmap', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 12,
    worldCopyJump: true,
    scrollWheelZoom: false,
    attributionControl: true,
  });

  // OSM standard tiles (free, no API key)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Heatmap layer (leaflet.heat) — cyan/blue gradient to match site theme
  if (points.length && L.heatLayer) {
    L.heatLayer(points, {
      radius: 25,
      blur: 35,
      maxZoom: 10,
      minOpacity: 0.4,
      gradient: { 0.2: '#07b6d3', 0.5: '#6ab0ff', 1.0: '#ffffff' },
    }).addTo(map);
    // Fit bounds to show all dots
    if (points.length > 1) {
      var bounds = L.latLngBounds(points.map(function(p) { return [p[0], p[1]]; }));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }
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

    // GET /api/recent → JSON array of recent activity events
    if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'recent') {
      const raw = await env.COUNTER_KV.get('recent_activity');
      let events = [];
      try { if (raw) events = JSON.parse(raw); } catch (e) {}
      // Enrich with display fields for the client-side feed
      events = (Array.isArray(events) ? events : []).slice(0, 50).map(ev => {
        const meta = PROJECT_META[ev.project] || { name: ev.project, type: 'download' };
        return {
          project: ev.project,
          projectName: meta.name,
          country: ev.country,
          countryFlag: countryFlag(ev.country),
          device: ev.device,
          ts: ev.ts,
          type: meta.type === 'install' ? 'install' : 'download',
        };
      });
      return new Response(JSON.stringify(events), { headers: corsHeaders });
    }

    // GET /badge/<project>.svg → shields.io-style SVG badge
    if (parts.length === 2 && parts[0] === 'badge' && parts[1].endsWith('.svg')) {
      const project = parts[1].slice(0, -4); // strip .svg
      if (!PROJECT_RE.test(project)) {
        return new Response(JSON.stringify({ error: 'invalid project name' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const val = await env.COUNTER_KV.get('project:' + project);
      const count = parseInt(val || '0', 10);
      const svg = renderBadge(project, count);
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // GET / → HTML stats page
    if (parts.length === 0) {
      const list = await env.COUNTER_KV.list({ prefix: 'project:' });
      const projectKeys = list.keys
        .map(k => k.name.slice('project:'.length))
        .filter(name => !name.includes(':')); // skip non-project keys
      const [countEntries, analyticsEntries, trendEntries, firstInstallEntries] = await Promise.all([
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('project:' + name);
          return [name, parseInt(val || '0', 10)];
        })),
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('analytics:' + name);
          return [name, val ? JSON.parse(val) : { countries: {}, devices: {} }];
        })),
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('trend:' + name);
          let arr = [];
          try { if (val) arr = JSON.parse(val); } catch (e) {}
          return [name, Array.isArray(arr) ? arr : []];
        })),
        Promise.all(projectKeys.map(async (name) => {
          const val = await env.COUNTER_KV.get('first_install:' + name);
          return [name, val || null];
        })),
      ]);
      // Fetch recent activity + map dots in parallel with the above
      const [recentRaw, mapDotsRaw] = await Promise.all([
        env.COUNTER_KV.get('recent_activity'),
        env.COUNTER_KV.get('map_dots'),
      ]);
      let recentActivity = [];
      try { if (recentRaw) recentActivity = JSON.parse(recentRaw); } catch (e) {}
      let mapDots = [];
      try { if (mapDotsRaw) mapDots = JSON.parse(mapDotsRaw); } catch (e) {}

      const counts = Object.fromEntries(countEntries);
      const analytics = Object.fromEntries(analyticsEntries);
      const trends = Object.fromEntries(trendEntries);
      const firstInstalls = Object.fromEntries(firstInstallEntries);
      const html = renderStatsPage(counts, analytics, trends, recentActivity, mapDots, firstInstalls);
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

      // First install date — set once, backfill if missing for existing projects
      const fiKey = 'first_install:' + project;
      const existingFi = await env.COUNTER_KV.get(fiKey);
      if (!existingFi) {
        await env.COUNTER_KV.put(fiKey, new Date().toISOString());
      }

      // Daily trend — last 30 days of counts
      const tKey = 'trend:' + project;
      let trend = [];
      try {
        const rawT = await env.COUNTER_KV.get(tKey);
        if (rawT) trend = JSON.parse(rawT);
        if (!Array.isArray(trend)) trend = [];
      } catch (e) { trend = []; }
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      if (trend.length > 0 && trend[trend.length - 1].d === today) {
        trend[trend.length - 1].n += 1;
      } else {
        trend.push({ d: today, n: 1 });
      }
      if (trend.length > 30) trend = trend.slice(trend.length - 30);
      await env.COUNTER_KV.put(tKey, JSON.stringify(trend));

      // Recent activity feed — prepend event, keep last 50
      const raKey = 'recent_activity';
      let activity = [];
      try {
        const rawA = await env.COUNTER_KV.get(raKey);
        if (rawA) activity = JSON.parse(rawA);
        if (!Array.isArray(activity)) activity = [];
      } catch (e) { activity = []; }
      const meta = PROJECT_META[project] || { type: 'download' };
      activity.unshift({
        project,
        country,
        device,
        ts: Date.now(),
        type: meta.type === 'install' ? 'install' : 'download',
      });
      if (activity.length > 50) activity = activity.slice(0, 50);
      await env.COUNTER_KV.put(raKey, JSON.stringify(activity));

      // Map dots — store lat/lng from Cloudflare geoip, keep last 200
      const mdKey = 'map_dots';
      let dots = [];
      try {
        const rawD = await env.COUNTER_KV.get(mdKey);
        if (rawD) dots = JSON.parse(rawD);
        if (!Array.isArray(dots)) dots = [];
      } catch (e) { dots = []; }
      const lat = request.cf && typeof request.cf.latitude === 'string' ? parseFloat(request.cf.latitude) : null;
      const lng = request.cf && typeof request.cf.longitude === 'string' ? parseFloat(request.cf.longitude) : null;
      if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
        dots.push({ lat, lng, project, ts: Date.now() });
        if (dots.length > 200) dots = dots.slice(dots.length - 200);
        await env.COUNTER_KV.put(mdKey, JSON.stringify(dots));
      }

      return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
    }

    // Default: return current count (no increment)
    let current = parseInt(await env.COUNTER_KV.get(key) || '0', 10);
    return new Response(JSON.stringify({ count: current, project }), { headers: corsHeaders });
  },
};

# 9M2PJU Mod LoRa APRS Tracker

A Malaysia-tuned fork of the [LoRa APRS Tracker](https://github.com/richonguzman/LoRa_APRS_Tracker) by Ricardo Guzman (CA2RXU), built for the **Heltec Wireless Tracker** board.

ESP32-S3 + LoRa + GPS + 80x160 color TFT, running APRS on **433.400 MHz**.

---

## Web Installer

Flash directly from your browser — no software needed:

### https://lora.hamradio.my

1. Use **Chrome** or **Edge** (Web Serial support required)
2. Plug in your Heltec Wireless Tracker via USB
3. Click **INSTALL**, pick the serial port, click **INSTALL**
4. Done — the tracker reboots with the new firmware

**After flashing, to change settings via web UI:**
1. Enable WiFi AP mode on the tracker (via menu)
2. Connect to WiFi: **LoRaTracker-AP** / password: **1234567890**
3. Open browser to **192.168.4.1**

---

## 9M2PJU Changes

### Display

| Feature | Original | This fork |
|---|---|---|
| Header bar | yellow / red | military green on every screen |
| Body text | all white, left-aligned | color-coded, centered |
| APRS symbol | white | colored by category |
| Status bar | none | left-edge accent (GPS/BT state) |
| Startup text | `CA2RXU <date>` | `9M2PJU Mod <versionDate>` |

**Body text colors:**
- Red — GPS warnings (`WAITING FOR GPS`, `GPS SLEEPING`)
- Orange — battery info
- Green — altitude and speed
- Yellow — GPS coordinates and Maidenhead grid
- Cyan — date/time, messages, Winlink mail
- Grey — last heard station
- White — everything else

**APRS symbol colors:**
- Cyan — runner, wheelchair, weather station
- Red — cars, bikes, motorcycles, trucks, vans, buses
- Blue — ships, canoes, yachts
- Green — houses, antennas, tents
- Magenta — balloons, aircraft
- Orange — trains
- Yellow — dogs

**Status accent bar (left edge, 2px):**
- Green = GPS locked
- Yellow = GPS searching
- Blue = Bluetooth connected
- Grey = idle

### LoRa

- Preset 1 frequency: **433.400 MHz** (Malaysia)
- On-screen label: `LoRa[MY]` (was `LoRa[Eu]`)
- Frequency change message: `MALAYSIA` (was `EU/WORLD`)

### Clock

- Display shows **Malaysia Time (UTC+8)**
- APRS packets still use UTC (standards-compliant)

### APRSMYSunday Net Check-In

Malaysia's APRS Sunday Net check-in feature, added by 9M2PJU. The original project only has APRSThursday — this fork adds a Malaysia-specific counterpart.

**Sub-menu items (Messages → APRSMYSunday):**

| Item | What it does |
|---|---|
| **Check-In** | Sends check-in to `APRSMY`. With keyboard: opens write screen for custom text (sent as `CHECK #APRSMY <text>`). Without keyboard: sends canned `CHECK #APRSMYSunday Net from LoRa Tracker 73!` |
| **Status** | Sends `STATUS` to `APRSMY` — query current net status |
| **Count** | Sends `COUNT` to `APRSMY` — query check-in count |
| **Last** | Sends `LAST` to `APRSMY` — query latest check-in |
| **Top** | Sends `TOP` to `APRSMY` — query top operators |
| **Me** | Sends `ME` to `APRSMY` — query your own check-in stats |

Replies come back as APRS messages — read them via Messages → Read.

**Menu path:** Messages → APRSMYSunday (menu 14 → 140-145)

### SOTA & POTA Reports

Added by 9M2PJU. Query SOTA (Summits On The Air) and POTA (Parks On The Air) spots and alerts from the **9M2PJU-4 APRS Bot**, right from the Reports menu.

**How to use:**
1. Menu → Reports → SOTA → Spots — sends `SOTA spots` to `9M2PJU-4`
2. Menu → Reports → SOTA → Alerts — sends `SOTA alerts` to `9M2PJU-4`
3. Menu → Reports → POTA → Spots — sends `POTA spots` to `9M2PJU-4`
4. Menu → Reports → POTA → Alerts — sends `POTA alerts` to `9M2PJU-4`

Replies come back as APRS messages — read them via Messages → Read.

**Menu path:** Reports → SOTA (menu 34 → 340/341) or Reports → POTA (menu 35 → 350/351)

> **Full user guide for 9M2PJU-4 APRS Bot:** https://hamradio.my/9m2pju-aprs-bot/

### HF Propagation Report

Added by 9M2PJU. Check current HF propagation conditions from the **9M2PJU-4 APRS Bot**, right from the Reports menu. Useful before a SOTA activation, DXpedition, or anytime you want to know if the HF bands are open.

**How to use:**
1. Menu → Reports → HF Report — sends `prop` to `9M2PJU-4`

The bot replies with current HF band conditions (MUF, solar flux, K-index, band-by-band status). The reply comes back as an APRS message — read it via Messages → Read.

**Menu path:** Reports → HF Report (menu 36)

> **Full user guide for 9M2PJU-4 APRS Bot:** https://hamradio.my/9m2pju-aprs-bot/

### Bulletins Reception (BLN)

Added by 9M2PJU. Receive and store APRS **BLN bulletins** (broadcast announcements addressed to `BLN` / `BLN0`–`BLN9`) in a dedicated Bulletins view — separate from your personal APRS messages.

Bulletins are general-purpose broadcasts sent to all stations (weather alerts, net announcements, emergency notices, event info, etc.) rather than to a specific callsign. Most APRS clients (APRSISCE, YAAC, etc.) put them in a separate "Bulletins" folder — this fork now does the same.

**Distance filter: 500 km** — only bulletins from senders within 500 km of your GPS position are stored. The tracker caches the last known position of every station it hears (from their beacon packets), then calculates the distance when a BLN bulletin arrives. If the sender is beyond 500 km, the bulletin is silently dropped. If the sender's position is unknown (no beacon heard yet) or your GPS has no lock, the bulletin is stored anyway (benefit of the doubt).

**Dedup: full file scan** — before saving a bulletin, the tracker reads the entire `/bulletins.txt` file and checks for an exact match (sender + addressee + text). If a duplicate is found, it's skipped. This prevents duplicate bulletins from digipeated/repeated packets filling up storage.

**Default: OFF** — you must enable bulletin reception explicitly. Three ways to toggle:

| Method | Path |
|---|---|
| On-device menu | Configuration → Bulletins → toggle (persists immediately) |
| Web admin UI | Station Config → "Receive Bulletins" switch → Save |
| Edit config JSON | `bulletins.active: true/false` in `tracker_conf.json` |

**To view saved bulletins:**

Menu → Messages → **Bulletins (N)** — shows each bulletin one at a time:
```
BULLETINS>
From --> 9M2PJU
[BLN1] Severe weather warning...
             Next=Down
```
Press Down to scroll through bulletins, Back to return.

**To delete all saved bulletins:**

Menu → Messages → **Delete BLN (N)** → confirm with Long Press or `>`.

**Menu paths:**
- View: Messages → Bulletins (menu 15 → 160)
- Delete: Messages → Delete BLN (menu 16 → 161)
- Toggle: Configuration → Bulletins (menu 28 → 280)

**Notes:**
- Bulletins are stored in SPIFFS flash — they survive reboots and power cycles
- BLN packets are still digipeated if your digipeater is ON, regardless of this setting
- No ack is sent back to the sender (BLN is broadcast, not a personal message)
- The `(N)` next to Bulletins / Delete BLN shows the current count of saved bulletins

### Smart Beaconing (Malaysia-tuned)

All 3 beacon profiles have been retuned for Malaysian use cases, with battery preservation as a priority. The original CA2RXU values were designed for European cycling/driving — this fork adjusts speed bands, beacon intervals, and turn thresholds to match Malaysian conditions while reducing TX frequency 20-33% across all profiles.

**Runner (Profile 1) — Hiking / SOTA**

Tuned for long battery sessions (6-12h SOTA activations). 33% fewer transmissions vs original.

| Parameter | Original (CA2RXU) | 9M2PJU | Notes |
|---|---|---|---|
| Slow beacon rate | 120 s | 180 s | At rest/summit, beacon every 3 min |
| Slow speed threshold | 3 km/h | 3 km/h | Unchanged |
| Fast beacon rate | 60 s | 90 s | When moving fast |
| Fast speed threshold | 15 km/h | 15 km/h | Unchanged |
| Min TX distance | 50 m | 70 m | Fewer beacons on switchback trails |
| Min turn interval | 20 s | 25 s | Fewer turn-triggered beacons |
| Turn min angle | 12 deg | 14 deg | Less sensitive to minor direction changes |
| Turn slope | 60 | 60 | Unchanged (preserves speed-scaling curve) |

**Bike (Profile 3) — Motorcycle (NOT bicycle)**

The original "Bike" profile was tuned for a bicycle (fastSpeed=40 km/h). Retuned for motorcycle use on Malaysian roads and highways. 20% fewer transmissions vs original.

| Parameter | Original (CA2RXU) | 9M2PJU | Notes |
|---|---|---|---|
| Slow beacon rate | 120 s | 150 s | At traffic lights, 2.5 min |
| Slow speed threshold | 5 km/h | 15 km/h | Motorcycle crawling speed, not bicycle |
| Fast beacon rate | 60 s | 75 s | Highway cruising |
| Fast speed threshold | 40 km/h | 80 km/h | Malaysian highway cruising speed |
| Min TX distance | 100 m | 150 m | Filters city stop-go TX |
| Min turn interval | 12 s | 15 s | Fewer turn beacons at intersections |
| Turn min angle | 12 deg | 12 deg | Unchanged |
| Turn slope | 60 | 70 | Between bicycle (60) and car (80) |

APRS symbol: motorcycle `<`

**Car (Profile 2) — Driving**

Tuned for Malaysian city traffic and highway speeds (PLUS North-South Expressway, limit 110 km/h). 20-30% fewer transmissions vs original.

| Parameter | Original (CA2RXU) | 9M2PJU | Notes |
|---|---|---|---|
| Slow beacon rate | 120 s | 150 s | In traffic jam, 2.5 min |
| Slow speed threshold | 10 km/h | 10 km/h | Unchanged (KL traffic) |
| Fast beacon rate | 60 s | 75 s | Highway cruising |
| Fast speed threshold | 70 km/h | 80 km/h | Extends proportional band for MY highway speeds |
| Min TX distance | 100 m | 150 m | Filters city stop-go TX |
| Min turn interval | 12 s | 15 s | Fewer turn beacons |
| Turn min angle | 10 deg | 12 deg | Less sensitive to minor curves |
| Turn slope | 80 | 80 | Unchanged |

**How Smart Beaconing works:**

The tracker uses two independent triggers to decide when to beacon:

1. **Speed-based interval** — If speed is below `slowSpeed`, beacon every `slowRate` seconds. If above `fastSpeed`, beacon every `fastRate` seconds. In between, the interval scales proportionally (faster = more frequent beacons, but never more than `fastRate`).

2. **Turn/cornering beacon** — If you change heading by more than a threshold angle (which scales with speed via `turnSlope`), and you've moved at least `minTxDist` meters, and `minDeltaBeacon` seconds have passed since the last beacon, it sends immediately. This captures turns at intersections and highway exits without waiting for the time interval.

When Smart Beaconing is off, the tracker falls back to a fixed interval (`nonSmartBeaconRate`, default 15 minutes).

### Web Admin UI (Mobile-First Redesign)

The web admin UI (accessible via WiFi AP at `192.168.4.1`) has been redesigned mobile-first for phones, tablets, and desktops while **saving flash** vs the original:

- **Dark mode by default** — easier on the eyes, especially for field use at night
- **Malaysia flag accent colors** — blue canton (#4a9eff), red stripes (#ff5252), yellow star (#FFD700) on dark background
- **Card-style sections** — each config group (Beacons, LoRa, Display, etc.) is wrapped in a bordered card with a red left border for visual separation
- **Mobile-first layout** — all form fields full-width on phones/tablets (`col-12 col-lg-6` pattern), stacking vertically instead of cramped side-by-side
- **Sticky save bar** — a fixed "Save Configuration" button pinned to the bottom of the screen on mobile, always accessible without scrolling to the navbar
- **Compact section headers on mobile** — icon + title on one line with a divider border, instead of wasting a full row
- **44px touch targets** — all inputs, switches, and buttons meet minimum recommended touch target size; 16px font-size on inputs prevents iOS auto-zoom
- **Bigger toggle switches** — 2.75rem wide for easier tapping on touchscreens
- **Desktop-optimized** — sidebar-style section headers, multi-column field layout, content constrained to 900px max-width
- **Sponsor links as text** — removed 49 KB of base64-encoded sponsor button images, replaced with simple text hyperlinks (GitHub Sponsors, PayPal CA2RXU, Buy Me a Coffee 9M2PJU, Wise 9M2PJU)

| Metric | Original (upstream) | 9M2PJU Mod | Savings |
|---|---|---|---|
| index.html (raw) | 128,645 bytes | 81,024 bytes | -47,621 bytes |
| index.html gz (in flash) | 38,758 bytes | 6,869 bytes | -31,889 bytes (-82%) |
| Total web UI (gzipped) | 42,819 bytes | 11,990 bytes | -30,829 bytes (-72%) |
| Firmware flash usage | 1,432,801 bytes (45.5%) | 1,413,101 bytes (44.9%) | -19,700 bytes |

### Config (shipped defaults)

| Setting | Value |
|---|---|
| Callsign | `9M2PJU-7` (all 3 profiles) |
| LoRa frequency | 433.400 MHz |
| Profile 1 symbol | runner `[` |
| Profile 2 symbol | car `>` |
| Profile 3 symbol | motorcycle `<` |
| GPS Eco Mode | off (GPS always active) |
| APRS path | `WIDE1-1` |

---

## Files changed by 9M2PJU

| File | What changed |
|---|---|
| `src/display.cpp` | Color helpers, military green headers, color-coded centered body text, colored symbols, status accent bar, startup branding, header/symbol layout |
| `src/utils.cpp` | UTC+8 offset for display clock |
| `src/menu_utils.cpp` | `LoRa[MY]` label, APRSMYSunday menu entries (case 14/140-145/1400), SOTA/POTA report menus (case 34/35/340/341/350/351), HF Report menu (case 36), BLN bulletins view/delete/toggle (case 15/160/16/161/28/280), 7-item Messages submenu (cases 10-16), 9-item Configuration submenu (cases 20-28) |
| `src/keyboard_utils.cpp` | APRSMY check-in send logic (lines 363-372, 622-625), APRSMY query commands Status/Count/Last/Top/Me (case 141-145), SOTA/POTA report send logic, HF Report send logic (case 36 sends `prop` to 9M2PJU-4), BLN bulletins view/delete/toggle navigation (case 15→160, 16→161, 28→280, 280 toggles + persists) |
| `src/msg_utils.cpp` | BLN bulletin storage (`/bulletins.txt`), `saveNewBulletin()` with full-file-scan dedup / `loadBulletinsFromMemory()` / `deleteBulletins()` / `getNumBulletins()`, BLN detection in `checkReceivedMessage()` (addressee starts with `BLN`), 500 km distance filter (`isWithinBlnRange()` + `cacheStationPos()` + `stationCache[20]`) |
| `include/configuration.h` | `Bulletins` class (bool `active`), `Config.bulletins` member |
| `src/configuration.cpp` | `bulletins.active` read/write/defaults (default `false`) |
| `src/web_utils.cpp` | `bulletins.active` form parsing from web admin UI |
| `src/lora_utils.cpp` | `MALAYSIA` frequency label |
| `src/smartbeacon_utils.cpp` | Malaysia-tuned smart beacon presets (runner/motorcycle/car), 20-33% fewer TX for battery preservation |
| `data/tracker_conf.json` | Callsign, frequency, symbols, GPS Eco Mode off, `bulletins.active: false` |
| `data_embed/index.html` | Web admin UI: dark mode, Malaysia flag accent, card sections, mobile-first responsive layout, sticky save bar, "Receive Bulletins" toggle |
| `data_embed/style.css` | Malaysia flag accent colors (blue/red/yellow), mobile-first responsive layout, 44px touch targets, bigger switches, compact mobile headers |
| `data_embed/script.js` | Smart Beacon Setting labels (Runner/Motorcycle/Car), mobile-first col-12 col-lg-* responsive beacon/lora templates, `bulletins.active` loader |
| `docs/index.html` | Web installer page, BLN bulletins feature section, donation popup (Buy Me a Coffee / Wise / GitHub Sponsors) |
| `docs/manifest-heltec-wireless-tracker.json` | ESP Web Tools flash manifest |
| `docs/firmware/` | Pre-built binaries |

---

## Building from source

Requires [PlatformIO](https://platformio.org/):

```bash
pio run -e heltec_wireless_tracker              # build
pio run -e heltec_wireless_tracker -t upload    # flash firmware
pio run -e heltec_wireless_tracker -t uploadfs  # flash config (overwrites live settings)
```

---

## Credits

Based on [LoRa APRS Tracker](https://github.com/richonguzman/LoRa_APRS_Tracker) by **Ricardo Guzman - CA2RXU**.

Fork by **9M2PJU** — Malaysia.
Web installer at **https://lora.hamradio.my** powered by [ESP Web Tools](https://esphome.github.io/esp-web-tools/).

---

## Support the project

This firmware mod is free and open source, maintained in spare time. If it has helped you on the trail, on the road, or on the air, a small donation keeps the project running.

- **Buy Me a Coffee** — https://www.buymeacoffee.com/9m2pju
- **Wise** — https://wise.com/pay/me/faizulz13
- **GitHub Sponsors (CA2RXU — upstream author)** — https://github.com/sponsors/richonguzman
- **PayPal (CA2RXU — upstream author)** — http://paypal.me/richonguzman

The web installer at [lora.hamradio.my](https://lora.hamradio.my) shows a donation popup on every visit, with a persistent floating Donate button in the bottom-right corner.

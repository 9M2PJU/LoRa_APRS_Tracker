# 9M2PJU Mod LoRa APRS Tracker — Project Notes

## Project Overview
Fork of CA2RXU LoRa APRS Tracker, modified by 9M2PJU for Malaysia.
- Target device: **Heltec Wireless Tracker** (ESP32-S3 + ST7735 TFT)
- Callsign: 9M2PJU-7
- LoRa frequency: 433.400 MHz (Malaysia)
- Clock: Malaysia Time (UTC+8)

## Build & Tooling
- PlatformIO installed at `~/.platformio/penv/bin/pio` (not on PATH)
- Build firmware: `pio run -e heltec_wireless_tracker`
- Build SPIFFS: `pio run -e heltec_wireless_tracker -t buildfs`
- Board: esp32-s3-devkitc-1, 8MB Flash, huge_app.csv partitions
- Partition layout: bootloader@0x0, partitions@0x8000, boot_app0@0xe000, firmware@0x10000, spiffs@0x310000

## Web Installer (docs/)
- ESP Web Tools 10.2.1, self-hosted in docs/
- Manifest: `docs/manifest-heltec-wireless-tracker.json`
  - Must use `chipFamily` (camelCase), value `"ESP32-S3"` (exact ROM name)
  - Must use `parts` (not `raw`)
  - `new_install_improv_wait_time: 0` — firmware has no Improv, skip detection
  - 5 parts: bootloader, partitions, boot_app0, firmware, spiffs
- Cache-bust: bump `?v=N` in index.html on manifest changes
- `_headers`: no-cache on .json, .bin, .js files
- Heltec download mode: press **both buttons together** (BOOT + RST), screen goes blank. NOT hold-BOOT.
- Post-install: JS listener on `document.body` for `closed` event checks `dialog._installState.state === 'finished'` to show reboot message

## GitHub Actions Workflows
- `commit.yml` — smoke-test build of heltec_wireless_tracker on any branch push
- `publish-firmware.yml` — on push to main (src/include/data/variants/tools/platformio.ini changes), builds firmware+SPIFFS, copies binaries to docs/firmware/, commits back to main. Triggers deploy.yml.
- `deploy.yml` — publishes docs/ to GitHub Pages on push to main
- `build.yml` — builds all 38 targets on release publish (dormant, not used)

## Config (data/tracker_conf.json)
- Display timeout: 3 seconds
- Posmsg email: 9m2pju@gmail.com (used by Extras → Send Email(GPS), sends `posmsg <email>` to 9M2PJU-4 APRS Bot, menu option 60)
- Winlink password: ABCDEF (placeholder — should be real Winlink account password, used for Winlink login challenge-response, menu option 50)
- BLN bulletins: `bulletins.active` (default false). When ON, APRS messages addressed to BLN/BLN0-9 are stored in SPIFFS `/bulletins.txt` and viewable via Messages → Bulletins (menu case 15/160). Toggle in web admin UI "Receive BLN Bulletins".
- 3 beacon profiles: Profile 1=Runner(setting 0), Profile 2=Car(setting 2), Profile 3=Bike(setting 1, motorcycle symbol `<`)
- Smart beacon presets are in src/smartbeacon_utils.cpp lines 38-42 — tuned by 9M2PJU for Malaysian use cases (battery-preserving: 20-33% fewer TX vs original CA2RXU values)
  - Runner (hiking/SOTA): slowRate=180, slowSpeed=3, fastRate=90, fastSpeed=15, minTxDist=70, minDeltaBeacon=25, turnMinDeg=14, turnSlope=60
  - Bike (motorcycle, NOT bicycle): slowRate=150, slowSpeed=15, fastRate=75, fastSpeed=80, minTxDist=150, minDeltaBeacon=15, turnMinDeg=12, turnSlope=70
  - Car (driving): slowRate=150, slowSpeed=10, fastRate=75, fastSpeed=80, minTxDist=150, minDeltaBeacon=15, turnMinDeg=12, turnSlope=80
  - Original CA2RXU values were: Runner {120,3,60,15,50,20,12,60}, Bike(bicycle) {120,5,60,40,100,12,12,60}, Car {120,10,60,70,100,12,10,80}

## Key Files
- `src/smartbeacon_utils.cpp` — smart beacon presets (runner/bike/car)
- `src/configuration.cpp` — config load/save, defaults (hardcoded fallbacks)
- `src/keyboard_utils.cpp` — menu logic, email posmsg (line 536), winlink commands, APRSMY check-in (lines 363-372, 622-625), APRSMY query commands STATUS/COUNT/LAST/TOP/ME (cases 141-145), SOTA/POTA report send logic (menu 34/35/340/341/350/351), BLN bulletins view/delete/toggle navigation (case 15→160, case 16→161, case 28→280, case 280 toggle+persist)
- `src/menu_utils.cpp` — menu display, APRSMY entries (case 14/140-145/1400), SOTA/POTA report menus (case 34/35/340/341/350/351), BLN bulletins view + delete + toggle (case 15/160/16/161/28/280, updated cases 10-16 for 7-item Messages rotation, cases 20-28 for 9-item Configuration rotation)
- `src/msg_utils.cpp` — APRS/Winlink message storage, BLN bulletin storage (`/bulletins.txt`, saveNewBulletin/loadBulletinsFromMemory/deleteBulletins/getNumBulletins), BLN detection in checkReceivedMessage (addressee indexOf "BLN" == 0), 500 km distance filter (isWithinBlnRange/cacheStationPos/stationCache[20])
- `src/winlink_utils.cpp` — Winlink challenge-response auth (Fisher-Yates shuffle as of upstream sync)
- `src/display.cpp` — display rendering, custom Heltec colors (heltecHeaderColor line 331, heltecBodyColor line 337), startup screen (line 647, shows "9M2PJU Mod <versionDate>")
- `src/LoRa_APRS_Tracker.cpp` — version strings (versionDate, versionNumber line 72-73)
- `variants/heltec_wireless_tracker/platformio.ini` — board build flags
- `docs/install-dialog-28H-HNrD.js` — patched ESP Web Tools dialog (custom error message for download mode)

## Upstream Sync
- Upstream repo: `richonguzman/LoRa_APRS_Tracker` (added as git remote `upstream`)
- Last sync: 2026-07-09, merged upstream/main up to commit `bfd531a` (2026-04-23)
- Merge-base was `aa32b58` (2026-01-20 displayEcoModeFix)
- 22 upstream commits merged: Winlink fix, GPS waiting display, BT KISS fix, ArduinoJson 6->7 migration, library bumps (RadioLib 7.6.0, ESP32 platform 6.12.0, ArduinoJson 7.4.2), new board variants (ttgo-t-beam-1W, ttgo_lora32_t3s3_v1_2_GPS)
- Conflict resolutions: README.md (kept Clock + added Timeline), display.cpp (kept custom Heltec colors), keyboard_utils.cpp (whitespace)
- How to sync: `git fetch upstream main && git merge upstream/main` — resolve conflicts preserving our mods (APRSMY, display colors, config, web flasher)

## Display Layout (v3.0)
- All body text under header is **centered** horizontally on 160px screen
- Header: navy blue background, bright yellow text, centered (with gap for symbol on main screen)
- APRS symbol: white, drawn at x=124-140 (16px wide, 14px tall)
- Menu selection: `>` prefix, selected item text is yellow, no background bar
- Menu items default color: cyan; button instructions (Back, 1P=, etc.): orange
- "MESSAGES" items: red color
- GPS warnings: red; GPS coordinates: yellow; altitude/speed: green; last RX: grey
- Startup screen: header yellow on navy blue, body cyan, "9M2PJU Mod <version>" orange
- Selection indicator on line 3 (2 items above, selected, 1 below) in menu_utils.cpp
- Font: bigSizeFont=2 (header), smallSizeFont=1 (body), lineSpacing=12, maxLineLength=26
- Status accent bar: 2px left edge (green=GPS lock, yellow=GPS searching, blue=BT, grey=idle)

## Git History
- All commits authored by 9M2PJU only (no Devin/Co-Authored-By lines in any commit message)
- Tags: v1.0-stable, v2.0-stable (both force-pushed after history rewrite)
- History rewrites via filter-branch: first pass removed Devin co-author lines from 8 commits; second pass (2026-07-12) stripped remaining `Co-Authored-By: Devin` lines from 7 commits on main (29 commits rewritten, tree unchanged, force-pushed)

## Our Modifications (must preserve during upstream sync)
- **APRSMY check-in** — Malaysia APRS Sunday Net feature in `src/menu_utils.cpp` (case 14/140-145/1400) and `src/keyboard_utils.cpp` (lines 363-372, 622-625). Sends `CHECK #APRSMY <text>` to callsign `APRSMY`. Sub-menu has 6 items: Check In (case 140, opens write screen with keyboard or sends predefined check-in), STATUS (case 141, sends `STATUS`), COUNT (case 142, sends `COUNT`), LAST (case 143, sends `LAST`), TOP (case 144, sends `TOP`), ME (case 145, sends `ME`). Query commands (141-145) are sent immediately to APRSMY without text input. Replies come as APRS messages read via Messages → Read.
- **SOTA & POTA reports** — New Reports submenu items (case 34/35/340/341/350/351) in `src/menu_utils.cpp` and `src/keyboard_utils.cpp`. Sends `SOTA spots`, `SOTA alerts`, `POTA spots`, `POTA alerts` to `9M2PJU-4` (9M2PJU-4 APRS Bot). No waiting screen — behaves like existing QTH reports (send and stay on menu). Replies come as APRS messages read via Messages → Read. User guide: https://hamradio.my/9m2pju-aprs-bot/
- **BLN bulletins reception** — New `Config.bulletins.active` setting (default OFF) in `include/configuration.h`, `src/configuration.cpp`, `data/tracker_conf.json`. When ON, APRS messages addressed to BLN/BLN0-9 (detected in `src/msg_utils.cpp` checkReceivedMessage via `addressee.indexOf("BLN") == 0`) are stored in SPIFFS `/bulletins.txt` (format: `sender,addressee,text`) via `saveNewBulletin()`. **500 km distance filter**: `isWithinBlnRange()` checks sender against a 20-entry station position cache (`stationCache[]`, populated from type 0/4 beacon packets via `cacheStationPos()`), drops bulletins from senders >500 km away (benefit of the doubt if sender position unknown or no GPS lock). Viewable via Messages → Bulletins (menu case 15 → 160 in `src/menu_utils.cpp` + `src/keyboard_utils.cpp`). Deletable via Messages → Delete BLN (menu case 16 → 161 confirmation, calls `deleteBulletins()` which removes `/bulletins.txt` and resets counter). Toggleable on-device via Configuration → BLN Bulletins (menu case 28 → 280, toggles `Config.bulletins.active` and calls `Config.writeFile()` to persist immediately). Messages submenu expanded from 5 to 7 items (cases 10-16: Read/Write/Delete/APRSThursday/APRSMYSunday/Bulletins/Delete BLN). Configuration submenu expanded from 8 to 9 items (cases 20-28: Change Callsign/Change Frequency/Display/Bluetooth/Status/Notifications/Reboot/Power Off/BLN Bulletins). Web admin toggle "Receive BLN Bulletins" in `data_embed/index.html` + `data_embed/script.js` + `src/web_utils.cpp`. BLN packets are still digipeated if digipeater is ON (independent of bulletins.active). No ack sent (BLN is broadcast). Bulletins are persistent in SPIFFS flash (survive reboots/power cycles).
- **Custom Heltec display colors** — `heltecHeaderColor()` and `heltecBodyColor()` functions in `src/display.cpp`, used in displayShow for HELTEC_WIRELESS_TRACKER
- **Centered display text** — body text centered via `(160 - textWidth) / 2`, header centered in symbol-aware space
- **Startup screen** — shows "9M2PJU Mod <versionDate>" centered (src/display.cpp startupScreen function)
- **LoRa frequency labels** — `LoRa[MY]` for preset 0, "MALAYSIA" change message (`src/display.cpp`, `src/lora_utils.cpp`)
- **Smart beacon tuning** — `src/smartbeacon_utils.cpp` lines 38-42: tuned all 3 profiles for Malaysian use cases with battery preservation (20-33% fewer TX). Runner for hiking/SOTA, Bike for motorcycle (not bicycle), Car for Malaysian highway speeds. Original CA2RXU values preserved in comments.
- **data/tracker_conf.json** — 9M2PJU-7 callsign, 433.400MHz, gpsEcoMode=false on all 3 profiles, Winlink email, display timeout 3s
- **Web admin UI labels** — `data_embed/script.js` lines 141-143: Smart Beacon Setting dropdown labels changed from "Human/Runner (Slow Speed) / Bicycle (Mid Speed) / Car/Motorcycle (Fast Speed)" to "Runner/Hiking (Slow) / Motorcycle (Medium) / Car (Fast)". This file is embedded into firmware as gzip (auto-compressed by tools/compress.py at build time).
- **Web admin UI branding** — `data_embed/index.html`: page title changed to "9M2PJU Mod LoRa APRS Tracker", navbar brand to "9M2PJU Mod LoRa Tracker", footer adds "9M2PJU Mod for Malaysia" credit with link to hamradio.my and lora.hamradio.my. Original CA2RXU/SQ2CPA/CD3EAP credits preserved.
- **Web admin UI field labels** — `data_embed/index.html`: Email field label changed to "Your email (for posmsg GPS position via 9M2PJU-4 APRS Bot)". Winlink section description changed to "Do you have a Winlink email? Your Winlink address is your callsign @winlink.org (e.g. 9M2PJU@winlink.org). Enter your Winlink account password below."
- **Web admin UI redesign (mobile-first)** — `data_embed/index.html`, `data_embed/style.css`, `data_embed/script.js`: Card-style sections with borders, mobile-first responsive layout using `col-12 col-lg-*` pattern (all fields full-width on phones/tablets, multi-column on desktop). Sticky bottom save bar (`#mobileSaveBar`) on mobile with 44px touch targets, 16px input font (prevents iOS auto-zoom), bigger toggle switches (2.75rem). Compact section headers on mobile (icon+title inline with divider). Desktop: sidebar headers, multi-column fields, 900px max-width. Removed 49KB base64 sponsor images (replaced with text links). Firmware flash: 1,413,101 bytes (44.9%).
- **Web admin UI dark mode + Malaysia flag accent** — `data_embed/index.html` (data-bs-theme="dark"), `data_embed/style.css`: Malaysia flag colors on dark mode — blue canton (#4a9eff), red stripes (#ff5252), yellow star (#FFD700). Navbar: blue border + red shadow stripe. Section cards: red left border, blue headings. Form focus: blue ring. Save button: blue with yellow hover. Links: blue, yellow on hover. Dark-mode variables under [data-bs-theme="dark"]. Sponsor links: GitHub Sponsors, PayPal (CA2RXU), Buy Me a Coffee (9M2PJU at buymeacoffee.com/9m2pju), Wise (9M2PJU at wise.com/pay/me/faizulz13).
- **Web flasher** — entire `docs/` directory, manifest, install dialog, firmware binaries at lora.hamradio.my. `docs/index.html` includes a "Digipeater & APRS Path (WIDE1-1)" info section explaining WIDE1-1 vs WIDE2-2, how to use a friend's tracker as a relay, and the S.O.S. placeholder caveat. Also includes a donation popup (`#donateModal`) that auto-opens on every visit (2.5s after load) with links to Buy Me a Coffee (buymeacoffee.com/9m2pju), Wise (wise.com/pay/me/faizulz13), and GitHub Sponsors (CA2RXU), plus a persistent floating "Donate" button (`#donateFloat`).
- **Custom workflows** — publish-firmware.yml, deploy.yml (not in upstream)

## Upstream Sync Checklist
When syncing with upstream (`git fetch upstream main && git merge upstream/main`), resolve conflicts preserving our mods. Files most likely to conflict and what to preserve:

| File | What to preserve | Upstream may change |
|---|---|---|
| `src/smartbeacon_utils.cpp` | Lines 38-42: our tuned values + comments. Keep original CA2RXU values in comments. | Preset values, struct fields |
| `src/display.cpp` | `heltecHeaderColor()`, `heltecBodyColor()`, centered text logic, startup screen "9M2PJU Mod", LoRa[MY] label, status accent bar | Display rendering, new features |
| `src/menu_utils.cpp` | APRSMY entries (case 14/140-145/1400), SOTA/POTA menus (case 34/35/340/341/350/351), BLN bulletins view (case 15/160), Delete BLN (case 16/161), BLN toggle (case 28/280), LoRa[MY] label, 7-item Messages submenu rotation (cases 10-16), 9-item Configuration submenu rotation (cases 20-28) | New menu items, case numbers |
| `src/keyboard_utils.cpp` | APRSMY send logic (lines 363-372, 622-625), APRSMY query commands (cases 141-145: STATUS/COUNT/LAST/TOP/ME), SOTA/POTA send logic, email posmsg, BLN bulletins navigation (case 15→160 view, case 16→161 delete, case 28→280 toggle, case 280/161 action+persist, ranges 10-16 and 20-28) | Menu logic, new features |
| `src/msg_utils.cpp` | BLN bulletin storage (saveNewBulletin/loadBulletinsFromMemory/deleteBulletins/getNumBulletins/warnNoBulletins, `/bulletins.txt`), BLN detection in checkReceivedMessage (addressee indexOf "BLN" == 0), 500 km distance filter (isWithinBlnRange + cacheStationPos + stationCache[20]), globals numBulletins/noBLNWarning/loadedBulletins/lastBulletinSaved | Message handling, new features |
| `include/configuration.h` | Bulletins class (bool active), Config.bulletins member | Config struct, new fields |
| `src/configuration.cpp` | bulletins.active read/write/defaults (default false) | Config load/save, new fields |
| `src/web_utils.cpp` | bulletins.active form parsing (request->hasParam("bulletins.active", true)) | Web config handling |
| `src/lora_utils.cpp` | "MALAYSIA" frequency change label | LoRa init, frequency handling |
| `src/utils.cpp` | UTC+8 offset for display clock | Time utilities |
| `src/LoRa_APRS_Tracker.cpp` | versionDate/versionNumber strings (lines 72-73) | Version strings |
| `data/tracker_conf.json` | Callsign 9M2PJU-7, 433.400MHz, gpsEcoMode=false, symbols, Winlink email, display timeout 3s, bulletins.active=false | New config fields (add upstream fields, keep our values) |
| `data_embed/script.js` | Smart Beacon dropdown labels (lines 141-143): Runner/Hiking, Motorcycle, Car. Mobile-first col-12 col-lg-* responsive beacon/lora templates. bulletins.active loader | Web UI form fields, new config options |
| `data_embed/index.html` | Page title "9M2PJU Mod", navbar brand, footer 9M2PJU credit, email field label (posmsg), Winlink section (callsign@winlink.org example), mobile-first col-12 col-lg-* responsive classes, sticky save bar (#mobileSaveBar), "Receive BLN Bulletins" toggle | Web UI layout, new form fields |
| `data_embed/style.css` | Malaysia flag accent colors, mobile-first responsive layout (44px touch targets, bigger switches, compact mobile headers, sticky save bar), desktop multi-column at lg breakpoint | CSS styles |
| `README.md` | Our entire 9M2PJU Changes section (display, LoRa, clock, APRSMY, SOTA/POTA, smart beaconing, config) | Upstream README content |
| `docs/` | Entire directory (web flasher, manifest, firmware binaries, install dialog) | Not in upstream (no conflict expected) |
| `.github/workflows/` | publish-firmware.yml, deploy.yml | commit.yml, build.yml may update |

### After resolving conflicts:
1. Build: `pio run -e heltec_wireless_tracker`
2. Build SPIFFS: `pio run -e heltec_wireless_tracker -t buildfs`
3. Copy binaries: `cp .pio/build/heltec_wireless_tracker/{firmware,bootloader,partitions,spiffs}.bin docs/firmware/` + boot_app0 from framework
4. Bump manifest cache-bust: `?v=N` in docs/index.html
5. Update AGENTS.md "Last sync" date and commit details
6. Commit and push (publish-firmware.yml will also rebuild and deploy)

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
- Winlink email: 9m2pju@gmail.com (used for posmsg command to 9M2PJU-4 gateway, menu option 60)
- Winlink password: ABCDEF (placeholder — should be real Winlink account password)
- 3 beacon profiles: Profile 1=Runner(setting 0), Profile 2=Car(setting 2), Profile 3=Bike(setting 1)
- Smart beacon presets are in src/smartbeacon_utils.cpp lines 38-42 (all original values, not modified)

## Key Files
- `src/smartbeacon_utils.cpp` — smart beacon presets (runner/bike/car)
- `src/configuration.cpp` — config load/save, defaults (hardcoded fallbacks)
- `src/keyboard_utils.cpp` — menu logic, email posmsg (line 536), winlink commands, APRSMY check-in (lines 363-372, 622-625)
- `src/menu_utils.cpp` — menu display, APRSMY entries (case 14/140/1400)
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

## Display Layout (v2.0-stable)
- All body text under header is **centered** horizontally on 160px screen
- Header callsign is centered in 0-124px space (leaves gap for APRS symbol on main screen)
- APRS symbol drawn at x=124-140 (16px wide, 14px tall) to avoid overlap with any callsign length
- On screens without symbol, header centers in full 160px
- Startup screen text centered (removed old manual padding spaces)
- Font: bigSizeFont=2 (header), smallSizeFont=1 (body), lineSpacing=12, maxLineLength=26
- Status accent bar: 2px left edge (green=GPS lock, yellow=GPS searching, blue=BT, grey=idle)

## Git History
- All commits authored by 9M2PJU only (Devin co-author lines removed via filter-branch)
- Tags: v1.0-stable, v2.0-stable (both force-pushed after history rewrite)
- Force push was used to rewrite 8 commits removing Devin co-author

## Our Modifications (must preserve during upstream sync)
- **APRSMY check-in** — Malaysia APRS Sunday Net feature in `src/menu_utils.cpp` (case 14/140/1400) and `src/keyboard_utils.cpp` (lines 363-372, 622-625). Sends `CHECK #APRSMY <text>` to callsign `APRSMY`.
- **Custom Heltec display colors** — `heltecHeaderColor()` and `heltecBodyColor()` functions in `src/display.cpp`, used in displayShow for HELTEC_WIRELESS_TRACKER
- **Centered display text** — body text centered via `(160 - textWidth) / 2`, header centered in symbol-aware space
- **Startup screen** — shows "9M2PJU Mod <versionDate>" centered (src/display.cpp startupScreen function)
- **LoRa frequency labels** — `LoRa[MY]` for preset 0, "MALAYSIA" change message (`src/display.cpp`, `src/lora_utils.cpp`)
- **data/tracker_conf.json** — 9M2PJU-7 callsign, 433.400MHz, gpsEcoMode=false on all 3 profiles, Winlink email, display timeout 3s
- **Web flasher** — entire `docs/` directory, manifest, install dialog, firmware binaries at lora.hamradio.my
- **Custom workflows** — publish-firmware.yml, deploy.yml (not in upstream)

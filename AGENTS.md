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
- `src/keyboard_utils.cpp` — menu logic, email posmsg (line 536), winlink commands
- `src/winlink_utils.cpp` — Winlink challenge-response auth
- `variants/heltec_wireless_tracker/platformio.ini` — board build flags
- `docs/install-dialog-28H-HNrD.js` — patched ESP Web Tools dialog (custom error message for download mode)

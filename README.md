# 9M2PJU Mod LoRa APRS Tracker (Heltec Wireless Tracker Edition)

> Fork of [CA2RXU LoRa APRS Tracker](https://github.com/richonguzman/LoRa_APRS_Tracker) by Ricardo Guzman (CA2RXU),
> customized by **9M2PJU** for operation in **Malaysia** on the **Heltec Wireless Tracker** board.

This firmware is for using ESP32 based boards with LoRa Modules and GPS to live in the APRS world.

__(NOTE: To use Tx/Rx capabilities of this tracker you should have also a Tx/Rx <a href="https://github.com/richonguzman/LoRa_APRS_iGate" target="_blank">LoRa iGate</a> near you)__

____________________________________________________

## Web Installer (one-click flash from browser)

### [9M2PJU Mod LoRa APRS Tracker Firmware Web Installer](https://9m2pju.github.io/LoRa_APRS_Tracker/)

Flash your Heltec Wireless Tracker directly from your browser — no software install needed.

**Requirements:**
- Google Chrome or Microsoft Edge (Web Serial API support)
- USB cable connected to your Heltec Wireless Tracker

**How to use:**
1. Open the web installer link above
2. Click the CONNECT button
3. Select your device's serial port (usually "USB JTAG/serial debug unit")
4. Click Install and wait for the flash to complete
5. Your tracker will reboot automatically with the new firmware

Pre-built firmware binaries are also in the `firmware/heltec_wireless_tracker/` directory for manual flashing.

____________________________________________________

## About this fork

This fork is specifically tuned for the **Heltec Wireless Tracker** (ESP32-S3 + ST7735 80x160 TFT)
operating in **Malaysia**. It adds a colorful TFT UI, Malaysia-specific LoRa presets, local MYT clock,
and personalized branding.

____________________________________________________

## Changes made in this fork

### Display enhancements (Heltec Wireless Tracker only)

All changes are guarded by `#if defined(HAS_TFT) && defined(HELTEC_WIRELESS_TRACKER)` so other boards are unaffected.

- **Military green header bar** on every screen (`0x4A84` RGB565) — consistent across startup, main, menus, messages, TX/RX, and error screens.
- **Color-coded body text** by content:
  - Red: `WAITING FOR GPS`, `GPS SLEEPING`, `NO GPS`
  - Orange: `Battery` lines
  - Green: altitude (`A=`) and speed (`KM/H`)
  - Grey: `LAST Rx`
  - Cyan: `WLNK MAIL`, `MESSAGES`, date/time lines
  - Yellow: GPS coordinates (lat/lng) and Maidenhead locator (`LoRa[`)
  - White: default
- **Colored APRS symbol bitmap** by category:
  - Cyan: runner `[`, wheelchair `)`, weather station `_`
  - Red: all vehicles (car, jeep, bike, motorcycle, trucks, van, RV, bus, ambulance)
  - Blue: watercraft (ship, canoe, yacht)
  - Green: stations (house, yagi, tent)
  - Magenta: air (balloon, aircraft)
  - Orange: train
  - Yellow: dog
- **Status accent bar** — 2px vertical strip on the left edge:
  - Green = GPS locked
  - Yellow = GPS active but no fix
  - Blue = Bluetooth connected (no GPS)
  - Grey = idle

### Startup screen

- Header bar: military green (was yellow/red)
- Bottom line: `9M2PJU Mod` (was `CA2RXU <version-date>`)
- LoRa region label: `LoRa Freq [MY]` (was `[EU]`)

### LoRa region labels

Renamed the first LoRa preset label from `Eu` / `EU/WORLD` to `MY` / `MALAYSIA` in:
- `src/display.cpp` (startup screen)
- `src/menu_utils.cpp` (main screen `LoRa[MY]`)
- `src/lora_utils.cpp` (frequency change message/log)

### Local time (MYT, UTC+8)

- The on-screen clock now displays **Malaysia Time (UTC+8)** instead of UTC.
- Modified `Utils::createDateString()` and `Utils::createTimeString()` in `src/utils.cpp` to add 8 hours before formatting.
- APRS packet timestamps remain UTC (standards-compliant) — only the display is shifted.

### Configuration (`data/tracker_conf.json`)

- **Callsign:** `9M2PJU-7` on all 3 beacon profiles (was `NOCALL-7`)
- **LoRa preset 1 frequency:** `433400000` Hz = **433.400 MHz** (was 433.775 MHz)
- **Profile 3 symbol:** `<` (motorcycle, was `b` bike)
- **GPS Eco Mode:** enabled on all 3 profiles (was disabled) — GPS sleeps between beacons to save battery

### Summary table

| Setting | Original | This fork |
|---|---|---|
| Header color | yellow/red | military green (`0x4A84`) |
| Body text | all white | color-coded by content |
| APRS symbol color | white | colored by category |
| Status accent bar | none | green/yellow/blue/grey |
| Startup bottom line | `CA2RXU <date>` | `9M2PJU Mod` |
| LoRa region label | `Eu` / `EU/WORLD` | `MY` / `MALAYSIA` |
| Display clock | UTC | MYT (UTC+8) |
| Callsign | `NOCALL-7` | `9M2PJU-7` |
| LoRa freq (preset 1) | 433.775 MHz | 433.400 MHz |
| Profile 3 symbol | bike (`b`) | motorcycle (`<`) |
| GPS Eco Mode | off | on |

____________________________________________________

## Files modified

| File | Changes |
|---|---|
| `src/display.cpp` | Color helpers, color-coded headers/body/symbol, status accent bar, startup screen branding, `MY` label |
| `src/utils.cpp` | UTC+8 offset for display clock (MYT) |
| `src/menu_utils.cpp` | `LoRa[MY]` label |
| `src/lora_utils.cpp` | `MALAYSIA` frequency-change message |
| `data/tracker_conf.json` | Callsign, frequency, symbol, GPS Eco Mode |
| `docs/index.html` | GitHub Pages web installer |
| `docs/manifest-heltec-wireless-tracker.yml` | ESP Web Tools manifest |
| `firmware/heltec_wireless_tracker/` | Pre-built firmware binaries |

____________________________________________________

## Building and flashing (advanced)

This fork is built with PlatformIO for the `heltec_wireless_tracker` environment:

```bash
# Build firmware
pio run -e heltec_wireless_tracker

# Flash firmware
pio run -e heltec_wireless_tracker -t upload

# Flash SPIFFS config image (overwrites live config on device!)
pio run -e heltec_wireless_tracker -t uploadfs
```

**Note:** Flashing `uploadfs` overwrites the device's `/tracker_conf.json`. If you want to keep your live settings, change them via the web UI instead.

____________________________________________________

## Original project features

Tracker with complete MENU:
- Read, Write and Delete Messages (with I2C Keyboard or Phone).
- Asking Weather Report.
- Listening to other Trackers around.
- Changing Display Eco Mode and Screen Brightness.
- Processor from 240Mhz to 80MHz to save almost 20% power consumption.
- All GPS beacons/packets are encoded for less time on RF/LoRa Tx.
- Screen shows Altitude+Speed+Course or BME280 Wx Data or Number of New Messages Received.
- Screen shows Recent Heard Trackers/Station/iGates Tx.
- Bluetooth capabilities to connect (Android + APRSDroid) or (iPhone + APRS.fi app) and use it as TNC.
- Led Notifications for Tx and Messages Received.
- Sound Notifications with YL44 Buzzer Module.
- Wx data with BME280 Module showed on Screen and transmitted as Wx Telemetry.
- Winlink Mails through APRSLink.
- Posibility to change between 3 major Frequencies used by LoRa APRS Worldwide.

____________________________________________________

## Credits

This fork is based on the work of **Ricardo Guzman - CA2RXU**:
- Original repo: https://github.com/richonguzman/LoRa_APRS_Tracker

Which was itself based on:
- https://github.com/aprs434/lora.tracker : Serge - ON4AA on base91 byte-saving/encoding
- https://github.com/lora-aprs/LoRa_APRS_Tracker : Peter - OE5BPA LoRa Tracker
- https://github.com/Mane76/LoRa_APRS_Tracker : Manfred - DC2MH (Mane76) mods for multiple Callsigns and processor speed
- https://github.com/dl9sau/TTGO-T-Beam-LoRa-APRS : Thomas - DL9SAU for the Kiss <> TNC2 lib

Fork modifications by **9M2PJU** — Malaysia.
Web installer powered by [ESP Web Tools](https://esphome.github.io/esp-web-tools/).

# 9M2PJU Mod LoRa APRS Tracker

A Malaysia-tuned fork of the [LoRa APRS Tracker](https://github.com/richonguzman/LoRa_APRS_Tracker) by Ricardo Guzman (CA2RXU), built for the **Heltec Wireless Tracker** board.

ESP32-S3 + LoRa + GPS + 80x160 color TFT, running APRS on **433.400 MHz**.

---

## Web Installer

Flash directly from your browser — no software needed:

### https://lora.hamradio.my

1. Use **Chrome** or **Edge** (Web Serial support required)
2. Plug in your Heltec Wireless Tracker via USB
3. Click **INSTALL NOW**, pick the serial port, click **Install**
4. Done — the tracker reboots with the new firmware

**After flashing, to change settings via web UI:**
1. Enable WiFi AP mode on the tracker (via menu)
2. Connect to WiFi: **LoRaTracker-AP** / password: **1234567890**
3. Open browser to **192.168.4.1**

---

## What's different in this fork

### Display

| Feature | Original | This fork |
|---|---|---|
| Header bar | yellow / red | military green on every screen |
| Body text | all white | color-coded by content |
| APRS symbol | white | colored by category |
| Status bar | none | left-edge accent (GPS/BT state) |
| Startup text | `CA2RXU <date>` | `9M2PJU Mod` |

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

### Config (shipped defaults)

| Setting | Value |
|---|---|
| Callsign | `9M2PJU-7` (all 3 profiles) |
| LoRa frequency | 433.400 MHz |
| Profile 1 symbol | runner `[` |
| Profile 2 symbol | car `>` |
| Profile 3 symbol | motorcycle `<` |
| GPS Eco Mode | on (battery saving) |
| APRS path | `WIDE1-1` |

---

## Files changed

| File | What changed |
|---|---|
| `src/display.cpp` | Color helpers, military green headers, color-coded body text, colored symbols, status accent bar, startup branding |
| `src/utils.cpp` | UTC+8 offset for display clock |
| `src/menu_utils.cpp` | `LoRa[MY]` label |
| `src/lora_utils.cpp` | `MALAYSIA` frequency label |
| `data/tracker_conf.json` | Callsign, frequency, symbols, GPS Eco Mode |
| `docs/index.html` | Web installer page |
| `docs/manifest-heltec-wireless-tracker.yml` | ESP Web Tools flash manifest |
| `firmware/heltec_wireless_tracker/` | Pre-built binaries |

---

## Building from source

Requires [PlatformIO](https://platformio.org/):

```bash
pio run -e heltec_wireless_tracker              # build
pio run -e heltec_wireless_tracker -t upload    # flash firmware
pio run -e heltec_wireless_tracker -t uploadfs  # flash config (overwrites live settings)
```

---

## Original features (from CA2RXU)

- Full menu system with keyboard or phone control
- Read, write, delete APRS messages
- Weather reports via BME280/BMP280/BME680
- Smart Beaconing with turn slope and speed scaling
- Bluetooth TNC (Android/APRSDroid, iPhone/APRS.fi)
- Winlink mail via APRSLink
- Digipeater mode
- LED and buzzer notifications
- 3 beacon profiles with independent settings
- GPS Eco Mode for battery saving

---

## Credits

Based on [LoRa APRS Tracker](https://github.com/richonguzman/LoRa_APRS_Tracker) by **Ricardo Guzman - CA2RXU**.

Which was based on:
- Serge ON4AA — base91 encoding
- Peter OE5BPA — original LoRa Tracker
- Manfred DC2MH — multi-callsign mods
- Thomas DL9SAU — KISS/TNC2 library

Fork by **9M2PJU** — Malaysia.
Web installer powered by [ESP Web Tools](https://esphome.github.io/esp-web-tools/).

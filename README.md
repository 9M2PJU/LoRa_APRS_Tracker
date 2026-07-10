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

**How to use:**
1. Menu → Messages → APRSMYSunday → Check In
2. Quick Check In: sends the canned message `CHECK #APRSMYSunday Net from LoRa Tracker 73!` to callsign `APRSMY`
3. Custom message: type your own text, which gets sent to `APRSMY` with prefix `CHECK #APRSMY `

**Menu path:** Messages → APRSMYSunday → Check In (menu 14 → 140)

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
| `src/menu_utils.cpp` | `LoRa[MY]` label, APRSMYSunday menu entries (case 14/140/1400), SOTA/POTA report menus (case 34/35/340/341/350/351) |
| `src/keyboard_utils.cpp` | APRSMY check-in send logic (lines 363-372, 622-625), SOTA/POTA report send logic |
| `src/lora_utils.cpp` | `MALAYSIA` frequency label |
| `data/tracker_conf.json` | Callsign, frequency, symbols, GPS Eco Mode off |
| `docs/index.html` | Web installer page |
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

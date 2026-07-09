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

## What's different in this fork

### Display

| Feature | Original | This fork |
|---|---|---|
| Header bar | yellow / red | military green on every screen |
| Body text | all white | color-coded by content |
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

### Timeline (Versions)

- 2026-04-22 BT Classic packet fix.
- 2026-01-19 A few bugs fixes on screen timeout and other issues.
- 2025-12-01 APRSPacketLib update.
- 2025-11-26 Custom Status Selection.
- 2025-08-11 New improved Battery Monitor for Heltec Boards. Thanks Tilen S54B.
- 2025-08-10 RPC Electronics 1W LoRa GPS with 1W SX1268 added. APRSPacketLib Library Updated.
- 2025-08-02 Personal Note for each Beacon Callsign. Thanks Tilen S54B.
- 2025.03.28 F4GOH DIY board with ESP32 + GPS + 1W LLCC68 added. APRSPacketLib Library Updated.
- 2025.03.06 F4GOH DIY board with ESP32 + GPS + 1W SX1268 added.
- 2025.02.09 Now Bluetooth connections lets you decide to use BLE/BT Classic and KISS/TNC.
- 2025.01.11 Added HELTEC V3.2 board support.
- 2025.01.07 TROY_LoRa_APRS board added.
- 2025.01.02 Buttons added for DIY Boards and Boards without buttons.
- 2024.11.13 Added Heltec Wireless Stick Lite V3 + GPS + Oled Display support for another DIY ESP32 Tracker.
- 2024.11.13 T-Deck Joystick and Button Pressing Fix for smother operation.
- 2024.10.24 Added QRP Labs LightTracker Plus1.0 support.
- 2024.10.11 Added Lilygo TTGO T-Deck Plus support.
- 2024.10.10 Configuration WiFiAP stops after 1 minute of no-client connected.
- 2024.10.09 WEB INSTALLER/FLASHER.
- 2024.10.07 Battery Monitor process added (Voltage Sleep to protect Battery).
- 2024.09.17 Battery Voltage now as Encoded Telemetry in GPS Beacon.
- 2024.08.26 New reformating of code ahead of WebInstaller: SmartBeacon change.
- 2024.08.16 BLE support for Android devices (not APRSDroid yet).
- 2024.08.12 Added support for EByte E220 400M30S 1Watt LoRa module for DIY ESP32 Tracker (LLCC68 supports spreading factor only in range of 5 - 11!)
- 2024.08.02 New gpsEcoMode added for Testing.
- 2024.08.02 ESP32S3 DIY LoRa GPS added.
- 2024.07.30 HELTEC V3 TNC added.
- 2024.07.01 All boards with 433MHZ and 915MHz versions now.
- 2024.06.21 3rd Party Packets decode added following the corrections on iGate Firmware.
- 2024.06.21 If Tracker Speed > 200km/hr and/or Altitude > 9.000 mts , path ("WIDE1-1") will be omited as its probably a plane.
- 2024.06.21 Wx Telemetry Tx on Tracker only if standing still > 15min. (On screen Wx Data will be available but won't be sent if moving).
- 2024.06.07 Dynamic Height Correction of the BME280 Pressure readings.
- 2024.05.21 WEMOS ESP32 Battery Holder + LoRa SX1278 + GPS Module support added.
- 2024.05.16 all boards now work with Radiolib (LoRa) library from @jgromes.
- 2024.05.13 BME modules will be autodetected (I2C Address and if it is BME280/BMP280/BME680).
- 2024.05.10 PacketBuffer for Rx (25 Seg) and Tx outputPacketBuffer for sending with ACK Request.
- 2024.05.07 HELTEC V3 and Wireless Tracker Battery Measurements at 30seg to avoid accelerated discharge.
- 2024.05.06 New Output Buffer for Messages with retry posibilities.
- 2024.04.25 Added Lilygo TTGO T-Deck (add Neo6Mv2 GPS) support.
- 2024.04.12 Added HELTEC Wireless Tracker support.
- 2024.03.22 3 times pressing middle button for T-Beams turns the Tracker off.
- 2024.03.08 ESP32_C3 DIY LoRa + GPS board added. Thanks Julian OE1JLN.
- 2024.02.29 Now you can change between (EU,PL,UK) LoRa APRS frequencies used worldwide.
- 2024.02.24 New Partitions: more memory for new code/firmware (still > 500 Rx messages available)
- 2024.02.21 Winlink Mails through APRSLink ( https://www.winlink.org/APRSLink/ )
- 2024.01.26 Added Helmut OE5HWN MeshCom PCB support.
- 2024.01.18 BME modules have now a single reading per minute.
- 2024.01.05 Added HELTEC V3 with NEO8M GPS. Thanks Asbjørn LA1HSA.
- 2024.01.04 Added TTGO Lilygo T-Beam S3 Supreme V3 support. Thanks Johannes OE2JPO.
- 2023.12.31 PowerManagment Library AXP192/AXP2101 updated.
- 2023.12.27 Added Led-Flashlight like Baofeng UV5R Led.
- 2023.12.27 Added LoRa APRS Packet Decoder to Stations Menu.
- 2023.12.26 Added BME680 (to the already BME/BMP280) support for Wx Telemetry Tx.
- 2023.12.22 Added APRSThrusday on Messages Menu to parcitipate from this exercise ( https://aprsph.net/aprsthursday/ )
- 2023.12.19 Added support for T-Beam V1.2 with Neo8M GPS and SX1262 LoRa Modules.
- 2023.12.18 Added Mic-E encoding and decoding.
- 2023.12.12 Added BMP280 (to the already BME280) support for Wx Telemetry Tx.
- 2023.12.11 Added support for EByte 400M30S 1Watt LoRa module for DIY ESP32 Tracker.
- 2023.12.07 Added TTGO Lilygo LoRa32 v2.1 board as Bluetooth TNC(Android/Apple) and as a Tracker (with external GPS module).
- 2023.12.07 Added ESP32 as DIY Tracker (with external GPS Module) with LoRa SX1278 module.
- 2023.12.06 T-Beam V1.2 as default board.
- 2023.12.05 Updated packets recognition (+Objects + Mic-E).
- 2023.11.28 Adding BLE connection to use it as TNC with APRS.fi app for iOS.
- 2023.11.07 Digipeater Mode added in Emergency Menu.
- 2023.10.23 COMPLETE New Menu for Keyboard add-on.
- 2023.10.22 Added Keyboard Support over I2C ( CARDKB from https://m5stack.com )
- 2023.10.07 Screen Brightness control added.
- 2023.10.01 Added Wx Telemetry Tx with BME280 Module attached to Tracker.
- 2023.09.28 Added Support for V.1 board with SX1268 LoRa Module.
- 2023.09.25 Wiki added.
- 2023.09.16 Adding Led notification for Beacon Tx and for Message Received.
- 2023.09.14 Adding buzzer sounds for BootUp, BeaconTx, MessageRx and more.
- 2023.09.11 Saving last used Callsign into internal Memory to remember it at next boot.
- 2023.09.05 Adding "simplified Tracker Mode": only GPS beacons Tx.
- 2023.08.27 Adding support to connect BME280 and see Temperature, Humidity, Pressure.
- 2023.08.12 Adding also support for old V0_7 board. Thanks Béla Török.
- 2023.08.09 Adding Bluetooth capabilities with Kiss and TNC2, TTGO Lora 32. Thanks Thomas DL9SAU.
- 2023.08.08 Added Maidenhead info on Screen. Thanks Mathias "mpbraendli".
- 2023.08.06 Added Bluetooth Support for TNC in Android/APRSDroid. Thanks Valentin F4HVV.
- 2023.08.05 New Support for SH1106 Oled Screen (0,96" and 1.3")
- 2023.07.24 New Validation for Callsings, Overlay change and New Icons (Bike, Motorcycle).
- 2023.07.18 Add Support for triggering PTT to external amplifier.
- 2023.07.16 New Icons for Oled Screen (Runner, Car, Jeep)
- 2023.07.01 Added Support for new T-Beam AXP2101 v1.2 Board.
- 2023.06.26 Weather Report now stays until button pressed, to avoid missing it.
- 2023.06.25 Sends comment after X count of beacons.
- 2023.06.24 displayEcoMode=true doesn't turn the screen off at boot.
- 2023.06.23 Return to from any Menu number to Main Menu (Tracker) after 30 segs.
- 2023.06.20 Major Code Repacking.
- 2023.06.01 Adding Turn Slope calculations for Smart Beacon and Display Eco Mode.
- 2023.05.29 New Config file for adding more new ideas to the Tracker.
- 2023.05.27 Adding Altitude + Speed or Course + Speed in the encoded GPS info.
- 2023.05.21 Adding Last-Heard LoRa Stations/Trackers.
- 2023.05.14 Adding Menu.
- 2023.05.12 Saving Messages to Internal Memory.
- 2023.04.16 Sending and Receiving LoRa Packets.

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

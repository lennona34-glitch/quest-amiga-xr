# 🛡️ COMMODORE GUARDIAN

### Mixed Reality & Desktop Retro Emulation Platform for Meta Quest 3 and Modern Web Browsers
**Commodore Amiga (OCS/ECS) • Amiga 1200 (AGA 68020) • Amiga CD32 (Akiko) • Commodore 64 • Commodore Plus/4 • Commodore VIC-20**

---

![Commodore Guardian](public/sounds/retro_badge.png)

**Commodore Guardian** is a 3D Mixed Reality and desktop cyber-workstation built with Three.js, WebXR, and WebAssembly emulation cores. It brings the golden age of Commodore computing into spatial computing and modern PCs, featuring authentic CRT monitor simulation, 1-click archive streaming, low-latency netplay, and full demoscene integration.

---

## ⚡ Key Features

- **🎮 Comprehensive Hardware Emulation:**
  - **Amiga 500 / 500+ / 600:** Cycle-exact OCS/ECS emulation via **vAmiga WebAssembly**.
  - **Amiga 1200 AGA:** Full Motorola 68020 32-bit CPU, 2MB Chip + 8MB Fast RAM, and AGA Lisa chipset via **Libretro PUAE WebAssembly**.
  - **Amiga CD32:** Complete CD-ROM console emulation with Akiko custom chip, CD-DA multi-track audio playback, and ISO/CUE support via **Libretro PUAE**.
  - **Commodore 64:** MOS 6510 CPU, cycle-exact SID 6581 sound synthesis, and VIC-II graphics via **VICE x64sc WebAssembly**.
  - **Commodore Plus/4 & C16:** MOS 7501 CPU and TED 7360 121-color graphics via **VICE xplus4 WebAssembly**.
  - **Commodore VIC-20:** MOS 6502 and VIC 6560 sound/graphics via **VICE xvic WebAssembly**.

- **🥽 Spatial Computing & VR/AR:**
  - **WebXR Immersive VR:** Sit in a 3D retro office with physical floppy disks, disk drives with functioning LEDs, and Commodore 1084S monitor.
  - **Meta Quest 3 AR Passthrough:** Pin a floating authentic 1084S CRT monitor directly in your living room or workspace.

- **📺 Deep Graphics & Authentic 1084S CRT Shaders:**
  - Real-time phosphor scanlines, bloom, vignette, and live tube curvature.
  - Live color palette switching: **Authentic RGB**, **Moody Green Screen (Phosphor P1)**, **Amber Phosphor (P4)**, **Paper White (P40)**, and **Sepia**.
  - Aspect ratio switcher: **4:3 Retro**, **1:1 Pixel-Exact Square**, and **16:9 Cinematic**.
  - Sub-frame input latency with configurable **Run-Ahead frame simulation**.

- **🖱️ Flexible Mouse Capture & MOOching:**
  - Dedicated **`🖱️ Mouse: OFF / ON`** capture toggle button.
  - Keeps the cursor free for effortless UI navigation and catalog browsing.
  - Press <kbd>Esc</kbd> or <kbd>Middle-Click</kbd> at any time to instantly release cursor back to desktop.

- **🧘 Fullscreen Zen Mode:**
  - Distraction-free full-screen retro experience with auto-hiding bottom toolbar.
  - Global hotkeys available across all emulator modes:
    - <kbd>R</kbd> — Random Game
    - <kbd>O</kbd> — Deep Graphics & Display Modal
    - <kbd>V</kbd> — Commodore Scene Vault
    - <kbd>C</kbd> — Cheats & Trainer POKEs
    - <kbd>M</kbd> — Toggle Mouse Capture
    - <kbd>Z</kbd> / <kbd>Esc</kbd> — Toggle Zen Mode
    - <kbd>F8</kbd> or <kbd>E</kbd> — Toggle 1084S Easy CRT Filter
    - <kbd>N</kbd> — Copperline P2P Netplay

- **🏛️ Commodore Scene Vault:**
  - Direct integration with **CSDb** (C64 Scene Database), **Plus/4 World**, **Pouët**, and **Demozoo**.
  - 1-click live streaming of demoscene productions, music disks, and homebrew releases.

- **🌐 Copperline P2P Netplay:**
  - Zero-server, WebRTC peer-to-peer 2-player multiplayer.
  - Share a room link or QR code to play against another player on Meta Quest 3 or another PC.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Modern browser (Chrome, Edge, or Meta Quest Browser with WebXR enabled)

### Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/commodore-guardian.git

# Navigate into project directory
cd commodore-guardian

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `https://localhost:5173/` in your browser. (Accept self-signed certificate if prompted).

---

## 💾 Firmware & ROM Setup

For copyright reasons, proprietary Commodore Kickstart ROMs are not redistributed with this repository. Open-source **AROS** firmware is included out of the box.

To enable genuine Commodore hardware firmware:
1. Place your ROM files in `public/roms/`:
   - `kick13.rom` (Amiga 500 Kickstart 1.3)
   - `kick204.rom` (Amiga 500+ / 600 Kickstart 2.04)
   - `kick31.rom` / `kick40068.A1200` (Amiga 1200 Kickstart 3.1)
   - `kick40060.CD32` and `kick40060.CD32.ext` (Amiga CD32 Firmware)
2. The platform will automatically detect and bind the appropriate Kickstart ROM on boot.

---

## 📜 License
Licensed under MIT License. All emulator cores (vAmiga, Libretro PUAE, VICE) maintain their respective GNU General Public Licenses (GPL).

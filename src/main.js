/**
 * Amiga XR - Master Client Application
 * Bridges Windows Chrome (Station & Director) and Meta Quest 3 (Mixed Reality & VR)
 */
import * as THREE from 'three';
import { createAmigaCRTMaterial } from './display/crt-material.js';
import { createAmigaStation, createAmigaFloppyDisk } from './room/amiga-model.js';
import { createRetroDen } from './room/retro-den.js';
import { AmigaXRManager } from './xr/xr-manager.js';
import { AmigaXRControllers } from './xr/xr-controllers.js';
import { RemoteRelay } from './network/remote-relay.js';
import { TosecUI } from './ui/tosec-ui.js';
import './ui/station.css';

class AmigaXRApp {
  constructor() {
    this.relay = new RemoteRelay();
    this.ui = null;
    this.emuIframe = null;
    this.emuCanvas = null;
    this.screenTexture = null;
    this.screenMaterial = null;
    this.amigaStation = null;
    this.retroDen = null;
    this.xrManager = null;
    this.xrControllers = null;
    this.interactiveDisks = [];

    // Current state - defaults to authentic Kickstart 1.3
    this.currentRom = 'roms/kick13.rom';
    this.currentEngine = 'vamiga';
    this.currentModel = 'A500';
    this.currentDiskDF0 = null;
    this.currentDiskDF1 = null;
    this.zenMode = false;
  }

  async init() {
    console.log('[Amiga XR] Initializing system...');

    // Commodore Guardian PC Optimizations (Hardware GPU Shaders, 60fps frame sync, sub-ms input response)
    try {
      localStorage.setItem('renderer', 'gpu shader');
      localStorage.setItem('pixel_art', 'true');
      localStorage.setItem('frame_sync', '100%');
      localStorage.setItem('OPT_EMU_RUN_AHEAD', '1');
    } catch(e) {}

    // 1. Initialize UI
    const appEl = document.getElementById('app');
    this.ui = new TosecUI({
      onDiskSelect: (unit, file, title, isBoot, targetSystem) => this.mountDisk(unit, file, title, true, isBoot, targetSystem),
      onDiskEject: (unit) => this.ejectDisk(unit, true),
      onReset: () => this.resetAmiga(true),
      onEnterXR: (mode) => this.enterXR(mode),
      onRomChange: (rom) => this.switchKickstart(rom),
      onZenToggle: (state) => this.toggleZenMode(state),
      onRequestMouseLock: () => this.requestMouseLock(),
      onReleaseMouseLock: () => this.releaseMouseLock(),
      onEngineToggle: () => this.toggleEngine(),
      onApplyPoke: (address, value) => this.applyPoke(address, value),
      onApplyMultiPoke: (pokes) => this.applyMultiPoke(pokes),
      onSplashModeChange: (mode) => {
        console.log('[Commodore Guardian] Splash mode switched to:', mode);
        this.switchKickstart(this.currentRom, false);
      },
      onOpenSettings: () => this.openEmulatorSettings(),
      onChangeDisk: (diskIdx) => this.changeEmulatorDisk(diskIdx)
    });
    this.ui.render(appEl);

    // Listen for pointer lock and status messages from emulator iframes
    window.addEventListener('message', (event) => {
      if (event.data && event.data.msg === 'pointer_lock_change') {
        const locked = !!event.data.locked;
        if (this.ui) {
          this.ui.setMouseLockState(locked);
        }
      }
      if (event.data && event.data.msg === 'guardian_middle_click') {
        this.releaseMouseLock();
      }
      if (event.data && event.data.msg === 'gamepad_status') {
        if (this.ui) {
          this.ui.updateGamepadStatus({ id: event.data.id }, event.data.connected);
        }
      }
      if (event.data && event.data.type === 'guardian_disks_info') {
        if (this.ui && typeof this.ui.updateMultiDiskControls === 'function') {
          this.ui.updateMultiDiskControls(event.data.diskCount, event.data.currentDisk);
        }
      }
    });

    // Native pointerlockchange listener on document
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      if (this.ui) {
        this.ui.setMouseLockState(locked);
      }
    });

    // Middle-click (button 1) traps or releases the mouse
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        if (this.ui && this.ui.mouseLocked) {
          this.releaseMouseLock();
        } else {
          this.requestMouseLock();
        }
      }
    }, true);
    window.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Sync fullscreen state with Zen mode
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      if (!isFs && this.zenMode) {
        this.toggleZenMode(false);
      }
    });

    // Unconditionally wake up WebAudio on any user click / keydown on host page
    const unlockAudio = () => this.resumeEmulatorAudio();
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    // 2. Connect Remote Relay WebSocket & PC Input Bridge (Keyboard, Mouse, Gamepad over LAN)
    this.setupRelay();
    this.setupPcInputBridge();

    // 3. Initialize Emulator Container (vAmigaWeb)
    this.setupEmulatorIframe();

    // 4. Initialize Three.js WebXR Scene (Snapdragon XR2 Gen 2 accelerated)
    this.setupWebXRScene();
  }

  resumeEmulatorAudio() {
    if (this.emuIframe && this.emuIframe.contentWindow) {
      try {
        const win = this.emuIframe.contentWindow;
        win.postMessage({ cmd: 'resume_audio' }, '*');
        win.postMessage('resume_audio', '*');
        if (typeof win.vAmiga_resume_audio === 'function') {
          win.vAmiga_resume_audio();
        }
        if (win.audioContext && win.audioContext.state === 'suspended') {
          win.audioContext.resume().catch(() => {});
        }
        if (win.__allAudioContexts) {
          win.__allAudioContexts.forEach(c => {
            if (c && c.state === 'suspended') c.resume().catch(() => {});
          });
        }
        if (win.EJS_emulator) {
          if (win.EJS_emulator.audioContext && win.EJS_emulator.audioContext.state === 'suspended') {
            win.EJS_emulator.audioContext.resume().catch(() => {});
          }
          if (win.EJS_emulator.Module?.AL?.currentCtx?.audioCtx?.state === 'suspended') {
            win.EJS_emulator.Module.AL.currentCtx.audioCtx.resume().catch(() => {});
          }
          if (typeof win.EJS_emulator.setVolume === 'function') {
            win.EJS_emulator.muted = false;
            win.EJS_emulator.setVolume(1.0);
          }
        }
      } catch (e) {}
    }
  }

  toggleEngine() {
    const engines = ['vamiga', 'c64', 'plus4', 'puae'];
    const idx = engines.indexOf(this.currentEngine);
    const nextEngine = engines[(idx + 1) % engines.length];
    console.log(`[Commodore Guardian] Cycling engine from ${this.currentEngine} to ${nextEngine}`);
    let nextRom = 'roms/kick13.rom';
    if (nextEngine === 'c64') nextRom = 'c64';
    else if (nextEngine === 'plus4') nextRom = 'plus4';
    else if (nextEngine === 'puae') nextRom = 'puae_a1200';
    
    this.currentRom = nextRom;
    const selectEl = document.getElementById('select_kickstart');
    if (selectEl) selectEl.value = this.currentRom;
    this.setupEmulatorIframe(nextEngine);
  }

  setupRelay() {
    this.relay.connect();

    this.relay.on('peer_count', (e) => {
      this.ui.setPeerCount(e.count);
    });

    this.relay.on('insert_disk', (e) => {
      console.log('[Amiga XR Relay] Received remote disk insert:', e);
      this.mountDisk(e.unit, e.file, e.title, false);
      const nameEl = document.getElementById(`df${e.unit}_disk_name`);
      if (nameEl) nameEl.textContent = e.title;
      this.ui.playSound('insert');
      this.ui.playSound('step');
    });

    this.relay.on('eject_disk', (e) => {
      console.log('[Amiga XR Relay] Received remote disk eject:', e);
      this.ejectDisk(e.unit, false);
      const nameEl = document.getElementById(`df${e.unit}_disk_name`);
      if (nameEl) nameEl.textContent = 'Empty';
      this.ui.playSound('eject');
    });

    this.relay.on('reset_amiga', () => {
      this.resetAmiga(false);
    });

    this.relay.on('switch_rom', (msg) => {
      if (!msg || !msg.romPath) return;
      console.log('[Commodore Guardian Netplay] Remote machine switch received:', msg.romPath);
      const selectEl = document.getElementById('select_kickstart');
      if (selectEl) selectEl.value = msg.romPath;
      this.switchKickstart(msg.romPath, false);
    });

    // Remote Input Receivers (Forwarding PC Keyboard, Mouse, and Gamepad to Quest VR)
    this.relay.on('remote_key', (msg) => {
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({ cmd: 'remote_key', ...msg }, '*');
      }
    });

    this.relay.on('remote_mouse', (msg) => {
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({ cmd: 'remote_mouse', ...msg }, '*');
      }
    });

    this.relay.on('remote_gamepad', (msg) => {
      // Avoid double-posting on host station which already polls its local gamepads
      if (this.pcBridgeActive) return;
      if (this.emuIframe && this.emuIframe.contentWindow) {
        if (msg.joystick) {
          this.emuIframe.contentWindow.postMessage({
            cmd: 'joystick',
            port: 2,
            ...msg.joystick
          }, '*');
        }
      }
    });
  }

  setupPcInputBridge() {
    this.pcBridgeActive = true; // Active on PC Station

    // 1. Physical PC Keyboard -> WebXR Quest Relay & Local Emulator
    const handleKey = (e) => {
      // Prevent browser default actions for Function keys (F1=Help, F3=Find, F5=Reload, etc.)
      if (e.key && (e.key === 'F1' || /^F([1-9]|1[0-2])$/.test(e.key) || e.key === 'Tab')) {
        e.preventDefault();
      }

      // Allow normal typing inside search and cheat input fields
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      if (!this.pcBridgeActive) return;

      const keyPayload = {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        which: e.which || e.keyCode,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      };

      // Transmit to connected Quest 3 headset over WebSocket
      this.relay.sendRemoteKey(e.type, keyPayload);

      // Also forward locally to active emulator iframe
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({
          cmd: 'remote_key',
          subType: e.type,
          ...keyPayload
        }, '*');
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);

    // 2. Physical PC Mouse -> WebXR Quest Relay & Local Emulator
    const isHudTarget = (target) => {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (['select', 'option', 'input', 'textarea', 'button'].includes(tag)) return true;
      if (typeof target.closest === 'function') {
        return !!(target.closest('.hud-header') || target.closest('.catalog-panel') || target.closest('#select_kickstart') || target.closest('.catalog-filters'));
      }
      return false;
    };

    const handleMouseMove = (e) => {
      if (!this.pcBridgeActive) return;
      if (isHudTarget(e.target)) return;
      const isLocked = !!(document.pointerLockElement || (this.ui && this.ui.mouseLocked));
      const hasMovement = Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0;
      if (isLocked || (hasMovement && e.buttons > 0)) {
        const mouseData = {
          movementX: e.movementX,
          movementY: e.movementY,
          buttons: e.buttons
        };
        this.relay.sendRemoteMouse('mousemove', mouseData);
        if (this.emuIframe && this.emuIframe.contentWindow) {
          this.emuIframe.contentWindow.postMessage({
            cmd: 'remote_mouse',
            subType: 'mousemove',
            ...mouseData
          }, '*');
        }
      }
    };

    const handleMouseDown = (e) => {
      if (!this.pcBridgeActive) return;
      if (isHudTarget(e.target)) return;
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      const isLocked = !!(document.pointerLockElement || (this.ui && this.ui.mouseLocked));

      const mouseData = {
        button: e.button,
        buttons: e.buttons
      };
      this.relay.sendRemoteMouse('mousedown', mouseData);
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({
          cmd: 'remote_mouse',
          subType: 'mousedown',
          ...mouseData
        }, '*');
      }
    };

    const handleMouseUp = (e) => {
      if (!this.pcBridgeActive) return;
      if (isHudTarget(e.target)) return;
      const mouseData = {
        button: e.button,
        buttons: e.buttons
      };
      this.relay.sendRemoteMouse('mouseup', mouseData);
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({
          cmd: 'remote_mouse',
          subType: 'mouseup',
          ...mouseData
        }, '*');
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });

    // 3. Wireless / USB Controller -> WebXR Quest Relay (Xbox, PlayStation, 8BitDo, USB Gamepads)
    let lastJoy = {};
    let lastJoyTransmit = 0;
    const pollGamepads = () => {
      if (this.pcBridgeActive && navigator.getGamepads) {
        try {
          const gamepads = navigator.getGamepads();
          let chosenPad = null;
          let padState = null;

          for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad || !pad.connected) continue;

            const axes = pad.axes || [0, 0, 0, 0];
            const buttons = pad.buttons || [];

            // 1. Analogue Thumbstick (Left Stick strictly on axes 0 & 1, avoiding trigger axis bleed)
            let stickUp = false;
            let stickDown = false;
            let stickLeft = false;
            let stickRight = false;

            const sx = axes[0] || 0;
            const sy = axes[1] || 0;
            const mag = Math.hypot(sx, sy);

            if (mag >= 0.25) {
              // 8-directional angular sector resolution (45° cone per direction, crisp diagonals)
              const deg = Math.atan2(sy, sx) * (180 / Math.PI);
              if (deg >= -22.5 && deg < 22.5) {
                stickRight = true;
              } else if (deg >= 22.5 && deg < 67.5) {
                stickDown = true;
                stickRight = true;
              } else if (deg >= 67.5 && deg < 112.5) {
                stickDown = true;
              } else if (deg >= 112.5 && deg < 157.5) {
                stickDown = true;
                stickLeft = true;
              } else if (deg >= 157.5 || deg < -157.5) {
                stickLeft = true;
              } else if (deg >= -157.5 && deg < -112.5) {
                stickUp = true;
                stickLeft = true;
              } else if (deg >= -112.5 && deg < -67.5) {
                stickUp = true;
              } else if (deg >= -67.5 && deg < -22.5) {
                stickUp = true;
                stickRight = true;
              }
            }

            // 2. Digital D-Pad (Standard Gamepad API buttons 12-15)
            const dpadUp = !!(buttons[12] && buttons[12].pressed);
            const dpadDown = !!(buttons[13] && buttons[13].pressed);
            const dpadLeft = !!(buttons[14] && buttons[14].pressed);
            const dpadRight = !!(buttons[15] && buttons[15].pressed);

            // 3. Fallback for older / DirectInput Gamepads mapping D-pad to axes 4-7
            let altHatUp = false;
            let altHatDown = false;
            let altHatLeft = false;
            let altHatRight = false;
            if (axes.length >= 6) {
              const axX = (axes.length >= 8) ? axes[6] : axes[4];
              const axY = (axes.length >= 8) ? axes[7] : axes[5];
              if (typeof axX === 'number' && typeof axY === 'number') {
                if (axX < -0.5) altHatLeft = true;
                else if (axX > 0.5) altHatRight = true;
                if (axY < -0.5) altHatUp = true;
                else if (axY > 0.5) altHatDown = true;
              }
            }

            const up = stickUp || dpadUp || altHatUp;
            const down = stickDown || dpadDown || altHatDown;
            const left = stickLeft || dpadLeft || altHatLeft;
            const right = stickRight || dpadRight || altHatRight;

            // Dedicated mappings: A/RT = Red (Shoot), B/LT = Blue (Retreat Mode / Jump), X = Green, Y = Yellow (Weapons), LB/RB = Shoulders, Start = Play
            const fire = !!((buttons[0] && buttons[0].pressed) || (buttons[7] && buttons[7].pressed));
            const fire2 = !!((buttons[1] && buttons[1].pressed) || (buttons[6] && buttons[6].pressed));
            const green = !!(buttons[2] && buttons[2].pressed);
            const yellow = !!(buttons[3] && buttons[3].pressed);
            const lShoulder = !!(buttons[4] && buttons[4].pressed);
            const rShoulder = !!(buttons[5] && buttons[5].pressed);
            const play = !!((buttons[9] && buttons[9].pressed) || (buttons[8] && buttons[8].pressed));

            const isNonNeutral = up || down || left || right || fire || fire2 || green || yellow || lShoulder || rShoulder || play;

            if (isNonNeutral) {
              chosenPad = pad;
              padState = { up, down, left, right, fire, fire2, green, yellow, lShoulder, rShoulder, play, isNonNeutral, axes, buttons };
              break;
            } else if (!chosenPad) {
              chosenPad = pad;
              padState = { up, down, left, right, fire, fire2, green, yellow, lShoulder, rShoulder, play, isNonNeutral, axes, buttons };
            }
          }

          if (padState && chosenPad) {
            const { up, down, left, right, fire, fire2, green, yellow, lShoulder, rShoulder, play, isNonNeutral, axes, buttons } = padState;
            const stateChanged = (
              up !== lastJoy.up ||
              down !== lastJoy.down ||
              left !== lastJoy.left ||
              right !== lastJoy.right ||
              fire !== lastJoy.fire ||
              fire2 !== lastJoy.fire2 ||
              green !== lastJoy.green ||
              yellow !== lastJoy.yellow ||
              lShoulder !== lastJoy.lShoulder ||
              rShoulder !== lastJoy.rShoulder ||
              play !== lastJoy.play
            );

            const now = performance.now();
            // Transmit immediately on state change, or heartbeat every 50ms while held to avoid timeouts
            if (stateChanged || (isNonNeutral && (now - lastJoyTransmit > 50))) {
              lastJoyTransmit = now;
              lastJoy = { up, down, left, right, fire, fire2, green, yellow, lShoulder, rShoulder, play };
              const safeButtons = Array.from(buttons || []).map(b => ({
                pressed: !!(b && b.pressed),
                value: (b && typeof b.value === 'number') ? b.value : (b && b.pressed ? 1 : 0)
              }));
              this.relay.sendRemoteGamepad({
                id: chosenPad.id,
                index: chosenPad.index,
                joystick: lastJoy,
                axes: [axes[0] || 0, axes[1] || 0],
                buttons: safeButtons
              });

              // Forward locally to active emulator iframe
              if (this.emuIframe && this.emuIframe.contentWindow) {
                this.emuIframe.contentWindow.postMessage({
                  cmd: 'joystick',
                  port: 2,
                  ...lastJoy
                }, '*');
              }
            }
          }
        } catch(gpErr) {
          console.warn('[Gamepad Poll Warning]:', gpErr);
        }
      }
      requestAnimationFrame(pollGamepads);
    };
    requestAnimationFrame(pollGamepads);
    console.log('[Amiga XR] PC Input Bridge initialized (forwarding Keyboard, Mouse, and Wireless Gamepad over LAN)');
  }

  getEmuConfig() {
    const config = {
      navbar: false,
      wide: false, // Authentic 4:3 Commodore aspect ratio strictly enforced at all times
      display: 'standard', // Full authentic PAL/NTSC 4:3 visible display window
      gpu: true, // Hardware-accelerated WebGL GPU shader renderer for 60fps locked, full resolution interlace & CRT
      pixel_art: true, // Ultra-crisp nearest-neighbor pixel rendering on modern PC monitors
      dialog_on_missing_roms: false,
      mouse: true
    };
    if (this.currentRom === 'aros') {
      config.kickstart_rom_url = 'roms/aros-rom-20260820.bin';
      config.kickstart_ext_url = 'roms/aros-ext-20260820.bin';
      config.model = 'A500+_BOOST';
    } else if (this.currentRom === 'cd32' || this.currentRom.includes('cd32')) {
      config.kickstart_rom_url = 'roms/kick40060.CD32';
      config.kickstart_ext_url = 'roms/kick40060.CD32.ext';
      config.model = 'CD32';
    } else if (this.currentRom.includes('kick31')) {
      config.kickstart_rom_url = 'roms/kick31.rom';
      config.model = 'A1200_STOCK';
    } else if (this.currentRom.includes('kick204')) {
      config.kickstart_rom_url = 'roms/kick204.rom';
      config.model = 'A500+_STOCK';
    } else {
      config.kickstart_rom_url = 'roms/kick13.rom';
      config.model = 'A500_VANILLA';
    }
    return config;
  }

  setupEmulatorIframe(targetEngine, gameUrl = null, title = '', explicitCore = null, explicitModel = null) {
    const slot = document.getElementById('emulator_canvas_slot');
    if (!slot) return;

    let engine = targetEngine;
    if (!engine) {
      if (['c64', 'plus4', 'vic20'].includes(this.currentRom)) {
        engine = this.currentRom;
      } else if (this.currentRom === 'puae_a1200' || this.currentRom === 'puae_cd32' || this.currentRom.includes('kick31') || this.currentRom.includes('cd32')) {
        engine = 'puae';
      } else {
        engine = 'vamiga';
      }
    }

    this.currentEngine = engine;
    if (this.ui) this.ui.setEngine(engine);

    slot.innerHTML = '';
    this.emuIframe = document.createElement('iframe');
    this.emuIframe.id = `${engine}_frame`;
    this.emuIframe.allow = 'autoplay; fullscreen; cross-origin-isolated; pointer-lock; gamepad';

    if (['puae', 'c64', 'plus4', 'vic20'].includes(engine)) {
      const coreMap = {
        puae: 'amiga',
        c64: 'c64',
        plus4: 'plus4',
        vic20: 'vic20'
      };
      let isGuardian = true;
      try {
        isGuardian = localStorage.getItem('guardian_splash') !== 'bios';
      } catch(e) {}

      let defaultGame = isGuardian ? '/disks/amiga_guardian.adf' : '/disks/blank.adf';
      if (engine === 'c64') defaultGame = isGuardian ? '/disks/c64_guardian.prg' : '/disks/c64_blank.d64';
      else if (engine === 'plus4') defaultGame = isGuardian ? '/disks/plus4_guardian.prg' : '/disks/plus4_blank.d64';
      else if (engine === 'vic20') defaultGame = '/disks/c64_blank.d64';
      else if (explicitCore === 'cd32' || explicitModel === 'CD32' || this.currentRom === 'puae_cd32') {
        defaultGame = isGuardian ? '/disks/cd32_boot.iso' : '/disks/blank.adf';
      }

      const effectiveCore = explicitCore || (this.currentRom === 'puae_cd32' ? 'cd32' : (coreMap[engine] || 'amiga'));
      const effectiveModel = explicitModel || (effectiveCore === 'cd32' || this.currentRom === 'puae_cd32' ? 'CD32' : (this.currentRom === 'puae_a1200' ? 'A1200' : null));
      this.currentModel = effectiveModel;

      let warpBoot = true;
      try {
        warpBoot = localStorage.getItem('c64_warp_boot') !== 'false';
      } catch(e) {}

      const isCrt = localStorage.getItem('crt_filter_enabled') === 'true';

      const runnerConfig = {
        core: effectiveCore,
        model: effectiveModel,
        warpBoot: warpBoot,
        crt: isCrt,
        gameUrl: (gameUrl && gameUrl.trim()) ? gameUrl : defaultGame,
        title: title || ''
      };
      this.emuIframe.src = `/puae/index.html#${encodeURIComponent(JSON.stringify(runnerConfig))}`;
      console.log(`[Commodore Guardian] Initializing ${engine.toUpperCase()} engine iframe (${runnerConfig.core}, model=${runnerConfig.model})`);
    } else {
      this.currentModel = 'A500';
      const cfg = this.getEmuConfig();
      this.emuIframe.src = `/vAmigaWeb/index.html#${encodeURIComponent(JSON.stringify(cfg))}`;
      console.log('[Commodore Guardian] Initializing vAmiga (OCS/ECS) engine iframe');
    }

    slot.appendChild(this.emuIframe);

    // Clicking anywhere in the canvas slot wakes audio and captures mouse focus
    slot.addEventListener('click', (e) => {
      this.resumeEmulatorAudio();
      if (e.button === 0 && (!this.ui || !this.ui.mouseLocked)) {
        this.requestMouseLock();
      }
    });

    this.emuIframe.onload = () => {
      console.log(`[Commodore Guardian] ${engine.toUpperCase()} engine loaded`);
      try {
        const isCrt = localStorage.getItem('crt_filter_enabled') === 'true';
        if (this.emuIframe.contentWindow) {
          this.emuIframe.contentWindow.postMessage({ cmd: 'toggle_crt', enabled: isCrt }, '*');
        }
      } catch(e) {}
      setTimeout(() => {
        try {
          const doc = this.emuIframe.contentDocument || this.emuIframe.contentWindow.document;
          if (doc) {
            this.emuCanvas = doc.getElementById('canvas') || doc.querySelector('canvas');
            if (this.emuCanvas) {
              console.log('[Commodore Guardian] Hooked live canvas texture:', this.emuCanvas);
              if (this.screenTexture) {
                this.screenTexture.image = this.emuCanvas;
                this.screenTexture.needsUpdate = true;
              }
            }
          }
        } catch (e) {
          console.warn('[Commodore Guardian] Canvas direct access:', e.message);
        }
      }, 1500);
    };
  }

  switchKickstart(romPath, broadcast = true) {
    console.log('[Commodore Guardian] Switching machine / ROM to:', romPath);
    this.currentRom = romPath;
    if (broadcast && this.relay) {
      this.relay.send('switch_rom', { romPath });
    }
    if (romPath === 'c64') {
      this.setupEmulatorIframe('c64', '', 'Commodore 64');
    } else if (romPath === 'plus4') {
      this.setupEmulatorIframe('plus4', '', 'Commodore Plus/4');
    } else if (romPath === 'vic20') {
      this.setupEmulatorIframe('vic20', '', 'Commodore VIC-20');
    } else if (romPath === 'puae_cd32') {
      this.setupEmulatorIframe('puae', '', 'Amiga CD32 Console', 'cd32', 'CD32');
    } else if (romPath === 'puae_a1200' || romPath.includes('kick31')) {
      this.setupEmulatorIframe('puae', '/disks/blank.adf', 'Amiga 1200 AGA (Kickstart 3.1)', 'amiga', 'A1200');
    } else {
      this.setupEmulatorIframe('vamiga');
    }
  }

  openEmulatorSettings() {
    if (this.ui && typeof this.ui.toggleDisplayModal === 'function') {
      this.ui.toggleDisplayModal();
      return;
    }
    if (this.emuIframe && this.emuIframe.contentWindow) {
      console.log('[Commodore Guardian] Dispatching open_settings to emulator iframe');
      this.emuIframe.contentWindow.postMessage({ cmd: 'open_settings' }, '*');
    }
  }

  async mountDisk(unit, relPath, title, broadcast = true, isBoot = false, targetSystem = null) {
    this.resumeEmulatorAudio();

    // If booting a Disk 1 or new game, always force DF0: / Drive 8
    if (isBoot) {
      unit = 0;
    }

    console.log(`[Commodore Guardian] Mounting ${title} into Drive ${unit} (isBoot=${isBoot}, targetSystem=${targetSystem})`);
    this.ui.setDriveLED(unit, true);
    if (this.amigaStation) {
      this.amigaStation.setDriveActive(true);
    }

    const lowerTitle = title.toLowerCase();
    const lowerRel = relPath.toLowerCase();
    const ext = relPath.split('.').pop().toLowerCase();

    // 1. Detect target Commodore system
    const isCdFormat = (ext === 'iso' || ext === 'cue' || ext === 'chd' || ext === 'nrg');
    const isCd32Repo = lowerRel.includes('commodore amiga cd32') || lowerRel.includes('cd32 [tosec]');
    const isCd32 = (targetSystem === 'cd32') || isCdFormat || isCd32Repo;

    const isAga = (targetSystem === 'aga') ||
                  lowerTitle.includes('(aga)') ||
                  lowerTitle.includes('[aga]') ||
                  lowerRel.includes('(aga)') ||
                  lowerRel.includes('[aga]') ||
                  /\baga\b/i.test(title) ||
                  /\baga\b/i.test(relPath);

    let targetEngine = null;
    if (isCd32 || isAga) {
      targetEngine = 'puae';
    } else if (targetSystem) {
      if (targetSystem === 'aga' || targetSystem === 'cd32') {
        targetEngine = 'puae';
      } else if (targetSystem === 'amiga') {
        targetEngine = 'vamiga';
      } else {
        targetEngine = targetSystem;
      }
    } else if (
      lowerTitle.includes('plus4') ||
      lowerTitle.includes('plus/4') ||
      lowerTitle.includes('plus-4') ||
      lowerTitle.includes('+4') ||
      lowerTitle.includes('c16') ||
      lowerRel.includes('plus4') ||
      lowerRel.includes('c16')
    ) {
      targetEngine = 'plus4';
    } else if (
      lowerTitle.includes('c128') ||
      lowerRel.includes('c128') ||
      ext === 'd71'
    ) {
      targetEngine = 'c128';
    } else if (
      lowerTitle.includes('vic20') ||
      lowerTitle.includes('vic-20') ||
      lowerRel.includes('vic20')
    ) {
      targetEngine = 'vic20';
    } else if (
      ext === 'd64' ||
      ext === 'd81' ||
      ext === 't64' ||
      ext === 'tap' ||
      ext === 'crt' ||
      ext === 'g64' ||
      lowerTitle.includes('c64') ||
      lowerRel.includes('c64')
    ) {
      targetEngine = 'c64';
    } else if (ext === 'prg') {
      if (['c64', 'c128', 'plus4', 'vic20'].includes(this.currentEngine)) {
        targetEngine = this.currentEngine;
      } else {
        targetEngine = 'c64';
      }
    } else if (isCd32 || isAga) {
      targetEngine = 'puae';
    } else {
      targetEngine = 'vamiga';
    }

    // Determine the expected disk format extension for 1-click mounting
    let diskExt = ext;
    if (ext === 'zip' || ext === 'gz') {
      if (lowerRel.includes('[prg]')) diskExt = 'prg';
      else if (lowerRel.includes('[crt]')) diskExt = 'crt';
      else if (lowerRel.includes('[tap]')) diskExt = 'tap';
      else if (lowerRel.includes('[t64]')) diskExt = 't64';
      else if (lowerRel.includes('[d71]')) diskExt = 'd71';
      else if (lowerRel.includes('[d81]')) diskExt = 'd81';
      else if (lowerRel.includes('[g64]')) diskExt = 'g64';
      else if (lowerRel.includes('[d64]')) diskExt = 'd64';
      else if (lowerRel.includes('[adf]')) diskExt = 'adf';
      else if (isCd32) diskExt = 'iso';
      else if (targetEngine === 'c128' || targetEngine === 'c64') diskExt = 'd64';
      else if (targetEngine === 'plus4' || targetEngine === 'vic20') diskExt = 'prg';
      else if (targetEngine === 'vamiga' || targetEngine === 'puae') diskExt = 'adf';
      else diskExt = 'd64';
    }

    const cleanTitle = (title || 'disk').replace(/["'\\/:,]/g, '_').trim();
    let gameUrl = `/api/tosec/disk/${encodeURIComponent(cleanTitle)}.${diskExt}?file=${encodeURIComponent(relPath)}`;

    const isMultiDisk = /\((?:Disk|Disc|Side)\s*([0-9A-Za-z]+)\s*(?:of\s*(\d+))?\)/i.test(title || relPath);
    if (targetEngine === 'puae' && isBoot && isMultiDisk) {
      gameUrl = `/api/tosec/bundle/${encodeURIComponent(cleanTitle)}.zip?file=${encodeURIComponent(relPath)}&title=${encodeURIComponent(cleanTitle)}`;
      console.log(`[Commodore Guardian] Multi-disk detected for PUAE boot: bundling with M3U playlist -> ${gameUrl}`);
    }

    // Auto-switch engine or hardware model if disk requires a different Commodore core or model, or reinitialize when booting a new game
    const explicitCore = isCd32 ? 'cd32' : (targetEngine === 'puae' ? 'amiga' : targetEngine);
    const explicitModel = isCd32 ? 'CD32' : (targetEngine === 'puae' ? 'A1200' : null);
    const modelChanged = (targetEngine === 'puae' && this.currentModel !== explicitModel);

    const isSecondaryOrSwap = !isBoot || unit > 0;

    if (!isSecondaryOrSwap && (targetEngine !== this.currentEngine || modelChanged || (isBoot && targetEngine !== 'vamiga'))) {
      console.log(`[Commodore Guardian] Booting ${targetEngine.toUpperCase()} (core=${explicitCore}, model=${explicitModel}) for: ${title}`);
      this.currentRom = isCd32 ? 'puae_cd32' : (targetEngine === 'puae' ? 'puae_a1200' : targetEngine);
      const selectEl = document.getElementById('select_kickstart');
      if (selectEl) selectEl.value = this.currentRom;

      this.setupEmulatorIframe(targetEngine, gameUrl, title, explicitCore, explicitModel);

      // In vAmiga: automatically mount Disk 2 into DF1 for multi-disk games!
      if (targetEngine === 'vamiga' && isMultiDisk && isBoot) {
        fetch(`/api/tosec/multidisk?title=${encodeURIComponent(cleanTitle.replace(/\((?:Disk|Disc|Side)\s*[0-9A-Za-z]+\s*(?:of\s*\d+)?\)/i, '').trim())}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.disks && data.disks.length > 1) {
              const d2 = data.disks.find(d => d.diskNum === 2);
              if (d2) {
                setTimeout(() => {
                  this.loadDisk(1, d2.relPath, d2.name, false, 'vamiga');
                }, 1200);
              }
            }
          }).catch(() => {});
      }

      if (broadcast) {
        this.relay.sendDiskInsert(unit, relPath, title);
      }
      setTimeout(() => {
        this.ui.setDriveLED(unit, false);
        if (this.amigaStation) this.amigaStation.setDriveActive(false);
      }, 1200);
      this.spawnFloppyOnDesk(title, 1, 1, relPath);
      return;
    }

    // If already in a VICE 8-bit core or PUAE and inserting disk (isBoot is false or unit > 0):
    if (['c64', 'c128', 'plus4', 'vic20', 'puae'].includes(this.currentEngine)) {
      const nextCore = isCd32 ? 'cd32' : (this.currentEngine === 'puae' ? 'amiga' : this.currentEngine);
      const nextModel = isCd32 ? 'CD32' : (this.currentEngine === 'puae' ? 'A1200' : null);
      const diskMatch = (title || '').match(/\((?:Disk|Disc|Side)\s*([0-9A-Za-z]+)\s*(?:of\s*(\d+))?\)/i);
      const parsedDiskNum = diskMatch ? parseInt(diskMatch[1], 10) : (unit + 1);
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({
          cmd: 'load',
          core: nextCore,
          model: nextModel,
          gameUrl: gameUrl,
          file_name: title,
          drive: unit,
          diskNum: parsedDiskNum,
          boot: false,
          reset: false
        }, '*');
      }
      this.ui.showToast(`💾 <strong>Mounted into DF${unit}:</strong> ${title}`);
      if (broadcast) {
        this.relay.sendDiskInsert(unit, relPath, title);
      }
      setTimeout(() => {
        this.ui.setDriveLED(unit, false);
        if (this.amigaStation) this.amigaStation.setDriveActive(false);
      }, 1200);
      this.spawnFloppyOnDesk(title, 1, 1, relPath);
      return;
    }

    // Classic vAmiga OCS/ECS Floppy Streaming:
    try {
      const fetchUrl = `/api/tosec/get?file=${encodeURIComponent(relPath)}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const adfBytes = await res.arrayBuffer();
      const uint8 = new Uint8Array(adfBytes);

      // Post disk to vAmigaWeb iframe
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.postMessage({
          cmd: 'load',
          file_name: title + '.adf',
          file: uint8,
          drive: unit,
          boot: isBoot && unit === 0,
          reset: isBoot && unit === 0
        }, '*');

        // Same-origin direct call fallback
        try {
          const win = this.emuIframe.contentWindow;
          if (typeof win.wasm_loadfile === 'function') {
            win.wasm_loadfile(title + '.adf', uint8, unit);
          }
          if (isBoot && unit === 0) {
            setTimeout(() => {
              try {
                if (typeof win.wasm_reset === 'function') {
                  win.wasm_reset();
                } else if (win.Module && typeof win.Module._wasm_reset === 'function') {
                  win.Module._wasm_reset();
                }
                if (typeof win.is_running === 'function' && !win.is_running() && win.app && win.app.button_run_click) {
                  win.app.button_run_click();
                }
                if (typeof win.vAmiga_resume_audio === 'function') {
                  win.vAmiga_resume_audio();
                }
              } catch (e) {}
            }, 60);
          }
        } catch (e) {}
      }
      this.ui.showToast(`💾 <strong>Mounted into DF${unit}:</strong> ${title}`);

      if (broadcast) {
        this.relay.sendDiskInsert(unit, relPath, title);
      }

      setTimeout(() => {
        this.ui.setDriveLED(unit, false);
        if (this.amigaStation) this.amigaStation.setDriveActive(false);
      }, 1200);

      // Spawn or update 3D floppy disk on desk
      this.spawnFloppyOnDesk(title, 1, 1, relPath);
    } catch (err) {
      console.error('[Amiga XR] Failed to mount disk:', err);
      this.ui.setDriveLED(unit, false);
      if (this.amigaStation) this.amigaStation.setDriveActive(false);
    }
  }

  ejectDisk(unit, broadcast = true) {
    if (this.emuIframe && this.emuIframe.contentWindow) {
      this.emuIframe.contentWindow.postMessage({
        cmd: 'eject',
        drive: unit
      }, '*');

      try {
        const win = this.emuIframe.contentWindow;
        if (typeof win.wasm_eject_disk === 'function') {
          win.wasm_eject_disk('df' + unit);
        }
      } catch (e) {}
    }
    if (broadcast) {
      this.relay.sendDiskEject(unit);
    }
  }

  resetAmiga(broadcast = true) {
    this.resumeEmulatorAudio();
    console.log('[Amiga XR] Hard Reset (Ctrl+Amiga+Amiga) requested');
    if (this.ui) {
      this.ui.playSound('step');
    }
    if (this.emuIframe && this.emuIframe.contentWindow) {
      // 1. Post message cmd to iframe
      this.emuIframe.contentWindow.postMessage({ cmd: 'reset' }, '*');
      this.emuIframe.contentWindow.postMessage('reset()', '*');

      // 2. Direct invocation for both engines
      try {
        const win = this.emuIframe.contentWindow;
        if (win) {
          if (typeof win.wasm_reset === 'function') {
            win.wasm_reset();
          } else if (win.Module && typeof win.Module._wasm_reset === 'function') {
            win.Module._wasm_reset();
          }
          if (win.EJS_emulator && win.EJS_emulator.gameManager) {
            win.EJS_emulator.gameManager.restart();
          }
        }
      } catch (e) {
        // ignore cross-origin restrictions
      }
    }
    if (broadcast) {
      this.relay.sendReset();
    }
  }

  applyPoke(address, value) {
    console.log(`[Amiga XR] Applying Action Replay POKE: ${address} = ${value}`);
    if (this.emuIframe && this.emuIframe.contentWindow) {
      this.emuIframe.contentWindow.postMessage({
        cmd: 'poke',
        address: address,
        value: value
      }, '*');

      try {
        const win = this.emuIframe.contentWindow;
        let addr = address;
        let val = value;
        if (typeof addr === 'string') {
          addr = addr.startsWith('$') ? parseInt(addr.slice(1), 16) : parseInt(addr, addr.startsWith('0x') ? 16 : 10);
        }
        if (typeof val === 'string') {
          val = val.startsWith('$') ? parseInt(val.slice(1), 16) : parseInt(val, val.startsWith('0x') ? 16 : 10);
        }
        if (typeof win.wasm_poke === 'function') {
          win.wasm_poke(addr, val);
        } else if (win.Module && typeof win.Module._wasm_poke === 'function') {
          win.Module._wasm_poke(addr, val);
        }
      } catch (e) {}
    }
  }

  applyMultiPoke(pokes) {
    console.log(`[Amiga XR] Applying ${pokes.length} Action Replay POKEs`);
    if (this.emuIframe && this.emuIframe.contentWindow) {
      this.emuIframe.contentWindow.postMessage({
        cmd: 'poke_multi',
        pokes: pokes
      }, '*');

      try {
        const win = this.emuIframe.contentWindow;
        for (const p of pokes) {
          let addr = p.address;
          let val = p.value;
          if (typeof addr === 'string') {
            addr = addr.startsWith('$') ? parseInt(addr.slice(1), 16) : parseInt(addr, addr.startsWith('0x') ? 16 : 10);
          }
          if (typeof val === 'string') {
            val = val.startsWith('$') ? parseInt(val.slice(1), 16) : parseInt(val, val.startsWith('0x') ? 16 : 10);
          }
          if (typeof win.wasm_poke === 'function') {
            win.wasm_poke(addr, val);
          } else if (win.Module && typeof win.Module._wasm_poke === 'function') {
            win.Module._wasm_poke(addr, val);
          }
        }
      } catch (e) {}
    }
  }

  requestMouseLock() {
    this.resumeEmulatorAudio();
    if (this.emuIframe && this.emuIframe.contentWindow) {
      try {
        const win = this.emuIframe.contentWindow;
        win.postMessage({ cmd: 'request_pointer_lock' }, '*');
        const canvas = win.document ? (win.document.getElementById('canvas') || win.document.querySelector('#game canvas') || win.document.querySelector('canvas') || win.document.getElementById('game')) : null;
        if (canvas && typeof canvas.requestPointerLock === 'function') {
          canvas.requestPointerLock();
        } else if (typeof win.request_pointerlock === 'function') {
          win.request_pointerlock();
        }
      } catch (e) {
        console.warn('[Amiga XR] Pointer lock error:', e);
      }
    }
  }

  releaseMouseLock() {
    try {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
      if (this.emuIframe && this.emuIframe.contentWindow) {
        const win = this.emuIframe.contentWindow;
        if (win.document && win.document.exitPointerLock) {
          win.document.exitPointerLock();
        }
        win.postMessage({ cmd: 'exit_pointer_lock' }, '*');
      }
    } catch (e) {
      console.warn('[Amiga XR] Pointer unlock error:', e);
    }
    if (this.ui) {
      this.ui.setMouseLockState(false);
    }
  }

  changeEmulatorDisk(diskIndex) {
    if (this.emuIframe && this.emuIframe.contentWindow) {
      this.emuIframe.contentWindow.postMessage({
        cmd: 'change_disk',
        index: diskIndex
      }, '*');
    }
  }

  toggleZenMode(forceState) {
    this.zenMode = (forceState !== undefined) ? forceState : !this.zenMode;
    const appEl = document.getElementById('app');
    if (appEl) {
      if (this.zenMode) {
        appEl.classList.add('zen-mode');
        // True Fullscreen: full full screen removing browser tabs & taskbar
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.warn('[Amiga XR] Fullscreen request error:', err);
          });
        }
      } else {
        appEl.classList.remove('zen-mode');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch((err) => {
            console.warn('[Amiga XR] Exit fullscreen error:', err);
          });
        }
      }
    }
    if (this.ui) {
      this.ui.setZenMode(this.zenMode);
    }

    // Trigger canvas resize so emulator scales immediately
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (this.emuIframe && this.emuIframe.contentWindow) {
        this.emuIframe.contentWindow.dispatchEvent(new Event('resize'));
      }
    }, 100);
  }

  setupWebXRScene() {
    const xrContainer = document.createElement('div');
    xrContainer.id = 'webxr_canvas_container';
    document.body.appendChild(xrContainer);

    // Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
    camera.position.set(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    xrContainer.appendChild(renderer.domElement);

    // Global ambient and directional illumination (ensures scene is never black in AR/VR)
    const globalAmbient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(globalAmbient);
    const globalSun = new THREE.DirectionalLight(0xfff8ee, 1.4);
    globalSun.position.set(2.0, 4.0, 2.5);
    scene.add(globalSun);

    // Blank initial texture until emulator canvas is ready
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 640;
    fallbackCanvas.height = 512;
    const ctx = fallbackCanvas.getContext('2d');
    ctx.fillStyle = '#0055aa'; // Classic Amiga Workbench blue
    ctx.fillRect(0, 0, 640, 512);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('COMMODORE AMIGA XR', 140, 240);
    ctx.font = '22px monospace';
    ctx.fillText('Loading emulator core...', 180, 290);

    this.screenTexture = new THREE.CanvasTexture(fallbackCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    // Create 1084S CRT Shader Material
    this.screenMaterial = createAmigaCRTMaterial(this.screenTexture);

    // Build Amiga 500 Computer & 1084S Monitor Model
    this.amigaStation = createAmigaStation(this.screenMaterial);
    scene.add(this.amigaStation.group);

    // Build 1990s Retro Den Environment
    this.retroDen = createRetroDen();
    scene.add(this.retroDen);

    // WebXR Session Manager
    this.xrManager = new AmigaXRManager(renderer, scene, camera, this.amigaStation.group, this.retroDen);

    // WebXR Touch Plus Controllers (Joystick & Floppy Interaction)
    this.xrControllers = new AmigaXRControllers(
      renderer,
      scene,
      (diskData) => {
        // Disk inserted physically in VR!
        this.ui.playSound('insert');
        this.ui.playSound('step');
        if (diskData && diskData.relPath) {
          this.mountDisk(0, diskData.relPath, diskData.title, true);
        }
      },
      () => {
        // Eject clicked in VR!
        this.ui.playSound('eject');
        this.ejectDisk(0, true);
      },
      (joyState) => {
        // Forward joystick events to emulator iframe
        if (this.emuIframe && this.emuIframe.contentWindow) {
          this.emuIframe.contentWindow.postMessage({
            cmd: 'joystick',
            port: 2,
            ...joyState
          }, '*');
        }
      },
      (mouseEv) => {
        // Forward VR laser pointer mouse events to emulator iframe
        if (this.emuIframe && this.emuIframe.contentWindow) {
          this.emuIframe.contentWindow.postMessage({
            cmd: 'remote_mouse',
            ...mouseEv
          }, '*');
        }
      }
    );

    this.xrControllers.setInteractiveDisks(
      this.interactiveDisks,
      this.amigaStation.driveSlot,
      this.amigaStation.ejectBtn,
      this.amigaStation.screen
    );

    // Render loop (Targeting 90Hz / 120Hz on Quest 3 Snapdragon XR2 Gen 2)
    renderer.setAnimationLoop(() => {
      if (this.emuCanvas) {
        this.screenTexture.image = this.emuCanvas;
        this.screenTexture.needsUpdate = true;
      }

      this.xrControllers.update();
      renderer.render(scene, camera);
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  spawnFloppyOnDesk(title, diskNum = 1, totalDisks = 1, relPath = '') {
    const diskMesh = createAmigaFloppyDisk(title, diskNum, totalDisks);
    diskMesh.position.set(0.35, 0.72, -0.92);
    diskMesh.rotation.y = 0.2;
    diskMesh.userData = { title, diskNum, totalDisks, relPath };

    this.amigaStation.group.add(diskMesh);
    this.interactiveDisks.push(diskMesh);

    if (this.xrControllers) {
      this.xrControllers.setInteractiveDisks(
        this.interactiveDisks,
        this.amigaStation.driveSlot,
        this.amigaStation.ejectBtn
      );
    }
  }

  enterXR(mode = 'ar') {
    const xrContainer = document.getElementById('webxr_canvas_container');
    if (xrContainer) xrContainer.style.display = 'block';
    this.xrManager.startSession(mode);
  }
}

// Boot application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new AmigaXRApp();
  window.amigaApp = app;
  app.init();
});

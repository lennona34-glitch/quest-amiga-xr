/**
 * TOSEC Archive Browser & Station UI for Windows Chrome and Quest Browser
 */
export class TosecUI {
  constructor(options = {}) {
    this.container = options.container;
    this.onDiskSelect = options.onDiskSelect;
    this.onDiskEject = options.onDiskEject;
    this.onReset = options.onReset;
    this.onEnterXR = options.onEnterXR;
    this.onRomChange = options.onRomChange;
    this.onZenToggle = options.onZenToggle;
    this.onRequestMouseLock = options.onRequestMouseLock;
    this.onReleaseMouseLock = options.onReleaseMouseLock;
    this.onEngineToggle = options.onEngineToggle;
    this.onApplyPoke = options.onApplyPoke;
    this.onApplyMultiPoke = options.onApplyMultiPoke;
    this.onOpenSettings = options.onOpenSettings;

    this.mouseLocked = false;
    this.isZen = false;
    this.currentEngine = 'vamiga';
    this.activeCatalogFilter = 'all';
    this.activeCategoryFilter = 'games';
    this.instaLoad = true;
    this.gamepadConnected = false;
    this.activeGameTitle = '';
    this.cheatsModalOpen = false;
    this.activeCheatFilter = 'all';
    this.sceneModalOpen = false;
    this.displayModalOpen = false;
    this.netplayModalOpen = false;
    this.activeScenePortal = 'csdb';
    this.activeDemoPlatform = 'all';

    this.audioCtx = null;
    this.audioBuffers = {};
    this.initAudio();
    this.initGamepadDetection();
  }

  async initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const loadSound = async (name, url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const ctype = res.headers.get('content-type') || '';
          if (ctype.includes('text/html')) return;
          const arrayBuf = await res.arrayBuffer();
          this.audioBuffers[name] = await this.audioCtx.decodeAudioData(arrayBuf);
        } catch (e) {
          console.warn('[Amiga UI] Sound load warning for', name, e.message);
        }
      };
      await loadSound('step', '/sounds/step.mp3');
      await loadSound('insert', '/sounds/insert.mp3');
      await loadSound('eject', '/sounds/eject.mp3');
    } catch (e) {
      console.warn('[Amiga UI] Audio init warning:', e);
    }
  }

  playSound(name) {
    if (!this.audioCtx || !this.audioBuffers[name]) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.audioBuffers[name];
      src.connect(this.audioCtx.destination);
      src.start();
    } catch (e) {
      // ignore
    }
  }

  render(parentElement) {
    parentElement.innerHTML = `
      <div class="amiga-station-hud">
        <!-- Floating Zen Mode Control Pill (reveals on hover at bottom edge in Zen mode) -->
        <div class="zen-trigger-zone" id="zen_trigger_zone"></div>
        <div class="zen-floating-bar" id="zen_floating_bar">
          <span class="zen-brand">/// COMMODORE ZEN</span>
          <button class="zen-pill-btn zen-crt-btn" id="zen_btn_crt">📺 CRT: OFF</button>
          <button class="zen-pill-btn" id="zen_btn_display" title="Deep Graphics & Display Options (Shortcut: O)">⚙️ Display (O)</button>
          <button class="zen-pill-btn" id="zen_btn_scene" title="Community Scene Vault (Shortcut: V)">🏛️ Scene (V)</button>
          <button class="zen-pill-btn" id="zen_btn_cheats" title="Cheats & POKEs (Shortcut: C)">⚡ Cheats (C)</button>
          <button class="zen-pill-btn" id="zen_btn_random" title="Random Game (Shortcut: R)">🎲 Random (R)</button>
          <button class="zen-pill-btn" id="zen_btn_mouse" title="Capture / Release Mouse (Shortcut: M • Esc or Middle-Click to free)">🖱️ Mouse: OFF</button>
          <button class="zen-pill-btn" id="zen_btn_reset" title="Hardware Reset (Ctrl+Amiga)">⚡ Reset</button>
          <button class="zen-pill-btn" id="zen_btn_splash" title="Toggle Splash Mode">🛡️ Splash</button>
          <button class="zen-pill-btn zen-pill-exit" id="zen_btn_exit" title="Exit Zen Mode (Shortcut: Z or Esc)">✕ Exit Zen (Z)</button>
        </div>

        <!-- Top Retro Header Bar -->
        <header class="hud-header">
          <div class="header-left">
            <span class="amiga-rainbow-badge">///</span>
            <span class="hud-title">COMMODORE GUARDIAN</span>
            <div class="rom-picker">
              <label for="select_kickstart">⚡ Machine:</label>
              <select id="select_kickstart" class="hud-select" title="Switch Active Hardware Machine & Firmware">
                <optgroup label="Commodore Amiga (32-Bit Motorola 680x0)">
                  <option value="roms/kick13.rom" selected>Amiga 500 (Kickstart 1.3 • OCS)</option>
                  <option value="roms/kick204.rom">Amiga 500+ / 600 (Kickstart 2.04 • ECS)</option>
                  <option value="puae_a1200">🚀 Amiga 1200 (Kickstart 3.1 • AGA 68020) [PUAE]</option>
                  <option value="puae_cd32">💿 Amiga CD32 (Akiko • AGA Console) [PUAE]</option>
                  <option value="aros">Amiga AROS (Open Source ROM)</option>
                </optgroup>
                <optgroup label="Commodore 8-Bit Heritage">
                  <option value="c64">🎮 Commodore 64 (MOS 6510 • SID 6581 • VIC-II)</option>
                  <option value="plus4">🎨 Commodore Plus/4 (+4 TED 121-Color)</option>
                  <option value="vic20">🕹️ Commodore VIC-20 (MOS 6502 • VIC 6560)</option>
                </optgroup>
              </select>
            </div>
            <button id="engine_chip" class="engine-badge" title="Click to Cycle Emulation Core: vAmiga, C64, Plus/4, PUAE">⚡ vAmiga</button>
          </div>

          <div class="header-mid">
            <div class="hud-leds">
              <div class="led-item"><span class="led-dot led-pwr on" id="hud_led_pwr"></span> PWR</div>
              <div class="led-item"><span class="led-dot led-df0" id="hud_led_df0"></span> DF0: <span id="df0_track">00</span></div>
              <div class="led-item"><span class="led-dot led-df1" id="hud_led_df1"></span> DF1: <span id="df1_track">--</span></div>
              <div class="led-item peer-tag" id="hud_peers" style="cursor:pointer;" title="Click to view Copperline P2P Netplay Status & Room Link">🌐 Netplay: 1 Device</div>
            </div>
          </div>

          <div class="header-right">
            <button id="btn_crt_filter" class="hud-btn btn-crt" title="Toggle Authentic Commodore 1084S 'Easy CRT' Filter (Scanlines & Phosphors)"><span class="btn-icon">📺</span> <span class="btn-text">CRT: OFF</span></button>
            <button id="btn_display_options" class="hud-btn btn-display" title="Deep Graphics & Display Options: GPU Shader / Software, Overscan, Stencils, Palette, Run-Ahead (Keyboard Shortcut: O)"><span class="btn-icon">⚙️</span> <span class="btn-text">Display</span></button>
            <button id="btn_netplay" class="hud-btn btn-netplay" title="Copperline P2P Netplay: Multi-device 2-player real-time gaming (Shortcut: N)"><span class="btn-icon">🌐</span> <span class="btn-text">Netplay</span></button>
            <button id="btn_scene_vault" class="hud-btn btn-scene" title="Commodore Scene Vault: CSDb, Plus/4 World, Pouët & Demozoo (Keyboard Shortcut: V)"><span class="btn-icon">🏛️</span> <span class="btn-text">Scene</span></button>
            <button id="btn_cheats" class="hud-btn btn-cheats" title="Commodore Cheats & Action Replay POKEs (Keyboard Shortcut: C)"><span class="btn-icon">⚡</span> <span class="btn-text">Cheats</span></button>
            <button id="btn_splash_mode" class="hud-btn btn-splash" title="Toggle Boot Mode: Commodore Guardian Intro Splash vs Raw Factory Machine BIOS"><span class="btn-icon">🛡️</span> <span class="btn-text">Splash: GUARDIAN</span></button>
            <div id="hud_gamepad_chip" class="gamepad-chip" title="PC Wireless Joypad (Xbox, PlayStation, 8BitDo, Bluetooth)">🎮 Joypad</div>
            <button id="btn_mouse_toggle" class="hud-chip mouse-chip" title="Capture / Release Mouse (Shortcut: M • Esc or Middle-Click to release)">🖱️ Mouse: OFF</button>
            <button id="btn_zen_mode" class="hud-btn btn-zen" title="Toggle Fullscreen Zen Mode (Keyboard Shortcut: Z)"><span class="btn-icon">🧘</span> <span class="btn-text">Zen</span></button>
            <button id="btn_enter_ar" class="hud-btn btn-ar"><span class="btn-icon">🥽</span> <span class="btn-text">AR</span></button>
            <button id="btn_enter_vr" class="hud-btn btn-vr"><span class="btn-icon">🌌</span> <span class="btn-text">VR</span></button>
          </div>
        </header>

        <!-- Main Workspace -->
        <div class="hud-body">
          <!-- Left: Emulator View Container -->
          <div class="hud-emu-view">
            <div id="emulator_canvas_slot" class="canvas-wrapper">
              <!-- Emulator iframe will be embedded here -->
              <div id="mouse_lock_hint" class="mouse-lock-hint">
                <span>🖱️ Mouse: OFF</span> &bull; <span>Click <b>🖱️ Mouse</b> to Capture &bull; <kbd>Middle-Click</kbd> or <kbd>Esc</kbd> to free</span>
              </div>
            </div>
            
            <!-- Quick Drive Bar Under Display -->
            <div class="drive-bar">
              <div class="drive-slot" id="df0_slot">
                <span class="drive-label">DF0: [Internal]</span>
                <span class="drive-disk-name" id="df0_disk_name">Insert Disk...</span>
                <button class="mini-btn" id="btn_eject_df0">Eject</button>
              </div>
              <div class="drive-slot" id="df1_slot">
                <span class="drive-label">DF1: [External]</span>
                <span class="drive-disk-name" id="df1_disk_name">Empty</span>
                <button class="mini-btn" id="btn_eject_df1">Eject</button>
              </div>
              <button class="mini-btn warn-btn" id="btn_reset_amiga" title="Hardware Reset (Ctrl+Amiga+Amiga / Shortcut: Ctrl+Alt+Backspace)">⚡ Ctrl+Amiga+Amiga (Reset)</button>
            </div>
            <div id="core_compat_notice" class="compat-notice" style="display:none;"></div>
          </div>

          <!-- Right: TOSEC Streaming Catalog & Disk Library -->
          <aside class="hud-catalog">
            <div class="catalog-header">
              <div class="catalog-header-title">
                <h3>📦 Commodore TOSEC Streamer</h3>
                <span class="catalog-stats" id="catalog_stats">Scanning archive...</span>
              </div>
              <div class="catalog-header-actions">
                <button id="btn_random_game" class="random-btn" title="Pick a Random Game (Disk 1) - Keyboard Shortcut: R">🎲 Random</button>
                <button id="btn_tosec_rescan" class="mini-btn rescan-btn" title="Rescan for newly downloaded disks or ISOs">🔄</button>
              </div>
            </div>

            <div class="catalog-search">
              <input type="text" id="tosec_search_input" placeholder="Search 60,000+ Commodore titles (e.g. Turrican, Giana Sisters, Elite)..." autocomplete="off" />
              <button id="btn_search_clear">✕</button>
            </div>

            <div class="catalog-filters">
              <button class="filter-tab active" data-filter="all">All Systems</button>
              <button class="filter-tab" data-filter="amiga">Amiga</button>
              <button class="filter-tab" data-filter="aga">AGA</button>
              <button class="filter-tab" data-filter="cd32">CD32</button>
              <button class="filter-tab" data-filter="c64">C64</button>
              <button class="filter-tab" data-filter="plus4">Plus/4</button>
              <button class="filter-tab" data-filter="multidisk">Multi-Disk</button>
            </div>

            <div class="catalog-category-tabs">
              <button class="category-tab active" data-category="games">🎮 Games</button>
              <button class="category-tab" data-category="all">📁 All Folders</button>
              <button class="category-tab" data-category="applications">🛠️ Apps & Utils</button>
              <button class="category-tab" data-category="compilations">💾 Compilations</button>
              <button class="category-tab" data-category="demos">👾 Demos</button>
              <button class="category-tab" data-category="coverdiscs">💿 Coverdiscs</button>
            </div>

            <div class="catalog-results" id="catalog_results_list">
              <div class="loading-spinner">Loading TOSEC index...</div>
            </div>

            <div class="catalog-footer">
              <span class="hint-text">💡 1-Click Game Boot: Click any title to auto-mount into DF0: & capture mouse! Press 'R' for Random!</span>
            </div>
          </aside>
        </div>

        <!-- Cheats & Action Replay Modal Drawer -->
        <div class="cheats-modal-overlay" id="cheats_modal_overlay" style="display:none;">
          <div class="cheats-modal" id="cheats_modal">
            <div class="cheats-header">
              <div class="cheats-title-box">
                <span class="cheats-badge">ACTION REPLAY ///</span>
                <h3>⚡ Amiga Cheats & Memory POKEs</h3>
              </div>
              <button class="cheats-close-btn" id="btn_close_cheats" title="Close (Esc or C)">✕</button>
            </div>

            <div class="cheats-controls">
              <input type="text" id="cheats_search_input" placeholder="Search cheats for current or any Amiga game (e.g. Turrican, Postman Pat, Alien Breed)..." autocomplete="off" />
              <div class="cheats-filter-tabs">
                <button class="cheats-tab active" data-filter="all">All Cheats</button>
                <button class="cheats-tab" data-filter="pokes">⚡ Action Replay POKEs</button>
                <button class="cheats-tab" data-filter="codes">📜 Codes & Passwords</button>
                <button class="cheats-tab" data-filter="disks">💿 TOSEC Cheat Disks</button>
              </div>
            </div>

            <!-- Custom POKE Direct Memory Injector -->
            <div class="custom-poke-bar">
              <span class="poke-bar-title">💉 Live Memory POKE:</span>
              <input type="text" id="poke_custom_address" placeholder="Address (e.g. $00F83C)" class="poke-input" />
              <input type="text" id="poke_custom_value" placeholder="Value (e.g. $4A79)" class="poke-input" />
              <button id="btn_inject_custom_poke" class="poke-apply-btn">⚡ Inject POKE</button>
            </div>

            <div class="cheats-content-list" id="cheats_content_list">
              <div class="loading-spinner">Loading Cheats Database...</div>
            </div>

            <div class="cheats-footer">
              <span>💡 Action Replay POKEs inject directly into active Amiga memory without restarting! Press <kbd>C</kbd> or <kbd>Esc</kbd> to toggle.</span>
            </div>
          </div>
        </div>

        <!-- Commodore Scene Vault Modal Drawer (CSDb, Plus/4 World, Pouët & Demozoo) -->
        <div class="scene-modal-overlay" id="scene_modal_overlay" style="display:none;">
          <div class="scene-modal" id="scene_modal">
            <div class="scene-header">
              <div class="scene-title-box">
                <span class="scene-badge">COMMODORE SCENE VAULT ///</span>
                <h3>🌐 Community Scene Vault</h3>
              </div>
              <button class="scene-close-btn" id="btn_close_scene" title="Close (Esc or V)">✕</button>
            </div>

            <div class="scene-controls">
              <div class="scene-portal-tabs">
                <button class="scene-portal-tab active" data-portal="csdb">💾 CSDb (Commodore 64)</button>
                <button class="scene-portal-tab" data-portal="plus4world">🎨 Plus/4 World (C16 & +4)</button>
                <button class="scene-portal-tab" data-portal="demos">🏆 Pouët & Demozoo (Hall of Fame)</button>
              </div>

              <div class="scene-subcontrols">
                <input type="text" id="scene_search_input" placeholder="Search releases, groups, handles, or titles..." autocomplete="off" />
                <div class="scene-platform-pills" id="scene_platform_pills" style="display:none;">
                  <button class="scene-platform-pill active" data-platform="all">All Systems</button>
                  <button class="scene-platform-pill" data-platform="amiga">Amiga OCS</button>
                  <button class="scene-platform-pill" data-platform="aga">Amiga AGA</button>
                  <button class="scene-platform-pill" data-platform="c64">C64</button>
                  <button class="scene-platform-pill" data-platform="plus4">Plus/4</button>
                </div>
              </div>
            </div>

            <div class="scene-content-list" id="scene_content_list">
              <div class="loading-spinner">Connecting to Commodore Scene Vault...</div>
            </div>

            <div class="scene-footer">
              <span>💡 <strong>1-Click Scene Boot:</strong> Downloads, mounts to Drive 8 / DF0:, auto-switches hardware core & boots instantly! Press <kbd>V</kbd> or <kbd>Esc</kbd> to toggle.</span>
            </div>
          </div>
        </div>

        <!-- Copperline P2P Netplay Modal -->
        <div class="scene-modal-overlay" id="netplay_modal_overlay" style="display:none;">
          <div class="scene-modal netplay-modal-card" id="netplay_modal">
            <div class="scene-header">
              <div class="scene-title-box">
                <span class="scene-badge">COPPERLINE P2P NETPLAY ///</span>
                <h3>🌐 2-Player Synchronized Netplay</h3>
              </div>
              <button class="scene-close-btn" id="btn_close_netplay" title="Close (Esc)">✕</button>
            </div>

            <div class="netplay-body">
              <div class="netplay-hero">
                <div class="netplay-status-pill waiting" id="netplay_status_pill">
                  🟡 Waiting for Second Device (Quest 3 / PC)...
                </div>
                <p class="netplay-desc">
                  Inspired by <strong>Copperline Netplay</strong>, Commodore Guardian features peer-to-peer real-time state & input streaming between your PC and Meta Quest 3 without external servers.
                </p>
              </div>

              <div class="netplay-ports-grid">
                <div class="netplay-port-card host">
                  <div class="port-badge">PORT 1 (Host Station)</div>
                  <div class="port-title">🖥️ PC Desktop / Keyboard / Joypad</div>
                  <div class="port-desc">Controls Player 1 in all Amiga & Commodore games. Keyboard arrows + X/Z fire buttons, or physical Bluetooth joypad.</div>
                </div>
                <div class="netplay-port-card guest">
                  <div class="port-badge">PORT 2 (Guest / VR)</div>
                  <div class="port-title">🥽 Meta Quest 3 / Second PC</div>
                  <div class="port-desc">Controls Player 2 simultaneously in real time. Quest 3 Touch Thumbsticks & Trigger/Grip fire buttons or gamepad.</div>
                </div>
              </div>

              <div class="netplay-invite-box">
                <div class="invite-label">Direct Connect Link (Local Network / Wi-Fi):</div>
                <div class="invite-input-row">
                  <input type="text" readonly id="netplay_invite_url" class="invite-input" value="${window.location.origin}" />
                  <button id="btn_copy_netplay_link" class="btn-copy">📋 Copy Link</button>
                </div>
                <span class="invite-sub">Open this URL in the Meta Quest 3 Browser or another PC on your local network to connect instantly.</span>
              </div>
            </div>

            <div class="scene-footer">
              <span>💡 <strong>Copperline P2P Netplay:</strong> Disk swaps, Kickstart changes, and 2-player controller inputs sync seamlessly over WebSocket relay!</span>
            </div>
          </div>
        </div>

        <!-- Deep Graphics & Display Modal Drawer -->
        <div class="display-modal-overlay" id="display_modal_overlay" style="display:none;">
          <div class="display-modal" id="display_modal">
            <div class="display-header">
              <div class="display-title-box">
                <span class="display-badge">GRAPHICS ARCHITECT ///</span>
                <h3>⚙️ Deep Graphics & Display Settings</h3>
              </div>
              <button class="display-close-btn" id="btn_close_display" title="Close (Esc or O)">✕</button>
            </div>

            <div class="display-modal-body">
              <!-- Section 1: CRT & Phosphor Filter -->
              <div class="display-group">
                <div class="display-group-header">
                  <span class="group-icon">📺</span>
                  <h4>Authentic Commodore 1084S CRT & Scanlines</h4>
                </div>
                <div class="display-group-content">
                  <div class="display-row">
                    <span class="row-label">CRT Screen Filter:</span>
                    <div class="toggle-pill-group" id="grp_crt_toggle">
                      <button class="pill-opt" data-val="off" id="opt_crt_off">Clean Crisp Pixels (OFF)</button>
                      <button class="pill-opt" data-val="on" id="opt_crt_on">Authentic 1084S CRT (ON)</button>
                    </div>
                  </div>

                  <div class="display-row">
                    <span class="row-label">Scanline Intensity:</span>
                    <div class="toggle-pill-group" id="grp_scanline_preset">
                      <button class="pill-opt" data-val="subtle">Subtle (Modern 2px)</button>
                      <button class="pill-opt active" data-val="authentic">Authentic 1084S (3px)</button>
                      <button class="pill-opt" data-val="heavy">Heavy Arcade (4px)</button>
                    </div>
                  </div>

                  <div class="display-row">
                    <span class="row-label">Glass Curvature & Vignette:</span>
                    <div class="toggle-pill-group" id="grp_curvature">
                      <button class="pill-opt active" data-val="flat">Flat Screen</button>
                      <button class="pill-opt" data-val="curved">Curved 1084S Glass Tube</button>
                    </div>
                  </div>

                  <div class="display-row">
                    <span class="row-label">Phosphor Glow / Bloom:</span>
                    <div class="toggle-pill-group" id="grp_glow">
                      <button class="pill-opt active" data-val="true">Warm Tube Glow (ON)</button>
                      <button class="pill-opt" data-val="false">Sharp Contrast (OFF)</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 2: Color Palette & Phosphor Type -->
              <div class="display-group">
                <div class="display-group-header">
                  <span class="group-icon">🎨</span>
                  <h4>Color Palette & Phosphor Type</h4>
                </div>
                <div class="display-group-content">
                  <div class="palette-grid" id="grp_palette">
                    <button class="palette-card active" data-val="color">
                      <span class="palette-swatch swatch-color"></span>
                      <span class="palette-name">Full Color (RGB)</span>
                      <span class="palette-sub">Authentic 12/24-Bit full color</span>
                    </button>
                    <button class="palette-card" data-val="green">
                      <span class="palette-swatch swatch-green"></span>
                      <span class="palette-name">Moody 80-Col Green</span>
                      <span class="palette-sub">P31 high-persistence green</span>
                    </button>
                    <button class="palette-card" data-val="amber">
                      <span class="palette-swatch swatch-amber"></span>
                      <span class="palette-name">Vintage Amber</span>
                      <span class="palette-sub">Warm amber monochrome</span>
                    </button>
                    <button class="palette-card" data-val="paper">
                      <span class="palette-swatch swatch-paper"></span>
                      <span class="palette-name">Paper White B&W</span>
                      <span class="palette-sub">High-contrast monochrome</span>
                    </button>
                    <button class="palette-card" data-val="sepia">
                      <span class="palette-swatch swatch-sepia"></span>
                      <span class="palette-name">Warm Sepia</span>
                      <span class="palette-sub">Archival photograph tone</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Section 3: Aspect Ratio & Visible Screen Area -->
              <div class="display-group">
                <div class="display-group-header">
                  <span class="group-icon">📐</span>
                  <h4>Aspect Ratio & Visible Screen Area</h4>
                </div>
                <div class="display-group-content">
                  <div class="display-row">
                    <span class="row-label">Screen Aspect Ratio:</span>
                    <div class="toggle-pill-group" id="grp_aspect">
                      <button class="pill-opt active" data-val="4:3">Authentic 4:3 (PAL / NTSC Standard)</button>
                      <button class="pill-opt" data-val="1:1">Pixel-Perfect 1:1 (Square Pixels)</button>
                      <button class="pill-opt" data-val="16:9">16:9 Cinematic Widescreen Fill</button>
                    </div>
                  </div>
                  <div class="display-row">
                    <span class="row-label">Overscan Display:</span>
                    <div class="toggle-pill-group" id="grp_overscan">
                      <button class="pill-opt active" data-val="borderless">Auto-Crop Borders (Full Viewport)</button>
                      <button class="pill-opt" data-val="standard">Standard Monitor Border</button>
                      <button class="pill-opt" data-val="full">Full Overscan Area</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 4: Performance, Input Latency & Audio (PC Optimization) -->
              <div class="display-group">
                <div class="display-group-header">
                  <span class="group-icon">⚡</span>
                  <h4>PC Performance, Latency & Audio (Optimized)</h4>
                </div>
                <div class="display-group-content">
                  <div class="display-row">
                    <span class="row-label">Run-Ahead Input Latency:</span>
                    <div class="toggle-pill-group" id="grp_run_ahead">
                      <button class="pill-opt" data-val="0">0 Frames (Normal)</button>
                      <button class="pill-opt active" data-val="1">⚡ 1 Frame (-20ms Sub-Frame Instant - Recommended)</button>
                      <button class="pill-opt" data-val="2">2 Frames (-40ms)</button>
                    </div>
                  </div>
                  <div class="setting-desc">
                    💡 <strong>Run-Ahead</strong> pre-computes frames before video output, completely removing emulator latency for instantaneous joystick and keyboard response on PC.
                  </div>

                  <div class="display-row" style="margin-top: 10px;">
                    <span class="row-label">Warp Autostart:</span>
                    <div class="toggle-pill-group" id="grp_warp">
                      <button class="pill-opt active" data-val="true">⚡ Instant Warp Loading (Fast)</button>
                      <button class="pill-opt" data-val="false">🐢 Authentic 1x Real Drive Speed</button>
                    </div>
                  </div>

                  <div class="display-row" style="margin-top: 10px;">
                    <span class="row-label">Hardware Acceleration:</span>
                    <div class="toggle-pill-group">
                      <button class="pill-opt active" data-val="gpu">⚡ WebGL2 GPU Shader (Active)</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="display-footer">
              <button class="btn-secondary" id="btn_display_reset_defaults">↺ Reset PC Optimized Defaults</button>
              <button class="btn-primary" id="btn_display_apply_close">✓ Apply & Close (O)</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(parentElement);
    this.refreshCatalog('');
    this.fetchStats();
    this.initDisplaySettings();
  }

  bindEvents(el) {
    const searchInput = el.querySelector('#tosec_search_input');
    const clearBtn = el.querySelector('#btn_search_clear');
    const romSelect = el.querySelector('#select_kickstart');

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.refreshCatalog(e.target.value, this.activeCatalogFilter, this.activeCategoryFilter);
      }, 150);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.refreshCatalog('', this.activeCatalogFilter, this.activeCategoryFilter);
      searchInput.focus();
    });

    const compatNotice = el.querySelector('#core_compat_notice');
    const updateCompatNotice = (val) => {
      if (!compatNotice) return;
      if (val === 'c64') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info c64-notice';
        compatNotice.innerHTML = '🎮 <strong>Commodore 64 (VICE x64sc):</strong> MOS 6510/8500 CPU, SID 6581 audio synthesizer, and VIC-II graphics active! Direct 1541 D64/PRG booting enabled.';
      } else if (val === 'plus4') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info plus4-notice';
        compatNotice.innerHTML = '🎨 <strong>Commodore Plus/4 (VICE xplus4):</strong> MOS 7501 CPU & TED 7360 chipset with 121-color palette and built-in 3-Plus-1 suite active!';
      } else if (val === 'vic20') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info vic20-notice';
        compatNotice.innerHTML = '🕹️ <strong>Commodore VIC-20 (VICE xvic):</strong> MOS 6502 CPU and VIC 6560 graphics & sound chip active!';
      } else if (val === 'puae_a1200') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info';
        compatNotice.innerHTML = '🚀 <strong>PUAE High-Performance Core:</strong> Motorola 68020 32-bit CPU and AGA chipset (Lisa) enabled via Libretro PUAE WebAssembly. Ready for 5,700+ AGA games!';
      } else if (val === 'puae_cd32') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info';
        compatNotice.innerHTML = '💿 <strong>PUAE CD32 Console Core:</strong> Akiko CD-ROM controller and AGA Lisa enabled. Ready for CD32 ISOs, CUE/BIN, and CD32 TOSEC games!';
      } else if (val === 'aros') {
        compatNotice.style.display = 'block';
        compatNotice.className = 'compat-notice info';
        compatNotice.innerHTML = 'ℹ️ <strong>AROS Open Source:</strong> Boots open-source AROS system. Note: commercial 1980s/1990s Amiga games require <strong>Kickstart 1.3</strong>.';
      } else {
        compatNotice.style.display = 'none';
      }
    };

    const engineChip = el.querySelector('#engine_chip');
    if (engineChip) {
      engineChip.addEventListener('click', () => {
        if (this.onEngineToggle) {
          this.onEngineToggle();
        }
      });
    }

    if (romSelect) {
      ['mousedown', 'pointerdown', 'click', 'focus'].forEach(evtName => {
        romSelect.addEventListener(evtName, (e) => {
          e.stopPropagation();
        });
      });
      romSelect.addEventListener('change', (e) => {
        updateCompatNotice(e.target.value);
        if (this.onRomChange) {
          this.onRomChange(e.target.value);
        }
      });
    }

    // Filter tab buttons (All Systems, Amiga, AGA, CD32, C64, C128, Plus/4, Multi-Disk)
    el.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter || 'all';
        this.activeCatalogFilter = filter;
        const curQuery = searchInput ? searchInput.value : '';
        this.refreshCatalog(curQuery, filter, this.activeCategoryFilter);
      });
    });

    // Category tab buttons (Games, All Folders, Apps & Utils, Compilations, Demos, Coverdiscs)
    el.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.dataset.category || 'games';
        this.activeCategoryFilter = cat;
        const curQuery = searchInput ? searchInput.value : '';
        this.refreshCatalog(curQuery, this.activeCatalogFilter, cat);
      });
    });

    // Rescan button
    const rescanBtn = el.querySelector('#btn_tosec_rescan');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', async () => {
        rescanBtn.textContent = '⏳ Scanning...';
        rescanBtn.disabled = true;
        try {
          await fetch('/api/tosec/rescan');
          this.playSound('step');
          await this.fetchStats();
          this.refreshCatalog(searchInput.value);
        } catch (e) {
          console.warn('Rescan error:', e);
        } finally {
          rescanBtn.textContent = '🔄 Rescan';
          rescanBtn.disabled = false;
        }
      });
    }

    // Random Game and Insta-Load buttons
    const randomBtn = el.querySelector('#btn_random_game');
    const zenRandomBtn = el.querySelector('#zen_btn_random');
    const instaLoadChk = el.querySelector('#chk_insta_load');

    if (randomBtn) {
      randomBtn.addEventListener('click', () => this.triggerRandomGame());
    }
    if (zenRandomBtn) {
      zenRandomBtn.addEventListener('click', () => this.triggerRandomGame());
    }
    if (instaLoadChk) {
      instaLoadChk.addEventListener('change', (e) => {
        this.instaLoad = e.target.checked;
        if (this.instaLoad) {
          this.showToast('⚡ <strong>Insta-Load Enabled:</strong> Disks auto-boot & capture mouse immediately');
        }
      });
    }

    // Mouse Lock buttons: toggle capture On and Off explicitly
    const triggerMouseLock = () => {
      if (this.mouseLocked) {
        if (this.onReleaseMouseLock) this.onReleaseMouseLock();
        this.setMouseLockState(false);
      } else {
        if (this.onRequestMouseLock) this.onRequestMouseLock();
        this.setMouseLockState(true);
      }
    };
    el.querySelector('#btn_mouse_toggle').addEventListener('click', triggerMouseLock);
    el.querySelector('#zen_btn_mouse').addEventListener('click', triggerMouseLock);

    // Zen Mode buttons
    const triggerZen = (state) => {
      if (this.onZenToggle) this.onZenToggle(state);
    };
    el.querySelector('#btn_zen_mode').addEventListener('click', () => triggerZen());
    el.querySelector('#zen_btn_exit').addEventListener('click', () => triggerZen(false));

    // Reset buttons
    const triggerReset = () => {
      this.playSound('step');
      if (this.onReset) this.onReset();
    };
    el.querySelector('#btn_reset_amiga').addEventListener('click', triggerReset);
    el.querySelector('#zen_btn_reset').addEventListener('click', triggerReset);

    // XR Buttons
    el.querySelector('#btn_enter_ar').addEventListener('click', () => {
      if (this.onEnterXR) this.onEnterXR('ar');
    });

    el.querySelector('#btn_enter_vr').addEventListener('click', () => {
      if (this.onEnterXR) this.onEnterXR('room');
    });

    // Eject Buttons
    el.querySelector('#btn_eject_df0').addEventListener('click', () => {
      this.playSound('eject');
      el.querySelector('#df0_disk_name').textContent = 'Empty';
      if (this.onDiskEject) this.onDiskEject(0);
    });

    el.querySelector('#btn_eject_df1').addEventListener('click', () => {
      this.playSound('eject');
      el.querySelector('#df1_disk_name').textContent = 'Empty';
      if (this.onDiskEject) this.onDiskEject(1);
    });

    // Cheats UI Buttons & Modal Events
    const btnCheats = el.querySelector('#btn_cheats');
    const zenBtnCheats = el.querySelector('#zen_btn_cheats');
    const btnCloseCheats = el.querySelector('#btn_close_cheats');
    const cheatsOverlay = el.querySelector('#cheats_modal_overlay');
    const cheatsSearch = el.querySelector('#cheats_search_input');

    if (btnCheats) btnCheats.addEventListener('click', () => this.toggleCheatsModal());
    if (zenBtnCheats) zenBtnCheats.addEventListener('click', () => this.toggleCheatsModal());
    if (btnCloseCheats) btnCloseCheats.addEventListener('click', () => this.closeCheatsModal());

    const btnWarp = el.querySelector('#btn_warp_boot');
    if (btnWarp) {
      let currentWarp = localStorage.getItem('c64_warp_boot') !== 'false';
      const updateWarpUI = (val) => {
        btnWarp.textContent = val ? '⚡ Warp: ON' : '⏳ Load: Authentic';
        btnWarp.classList.toggle('authentic', !val);
        btnWarp.title = val 
          ? 'Fast Autostart Warp Enabled (Instant 1-Click Game Launch). Click for Authentic 1x Speed.' 
          : 'Authentic 1x Loading Speed Active (Nostalgic Tape/Disk Loading). Click for Instant Warp Boot.';
      };
      updateWarpUI(currentWarp);

      btnWarp.addEventListener('click', () => {
        currentWarp = !currentWarp;
        localStorage.setItem('c64_warp_boot', currentWarp ? 'true' : 'false');
        updateWarpUI(currentWarp);
        this.playSound('click');
        this.showNotification(currentWarp 
          ? '⚡ Instant Warp Boot Enabled! C64/8-bit games will autostart instantly.' 
          : '⏳ Authentic Loading Speed Active! Enjoy nostalgic 1x tape & drive loading.');
      });
    }

    // Splash Mode Toggle: Commodore Guardian Splash vs Raw Factory Machine BIOS
    const btnSplash = el.querySelector('#btn_splash_mode');
    const zenBtnSplash = el.querySelector('#zen_btn_splash');
    let currentSplash = localStorage.getItem('guardian_splash') || 'guardian';

    const updateSplashUI = (val) => {
      const isGuardian = (val !== 'bios');
      if (btnSplash) {
        btnSplash.innerHTML = `<span class="btn-icon">🛡️</span> <span class="btn-text">Splash: ${isGuardian ? 'GUARDIAN' : 'BIOS'}</span>`;
        btnSplash.classList.toggle('bios-mode', !isGuardian);
        btnSplash.title = isGuardian
          ? 'Commodore Guardian Hardware Splash Active! Click to switch to Raw Factory Machine BIOS.'
          : 'Raw Factory Machine BIOS Active (Kickstart hand & BASIC prompts). Click to switch to Guardian Splash.';
      }
      if (zenBtnSplash) {
        zenBtnSplash.textContent = `🛡️ Splash: ${isGuardian ? 'GUARDIAN' : 'BIOS'}`;
      }
    };
    updateSplashUI(currentSplash);

    const toggleSplashMode = () => {
      currentSplash = (currentSplash === 'bios') ? 'guardian' : 'bios';
      localStorage.setItem('guardian_splash', currentSplash);
      updateSplashUI(currentSplash);
      this.playSound('click');
      this.showNotification(currentSplash === 'guardian'
        ? '🛡️ Commodore Guardian Splash Online! Custom hardware intros enabled.'
        : '🖥️ Raw Factory Machine BIOS Active! Clean Kickstart and factory BASIC prompts.');
      if (typeof this.onSplashModeChange === 'function') {
        this.onSplashModeChange(currentSplash);
      }
    };

    if (btnSplash) btnSplash.addEventListener('click', toggleSplashMode);
    if (zenBtnSplash) zenBtnSplash.addEventListener('click', toggleSplashMode);

    if (cheatsOverlay) {
      cheatsOverlay.addEventListener('click', (e) => {
        if (e.target === cheatsOverlay) this.closeCheatsModal();
      });
    }

    let cheatsDebounce;
    if (cheatsSearch) {
      cheatsSearch.addEventListener('input', (e) => {
        clearTimeout(cheatsDebounce);
        cheatsDebounce = setTimeout(() => {
          this.refreshCheats(e.target.value, this.activeCheatFilter);
        }, 150);
      });
    }

    el.querySelectorAll('.cheats-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.cheats-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCheatFilter = tab.dataset.filter || 'all';
        const curQuery = cheatsSearch ? cheatsSearch.value : '';
        this.refreshCheats(curQuery, this.activeCheatFilter);
      });
    });

    const injectPokeBtn = el.querySelector('#btn_inject_custom_poke');
    const addrInput = el.querySelector('#poke_custom_address');
    const valInput = el.querySelector('#poke_custom_value');
    if (injectPokeBtn && addrInput && valInput) {
      injectPokeBtn.addEventListener('click', () => {
        const addr = addrInput.value.trim();
        const val = valInput.value.trim();
        if (!addr || !val) {
          this.showToast('⚠️ Please enter both Address and Value (e.g. $00F83C and $4A79)');
          return;
        }
        this.applyCheatPoke(addr, val, 'Custom Action Replay');
      });
    }

    // Scene Vault UI Buttons & Modal Events
    const btnScene = el.querySelector('#btn_scene_vault');
    const zenBtnScene = el.querySelector('#zen_btn_scene');
    const btnCloseScene = el.querySelector('#btn_close_scene');
    const sceneOverlay = el.querySelector('#scene_modal_overlay');
    const sceneSearch = el.querySelector('#scene_search_input');

    if (btnScene) btnScene.addEventListener('click', () => this.toggleSceneModal());
    if (zenBtnScene) zenBtnScene.addEventListener('click', () => this.toggleSceneModal());
    if (btnCloseScene) btnCloseScene.addEventListener('click', () => this.closeSceneModal());
    if (sceneOverlay) {
      sceneOverlay.addEventListener('click', (e) => {
        if (e.target === sceneOverlay) this.closeSceneModal();
      });
    }

    let sceneDebounce;
    if (sceneSearch) {
      sceneSearch.addEventListener('input', (e) => {
        clearTimeout(sceneDebounce);
        sceneDebounce = setTimeout(() => {
          this.refreshSceneVault(e.target.value);
        }, 150);
      });
    }

    el.querySelectorAll('.scene-portal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.querySelectorAll('.scene-portal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeScenePortal = tab.dataset.portal || 'csdb';
        const pills = el.querySelector('#scene_platform_pills');
        if (pills) {
          pills.style.display = this.activeScenePortal === 'demos' ? 'flex' : 'none';
        }
        const curQuery = sceneSearch ? sceneSearch.value : '';
        this.refreshSceneVault(curQuery);
      });
    });

    el.querySelectorAll('.scene-platform-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        el.querySelectorAll('.scene-platform-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeDemoPlatform = pill.dataset.platform || 'all';
        const curQuery = sceneSearch ? sceneSearch.value : '';
        this.refreshSceneVault(curQuery);
      });
    });

    // Easy CRT Screen Filter Toggle Button & Zen Pill
    // Default CRT filter to OFF (clean crisp pixels as preferred by user)
    if (localStorage.getItem('crt_filter_v2_initialized') !== 'true') {
      localStorage.setItem('crt_filter_enabled', 'false');
      localStorage.setItem('crt_filter_v2_initialized', 'true');
    }
    const btnCrt = el.querySelector('#btn_crt_filter');
    const zenBtnCrt = el.querySelector('#zen_btn_crt');
    const initialCrt = localStorage.getItem('crt_filter_enabled') === 'true';
    const syncCrtUI = (active) => {
      if (btnCrt) {
        btnCrt.classList.toggle('crt-active', active);
        btnCrt.innerHTML = `<span class="btn-icon">📺</span> <span class="btn-text">CRT: ${active ? 'ON' : 'OFF'}</span>`;
      }
      if (zenBtnCrt) {
        zenBtnCrt.classList.toggle('crt-active', active);
        zenBtnCrt.innerHTML = `<span class="btn-icon">📺</span> <span class="btn-text">CRT: ${active ? 'ON' : 'OFF'}</span>`;
      }
    };
    syncCrtUI(initialCrt);
    if (btnCrt) btnCrt.addEventListener('click', () => this.toggleCrtFilter());
    if (zenBtnCrt) zenBtnCrt.addEventListener('click', () => this.toggleCrtFilter());

    // Deep Graphics & Display Options Button & Zen Pill
    const btnDisplay = el.querySelector('#btn_display_options');
    const zenBtnDisplay = el.querySelector('#zen_btn_display');
    const btnCloseDisplay = el.querySelector('#btn_close_display');
    const displayOverlay = el.querySelector('#display_modal_overlay');
    const btnDisplayApplyClose = el.querySelector('#btn_display_apply_close');
    const btnDisplayReset = el.querySelector('#btn_display_reset_defaults');

    const triggerDisplayOptions = () => {
      this.playSound('step');
      this.toggleDisplayModal();
    };
    if (btnDisplay) btnDisplay.addEventListener('click', triggerDisplayOptions);
    if (zenBtnDisplay) zenBtnDisplay.addEventListener('click', triggerDisplayOptions);
    if (btnCloseDisplay) btnCloseDisplay.addEventListener('click', () => this.closeDisplayModal());
    if (btnDisplayApplyClose) btnDisplayApplyClose.addEventListener('click', () => this.closeDisplayModal());
    if (btnDisplayReset) btnDisplayReset.addEventListener('click', () => this.resetDisplayDefaults());
    if (displayOverlay) {
      displayOverlay.addEventListener('click', (e) => {
        if (e.target === displayOverlay) this.closeDisplayModal();
      });
    }

    // Modal Option Click Handlers
    const optCrtOff = el.querySelector('#opt_crt_off');
    const optCrtOn = el.querySelector('#opt_crt_on');
    if (optCrtOff) {
      optCrtOff.addEventListener('click', () => {
        localStorage.setItem('crt_filter_enabled', 'false');
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    }
    if (optCrtOn) {
      optCrtOn.addEventListener('click', () => {
        localStorage.setItem('crt_filter_enabled', 'true');
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    }

    el.querySelectorAll('#grp_scanline_preset .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('crt_scanline_preset', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_curvature .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('crt_curvature', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_glow .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('crt_glow', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_palette .palette-card').forEach(card => {
      card.addEventListener('click', () => {
        localStorage.setItem('display_palette', card.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_aspect .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('display_aspect', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_overscan .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('display_overscan', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_run_ahead .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('display_run_ahead', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    el.querySelectorAll('#grp_warp .pill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('c64_warp_boot', btn.dataset.val);
        this.applyDisplaySettings();
        this.syncDisplayModalUI();
      });
    });

    // Listen for forwarded hotkeys from emulator iframes
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data) return;
      if (data.msg === 'guardian_hotkey') {
        const k = (data.key || '').toLowerCase();
        if (k === 'r') {
          this.triggerRandomGame();
        } else if (k === 'o') {
          triggerDisplayOptions();
        } else if (k === 'v') {
          this.toggleSceneModal();
        } else if (k === 'c') {
          this.toggleCheatsModal();
        } else if (k === 'z') {
          triggerZen();
        } else if (k === 'n') {
          this.toggleNetplayModal();
        } else if (k === 'e' || k === 'f8') {
          this.toggleCrtFilter();
        } else if (k === 'm') {
          triggerMouseLock();
        } else if (k === 'escape') {
          if (this.displayModalOpen) this.closeDisplayModal();
          else if (this.sceneModalOpen) this.closeSceneModal();
          else if (this.cheatsModalOpen) this.closeCheatsModal();
          else if (this.netplayModalOpen) this.closeNetplayModal();
          else if (this.mouseLocked) {
            if (this.onReleaseMouseLock) this.onReleaseMouseLock();
            this.setMouseLockState(false);
          } else if (this.isZen) {
            triggerZen(false);
          }
        }
      }
    });

    // Copperline P2P Netplay UI Buttons & Modal Events
    const btnNetplay = el.querySelector('#btn_netplay');
    const hudPeers = el.querySelector('#hud_peers');
    const btnCloseNetplay = el.querySelector('#btn_close_netplay');
    const netplayOverlay = el.querySelector('#netplay_modal_overlay');
    const btnCopyNetplay = el.querySelector('#btn_copy_netplay_link');

    if (btnNetplay) btnNetplay.addEventListener('click', () => this.toggleNetplayModal());
    if (hudPeers) hudPeers.addEventListener('click', () => this.toggleNetplayModal());
    if (btnCloseNetplay) btnCloseNetplay.addEventListener('click', () => this.closeNetplayModal());
    if (netplayOverlay) {
      netplayOverlay.addEventListener('click', (e) => {
        if (e.target === netplayOverlay) this.closeNetplayModal();
      });
    }
    if (btnCopyNetplay) {
      btnCopyNetplay.addEventListener('click', async () => {
        const inviteInput = el.querySelector('#netplay_invite_url');
        const url = (inviteInput && inviteInput.value) ? inviteInput.value : window.location.origin;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else if (inviteInput) {
            inviteInput.select();
            document.execCommand('copy');
          }
          btnCopyNetplay.textContent = '✅ Copied!';
          this.showToast('📋 <strong>Netplay URL Copied to Clipboard!</strong><br/>Open on Meta Quest 3 Browser or 2nd PC to connect.');
          setTimeout(() => {
            btnCopyNetplay.textContent = '📋 Copy Link';
          }, 2000);
        } catch (err) {
          console.warn('Clipboard write failed:', err);
          if (inviteInput) {
            inviteInput.select();
            this.showToast('📋 Please press Ctrl+C to copy the Netplay URL.');
          }
        }
      });
    }

    // Global Hotkeys for Zen Mode, Random Game, Cheats, Scene Vault, Netplay, and Amiga Reset
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      // Only block plain-letter hotkeys when typing into an input field or textarea
      const isInputActive = activeTag === 'input' || activeTag === 'textarea';

      // 'N' key toggles Copperline Netplay (when not typing in search box)
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        this.toggleNetplayModal();
      }

      // 'V' key toggles Scene Vault (when not typing in search box)
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        this.toggleSceneModal();
      }

      // 'E' or 'F8' key toggles Easy CRT screen filter (when not typing in search box)
      if (((e.key === 'F8') || ((e.key === 'e' || e.key === 'E') && !isInputActive)) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        this.toggleCrtFilter();
      }

      // 'C' key toggles Cheats (when not typing in search box)
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        this.toggleCheatsModal();
      }

      // 'O' key toggles Deep Graphics & Display Options (when not typing in search box)
      if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        triggerDisplayOptions();
      }

      // 'M' key toggles Mouse Capture (when not typing in search box)
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        triggerMouseLock();
      }

      // Escape closes open modals, releases mouse lock, or exits Zen mode
      if (e.key === 'Escape') {
        if (this.displayModalOpen) {
          e.preventDefault();
          this.closeDisplayModal();
          return;
        }
        if (this.netplayModalOpen) {
          e.preventDefault();
          this.closeNetplayModal();
          return;
        }
        if (this.sceneModalOpen) {
          e.preventDefault();
          this.closeSceneModal();
          return;
        }
        if (this.cheatsModalOpen) {
          e.preventDefault();
          this.closeCheatsModal();
          return;
        }
        if (this.mouseLocked) {
          e.preventDefault();
          if (this.onReleaseMouseLock) this.onReleaseMouseLock();
          this.setMouseLockState(false);
          return;
        }
        if (this.isZen) {
          e.preventDefault();
          triggerZen(false);
          return;
        }
      }

      // 'R' key triggers Random Game (when not typing in search box)
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        this.triggerRandomGame();
      }

      // 'Z' key toggles Zen Mode (when not typing in search box)
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.altKey && !e.metaKey && !isInputActive) {
        e.preventDefault();
        triggerZen();
      }

      // Ctrl + Alt + Backspace or Ctrl + Alt + R resets the Amiga
      if (e.ctrlKey && e.altKey && (e.key === 'Backspace' || e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        triggerReset();
      }
    });
  }

  setMouseLockState(locked) {
    this.mouseLocked = locked;
    if (locked) {
      try {
        if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        const emuFrame = document.querySelector('#emulator_canvas_slot iframe');
        if (emuFrame) emuFrame.focus();
      } catch (e) {}
    }
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.classList.toggle('mouse-locked', locked);
    }
    const btn = document.getElementById('btn_mouse_toggle');
    const zenBtn = document.getElementById('zen_btn_mouse');
    const hint = document.getElementById('mouse_lock_hint');

    if (btn) {
      if (locked) {
        btn.classList.add('active');
        btn.textContent = '🖱️ Mouse: ON';
        btn.title = 'Mouse Captured into Emulator. Press Esc, Middle-Click, or click to release';
      } else {
        btn.classList.remove('active');
        btn.textContent = '🖱️ Mouse: OFF';
        btn.title = 'Mouse Free. Click or press M to capture into emulator';
      }
    }
    if (zenBtn) {
      if (locked) {
        zenBtn.classList.add('active');
        zenBtn.textContent = '🖱️ Mouse: ON';
        zenBtn.title = 'Mouse Captured. Click or press Esc to release';
      } else {
        zenBtn.classList.remove('active');
        zenBtn.textContent = '🖱️ Mouse: OFF';
        zenBtn.title = 'Mouse Free. Click or press M to capture into emulator';
      }
    }
    if (hint) {
      if (locked) {
        hint.classList.add('hidden');
      } else {
        hint.classList.remove('hidden');
      }
    }
  }

  initDisplaySettings() {
    if (localStorage.getItem('crt_filter_v3_initialized') !== 'true') {
      if (localStorage.getItem('crt_filter_enabled') === null) {
        localStorage.setItem('crt_filter_enabled', 'false');
      }
      if (localStorage.getItem('crt_scanline_preset') === null) {
        localStorage.setItem('crt_scanline_preset', 'authentic');
      }
      if (localStorage.getItem('crt_curvature') === null) {
        localStorage.setItem('crt_curvature', 'flat');
      }
      if (localStorage.getItem('crt_glow') === null) {
        localStorage.setItem('crt_glow', 'true');
      }
      if (localStorage.getItem('display_palette') === null) {
        localStorage.setItem('display_palette', 'color');
      }
      if (localStorage.getItem('display_aspect') === null) {
        localStorage.setItem('display_aspect', '4:3');
      }
      if (localStorage.getItem('display_overscan') === null) {
        localStorage.setItem('display_overscan', 'borderless');
      }
      if (localStorage.getItem('display_run_ahead') === null) {
        localStorage.setItem('display_run_ahead', '1');
      }
      if (localStorage.getItem('c64_warp_boot') === null) {
        localStorage.setItem('c64_warp_boot', 'true');
      }
      localStorage.setItem('crt_filter_v3_initialized', 'true');
    }
    this.applyDisplaySettings();
  }

  applyDisplaySettings() {
    const isCrt = localStorage.getItem('crt_filter_enabled') === 'true';
    const scanline = localStorage.getItem('crt_scanline_preset') || 'authentic';
    const curvature = localStorage.getItem('crt_curvature') || 'flat';
    const glow = localStorage.getItem('crt_glow') !== 'false';
    const palette = localStorage.getItem('display_palette') || 'color';
    const aspect = localStorage.getItem('display_aspect') || '4:3';
    const overscan = localStorage.getItem('display_overscan') || 'borderless';
    const runAhead = localStorage.getItem('display_run_ahead') || '1';
    const warpBoot = localStorage.getItem('c64_warp_boot') !== 'false';

    const slot = document.getElementById('emulator_canvas_slot');
    if (slot) {
      slot.classList.toggle('crt-active', isCrt);
      slot.classList.remove('crt-scanlines-subtle', 'crt-scanlines-authentic', 'crt-scanlines-heavy');
      slot.classList.add(`crt-scanlines-${scanline}`);
      slot.classList.toggle('crt-curved', curvature === 'curved');
      slot.classList.toggle('crt-glow', glow);

      slot.classList.remove('palette-color', 'palette-green', 'palette-amber', 'palette-paper', 'palette-sepia');
      slot.classList.add(`palette-${palette}`);

      slot.classList.remove('aspect-4-3', 'aspect-1-1', 'aspect-16-9');
      if (aspect === '16:9') slot.classList.add('aspect-16-9');
      else if (aspect === '1:1') slot.classList.add('aspect-1-1');
      else slot.classList.add('aspect-4-3');

      slot.classList.remove('overscan-borderless', 'overscan-standard', 'overscan-full');
      slot.classList.add(`overscan-${overscan}`);
    }

    const btnCrt = document.getElementById('btn_crt_filter');
    const zenBtnCrt = document.getElementById('zen_btn_crt');
    if (btnCrt) {
      btnCrt.classList.toggle('crt-active', isCrt);
      btnCrt.innerHTML = `<span class="btn-icon">📺</span> <span class="btn-text">CRT: ${isCrt ? 'ON' : 'OFF'}</span>`;
    }
    if (zenBtnCrt) {
      zenBtnCrt.classList.toggle('crt-active', isCrt);
      zenBtnCrt.innerHTML = `<span class="btn-icon">📺</span> <span class="btn-text">CRT: ${isCrt ? 'ON' : 'OFF'}</span>`;
    }

    const emuFrame = document.querySelector('#emulator_canvas_slot iframe');
    if (emuFrame && emuFrame.contentWindow) {
      emuFrame.contentWindow.postMessage({
        cmd: 'apply_display_settings',
        isCrt,
        scanline,
        curvature,
        glow,
        palette,
        aspect,
        overscan,
        runAhead,
        warpBoot
      }, '*');
    }
  }

  toggleDisplayModal(force) {
    if (force !== undefined) {
      this.displayModalOpen = !!force;
    } else {
      this.displayModalOpen = !this.displayModalOpen;
    }
    const overlay = document.getElementById('display_modal_overlay');
    if (overlay) {
      overlay.style.display = this.displayModalOpen ? 'flex' : 'none';
      if (this.displayModalOpen) {
        this.syncDisplayModalUI();
      }
    }
  }

  openDisplayModal() {
    this.toggleDisplayModal(true);
  }

  closeDisplayModal() {
    this.toggleDisplayModal(false);
  }

  syncDisplayModalUI() {
    const isCrt = localStorage.getItem('crt_filter_enabled') === 'true';
    const scanline = localStorage.getItem('crt_scanline_preset') || 'authentic';
    const curvature = localStorage.getItem('crt_curvature') || 'flat';
    const glow = localStorage.getItem('crt_glow') !== 'false';
    const palette = localStorage.getItem('display_palette') || 'color';
    const aspect = localStorage.getItem('display_aspect') || '4:3';
    const overscan = localStorage.getItem('display_overscan') || 'borderless';
    const runAhead = localStorage.getItem('display_run_ahead') || '1';
    const warpBoot = localStorage.getItem('c64_warp_boot') !== 'false';

    const optOff = document.getElementById('opt_crt_off');
    const optOn = document.getElementById('opt_crt_on');
    if (optOff) optOff.classList.toggle('active', !isCrt);
    if (optOn) optOn.classList.toggle('active', isCrt);

    document.querySelectorAll('#grp_scanline_preset .pill-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === scanline);
    });

    document.querySelectorAll('#grp_curvature .pill-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === curvature);
    });

    document.querySelectorAll('#grp_glow .pill-opt').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.val === 'true') === glow);
    });

    document.querySelectorAll('#grp_palette .palette-card').forEach(card => {
      card.classList.toggle('active', card.dataset.val === palette);
    });

    document.querySelectorAll('#grp_aspect .pill-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === aspect);
    });

    document.querySelectorAll('#grp_overscan .pill-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === overscan);
    });

    document.querySelectorAll('#grp_run_ahead .pill-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === runAhead);
    });

    document.querySelectorAll('#grp_warp .pill-opt').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.val === 'true') === warpBoot);
    });
  }

  resetDisplayDefaults() {
    localStorage.setItem('crt_filter_enabled', 'false');
    localStorage.setItem('crt_scanline_preset', 'authentic');
    localStorage.setItem('crt_curvature', 'flat');
    localStorage.setItem('crt_glow', 'true');
    localStorage.setItem('display_palette', 'color');
    localStorage.setItem('display_aspect', '4:3');
    localStorage.setItem('display_overscan', 'borderless');
    localStorage.setItem('display_run_ahead', '1');
    localStorage.setItem('c64_warp_boot', 'true');
    this.applyDisplaySettings();
    this.syncDisplayModalUI();
    this.showToast('↺ <strong>PC Optimized Display Settings Restored</strong>');
  }

  toggleCrtFilter() {
    let current = localStorage.getItem('crt_filter_enabled') === 'true';
    const isNowActive = !current;
    localStorage.setItem('crt_filter_enabled', isNowActive ? 'true' : 'false');
    this.applyDisplaySettings();
    this.syncDisplayModalUI();
    this.showToast(isNowActive 
      ? '📺 <strong>Authentic 1084S CRT: ENABLED</strong> (Scanlines & Phosphors active)' 
      : '📺 <strong>Authentic 1084S CRT: DISABLED</strong> (Clean Crisp Pixels)');
  }

  setZenMode(isZen) {
    this.isZen = isZen;
    const btn = document.getElementById('btn_zen_mode');
    if (btn) {
      btn.textContent = isZen ? '✕ Exit Zen' : '🧘 Zen Mode';
      btn.classList.toggle('active', isZen);
    }
    const floatingBar = document.getElementById('zen_floating_bar');
    if (floatingBar) {
      if (isZen) {
        floatingBar.classList.add('visible');
        clearTimeout(this._zenPillTimeout);
        this._zenPillTimeout = setTimeout(() => {
          floatingBar.classList.remove('visible');
        }, 2500);
      } else {
        floatingBar.classList.remove('visible');
      }
    }
  }

  async fetchStats() {
    try {
      const res = await fetch('/api/tosec/stats');
      const data = await res.json();
      const statsEl = document.getElementById('catalog_stats');
      if (statsEl) {
        if (data.total > 0) {
          statsEl.textContent = `${data.total.toLocaleString()} Disks Online`;
        } else {
          statsEl.textContent = 'Waiting for TOSEC download';
        }
      }
    } catch (e) {
      console.warn('Failed to fetch stats:', e);
    }
  }

  renderCatalogItemHtml(item) {
    let sys = item.system;
    const isCdFormat = item.file && (item.file.endsWith('.iso') || item.file.endsWith('.cue') || item.file.endsWith('.chd') || item.file.endsWith('.nrg') || (item.relPath && item.relPath.toLowerCase().includes('cd32')));
    const isAgaDisk = !isCdFormat && (
      sys === 'aga' ||
      (item.name && (item.name.toLowerCase().includes('(aga)') || item.name.toLowerCase().includes('[aga]') || /\baga\b/i.test(item.name))) ||
      (item.relPath && (item.relPath.toLowerCase().includes('(aga)') || item.relPath.toLowerCase().includes('[aga]') || /\baga\b/i.test(item.relPath))) ||
      (item.file && (item.file.toLowerCase().includes('(aga)') || item.file.toLowerCase().includes('[aga]') || /\baga\b/i.test(item.file)))
    );
    if (isCdFormat) sys = 'cd32';
    else if (isAgaDisk) sys = 'aga';
    else if (!sys) sys = 'amiga';

    const isC64 = sys === 'c64';
    const isPlus4 = sys === 'plus4';
    const isVIC20 = sys === 'vic20';
    const isCD32 = sys === 'cd32';
    const isAGA = sys === 'aga';
    const is8Bit = isC64 || isPlus4 || isVIC20;
    const dNum = item.diskNum || 1;
    const dTotal = item.diskTotal || 1;

    let icon = '💾';
    if (isC64) icon = '🎮';
    else if (isPlus4) icon = '🎨';
    else if (isVIC20) icon = '🕹️';
    else if (isCD32) icon = '💿';
    else if (isAGA) icon = '🚀';

    let sysBadge = '';
    if (isC64) sysBadge = '<span class="badge c64-badge">C64</span>';
    else if (isPlus4) sysBadge = '<span class="badge plus4-badge">PLUS/4</span>';
    else if (isVIC20) sysBadge = '<span class="badge vic20-badge">VIC-20</span>';
    else if (isCD32) sysBadge = '<span class="badge cd32-badge">CD32</span>';
    else if (isAGA) sysBadge = '<span class="badge aga-badge">AGA</span>';
    else sysBadge = '<span class="badge amiga-badge">AMIGA</span>';

    let bootBtnText = '⚡ Boot DF0';
    if (is8Bit) {
      bootBtnText = dNum === 1 ? '⚡ Boot D8' : 'Drive 8 ⏏';
    } else if (isCD32) {
      bootBtnText = '⚡ Play CD';
    }

    return `
      <div class="catalog-item ${sys}-item" 
           data-file="${encodeURIComponent(item.relPath)}" 
           data-title="${encodeURIComponent(item.name)}" 
           data-system="${sys}"
           data-disknum="${dNum}" 
           data-disktotal="${dTotal}" 
           title="${dNum === 1 ? `Click to Boot ${item.name}` : 'Click to Insert'}">
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-title">${item.name}</div>
          <div class="item-meta">
            ${sysBadge}
            ${dTotal > 1 ? `<span class="badge disk-badge">D${dNum}/${dTotal}</span>` : ''}
            <span class="file-size">${item.file.endsWith('.zip') ? 'ZIP' : (item.file.endsWith('.iso') ? 'ISO' : item.file.split('.').pop().toUpperCase())}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-load-df0" title="${dNum === 1 ? 'Boot Game' : 'Insert into Drive'}">${bootBtnText}</button>
          ${dTotal > 1 ? `<button class="btn-load-df1 mini-action-btn" title="Insert into secondary drive">${is8Bit ? 'D9' : 'DF1'}</button>` : ''}
        </div>
      </div>
    `;
  }

  bindCatalogItem(itemEl) {
    const file = decodeURIComponent(itemEl.dataset.file);
    const title = decodeURIComponent(itemEl.dataset.title);
    const sys = itemEl.dataset.system || 'amiga';
    const diskNum = parseInt(itemEl.dataset.disknum, 10) || 1;

    const mountToDrive = (drive, forceBoot = false) => {
      this.playSound('insert');
      this.playSound('step');
      const diskLabel = document.getElementById(`df${drive}_disk_name`);
      if (diskLabel) diskLabel.textContent = title;
      if (drive === 0) this.activeGameTitle = title;
      const isBoot = forceBoot || (drive === 0 && diskNum === 1);
      if (this.onDiskSelect) {
        this.onDiskSelect(drive, file, title, isBoot, sys);
      }
      if (isBoot) {
        const is8Bit = ['c64', 'c128', 'plus4', 'vic20'].includes(sys);
        const driveLabel = is8Bit ? 'Drive 8' : (sys === 'cd32' ? 'CD0:' : 'DF0:');
        this.showToast(`⚡ <strong>Booting ${sys.toUpperCase()}:</strong> ${title} in ${driveLabel}`);
      }
    };

    itemEl.addEventListener('click', (e) => {
      if (e.target.closest('.btn-load-df1')) {
        e.stopPropagation();
        mountToDrive(1, false);
        return;
      }
      mountToDrive(0, diskNum === 1);
    });

    const df0Btn = itemEl.querySelector('.btn-load-df0');
    if (df0Btn) {
      df0Btn.addEventListener('click', (e) => {
        e.stopPropagation();
        mountToDrive(0, diskNum === 1);
      });
    }
  }

  updateCatalogStats(loaded, total, query, filter, category) {
    const statsEl = document.getElementById('catalog_stats');
    if (!statsEl) return;
    const catLabel = (category && category !== 'games' && category !== 'all') ? ` • ${category.toUpperCase()}` : '';
    if (query || (filter && filter !== 'all')) {
      const tag = filter && filter !== 'all' ? ` ${filter.toUpperCase()}` : '';
      statsEl.textContent = `Found ${total.toLocaleString()}${tag}${catLabel} (Showing ${loaded.toLocaleString()})`;
    } else {
      statsEl.textContent = `${total.toLocaleString()} Disks Online${catLabel}`;
    }
  }

  async refreshCatalog(query = '', systemFilter = this.activeCatalogFilter || 'all', categoryFilter = this.activeCategoryFilter || 'games') {
    const listEl = document.getElementById('catalog_results_list');
    if (!listEl) return;

    this.currentQuery = query;
    this.currentFilter = systemFilter;
    this.currentCategory = categoryFilter;
    this.loadedCount = 0;
    this.totalMatches = 0;

    try {
      const res = await fetch(`/api/tosec/search?q=${encodeURIComponent(query)}&system=${encodeURIComponent(systemFilter)}&category=${encodeURIComponent(categoryFilter)}&limit=100&offset=0`);
      const data = await res.json();

      this.loadedCount = data.results.length;
      this.totalMatches = data.totalMatches || data.results.length;
      this.updateCatalogStats(this.loadedCount, this.totalMatches, query, systemFilter, categoryFilter);

      if (data.results.length === 0) {
        const sysLabel = systemFilter === 'all' ? 'Commodore' : systemFilter.toUpperCase();
        listEl.innerHTML = `
          <div class="empty-state">
            <p>No ${sysLabel} items found matching "${query}".</p>
            <p class="subtext">Archives in <code>Desktop\\Amiga Emulator</code> & <code>public\\disks</code></p>
          </div>
        `;
        return;
      }

      const itemsHtml = data.results.map(item => this.renderCatalogItemHtml(item)).join('');
      let moreHtml = '';
      if (this.totalMatches > this.loadedCount) {
        moreHtml = `
          <div class="catalog-load-more-container" id="catalog_load_more_wrap">
            <button class="btn-load-more" id="btn_catalog_load_more">
              📥 Load Next 100 Games (${this.loadedCount} of ${this.totalMatches.toLocaleString()})
            </button>
          </div>
        `;
      }

      listEl.innerHTML = itemsHtml + moreHtml;

      listEl.querySelectorAll('.catalog-item').forEach(itemEl => {
        this.bindCatalogItem(itemEl);
      });

      const moreBtn = document.getElementById('btn_catalog_load_more');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => this.loadMoreCatalog());
      }
    } catch (err) {
      listEl.innerHTML = `<div class="error-msg">Error loading catalog: ${err.message}</div>`;
    }
  }

  async loadMoreCatalog() {
    const listEl = document.getElementById('catalog_results_list');
    const moreBtn = document.getElementById('btn_catalog_load_more');
    const moreWrap = document.getElementById('catalog_load_more_wrap');
    if (!listEl || !moreBtn) return;

    moreBtn.disabled = true;
    moreBtn.textContent = '⏳ Loading next 100 games...';

    try {
      const cat = this.currentCategory || this.activeCategoryFilter || 'games';
      const res = await fetch(`/api/tosec/search?q=${encodeURIComponent(this.currentQuery || '')}&system=${encodeURIComponent(this.currentFilter || 'all')}&category=${encodeURIComponent(cat)}&limit=100&offset=${this.loadedCount}`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.results.map(item => this.renderCatalogItemHtml(item)).join('');
        const newEls = Array.from(tempDiv.children);

        newEls.forEach(el => {
          if (moreWrap) {
            listEl.insertBefore(el, moreWrap);
          } else {
            listEl.appendChild(el);
          }
          this.bindCatalogItem(el);
        });

        this.loadedCount += data.results.length;
        this.updateCatalogStats(this.loadedCount, this.totalMatches, this.currentQuery, this.currentFilter);

        if (this.loadedCount < this.totalMatches) {
          moreBtn.disabled = false;
          moreBtn.textContent = `📥 Load Next 100 Games (${this.loadedCount} of ${this.totalMatches.toLocaleString()})`;
        } else {
          if (moreWrap) moreWrap.remove();
        }
      } else {
        if (moreWrap) moreWrap.remove();
      }
    } catch (err) {
      console.warn('Failed to load more catalog entries:', err);
      moreBtn.disabled = false;
      moreBtn.textContent = '⚠️ Error loading more. Click to retry.';
    }
  }

  setEngine(engine) {
    this.currentEngine = engine;
    const chip = document.getElementById('engine_chip');
    const df0SlotLabel = document.querySelector('#df0_slot .drive-label');
    const df1SlotLabel = document.querySelector('#df1_slot .drive-label');
    const resetBtn = document.getElementById('btn_reset_amiga');

    const is8Bit = ['c64', 'c128', 'plus4', 'vic20'].includes(engine);

    if (df0SlotLabel) {
      df0SlotLabel.textContent = is8Bit ? 'Drive 8: [1541/1571]' : 'DF0: [Internal]';
    }
    if (df1SlotLabel) {
      df1SlotLabel.textContent = is8Bit ? 'Drive 9: [1541-II]' : 'DF1: [External]';
    }
    if (resetBtn) {
      resetBtn.textContent = is8Bit ? '⚡ Commodore Reset' : '⚡ Ctrl+Amiga+Amiga (Reset)';
    }

    if (chip) {
      chip.className = 'engine-badge';
      if (engine === 'c64') {
        chip.textContent = '🎮 Core: C64';
        chip.classList.add('c64-active');
        chip.title = 'Active Core: Commodore 64 (VICE x64sc SID 6581) - Click to Switch Engine';
      } else if (engine === 'plus4') {
        chip.textContent = '🎨 Core: Plus/4';
        chip.classList.add('plus4-active');
        chip.title = 'Active Core: Commodore Plus/4 (VICE xplus4 TED 121) - Click to Switch Engine';
      } else if (engine === 'vic20') {
        chip.textContent = '🕹️ Core: VIC-20';
        chip.classList.add('vic20-active');
        chip.title = 'Active Core: Commodore VIC-20 (VICE xvic) - Click to Switch Engine';
      } else if (engine === 'puae') {
        chip.textContent = '🚀 Core: PUAE';
        chip.classList.add('puae-active');
        chip.title = 'Active Core: PUAE (AGA Lisa & CD32 Akiko) - Click to Switch to vAmiga';
      } else {
        chip.textContent = '⚡ Core: vAmiga';
        chip.title = 'Active Core: vAmiga (OCS/ECS Cycle-Exact) - Click to Switch Engine';
      }
    }
  }

  setDriveLED(unit, active, track = 0) {
    const led = document.getElementById(`hud_led_df${unit}`);
    const trackEl = document.getElementById(`df${unit}_track`);
    if (led) {
      if (active) {
        led.classList.add('on');
        this.playSound('step');
      } else {
        led.classList.remove('on');
      }
    }
    if (trackEl && track !== undefined) {
      trackEl.textContent = track < 10 ? `0${track}` : `${track}`;
    }
  }

  setPeerCount(count) {
    const peerEl = document.getElementById('hud_peers');
    const netplayStatus = document.getElementById('netplay_status_pill');
    if (peerEl) {
      if (count > 0) {
        peerEl.textContent = `🌐 Netplay: ${count + 1} Connected (Sync Active)`;
        peerEl.style.color = '#4ade80';
        peerEl.style.borderColor = 'rgba(74, 222, 128, 0.4)';
      } else {
        peerEl.textContent = '🌐 Netplay: 1 Device (Waiting for Quest/PC...)';
        peerEl.style.color = '#94a3b8';
        peerEl.style.borderColor = 'rgba(148, 163, 184, 0.2)';
      }
    }
    if (netplayStatus) {
      if (count > 0) {
        netplayStatus.className = 'netplay-status-pill connected';
        netplayStatus.innerHTML = `🟢 2 Devices Connected (${count + 1} Peers) - Real-time Port 1/Port 2 Netplay Active`;
      } else {
        netplayStatus.className = 'netplay-status-pill waiting';
        netplayStatus.innerHTML = `🟡 Waiting for Second Device (Quest 3 / PC)...`;
      }
    }
  }

  showToast(html, duration = 3500) {
    let toast = document.getElementById('insta_toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'insta_toast';
      toast.className = 'insta-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = html;
    toast.style.display = 'flex';
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      if (toast) toast.style.display = 'none';
    }, duration);
  }

  async triggerRandomGame() {
    const randomBtn = document.getElementById('btn_random_game');
    const zenRandomBtn = document.getElementById('zen_btn_random');
    if (randomBtn) randomBtn.textContent = '🎲 Rolling...';
    if (zenRandomBtn) zenRandomBtn.textContent = '🎲 Rolling...';

    try {
      const activeTab = document.querySelector('.filter-tab.active');
      const filter = activeTab ? activeTab.dataset.filter : (this.activeCatalogFilter || 'all');
      const res = await fetch(`/api/tosec/random?filter=${encodeURIComponent(filter)}`);
      const data = await res.json();

      if (!data.success || !data.game) {
        this.showToast('⚠️ No random game available for selected system. Please rescan collection.');
        return;
      }

      const game = data.game;
      this.playSound('insert');
      this.playSound('step');

      const df0Label = document.getElementById('df0_disk_name');
      if (df0Label) df0Label.textContent = game.name;
      this.activeGameTitle = game.name;

      const sysName = (game.system || 'Commodore').toUpperCase();
      this.showToast(`🎲 <strong>Random [${sysName}]:</strong> ${game.name} <span class="badge disk-badge">Disk ${game.diskNum}/${game.diskTotal}</span> ⚡ Booting...`);

      if (this.onDiskSelect) {
        this.onDiskSelect(0, game.relPath, game.name, true);
      }
    } catch (err) {
      console.warn('[Commodore UI] Random game selection error:', err);
      this.showToast(`❌ Error selecting random game: ${err.message}`);
    } finally {
      if (randomBtn) randomBtn.textContent = '🎲 Random';
      if (zenRandomBtn) zenRandomBtn.textContent = '🎲 Random Game (R)';
    }
  }

  initGamepadDetection() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('[Amiga UI] Wireless gamepad connected:', e.gamepad);
      this.updateGamepadStatus(e.gamepad, true);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('[Amiga UI] Gamepad disconnected:', e.gamepad);
      this.updateGamepadStatus(e.gamepad, false);
    });

    // Periodic polling check (required for some Bluetooth controllers on Windows)
    setInterval(() => {
      if (!navigator.getGamepads) return;
      const gamepads = navigator.getGamepads();
      let activeGp = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          activeGp = gamepads[i];
          break;
        }
      }

      if (activeGp && !this.gamepadConnected) {
        this.updateGamepadStatus(activeGp, true);
      } else if (!activeGp && this.gamepadConnected) {
        this.updateGamepadStatus(null, false);
      }
    }, 1200);
  }

  updateGamepadStatus(gamepad, isConnected) {
    const chip = document.getElementById('hud_gamepad_chip');
    if (!chip) return;

    if (isConnected && gamepad) {
      const gid = gamepad.id || 'controller';
      if (this.gamepadConnected && this._lastGamepadId === gid) {
        return; // Already connected and active with this controller, avoid redundant toast and DOM updates
      }
      this.gamepadConnected = true;
      this._lastGamepadId = gid;
      let cleanName = gamepad.id || 'Wireless Controller';
      cleanName = cleanName.replace(/\(.*?\)/g, '').replace(/STANDARD GAMEPAD/i, '').replace(/Vendor:.*Product:.*/i, '').trim();
      if (!cleanName) cleanName = 'Wireless Controller';
      if (cleanName.length > 20) cleanName = cleanName.substring(0, 18) + '...';

      chip.classList.add('gamepad-active');
      chip.textContent = `🎮 Joypad: ${cleanName} (Active)`;
      chip.title = `${gamepad.id} (Wireless & Mapped to Amiga Port 2 Joystick)`;
      this.showToast(`🎮 <strong>Joypad Connected:</strong> ${cleanName} mapped to Port 2`);
    } else {
      if (!this.gamepadConnected) return; // Already disconnected
      this.gamepadConnected = false;
      this._lastGamepadId = null;
      chip.classList.remove('gamepad-active');
      chip.textContent = '🎮 Joypad: Wireless Ready';
      chip.title = 'PC Wireless Joypad (Xbox, PlayStation, 8BitDo, Bluetooth)';
    }
  }

  extractCleanGameName(raw) {
    if (!raw) return '';
    return raw
      .replace(/\.(zip|adf|dms|gz|iso|cue|bin)$/i, '')
      .replace(/\((?:Disk|Disc)\s*\d+\s*(?:of\s*\d+)?\)/gi, '')
      .replace(/\(19\d\d.*?\)/g, '')
      .replace(/\(20\d\d.*?\)/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[-_]/g, ' ')
      .trim();
  }

  toggleCheatsModal() {
    if (this.cheatsModalOpen) {
      this.closeCheatsModal();
    } else {
      this.openCheatsModal();
    }
  }

  openCheatsModal() {
    this.closeSceneModal();
    this.closeNetplayModal();
    this.cheatsModalOpen = true;
    const overlay = document.getElementById('cheats_modal_overlay');
    if (overlay) overlay.style.display = 'flex';
    this.playSound('step');

    const searchInput = document.getElementById('cheats_search_input');
    if (searchInput) {
      if (!searchInput.value.trim() && this.activeGameTitle) {
        const cleanName = this.extractCleanGameName(this.activeGameTitle);
        // Take primary first 1-2 words
        const firstWords = cleanName.split(/\s+/).slice(0, 2).join(' ');
        searchInput.value = firstWords;
      }
      this.refreshCheats(searchInput.value, this.activeCheatFilter);
      setTimeout(() => searchInput.focus(), 100);
    } else {
      this.refreshCheats('', this.activeCheatFilter);
    }
  }

  closeCheatsModal() {
    this.cheatsModalOpen = false;
    const overlay = document.getElementById('cheats_modal_overlay');
    if (overlay) overlay.style.display = 'none';
  }

  applyCheatPoke(address, value, cheatTitle = '') {
    this.playSound('step');
    if (this.onApplyPoke) {
      this.onApplyPoke(address, value);
    }
    this.showToast(`⚡ <strong>Action Replay POKE Applied:</strong> ${cheatTitle} <code>${address} &rarr; ${value}</code>`);
  }

  async refreshCheats(query = '', filter = 'all') {
    const listEl = document.getElementById('cheats_content_list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loading-spinner">Searching Cheats Database...</div>';

    try {
      const res = await fetch(`/api/tosec/cheats?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      let html = '';

      // Curated Cheats:
      let curated = data.curated || [];
      if (filter === 'pokes') {
        curated = curated.map(g => ({
          ...g,
          cheats: g.cheats.filter(c => c.type === 'Action Replay' || c.address)
        })).filter(g => g.cheats.length > 0);
      } else if (filter === 'codes') {
        curated = curated.map(g => ({
          ...g,
          cheats: g.cheats.filter(c => c.type === 'Code' || !c.address)
        })).filter(g => g.cheats.length > 0);
      } else if (filter === 'disks') {
        curated = [];
      }

      if (curated.length > 0) {
        html += curated.map(game => {
          return `
            <div class="cheat-game-card">
              <div class="cheat-game-card-header">
                <span class="cheat-game-title">🕹️ ${game.game}</span>
                <span class="cheat-count-badge">${game.cheats.length} Cheat${game.cheats.length > 1 ? 's' : ''}</span>
              </div>
              <div class="cheat-items-list">
                ${game.cheats.map(c => {
                  const isPoke = c.type === 'Action Replay' || !!c.address;
                  return `
                    <div class="cheat-row">
                      <div class="cheat-row-info">
                        <span class="cheat-type-tag ${isPoke ? 'cheat-tag-poke' : 'cheat-tag-code'}">${isPoke ? 'POKE' : 'CODE'}</span>
                        <strong class="cheat-item-title">${c.title}</strong>
                        ${c.description ? `<div class="cheat-item-desc">${c.description}</div>` : ''}
                        ${isPoke ? `<span class="cheat-poke-addr">ADDR: ${c.address} | VAL: ${c.value}</span>` : ''}
                      </div>
                      ${isPoke ? `
                        <button class="btn-apply-poke" data-addr="${c.address}" data-val="${c.value}" data-title="${encodeURIComponent(c.title)}">⚡ Apply POKE</button>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('');
      }

      // TOSEC Cheat Disks:
      const disks = data.disks || [];
      if (disks.length > 0 && (filter === 'all' || filter === 'disks')) {
        html += `
          <div class="cheat-game-card" style="border-color: #0077dd;">
            <div class="cheat-game-card-header">
              <span class="cheat-game-title">💿 TOSEC Cheat & Trainer Compilations (${disks.length} Disks)</span>
              <span class="cheat-count-badge" style="color: #38bdf8;">Bootable Disk</span>
            </div>
            <div class="cheat-items-list">
              ${disks.map(d => `
                <div class="cheat-disk-row">
                  <span class="cheat-disk-name">💾 ${d.name}</span>
                  <button class="btn-boot-cheat-disk" data-file="${encodeURIComponent(d.relPath)}" data-title="${encodeURIComponent(d.name)}">⚡ Boot in DF0:</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (!html) {
        listEl.innerHTML = `
          <div class="empty-state">
            <p>No cheats found matching "${query}".</p>
            <p class="subtext">Try searching "Turrican", "Alien Breed", "SWOS", "Postman", or type a custom POKE above.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = html;

      // Bind Apply POKE buttons
      listEl.querySelectorAll('.btn-apply-poke').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const addr = btn.dataset.addr;
          const val = btn.dataset.val;
          const title = decodeURIComponent(btn.dataset.title || '');
          this.applyCheatPoke(addr, val, title);
        });
      });

      // Bind Boot Cheat Disk buttons
      listEl.querySelectorAll('.btn-boot-cheat-disk').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const file = decodeURIComponent(btn.dataset.file);
          const title = decodeURIComponent(btn.dataset.title);
          this.playSound('insert');
          this.playSound('step');
          const diskLabel = document.getElementById('df0_disk_name');
          if (diskLabel) diskLabel.textContent = title;
          if (this.onDiskSelect) {
            this.onDiskSelect(0, file, title, true);
          }
          this.closeCheatsModal();
          this.showToast(`⚡ <strong>Booting Cheat Disk:</strong> ${title} into DF0:`);
        });
      });

    } catch(err) {
      listEl.innerHTML = `<div class="error-msg">Error loading cheats: ${err.message}</div>`;
    }
  }

  toggleSceneModal() {
    if (this.sceneModalOpen) {
      this.closeSceneModal();
    } else {
      this.openSceneModal();
    }
  }

  openSceneModal() {
    this.closeCheatsModal();
    this.closeNetplayModal();
    this.sceneModalOpen = true;
    const overlay = document.getElementById('scene_modal_overlay');
    if (overlay) overlay.style.display = 'flex';
    this.playSound('step');

    const searchInput = document.getElementById('scene_search_input');
    const curVal = searchInput ? searchInput.value.trim() : '';
    this.refreshSceneVault(curVal);
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  }

  closeSceneModal() {
    this.sceneModalOpen = false;
    const overlay = document.getElementById('scene_modal_overlay');
    if (overlay) overlay.style.display = 'none';
  }

  toggleNetplayModal() {
    if (this.netplayModalOpen) {
      this.closeNetplayModal();
    } else {
      this.openNetplayModal();
    }
  }

  openNetplayModal() {
    this.closeCheatsModal();
    this.closeSceneModal();
    this.netplayModalOpen = true;
    const overlay = document.getElementById('netplay_modal_overlay');
    if (overlay) overlay.style.display = 'flex';
    this.playSound('step');

    const inviteUrlInput = document.getElementById('netplay_invite_url');
    if (inviteUrlInput) {
      inviteUrlInput.value = window.location.origin;
    }
  }

  closeNetplayModal() {
    this.netplayModalOpen = false;
    const overlay = document.getElementById('netplay_modal_overlay');
    if (overlay) overlay.style.display = 'none';
  }

  async bootSceneItem(item, btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '⏳ Downloading & Mounting...';
      btnEl.classList.add('loading');
    }
    this.playSound('step');

    try {
      const bootSys = item.system || (item.platform === 'aga' ? 'aga' : item.platform) || 'c64';
      const bootFilename = item.filename || '';
      const params = new URLSearchParams({
        url: item.downloadUrl,
        title: item.title,
        system: bootSys,
        filename: bootFilename,
        localRel: item.localRel || ''
      });

      const res = await fetch(`/api/scene/boot?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      this.playSound('insert');
      this.playSound('step');

      const is8Bit = ['c64', 'c128', 'plus4', 'vic20'].includes(data.system);
      const driveLabel = is8Bit ? 'Drive 8' : 'DF0:';
      const diskLabel = document.getElementById('df0_disk_name');
      if (diskLabel) diskLabel.textContent = data.title;
      this.activeGameTitle = data.title;

      if (this.onDiskSelect) {
        this.onDiskSelect(0, data.relPath, data.title, true, data.system);
      }

      this.closeSceneModal();
      this.showToast(`🚀 <strong>Booting Scene Release:</strong> ${data.title} into active ${data.system.toUpperCase()} (${driveLabel})!`);
    } catch (err) {
      console.error('[Scene Vault Boot Error]:', err);
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = '❌ Download Failed - Retry';
        btnEl.classList.remove('loading');
      }
      this.showToast(`❌ <strong>Download Error:</strong> ${err.message}`);
    }
  }

  async refreshSceneVault(query = '') {
    const listEl = document.getElementById('scene_content_list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loading-spinner">Querying Commodore Scene Vault...</div>';

    let endpoint = '';
    if (this.activeScenePortal === 'csdb') {
      endpoint = `/api/scene/csdb?q=${encodeURIComponent(query)}`;
    } else if (this.activeScenePortal === 'plus4world') {
      endpoint = `/api/scene/plus4world?q=${encodeURIComponent(query)}`;
    } else if (this.activeScenePortal === 'demos') {
      endpoint = `/api/scene/demos?platform=${encodeURIComponent(this.activeDemoPlatform)}&q=${encodeURIComponent(query)}`;
    }

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const releases = data.releases || [];

      if (releases.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <p>No scene releases found matching "${query}".</p>
            <p class="subtext">Try searching by title, scener group (e.g. Booze Design, Spaceballs, Mad Scientists), or switch portal tabs above.</p>
          </div>
        `;
        return;
      }

      let html = '';
      if (this.activeScenePortal === 'csdb') {
        html = releases.map((rel, idx) => `
          <div class="scene-card c64-scene-card" data-idx="${idx}">
            <div class="scene-card-header">
              <div class="scene-card-title-group">
                <span class="scene-badge c64-badge">C64</span>
                <span class="scene-type-tag">${rel.type || 'C64 Release'}</span>
                <h4 class="scene-title">${rel.title}</h4>
              </div>
              <div class="scene-card-actions">
                ${rel.link ? `<a href="${rel.link}" target="_blank" rel="noopener" class="scene-web-link" title="View on CSDb.dk">🔗 CSDb</a>` : ''}
                <button class="btn-boot-scene btn-boot-c64" data-idx="${idx}" title="Download & Boot into Commodore 64 core">⚡ Boot Release</button>
              </div>
            </div>
            <div class="scene-card-meta">
              <span class="scene-author">👤 Released by: <strong>${rel.group || 'Independent'}</strong></span>
              ${rel.filename ? `<span class="scene-file">💾 ${rel.filename}</span>` : ''}
            </div>
          </div>
        `).join('');
      } else if (this.activeScenePortal === 'plus4world') {
        html = releases.map((rel, idx) => `
          <div class="scene-card plus4-scene-card" data-idx="${idx}">
            <div class="scene-card-header">
              <div class="scene-card-title-group">
                <span class="scene-badge plus4-badge">+4 TED</span>
                <span class="scene-type-tag">${rel.genre || 'Game'}</span>
                <h4 class="scene-title">${rel.title}</h4>
              </div>
              <div class="scene-card-actions">
                ${rel.infoUrl ? `<a href="${rel.infoUrl}" target="_blank" rel="noopener" class="scene-web-link" title="View on Plus/4 World">🔗 Plus/4 World</a>` : ''}
                <button class="btn-boot-scene btn-boot-plus4" data-idx="${idx}" title="Download & Boot into Commodore Plus/4 core">⚡ Boot (+4)</button>
              </div>
            </div>
            <div class="scene-card-meta">
              <span class="scene-author">👤 Author: <strong>${rel.author || 'Unknown'}</strong> (${rel.year || '198x'})</span>
              ${rel.filename ? `<span class="scene-file">💾 ${rel.filename}</span>` : ''}
            </div>
            ${rel.description ? `<p class="scene-desc">${rel.description}</p>` : ''}
          </div>
        `).join('');
      } else if (this.activeScenePortal === 'demos') {
        html = releases.map((rel, idx) => {
          const sys = rel.platform || 'amiga';
          let sysBadge = 'AMIGA OCS';
          let badgeClass = 'amiga-badge';
          let btnClass = 'btn-boot-amiga';
          if (sys === 'aga') {
            sysBadge = 'AMIGA AGA';
            badgeClass = 'aga-badge';
            btnClass = 'btn-boot-aga';
          } else if (sys === 'c64') {
            sysBadge = 'C64';
            badgeClass = 'c64-badge';
            btnClass = 'btn-boot-c64';
          } else if (sys === 'plus4') {
            sysBadge = 'PLUS/4';
            badgeClass = 'plus4-badge';
            btnClass = 'btn-boot-plus4';
          }

          return `
            <div class="scene-card demo-scene-card ${sys}-scene-card" data-idx="${idx}">
              <div class="scene-card-header">
                <div class="scene-card-title-group">
                  <span class="scene-badge ${badgeClass}">${sysBadge}</span>
                  <span class="scene-party-badge">🏆 ${rel.party || 'Demoscene Classic'}</span>
                  <h4 class="scene-title">${rel.title}</h4>
                </div>
                <div class="scene-card-actions">
                  ${rel.pouetUrl ? `<a href="${rel.pouetUrl}" target="_blank" rel="noopener" class="scene-web-link" title="View on Pouët.net">🔗 Pouët</a>` : ''}
                  ${rel.demozooUrl ? `<a href="${rel.demozooUrl}" target="_blank" rel="noopener" class="scene-web-link" title="View on Demozoo">🔗 Demozoo</a>` : ''}
                  <button class="btn-boot-scene ${btnClass}" data-idx="${idx}" title="Download & Boot into active core">⚡ Boot Demo</button>
                </div>
              </div>
              <div class="scene-card-meta">
                <span class="scene-author">👤 Group: <strong>${rel.author || 'Scene Group'}</strong> &bull; ${rel.year || ''}</span>
                ${rel.filename ? `<span class="scene-file">💾 ${rel.filename}</span>` : ''}
              </div>
              ${rel.notes ? `<p class="scene-desc">${rel.notes}</p>` : ''}
            </div>
          `;
        }).join('');
      }

      listEl.innerHTML = html;

      // Bind Boot Scene buttons
      listEl.querySelectorAll('.btn-boot-scene').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx, 10);
          const item = releases[idx];
          if (item) {
            this.bootSceneItem(item, btn);
          }
        });
      });

    } catch (err) {
      listEl.innerHTML = `<div class="error-msg">Error loading scene vault releases: ${err.message}</div>`;
    }
  }
}


/**
 * WebXR Manager for Amiga XR on Meta Quest 3
 * Manages Color Passthrough MR, 1990s Computer Den VR, and Snapdragon XR2 Gen 2 framerate tuning
 */
import * as THREE from 'three';

export class AmigaXRManager {
  constructor(renderer, scene, camera, screenRig, retroDen = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.screenRig = screenRig;
    this.retroDen = retroDen;

    this.currentMode = 'ar'; // Default to Mixed Reality Passthrough
    this.currentSession = null;
    this.initVoidEnvironment();
  }

  initVoidEnvironment() {
    this.voidGroup = new THREE.Group();
    this.voidGroup.name = 'AmigaVoid';

    const solidFloorGeo = new THREE.PlaneGeometry(30, 30);
    solidFloorGeo.rotateX(-Math.PI / 2);
    const solidFloorMat = new THREE.MeshStandardMaterial({
      color: 0x12141e,
      roughness: 0.6,
      metalness: 0.3
    });
    const solidFloor = new THREE.Mesh(solidFloorGeo, solidFloorMat);
    solidFloor.position.y = -0.01;
    this.voidGroup.add(solidFloor);

    // Vibrant Amiga-style violet & cyan cyber grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x00bbff, 0x7a2db8);
    gridHelper.position.y = 0.002;
    this.voidGroup.add(gridHelper);

    // Amiga Workbench Blue spotlight and overhead ambient illumination
    const spotLight = new THREE.SpotLight(0x0077ff, 6.0, 15, Math.PI / 3, 0.4, 1.0);
    spotLight.position.set(0, 4.0, 0);
    spotLight.target.position.set(0, 0.72, -1.0);
    this.voidGroup.add(spotLight);
    this.voidGroup.add(spotLight.target);

    const voidAmbient = new THREE.AmbientLight(0xffffff, 1.2);
    this.voidGroup.add(voidAmbient);

    const voidHemi = new THREE.HemisphereLight(0x5a2d82, 0x003366, 1.0);
    this.voidGroup.add(voidHemi);

    this.scene.add(this.voidGroup);
    this.voidGroup.visible = false;
  }

  setMode(mode) {
    this.currentMode = mode;

    if (mode === 'ar') {
      // Color Passthrough Mixed Reality
      this.renderer.setClearColor(0x000000, 0.0);
      this.scene.background = null;
      this.voidGroup.visible = false;
      if (this.retroDen) this.retroDen.visible = false;
      if (this.screenRig) this.screenRig.visible = true;
      console.log('[Amiga XR] Mixed Reality (Passthrough) active');
    } else if (mode === 'room') {
      // 1990s Retro Amiga Den
      this.renderer.setClearColor(0x181922, 1.0);
      this.scene.background = new THREE.Color(0x181922);
      this.voidGroup.visible = false;
      if (this.retroDen) this.retroDen.visible = true;
      if (this.screenRig) this.screenRig.visible = true;
      console.log('[Amiga XR] 1990s Retro Den active');
    } else if (mode === 'void') {
      // Minimalist Grid Void
      this.renderer.setClearColor(0x0f111a, 1.0);
      this.scene.background = new THREE.Color(0x0f111a);
      this.voidGroup.visible = true;
      if (this.retroDen) this.retroDen.visible = false;
      if (this.screenRig) this.screenRig.visible = true;
      console.log('[Amiga XR] Cyber Void active');
    }
  }

  toggleMode() {
    const modes = ['ar', 'room', 'void'];
    const idx = modes.indexOf(this.currentMode);
    const next = modes[(idx + 1) % modes.length];
    this.setMode(next);
    return next;
  }

  async startSession(mode = 'ar') {
    if (!navigator.xr) {
      alert('WebXR is not supported on this browser. Open this page in Meta Quest Browser on your Quest 3!');
      return;
    }

    const sessionType = (mode === 'ar') ? 'immersive-ar' : 'immersive-vr';

    try {
      const supported = await navigator.xr.isSessionSupported(sessionType);
      if (!supported) {
        console.warn(`${sessionType} not supported, falling back...`);
        return this.startSession(mode === 'ar' ? 'vr' : 'ar');
      }

      const sessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      };

      const session = await navigator.xr.requestSession(sessionType, sessionInit);
      this.currentSession = session;

      // Request 90Hz or 120Hz display refresh on Quest 3 Snapdragon XR2 Gen 2
      if (session.supportedFrameRates) {
        try {
          const rates = session.supportedFrameRates;
          console.log('[Amiga XR] Supported Quest 3 refresh rates:', Array.from(rates));
          if (rates.includes(90)) {
            await session.updateTargetFrameRate(90);
            console.log('[Amiga XR] Target frame rate set to 90Hz');
          } else if (rates.includes(72)) {
            await session.updateTargetFrameRate(72);
          }
        } catch (e) {
          console.warn('[Amiga XR] Could not update target frame rate:', e);
        }
      }

      // CRITICAL: Set WebXR Reference Space to 'local-floor' so physical floor is y=0
      // Without this, Three.js defaults to 'local' (y=0 at eye level), placing user under desk in the dark!
      try {
        await this.renderer.xr.setReferenceSpaceType('local-floor');
        console.log('[Amiga XR] Configured WebXR reference space: local-floor');
      } catch (refErr) {
        console.warn('[Amiga XR] local-floor reference space request error, falling back:', refErr);
      }

      this.setMode(mode);
      await this.renderer.xr.setSession(session);

      session.addEventListener('end', () => {
        this.currentSession = null;
        console.log('[Amiga XR] WebXR session ended');
      });

      console.log(`[Amiga XR] Started ${sessionType} session on Meta Quest 3`);
    } catch (err) {
      console.error('[Amiga XR] Error starting WebXR session:', err);
      if (mode === 'ar') {
        this.startSession('vr');
      }
    }
  }

  endSession() {
    if (this.currentSession) {
      this.currentSession.end();
    }
  }
}

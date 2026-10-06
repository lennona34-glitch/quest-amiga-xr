/**
 * Meta Quest 3 Touch Plus Controller Manager for Amiga XR
 * Maps controllers to Amiga Competition Pro Joystick (Port 2) & Amiga Tank Mouse (Port 1),
 * plus 6DoF physical floppy disk pickup and drive insertion.
 */
import * as THREE from 'three';

export class AmigaXRControllers {
  constructor(renderer, scene, onFloppyInsert = null, onFloppyEject = null, onJoystickEvent = null, onMouseEvent = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.onFloppyInsert = onFloppyInsert;
    this.onFloppyEject = onFloppyEject;
    this.onJoystickEvent = onJoystickEvent;
    this.onMouseEvent = onMouseEvent;

    this.controllers = [];
    this.controllerGrips = [];
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    // Floppy disk grab state
    this.heldDisk = null;
    this.interactiveDisks = [];
    this.driveSlotObject = null;
    this.ejectButtonObject = null;
    this.screenMesh = null;
    this.screenLaserDown = false;
    this.lastLaserX = undefined;
    this.lastLaserY = undefined;

    // Joystick state cache
    this.lastJoyState = { up: false, down: false, left: false, right: false, fire: false, fire2: false, play: false };
    this.lastTransmit = 0;

    this.initControllers();
  }

  setInteractiveDisks(disks, driveSlot, ejectButton, screenMesh = null) {
    this.interactiveDisks = disks;
    this.driveSlotObject = driveSlot;
    this.ejectButtonObject = ejectButton;
    this.screenMesh = screenMesh;
  }

  initControllers() {
    for (let i = 0; i < 2; i++) {
      // Controller Ray
      const controller = this.renderer.xr.getController(i);
      controller.userData.index = i;
      this.scene.add(controller);
      this.controllers.push(controller);

      // Visible Pointer Laser Ray
      const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1.5)
      ]);
      const laserMat = new THREE.LineBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.6
      });
      const laser = new THREE.Line(laserGeo, laserMat);
      laser.name = 'LaserRay';
      controller.add(laser);

      // Controller Grip (hand position)
      const controllerGrip = this.renderer.xr.getControllerGrip(i);
      this.scene.add(controllerGrip);
      this.controllerGrips.push(controllerGrip);

      // Event Listeners for Select / Squeeze
      controller.addEventListener('selectstart', (e) => this.onSelectStart(e));
      controller.addEventListener('selectend', (e) => this.onSelectEnd(e));
      controller.addEventListener('squeezestart', (e) => this.onSqueezeStart(e));
      controller.addEventListener('squeezeend', (e) => this.onSqueezeEnd(e));
    }
  }

  onSelectStart(event) {
    const controller = event.target;
    // 1. Check for Eject Button click
    if (this.ejectButtonObject) {
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

      const hits = this.raycaster.intersectObject(this.ejectButtonObject, true);
      if (hits.length > 0) {
        if (this.onFloppyEject) {
          this.onFloppyEject();
        }
        return;
      }
    }

    // 2. Check for Virtual Amiga Screen laser click (Tank Mouse Click in VR)
    if (this.screenMesh && this.onMouseEvent) {
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

      const hits = this.raycaster.intersectObject(this.screenMesh, true);
      if (hits.length > 0 && hits[0].uv) {
        const uv = hits[0].uv;
        const cx = Math.round(uv.x * 640);
        const cy = Math.round((1 - uv.y) * 480);
        this.screenLaserDown = true;
        this.onMouseEvent({
          subType: 'mousedown',
          button: 0,
          buttons: 1,
          clientX: cx,
          clientY: cy
        });
      }
    }
  }

  onSelectEnd(event) {
    if (this.screenLaserDown && this.onMouseEvent) {
      this.screenLaserDown = false;
      this.onMouseEvent({
        subType: 'mouseup',
        button: 0,
        buttons: 0
      });
    }
  }

  onSqueezeStart(event) {
    const controller = event.target;
    const gripPos = new THREE.Vector3();
    controller.getWorldPosition(gripPos);

    // Check distance to interactive floppy disks (grab within 0.18m)
    for (const disk of this.interactiveDisks) {
      const diskPos = new THREE.Vector3();
      disk.getWorldPosition(diskPos);
      if (gripPos.distanceTo(diskPos) < 0.18) {
        this.heldDisk = {
          mesh: disk,
          controller: controller,
          originalParent: disk.parent
        };
        controller.attach(disk);
        console.log(`[Amiga XR] Grabbed floppy disk: ${disk.name}`);
        break;
      }
    }
  }

  onSqueezeEnd(event) {
    const controller = event.target;
    if (this.heldDisk && this.heldDisk.controller === controller) {
      const disk = this.heldDisk.mesh;

      // Check if dropped near the Amiga A500 DF0: drive slot!
      if (this.driveSlotObject) {
        const slotPos = new THREE.Vector3();
        this.driveSlotObject.getWorldPosition(slotPos);
        const diskPos = new THREE.Vector3();
        disk.getWorldPosition(diskPos);

        if (slotPos.distanceTo(diskPos) < 0.15) {
          // INSERT FLOPPY DISK!
          console.log(`[Amiga XR] Disk ${disk.name} inserted into DF0:`);
          if (this.onFloppyInsert) {
            this.onFloppyInsert(disk.userData);
          }
          // Snap disk smoothly into drive slot
          this.heldDisk.originalParent.attach(disk);
          disk.position.copy(slotPos);
          disk.position.x -= 0.04; // Slipped inside slot
          this.heldDisk = null;
          return;
        }
      }

      // Dropped onto desk/space
      this.heldDisk.originalParent.attach(disk);
      this.heldDisk = null;
    }
  }

  update() {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    // 1. Screen Laser Pointer mouse movement on virtual Amiga screen
    if (this.screenMesh && this.onMouseEvent && this.controllers.length > 0) {
      for (const controller of this.controllers) {
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const hits = this.raycaster.intersectObject(this.screenMesh, true);
        if (hits.length > 0 && hits[0].uv) {
          const uv = hits[0].uv;
          const cx = Math.round(uv.x * 640);
          const cy = Math.round((1 - uv.y) * 480);
          if (this.lastLaserX === undefined || Math.abs(cx - this.lastLaserX) > 1 || Math.abs(cy - this.lastLaserY) > 1) {
            const dx = (this.lastLaserX !== undefined) ? (cx - this.lastLaserX) : 0;
            const dy = (this.lastLaserY !== undefined) ? (cy - this.lastLaserY) : 0;
            this.lastLaserX = cx;
            this.lastLaserY = cy;
            this.onMouseEvent({
              subType: 'mousemove',
              movementX: dx,
              movementY: dy,
              clientX: cx,
              clientY: cy,
              buttons: this.screenLaserDown ? 1 : 0
            });
          }
          break;
        }
      }
    }

    // 2. Polling Meta Quest Touch Plus / Pro Thumbstick & Action Buttons (Port 2 Joystick)
    for (const source of session.inputSources) {
      if (!source.gamepad) continue;

      const gp = source.gamepad;
      const axes = gp.axes;
      const buttons = gp.buttons;

      if (axes.length >= 2) {
        // Read thumbstick from axes 2/3 (standard on some VR runtimes) or axes 0/1 (standard WebXR gamepad)
        const joyX = (axes.length >= 4 && (Math.abs(axes[2]) > 0.05 || Math.abs(axes[3]) > 0.05)) ? axes[2] : (axes[0] || 0);
        const joyY = (axes.length >= 4 && (Math.abs(axes[2]) > 0.05 || Math.abs(axes[3]) > 0.05)) ? axes[3] : (axes[1] || 0);

        let up = false;
        let down = false;
        let left = false;
        let right = false;
        const mag = Math.hypot(joyX, joyY);
        if (mag >= 0.20) {
          // 8-directional angular sector resolution (45° cone per direction, crisp diagonals)
          const deg = Math.atan2(joyY, joyX) * (180 / Math.PI);
          if (deg >= -22.5 && deg < 22.5) {
            right = true;
          } else if (deg >= 22.5 && deg < 67.5) {
            down = true;
            right = true;
          } else if (deg >= 67.5 && deg < 112.5) {
            down = true;
          } else if (deg >= 112.5 && deg < 157.5) {
            down = true;
            left = true;
          } else if (deg >= 157.5 || deg < -157.5) {
            left = true;
          } else if (deg >= -157.5 && deg < -112.5) {
            up = true;
            left = true;
          } else if (deg >= -112.5 && deg < -67.5) {
            up = true;
          } else if (deg >= -67.5 && deg < -22.5) {
            up = true;
            right = true;
          }
        }

        const fire = !!((buttons[0] && buttons[0].pressed) || (buttons[4] && buttons[4].pressed)); // Trigger or Button A/X
        const fire2 = !!((buttons[1] && buttons[1].pressed) || (buttons[5] && buttons[5].pressed)); // Grip or Button B/Y
        const play = !!((buttons[3] && buttons[3].pressed) || (buttons[2] && buttons[2].pressed)); // Thumbstick click / Menu

        const isNonNeutral = up || down || left || right || fire || fire2 || play;
        const stateChanged = (
          left !== this.lastJoyState.left ||
          right !== this.lastJoyState.right ||
          up !== this.lastJoyState.up ||
          down !== this.lastJoyState.down ||
          fire !== this.lastJoyState.fire ||
          fire2 !== this.lastJoyState.fire2 ||
          play !== this.lastJoyState.play
        );

        const now = performance.now();
        if (stateChanged || (isNonNeutral && (now - this.lastTransmit > 50))) {
          this.lastTransmit = now;
          this.lastJoyState = { up, down, left, right, fire, fire2, play };
          if (this.onJoystickEvent) {
            this.onJoystickEvent(this.lastJoyState);
          }
        }
      }
    }
  }
}

/**
 * 3D Procedural Amiga 500 & Commodore 1084S Monitor Model for WebXR
 * Accurately scaled and detailed with working LEDs, drive slot, and screen mesh.
 */
import * as THREE from 'three';

export function createAmigaStation(screenMaterial) {
  const stationGroup = new THREE.Group();
  stationGroup.name = 'AmigaStation';

  // 1. COMMODORE 1084S CRT MONITOR
  const monitorGroup = new THREE.Group();
  monitorGroup.name = 'Commodore1084S';
  monitorGroup.position.set(0, 1.05, -1.2); // Positioned comfortably in front of user

  // Outer Housing (Beige/Warm Grey Plastic)
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0xc8c2b5, // Vintage Commodore beige
    roughness: 0.6,
    metalness: 0.05
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2d,
    roughness: 0.8
  });

  // Main CRT Cabinet
  const caseGeo = new THREE.BoxGeometry(0.56, 0.44, 0.42);
  const caseMesh = new THREE.Mesh(caseGeo, caseMat);
  monitorGroup.add(caseMesh);

  // Monitor Front Bezel
  const bezelGeo = new THREE.BoxGeometry(0.53, 0.41, 0.04);
  const bezelMesh = new THREE.Mesh(bezelGeo, darkTrimMat);
  bezelMesh.position.set(0, 0.01, 0.20);
  monitorGroup.add(bezelMesh);

  // CRT Glass Screen (4:3 PAL Aspect Ratio - Amiga 320x256 lowres / 640x512 hires)
  // Standard 14" screen: 0.42m width x 0.315m height (4:3)
  const screenGeo = new THREE.PlaneGeometry(0.44, 0.33);
  const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
  screenMesh.position.set(0, 0.02, 0.222);
  screenMesh.name = 'AmigaScreenMesh';
  monitorGroup.add(screenMesh);

  // Front Speaker Grilles (Left and Right of bottom panel)
  const speakerGeo = new THREE.BoxGeometry(0.08, 0.04, 0.01);
  const speakerL = new THREE.Mesh(speakerGeo, darkTrimMat);
  speakerL.position.set(-0.19, -0.165, 0.215);
  const speakerR = new THREE.Mesh(speakerGeo, darkTrimMat);
  speakerR.position.set(0.19, -0.165, 0.215);
  monitorGroup.add(speakerL);
  monitorGroup.add(speakerR);

  // Power LED (Green)
  const powerLedGeo = new THREE.SphereGeometry(0.005, 12, 12);
  const powerLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
  const powerLed = new THREE.Mesh(powerLedGeo, powerLedMat);
  powerLed.position.set(0.22, -0.165, 0.22);
  monitorGroup.add(powerLed);

  // Monitor Pedestal Stand
  const standGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.05, 24);
  const standMesh = new THREE.Mesh(standGeo, caseMat);
  standMesh.position.set(0, -0.24, 0);
  monitorGroup.add(standMesh);

  stationGroup.add(monitorGroup);

  // 2. COMMODORE AMIGA 500 COMPUTER
  const a500Group = new THREE.Group();
  a500Group.name = 'Amiga500Computer';
  a500Group.position.set(0, 0.72, -0.92); // Resting on desk in front of monitor

  // A500 Wedge Chassis (Main Body)
  const bodyGeo = new THREE.BoxGeometry(0.47, 0.065, 0.31);
  const bodyMesh = new THREE.Mesh(bodyGeo, caseMat);
  a500Group.add(bodyMesh);

  // Sloped Keyboard Well
  const kbWellGeo = new THREE.BoxGeometry(0.42, 0.02, 0.17);
  const kbWellMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22 });
  const kbWellMesh = new THREE.Mesh(kbWellGeo, kbWellMat);
  kbWellMesh.position.set(0, 0.025, 0.035);
  a500Group.add(kbWellMesh);

  // Keyboard Keys (Simplified clustered blocks for high WebXR performance)
  const keyMatLight = new THREE.MeshStandardMaterial({ color: 0xd2cdc2, roughness: 0.5 });
  const keyMatDark = new THREE.MeshStandardMaterial({ color: 0x6e6e72, roughness: 0.5 });

  // Main Alpha Keys
  const alphaKeysGeo = new THREE.BoxGeometry(0.26, 0.015, 0.13);
  const alphaKeysMesh = new THREE.Mesh(alphaKeysGeo, keyMatLight);
  alphaKeysMesh.position.set(-0.06, 0.038, 0.035);
  a500Group.add(alphaKeysMesh);

  // Numeric Keypad (Right)
  const numpadGeo = new THREE.BoxGeometry(0.08, 0.015, 0.13);
  const numpadMesh = new THREE.Mesh(numpadGeo, keyMatLight);
  numpadMesh.position.set(0.145, 0.038, 0.035);
  a500Group.add(numpadMesh);

  // Function Keys (Top row)
  const fkeysGeo = new THREE.BoxGeometry(0.39, 0.012, 0.02);
  const fkeysMesh = new THREE.Mesh(fkeysGeo, keyMatDark);
  fkeysMesh.position.set(0, 0.04, -0.045);
  a500Group.add(fkeysMesh);

  // FLOPPY DRIVE DF0: (Right Side Slot)
  const slotGeo = new THREE.BoxGeometry(0.008, 0.012, 0.10);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
  const driveSlot = new THREE.Mesh(slotGeo, slotMat);
  driveSlot.position.set(0.236, 0.008, -0.02);
  driveSlot.name = 'DF0_DriveSlot';
  a500Group.add(driveSlot);

  // Eject Button
  const ejectBtnGeo = new THREE.BoxGeometry(0.008, 0.008, 0.015);
  const ejectBtnMat = new THREE.MeshStandardMaterial({ color: 0x909090 });
  const ejectBtn = new THREE.Mesh(ejectBtnGeo, ejectBtnMat);
  ejectBtn.position.set(0.236, -0.01, -0.02);
  ejectBtn.name = 'DF0_EjectButton';
  a500Group.add(ejectBtn);

  // Drive LED (DF0: - Green/Amber)
  const driveLedGeo = new THREE.SphereGeometry(0.003, 8, 8);
  const driveLedMat = new THREE.MeshBasicMaterial({ color: 0x223322 }); // Dimmest green when idle
  const driveLed = new THREE.Mesh(driveLedGeo, driveLedMat);
  driveLed.position.set(0.236, 0.022, -0.02);
  driveLed.name = 'DF0_ActivityLED';
  a500Group.add(driveLed);

  // Power LED (Top Left)
  const a500PowerLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff33 });
  const a500PowerLed = new THREE.Mesh(driveLedGeo, a500PowerLedMat);
  a500PowerLed.position.set(-0.18, 0.038, -0.11);
  a500PowerLed.name = 'A500_PowerLED';
  a500Group.add(a500PowerLed);

  stationGroup.add(a500Group);

  // 3. RETRO COMPUTER DESK
  const deskGroup = new THREE.Group();
  deskGroup.name = 'RetroDesk';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6e4a2e, // Warm teak wood
    roughness: 0.7,
    metalness: 0.05
  });

  const deskTopGeo = new THREE.BoxGeometry(1.2, 0.04, 0.75);
  const deskTop = new THREE.Mesh(deskTopGeo, woodMat);
  deskTop.position.set(0, 0.69, -1.05);
  deskGroup.add(deskTop);

  // Desk Legs
  const legGeo = new THREE.BoxGeometry(0.05, 0.69, 0.05);
  const legPositions = [
    [-0.55, 0.345, -0.72],
    [ 0.55, 0.345, -0.72],
    [-0.55, 0.345, -1.38],
    [ 0.55, 0.345, -1.38]
  ];
  for (const pos of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(...pos);
    deskGroup.add(leg);
  }

  stationGroup.add(deskGroup);

  return {
    group: stationGroup,
    monitorGroup,
    a500Group,
    screenMesh,
    driveSlot,
    ejectBtn,
    driveLed,
    setDriveActive: (active) => {
      driveLed.material.color.setHex(active ? 0x00ff00 : 0x223322);
    }
  };
}

/**
 * Creates a detailed 3D Amiga 3.5" Floppy Diskette with custom printed label
 */
export function createAmigaFloppyDisk(diskTitle, diskNum = 1, totalDisks = 1) {
  const diskGroup = new THREE.Group();
  diskGroup.name = `Floppy_${diskTitle}`;

  // Floppy plastic case: 90mm x 94mm x 3.3mm
  const caseGeo = new THREE.BoxGeometry(0.09, 0.0033, 0.094);
  const diskColor = 0x22252a; // Iconic dark grey / blue Amiga floppy
  const diskCaseMat = new THREE.MeshStandardMaterial({
    color: diskColor,
    roughness: 0.6
  });
  const caseMesh = new THREE.Mesh(caseGeo, diskCaseMat);
  diskGroup.add(caseMesh);

  // Metal Shutter Slider (top edge)
  const shutterGeo = new THREE.BoxGeometry(0.038, 0.0036, 0.026);
  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.85,
    roughness: 0.2
  });
  const shutterMesh = new THREE.Mesh(shutterGeo, shutterMat);
  shutterMesh.position.set(0, 0, -0.034);
  diskGroup.add(shutterMesh);

  // Custom Canvas Label Texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // White retro label background with red/blue stripes
  ctx.fillStyle = '#f0eee9';
  ctx.fillRect(0, 0, 512, 256);

  // Amiga rainbow color bar at the top
  ctx.fillStyle = '#0055aa'; // Commodore blue
  ctx.fillRect(0, 0, 512, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('COMMODORE AMIGA 3.5" DISK', 14, 26);

  // Disk title
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 28px sans-serif';
  let displayTitle = diskTitle;
  if (displayTitle.length > 28) displayTitle = displayTitle.substring(0, 25) + '...';
  ctx.fillText(displayTitle, 16, 90);

  // Subtitle / Multi-disk info
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText(`Disk ${diskNum} of ${totalDisks} [880 KB MFM]`, 16, 130);

  // Retro grid lines on label
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 160);
  ctx.lineTo(496, 160);
  ctx.moveTo(16, 195);
  ctx.lineTo(496, 195);
  ctx.stroke();

  // Bottom note
  ctx.fillStyle = '#888888';
  ctx.font = '16px monospace';
  ctx.fillText('TOSEC HIGH DENSITY PRESERVATION', 16, 230);

  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelGeo = new THREE.PlaneGeometry(0.076, 0.048);
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.8 });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(0, 0.0018, 0.01);
  diskGroup.add(labelMesh);

  return diskGroup;
}

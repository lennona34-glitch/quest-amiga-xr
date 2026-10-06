/**
 * 1990s Retro Amiga Den Environment for Meta Quest 3 WebXR
 * Creates an authentic retro room with wallpaper, carpet, retro posters, and rich warm lighting.
 */
import * as THREE from 'three';

export function createRetroDen() {
  const denGroup = new THREE.Group();
  denGroup.name = 'RetroAmigaDen';

  // Room Dimensions (4.5m wide x 3.8m deep x 2.8m high)
  const roomWidth = 4.5;
  const roomDepth = 3.8;
  const roomHeight = 2.8;
  const centerZ = -0.625; // Desk is around z = -1.0, user sits at z = 0.0

  // 1. CARPET FLOOR (Double-sided, warm 90s carpet)
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x4a3830, // 90s warm brown/maroon shag carpet
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, 0, centerZ);
  denGroup.add(floor);

  // 2. WALL MATERIAL (Double-sided vintage wallpaper)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8a7b6c, // 90s warm taupe/beige striped wallpaper
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  // BACK WALL (Behind monitor, z = -2.5)
  const backWallGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, roomHeight / 2, -2.5);
  denGroup.add(backWall);

  // FRONT WALL (Behind user, z = +1.3)
  const frontWallGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const frontWall = new THREE.Mesh(frontWallGeo, wallMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, roomHeight / 2, 1.275);
  denGroup.add(frontWall);

  // LEFT WALL
  const sideWallGeo = new THREE.PlaneGeometry(roomDepth, roomHeight);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-roomWidth / 2, roomHeight / 2, centerZ);
  denGroup.add(leftWall);

  // RIGHT WALL
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(roomWidth / 2, roomHeight / 2, centerZ);
  denGroup.add(rightWall);

  // 3. CEILING (Double-sided)
  const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  ceilingGeo.rotateX(Math.PI / 2);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x303038,
    roughness: 0.9,
    side: THREE.DoubleSide
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(0, roomHeight, centerZ);
  denGroup.add(ceiling);

  // 4. RETRO POSTERS ON WALLS
  function createPoster(title, subtitle, color, x, y, z, rotY = 0, width = 0.55, height = 0.75) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 700);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, 476, 664);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 120);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(subtitle, 256, 180);

    // Decorative retro graphic
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(256, 380, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 24px monospace';
    ctx.fillText('ONLY AMIGA MAKES IT POSSIBLE', 256, 620);

    const texture = new THREE.CanvasTexture(canvas);
    const posterGeo = new THREE.PlaneGeometry(width, height);
    const posterMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(x, y, z);
    poster.rotation.y = rotY;
    return poster;
  }

  // Turrican II Poster
  const poster1 = createPoster('TURRICAN II', 'THE FINAL FIGHT', '#8b1e0f', -1.1, 1.6, -2.48);
  denGroup.add(poster1);

  // Sensible Soccer Poster
  const poster2 = createPoster('SENSIBLE SOCCER', 'EUROPEAN CHAMPIONS', '#1e6b2c', 1.1, 1.6, -2.48);
  denGroup.add(poster2);

  // Amiga Boing Ball / Workbench Poster
  const poster3 = createPoster('COMMODORE AMIGA', 'POWER TO FLY', '#0d3b66', 0.0, 1.9, -2.48, 0, 0.7, 0.5);
  denGroup.add(poster3);

  // Kikstart 2 Retro Poster on Left Wall
  const posterLeft = createPoster('KIKSTART 2', 'SHAUN SOUTHERN', '#c85a17', -roomWidth / 2 + 0.02, 1.6, -1.0, Math.PI / 2);
  denGroup.add(posterLeft);

  // C64 Scene Poster on Right Wall
  const posterRight = createPoster('COMMODORE 64', 'KEEPING 8-BIT ALIVE', '#2b4c7e', roomWidth / 2 - 0.02, 1.6, -1.0, -Math.PI / 2);
  denGroup.add(posterRight);

  // 5. HIGH-FIDELITY ROOM LIGHTING (Physically Correct PBR for Snapdragon XR2 Gen 2)
  // Overhead Ceiling Lamp
  const ceilingLamp = new THREE.PointLight(0xfff5e8, 9.0, 12.0, 1.0);
  ceilingLamp.position.set(0, 2.65, centerZ);
  denGroup.add(ceilingLamp);

  // Desk Reading Lamp (Warm golden illumination on the desk)
  const deskLamp = new THREE.SpotLight(0xffdfa0, 12.0, 6.0, Math.PI / 3, 0.5, 1.0);
  deskLamp.position.set(-0.55, 1.8, -0.6);
  deskLamp.target.position.set(0, 0.72, -1.0);
  denGroup.add(deskLamp);
  denGroup.add(deskLamp.target);

  // Room Ambient & Hemisphere Fill
  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  denGroup.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x54473d, 1.1);
  denGroup.add(hemi);

  return denGroup;
}

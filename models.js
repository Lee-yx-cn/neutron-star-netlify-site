import * as THREE from "./vendor/three/build/three.module.js";

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothRange(start, end, value) {
  if (start === end) {
    return value >= end ? 1 : 0;
  }
  const x = clamp01((value - start) / (end - start));
  return x * x * (3 - 2 * x);
}

function pulse(center, width, value) {
  const scaled = (value - center) / width;
  return Math.exp(-(scaled * scaled));
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose();
        }
        material.dispose();
      });
    }
  });
}

function updateOpacity(object, opacity) {
  object.traverse((child) => {
    if (!child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
    });
  });
}

function makeGlowSprite(color) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(0.52, "rgba(98,214,255,0.20)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Sprite(material);
}

function createStar(radius, color, emissive) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 48),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 2.2,
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 0.55
    })
  );

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.16, 40, 40),
    new THREE.MeshBasicMaterial({
      color: emissive,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );

  const glow = makeGlowSprite("rgba(98,214,255,0.72)");
  glow.scale.set(radius * 5.6, radius * 5.6, 1);

  group.add(glow, shell, core);
  group.userData = { core, shell, glow };
  return group;
}

function createDipoleTube(radius, shellRadius, phi, color) {
  const points = [];
  const thetaMin = 0.2;
  const thetaMax = Math.PI - 0.2;
  const steps = 90;

  for (let step = 0; step <= steps; step += 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * step) / steps;
    const r = Math.max(radius * 1.08, shellRadius * Math.sin(theta) ** 2);
    const x = r * Math.sin(theta);
    const z = r * Math.cos(theta);
    points.push(new THREE.Vector3(x, 0, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 0.032, 10, false),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  tube.rotation.y = phi;
  return tube;
}

function createAlphaLoop(radius, phi, color, tilt = 0) {
  const points = [];
  const outerSteps = 84;
  const innerSteps = 66;
  const thetaMin = 0.32;
  const thetaMax = Math.PI - 0.32;
  const outerScale = radius * 1.72;
  const innerBase = radius * 0.54;

  // The alpha-effect should regenerate a poloidal component, so use a
  // closed meridional loop that follows a dipole-like outer branch and a
  // tighter interior return branch instead of a decorative wavy ring.
  for (let step = 0; step <= outerSteps; step += 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * step) / outerSteps;
    const r = Math.max(radius * 1.03, outerScale * Math.sin(theta) ** 2);
    points.push(new THREE.Vector3(r * Math.sin(theta), r * Math.cos(theta), 0));
  }

  for (let step = innerSteps; step >= 0; step -= 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * step) / innerSteps;
    const r = innerBase + radius * 0.12 * Math.cos(theta) ** 2;
    points.push(new THREE.Vector3(r * Math.sin(theta), r * Math.cos(theta), 0));
  }

  const curve = new THREE.CatmullRomCurve3(points, true);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 220, 0.03, 12, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  tube.rotation.y = phi;
  tube.rotation.z = tilt;
  return tube;
}

function createSparkCloud(count, spread, color) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const radius = spread * (0.55 + Math.random() * 0.45);
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * Math.PI * 2;
    positions[index * 3] = radius * Math.sin(theta) * Math.cos(phi);
    positions[index * 3 + 1] = radius * Math.cos(theta);
    positions[index * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
    scales[index] = 0.2 + Math.random();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

  const material = new THREE.PointsMaterial({
    color,
    size: 0.045,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

function createWaveRing(color) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 16, 80),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
}

function buildMagnetarExperience(root) {
  const group = new THREE.Group();
  root.add(group);

  const star = createStar(1.55, 0xffb36a, 0xff7f37);
  group.add(star);

  const dipoles = [];
  for (let index = 0; index < 6; index += 1) {
    const tube = createDipoleTube(1.55, 4.3, (index * Math.PI) / 3, 0x62d6ff);
    dipoles.push(tube);
    group.add(tube);
  }

  const toroidalGroup = new THREE.Group();
  const toroidalRings = [];
  for (let index = 0; index < 5; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.15 + index * 0.2, 0.06, 16, 72),
      new THREE.MeshBasicMaterial({
        color: 0xffc871,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.28 + index * 0.14;
    toroidalRings.push(ring);
    toroidalGroup.add(ring);
  }
  group.add(toroidalGroup);

  const alphaGroup = new THREE.Group();
  const alphaLoops = [];
  const alphaPhases = [0.18, 2.28, 4.38];
  const alphaTilts = [0.16, -0.14, 0.12];
  for (let index = 0; index < alphaPhases.length; index += 1) {
    const loop = createAlphaLoop(1.78, alphaPhases[index], 0xfe8df8, alphaTilts[index]);
    alphaLoops.push(loop);
    alphaGroup.add(loop);
  }
  group.add(alphaGroup);

  const sparkCloud = createSparkCloud(320, 5.4, 0x62d6ff);
  group.add(sparkCloud);

  group.position.y = 0.15;
  root.userData.cameraTarget.set(0, 0.6, 0);

  const state = { progress: 0 };
  const duration = 18;

  return {
    duration,
    getProgress() {
      return state.progress;
    },
    update(delta, elapsed) {
      const phase = (elapsed % duration) / duration;
      state.progress = phase;

      const wrapping = smoothRange(0.12, 0.46, phase);
      const alphaLift = smoothRange(0.4, 0.78, phase);
      const saturation = smoothRange(0.76, 0.98, phase);
      const pulseBoost = pulse(0.87, 0.08, phase);

      group.rotation.y += delta * 0.18;
      star.rotation.y += delta * (1.2 + wrapping * 4.8);
      star.rotation.z = Math.sin(elapsed * 0.8) * 0.06;
      star.scale.setScalar(1 + 0.03 * Math.sin(elapsed * 2.6));

      star.userData.core.material.emissiveIntensity = 2.2 + wrapping * 1.3 + pulseBoost * 0.9;
      star.userData.shell.material.opacity = 0.1 + wrapping * 0.08 + pulseBoost * 0.12;
      star.userData.glow.material.opacity = 0.7 + wrapping * 0.12 + pulseBoost * 0.2;

      dipoles.forEach((tube, index) => {
        const opacity = 0.36 + 0.22 * (1 - wrapping) + 0.34 * saturation;
        tube.material.opacity = opacity;
        tube.scale.setScalar(1 + 0.08 * Math.sin(elapsed * 1.8 + index));
        tube.rotation.z = Math.sin(elapsed * 0.45 + index) * 0.06;
      });

      toroidalRings.forEach((ring, index) => {
        ring.material.opacity = 0.78 * wrapping * (1 - saturation * 0.2);
        ring.rotation.z += delta * (0.6 + index * 0.18);
        ring.scale.setScalar(1 + 0.08 * Math.sin(elapsed * 3.2 + index * 0.8));
      });

      alphaLoops.forEach((loop, index) => {
        loop.material.opacity = (0.18 + 0.74 * alphaLift) * (0.72 + 0.28 * Math.sin(elapsed * 4 + index));
        loop.rotation.x = Math.sin(elapsed * 0.9 + index) * 0.08;
        loop.scale.setScalar(0.95 + alphaLift * 0.22);
      });

      sparkCloud.rotation.y += delta * (0.16 + 0.48 * wrapping);
      sparkCloud.material.opacity = 0.2 + 0.55 * alphaLift + 0.2 * pulseBoost;
      sparkCloud.scale.setScalar(1 + 0.1 * pulseBoost);
    },
    dispose() {
      disposeObject(group);
      root.remove(group);
    }
  };
}

function buildMergerExperience(root) {
  const group = new THREE.Group();
  root.add(group);

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20, 72, 72),
    new THREE.MeshBasicMaterial({
      color: 0x1d517a,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1.85;
  group.add(plane);

  const basePlane = plane.geometry.attributes.position.array.slice();

  const starA = createStar(1.08, 0xd0f0ff, 0x73ddff);
  const starB = createStar(1.08, 0xc8d8ff, 0x93adff);
  group.add(starA, starB);

  const remnant = createStar(1.45, 0xffce83, 0xff8157);
  remnant.visible = false;
  group.add(remnant);

  const ejecta = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffa27c,
      transparent: true,
      opacity: 0,
      wireframe: true
    })
  );
  ejecta.visible = false;
  group.add(ejecta);

  const waveRings = [];
  for (let index = 0; index < 6; index += 1) {
    const ring = createWaveRing(0x62d6ff);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.45;
    waveRings.push(ring);
    group.add(ring);
  }

  const orbitTrail = createSparkCloud(240, 6.2, 0x62d6ff);
  orbitTrail.position.y = 0.2;
  group.add(orbitTrail);

  root.userData.cameraTarget.set(0, -0.2, 0);

  const state = { progress: 0 };
  const duration = 20;

  return {
    duration,
    getProgress() {
      return state.progress;
    },
    update(_delta, elapsed) {
      const phase = (elapsed % duration) / duration;
      state.progress = phase;

      const inspiral = smoothRange(0.0, 0.76, phase);
      const merger = smoothRange(0.74, 0.86, phase);
      const afterglow = smoothRange(0.84, 0.98, phase);

      const separation = 7.2 - inspiral * 5.95;
      const theta = elapsed * (0.7 + inspiral * 8.5);
      const x = Math.cos(theta) * separation * 0.5;
      const z = Math.sin(theta) * separation * 0.5;

      starA.visible = merger < 0.92;
      starB.visible = merger < 0.92;
      starA.position.set(x, 0.18, z);
      starB.position.set(-x, 0.18, -z);
      starA.rotation.y += 0.04;
      starB.rotation.y -= 0.05;

      remnant.visible = merger > 0.05;
      remnant.scale.setScalar(0.8 + merger * 0.55 + 0.06 * Math.sin(elapsed * 6));
      remnant.userData.core.material.emissiveIntensity = 2.1 + merger * 2.1 + afterglow;
      remnant.userData.shell.material.opacity = 0.08 + merger * 0.18;

      ejecta.visible = merger > 0.1;
      ejecta.scale.setScalar(1 + merger * 1.8 + afterglow * 1.8);
      ejecta.material.opacity = 0.08 + 0.24 * merger * (1 - afterglow * 0.55);

      const positions = plane.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const px = basePlane[i];
        const py = basePlane[i + 1];
        const distanceA = Math.hypot(px - starA.position.x, py - starA.position.z);
        const distanceB = Math.hypot(px - starB.position.x, py - starB.position.z);
        const centralWell = Math.hypot(px, py);

        let depth = -0.9 / (distanceA + 1.1) - 0.9 / (distanceB + 1.1);
        depth += -1.35 * merger / (centralWell + 1.15);
        positions[i + 2] = depth;
      }
      plane.geometry.attributes.position.needsUpdate = true;

      waveRings.forEach((ring, index) => {
        const local = (elapsed * (0.34 + inspiral * 0.95 + merger * 0.55) - index * 0.23) % 1;
        ring.scale.setScalar(0.6 + local * (5.5 + inspiral * 2.5 + merger * 4));
        ring.material.opacity = (1 - local) * (0.08 + inspiral * 0.32 + merger * 0.48);
      });

      orbitTrail.rotation.y += 0.003 + inspiral * 0.01;
      orbitTrail.material.opacity = 0.08 + inspiral * 0.26 + merger * 0.15;
    },
    dispose() {
      disposeObject(group);
      root.remove(group);
    }
  };
}

function buildBlitzarExperience(root) {
  const group = new THREE.Group();
  root.add(group);

  const star = createStar(1.5, 0xd6ecff, 0x74c7ff);
  group.add(star);

  const supportRings = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.0 + index * 0.18, 0.04, 16, 64),
      new THREE.MeshBasicMaterial({
        color: 0x62d6ff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2 + index * 0.18;
    ring.rotation.z = index * 0.42;
    supportRings.push(ring);
    group.add(ring);
  }

  const dipoles = [];
  for (let index = 0; index < 5; index += 1) {
    const tube = createDipoleTube(1.45, 3.9, (index * Math.PI * 2) / 5, 0x8de6ff);
    dipoles.push(tube);
    group.add(tube);
  }

  const blackHole = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 48, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0x08080b,
      emissive: 0x1a2236,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 0.85
    })
  );
  blackHole.visible = false;
  group.add(blackHole);

  const horizonGlow = makeGlowSprite("rgba(126,180,255,0.50)");
  horizonGlow.visible = false;
  horizonGlow.scale.set(9, 9, 1);
  group.add(horizonGlow);

  const frbBeamA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.58, 10, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x62d6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  frbBeamA.rotation.z = Math.PI / 2;
  frbBeamA.position.x = 4.8;
  group.add(frbBeamA);

  const frbBeamB = frbBeamA.clone();
  frbBeamB.material = frbBeamA.material.clone();
  frbBeamB.position.x = -4.8;
  frbBeamB.rotation.z = -Math.PI / 2;
  group.add(frbBeamB);

  const wavefront = createWaveRing(0xffc871);
  wavefront.rotation.y = Math.PI / 2;
  group.add(wavefront);

  const debris = createSparkCloud(260, 5.2, 0xffc871);
  group.add(debris);

  group.position.y = 0.2;
  root.userData.cameraTarget.set(0, 0.3, 0);

  const state = { progress: 0 };
  const duration = 18;

  return {
    duration,
    getProgress() {
      return state.progress;
    },
    update(delta, elapsed) {
      const phase = (elapsed % duration) / duration;
      state.progress = phase;

      const spinDown = smoothRange(0.22, 0.58, phase);
      const collapse = smoothRange(0.56, 0.79, phase);
      const radioFlash = pulse(0.84, 0.05, phase);
      const aftermath = smoothRange(0.8, 0.97, phase);

      star.visible = collapse < 0.98;
      star.scale.setScalar(1 - collapse * 0.88);
      star.rotation.y += delta * (3.3 - spinDown * 1.7);
      star.userData.core.material.emissiveIntensity = 1.9 - spinDown * 0.7 + radioFlash * 1.1;
      star.userData.shell.material.opacity = 0.11 + radioFlash * 0.22;

      supportRings.forEach((ring, index) => {
        ring.material.opacity = Math.max(0, 0.54 - spinDown * 0.34 - collapse * 0.54 + radioFlash * 0.24);
        ring.rotation.y += delta * (0.7 + index * 0.22);
        ring.scale.setScalar(1 - spinDown * 0.12 + radioFlash * 0.42);
      });

      dipoles.forEach((tube, index) => {
        tube.material.opacity = 0.22 + 0.52 * (1 - collapse) + radioFlash * 0.52;
        tube.scale.setScalar(1 + collapse * 0.4 + radioFlash * 1.5);
        tube.rotation.z = Math.sin(elapsed * 0.7 + index) * 0.05;
      });

      blackHole.visible = aftermath > 0.02;
      blackHole.scale.setScalar(0.25 + aftermath * 0.95);
      horizonGlow.visible = blackHole.visible;
      horizonGlow.material.opacity = 0.18 + aftermath * 0.42;

      frbBeamA.material.opacity = radioFlash * 0.9;
      frbBeamB.material.opacity = radioFlash * 0.9;
      frbBeamA.scale.set(1 + radioFlash * 3.4, 1 + radioFlash * 0.4, 1 + radioFlash * 0.4);
      frbBeamB.scale.copy(frbBeamA.scale);
      frbBeamA.position.x = 4.8 + radioFlash * 5.4;
      frbBeamB.position.x = -4.8 - radioFlash * 5.4;

      wavefront.material.opacity = radioFlash * 0.78;
      wavefront.scale.setScalar(1 + radioFlash * 11);

      debris.rotation.y += delta * 0.22;
      debris.material.opacity = 0.08 + radioFlash * 0.42 + aftermath * 0.16;
      debris.scale.setScalar(1 + radioFlash * 0.7);
    },
    dispose() {
      disposeObject(group);
      root.remove(group);
    }
  };
}

export const MODEL_DEFINITIONS = [
  {
    id: "magnetar-alpha-omega",
    title: "磁星 α-ω 效应",
    buttonText: "快速自转、微分旋转与磁场放大",
    summary:
      "这一动画把磁星形成中的经典 α-ω 发电机图像做成了三维示意：初始极向场先被快速自转与微分旋转缠绕成更强的环向磁场，再由 α 效应把局部扭曲环流重新抬升并回接为大尺度磁结构。",
    highlights: [
      "蓝色弧线表示极向/大尺度磁场，金色环表示被微分旋转缠绕出的环向场。",
      "紫色回卷回路表示 α 效应把局部扭曲磁通重新转回到可维持全局磁场的方向。",
      "场强脉动和发光增强用于强调 proto-magnetar 阶段的磁场放大，而不是做严格数值定量。"
    ],
    citation:
      "参考：Turolla, Zane & Watts (2015), Magnetars: the physics behind observations. A review。你指定的第 2.2 节主要强调 magneto-thermal evolution，以及内部场可能同时包含 toroidal 与 poloidal 组分；本页据此采用科普级 α-ω 可视化来表现强磁场建立过程。",
    note:
      "这里的 α-ω 动画是面向展示的物理图像，不等同于论文中的完整磁流体数值模拟；更接近文献与科普视频常见的“种子场 -> 缠绕 -> 回卷 -> 强磁场”叙事结构。",
    stages: [
      { label: "种子磁场", description: "先显示较规则的极向场，强调原始磁通存在。", range: [0.0, 0.22] },
      { label: "ω 效应缠绕", description: "微分旋转把磁力线不断卷紧，环向场迅速增强。", range: [0.22, 0.52] },
      { label: "α 效应回卷", description: "局部翻卷与抬升把部分环向场重新转成大尺度分量。", range: [0.52, 0.8] },
      { label: "强磁场建立", description: "环向与极向成分共同维持更强、更复杂的磁结构。", range: [0.8, 1.0] }
    ],
    createExperience: buildMagnetarExperience
  },
  {
    id: "bns-merger",
    title: "双中子星并合与引力波",
    buttonText: "轨道衰减、chirp 与并合后 remnant",
    summary:
      "这一模型聚焦双中子星系统在引力波辐射作用下的轨道内旋、chirp 增强、最终接触并合，以及并合后 remnant 与喷出物出现的多信使图像。",
    highlights: [
      "两颗中子星越靠越近时，轨道频率与引力波幅度同步上升，对应典型 chirp 行为。",
      "下方网格是风格化的时空势阱可视化，用来帮助观看并合前后曲率变化。",
      "并合后出现 remnant 与膨胀外壳，用来指代并合后喷出物和多信使后续过程。"
    ],
    citation:
      "参考：Bailes et al. (2021), Gravitational-wave physics and astronomy in the 2020s and 2030s | Nature Reviews Physics。文中以 GW170817 作为双中子星并合与多信使天文学的代表性案例。",
    note:
      "这里的引力波波前和时空网格都是教学化表达，重点在“轨道衰减 -> chirp -> 并合 -> remnant”这一主线，而不是复现波形模板的精确参数。",
    stages: [
      { label: "稳定双星", description: "两颗中子星围绕共同质心运行。", range: [0.0, 0.28] },
      { label: "轨道内旋", description: "系统通过引力波失能，轨道半径缩小、频率抬升。", range: [0.28, 0.68] },
      { label: "并合触发", description: "接触并合时，引力波达到最剧烈阶段。", range: [0.68, 0.88] },
      { label: "并合后 remnant", description: "形成并合后天体并伴随喷出物扩张。", range: [0.88, 1.0] }
    ],
    createExperience: buildMergerExperience
  },
  {
    id: "suron-blitzar",
    title: "SURON 坍塌成 BH 与 blitzar-FRB",
    buttonText: "超大质量旋转中子星失稳坍塌并触发 FRB",
    summary:
      "这一动画把 supramassive rotating neutron star (SURON) 的自转支撑、持续 spin-down、临界失稳坍塌成黑洞，以及磁层快速断开释放 blitzar 型 FRB 的过程放在同一个三维场景里展示。",
    highlights: [
      "蓝色支撑环表示快速自转带来的额外支撑；随时间推移，spin-down 让这部分支撑逐渐减弱。",
      "坍塌触发后，中心黑洞出现，原有磁层被快速拉断并向外甩出。",
      "两侧的亮束和膨胀波前表示 blitzar 情景下瞬时射电暴的教学化表达。"
    ],
    citation:
      "参考：Zhang (2023), The physics of fast radio bursts，第 VI.F 节对 cataclysmic progenitor models 中的 blitzars 作了综述，提到 Falcke & Rezzolla (2014) 以及后续数值模拟工作。",
    note:
      "网页里使用的是“自转支撑衰减 -> 视界形成 -> 磁层脱附 -> FRB 射电脉冲”这一简洁动画叙事，适合教学展示，不代表完整广义相对论磁层演化计算。",
    stages: [
      { label: "SURON 自转支撑", description: "超大质量旋转中子星靠快速自转保持暂时稳定。", range: [0.0, 0.32] },
      { label: "持续 spin-down", description: "角动量流失让额外支撑逐步消退。", range: [0.32, 0.62] },
      { label: "临界坍塌", description: "达到稳定极限后快速塌缩，黑洞开始形成。", range: [0.62, 0.82] },
      { label: "blitzar / FRB", description: "磁层断开并抛出，形成毫秒级射电暴示意。", range: [0.82, 1.0] }
    ],
    createExperience: buildBlitzarExperience
  }
];

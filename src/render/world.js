import * as THREE from "three";
import { PALETTE as C, SITE } from "../config.js";
import { VoxelBuilder, createSign, boxMesh } from "./voxel.js";

function addGround(root, colliders) {
  const ground = new VoxelBuilder();
  ground.box(0, -1.4, 0, 190, 1.2, 160, 0x69715f);
  // 四块场坪拼出真实下凹的土方坑，而非在平地贴一张黑色图案。
  ground.box(-55, -0.6, 0, 2, 1.2, 84, C.soil);
  ground.box(6, -0.6, 0, 100, 1.2, 84, C.soil);
  ground.box(-49, -0.6, -32, 10, 1.2, 20, C.soil);
  ground.box(-49, -0.6, 19, 10, 1.2, 46, C.soil);
  ground.box(-49, -1.02, -13, 10, 0.4, 18, C.soilDark);
  ground.box(-53.4, -0.45, -13, 1.2, 0.8, 18, C.sand);
  ground.box(-44.6, -0.45, -13, 1.2, 0.8, 18, C.sand);
  ground.box(-49, -0.45, -21.4, 8, 0.8, 1.2, C.sand);
  ground.box(-49, -0.45, -4.6, 8, 0.8, 1.2, C.sand);
  root.add(ground.group({ name: "场坪与土方坑" }));
  colliders.push({ minX: -54.5, maxX: -43.5, minZ: -22.5, maxZ: -3.5, label: "土方坑" });

  const roads = new VoxelBuilder();
  roads.box(-2, 0.04, 26, 76, 0.12, 8, C.asphalt);
  roads.box(-36, 0.04, -2, 8, 0.12, 56, C.asphalt);
  roads.box(-2, 0.04, -30, 76, 0.12, 8, C.asphalt);
  roads.box(32, 0.04, 1, 8, 0.12, 66, C.asphalt);
  roads.box(8, 0.04, 34, 8, 0.12, 16, C.asphalt);
  roads.box(8, -0.02, 51, 10, 0.12, 18, C.asphalt);
  roads.box(24, 0.02, 10, 24, 0.12, 20, C.gravel);
  roads.box(-29.5, 0.02, 7, 11, 0.12, 16, C.gravel);
  roads.box(44, 0.02, 26, 16, 0.12, 14, C.gravel);
  for (let x = -29; x <= 27; x += 6) {
    roads.box(x, 0.115, 26, 2.6, 0.03, 0.18, C.white);
    roads.box(x, 0.115, -30, 2.6, 0.03, 0.18, C.white);
  }
  for (let z = -21; z <= 19; z += 6) {
    roads.box(-36, 0.115, z, 0.18, 0.03, 2.6, C.white);
    roads.box(32, 0.115, z, 0.18, 0.03, 2.6, C.white);
  }
  for (let z = 30; z <= 40; z += 4) roads.box(8, 0.115, z, 0.18, 0.03, 1.8, C.yellow);
  // 装卸区与停车位标线。
  for (const x of [20, 34]) roads.box(x, 0.13, 23, 0.18, 0.04, 8, C.yellow);
  for (const z of [19, 29]) roads.box(27, 0.13, z, 14, 0.04, 0.18, C.yellow);
  for (let i = 0; i < 4; i += 1) {
    roads.box(39 + i * 3.4, 0.13, 27, 0.16, 0.04, 10, C.white);
  }
  root.add(roads.group({ name: "施工道路", castShadow: false }));
}

function addFenceAndGate(root) {
  const fence = new VoxelBuilder();
  const panel = (x, z, w, d, index) => {
    fence.box(x, 1.2, z, w, 2.4, d, index % 3 === 0 ? 0x456a68 : 0x597b74);
    fence.box(x, 2.45, z, w + 0.1, 0.14, d + 0.1, C.steelLight);
  };
  let index = 0;
  for (let x = -54; x <= 54; x += 4) {
    if (x < 2 || x > 14) panel(x, 42, 3.8, 0.2, index++);
    panel(x, -42, 3.8, 0.2, index++);
  }
  for (let z = -40; z <= 40; z += 4) {
    panel(-56, z, 0.2, 3.8, index++);
    panel(56, z, 0.2, 3.8, index++);
  }
  for (let x = -56; x <= 56; x += 4) {
    fence.box(x, 1.4, -42, 0.2, 2.8, 0.2, C.steel);
    if (x < 2 || x > 14) fence.box(x, 1.4, 42, 0.2, 2.8, 0.2, C.steel);
  }
  // 门柱、门禁与红白道闸。
  for (const x of [1.4, 14.6]) {
    fence.box(x, 1.8, 41.4, 0.8, 3.6, 0.8, C.concreteLight);
    fence.box(x, 3.7, 41.4, 1, 0.2, 1, C.yellow);
  }
  fence.box(14, 0.8, 39.8, 0.8, 1.6, 0.8, C.yellow);
  for (let i = 0; i < 10; i += 1) fence.box(13.4 - i, 1.5, 39.8, 1, 0.24, 0.24, i % 2 ? C.white : C.red);
  fence.box(8, 5.4, 41.5, 15, 0.4, 0.6, C.steel);
  root.add(fence.group({ name: "围挡与正门" }));

  const title = createSign("飞尘工地", "FEICHEN · 结构施工阶段", 11.6, 2.2);
  title.position.set(8, 4.35, 41.85);
  root.add(title);
  const safety = createSign("安全生产", "进入现场 · 请佩戴安全帽", 5.4, 2.1, { background: "#e6e1ce", band: "#b94d3e" });
  safety.position.set(-6, 1.45, 42.12);
  root.add(safety);
}

function addOffice(root, nightMaterials, colliders) {
  const office = new VoxelBuilder();
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x71919a,
    emissive: 0xffc777,
    emissiveIntensity: 0.08,
    roughness: 0.35,
  });
  nightMaterials.push(windowMaterial);
  const buildCabin = (x, z, w, d, h, label) => {
    office.box(x, 0.2, z, w + 0.4, 0.4, d + 0.4, C.concreteDark);
    office.box(x, h / 2 + 0.4, z, w, h, d, C.white);
    office.box(x, 0.8, z, w + 0.1, 0.5, d + 0.1, C.blue);
    office.box(x, h + 0.55, z, w + 0.6, 0.3, d + 0.6, C.blue);
    office.box(x - w * 0.32, 1.6, z + d / 2 + 0.11, 1.2, 2.4, 0.2, C.dark);
    const windows = new THREE.Group();
    for (const dx of [-0.05, 0.28]) {
      const win = boxMesh(w * 0.22, 1.2, 0.16, windowMaterial);
      win.position.set(x + w * dx, 2.1, z + d / 2 + 0.13);
      windows.add(win);
    }
    root.add(windows);
    if (label) {
      const sign = createSign(label, "TEMPORARY FACILITIES", Math.min(w - 1, 6), 1.2, { background: "#e6e4d9", band: "#397183" });
      sign.position.set(x, h + 0.1, z + d / 2 + 0.2);
      root.add(sign);
    }
    colliders.push({ minX: x - w / 2 - 0.5, maxX: x + w / 2 + 0.5, minZ: z - d / 2 - 0.5, maxZ: z + d / 2 + 0.5, label });
  };
  buildCabin(43, -36, 18, 7, 3.2, "项目办公 / 工友休息");
  buildCabin(19, 37, 5, 5, 3, "门岗");
  root.add(office.group({ name: "办公休息区与门岗" }));

  const details = new VoxelBuilder();
  // 办公区踏步、雨棚、空调外机与休息桌椅。
  details.box(37, 0.2, -31.8, 3, 0.4, 1.2, C.concreteLight);
  details.box(43, 2.8, -31.9, 16, 0.2, 1.6, C.blue);
  for (const x of [38, 48]) {
    details.box(x, 2.3, -39.7, 1.6, 1, 0.6, C.concreteLight);
    for (let k = 0; k < 4; k += 1) details.box(x - 0.6 + k * 0.4, 2.3, -40.05, 0.12, 0.8, 0.1, C.steel);
  }
  details.box(45, 0.8, -30.8, 3, 0.2, 1.4, C.wood);
  for (const x of [44, 46]) details.box(x, 0.4, -30.8, 0.2, 0.8, 1.2, C.steel);
  root.add(details.group({ name: "临时设施细节" }));
}

function addBuilding(root) {
  const b = new VoxelBuilder();
  const bx = SITE.building.x;
  const bz = SITE.building.z;
  b.box(bx, 0.2, bz, 30, 0.4, 22, C.concreteDark);
  const xs = [-26, -19, -12, -5, 2];
  const zs = [-20, -10, 0];
  for (let floor = 0; floor <= 5; floor += 1) {
    const slabY = 0.4 + floor * 3.4;
    // 顶层保留一块尚未浇筑的东南角，用木模板与钢筋表达施工状态。
    if (floor < 5) {
      b.box(bx, slabY, bz, 28, 0.4, 20, floor === 0 ? C.concreteDark : C.concrete);
    } else {
      b.box(-16, slabY, bz, 20, 0.4, 20, C.concreteLight);
      b.box(-2, slabY, -14, 8, 0.4, 12, C.concreteLight);
      b.box(-2, slabY - 0.4, -2, 8, 0.4, 4, C.wood);
      for (let x = -5.6; x <= 1.6; x += 0.8) b.box(x, slabY + 0.1, -2, 0.16, 0.16, 8, C.rebar);
      for (let z = -5.6; z <= 1.6; z += 0.8) b.box(-2, slabY + 0.12, z, 8, 0.16, 0.16, C.rebar);
    }
    if (floor === 5) continue;
    for (const x of xs) {
      for (const z of zs) {
        const shade = (x + z + floor) % 3 === 0 ? C.concreteLight : C.concrete;
        b.box(x, slabY + 1.9, z, 0.8, 3.4, 0.8, shade);
      }
    }
    for (const z of zs) b.box(bx, slabY + 3.25, z, 28, 0.5, 0.6, C.concreteDark);
    for (const x of xs) b.box(x, slabY + 3.25, bz, 0.6, 0.5, 20, C.concreteDark);
  }
  // 顶层钢筋柱、模板与少量已支设的梁模。
  for (const x of xs) {
    for (const z of zs) {
      const completed = !(x === 2 && z >= -10);
      if (completed) b.box(x, 19.1, z, 0.8, 3, 0.8, C.concreteLight);
      for (const dx of [-0.25, 0.25]) {
        for (const dz of [-0.25, 0.25]) b.box(x + dx, completed ? 21.2 : 19.8, z + dz, 0.14, completed ? 2.2 : 4.4, 0.14, C.rebar);
      }
      if (!completed) {
        b.box(x, 18.2, z, 1.2, 1.2, 1.2, C.wood);
        b.box(x, 18.85, z, 1.3, 0.12, 1.3, C.woodLight);
      }
    }
  }
  // 局部砌体：按皮错缝，保留窗洞和未完成的墙头。
  for (let floor = 1; floor <= 4; floor += 1) {
    const baseY = 0.6 + floor * 3.4;
    const rows = floor < 3 ? 4 : 2;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < 27; col += 1) {
        const x = -25.5 + col;
        if (x > -15 && x < -11 && row < 3) continue;
        b.box(x + (row % 2) * 0.4, baseY + row * 0.6, -19.65, 0.92, 0.52, 0.6, (col + row) % 4 === 0 ? 0xb39779 : 0xc1a588);
      }
      for (let col = 0; col < 18; col += 1) {
        if (col > 8 && col < 12 && row < 3) continue;
        b.box(-25.65, baseY + row * 0.6, -19.4 + col, 0.6, 0.52, 0.92, (col + row) % 3 === 0 ? 0xb69a7d : 0xc2a98d);
      }
    }
  }
  // 内部楼梯，每一步都有实体踏板并与楼层相接。
  for (let floor = 0; floor < 5; floor += 1) {
    for (let step = 0; step < 17; step += 1) {
      b.box(-23 + step * 0.4, 0.65 + floor * 3.4 + step * 0.2, -16.5, 0.45, 0.2, 2, C.concreteDark);
    }
    b.box(-16.5, 3.8 + floor * 3.4, -16.5, 1.8, 0.2, 2, C.concreteDark);
  }
  // 顶层材料与测量控制点。
  for (let i = 0; i < 6; i += 1) b.box(-20 + (i % 3) * 1.2, 17.9 + Math.floor(i / 3) * 0.6, -5, 1, 0.5, 0.8, 0xbb9d7e);
  b.box(-10, 17.8, -10, 4, 0.2, 3, C.concreteDark);
  b.box(-10, 17.95, -10, 3.4, 0.1, 2.4, C.wood);
  root.add(b.group({ name: "在建主楼" }));
}

function addScaffolding(root) {
  const s = new VoxelBuilder();
  const nets = new VoxelBuilder();
  const platforms = new VoxelBuilder();
  const levels = [0.6, 4, 7.4, 10.8, 14.2, 17.6, 19.4];
  const faces = [
    { axis: "x", fixed: 2.2, from: -28, to: 4, outward: 1 },
    { axis: "x", fixed: -22.2, from: -28, to: 4, outward: -1 },
    { axis: "z", fixed: -28.2, from: -22, to: 2, outward: -1 },
    { axis: "z", fixed: 4.2, from: -22, to: 2, outward: 1 },
  ];
  for (const face of faces) {
    const count = Math.round((face.to - face.from) / 4);
    for (let i = 0; i <= count; i += 1) {
      const v = face.from + (face.to - face.from) * (i / count);
      const x = face.axis === "x" ? v : face.fixed;
      const z = face.axis === "x" ? face.fixed : v;
      s.box(x, 9.6, z, 0.2, 19.2, 0.2, C.scaffold);
      const innerX = face.axis === "x" ? x : x - face.outward * 1.2;
      const innerZ = face.axis === "x" ? z - face.outward * 1.2 : z;
      s.box(innerX, 9.6, innerZ, 0.2, 19.2, 0.2, C.scaffold);
      for (const y of levels) {
        const a = face.axis === "x" ? { x, y, z } : { x, y, z };
        const b = { x: innerX, y, z: innerZ };
        s.beam(a, b, 0.16, C.scaffold);
      }
      if (i < count) {
        const next = face.from + (face.to - face.from) * ((i + 1) / count);
        for (let l = 0; l < levels.length - 1; l += 1) {
          const y0 = levels[l];
          const y1 = levels[l + 1];
          const a = face.axis === "x" ? { x: v, y: y0, z } : { x, y: y0, z: v };
          const b = face.axis === "x" ? { x: next, y: y1, z } : { x, y: y1, z: next };
          if ((i + l) % 2 === 0) s.beam(a, b, 0.14, C.scaffold);
        }
      }
    }
    for (const y of levels) {
      if (face.axis === "x") {
        s.box((face.from + face.to) / 2, y, face.fixed, face.to - face.from, 0.16, 0.16, C.scaffold);
        if (y > 1 && y < 19) platforms.box((face.from + face.to) / 2, y - 0.18, face.fixed - face.outward * 0.6, face.to - face.from, 0.2, 1.4, C.wood);
      } else {
        s.box(face.fixed, y, (face.from + face.to) / 2, 0.16, 0.16, face.to - face.from, C.scaffold);
        if (y > 1 && y < 19) platforms.box(face.fixed - face.outward * 0.6, y - 0.18, (face.from + face.to) / 2, 1.4, 0.2, face.to - face.from, C.wood);
      }
    }
  }
  // 防落网分段设置，留出可见结构带与东南侧吊装通道。
  for (const y of [5.8, 9.2, 12.6, 16]) {
    for (const x of [-24, -16, -8]) nets.box(x, y, 2.28, 7.4, 2.8, 0.12, C.net);
    for (const z of [-18, -10]) nets.box(4.28, y, z, 0.12, 2.8, 7.4, C.net);
    nets.box(-28.28, y, -15, 0.12, 2.8, 12, C.net);
  }
  const netMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 1, depthWrite: false, side: THREE.DoubleSide });
  root.add(s.group({ name: "脚手架杆件" }));
  root.add(platforms.group({ name: "脚手架作业层" }));
  root.add(nets.group({ name: "分段防落网", material: netMaterial, castShadow: false, receiveShadow: false }));

  // 南侧楼梯通道，连接各脚手架作业层。
  const stairs = new VoxelBuilder();
  for (let floor = 0; floor < 5; floor += 1) {
    for (let step = 0; step < 17; step += 1) {
      stairs.box(-26 + step * 0.4, 0.65 + floor * 3.4 + step * 0.2, 3.4, 0.45, 0.2, 1.2, C.woodLight);
    }
    stairs.beam({ x: -26, y: 1.6 + floor * 3.4, z: 4.1 }, { x: -19.6, y: 5 + floor * 3.4, z: 4.1 }, 0.14, C.scaffold);
  }
  root.add(stairs.group({ name: "脚手架楼梯" }));
}

function addYard(root, colliders) {
  const y = new VoxelBuilder();
  // 钢构件、模板、木方与砌块分区码放。
  for (let level = 0; level < 4; level += 1) {
    for (let i = 0; i < 4; i += 1) y.box(39, 0.45 + level * 0.45, 4 + i * 0.7, 8, 0.3, 0.3, level % 2 ? C.steelLight : C.steel);
  }
  for (let level = 0; level < 5; level += 1) {
    y.box(42, 0.35 + level * 0.35, 12, 6, 0.25, 1.8, level % 2 ? C.woodLight : C.wood);
  }
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      for (let level = 0; level < 3; level += 1) y.box(37 + col * 1.1, 0.45 + level * 0.55, 17 + row * 1.1, 1, 0.5, 1, 0xbda488);
    }
  }
  // 仓储集装箱与工具箱。
  y.box(46, 1.6, 4, 10, 3, 4, C.blue);
  y.box(46, 3.2, 4, 10.4, 0.2, 4.4, C.dark);
  for (let x = 41.5; x <= 50.5; x += 0.8) y.box(x, 1.6, 6.05, 0.12, 2.6, 0.12, 0x2e5e6d);
  y.box(43, 1.4, 6.2, 1.8, 2.4, 0.2, C.dark);
  y.box(21, 0.35, 17, 5, 0.5, 1.4, C.wood);
  y.box(21, 0.9, 17, 4.6, 0.5, 1.2, C.steel);
  // 锥桶、灭火器与小型料箱。
  for (const [x, z] of [[17, 18], [17, 8], [-32, 15], [-27, 15], [4, 10]]) {
    y.box(x, 0.15, z, 0.7, 0.3, 0.7, C.rubber);
    y.box(x, 0.55, z, 0.4, 0.6, 0.4, C.orange);
    y.box(x, 0.6, z, 0.45, 0.15, 0.45, C.white);
  }
  root.add(y.group({ name: "材料堆场" }));
  colliders.push({ minX: 40, maxX: 52, minZ: 1, maxZ: 19, label: "材料堆放" });
  colliders.push({ minX: 36, maxX: 44, minZ: 1, maxZ: 8, label: "钢材堆放" });
  const sign = createSign("材料堆场", "钢构 · 模板 · 砌块", 5.6, 1.7, { background: "#e5dfc9", band: "#d99b28" });
  sign.position.set(35, 2.2, 20.2);
  root.add(sign);
}

function addExcavation(root) {
  const e = new VoxelBuilder();
  // 阶梯状土堆与坑底石块。
  for (let level = 0; level < 4; level += 1) {
    e.box(-42, -0.65 + level * 0.45, -1.8, 4.4 - level * 0.85, 0.5, 3.6 - level * 0.65, level % 2 ? C.soil : C.sand);
  }
  for (let i = 0; i < 26; i += 1) {
    const x = -53 + (i * 37 % 80) / 10;
    const z = -20 + (i * 53 % 140) / 10;
    e.box(x, -0.65, z, 0.4 + (i % 3) * 0.2, 0.3, 0.4, i % 2 ? C.soilDark : C.soil);
  }
  // 临边警示栏，西侧留出挖掘机作业口。
  for (let z = -21; z <= -5; z += 4) {
    e.box(-43.4, 0.8, z, 0.18, 1.6, 0.18, C.yellow);
    e.box(-43.4, 1.2, z + 1.8, 0.16, 0.16, 3.6, C.yellow);
  }
  root.add(e.group({ name: "土方作业区" }));
}

function addPump(root) {
  const p = new VoxelBuilder();
  p.box(2.8, 0.8, 7, 3, 1.4, 4, C.red);
  p.box(2.8, 1.6, 7, 2, 0.4, 2, C.dark);
  for (const x of [1.8, 3.8]) for (const z of [5.5, 8.5]) p.box(x, 0.45, z, 0.5, 0.8, 0.8, C.rubber);
  p.beam({ x: 2.8, y: 1.8, z: 7 }, { x: 2.8, y: 8, z: 4 }, 0.5, C.red);
  p.beam({ x: 2.8, y: 8, z: 4 }, { x: -2, y: 15, z: 1 }, 0.45, C.red);
  p.beam({ x: -2, y: 15, z: 1 }, { x: -6, y: 18.6, z: -1 }, 0.35, C.dark);
  p.box(-6, 18.2, -1, 0.4, 1.2, 0.4, C.dark);
  root.add(p.group({ name: "混凝土泵送设备" }));
}

function addLandscape(root) {
  const l = new VoxelBuilder();
  const tree = (x, z, size = 1) => {
    l.box(x, 1.5 * size, z, 0.6 * size, 3 * size, 0.6 * size, C.wood);
    l.box(x, 3.6 * size, z, 3 * size, 2 * size, 3 * size, C.vegetation);
    l.box(x - 0.8 * size, 4.6 * size, z, 1.8 * size, 1.4 * size, 2 * size, C.vegetationLight);
    l.box(x + 0.9 * size, 3.8 * size, z + 0.5 * size, 1.6 * size, 1.6 * size, 2 * size, 0x536d50);
  };
  for (const [x, z, s] of [[-48, 36, 1], [-38, 37, 0.8], [-24, 37, 0.9], [28, 38, 0.8], [51, 38, 1], [53, -20, 0.9], [-61, -32, 1.2], [-63, 4, 1], [62, 20, 1.1]]) tree(x, z, s);
  // 周边环境保持低反差，不抢主楼与塔吊的轮廓。
  for (const [x, z, w, d, h] of [[-44, -57, 20, 14, 9], [-14, -59, 24, 12, 6], [25, -58, 18, 14, 12], [63, -18, 12, 20, 7]]) {
    l.box(x, h / 2 - 0.8, z, w, h, d, 0x777e77);
    l.box(x, h - 0.6, z, w + 0.5, 0.4, d + 0.5, 0x5f6965);
    for (let ix = -w / 2 + 2; ix < w / 2 - 1; ix += 3) {
      for (let iy = 2; iy < h - 1; iy += 2.4) l.box(x + ix, iy, z + d / 2 + 0.05, 1.2, 1, 0.12, 0x789092);
    }
  }
  // 场外人行道与排水边沟。
  l.box(0, -0.2, 46, 120, 0.4, 4, 0x99988a);
  for (let x = -54; x <= 54; x += 2) l.box(x, 0.04, 44.2, 1.6, 0.12, 0.4, C.concreteDark);
  root.add(l.group({ name: "周边城市与植被" }));
}

function addLighting(root) {
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffbd65, emissiveIntensity: 0.1, roughness: 0.35 });
  const warningMaterial = new THREE.MeshStandardMaterial({ color: 0xff6347, emissive: 0xff321c, emissiveIntensity: 0.4 });
  const poles = new VoxelBuilder();
  const nightLights = [];
  const locations = [[-41, 33], [38, 34], [38, -25], [-31, -26]];
  for (const [x, z] of locations) {
    poles.box(x, 0.25, z, 1.4, 0.5, 1.4, C.concreteDark);
    poles.box(x, 4.6, z, 0.25, 9, 0.25, C.steel);
    poles.box(x, 9, z, 2.8, 0.2, 0.25, C.steel);
    for (const dx of [-0.9, 0.9]) {
      const lamp = boxMesh(0.8, 0.5, 0.5, lampMaterial);
      lamp.position.set(x + dx, 8.8, z);
      lamp.rotation.x = -0.35;
      root.add(lamp);
    }
    const light = new THREE.SpotLight(0xffd4a0, 0, 74, Math.PI / 3.2, 0.55, 1.1);
    light.position.set(x, 8.7, z);
    light.target.position.set(x * 0.35, 0, z * 0.35);
    light.castShadow = false;
    root.add(light, light.target);
    nightLights.push(light);
  }
  // 门岗与办公区保留暖色照明。
  for (const [x, y, z, intensity] of [[8, 4, 39, 90], [42, 3.4, -31, 100], [19, 3.2, 34, 55]]) {
    const light = new THREE.PointLight(0xffc77d, 0, 24, 1.4);
    light.position.set(x, y, z);
    light.userData.nightIntensity = intensity;
    root.add(light);
    nightLights.push(light);
  }
  root.add(poles.group({ name: "工地照明灯杆" }));
  return { nightLights, lampMaterial, warningMaterial };
}

export function buildWorld(scene) {
  const root = new THREE.Group();
  root.name = "飞尘工地静态场景";
  const colliders = [];
  addGround(root, colliders);
  addFenceAndGate(root);
  const nightMaterials = [];
  addOffice(root, nightMaterials, colliders);
  addBuilding(root);
  addScaffolding(root);
  addYard(root, colliders);
  addExcavation(root);
  addPump(root);
  addLandscape(root);
  const lighting = addLighting(root);
  scene.add(root);
  colliders.push(
    { minX: -29.5, maxX: 5.5, minZ: -23.5, maxZ: 4.8, label: "主楼与脚手架" },
    { minX: 9, maxX: 15, minZ: -17, maxZ: -11, label: "塔吊基础" },
  );
  return {
    root,
    colliders,
    ...lighting,
    nightMaterials,
    focus: {
      overview: { position: [64, 48, 70], target: [-4, 9, -4] },
      crane: { position: [35, 23, 27], target: [3, 16, -7] },
      yard: { position: [43, 11, 29], target: [23, 2, 10] },
      roof: { position: [17, 30, 19], target: [-11, 17.5, -9] },
      transport: { position: [-48, 10, 28], target: [-32, 2, 8] },
      gate: { position: [8, 2.2, 48], target: [5, 4, 18] },
    },
  };
}

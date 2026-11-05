import * as THREE from "three";
import { PALETTE as C, SITE, lerp } from "../config.js";
import { VoxelBuilder, voxelGroup, boxMesh } from "./voxel.js";

// 少量动态部件仍按体素块实例化，避免每个方块产生一次 draw call。
function wheelGroup(x, y, z, width = 0.55) {
  const group = voxelGroup("车轮", (b) => {
    b.box(0, 0, 0, width, 1.05, 1.05, C.rubber);
    b.box(x > 0 ? width / 2 + 0.03 : -width / 2 - 0.03, 0, 0, 0.12, 0.5, 0.5, C.steelLight);
  });
  group.position.set(x, y, z);
  return group;
}

function createTruck() {
  const root = new THREE.Group();
  root.name = "材料运输平板车";
  const body = voxelGroup("底盘与车斗", (b) => {
    b.box(0, 0.75, -0.4, 2.5, 0.4, 7.8, C.dark);
    b.box(0, 1.15, -0.8, 2.7, 0.25, 5.8, C.wood);
    for (const x of [-1.35, 1.35]) {
      b.box(x, 1.5, -0.8, 0.16, 0.65, 5.8, C.orange);
      for (const z of [-3.4, -1.8, 0, 1.8]) b.box(x, 1.45, z, 0.2, 0.9, 0.2, C.steel);
    }
    b.box(0, 1.55, 2.65, 2.5, 2.1, 2.1, C.blue);
    b.box(0, 2.75, 2.45, 2.5, 0.35, 2.2, C.blue);
    b.box(0, 2.15, 3.73, 2.1, 0.85, 0.12, C.glass);
    for (const x of [-1.28, 1.28]) {
      b.box(x, 2.1, 2.7, 0.12, 0.85, 1.25, C.glass);
      b.box(x * 1.18, 2.15, 3.25, 0.25, 0.35, 0.35, C.dark);
    }
    b.box(0, 0.9, 3.82, 2.6, 0.35, 0.3, C.steelLight);
    b.box(0, 1.3, 3.78, 1.2, 0.5, 0.15, C.dark);
    for (const x of [-0.9, 0.9]) b.box(x, 1.25, 3.88, 0.45, 0.35, 0.12, C.white);
    b.box(0, 1.55, -3.75, 2.6, 0.7, 0.18, C.orange);
  });
  root.add(body);
  const wheels = [];
  for (const x of [-1.3, 1.3]) {
    for (const z of [-2.6, -1.25, 2.45]) {
      const wheel = wheelGroup(x, 0.65, z, 0.5);
      root.add(wheel);
      wheels.push(wheel);
    }
  }
  root.userData.wheels = wheels;
  return root;
}

function createForklift(name = "叉车") {
  const root = new THREE.Group();
  root.name = name;
  root.add(voxelGroup("叉车车体", (b) => {
    b.box(0, 0.65, -0.2, 1.7, 0.8, 2.5, C.orange);
    b.box(0, 1, -1.15, 1.8, 1.2, 0.7, C.orange);
    b.box(0, 1.35, -0.25, 0.8, 0.3, 0.8, C.dark);
    b.box(0, 1.75, -0.55, 0.2, 1.2, 0.2, C.dark);
    for (const x of [-0.75, 0.75]) {
      b.box(x, 2.05, -0.1, 0.16, 1.8, 0.16, C.dark);
      b.box(x, 2.05, -1.05, 0.16, 1.8, 0.16, C.dark);
    }
    b.box(0, 2.95, -0.55, 1.8, 0.2, 1.4, C.dark);
    for (const x of [-0.62, 0.62]) {
      b.box(x, 1.6, 1.15, 0.2, 3.1, 0.25, C.steel);
      b.box(x, 1.65, 1.35, 0.12, 2.7, 0.12, C.steelLight);
    }
    b.box(0.85, 1.15, -0.7, 0.2, 0.35, 0.35, C.yellowLight);
  }));
  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.95, 0.75]) root.add(wheelGroup(x, 0.5, z, 0.4));
  }
  const carriage = voxelGroup("升降叉齿", (b) => {
    b.box(0, 0, 1.3, 1.5, 0.3, 0.2, C.steel);
    for (const x of [-0.52, 0.52]) b.box(x, -0.08, 2.1, 0.18, 0.16, 2.2, C.steelLight);
  });
  root.add(carriage);
  root.userData.carriage = carriage;
  return root;
}

function createPallet(kind = "blocks") {
  return voxelGroup(`货物-${kind}`, (b) => {
    b.box(0, -0.28, 0, 1.6, 0.2, 1.4, C.wood);
    for (const x of [-0.6, 0, 0.6]) b.box(x, -0.4, 0, 0.2, 0.16, 1.4, C.woodDark || 0x745236);
    if (kind === "steel") {
      for (let level = 0; level < 2; level += 1) {
        for (const z of [-0.45, 0, 0.45]) b.box(0, -0.02 + level * 0.28, z, 3.2, 0.22, 0.22, level ? C.steelLight : C.steel);
      }
      for (const x of [-1, 1]) b.box(x, 0.18, 0, 0.12, 0.65, 1.25, C.yellow);
    } else {
      for (let level = 0; level < 2; level += 1) {
        for (const x of [-0.42, 0.42]) {
          for (const z of [-0.35, 0.35]) b.box(x, -0.02 + level * 0.36, z, 0.72, 0.3, 0.58, (level + (x > 0 ? 1 : 0)) % 2 ? 0xc0a789 : 0xb59b7d);
        }
      }
      b.box(0, 0.25, 0, 1.62, 0.08, 0.12, C.white);
    }
  });
}

function createTowerCrane() {
  const root = new THREE.Group();
  root.name = "塔式起重机";
  root.position.set(SITE.crane.x, 0, SITE.crane.z);
  const mast = new VoxelBuilder();
  mast.box(0, 0.5, 0, 4, 1, 4, C.concreteDark);
  mast.box(0, 1.15, 0, 2.8, 0.3, 2.8, C.yellow);
  for (let y = 1.4; y < 33; y += 2.8) {
    for (const x of [-0.85, 0.85]) for (const z of [-0.85, 0.85]) mast.box(x, y + 1.4, z, 0.24, 2.8, 0.24, C.yellow);
    for (const z of [-0.85, 0.85]) {
      mast.box(0, y, z, 1.8, 0.2, 0.2, C.yellowLight);
      mast.beam({ x: -0.85, y, z }, { x: 0.85, y: y + 2.8, z }, 0.16, C.yellow);
      mast.beam({ x: 0.85, y, z }, { x: -0.85, y: y + 2.8, z }, 0.16, C.yellow);
    }
    for (const x of [-0.85, 0.85]) {
      mast.box(x, y, 0, 0.2, 0.2, 1.8, C.yellowLight);
      mast.beam({ x, y, z: -0.85 }, { x, y: y + 2.8, z: 0.85 }, 0.16, C.yellow);
    }
  }
  root.add(mast.group({ name: "塔身格构" }));
  const upper = new THREE.Group();
  upper.name = "回转上部";
  upper.position.y = 33.4;
  upper.add(voxelGroup("起重臂与平衡臂", (b) => {
    b.box(0, 0, 0, 3.4, 0.6, 3, C.yellow);
    b.box(-0.6, 3.4, 0, 0.5, 6.4, 0.5, C.yellow);
    b.box(-0.6, 6.6, 0, 1, 0.3, 1, C.yellowLight);
    for (const z of [-0.65, 0.65]) {
      b.box(12, 0, z, 38, 0.22, 0.22, C.yellow);
      b.box(12, 1.6, z, 38, 0.18, 0.18, C.yellowLight);
      b.box(-5.5, 0, z, 10, 0.25, 0.25, C.yellow);
      for (let x = -6; x < 30; x += 3) {
        b.beam({ x, y: 0, z }, { x: x + 3, y: 1.6, z }, 0.14, C.yellow);
        b.beam({ x, y: 1.6, z }, { x: x + 3, y: 0, z }, 0.14, C.yellow);
      }
    }
    b.beam({ x: -0.6, y: 6.5, z: 0 }, { x: 29, y: 1.6, z: 0 }, 0.12, C.steel);
    b.beam({ x: -0.6, y: 6.5, z: 0 }, { x: -9.5, y: 0, z: 0 }, 0.12, C.steel);
    for (const x of [-8.5, -7, -5.5]) b.box(x, -0.7, 0, 1.2, 1.5, 2.4, C.concreteDark);
    b.box(1.4, -1, 1.25, 2.2, 2, 1.8, C.yellow);
    b.box(1.6, -0.8, 2.18, 1.6, 1.1, 0.12, C.glass);
    b.box(2.53, -0.8, 1.25, 0.12, 1.1, 1.4, C.glass);
    b.box(0, -0.4, 0, 1.4, 0.3, 1.4, C.steel);
  }));
  root.add(upper);
  const trolley = voxelGroup("起重小车", (b) => {
    b.box(0, 0, 0, 1.2, 0.5, 1.8, C.dark);
    b.box(0, -0.35, 0, 0.5, 0.3, 0.5, C.yellow);
  });
  root.add(trolley);
  const cable = boxMesh(0.12, 1, 0.12, new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.7 }));
  cable.name = "吊索";
  root.add(cable);
  const hook = voxelGroup("吊钩", (b) => {
    b.box(0, 0, 0, 0.65, 0.55, 0.65, C.yellow);
    b.box(0, -0.45, 0, 0.2, 0.45, 0.2, C.dark);
    b.box(0.2, -0.65, 0, 0.55, 0.2, 0.2, C.dark);
    b.box(0.42, -0.48, 0, 0.15, 0.35, 0.2, C.dark);
  });
  root.add(hook);
  const beacon = boxMesh(0.45, 0.45, 0.45, new THREE.MeshStandardMaterial({ color: 0xff6148, emissive: 0xff2f1b, emissiveIntensity: 1 }));
  beacon.position.set(-0.6, 40.2, 0);
  root.add(beacon);
  return { root, upper, trolley, cable, hook, beacon };
}

function createMixer() {
  const root = new THREE.Group();
  root.name = "混凝土搅拌车";
  root.add(voxelGroup("搅拌车底盘", (b) => {
    b.box(0, 0.8, 0, 2.6, 0.45, 7.6, C.dark);
    b.box(0, 1.7, 2.6, 2.5, 2.2, 2.2, C.white);
    b.box(0, 2.25, 3.73, 2.1, 0.9, 0.12, C.glass);
    b.box(0, 2.95, 2.6, 2.6, 0.25, 2.3, C.yellow);
    for (const x of [-1.27, 1.27]) b.box(x, 2.25, 2.7, 0.12, 0.9, 1.3, C.glass);
    b.box(0, 1.05, 3.85, 2.6, 0.35, 0.25, C.steelLight);
    b.box(0, 1.4, -3.5, 0.6, 0.4, 2.6, C.steel, -0.35, 0, 0);
    b.box(0, 0.9, -4.5, 1.2, 0.25, 1.2, C.steel);
  }));
  const drum = new THREE.Group();
  drum.name = "体素搅拌筒";
  drum.position.set(0, 2.25, -0.75);
  const segments = [
    [-1.65, 1.1, 1.1], [-1.15, 1.8, 1.8], [-0.55, 2.35, 2.35], [0.1, 2.6, 2.6], [0.75, 2.3, 2.3], [1.35, 1.65, 1.65],
  ];
  for (let i = 0; i < segments.length; i += 1) {
    const [z, w, h] = segments[i];
    drum.add(voxelGroup("搅拌筒节段", (b) => {
      b.box(0, 0, z, w, h, 0.65, i % 2 ? C.white : C.yellow);
      if (i > 1 && i < 5) b.box(0, h / 2 + 0.06, z, w * 0.65, 0.12, 0.68, C.orange);
    }));
  }
  root.add(drum);
  for (const x of [-1.3, 1.3]) for (const z of [-2.5, -1.1, 2.5]) root.add(wheelGroup(x, 0.65, z, 0.5));
  root.userData.drum = drum;
  return root;
}

function createExcavator() {
  const root = new THREE.Group();
  root.name = "履带挖掘机";
  root.position.set(-48, 0.12, -1);
  root.rotation.y = Math.PI;
  root.add(voxelGroup("履带底盘", (b) => {
    for (const x of [-1.35, 1.35]) {
      b.box(x, 0.55, 0, 0.85, 0.9, 4.4, C.rubber);
      for (let z = -1.8; z <= 1.8; z += 0.6) b.box(x, 0.55, z, 0.95, 0.65, 0.16, C.steel);
    }
    b.box(0, 0.95, 0, 3.2, 0.5, 3.6, C.dark);
    b.box(0, 1.25, 0, 1.4, 0.4, 1.4, C.steel);
  }));
  const upper = new THREE.Group();
  upper.position.y = 1.3;
  upper.add(voxelGroup("回转平台与驾驶室", (b) => {
    b.box(0, 0.55, -0.5, 3.2, 1.1, 3.8, C.yellow);
    b.box(-0.75, 1.65, 0.2, 1.5, 2.2, 2, C.yellow);
    b.box(-0.75, 1.9, 1.23, 1.25, 1.35, 0.12, C.glass);
    b.box(-1.53, 1.9, 0.2, 0.12, 1.35, 1.6, C.glass);
    b.box(0.85, 1, -1.5, 1.4, 1.3, 1.2, C.yellowLight);
    b.box(0.85, 1.6, -1.6, 0.6, 0.2, 0.6, C.dark);
  }));
  const boom = new THREE.Group();
  boom.position.set(0.65, 0.9, 0.8);
  boom.add(voxelGroup("动臂", (b) => {
    b.box(0, 0, 1.8, 0.65, 0.75, 3.6, C.yellow);
    b.box(0, 0.45, 1.4, 0.2, 0.2, 2.6, C.steelLight);
  }));
  const stick = new THREE.Group();
  stick.position.z = 3.5;
  stick.add(voxelGroup("斗杆", (b) => {
    b.box(0, 0, 1.3, 0.5, 0.55, 2.6, C.yellowLight);
    b.box(0, 0.35, 1, 0.16, 0.16, 2, C.steelLight);
  }));
  const bucket = new THREE.Group();
  bucket.position.z = 2.55;
  bucket.add(voxelGroup("铲斗", (b) => {
    b.box(0, -0.25, 0.35, 1.5, 0.35, 1.1, C.steel);
    b.box(0, 0.1, 0, 1.5, 0.75, 0.3, C.steel);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) b.box(x, -0.4, 0.95, 0.18, 0.18, 0.45, C.steelLight);
  }));
  const dirt = voxelGroup("斗内土料", (b) => {
    b.box(0, 0, 0.45, 1.25, 0.45, 0.8, C.sand);
  });
  dirt.position.y = 0.1;
  bucket.add(dirt);
  stick.add(bucket);
  boom.add(stick);
  upper.add(boom);
  root.add(upper);
  return { root, upper, boom, stick, bucket, dirt };
}

function createHoist() {
  const root = new THREE.Group();
  root.name = "施工升降机";
  const mast = new VoxelBuilder();
  for (const z of [-11, -9]) {
    mast.box(4.9, 10.8, z, 0.35, 21.6, 0.35, C.steelLight);
    for (let y = 0.6; y < 21; y += 1.6) {
      mast.box(4.9, y, z, 0.8, 0.16, 0.8, C.steel);
      mast.beam({ x: 4.9, y, z }, { x: 3.2, y: y + 0.8, z }, 0.12, C.steel);
    }
  }
  for (let y = 1; y < 21; y += 1.6) mast.beam({ x: 4.9, y, z: -11 }, { x: 4.9, y: y + 1.6, z: -9 }, 0.12, C.steelLight);
  root.add(mast.group({ name: "升降机导轨架" }));
  const cage = new THREE.Group();
  cage.name = "升降吊笼";
  cage.position.set(6.1, 0.12, -10);
  cage.add(voxelGroup("吊笼", (b) => {
    b.box(0, 0, 0, 2.4, 0.25, 2.4, C.steel);
    b.box(0, 2.4, 0, 2.4, 0.25, 2.4, C.yellow);
    for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) b.box(x, 1.2, z, 0.16, 2.4, 0.16, C.yellow);
    for (const x of [-1.1, 1.1]) b.box(x, 1.2, 0, 0.12, 2, 2.2, C.steelLight);
    b.box(0, 1.2, -1.1, 2.2, 2, 0.12, C.steelLight);
    b.box(0, 0.65, 1.1, 2.2, 1, 0.12, C.yellow);
  }));
  root.add(cage);
  return { root, cage };
}

export function createMachines(scene) {
  const tower = createTowerCrane();
  const truck = createTruck();
  const mixer = createMixer();
  const excavator = createExcavator();
  const hoist = createHoist();
  const eastForklift = createForklift("东堆场叉车");
  const westForklift = createForklift("西卸货区叉车");
  const restocker = createForklift("塔吊补料叉车");
  const currentSteel = createPallet("steel");
  const nextSteel = createPallet("steel");
  const pallets = Array.from({ length: 3 }, () => createPallet("blocks"));
  const reserve = Array.from({ length: 3 }, () => createPallet("blocks"));
  scene.add(tower.root, truck, mixer, excavator.root, hoist.root, eastForklift, westForklift, restocker, currentSteel, nextSteel, ...pallets, ...reserve);

  function placeVehicle(object, state) {
    object.position.set(state.x, state.y ?? 0.12, state.z);
    object.rotation.y = state.yaw || 0;
  }

  function placeForklift(object, state) {
    placeVehicle(object, state);
    object.userData.carriage.position.y = state.lift ?? 0.25;
  }

  function placeCargo(object, state) {
    object.visible = state.visible && state.scale !== 0;
    object.position.set(state.position.x, state.position.y, state.position.z);
    const s = state.scale ?? 1;
    object.scale.setScalar(Math.max(0.001, s));
  }

  function update(ops, time, dt = 0) {
    const c = ops.crane;
    tower.upper.rotation.y = -c.angle;
    tower.trolley.position.set(Math.cos(c.angle) * c.radius, 33, -Math.sin(c.angle) * c.radius);
    // 小车与吊索直接放在塔吊根坐标中，避免回转时产生二次旋转。
    const top = { x: Math.cos(c.angle) * c.radius, y: 33, z: Math.sin(c.angle) * c.radius };
    tower.trolley.position.set(top.x, top.y, top.z);
    const length = Math.max(0.2, top.y - c.hookY);
    tower.cable.position.set(top.x, c.hookY + length / 2, top.z);
    tower.cable.scale.set(0.12, length, 0.12);
    tower.hook.position.set(top.x, c.hookY, top.z);
    tower.beacon.material.emissiveIntensity = 0.5 + (Math.sin(time * 0.012) > 0.2 ? 2 : 0.1);
    placeCargo(currentSteel, c.current);
    placeCargo(nextSteel, c.next);
    placeForklift(restocker, c.restocker);

    placeVehicle(truck, ops.transport.truck);
    if (ops.transport.truck.moving && dt > 0) for (const wheel of truck.userData.wheels) wheel.rotation.x -= dt * 6;
    placeForklift(eastForklift, ops.transport.eastForklift);
    placeForklift(westForklift, ops.transport.westForklift);
    ops.transport.pallets.forEach((state, i) => placeCargo(pallets[i], state));
    ops.transport.reserve.forEach((state, i) => placeCargo(reserve[i], state));

    placeVehicle(mixer, ops.mixer);
    mixer.userData.drum.rotation.z = ops.mixer.drum;

    const e = ops.excavator;
    excavator.upper.rotation.y = e.swing;
    excavator.boom.rotation.x = e.boom;
    excavator.stick.rotation.x = e.stick;
    excavator.bucket.rotation.x = e.bucket;
    excavator.dirt.visible = e.load > 0.03;
    excavator.dirt.scale.set(1, Math.max(0.05, e.load), 1);

    hoist.cage.position.y = ops.hoist.cageY;
  }

  return { tower, truck, mixer, excavator, hoist, eastForklift, westForklift, restocker, update };
}

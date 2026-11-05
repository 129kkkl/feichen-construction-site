import * as THREE from "three";
import { PALETTE as C, SCHEDULE, SITE, clamp01, lerp, mod, smooth } from "../config.js";
import { voxelGroup, boxMesh } from "./voxel.js";
import { lerpPoint, samplePath, yawFor } from "../simulation/operations.js";

function createWorker(name, helmet = C.yellow) {
  const root = new THREE.Group();
  root.name = name;
  const torso = voxelGroup("安全背心", (b) => {
    b.box(0, 1.15, 0, 0.62, 0.65, 0.36, C.vest);
    b.box(0, 1.18, 0.2, 0.64, 0.12, 0.06, C.white);
    for (const x of [-0.2, 0.2]) b.box(x, 1.32, 0.2, 0.08, 0.35, 0.06, C.white);
    b.box(0, 1.68, 0, 0.42, 0.42, 0.4, C.skin);
    b.box(0, 1.94, 0, 0.58, 0.18, 0.55, helmet);
    b.box(0, 1.83, 0.1, 0.65, 0.1, 0.65, helmet);
    b.box(0, 1.66, 0.22, 0.12, 0.12, 0.08, C.skin);
  });
  root.add(torso);
  const leftLeg = voxelGroup("左腿", (b) => {
    b.box(0, -0.36, 0, 0.24, 0.72, 0.28, C.blue);
    b.box(0, -0.74, 0.09, 0.28, 0.18, 0.45, C.rubber);
  });
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.18, 0.85, 0);
  rightLeg.position.set(0.18, 0.85, 0);
  const leftArm = voxelGroup("左臂", (b) => {
    b.box(0, -0.28, 0, 0.2, 0.56, 0.24, C.vest);
    b.box(0, -0.62, 0, 0.18, 0.2, 0.2, C.skin);
  });
  const rightArm = leftArm.clone();
  leftArm.position.set(-0.43, 1.46, 0);
  rightArm.position.set(0.43, 1.46, 0);
  const carry = voxelGroup("手持小料", (b) => {
    b.box(0, 0, 0, 0.8, 0.35, 0.45, C.woodLight);
    b.box(0, 0.2, 0, 0.65, 0.12, 0.35, C.steel);
  });
  carry.position.set(0, 1, 0.55);
  carry.visible = false;
  root.add(leftLeg, rightLeg, leftArm, rightArm, carry);
  root.userData = { leftLeg, rightLeg, leftArm, rightArm, carry };
  root.scale.setScalar(0.92);
  return root;
}

const EXIT_COMMON = [{ x: 8, y: 0.12, z: 30 }, { x: 8, y: 0.12, z: 38.5 }, { x: 10, y: 0.12, z: 40 }];
const definitions = [
  {
    id: "signal", name: "吊装信号工", helmet: C.orange, base: { x: 15, y: 0.12, z: 2 },
    exit: [{ x: 17, y: 0.12, z: 12 }, { x: 16, y: 0.12, z: 24 }, ...EXIT_COMMON], delay: 1050,
  },
  {
    id: "roofA", name: "楼层钢筋工", helmet: C.yellow, base: { x: -10, y: 17.6, z: -7 }, roof: true,
    exit: [], delay: 1500,
  },
  {
    id: "roofB", name: "楼层模板工", helmet: C.yellow, base: { x: -6, y: 17.6, z: -13 }, roof: true,
    exit: [], delay: 1500,
  },
  {
    id: "mason", name: "材料转运工", helmet: C.yellow, base: { x: -28, y: 0.12, z: 1 },
    exit: [{ x: -29, y: 0.12, z: 17 }, { x: -25, y: 0.12, z: 26 }, { x: 0, y: 0.12, z: 26 }, ...EXIT_COMMON], delay: 250,
  },
  {
    id: "pump", name: "混凝土工", helmet: C.white, base: { x: 0, y: 0.12, z: 5 },
    exit: [{ x: 10, y: 0.12, z: 10 }, { x: 12, y: 0.12, z: 25 }, ...EXIT_COMMON], delay: 450,
  },
  {
    id: "east", name: "堆场理料工", helmet: C.yellow, base: { x: 20, y: 0.12, z: 15 },
    exit: [{ x: 17, y: 0.12, z: 20 }, { x: 15, y: 0.12, z: 26 }, ...EXIT_COMMON], delay: 100,
  },
  {
    id: "west", name: "卸货引导员", helmet: C.orange, base: { x: -31, y: 0.12, z: 14 },
    exit: [{ x: -29, y: 0.12, z: 20 }, { x: -24, y: 0.12, z: 26 }, { x: 0, y: 0.12, z: 26 }, ...EXIT_COMMON], delay: 600,
  },
  {
    id: "earth", name: "土方安全员", helmet: C.white, base: { x: -42, y: 0.12, z: 1 },
    exit: [{ x: -41, y: 0.12, z: 18 }, { x: -32, y: 0.12, z: 26 }, { x: 0, y: 0.12, z: 26 }, ...EXIT_COMMON], delay: 50,
  },
];

function routeToGate(def, start) {
  return [start, ...def.exit];
}

function walkingPath(points, progress) {
  const p = samplePath(points, progress);
  return { position: p, yaw: p.yaw, walking: true, working: false, carrying: false };
}

function jobState(def, time, index) {
  const phase = mod((time - SCHEDULE.WORK_START) * (0.09 + index * 0.006), 2);
  const f = phase < 1 ? phase : 2 - phase;
  const forward = phase < 1;
  const base = def.base;
  if (def.id === "roofA" || def.id === "roofB") {
    const target = def.id === "roofA" ? { x: -5, y: 17.6, z: -7 } : { x: -2, y: 17.6, z: -13 };
    const pos = lerpPoint(base, target, smooth(f));
    return { position: pos, yaw: yawFor(target.x - base.x, target.z - base.z) + (forward ? 0 : Math.PI), walking: true, working: f > 0.85, carrying: forward, };
  }
  if (def.id === "mason") {
    const target = { x: -27, y: 0.12, z: -3.2 };
    const pos = lerpPoint(base, target, smooth(f));
    return { position: pos, yaw: yawFor(target.x - base.x, target.z - base.z) + (forward ? 0 : Math.PI), walking: true, working: false, carrying: forward };
  }
  if (def.id === "pump") {
    const target = { x: -5, y: 0.12, z: 3.4 };
    const pos = lerpPoint(base, target, smooth(f));
    return { position: pos, yaw: yawFor(target.x - base.x, target.z - base.z), walking: f > 0.1 && f < 0.9, working: f >= 0.9, carrying: false };
  }
  if (def.id === "east") {
    const target = { x: 31, y: 0.12, z: 15 };
    const pos = lerpPoint(base, target, smooth(f));
    return { position: pos, yaw: forward ? Math.PI / 2 : -Math.PI / 2, walking: true, working: false, carrying: forward };
  }
  if (def.id === "west") {
    const target = { x: -31, y: 0.12, z: 5 };
    const pos = lerpPoint(base, target, smooth(f));
    return { position: pos, yaw: forward ? Math.PI : 0, walking: true, working: false, carrying: false };
  }
  if (def.id === "earth") {
    return { position: base, yaw: Math.PI, walking: false, working: true, carrying: false };
  }
  return { position: base, yaw: -2.2, walking: false, working: true, carrying: false, signal: true };
}

function cagePoint(index, y) {
  return { x: 6.1 + (index - 1.5) * 0.55, y, z: -10 };
}

function roofExitState(def, time, index, ops) {
  const elapsed = time - SCHEDULE.WORK_END;
  const start = jobState(def, SCHEDULE.WORK_END, index).position;
  const landing = { x: 2.8, y: 17.6, z: -10 };
  const cageTop = cagePoint(index, 17.8);
  if (elapsed < 600) return walkingPath([start, { x: -5, y: 17.6, z: -10 }, landing], elapsed / 600);
  if (elapsed < 900) return walkingPath([landing, { x: 4.2, y: 17.7, z: -10 }, cageTop], (elapsed - 600) / 300);
  if (elapsed < 1500) {
    return { position: cagePoint(index, ops.hoist.cageY), yaw: Math.PI / 2, walking: false, working: false, carrying: false };
  }
  const ground = cagePoint(index, 0.12);
  const route = [ground, { x: 9, y: 0.12, z: 2 }, { x: 11, y: 0.12, z: 20 }, ...EXIT_COMMON];
  const f = clamp01((elapsed - 1500) / 850);
  return { ...walkingPath(route, f), visible: f < 0.995 };
}

function roofPrepState(def, time, index, ops) {
  const elapsed = time - SCHEDULE.PREP_START;
  const ground = cagePoint(index, 0.12);
  if (elapsed < 1200) {
    const route = [...EXIT_COMMON].reverse().concat([{ x: 11, y: 0.12, z: 20 }, { x: 9, y: 0.12, z: 2 }, ground]);
    return walkingPath(route, clamp01((elapsed - index * 90) / 1000));
  }
  if (elapsed < 1800) return { position: ground, yaw: -Math.PI / 2, walking: false, working: false, carrying: false };
  if (elapsed < 2400) return { position: cagePoint(index, ops.hoist.cageY), yaw: -Math.PI / 2, walking: false, working: false, carrying: false };
  const landing = { x: 2.8, y: 17.6, z: -10 };
  const cageTop = cagePoint(index, 17.8);
  const f = clamp01((elapsed - 2400) / 1000);
  return walkingPath([cageTop, { x: 4.2, y: 17.7, z: -10 }, landing, { x: -5, y: 17.6, z: -10 }, def.base], f);
}

export function createWorkers(scene) {
  const workers = definitions.map((def, index) => {
    const object = createWorker(def.name, def.helmet);
    scene.add(object);
    return { def, object, index };
  });
  const guard = createWorker("门岗值守", C.white);
  scene.add(guard);

  function applyPose(worker, state, time) {
    const { object, index } = worker;
    object.visible = state.visible !== false;
    object.position.set(state.position.x, state.position.y, state.position.z);
    object.rotation.y = state.yaw || 0;
    const { leftLeg, rightLeg, leftArm, rightArm, carry } = object.userData;
    const gait = state.walking ? Math.sin(time * 7 + index) * 0.55 : 0;
    leftLeg.rotation.x = gait;
    rightLeg.rotation.x = -gait;
    leftArm.rotation.x = -gait * 0.65;
    rightArm.rotation.x = gait * 0.65;
    leftArm.rotation.z = 0;
    rightArm.rotation.z = 0;
    if (state.working) {
      rightArm.rotation.x = -1.1 + Math.sin(time * 5 + index) * 0.45;
      leftArm.rotation.x = -0.55;
    }
    if (state.signal) {
      rightArm.rotation.z = -2.5 + Math.sin(time * 2.5) * 0.25;
      leftArm.rotation.z = 2.1;
    }
    if (state.carrying) {
      leftArm.rotation.x = -1.15;
      rightArm.rotation.x = -1.15;
    }
    carry.visible = Boolean(state.carrying);
  }

  function update(time, ops) {
    for (const worker of workers) {
      const { def, index } = worker;
      let state;
      if (time < SCHEDULE.PREP_START || time >= SCHEDULE.CLOSE_END) {
        state = { ...jobState(def, time, index), visible: false };
      } else if (time < SCHEDULE.WORK_START) {
        if (def.roof) state = roofPrepState(def, time, index, ops);
        else {
          const route = routeToGate(def, def.base).reverse();
          const f = clamp01((time - SCHEDULE.PREP_START - index * 100) / 2400);
          state = walkingPath(route, f);
          if (f <= 0) state = { position: route[0], visible: false, yaw: 0, walking: false, carrying: false };
        }
      } else if (time < SCHEDULE.WORK_END) {
        state = jobState(def, time, index);
      } else if (def.roof) {
        state = roofExitState(def, time, index, ops);
      } else if (time < SCHEDULE.WORK_END + def.delay) {
        // 等待各自离场时间的工人继续收尾，而不是在 17:30 突然消失。
        state = jobState(def, time, index);
      } else {
        const start = jobState(def, SCHEDULE.WORK_END + def.delay, index).position;
        const route = routeToGate(def, start);
        const f = clamp01((time - SCHEDULE.WORK_END - def.delay) / 900);
        state = walkingPath(route, f);
        state.visible = f < 0.995;
      }
      applyPose(worker, state, time);
    }
    const guardPhase = mod(time * 0.04, 2);
    const guardF = guardPhase < 1 ? guardPhase : 2 - guardPhase;
    const guardState = {
      position: { x: lerp(10.5, 13, guardF), y: 0.12, z: 38.2 },
      yaw: guardPhase < 1 ? Math.PI / 2 : -Math.PI / 2,
      walking: true,
      working: false,
      carrying: false,
    };
    applyPose({ object: guard, index: 9 }, guardState, time);
  }

  return { workers, guard, update };
}

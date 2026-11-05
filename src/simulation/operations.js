import { DAY_SECONDS, SCHEDULE, SITE, clamp01, lerp, mod, normalizeTime, smooth } from "../config.js";

const CRANE_CYCLE = 96;
const TRANSPORT_CYCLE = 240;
const TRUCK_SLOTS = [{ x: 0, z: -2.2 }, { x: 0, z: -0.6 }, { x: 0, z: 1 }];

export function point(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y ?? 0, b.y ?? 0, t), z: lerp(a.z, b.z, t) };
}

export function lerpAngle(a, b, t) {
  let delta = mod(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + delta * t;
}

export function yawFor(dx, dz) {
  return Math.atan2(dx, dz);
}

export function localToWorld(origin, yaw, local) {
  return {
    x: origin.x + Math.cos(yaw) * local.x + Math.sin(yaw) * local.z,
    y: local.y ?? origin.y ?? 0,
    z: origin.z - Math.sin(yaw) * local.x + Math.cos(yaw) * local.z,
  };
}

function samplePathRaw(points, progress) {
  const t = clamp01(progress);
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    lengths.push(length);
    total += length;
  }
  let distance = total * t;
  for (let i = 0; i < lengths.length; i += 1) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : clamp01(distance / lengths[i]);
      const a = points[i];
      const b = points[i + 1];
      return {
        ...lerpPoint(a, b, f),
        yaw: yawFor(b.x - a.x, b.z - a.z),
        segment: i,
      };
    }
    distance -= lengths[i];
  }
  return { ...points[points.length - 1], yaw: 0, segment: 0 };
}

export function samplePath(points, progress) {
  const t = clamp01(progress);
  const raw = samplePathRaw(points, t);
  // 用前后一小段路径的切线平滑朝向，避免车厢与车载货物在折点突然旋转。
  const span = 0.018;
  const before = samplePathRaw(points, Math.max(0, t - span));
  const after = samplePathRaw(points, Math.min(1, t + span));
  return { ...raw, yaw: yawFor(after.x - before.x, after.z - before.z) };
}

export function getPeriod(time) {
  const t = normalizeTime(time);
  if (t < SCHEDULE.PREP_START) return "night";
  if (t < SCHEDULE.WORK_START) return "prep";
  if (t < SCHEDULE.WORK_END) return "work";
  if (t < SCHEDULE.CLOSE_END) return "closing";
  return "night";
}

export function getPeriodLabel(time) {
  return { night: "夜间值守", prep: "进场准备", work: "正常施工", closing: "收工撤离" }[getPeriod(time)];
}

function safeCycle(time, duration, startDelay = 0) {
  const t = normalizeTime(time);
  if (t < SCHEDULE.WORK_START || t >= SCHEDULE.WORK_END) return null;
  const elapsed = t - SCHEDULE.WORK_START - startDelay;
  if (elapsed < 0) return null;
  const index = Math.floor(elapsed / duration);
  const start = index * duration + startDelay;
  const end = start + duration;
  if (end > SCHEDULE.WORK_END - SCHEDULE.WORK_START) return null;
  return { local: mod(elapsed, duration), index, start, end };
}

function craneAngles() {
  const c = SITE.crane;
  return {
    sourceAngle: Math.atan2(c.source.z - c.z, c.source.x - c.x),
    targetAngle: Math.atan2(c.target.z - c.z, c.target.x - c.x),
    sourceRadius: Math.hypot(c.source.x - c.x, c.source.z - c.z),
    targetRadius: Math.hypot(c.target.x - c.x, c.target.z - c.z),
  };
}

function craneIdle(time) {
  const { sourceAngle, sourceRadius } = craneAngles();
  const close = smooth((normalizeTime(time) - SCHEDULE.WORK_END) / 1800);
  return {
    angle: sourceAngle + 0.55 * close,
    radius: sourceRadius,
    hookY: 29.5,
    cableTopY: SITE.crane.height - 0.6,
    moving: false,
    status: getPeriod(time) === "prep" ? "塔吊检查 · 等待开工" : "塔吊待机 · 吊钩已收高",
    current: { visible: true, position: point(SITE.crane.source.x, 0.8, SITE.crane.source.z), scale: 1, attached: false },
    next: { visible: true, position: point(23, 0.8, 2), scale: 1, attached: false },
    restocker: { x: 24, z: 3, y: 0.12, yaw: Math.PI, lift: 0.25, moving: false },
  };
}

export function sampleCrane(time) {
  const cycle = safeCycle(time, CRANE_CYCLE);
  if (!cycle) return craneIdle(time);
  const t = cycle.local;
  const { sourceAngle, targetAngle, sourceRadius, targetRadius } = craneAngles();
  let angle = sourceAngle;
  let radius = sourceRadius;
  let hookY = 29.5;
  let status = "塔吊就位 · 等待挂接";
  if (t < 8) {
    hookY = lerp(29.5, 1.8, smooth(t / 8));
    status = "吊钩下降 · 对准钢构件";
  } else if (t < 12) {
    hookY = 1.8;
    status = "挂接确认 · 信号工指挥";
  } else if (t < 24) {
    hookY = lerp(1.8, 29.5, smooth((t - 12) / 12));
    status = "钢构件起吊 · 离开堆场";
  } else if (t < 46) {
    const f = smooth((t - 24) / 22);
    angle = lerpAngle(sourceAngle, targetAngle, f);
    radius = lerp(sourceRadius, targetRadius, f);
    status = "回转转运 · 货物随吊钩移动";
  } else if (t < 60) {
    angle = targetAngle;
    radius = targetRadius;
    hookY = lerp(29.5, 19, smooth((t - 46) / 14));
    status = "就位下放 · 顶层作业面";
  } else if (t < 64) {
    angle = targetAngle;
    radius = targetRadius;
    hookY = 19;
    status = "卸钩 · 楼层工人接手";
  } else if (t < 74) {
    angle = targetAngle;
    radius = targetRadius;
    hookY = lerp(19, 29.5, smooth((t - 64) / 10));
    status = "空钩提升 · 构件安装";
  } else if (t < 90) {
    const f = smooth((t - 74) / 16);
    angle = lerpAngle(targetAngle, sourceAngle, f);
    radius = lerp(targetRadius, sourceRadius, f);
    status = "空钩返回 · 地面补料";
  } else {
    status = "本轮吊装完成 · 准备下一轮";
  }

  const horizontal = {
    x: SITE.crane.x + Math.cos(angle) * radius,
    z: SITE.crane.z + Math.sin(angle) * radius,
  };
  let current;
  if (t < 8) {
    current = { visible: true, position: point(SITE.crane.source.x, 0.8, SITE.crane.source.z), scale: 1, attached: false };
  } else if (t < 60) {
    current = { visible: true, position: point(horizontal.x, hookY - 1, horizontal.z), scale: 1, attached: true };
  } else {
    const install = smooth((t - 88) / 8);
    current = {
      visible: t < 96,
      position: point(SITE.crane.target.x, 18 - install * 0.2, SITE.crane.target.z),
      scale: 1 - install,
      attached: false,
    };
  }

  let next = { visible: true, position: point(23, 0.8, 2), scale: 1, attached: false };
  let restocker = { x: 24, z: 3, y: 0.12, yaw: Math.PI, lift: 0.25, moving: false };
  if (t >= 74 && t < 92) {
    const f = (t - 74) / 18;
    const source = point(23, 0.8, 2);
    const target = point(SITE.crane.source.x, 0.8, SITE.crane.source.z);
    const task = sampleForkliftTask(f, source, target, point(23, 0, 4.4), point(18, 0, 2.4), point(24, 0, 3), 0.8, 0.8);
    next = { visible: true, position: task.cargo, scale: 1, attached: task.attached };
    restocker = task.forklift;
  } else if (t >= 92) {
    next = { visible: true, position: point(SITE.crane.source.x, 0.8, SITE.crane.source.z), scale: 1, attached: false };
  }

  return {
    angle,
    radius,
    hookY,
    cableTopY: SITE.crane.height - 0.6,
    moving: t < 90,
    status,
    current,
    next,
    restocker,
  };
}

const OUTBOUND = [
  point(28, 0.12, 25), point(20, 0.12, 25), point(-27, 0.12, 26),
  point(-33, 0.12, 24), point(-36, 0.12, 19), point(-36, 0.12, 10),
];
const RETURN = [
  point(-36, 0.12, 10), point(-36, 0.12, -21), point(-33, 0.12, -27),
  point(-27, 0.12, -30), point(25, 0.12, -30), point(31, 0.12, -27),
  point(32, 0.12, -21), point(32, 0.12, 18), point(32, 0.12, 25), point(28, 0.12, 25),
];

function truckAt(local) {
  if (local < 60) return { ...point(28, 0.12, 25), yaw: -Math.PI / 2, moving: false };
  if (local < 95) {
    const path = samplePath(OUTBOUND, (local - 60) / 35);
    return { ...path, moving: true };
  }
  if (local < 155) return { ...point(-36, 0.12, 10), yaw: Math.PI, moving: false };
  if (local < 220) {
    const path = samplePath(RETURN, (local - 155) / 65);
    return { ...path, moving: true };
  }
  return { ...point(28, 0.12, 25), yaw: -Math.PI / 2, moving: false };
}

function sampleForkliftTask(progress, source, target, sourceApproach, targetApproach, idle, sourceY = 0.6, targetY = sourceY) {
  const p = clamp01(progress);
  const sourceGround = point(source.x, 0.12, source.z);
  const targetGround = point(target.x, 0.12, target.z);
  const sourceYaw = yawFor(sourceGround.x - sourceApproach.x, sourceGround.z - sourceApproach.z);
  const targetYaw = yawFor(targetGround.x - targetApproach.x, targetGround.z - targetApproach.z);
  const sourceLift = Math.max(0.15, sourceY - 0.35);
  const targetLift = Math.max(0.15, targetY - 0.35);
  let forklift = { ...idle, y: 0.12, yaw: sourceYaw, lift: sourceLift, moving: false };
  let cargo = point(source.x, sourceY, source.z);
  let attached = false;

  if (p < 0.2) {
    const f = smooth(p / 0.2);
    const pos = lerpPoint(idle, sourceApproach, f);
    forklift = { ...pos, y: 0.12, yaw: yawFor(sourceApproach.x - idle.x, sourceApproach.z - idle.z), lift: sourceLift, moving: true };
  } else if (p < 0.3) {
    const f = smooth((p - 0.2) / 0.1);
    attached = true;
    cargo = point(source.x, lerp(sourceY, 1.4, f), source.z);
    forklift = { ...sourceApproach, y: 0.12, yaw: sourceYaw, lift: lerp(sourceLift, 1.05, f), moving: false };
  } else if (p < 0.68) {
    const f = smooth((p - 0.3) / 0.38);
    const yaw = lerpAngle(sourceYaw, targetYaw, f);
    const horizontal = lerpPoint(sourceGround, targetGround, f);
    cargo = point(horizontal.x, 1.4, horizontal.z);
    forklift = {
      x: cargo.x - Math.sin(yaw) * 2.4,
      y: 0.12,
      z: cargo.z - Math.cos(yaw) * 2.4,
      yaw,
      lift: 1.05,
      moving: true,
    };
    attached = true;
  } else if (p < 0.82) {
    const f = smooth((p - 0.68) / 0.14);
    cargo = point(target.x, lerp(1.4, targetY, f), target.z);
    forklift = { ...targetApproach, y: 0.12, yaw: targetYaw, lift: lerp(1.05, targetLift, f), moving: false };
    attached = true;
  } else {
    const f = smooth((p - 0.82) / 0.18);
    const pos = lerpPoint(targetApproach, idle, f);
    cargo = point(target.x, targetY, target.z);
    forklift = { ...pos, y: 0.12, yaw: targetYaw, lift: targetLift, moving: true };
  }
  return { forklift, cargo, attached };
}

function transportStatus(local) {
  if (local < 60) return "东堆场装车 · 叉车逐件搬运";
  if (local < 95) return "材料运输 · 沿西侧通道行驶";
  if (local < 155) return "西侧卸货 · 送往主楼入口";
  if (local < 220) return "空车返程 · 地面补充托盘";
  return "本轮运输完成 · 清点物料";
}

export function sampleTransport(time) {
  const cycle = safeCycle(time, TRANSPORT_CYCLE);
  if (!cycle) {
    return {
      active: false,
      status: getPeriod(time) === "prep" ? "运输车辆检查 · 等待发车" : "运输车辆停放 · 物料已入库",
      truck: { ...point(28, 0.12, 25), yaw: -Math.PI / 2, moving: false },
      eastForklift: { ...point(26, 0.12, 17), yaw: Math.PI, lift: 0.25, moving: false },
      westForklift: { ...point(-31, 0.12, 13), yaw: -Math.PI / 2, lift: 0.25, moving: false },
      pallets: Array.from({ length: 3 }, () => ({ visible: false, position: point(0, -5, 0), attached: false })),
      reserve: SITE.palletSources.map((p) => ({ visible: true, position: point(p.x, 0.6, p.z), attached: false })),
    };
  }
  const t = cycle.local;
  const truck = truckAt(t);
  let eastForklift = { ...point(26, 0.12, 17), yaw: Math.PI, lift: 0.25, moving: false };
  let westForklift = { ...point(-31, 0.12, 13), yaw: -Math.PI / 2, lift: 0.25, moving: false };
  const pallets = [];
  const reserve = [];

  for (let i = 0; i < 3; i += 1) {
    const source = point(SITE.palletSources[i].x, 0.6, SITE.palletSources[i].z);
    const loadStart = i * 20;
    const loadTarget = localToWorld(point(28, 0.12, 25), -Math.PI / 2, { ...TRUCK_SLOTS[i], y: 1.65 });
    let pallet = { visible: true, position: source, attached: false };
    if (t >= loadStart && t < loadStart + 20) {
      const task = sampleForkliftTask(
        (t - loadStart) / 20,
        source,
        loadTarget,
        point(source.x, 0.12, source.z + 2.4),
        point(loadTarget.x, 0.12, loadTarget.z + 2.4),
        point(26, 0.12, 17),
        0.6,
        1.65,
      );
      pallet = { visible: true, position: task.cargo, attached: task.attached };
      eastForklift = task.forklift;
    } else if (t >= loadStart + 20 && t < 95 + i * 20) {
      pallet = { visible: true, position: localToWorld(truck, truck.yaw, { ...TRUCK_SLOTS[i], y: 1.65 }), attached: true };
    } else if (t >= 95 + i * 20 && t < 115 + i * 20) {
      const unloadSource = localToWorld(point(-36, 0.12, 10), Math.PI, { ...TRUCK_SLOTS[i], y: 1.65 });
      const target = point(SITE.palletDrops[i].x, 0.6, SITE.palletDrops[i].z);
      const task = sampleForkliftTask(
        (t - 95 - i * 20) / 20,
        unloadSource,
        target,
        point(unloadSource.x + 2.4, 0.12, unloadSource.z),
        point(target.x + 2.4, 0.12, target.z),
        point(-31, 0.12, 13),
        1.65,
        0.6,
      );
      pallet = { visible: true, position: task.cargo, attached: task.attached };
      westForklift = task.forklift;
    } else if (t >= 115 + i * 20) {
      const drop = point(SITE.palletDrops[i].x, 0.6, SITE.palletDrops[i].z);
      pallet = { visible: true, position: drop, attached: false };
      const removeStart = 215 + i * (25 / 3);
      if (t >= removeStart) {
        const task = sampleForkliftTask(
          (t - removeStart) / (25 / 3),
          drop,
          point(SITE.buildingDoor.x, 0.6, SITE.buildingDoor.z),
          point(drop.x + 2.4, 0.12, drop.z),
          point(SITE.buildingDoor.x - 2.4, 0.12, SITE.buildingDoor.z),
          point(-31, 0.12, 13),
          0.6,
          0.6,
        );
        pallet = { visible: t < removeStart + 25 / 3 - 0.4, position: task.cargo, attached: task.attached };
        westForklift = task.forklift;
      }
    }
    pallets.push(pallet);

    const reserveSource = point(SITE.palletReserve[i].x, 0.6, SITE.palletReserve[i].z);
    const reserveTarget = point(SITE.palletSources[i].x, 0.6, SITE.palletSources[i].z);
    const reserveStart = 180 + i * 15;
    let reservePallet = { visible: true, position: reserveSource, attached: false };
    if (t >= reserveStart && t < reserveStart + 15) {
      const task = sampleForkliftTask(
        (t - reserveStart) / 15,
        reserveSource,
        reserveTarget,
        point(reserveSource.x, 0.12, reserveSource.z + 2.4),
        point(reserveTarget.x, 0.12, reserveTarget.z + 2.4),
        point(26, 0.12, 17),
        0.6,
        0.6,
      );
      reservePallet = { visible: true, position: task.cargo, attached: task.attached };
      eastForklift = task.forklift;
    } else if (t >= reserveStart + 15) {
      reservePallet = { visible: true, position: reserveTarget, attached: false };
    }
    reserve.push(reservePallet);
  }

  return { active: true, status: transportStatus(t), truck, eastForklift, westForklift, pallets, reserve };
}

const MIXER_OUT = [point(43, 0.12, 33), point(32, 0.12, 33), point(13, 0.12, 32), point(8, 0.12, 25), point(8, 0.12, 7)];
const MIXER_BACK = [point(8, 0.12, 7), point(8, 0.12, 25), point(13, 0.12, 32), point(32, 0.12, 36), point(48, 0.12, 36), point(48, 0.12, 33), point(43, 0.12, 33)];

export function sampleMixer(time) {
  const cycle = safeCycle(time, 190, 25);
  if (!cycle) return { ...point(43, 0.12, 33), yaw: -Math.PI / 2, drum: 0, pouring: false, moving: false, status: "搅拌车停放" };
  const t = cycle.local;
  if (t < 50) {
    const p = samplePath(MIXER_OUT, t / 50);
    return { ...p, drum: t * 0.4, pouring: false, moving: true, status: "混凝土运输进场" };
  }
  if (t < 125) {
    const turning = t >= 112;
    return {
      ...point(8, 0.12, 7),
      yaw: turning ? lerpAngle(Math.PI, 0, smooth((t - 112) / 13)) : Math.PI,
      drum: t * 0.4,
      pouring: t > 65 && t < 112,
      moving: false,
      status: turning ? "卸料完成 · 原地掉头" : "混凝土卸料 · 泵送楼板",
    };
  }
  const p = samplePath(MIXER_BACK, (t - 125) / 65);
  return { ...p, drum: t * 0.4, pouring: false, moving: true, status: "搅拌车返程" };
}

export function sampleExcavator(time) {
  const cycle = safeCycle(time, 28, 7);
  if (!cycle) return { swing: -0.65, boom: -0.08, stick: 1, bucket: 0.2, load: 0, active: false, digging: false, dumping: false };
  const p = cycle.local / 28;
  const digSwing = -0.65;
  const dumpSwing = -1.35;
  let swing = digSwing;
  let boom = -0.08;
  let stick = 1;
  let bucket = 0.2;
  let load = 0;
  let digging = false;
  let dumping = false;
  if (p < 0.25) {
    // 动臂下压、斗杆内收，铲斗确实抵达坑底后再装满土料。
    const f = smooth(p / 0.25);
    boom = lerp(-0.08, 0.18, f);
    stick = lerp(1, 1.25, f);
    bucket = lerp(0.2, -0.65, f);
    load = f;
    digging = p > 0.08;
  } else if (p < 0.42) {
    const f = smooth((p - 0.25) / 0.17);
    boom = lerp(0.18, -0.45, f);
    stick = lerp(1.25, 0.65, f);
    bucket = -0.65;
    load = 1;
  } else if (p < 0.65) {
    swing = lerpAngle(digSwing, dumpSwing, smooth((p - 0.42) / 0.23));
    boom = -0.45;
    stick = 0.65;
    bucket = -0.65;
    load = 1;
  } else if (p < 0.8) {
    // 回转至南侧土堆，斗内土料随倾倒逐步减少。
    const f = smooth((p - 0.65) / 0.15);
    swing = dumpSwing;
    boom = -0.45;
    stick = 0.65;
    bucket = lerp(-0.65, 0.75, f);
    load = 1 - f;
    dumping = true;
  } else {
    const f = smooth((p - 0.8) / 0.2);
    swing = lerpAngle(dumpSwing, digSwing, f);
    boom = lerp(-0.45, -0.08, f);
    stick = lerp(0.65, 1, f);
    bucket = lerp(0.75, 0.2, f);
  }
  return { swing, boom, stick, bucket, load, active: true, digging, dumping };
}

export function sampleHoist(time) {
  const t = normalizeTime(time);
  const bottom = 0.12;
  if (t >= SCHEDULE.PREP_START && t < SCHEDULE.WORK_START) {
    const elapsed = t - SCHEDULE.PREP_START;
    if (elapsed < 1800) return { cageY: bottom, moving: false };
    if (elapsed < 2400) return { cageY: lerp(bottom, 17.8, smooth((elapsed - 1800) / 600)), moving: true };
    if (elapsed < 3000) return { cageY: 17.8, moving: false };
    return { cageY: lerp(17.8, bottom, smooth((elapsed - 3000) / 600)), moving: true };
  }
  if (t >= SCHEDULE.WORK_END && t < SCHEDULE.CLOSE_END) {
    const elapsed = t - SCHEDULE.WORK_END;
    let cageY = bottom;
    if (elapsed < 600) cageY = lerp(bottom, 17.8, smooth(elapsed / 600));
    else if (elapsed < 900) cageY = 17.8;
    else if (elapsed < 1500) cageY = lerp(17.8, bottom, smooth((elapsed - 900) / 600));
    return { cageY, moving: elapsed < 600 || (elapsed >= 900 && elapsed < 1500) };
  }
  const cycle = safeCycle(time, 54, 10);
  if (!cycle) return { cageY: bottom, moving: false };
  const p = cycle.local / 54;
  if (p < 0.16) return { cageY: bottom, moving: false };
  if (p < 0.44) return { cageY: lerp(bottom, 17.8, smooth((p - 0.16) / 0.28)), moving: true };
  if (p < 0.62) return { cageY: 17.8, moving: false };
  if (p < 0.94) return { cageY: lerp(17.8, bottom, smooth((p - 0.62) / 0.32)), moving: true };
  return { cageY: bottom, moving: false };
}

export function sampleOperations(time) {
  return {
    period: getPeriod(time),
    crane: sampleCrane(time),
    transport: sampleTransport(time),
    mixer: sampleMixer(time),
    excavator: sampleExcavator(time),
    hoist: sampleHoist(time),
  };
}

export function isWorkTime(time) {
  const t = normalizeTime(time);
  return t >= SCHEDULE.WORK_START && t < SCHEDULE.WORK_END;
}

export { CRANE_CYCLE, TRANSPORT_CYCLE, DAY_SECONDS };

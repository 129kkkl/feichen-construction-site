import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_TIME, SCHEDULE, SITE } from "../src/config.js";
import { sampleOperations, sampleCrane, sampleTransport, getPeriod } from "../src/simulation/operations.js";

function finitePoint(p) {
  return [p.x, p.y, p.z].every(Number.isFinite);
}

test("初始画面同时包含吊装与运输装卸作业", () => {
  const ops = sampleOperations(INITIAL_TIME);
  assert.equal(ops.period, "work");
  assert.equal(ops.crane.current.attached, true);
  assert.equal(ops.crane.current.visible, true);
  assert.ok(ops.transport.pallets.some((pallet) => pallet.visible));
  assert.notEqual(ops.transport.status, "运输车辆停放 · 物料已入库");
});

test("吊起货物始终与吊钩保持固定挂接关系", () => {
  for (let time = SCHEDULE.WORK_START; time < SCHEDULE.WORK_END; time += 7) {
    const c = sampleCrane(time);
    if (!c.current.attached) continue;
    const hookX = SITE.crane.x + Math.cos(c.angle) * c.radius;
    const hookZ = SITE.crane.z + Math.sin(c.angle) * c.radius;
    assert.ok(Math.abs(c.current.position.x - hookX) < 1e-8);
    assert.ok(Math.abs(c.current.position.z - hookZ) < 1e-8);
    assert.ok(Math.abs(c.current.position.y - (c.hookY - 1)) < 1e-8);
  }
});

test("运输中已装车货物跟随车厢，不在道路或堆场瞬移", () => {
  const ops = sampleTransport(SCHEDULE.WORK_START + 100);
  assert.equal(ops.truck.moving, false); // 07:01:40 正位于西卸货点
  for (const pallet of ops.pallets) {
    assert.equal(pallet.visible, true);
    assert.ok(finitePoint(pallet.position));
  }
  const driving = sampleTransport(SCHEDULE.WORK_START + 80);
  assert.equal(driving.truck.moving, true);
  for (const pallet of driving.pallets) {
    assert.equal(pallet.attached, true);
    assert.ok(Math.hypot(pallet.position.x - driving.truck.x, pallet.position.z - driving.truck.z) < 3);
    assert.equal(pallet.position.y, 1.65);
  }
});

test("夜间无人施工：无悬货、车辆停放、升降机落地、挖机待机", () => {
  for (const hour of [0, 1, 3, 5, 19, 21, 23]) {
    const ops = sampleOperations(hour * 3600);
    assert.equal(getPeriod(hour * 3600), "night");
    assert.equal(ops.crane.current.attached, false);
    assert.equal(ops.crane.current.position.y <= 0.8, true);
    assert.ok(ops.crane.hookY >= 29);
    assert.equal(ops.transport.truck.moving, false);
    assert.ok(ops.transport.pallets.every((pallet) => !pallet.visible));
    assert.equal(ops.mixer.moving, false);
    assert.equal(ops.excavator.active, false);
    assert.equal(ops.excavator.load, 0);
    assert.equal(ops.hoist.cageY, 0.12);
  }
});

test("收工时段不开始新吊装，货物不会被强行冻结在半空", () => {
  for (let time = SCHEDULE.WORK_END; time <= SCHEDULE.CLOSE_END; time += 30) {
    const ops = sampleOperations(time);
    assert.equal(ops.crane.current.attached, false);
    assert.equal(ops.transport.truck.moving, false);
    assert.equal(ops.mixer.moving, false);
  }
});

test("任意手动跳时间都得到确定且有限的状态", () => {
  for (let time = 0; time < 86400; time += 137) {
    const a = sampleOperations(time);
    const b = sampleOperations(time);
    assert.deepEqual(a, b);
    assert.ok(finitePoint(a.transport.truck));
    assert.ok(Number.isFinite(a.crane.hookY));
    for (const pallet of a.transport.pallets) assert.ok(finitePoint(pallet.position));
  }
});

test("次日开工后作业自动恢复", () => {
  const night = sampleOperations(23 * 3600);
  const nextDay = sampleOperations(SCHEDULE.WORK_START + 100);
  assert.equal(night.excavator.active, false);
  assert.equal(nextDay.period, "work");
  assert.equal(nextDay.excavator.active, true);
  assert.notEqual(nextDay.crane.status, "塔吊待机 · 吊钩已收高");
});

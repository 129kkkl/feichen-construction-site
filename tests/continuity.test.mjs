import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SCHEDULE } from "../src/config.js";
import { sampleCrane, sampleTransport, sampleMixer, sampleOperations } from "../src/simulation/operations.js";
import { createWorkers } from "../src/render/workers.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("开工瞬间塔吊货物与吊钩不瞬移、不在空中出现", () => {
  const before = sampleCrane(SCHEDULE.WORK_START - 0.001);
  const after = sampleCrane(SCHEDULE.WORK_START);
  assert.ok(distance(before.current.position, after.current.position) < 1e-8);
  assert.ok(distance(before.next.position, after.next.position) < 1e-8);
  assert.equal(after.current.attached, false);
  assert.equal(after.current.position.y, 0.8);
  assert.equal(after.hookY, before.hookY);
});

test("运输车过弯时车载托盘保持空间连续", () => {
  let previous = sampleTransport(SCHEDULE.WORK_START + 59.99);
  let maxJump = 0;
  for (let local = 60; local <= 155; local += 0.05) {
    const current = sampleTransport(SCHEDULE.WORK_START + local);
    for (let i = 0; i < 3; i += 1) {
      if (current.pallets[i].visible && previous.pallets[i].visible) {
        maxJump = Math.max(maxJump, distance(current.pallets[i].position, previous.pallets[i].position));
      }
    }
    previous = current;
  }
  assert.ok(maxJump < 0.35, `相邻 0.05s 托盘最大位移 ${maxJump}`);
});

test("搅拌车进出停车位与周期衔接不瞬移", () => {
  let previous = sampleMixer(SCHEDULE.WORK_START + 24.99);
  let maxJump = 0;
  let maxTurn = 0;
  for (let elapsed = 25; elapsed <= 215; elapsed += 0.05) {
    const current = sampleMixer(SCHEDULE.WORK_START + elapsed);
    maxJump = Math.max(maxJump, distance(current, previous));
    const turn = Math.abs(Math.atan2(Math.sin(current.yaw - previous.yaw), Math.cos(current.yaw - previous.yaw)));
    maxTurn = Math.max(maxTurn, turn);
    previous = current;
  }
  assert.ok(maxJump < 0.5, `搅拌车相邻帧最大位移 ${maxJump}`);
  assert.ok(maxTurn < 0.06, `搅拌车相邻帧最大转角 ${maxTurn}rad`);
});

test("工人开工、乘降升降机与延迟离场边界连续", () => {
  const scene = new THREE.Scene();
  const crew = createWorkers(scene);
  const boundaries = [
    SCHEDULE.WORK_START,
    SCHEDULE.PREP_START + 1200, SCHEDULE.PREP_START + 1800, SCHEDULE.PREP_START + 2400,
    SCHEDULE.WORK_END,
    SCHEDULE.WORK_END + 50, SCHEDULE.WORK_END + 100, SCHEDULE.WORK_END + 250,
    SCHEDULE.WORK_END + 450, SCHEDULE.WORK_END + 600, SCHEDULE.WORK_END + 900,
    SCHEDULE.WORK_END + 1050, SCHEDULE.WORK_END + 1500,
  ];
  for (const boundary of boundaries) {
    crew.update(boundary - 0.001, sampleOperations(boundary - 0.001));
    const before = crew.workers.map((worker) => ({ visible: worker.object.visible, position: worker.object.position.clone() }));
    crew.update(boundary + 0.001, sampleOperations(boundary + 0.001));
    crew.workers.forEach((worker, i) => {
      if (!before[i].visible || !worker.object.visible) return;
      const jump = before[i].position.distanceTo(worker.object.position);
      assert.ok(jump < 0.08, `${worker.def.name} 在 ${boundary} 附近跳变 ${jump}m`);
    });
  }
});

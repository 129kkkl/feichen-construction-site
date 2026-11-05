import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SCHEDULE } from "../src/config.js";
import { sampleOperations } from "../src/simulation/operations.js";
import { createWorkers } from "../src/render/workers.js";

function setup(time) {
  const scene = new THREE.Scene();
  const crew = createWorkers(scene);
  const ops = sampleOperations(time);
  crew.update(time, ops);
  return { crew, ops };
}

test("收工等待期间地面工人继续收尾，不在 17:30 集体消失", () => {
  const { crew } = setup(SCHEDULE.WORK_END + 60);
  for (const worker of crew.workers) {
    assert.equal(worker.object.visible, true, worker.def.name);
    assert.ok(Number.isFinite(worker.object.position.x));
    assert.ok(Number.isFinite(worker.object.position.y));
    assert.ok(Number.isFinite(worker.object.position.z));
  }
});

test("楼层工人随升降机下楼，不会悬空留在屋面", () => {
  const atBoarding = setup(SCHEDULE.WORK_END + 900);
  assert.equal(atBoarding.ops.hoist.cageY, 17.8);
  for (const worker of atBoarding.crew.workers.filter((w) => w.def.roof)) {
    assert.ok(Math.abs(worker.object.position.y - 17.8) < 1e-8);
  }
  const atGround = setup(SCHEDULE.WORK_END + 1500);
  assert.equal(atGround.ops.hoist.cageY, 0.12);
  for (const worker of atGround.crew.workers.filter((w) => w.def.roof)) {
    assert.ok(worker.object.position.y < 1);
  }
});

test("深夜仅门岗留场，次日准备阶段人员重新进场", () => {
  const night = setup(22 * 3600);
  assert.equal(night.crew.workers.every((worker) => !worker.object.visible), true);
  assert.equal(night.crew.guard.visible, true);
  const prep = setup(6 * 3600 + 30 * 60);
  assert.ok(prep.crew.workers.some((worker) => worker.object.visible));
});

test("全天人员采样坐标均为有限值", () => {
  const scene = new THREE.Scene();
  const crew = createWorkers(scene);
  for (let time = 0; time < 86400; time += 211) {
    const ops = sampleOperations(time);
    crew.update(time, ops);
    for (const worker of [...crew.workers, { object: crew.guard }]) {
      assert.ok(Number.isFinite(worker.object.position.x));
      assert.ok(Number.isFinite(worker.object.position.y));
      assert.ok(Number.isFinite(worker.object.position.z));
    }
  }
});

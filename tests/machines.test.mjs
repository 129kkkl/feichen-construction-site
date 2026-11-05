import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SCHEDULE } from "../src/config.js";
import { sampleOperations } from "../src/simulation/operations.js";
import { createMachines } from "../src/render/machines.js";

function bucketAt(time) {
  const scene = new THREE.Scene();
  const machines = createMachines(scene);
  const ops = sampleOperations(time);
  machines.update(ops, time, 0);
  scene.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  machines.excavator.bucket.getWorldPosition(position);
  return { position, excavator: ops.excavator };
}

test("挖掘结束时铲斗抵达坑底，提升后离开地面", () => {
  const dig = bucketAt(SCHEDULE.WORK_START + 14);
  assert.equal(dig.excavator.load, 1);
  assert.ok(dig.position.y < 0.4 && dig.position.y > -1.6, `挖掘铲斗高度 ${dig.position.y}`);
  const lifted = bucketAt(SCHEDULE.WORK_START + 18.8);
  assert.equal(lifted.excavator.load, 1);
  assert.ok(lifted.position.y > 2.2, `提升铲斗高度 ${lifted.position.y}`);
});

test("卸土阶段铲斗位于土堆上方，斗内土料随倾倒减少", () => {
  const dumping = bucketAt(SCHEDULE.WORK_START + 27.16);
  assert.equal(dumping.excavator.dumping, true);
  assert.ok(dumping.excavator.load > 0 && dumping.excavator.load < 1);
  const horizontalDistance = Math.hypot(dumping.position.x + 42, dumping.position.z + 1.8);
  assert.ok(horizontalDistance < 2, `卸土水平偏差 ${horizontalDistance}`);
  assert.ok(dumping.position.y > 1, `卸土高度 ${dumping.position.y}`);
});

import * as THREE from "three";
import { PALETTE as C } from "../config.js";

const MAX_PARTICLES = 180;

export function createDust(scene, machines) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xc5b18a, transparent: true, opacity: 0.42, roughness: 1, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
  mesh.name = "局部施工尘土";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const particles = Array.from({ length: MAX_PARTICLES }, () => ({ life: 0, maxLife: 1, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, size: 0, spin: 0 }));
  const dummy = new THREE.Object3D();
  let cursor = 0;
  let truckClock = 0;
  let mixerClock = 0;
  let excavatorClock = 0;
  let forkliftClock = 0;

  function emit(x, y, z, amount = 1, strength = 1) {
    for (let n = 0; n < amount; n += 1) {
      const p = particles[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.life = 0;
      p.maxLife = 1.2 + Math.random() * 1.3;
      p.x = x + (Math.random() - 0.5) * 1.2;
      p.y = y + Math.random() * 0.25;
      p.z = z + (Math.random() - 0.5) * 1.2;
      p.vx = (Math.random() - 0.5) * 0.75 * strength;
      p.vz = (Math.random() - 0.5) * 0.75 * strength;
      p.vy = (0.25 + Math.random() * 0.55) * strength;
      p.size = (0.25 + Math.random() * 0.45) * strength;
      p.spin = Math.random() * Math.PI;
    }
  }

  function clear() {
    for (const p of particles) p.life = p.maxLife + 1;
  }

  function update(dt, ops) {
    if (dt > 0) {
      truckClock -= dt;
      mixerClock -= dt;
      excavatorClock -= dt;
      forkliftClock -= dt;
      if (ops.transport.truck.moving && truckClock <= 0) {
        const t = ops.transport.truck;
        emit(t.x - Math.sin(t.yaw) * 3.2, 0.3, t.z - Math.cos(t.yaw) * 3.2, 2, 0.85);
        truckClock = 0.12;
      }
      if (ops.mixer.moving && mixerClock <= 0) {
        emit(ops.mixer.x - Math.sin(ops.mixer.yaw) * 3, 0.3, ops.mixer.z - Math.cos(ops.mixer.yaw) * 3, 1, 0.7);
        mixerClock = 0.18;
      }
      if ((ops.excavator.digging || ops.excavator.dumping) && excavatorClock <= 0) {
        const p = new THREE.Vector3();
        machines.excavator.bucket.getWorldPosition(p);
        emit(p.x, Math.max(-0.4, p.y - 0.4), p.z, ops.excavator.dumping ? 3 : 2, 1.1);
        excavatorClock = 0.11;
      }
      if ((ops.transport.eastForklift.moving || ops.transport.westForklift.moving) && forkliftClock <= 0) {
        const f = ops.transport.eastForklift.moving ? ops.transport.eastForklift : ops.transport.westForklift;
        emit(f.x, 0.25, f.z, 1, 0.45);
        forkliftClock = 0.25;
      }
    }

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life < p.maxLife) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy *= Math.max(0, 1 - dt * 0.8);
        const remaining = 1 - p.life / p.maxLife;
        const size = p.size * Math.sin(Math.min(1, p.life * 3) * Math.PI * 0.5) * remaining;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.spin + p.life * 0.4, p.spin, p.life * 0.25);
        dummy.scale.setScalar(Math.max(0.001, size));
      } else {
        dummy.position.set(0, -30, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(0, { transport: { truck: {}, eastForklift: {}, westForklift: {} }, mixer: {}, excavator: {} });
  return { update, clear, emit, mesh };
}

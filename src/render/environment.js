import * as THREE from "three";
import { clamp01, lerp, smooth } from "../config.js";
import { voxelGroup } from "./voxel.js";

const SKY_STOPS = [
  { e: -1, color: new THREE.Color(0x07111d) },
  { e: -0.22, color: new THREE.Color(0x101e2e) },
  { e: -0.02, color: new THREE.Color(0x805e5d) },
  { e: 0.08, color: new THREE.Color(0xd59b78) },
  { e: 0.28, color: new THREE.Color(0x91b7c3) },
  { e: 1, color: new THREE.Color(0x78acc8) },
];

function skyColor(elevation) {
  for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
    const a = SKY_STOPS[i];
    const b = SKY_STOPS[i + 1];
    if (elevation <= b.e) return a.color.clone().lerp(b.color, clamp01((elevation - a.e) / (b.e - a.e)));
  }
  return SKY_STOPS[SKY_STOPS.length - 1].color.clone();
}

export function createEnvironment(scene, renderer, world) {
  scene.background = new THREE.Color(0x8db5c6);
  scene.fog = new THREE.Fog(0x8db5c6, 92, 245);
  const hemisphere = new THREE.HemisphereLight(0xc5dded, 0x59604f, 1.1);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xfff1d5, 2.4);
  keyLight.position.set(70, 100, 45);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -72;
  keyLight.shadow.camera.right = 72;
  keyLight.shadow.camera.top = 72;
  keyLight.shadow.camera.bottom = -72;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 280;
  keyLight.shadow.bias = -0.00035;
  keyLight.shadow.normalBias = 0.035;
  keyLight.target.position.set(0, 0, 0);
  scene.add(keyLight, keyLight.target);

  const sun = voxelGroup("体素太阳", (b) => {
    b.box(0, 0, 0, 7, 7, 2, 0xffd77d);
    b.box(0, 0, 0, 4, 9, 1.8, 0xffe4a0);
  }, { material: new THREE.MeshBasicMaterial({ color: 0xffffff }), castShadow: false, receiveShadow: false });
  const moon = voxelGroup("体素月亮", (b) => {
    b.box(0, 0, 0, 5, 5, 1.6, 0xc5d6e0);
    b.box(1.6, 1.4, 0.9, 2.6, 3.2, 1.7, 0x8fa9bb);
  }, { material: new THREE.MeshBasicMaterial({ color: 0xffffff }), castShadow: false, receiveShadow: false });
  scene.add(sun, moon);

  let seed = 4173;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const starPositions = [];
  for (let i = 0; i < 520; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = random() * Math.PI * 0.48;
    const r = 195;
    starPositions.push(Math.cos(theta) * Math.cos(phi) * r, Math.sin(phi) * r + 5, Math.sin(theta) * Math.cos(phi) * r);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xd8e5ee, size: 1.25, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const clouds = [];
  for (let i = 0; i < 6; i += 1) {
    const cloud = voxelGroup("体素云", (b) => {
      b.box(0, 0, 0, 10, 2.4, 4, 0xe2e3da);
      b.box(-3, 1.6, 0, 5, 2, 3.6, 0xeeeeE6);
      b.box(2.4, 1.2, -0.4, 6, 2.4, 4.4, 0xd7dcd7);
    }, { castShadow: false, receiveShadow: false });
    cloud.position.set(-95 + i * 38, 47 + (i % 3) * 8, -62 + (i % 2) * 95);
    cloud.userData.baseX = cloud.position.x;
    cloud.userData.speed = 0.7 + i * 0.12;
    scene.add(cloud);
    clouds.push(cloud);
  }

  function update(time) {
    const hours = time / 3600;
    const angle = ((hours - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(angle);
    const horizontal = Math.cos(angle);
    const sunDirection = new THREE.Vector3(horizontal * 0.82, elevation, -0.42).normalize();
    const daylight = smooth((elevation + 0.1) / 0.32);
    const night = 1 - smooth((elevation + 0.04) / 0.22);
    const dusk = 1 - smooth(Math.abs(elevation) / 0.35);
    const sky = skyColor(elevation);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    scene.fog.near = lerp(75, 105, daylight);
    scene.fog.far = lerp(185, 250, daylight);

    sun.position.copy(sunDirection).multiplyScalar(175);
    moon.position.copy(sunDirection).multiplyScalar(-175);
    sun.visible = elevation > -0.13;
    moon.visible = elevation < 0.18;
    sun.lookAt(0, 0, 0);
    moon.lookAt(0, 0, 0);
    starMaterial.opacity = night * 0.88;

    const lightDirection = elevation > -0.04 ? sunDirection : sunDirection.clone().negate();
    keyLight.position.copy(lightDirection).multiplyScalar(125);
    keyLight.intensity = lerp(0.32, 2.65, daylight);
    keyLight.color.set(0xfff0d5).lerp(new THREE.Color(0xffb078), dusk * 0.7);
    if (elevation <= -0.04) keyLight.color.set(0x9cb9d7);
    hemisphere.intensity = lerp(0.38, 1.25, daylight);
    hemisphere.color.set(0x91a9c2).lerp(new THREE.Color(0xd2e4e9), daylight);
    hemisphere.groundColor.set(0x3e4850).lerp(new THREE.Color(0x6c6c56), daylight);
    renderer.toneMappingExposure = lerp(0.88, 1.02, daylight);

    const lamps = smooth((0.16 - elevation) / 0.28);
    for (const light of world.nightLights) light.intensity = lamps * (light.userData.nightIntensity || 460);
    world.lampMaterial.emissiveIntensity = 0.1 + lamps * 4;
    for (const material of world.nightMaterials) material.emissiveIntensity = 0.06 + lamps * 2.2;
    for (const cloud of clouds) {
      cloud.position.x = ((cloud.userData.baseX + time * 0.002 * cloud.userData.speed + 120) % 240) - 120;
    }
    return { elevation, daylight, night };
  }

  return { update, keyLight, hemisphere, sun, moon, stars };
}

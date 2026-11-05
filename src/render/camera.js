import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clamp, lerp, smooth } from "../config.js";

const TOUR_STOPS = [
  { position: [8, 3.2, 48], target: [2, 8, -5], duration: 5 },
  { position: [8, 2.2, 32], target: [5, 14, -8], duration: 6 },
  { position: [39, 6, 26], target: [24, 2, 9], duration: 7 },
  { position: [27, 15, 18], target: [4, 18, -7], duration: 7 },
  { position: [13, 27, 16], target: [-11, 17.5, -9], duration: 7 },
  { position: [-46, 8, 27], target: [-32, 2, 8], duration: 7 },
  { position: [-53, 7, 8], target: [-48, 1, -9], duration: 6 },
  { position: [64, 48, 70], target: [-4, 9, -4], duration: 8 },
];

export function createCameraSystem(camera, dom, world, onModeChange = () => {}) {
  camera.position.set(...world.focus.overview.position);
  const controls = new OrbitControls(camera, dom);
  controls.target.set(...world.focus.overview.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 7;
  controls.maxDistance = 165;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minPolarAngle = 0.12;
  controls.panSpeed = 0.75;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.85;
  controls.update();

  let mode = "orbit";
  let yaw = 0;
  let pitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let walkPosition = new THREE.Vector3(8, 1.78, 37.5);
  const keys = new Set();
  let tween = null;
  let tourIndex = 0;
  let tourElapsed = 0;
  let tourFrom = null;

  function currentTarget() {
    if (mode === "orbit") return controls.target.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    return camera.position.clone().add(direction.multiplyScalar(12));
  }

  function updateWalkRotation() {
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function setMode(next) {
    if (!['orbit', 'walk', 'tour'].includes(next)) return;
    if (mode === next && next !== "tour") return;
    tween = null;
    mode = next;
    controls.enabled = mode === "orbit";
    dragging = false;
    keys.clear();
    if (mode === "walk") {
      camera.position.copy(walkPosition);
      yaw = 0;
      pitch = 0;
      updateWalkRotation();
    } else if (mode === "orbit") {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      controls.target.copy(camera.position).add(direction.multiplyScalar(15));
      controls.update();
    } else {
      tourIndex = 0;
      tourElapsed = 0;
      tourFrom = { position: camera.position.clone(), target: currentTarget() };
    }
    onModeChange(mode);
  }

  function focus(name) {
    const destination = world.focus[name];
    if (!destination) return;
    const fromTarget = currentTarget();
    mode = "orbit";
    controls.enabled = false;
    onModeChange(mode);
    tween = {
      elapsed: 0,
      duration: 1.5,
      fromPosition: camera.position.clone(),
      fromTarget,
      toPosition: new THREE.Vector3(...destination.position),
      toTarget: new THREE.Vector3(...destination.target),
    };
  }

  function collides(x, z) {
    const radius = 0.45;
    return world.colliders.some((c) => x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ);
  }

  function updateWalk(dt) {
    let forward = 0;
    let right = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) right += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) right -= 1;
    const length = Math.hypot(forward, right) || 1;
    const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.2 : 3.8) * dt;
    forward = forward / length * speed;
    right = right / length * speed;
    const dx = Math.cos(yaw) * right - Math.sin(yaw) * forward;
    const dz = -Math.sin(yaw) * right - Math.cos(yaw) * forward;
    let nextX = clamp(camera.position.x + dx, -54.5, 54.5);
    let nextZ = clamp(camera.position.z + dz, -40.5, 40.5);
    if (!collides(nextX, camera.position.z)) camera.position.x = nextX;
    if (!collides(camera.position.x, nextZ)) camera.position.z = nextZ;
    camera.position.y = 1.78;
    walkPosition.copy(camera.position);
    updateWalkRotation();
  }

  function updateTour(dt) {
    const to = TOUR_STOPS[tourIndex];
    tourElapsed += dt;
    const f = smooth(tourElapsed / to.duration);
    camera.position.lerpVectors(tourFrom.position, new THREE.Vector3(...to.position), f);
    const target = new THREE.Vector3().lerpVectors(tourFrom.target, new THREE.Vector3(...to.target), f);
    camera.lookAt(target);
    if (tourElapsed >= to.duration) {
      tourFrom = { position: new THREE.Vector3(...to.position), target: new THREE.Vector3(...to.target) };
      tourElapsed = 0;
      tourIndex = (tourIndex + 1) % TOUR_STOPS.length;
    }
  }

  function update(dt) {
    if (tween) {
      tween.elapsed += dt;
      const f = smooth(tween.elapsed / tween.duration);
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, f);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, f);
      camera.lookAt(controls.target);
      if (tween.elapsed >= tween.duration) {
        tween = null;
        controls.enabled = true;
        controls.update();
      }
    } else if (mode === "orbit") {
      controls.update();
    } else if (mode === "walk") {
      updateWalk(dt);
    } else {
      updateTour(dt);
    }
  }

  dom.addEventListener("pointerdown", (event) => {
    if (mode !== "walk" || event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    dom.setPointerCapture(event.pointerId);
  });
  dom.addEventListener("pointermove", (event) => {
    if (mode !== "walk" || !dragging) return;
    yaw -= (event.clientX - lastX) * 0.004;
    pitch = clamp(pitch - (event.clientY - lastY) * 0.004, -1.35, 1.35);
    lastX = event.clientX;
    lastY = event.clientY;
    updateWalkRotation();
  });
  dom.addEventListener("pointerup", () => { dragging = false; });
  dom.addEventListener("pointercancel", () => { dragging = false; });

  window.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.code === "Digit1") setMode("orbit");
    if (event.code === "Digit2") setMode("walk");
    if (event.code === "Digit3") setMode("tour");
    keys.add(event.code);
    if (mode === "walk" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  return {
    update,
    setMode,
    focus,
    controls,
    get mode() { return mode; },
    get tourStop() { return tourIndex; },
  };
}

import * as THREE from "three";
import "./style.css";
import { BASE_TIME_RATE, INITIAL_TIME, normalizeTime } from "./config.js";
import { sampleOperations, getPeriod } from "./simulation/operations.js";
import { buildWorld } from "./render/world.js";
import { createMachines } from "./render/machines.js";
import { createWorkers } from "./render/workers.js";
import { createEnvironment } from "./render/environment.js";
import { createDust } from "./render/dust.js";
import { createCameraSystem } from "./render/camera.js";
import { createUI } from "./ui/ui.js";

const state = {
  time: INITIAL_TIME,
  day: 1,
  paused: false,
  speed: 1,
};

let cameraSystem;
let dust;
let renderer;
let latestOps = sampleOperations(state.time);

const ui = createUI({
  setMode: (mode) => cameraSystem?.setMode(mode),
  focus: (name) => cameraSystem?.focus(name),
  setTime: (value) => setTime(value),
  setPaused: (value) => setPaused(value),
  setSpeed: (value) => { state.speed = value; },
});

function setTime(value) {
  state.time = normalizeTime(Number(value) || 0);
  dust?.clear();
}

function setPaused(value) {
  state.paused = typeof value === "boolean" ? value : !state.paused;
  ui.showToast(state.paused ? "时间与施工已暂停 · 仍可自由游览" : "时间与施工继续推进");
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  ui.viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 460);
  const world = buildWorld(scene);
  const machines = createMachines(scene);
  const workers = createWorkers(scene);
  const environment = createEnvironment(scene, renderer, world);
  dust = createDust(scene, machines);
  cameraSystem = createCameraSystem(camera, renderer.domElement, world, ui.setMode);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    state.paused = true;
    ui.showToast("图形上下文暂时中断，时间与施工已暂停");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    ui.showToast("图形上下文已恢复，可手动继续施工");
  });

  window.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.code === "KeyP") setPaused();
    if (event.code === "KeyH") {
      if (ui.help.open) ui.help.close();
      else ui.help.showModal();
    }
  });

  let previous = performance.now();
  let firstFrame = true;
  renderer.setAnimationLoop((now) => {
    const realDt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    const animationDt = state.paused ? 0 : realDt;
    if (!state.paused) {
      const next = state.time + realDt * BASE_TIME_RATE * state.speed;
      if (next >= 86400) state.day += 1;
      state.time = normalizeTime(next);
    }

    latestOps = sampleOperations(state.time);
    machines.update(latestOps, state.time, animationDt);
    workers.update(state.time, latestOps);
    environment.update(state.time);
    dust.update(animationDt, latestOps);
    cameraSystem.update(realDt);
    renderer.render(scene, camera);
    ui.update({
      time: state.time,
      day: state.day,
      paused: state.paused,
      speed: state.speed,
      ops: latestOps,
      rendererInfo: renderer.info.render,
    }, now);

    if (firstFrame) {
      firstFrame = false;
      ui.ready();
      window.__FEICHEN_READY__ = true;
    }
  });

  window.__FEICHEN__ = {
    getSnapshot() {
      return {
        time: state.time,
        day: state.day,
        paused: state.paused,
        speed: state.speed,
        period: getPeriod(state.time),
        mode: cameraSystem.mode,
        crane: latestOps.crane,
        transport: latestOps.transport,
        excavator: latestOps.excavator,
        hoist: latestOps.hoist,
        mixer: latestOps.mixer,
        visibleWorkers: workers.workers.filter((worker) => worker.object.visible).length + (workers.guard.visible ? 1 : 0),
        camera: { position: camera.position.toArray(), rotation: camera.rotation.toArray().slice(0, 3) },
        renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
      };
    },
    setTime,
    setPaused,
    setSpeed(value) { state.speed = Number(value); },
    setMode(mode) { cameraSystem.setMode(mode); },
    focus(name) { cameraSystem.focus(name); },
    sampleAt(time) { return sampleOperations(normalizeTime(time)); },
  };
} catch (error) {
  console.error("飞尘工地初始化失败", error);
  ui.loading.innerHTML = `<h2>无法启动三维场景</h2><p>请使用支持 WebGL 2 的现代浏览器，并启用硬件加速。</p><pre>${String(error.message || error)}</pre>`;
}

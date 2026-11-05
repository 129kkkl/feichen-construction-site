import { formatTime } from "../config.js";
import { getPeriodLabel } from "../simulation/operations.js";

export function createUI(callbacks) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <main id="viewport" aria-label="飞尘工地三维交互场景"></main>
    <div class="vignette" aria-hidden="true"></div>
    <header class="brand glass">
      <div class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></div>
      <div><h1>飞尘工地</h1><p>FEICHEN SITE · 0.2m / VOXEL</p></div>
    </header>
    <div id="period" class="period glass"><span class="live-dot"></span><span id="period-text">正常施工</span><span class="divider"></span><span id="clock-top">09:22</span></div>
    <aside class="operations glass" aria-label="现场作业状态">
      <div class="operation"><span class="op-icon crane-icon">⌁</span><div><small>吊装作业</small><p id="crane-status">正在准备</p></div></div>
      <div class="operation"><span class="op-icon truck-icon">▰</span><div><small>运输装卸</small><p id="transport-status">正在准备</p></div></div>
    </aside>
    <nav class="view-switch glass" aria-label="游览方式">
      <button data-mode="orbit" class="active" title="全景环绕（1）"><span>◉</span>全景</button>
      <button data-mode="walk" title="地面步行（2）"><span>⌖</span>步行</button>
      <button data-mode="tour" title="自动巡游（3）"><span>▷</span>巡游</button>
    </nav>
    <div class="focus-wrap glass">
      <label for="focus">观察点</label>
      <select id="focus" aria-label="选择观察点">
        <option value="overview">工地全景</option>
        <option value="crane">塔吊吊装</option>
        <option value="yard">材料堆场</option>
        <option value="roof">顶层作业面</option>
        <option value="transport">西侧卸货</option>
        <option value="gate">工地入口</option>
      </select>
    </div>
    <section class="time-dock glass" aria-label="时间控制">
      <div class="time-row">
        <button id="play" class="play" aria-label="暂停时间与施工" title="暂停 / 继续（P）">Ⅱ</button>
        <div class="time-readout"><strong id="clock">09:22</strong><span id="day-state">第 1 天 · 施工中</span></div>
        <div class="presets" aria-label="时间预设">
          <button data-time="23400">清晨</button><button data-time="43200">正午</button><button data-time="63900">收工</button><button data-time="79200">夜晚</button>
        </div>
        <label class="speed-label">流速<select id="speed" aria-label="时间流速"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label>
        <button id="help" class="help-button" aria-label="操作帮助" title="操作帮助（H）">?</button>
      </div>
      <div class="slider-row"><span>00:00</span><input id="time-slider" type="range" min="0" max="86340" step="60" value="33720" aria-label="一天中的时刻" /><span>24:00</span></div>
    </section>
    <div id="toast" class="toast" role="status"></div>
    <div id="loading" class="loading"><div class="loader-cubes"><i></i><i></i><i></i></div><h2>飞尘工地</h2><p>正在装配体素场景与施工日程…</p></div>
    <dialog id="help-dialog">
      <form method="dialog" class="help-card">
        <div class="help-head"><div><small>SITE GUIDE</small><h2>游览与施工日程</h2></div><button class="close" aria-label="关闭">×</button></div>
        <div class="help-grid">
          <section><h3>游览</h3><p><b>全景</b>：左键环绕，右键平移，滚轮缩放。</p><p><b>步行</b>：WASD / 方向键移动，按住左键拖动视角，Shift 加速。</p><p><b>巡游</b>：沿入口、堆场、吊装面、卸货区自动游览。按 1 / 2 / 3 切换模式。</p></section>
          <section><h3>时间与施工</h3><p>06:00 进场准备，07:00 开工，17:30 停止新作业并收工，18:15 后夜间值守。</p><p>拖动时间轴可跳至任意时刻；系统会直接生成一致的人、机、料状态。</p><p><b>P / 暂停按钮</b>：同时暂停时间、施工动画与尘土；仍可自由游览。1× 为现实 1 秒推进现场 1 分钟。</p></section>
        </div>
        <div class="help-foot"><span>所有模型均由 0.2m 体素单元程序化构建</span><span id="performance">WebGL 已就绪</span></div>
      </form>
    </dialog>
  `;

  const el = {
    viewport: document.getElementById("viewport"),
    clock: document.getElementById("clock"),
    clockTop: document.getElementById("clock-top"),
    dayState: document.getElementById("day-state"),
    periodText: document.getElementById("period-text"),
    craneStatus: document.getElementById("crane-status"),
    transportStatus: document.getElementById("transport-status"),
    play: document.getElementById("play"),
    speed: document.getElementById("speed"),
    slider: document.getElementById("time-slider"),
    focus: document.getElementById("focus"),
    loading: document.getElementById("loading"),
    toast: document.getElementById("toast"),
    help: document.getElementById("help-dialog"),
    performance: document.getElementById("performance"),
  };
  let scrubbing = false;
  let toastTimer;
  let lastUpdate = 0;

  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => callbacks.setMode(button.dataset.mode)));
  document.querySelectorAll("[data-time]").forEach((button) => button.addEventListener("click", () => {
    const value = Number(button.dataset.time);
    callbacks.setTime(value);
    showToast(`已跳转至 ${formatTime(value)} · 现场状态已同步`);
  }));
  el.play.addEventListener("click", () => callbacks.setPaused());
  el.speed.addEventListener("change", () => callbacks.setSpeed(Number(el.speed.value)));
  el.focus.addEventListener("change", () => callbacks.focus(el.focus.value));
  el.slider.addEventListener("pointerdown", () => { scrubbing = true; });
  window.addEventListener("pointerup", () => { scrubbing = false; });
  el.slider.addEventListener("input", () => {
    const value = Number(el.slider.value);
    el.clock.textContent = formatTime(value);
    el.clockTop.textContent = formatTime(value);
    callbacks.setTime(value);
  });
  document.getElementById("help").addEventListener("click", () => el.help.showModal());
  el.help.addEventListener("click", (event) => {
    if (event.target === el.help) el.help.close();
  });

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("show");
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  function setMode(mode) {
    document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    showToast({ orbit: "全景环绕 · 拖动旋转，滚轮缩放", walk: "地面步行 · WASD 移动，拖动视角", tour: "自动巡游 · 按 1 可随时返回全景" }[mode]);
  }

  function update(state, now = performance.now()) {
    if (now - lastUpdate < 100) return;
    lastUpdate = now;
    const text = formatTime(state.time);
    el.clock.textContent = text;
    el.clockTop.textContent = text;
    el.periodText.textContent = getPeriodLabel(state.time);
    el.dayState.textContent = `第 ${state.day} 天 · ${state.paused ? "已暂停" : getPeriodLabel(state.time)}`;
    el.craneStatus.textContent = state.ops.crane.status;
    el.transportStatus.textContent = state.ops.transport.status;
    el.play.textContent = state.paused ? "▶" : "Ⅱ";
    el.play.setAttribute("aria-label", state.paused ? "继续时间与施工" : "暂停时间与施工");
    if (!scrubbing) el.slider.value = Math.floor(state.time / 60) * 60;
    if (state.rendererInfo) el.performance.textContent = `${state.rendererInfo.calls} draw calls · ${Math.round(state.rendererInfo.triangles / 1000)}k tris`;
  }

  function ready() {
    el.loading.classList.add("done");
    setTimeout(() => el.loading.remove(), 700);
  }

  return { ...el, update, setMode, showToast, ready };
}

import * as THREE from "three";
import type {
  FlowNode,
  FlowNodeKind,
  FlowStep,
  FlowTraffic,
  TraceFlow,
} from "@blocks-lmt/utils/trace-flow.util";

/**
 * The imperative three.js half of the flow view. It owns the canvas, the render loop and the
 * playback clock; React only drives it through play/pause/seek and hears back on step changes.
 * Loaded with a dynamic import so three.js stays out of the main bundle.
 */

export interface TraceFlowSceneOptions {
  onStepChange: (index: number, ended: boolean) => void;
  onPlayingChange: (playing: boolean) => void;
  reducedMotion?: boolean;
  onNodeSelect?: (nodeId: string) => void;
}

const STEP_SECONDS = 2.4;

const NODE_COLORS: Record<FlowNodeKind, number> = {
  caller: 0x8fb8ff,
  service: 0x5fc4b8,
  database: 0xc3a0ff,
  cache: 0xff7a7a,
  queue: 0xf28c6b,
  external: 0xff9fc6,
};

export const TRAFFIC_COLORS: Record<FlowTraffic, number> = {
  http: 0xffc857,
  call: 0x7fd08a,
  data: 0xc3a0ff,
  cache: 0xff7a7a,
  message: 0xf28c6b,
};
const DASHED: Record<FlowTraffic, boolean> = {
  http: false,
  call: false,
  data: true,
  cache: true,
  message: true,
};

const ERROR_COLOR = 0xff4d4f;
const PROPAGATED_COLOR = 0xff9f43;
const WARNING_COLOR = 0xf5c542;

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function drawTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (g) draw(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const MONO = (size: number) => `600 ${size}px ui-monospace, "JetBrains Mono", Menlo, monospace`;

function makeTextures() {
  return {
    browser: drawTexture(320, 200, (g) => {
      g.fillStyle = "#0e1526";
      g.fillRect(0, 0, 320, 200);
      g.fillStyle = "#1f2b47";
      g.fillRect(0, 0, 320, 36);
      ["#ff6b6b", "#ffc857", "#6bdc8a"].forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(18 + i * 18, 18, 6, 0, 7);
        g.fill();
      });
      g.fillStyle = "#0e1526";
      roundRect(g, 76, 9, 230, 18, 9);
      g.fill();
      g.fillStyle = "#6bdc8a";
      g.font = MONO(11);
      g.fillText("https://", 88, 22);
      g.fillStyle = "#33415f";
      [60, 84, 108, 132].forEach((y, i) => {
        roundRect(g, 18, y, 284 - i * 40, 10, 4);
        g.fill();
      });
    }),
    service: drawTexture(280, 180, (g) => {
      g.fillStyle = "#0f2a2c";
      g.fillRect(0, 0, 280, 180);
      g.strokeStyle = css(NODE_COLORS.service);
      g.lineWidth = 6;
      roundRect(g, 8, 8, 264, 164, 14);
      g.stroke();
      for (let i = 0; i < 3; i++) {
        g.fillStyle = "#17403f";
        roundRect(g, 26, 30 + i * 44, 228, 30, 6);
        g.fill();
        g.fillStyle = i === 1 ? "#ffc857" : "#6bdc8a";
        g.beginPath();
        g.arc(234, 45 + i * 44, 6, 0, 7);
        g.fill();
      }
    }),
    envelope: drawTexture(160, 104, (g) => {
      g.fillStyle = "#fde3d7";
      g.fillRect(0, 0, 160, 104);
      g.strokeStyle = "#c2593a";
      g.lineWidth = 6;
      g.strokeRect(3, 3, 154, 98);
      g.beginPath();
      g.moveTo(4, 6);
      g.lineTo(80, 60);
      g.lineTo(156, 6);
      g.stroke();
    }),
    card: drawTexture(160, 104, (g) => {
      g.fillStyle = "#fff2cf";
      g.fillRect(0, 0, 160, 104);
      g.fillStyle = "#c28a10";
      g.fillRect(0, 0, 160, 24);
      g.fillStyle = "#fff2cf";
      g.font = MONO(15);
      g.fillText("HTTP/1.1", 10, 18);
      g.fillStyle = "#d8c38a";
      [40, 60, 80].forEach((y, i) => g.fillRect(12, y, 136 - i * 30, 9));
    }),
  };
}

function boltGeometry() {
  const shape = new THREE.Shape();
  const pts: [number, number][] = [
    [0.06, 0.34],
    [-0.17, -0.02],
    [-0.01, -0.02],
    [-0.08, -0.34],
    [0.18, 0.06],
    [0.02, 0.06],
  ];
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  geo.center();
  return geo;
}

interface NodeView {
  node: FlowNode;
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  label: HTMLButtonElement;
  labelY: number;
  firstStep: number;
  phase: number;
  animate?: (t: number) => void;
  /** First step that failed at this node, and first step where an error started here. */
  firstFailure: number;
  firstOrigin: number;
  visible: boolean;
  active: boolean;
  labelText: string;
}

interface EdgeView {
  step: FlowStep;
  curve: THREE.QuadraticBezierCurve3 | null;
  line: THREE.Line | null;
  count: number;
  arrow: THREE.Mesh | null;
}

export class TraceFlowScene {
  private readonly host: HTMLElement;
  private readonly flow: TraceFlow;
  private readonly opts: TraceFlowSceneOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 400);
  private readonly labels: HTMLDivElement;
  private readonly packetTag: HTMLDivElement;
  private readonly textures = makeTextures();
  private readonly nodes = new Map<string, NodeView>();
  private readonly edges: EdgeView[] = [];
  private readonly packet = new THREE.Group();
  private readonly packetLight = new THREE.PointLight(0xffc857, 1.4, 5);
  private readonly packets: Record<FlowTraffic | "error", THREE.Mesh>;
  private readonly burst: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly camTarget = new THREE.Vector3();
  private readonly camGoal = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private extent = 10;
  private camRadius = 12;
  private camYaw = 0.42;
  private userYaw = 0;
  private zoomFactor = 1;
  private overview = true;
  private dragX: number | null = null;
  private step = 0;
  private t = 0;
  private playing = true;
  private ended = false;
  private speed = 1;
  private clock = 0;
  private last = 0;
  private frameId = 0;
  private disposed = false;

  constructor(host: HTMLElement, flow: TraceFlow, opts: TraceFlowSceneOptions) {
    this.host = host;
    this.flow = flow;
    this.opts = opts;

    // Throws when WebGL is unavailable; the caller shows its fallback in that case.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    host.appendChild(this.renderer.domElement);

    this.labels = document.createElement("div");
    Object.assign(this.labels.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    host.appendChild(this.labels);
    this.packetTag = document.createElement("div");
    this.styleTag(this.packetTag);
    this.labels.appendChild(this.packetTag);

    this.scene.fog = new THREE.Fog(0x0c1120, 26, 80);
    this.scene.add(new THREE.AmbientLight(0x8899cc, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fc4b8, 0.35);
    rim.position.set(-8, 4, -10);
    this.scene.add(rim);
    const grid = new THREE.GridHelper(160, 160, 0x2a3a60, 0x1a2440);
    grid.position.y = -0.9;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    this.scene.add(grid);

    const basic = (color: number) => new THREE.MeshBasicMaterial({ color });
    this.packets = {
      http: new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.33, 0.04),
        new THREE.MeshBasicMaterial({ map: this.textures.card }),
      ),
      call: new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), basic(TRAFFIC_COLORS.call)),
      data: new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.14, 24),
        basic(TRAFFIC_COLORS.data),
      ),
      cache: new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.12, 24),
        basic(TRAFFIC_COLORS.cache),
      ),
      message: new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.32, 0.04),
        new THREE.MeshBasicMaterial({ map: this.textures.envelope }),
      ),
      error: new THREE.Mesh(new THREE.OctahedronGeometry(0.24), basic(ERROR_COLOR)),
    };
    Object.values(this.packets).forEach((m) => {
      m.visible = false;
      this.packet.add(m);
    });
    this.packet.add(this.packetLight);
    this.scene.add(this.packet);
    this.burst = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 40),
      new THREE.MeshBasicMaterial({
        color: ERROR_COLOR,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    this.burst.visible = false;
    this.scene.add(this.burst);

    this.build();
    this.bindPointer();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
    }
    this.resize();
    this.last = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
    this.opts.onStepChange(0, false);
    this.opts.onPlayingChange(true);
  }

  // ---------- public controls ----------
  play() {
    if (this.ended) this.seek(0);
    this.setPlaying(true);
  }
  pause() {
    this.setPlaying(false);
  }
  /** Moves to a step. With `settle`, it lands on the moment the step arrived and pauses there,
   *  so a failed step is shown with its error instead of mid-flight. */
  seek(index: number, settle = false) {
    const n = this.flow.steps.length;
    if (!n) return;
    this.step = Math.max(0, Math.min(n - 1, index));
    this.t = settle ? 0.74 : 0;
    if (settle) this.setPlaying(false);
    this.ended = false;
    this.opts.onStepChange(this.step, false);
  }
  setSpeed(speed: number) {
    this.speed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  }
  setOverview(overview: boolean) {
    this.overview = overview;
  }
  zoom(factor: number) {
    this.zoomFactor = Math.max(0.5, Math.min(2, this.zoomFactor * factor));
  }
  resetCamera() {
    this.userYaw = 0;
    this.zoomFactor = 1;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (material) ([] as THREE.Material[]).concat(material).forEach((m) => m.dispose());
    });
    Object.values(this.textures).forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.remove();
  }

  // ---------- build ----------
  private styleTag(el: HTMLDivElement) {
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      whiteSpace: "nowrap",
      font: '600 11px/1 ui-monospace, "JetBrains Mono", Menlo, monospace',
      color: "#14110a",
      padding: "5px 8px",
      borderRadius: "5px",
      opacity: "0",
      transition: "opacity .2s",
      boxShadow: "0 4px 14px rgba(0,0,0,.4)",
      maxWidth: "260px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
  }

  private build() {
    const firstStep = new Map<string, number>();
    this.flow.steps.forEach((s, i) => {
      if (!firstStep.has(s.fromId)) firstStep.set(s.fromId, i);
      if (!firstStep.has(s.toId)) firstStep.set(s.toId, i);
    });

    // Place dependencies in separate lanes: fan-out stays visible instead of a single row.
    const levels = new Map<string, number>();
    if (this.flow.nodes.length) levels.set(this.flow.nodes[0].id, 0);
    this.flow.steps.forEach((step) => {
      if (!levels.has(step.fromId)) levels.set(step.fromId, 1);
      if (!levels.has(step.toId)) levels.set(step.toId, levels.get(step.fromId)! + 1);
    });
    const columns = new Map<number, FlowNode[]>();
    this.flow.nodes.forEach((node) => {
      const level = Math.min(levels.get(node.id) ?? 1, 8);
      const column = columns.get(level) ?? [];
      column.push(node);
      columns.set(level, column);
    });
    const maxLevel = Math.max(0, ...columns.keys());
    const maxLane = Math.max(1, ...[...columns.values()].map((col) => col.length));
    columns.forEach((column, level) =>
      column.forEach((node, lane) => {
        const view = this.makeNode(node, firstStep.get(node.id) ?? 0);
        view.group.position.set(
          (level - maxLevel / 2) * 3.8,
          0,
          (lane - (column.length - 1) / 2) * 3.6,
        );
        view.group.traverse((obj) => {
          obj.userData.flowNodeId = node.id;
        });
        this.scene.add(view.group);
        this.nodes.set(node.id, view);
      }),
    );
    this.extent = Math.max((maxLevel + 1) * 3.8, maxLane * 3.6);

    this.flow.steps.forEach((step) => {
      const from = this.nodes.get(step.fromId);
      const to = this.nodes.get(step.toId);
      if (!from || !to || from === to) {
        this.edges.push({ step, curve: null, line: null, count: 0, arrow: null });
        return;
      }
      const a = from.group.position.clone();
      const b = to.group.position.clone();
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 1 + a.distanceTo(b) * 0.18;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const pts = curve.getPoints(80);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const color = step.state === "error" ? ERROR_COLOR : TRAFFIC_COLORS[step.traffic];
      const material = DASHED[step.traffic]
        ? new THREE.LineDashedMaterial({
            color,
            dashSize: 0.22,
            gapSize: 0.14,
            transparent: true,
            opacity: 0.9,
          })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, material);
      if (DASHED[step.traffic]) line.computeLineDistances();
      geo.setDrawRange(0, 0);
      this.scene.add(line);
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.36, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      arrow.position.copy(curve.getPoint(0.7));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        curve.getTangent(0.7).normalize(),
      );
      this.scene.add(arrow);
      this.edges.push({ step, curve, line, count: pts.length, arrow });
    });
  }

  private makeNode(node: FlowNode, firstStep: number): NodeView {
    const color = NODE_COLORS[node.kind];
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.15,
      emissive: color,
      emissiveIntensity: 0.12,
    });
    const group = new THREE.Group();
    const faced = (w: number, h: number, d: number, map: THREE.Texture) => {
      const face = new THREE.MeshBasicMaterial({ map });
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
        material,
        material,
        material,
        material,
        face,
        face,
      ]);
    };
    let labelY = 1;
    let animate: ((t: number) => void) | undefined;

    switch (node.kind) {
      case "caller":
        group.add(faced(1.8, 1.15, 0.08, this.textures.browser));
        labelY = 0.85;
        break;
      case "service":
        group.add(faced(1.45, 0.95, 0.7, this.textures.service));
        labelY = 0.8;
        break;
      case "database": {
        for (let i = 0; i < 3; i++) {
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 36), material);
          disc.position.y = -0.38 + i * 0.38;
          group.add(disc);
        }
        break;
      }
      case "cache": {
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 36), material));
        const bolt = new THREE.Mesh(
          boltGeometry(),
          new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        bolt.position.set(0, 0, 0.62);
        group.add(bolt);
        labelY = 0.85;
        break;
      }
      case "queue": {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 1.9, 28, 1, true),
          new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
          }),
        );
        tube.rotation.z = Math.PI / 2;
        group.add(tube);
        [-0.95, 0.95].forEach((x) => {
          const cap = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 10, 32), material);
          cap.rotation.y = Math.PI / 2;
          cap.position.x = x;
          group.add(cap);
        });
        const envelope = new THREE.MeshBasicMaterial({ map: this.textures.envelope });
        const envs = [0, 1, 2].map(() => {
          const e = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.03), envelope);
          group.add(e);
          return e;
        });
        animate = (t) =>
          envs.forEach((e, i) => {
            e.position.x = -0.8 + ((t * 0.35 + i / 3) % 1) * 1.6;
          });
        labelY = 0.75;
        break;
      }
      default: {
        const blobs: [number, number, number][] = [
          [0, 0.08, 0.46],
          [-0.46, -0.08, 0.34],
          [0.46, -0.06, 0.36],
          [0.2, 0.36, 0.3],
          [-0.22, 0.3, 0.28],
        ];
        blobs.forEach(([x, y, r]) => {
          const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), material);
          blob.position.set(x, y, 0);
          blob.scale.z = 0.7;
          group.add(blob);
        });
        labelY = 0.95;
      }
    }

    // A flat ring on the floor marks the node where the error started.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.12, 48),
      new THREE.MeshBasicMaterial({
        color: ERROR_COLOR,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.85;
    group.add(ring);
    group.scale.setScalar(0.001);

    const label = document.createElement("button");
    label.type = "button";
    label.setAttribute("aria-label", `Inspect ${node.label}`);
    label.addEventListener("click", () => this.opts.onNodeSelect?.(node.id));
    Object.assign(label.style, {
      position: "absolute",
      pointerEvents: "auto",
      cursor: "pointer",
      left: "0",
      top: "0",
      whiteSpace: "nowrap",
      font: '500 11px/1.25 ui-monospace, "JetBrains Mono", Menlo, monospace',
      padding: "3px 7px",
      borderRadius: "5px",
      background: "rgba(12,17,32,.85)",
      color: "#e7ecf5",
      border: "1px solid #27334f",
      opacity: "0",
      transition: "opacity .25s, border-color .25s",
      maxWidth: "220px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    label.textContent = node.label;
    this.labels.appendChild(label);

    const failures = this.flow.steps.filter((s) => s.toId === node.id && s.state === "error");
    const origins = failures.filter((s) => s.isErrorOrigin);
    return {
      node,
      group,
      material,
      ring,
      label,
      labelY,
      firstStep,
      phase: firstStep * 2.4,
      animate,
      firstFailure: failures.length ? failures[0].index : -1,
      firstOrigin: origins.length ? origins[0].index : -1,
      visible: false,
      active: false,
      labelText: "",
    };
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.style.cursor = "grab";
    el.style.touchAction = "pan-y";
    let startX = 0;
    let startY = 0;
    el.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
      startY = e.clientY;
      this.dragX = e.clientX;
      el.style.cursor = "grabbing";
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (this.dragX === null) return;
      this.userYaw += (e.clientX - this.dragX) * 0.006;
      this.dragX = e.clientX;
    });
    const end = () => {
      this.dragX = null;
      el.style.cursor = "grab";
    };
    el.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) {
        const rect = el.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(pointer, this.camera);
        const hit = ray
          .intersectObjects(
            [...this.nodes.values()].map((n) => n.group),
            true,
          )
          .find((h) => h.object.userData.flowNodeId);
        if (hit) this.opts.onNodeSelect?.(hit.object.userData.flowNodeId);
      }
      end();
    });
    el.addEventListener("pointercancel", end);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setPlaying(playing: boolean) {
    if (this.playing === playing) return;
    this.playing = playing;
    this.opts.onPlayingChange(playing);
  }

  private finish() {
    this.ended = true;
    this.setPlaying(false);
    this.opts.onStepChange(this.step, true);
  }

  // ---------- frame ----------
  private advancePlayback(dt: number) {
    if (!this.playing || this.ended || this.flow.steps.length === 0) return;
    this.t += (dt * this.speed) / STEP_SECONDS;
    if (this.t < 1) return;
    if (this.step < this.flow.steps.length - 1) {
      this.step++;
      this.t = 0;
      this.opts.onStepChange(this.step, false);
    } else {
      this.t = 1;
      this.finish();
    }
  }

  private nodeScale(view: NodeView, id: string, p: number, reduced: boolean, cur: FlowStep | null) {
    if (this.overview || this.ended || view.firstStep < this.step) return 1;
    if (view.firstStep > this.step) return 0.001;
    const start = cur?.fromId === id ? 0 : 0.08;
    const progress = reduced ? 1 : clamp01((p - start) / 0.22);
    return Math.max(0.001, easeOutBack(progress));
  }

  private reached(index: number, q: number) {
    return (
      index >= 0 &&
      (this.overview || this.ended || index < this.step || (index === this.step && q >= 1))
    );
  }

  private nodeColor(view: NodeView, origin: boolean, failure: boolean) {
    if (origin) return ERROR_COLOR;
    if (failure) return PROPAGATED_COLOR;
    return NODE_COLORS[view.node.kind];
  }

  private emissiveIntensity(hit: boolean, active: boolean, origin: boolean) {
    if (hit) return 0.45 + 0.25 * Math.sin(this.clock * 6);
    if (active) return 0.3;
    if (origin) return 0.3 + 0.15 * Math.sin(this.clock * 3);
    return 0.12;
  }

  private updateNodeLabel(view: NodeView, origin: boolean, active: boolean) {
    let border = "#27334f";
    if (origin) border = css(ERROR_COLOR);
    else if (active) border = "#ffc857";
    view.label.style.borderColor = border;
    const label = origin ? `✕ ${view.node.label} · error started here` : view.node.label;
    if (label !== view.labelText) {
      view.labelText = label;
      view.label.textContent = label;
    }
  }

  private updateNodes(p: number, q: number, cur: FlowStep | null, reduced: boolean) {
    for (const [id, view] of this.nodes) {
      const scale = this.nodeScale(view, id, p, reduced, cur);
      view.group.scale.setScalar(scale);
      view.group.rotation.y =
        this.camYaw + (reduced ? 0 : Math.sin(this.clock * 0.6 + view.phase) * 0.15);
      view.group.position.y = reduced ? 0 : Math.sin(this.clock * 1.2 + view.phase) * 0.05;
      if (!reduced) view.animate?.(this.clock + view.phase);
      // Failure colours are revealed when reached, or immediately in the overview.
      const origin = this.reached(view.firstOrigin, q);
      const failure = this.reached(view.firstFailure, q);
      const isTarget = cur?.toId === id;
      const isSource = cur?.fromId === id;
      const color = this.nodeColor(view, origin, failure);
      view.material.color.setHex(color);
      view.material.emissive.setHex(color);
      view.material.emissiveIntensity = this.emissiveIntensity(
        isTarget && q >= 1,
        isTarget || isSource,
        origin,
      );
      const ring = view.ring.material as THREE.MeshBasicMaterial;
      ring.opacity = origin ? 0.55 + 0.35 * Math.sin(this.clock * 3) : 0;
      const active = Boolean(isTarget || (isSource && q < 1));
      this.updateNodeLabel(view, origin, active);
      view.visible = scale > 0.2;
      view.active = active;
    }
  }

  private edgeProgress(index: number, q: number) {
    if (this.overview || this.ended || index < this.step) return 1;
    if (index > this.step) return 0;
    return q;
  }

  private edgeOpacity(index: number) {
    if (!this.ended && index === this.step) return 1;
    return this.overview ? 0.22 : 0.35;
  }

  private updateEdges(q: number) {
    for (const [index, edge] of this.edges.entries()) {
      if (!edge.line) continue;
      const progress = this.edgeProgress(index, q);
      edge.line.geometry.setDrawRange(0, Math.floor(progress * edge.count));
      if (edge.arrow) {
        edge.arrow.visible = progress >= 0.7;
        (edge.arrow.material as THREE.MeshBasicMaterial).opacity = index === this.step ? 1 : 0.4;
      }
      (edge.line.material as THREE.LineBasicMaterial).opacity = this.edgeOpacity(index);
    }
  }

  private packetColor(cur: FlowStep) {
    if (cur.state === "error") return ERROR_COLOR;
    if (cur.state === "warning") return WARNING_COLOR;
    return TRAFFIC_COLORS[cur.traffic];
  }

  private movePacket(
    cur: FlowStep,
    edge: EdgeView | undefined,
    target: NodeView | undefined,
    p: number,
    q: number,
    color: number,
  ) {
    if (edge?.curve && q > 0 && q < 1) {
      this.packets[cur.traffic].visible = true;
      edge.curve.getPoint(q, this.packet.position);
      this.packet.rotation.set(
        cur.traffic === "data" || cur.traffic === "cache" ? 0.5 : 0,
        this.camYaw,
        0,
      );
      this.packetLight.color.setHex(color);
      return true;
    }
    if (target && p > 0.2 && p < 0.95) {
      this.packet.position.copy(target.group.position);
      this.packet.position.y += target.labelY + 0.2;
      if (!edge?.curve) {
        this.packets.call.visible = true;
        return true;
      }
    }
    return false;
  }

  private showFailureBurst(
    target: NodeView | undefined,
    p: number,
    q: number,
    reduced: boolean,
    failing: boolean,
  ) {
    if (!failing || !target || q < 1 || reduced) return false;
    const progress = clamp01((p - 0.7) / 0.3);
    this.burst.visible = true;
    this.burst.position.copy(target.group.position);
    this.burst.lookAt(this.camera.position);
    this.burst.scale.setScalar(1 + progress * 4);
    (this.burst.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
    this.packets.error.visible = true;
    this.packet.position.copy(target.group.position);
    this.packet.position.y += target.labelY + 0.3;
    this.packet.rotation.y = this.clock * 3;
    return true;
  }

  private updatePacketTag(cur: FlowStep, color: number) {
    const failing = cur.state === "error";
    const tag = failing ? `✕ ${cur.tag} · ${cur.statusLabel}` : cur.tag;
    if (this.packetTag.textContent === tag) return;
    this.packetTag.textContent = tag;
    this.packetTag.style.background = css(color);
    this.packetTag.style.color = failing ? "#fff" : "#14110a";
  }

  private updatePacket(p: number, q: number, cur: FlowStep | null, reduced: boolean) {
    for (const mesh of Object.values(this.packets)) mesh.visible = false;
    this.burst.visible = false;
    if (!cur) return false;
    const edge = this.edges[this.step];
    const target = this.nodes.get(cur.toId);
    const color = this.packetColor(cur);
    let tagVisible = this.movePacket(cur, edge, target, p, q, color);
    if (this.showFailureBurst(target, p, q, reduced, cur.state === "error")) tagVisible = true;
    if (tagVisible) this.updatePacketTag(cur, color);
    return tagVisible;
  }

  private updateCamera(cur: FlowStep | null, reduced: boolean, dt: number) {
    let radiusGoal: number;
    const a = cur ? this.nodes.get(cur.fromId)?.group.position : undefined;
    const b = cur ? this.nodes.get(cur.toId)?.group.position : undefined;
    if (a && b && !this.overview) {
      this.camGoal.copy(a).add(b).multiplyScalar(0.5);
      radiusGoal = 9 + a.distanceTo(b) * 0.55;
    } else {
      this.camGoal.copy(this.center);
      radiusGoal = Math.max(12, this.extent * 0.75 + 6);
    }
    if (this.camera.aspect < 1) radiusGoal *= 1.35;
    radiusGoal *= this.zoomFactor;
    const blend = reduced ? 1 : 1 - Math.pow(0.02, dt);
    this.camTarget.lerp(this.camGoal, blend);
    this.camRadius += (radiusGoal - this.camRadius) * blend;
    this.camYaw = 0.42 + this.userYaw + (reduced ? 0 : Math.sin(this.clock * 0.15) * 0.1);
    const pitch = 0.52;
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.camYaw) * Math.cos(pitch) * this.camRadius,
      this.camTarget.y + Math.sin(pitch) * this.camRadius,
      this.camTarget.z + Math.cos(this.camYaw) * Math.cos(pitch) * this.camRadius,
    );
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  }

  private positionLabel(label: HTMLElement, width: number, height: number, offset = 0) {
    const x = (this.tmp.x * 0.5 + 0.5) * width;
    const y = (-this.tmp.y * 0.5 + 0.5) * height;
    label.style.transform = `translate(${x.toFixed(1)}px, ${(y - offset).toFixed(1)}px) translate(-50%, -100%)`;
  }

  private updateLabels(cur: FlowStep | null, tagVisible: boolean) {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    for (const view of this.nodes.values()) {
      this.tmp.copy(view.group.position);
      this.tmp.y += view.labelY + 0.15;
      this.tmp.project(this.camera);
      const onScreen = view.visible && this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.2;
      view.label.style.visibility = onScreen ? "visible" : "hidden";
      let opacity = "0";
      if (onScreen) opacity = view.active || !cur ? "1" : "0.72";
      view.label.style.opacity = opacity;
      this.positionLabel(view.label, width, height);
    }
    if (tagVisible) {
      this.tmp.copy(this.packet.position);
      this.tmp.project(this.camera);
      this.packetTag.style.opacity = "1";
      this.positionLabel(this.packetTag, width, height, 20);
    } else {
      this.packetTag.style.opacity = "0";
    }
  }

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    const reduced = Boolean(this.opts.reducedMotion);
    this.advancePlayback(dt);
    const p = this.ended ? 1 : this.t;
    let q = easeInOut(clamp01((p - 0.2) / 0.5));
    if (reduced) q = p > 0.3 ? 1 : 0;
    const cur = this.ended || this.flow.steps.length === 0 ? null : this.flow.steps[this.step];
    this.updateNodes(p, q, cur, reduced);
    this.updateEdges(q);
    const tagVisible = this.updatePacket(p, q, cur, reduced);
    this.updateCamera(cur, reduced, dt);
    this.updateLabels(cur, tagVisible);
    this.frameId = requestAnimationFrame(this.frame);
  };
}

export const createTraceFlowScene = (
  host: HTMLElement,
  flow: TraceFlow,
  opts: TraceFlowSceneOptions,
) => new TraceFlowScene(host, flow, opts);

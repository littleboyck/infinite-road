/**
 * track.js —— 闭环赛道采样器
 *
 * track.json 的 points 是 glTF 坐标系（Y 向上）下的闭环中心线，约 1 m 一个点，
 * 最后一个点几乎回到起点。这里把它预处理成累计弧长，并提供按弧长等距采样：
 *   - 位置用相邻两点线性插值；
 *   - 朝向用每点中心差分求切线，再按角度插值，避免在接缝处出现车头跳变。
 */
import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

/** 把角度归一化到 (-π, π] */
function wrapAngle(a) {
  a = (a + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

export class TrackPath {
  constructor(data) {
    this.data = data;
    this.closed = data.closed !== false;

    // 去掉重复的收尾点：最后一个点与第一个点重合时不该当作独立采样点
    let pts = data.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (this.closed && pts.length > 1) {
      const d = pts[0].distanceTo(pts[pts.length - 1]);
      if (d < 0.5) pts = pts.slice(0, -1);
    }
    // 统一首点的切线基准（数据里首点位于原点附近，切线沿 +X）
    this.points = pts;
    this.count = pts.length;

    this._buildCumulative();
    this._buildHeadings();

    // 赛道元数据（车道、桥面宽等）
    this.deckHalfWidth = data.deckHalfWidth ?? 6.5;
    this.laneCenters = data.laneCenters ?? [-3.5, 0, 3.5];
    this.laneWidth = data.laneWidth ?? 3.5;
  }

  /** 累计弧长（含闭环收尾段） */
  _buildCumulative() {
    const n = this.count;
    const cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const a = this.points[i];
      const b = this.points[(i + 1) % n];
      cum[i + 1] = cum[i] + a.distanceTo(b);
    }
    this.cum = cum;
    this.totalLength = cum[n];
  }

  /** 每个采样点的航向角 yaw = atan2(tx, tz)，让物体 +Z 轴对准前进方向 */
  _buildHeadings() {
    const n = this.count;
    const h = new Float32Array(n);
    // 用 ±2 个点做中心差分，削掉 1 m 折线带来的朝向毛刺
    const k = 2;
    for (let i = 0; i < n; i++) {
      const a = this.points[(i - k + n) % n];
      const b = this.points[(i + k) % n];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      h[i] = Math.atan2(dx, dz);
    }
    this.headings = h;

    // 每段缓存的航向增量（处理 ±π 边界）
    const delta = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      delta[i] = wrapAngle(h[(i + 1) % n] - h[i]);
    }
    this.headingDelta = delta;
  }

  /** 定位弧长 s 所在的段：返回段索引 i 与段内系数 t∈[0,1) */
  _locate(s) {
    const L = this.totalLength;
    if (s < 0) s = ((s % L) + L) % L;
    else if (s >= L) s = s % L;

    const cum = this.cum;
    // 二分查找
    let lo = 0;
    let hi = this.count; // cum 长度 = count + 1
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const i = Math.min(lo, this.count - 1);
    const segLen = cum[i + 1] - cum[i] || 1e-6;
    return { i, t: Math.min(1, (s - cum[i]) / segLen), s };
  }

  /**
   * 在弧长 s 处采样。
   * 返回 { position, tangent, right, yaw }，position/tangent/right 均为复用对象外的
   * 新 Vector3（调用方可直接持有，但热路径请用 sampleInto 避免 GC）。
   */
  sample(s, out = {}) {
    const { i, t } = this._locate(s);
    const n = this.count;
    const a = this.points[i];
    const b = this.points[(i + 1) % n];

    const pos = (out.position ??= new THREE.Vector3());
    pos.lerpVectors(a, b, t);

    const yaw = this.headings[i] + this.headingDelta[i] * t;
    const tx = Math.sin(yaw);
    const tz = Math.cos(yaw);

    const tangent = (out.tangent ??= new THREE.Vector3());
    tangent.set(tx, 0, tz);

    // right = tangent × up  （up = +Y）
    const right = (out.right ??= new THREE.Vector3());
    right.set(-tz, 0, tx);

    out.yaw = yaw;
    out.position = pos;
    out.tangent = tangent;
    out.right = right;
    return out;
  }

  /**
   * 把横向偏移（沿 right 方向为正）应用到采样点上。
   * laneCenters 用「车行方向左侧为负」的约定：负值在右手边。
   * 因此 u = -laneCenter（见 main.js 中的说明）。
   */
  positionWithLateral(s, lateral, out = new THREE.Vector3()) {
    const r = this.sample(s, this._scratch ??= {});
    return out.copy(r.position).addScaledVector(r.right, lateral);
  }
}

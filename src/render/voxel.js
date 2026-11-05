import * as THREE from "three";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const color = new THREE.Color();

export const solidVoxelMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.88,
  metalness: 0.04,
});

export class VoxelBuilder {
  constructor() {
    this.items = [];
  }

  box(x, y, z, width, height, depth, tint, rx = 0, ry = 0, rz = 0) {
    this.items.push({ x, y, z, width, height, depth, tint, rx, ry, rz });
    return this;
  }

  beam(a, b, thickness, tint) {
    const start = new THREE.Vector3(a.x, a.y, a.z);
    const end = new THREE.Vector3(b.x, b.y, b.z);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.0001) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    this.items.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
      width: thickness,
      height: length,
      depth: thickness,
      tint,
      quaternion: q,
    });
    return this;
  }

  build({ name = "voxels", material = solidVoxelMaterial, castShadow = true, receiveShadow = true } = {}) {
    const mesh = new THREE.InstancedMesh(unitBox, material, this.items.length);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = true;
    for (let i = 0; i < this.items.length; i += 1) {
      const item = this.items[i];
      position.set(item.x, item.y, item.z);
      scale.set(item.width, item.height, item.depth);
      if (item.quaternion) quaternion.copy(item.quaternion);
      else quaternion.setFromEuler(euler.set(item.rx || 0, item.ry || 0, item.rz || 0));
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.setHex(item.tint));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  group(options = {}) {
    const group = new THREE.Group();
    group.name = options.name || "voxel-group";
    if (this.items.length) group.add(this.build(options));
    return group;
  }
}

export function voxelGroup(name, draw, options = {}) {
  const builder = new VoxelBuilder();
  draw(builder);
  return builder.group({ ...options, name });
}

export function boxMesh(width, height, depth, material) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createSign(text, subtitle, width = 6, height = 2.2, colors = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colors.background || "#e7d9ad";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.band || "#e2a72c";
  ctx.fillRect(0, 0, canvas.width, 40);
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18);
  ctx.strokeStyle = colors.foreground || "#233238";
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = colors.foreground || "#233238";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 84px 'Microsoft YaHei', sans-serif";
  ctx.fillText(text, canvas.width / 2, 132);
  if (subtitle) {
    ctx.font = "500 29px 'Microsoft YaHei', sans-serif";
    ctx.fillText(subtitle, canvas.width / 2, 224);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.castShadow = false;
  return mesh;
}

export function setShadowRecursive(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

export { unitBox };

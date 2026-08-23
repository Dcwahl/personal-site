import { buildScene } from "./scene.js";

const svg = document.querySelector(".room__seams");
const door = document.querySelector(".room__door");

const path = (points) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

export function layoutRoom() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scene = buildScene(width, height);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  for (const [name, points] of Object.entries(scene.seams)) {
    svg.querySelector(`[data-seam="${name}"]`).setAttribute("d", path(points));
  }

  svg.style.setProperty("--seam-weight", `${scene.inkWeight.toFixed(2)}`);

  const { a, b, c, d, e, f } = scene.door.matrix;
  door.style.width = `${scene.door.natural.width}px`;
  door.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

  return scene;
}

window.addEventListener("resize", layoutRoom);
layoutRoom();

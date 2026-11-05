import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [path.join(root, "src/main.js")],
  outfile: path.join(root, ".standalone/app.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  write: false,
  legalComments: "inline",
  sourcemap: false,
});
const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
const css = result.outputFiles.find((file) => file.path.endsWith(".css"));
if (!js || !css) throw new Error("离线打包未能生成完整的 JS / CSS");

let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace('<script type="module" src="/src/main.js"></script>', () => `<style>${css.text}</style>\n<script>${js.text.replace(/<\/script/gi, "<\\/script")}</script>`);
html = html.replace("</head>", "  <!-- 完全离线单文件版：Three.js、样式、模型与全部资源均已内嵌。 -->\n  </head>");
const output = path.join(root, "飞尘工地.html");
await writeFile(output, html, "utf8");
const bytes = Buffer.byteLength(html);
console.log(`离线单文件已生成：${output} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);

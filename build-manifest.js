// Gera manifest.prod.xml trocando localhost pela URL de producao.
// Uso: node build-manifest.js https://USUARIO.github.io/REPO
const fs = require("fs");
const path = require("path");

const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!base || !/^https:\/\//.test(base)) {
  console.error("Uso: node build-manifest.js https://USUARIO.github.io/REPO");
  process.exit(1);
}
const src = fs.readFileSync(path.join(__dirname, "manifest.xml"), "utf8");
const out = src.replace(/https:\/\/localhost:3000/g, base);
fs.writeFileSync(path.join(__dirname, "manifest.prod.xml"), out);
console.log("manifest.prod.xml gerado ->", base);

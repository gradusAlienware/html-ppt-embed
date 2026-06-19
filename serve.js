// Servidor HTTPS estatico local para o add-in.
// Usa certificado dev confiavel do office-addin-dev-certs (sem aviso de seguranca).
const https = require("https");
const fs = require("fs");
const path = require("path");
const devCerts = require("office-addin-dev-certs");

const ROOT = __dirname;
const PORT = 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

(async () => {
  const opts = await devCerts.getHttpsServerOptions();
  https.createServer(opts, (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("403"); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("404 " + p); }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(PORT, () => console.log("Servindo add-in em https://localhost:" + PORT));
})();

// Gera apps.json a partir das ferramentas freeform PUBLICAS da org GradusAnalytics.
// Fonte = GitHub (repos publicos com Pages). Nao usa a API do PPR (sem CORS / instavel).
// Token: env GH_TOKEN (ou GITHUB_TOKEN no Action). Leitura de repo publico funciona sem,
// mas com token evita rate limit.
const fs = require("fs");
const path = require("path");

const ORG = "GradusAnalytics";
const PAGES_BASE = "https://gradusanalytics.github.io";
// Repos que NAO sao ferramentas (templates, infra, lixo de teste)
const DENY = new Set([
  "analytics-standard-template",
  "analytics-freeform-template",
  "analytics_resources",
  "teste",
]);
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

async function gh(url, raw = false) {
  const headers = {
    "Accept": raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "User-Agent": "ppt-embed-sync",
  };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} :: ${url}`);
  return raw ? r.text() : r.json();
}

async function listRepos() {
  let page = 1, out = [];
  while (true) {
    const d = await gh(`https://api.github.com/orgs/${ORG}/repos?per_page=100&page=${page}`);
    out.push(...d);
    if (d.length < 100) break;
    page++;
  }
  return out.filter(r => !r.private && r.has_pages && !DENY.has(r.name));
}

// gh-pages serve duas pastas por stage: dev/ (homolog) e main/ (producao=prd).
const STAGE_FOLDER = { dev: "dev", prd: "main" };

// Lista os .html de uma pasta de stage no gh-pages. Vazio se nao existir.
async function stageHtmls(repo, folder) {
  let items;
  try {
    items = await gh(`https://api.github.com/repos/${ORG}/${repo}/contents/${folder}?ref=gh-pages`);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(items)) return [];
  return items.filter(x => x.type === "file" && x.name.toLowerCase().endsWith(".html"));
}

const byLen = (a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name);

// Escolhe o html "principal" de cada stage. Prefere nome comum aos dois stages
// (mesma ferramenta), senao o menor non-index, senao index.html.
function pickFiles(devList, prdList) {
  const devNon = devList.filter(x => x.name.toLowerCase() !== "index.html").sort(byLen);
  const prdNon = prdList.filter(x => x.name.toLowerCase() !== "index.html").sort(byLen);
  const common = devNon.filter(d => prdNon.some(p => p.name === d.name)).sort(byLen);
  let dev, prd;
  if (common.length) {
    dev = devList.find(x => x.name === common[0].name);
    prd = prdList.find(x => x.name === common[0].name);
  } else {
    dev = devNon[0] || devList.find(x => x.name.toLowerCase() === "index.html");
    prd = prdNon[0] || prdList.find(x => x.name.toLowerCase() === "index.html");
  }
  return { dev, prd };
}

function titleFrom(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? m[1].replace(/\s+/g, " ").trim() : "";
  return t || fallback;
}

(async () => {
  if (!TOKEN) console.warn("Aviso: sem token, sujeito a rate limit do GitHub.");
  const repos = await listRepos();
  const apps = [];
  for (const r of repos) {
    const devList = await stageHtmls(r.name, STAGE_FOLDER.dev);
    const prdList = await stageHtmls(r.name, STAGE_FOLDER.prd);
    if (!devList.length && !prdList.length) continue;
    const { dev, prd } = pickFiles(devList, prdList);
    const entry = { repo: r.name };
    if (dev) entry.dev = `${PAGES_BASE}/${r.name}/${STAGE_FOLDER.dev}/${dev.name}`;
    if (prd) entry.prd = `${PAGES_BASE}/${r.name}/${STAGE_FOLDER.prd}/${prd.name}`;
    // nome = <title> do arquivo non-index (prefere prd); evita pegar wrapper index.html
    let name = r.name;
    const cands = [prd, dev].filter(Boolean);
    const src = cands.find(f => f.name.toLowerCase() !== "index.html") || cands[0];
    try { name = titleFrom(await gh(src.download_url, true), r.name); } catch (e) {}
    entry.name = name;
    apps.push(entry);
  }
  apps.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const out = apps.map(({ name, dev, prd }) => ({ name, ...(dev ? { dev } : {}), ...(prd ? { prd } : {}) }));
  fs.writeFileSync(path.join(__dirname, "apps.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`apps.json gerado: ${out.length} ferramentas`);
  apps.forEach(a => console.log(`  ${a.name}  <-  ${a.repo}  [${a.dev ? "dev" : ""}${a.dev && a.prd ? "+" : ""}${a.prd ? "prd" : ""}]`));
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });

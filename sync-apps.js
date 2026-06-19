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

// HTML da ferramenta = .html em gh-pages/dev/, preferindo o que NAO e index.html
async function htmlsForRepo(repo) {
  let items;
  try {
    items = await gh(`https://api.github.com/repos/${ORG}/${repo}/contents/dev?ref=gh-pages`);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const htmls = items.filter(x => x.type === "file" && x.name.toLowerCase().endsWith(".html"));
  const nonIndex = htmls.filter(x => x.name.toLowerCase() !== "index.html");
  return nonIndex.length ? nonIndex : htmls;
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
    const htmls = await htmlsForRepo(r.name);
    for (const h of htmls) {
      const url = `${PAGES_BASE}/${r.name}/dev/${h.name}`;
      let name = r.name;
      try { name = titleFrom(await gh(h.download_url, true), r.name); } catch (e) {}
      apps.push({ name, url, repo: r.name });
    }
  }
  apps.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const out = apps.map(({ name, url }) => ({ name, url }));
  fs.writeFileSync(path.join(__dirname, "apps.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`apps.json gerado: ${out.length} ferramentas`);
  apps.forEach(a => console.log(`  ${a.name}  <-  ${a.repo}`));
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });

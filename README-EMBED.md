# Embed HTML interativo no PowerPoint (Content Add-in generico)

UM add-in embeda QUALQUER HTML (via URL) vivo dentro do slide. Engine = Edge
WebView2, entao CSS moderno e JS funcionam. `bolao-completo.html` e so um exemplo.

## Como funciona

```
PowerPoint slide
  -> Content Add-in (manifest.xml)
       -> SourceLocation .../index.html  (PICKER)
            -> usuario escolhe favorito (apps.json) OU cola URL
                 -> iframe -> HTML alvo (qualquer URL https acessivel)
                      -> escolha salva no .pptx (Office settings)
```

- `manifest.xml`  - declara o add-in (tipo ContentApp, host Presentation)
- `index.html`    - PICKER: dropdown de favoritos + campo de URL + iframe
- `apps.json`     - lista de favoritos [{name,url}] (editavel)
- `serve.js`      - servidor HTTPS local p/ dev (cert dev confiavel)
- `bolao-completo.html` - HTML de exemplo/teste

### Requisitos do HTML alvo
- Tem que estar numa URL HTTP(S) que a maquina alcance (publica OU intranet OU localhost).
- Arquivo solto no disco (file://) NAO funciona.
- Nao pode bloquear iframe (sem X-Frame-Options: DENY / frame-ancestors restritivo).
  GitHub Pages permite iframe -> ok.

### Favoritos vem do PPR (sync automatico)
`apps.json` e GERADO por `sync-apps.js` a partir das ferramentas freeform PUBLICAS
da org GradusAnalytics (repos publicos com Pages, exceto templates/teste).

Fluxo: cria freeform no PPR -> gera repo publico em github.io/GradusAnalytics/{code}/dev/
-> sync monta apps.json -> picker lista. Cada tool: nome = <title> do HTML, url = pagina.

Rodar manual:  `set GH_TOKEN=...  &&  node sync-apps.js`
Automatico:    GitHub Action `.github/workflows/sync-apps.yml` (cron horario + botao
               manual em Actions -> Run workflow). Requer PAT com scope `workflow`
               para publicar o .yml; o sync em si usa github.token (le repos publicos).

Adicionar tool fora do PPR: cola a URL https direto no campo do picker (nao precisa
estar no apps.json). Ou edita apps.json na mao (sera sobrescrito no proximo sync).

### Limitacao - persistencia por documento
A escolha e salva via Office settings = nivel DOCUMENTO, por add-in. Dois add-ins
do mesmo tipo no mesmo .pptx compartilham a ultima escolha salva. Para HTMLs
diferentes em slides diferentes do MESMO deck, use o botao "Trocar HTML" ao
apresentar, ou mantenha 1 HTML por deck.

## Setup (1x)

```powershell
npm install
npm run certs      # instala cert dev confiavel (aceitar prompt do Windows)
```

## Rodar

Terminal 1 - servidor:
```powershell
npm run dev-server
```

Terminal 2 - sideload no PowerPoint:
```powershell
npm run sideload
```

PowerPoint abre. Inserir -> Meus Suplementos -> DESENVOLVEDOR -> "HTML Embed".
Add-in cai no slide mostrando o PICKER. Escolhe favorito ou cola URL -> carrega.
Botao "Trocar HTML" (canto sup. dir.) volta ao picker.

Parar sideload depois:
```powershell
npm run stop
```

## OFFLINE - ja vendorizado

Deps do app baixadas pra `vendor/` (servidas do localhost, SEM internet):
- `vendor/xlsx.full.min.js`        (era cdnjs)
- `vendor/fonts/nunito.css` + woff2 (era Google Fonts)
- `vendor/flags/*.png` (48 paises)  (era flagcdn.com)

`bolao-completo.html` ja aponta pra esses caminhos locais. Zero CDN no app.

### office.js (unica excecao)
office.js NAO e auto-hospedavel (e um loader que puxa varios arquivos
versionados da CDN Microsoft). `index.html` foi feito pra renderizar o app
MESMO SE office.js falhar (offline) - nao bloqueia. O WebView2 do PowerPoint
exibe o conteudo do content add-in sem o ready signal.

### Testar offline
1. `npm run dev-server`  (localhost nao precisa de net)
2. `npm run sideload`
3. DESLIGA o Wi-Fi / cabo.
4. Inserir -> Meus Suplementos -> "HTML Embed".
5. App deve renderizar completo (fontes, bandeiras, import xlsx).

Se o add-in ficar preso em "carregando" offline (host exigindo office.js):
abre 1x ONLINE primeiro (cacheia office.js no WebView2), depois desliga net.

## Producao - GitHub Pages + catalogo pasta de rede

ATENCAO: GitHub Pages gratis serve de repo PUBLICO. Conteudo fica acessivel
a qualquer um com a URL. Sensivel -> repo privado (GitHub Pro+) ou outro host.

### A) Publicar arquivos no GitHub Pages
```powershell
gh auth login                         # 1x, interativo (rode com ! no chat)
git init
git add index.html bolao-completo.html vendor assets manifest.xml build-manifest.js package.json serve.js README-EMBED.md .gitignore
git commit -m "Add-in embed HTML no PowerPoint"
gh repo create REPO --public --source=. --push
# Habilita Pages (branch main, raiz):
gh api -X POST repos/USUARIO/REPO/pages -f "source[branch]=main" -f "source[path]=/"
```
URL final: `https://USUARIO.github.io/REPO/index.html` (leva ~1 min pra subir).

### B) Gerar manifest de producao
```powershell
npm run build:manifest -- https://USUARIO.github.io/REPO
```
Cria `manifest.prod.xml` com as URLs do Pages no lugar de localhost.

### C) Distribuir pra equipe (catalogo pasta de rede)
1. Copia `manifest.prod.xml` pra pasta compartilhada, ex: `\\servidor\addins\`.
2. Cada usuario (1x): PowerPoint -> Arquivo -> Opcoes -> Central de Confiabilidade
   -> Config. da Central -> Catalogos de Suplementos Confiaveis.
3. Cola o caminho `\\servidor\addins\`, marca "Mostrar no Menu", OK, reinicia.
4. Inserir -> Meus Suplementos -> PASTA COMPARTILHADA -> "HTML Embed".

Sem servidor local rodando - tudo vem do GitHub Pages (precisa internet ao apresentar,
exceto se voce hospedar offline numa rede interna).

### Atualizar o app depois
Edita HTML -> `git add -A; git commit -m "..."; git push`. Pages atualiza sozinho.
Nao precisa redistribuir o manifest (URLs nao mudam).

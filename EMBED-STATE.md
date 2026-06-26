# Persistência de estado no HTML embedado (viaja no .pptx)

O add-in salva o estado interno do seu HTML **dentro do `.pptx`** (Office settings),
então ele sobrevive a fechar/reabrir a apresentação — e viaja para outra máquina/usuário.

Funciona via `postMessage` entre o seu HTML (iframe) e o shell do add-in:

```
seu HTML  --STATE(estado)-->  shell  --salva no .pptx (por HTML)
reabre:   shell  --RESTORE(estado)-->  seu HTML  -> rehidrata
```

## O que fazer no seu HTML

1. Cole o snippet abaixo no final do seu HTML (antes de `</script>`/`</body>`).
2. Implemente `getState()` (serializar o estado atual) e `setState(s)` (aplicar de volta).
3. Chame `embedSave()` **toda vez que o estado mudar** (cada input/click relevante).

```html
<script>
(function(){
  // Bridge de persistencia com o add-in "HTML Embed" (PowerPoint).
  if(window.parent === window) return;   // nao embedado -> ignora, segue normal

  // ── EDITE ESTES DOIS ──────────────────────────────────────────────
  function getState(){
    // retorne um objeto serializavel (JSON) com TODO o estado a preservar
    return { /* ex: nome: input.value, dados: meusDados */ };
  }
  function setState(s){
    // aplique o estado restaurado de volta na sua UI e re-renderize
    // ex: input.value = s.nome; meusDados = s.dados; renderTudo();
  }
  // ──────────────────────────────────────────────────────────────────

  window.addEventListener("message", function(ev){
    var d = ev.data;
    if(!d || d.__embed !== true) return;
    if(d.type === "RESTORE" && d.state){ try{ setState(d.state); }catch(e){} }
    if(d.type === "STATE_TOO_BIG"){ console.warn("Estado > " + d.limit + " bytes: nao salvo no .pptx."); }
  });

  // pede o estado salvo assim que carrega
  parent.postMessage({ __embed:true, type:"READY" }, "*");

  // chame embedSave() a cada mudanca (debounced 500ms)
  var t;
  window.embedSave = function(){
    clearTimeout(t);
    t = setTimeout(function(){
      try{ parent.postMessage({ __embed:true, type:"STATE", state: getState() }, "*"); }catch(e){}
    }, 500);
  };
})();
</script>
```

## Limites

- Teto ~2 MB por HTML (cabe no `.pptx` sem inchar demais). Acima disso o shell
  manda `STATE_TOO_BIG` e **não salva** — guarde dados parseados/comprimidos, não
  o arquivo bruto (ex: xlsx grande → extraia só o que precisa).
- Estado é separado **por HTML** (URL ou nome+tamanho do arquivo). HTMLs diferentes
  não misturam estado. O mesmo HTML em dois slides compartilha (settings = nível documento).
- Sem o snippet, o HTML roda igual a antes (sem persistir). Retrocompatível.

## Exemplo real

`bolao-completo.html` já usa este bridge — veja o bloco no final do arquivo.

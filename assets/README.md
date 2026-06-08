# assets

Coloque aqui o **logo oficial da Gestão de Impacto** com o nome exato **`logo.png`**:

```
assets/logo.png
```

Recomendado: PNG com **fundo transparente**, versão **branca** (o painel é escuro), altura ~80–120px.
Pode ser .png (também aceita .svg se você renomear a referência no `index.html`).

O painel usa `assets/logo.png` automaticamente. Enquanto o arquivo não existir, ele mostra um texto provisório
("GESTÃO DE ▲ IMPACTO") — que **não** é o logo oficial, é só placeholder.

Como subir pelo terminal:
```bash
cp /caminho/do/seu/logo.png ~/projects/gestao-impacto-painel/assets/logo.png
cd ~/projects/gestao-impacto-painel && git add assets/logo.png && git commit -m "logo oficial" && git push
```

# Catálogo Musical: Atualização Novembro 2026

Página estática (HTML + JS, sem servidor) para a pessoa escolher as músicas que quer no pendrive.

- Lista as categorias e pastas da coleção, com a capa (foto do cantor), o artista e o título.
- **▶ Prévia de 30 s:** vem da API pública do Deezer (JSONP), buscada na hora do clique. **Nenhum arquivo de áudio fica hospedado aqui.**
- Caixa de seleção por música, botão "Selecionar pasta" e busca por música ou artista.
- A seleção fica salva no navegador (`localStorage`).
- **Gerar lista** baixa um `.md` ou `.txt` com as músicas escolhidas, agrupadas por pasta e com o caminho do arquivo no pendrive.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Estrutura e estilo da página, com a política de segurança (CSP). |
| `app.js` | Lógica: menu, busca, seleção, prévias e geração da lista. |
| `catalogo.js` | Dados gerados (`window.CATALOGO`). Não editar à mão. |
| `scripts/gerar_catalogo.py` | Gera o `catalogo.js` a partir das tags dos MP3. |

## Atualizar o catálogo

Depois de mudar músicas ou tags na coleção, gere o catálogo de novo. O script precisa de um Python com `mutagen`:

```bash
python scripts/gerar_catalogo.py <pasta-da-colecao> <artistas.json>
```

O segundo argumento é o cache de artistas do Deezer (nome → URL da foto) gerado na edição das tags.

## Segurança

- Site 100% estático: sem login, sem banco de dados, sem servidor próprio e sem nenhum dado pessoal.
- A CSP no `index.html` só permite código desta página e da API do Deezer. Capas e prévias vêm só do CDN do Deezer.
- Todo texto do catálogo é escapado antes de entrar no HTML.

## Publicar

É um site estático, então funciona no GitHub Pages (Settings → Pages → branch `main`, pasta `/`) ou abrindo o `index.html` direto no navegador.

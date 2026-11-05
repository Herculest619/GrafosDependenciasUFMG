# Grafos de Dependências — UFMG

Visualizador dos **pré-requisitos** das disciplinas dos cursos de graduação da UFMG.
Cada coluna do grafo é um período sugerido; cada nó é uma disciplina; cada seta indica
"esta disciplina exige aquela". Dá para marcar o que você já cursou (fica azul), o que já
está liberado (verde) e o que ainda está bloqueado (cinza), inclusive simulando
"quebra de pré-requisito".

**Site:** https://herculest619.github.io/GrafosDependenciasUFMG/

> Projeto derivado do [GrafosDependenciasUFOP](https://github.com/Herculest619/GrafosDependenciasUFOP)
> (cursos de Engenharia de Computação/Produção/Sistemas do ICEA-UFOP), reescrito para os cursos da UFMG.

## Telas

Catálogo de cursos:

![Catálogo de cursos](docs/screenshots/catalogo.png)

Grafo de um curso (Engenharia de Computação):

![Grafo de pré-requisitos](docs/screenshots/curso.png)

## Estado atual

| Curso | Fonte | Períodos | Disciplinas | Pré-requisitos | Optativas | Carga total |
|---|---|---|---|---|---|---|
| Ciência da Computação | Siga — versão curricular D-20192 | 10 | 35 | 25 | 11–17 slots | 3.240 h |
| Sistemas de Informação | Siga — percurso curricular N-2019/9 | 9 | 35 | 16 | 13 slots | 3.000 h |
| Engenharia de Computação | Siga — versão curricular V-20251 | 10 | 52 | 41 | 10 slots | 3.600 h |
| Ciência de Dados | Siga — percurso curricular V-20241 | 9 | 39 | 36 | 11 slots | 3.000 h |
| Física — Bacharelado | JSON legado (Siga 2025) | 7 | 31 | 38 | não mapeadas | — |
| Física — Licenciatura (diurno) | JSON legado (Siga 2025) | 9 | 41 | 49 | não mapeadas | — |
| Física — Licenciatura (noturno) | JSON legado (Siga 2025) | 10 | 41 | 48 | não mapeadas | — |

A UFMG tem **100 cursos de graduação**. Os dados de matriz curricular são publicados
curso a curso (não existe API pública unificada), então a cobertura cresce de forma
incremental — veja [Adicionar um curso](#adicionar-um-curso).

O parser entende os dois formatos de relatório do Siga:

- **"Relatório de versão curricular"** — uma linha por percurso dentro de cada período
  (usado em Ciência da Computação e Engenharia de Computação);
- **"Relatório de percurso curricular"** — um percurso por documento, colunas fixas
  (usado em Sistemas de Informação e Ciência de Dados).

Também trata os artefatos comuns da extração: cabeçalhos/rodapés colados nas linhas,
nomes e listas de pré-requisitos quebrados em duas linhas e blocos duplicados na virada
de página.

## Como funciona

```
data/sources/**            texto extraído dos relatórios oficiais (Siga/PROGRAD)
        │  scripts/build-data.mjs
        ▼
public/data/courses.json          catálogo (manifesto)
public/data/courses/<slug>.json   um arquivo por curso (carregado sob demanda)
        │  fetch em tempo de execução
        ▼
src/views/CatalogView.vue         catálogo com busca
src/views/CourseView.vue          grafo + progresso do curso
src/core/graph.mjs                regras puras: disponibilidade, cargas horárias, slots
```

### Modelo de dados (schema v2)

`public/data/courses.json`

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-11-05T...",
  "courses": [
    {
      "id": "ciencia-da-computacao",
      "name": "Ciência da Computação",
      "unit": "DCC — ICEX",
      "shift": "Diurno",
      "degree": "Bacharelado",
      "curriculum": "02001 · D-20192",
      "source": { "kind": "siga-versao-curricular", "url": "https://..." },
      "stats": { "disciplines": 58, "edges": 84, "periods": 10, "optionalSlots": 11 },
      "file": "data/courses/ciencia-da-computacao.json"
    }
  ]
}
```

`public/data/courses/<slug>.json`

```json
{
  "schemaVersion": 2,
  "id": "ciencia-da-computacao",
  "meta": { "...": "mesmos campos do manifesto" },
  "disciplines": {
    "DCC205": {
      "code": "DCC205",
      "name": "Estruturas de Dados",
      "type": "DIG",
      "credits": 4,
      "hours": { "total": 60, "theory": 45, "practice": 15 },
      "prereqs": ["DCC204"]
    }
  },
  "percursos": [
    {
      "id": "01-01",
      "name": "NÚCLEO COMUM / NÚCLEO AVANÇADO / NÚCLEO GERAL",
      "periods": [{ "number": 1, "codes": ["DCC203", "..."] }],
      "optionalSlots": [
        { "id": "OPT-01-01-01", "label": "Optativa 1", "hours": 60, "group": "Optativas" }
      ],
      "summary": {
        "obligatoryHours": { "min": 2040, "max": 2040 },
        "optionalHours": { "min": 660, "max": 780 },
        "complementaryHours": { "min": 0, "max": 0 },
        "freeHours": { "min": 60, "max": 180 },
        "totalHours": 3240
      }
    }
  ]
}
```

Decisões de modelagem:

- **Slots de optativa**: as optativas não são pré-requisito de nada e o aluno escolhe quais
  cursar, então o grafo mostra apenas "Optativa 1, Optativa 2, …" (sem arestas), calculados
  a partir da carga horária mínima de optativas do percurso (mínima ÷ 60 h).
- **Percurso**: quando a versão curricular permite mais de um percurso (ex.: BCC tem
  `01-01` Núcleo Comum e `01-02` Núcleo Avançado), a página permite alternar.
- **Progresso** fica no `localStorage`, separado por curso:
  `grafos-ufmg:v3:<slug>`.

## Desenvolvimento

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run check      # testes + validação dos dados + checagem dos componentes
npm run lint
```

O `npm run check` roda três verificações independentes:

1. `npm test` — 46 testes (`node --test`) das regras de grafo/progresso, do parser dos
   relatórios, da conversão para JSON v2 e da integridade dos dados publicados;
2. `npm run data:validate` — IDs duplicados, arestas órfãs, ciclos, pré-requisito em
   período posterior, faixas de carga horária e divergência entre o manifesto e os JSONs;
3. `npm run check:sfc` — compila os componentes Vue (`@vue/compiler-sfc`) e confere os
   imports relativos, sem depender do Vite.

No CI (`.github/workflows/deploy.yml`) esses passos rodam antes do build e do deploy no
GitHub Pages, junto com o `lint`.

Scripts de dados:

```sh
npm run data:build      # data/sources/**.txt -> public/data/**
npm run data:validate   # integridade dos JSONs gerados (IDs, arestas, ciclos, cargas)
npm run data:fetch      # baixa o PDF do Siga e extrai o texto (precisa de pdftotext)
```

## Adicionar um curso

1. Baixe o relatório **"Versão Curricular"** (ou **"Percurso Curricular"**) do curso no Siga
   (minhaUFMG → Relatórios) ou num site de unidade que publique o PDF.
2. Extraia o texto preservando o layout de linhas:
   ```sh
   pdftotext -layout relatorio.pdf data/sources/dcc/novo-curso.txt
   ```
   (ou `npm run data:fetch -- --url <url-do-pdf> --out data/sources/.../*.txt`)
3. Registre a origem em `data/sources/sources.json`.
4. Inclua o arquivo em `COURSES` no topo de `scripts/build-data.mjs`.
5. Rode `npm run data:build && npm run data:validate`.
6. Abra um PR — o GitHub Actions roda `npm run check` e faz o deploy.

> Curso cujo PDF não existe publicamente? Envie o PDF/relatório para o projeto ou abra
> uma issue: a extração é feita a partir do texto do relatório oficial.

## Cobertura e próximos passos

A UFMG tem ~100 cursos de graduação e **não existe API pública única** com as matrizes:
o dado autoritativo é gerado no Siga (autenticado). O levantamento de fontes está em
[docs/RELATORIO_FONTES_UFMG.md](docs/RELATORIO_FONTES_UFMG.md). Resumo:

- **~30% das unidades publicam os relatórios do Siga** nos próprios sites (DCC — 4 cursos,
  já incluídos; Farmácia, ECI, FAE — dezenas de PDFs a explorar com a mesma receita);
- **PPCs da PROGRAD não servem** como fonte: a matriz é anexo separado, sem códigos nem
  pré-requisitos na maioria dos casos;
- **horários/oferta** não têm endpoint público global — por isso a antiga aba "Tabela de
  Horários" foi removida;
- os cursos restantes dependem de pedido de dados à PROGRAD/DGI (LAI) ou de contribuição
  de quem tiver acesso ao relatório do curso.

Próximos passos naturais: colher Farmácia/ECI/FAE com o pipeline já existente; pedir a
extração oficial à PROGRAD; e criar um fluxo de contribuição (upload do PDF do relatório →
texto → `data:build` → PR).

## Limitações e avisos

- Os dados refletem a **versão curricular** do relatório usado (data registrada em
  `sources.json`) e podem estar desatualizados em relação ao Siga.
- O grafo é **apoio** ao planejamento de matrícula: a fonte de verdade é sempre o Siga e o
  colegiado do curso.
- Os cursos de Física vieram do JSON do projeto original (2025), sem carga horária e sem
  optativas mapeadas; a interface avisa isso.
- Alguns cursos têm matrizes antigas em PDF (exportação de Word) sem códigos de disciplina
  e sem pré-requisitos — esses casos não entram no grafo.
- A carga horária por disciplina usa o total informado no relatório; os slots de optativa
  assumem 60 h cada (arredondamento para cima da carga mínima de optativas).

## Licença e créditos

Código aberto para uso educacional. Dados extraídos de relatórios públicos da UFMG
(PROGRAD/Siga) e de páginas de unidades; cada arquivo aponta sua origem em
`data/sources/sources.json`.

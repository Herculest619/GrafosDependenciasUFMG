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

**23 cursos** publicados (de ~100 da UFMG), cobrindo 8 unidades/setores:

| Unidade             | Curso                                       | Versão curricular      | Períodos | Disciplinas | Pré-requisitos | Optativas    | Carga total |
| ------------------- | ------------------------------------------- | ---------------------- | -------- | ----------- | -------------- | ------------ | ----------- |
| DCC — ICEx          | Ciência da Computação                       | 02001 · D-20192        | 10       | 35          | 25             | 11–17 slots  | 3.240 h     |
| DCC — ICEx          | Sistemas de Informação                      | 02009 · N-2019/9       | 9        | 35          | 16             | 13 slots     | 3.000 h     |
| DCC — ICEx / Eng.   | Engenharia de Computação                    | 02101 · V-20251        | 10       | 52          | 41             | 10 slots     | 3.600 h     |
| DCC — ICEx          | Ciência de Dados                            | 02011 · V-20241        | 9        | 39          | 36             | 11 slots     | 3.000 h     |
| ICEx — Física       | Física — Bacharelado                        | Matriz 2019 · PPC      | 8        | 31          | 38             | 11 slots     | 2.400 h     |
| ICEx — Física       | Física — Licenciatura (diurno)              | fonte legada           | 9        | 41          | 49             | não mapeadas | —           |
| ICEx — Física       | Física — Licenciatura Noturno (matriz 2018) | texto extraído         | 9        | 35          | 33             | 12 slots     | 2.805 h     |
| IGC — Geociências   | Geografia — Licenciatura (matutino)         | 04004 · M-20271        | 10       | 43          | 27             | 7 slots      | 3.225 h     |
| IGC — Geociências   | Geografia — Licenciatura (noturno)          | 04004 · N-20271        | 10       | 43          | 27             | 7 slots      | 3.225 h     |
| IGC — Geociências   | Turismo                                     | 04003 · D-20221        | 8        | 25          | 3              | 13 slots     | 2.550 h     |
| Medicina            | Medicina                                    | 16003 · I-20212        | 12       | 79          | 117            | 7 slots      | 7.755 h     |
| ICA (Montes Claros) | Engenharia de Alimentos                     | 24003 · D-20251        | 10       | 55          | 22             | 9 slots      | 3.600 h     |
| ICA (Montes Claros) | Zootecnia                                   | 24006 · D-20261        | 10       | 50          | 20             | 13 slots     | 3.600 h     |
| ICA (Montes Claros) | Aquacultura                                 | 21001 · D2023-1        | 10       | 53          | 19             | 7 slots      | 3.600 h     |
| Farmácia            | Farmácia — Diurno                           | 18002 · D-20252        | 10       | 66          | 92             | 9 slots      | 4.170 h     |
| Farmácia            | Farmácia — Noturno                          | 18002 · N-20252        | 12       | 66          | 92             | 9 slots      | 4.170 h     |
| Farmácia            | Biomedicina                                 | 18001 · N-20262        | 10       | 40          | 48             | 7 slots      | 3.210 h     |
| ECI                 | Biblioteconomia — Diurno                    | 13002 · D-20141        | 8        | 30          | 3              | 8 slots      | 2.400 h     |
| ECI                 | Biblioteconomia — Noturno                   | 13002 · N-20141        | 8        | 30          | 3              | 8 slots      | 2.400 h     |
| ECI                 | Arquivologia                                | 13001 · N-20151        | 8        | 31          | 6              | 5 slots      | 2.400 h     |
| ECI                 | Museologia                                  | 13003 · M-20251        | 8        | 32          | 8              | 7 slots      | 2.400 h     |
| FAE                 | Pedagogia — Diurno                          | 14006 · D-20191        | 9        | 41          | 0              | 13 slots     | 3.240 h     |
| FAE                 | Pedagogia — Noturno                         | 14006 · N-20191        | 10       | 41          | 0              | 13 slots     | 3.240 h     |

A UFMG tem **100 cursos de graduação**. Os dados de matriz curricular são publicados
curso a curso (não existe API pública unificada), então a cobertura cresce de forma
incremental — veja [Adicionar um curso](#adicionar-um-curso) e
[Cobertura e próximos passos](#cobertura-e-próximos-passos).

Observações sobre os dados:

-   Pedagogia **não tem pré-requisitos** na matriz oficial (0 arestas é o dado real);
-   cursos com vários percursos (Farmácia 3, Biblioteconomia 5, Pedagogia 6, Museologia 2)
    abrem no percurso padrão e permitem alternar na página do curso;
-   o curso de Física de **fonte legada** (licenciatura diurno) não tem carga horária nem
    optativas mapeadas; a licenciatura noturna legada foi **retirada do catálogo** por
    duplicar a matriz 2018, que é a versão mais recente e a única publicada para o noturno;
-   a **matriz 2019 do Bacharelado em Física** e o **Anexo A de ementas** estão em
    `data/archives/Física Bacharelado/`, com carga horária, pré-requisitos e ementas; o
    PDF da licenciatura 2018 foi removido de `data/archives` e só o texto extraído
    permanece (o curso continua publicado);
-   as ementas do Bacharelado em Física vêm do Anexo A do PPC 2019: **60 das 90
    disciplinas** têm texto (as 31 obrigatórias + 29 optativas); as demais (tópicos
    `FIS634–646`, `ICE055–063` e disciplinas sem ementa no PDF) mostram "Ementa não
    disponível nesta fonte";
-   os **espaços de optativa são distribuídos automaticamente** entre as colunas dos
    períodos (abaixo das disciplinas), priorizando os semestres mais vazios — não existe
    mais uma coluna "Optativas" separada no fim do grafo;
-   **períodos sem disciplina obrigatória continuam no grafo**: é o caso do 8º período da
    Física 2019 (só optativas) e dos últimos períodos da Pedagogia noturno. O build
    preserva os períodos declarados no documento e a validação barra lacunas na numeração.

O parser entende **quatro** formatos de documento:

-   **"Relatório de versão curricular"** (Siga) — uma linha por percurso dentro de cada
    período (DCC, Farmácia, ECI, FAE, IGC, Medicina e ICA);
-   **"Relatório de percurso curricular"** (Siga) — um percurso por documento, colunas
    fixas (Sistemas de Informação e Ciência de Dados);
-   **"Estrutura curricular"** (PDFs mais antigos, ex. Física — Licenciatura Noturno
    2018) — blocos por período com coluna de pré-requisito e grupos de optativas
    (G1/G2/G9);
-   **"Matriz 2019 + Anexo de ementas"** (PPC do Bacharelado em Física) — tabelas de
    resumo (3.1–3.5), obrigatórias por período (4.1), optativas por grupo (4.2/4.3) e
    um **Anexo A em documento separado** com as ementas e as horas de cada disciplina.

Também trata os artefatos comuns da extração: cabeçalhos/rodapés colados nas linhas,
nomes e listas de pré-requisitos quebrados em duas linhas, blocos duplicados na virada
de página, identificadores de percurso não numéricos (`R-01`, `02-01`) e a coluna de
grupo com identificador completo (`13002-D-20141-1`).

## Como funciona

```
data/archives/*.pdf        PDFs enviados manualmente (inbox de documentos)
data/sources/**            texto extraído dos relatórios oficiais (Siga/PROGRAD/Estruturas)
        │  scripts/build-data.mjs  (parseSigaReport | parseEstruturaCurricular |
        │                           parseMatriz2019 + parseEmentas | legado)
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

Campos adicionais do formato **"matriz 2019 + Anexo de ementas"** (Bacharelado em
Física; o schema continua v2 e os demais cursos não são afetados):

```json
{
    "meta": {
        "layout": "matriz-2019",
        "source": { "kind": "estrutura-curricular-pdf", "url": "data/archives/Física Bacharelado/BacD2019.pdf" },
        "ementas": {
            "url": "data/archives/Física Bacharelado/ementas_curso_fisica_v2019.pdf",
            "retrievedAt": "2026-11-10T21:10:00-03:00",
            "note": "Anexo A do PPC 2019 fornecido pelo usuário"
        }
    },
    "disciplines": {
        "FIS634": {
            "code": "FIS634",
            "name": "Tópicos de Astrofísica A",
            "type": "OP",
            "credits": 2,
            "creditsLabel": "2–4",
            "hours": { "total": 30, "theory": null, "practice": null },
            "prereqs": [],
            "scheduled": false,
            "group": "G1",
            "period": null,
            "ementa": null
        }
    },
    "percursos": [
        {
            "id": "01-01",
            "name": "Bacharelado — formação padrão (01-01)",
            "optionalPool": [
                {
                    "code": "MAT118",
                    "name": "Variável Complexa",
                    "hours": 60,
                    "credits": 4,
                    "creditsLabel": null,
                    "group": "G1",
                    "groupName": "G1 — Optativas de Física",
                    "prereqs": ["MAT002"],
                    "period": 4,
                    "ementa": "Números complexos. Topologia de C. …"
                }
            ],
            "optionalCreditsByPeriod": { "2": 4, "3": 4, "4": 4, "5": 4, "6": 4, "7": 8, "8": 20 },
            "summary": {
                "obligatoryHours": { "min": 1680, "max": 1680 },
                "optionalHours": { "min": 660, "max": 660 },
                "freeHours": { "min": 60, "max": 60 },
                "totalHours": 2400
            }
        }
    ]
}
```

-   **`ementa`**: texto corrido do Anexo A em `disciplines[code].ementa` e
    `optionalPool[].ementa` (string ou `null`; `null` = disciplina sem ementa na fonte).
-   **`creditsLabel`**: faixa de créditos quando a fonte declara "2–4" ou "1–6" (nos
    tópicos); `credits` guarda o menor valor da faixa.
-   **`group`/`groupName`** (`G1`, `G8`, `G9`) e **`type`** (`OB`/`OP`) nas disciplinas e
    no pool; **`period`** é o período sugerido pelo Anexo A (o das obrigatórias vem da
    tabela 4.1).
-   **`optionalCreditsByPeriod`**: as linhas `OP/AAC` da tabela 4.1 (sugestão de
    créditos de optativa por período), preservadas sem virar slot.
-   **`meta.ementas`**: origem do Anexo A (url, data e nota), separada de
    `meta.source` (a matriz).

Decisões de modelagem:

-   **Painel de detalhes**: clicar no nó abre um painel com tipo (obrigatória/optativa),
    grupo, período sugerido, créditos/carga horária, **ementa** (quando a fonte traz o
    texto; senão "Ementa não disponível nesta fonte"), pré-requisitos com o status
    (cursada/faltando), disciplinas que ela libera e o atalho para marcar/desmarcar como
    cursada. Dá para marcar mesmo sem os pré-requisitos, para simular cenários.
-   **Slots de optativa**: as optativas não são pré-requisito de nada e o aluno escolhe quais
    cursar, então o grafo mostra "Optativa 1, Optativa 2, …" (sem arestas até serem
    escolhidas), calculados a partir da carga horária mínima de optativas do percurso
    (mínima ÷ 60 h). Os slots são distribuídos entre as colunas dos períodos e **numerados
    na ordem de leitura** do grafo (esquerda → direita, cima → baixo).
-   **Escolher a optativa**: clicar no espaço abre a lista de optativas do percurso
    (`optionalPool`, com nome, carga horária, grupo e pré-requisitos). A escolha substitui o
    rótulo do espaço e deixa o nó **roxo** (planejada); marcar "cursada" é um passo separado
    (aí fica **azul**) e pode ser desmarcado. A escolha cria arestas com os pré-requisitos da
    disciplina escolhida (inclusive quando o pré-requisito é outra optativa já escolhida) e
    fica salva no `localStorage` junto do progresso (`choices`). Espaços sem escolha
    continuam podendo ser marcados como cursados.
-   **Exportar imagem**: o botão "Baixar imagem" renderiza a grade inteira enquadrada como o
    "Ajustar" e baixa um PNG em resolução 2× (texto grande o suficiente para dar zoom). O
    arquivo sai como `<curso>-<percurso>-grafo.png`, então não se repete entre cursos.
-   **Percurso**: quando a versão curricular permite mais de um percurso (ex.: BCC tem
    `01-01` Núcleo Comum e `01-02` Núcleo Avançado), a página permite alternar.
-   **Progresso** fica no `localStorage`, separado por curso:
    `grafos-ufmg:v3:<slug>`.

## Como rodar e testar localmente

Pré-requisitos: **Node.js 20+** (o projeto usa `node --test`) e npm.

```sh
# 1) instalar dependências (só na primeira vez)
npm install

# 2) subir o servidor de desenvolvimento
npm run dev
```

Abra **http://localhost:5173/GrafosDependenciasUFMG/** — atenção ao caminho com o nome do
repositório: o Vite está configurado com `base: '/GrafosDependenciasUFMG/'` por causa do
GitHub Pages. Abrir só `http://localhost:5173/` mostra página em branco.

A primeira execução pode demorar ~20 s (otimização de dependências do Vite); depois o hot
reload é imediato. Se a porta 5173 estiver ocupada: `npm run dev -- --port 5200`.

O que deve aparecer:

1. catálogo com os cursos publicados (hoje: Física ×3, Ciência da Computação, Sistemas de
   Informação, Engenharia de Computação, Ciência de Dados);
2. ao abrir um curso, o grafo com uma coluna por período, nós cinza/verde/azul e os slots
   "Optativa 1..N" distribuídos entre as colunas;
3. clique em um nó para abrir o **painel de detalhes** (ementa, créditos, pré-requisitos) e
   marcar/desmarcar como cursada — o progresso fica em `localStorage` e é salvo por curso
   (sobrevive a recarregar a página).

Testar o build de produção (é o que o GitHub Pages serve):

```sh
npm run build      # gera dist/
npm run preview    # http://localhost:4173/GrafosDependenciasUFMG/
```

Rodar as verificações antes de commitar:

```sh
npm run check      # testes + validação dos dados + checagem dos componentes
npm run lint
```

O `npm run check` roda três verificações independentes:

1. `npm test` — 81 testes (`node --test`) das regras de grafo/progresso, dos parsers
   (incluindo regressão sobre os 13 relatórios oficiais do Siga, a matriz 2019 de Física
   com o Anexo A de ementas e o PDF de estrutura curricular de 2018), da conversão para
   JSON v2 e da integridade dos dados publicados;
2. `npm run data:validate` — IDs duplicados, arestas órfãs, ciclos, pré-requisito em
   período posterior, faixas de carga horária e divergência entre o manifesto e os JSONs;
3. `npm run check:sfc` — compila os componentes Vue (`@vue/compiler-sfc`) e confere os
   imports relativos, sem depender do Vite.

Dicas de diagnóstico:

-   **página em branco** → confira a URL com `/GrafosDependenciasUFMG/`;
-   **link direto para um curso** (ex.: `/curso/ciencia-da-computacao`) → o build copia
    `dist/index.html` para `dist/404.html`; é esse fallback que faz o vue-router resolver a
    rota no GitHub Pages (`npm run build` já executa `scripts/copy-404.mjs`);
-   **erro 404 em `data/courses.json`** → rode `npm run data:build` (os JSONs de `public/data`
    são versionados, mas essa é a forma de regenerar);
-   **aviso de `esbuild`/`npm install`** em ambientes restritos → `npm install --ignore-scripts`;
-   **quer inspecionar uma fonte de dados** → `node scripts/inspect-source.mjs data/sources/dcc/bcc.txt`.

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
3. Registre a origem: em `data/sources/sources.json` (uma entrada só) ou num
   `data/sources/<unidade>/index.json` (formato usado nas unidades com vários cursos —
   veja `data/sources/farmacia/index.json`).
4. Inclua o arquivo em `COURSES` no topo de `scripts/build-data.mjs` (unidade e campus
   vêm de `UNIT_DEFAULTS`; nome, grau e turno são lidos do próprio relatório). O `kind`
   escolhe o parser: `siga`, `estrutura` (PDFs antigos com coluna de pré-requisito),
   `fisica-2019` (matriz 2019 + Anexo de ementas, com `ementasFile` apontando o segundo
   texto) ou `legacy` (JSON do projeto original).
5. Rode `npm run data:build && npm run data:validate`.
6. Abra um PR — o GitHub Actions roda `npm run check` e faz o deploy.

> PDFs enviados manualmente podem ficar em `data/archives/`; o texto extraído vai para
> `data/sources/<unidade>/` e a origem é registrada no `index.json` da unidade. Foi assim
> que entraram a matriz 2019 do Bacharelado em Física e o Anexo A de ementas. A matriz
> 2013/1 do Bacharelado (e a fonte legada) saíram do catálogo; o PDF da licenciatura 2018
> foi removido de `data/archives`, mas o texto extraído permaneceu e o curso continua
> publicado (registro com `pdf: null`).

## Cobertura e próximos passos

A UFMG tem ~100 cursos de graduação e **não existe API pública única** com as matrizes:
o dado autoritativo é gerado no Siga (autenticado). O levantamento de fontes está em
[docs/RELATORIO_FONTES_UFMG.md](docs/RELATORIO_FONTES_UFMG.md). Resumo do que já foi
varrido:

-   **DCC** — 4 cursos publicados (relatórios no site da unidade);
-   **Farmácia** — 3 cursos publicados (Farmácia diurno/noturno e Biomedicina), 17 PDFs
    avaliados e as versões antigas descartadas;
-   **ECI** — Biblioteconomia (diurno/noturno), Arquivologia e Museologia; 8 PDFs avaliados;
-   **FAE** — Pedagogia (diurno/noturno); Educação do Campo e FIEI **não publicam** matriz
    no formato do Siga (FIEI bloqueia acesso automatizado — respeitado);
-   **IGC** — Geografia (licenciatura matutino/noturno) e Turismo (PDFs no site do IGC);
-   **Medicina** — Medicina (I-20212), relatório de versão curricular no site da Faculdade;
-   **ICA (Montes Claros)** — Engenharia de Alimentos (D-20251), Zootecnia (D-20261) e
    Aquacultura (D2023-1), grade publicada no site do campus;
-   **Física** — 3 cursos publicados: Bacharelado (matriz 2019, a partir do PPC com o
    Anexo A de ementas fornecido pelo usuário), licenciatura diurna (fonte legada) e
    licenciatura noturna (matriz 2018, texto extraído preservado; a entrada legada do
    noturno foi removida por ser duplicata de versão anterior). Detalhes da fonte e da
    modelagem em [docs/FISICA_2019.md](docs/FISICA_2019.md);
-   **~75 cursos restantes** (Engenharias, Saúde, Direito, Letras, ICEx/Matemática etc.)
    dependem de relatório do Siga: pedido de dados à PROGRAD/DGI (LAI) ou contribuição de
    quem tiver acesso.

Outros aprendizados do levantamento:

-   **PPCs da PROGRAD não servem** como fonte na maioria dos casos: a matriz é anexo
    separado, sem códigos nem pré-requisitos. A exceção é o **PPC 2019 do Bacharelado em
    Física**, que traz as tabelas com códigos/pré-requisitos e um Anexo A de ementas —
    por isso ganhou parser próprio;
-   **horários/oferta** não têm endpoint público global — por isso a antiga aba "Tabela de
    Horários" foi removida;
-   sites de unidade são heterogêneos (WordPress, Wix, IIS) e alguns bloqueiam crawl; a
    receita que funcionou foi a REST de mídia do WordPress (`/wp-json/wp/v2/media?search=curricular`)
    combinada com busca externa (DuckDuckGo HTML) e download direto do PDF + `pdftotext -layout`;
-   **o parser do Siga cobre os PDFs publicados pelas unidades** — Geografia, Turismo,
    Medicina, Engenharia de Alimentos, Zootecnia e Aquacultura entraram sem parser novo.

Próximos passos naturais: pedir a extração oficial à PROGRAD/DGI; varrer outras unidades
WordPress com a mesma receita; e criar um fluxo de contribuição (upload do PDF do
relatório → texto → `data:build` → PR).

## Limitações e avisos

-   Os dados refletem a **versão curricular** do relatório usado (data registrada em
    `sources.json`) e podem estar desatualizados em relação ao Siga.
-   O grafo é **apoio** ao planejamento de matrícula: a fonte de verdade é sempre o Siga e o
    colegiado do curso.
-   O **curso de Física de fonte legada** (licenciatura diurno) veio do JSON do projeto
    original (2025), sem carga horária e sem optativas mapeadas; a interface avisa isso.
    A **licenciatura noturna** é publicada pela **matriz 2018** (9 períodos, 35
    disciplinas, 12 slots, 2.805 h) — a entrada legada duplicada foi retirada do catálogo
    por ser a versão anterior.
-   O **Bacharelado em Física** passou a usar a **matriz 2019**: 8 períodos, 31
    obrigatórias, 38 pré-requisitos, 11 slots de optativa (660 h), 2.400 h totais e
    ementas do Anexo A para 60 das 90 disciplinas. Os percursos 01-02 a 01-05 e as AAC
    (G3) **não são modelados** porque o PDF não lista as disciplinas obrigatórias de cada
    percurso nem as atividades de AAC; o G8 aparece como FIS638, sem ementa (variável).
-   No Bacharelado em Física, pré-requisitos escritos como `A/B` (ou) são exigidos como
    `A e B`: o modelo não expressa alternativas, então pode haver bloqueio mais restritivo
    que a regra real.
-   O PDF da **licenciatura 2018** foi removido de `data/archives`; o curso continua
    publicado a partir do texto extraído e o registro da fonte fica com `pdf: null`.
-   Alguns cursos têm matrizes antigas em PDF (exportação de Word) sem códigos de disciplina
    e sem pré-requisitos — esses casos não entram no grafo.
-   A carga horária por disciplina usa o total informado no relatório (no Bacharelado em
    Física, o total das ementas); os espaços de optativa assumem 60 h cada até o aluno
    escolher a disciplina (aí vale a carga horária dela).

## Licença e créditos

Código aberto para uso educacional. Dados extraídos de relatórios públicos da UFMG
(PROGRAD/Siga) e de páginas de unidades; cada arquivo aponta sua origem em
`data/sources/sources.json`.

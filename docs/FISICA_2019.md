# Física — Bacharelado · matriz 2019

Documentação da fonte e da modelagem do curso **Física — Bacharelado** do ICEx, cuja
matriz curricular passou a ser a **de 2019** (antes o app publicava a matriz 2013/1 e a
fonte legada). O documento veio em dois PDFs fornecidos pelo usuário, e o app combina os
dois: a **matriz** (períodos, pré-requisitos, grupos de optativa e totais de
integralização) e o **Anexo A de ementas** (texto de cada disciplina e carga horária).

| Item              | Valor                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Curso             | Física — Bacharelado (ICEx, campus Pampulha, diurno)                                      |
| Versão curricular | matriz 2019 (PPC do Bacharelado)                                                          |
| PDFs de origem    | `data/archives/Física Bacharelado/BacD2019.pdf` (tabelas 3.1–3.5 e 4.1–4.3 + AAC) e `data/archives/Física Bacharelado/ementas_curso_fisica_v2019.pdf` (Anexo A) |
| Textos extraídos  | `data/sources/fisica/fisica-bacharelado-2019.txt` e `data/sources/fisica/ementas-fisica-2019.txt` |
| Registro da fonte | `data/sources/fisica/index.json` (entradas `fisica-bacharelado-2019` e `fisica-bacharelado-ementas-2019`) |
| Parser            | `scripts/lib/fisica-2019.mjs` (`parseMatriz2019`, `parseEmentas`) + `buildFisica2019Course` em `scripts/lib/course-json.mjs` |
| Saída no app      | `public/data/courses/fisica-bacharelado.json` (manifesto em `public/data/courses.json`)    |
| `meta.layout`     | `"matriz-2019"` · `meta.source.kind` = `"estrutura-curricular-pdf"` (mesmo kind dos PDFs antigos) |

## O que cada tabela do PDF contém

O PDF da matriz (`BacD2019.pdf`) é o anexo de integralização do PPC. Ele **não** traz a
lista de disciplinas por período na tabela de resumo — essa lista está na tabela 4.1 —
e **não** traz o texto das ementas, que está no outro PDF (Anexo A).

| Tabela             | Conteúdo                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3.1**            | Resumo da **formação padrão** do Bacharelado: Núcleo Comum (1260 h = 84 cr), obrigatórias do Bacharelado (420 h = 28 cr), total de obrigatórias (1680 h = 112 cr = 70%), G1–Optativas de Física (16–36 cr), G3–AAC (8–24 cr), G8–Formação Avançada em Física (0–16 cr), G9–Optativas Gerais (0–20 cr), total de optativas (660 h = 44 cr), Núcleo Geral (4 cr) e total (2400 h = 160 cr). |
| **3.2**            | Resumo do percurso **01-02 Física Médica**: acrescenta 225 h = 15 cr de obrigatórias do percurso e grupos G5 (Optativas de Física Médica) e G9 próprios; total de optativas 495 h = 33 cr. |
| **3.3**            | Resumo do percurso **01-03 Energia Nuclear**: acrescenta 180 h = 12 cr de obrigatórias do percurso e o grupo G6 (Optativas de Energia Nuclear); total de optativas 540 h = 36 cr. |
| **3.4**            | Resumo do percurso **01-04 Física Matemática**: acrescenta 270 h = 18 cr de obrigatórias do percurso e o grupo G7 (Optativas de Física Matemática); total de optativas 390 h = 26 cr. |
| **3.5**            | Resumo do percurso **01-05 Formação Complementar Aberta / Formação Transversal**: G1 de 16 cr (240 h), G3 de 8 cr (120 h) e 24 cr (360 h) de Formação Complementar/Transversal; total 2400 h = 160 cr. |
| **4.1**            | **Disciplinas obrigatórias do Grupo 1**, organizadas por período (1º a 8º), com código, nome, créditos e pré-requisitos. As linhas `OP/AAC` são os créditos de optativa/atividades que o aluno deve cumprir no período. |
| **4.2**            | **Optativas com temas de Física — Grupo 5** (G18/G19/G20/G21), com código, nome, créditos, pré-requisitos, semestre mínimo sugerido e marcações de disciplinas essenciais (E) / recomendadas (R) para os enfoques Astrofísica, Física dos Materiais, Física Teórica, Física Experimental e Física Computacional. |
| **4.3**            | **Optativas de caráter geral — Grupo 7** (G16/G17), com código, nome, créditos, pré-requisitos e semestre mínimo sugerido, além da nota sobre a pós-graduação (FIS638, Grupo 26/G8). |
| **AAC** (sem número) | Tabela das **Atividades Acadêmicas Complementares — Grupo 9** (G10/G11/G12/G13): Estudo Orientado, Participação em Eventos, Iniciação à Pesquisa/Docência/Extensão, Monografia e Vivência Profissional, com créditos e máximo por atividade. |
| **Anexo A** (PDF separado) | **Ementas** de todas as disciplinas da matriz (e também das disciplinas da Licenciatura), com o texto da ementa e a linha de metadados `(NN créditos, NN horas, natureza OB/OP, período sugerido, pré-requisitos/co-requisitos)`. |

## O que o app modela

O curso publicado tem **um único percurso** — `01-01`, "Bacharelado — formação padrão
(01-01)" —, que corresponde à tabela 3.1 e à tabela 4.1 (as que valem para o
Bacharelado inteiro). Resumo do que entra no grafo:

- **8 períodos**, exatamente os da tabela 4.1. O **8º período não tem disciplina
  obrigatória** (só `OP/AAC`) e continua aparecendo no grafo, com os espaços de
  optativa distribuídos entre as colunas.
- **31 disciplinas obrigatórias** (24 da Física + 6 da Matemática + DCC208), com os
  pré-requisitos da coluna `PRÉ` da tabela 4.1. A carga horária sai do Anexo A (a
  tabela 4.1 só informa créditos), resultando em **1680 h = 112 cr** de obrigatórias.
- **11 espaços de optativa de 60 h = 660 h = 44 cr**, que é o total de optativas da
  tabela 3.1 (`G1 + G3 + G8 + G9`). Cada espaço é um nó "Optativa N" sem arestas até o
  aluno escolher a disciplina.
- **Pool de optativas** com as disciplinas das tabelas 4.2 (**G1**) e 4.3 (**G9**) e
  **FIS638** (pós-graduação, **G8**, 4 cr) — 59 entradas no total (25 + 33 + 1) com nome,
  carga horária, grupo e pré-requisitos, usados quando o aluno escolhe a disciplina de um
  espaço (a escolha cria as arestas e pode ser desfeita). Optativas documentadas só no
  Anexo A como `OP1`/`OP9` do bacharelado — caso de **DIT121 — Direitos Humanos**,
  ausente da tabela 4.3 — entram na pool do grupo correspondente com a marca **`extra`**.
- **Pré-requisitos das optativas vêm do Anexo A** (a tabela 4.2 quebra as células de
  pré-requisito em duas linhas e por isso não é confiável); os das obrigatórias vêm da
  coluna `PRÉ` da 4.1.
- **Núcleo Geral (Grupo 37), 4 cr = 60 h**, modelado como **horas livres** no resumo do
  percurso (`summary.freeHours`), não como disciplina/nó.
- **Ementas**: o texto do Anexo A de cada disciplina é publicado em
  `disciplines[code].ementa` (string ou `null`) e também em `optionalPool[].ementa`;
  aparece no painel de detalhes da visão **Lista** (no grafo, o clique apenas marca/desmarca).
- **Sugestão de optativas por período**: as linhas `OP/AAC` da 4.1 são guardadas em
  `percurso.optionalCreditsByPeriod` (`{"2":4,"3":4,"4":4,"5":4,"6":4,"7":8,"8":20}`),
  sem transformar cada período em um slot separado.

Com isso o resumo do percurso no app fecha em **2400 h**: 1680 h de obrigatórias
(112 cr) + 660 h de optativas (44 cr) + 60 h livres (4 cr) = 2400 h. As 240 h = 16 cr
que a tabela 3.1 declara como máximo de G8 já estão dentro das 660 h de optativas e não
são somadas à parte.

## Dados publicados (conferidos no build)

Conferido em `public/data/courses.json` e `public/data/courses/fisica-bacharelado.json`
(build de 2026-11-10, `npm run data:build && npm run data:validate` com exit 0):

| Item                        | Valor                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Entrada no manifesto        | `id: "fisica-bacharelado"`, `layout: "matriz-2019"`, `curriculum: "Matriz 2019"`, `source.kind: "estrutura-curricular-pdf"` |
| `stats` (manifesto)         | disciplinas **31**, pré-requisitos **38**, períodos **8**, slots **11**, carga total **2.400 h** |
| Disciplinas no JSON         | **90**: 31 agendadas (obrigatórias do Grupo 1) + 59 na pool                          |
| Pool por grupo              | **G1: 25** (13 disciplinas + 12 tópicos `FIS634–FIS646` expandidos), **G9: 33** (23 da tabela 4.3 + 9 `ICE055–063` + DIT121), **G8: 1** (FIS638) |
| Ementas                     | **60 disciplinas** com texto do Anexo A (as 31 obrigatórias + 29 optativas); **30** com `ementa: null` (tópicos `FIS634–646`, `ICE055–063`, DCC033, EST031, FIS638, MAT243/245/247, QUI003, QUI019, QUI604) |
| `summary` do percurso       | obrigatórias 1.680 h (112 cr), optativas 660 h (44 cr), horas livres 60 h, total 2.400 h |
| `optionalCreditsByPeriod`   | `{"2":4,"3":4,"4":4,"5":4,"6":4,"7":8,"8":20}` (sugestão `OP/AAC` por período)        |
| Aviso esperado no build     | `DCC033->DCC003` — pré-requisito DCC003 não existe na matriz do curso e é descartado      |

O JSON do curso segue o schema v2 e acrescenta, em relação aos cursos do Siga:
`disciplines[code].ementa` (string ou `null`), `creditsLabel` (faixa de créditos dos
tópicos, ex. `"2–4"`), `group` (`"G1"`/`"G8"`/`"G9"`/`null`), `type` (`"OB"`/`"OP"`),
`period` (período sugerido pelo Anexo A) e `optionalPool[].ementa`; no percurso,
`optionalCreditsByPeriod`; no `meta`, `ementas` (url/retrievedAt/note do Anexo A).
O Anexo A entra como segunda fonte no registro de `data/sources/fisica/index.json`
(id `fisica-bacharelado-ementas-2019`).

## O que NÃO foi modelado (e por quê)

- **Percursos 01-02 (Física Médica), 01-03 (Energia Nuclear), 01-04 (Física
  Matemática) e 01-05 (Formação Complementar/Transversal)**: o PDF descreve apenas o
  *resumo* de cada percurso (tabelas 3.2–3.5). As **disciplinas obrigatórias próprias**
  de cada percurso não estão listadas no documento (ficam em anexo/regulamento
  separado, não fornecido), então não dá para montar o grafo desses percursos sem
  inventar disciplinas. O app publica só a formação padrão, que é a que o documento
  detalha por completo.
- **AAC (G3, Atividades Acadêmicas Complementares)**: são atividades (estudo orientado,
  eventos, iniciação científica, monografia, vivência profissional), não disciplinas
  com período e pré-requisito. Como as 660 h oficiais de optativas incluem as 120 h
  mínimas de AAC, os 11 espaços de 60 h cobrem o total, mas o pool oferecido para
  escolha é o das disciplinas de G1/G8/G9 — não há como "escolher" AAC no grafo.
- **Disciplinas de `OP/AAC` que não são optativas da pool**: as linhas `OP/AAC` da
  tabela 4.1 não dizem qual grupo será cumprido em cada período; o app guarda o total e
  a sugestão por período, não uma disciplina por linha.
- **Enfoques E/R da tabela 4.2** (essencial/recomendada por ênfase) não são modelados:
  são orientação de escolha, não pré-requisito.
- **Núcleo Geral (Grupo 37)** não tem lista de disciplinas no PDF; entra só como carga
  horária livre (60 h), sem nós.
- **Percursos que o PDF só menciona em texto** (ex.: "opção a partir do 2º/3º/4º
  período") não alteram a matriz padrão e não são representados.

## Decisões de parsing (e o que precisa de atenção)

- **`OP/AAC` soma 48 cr por período, mas o total oficial é 44 cr**: somando as linhas
  `OP/AAC` da tabela 4.1 chega-se a 48 cr (4 no 2º, 4 no 3º, 4 no 4º, 4 no 5º, 4 no 6º,
  8 no 7º e 20 no 8º = 720 h). A diferença de 4 cr (60 h) é o **Núcleo Geral**, que a
  tabela 3.1 lista à parte; os outros **44 cr = 660 h** são as optativas oficiais. O app
  usa o total oficial (11 slots × 60 h) e registra as 60 h restantes como horas livres.
- **Pré-requisitos com `/` (ou) são tratados como `e`**: a fonte usa `/` tanto para
  alternativas quanto para conjunções (ex.: `FIS069/MAT015`, `FIS621/FIS073` no 7º
  período). O grafo só sabe exigir **todos** os pré-requisitos, então essas linhas viram
  arestas de todos os códigos citados. Isso é mais restritivo do que a regra real (o
  aluno pode se sentir "bloqueado" por uma disciplina que na prática é alternativa).
  Exceção tratada: pré-requisito citado que não pertence à matriz é descartado (ex.:
  `DCC003` em `DCC033`). As alternativas que só aparecem no Anexo A (ex.: a de `FIS036`,
  "`FIS034` (D) ou `FIS031` (N)") não são aplicadas às obrigatórias — elas seguem a coluna
  `PRÉ` da tabela 4.1.
- **Nome e horas preferem o Anexo A**: a tabela 4.1 usa abreviações (`Fund. Mecânica
  dos Fluidos...`, `Progr. e Desenv. de Software`) e a ementa traz o nome completo;
  quando a disciplina tem ementa, o nome publicado é o do Anexo A. A carga horária
  também vem da ementa (`NN créditos, NN horas`); para quem não tem ementa, usa-se
  `créditos × 15`.
- **Códigos de tópicos expandidos**: a tabela 4.2 lista os tópicos em grupos
  (`FIS634,639,640`, `FIS644,645,646`, `FIS641,642,643`, `FIS635,636,637`; 2–4 cr) e a
  4.3 lista `ICE061–063` (Tópicos Especiais A–C, 2–4 cr) e `ICE055–060` (Tópicos em
  Ensino de Física A–F, 1–6 cr). Cada código é expandido em uma entrada própria com
  nome sufixado (A, B, C…) e a faixa guardada em `creditsLabel` (`"2–4"`, `"1–6"`).
  Como não há ementa, `credits` assume o **menor** crédito da faixa e a carga horária
  vira `créditos × 15` (tópicos de 2–4 cr → 30 h; `ICE055–060` → 15 h) — essas
  entradas aparecem com carga menor que a máxima da tabela.
- **`QUI604` fica sem ementa**: a tabela 4.3 lista `QUI604 — Físico-Química II (6 cr)`,
  mas o Anexo A termina o curso `QUI604` sem texto de ementa (só o código, na última
  página). A disciplina continua no pool com 90 h (6 cr × 15) e `ementa: null`; o painel
  de detalhes mostra "ementa não disponível".
- **`DIT121` entra como optativa "extra"**: o Anexo A a classifica como `OP9 – Bac`,
  mas ela não está na tabela 4.3. O build inclui a disciplina na pool G9 com
  `extra: true`, para não perder uma optativa documentada na fonte.
- **Natureza híbrida no Anexo A**: muitas disciplinas são `OB` para o bacharelado e
  `OP1`/`OP9` para a licenciatura (ou vice-versa). O parser usa a marcação `- Bac`
  quando existe; se só houver `- Lic`, a entrada não entra no pool do bacharelado.
- **FIS638 tem ementa variável**: o Anexo A menciona o código duas vezes ("Mecânica
  Analítica (Pós)" e "Mecânica Estatística (Pós)") e ambas entram como FIS638 (Tópicos
  Avançados de Física, G8). Por isso `FIS638.ementa = null`, `prereqs = []` e a entrada
  fica marcada como de carga variável.
- **Co-requisitos não viram pré-requisitos**: a linha `Có: MAT002` do Anexo A (ex.:
  FIS069) é descartada da lista de arestas.
- **Slots numerados na ordem de leitura**: os "Optativa 1..11" são distribuídos entre
  as colunas dos períodos no **frontend** (`distributeSlots` em `src/core/graph.mjs`),
  priorizando os semestres mais vazios, e numerados da esquerda para a direita; o build
  publica os 11 slots sem nível fixo. O 8º período, sem obrigatórias, fica com vários
  slots.
- **Contagem de créditos do período**: o parser confere, para cada período, se os
  créditos declarados na última coluna da 4.1 batem com a soma das disciplinas +
  `OP/AAC` e emite aviso no build quando não batem (é assim que a divergência
  `OP/AAC` aparece nos logs). O build também avisa quando descarta pré-requisito fora
  da matriz — no estado atual, há um aviso esperado: `DCC033->DCC003` (DCC003 não faz
  parte da matriz de Física).

## Como reproduzir a extração

Os textos são gerados a partir dos PDFs com `pdftotext -layout` (o layout é o que
preserva a coluna `PRÉ`, as marcações E/R e a linha de metadados das ementas):

```sh
pdftotext -layout -enc UTF-8 "data/archives/Física Bacharelado/BacD2019.pdf" \
    data/sources/fisica/fisica-bacharelado-2019.txt
pdftotext -layout -enc UTF-8 "data/archives/Física Bacharelado/ementas_curso_fisica_v2019.pdf" \
    data/sources/fisica/ementas-fisica-2019.txt
```

Depois, registrar/atualizar as entradas em `data/sources/fisica/index.json` (id, `file`,
`pdf`, `title`, `source`, `format`, `retrievedAt`, `pages`, `chars`, `sha256`,
`pdfSha256`). Seguindo o `fetch-source.mjs` e as demais unidades, **`chars` e `sha256` são
do texto extraído normalizado (CRLF→LF)**; o `pdfSha256` (campo opcional, usado nas duas
entradas novas) guarda o hash do PDF original. O `tests/registry.test.mjs` confere os
dois. Rodar:

```sh
npm run data:build      # regenera public/data/**
npm run data:validate   # IDs, arestas, ciclos, cargas e manifesto x JSONs
```

`pdf` aponta para `data/archives/Física Bacharelado/<arquivo>`; PDFs enviados
manualmente ficam em `data/archives/` e não são versionados no `public/`.

## Pendências

- [ ] **Percursos 01-02 a 01-05**: obter o anexo com as disciplinas obrigatórias de cada
      percurso para publicá-los como percursos alternativos (hoje só a formação padrão).
- [ ] **AAC**: se o colegiado publicar a lista de atividades aceitas com carga horária,
      modelar como grupo próprio (hoje as 120 h mínimas estão dentro dos 11 slots).
- [ ] **G8/FIS638**: confirmar como a pós-graduação é aproveitada e se há mais de um
      código além de FIS638 (o Anexo A usa o mesmo código para duas ementas).
- [ ] **Semântica de OU nos pré-requisitos**: avaliar suporte a "qualquer um de" no
      modelo (hoje, todos os códigos de uma linha `A/B` viram arestas).
- [ ] **`QUI604`**: falta a ementa no Anexo A; a disciplina aparece no pool sem texto.
- [ ] **`DIT121`**: confirmar com o colegiado se é optativa geral válida (está na pool
      como `extra`).
- [ ] **`ICE061–063` e `ICE055–060`**: dependem da oferta; a faixa de créditos está em
      `creditsLabel`, mas a carga horária usa o mínimo da faixa.
- [ ] **Horas do Núcleo Geral**: confirmar quais atividades contam como as 60 h livres.

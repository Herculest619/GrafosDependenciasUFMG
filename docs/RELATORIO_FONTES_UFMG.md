# Fontes públicas de dados curriculares da UFMG (verificado em 2026-11-05)

Objetivo: alimentar app de grafo de dependências (nós = disciplinas, arestas = pré-requisitos,
níveis = períodos) para TODOS os cursos de graduação da UFMG.

## Resumo executivo

1. **Não existe** endpoint público único (HTML/JSON/CSV) com as matrizes de todos os cursos.
2. A fonte autoritativa real é o **SigaUFMG** (Sistema Integrado de Gestão Acadêmica), que gera os
   relatórios **"Relatório de percurso curricular"** e **"Relatório de versão curricular"** (PDF).
   O Siga é acessível **apenas autenticado** via `https://sistemas.ufmg.br/` (minhaUFMG).
3. Cópias desses PDFs do Siga são publicadas **por algumas unidades** nos seus próprios sites
   (ex.: DCC publica 4; Física publica matrizes antigas sem códigos).
4. A lista canônica de cursos É pública e autêntica (3 fontes redundantes, todas verificadas).
5. Zona cinzenta: dados abertos da UFMG (`dados.ufmg.br`) publicam vagas/matriculados, **não** matrizes.

## Endpoints testados (status verificado por requisição real)

| URL                                                                                | Status            | Observação                                                           |
| ---------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `https://www.ufmg.br/site/ensino/graduacao/cursos-de-graduacao/`                   | 404               | URL antiga, site foi redesenhado                                     |
| `https://www.ufmg.br/cursos/`                                                      | 200               | nova home de cursos                                                  |
| `https://www.ufmg.br/cursos/estude-na-ufmg/graduacao/`                             | 200               | institucional, sem matrizes                                          |
| `https://www.ufmg.br/wp-sitemap-posts-course-1.xml`                                | 200               | **100 URLs** `/curso/graduacao-*/` — melhor enumeração               |
| `https://www.ufmg.br/wp-json/wp/v2/course`                                         | 404               | custom post type **não** exposto no REST                             |
| `https://www.ufmg.br/wp-json/wp/v2/types`                                          | 200               | lista tipos; `course` ausente                                        |
| `https://sga.ufmg.br/`                                                             | DNS ENOTFOUND     | host não existe                                                      |
| `https://siga.ufmg.br/`                                                            | DNS ENOTFOUND     | host não existe                                                      |
| `https://percurso.ufmg.br/`                                                        | DNS ENOTFOUND     | host não existe                                                      |
| `https://catalogo.ufmg.br/`                                                        | DNS ENOTFOUND     | host não existe                                                      |
| `https://sistemas.ufmg.br/siga/`                                                   | **403 Forbidden** | IBM HTTP Server; exige autenticação                                  |
| `https://dados.ufmg.br/`                                                           | 200               | CKAN, 26 datasets                                                    |
| `https://dados.ufmg.br/api/3/action/package_show?id=graduacao`                     | 200               | só vagas/inscritos/matriculados — **sem matrizes**                   |
| `https://www.ufmg.br/prograd/estrutura-curricular-da-graduacao/`                   | 200               | texto explicativo, sem dados                                         |
| PROGRAD REST `pages?slug=projetos-pedagogicos-e-regulamentos`                      | 200               | **índice canônico de ~100 cursos + links de PPC**                    |
| `https://dcc.ufmg.br/wp-json/wp/v2/media?search=curricular`                        | 200               | 4 PDFs `versao_curricular_*` (BCC/BSI/BEC/BCD)                       |
| `https://dcc.ufmg.br/wp-content/uploads/versao_curricular_bcc_20241208.pdf`        | 200               | **11 páginas, código + período + pré-requisitos**                    |
| `https://www.fisica.ufmg.br/graduacao/projeto-pedagogico/`                         | 200               | página com "4. MATRIZES CURRICULARES"                                |
| `https://www.fisica.ufmg.br/graduacao/wp-content/uploads/sites/3/2017/12/bach.pdf` | 200               | 2 páginas, versão 2015, **sem códigos e sem pré-requisitos**         |
| `https://github.com/rafael-sant-ana/estrutura-curricular-de-qualquer-curso-ufmg`   | 200               | `grade-compsci.pdf` = relatório de percurso completo + parser Python |

Ferramentas de busca (para registro): `web_search` do harness = **HTTP 401** (chave inválida);
DuckDuckGo lite = 202 captcha; Mojeek = 403; `web.archive.org/cdx` = 503 offline.
Rede do sandbox: `curl`/`Invoke-WebRequest` = conexão fechada; só `web_fetch` funciona.

## Estrutura do dado autoritativo (formato a ser parseado)

### A) "Relatório de percurso curricular" (Siga/PROGRAD)

Cabeçalho: `Curso`, `Situação`, `Versão curricular` (ex.: `CIÊNCIA DA COMPUTAÇÃO V-20251`),
`Identificador`. Depois, por período (`1º PERÍODO` ... `10º PERÍODO`), tabela com colunas:

`Atividade Acadêmica | Créditos | Teórica | Prática | Total | Conteúdo variável | Grupo |
Natureza do grupo | Pré-requisitos (Atividades / Adicionais)`

Exemplo real (Ciência da Computação, Uso do relatório hospedado no repo, pág. 2):

```
2º PERÍODO
DIG - CAD103 - ADMINISTRAÇÃO TGA 4 60 0 60 N 4 OB - -
DIG - DCC114 - INTRODUÇÃO AOS SISTEMAS LÓGICOS 4 60 0 60 N 4 OB DCC638 -
DIG - DCC219 - PROGRAMAÇÃO E DESENVOLVIMENTO DE SOFTWARE II 4 45 15 60 N 4 OB DCC203 -
DIG - MAT001 - CALCULO DIFERENCIAL E INTEGRAL I 6 90 0 90 N 4 OB - -
3º PERÍODO
DIG - DCC221 - ESTRUTURAS DE DADOS 4 45 15 60 N 4 OB DCC219 -
DIG - DCC639 - ÁLGEBRA LINEAR COMPUTACIONAL 4 60 0 60 N 4 OB MAT001, MAT038 -
```

Blocos extras: `Carga horária adicional do período` (por grupo), `Atividades acadêmicas optativas
no percurso` (lista longa de optativas **com pré-requisitos**), `Quadro de integralização`,
`Grupos de atividades`, `Regras curriculares`, `Tipos de atividades`.

### B) "Relatório de versão curricular" (Siga/PROGRAD) — variante

Mesmos dados, colunas ligeiramente diferentes, repetindo linha por percurso (01-01, 01-02):
`DIG - DCC206 - ALGORITMOS I 4 4 60 60 0 01-01 - 2 OB OB DCC205`

Parser de referência (validado): `src/classes/PdfProcessor.py` no repo acima —
`pymupdf` + split em `\d+º PERÍODO` + blocos de 10 campos.

## Lista de cursos (canônica)

-   `https://www.ufmg.br/wp-sitemap-posts-course-1.xml` → **100 páginas** `/curso/graduacao-<slug>/`
-   `https://www.ufmg.br/a-universidade/estrutura-organizacional/colegiados-de-curso/` → **~85 colegiados**
    com link do site de cada curso (domínio da unidade)
-   PROGRAD `projetos-pedagogicos-e-regulamentos` → lista por campus (BH / Montes Claros) + troncos comuns

Cada página `/curso/...` traz metadados verificados (exemplo Física Bacharelado):
Cidade, Turno, Área do Conhecimento, Modalidade, Unidade Acadêmica, Duração — **mas nenhuma disciplina**.

## Estratégia recomendada

1. Enumerar cursos pelo sitemap `wp-sitemap-posts-course-1.xml` (100) e enriquecer metadados via
   páginas `/curso/<slug>/` (usar `https://r.jina.ai/<url>` para contornar o megamenu gigante).
2. Descobrir PDFs de matriz publicados por unidade:
    - varredura REST: `https://<unidade>/wp-json/wp/v2/media?search=curricular` (funcionou no DCC);
    - crawl das páginas de colegiado listadas na página oficial de Colegiados.
3. Parsing: `pdftotext -layout` → split `\d+º PERÍODO` → linhas `DIG|PJG|... - CODE - NOME ...`.
4. Para cobertura total e homogênea: **pedido de dados** a PROGRAD/DGI
   (`info@dgi.ufmg.br`, LAI / Plano de Dados Abertos) + `colgradfis@icex.ufmg.br` por curso.

## Obstáculos

-   Siga autenticado (403 fora do minhaUFMG) → sem automação pública possível hoje.
-   Sites de unidade heterogêneos (WordPress, Wix, IIS, sites estáticos).
-   Matrizes antigas em PDF exportado de Word (Física 2015) **sem código nem pré-requisito**.
-   Buscadores bloqueados no ambiente (401/captcha/403) → descoberta depende de sitemap/REST.
-   `www.ufmg.br` tem megamenu de ~15 KB antes do conteúdo (usar REST `_fields` ou proxy de leitura).

---

## Atualização — coleta de Farmácia, ECI e FAE (2026-11)

Varredura feita com a receita deste relatório (`wp-json/wp/v2/media?search=curricular`

-   proxy de leitura para extrair o texto do PDF). Resultado da triagem:

| Unidade  | Relatórios no formato Siga | Cursos publicados                                                                         |
| -------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| DCC      | 4                          | Ciência da Computação, Sistemas de Informação, Engenharia de Computação, Ciência de Dados |
| Farmácia | 3 (de 17 PDFs avaliados)   | Farmácia diurno, Farmácia noturno, Biomedicina                                            |
| ECI      | 4 (de 8 avaliados)         | Biblioteconomia diurno/noturno, Arquivologia, Museologia                                  |
| FAE      | 2 (de 5 avaliados)         | Pedagogia diurno/noturno                                                                  |

Descartes típicos: versões curriculares antigas, duplicatas de upload, grade de horários
do mapa de oferta, "representação curricular" (matriz exportada sem códigos nem
pré-requisitos), pré-requisitos de estágios optativos, PPCs e ementários.

Achados novos que o parser passou a suportar:

-   identificadores de percurso não numéricos (`R-01`/`R-02` na Museologia; `02-01`… na Pedagogia);
-   coluna "Grupo" com identificador completo (`13002-D-20141-1` na Biblioteconomia);
-   blocos de período duplicados na virada de página (Sistemas de Informação/Ciência de Dados);
-   rodapé colado no marcador de período (`... 11.17.361º PERÍODO`) e no cabeçalho.

Cursos que **não** têm matriz pública no formato do Siga:

-   **Educação do Campo (FAE)**: páginas do curso não publicam matriz (só documento de estágio);
-   **FIEI (FAE)**: subsite responde 401 para a REST de mídia — acesso automatizado bloqueado;
-   **Física (ICEx)**: site do departamento só tem matrizes antigas (Word, sem códigos/pré-requisitos).

## Atualização — coleta IGC, Medicina e ICA/Montes Claros (2026-11)

Nova rodada combinando três caminhos: REST de mídia do WordPress das unidades, busca
externa (DuckDuckGo HTML, porque o endpoint de busca do projeto está sem chave) e
download direto do PDF com `pdftotext -layout`. Todos os relatórios abaixo estão no
formato **"Relatório de versão curricular"** do Siga — nenhum parser novo foi necessário.

| Unidade             | Curso                               | Versão  | Fonte                                                                                            |
| ------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| IGC                 | Geografia — Licenciatura (matutino) | M-20271 | `igc.ufmg.br/wp-content/uploads/2026/10/Versao-Curricular-M-20271_LICENCIATURA-EM-GEOGRAFIA.pdf` |
| IGC                 | Geografia — Licenciatura (noturno)  | N-20271 | `igc.ufmg.br/.../Versao-Curricular-N-20271_LICENCIATURA-EM-GEOGRAFIA-1.pdf`                      |
| IGC                 | Turismo                             | D-20221 | `igc.ufmg.br/wp-content/uploads/2023/08/GRADE-CURRICULAR-TURISMO-2022-1-1.pdf`                   |
| Medicina            | Medicina                            | I-20212 | `medicina.ufmg.br/wp-content/uploads/sites/102/2024/09/Versao-Curricular-2021-2.pdf`             |
| ICA (Montes Claros) | Engenharia de Alimentos             | D-20251 | `ufmg.br/montesclaros/wp-content/uploads/2024/03/Nova-Grade-Curricular-EAL-2025.pdf`             |
| ICA (Montes Claros) | Zootecnia                           | D-20261 | `ufmg.br/montesclaros/wp-content/uploads/2025/11/Grade-Nova-Zootecnia.pdf`                       |
| ICA (Montes Claros) | Aquacultura                         | D2023-1 | `vet.ufmg.br/wp-content/uploads/2023/03/Versao-curricular-D2023-1.pdf`                           |

Ajustes de parser decorrentes: nome do curso no formato `Curso: <código> - <nome>`
(antes da coluna "Versão curricular") e identificador de versão sem hífen (`D2023-1`).

Ainda não cobertos nesta rodada:

-   **Veterinária**: o PDF publicado no site da Vet é o relatório de **Aquacultura**
    (curso do ICA), não o da Veterinária;
-   **Matemática/Artes Visuais/Física antigos**: PDFs em layout antigo (sem marcadores de
    período do Siga), exigiriam um parser específico;
-   unidades com subdomínio indisponível ou REST desativada: Letras, FAFICH, Engenharia,
    ICB, EEFFTO, Odontologia, Enfermagem, Face, Arquitetura, Música, Estatística.

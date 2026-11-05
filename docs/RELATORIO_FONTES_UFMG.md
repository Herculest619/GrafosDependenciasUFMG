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

| URL | Status | Observação |
|---|---|---|
| `https://www.ufmg.br/site/ensino/graduacao/cursos-de-graduacao/` | 404 | URL antiga, site foi redesenhado |
| `https://www.ufmg.br/cursos/` | 200 | nova home de cursos |
| `https://www.ufmg.br/cursos/estude-na-ufmg/graduacao/` | 200 | institucional, sem matrizes |
| `https://www.ufmg.br/wp-sitemap-posts-course-1.xml` | 200 | **100 URLs** `/curso/graduacao-*/` — melhor enumeração |
| `https://www.ufmg.br/wp-json/wp/v2/course` | 404 | custom post type **não** exposto no REST |
| `https://www.ufmg.br/wp-json/wp/v2/types` | 200 | lista tipos; `course` ausente |
| `https://sga.ufmg.br/` | DNS ENOTFOUND | host não existe |
| `https://siga.ufmg.br/` | DNS ENOTFOUND | host não existe |
| `https://percurso.ufmg.br/` | DNS ENOTFOUND | host não existe |
| `https://catalogo.ufmg.br/` | DNS ENOTFOUND | host não existe |
| `https://sistemas.ufmg.br/siga/` | **403 Forbidden** | IBM HTTP Server; exige autenticação |
| `https://dados.ufmg.br/` | 200 | CKAN, 26 datasets |
| `https://dados.ufmg.br/api/3/action/package_show?id=graduacao` | 200 | só vagas/inscritos/matriculados — **sem matrizes** |
| `https://www.ufmg.br/prograd/estrutura-curricular-da-graduacao/` | 200 | texto explicativo, sem dados |
| PROGRAD REST `pages?slug=projetos-pedagogicos-e-regulamentos` | 200 | **índice canônico de ~100 cursos + links de PPC** |
| `https://dcc.ufmg.br/wp-json/wp/v2/media?search=curricular` | 200 | 4 PDFs `versao_curricular_*` (BCC/BSI/BEC/BCD) |
| `https://dcc.ufmg.br/wp-content/uploads/versao_curricular_bcc_20241208.pdf` | 200 | **11 páginas, código + período + pré-requisitos** |
| `https://www.fisica.ufmg.br/graduacao/projeto-pedagogico/` | 200 | página com "4. MATRIZES CURRICULARES" |
| `https://www.fisica.ufmg.br/graduacao/wp-content/uploads/sites/3/2017/12/bach.pdf` | 200 | 2 páginas, versão 2015, **sem códigos e sem pré-requisitos** |
| `https://github.com/rafael-sant-ana/estrutura-curricular-de-qualquer-curso-ufmg` | 200 | `grade-compsci.pdf` = relatório de percurso completo + parser Python |

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

- `https://www.ufmg.br/wp-sitemap-posts-course-1.xml` → **100 páginas** `/curso/graduacao-<slug>/`
- `https://www.ufmg.br/a-universidade/estrutura-organizacional/colegiados-de-curso/` → **~85 colegiados**
  com link do site de cada curso (domínio da unidade)
- PROGRAD `projetos-pedagogicos-e-regulamentos` → lista por campus (BH / Montes Claros) + troncos comuns

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

- Siga autenticado (403 fora do minhaUFMG) → sem automação pública possível hoje.
- Sites de unidade heterogêneos (WordPress, Wix, IIS, sites estáticos).
- Matrizes antigas em PDF exportado de Word (Física 2015) **sem código nem pré-requisito**.
- Buscadores bloqueados no ambiente (401/captcha/403) → descoberta depende de sitemap/REST.
- `www.ufmg.br` tem megamenu de ~15 KB antes do conteúdo (usar REST `_fields` ou proxy de leitura).

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import CourseGraph from '../components/CourseGraph.vue'
import ProgressPanel from '../components/ProgressPanel.vue'
import { formatHours } from '../core/format.mjs'
import {
    buildGraph,
    searchDisciplines,
    suggestNextPeriod,
    summarizeProgress,
} from '../core/graph.mjs'
import { browserStorage, clearProgress, loadProgress, saveProgress } from '../core/progress.mjs'
import { findCatalogEntry, loadCourse } from '../data/courseLoader.mjs'

const props = defineProps({
    slug: { type: String, required: true },
})

const storage = browserStorage()
const graphRef = ref(null)

const state = reactive({
    loading: true,
    error: null,
    notFound: false,
    course: null,
})

const selectedPercurso = ref(null)
const showOptionalSlots = ref(true)
const viewMode = ref('graph')
const taken = ref(new Set())
const choices = ref({})
const choosingSlot = ref(null)
const choiceSearch = ref('')
const search = ref('')

const meta = computed(() => state.course?.meta ?? null)
const percursos = computed(() => state.course?.percursos ?? [])
const selectedPercursoData = computed(
    () =>
        percursos.value.find((percurso) => percurso.id === selectedPercurso.value) ??
        percursos.value[0] ??
        null
)

const graph = computed(() =>
    state.course
        ? buildGraph(state.course, {
              percursoId: selectedPercurso.value,
              includeOptionalSlots: showOptionalSlots.value,
              choices: choices.value,
          })
        : null
)

const chosenCodes = computed(() => new Set(Object.values(choices.value)))

/** Opções de optativa do percurso atual, filtradas pela busca do modal. */
const optionalOptions = computed(() => {
    const pool = selectedPercursoData.value?.optionalPool ?? []
    const term = choiceSearch.value.trim().toLowerCase()
    return pool
        .filter((entry) => {
            if (!term) return true
            const haystack = `${entry.code} ${entry.name ?? ''} ${entry.groupName ?? ''}`
            return haystack.toLowerCase().includes(term)
        })
        .slice()
        .sort((left, right) =>
            String(left.name ?? left.code).localeCompare(String(right.name ?? right.code), 'pt-BR')
        )
        .map((entry) => {
            const missing = (entry.prereqs ?? []).filter((code) => !taken.value.has(code))
            return {
                ...entry,
                missing,
                alreadyChosen:
                    chosenCodes.value.has(entry.code) &&
                    choices.value[choosingSlot.value] !== entry.code,
            }
        })
})

const choosingSlotNode = computed(
    () => graph.value?.nodes.find((node) => node.id === choosingSlot.value) ?? null
)

const progress = computed(() => (graph.value ? summarizeProgress(graph.value, taken.value) : null))
const nextPeriod = computed(() =>
    graph.value ? suggestNextPeriod(graph.value, taken.value) : null
)

const disciplinesByCode = computed(() => state.course?.disciplines ?? {})

const hasOptionalSlots = computed(() =>
    (state.course?.percursos ?? []).some((percurso) => (percurso.optionalSlots ?? []).length > 0)
)

const suggestions = computed(() => {
    const term = search.value.trim()
    if (term.length < 2 || !graph.value) return []
    return searchDisciplines(graph.value, term)
})

const showSuggestions = computed(() => suggestions.value.length > 0)

async function load() {
    state.loading = true
    state.error = null
    state.notFound = false
    try {
        const entry = await findCatalogEntry(props.slug)
        if (!entry) {
            state.notFound = true
            state.course = null
            return
        }
        const course = await loadCourse(entry.file)
        state.course = course
        selectedPercurso.value = course.percursos?.[0]?.id ?? null
        const stored = loadProgress(storage, course.id)
        taken.value = new Set(stored?.taken ?? [])
        choices.value = stored?.choices ?? {}
        document.title = `${course.meta.name} — Grafos de Dependências UFMG`
    } catch (problem) {
        state.error = problem.message
    } finally {
        state.loading = false
    }
}

onMounted(load)
watch(() => props.slug, load)

watch(
    [taken, choices],
    ([takenCodes, chosen]) => {
        if (!state.course) return
        saveProgress(storage, state.course.id, takenCodes, chosen)
    },
    { deep: false }
)

function toggle(code) {
    const next = new Set(taken.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    taken.value = next
}

function openSlot(slotId) {
    choiceSearch.value = ''
    choosingSlot.value = slotId
}

function closeSlot() {
    choosingSlot.value = null
    choiceSearch.value = ''
}

function setTaken(slotId, isTaken) {
    const next = new Set(taken.value)
    if (isTaken) next.add(slotId)
    else next.delete(slotId)
    taken.value = next
}

/** Escolhe a disciplina que preenche o espaço de optativa aberto no modal. */
function pickOptional(code) {
    const slotId = choosingSlot.value
    if (!slotId) return
    choices.value = { ...choices.value, [slotId]: code }
    setTaken(slotId, true)
    closeSlot()
}

/** Remove a escolha (e o "cursada") do espaço de optativa. */
function removeChoice(slotId) {
    const next = { ...choices.value }
    delete next[slotId]
    choices.value = next
    setTaken(slotId, false)
    closeSlot()
}

/** Fallback para cursos sem lista de optativas: marca o espaço sem escolher. */
function toggleSlotTaken(slotId) {
    if (choices.value[slotId]) removeChoice(slotId)
    else setTaken(slotId, !taken.value.has(slotId))
}

function toggleAllFor(period) {
    const slotIds = slotsForPeriod(period.number).map((slot) => slot.id)
    const allTaken = [...period.codes, ...slotIds].every((code) => taken.value.has(code))
    const next = new Set(taken.value)
    for (const code of [...period.codes, ...slotIds]) {
        if (allTaken) next.delete(code)
        else next.add(code)
    }
    taken.value = next
}

/** Espaços de optativa que foram distribuídos para este período. */
function slotsForPeriod(number) {
    if (!graph.value) return []
    return graph.value.nodes.filter(
        (node) => node.kind === 'slot' && Number(node.level) === Number(number)
    )
}

function clearAll() {
    taken.value = new Set()
    choices.value = {}
    if (state.course) clearProgress(storage, state.course.id)
}

function goTo(code) {
    search.value = ''
    if (viewMode.value === 'list') viewMode.value = 'graph'
    graphRef.value?.focusNode(code)
}

function submitSearch() {
    if (suggestions.value.length) goTo(suggestions.value[0].code)
}

function statusOf(code) {
    return progress.value?.status.get(code) ?? 'blocked'
}

function prerequisiteLabel(code) {
    const discipline = disciplinesByCode.value[code]
    const prereqs = discipline?.prereqs ?? []
    return prereqs.length ? `exige ${prereqs.join(', ')}` : 'sem pré-requisito'
}
</script>

<template>
    <div class="mx-auto max-w-[1500px] px-4 py-6">
        <div v-if="state.loading" class="card text-sm text-gray-500 dark:text-gray-400">
            Carregando matriz curricular…
        </div>

        <div v-else-if="state.notFound" class="card">
            <p class="font-medium">Curso não encontrado.</p>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                O curso “{{ props.slug }}” ainda não está publicado neste site.
            </p>
            <RouterLink to="/" class="btn mt-4">← Ver todos os cursos</RouterLink>
        </div>

        <div v-else-if="state.error" class="card border-red-300 dark:border-red-700">
            <p class="font-medium text-red-700 dark:text-red-400">Erro ao carregar o curso.</p>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ state.error }}</p>
            <div class="mt-4 flex gap-2">
                <button type="button" class="btn" @click="load">Tentar novamente</button>
                <RouterLink to="/" class="btn">← Ver todos os cursos</RouterLink>
            </div>
        </div>

        <template v-else-if="meta && graph && progress">
            <div class="mb-4">
                <RouterLink
                    to="/"
                    class="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                >
                    ← Todos os cursos
                </RouterLink>
                <div class="mt-2 flex flex-wrap items-center gap-3">
                    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
                        {{ meta.name }}
                        <span
                            v-if="meta.variant"
                            class="font-normal text-gray-500 dark:text-gray-400"
                        >
                            — {{ meta.variant }}
                        </span>
                    </h1>
                </div>
                <div class="mt-2 flex flex-wrap gap-2">
                    <span v-if="meta.unit" class="badge">{{ meta.unit }}</span>
                    <span v-if="meta.degree" class="badge">{{ meta.degree }}</span>
                    <span v-if="meta.shift" class="badge">{{ meta.shift }}</span>
                    <span v-if="meta.campus" class="badge">{{ meta.campus }}</span>
                    <span v-if="meta.curriculum" class="badge">versão {{ meta.curriculum }}</span>
                    <span class="badge">{{ graph.stats.disciplines }} disciplinas</span>
                    <span class="badge">{{ graph.stats.edges }} pré-requisitos</span>
                </div>
            </div>

            <div class="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
                <aside class="space-y-4">
                    <section class="card space-y-3">
                        <label class="block">
                            <span class="mb-1 block text-sm font-medium">Ir para disciplina</span>
                            <span class="relative block">
                                <input
                                    v-model="search"
                                    type="search"
                                    class="input"
                                    placeholder="Código ou nome (ex.: DCC205)"
                                    @keydown.enter.prevent="submitSearch"
                                />
                                <ul
                                    v-if="showSuggestions"
                                    class="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800"
                                >
                                    <li v-for="item in suggestions" :key="item.id">
                                        <button
                                            type="button"
                                            class="block w-full truncate px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                                            @click="goTo(item.id)"
                                        >
                                            <span class="font-mono text-xs">{{ item.code }}</span>
                                            — {{ item.name }}
                                        </button>
                                    </li>
                                </ul>
                            </span>
                        </label>

                        <label v-if="percursos.length > 1" class="block">
                            <span class="mb-1 block text-sm font-medium">Percurso</span>
                            <select v-model="selectedPercurso" class="input">
                                <option
                                    v-for="percurso in percursos"
                                    :key="percurso.id"
                                    :value="percurso.id"
                                >
                                    {{ percurso.id }} — {{ percurso.name }}
                                </option>
                            </select>
                        </label>

                        <div class="flex flex-wrap items-center gap-2">
                            <label
                                v-if="hasOptionalSlots"
                                class="inline-flex cursor-pointer items-center gap-2 text-sm"
                            >
                                <input
                                    v-model="showOptionalSlots"
                                    type="checkbox"
                                    class="h-4 w-4 rounded"
                                />
                                Mostrar optativas
                            </label>
                            <span
                                v-else
                                class="inline-flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
                            >
                                Esta matriz não tem optativas mapeadas
                            </span>
                            <div class="ml-auto flex gap-2">
                                <button
                                    v-if="viewMode === 'graph'"
                                    type="button"
                                    class="btn"
                                    @click="graphRef?.fitAll()"
                                >
                                    Ajustar
                                </button>
                                <button
                                    v-if="viewMode === 'graph'"
                                    type="button"
                                    class="btn"
                                    title="Baixa um PNG em alta resolução, enquadrado como o Ajustar"
                                    @click="graphRef?.exportImage(state.course?.id)"
                                >
                                    Baixar imagem
                                </button>
                                <button type="button" class="btn" @click="clearAll">
                                    Limpar progresso
                                </button>
                            </div>
                        </div>

                        <div
                            class="flex rounded-lg border border-gray-300 p-0.5 text-sm dark:border-gray-600"
                        >
                            <button
                                type="button"
                                class="flex-1 rounded-md px-2 py-1"
                                :class="
                                    viewMode === 'graph'
                                        ? 'bg-brand-600 text-white'
                                        : 'text-gray-600 dark:text-gray-300'
                                "
                                @click="viewMode = 'graph'"
                            >
                                Grafo
                            </button>
                            <button
                                type="button"
                                class="flex-1 rounded-md px-2 py-1"
                                :class="
                                    viewMode === 'list'
                                        ? 'bg-brand-600 text-white'
                                        : 'text-gray-600 dark:text-gray-300'
                                "
                                @click="viewMode = 'list'"
                            >
                                Lista
                            </button>
                        </div>
                    </section>

                    <ProgressPanel
                        :progress="progress"
                        :summary="selectedPercursoData?.summary"
                        :next-period="nextPeriod"
                    />

                    <section class="card">
                        <h2
                            class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                        >
                            Legenda
                        </h2>
                        <ul class="mt-2 space-y-1.5 text-sm">
                            <li class="flex items-center gap-2">
                                <span
                                    class="h-3 w-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-700"
                                ></span>
                                Pode cursar (pré-requisitos cumpridos)
                            </li>
                            <li class="flex items-center gap-2">
                                <span
                                    class="h-3 w-3 rounded-sm bg-blue-500 ring-1 ring-blue-700"
                                ></span>
                                Já cursada
                            </li>
                            <li class="flex items-center gap-2">
                                <span
                                    class="h-3 w-3 rounded-sm bg-gray-300 ring-1 ring-gray-500 dark:bg-gray-500"
                                ></span>
                                Falta pré-requisito
                            </li>
                            <li class="flex items-center gap-2">
                                <span
                                    class="h-3 w-3 rounded-sm bg-violet-300 ring-1 ring-violet-700"
                                ></span>
                                Espaço de optativa
                            </li>
                        </ul>
                        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            Clique em uma disciplina para marcar/desmarcar. Você pode marcar mesmo
                            sem os pré-requisitos (“quebra”) para simular cenários. Cada coluna é um
                            período sugerido. Clique em uma <strong>optativa</strong> para escolher
                            a disciplina que vai preenchê-la. Arraste para navegar e use o scroll
                            (ou pinça) para dar zoom; “Ajustar” mostra o grafo inteiro.
                        </p>
                    </section>
                </aside>

                <section class="min-w-0">
                    <div
                        v-if="viewMode === 'graph'"
                        class="h-[72vh] min-h-[480px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
                    >
                        <CourseGraph
                            ref="graphRef"
                            :graph="graph"
                            :status="progress.status"
                            @toggle="toggle"
                            @choose-slot="openSlot"
                        />
                    </div>

                    <div v-else class="space-y-6">
                        <div
                            v-for="period in selectedPercursoData?.periods ?? []"
                            :key="period.number"
                        >
                            <div class="mb-2 flex items-center justify-between">
                                <h2 class="text-lg font-semibold">Período {{ period.number }}</h2>
                                <button
                                    type="button"
                                    class="btn text-xs"
                                    @click="toggleAllFor(period)"
                                >
                                    Alternar período
                                </button>
                            </div>
                            <ul
                                class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
                            >
                                <li
                                    v-for="code in period.codes"
                                    :key="code"
                                    class="flex items-start gap-3 bg-white px-3 py-2 dark:bg-gray-800/60"
                                >
                                    <input
                                        type="checkbox"
                                        class="mt-1 h-4 w-4 rounded"
                                        :checked="taken.has(code)"
                                        @change="toggle(code)"
                                    />
                                    <div class="min-w-0">
                                        <p class="text-sm font-medium">
                                            <span
                                                class="font-mono text-xs text-gray-500 dark:text-gray-400"
                                            >
                                                {{ code }}
                                            </span>
                                            {{ disciplinesByCode[code]?.name }}
                                        </p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">
                                            {{ formatHours(disciplinesByCode[code]?.hours?.total) }}
                                            ·
                                            {{ prerequisiteLabel(code) }}
                                        </p>
                                    </div>
                                    <span
                                        class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                                        :class="{
                                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200':
                                                statusOf(code) === 'taken',
                                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200':
                                                statusOf(code) === 'available',
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300':
                                                statusOf(code) === 'blocked',
                                        }"
                                    >
                                        {{
                                            statusOf(code) === 'taken'
                                                ? 'cursada'
                                                : statusOf(code) === 'available'
                                                ? 'liberada'
                                                : 'bloqueada'
                                        }}
                                    </span>
                                </li>
                                <li
                                    v-for="slot in slotsForPeriod(period.number)"
                                    :key="slot.id"
                                    class="flex items-start gap-3 bg-violet-50 px-3 py-2 dark:bg-violet-900/20"
                                >
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-medium">
                                            <span
                                                class="font-mono text-xs text-violet-600 dark:text-violet-300"
                                            >
                                                optativa
                                            </span>
                                            {{ slot.chosen ? slot.chosen.name : slot.label }}
                                        </p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">
                                            {{ formatHours(slot.hours) }} ·
                                            {{
                                                slot.chosen
                                                    ? `${slot.chosen.code} · escolhida`
                                                    : 'escolha uma disciplina da lista'
                                            }}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn text-xs"
                                        @click="openSlot(slot.id)"
                                    >
                                        {{ slot.chosen ? 'Trocar' : 'Escolher' }}
                                    </button>
                                    <button
                                        v-if="slot.chosen"
                                        type="button"
                                        class="btn text-xs"
                                        @click="removeChoice(slot.id)"
                                    >
                                        Remover
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </template>

        <div
            v-if="choosingSlot"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            @click.self="closeSlot"
        >
            <div
                class="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="text-lg font-semibold">
                            Escolher disciplina — {{ choosingSlotNode?.label }}
                        </h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Optativas do percurso {{ selectedPercursoData?.name }}. A disciplina
                            escolhida substitui o espaço no grafo e entra na carga horária.
                        </p>
                    </div>
                    <button type="button" class="btn text-xs" @click="closeSlot">Fechar</button>
                </div>

                <input
                    v-model="choiceSearch"
                    class="input mt-3"
                    type="search"
                    placeholder="Buscar por código, nome ou grupo…"
                />

                <ul
                    class="mt-3 min-h-0 flex-1 divide-y divide-gray-200 overflow-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
                >
                    <li
                        v-for="option in optionalOptions"
                        :key="option.code"
                        class="flex items-start gap-3 px-3 py-2"
                        :class="{ 'opacity-50': option.alreadyChosen }"
                    >
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium">
                                <span class="font-mono text-xs text-gray-500 dark:text-gray-400">
                                    {{ option.code }}
                                </span>
                                {{ option.name ?? option.code }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {{ formatHours(option.hours) }}
                                <template v-if="option.groupName">
                                    · {{ option.groupName }}
                                </template>
                                ·
                                {{
                                    option.missing.length
                                        ? `faltam: ${option.missing.join(', ')}`
                                        : 'pré-requisitos ok'
                                }}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="btn text-xs"
                            :disabled="option.alreadyChosen"
                            @click="pickOptional(option.code)"
                        >
                            {{ option.alreadyChosen ? 'já escolhida' : 'Escolher' }}
                        </button>
                    </li>
                    <li
                        v-if="!optionalOptions.length"
                        class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                    >
                        Nenhuma optativa mapeada para este percurso. Você ainda pode marcar o espaço
                        como cursado.
                    </li>
                </ul>

                <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        class="btn text-xs"
                        @click="toggleSlotTaken(choosingSlot)"
                    >
                        {{
                            taken.has(choosingSlot)
                                ? 'Desmarcar este espaço'
                                : 'Marcar espaço sem escolher disciplina'
                        }}
                    </button>
                    <button
                        v-if="choices[choosingSlot]"
                        type="button"
                        class="btn text-xs"
                        @click="removeChoice(choosingSlot)"
                    >
                        Remover escolha atual
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

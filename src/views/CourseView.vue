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
          })
        : null
)

const progress = computed(() => (graph.value ? summarizeProgress(graph.value, taken.value) : null))
const nextPeriod = computed(() =>
    graph.value ? suggestNextPeriod(graph.value, taken.value) : null
)

const disciplinesByCode = computed(() => state.course?.disciplines ?? {})

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
        taken.value = new Set(loadProgress(storage, course.id)?.taken ?? [])
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
    taken,
    (value) => {
        if (!state.course) return
        saveProgress(storage, state.course.id, value)
    },
    { deep: false }
)

function toggle(code) {
    const next = new Set(taken.value)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    taken.value = next
}

function toggleAllFor(period) {
    const allTaken = period.codes.every((code) => taken.value.has(code))
    const next = new Set(taken.value)
    for (const code of period.codes) {
        if (allTaken) next.delete(code)
        else next.add(code)
    }
    taken.value = next
}

function clearAll() {
    taken.value = new Set()
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
                            <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                    v-model="showOptionalSlots"
                                    type="checkbox"
                                    class="h-4 w-4 rounded"
                                />
                                Mostrar optativas
                            </label>
                            <div class="ml-auto flex gap-2">
                                <button
                                    v-if="viewMode === 'graph'"
                                    type="button"
                                    class="btn"
                                    @click="graphRef?.fitAll()"
                                >
                                    Ajustar
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
                            período sugerido.
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
                            </ul>
                        </div>

                        <div v-if="graph.nodes.some((node) => node.kind === 'slot')">
                            <h2 class="mb-2 text-lg font-semibold">Optativas</h2>
                            <ul class="flex flex-wrap gap-2">
                                <li
                                    v-for="node in graph.nodes.filter(
                                        (candidate) => candidate.kind === 'slot'
                                    )"
                                    :key="node.id"
                                >
                                    <label
                                        class="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700"
                                    >
                                        <input
                                            type="checkbox"
                                            class="h-4 w-4 rounded"
                                            :checked="taken.has(node.id)"
                                            @change="toggle(node.id)"
                                        />
                                        {{ node.label }}
                                    </label>
                                </li>
                            </ul>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Os espaços de optativa não têm pré-requisitos: você escolhe quais
                                disciplinas usar para preenchê-los.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </template>
    </div>
</template>

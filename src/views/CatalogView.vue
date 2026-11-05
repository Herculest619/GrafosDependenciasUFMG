<script setup>
import { computed, onMounted, ref } from 'vue'

import { filterCourses, formatHours, groupByUnit } from '../core/format.mjs'
import { loadCatalog } from '../data/courseLoader.mjs'

const courses = ref([])
const loading = ref(true)
const error = ref(null)
const query = ref('')

async function load() {
    loading.value = true
    error.value = null
    try {
        const catalog = await loadCatalog()
        courses.value = catalog.courses ?? []
    } catch (problem) {
        error.value = problem.message
    } finally {
        loading.value = false
    }
}

onMounted(load)

const filtered = computed(() => filterCourses(courses.value, query.value))
const groups = computed(() => groupByUnit(filtered.value))
const total = computed(() => courses.value.length)
</script>

<template>
    <div class="mx-auto max-w-6xl px-4 py-8">
        <header class="mb-8">
            <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Cursos de graduação</h1>
            <p class="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
                Escolha um curso para ver o grafo de pré-requisitos, marcar o que já cursou e
                simular sua matrícula. Cada coluna é um período sugerido.
            </p>
        </header>

        <div v-if="loading" class="card text-sm text-gray-500 dark:text-gray-400">
            Carregando catálogo…
        </div>

        <div v-else-if="error" class="card border-red-300 dark:border-red-700">
            <p class="font-medium text-red-700 dark:text-red-400">
                Não foi possível carregar o catálogo.
            </p>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ error }}</p>
            <button type="button" class="btn mt-3" @click="load">Tentar novamente</button>
        </div>

        <template v-else>
            <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label class="relative block flex-1">
                    <span class="sr-only">Buscar curso</span>
                    <input
                        v-model="query"
                        type="search"
                        class="input pl-9"
                        placeholder="Buscar por curso, unidade, turno ou grau…"
                    />
                    <span
                        class="pointer-events-none absolute left-3 top-2.5 text-gray-400"
                        aria-hidden="true"
                    >
                        <svg
                            class="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                        >
                            <circle cx="11" cy="11" r="7"></circle>
                            <path d="m20 20-3.5-3.5"></path>
                        </svg>
                    </span>
                </label>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ filtered.length }} de {{ total }} curso(s)
                </p>
            </div>

            <p v-if="!filtered.length" class="card text-sm text-gray-500 dark:text-gray-400">
                Nenhum curso encontrado para “{{ query }}”.
            </p>

            <div v-for="group in groups" :key="group.unit" class="mb-8">
                <h2
                    class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                    {{ group.unit }}
                </h2>
                <ul class="grid gap-4 sm:grid-cols-2">
                    <li v-for="course in group.items" :key="course.id">
                        <RouterLink
                            :to="`/curso/${course.id}`"
                            class="card block h-full transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <h3 class="text-lg font-semibold leading-tight">
                                    {{ course.name }}
                                </h3>
                                <span v-if="course.variant" class="badge shrink-0">
                                    {{ course.variant }}
                                </span>
                            </div>

                            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {{
                                    [course.degree, course.shift, course.campus]
                                        .filter(Boolean)
                                        .join(' · ')
                                }}
                            </p>

                            <p
                                class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"
                            >
                                <span>{{ course.stats?.disciplines ?? '?' }} disciplinas</span>
                                <span>{{ course.stats?.periods ?? '?' }} períodos</span>
                                <span v-if="course.stats?.optionalSlots">
                                    {{ course.stats.optionalSlots }} optativas
                                </span>
                                <span v-if="course.stats?.totalHours">
                                    {{ formatHours(course.stats.totalHours) }}
                                </span>
                            </p>

                            <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
                                {{ course.curriculum || 'versão curricular não informada' }}
                            </p>
                        </RouterLink>
                    </li>
                </ul>
            </div>

            <aside
                class="mt-10 rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400"
            >
                <h2 class="font-semibold text-gray-800 dark:text-gray-200">Cobertura parcial</h2>
                <p class="mt-1">
                    A UFMG tem cerca de 100 cursos de graduação e as matrizes são publicadas curso a
                    curso (não há uma API pública única). Este site é alimentado por relatórios
                    oficiais do Siga/PROGRAD — veja como contribuir com o curso que falta no
                    <a
                        class="underline hover:text-gray-900 dark:hover:text-white"
                        href="https://github.com/Herculest619/GrafosDependenciasUFMG"
                        target="_blank"
                        rel="noopener noreferrer"
                        >repositório</a
                    >.
                </p>
            </aside>
        </template>
    </div>
</template>

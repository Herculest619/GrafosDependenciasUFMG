<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { formatHours } from '../core/format.mjs'

const props = defineProps({
    code: { type: String, required: true },
    discipline: { type: Object, default: null },
    period: { type: [Number, String], default: null },
    optional: { type: Boolean, default: false },
    prereqs: { type: Array, default: () => [] },
    dependents: { type: Array, default: () => [] },
    taken: { type: Boolean, default: false },
    status: { type: String, default: 'blocked' },
})

const emit = defineEmits(['close', 'toggle-taken', 'navigate'])

const dialog = ref(null)
let previouslyFocused = null

const name = computed(() => props.discipline?.name ?? props.code)

/** Tipo da disciplina: usa type (OB/OP) e cai no grupo/estado do percurso. */
const typeLabel = computed(() => {
    const type = props.discipline?.type
    if (type === 'OB') return 'Obrigatória'
    if (type === 'OP') return 'Optativa'
    if (props.discipline?.group || props.optional) return 'Optativa'
    return 'Obrigatória'
})

const groupLabel = computed(() => {
    const groupName = props.discipline?.groupName
    if (groupName) return groupName
    const group = props.discipline?.group
    return group ? `Grupo ${group}` : null
})

const creditsLabel = computed(() => {
    const credits = props.discipline?.credits
    const range = props.discipline?.creditsLabel
    const hasCredits = Number.isFinite(credits) && credits > 0
    if (hasCredits && range) return `${credits} cr (${range})`
    if (hasCredits) return `${credits} cr`
    if (range) return `${range} cr`
    return '—'
})

const hoursLabel = computed(() => {
    const total = props.discipline?.hours?.total
    if (Number.isFinite(total) && total > 0) return formatHours(total)
    return '—'
})

const periodLabel = computed(() => {
    const period = Number(props.period)
    if (!Number.isFinite(period) || period <= 0) return '—'
    return `${period}º`
})

const notScheduled = computed(() => props.discipline?.scheduled === false)

/** Ementa em parágrafos: respeita quebras de linha e linhas em branco da fonte. */
const ementaParagraphs = computed(() => {
    const text = String(props.discipline?.ementa ?? '').trim()
    if (!text) return []
    return text
        .split(/\r?\n\s*\r?\n|\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
})

const statusLabel = computed(() => {
    if (props.taken || props.status === 'taken') return 'cursada'
    if (props.status === 'available') return 'liberada'
    return 'bloqueada'
})

const statusClass = computed(() => {
    if (props.taken || props.status === 'taken') {
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
    if (props.status === 'available') {
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
    }
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
})

const toggleLabel = computed(() => (props.taken ? 'Desmarcar como cursada' : 'Marcar como cursada'))

function prereqClass(isTaken) {
    return isTaken
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

/** Fecha pelo teclado (Esc), além do botão e do clique no fundo. */
function onKeydown(event) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    emit('close')
}

onMounted(() => {
    previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)
    dialog.value?.focus?.()
})

onBeforeUnmount(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
    }
})
</script>

<template>
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="emit('close')"
    >
        <div
            ref="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discipline-details-title"
            tabindex="-1"
            class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800"
        >
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ code }}</p>
                    <h3 id="discipline-details-title" class="text-lg font-semibold leading-tight">
                        {{ name }}
                    </h3>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                        <span class="badge">{{ typeLabel }}</span>
                        <span v-if="groupLabel" class="badge">{{ groupLabel }}</span>
                        <span
                            class="rounded-full px-2 py-0.5 text-xs font-medium"
                            :class="statusClass"
                        >
                            {{ statusLabel }}
                        </span>
                        <span v-if="notScheduled" class="badge">sem oferta prevista</span>
                    </div>
                </div>
                <button type="button" class="btn shrink-0 text-xs" @click="emit('close')">
                    Fechar
                </button>
            </div>

            <div class="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                        <dt class="text-xs text-gray-500 dark:text-gray-400">Período sugerido</dt>
                        <dd class="font-medium">{{ periodLabel }}</dd>
                    </div>
                    <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                        <dt class="text-xs text-gray-500 dark:text-gray-400">Créditos</dt>
                        <dd class="font-medium">{{ creditsLabel }}</dd>
                    </div>
                    <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                        <dt class="text-xs text-gray-500 dark:text-gray-400">Carga horária</dt>
                        <dd class="font-medium">{{ hoursLabel }}</dd>
                    </div>
                </dl>

                <section class="mt-4">
                    <h4
                        class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                        Ementa
                    </h4>
                    <div
                        v-if="ementaParagraphs.length"
                        class="mt-1 space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                    >
                        <p v-for="(paragraph, index) in ementaParagraphs" :key="index">
                            {{ paragraph }}
                        </p>
                    </div>
                    <p v-else class="mt-1 text-sm italic text-gray-500 dark:text-gray-400">
                        Ementa não disponível nesta fonte.
                    </p>
                </section>

                <section class="mt-4">
                    <h4
                        class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                        Pré-requisitos
                    </h4>
                    <ul v-if="prereqs.length" class="mt-1 space-y-1">
                        <li
                            v-for="item in prereqs"
                            :key="item.code"
                            class="flex items-center gap-2 text-sm"
                        >
                            <button
                                v-if="item.inGraph"
                                type="button"
                                class="shrink-0 font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
                                :title="`Ver detalhes de ${item.code}`"
                                @click="emit('navigate', item.code)"
                            >
                                {{ item.code }}
                            </button>
                            <span
                                v-else
                                class="shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400"
                            >
                                {{ item.code }}
                            </span>
                            <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">
                                {{ item.name }}
                            </span>
                            <span
                                class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                                :class="prereqClass(item.taken)"
                            >
                                {{ item.taken ? 'cursada' : 'faltando' }}
                            </span>
                        </li>
                    </ul>
                    <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Sem pré-requisitos.
                    </p>
                </section>

                <section class="mt-4">
                    <h4
                        class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                        Libera diretamente
                    </h4>
                    <ul v-if="dependents.length" class="mt-1 space-y-1">
                        <li
                            v-for="item in dependents"
                            :key="item.code"
                            class="flex items-center gap-2 text-sm"
                        >
                            <button
                                v-if="item.kind !== 'slot'"
                                type="button"
                                class="shrink-0 font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
                                :title="`Ver detalhes de ${item.code}`"
                                @click="emit('navigate', item.code)"
                            >
                                {{ item.code }}
                            </button>
                            <span
                                v-else
                                class="shrink-0 font-mono text-xs text-violet-600 dark:text-violet-300"
                            >
                                optativa
                            </span>
                            <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">
                                {{ item.name }}
                            </span>
                            <span
                                v-if="Number.isFinite(Number(item.level)) && item.kind !== 'slot'"
                                class="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400"
                            >
                                Período {{ item.level }}
                            </span>
                        </li>
                    </ul>
                    <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma disciplina deste percurso depende dela diretamente.
                    </p>
                </section>
            </div>

            <div
                class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700"
            >
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Dá para marcar mesmo sem os pré-requisitos, para simular cenários.
                </p>
                <button
                    type="button"
                    class="btn-primary text-xs"
                    @click="emit('toggle-taken', code)"
                >
                    {{ toggleLabel }}
                </button>
            </div>
        </div>
    </div>
</template>

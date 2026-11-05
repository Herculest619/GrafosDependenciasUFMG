<script setup>
import { computed } from 'vue'

import { formatHours, percent } from '../core/format.mjs'

const props = defineProps({
    progress: { type: Object, required: true },
    summary: { type: Object, default: null },
    nextPeriod: { type: Number, default: null },
})

const obligatory = computed(() => props.progress.obligatory)
const optional = computed(() => props.progress.optional)

const obligatoryPercent = computed(() => {
    if (obligatory.value.hoursTotal > 0) {
        return percent(obligatory.value.hoursTaken, obligatory.value.hoursTotal)
    }
    return percent(obligatory.value.taken, obligatory.value.total)
})

const optionalPercent = computed(() => percent(optional.value.taken, optional.value.total))

const obligatoryBarLabel = computed(() =>
    obligatory.value.hoursTotal > 0
        ? `${formatHours(obligatory.value.hoursTaken)} de ${formatHours(
              obligatory.value.hoursTotal
          )}`
        : `${obligatory.value.taken} de ${obligatory.value.total} disciplinas`
)
</script>

<template>
    <section class="card space-y-4" aria-label="Seu progresso">
        <header class="flex items-baseline justify-between">
            <h2
                class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
                Seu progresso
            </h2>
            <span class="text-xs text-gray-400 dark:text-gray-500">salvo neste navegador</span>
        </header>

        <div>
            <div class="flex items-baseline justify-between text-sm">
                <span class="font-medium">Obrigatórias</span>
                <span class="text-gray-500 dark:text-gray-400">
                    {{ obligatory.taken }}/{{ obligatory.total }}
                </span>
            </div>
            <div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                    class="h-full rounded-full bg-emerald-500 transition-all"
                    :style="{ width: `${obligatoryPercent}%` }"
                ></div>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ obligatoryBarLabel }}</p>
        </div>

        <div v-if="optional.total > 0">
            <div class="flex items-baseline justify-between text-sm">
                <span class="font-medium">Optativas</span>
                <span class="text-gray-500 dark:text-gray-400"
                    >{{ optional.taken }}/{{ optional.total }}</span
                >
            </div>
            <div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                    class="h-full rounded-full bg-violet-500 transition-all"
                    :style="{ width: `${optionalPercent}%` }"
                ></div>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ optional.taken }} de {{ optional.total }} espaços de optativa preenchidos
            </p>
        </div>

        <dl
            class="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 text-sm dark:border-gray-700"
        >
            <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">Disciplinas liberadas</dt>
                <dd class="font-semibold">{{ progress.availableNow }}</dd>
            </div>
            <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">Próximo período</dt>
                <dd class="font-semibold">{{ nextPeriod ?? '—' }}</dd>
            </div>
            <div v-if="summary?.totalHours">
                <dt class="text-xs text-gray-500 dark:text-gray-400">Carga total do curso</dt>
                <dd class="font-semibold">{{ formatHours(summary.totalHours) }}</dd>
            </div>
            <div v-if="summary?.optionalHours?.min">
                <dt class="text-xs text-gray-500 dark:text-gray-400">Optativas exigidas</dt>
                <dd class="font-semibold">{{ formatHours(summary.optionalHours.min) }}</dd>
            </div>
        </dl>

        <p v-if="!summary" class="text-xs text-amber-600 dark:text-amber-400">
            Esta matriz veio de uma fonte sem carga horária e sem optativas mapeadas.
        </p>
    </section>
</template>

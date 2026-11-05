<script setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const THEME_KEY = 'grafos-ufmg:theme'
const isDark = ref(true)

function applyTheme(value) {
    document.documentElement.classList.toggle('dark', value)
    document.documentElement.style.colorScheme = value ? 'dark' : 'light'
}

onMounted(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') isDark.value = saved === 'dark'
    applyTheme(isDark.value)
})

watch(isDark, (value) => {
    applyTheme(value)
    try {
        localStorage.setItem(THEME_KEY, value ? 'dark' : 'light')
    } catch {
        /* localStorage pode estar indisponível */
    }
})

provide('theme', { isDark })

const themeLabel = computed(() => (isDark.value ? 'Tema claro' : 'Tema escuro'))
</script>

<template>
    <div
        class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
    >
        <header
            class="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
        >
            <div class="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3">
                <RouterLink to="/" class="flex items-center gap-2 font-semibold">
                    <span
                        class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
                        aria-hidden="true"
                        >GD</span
                    >
                    <span class="hidden sm:inline">Grafos de Dependências — UFMG</span>
                    <span class="sm:hidden">Grafos UFMG</span>
                </RouterLink>

                <nav class="ml-auto flex items-center gap-3 text-sm">
                    <RouterLink
                        to="/"
                        class="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                        Cursos
                    </RouterLink>
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        :aria-label="themeLabel"
                        :title="themeLabel"
                        @click="isDark = !isDark"
                    >
                        {{ isDark ? '☀️ Claro' : '🌙 Escuro' }}
                    </button>
                </nav>
            </div>
        </header>

        <main class="flex-1">
            <RouterView />
        </main>

        <footer
            class="border-t border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
        >
            <p>
                Apoio ao planejamento de matrícula. A fonte de verdade é sempre o
                <a
                    class="underline hover:text-gray-700 dark:hover:text-gray-200"
                    href="https://sistemas.ufmg.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Siga/minhaUFMG</a
                >
                e o colegiado do curso.
            </p>
            <p class="mt-1">
                Dados extraídos de relatórios públicos da UFMG (PROGRAD/Siga) — versões e datas em
                <code class="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">data/sources</code>.
            </p>
        </footer>
    </div>
</template>

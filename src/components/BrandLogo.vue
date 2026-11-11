<script setup>
/**
 * Marca do projeto: grafo de dependências (3 nós ligados) no azul da marca.
 * Usada no cabeçalho, no rodapé, no catálogo e no cartão social. O SVG é
 * inline para ficar nítido em qualquer tamanho e não depender de rede.
 */
defineProps({
    label: { type: String, default: '' },
})
</script>

<template>
    <svg
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        :role="label ? 'img' : undefined"
        :aria-label="label || undefined"
        :aria-hidden="label ? undefined : 'true'"
    >
        <rect width="256" height="256" rx="56" fill="#2563eb" />
        <g stroke="#ffffff" stroke-width="16" stroke-linecap="round">
            <line x1="128" y1="76" x2="74" y2="178" />
            <line x1="128" y1="76" x2="182" y2="178" />
            <line x1="74" y1="178" x2="182" y2="178" />
        </g>
        <g fill="#ffffff">
            <circle cx="128" cy="76" r="28" />
            <circle cx="74" cy="178" r="28" />
            <circle cx="182" cy="178" r="28" />
        </g>
    </svg>
</template>

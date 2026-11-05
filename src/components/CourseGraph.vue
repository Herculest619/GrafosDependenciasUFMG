<script setup>
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Network } from 'vis-network/esnext'
import { DataSet } from 'vis-data/esnext'
import 'vis-network/styles/vis-network.css'

const props = defineProps({
    graph: { type: Object, required: true },
    status: { type: Map, required: true },
})

const emit = defineEmits(['toggle'])

const theme = inject('theme', null)
const container = ref(null)

let network = null
let nodesSet = null
let edgesSet = null

const COLORS = {
    taken: { background: '#3b82f6', border: '#1d4ed8' },
    available: { background: '#34d399', border: '#047857' },
    blocked: { background: '#d1d5db', border: '#6b7280' },
    slot: { background: '#c4b5fd', border: '#7c3aed' },
}

/**
 * Repete a cor de estado em hover/highlight. Sem isso o vis-network aplica o
 * destaque padrão (fundo branco) ao passar o mouse ou ao arrastar o nó, e a cor
 * de "já cursada"/"pode cursar" parece sumir.
 */
function paint(color) {
    return {
        ...color,
        hover: { background: color.background, border: color.border },
        highlight: { background: color.background, border: color.border },
    }
}

function colorFor(node) {
    if (node.kind === 'slot') {
        return paint(props.status.get(node.id) === 'taken' ? COLORS.taken : COLORS.slot)
    }
    return paint(COLORS[props.status.get(node.id)] ?? COLORS.blocked)
}

function labelColor() {
    // Os nós usam fundos claros em ambos os temas, então o rótulo é sempre escuro.
    return '#111827'
}

function edgeColor() {
    return theme?.isDark?.value ? '#4b5563' : '#9ca3af'
}

function baseOptions() {
    return {
        autoResize: true,
        physics: false,
        layout: { improvedLayout: false, randomSeed: 7 },
        interaction: {
            hover: true,
            selectable: false,
            dragNodes: true,
            tooltipDelay: 150,
            zoomView: true,
            navigationButtons: false,
            keyboard: false,
        },
        nodes: {
            shape: 'box',
            margin: { top: 8, right: 10, bottom: 8, left: 10 },
            borderWidth: 1,
            shapeProperties: { borderRadius: 6 },
            widthConstraint: { maximum: 190 },
            font: {
                size: 14,
                face: 'ui-sans-serif, system-ui, sans-serif',
                color: labelColor(),
                multi: 'html',
            },
        },
        edges: {
            arrows: { to: { enabled: true, scaleFactor: 0.7 } },
            color: { color: edgeColor(), highlight: '#3b82f6', hover: '#3b82f6' },
            width: 1,
            smooth: { enabled: true, type: 'horizontal', roundness: 0.35 },
            hoverWidth: 0.3,
        },
    }
}

const LEVEL_SPACING = 260
const ROW_SPACING = 80
const MIN_INITIAL_SCALE = 0.65
const HEADER_OFFSET = -110

function levelHeaders(nodes) {
    const levels = [...new Set(nodes.map((node) => Number(node.level) || 1))].sort((a, b) => a - b)
    const slotLevel = nodes.find((node) => node.kind === 'slot')?.level ?? null
    return levels.map((level) => ({
        id: `__level_${level}`,
        label: level === slotLevel ? 'Optativas' : `Período ${level}`,
        x: level * LEVEL_SPACING,
        y: HEADER_OFFSET,
        fixed: { x: true, y: true },
        shape: 'text',
        font: { size: 14, color: '#9ca3af', face: 'ui-sans-serif, system-ui, sans-serif' },
        chosen: false,
    }))
}

function nodePositions(nodes) {
    const counts = new Map()
    const items = nodes.map((node) => {
        const level = Number(node.level) || 1
        const index = counts.get(level) ?? 0
        counts.set(level, index + 1)
        return {
            id: node.id,
            label: node.label,
            title: node.title,
            x: level * LEVEL_SPACING,
            y: index * ROW_SPACING,
            fixed: { x: true },
        }
    })
    return [...levelHeaders(nodes), ...items]
}

function buildDataset() {
    const nodes = nodePositions(props.graph.nodes).map((node) => {
        if (node.shape === 'text') return node
        const source = props.graph.nodes.find((candidate) => candidate.id === node.id)
        return { ...node, color: colorFor(source) }
    })
    const edges = props.graph.edges.map((edge, index) => ({
        id: `edge-${index}`,
        from: edge.from,
        to: edge.to,
    }))
    return { nodes: new DataSet(nodes), edges: new DataSet(edges) }
}

function destroyNetwork() {
    if (network) {
        network.destroy()
        network = null
        nodesSet = null
        edgesSet = null
    }
}

function mountNetwork() {
    destroyNetwork()
    if (!container.value || !props.graph.nodes.length) return

    const datasets = buildDataset()
    nodesSet = datasets.nodes
    edgesSet = datasets.edges

    network = new Network(container.value, { nodes: nodesSet, edges: edgesSet }, baseOptions())

    network.on('click', (params) => {
        // O evento "click" do vis-network traz params.nodes apenas quando há seleção;
        // como os nós não são selecionáveis, fazemos o hit-test pelo ponteiro.
        const nodeId = network.getNodeAt(params.pointer.DOM)
        if (nodeId === undefined || nodeId === null) return
        network.unselectAll()
        if (String(nodeId).startsWith('__level_')) return
        emit('toggle', nodeId)
    })

    // O arrasto vertical é permitido (para reorganizar dentro do período), mas o
    // vis-network seleciona o nó durante o gesto e guarda a posição só no modelo
    // interno. Gravamos a posição no DataSet e limpamos a seleção para a cor de
    // estado continuar valendo.
    network.on('dragEnd', () => {
        const positions = network.getPositions()
        const changed = Object.entries(positions)
            .filter(([id]) => !String(id).startsWith('__level_'))
            .map(([id, point]) => ({ id, x: point.x, y: point.y }))
        if (changed.length) nodesSet.update(changed)
        network.unselectAll()
        refreshColors()
    })

    // expõe a instância para depuração/ testes e2e: abra a página com ?debug=1
    if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
        window.__graphNetwork = network
    }

    scheduleInitialView(0)
}

/** Espera o container ganhar dimensões antes de posicionar a câmera. */
function scheduleInitialView(attempt) {
    requestAnimationFrame(() => {
        if (!network) return
        if (
            !container.value ||
            container.value.clientWidth < 50 ||
            container.value.clientHeight < 50
        ) {
            if (attempt < 6) setTimeout(() => scheduleInitialView(attempt + 1), 60)
            return
        }
        goToStart()
        // segunda passada: o canvas pode terminar de dimensionar depois do 1º frame
        setTimeout(() => {
            if (network) goToStart()
        }, 300)
    })
}

function fitAll() {
    if (!network) return
    network.fit({ animation: false })
    const scale = network.getScale()
    if (scale < MIN_INITIAL_SCALE) {
        network.moveTo({ scale: MIN_INITIAL_SCALE, position: network.getViewPosition() })
    }
}

/**
 * Câmera inicial: começa nos primeiros períodos com zoom 100% (texto nítido).
 * O grafo inteiro pode ser visto pelo botão "Ajustar".
 */
function goToStart() {
    if (!network || !container.value) return

    const nodes = props.graph.nodes
    const levels = nodes.map((node) => Number(node.level) || 1)
    // O centro vertical considera só as disciplinas: uma coluna de optativas
    // grande (ex.: 13 slots) não deve empurrar os períodos para fora da tela.
    const disciplineLevels = nodes
        .filter((node) => node.kind !== 'slot')
        .map((node) => Number(node.level) || 1)
    const rowsByLevel = new Map()
    for (const level of disciplineLevels.length ? disciplineLevels : levels) {
        rowsByLevel.set(level, (rowsByLevel.get(level) ?? 0) + 1)
    }

    const minX = Math.min(...levels) * LEVEL_SPACING
    const minY = HEADER_OFFSET
    const maxY = (Math.max(...rowsByLevel.values()) - 1) * ROW_SPACING
    const width = container.value.clientWidth
    const scale = 1

    network.moveTo({
        scale,
        position: {
            x: minX - 140 + width / 2 / scale,
            y: (minY + maxY) / 2,
        },
        animation: false,
    })
}

function refreshColors() {
    if (!nodesSet) return
    for (const node of props.graph.nodes) {
        const current = nodesSet.get(node.id)
        if (!current) continue
        nodesSet.update({ id: node.id, color: colorFor(node) })
    }
}

function focusNode(code) {
    if (!network || !code) return
    network.selectNodes([code])
    network.focus(code, {
        scale: 1.1,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    })
}

defineExpose({ focusNode, fitAll })

watch(
    () => props.graph,
    () => mountNetwork()
)

watch(
    () => props.status,
    () => refreshColors()
)

watch(
    () => theme?.isDark?.value,
    () => {
        if (!network) return
        network.setOptions({
            nodes: { font: { color: labelColor() } },
            edges: { color: { color: edgeColor() } },
        })
    }
)

onMounted(mountNetwork)

onBeforeUnmount(destroyNetwork)
</script>

<template>
    <div ref="container" class="h-full w-full"></div>
</template>

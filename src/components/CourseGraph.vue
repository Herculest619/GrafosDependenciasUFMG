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

function colorFor(node) {
    if (node.kind === 'slot') {
        return props.status.get(node.id) === 'taken' ? COLORS.taken : COLORS.slot
    }
    return COLORS[props.status.get(node.id)] ?? COLORS.blocked
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
            navigationButtons: true,
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
        if (!params.nodes.length) return
        const nodeId = params.nodes[0]
        if (String(nodeId).startsWith('__level_')) return
        emit('toggle', nodeId)
    })

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
 * Câmera inicial: começa nos primeiros períodos com zoom legível.
 * Se o grafo inteiro couber na tela, mostra tudo; senão alinha à esquerda
 * (o usuário arrasta/usa os botões de navegação para o restante).
 */
function goToStart() {
    if (!network || !container.value) return

    const nodes = props.graph.nodes
    const levels = nodes.map((node) => Number(node.level) || 1)
    const rowsByLevel = new Map()
    for (const level of levels) rowsByLevel.set(level, (rowsByLevel.get(level) ?? 0) + 1)

    const minX = Math.min(...levels) * LEVEL_SPACING
    const maxX = Math.max(...levels) * LEVEL_SPACING
    const minY = HEADER_OFFSET
    const maxY = (Math.max(...rowsByLevel.values()) - 1) * ROW_SPACING

    const width = container.value.clientWidth
    const height = container.value.clientHeight
    const graphWidth = maxX - minX + 320
    const graphHeight = maxY - minY + 120
    const fitScale = Math.min(width / graphWidth, height / graphHeight)

    if (fitScale >= 0.75) {
        network.moveTo({
            scale: Math.min(fitScale, 1),
            position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
            animation: false,
        })
        return
    }

    const scale = 0.8
    network.moveTo({
        scale,
        position: {
            x: minX - 180 + width / 2 / scale,
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

/* =============================================================================
   charts.js — Gráficos interactivos de resultados (Chart.js)
   Indagación: "La Germinación de la Lenteja y la Cantidad de Agua"
   ============================================================================= */

/* ---------------------------------------------------------------------------
   DATOS EXPERIMENTALES COMPARTIDOS (también los usa app.js)
--------------------------------------------------------------------------- */
const TREATMENTS = [
    {
        id: '5ml', ml: 5, label: 'Botella 5 ml', short: '5 ml',
        color: '#38bdf8', colorDim: '#0288D1',
        germination: 30, maxLength: 1.5,
        growth: [0, 0.1, 0.2, 0.4, 0.7, 1.0, 1.5],
        model: 'assets/models/lenteja_5ml_opt.glb', fallback: 'sprout-5',
        status: 'Crecimiento lento',
        desc: 'Agua insuficiente: la mayoría de semillas permanece en latencia.'
    },
    {
        id: '10ml', ml: 10, label: 'Botella 10 ml', short: '10 ml',
        color: '#8c9e2d', colorDim: '#6B8E23',
        germination: 75, maxLength: 5,
        growth: [0, 0.3, 0.8, 1.6, 2.8, 3.9, 5.0],
        model: 'assets/models/lenteja_10ml_opt.glb', fallback: 'sprout-10',
        status: 'Crecimiento medio',
        desc: 'Desarrollo intermedio y más lento que el óptimo.'
    },
    {
        id: '15ml', ml: 15, label: 'Botella 15 ml', short: '15 ml',
        color: '#34d399', colorDim: '#4CAF50',
        germination: 100, maxLength: 12,
        growth: [0, 0.8, 2.2, 4.5, 7.0, 9.5, 12.0],
        model: 'assets/models/lenteja_15ml_opt.glb', fallback: 'sprout-15',
        status: 'Desarrollo óptimo y vigoroso',
        desc: 'Máximo porcentaje de germinación y crecimiento vigoroso.'
    }
];

const DAYS = ['Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5', 'Día 6', 'Día 7'];

/* ---------------------------------------------------------------------------
   ESTADO Y CONFIGURACIÓN DE TEMA
--------------------------------------------------------------------------- */
let growthChart = null;
let germinationChart = null;
let showingTable = false;

function chartTheme() {
    const dark = document.documentElement.classList.contains('dark');
    return {
        text: dark ? '#a7d7c0' : '#4a6b58',
        grid: dark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(16, 36, 26, 0.08)'
    };
}

function largeTooltip() {
    return {
        backgroundColor: 'rgba(10, 30, 22, 0.92)',
        titleFont: { family: 'JetBrains Mono', size: 14, weight: '700' },
        bodyFont: { family: 'Inter', size: 15, weight: '600' },
        padding: 14,
        cornerRadius: 12,
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12
    };
}

/* ---------------------------------------------------------------------------
   INICIALIZACIÓN DE GRÁFICOS
--------------------------------------------------------------------------- */
function initCharts() {
    if (typeof Chart === 'undefined') return;

    const t = chartTheme();

    // ---- GRÁFICO 1: Líneas — Longitud promedio del brote (cm) Días 1-7 ----
    const growthCtx = document.getElementById('growthChart');
    if (growthCtx) {
        growthChart = new Chart(growthCtx, {
            type: 'line',
            data: {
                labels: DAYS,
                datasets: TREATMENTS.map(tr => ({
                    label: `${tr.short} (máx ${tr.maxLength} cm)`,
                    data: tr.growth,
                    borderColor: tr.color,
                    backgroundColor: tr.color + '26',
                    pointBackgroundColor: tr.color,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4.5,
                    pointHoverRadius: 8,
                    borderWidth: 3.5,
                    tension: 0.35,
                    fill: true
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: t.text, font: { family: 'Inter', size: 13, weight: '600' } }
                    },
                    tooltip: largeTooltip()
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Días', color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        grid: { color: t.grid }
                    },
                    y: {
                        title: { display: true, text: 'Crecimiento (cm)', color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        grid: { color: t.grid },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // ---- GRÁFICO 2: Barras — Porcentaje de germinación (Día 7) ----
    const germCtx = document.getElementById('germinationChart');
    if (germCtx) {
        germinationChart = new Chart(germCtx, {
            type: 'bar',
            data: {
                labels: TREATMENTS.map(tr => tr.short),
                datasets: [{
                    label: '% de Germinación (Día 7)',
                    data: TREATMENTS.map(tr => tr.germination),
                    backgroundColor: TREATMENTS.map(tr => tr.color + 'cc'),
                    borderColor: TREATMENTS.map(tr => tr.color),
                    borderWidth: 2.5,
                    borderRadius: 10,
                    maxBarThickness: 110
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: t.text, font: { family: 'Inter', size: 13, weight: '600' } }
                    },
                    tooltip: largeTooltip()
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Tratamiento de agua', color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 13, weight: '700' } },
                        grid: { color: t.grid }
                    },
                    y: {
                        title: { display: true, text: '% de Germinación', color: t.text, font: { family: 'JetBrains Mono', size: 12 } },
                        ticks: { color: t.text, font: { family: 'JetBrains Mono', size: 12 }, callback: v => v + '%' },
                        grid: { color: t.grid },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
}

/* ---------------------------------------------------------------------------
   UTILIDADES PÚBLICAS (llamadas desde app.js)
--------------------------------------------------------------------------- */
function resizeCharts() {
    if (growthChart) growthChart.resize();
    if (germinationChart) germinationChart.resize();
}

function refreshCharts() {
    if (growthChart) { growthChart.destroy(); growthChart = null; }
    if (germinationChart) { germinationChart.destroy(); germinationChart = null; }
    initCharts();
}

/* ---------------------------------------------------------------------------
   ALTERNAR ENTRE GRÁFICOS Y TABLA DE DATOS
--------------------------------------------------------------------------- */
function toggleDataView() {
    showingTable = !showingTable;
    document.getElementById('chartsView').classList.toggle('hidden', showingTable);
    document.getElementById('tableView').classList.toggle('hidden', !showingTable);
    document.getElementById('toggleDataViewBtn').textContent = showingTable ? 'Ver Gráficos' : 'Ver Tabla de Datos';
    if (!showingTable) setTimeout(resizeCharts, 80);
}

/* ---------------------------------------------------------------------------
   INICIALIZACIÓN
--------------------------------------------------------------------------- */
window.addEventListener('load', () => {
    initCharts();
});

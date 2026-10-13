/**
 * Módulo de Gráficos - con protección contra Chart.js no disponible
 */

const Charts = (() => {
    let incomeChart = null;
    let membershipChart = null;
    let analysisChart = null;

    function initialize() {
        // FIX: verificar que Chart.js esté disponible antes de usarlo
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está disponible. Los gráficos no se mostrarán.');
            return;
        }
        try {
            setupAnalysisListeners();
            updateAllCharts();
        } catch (e) {
            console.warn('Error al inicializar gráficos:', e.message);
        }
    }

    function updateAllCharts() {
        if (typeof Chart === 'undefined') return;
        updateIncomeChart();
        updateMembershipChart();
        updateAnalysisChart();
    }

    function destroyChart(chartInstance) {
        try { if (chartInstance) chartInstance.destroy(); } catch(e) {}
        return null;
    }

    function updateIncomeChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('incomeChart');
        if (!canvas) return;

        const income  = Storage.getIncome();
        const labels  = [];
        const values  = [];
        const now     = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ms = d.toISOString().slice(0, 7);
            const { start, end } = Utils.getMonthRange(ms);
            const total = income
                .filter(p => p.paymentDate >= start && p.paymentDate <= end)
                .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
            labels.push(d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
            values.push(total);
        }

        incomeChart = destroyChart(incomeChart);
        incomeChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Ingresos',
                    data: values,
                    backgroundColor: 'rgba(39,249,212,0.7)',
                    borderColor: '#27F9D4',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => Utils.formatCurrency(c.raw) } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => Utils.formatCurrency(v), color: '#f8f9fa' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#f8f9fa' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    function updateMembershipChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('membershipChart');
        if (!canvas) return;

        const users = Users.getActiveUsers();
        const groups = Utils.groupBy(users, 'affiliationType');
        const labels = Object.keys(groups);
        const data   = labels.map(l => groups[l].length);

        if (labels.length === 0) return;

        membershipChart = destroyChart(membershipChart);
        membershipChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#27F9D4','#FF729F','#F0F66E','#7C77B9','#1D8A99'],
                    borderColor: '#1a2332',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#f8f9fa', padding: 12, font: { size: 12 } }
                    }
                }
            }
        });
    }

    /* ================= ANÁLISIS COMPARATIVO ================= */

    // Normaliza a 'YYYY-MM-DD' (acepta string ISO o Date)
    function toISODate(v) {
        if (!v) return null;
        if (v instanceof Date) {
            return isNaN(v) ? null : v.getFullYear() + '-' +
                String(v.getMonth() + 1).padStart(2, '0') + '-' +
                String(v.getDate()).padStart(2, '0');
        }
        const s = String(v).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }

    function ymKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // n meses terminando en el mes actual; yearsBack desplaza n años atrás
    function monthsBack(n, yearsBack = 0) {
        const now = new Date(), out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear() - yearsBack, now.getMonth() - i, 1);
            out.push({
                key: ymKey(d),
                label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
            });
        }
        return out;
    }

    function getAttendanceRecords() {
        return (typeof Storage.getAttendance === 'function' ? Storage.getAttendance() : []) || [];
    }

    // Presente = sin status o status 'presente'
    function isPresent(a) {
        return !a.status || String(a.status).toLowerCase() === 'presente';
    }

    function monthlyTotals(metric) {
        const map = {};
        if (metric === 'income') {
            (Storage.getIncome() || []).forEach(p => {
                const d = toISODate(p.paymentDate);
                if (!d) return;
                const k = d.slice(0, 7);
                map[k] = (map[k] || 0) + parseFloat(p.amount || 0);
            });
        } else {
            getAttendanceRecords().forEach(a => {
                if (!isPresent(a)) return;
                const d = toISODate(a.date);
                if (!d) return;
                const k = d.slice(0, 7);
                map[k] = (map[k] || 0) + 1;
            });
        }
        return map;
    }

    // Asistencias por día (Lun..Dom) de los últimos 6 meses
    function weekdayTotals() {
        const counts = [0, 0, 0, 0, 0, 0, 0]; // dom..sáb
        const start = monthsBack(6)[0].key + '-01';
        getAttendanceRecords().forEach(a => {
            if (!isPresent(a)) return;
            const d = toISODate(a.date);
            if (!d || d < start) return;
            const [y, m, dd] = d.split('-').map(Number);
            counts[new Date(y, m - 1, dd).getDay()]++;
        });
        return [1, 2, 3, 4, 5, 6, 0].map(i => counts[i]);
    }

    function updateAnalysisChart() {
        if (typeof Chart === 'undefined') return;
        const canvas = document.getElementById('analysisChart');
        if (!canvas) return;

        const metric = document.getElementById('analysisMetric')?.value || 'income';
        const viewSel = document.getElementById('analysisView');
        let view = viewSel?.value || '6m';

        // Día de la semana solo aplica a asistencia
        if (viewSel) {
            const wdOpt = viewSel.querySelector('option[value="weekday"]');
            if (wdOpt) wdOpt.disabled = metric === 'income';
            if (metric === 'income' && view === 'weekday') {
                viewSel.value = '6m';
                view = '6m';
            }
        }

        const isInc = metric === 'income';
        const fmt = v => isInc ? Utils.formatCurrency(v) : v;
        const totals = monthlyTotals(metric);
        const color = isInc ? '39,249,212' : '255,114,159';
        const mk = (label, data, rgb) => ({
            label, data,
            backgroundColor: `rgba(${rgb},0.7)`,
            borderColor: `rgb(${rgb})`,
            borderWidth: 2,
            borderRadius: 6
        });

        let labels, datasets;
        if (view === 'weekday') {
            labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            datasets = [mk('Asistencias (últimos 6 meses)', weekdayTotals(), color)];
        } else if (view === 'yoy') {
            const cur = monthsBack(6), prev = monthsBack(6, 1);
            labels = cur.map(m => m.label);
            datasets = [
                mk('Año anterior', prev.map(m => totals[m.key] || 0), '139,148,158'),
                mk('Actual', cur.map(m => totals[m.key] || 0), color)
            ];
        } else {
            const ms = monthsBack(view === '3m' ? 3 : 6);
            labels = ms.map(m => m.label);
            datasets = [mk(isInc ? 'Ingresos' : 'Asistencias', ms.map(m => totals[m.key] || 0), color)];
        }

        analysisChart = destroyChart(analysisChart);
        analysisChart = new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: datasets.length > 1, labels: { color: '#f8f9fa' } },
                    tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)}` } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => fmt(v), color: '#f8f9fa' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#f8f9fa' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    function setupAnalysisListeners() {
        ['analysisMetric', 'analysisView'].forEach(id =>
            document.getElementById(id)?.addEventListener('change', updateAnalysisChart));
    }

    return { initialize, updateAllCharts, updateIncomeChart, updateMembershipChart, updateAnalysisChart };
})();

window.Charts = Charts;

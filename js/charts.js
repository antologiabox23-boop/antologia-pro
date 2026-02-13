/**
 * Módulo de Gráficos - con protección contra Chart.js no disponible
 */

const Charts = (() => {
    let incomeChart = null;
    let membershipChart = null;

    function initialize() {
        // FIX: verificar que Chart.js esté disponible antes de usarlo
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está disponible. Los gráficos no se mostrarán.');
            return;
        }
        try {
            updateAllCharts();
        } catch (e) {
            console.warn('Error al inicializar gráficos:', e.message);
        }
    }

    function updateAllCharts() {
        if (typeof Chart === 'undefined') return;
        updateIncomeChart();
        updateMembershipChart();
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

    return { initialize, updateAllCharts, updateIncomeChart, updateMembershipChart };
})();

window.Charts = Charts;

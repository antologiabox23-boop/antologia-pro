const Charts = (() => {
    let incomeChart = null;
    let membershipChart = null;

    function initialize() {
        updateAllCharts();
    }

    function updateAllCharts() {
        updateIncomeChart();
        updateMembershipChart();
    }

    function updateIncomeChart() {
        const ctx = document.getElementById('incomeChart');
        if (!ctx) return;

        const income = Storage.getIncome();
        const last6Months = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = date.toISOString().slice(0, 7);
            const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            
            const { start, end } = Utils.getMonthRange(monthStr);
            const monthIncome = income.filter(p => p.paymentDate >= start && p.paymentDate <= end);
            const total = monthIncome.reduce((sum, p) => sum + parseFloat(p.amount), 0);

            last6Months.push({ label: monthName, value: total });
        }

        if (incomeChart) incomeChart.destroy();

        incomeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [{
                    label: 'Ingresos',
                    data: last6Months.map(m => m.value),
                    backgroundColor: 'rgba(39, 249, 212, 0.7)',
                    borderColor: '#27F9D4',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => Utils.formatCurrency(context.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => Utils.formatCurrency(value),
                            color: '#f8f9fa'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#f8f9fa' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }

    function updateMembershipChart() {
        const ctx = document.getElementById('membershipChart');
        if (!ctx) return;

        const users = Users.getActiveUsers();
        const types = Utils.groupBy(users, 'affiliationType');
        const data = Object.entries(types).map(([type, users]) => ({
            label: type,
            value: users.length
        }));

        if (membershipChart) membershipChart.destroy();

        membershipChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.value),
                    backgroundColor: ['#27F9D4', '#FF729F', '#F0F66E', '#7C77B9', '#1D8A99'],
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
                        labels: { color: '#f8f9fa', padding: 15 }
                    }
                }
            }
        });
    }

    return {
        initialize,
        updateAllCharts,
        updateIncomeChart,
        updateMembershipChart
    };
})();
window.Charts = Charts;

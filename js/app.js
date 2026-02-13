/**
 * Aplicación Principal - Antología Box23 v2.0
 */

const Dashboard = (() => {
    function initialize() {
        try { updateStats(); } catch(e) { console.warn('Dashboard stats:', e.message); }
        try { updateRecentActivity(); } catch(e) { console.warn('Dashboard activity:', e.message); }
        setupQuickActions();
    }

    function updateStats() {
        const activeUsers = Users.getActiveUsers();

        // Usuarios activos
        const countEl = document.getElementById('activeUsersCount');
        if (countEl) UI.updateCounter('activeUsersCount', activeUsers.length);

        // Ingresos del mes
        const { start, end } = Utils.getMonthRange(Utils.getCurrentMonth());
        const monthlyPayments = Storage.getIncomeByDateRange(start, end);
        const monthlyTotal = monthlyPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const incomeEl = document.getElementById('monthlyIncome');
        if (incomeEl) incomeEl.textContent = Utils.formatCurrency(monthlyTotal);

        // Asistencia hoy
        const todayAttendance = Storage.getAttendanceByDate(Utils.getCurrentDate())
            .filter(a => a.status === 'presente');
        UI.updateCounter('todayAttendance', todayAttendance.length);

        const rate = activeUsers.length > 0
            ? ((todayAttendance.length / activeUsers.length) * 100).toFixed(1) : 0;
        const rateEl = document.getElementById('todayAttendanceRate');
        if (rateEl) rateEl.textContent = `${rate}% de ocupación`;

        // Pagos pendientes
        const paid = new Set(monthlyPayments.map(p => p.userId));
        const pending = activeUsers.filter(u => !paid.has(u.id) && u.affiliationType !== 'Entrenador(a)');
        UI.updateCounter('pendingPayments', pending.length);
        const pendingAmtEl = document.getElementById('pendingPaymentsAmount');
        if (pendingAmtEl) pendingAmtEl.textContent = `${pending.length} sin pagar este mes`;

        // Gráficos
        if (window.Charts && typeof Chart !== 'undefined') {
            try { Charts.updateAllCharts(); } catch(e) { console.warn('Charts:', e.message); }
        }
    }

    function updateRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        const recentPayments = Storage.getIncome().slice(-5).reverse();
        const recentAttendance = Storage.getAttendance().slice(-5).reverse();

        const activities = [
            ...recentPayments.map(p => ({
                icon: 'dollar-sign',
                text: `Pago de ${Storage.getUserById(p.userId)?.name || 'Usuario'} — ${Utils.formatCurrency(p.amount)}`,
                time: Utils.formatDateTime(p.createdAt),
                date: p.createdAt || ''
            })),
            ...recentAttendance.map(a => ({
                icon: 'clipboard-check',
                text: `${Storage.getUserById(a.userId)?.name || 'Usuario'} marcó asistencia`,
                time: Utils.formatDateTime(a.createdAt),
                date: a.createdAt || ''
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

        if (activities.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3">No hay actividad reciente</p>';
            return;
        }

        container.innerHTML = activities.map(a => `
            <div class="activity-item d-flex align-items-center mb-2">
                <div class="activity-icon me-3">
                    <i class="fas fa-${a.icon}"></i>
                </div>
                <div class="activity-content">
                    <div style="font-size:.9rem">${a.text}</div>
                    <small class="activity-time">${a.time}</small>
                </div>
            </div>`).join('');
    }

    function setupQuickActions() {
        document.getElementById('quickAddUser')?.addEventListener('click', () => {
            UI.switchTab('users');
            setTimeout(() => Users.openUserModal(), 400);
        });
        document.getElementById('quickAddPayment')?.addEventListener('click', () => {
            UI.switchTab('income');
            setTimeout(() => { Income.populateSelect(); UI.showModal('incomeModal'); }, 400);
        });
        document.getElementById('quickAttendance')?.addEventListener('click', () => UI.switchTab('attendance'));
        document.getElementById('quickReport')?.addEventListener('click', () => UI.switchTab('reports'));
    }

    return { initialize, updateStats, updateRecentActivity };
})();

// ─── Configuración ───────────────────────────────────────────────────────────
const Settings = (() => {
    function initialize() {
        setupEventListeners();
        loadSettings();
    }

    function setupEventListeners() {
        document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
        document.getElementById('clearAllData')?.addEventListener('click', clearAllData);
        document.getElementById('itemsPerPage')?.addEventListener('change', (e) => {
            Storage.updateSettings({ itemsPerPage: parseInt(e.target.value) });
        });
    }

    function loadSettings() {
        const s = Storage.getSettings();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
        set('themeSelect', s.theme || 'dark');
        set('itemsPerPage', s.itemsPerPage || 25);
        chk('notificationsToggle', s.notifications !== false);
        chk('autoBackupToggle', s.autoBackup || false);
    }

    function saveSettings() {
        const get = (id) => document.getElementById(id);
        const settings = {
            theme:          get('themeSelect')?.value || 'dark',
            itemsPerPage:   parseInt(get('itemsPerPage')?.value || '25'),
            notifications:  get('notificationsToggle')?.checked !== false,
            autoBackup:     get('autoBackupToggle')?.checked || false
        };
        Storage.updateSettings(settings);
        UI.showSuccessToast('Configuración guardada');
        UI.setTheme(settings.theme);
    }

    function clearAllData() {
        UI.showConfirmModal(
            'Eliminar Todos los Datos',
            '⚠️ ADVERTENCIA: Se eliminarán PERMANENTEMENTE todos los usuarios, asistencias y pagos. ¿Continuar?',
            () => {
                Storage.clear();
                Storage.initialize();
                UI.showSuccessToast('Datos eliminados');
                setTimeout(() => location.reload(), 1200);
            },
            true
        );
    }

    return { initialize, loadSettings };
})();

// ─── Bootstrap de la aplicación ──────────────────────────────────────────────
(function boot() {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // 1. Módulos de datos (sin DOM)
            Storage.initialize();

            // 2. UI (necesita DOM)
            UI.initialize();
            UI.showLoading('Iniciando Antología Box23…');

            await Utils.sleep(200);

            // 3. Módulos funcionales
            Users.initialize();
            Attendance.initialize();
            Income.initialize();
            Reports.initialize();
            Charts.initialize();    // protegido internamente contra Chart.js ausente
            Backup.initialize();
            Dashboard.initialize();
            Settings.initialize();
            Backup.checkAutoBackup();

            UI.hideLoading();

            // Bienvenida primera vez
            if (Storage.getUsers().length === 0) {
                setTimeout(() => UI.showInfoToast('¡Bienvenido! Comienza agregando usuarios.'), 1000);
            }

            console.log('%c✓ Antología Box23 v2.0 – Listo', 'color:#27F9D4;font-weight:bold;font-size:14px');

        } catch (err) {
            console.error('Error de inicio:', err);
            UI.hideLoading();
            UI.showErrorToast(`Error de inicio: ${err.message}`);
        }
    });

    // Errores globales no capturados
    window.addEventListener('error', (e) => {
        console.error('Error global:', e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promesa rechazada:', e.reason);
    });
})();

window.App      = { version: '2.0' };
window.Dashboard = Dashboard;
window.Settings  = Settings;

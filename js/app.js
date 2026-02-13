/**
 * Aplicación Principal - Antología Box23
 * Coordinación de todos los módulos y gestión del dashboard
 */

const Dashboard = (() => {
    function initialize() {
        updateStats();
        updateRecentActivity();
        setupQuickActions();
    }

    function updateStats() {
        // Usuarios activos
        const activeUsers = Users.getActiveUsers();
        UI.updateCounter('activeUsersCount', activeUsers.length);

        // Ingresos del mes
        const { start, end } = Utils.getMonthRange(Utils.getCurrentMonth());
        const monthlyPayments = Storage.getIncomeByDateRange(start, end);
        const monthlyTotal = monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        document.getElementById('monthlyIncome').textContent = Utils.formatCurrency(monthlyTotal);

        // Asistencia de hoy
        const todayDate = Utils.getCurrentDate();
        const todayAttendance = Storage.getAttendanceByDate(todayDate).filter(a => a.status === 'presente');
        UI.updateCounter('todayAttendance', todayAttendance.length);
        
        const attendanceRate = activeUsers.length > 0 
            ? ((todayAttendance.length / activeUsers.length) * 100).toFixed(1)
            : 0;
        document.getElementById('todayAttendanceRate').textContent = `${attendanceRate}% de ocupación`;

        // Pagos pendientes (usuarios sin pago este mes)
        const usersPaidThisMonth = new Set(monthlyPayments.map(p => p.userId));
        const pendingPayments = activeUsers.filter(u => 
            !usersPaidThisMonth.has(u.id) && u.affiliationType !== 'Entrenador(a)'
        );
        UI.updateCounter('pendingPayments', pendingPayments.length);

        // Actualizar gráficos
        if (window.Charts) {
            Charts.updateAllCharts();
        }
    }

    function updateRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        const recentPayments = Storage.getIncome().slice(-5).reverse();
        const recentAttendance = Storage.getAttendance().slice(-5).reverse();

        const activities = [
            ...recentPayments.map(p => ({
                type: 'payment',
                icon: 'dollar-sign',
                text: `Pago de ${Storage.getUserById(p.userId)?.name || 'Usuario'} - ${Utils.formatCurrency(p.amount)}`,
                time: Utils.formatDateTime(p.createdAt),
                date: p.createdAt
            })),
            ...recentAttendance.map(a => ({
                type: 'attendance',
                icon: 'clipboard-check',
                text: `${Storage.getUserById(a.userId)?.name || 'Usuario'} marcó asistencia`,
                time: Utils.formatDateTime(a.createdAt),
                date: a.createdAt
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

        if (activities.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No hay actividad reciente</p>';
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item d-flex align-items-center">
                <div class="activity-icon">
                    <i class="fas fa-${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div>${activity.text}</div>
                    <small class="activity-time">${activity.time}</small>
                </div>
            </div>
        `).join('');
    }

    function setupQuickActions() {
        document.getElementById('quickAddUser')?.addEventListener('click', () => {
            UI.switchTab('users');
            Users.openUserModal();
        });

        document.getElementById('quickAddPayment')?.addEventListener('click', () => {
            UI.switchTab('income');
            document.querySelector('[data-bs-target="#incomeModal"]')?.click();
        });

        document.getElementById('quickAttendance')?.addEventListener('click', () => {
            UI.switchTab('attendance');
        });

        document.getElementById('quickReport')?.addEventListener('click', () => {
            UI.switchTab('reports');
        });
    }

    return {
        initialize,
        updateStats,
        updateRecentActivity
    };
})();

// Módulo de Configuración
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
        const settings = Storage.getSettings();
        document.getElementById('themeSelect').value = settings.theme || 'dark';
        document.getElementById('itemsPerPage').value = settings.itemsPerPage || 25;
        document.getElementById('notificationsToggle').checked = settings.notifications !== false;
        document.getElementById('autoBackupToggle').checked = settings.autoBackup || false;
    }

    function saveSettings() {
        const settings = {
            theme: document.getElementById('themeSelect').value,
            itemsPerPage: parseInt(document.getElementById('itemsPerPage').value),
            notifications: document.getElementById('notificationsToggle').checked,
            autoBackup: document.getElementById('autoBackupToggle').checked
        };

        Storage.updateSettings(settings);
        UI.showSuccessToast('Configuración guardada exitosamente');
        UI.setTheme(settings.theme);
    }

    function clearAllData() {
        UI.showConfirmModal(
            'Eliminar Todos los Datos',
            '⚠️ ADVERTENCIA: Esta acción eliminará PERMANENTEMENTE todos los usuarios, asistencias y pagos. Esta operación NO se puede deshacer. ¿Estás completamente seguro?',
            () => {
                UI.showLoading('Eliminando todos los datos...');
                setTimeout(() => {
                    Storage.clear();
                    Storage.initialize();
                    UI.hideLoading();
                    UI.showSuccessToast('Todos los datos han sido eliminados');
                    setTimeout(() => location.reload(), 1500);
                }, 1000);
            },
            true
        );
    }

    return {
        initialize
    };
})();

// Inicialización de la Aplicación
(function initializeApp() {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // Mostrar loading inicial
            UI.showLoading('Iniciando aplicación...');

            // Esperar un momento para que el DOM se estabilice
            await Utils.sleep(300);

            // Inicializar módulos de base
            Storage.initialize();
            UI.initialize();

            // Inicializar módulos principales
            Users.initialize();
            Attendance.initialize();
            Income.initialize();
            Reports.initialize();
            Charts.initialize();
            Backup.initialize();
            Dashboard.initialize();
            Settings.initialize();

            // Verificar respaldo automático
            Backup.checkAutoBackup();

            // Aplicar animaciones
            setTimeout(() => {
                UI.animateElements();
            }, 100);

            // Ocultar loading
            setTimeout(() => {
                UI.hideLoading();
            }, 800);

            // Mostrar mensaje de bienvenida
            setTimeout(() => {
                const isFirstTime = !Storage.getLastBackupDate() && Storage.getUsers().length === 0;
                if (isFirstTime) {
                    UI.showInfoToast('¡Bienvenido a Antología Box23! Comienza agregando usuarios.', 5000);
                }
            }, 1500);

            // Log de inicialización exitosa
            console.log('%c✓ Antología Box23 - Sistema Inicializado', 
                'color: #27F9D4; font-size: 16px; font-weight: bold;');
            console.log('Versión: 2.0');
            console.log('Usuarios:', Storage.getUsers().length);
            console.log('Registros de asistencia:', Storage.getAttendance().length);
            console.log('Pagos registrados:', Storage.getIncome().length);

        } catch (error) {
            console.error('Error crítico al inicializar la aplicación:', error);
            UI.hideLoading();
            UI.showErrorToast('Error al inicializar la aplicación. Por favor, recarga la página.');
        }
    });

    // Guardar cambios antes de cerrar
    window.addEventListener('beforeunload', (e) => {
        const usage = Storage.getStorageUsage();
        console.log('Guardando cambios...', usage);
    });

    // Manejo de errores globales
    window.addEventListener('error', (e) => {
        console.error('Error no capturado:', e.error);
        UI.showErrorToast('Ocurrió un error inesperado. Revisa la consola para más detalles.');
    });

    // Manejo de promesas rechazadas
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promesa rechazada:', e.reason);
        UI.showErrorToast('Error en operación asíncrona.');
    });
})();

// Exponer módulos globalmente
window.App = {
    Dashboard,
    Settings,
    version: '2.0',
    build: '2024-02-08'
};

// Exportar para uso en otros módulos
window.Dashboard = Dashboard;
window.Settings = Settings;

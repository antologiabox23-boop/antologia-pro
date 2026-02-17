/**
 * Aplicación Principal - Antología Box23 v2.0
 */

const Dashboard = (() => {
    function initialize() {
        updateStats();
        updateRecentActivity();
        setupQuickActions();
    }

    function updateStats() {
        try {
            // Usuarios activos (sin entrenadores)
            const activeUsers = Users.getActiveUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
            const el = document.getElementById('activeUsersCount');
            if (el) el.textContent = activeUsers.length;

            // Ingresos del mes
            const { start, end } = Utils.getMonthRange(Utils.getCurrentMonth());
            const monthlyPayments = Storage.getIncomeByDateRange(start, end);
            const monthlyTotal = monthlyPayments.reduce((s, p) => s + Utils.parseAmount(p.amount), 0);
            const incomeEl = document.getElementById('monthlyIncome');
            if (incomeEl) incomeEl.textContent = Utils.formatCurrency(monthlyTotal);

            // Asistencia hoy
            const today = Utils.getCurrentDate();
            const todayAttendance = Storage.getAttendanceByDate(today).filter(a => a.status === 'presente');
            const attEl = document.getElementById('todayAttendance');
            if (attEl) attEl.textContent = todayAttendance.length;
            const rate = activeUsers.length > 0
                ? ((todayAttendance.length / activeUsers.length) * 100).toFixed(0) : 0;
            const rateEl = document.getElementById('todayAttendanceRate');
            if (rateEl) rateEl.textContent = `${rate}% asistencia`;

            // Vigencias vencidas
            const vencidas = activeUsers.filter(u => {
                const pay = Storage.getIncome()
                    .filter(p => p.userId === u.id && p.endDate)
                    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
                return !pay || pay.endDate < today;
            }).length;
            const pendEl = document.getElementById('pendingPayments');
            if (pendEl) pendEl.textContent = vencidas;
            const pendTxt = document.getElementById('pendingPaymentsAmount');
            if (pendTxt) pendTxt.textContent = `${vencidas} vigencia${vencidas !== 1 ? 's' : ''} vencida${vencidas !== 1 ? 's' : ''}`;

            if (window.Charts && typeof Chart !== 'undefined') {
                try { Charts.updateAllCharts(); } catch(e) {}
            }
        } catch(e) { console.warn('Dashboard updateStats:', e.message); }
    }

    function updateRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        try {
            const payments   = [...Storage.getIncome()].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);
            const attendance = [...Storage.getAttendance()].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);

            const activities = [
                ...payments.map(p => ({
                    icon: 'dollar-sign', color: 'success',
                    text: `Pago de <strong>${Storage.getUserById(p.userId)?.name || 'Usuario'}</strong> — ${Utils.formatCurrency(p.amount)}`,
                    date: p.createdAt || p.paymentDate || ''
                })),
                ...attendance.map(a => ({
                    icon: 'clipboard-check', color: 'primary',
                    text: `<strong>${Storage.getUserById(a.userId)?.name || 'Usuario'}</strong> — asistencia ${a.status}`,
                    date: a.createdAt || a.date || ''
                }))
            ].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);

            if (activities.length === 0) {
                container.innerHTML = '<p class="text-muted text-center py-3"><i class="fas fa-inbox me-2"></i>No hay actividad reciente</p>';
                return;
            }
            container.innerHTML = activities.map(a => `
                <div class="d-flex align-items-center mb-2 p-2 rounded" style="background:rgba(255,255,255,.04)">
                    <div class="me-3 text-${a.color}"><i class="fas fa-${a.icon}"></i></div>
                    <div>
                        <div style="font-size:.88rem">${a.text}</div>
                        <small class="text-muted">${Utils.formatDate(a.date.slice(0,10))}</small>
                    </div>
                </div>`).join('');
        } catch(e) { console.warn('Dashboard activity:', e.message); }
    }

    function setupQuickActions() {
        document.getElementById('quickAddUser')?.addEventListener('click', () => {
            UI.switchTab('users'); setTimeout(() => Users.openUserModal(), 400);
        });
        document.getElementById('quickAddPayment')?.addEventListener('click', () => {
            UI.switchTab('income'); setTimeout(() => Income.openModal(), 400);
        });
        document.getElementById('quickAttendance')?.addEventListener('click', () => UI.switchTab('attendance'));
        document.getElementById('quickReport')?.addEventListener('click',    () => UI.switchTab('reports'));
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


// Banner de configuración inicial
function showSetupBanner() {
    const banner = document.createElement('div');
    banner.id = 'setupBanner';
    banner.style.cssText = `
        position:fixed; top:70px; left:50%; transform:translateX(-50%);
        background:linear-gradient(135deg,#27F9D4,#FF729F); color:#1a2332;
        padding:16px 28px; border-radius:12px; z-index:9000;
        font-family:'Outfit',sans-serif; font-weight:700; font-size:.95rem;
        box-shadow:0 8px 24px rgba(0,0,0,.4); max-width:90vw; text-align:center;
    `;
    banner.innerHTML = `
        ⚙️ <strong>Configuración requerida</strong><br>
        <span style="font-weight:400;font-size:.85rem">
            Debes conectar Google Sheets antes de usar la app.<br>
            Sigue las instrucciones en <em>CONFIGURACION_GOOGLE_SHEETS.md</em>
        </span>
        <br><button onclick="document.getElementById('setupBanner').remove()"
            style="margin-top:10px;background:#1a2332;color:#27F9D4;border:none;
                   padding:6px 18px;border-radius:8px;font-weight:700;cursor:pointer">
            Entendido
        </button>
    `;
    document.body.appendChild(banner);
}

// ─── Bootstrap de la aplicación ──────────────────────────────────────────────

// Función de inicialización de la app (llamada después del login)
async function initializeApp() {
    console.log('App: Iniciando aplicación...');
    try {
        // 1. UI primero (necesita DOM, no necesita datos)
        UI.initialize();
        UI.showLoading('Conectando con Google Sheets…');

        // 2. Cargar datos desde Google Sheets (async)
        console.log('App: Cargando datos desde Google Sheets...');
        try {
            await Storage.initialize();
            console.log('App: Storage inicializado correctamente');
        } catch (err) {
            console.error('App: Error en Storage.initialize():', err);
            if (err.message.includes('SCRIPT_URL') || err.message.includes('Configura')) {
                UI.showErrorToast('⚙️ Configura tu SCRIPT_URL en storage.js. Ver CONFIGURACION_GOOGLE_SHEETS.md', 8000);
                showSetupBanner();
            } else {
                UI.showWarningToast('No se pudo conectar con Google Sheets. Revisa tu conexión.', 6000);
            }
        }

        UI.showLoading('Iniciando módulos…');
        await Utils.sleep(150);

        // 3. Módulos funcionales
        console.log('App: Inicializando módulos...');
        Users.initialize();
        Attendance.initialize();
        Income.initialize();
        Finance.initialize();
        Staff.initialize();
        WhatsApp.initialize();
        Reports.initialize();
        Charts.initialize();
        Backup.initialize();
        Dashboard.initialize();
        Settings.initialize();
        Backup.checkAutoBackup();

        // Poblar selects que dependen de usuarios cargados
        console.log('App: Poblando selects...');
        Attendance.populateReportUsers();
        Staff.populateTrainerSelects();

        // Inicializar rangos de fecha al mes actual en todas las consultas
        initMonthRanges();

        // Verificar cumpleaños al abrir el tab de WhatsApp
        document.getElementById('whatsapp-tab')?.addEventListener('shown.bs.tab', () => {
            WhatsApp.checkBirthdays();
        });
        document.getElementById('staff-tab')?.addEventListener('shown.bs.tab', () => {
            Staff.populateTrainerSelects();
        });

        UI.hideLoading();

        if (Storage.getUsers().length === 0) {
            setTimeout(() => UI.showInfoToast('¡Bienvenido! Comienza agregando usuarios.'), 1000);
        }

        console.log('%c✓ Antología Box23 v3.0 – Google Sheets', 'color:#27F9D4;font-weight:bold;font-size:14px');

    } catch (err) {
        console.error('Error de inicio:', err);
        UI.hideLoading();
        UI.showErrorToast(`Error de inicio: ${err.message}`);
    }
}

(function boot() {
    document.addEventListener('DOMContentLoaded', async () => {
        // 0. Autenticación PRIMERO
        if (!Auth.initialize()) {
            // Si no está autenticado, Auth.initialize() muestra el login
            // y no continuamos con la inicialización de la app.
            // La app se inicializará cuando Auth llame a App.initializeApp()
            return;
        }

        // Si ya está autenticado, inicializar normalmente
        await initializeApp();
    });

    // Errores globales no capturados
    window.addEventListener('error', (e) => {
        console.error('Error global:', e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promesa rechazada:', e.reason);
    });

    /**
     * Inicializa todos los campos de fecha "Desde/Hasta" con el mes actual.
     * Los campos siguen siendo editables normalmente.
     */
    function initMonthRanges() {
        const today   = new Date();
        const year    = today.getFullYear();
        const month   = String(today.getMonth() + 1).padStart(2, '0');
        const firstDay = `${year}-${month}-01`;
        const lastDay  = new Date(year, today.getMonth() + 1, 0)
                            .toISOString().slice(0, 10);

        // Par [idDesde, idHasta] de cada sección de consulta
        const pairs = [
            ['reportDateFrom',  'reportDateTo' ],   // Asistencia – informe
            ['expHistFrom',     'expHistTo'    ],   // Finanzas – gastos
            ['finRepFrom',      'finRepTo'     ],   // Finanzas – reporte
            ['staffHistFrom',   'staffHistTo'  ],   // Personal – historial clases
            ['payFrom',         'payTo'        ],   // Personal – liquidar pago
        ];

        pairs.forEach(([fromId, toId]) => {
            const fromEl = document.getElementById(fromId);
            const toEl   = document.getElementById(toId);
            if (fromEl && !fromEl.value) fromEl.value = firstDay;
            if (toEl   && !toEl.value)   toEl.value   = lastDay;
        });
    }
})();

window.App      = { version: '2.0', initializeApp };
window.Dashboard = Dashboard;
window.Settings  = Settings;

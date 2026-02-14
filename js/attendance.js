/**
 * Módulo de Asistencia v2 — con vigencia, alertas e informes
 */
const Attendance = (() => {
    let currentDate = Utils.getCurrentDate();

    function initialize() {
        setupEventListeners();
        const el = document.getElementById('attendanceDate');
        if (el) el.value = currentDate;
        renderAttendance();
        renderAlerts();
    }

    function setupEventListeners() {
        document.getElementById('attendanceDate')?.addEventListener('change', e => {
            currentDate = e.target.value; renderAttendance();
        });
        document.getElementById('attendanceSearch')?.addEventListener('input',
            Utils.debounce(() => renderAttendance(), 300));
        document.getElementById('markAllPresent')?.addEventListener('click', markAllPresent);
        document.getElementById('applyAttendanceReport')?.addEventListener('click', renderReport);
        document.getElementById('quickAttendance')?.addEventListener('click', () => UI.switchTab('attendance'));
    }

    // ── Helpers de vigencia ──────────────────────────────────────────────

    function getActivePayment(userId) {
        const today = Utils.getCurrentDate();
        const payments = Storage.getIncome()
            .filter(p => p.userId === userId && p.startDate && p.endDate)
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        return payments[0] || null; // el pago más reciente
    }

    function vigenciaBadge(userId) {
        const today   = Utils.getCurrentDate();
        const payment = getActivePayment(userId);
        if (!payment) return `<span class="badge bg-secondary">Sin pago</span>`;

        const start = payment.startDate;
        const end   = payment.endDate;
        const tipo  = payment.paymentType || '';

        // Contar asistencias en el período
        const attendsInPeriod = Storage.getAttendance()
            .filter(a => a.userId === userId && a.status === 'presente' && a.date >= start && a.date <= end).length;

        // Días vencido / activo
        const endDate   = new Date(end   + 'T00:00:00');
        const todayDate = new Date(today + 'T00:00:00');
        const diffDays  = Math.floor((todayDate - endDate) / 86400000);

        let vigTag, extraInfo = '';
        if (diffDays < 0) {
            vigTag = `<span class="badge bg-success">Vigente hasta ${Utils.formatDate(end)}</span>`;
        } else if (diffDays === 0) {
            vigTag = `<span class="badge bg-warning text-dark">Vence hoy</span>`;
        } else {
            vigTag = `<span class="badge bg-danger">Vencida hace ${diffDays} día${diffDays>1?'s':''}</span>`;
            // Clases después del vencimiento
            const afterExpiry = Storage.getAttendance()
                .filter(a => a.userId === userId && a.status === 'presente' && a.date > end).length;
            if (afterExpiry > 0)
                extraInfo = ` · <span class="text-warning small">${afterExpiry} clase${afterExpiry>1?'s':''} tras vencimiento</span>`;
        }

        return `<div class="small lh-sm">
            ${vigTag}
            <div class="text-muted mt-1">${Utils.formatDate(start)} → ${Utils.formatDate(end)} · 
            <em>${tipo}</em> · <strong>${attendsInPeriod}</strong> asistencia${attendsInPeriod!==1?'s':''}</div>
            ${extraInfo}
        </div>`;
    }

    // ── Tabla principal de asistencia ───────────────────────────────────

    function markAllPresent() {
        UI.showConfirmModal('Marcar Todos Presente',
            '¿Marcar a todos los usuarios activos como presentes hoy?', async () => {
            const users = Users.getActiveUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
            for (const user of users) await markAttendance(user.id, 'presente');
            UI.showSuccessToast('Todos marcados como presentes');
            renderAttendance();
            if (window.Dashboard) Dashboard.updateStats();
        });
    }

    async function markAttendance(userId, status) {
        const existing = Storage.getAttendanceByDate(currentDate).find(a => a.userId === userId);
        if (existing) {
            await Storage.updateAttendance(existing.id, { status, time: new Date().toLocaleTimeString('es-ES') });
        } else {
            await Storage.addAttendance({ userId, date: currentDate, status, time: new Date().toLocaleTimeString('es-ES') });
        }
    }

    function renderAttendance() {
        const searchTerm = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';
        // Solo activos, sin entrenadores
        const users = Users.getActiveUsers()
            .filter(u => u.affiliationType !== 'Entrenador(a)')
            .filter(u => !searchTerm || u.name.toLowerCase().includes(searchTerm));

        const attendance = Storage.getAttendanceByDate(currentDate);
        const tbody = document.getElementById('attendanceList');
        if (!tbody) return;

        // Resumen del día
        const presentes = attendance.filter(a => a.status === 'presente').length;
        const el = document.getElementById('attendanceDaySummary');
        if (el) el.innerHTML = `<span class="badge bg-success me-2">✓ Presentes: ${presentes}</span>
            <span class="badge bg-secondary">Total activos: ${users.length}</span>`;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No hay usuarios activos registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map((user, i) => {
            const record = attendance.find(a => a.userId === user.id);
            const status = record?.status || 'sin registro';
            const time   = record?.time   || '-';

            const statusBadge = status === 'presente'
                ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Presente</span>'
                : status === 'ausente'
                    ? '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Ausente</span>'
                    : '<span class="badge bg-secondary">Sin registro</span>';

            return `<tr>
                <td>${i+1}</td>
                <td>
                    <strong>${Utils.escapeHtml(user.name)}</strong>
                    <div class="text-muted small">${user.classTime || '-'}</div>
                </td>
                <td>${statusBadge}<div class="text-muted small mt-1">${time !== '-' ? 'Hora: '+time : ''}</div></td>
                <td>${vigenciaBadge(user.id)}</td>
                <td>
                    <button class="btn btn-sm btn-success me-1" onclick="Attendance.mark('${user.id}','presente')" title="Presente">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="Attendance.mark('${user.id}','ausente')" title="Ausente">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    // ── Alertas de inasistencia (>6 días sin asistir) ───────────────────

    function renderAlerts() {
        const tbody = document.getElementById('alertsList');
        if (!tbody) return;

        const today = Utils.getCurrentDate();
        const todayDate = new Date(today + 'T00:00:00');
        const users = Users.getActiveUsers().filter(u => u.affiliationType !== 'Entrenador(a)');

        const alerts = users.map(user => {
            const lastAttend = Storage.getAttendanceByUser(user.id)
                .filter(a => a.status === 'presente')
                .sort((a, b) => b.date.localeCompare(a.date))[0];

            const lastDate = lastAttend ? new Date(lastAttend.date + 'T00:00:00') : null;
            const daysSince = lastDate
                ? Math.floor((todayDate - lastDate) / 86400000)
                : null;

            return { user, lastDate: lastAttend?.date || null, daysSince };
        }).filter(a => a.daysSince === null || a.daysSince > 6)
          .sort((a, b) => (b.daysSince || 999) - (a.daysSince || 999));

        const countEl = document.getElementById('alertsCount');
        if (countEl) countEl.textContent = alerts.length;

        if (alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">
                <i class="fas fa-check-circle text-success me-2"></i>Sin alertas de inasistencia</td></tr>`;
            return;
        }

        tbody.innerHTML = alerts.map((a, i) => {
            const info = a.daysSince === null
                ? '<span class="badge bg-secondary">Nunca ha asistido</span>'
                : `<span class="badge bg-warning text-dark">${a.daysSince} días sin asistir</span>`;
            const lastStr = a.lastDate ? Utils.formatDate(a.lastDate) : '-';
            return `<tr>
                <td>${i+1}</td>
                <td><strong>${Utils.escapeHtml(a.user.name)}</strong></td>
                <td>${info}</td>
                <td>${lastStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline-success" 
                        onclick="Attendance.whatsappInasistencia('${a.user.id}')" title="Enviar mensaje WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    // ── Informe de asistencia por período ───────────────────────────────

    function renderReport() {
        const dateFrom  = document.getElementById('reportDateFrom')?.value;
        const dateTo    = document.getElementById('reportDateTo')?.value;
        const userFilter = document.getElementById('reportUser')?.value;
        const tbody     = document.getElementById('reportList');
        if (!tbody) return;

        if (!dateFrom || !dateTo) {
            UI.showWarningToast('Selecciona fecha inicial y final');
            return;
        }

        const allAttendance = Storage.getAttendance()
            .filter(a => a.date >= dateFrom && a.date <= dateTo && a.status === 'presente');

        let records = allAttendance;
        if (userFilter) records = records.filter(a => a.userId === userFilter);

        records.sort((a, b) => b.date.localeCompare(a.date));

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Sin asistencias en el período</td></tr>`;
            document.getElementById('reportSummary').textContent = '0 asistencias';
            return;
        }

        const sumEl = document.getElementById('reportSummary');
        if (sumEl) sumEl.textContent = `${records.length} asistencia${records.length!==1?'s':''}`;

        tbody.innerHTML = records.map((a, i) => {
            const user = Storage.getUserById(a.userId);
            return `<tr>
                <td>${i+1}</td>
                <td>${Utils.formatDate(a.date)}</td>
                <td>${user ? Utils.escapeHtml(user.name) : '-'}</td>
                <td>${a.time || '-'}</td>
            </tr>`;
        }).join('');
    }

    // ── WhatsApp inasistencia ────────────────────────────────────────────

    function whatsappInasistencia(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const lastAttend = Storage.getAttendanceByUser(userId)
            .filter(a => a.status === 'presente')
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        const lastDate = lastAttend ? Utils.formatDate(lastAttend.date) : 'hace un tiempo';
        const nombre = user.name.split(' ')[0];
        const msg = `Hola ${nombre}, ¡te extrañamos en Antología Box23! 👋\nHemos notado que no hemos tenido el gusto de verte desde el ${lastDate}.\n¿Todo bien? Esperamos que puedas regresar pronto a tus entrenamientos. Si hay algún inconveniente o necesitas ayuda, no dudes en contarnos.\n¡Quedamos atentos a cualquier inquietud!\n💪 El equipo de Antología Box23`;
        const phone = (user.phone || '').replace(/\D/g, '');
        const url = `https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    return {
        initialize,
        mark: async (userId, status) => {
            await markAttendance(userId, status);
            renderAttendance();
            renderAlerts();
            if (window.Dashboard) Dashboard.updateStats();
        },
        renderAttendance,
        renderAlerts,
        whatsappInasistencia,
        populateReportUsers: () => {
            const sel = document.getElementById('reportUser');
            if (!sel) return;
            const users = Users.getActiveUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
            sel.innerHTML = '<option value="">Todos los usuarios</option>' +
                users.map(u => `<option value="${u.id}">${Utils.escapeHtml(u.name)}</option>`).join('');
        }
    };
})();
window.Attendance = Attendance;

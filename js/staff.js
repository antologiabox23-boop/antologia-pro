/**
 * Módulo de Control de Personal
 * Clases dictadas, pago a entrenadores por horas
 */
const Staff = (() => {
    const RATE_PER_HOUR = 8500; // COP por hora

    function initialize() {
        setupEventListeners();
        populateTrainerSelect();
        document.getElementById('classDate').value = Utils.getCurrentDate();
        renderClasses();
    }

    function populateTrainerSelect() {
        const trainers = Users.getActiveUsers().filter(u => u.affiliationType === 'Entrenador(a)');
        ['classTrainer', 'staffHistTrainer'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = (id === 'staffHistTrainer' ? '<option value="">Todos</option>' : '<option value="">Seleccionar...</option>') +
                trainers.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.name)}</option>`).join('');
        });
    }

    function setupEventListeners() {
        document.getElementById('saveClassBtn')?.addEventListener('click', saveClass);
        document.getElementById('applyStaffFilter')?.addEventListener('click', renderClasses);
    }

    async function saveClass() {
        const date     = document.getElementById('classDate')?.value;
        const hour     = document.getElementById('classHour')?.value;
        const trainer  = document.getElementById('classTrainer')?.value;
        const type     = document.getElementById('classType')?.value;
        const duration = parseFloat(document.getElementById('classDuration')?.value);

        if (!date || !hour || !trainer || !type || isNaN(duration)) {
            UI.showErrorToast('Completa todos los campos'); return;
        }

        const payment = duration * RATE_PER_HOUR;
        UI.setButtonLoading('saveClassBtn', true);
        try {
            await Storage.addClass({ date, hour, trainerId: trainer, classType: type, duration, payment });
            UI.showSuccessToast(`Clase registrada · Pago entrenador: ${Utils.formatCurrency(payment)}`);
            document.getElementById('classForm')?.reset();
            document.getElementById('classDate').value = Utils.getCurrentDate();
            renderClasses();
        } catch (err) {
            UI.showErrorToast('Error: ' + err.message);
        } finally {
            UI.setButtonLoading('saveClassBtn', false);
        }
    }

    function renderClasses() {
        const dateFrom  = document.getElementById('staffHistFrom')?.value;
        const dateTo    = document.getElementById('staffHistTo')?.value;
        const trFilter  = document.getElementById('staffHistTrainer')?.value;
        const tbody     = document.getElementById('classesList');
        if (!tbody) return;

        let classes = Storage.getClasses();
        if (dateFrom) classes = classes.filter(c => c.date >= dateFrom);
        if (dateTo)   classes = classes.filter(c => c.date <= dateTo);
        if (trFilter) classes = classes.filter(c => c.trainerId === trFilter);
        classes.sort((a, b) => b.date.localeCompare(a.date) || b.hour.localeCompare(a.hour));

        const totalHours = classes.reduce((s, c) => s + parseFloat(c.duration || 0), 0);
        const totalPay   = classes.reduce((s, c) => s + parseFloat(c.payment || 0), 0);

        const hEl = document.getElementById('staffTotalHours'); if (hEl) hEl.textContent = totalHours.toFixed(1) + ' h';
        const pEl = document.getElementById('staffTotalPay');   if (pEl) pEl.textContent = Utils.formatCurrency(totalPay);

        if (classes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">Sin clases en el período</td></tr>`; return;
        }

        tbody.innerHTML = classes.map((c, i) => {
            const trainer = Storage.getUserById(c.trainerId);
            return `<tr>
                <td>${i+1}</td>
                <td>${Utils.formatDate(c.date)}</td>
                <td>${c.hour}</td>
                <td>${trainer ? Utils.escapeHtml(trainer.name) : '-'}</td>
                <td><span class="badge bg-info">${c.classType}</span></td>
                <td>${c.duration} h</td>
                <td><strong>${Utils.formatCurrency(c.payment)}</strong></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Staff.deleteClass('${c.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function deleteClass(id) {
        UI.showConfirmModal('Eliminar Clase', '¿Eliminar este registro?', async () => {
            await Storage.deleteClass(id);
            UI.showSuccessToast('Registro eliminado');
            renderClasses();
        }, true);
    }

    return { initialize, populateTrainerSelect, renderClasses, deleteClass };
})();
window.Staff = Staff;

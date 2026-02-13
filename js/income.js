/**
 * Módulo de Gestión de Ingresos / Pagos
 */

const Income = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;

    // Tipos que tienen vigencia de un solo día
    const SINGLE_DAY_TYPES = ['Clase suelta', 'Movimientos caja'];

    function initialize() {
        setupEventListeners();
        setupRealtimeValidation();
        document.getElementById('incomeDate').value = Utils.getCurrentDate();
        renderIncome();
    }

    function openModal() {
        populateUserSelect();
        const today = Utils.getCurrentDate();
        document.getElementById('incomeDate').value = today;
        // Limpiar vigencia hasta que se elija tipo
        document.getElementById('incomeStartDate').value = today;
        document.getElementById('incomeEndDate').value = '';
        document.getElementById('vigenciaInfo').style.display = 'none';
        UI.showModal('incomeModal');
    }

    function setupEventListeners() {
        document.getElementById('saveIncomeBtn')?.addEventListener('click', saveIncome);
        document.getElementById('quickAddPayment')?.addEventListener('click', openModal);

        // Recargar usuarios y resetear vigencia al abrir el modal
        document.getElementById('incomeModal')?.addEventListener('show.bs.modal', () => {
            populateUserSelect();
            const today = Utils.getCurrentDate();
            document.getElementById('incomeDate').value = today;
            recalcVigencia();
        });

        document.getElementById('incomeModal')?.addEventListener('hidden.bs.modal', () => {
            UI.resetModalForm('incomeModal', 'incomeForm');
            document.getElementById('vigenciaInfo').style.display = 'none';
        });

        document.getElementById('applyPaymentFilters')?.addEventListener('click', renderIncome);

        // Recalcular vigencia cuando cambia el tipo de pago
        document.getElementById('incomeType')?.addEventListener('change', recalcVigencia);

        // Recalcular vigencia cuando cambia la fecha de pago
        document.getElementById('incomeDate')?.addEventListener('change', recalcVigencia);

        // Si el usuario edita manualmente la fecha de inicio, recalcular solo el fin
        document.getElementById('incomeStartDate')?.addEventListener('change', () => {
            const tipo = document.getElementById('incomeType')?.value;
            calcEndDate(tipo);
            showVigenciaInfo();
        });
    }

    // ── Lógica de vigencia ────────────────────────────────────────────────

    function recalcVigencia() {
        const tipo      = document.getElementById('incomeType')?.value;
        const fechaPago = document.getElementById('incomeDate')?.value;

        if (!fechaPago) return;

        // La fecha de inicio de vigencia es siempre igual a la fecha de pago
        document.getElementById('incomeStartDate').value = fechaPago;

        calcEndDate(tipo);
        showVigenciaInfo();
    }

    function calcEndDate(tipo) {
        const startVal = document.getElementById('incomeStartDate')?.value;
        if (!startVal) return;

        const start = new Date(startVal + 'T00:00:00');
        const y = start.getFullYear();
        const m = start.getMonth();   // 0-based
        const d = start.getDate();
        let end;

        if (!tipo || SINGLE_DAY_TYPES.includes(tipo)) {
            // Clase suelta / Movimientos caja → mismo día
            end = new Date(start);
        } else {
            // Demás tipos → mismo día del mes siguiente - 1 día
            // Ej: 2 feb → 1 mar  |  15 ene → 14 feb  |  31 ene → 28 feb
            const target = new Date(y, m + 1, d);
            if (target.getMonth() !== ((m + 1) % 12)) {
                // El día no existe en el mes siguiente (ej: 31 ene en feb)
                // Usar el último día del mes siguiente
                end = new Date(y, m + 2, 0);
            } else {
                // Restar 1 día al mismo día del mes siguiente
                end = new Date(target - 86400000);
            }
        }

        document.getElementById('incomeEndDate').value = formatDateInput(end);
    }

    function showVigenciaInfo() {
        const tipo  = document.getElementById('incomeType')?.value;
        const start = document.getElementById('incomeStartDate')?.value;
        const end   = document.getElementById('incomeEndDate')?.value;
        const info  = document.getElementById('vigenciaInfo');

        if (!info || !start) return;

        if (!tipo) {
            info.style.display = 'none';
            return;
        }

        if (SINGLE_DAY_TYPES.includes(tipo)) {
            info.textContent  = `✓ Vigencia: un solo día (${Utils.formatDate(start)})`;
        } else {
            info.textContent  = `✓ Vigencia: ${Utils.formatDate(start)} → ${Utils.formatDate(end)}`;
        }
        info.style.display = 'block';
    }

    // Convierte un objeto Date a string YYYY-MM-DD para input[type=date]
    function formatDateInput(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────

    function setupRealtimeValidation() {
        Validation.setupRealtimeValidation('incomeForm', Validation.schemas.income);
    }

    function populateUserSelect() {
        const select = document.getElementById('incomeUser');
        if (!select) return;
        const users = Users.getUsersForSelect();
        select.innerHTML = '<option value="">Seleccionar usuario...</option>' +
            users.map(u => `<option value="${u.id}">${Utils.escapeHtml(u.name)}</option>`).join('');
    }

    async function saveIncome() {
        const validation = Validation.validateForm('incomeForm', Validation.schemas.income);
        if (!validation.isValid) {
            UI.showErrorToast('Corrige los errores en el formulario');
            return;
        }

        const startDate = document.getElementById('incomeStartDate').value;
        const endDate   = document.getElementById('incomeEndDate').value;

        if (!startDate || !endDate) {
            UI.showErrorToast('Completa las fechas de vigencia');
            return;
        }

        const incomeData = {
            userId:        document.getElementById('incomeUser').value,
            paymentType:   document.getElementById('incomeType').value,
            amount:        parseFloat(document.getElementById('incomeAmount').value),
            paymentMethod: document.getElementById('incomeMethod').value,
            paymentDate:   document.getElementById('incomeDate').value,
            startDate,
            endDate,
            notes:         Validation.sanitizeInput(document.getElementById('incomeNotes').value)
        };

        const customVal = Validation.validatePaymentData(incomeData);
        if (!customVal.isValid) {
            UI.showErrorToast(customVal.errors.join(' · '));
            return;
        }

        UI.setButtonLoading('saveIncomeBtn', true);
        try {
            await Storage.addIncome(incomeData);
            UI.showSuccessToast('Pago registrado exitosamente');
            UI.hideModal('incomeModal');
            renderIncome();
            if (window.Dashboard) Dashboard.updateStats();
        } catch (err) {
            UI.showErrorToast('Error al guardar: ' + err.message);
        } finally {
            UI.setButtonLoading('saveIncomeBtn', false);
        }
    }

    function renderIncome() {
        const income     = Storage.getIncome();
        const dateFrom   = document.getElementById('paymentDateFrom')?.value;
        const dateTo     = document.getElementById('paymentDateTo')?.value;
        const typeFilter = document.getElementById('paymentTypeFilter')?.value;

        let filtered = income.filter(p => {
            let ok = true;
            if (dateFrom && p.paymentDate < dateFrom) ok = false;
            if (dateTo   && p.paymentDate > dateTo)   ok = false;
            if (typeFilter && p.paymentType !== typeFilter) ok = false;
            return ok;
        }).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        const start     = (currentPage - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        renderIncomeList(paginated);
        updateIncomeSummary(filtered);
        UI.renderPagination('incomePagination', filtered.length, currentPage, itemsPerPage, page => {
            currentPage = page; renderIncome();
        });
    }

    function renderIncomeList(payments) {
        const tbody = document.getElementById('incomeList');
        if (!tbody) return;

        if (payments.length === 0) {
            UI.showEmptyState('incomeList', 'No hay pagos registrados', 'fa-dollar-sign');
            return;
        }

        tbody.innerHTML = payments.map((p, i) => {
            const user     = Storage.getUserById(p.userId);
            const vigencia = p.startDate
                ? (p.startDate === p.endDate
                    ? Utils.formatDate(p.startDate)
                    : `${Utils.formatDate(p.startDate)} → ${Utils.formatDate(p.endDate)}`)
                : '-';
            return `
            <tr>
                <td>${(currentPage - 1) * itemsPerPage + i + 1}</td>
                <td>${Utils.formatDate(p.paymentDate)}</td>
                <td>${user ? Utils.escapeHtml(user.name) : '<span class="text-muted">Eliminado</span>'}</td>
                <td><span class="badge bg-info">${p.paymentType}</span></td>
                <td><strong>${Utils.formatCurrency(p.amount)}</strong></td>
                <td>${p.paymentMethod}</td>
                <td><small>${vigencia}</small></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Income.deletePayment('${p.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function updateIncomeSummary(payments) {
        const total = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const el1 = document.getElementById('periodTotal');
        const el2 = document.getElementById('periodCount');
        if (el1) el1.textContent = Utils.formatCurrency(total);
        if (el2) el2.textContent = payments.length;
    }

    function deletePayment(id) {
        UI.showConfirmModal('Eliminar Pago', '¿Eliminar este registro de pago?', async () => {
            try {
                await Storage.deleteIncome(id);
                UI.showSuccessToast('Pago eliminado');
                renderIncome();
                if (window.Dashboard) Dashboard.updateStats();
            } catch (err) {
                UI.showErrorToast('Error al eliminar: ' + err.message);
            }
        }, true);
    }

    return {
        initialize,
        openModal,
        renderIncome,
        deletePayment,
        populateSelect: populateUserSelect
    };
})();

window.Income = Income;

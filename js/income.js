const Income = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;

    function initialize() {
        setupEventListeners();
        setupRealtimeValidation();
        document.getElementById('incomeDate').value = Utils.getCurrentDate();
        renderIncome();
    }

    function openModal() {
        // Siempre recarga la lista de usuarios antes de mostrar el modal
        populateUserSelect();
        document.getElementById('incomeDate').value = Utils.getCurrentDate();
        UI.showModal('incomeModal');
    }

    function setupEventListeners() {
        document.getElementById('saveIncomeBtn')?.addEventListener('click', saveIncome);

        // Botón rápido del dashboard
        document.getElementById('quickAddPayment')?.addEventListener('click', openModal);

        // Recargar usuarios SIEMPRE que el modal se va a mostrar (cualquier origen)
        document.getElementById('incomeModal')?.addEventListener('show.bs.modal', () => {
            populateUserSelect();
            document.getElementById('incomeDate').value = Utils.getCurrentDate();
        });

        document.getElementById('applyPaymentFilters')?.addEventListener('click', renderIncome);

        document.getElementById('incomeModal')?.addEventListener('hidden.bs.modal', () => {
            UI.resetModalForm('incomeModal', 'incomeForm');
        });
    }

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

    function saveIncome() {
        const validation = Validation.validateForm('incomeForm', Validation.schemas.income);
        if (!validation.isValid) {
            UI.showErrorToast('Corrige los errores en el formulario');
            return;
        }

        const incomeData = {
            userId: document.getElementById('incomeUser').value,
            paymentType: document.getElementById('incomeType').value,
            amount: parseFloat(document.getElementById('incomeAmount').value),
            paymentMethod: document.getElementById('incomeMethod').value,
            paymentDate: document.getElementById('incomeDate').value,
            notes: Validation.sanitizeInput(document.getElementById('incomeNotes').value)
        };

        const customValidation = Validation.validatePaymentData(incomeData);
        if (!customValidation.isValid) {
            UI.showErrorToast(customValidation.errors.join(', '));
            return;
        }

        UI.setButtonLoading('saveIncomeBtn', true);
        setTimeout(() => {
            Storage.addIncome(incomeData);
            UI.showSuccessToast('Pago registrado exitosamente');
            UI.hideModal('incomeModal');
            renderIncome();
            if (window.Dashboard) Dashboard.updateStats();
            UI.setButtonLoading('saveIncomeBtn', false);
        }, 500);
    }

    function renderIncome() {
        const income = Storage.getIncome();
        const dateFrom = document.getElementById('paymentDateFrom')?.value;
        const dateTo = document.getElementById('paymentDateTo')?.value;
        const typeFilter = document.getElementById('paymentTypeFilter')?.value;

        let filtered = income.filter(payment => {
            let matches = true;
            if (dateFrom && payment.paymentDate < dateFrom) matches = false;
            if (dateTo && payment.paymentDate > dateTo) matches = false;
            if (typeFilter && payment.paymentType !== typeFilter) matches = false;
            return matches;
        });

        filtered.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        
        const start = (currentPage - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        renderIncomeList(paginated);
        updateIncomeSummary(filtered);
        
        UI.renderPagination('incomePagination', filtered.length, currentPage, itemsPerPage, (page) => {
            currentPage = page;
            renderIncome();
        });
    }

    function renderIncomeList(payments) {
        const tbody = document.getElementById('incomeList');
        if (!tbody) return;

        if (payments.length === 0) {
            UI.showEmptyState('incomeList', 'No hay pagos registrados', 'fa-dollar-sign');
            return;
        }

        tbody.innerHTML = payments.map((payment, i) => {
            const user = Storage.getUserById(payment.userId);
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td>${Utils.formatDate(payment.paymentDate)}</td>
                    <td>${user ? Utils.escapeHtml(user.name) : 'Usuario eliminado'}</td>
                    <td><span class="badge bg-info">${payment.paymentType}</span></td>
                    <td><strong>${Utils.formatCurrency(payment.amount)}</strong></td>
                    <td>${payment.paymentMethod}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="Income.deletePayment('${payment.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateIncomeSummary(payments) {
        const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        document.getElementById('periodTotal').textContent = Utils.formatCurrency(total);
        document.getElementById('periodCount').textContent = payments.length;
    }

    function deletePayment(id) {
        UI.showConfirmModal('Eliminar Pago', '¿Eliminar este registro de pago?', () => {
            Storage.deleteIncome(id);
            UI.showSuccessToast('Pago eliminado');
            renderIncome();
            if (window.Dashboard) Dashboard.updateStats();
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

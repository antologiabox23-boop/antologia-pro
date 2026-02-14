/**
 * Módulo de Administración Financiera
 * Gastos, saldos por cuenta y reporte financiero
 */
const Finance = (() => {

    function initialize() {
        setupEventListeners();
        renderSummary();
        renderExpenses();
        renderFinancialReport();
        setDefaultDates();
    }

    function setDefaultDates() {
        const today = Utils.getCurrentDate();
        ['expenseDate','expHistFrom','expHistTo','finRepFrom','finRepTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = today;
        });
        // Reporte: mes actual
        const { start, end } = Utils.getMonthRange(Utils.getCurrentMonth());
        const fr = document.getElementById('finRepFrom'); if (fr) fr.value = start;
        const ft = document.getElementById('finRepTo');   if (ft) ft.value = end;
    }

    function setupEventListeners() {
        document.getElementById('saveExpenseBtn')?.addEventListener('click', saveExpense);
        document.getElementById('saveEditExpenseBtn')?.addEventListener('click', saveEditExpense);
        document.getElementById('applyExpHistFilter')?.addEventListener('click', renderExpenses);
        document.getElementById('applyFinReport')?.addEventListener('click', renderFinancialReport);
    }

    // ── Saldos por cuenta ────────────────────────────────────────────────

    function getBalances() {
        const accounts = ['Efectivo', 'Bancolombia', 'Daviplata', 'Nequi'];
        const income   = Storage.getIncome();
        const expenses = Storage.getExpenses();
        const result   = {};
        accounts.forEach(acc => {
            const ingresos = income.filter(p => p.paymentMethod === acc)
                .reduce((s, p) => s + Utils.parseAmount(p.amount), 0);
            const gastos = expenses.filter(e => e.account === acc)
                .reduce((s, e) => s + Utils.parseAmount(e.amount), 0);
            result[acc] = ingresos - gastos;
        });
        return result;
    }

    function renderSummary() {
        const balances = getBalances();
        const total    = Object.values(balances).reduce((s, v) => s + v, 0);
        const icons    = { Efectivo:'fa-money-bill-wave', Bancolombia:'fa-university', Daviplata:'fa-mobile-alt', Nequi:'fa-mobile' };
        const colors   = { Efectivo:'success', Bancolombia:'primary', Daviplata:'info', Nequi:'warning' };

        const container = document.getElementById('accountBalances');
        if (!container) return;
        container.innerHTML = Object.entries(balances).map(([acc, val]) => `
            <div class="col-6 col-md-3">
                <div class="card text-center h-100">
                    <div class="card-body py-3">
                        <i class="fas ${icons[acc]} fa-2x text-${colors[acc]} mb-2"></i>
                        <div class="fw-bold">${acc}</div>
                        <div class="fs-5 mt-1 ${val < 0 ? 'text-danger' : 'text-success'}">${Utils.formatCurrency(val)}</div>
                    </div>
                </div>
            </div>`).join('');

        const totalEl = document.getElementById('totalBalance');
        if (totalEl) {
            totalEl.innerHTML = `<span class="${total < 0 ? 'text-danger' : 'text-success'}">${Utils.formatCurrency(total)}</span>`;
        }
    }

    // ── Gastos ───────────────────────────────────────────────────────────

    async function saveExpense() {
        const date     = document.getElementById('expenseDate')?.value;
        const desc     = document.getElementById('expenseDesc')?.value?.trim();
        const amount   = parseFloat(document.getElementById('expenseAmount')?.value);
        const category = document.getElementById('expenseCategory')?.value;
        const account  = document.getElementById('expenseAccount')?.value;

        if (!date || !desc || isNaN(amount) || amount <= 0 || !category || !account) {
            UI.showErrorToast('Completa todos los campos del gasto'); return;
        }

        UI.setButtonLoading('saveExpenseBtn', true);
        try {
            await Storage.addExpense({ date, description: desc, amount, category, account });
            UI.showSuccessToast('Gasto registrado');
            document.getElementById('expenseForm')?.reset();
            document.getElementById('expenseDate').value = Utils.getCurrentDate();
            renderSummary();
            renderExpenses();
            renderFinancialReport();
        } catch (err) {
            UI.showErrorToast('Error: ' + err.message);
        } finally {
            UI.setButtonLoading('saveExpenseBtn', false);
        }
    }

    function renderExpenses() {
        const dateFrom   = document.getElementById('expHistFrom')?.value;
        const dateTo     = document.getElementById('expHistTo')?.value;
        const catFilter  = document.getElementById('expHistCategory')?.value;
        const accFilter  = document.getElementById('expHistAccount')?.value;
        const tbody      = document.getElementById('expensesList');
        if (!tbody) return;

        let expenses = Storage.getExpenses();
        if (dateFrom)   expenses = expenses.filter(e => e.date >= dateFrom);
        if (dateTo)     expenses = expenses.filter(e => e.date <= dateTo);
        if (catFilter)  expenses = expenses.filter(e => e.category === catFilter);
        if (accFilter)  expenses = expenses.filter(e => e.account  === accFilter);
        expenses.sort((a, b) => b.date.localeCompare(a.date));

        const total   = expenses.reduce((s, e) => s + Utils.parseAmount(e.amount), 0);
        const sumEl   = document.getElementById('expensesTotal');
        if (sumEl) sumEl.textContent = Utils.formatCurrency(total);

        if (expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">Sin gastos en el período</td></tr>`; return;
        }

        tbody.innerHTML = expenses.map((e, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${Utils.formatDate(e.date)}</td>
                <td>${Utils.escapeHtml(e.description)}</td>
                <td><span class="badge bg-secondary">${e.category}</span></td>
                <td>${e.account}</td>
                <td><strong>${Utils.formatCurrency(Utils.parseAmount(e.amount))}</strong></td>
                <td>
                    <button class="btn btn-sm btn-warning me-1" onclick="Finance.editExpense('${e.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="Finance.deleteExpense('${e.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    }

    function editExpense(id) {
        const expense = Storage.getExpenses().find(e => e.id === id);
        if (!expense) return;

        document.getElementById('editExpenseId').value       = expense.id;
        document.getElementById('editExpenseDate').value     = Utils.normalizeDate(expense.date) || expense.date || '';
        document.getElementById('editExpenseDesc').value     = expense.description || '';
        document.getElementById('editExpenseAmount').value   = Utils.parseAmount(expense.amount) || '';
        document.getElementById('editExpenseCategory').value = expense.category || '';
        document.getElementById('editExpenseAccount').value  = expense.account  || '';

        UI.showModal('editExpenseModal');
    }

    async function saveEditExpense() {
        const id       = document.getElementById('editExpenseId')?.value?.trim();
        const date     = document.getElementById('editExpenseDate')?.value;
        const desc     = document.getElementById('editExpenseDesc')?.value?.trim();
        const amount   = parseFloat(document.getElementById('editExpenseAmount')?.value);
        const category = document.getElementById('editExpenseCategory')?.value;
        const account  = document.getElementById('editExpenseAccount')?.value;

        if (!id || !date || !desc || isNaN(amount) || amount <= 0 || !category || !account) {
            UI.showErrorToast('Completa todos los campos'); return;
        }

        UI.setButtonLoading('saveEditExpenseBtn', true);
        try {
            await Storage.updateExpense(id, { date, description: desc, amount, category, account });
            UI.showSuccessToast('Gasto actualizado');
            UI.hideModal('editExpenseModal');
            renderSummary();
            renderExpenses();
            renderFinancialReport();
        } catch (err) {
            UI.showErrorToast('Error: ' + err.message);
        } finally {
            UI.setButtonLoading('saveEditExpenseBtn', false);
        }
    }

    function deleteExpense(id) {
        UI.showConfirmModal('Eliminar Gasto', '¿Eliminar este gasto?', async () => {
            await Storage.deleteExpense(id);
            UI.showSuccessToast('Gasto eliminado');
            renderSummary(); renderExpenses(); renderFinancialReport();
        }, true);
    }

    // ── Reporte financiero ───────────────────────────────────────────────

    function renderFinancialReport() {
        const from = document.getElementById('finRepFrom')?.value;
        const to   = document.getElementById('finRepTo')?.value;
        if (!from || !to) return;

        const income   = Storage.getIncomeByDateRange(from, to);
        const expenses = Storage.getExpenses().filter(e => e.date >= from && e.date <= to);

        const totalIncome   = income.reduce((s, p)   => s + Utils.parseAmount(p.amount), 0);
        const totalExpenses = expenses.reduce((s, e) => s + Utils.parseAmount(e.amount), 0);
        const netProfit     = totalIncome - totalExpenses;
        const margin        = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
        set('finRepIncome',   Utils.formatCurrency(totalIncome));
        set('finRepExpenses', Utils.formatCurrency(totalExpenses));
        set('finRepProfit',   `<span class="${netProfit >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(netProfit)}</span>`);
        set('finRepMargin',   `<span class="${margin >= 0 ? 'text-success' : 'text-danger'}">${margin}%</span>`);

        // Desglose gastos por categoría
        const byCategory = {};
        expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Utils.parseAmount(e.amount); });
        const catEl = document.getElementById('finRepCategories');
        if (catEl) {
            catEl.innerHTML = Object.entries(byCategory).length === 0
                ? '<p class="text-muted">Sin gastos en el período</p>'
                : Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, val]) =>
                    `<div class="d-flex justify-content-between border-bottom py-1">
                        <span>${cat}</span>
                        <strong>${Utils.formatCurrency(val)}</strong>
                    </div>`).join('');
        }
    }

    return { initialize, renderSummary, renderExpenses, renderFinancialReport, editExpense, deleteExpense };
})();
window.Finance = Finance;

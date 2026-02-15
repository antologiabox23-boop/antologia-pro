/**
 * Módulo de Gestión de Ingresos / Pagos
 */

const Income = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;

    // Tipos que tienen vigencia de un solo día
    const SINGLE_DAY_TYPES    = ['Clase suelta', 'Movimientos caja'];
    // Tipos en los que la nueva vigencia continúa donde terminó la anterior
    const CONTINUOUS_TYPES    = ['Mensualidad', 'Paquete 10 clases', 'Personalizado Diana'];

    function initialize() {
        setupEventListeners();
        setupRealtimeValidation();
        document.getElementById('incomeDate').value = Utils.getCurrentDate();
        renderIncome();
    }

    function openModal(paymentId = null) {
        populateUserSelect();
        const form = document.getElementById('incomeForm');
        if (form) { form.reset(); Validation.clearFormValidation(form); }
        document.getElementById('incomeId').value = '';
        document.getElementById('vigenciaInfo').style.display = 'none';

        const labelEl = document.getElementById('incomeModalLabel');

        if (paymentId) {
            const p = Storage.getIncome().find(x => x.id === paymentId);
            if (!p) return;
            if (labelEl) labelEl.innerHTML = '<i class="fas fa-edit me-2"></i>Editar Pago';
            document.getElementById('incomeId').value        = p.id;
            document.getElementById('incomeUser').value      = p.userId        || '';
            document.getElementById('incomeType').value      = p.paymentType   || '';
            document.getElementById('incomeAmount').value    = Utils.parseAmount(p.amount) || '';
            document.getElementById('incomeMethod').value    = p.paymentMethod || '';
            document.getElementById('incomeDate').value      = Utils.normalizeDate(p.paymentDate) || '';
            document.getElementById('incomeStartDate').value = Utils.normalizeDate(p.startDate)   || '';
            document.getElementById('incomeEndDate').value   = Utils.normalizeDate(p.endDate)     || '';
            document.getElementById('incomeNotes').value     = p.notes || '';
            // Mostrar nombre del usuario en el buscador
            const user = Storage.getUserById(p.userId);
            if (user) {
                const selBox  = document.getElementById('incomeUserSelected');
                const selName = document.getElementById('incomeUserSelectedName');
                if (selBox && selName) { selBox.style.display = 'block'; selName.textContent = user.name; }
            }
            showVigenciaInfo();
        } else {
            if (labelEl) labelEl.innerHTML = '<i class="fas fa-dollar-sign me-2"></i>Registrar Pago';
            const today = Utils.getCurrentDate();
            document.getElementById('incomeDate').value      = today;
            document.getElementById('incomeStartDate').value = today;
            document.getElementById('incomeEndDate').value   = '';
            // Asegurar buscador limpio
            const inp = document.getElementById('incomeUserSearch');
            if (inp) inp.value = '';
            const sel = document.getElementById('incomeUserSelected');
            if (sel) sel.style.display = 'none';
            const lp  = document.getElementById('incomeUserLastPay');
            if (lp)  lp.style.display  = 'none';
        }
        UI.showModal('incomeModal');
    }

    function editPayment(id) { openModal(id); }

    function setupEventListeners() {
        document.getElementById('saveIncomeBtn')?.addEventListener('click', saveIncome);
        document.getElementById('quickAddPayment')?.addEventListener('click', openModal);

        // Recargar usuarios y resetear vigencia al abrir el modal
        document.getElementById('incomeModal')?.addEventListener('show.bs.modal', () => {
            populateUserSelect();
        });
        // Al terminar de abrir, enfocar el buscador
        document.getElementById('incomeModal')?.addEventListener('shown.bs.modal', () => {
            document.getElementById('incomeUserSearch')?.focus();
        });

        document.getElementById('incomeModal')?.addEventListener('hidden.bs.modal', () => {
            UI.resetModalForm('incomeModal', 'incomeForm');
            document.getElementById('vigenciaInfo').style.display = 'none';
            // Limpiar buscador
            const inp = document.getElementById('incomeUserSearch');
            if (inp) inp.value = '';
            const sel = document.getElementById('incomeUserSelected');
            if (sel) sel.style.display = 'none';
            const lp  = document.getElementById('incomeUserLastPay');
            if (lp)  lp.style.display  = 'none';
            _hideDropdown();
        });

        document.getElementById('applyPaymentFilters')?.addEventListener('click', renderIncome);

        // Recalcular vigencia cuando cambia el tipo de pago
        document.getElementById('incomeType')?.addEventListener('change', () => {
            const userId = document.getElementById('incomeUser')?.value;
            if (userId) {
                // Re-aplicar sugerencia según el tipo elegido
                _applyLastPaymentHint(userId);
            } else {
                recalcVigencia();
            }
        });

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

    // ── Buscador de usuario ─────────────────────────────────────────────

    let _allUsers = [];

    function populateUserSelect() {
        _allUsers = Users.getUsersForSelect();
        // El input de búsqueda ya está en el HTML; solo asegurar listener
        const inp = document.getElementById('incomeUserSearch');
        if (!inp) return;
        inp.removeEventListener('input', _onUserSearch);
        inp.removeEventListener('keydown', _onUserSearchKey);
        inp.addEventListener('input', _onUserSearch);
        inp.addEventListener('keydown', _onUserSearchKey);
        inp.addEventListener('blur', () => setTimeout(_hideDropdown, 180));
    }

    function _onUserSearch(e) {
        const q = e.target.value.trim().toLowerCase();
        _renderDropdown(q ? _allUsers.filter(u => u.name.toLowerCase().includes(q)) : _allUsers.slice(0, 12));
    }

    function _onUserSearchKey(e) {
        const dd = document.getElementById('incomeUserDropdown');
        const items = dd.querySelectorAll('.user-dd-item');
        let active = dd.querySelector('.user-dd-item.active');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = active ? active.nextElementSibling : items[0];
            if (next) { active?.classList.remove('active'); next.classList.add('active'); next.scrollIntoView({block:'nearest'}); }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = active?.previousElementSibling;
            if (prev) { active.classList.remove('active'); prev.classList.add('active'); prev.scrollIntoView({block:'nearest'}); }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active) active.click();
        } else if (e.key === 'Escape') {
            _hideDropdown();
        }
    }

    function _renderDropdown(users) {
        const dd = document.getElementById('incomeUserDropdown');
        if (!dd) return;
        if (users.length === 0) {
            dd.innerHTML = '<div style="padding:.5rem .85rem;font-size:.82rem;color:#8b949e">Sin resultados</div>';
        } else {
            dd.innerHTML = users.map(u => `
                <div class="user-dd-item" data-id="${u.id}" data-name="${Utils.escapeHtml(u.name)}"
                     style="padding:.5rem .85rem;cursor:pointer;font-size:.88rem;
                            border-bottom:1px solid rgba(255,255,255,.06);transition:background .1s"
                     onmouseenter="this.classList.add('active')"
                     onmouseleave="this.classList.remove('active')"
                     onclick="Income.selectUser('${u.id}','${Utils.escapeHtml(u.name).replace(/'/g,'\\&apos;')}')">
                    <i class="fas fa-user me-2" style="opacity:.4;font-size:.75rem"></i>${Utils.escapeHtml(u.name)}
                </div>`).join('');
        }
        dd.style.display = 'block';
    }

    function _hideDropdown() {
        const dd = document.getElementById('incomeUserDropdown');
        if (dd) dd.style.display = 'none';
    }

    function selectUser(id, name) {
        document.getElementById('incomeUser').value = id;
        document.getElementById('incomeUserSearch').value = '';
        _hideDropdown();
        // Mostrar badge de selección
        const selBox  = document.getElementById('incomeUserSelected');
        const selName = document.getElementById('incomeUserSelectedName');
        if (selBox && selName) { selBox.style.display = 'block'; selName.textContent = name; }
        // Mostrar último pago y sugerir fechas si aplica
        _applyLastPaymentHint(id);
    }

    function clearUserSearch() {
        document.getElementById('incomeUser').value = '';
        document.getElementById('incomeUserSearch').value = '';
        const selBox = document.getElementById('incomeUserSelected');
        if (selBox) selBox.style.display = 'none';
        const lastPay = document.getElementById('incomeUserLastPay');
        if (lastPay) lastPay.style.display = 'none';
        document.getElementById('incomeUserSearch')?.focus();
        // Limpiar fechas sugeridas
        const today = Utils.getCurrentDate();
        document.getElementById('incomeDate').value      = today;
        document.getElementById('incomeStartDate').value = today;
        document.getElementById('incomeEndDate').value   = '';
        document.getElementById('vigenciaInfo').style.display = 'none';
    }

    // ── Sugerir fechas según el último pago del usuario ──────────────────

    function _applyLastPaymentHint(userId) {
        const tipo = document.getElementById('incomeType')?.value;
        const lastPayEl = document.getElementById('incomeUserLastPay');

        // Obtener el último pago del usuario
        const lastPay = Storage.getIncome()
            .filter(p => p.userId === userId && p.endDate)
            .sort((a, b) => (Utils.normalizeDate(b.endDate) || '').localeCompare(Utils.normalizeDate(a.endDate) || ''))[0];

        if (lastPay) {
            const endNorm = Utils.normalizeDate(lastPay.endDate);
            if (lastPayEl) {
                lastPayEl.style.display = 'block';
                lastPayEl.querySelector('span').textContent =
                    `Último pago: ${lastPay.paymentType} · vigente hasta ${Utils.formatDate(endNorm)}`;
            }
            // Si el tipo actual es de continuidad, sugerir fechas desde el día siguiente
            if (CONTINUOUS_TYPES.includes(tipo)) {
                _suggestContinuousDates(endNorm, tipo);
                return;
            }
        } else {
            if (lastPayEl) lastPayEl.style.display = 'none';
        }

        // Sin pago previo o tipo no continuo → usar fecha de hoy
        const today = Utils.getCurrentDate();
        document.getElementById('incomeDate').value      = today;
        document.getElementById('incomeStartDate').value = today;
        calcEndDate(tipo);
        showVigenciaInfo();
    }

    function _suggestContinuousDates(lastEndDate, tipo) {
        if (!lastEndDate) return;
        // Inicio de vigencia = día siguiente al fin del pago anterior
        const lastEnd   = new Date(lastEndDate + 'T00:00:00');
        const nextStart = new Date(lastEnd.getTime() + 86400000);
        const startStr  = formatDateInput(nextStart);

        // Fecha de pago = hoy (cuando se registra, no cuando inicia)
        const today = Utils.getCurrentDate();
        document.getElementById('incomeDate').value      = today;
        document.getElementById('incomeStartDate').value = startStr;
        calcEndDate(tipo);
        showVigenciaInfo();
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

        const paymentId = document.getElementById('incomeId')?.value?.trim();
        UI.setButtonLoading('saveIncomeBtn', true);
        try {
            if (paymentId) {
                // Edición
                await Storage.updateIncome(paymentId, incomeData);
                UI.showSuccessToast('Pago actualizado');
                UI.hideModal('incomeModal');
                renderIncome();
                if (window.Dashboard) Dashboard.updateStats();
            } else {
                // Nuevo
                const saved = await Storage.addIncome(incomeData);
                UI.hideModal('incomeModal');
                renderIncome();
                if (window.Dashboard) Dashboard.updateStats();
                ofrecerWhatsApp(saved || incomeData);
            }
        } catch (err) {
            UI.showErrorToast('Error al guardar: ' + err.message);
        } finally {
            UI.setButtonLoading('saveIncomeBtn', false);
        }
    }

    function renderIncome() {
        const income     = Storage.getIncome();
        const dateFrom   = document.getElementById('paymentDateFrom')?.value  || '';
        const dateTo     = document.getElementById('paymentDateTo')?.value    || '';
        const typeFilter = document.getElementById('paymentTypeFilter')?.value || '';

        let filtered = income.filter(p => {
            const pd = (p.paymentDate || '');
            if (dateFrom && pd < dateFrom) return false;
            if (dateTo   && pd > dateTo)   return false;
            if (typeFilter && p.paymentType !== typeFilter) return false;
            return true;
        }).sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));

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
                <td><strong>${Utils.formatCurrency(Utils.parseAmount(p.amount))}</strong></td>
                <td>${p.paymentMethod}</td>
                <td><small>${vigencia}</small></td>
                <td>
                    <button class="btn btn-sm btn-warning me-1" onclick="Income.editPayment('${p.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="Income.deletePayment('${p.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function updateIncomeSummary(payments) {
        const total = payments.reduce((s, p) => s + Utils.parseAmount(p.amount), 0);
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

    // ── WhatsApp confirmación de pago ────────────────────────────────────

    function ofrecerWhatsApp(payment) {
        const user = Storage.getUserById(payment.userId);
        if (!user || !user.phone) {
            UI.showSuccessToast('Pago registrado exitosamente');
            return;
        }

        const nombre   = user.name;
        const monto    = Utils.formatCurrency(payment.amount);
        const tipo     = payment.paymentType || 'membresía';
        const fechaFin = payment.endDate ? Utils.formatDate(payment.endDate) : null;

        const vigenciaLine = fechaFin
            ? `\n\nTu membresía (${tipo}) es válida hasta el ${fechaFin}. ¡Gracias por tu preferencia!`
            : `\n\n¡Gracias por tu preferencia en Antología Box23!`;

        const msg = `Hola ${nombre}, tu pago en Antología Box23 por un valor de ${monto} ha sido registrado.${vigenciaLine}`;
        const phone = (user.phone || '').replace(/\D/g, '');
        const url   = `https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`;

        // Mostrar toast con botón para abrir WhatsApp
        const toastId = 'waPaymentToast_' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center border-0 bg-success text-white show position-fixed"
                 style="bottom:1.5rem;right:1.5rem;z-index:9999;min-width:320px" role="alert">
                <div class="d-flex align-items-center p-3">
                    <i class="fas fa-check-circle fa-lg me-3"></i>
                    <div class="flex-grow-1">
                        <div class="fw-bold">Pago registrado</div>
                        <div class="small">¿Enviar confirmación a ${nombre.split(' ')[0]} por WhatsApp?</div>
                    </div>
                    <div class="ms-3 d-flex flex-column gap-1">
                        <button class="btn btn-sm btn-light fw-bold" onclick="window.open('${url}','_blank');document.getElementById('${toastId}').remove()">
                            <i class="fab fa-whatsapp me-1 text-success"></i>Enviar
                        </button>
                        <button class="btn btn-sm btn-outline-light" onclick="document.getElementById('${toastId}').remove()">
                            Omitir
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        // Auto-cerrar después de 12 segundos
        setTimeout(() => document.getElementById(toastId)?.remove(), 12000);
    }

    return {
        initialize,
        openModal,
        editPayment,
        renderIncome,
        deletePayment,
        selectUser,
        clearUserSearch,
        populateSelect: populateUserSelect
    };
})();

window.Income = Income;

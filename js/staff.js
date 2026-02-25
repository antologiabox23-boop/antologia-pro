/**
 * Módulo de Control de Personal
 * Registro múltiple de clases con cola + liquidación de pagos
 */
const Staff = (() => {
    const RATE_PER_HOUR = 8500;
    let classQueue = []; // Cola de clases pendientes

    function initialize() {
        populateTrainerSelects();
        document.getElementById('classDate').value = Utils.getCurrentDate();
        document.getElementById('payDate').value = Utils.getCurrentDate();
        setupEventListeners();
        renderClasses();
    }

    function populateTrainerSelects() {
        const trainers = Users.getActiveUsers().filter(u => u.affiliationType === 'Entrenador(a)');
        const opts = trainers.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.name)}</option>`).join('');

        ['classTrainer', 'staffHistTrainer', 'payTrainer'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const first = id === 'staffHistTrainer' ? '<option value="">Todos</option>' : '<option value="">Seleccionar...</option>';
            sel.innerHTML = first + opts;
        });
    }

    function setupEventListeners() {
        document.getElementById('addClassToQueueBtn')?.addEventListener('click', addClassToQueue);
        document.getElementById('clearQueueBtn')?.addEventListener('click', clearQueue);
        document.getElementById('saveAllClassesBtn')?.addEventListener('click', saveAllClasses);
        document.getElementById('applyStaffFilter')?.addEventListener('click', renderClasses);
        document.getElementById('calcPayBtn')?.addEventListener('click', calcPayment);
        document.getElementById('registerPayBtn')?.addEventListener('click', registerPayment);
    }

    // ═══ REGISTRO MÚLTIPLE CON COLA ═══════════════════════════════════════

    function addClassToQueue() {
        const date = document.getElementById('classDate')?.value;
        const hour = document.getElementById('classHour')?.value;
        const trainerId = document.getElementById('classTrainer')?.value;
        const type = document.getElementById('classType')?.value;
        const duration = parseFloat(document.getElementById('classDuration')?.value);

        if (!date || !hour || !trainerId || !type || isNaN(duration)) {
            UI.showErrorToast('Completa todos los campos');
            return;
        }

        const trainer = Storage.getUserById(trainerId);
        if (!trainer) {
            UI.showErrorToast('Entrenador no encontrado');
            return;
        }

        // Agregar a la cola
        classQueue.push({
            id: 'temp-' + Date.now(),
            date,
            hour,
            trainerId,
            trainerName: trainer.name,
            classType: type,
            duration
        });

        // Limpiar campos excepto entrenador y fecha
        document.getElementById('classHour').value = '';
        document.getElementById('classType').value = '';
        document.getElementById('classDuration').value = '';

        renderQueue();
        UI.showSuccessToast('✓ Clase agregada a la lista');
    }

    function renderQueue() {
        const section = document.getElementById('classQueueSection');
        const tbody = document.getElementById('classQueueList');
        const count1 = document.getElementById('queueCount');
        const count2 = document.getElementById('queueCount2');

        if (classQueue.length === 0) {
            section?.classList.add('d-none');
            return;
        }

        section?.classList.remove('d-none');

        if (count1) count1.textContent = classQueue.length;
        if (count2) count2.textContent = classQueue.length;

        tbody.innerHTML = classQueue.map((c, i) => `
            <tr>
                <td style="font-size:.8rem">${Utils.formatDate(c.date)}</td>
                <td style="font-size:.8rem">${c.hour}</td>
                <td style="font-size:.8rem"><strong>${Utils.escapeHtml(c.trainerName)}</strong></td>
                <td style="font-size:.8rem"><span class="badge bg-info">${c.classType}</span></td>
                <td style="font-size:.8rem" class="text-center">${c.duration}h</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="Staff.removeFromQueue(${i})" title="Eliminar">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function removeFromQueue(index) {
        classQueue.splice(index, 1);
        renderQueue();
        UI.showSuccessToast('Clase eliminada de la lista');
    }

    function clearQueue() {
        if (classQueue.length === 0) return;
        UI.showConfirmModal('Limpiar lista', '¿Eliminar todas las clases de la lista?', () => {
            classQueue = [];
            renderQueue();
            UI.showSuccessToast('Lista limpiada');
        }, true);
    }

    async function saveAllClasses() {
        if (classQueue.length === 0) {
            UI.showErrorToast('No hay clases en la lista');
            return;
        }

        UI.setButtonLoading('saveAllClassesBtn', true);
        
        try {
            // Guardar todas las clases
            for (const c of classQueue) {
                await Storage.addClass({
                    date: c.date,
                    hour: c.hour,
                    trainerId: c.trainerId,
                    classType: c.classType,
                    duration: c.duration
                });
            }

            const totalHours = classQueue.reduce((sum, c) => sum + c.duration, 0);
            UI.showSuccessToast(`✓ ${classQueue.length} clases guardadas · ${totalHours.toFixed(1)} horas totales`);

            // Limpiar cola y formulario
            classQueue = [];
            renderQueue();
            document.getElementById('classForm')?.reset();
            document.getElementById('classDate').value = Utils.getCurrentDate();
            
            // Refrescar historial
            renderClasses();

        } catch (err) {
            console.error(err);
            UI.showErrorToast('Error al guardar clases');
        } finally {
            UI.setButtonLoading('saveAllClassesBtn', false);
        }
    }

    // ═══ HISTORIAL DE CLASES ══════════════════════════════════════════════

    function renderClasses() {
        const dateFrom = document.getElementById('staffHistFrom')?.value;
        const dateTo = document.getElementById('staffHistTo')?.value;
        const trFilter = document.getElementById('staffHistTrainer')?.value;
        const tbody = document.getElementById('classesList');
        if (!tbody) return;

        let classes = Storage.getClasses();
        if (dateFrom) classes = classes.filter(c => c.date >= dateFrom);
        if (dateTo) classes = classes.filter(c => c.date <= dateTo);
        if (trFilter) classes = classes.filter(c => c.trainerId === trFilter);
        classes.sort((a, b) => b.date.localeCompare(a.date) || (b.hour || '').localeCompare(a.hour || ''));

        const totalHours = classes.reduce((s, c) => s + parseFloat(c.duration || 0), 0);
        const hEl = document.getElementById('staffTotalHours');
        if (hEl) hEl.textContent = totalHours.toFixed(1) + ' h';

        if (classes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">Sin clases en el período</td></tr>`;
            return;
        }

        tbody.innerHTML = classes.map((c, i) => {
            const trainer = Storage.getUserById(c.trainerId);
            return `<tr>
                <td>${i + 1}</td>
                <td>${Utils.formatDate(c.date)}</td>
                <td>${c.hour || '-'}</td>
                <td>${trainer ? Utils.escapeHtml(trainer.name) : '-'}</td>
                <td><span class="badge bg-info">${c.classType}</span></td>
                <td>${parseFloat(c.duration).toFixed(1)} h</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="Staff.deleteClass('${c.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function deleteClass(id) {
        UI.showConfirmModal('Eliminar registro', '¿Eliminar esta clase del historial?', async () => {
            await Storage.deleteClass(id);
            UI.showSuccessToast('Registro eliminado');
            renderClasses();
        }, true);
    }

    // ═══ LIQUIDAR PAGO ═════════════════════════════════════════════════════

    function calcPayment() {
        const dateFrom = document.getElementById('payFrom')?.value;
        const dateTo = document.getElementById('payTo')?.value;
        const trainerId = document.getElementById('payTrainer')?.value;

        if (!dateFrom || !dateTo || !trainerId) {
            UI.showErrorToast('Selecciona período y entrenador');
            return;
        }
        if (dateFrom > dateTo) {
            UI.showErrorToast('La fecha inicial debe ser anterior a la final');
            return;
        }

        const classes = Storage.getClasses().filter(c =>
            c.trainerId === trainerId && c.date >= dateFrom && c.date <= dateTo
        );

        const resultDiv = document.getElementById('payResult');

        if (classes.length === 0) {
            UI.showWarningToast('Sin clases registradas en ese período para ese entrenador');
            resultDiv?.classList.add('d-none');
            return;
        }

        const byType = {};
        classes.forEach(c => {
            const t = c.classType || 'Sin tipo';
            if (!byType[t]) byType[t] = { count: 0, hours: 0 };
            byType[t].count++;
            byType[t].hours += parseFloat(c.duration || 0);
        });

        const totalClasses = classes.length;
        const totalHours = classes.reduce((s, c) => s + parseFloat(c.duration || 0), 0);
        const estimated = Math.round(totalHours * RATE_PER_HOUR);

        const detailBody = document.getElementById('payDetailTable');
        if (detailBody) {
            detailBody.innerHTML = Object.entries(byType)
                .sort((a, b) => b[1].hours - a[1].hours)
                .map(([type, d]) => `<tr>
                    <td>${Utils.escapeHtml(type)}</td>
                    <td class="text-center">${d.count}</td>
                    <td class="text-center">${d.hours.toFixed(1)} h</td>
                </tr>`).join('');
        }

        const tcEl = document.getElementById('payTotalClasses');
        const thEl = document.getElementById('payTotalHours');
        if (tcEl) tcEl.textContent = totalClasses;
        if (thEl) thEl.textContent = totalHours.toFixed(1) + ' h';

        const rateEl = document.getElementById('payRateDisplay');
        const estEl = document.getElementById('payEstimated');
        const finEl = document.getElementById('payFinalAmount');
        if (rateEl) rateEl.textContent = `$${RATE_PER_HOUR.toLocaleString('es-CO')}/h`;
        if (estEl) estEl.textContent = Utils.formatCurrency(estimated);
        if (finEl) finEl.value = estimated;

        const trainer = Storage.getUserById(trainerId);
        const nameEl = document.getElementById('payTrainerName');
        const periodEl = document.getElementById('payPeriodLabel');
        if (nameEl && trainer) nameEl.textContent = trainer.name;
        if (periodEl) periodEl.textContent = `${Utils.formatDate(dateFrom)} – ${Utils.formatDate(dateTo)}`;

        resultDiv?.classList.remove('d-none');
        resultDiv?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const regBtn = document.getElementById('registerPayBtn');
        const regHint = document.getElementById('registerPayHint');
        if (regBtn) regBtn.disabled = false;
        if (regHint) regHint.textContent = '';
    }

    async function registerPayment() {
        const trainerId = document.getElementById('payTrainer')?.value;
        const dateFrom = document.getElementById('payFrom')?.value;
        const dateTo = document.getElementById('payTo')?.value;
        const finalAmt = parseFloat(document.getElementById('payFinalAmount')?.value);
        const account = document.getElementById('payAccount')?.value;
        const payDate = document.getElementById('payDate')?.value;

        if (!trainerId || !dateFrom || !dateTo) {
            UI.showErrorToast('Primero calcula el pago');
            return;
        }
        if (isNaN(finalAmt) || finalAmt <= 0) {
            UI.showErrorToast('El monto debe ser mayor a $0');
            return;
        }
        if (!account) {
            UI.showErrorToast('Selecciona la cuenta de pago');
            return;
        }
        if (!payDate) {
            UI.showErrorToast('Selecciona la fecha del pago');
            return;
        }

        const trainer = Storage.getUserById(trainerId);
        const nombre = trainer ? trainer.name : 'Entrenador';

        UI.showConfirmModal(
            'Confirmar Pago',
            `Registrar <strong>${Utils.formatCurrency(finalAmt)}</strong> a <strong>${Utils.escapeHtml(nombre)}</strong><br>
             Período: ${Utils.formatDate(dateFrom)} al ${Utils.formatDate(dateTo)}<br>
             Cuenta: ${account}`,
            async () => {
                UI.setButtonLoading('registerPayBtn', true);
                try {
                    await Storage.addExpense({
                        date: payDate,
                        description: `Pago ${Utils.escapeHtml(nombre)} · ${Utils.formatDate(dateFrom)} al ${Utils.formatDate(dateTo)}`,
                        amount: finalAmt,
                        category: 'Pago Personal',
                        account
                    });

                    UI.showSuccessToast(`✓ Gasto registrado: ${Utils.formatCurrency(finalAmt)}`);

                    document.getElementById('payResult')?.classList.add('d-none');
                    ['payFrom', 'payTo', 'payDate'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = id === 'payDate' ? Utils.getCurrentDate() : '';
                    });
                    document.getElementById('payTrainer').value = '';
                    document.getElementById('payAccount').value = '';
                    const regBtn = document.getElementById('registerPayBtn');
                    const regHint = document.getElementById('registerPayHint');
                    if (regBtn) regBtn.disabled = true;
                    if (regHint) regHint.textContent = 'Primero calcula el pago';

                    if (window.Finance) {
                        Finance.renderExpenses?.();
                        Finance.updateSummary?.();
                    }
                } catch (err) {
                    console.error(err);
                    UI.showErrorToast('Error al registrar el gasto');
                } finally {
                    UI.setButtonLoading('registerPayBtn', false);
                }
            }
        );
    }

    return { initialize, populateTrainerSelects, renderClasses, deleteClass, removeFromQueue };
})();
window.Staff = Staff;

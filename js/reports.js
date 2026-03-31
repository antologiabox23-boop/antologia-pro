const Reports = (() => {
    function initialize() {
        setupEventListeners();
        document.getElementById('attendanceReportMonth').value = Utils.getCurrentMonth();
        document.getElementById('incomeReportMonth').value = Utils.getCurrentMonth();
    }

    function setupEventListeners() {
        document.getElementById('generateAttendanceReport')?.addEventListener('click', generateAttendanceReport);
        document.getElementById('generateIncomeReport')?.addEventListener('click', generateIncomeReport);
        document.getElementById('exportAttendanceReportExcel')?.addEventListener('click', exportAttendanceExcel);
        document.getElementById('exportIncomeReportExcel')?.addEventListener('click', exportIncomeExcel);
        document.getElementById('exportCustomReportPDF')?.addEventListener('click', exportCustomPDF);
        document.getElementById('exportCustomReportExcel')?.addEventListener('click', exportCustomExcel);
        
        // Informe combinado
        document.getElementById('generateCombinedReportBtn')?.addEventListener('click', generateCombinedReport);
        document.getElementById('exportCombinedReportBtn')?.addEventListener('click', exportCombinedReport);

        // Vencimiento de membresías
        document.getElementById('generateMembershipReport')?.addEventListener('click', generateMembershipReport);
        document.getElementById('exportMembershipReportExcel')?.addEventListener('click', exportMembershipReportExcel);
        document.getElementById('membershipReportFilter')?.addEventListener('change', generateMembershipReport);
    }

    function generateAttendanceReport() {
        const monthInput = document.getElementById('attendanceReportMonth').value;
        if (!monthInput) {
            UI.showWarningToast('Selecciona un mes');
            return;
        }

        const { start, end } = Utils.getMonthRange(monthInput);
        const users = Users.getActiveUsers();
        const tbody = document.getElementById('attendanceReportList');

        const report = users.map(user => {
            const userAttendance = Storage.getAttendance().filter(a =>
                a.userId === user.id && a.status === 'presente' && 
                a.date >= start && a.date <= end
            );
            const count = userAttendance.length;
            const daysInMonth = new Date(monthInput.split('-')[0], monthInput.split('-')[1], 0).getDate();
            const percentage = ((count / daysInMonth) * 100).toFixed(1);

            return { user, count, percentage };
        }).sort((a, b) => b.count - a.count);

        tbody.innerHTML = report.map(r => `
            <tr>
                <td>${Utils.escapeHtml(r.user.name)}</td>
                <td><strong>${r.count}</strong></td>
                <td>${r.percentage}%</td>
            </tr>
        `).join('');

        UI.showSuccessToast('Reporte generado');
    }

    function generateIncomeReport() {
        const monthInput = document.getElementById('incomeReportMonth').value;
        if (!monthInput) {
            UI.showWarningToast('Selecciona un mes');
            return;
        }

        const { start, end } = Utils.getMonthRange(monthInput);
        const payments = Storage.getIncomeByDateRange(start, end);
        const grouped = Utils.groupBy(payments, 'paymentType');
        const tbody = document.getElementById('incomeReportList');

        const report = Object.entries(grouped).map(([type, items]) => ({
            type,
            count: items.length,
            total: items.reduce((sum, p) => sum + parseFloat(p.amount), 0)
        })).sort((a, b) => b.total - a.total);

        tbody.innerHTML = report.map(r => `
            <tr>
                <td>${r.type}</td>
                <td>${r.count}</td>
                <td><strong>${Utils.formatCurrency(r.total)}</strong></td>
            </tr>
        `).join('');

        UI.showSuccessToast('Reporte generado');
    }

    function exportAttendanceExcel() {
        const month = document.getElementById('attendanceReportMonth').value;
        if (!month) return UI.showWarningToast('Primero genera el reporte');

        const { start, end } = Utils.getMonthRange(month);
        const users = Users.getActiveUsers();
        
        let csv = 'Usuario,Asistencias,Porcentaje\n';
        users.forEach(user => {
            const count = Storage.getAttendance().filter(a =>
                a.userId === user.id && a.status === 'presente' &&
                a.date >= start && a.date <= end
            ).length;
            const daysInMonth = new Date(month.split('-')[0], month.split('-')[1], 0).getDate();
            const percentage = ((count / daysInMonth) * 100).toFixed(1);
            csv += `"${user.name}",${count},${percentage}%\n`;
        });

        Utils.downloadFile(csv, `reporte_asistencia_${month}.csv`, 'text/csv');
        UI.showSuccessToast('Reporte exportado');
    }

    function exportIncomeExcel() {
        const month = document.getElementById('incomeReportMonth').value;
        if (!month) return UI.showWarningToast('Primero genera el reporte');

        const { start, end } = Utils.getMonthRange(month);
        const payments = Storage.getIncomeByDateRange(start, end);
        
        let csv = 'Fecha,Usuario,Tipo,Monto,Método\n';
        payments.forEach(p => {
            const user = Storage.getUserById(p.userId);
            csv += `${p.paymentDate},"${user?.name || 'N/A'}","${p.paymentType}",${p.amount},"${p.paymentMethod}"\n`;
        });

        Utils.downloadFile(csv, `reporte_ingresos_${month}.csv`, 'text/csv');
        UI.showSuccessToast('Reporte exportado');
    }

    function exportCustomPDF() {
        UI.showInfoToast('Exportación PDF en desarrollo');
    }

    function exportCustomExcel() {
        UI.showInfoToast('Exportación personalizada en desarrollo');
    }

    // ═══ INFORME COMBINADO: USUARIOS + ASISTENCIAS + PAGOS ═══════════════
    
    function generateCombinedReport() {
        const dateFrom = document.getElementById('combinedReportFrom')?.value;
        const dateTo = document.getElementById('combinedReportTo')?.value;
        const statusFilter = document.getElementById('combinedReportStatus')?.value || 'active';

        if (!dateFrom || !dateTo) {
            UI.showErrorToast('Selecciona el rango de fechas');
            return;
        }

        if (dateFrom > dateTo) {
            UI.showErrorToast('La fecha inicial debe ser menor a la final');
            return;
        }

        // Filtrar usuarios según estado
        let users = Storage.getUsers();
        if (statusFilter === 'active') {
            users = users.filter(u => u.status === 'active' && u.affiliationType !== 'Entrenador(a)');
        } else if (statusFilter === 'inactive') {
            users = users.filter(u => u.status === 'inactive' && u.affiliationType !== 'Entrenador(a)');
        } else {
            users = users.filter(u => u.affiliationType !== 'Entrenador(a)');
        }

        // Obtener asistencias y pagos del período
        const attendance = Storage.getAttendance().filter(a => 
            a.status === 'presente' && 
            a.date >= dateFrom && 
            a.date <= dateTo
        );

        const payments = Storage.getIncome().filter(p =>
            p.paymentDate >= dateFrom &&
            p.paymentDate <= dateTo
        );

        // Construir datos combinados
        const reportData = users.map(user => {
            const userAttendance = attendance.filter(a => a.userId === user.id).length;
            const userPayments = payments.filter(p => p.userId === user.id);
            const totalPaid = userPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            return {
                user,
                attendance: userAttendance,
                paymentsCount: userPayments.length,
                totalPaid
            };
        })
        // Filtrar usuarios con al menos 1 asistencia O 1 pago
        .filter(d => d.attendance > 0 || d.paymentsCount > 0);

        // Ordenar por asistencias (descendente)
        reportData.sort((a, b) => b.attendance - a.attendance);

        // Totales
        const totalAttendance = reportData.reduce((s, d) => s + d.attendance, 0);
        const totalIncome = reportData.reduce((s, d) => s + d.totalPaid, 0);

        // Actualizar badges
        document.getElementById('combinedReportCount').textContent = reportData.length;
        document.getElementById('combinedReportTotalAttendance').textContent = totalAttendance;
        document.getElementById('combinedReportTotalIncome').textContent = Utils.formatCurrency(totalIncome);

        // Renderizar tabla
        const tbody = document.getElementById('combinedReportList');
        tbody.innerHTML = reportData.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${Utils.escapeHtml(d.user.name)}</strong></td>
                <td><span class="badge bg-${d.user.status === 'active' ? 'success' : 'secondary'}">${d.user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td class="text-center"><span class="badge bg-info">${d.attendance}</span></td>
                <td class="text-center"><span class="badge bg-primary">${d.paymentsCount}</span></td>
                <td class="text-end"><strong>${Utils.formatCurrency(d.totalPaid)}</strong></td>
            </tr>
        `).join('');

        // Mostrar/ocultar secciones
        document.getElementById('combinedReportResult')?.classList.remove('d-none');
        document.getElementById('combinedReportEmpty')?.classList.add('d-none');

        // Guardar datos para exportación
        window._combinedReportData = { reportData, dateFrom, dateTo };
    }

    async function exportCombinedReport() {
        if (!window._combinedReportData) {
            UI.showErrorToast('Primero genera el informe');
            return;
        }

        const { reportData, dateFrom, dateTo } = window._combinedReportData;

        try {
            // Cargar SheetJS si no está disponible
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            // Preparar datos
            const data = reportData.map((d, i) => ({
                '#': i + 1,
                'Usuario': d.user.name,
                'Documento': d.user.document || '',
                'Teléfono': d.user.phone || '',
                'Estado': d.user.status === 'active' ? 'Activo' : 'Inactivo',
                'Asistencias': d.attendance,
                'Pagos Realizados': d.paymentsCount,
                'Total Pagado': d.totalPaid,
            }));

            // Crear workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Anchos de columna
            ws['!cols'] = [
                { wch: 4 },  // #
                { wch: 30 }, // Usuario
                { wch: 15 }, // Documento
                { wch: 15 }, // Teléfono
                { wch: 10 }, // Estado
                { wch: 12 }, // Asistencias
                { wch: 15 }, // Pagos Realizados
                { wch: 15 }, // Total Pagado
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Informe Combinado');

            // Generar archivo
            const filename = `Informe_Combinado_${dateFrom}_${dateTo}.xlsx`;
            XLSX.writeFile(wb, filename);

            UI.showSuccessToast('✓ Informe exportado: ' + filename);

        } catch (err) {
            console.error('Error al exportar:', err);
            UI.showErrorToast('Error al generar archivo Excel');
        }
    }

    // ═══ INFORME DE VENCIMIENTO DE MEMBRESÍAS ════════════════════════════

    function generateMembershipReport() {
        const filterEl  = document.getElementById('membershipReportFilter');
        const filter    = filterEl ? filterEl.value : 'all';
        const today     = Utils.getCurrentDate();

        const users    = Storage.getUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
        const allIncome = Storage.getIncome();

        const data = users.map(user => {
            // Tomar el pago con endDate más reciente del usuario
            const lastPayment = allIncome
                .filter(p => p.userId === user.id && p.endDate)
                .sort((a, b) => (Utils.normalizeDate(b.endDate) || '').localeCompare(Utils.normalizeDate(a.endDate) || ''))[0];

            const endDate = lastPayment ? (Utils.normalizeDate(lastPayment.endDate) || lastPayment.endDate) : null;
            const payType = lastPayment ? lastPayment.paymentType : null;

            let diasRestantes = null;
            let estado = 'sin-pago';

            if (endDate) {
                const diff = Math.ceil((new Date(endDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
                diasRestantes = diff;
                if (diff < 0)       estado = 'vencida';
                else if (diff <= 5) estado = 'por-vencer';
                else                estado = 'vigente';
            }

            return { user, endDate, payType, diasRestantes, estado };
        });

        // Aplicar filtro
        const filtered = data.filter(d => {
            if (filter === 'all')       return true;
            if (filter === 'vigente')   return d.estado === 'vigente';
            if (filter === 'por-vencer') return d.estado === 'por-vencer';
            if (filter === 'vencida')   return d.estado === 'vencida';
            if (filter === 'sin-pago')  return d.estado === 'sin-pago';
            return true;
        });

        // Ordenar: vencidas primero, luego por-vencer, luego vigentes, luego sin pago
        const order = { 'vencida': 0, 'por-vencer': 1, 'vigente': 2, 'sin-pago': 3 };
        filtered.sort((a, b) => {
            const od = order[a.estado] - order[b.estado];
            if (od !== 0) return od;
            if (a.endDate && b.endDate) return a.endDate.localeCompare(b.endDate);
            return 0;
        });

        // Badges resumen
        const counts = data.reduce((acc, d) => { acc[d.estado] = (acc[d.estado] || 0) + 1; return acc; }, {});
        document.getElementById('msVigenteCount').textContent   = counts['vigente']    || 0;
        document.getElementById('msPorVencerCount').textContent = counts['por-vencer'] || 0;
        document.getElementById('msVencidaCount').textContent   = counts['vencida']    || 0;
        document.getElementById('msSinPagoCount').textContent   = counts['sin-pago']   || 0;

        const tbody = document.getElementById('membershipReportList');
        tbody.innerHTML = filtered.length === 0
            ? `<tr><td colspan="6" class="text-center text-muted py-3">Sin usuarios para mostrar</td></tr>`
            : filtered.map((d, i) => {
                const { user, endDate, payType, diasRestantes, estado } = d;

                const estadoBadge = {
                    'vigente':    '<span class="badge bg-success">Vigente</span>',
                    'por-vencer': '<span class="badge bg-warning text-dark">Por vencer</span>',
                    'vencida':    '<span class="badge bg-danger">Vencida</span>',
                    'sin-pago':   '<span class="badge bg-secondary">Sin pago</span>',
                }[estado];

                const diasCell = diasRestantes !== null
                    ? (diasRestantes < 0
                        ? `<span class="text-danger fw-bold">${Math.abs(diasRestantes)} días vencida</span>`
                        : diasRestantes === 0
                            ? `<span class="text-warning fw-bold">Vence hoy</span>`
                            : `<span class="${diasRestantes <= 5 ? 'text-warning fw-bold' : ''}">${diasRestantes} días</span>`)
                    : '<span class="text-muted">—</span>';

                return `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${Utils.escapeHtml(user.name)}</strong><br>
                        <small class="text-muted">${Utils.escapeHtml(user.affiliationType || '')}</small></td>
                    <td>${Utils.formatPhone ? Utils.formatPhone(user.phone) : user.phone || '—'}</td>
                    <td>${endDate ? Utils.formatDate(endDate) : '<span class="text-muted">—</span>'}</td>
                    <td>${diasCell}</td>
                    <td>${estadoBadge}</td>
                </tr>`;
            }).join('');

        document.getElementById('membershipReportResult').classList.remove('d-none');
        document.getElementById('membershipReportEmpty').classList.add('d-none');
        const expBtn = document.getElementById('membershipExportBtn');
        if (expBtn) expBtn.style.display = '';

        // Guardar para exportar
        window._membershipReportData = { filtered, today };
        UI.showSuccessToast(`${filtered.length} usuario${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`);
    }

    async function exportMembershipReportExcel() {
        if (!window._membershipReportData) { UI.showWarningToast('Primero genera el informe'); return; }
        const { filtered, today } = window._membershipReportData;

        try {
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
                await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
            }

            const data = filtered.map((d, i) => ({
                '#':                i + 1,
                'Nombre':           d.user.name,
                'Teléfono':         d.user.phone || '',
                'Tipo Membresía':   d.user.affiliationType || '',
                'Último Pago':      d.payType || '',
                'Fecha Vencimiento': d.endDate ? d.endDate : '',
                'Días Restantes':   d.diasRestantes !== null ? d.diasRestantes : '',
                'Estado':           { vigente: 'Vigente', 'por-vencer': 'Por vencer', vencida: 'Vencida', 'sin-pago': 'Sin pago' }[d.estado] || ''
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 4 }, { wch: 30 }, { wch: 14 }, { wch: 20 },
                { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 12 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'Vencimientos');
            XLSX.writeFile(wb, `Vencimientos_Membresias_${today}.xlsx`);
            UI.showSuccessToast('✓ Informe exportado');
        } catch (err) {
            console.error(err);
            UI.showErrorToast('Error al exportar');
        }
    }

    return { initialize };
})();
window.Reports = Reports;

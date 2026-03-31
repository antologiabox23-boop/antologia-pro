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

        // Todas las asistencias (sin filtro de fecha) para calcular clases post-vencimiento
        const allAttendance = Storage.getAttendance().filter(a => a.status === 'presente');
        const allIncome     = Storage.getIncome();

        // Obtener asistencias y pagos del período
        const attendance = allAttendance.filter(a =>
            a.date >= dateFrom && a.date <= dateTo
        );

        const payments = allIncome.filter(p =>
            p.paymentDate >= dateFrom &&
            p.paymentDate <= dateTo
        );

        // Construir datos combinados
        const reportData = users.map(user => {
            const userAttendance = attendance.filter(a => a.userId === user.id).length;
            const userPayments   = payments.filter(p => p.userId === user.id);
            const totalPaid      = userPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            // Último endDate de cualquier pago del usuario (hasta dateTo)
            const lastPayment = allIncome
                .filter(p => p.userId === user.id && p.endDate && p.paymentDate <= dateTo)
                .sort((a, b) => (Utils.normalizeDate(b.endDate) || '').localeCompare(Utils.normalizeDate(a.endDate) || ''))[0];

            const endDate = lastPayment ? (Utils.normalizeDate(lastPayment.endDate) || lastPayment.endDate) : null;

            // Clases tomadas DESPUÉS del vencimiento, dentro del período del informe
            const postExpiry = endDate
                ? allAttendance.filter(a =>
                    a.userId === user.id &&
                    a.date > endDate &&
                    a.date >= dateFrom &&
                    a.date <= dateTo
                  ).length
                : 0;

            return {
                user,
                attendance: userAttendance,
                postExpiry,
                endDate,
                paymentsCount: userPayments.length,
                totalPaid
            };
        })
        .filter(d => d.attendance > 0 || d.paymentsCount > 0);

        // Ordenar por asistencias (descendente)
        reportData.sort((a, b) => b.attendance - a.attendance);

        // Totales
        const totalAttendance = reportData.reduce((s, d) => s + d.attendance, 0);
        const totalIncome     = reportData.reduce((s, d) => s + d.totalPaid, 0);
        const totalPostExpiry = reportData.reduce((s, d) => s + d.postExpiry, 0);

        // Actualizar badges
        document.getElementById('combinedReportCount').textContent           = reportData.length;
        document.getElementById('combinedReportTotalAttendance').textContent = totalAttendance;
        document.getElementById('combinedReportTotalIncome').textContent     = Utils.formatCurrency(totalIncome);

        // Badge clases post-vencimiento
        let postBadge = document.getElementById('combinedReportPostExpiry');
        if (!postBadge) {
            postBadge = document.createElement('span');
            postBadge.id = 'combinedReportPostExpiry';
            postBadge.className = 'badge bg-danger';
            const badgesContainer = document.getElementById('combinedReportTotalIncome')?.closest('.badge')?.parentNode;
            if (badgesContainer) badgesContainer.appendChild(postBadge);
        }
        if (postBadge) postBadge.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>${totalPostExpiry} clases post-venc.`;
        if (postBadge) postBadge.style.display = totalPostExpiry > 0 ? '' : 'none';

        // Renderizar tabla
        const tbody = document.getElementById('combinedReportList');
        tbody.innerHTML = reportData.map((d, i) => {
            const postExpiryCell = d.postExpiry > 0
                ? `<span class="badge bg-danger" title="Clases asistidas después del ${d.endDate ? Utils.formatDate(d.endDate) : 'vencimiento'}">${d.postExpiry}</span>`
                : d.endDate
                    ? `<span class="text-muted">—</span>`
                    : `<span class="text-muted small">sin fecha</span>`;
            return `
            <tr ${d.postExpiry > 0 ? 'class="table-danger bg-opacity-25"' : ''}>
                <td>${i + 1}</td>
                <td><strong>${Utils.escapeHtml(d.user.name)}</strong></td>
                <td><span class="badge bg-${d.user.status === 'active' ? 'success' : 'secondary'}">${d.user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td class="text-center"><span class="badge bg-info">${d.attendance}</span></td>
                <td class="text-center">${postExpiryCell}</td>
                <td class="text-center"><span class="badge bg-primary">${d.paymentsCount}</span></td>
                <td class="text-end"><strong>${Utils.formatCurrency(d.totalPaid)}</strong></td>
            </tr>`;
        }).join('');

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
                'Clases Post-Vencimiento': d.postExpiry,
                'Vencimiento Membresía': d.endDate ? d.endDate : '',
                'Pagos Realizados': d.paymentsCount,
                'Total Pagado': d.totalPaid,
            }));

            // Crear workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            ws['!cols'] = [
                { wch: 4 },  // #
                { wch: 30 }, // Usuario
                { wch: 15 }, // Documento
                { wch: 15 }, // Teléfono
                { wch: 10 }, // Estado
                { wch: 12 }, // Asistencias
                { wch: 22 }, // Clases Post-Vencimiento
                { wch: 22 }, // Vencimiento Membresía
                { wch: 18 }, // Pagos Realizados
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

    return { initialize };
})();
window.Reports = Reports;

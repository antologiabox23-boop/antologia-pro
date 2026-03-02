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

        // Reporte personalizado
        document.getElementById('generateCustomReport')?.addEventListener('click', generateCustomReport);

        // Movimientos por cuenta
        document.getElementById('generateAccountReport')?.addEventListener('click', generateAccountReport);
        document.getElementById('exportAccountReportExcel')?.addEventListener('click', exportAccountReportExcel);
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

    // ═══ REPORTE PERSONALIZADO ═══════════════════════════════════════════

    function generateCustomReport() {
        const start = document.getElementById('customReportStart').value;
        const end   = document.getElementById('customReportEnd').value;
        const type  = document.getElementById('customReportType').value;

        if (!start || !end) {
            UI.showWarningToast('Selecciona el rango de fechas');
            return;
        }
        if (start > end) {
            UI.showErrorToast('La fecha inicio debe ser menor a la final');
            return;
        }

        const thead = document.getElementById('customReportThead');
        const tbody = document.getElementById('customReportList');
        const tfoot = document.getElementById('customReportTfoot');
        let rows = [];
        let headers = '';
        let totalRow = '';

        if (type === 'attendance' || type === 'complete') {
            const attendance = Storage.getAttendance().filter(a =>
                a.status === 'presente' && a.date >= start && a.date <= end
            );
            if (type === 'attendance') {
                headers = '<tr><th>Fecha</th><th>Usuario</th><th>Estado</th></tr>';
                rows = attendance.map(a => {
                    const user = Storage.getUserById(a.userId);
                    return `<tr>
                        <td>${a.date}</td>
                        <td>${Utils.escapeHtml(user?.name || 'N/A')}</td>
                        <td><span class="badge bg-success">Presente</span></td>
                    </tr>`;
                });
                totalRow = `<tr class="table-light fw-bold"><td colspan="2">Total asistencias</td><td>${rows.length}</td></tr>`;
                window._customReportData = { type, start, end, attendance };
            }
        }

        if (type === 'income') {
            const payments = Storage.getIncome().filter(p => p.paymentDate >= start && p.paymentDate <= end);
            headers = '<tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Método</th><th class="text-end">Monto</th></tr>';
            const total = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
            rows = payments.map(p => {
                const user = Storage.getUserById(p.userId);
                return `<tr>
                    <td>${p.paymentDate}</td>
                    <td>${Utils.escapeHtml(user?.name || 'N/A')}</td>
                    <td>${Utils.escapeHtml(p.paymentType || '')}</td>
                    <td>${Utils.escapeHtml(p.paymentMethod || '')}</td>
                    <td class="text-end"><strong>${Utils.formatCurrency(parseFloat(p.amount || 0))}</strong></td>
                </tr>`;
            });
            totalRow = `<tr class="table-success fw-bold"><td colspan="4">Total ingresos</td><td class="text-end">${Utils.formatCurrency(total)}</td></tr>`;
            window._customReportData = { type, start, end, payments };
        }

        if (type === 'users') {
            const users = Storage.getUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
            headers = '<tr><th>#</th><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Estado</th><th>Tipo</th></tr>';
            rows = users.map((u, i) => `<tr>
                <td>${i + 1}</td>
                <td>${Utils.escapeHtml(u.name)}</td>
                <td>${Utils.escapeHtml(u.document || '')}</td>
                <td>${Utils.escapeHtml(u.phone || '')}</td>
                <td><span class="badge bg-${u.status === 'active' ? 'success' : 'secondary'}">${u.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>${Utils.escapeHtml(u.affiliationType || '')}</td>
            </tr>`);
            totalRow = `<tr class="table-light fw-bold"><td colspan="5">Total usuarios</td><td>${rows.length}</td></tr>`;
            window._customReportData = { type, start, end, users };
        }

        if (type === 'complete') {
            const payments = Storage.getIncome().filter(p => p.paymentDate >= start && p.paymentDate <= end);
            const attendance = Storage.getAttendance().filter(a =>
                a.status === 'presente' && a.date >= start && a.date <= end
            );
            const users = Storage.getUsers().filter(u => u.affiliationType !== 'Entrenador(a)');
            headers = '<tr><th>#</th><th>Usuario</th><th>Estado</th><th class="text-center">Asistencias</th><th class="text-center">Pagos</th><th class="text-end">Total Pagado</th></tr>';
            const data = users.map(u => ({
                user: u,
                att: attendance.filter(a => a.userId === u.id).length,
                pays: payments.filter(p => p.userId === u.id),
            })).filter(d => d.att > 0 || d.pays.length > 0)
               .sort((a, b) => b.att - a.att);
            const grandTotal = data.reduce((s, d) => s + d.pays.reduce((ss, p) => ss + parseFloat(p.amount || 0), 0), 0);
            rows = data.map((d, i) => `<tr>
                <td>${i + 1}</td>
                <td><strong>${Utils.escapeHtml(d.user.name)}</strong></td>
                <td><span class="badge bg-${d.user.status === 'active' ? 'success' : 'secondary'}">${d.user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td class="text-center"><span class="badge bg-info">${d.att}</span></td>
                <td class="text-center"><span class="badge bg-primary">${d.pays.length}</span></td>
                <td class="text-end"><strong>${Utils.formatCurrency(d.pays.reduce((s, p) => s + parseFloat(p.amount || 0), 0))}</strong></td>
            </tr>`);
            totalRow = `<tr class="table-success fw-bold"><td colspan="5">Total ingresos</td><td class="text-end">${Utils.formatCurrency(grandTotal)}</td></tr>`;
            window._customReportData = { type, start, end, data };
        }

        thead.innerHTML = headers;
        tbody.innerHTML = rows.join('') || `<tr><td colspan="6" class="text-center text-muted">Sin datos para el período seleccionado</td></tr>`;
        tfoot.innerHTML = totalRow;

        document.getElementById('customReportCount').textContent = rows.length;
        document.getElementById('customReportResult').classList.remove('d-none');
        document.getElementById('customReportEmpty').classList.add('d-none');
        UI.showSuccessToast('Reporte generado');
    }

    async function exportCustomPDF() {
        if (!window._customReportData) {
            UI.showWarningToast('Primero genera el reporte');
            return;
        }
        const { type, start, end } = window._customReportData;
        // Generar HTML para imprimir
        const table = document.querySelector('#customReportList')?.closest('table');
        if (!table) return;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Reporte Personalizado ${start} - ${end}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  h2 { color: #333; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  tfoot tr { background: #e8f5e9; font-weight: bold; }
  .badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #999; color: #fff; }
</style>
</head><body>
<h2>Reporte Personalizado — ${type === 'complete' ? 'Completo' : type === 'income' ? 'Ingresos' : type === 'attendance' ? 'Asistencia' : 'Usuarios'}</h2>
<p>Período: ${start} al ${end} | Generado: ${new Date().toLocaleString('es-CO')}</p>
${table.outerHTML}
</body></html>`);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
        UI.showSuccessToast('Abriendo ventana de impresión/PDF');
    }

    async function exportCustomExcel() {
        if (!window._customReportData) {
            UI.showWarningToast('Primero genera el reporte');
            return;
        }
        const { type, start, end } = window._customReportData;
        try {
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
                await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
            }

            let data = [];
            if (type === 'income') {
                data = (window._customReportData.payments || []).map(p => {
                    const user = Storage.getUserById(p.userId);
                    return { Fecha: p.paymentDate, Usuario: user?.name || 'N/A', Tipo: p.paymentType, Método: p.paymentMethod, Monto: parseFloat(p.amount || 0) };
                });
            } else if (type === 'attendance') {
                data = (window._customReportData.attendance || []).map(a => {
                    const user = Storage.getUserById(a.userId);
                    return { Fecha: a.date, Usuario: user?.name || 'N/A', Estado: 'Presente' };
                });
            } else if (type === 'users') {
                data = (window._customReportData.users || []).map((u, i) => ({
                    '#': i + 1, Nombre: u.name, Documento: u.document || '', Teléfono: u.phone || '',
                    Estado: u.status === 'active' ? 'Activo' : 'Inactivo', Tipo: u.affiliationType || ''
                }));
            } else {
                data = (window._customReportData.data || []).map((d, i) => ({
                    '#': i + 1, Usuario: d.user.name, Estado: d.user.status === 'active' ? 'Activo' : 'Inactivo',
                    Asistencias: d.att, Pagos: d.pays.length,
                    'Total Pagado': d.pays.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
                }));
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
            XLSX.writeFile(wb, `Reporte_${type}_${start}_${end}.xlsx`);
            UI.showSuccessToast('Reporte exportado a Excel');
        } catch (err) {
            console.error(err);
            UI.showErrorToast('Error al exportar Excel');
        }
    }

    // ═══ MOVIMIENTOS POR CUENTA ══════════════════════════════════════════

    function generateAccountReport() {
        const dateFrom = document.getElementById('accountReportFrom').value;
        const dateTo   = document.getElementById('accountReportTo').value;
        const method   = document.getElementById('accountReportMethod').value;

        if (!dateFrom || !dateTo) {
            UI.showWarningToast('Selecciona el rango de fechas');
            return;
        }
        if (dateFrom > dateTo) {
            UI.showErrorToast('La fecha inicial debe ser menor a la final');
            return;
        }

        // Filtrar pagos
        let payments = Storage.getIncome().filter(p =>
            p.paymentDate >= dateFrom && p.paymentDate <= dateTo
        );
        if (method !== 'all') {
            payments = payments.filter(p => p.paymentMethod === method);
        }

        // Ordenar por fecha
        payments.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

        // Resumen por cuenta
        const accounts = method === 'all'
            ? ['Efectivo', 'Bancolombia', 'Daviplata', 'Nequi']
            : [method];

        const icons  = { Efectivo: '💵', Bancolombia: '🏦', Daviplata: '📱', Nequi: '📱' };
        const colors = { Efectivo: 'success', Bancolombia: 'primary', Daviplata: 'info', Nequi: 'warning' };

        const summaryCards = document.getElementById('accountSummaryCards');
        summaryCards.innerHTML = accounts.map(acc => {
            const accPayments = payments.filter(p => p.paymentMethod === acc);
            const total = accPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
            if (method === 'all' && accPayments.length === 0) return '';
            return `<div class="col-6 col-md-3">
                <div class="card border-${colors[acc] || 'secondary'} text-center py-2">
                    <div class="card-body p-2">
                        <div class="fs-4">${icons[acc] || '💳'}</div>
                        <div class="fw-bold small">${acc}</div>
                        <div class="text-${colors[acc] || 'secondary'} fw-bold">${Utils.formatCurrency(total)}</div>
                        <div class="text-muted" style="font-size:11px">${accPayments.length} movimiento${accPayments.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Tabla de detalle
        const total = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const tbody = document.getElementById('accountReportList');
        tbody.innerHTML = payments.length === 0
            ? '<tr><td colspan="5" class="text-center text-muted">No hay movimientos en el período seleccionado</td></tr>'
            : payments.map(p => {
                const user = Storage.getUserById(p.userId);
                const acc = p.paymentMethod || 'N/A';
                return `<tr>
                    <td>${p.paymentDate}</td>
                    <td>${Utils.escapeHtml(user?.name || 'N/A')}</td>
                    <td>${Utils.escapeHtml(p.paymentType || '')}</td>
                    <td><span class="badge bg-${colors[acc] || 'secondary'}">${icons[acc] || '💳'} ${acc}</span></td>
                    <td class="text-end fw-bold">${Utils.formatCurrency(parseFloat(p.amount || 0))}</td>
                </tr>`;
            }).join('');

        document.getElementById('accountReportTfoot').innerHTML = `
            <tr class="table-success fw-bold">
                <td colspan="4">Total del período</td>
                <td class="text-end">${Utils.formatCurrency(total)}</td>
            </tr>`;

        document.getElementById('accountReportResult').classList.remove('d-none');
        document.getElementById('accountReportEmpty').classList.add('d-none');

        window._accountReportData = { payments, dateFrom, dateTo, method };
        UI.showSuccessToast(`${payments.length} movimiento${payments.length !== 1 ? 's' : ''} encontrado${payments.length !== 1 ? 's' : ''}`);
    }

    async function exportAccountReportExcel() {
        if (!window._accountReportData) {
            UI.showWarningToast('Primero genera el reporte');
            return;
        }
        const { payments, dateFrom, dateTo, method } = window._accountReportData;
        try {
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
                await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
            }

            const data = payments.map((p, i) => {
                const user = Storage.getUserById(p.userId);
                return {
                    '#': i + 1,
                    'Fecha': p.paymentDate,
                    'Usuario': user?.name || 'N/A',
                    'Documento': user?.document || '',
                    'Tipo de Pago': p.paymentType || '',
                    'Cuenta / Método': p.paymentMethod || '',
                    'Monto': parseFloat(p.amount || 0),
                    'Notas': p.notes || ''
                };
            });

            // Hoja de detalle
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 4 }, { wch: 12 }, { wch: 28 }, { wch: 15 },
                { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 20 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

            // Hoja resumen por cuenta
            const accounts = ['Efectivo', 'Bancolombia', 'Daviplata', 'Nequi'];
            const summaryData = accounts.map(acc => {
                const accP = payments.filter(p => p.paymentMethod === acc);
                return {
                    'Cuenta': acc,
                    'Cantidad de Movimientos': accP.length,
                    'Total Recaudado': accP.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
                };
            });
            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            wsSummary['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por Cuenta');

            const filename = `Movimientos_${method === 'all' ? 'TodasCuentas' : method}_${dateFrom}_${dateTo}.xlsx`;
            XLSX.writeFile(wb, filename);
            UI.showSuccessToast('✓ Exportado: ' + filename);
        } catch (err) {
            console.error(err);
            UI.showErrorToast('Error al exportar Excel');
        }
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

    return { initialize };
})();
window.Reports = Reports;

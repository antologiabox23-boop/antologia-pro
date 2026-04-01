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

    // ═══ MOVIMIENTOS POR CUENTA (EXTRACTO) ═══════════════════════════════

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

        const accounts = method === 'all'
            ? ['Efectivo', 'Bancolombia', 'Daviplata', 'Nequi']
            : [method];

        const icons  = { Efectivo: '💵', Bancolombia: '🏦', Daviplata: '📱', Nequi: '📱' };
        const colors = { Efectivo: 'success', Bancolombia: 'primary', Daviplata: 'info', Nequi: 'warning' };

        // ── Todos los movimientos del período para la(s) cuenta(s) ─────────
        const allIncome   = Storage.getIncome();
        const allExpenses = Storage.getExpenses();

        // Calcular saldo INICIAL (todo lo anterior a dateFrom)
        function getSaldoInicial(acc) {
            const ing = allIncome
                .filter(p => p.paymentMethod === acc && p.paymentDate < dateFrom)
                .reduce((s, p) => s + Utils.parseAmount(p.amount), 0);
            const gas = allExpenses
                .filter(e => e.account === acc && e.date < dateFrom)
                .reduce((s, e) => s + Utils.parseAmount(e.amount), 0);
            return ing - gas;
        }

        // Filtrar movimientos del período
        function getMovimientos(acc) {
            const ing = allIncome
                .filter(p => p.paymentMethod === acc && p.paymentDate >= dateFrom && p.paymentDate <= dateTo)
                .map(p => ({
                    fecha: p.paymentDate,
                    descripcion: (() => { const u = Storage.getUserById(p.userId); return `Ingreso — ${p.paymentType || 'Pago'}${u ? ' · ' + u.name : ''}`; })(),
                    tipo: 'ingreso',
                    debe: 0,
                    haber: Utils.parseAmount(p.amount),
                    raw: p
                }));
            const gas = allExpenses
                .filter(e => e.account === acc && e.date >= dateFrom && e.date <= dateTo)
                .map(e => ({
                    fecha: e.date,
                    descripcion: `Gasto — ${e.category}${e.description ? ' · ' + e.description : ''}`,
                    tipo: 'gasto',
                    debe: Utils.parseAmount(e.amount),
                    haber: 0,
                    raw: e
                }));
            return [...ing, ...gas].sort((a, b) => a.fecha.localeCompare(b.fecha));
        }

        // ── Tarjetas de resumen ────────────────────────────────────────────
        const summaryCards = document.getElementById('accountSummaryCards');
        let summaryHtml = '';
        let allMovimientos = [];

        accounts.forEach(acc => {
            const movs = getMovimientos(acc);
            const saldoInicial = getSaldoInicial(acc);
            const totalIng = movs.reduce((s, m) => s + m.haber, 0);
            const totalGas = movs.reduce((s, m) => s + m.debe, 0);
            const saldoFinal = saldoInicial + totalIng - totalGas;

            // Agregar cuenta a cada movimiento para tabla global
            movs.forEach(m => { m.account = acc; });
            allMovimientos.push({ acc, movs, saldoInicial, totalIng, totalGas, saldoFinal });

            if (method === 'all' && movs.length === 0 && saldoInicial === 0) return;

            summaryHtml += `
            <div class="col-6 col-md-3">
                <div class="card border-${colors[acc] || 'secondary'} h-100">
                    <div class="card-body p-2 text-center">
                        <div class="fs-4">${icons[acc] || '💳'}</div>
                        <div class="fw-bold small">${acc}</div>
                        <div class="text-muted" style="font-size:10px">Saldo inicial</div>
                        <div class="small">${Utils.formatCurrency(saldoInicial)}</div>
                        <hr class="my-1">
                        <div class="text-success small">+${Utils.formatCurrency(totalIng)}</div>
                        <div class="text-danger small">-${Utils.formatCurrency(totalGas)}</div>
                        <hr class="my-1">
                        <div class="text-muted" style="font-size:10px">Saldo final</div>
                        <div class="fw-bold text-${colors[acc] || 'secondary'}">${Utils.formatCurrency(saldoFinal)}</div>
                    </div>
                </div>
            </div>`;
        });

        summaryCards.innerHTML = summaryHtml || '<div class="col-12 text-muted small">Sin datos para las cuentas seleccionadas</div>';

        // ── Tabla de detalle tipo extracto ─────────────────────────────────
        const tbody = document.getElementById('accountReportList');
        const tfoot = document.getElementById('accountReportTfoot');
        let tableRows = '';
        let grandSaldoInicial = 0;
        let grandHaber = 0;
        let grandDebe = 0;

        allMovimientos.forEach(({ acc, movs, saldoInicial, totalIng, totalGas, saldoFinal }) => {
            if (method === 'all' && movs.length === 0 && saldoInicial === 0) return;

            grandSaldoInicial += saldoInicial;
            grandHaber += totalIng;
            grandDebe  += totalGas;

            // Fila de saldo inicial de la cuenta
            if (method === 'all') {
                tableRows += `<tr class="table-${colors[acc] || 'secondary'} bg-opacity-10">
                    <td colspan="5" class="fw-bold small">
                        <span class="badge bg-${colors[acc] || 'secondary'}">${icons[acc] || '💳'} ${acc}</span>
                        &nbsp; Saldo inicial al ${dateFrom}: <strong>${Utils.formatCurrency(saldoInicial)}</strong>
                    </td>
                </tr>`;
            }

            if (movs.length === 0) {
                tableRows += `<tr><td colspan="5" class="text-muted small text-center fst-italic">Sin movimientos en el período</td></tr>`;
            } else {
                let saldoAcumulado = saldoInicial;
                movs.forEach(m => {
                    saldoAcumulado += m.haber - m.debe;
                    tableRows += `<tr>
                        <td class="small">${m.fecha}</td>
                        <td class="small">${Utils.escapeHtml(m.descripcion)}</td>
                        <td class="text-end small ${m.debe > 0 ? 'text-danger' : 'text-muted'}">${m.debe > 0 ? Utils.formatCurrency(m.debe) : '—'}</td>
                        <td class="text-end small ${m.haber > 0 ? 'text-success' : 'text-muted'}">${m.haber > 0 ? Utils.formatCurrency(m.haber) : '—'}</td>
                        <td class="text-end small fw-bold ${saldoAcumulado >= 0 ? '' : 'text-danger'}">${Utils.formatCurrency(saldoAcumulado)}</td>
                    </tr>`;
                });
            }

            // Subtotal por cuenta si hay varias
            if (method === 'all') {
                tableRows += `<tr class="table-light">
                    <td colspan="2" class="small fw-bold text-end">Saldo final ${acc}:</td>
                    <td class="text-end text-danger small fw-bold">-${Utils.formatCurrency(totalGas)}</td>
                    <td class="text-end text-success small fw-bold">+${Utils.formatCurrency(totalIng)}</td>
                    <td class="text-end fw-bold">${Utils.formatCurrency(saldoFinal)}</td>
                </tr>`;
            }
        });

        tbody.innerHTML = tableRows || `<tr><td colspan="5" class="text-center text-muted">No hay movimientos en el período seleccionado</td></tr>`;

        const grandSaldoFinal = grandSaldoInicial + grandHaber - grandDebe;
        tfoot.innerHTML = `
            <tr class="table-dark fw-bold">
                <td colspan="2">TOTALES DEL PERÍODO</td>
                <td class="text-end text-danger">-${Utils.formatCurrency(grandDebe)}</td>
                <td class="text-end text-success">+${Utils.formatCurrency(grandHaber)}</td>
                <td class="text-end">${Utils.formatCurrency(grandSaldoFinal)}</td>
            </tr>`;

        document.getElementById('accountReportResult').classList.remove('d-none');
        document.getElementById('accountReportEmpty').classList.add('d-none');

        window._accountReportData = { allMovimientos, dateFrom, dateTo, method };
        const totalMovs = allMovimientos.reduce((s, a) => s + a.movs.length, 0);
        UI.showSuccessToast(`${totalMovs} movimiento${totalMovs !== 1 ? 's' : ''} encontrado${totalMovs !== 1 ? 's' : ''}`);
    }

    async function exportAccountReportExcel() {
        if (!window._accountReportData) {
            UI.showWarningToast('Primero genera el reporte');
            return;
        }
        const { allMovimientos, dateFrom, dateTo, method } = window._accountReportData;
        try {
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
                await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
            }

            const wb = XLSX.utils.book_new();

            // Hoja de detalle por cuenta
            allMovimientos.forEach(({ acc, movs, saldoInicial, saldoFinal }) => {
                if (method === 'all' && movs.length === 0 && saldoInicial === 0) return;

                const data = [];
                data.push({ 'Fecha': `Saldo inicial al ${dateFrom}`, 'Descripción': '', 'Gasto (Débito)': '', 'Ingreso (Crédito)': '', 'Saldo': saldoInicial });

                let saldo = saldoInicial;
                movs.forEach(m => {
                    saldo += m.haber - m.debe;
                    data.push({
                        'Fecha': m.fecha,
                        'Descripción': m.descripcion,
                        'Gasto (Débito)': m.debe || '',
                        'Ingreso (Crédito)': m.haber || '',
                        'Saldo': saldo
                    });
                });
                data.push({ 'Fecha': `Saldo final al ${dateTo}`, 'Descripción': '', 'Gasto (Débito)': '', 'Ingreso (Crédito)': '', 'Saldo': saldoFinal });

                const ws = XLSX.utils.json_to_sheet(data);
                ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
                XLSX.utils.book_append_sheet(wb, ws, acc.substring(0, 31));
            });

            // Hoja resumen general
            const summaryData = allMovimientos.map(({ acc, saldoInicial, totalIng, totalGas, saldoFinal }) => ({
                'Cuenta': acc,
                'Saldo Inicial': saldoInicial,
                'Total Ingresos': totalIng,
                'Total Gastos': totalGas,
                'Saldo Final': saldoFinal
            }));
            const wsResumen = XLSX.utils.json_to_sheet(summaryData);
            wsResumen['!cols'] = [{ wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

            const filename = `Extracto_${method === 'all' ? 'TodasCuentas' : method}_${dateFrom}_${dateTo}.xlsx`;
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

        // Obtener TODOS los pagos (para determinar membresía vigente)
        const allPayments = Storage.getIncome();

        // Obtener asistencias y pagos del período
        const attendance = Storage.getAttendance().filter(a => 
            a.status === 'presente' && 
            a.date >= dateFrom && 
            a.date <= dateTo
        );

        const payments = allPayments.filter(p =>
            p.paymentDate >= dateFrom &&
            p.paymentDate <= dateTo
        );

        // Construir datos combinados
        const reportData = users.map(user => {
            const userAttendance = attendance.filter(a => a.userId === user.id);
            const userPayments = payments.filter(p => p.userId === user.id);
            const totalPaid = userPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            // Fecha de vencimiento: último pago con endDate registrado hasta la fecha final del reporte
            const lastPayWithEnd = allPayments
                .filter(p => p.userId === user.id && p.endDate)
                .sort((a, b) => (Utils.normalizeDate(b.endDate) || '').localeCompare(Utils.normalizeDate(a.endDate) || ''))[0];

            const membershipEndRaw = lastPayWithEnd ? Utils.normalizeDate(lastPayWithEnd.endDate) : null;

            // ¿Venció dentro del período del reporte?
            const expiredInPeriod = membershipEndRaw
                && membershipEndRaw >= dateFrom
                && membershipEndRaw <= dateTo;

            // Clases asistidas DESPUÉS del vencimiento (dentro del período)
            let postExpiryAttendance = 0;
            if (membershipEndRaw) {
                postExpiryAttendance = userAttendance.filter(a => a.date > membershipEndRaw).length;
            }

            return {
                user,
                attendance: userAttendance.length,
                paymentsCount: userPayments.length,
                totalPaid,
                membershipEnd: membershipEndRaw,
                expiredInPeriod: !!expiredInPeriod,
                postExpiryAttendance
            };
        })
        // Filtrar usuarios con al menos 1 asistencia O 1 pago
        .filter(d => d.attendance > 0 || d.paymentsCount > 0);

        // Ordenar por asistencias (descendente)
        reportData.sort((a, b) => b.attendance - a.attendance);

        // Totales
        const totalAttendance = reportData.reduce((s, d) => s + d.attendance, 0);
        const totalIncome = reportData.reduce((s, d) => s + d.totalPaid, 0);
        const expiredCount = reportData.filter(d => d.expiredInPeriod).length;
        const postExpTotal = reportData.reduce((s, d) => s + d.postExpiryAttendance, 0);

        // Actualizar badges
        document.getElementById('combinedReportCount').textContent = reportData.length;
        document.getElementById('combinedReportTotalAttendance').textContent = totalAttendance;
        document.getElementById('combinedReportTotalIncome').textContent = Utils.formatCurrency(totalIncome);

        const expBadge = document.getElementById('combinedReportExpiredBadge');
        const postBadge = document.getElementById('combinedReportPostExpBadge');
        if (expiredCount > 0) {
            document.getElementById('combinedReportExpiredCount').textContent = expiredCount;
            expBadge.style.display = '';
        } else {
            expBadge.style.display = 'none';
        }
        if (postExpTotal > 0) {
            document.getElementById('combinedReportPostExpTotal').textContent = postExpTotal;
            postBadge.style.display = '';
        } else {
            postBadge.style.display = 'none';
        }

        // Renderizar tabla
        const tbody = document.getElementById('combinedReportList');
        tbody.innerHTML = reportData.map((d, i) => {
            // Celda de vencimiento
            let vencCell = '<span class="text-muted small">—</span>';
            if (d.membershipEnd) {
                if (d.expiredInPeriod) {
                    vencCell = `<span class="badge bg-danger" title="Venció dentro del período">${Utils.formatDate(d.membershipEnd)}</span>`;
                } else if (d.membershipEnd < dateFrom) {
                    vencCell = `<span class="badge bg-secondary" title="Ya estaba vencida al inicio del período">${Utils.formatDate(d.membershipEnd)}</span>`;
                } else {
                    vencCell = `<span class="badge bg-success" title="Membresía vigente">${Utils.formatDate(d.membershipEnd)}</span>`;
                }
            }

            // Celda de clases post-vencimiento
            let postCell = '<span class="text-muted small">—</span>';
            if (d.postExpiryAttendance > 0) {
                postCell = `<span class="badge bg-warning text-dark" title="Clases asistidas sin membresía vigente">${d.postExpiryAttendance}</span>`;
            } else if (d.membershipEnd) {
                postCell = '<span class="text-success small">✓</span>';
            }

            // Botón WhatsApp recordatorio membresía
            let waBtn = '';
            if (d.user.phone && d.membershipEnd) {
                const nombre = user.name.split(' ')[0];
                const clean = d.user.phone.replace(/\D/g, '');
                const msgWA = encodeURIComponent(
                    `Hola, *${nombre}* 😊\n\n` +
                    `Estamos realizando el cierre del mes y al revisar nuestro sistema notamos que tu membresía venció el *${Utils.formatDate(d.membershipEnd)}* y no hemos registrado tu pago.\n\n` +
                    `Si ya cancelaste, alleganos tu comprobante para actualizar tu estado en el sistema.\n\n` +
                    `Cualquier inquietud, con mucho gusto te atendemos. ¡Gracias por confiar en *Antología Box23* 🌟!`
                );
                const waUrl = `https://wa.me/57${clean}?text=${msgWA}`;
                waBtn = `<a href="${waUrl}" target="_blank" class="btn btn-success btn-sm py-0 px-1 ms-1" title="Enviar recordatorio WhatsApp" style="font-size:11px"><i class="fab fa-whatsapp"></i></a>`;
            }

            return `
            <tr class="${d.expiredInPeriod && d.postExpiryAttendance > 0 ? 'table-warning' : ''}">
                <td>${i + 1}</td>
                <td><strong>${Utils.escapeHtml(d.user.name)}</strong>${waBtn}</td>
                <td><span class="badge bg-${d.user.status === 'active' ? 'success' : 'secondary'}">${d.user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td class="text-center">${vencCell}</td>
                <td class="text-center"><span class="badge bg-info">${d.attendance}</span></td>
                <td class="text-center">${postCell}</td>
                <td class="text-center"><span class="badge bg-primary">${d.paymentsCount}</span></td>
                <td class="text-end"><strong>${Utils.formatCurrency(d.totalPaid)}</strong></td>
            </tr>`;
        }).join('');

        // Mostrar/ocultar secciones
        document.getElementById('combinedReportResult')?.classList.remove('d-none');
        document.getElementById('combinedReportEmpty')?.classList.add('d-none');

        // Guardar datos para exportación
        window._combinedReportData = { reportData, dateFrom, dateTo };
        UI.showSuccessToast('Informe generado');
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
                'Vencimiento Membresía': d.membershipEnd || '',
                'Venció en Período': d.expiredInPeriod ? 'Sí' : 'No',
                'Asistencias': d.attendance,
                'Clases Post-Vencimiento': d.postExpiryAttendance,
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
                { wch: 20 }, // Vencimiento Membresía
                { wch: 16 }, // Venció en Período
                { wch: 12 }, // Asistencias
                { wch: 20 }, // Clases Post-Vencimiento
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

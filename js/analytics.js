/**
 * Módulo de Análisis y Exportación Avanzada
 * Genera archivos Excel con múltiples hojas para análisis de datos
 */
const Analytics = (() => {

    function initialize() {
        setupEventListeners();
    }

    function setupEventListeners() {
        document.getElementById('exportAnalyticsBtn')?.addEventListener('click', exportCompleteAnalytics);
    }

    /**
     * Exporta todos los datos de la app a un archivo Excel multi-hoja
     * con datos formateados para análisis
     */
    async function exportCompleteAnalytics() {
        UI.showLoading('Preparando análisis de datos...');

        try {
            // Cargar SheetJS si no está disponible
            if (typeof XLSX === 'undefined') {
                await loadSheetJS();
            }

            const wb = XLSX.utils.book_new();
            const today = Utils.getCurrentDate();

            // 1. HOJA: Usuarios
            addUsersSheet(wb);

            // 2. HOJA: Asistencia
            addAttendanceSheet(wb);

            // 3. HOJA: Pagos/Ingresos
            addPaymentsSheet(wb);

            // 4. HOJA: Gastos
            addExpensesSheet(wb);

            // 5. HOJA: Clases Personal
            addStaffSheet(wb);

            // 6. HOJA: Resumen General
            addSummarySheet(wb);

            // Generar archivo
            const filename = `Antologia_Box23_Analisis_${today.replace(/-/g, '')}.xlsx`;
            XLSX.writeFile(wb, filename);

            UI.hideLoading();
            UI.showSuccessToast('✓ Archivo de análisis exportado: ' + filename);

        } catch (err) {
            console.error('Error al exportar análisis:', err);
            UI.hideLoading();
            UI.showErrorToast('Error al generar archivo de análisis');
        }
    }

    /**
     * Carga la librería SheetJS dinámicamente
     */
    function loadSheetJS() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('No se pudo cargar SheetJS'));
            document.head.appendChild(script);
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // HOJAS DEL LIBRO
    // ═══════════════════════════════════════════════════════════════════

    function addUsersSheet(wb) {
        const users = Storage.getUsers();
        
        const data = users.map(u => ({
            'ID': u.id,
            'Nombre': u.name,
            'Documento': u.document || '',
            'Teléfono': u.phone || '',
            'Tipo': u.affiliationType || '',
            'Estado': u.status === 'active' ? 'Activo' : 'Inactivo',
            'Fecha Nacimiento': u.birthdate || '',
            'Edad': u.birthdate ? calculateAge(u.birthdate) : '',
            'EPS': u.eps || '',
            'Patologías': u.pathology || '',
            'Contacto Emergencia': u.emergencyContact || '',
            'Tel. Emergencia': u.emergencyPhone || '',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        
        // Anchos de columna
        ws['!cols'] = [
            { wch: 25 }, // ID
            { wch: 30 }, // Nombre
            { wch: 15 }, // Documento
            { wch: 15 }, // Teléfono
            { wch: 15 }, // Tipo
            { wch: 10 }, // Estado
            { wch: 12 }, // Fecha Nac
            { wch: 6 },  // Edad
            { wch: 20 }, // EPS
            { wch: 30 }, // Patologías
            { wch: 25 }, // Contacto Emerg
            { wch: 15 }, // Tel Emerg
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    }

    function addAttendanceSheet(wb) {
        const attendance = Storage.getAttendance()
            .filter(a => a.status === 'presente') // Solo presentes
            .sort((a, b) => b.date.localeCompare(a.date));

        const data = attendance.map(a => {
            const user = Storage.getUserById(a.userId);
            return {
                'Fecha': a.date,
                'Usuario': user ? user.name : 'Desconocido',
                'ID Usuario': a.userId,
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 30 }, // Usuario
            { wch: 25 }, // ID Usuario
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    }

    function addPaymentsSheet(wb) {
        const payments = Storage.getIncome()
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

        const data = payments.map(p => {
            const user = Storage.getUserById(p.userId);
            return {
                'Fecha Pago': p.paymentDate,
                'Usuario': user ? user.name : 'Desconocido',
                'ID Usuario': p.userId,
                'Tipo Pago': p.paymentType || '',
                'Monto': parseFloat(p.amount) || 0,
                'Método': p.paymentMethod || '',
                'Inicio Vigencia': p.startDate || '',
                'Fin Vigencia': p.endDate || '',
                'Días Vigencia': p.startDate && p.endDate ? daysBetween(p.startDate, p.endDate) : '',
                'Observaciones': p.notes || '',
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, // Fecha Pago
            { wch: 30 }, // Usuario
            { wch: 25 }, // ID Usuario
            { wch: 20 }, // Tipo Pago
            { wch: 12 }, // Monto
            { wch: 15 }, // Método
            { wch: 12 }, // Inicio Vig
            { wch: 12 }, // Fin Vig
            { wch: 10 }, // Días Vig
            { wch: 40 }, // Observaciones
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
    }

    function addExpensesSheet(wb) {
        const expenses = Storage.getExpenses()
            .sort((a, b) => b.date.localeCompare(a.date));

        const data = expenses.map(e => ({
            'Fecha': e.date,
            'Descripción': e.description || '',
            'Monto': parseFloat(e.amount) || 0,
            'Categoría': e.category || '',
            'Cuenta': e.account || '',
            'Registrado': e.createdAt || '',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 40 }, // Descripción
            { wch: 12 }, // Monto
            { wch: 20 }, // Categoría
            { wch: 15 }, // Cuenta
            { wch: 18 }, // Registrado
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    }

    function addStaffSheet(wb) {
        const classes = Storage.getClasses()
            .sort((a, b) => b.date.localeCompare(a.date));

        const data = classes.map(c => {
            const trainer = Storage.getUserById(c.trainerId);
            return {
                'Fecha': c.date,
                'Hora': c.hour || '',
                'Entrenador': trainer ? trainer.name : 'Desconocido',
                'ID Entrenador': c.trainerId,
                'Tipo Clase': c.classType || '',
                'Duración (h)': parseFloat(c.duration) || 0,
                'Registrado': c.createdAt || '',
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, // Fecha
            { wch: 10 }, // Hora
            { wch: 30 }, // Entrenador
            { wch: 25 }, // ID Entrenador
            { wch: 20 }, // Tipo Clase
            { wch: 12 }, // Duración
            { wch: 18 }, // Registrado
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Clases Personal');
    }

    function addSummarySheet(wb) {
        const users = Storage.getUsers();
        const activeUsers = users.filter(u => u.status === 'active' && u.affiliationType !== 'Entrenador(a)');
        const trainers = users.filter(u => u.affiliationType === 'Entrenador(a)');
        
        const today = Utils.getCurrentDate();
        const { start: monthStart, end: monthEnd } = Utils.getMonthRange(Utils.getCurrentMonth());
        
        const monthPayments = Storage.getIncomeByDateRange(monthStart, monthEnd);
        const monthExpenses = Storage.getExpenses().filter(e => e.date >= monthStart && e.date <= monthEnd);
        
        const totalIncome = monthPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const totalExpenses = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        
        const todayAttendance = Storage.getAttendanceByDate(today).filter(a => a.status === 'presente');

        const summaryData = [
            { 'Métrica': 'USUARIOS' },
            { 'Métrica': 'Usuarios Activos', 'Valor': activeUsers.length },
            { 'Métrica': 'Entrenadores', 'Valor': trainers.length },
            { 'Métrica': 'Total Usuarios', 'Valor': users.length },
            { 'Métrica': '' },
            { 'Métrica': 'FINANCIERO (MES ACTUAL)' },
            { 'Métrica': 'Total Ingresos', 'Valor': totalIncome },
            { 'Métrica': 'Total Gastos', 'Valor': totalExpenses },
            { 'Métrica': 'Balance', 'Valor': totalIncome - totalExpenses },
            { 'Métrica': '' },
            { 'Métrica': 'ASISTENCIA' },
            { 'Métrica': 'Presentes Hoy', 'Valor': todayAttendance.length },
            { 'Métrica': 'Tasa Asistencia Hoy', 'Valor': activeUsers.length > 0 ? ((todayAttendance.length / activeUsers.length) * 100).toFixed(1) + '%' : '0%' },
            { 'Métrica': '' },
            { 'Métrica': 'REPORTE GENERADO' },
            { 'Métrica': 'Fecha', 'Valor': today },
            { 'Métrica': 'Hora', 'Valor': new Date().toLocaleTimeString('es-ES') },
        ];

        const ws = XLSX.utils.json_to_sheet(summaryData);
        ws['!cols'] = [
            { wch: 30 }, // Métrica
            { wch: 20 }, // Valor
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Resumen General');
    }

    // ═══════════════════════════════════════════════════════════════════
    // UTILIDADES
    // ═══════════════════════════════════════════════════════════════════

    function calculateAge(birthdate) {
        if (!birthdate) return '';
        const bd = Utils.normalizeDate(birthdate);
        if (!bd) return '';
        const birth = new Date(bd);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    function daysBetween(start, end) {
        const d1 = new Date(start + 'T00:00:00');
        const d2 = new Date(end + 'T00:00:00');
        return Math.round((d2 - d1) / 86400000) + 1;
    }

    return {
        initialize,
        exportCompleteAnalytics
    };
})();

window.Analytics = Analytics;

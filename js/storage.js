/**
 * Storage v3.0 — Google Sheets como base de datos
 *
 * Arquitectura:
 *   App (Vercel) ──fetch──► Google Apps Script (Web App) ──► Google Sheets
 *
 * ⚠️  ÚNICO PASO DE CONFIGURACIÓN:
 *     Reemplaza SCRIPT_URL con la URL de tu Google Apps Script desplegado.
 *     Ver instrucciones en: CONFIGURACION_GOOGLE_SHEETS.md
 */

const Storage = (() => {

    // ─── CONFIGURACIÓN ───────────────────────────────────────────────────────
    // Pega aquí la URL de tu Apps Script después de desplegarlo:
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9YubFTKIAFUXsQYoOh691HUytL7QwYZ9ZQL-WG0k2nab0w-_FzCCcX6Lm0SMC0TZA/exec';
    // ─────────────────────────────────────────────────────────────────────────

    const DEFAULT_SETTINGS = {
        theme: 'dark', itemsPerPage: 25, notifications: true, language: 'es'
    };

    // Cache en memoria — evita peticiones repetidas en la misma sesión
    const cache = {
        users:      null,
        attendance: null,
        income:     null,
        expenses:   null,
        classes:    null,
        settings:   null,
        dirty:      { users: false, attendance: false, income: false }
    };

    // Settings siempre en localStorage (son preferencias del navegador, no datos)
    const LS_SETTINGS = 'antologia_settings';
    const LS_LAST_BACKUP = 'antologia_last_backup';

    // ─── HELPERS HTTP ────────────────────────────────────────────────────────

    async function apiCall(action, payload = {}) {
        if (!SCRIPT_URL || SCRIPT_URL === 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT') {
            throw new Error('⚙️ Configura SCRIPT_URL en storage.js primero.');
        }

        // Usamos GET con el payload en base64 para evitar CORS preflight.
        // Apps Script siempre permite GET desde cualquier origen.
        const data   = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
        const url    = `${SCRIPT_URL}?action=${action}&payload=${data}`;

        const res = await fetch(url, {
            method:   'GET',
            redirect: 'follow'   // Apps Script redirige la respuesta — seguimos la redirección
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Apps Script a veces devuelve text/html envolviendo el JSON
        const text = await res.text();
        let json;
        try {
            // Extraer el primer objeto JSON válido del texto
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Sin respuesta JSON');
            json = JSON.parse(match[0]);
        } catch (e) {
            throw new Error('Respuesta inválida del servidor: ' + text.substring(0, 100));
        }

        if (json.error) throw new Error(json.error);
        return json.data;
    }

    // ─── INICIALIZACIÓN ──────────────────────────────────────────────────────

    async function initialize() {
        // Settings siempre desde localStorage
        if (!localStorage.getItem(LS_SETTINGS)) {
            localStorage.setItem(LS_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        }
        // Cargar datos desde Sheets en paralelo
        await loadAllData();
    }

    async function loadAllData() {
        try {
            const [users, attendance, income, expenses, classes] = await Promise.all([
                apiCall('getUsers'),
                apiCall('getAttendance'),
                apiCall('getIncome'),
                apiCall('getExpenses'),
                apiCall('getClasses')
            ]);
            cache.users      = users      || [];
            cache.attendance = attendance || [];
            cache.income     = income     || [];
            cache.expenses   = expenses   || [];
            cache.classes    = classes    || [];
        } catch (err) {
            console.error('Error cargando datos desde Sheets:', err.message);
            cache.users      = cache.users      || [];
            cache.attendance = cache.attendance || [];
            cache.income     = cache.income     || [];
            cache.expenses   = cache.expenses   || [];
            cache.classes    = cache.classes    || [];
            throw err;
        }
    }

    // ─── USUARIOS ────────────────────────────────────────────────────────────

    function getUsers() {
        return cache.users || [];
    }

    async function addUser(user) {
        const newUser = {
            id:        Utils.generateUUID(),
            ...user,
            createdAt: Utils.getCurrentDateTime(),
            updatedAt: Utils.getCurrentDateTime()
        };
        const saved = await apiCall('addRow', { sheet: 'Usuarios', row: newUser });
        cache.users.push(saved || newUser);
        return saved || newUser;
    }

    async function updateUser(id, updates) {
        const idx = cache.users.findIndex(u => u.id === id);
        if (idx === -1) return null;
        const updated = { ...cache.users[idx], ...updates, updatedAt: Utils.getCurrentDateTime() };
        await apiCall('updateRow', { sheet: 'Usuarios', id, data: updated });
        cache.users[idx] = updated;
        return updated;
    }

    async function deleteUser(id) {
        await apiCall('deleteRow', { sheet: 'Usuarios', id });
        cache.users      = cache.users.filter(u => u.id !== id);
        cache.attendance = cache.attendance.filter(a => a.userId !== id);
        cache.income     = cache.income.filter(i => i.userId !== id);
        // Borrar también en Sheets
        await Promise.all([
            apiCall('deleteByField', { sheet: 'Asistencia', field: 'userId', value: id }),
            apiCall('deleteByField', { sheet: 'Ingresos',   field: 'userId', value: id })
        ]);
        return true;
    }

    function getUserById(id) {
        return (cache.users || []).find(u => u.id === id) || null;
    }

    // ─── ASISTENCIA ──────────────────────────────────────────────────────────

    function getAttendance() {
        return cache.attendance || [];
    }

    async function addAttendance(record) {
        const newRecord = {
            id:        Utils.generateUUID(),
            ...record,
            createdAt: Utils.getCurrentDateTime()
        };
        await apiCall('addRow', { sheet: 'Asistencia', row: newRecord });
        cache.attendance.push(newRecord);
        return newRecord;
    }

    async function updateAttendance(id, updates) {
        const idx = cache.attendance.findIndex(a => a.id === id);
        if (idx === -1) return null;
        const updated = { ...cache.attendance[idx], ...updates };
        await apiCall('updateRow', { sheet: 'Asistencia', id, data: updated });
        cache.attendance[idx] = updated;
        return updated;
    }

    async function deleteAttendance(id) {
        await apiCall('deleteRow', { sheet: 'Asistencia', id });
        cache.attendance = cache.attendance.filter(a => a.id !== id);
        return true;
    }

    function getAttendanceByDate(date) {
        return (cache.attendance || []).filter(a => a.date === date);
    }

    function getAttendanceByUser(userId) {
        return (cache.attendance || []).filter(a => a.userId === userId);
    }

    // ─── INGRESOS ────────────────────────────────────────────────────────────

    function getIncome() {
        return cache.income || [];
    }

    async function addIncome(payment) {
        const newPayment = {
            id:        Utils.generateUUID(),
            ...payment,
            createdAt: Utils.getCurrentDateTime()
        };
        await apiCall('addRow', { sheet: 'Ingresos', row: newPayment });
        cache.income.push(newPayment);
        return newPayment;
    }

    async function updateIncome(id, updates) {
        const idx = cache.income.findIndex(i => i.id === id);
        if (idx === -1) return null;
        const updated = { ...cache.income[idx], ...updates };
        await apiCall('updateRow', { sheet: 'Ingresos', id, data: updated });
        cache.income[idx] = updated;
        return updated;
    }

    async function deleteIncome(id) {
        await apiCall('deleteRow', { sheet: 'Ingresos', id });
        cache.income = cache.income.filter(i => i.id !== id);
        return true;
    }

    function getIncomeByDateRange(start, end) {
        return (cache.income || []).filter(i => i.paymentDate >= start && i.paymentDate <= end);
    }

    // ─── GASTOS ─────────────────────────────────────────────────────────────

    function getExpenses() { return cache.expenses || []; }

    async function addExpense(expense) {
        const newExpense = { id: Utils.generateUUID(), ...expense, createdAt: Utils.getCurrentDateTime() };
        await apiCall('addRow', { sheet: 'Gastos', row: newExpense });
        cache.expenses.push(newExpense);
        return newExpense;
    }

    async function deleteExpense(id) {
        await apiCall('deleteRow', { sheet: 'Gastos', id });
        cache.expenses = cache.expenses.filter(e => e.id !== id);
        return true;
    }

    // ─── CLASES (personal) ───────────────────────────────────────────────────

    function getClasses() { return cache.classes || []; }

    async function addClass(classData) {
        const newClass = { id: Utils.generateUUID(), ...classData, createdAt: Utils.getCurrentDateTime() };
        await apiCall('addRow', { sheet: 'Clases', row: newClass });
        cache.classes.push(newClass);
        return newClass;
    }

    async function deleteClass(id) {
        await apiCall('deleteRow', { sheet: 'Clases', id });
        cache.classes = cache.classes.filter(c => c.id !== id);
        return true;
    }

    // ─── CONFIGURACIÓN (localStorage — son preferencias del navegador) ───────

    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(LS_SETTINGS)) || DEFAULT_SETTINGS;
        } catch { return DEFAULT_SETTINGS; }
    }

    function updateSettings(updates) {
        const current = getSettings();
        localStorage.setItem(LS_SETTINGS, JSON.stringify({ ...current, ...updates }));
        return true;
    }

    function getSetting(key) {
        return getSettings()[key];
    }

    // ─── BACKUP ──────────────────────────────────────────────────────────────

    function exportData() {
        try {
            const data = {
                version:    '3.0',
                exportDate: Utils.getCurrentDateTime(),
                users:      getUsers(),
                attendance: getAttendance(),
                income:     getIncome(),
                settings:   getSettings()
            };
            Utils.downloadFile(JSON.stringify(data, null, 2),
                `antologia_backup_${Utils.getCurrentDate()}.json`, 'application/json');
            localStorage.setItem(LS_LAST_BACKUP, Utils.getCurrentDateTime());
            return true;
        } catch (err) {
            console.error('Error al exportar:', err);
            return false;
        }
    }

    async function importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (!Array.isArray(data.users) || !Array.isArray(data.attendance) || !Array.isArray(data.income)) {
                throw new Error('Formato de backup inválido');
            }
            // Enviar todo a Sheets de una vez
            await apiCall('importAll', {
                users:      data.users,
                attendance: data.attendance,
                income:     data.income
            });
            // Actualizar cache
            cache.users      = data.users;
            cache.attendance = data.attendance;
            cache.income     = data.income;
            if (data.settings) updateSettings(data.settings);
            return true;
        } catch (err) {
            console.error('Error al importar:', err);
            return false;
        }
    }

    function getLastBackupDate() {
        return localStorage.getItem(LS_LAST_BACKUP);
    }

    // ─── UTILIDADES ──────────────────────────────────────────────────────────

    async function clear() {
        await apiCall('clearAll');
        cache.users = []; cache.attendance = []; cache.income = [];
        return true;
    }

    function getStorageUsage() {
        return {
            users:      getUsers().length,
            attendance: getAttendance().length,
            income:     getIncome().length,
            source:     'Google Sheets'
        };
    }

    // Exponer cache para depuración
    function getCache() { return cache; }

    return {
        initialize, loadAllData,
        // Usuarios
        getUsers, addUser, updateUser, deleteUser, getUserById,
        // Asistencia
        getAttendance, addAttendance, updateAttendance, deleteAttendance,
        getAttendanceByDate, getAttendanceByUser,
        // Ingresos
        getIncome, addIncome, updateIncome, deleteIncome, getIncomeByDateRange,
        // Configuración
        getSettings, updateSettings, getSetting,
        // Backup
        exportData, importData, getLastBackupDate,
        // Gastos
        getExpenses, addExpense, deleteExpense,
        // Clases personal
        getClasses, addClass, deleteClass,
        // Utilidades
        clear, getStorageUsage, getCache
    };
})();

window.Storage = Storage;

/**
 * Módulo de Almacenamiento
 * Gestión centralizada de datos en localStorage con validación y respaldo
 */

const Storage = (() => {
    const STORAGE_KEYS = {
        USERS: 'antologia_users',
        ATTENDANCE: 'antologia_attendance',
        INCOME: 'antologia_income',
        SETTINGS: 'antologia_settings',
        BACKUP_DATE: 'antologia_last_backup'
    };

    const DEFAULT_SETTINGS = {
        theme: 'dark',
        itemsPerPage: 25,
        notifications: true,
        autoBackup: false,
        language: 'es'
    };

    // Inicializar storage si no existe
    function initialize() {
        try {
            if (!get(STORAGE_KEYS.USERS)) {
                set(STORAGE_KEYS.USERS, []);
            }
            if (!get(STORAGE_KEYS.ATTENDANCE)) {
                set(STORAGE_KEYS.ATTENDANCE, []);
            }
            if (!get(STORAGE_KEYS.INCOME)) {
                set(STORAGE_KEYS.INCOME, []);
            }
            if (!get(STORAGE_KEYS.SETTINGS)) {
                set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
            }
            return true;
        } catch (error) {
            console.error('Error al inicializar storage:', error);
            return false;
        }
    }

    // Guardar datos en localStorage
    function set(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            localStorage.setItem(key, jsonString);
            return true;
        } catch (error) {
            console.error(`Error al guardar ${key}:`, error);
            if (error.name === 'QuotaExceededError') {
                UI.showToast('Almacenamiento lleno. Por favor, exporta un respaldo y limpia datos antiguos.', 'error');
            }
            return false;
        }
    }

    // Obtener datos de localStorage
    function get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error al leer ${key}:`, error);
            return null;
        }
    }

    // Eliminar clave específica
    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error al eliminar ${key}:`, error);
            return false;
        }
    }

    // Limpiar todo el storage
    function clear() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Error al limpiar storage:', error);
            return false;
        }
    }

    // ===== USUARIOS =====

    function getUsers() {
        return get(STORAGE_KEYS.USERS) || [];
    }

    function setUsers(users) {
        return set(STORAGE_KEYS.USERS, users);
    }

    function addUser(user) {
        const users = getUsers();
        const newUser = {
            id: Utils.generateUUID(),
            ...user,
            createdAt: Utils.getCurrentDateTime(),
            updatedAt: Utils.getCurrentDateTime()
        };
        users.push(newUser);
        setUsers(users);
        return newUser;
    }

    function updateUser(id, updates) {
        const users = getUsers();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) return null;
        
        users[index] = {
            ...users[index],
            ...updates,
            updatedAt: Utils.getCurrentDateTime()
        };
        setUsers(users);
        return users[index];
    }

    function deleteUser(id) {
        const users = getUsers();
        const filtered = users.filter(u => u.id !== id);
        if (filtered.length === users.length) return false;
        
        setUsers(filtered);
        
        // Eliminar datos relacionados
        deleteUserAttendance(id);
        deleteUserIncome(id);
        
        return true;
    }

    function getUserById(id) {
        const users = getUsers();
        return users.find(u => u.id === id) || null;
    }

    // ===== ASISTENCIA =====

    function getAttendance() {
        return get(STORAGE_KEYS.ATTENDANCE) || [];
    }

    function setAttendance(attendance) {
        return set(STORAGE_KEYS.ATTENDANCE, attendance);
    }

    function addAttendance(record) {
        const attendance = getAttendance();
        const newRecord = {
            id: Utils.generateUUID(),
            ...record,
            createdAt: Utils.getCurrentDateTime()
        };
        attendance.push(newRecord);
        setAttendance(attendance);
        return newRecord;
    }

    function updateAttendance(id, updates) {
        const attendance = getAttendance();
        const index = attendance.findIndex(a => a.id === id);
        if (index === -1) return null;
        
        attendance[index] = {
            ...attendance[index],
            ...updates,
            updatedAt: Utils.getCurrentDateTime()
        };
        setAttendance(attendance);
        return attendance[index];
    }

    function deleteAttendance(id) {
        const attendance = getAttendance();
        const filtered = attendance.filter(a => a.id !== id);
        if (filtered.length === attendance.length) return false;
        
        setAttendance(filtered);
        return true;
    }

    function deleteUserAttendance(userId) {
        const attendance = getAttendance();
        const filtered = attendance.filter(a => a.userId !== userId);
        setAttendance(filtered);
    }

    function getAttendanceByDate(date) {
        const attendance = getAttendance();
        return attendance.filter(a => a.date === date);
    }

    function getAttendanceByUser(userId) {
        const attendance = getAttendance();
        return attendance.filter(a => a.userId === userId);
    }

    // ===== INGRESOS =====

    function getIncome() {
        return get(STORAGE_KEYS.INCOME) || [];
    }

    function setIncome(income) {
        return set(STORAGE_KEYS.INCOME, income);
    }

    function addIncome(payment) {
        const income = getIncome();
        const newPayment = {
            id: Utils.generateUUID(),
            ...payment,
            createdAt: Utils.getCurrentDateTime()
        };
        income.push(newPayment);
        setIncome(income);
        return newPayment;
    }

    function updateIncome(id, updates) {
        const income = getIncome();
        const index = income.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        income[index] = {
            ...income[index],
            ...updates,
            updatedAt: Utils.getCurrentDateTime()
        };
        setIncome(income);
        return income[index];
    }

    function deleteIncome(id) {
        const income = getIncome();
        const filtered = income.filter(i => i.id !== id);
        if (filtered.length === income.length) return false;
        
        setIncome(filtered);
        return true;
    }

    function deleteUserIncome(userId) {
        const income = getIncome();
        const filtered = income.filter(i => i.userId !== userId);
        setIncome(filtered);
    }

    function getIncomeByDateRange(startDate, endDate) {
        const income = getIncome();
        return income.filter(i => 
            i.paymentDate >= startDate && i.paymentDate <= endDate
        );
    }

    // ===== CONFIGURACIÓN =====

    function getSettings() {
        return get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;
    }

    function updateSettings(updates) {
        const settings = getSettings();
        const newSettings = { ...settings, ...updates };
        return set(STORAGE_KEYS.SETTINGS, newSettings);
    }

    function getSetting(key) {
        const settings = getSettings();
        return settings[key];
    }

    // ===== BACKUP Y RESTAURACIÓN =====

    function exportData() {
        try {
            const data = {
                version: '2.0',
                exportDate: Utils.getCurrentDateTime(),
                users: getUsers(),
                attendance: getAttendance(),
                income: getIncome(),
                settings: getSettings()
            };
            
            const jsonString = JSON.stringify(data, null, 2);
            const filename = `antologia_backup_${Utils.getCurrentDate()}.json`;
            
            Utils.downloadFile(jsonString, filename, 'application/json');
            
            // Actualizar fecha de último backup
            set(STORAGE_KEYS.BACKUP_DATE, Utils.getCurrentDateTime());
            
            return true;
        } catch (error) {
            console.error('Error al exportar datos:', error);
            return false;
        }
    }

    function importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validar estructura de datos
            if (!data.users || !data.attendance || !data.income) {
                throw new Error('Formato de datos inválido');
            }
            
            // Validar que los datos son arrays
            if (!Array.isArray(data.users) || 
                !Array.isArray(data.attendance) || 
                !Array.isArray(data.income)) {
                throw new Error('Los datos deben ser arrays');
            }
            
            // Importar datos
            setUsers(data.users);
            setAttendance(data.attendance);
            setIncome(data.income);
            
            if (data.settings) {
                updateSettings(data.settings);
            }
            
            return true;
        } catch (error) {
            console.error('Error al importar datos:', error);
            return false;
        }
    }

    function getLastBackupDate() {
        return get(STORAGE_KEYS.BACKUP_DATE);
    }

    // ===== ESTADÍSTICAS =====

    function getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return (total / 1024).toFixed(2); // KB
    }

    function getStorageUsage() {
        return {
            users: getUsers().length,
            attendance: getAttendance().length,
            income: getIncome().length,
            totalSize: getStorageSize() + ' KB'
        };
    }

    // Inicializar al cargar
    initialize();

    // API Pública
    return {
        // Inicialización
        initialize,
        
        // Usuarios
        getUsers,
        setUsers,
        addUser,
        updateUser,
        deleteUser,
        getUserById,
        
        // Asistencia
        getAttendance,
        setAttendance,
        addAttendance,
        updateAttendance,
        deleteAttendance,
        getAttendanceByDate,
        getAttendanceByUser,
        
        // Ingresos
        getIncome,
        setIncome,
        addIncome,
        updateIncome,
        deleteIncome,
        getIncomeByDateRange,
        
        // Configuración
        getSettings,
        updateSettings,
        getSetting,
        
        // Backup
        exportData,
        importData,
        getLastBackupDate,
        
        // Utilidades
        clear,
        getStorageUsage,
        getStorageSize
    };
})();

// Exponer globalmente
window.Storage = Storage;

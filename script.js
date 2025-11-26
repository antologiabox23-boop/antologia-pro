/**
 * Antología Box23 - Sistema de Gestión
 * Lógica principal de la aplicación + Conexión a Neon DB (Vercel API)
 * Versión: 3.0 (Cloud Connected)
 * Autor: [Carlos Alberto Africano Granados]
  */

'use strict';

// ==========================================
// 1. CONFIGURACIÓN Y ESTADO GLOBAL
// ==========================================
const AppState = {
    users: [],
    attendance: [],
    income: [],
    backupConfig: {
        autoBackupInterval: 15 * 60 * 1000, // 15 minutos
        lastBackup: null
    },
    dbKeys: {
        USERS: 'antologia_users',
        ATTENDANCE: 'antologia_attendance',
        INCOME: 'antologia_income'
    }
};

// ==========================================
// 2. MÓDULO DE NUBE (Neon DB Service)
// ==========================================
const CloudService = {
    // Si estamos en local (file://) no intenta conectar a la API, solo si estamos en web
    isOnline: () => window.location.protocol.startsWith('http'),

    saveUser: async (user) => {
        if (!CloudService.isOnline()) return;
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            CloudService.updateStatus('Guardado en nube', 'success');
        } catch (e) { console.error("Error nube:", e); }
    },

    saveAttendance: async (attendanceItem) => {
        if (!CloudService.isOnline()) return;
        try {
            await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attendanceItem)
            });
        } catch (e) { console.error("Error nube:", e); }
    },

    saveIncome: async (incomeItem) => {
        if (!CloudService.isOnline()) return;
        try {
            await fetch('/api/income', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(incomeItem)
            });
        } catch (e) { console.error("Error nube:", e); }
    },

    loadAllFromCloud: async () => {
        if (!CloudService.isOnline()) {
            console.log("Modo offline: Cargando solo de LocalStorage");
            return false;
        }
        
        CloudService.updateStatus('Sincronizando...', 'info');
        
        try {
            // Cargar Usuarios
            const resUsers = await fetch('/api/users');
            if (resUsers.ok) {
                const usersDB = await resUsers.json();
                // Mapear nombres de DB (snake_case) a JS (camelCase) si es necesario
                // Por ahora asumimos que la DB devuelve estructura similar o ajustamos aqui
                if(usersDB.length > 0) AppState.users = CloudService.mapUsersFromDB(usersDB);
            }

            // Cargar Asistencias
            const resAtt = await fetch('/api/attendance');
            if (resAtt.ok) {
                const attDB = await resAtt.json();
                if(attDB.length > 0) AppState.attendance = CloudService.mapAttendanceFromDB(attDB);
            }

            // Cargar Pagos
            const resInc = await fetch('/api/income');
            if (resInc.ok) {
                const incDB = await resInc.json();
                if(incDB.length > 0) AppState.income = CloudService.mapIncomeFromDB(incDB);
            }

            CloudService.updateStatus('Conectado a Neon PostgreSQL', 'success');
            document.getElementById('lastCloudSync').textContent = new Date().toLocaleTimeString();
            return true;
        } catch (error) {
            console.error("Error cargando de nube:", error);
            CloudService.updateStatus('Error de conexión', 'error');
            return false;
        }
    },

    updateStatus: (text, type) => {
        const statusText = document.getElementById('cloudStatusText');
        const icon = document.getElementById('cloudStatusIcon');
        if(!statusText) return;

        statusText.textContent = text;
        if(type === 'success') { statusText.className = 'text-success'; icon.textContent = '🟢'; }
        if(type === 'info') { statusText.className = 'text-primary'; icon.textContent = '🔵'; }
        if(type === 'error') { statusText.className = 'text-danger'; icon.textContent = '🔴'; }
    },

    // Mappers para convertir de formato SQL (snake_case) a App (camelCase)
    mapUsersFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id, name: r.name, document: r.document, phone: r.phone,
            birthdate: r.birthdate, eps: r.eps, rh: r.rh,
            emergencyContact: r.emergency_contact, emergencyPhone: r.emergency_phone,
            classTime: r.class_time, affiliationType: r.affiliation_type, status: r.status
        }));
    },
    mapAttendanceFromDB: (rows) => {
        return rows.map(r => ({ id: r.id, userId: r.user_id, date: r.date, timestamp: r.timestamp }));
    },
    mapIncomeFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id, userId: r.user_id, startDate: r.start_date, endDate: r.end_date,
            amount: parseFloat(r.amount), method: r.method, description: r.description, date: r.date
        }));
    }
};

// ==========================================
// 3. MÓDULO DE UTILIDADES (Helpers)
// ==========================================
const Utils = {
    generateId: () => '_' + Math.random().toString(36).substr(2, 9),
    
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
    },

    formatDate: (dateString) => {
        if (!dateString) return '';
        // Ajuste para zona horaria local para evitar que la fecha retroceda un día
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return adjustedDate.toLocaleDateString('es-ES', options);
    },

    showAlert: (message, type = 'success') => { alert(message); },

    saveToLocal: () => {
        // Guardar en LocalStorage (Respaldo inmediato navegador)
        localStorage.setItem(AppState.dbKeys.USERS, JSON.stringify(AppState.users));
        localStorage.setItem(AppState.dbKeys.ATTENDANCE, JSON.stringify(AppState.attendance));
        localStorage.setItem(AppState.dbKeys.INCOME, JSON.stringify(AppState.income));
        AppState.backupConfig.lastBackup = new Date();
        Utils.updateDashboardStats();
    },

    loadFromLocal: () => {
        const users = localStorage.getItem(AppState.dbKeys.USERS);
        const attendance = localStorage.getItem(AppState.dbKeys.ATTENDANCE);
        const income = localStorage.getItem(AppState.dbKeys.INCOME);

        if (users) AppState.users = JSON.parse(users);
        if (attendance) AppState.attendance = JSON.parse(attendance);
        if (income) AppState.income = JSON.parse(income);
    }
};

// ==========================================
// 4. MÓDULO DE USUARIOS
// ==========================================
const UserManager = {
    init: () => {
        document.getElementById('userForm').addEventListener('submit', UserManager.handleAddUser);
        document.getElementById('searchUserInput').addEventListener('input', UserManager.renderUsers);
        UserManager.renderUsers();
    },

    handleAddUser: async (e) => {
        e.preventDefault();
        
        const newUser = {
            id: Utils.generateId(),
            name: document.getElementById('name').value,
            document: document.getElementById('document').value,
            phone: document.getElementById('phone').value,
            birthdate: document.getElementById('birthdate').value,
            eps: document.getElementById('eps').value,
            rh: document.getElementById('rh').value,
            emergencyContact: document.getElementById('emergencyContact').value,
            emergencyPhone: document.getElementById('emergencyPhone').value,
            classTime: document.getElementById('classTime').value,
            affiliationType: document.getElementById('affiliationType').value,
            status: document.getElementById('status').value,
            createdAt: new Date().toISOString()
        };

        const exists = AppState.users.some(u => u.document === newUser.document);
        if (exists) {
            Utils.showAlert('Ya existe un usuario con este documento', 'error');
            return;
        }

        AppState.users.push(newUser);
        Utils.saveToLocal();
        
        // Enviar a Neon
        await CloudService.saveUser(newUser);

        UserManager.renderUsers();
        document.getElementById('userForm').reset();
        Utils.showAlert('Usuario registrado correctamente');
    },

    renderUsers: () => {
        const tbody = document.getElementById('usersList');
        const searchTerm = document.getElementById('searchUserInput')?.value.toLowerCase() || '';
        tbody.innerHTML = '';

        const filteredUsers = AppState.users.filter(user => 
            (user.name && user.name.toLowerCase().includes(searchTerm)) || 
            (user.document && user.document.includes(searchTerm))
        );

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id.substr(0, 6)}</td>
                <td>${user.name}</td>
                <td>${user.document}</td>
                <td>${user.phone}</td>
                <td><span class="badge bg-info">${user.classTime}</span></td>
                <td><span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-secondary'}">${user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="WhatsAppManager.openModal('${user.phone}')"><i class="fab fa-whatsapp"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

// ==========================================
// 5. MÓDULO DE ASISTENCIA
// ==========================================
const AttendanceManager = {
    init: () => {
        document.getElementById('attendanceDate').valueAsDate = new Date();
        document.getElementById('refreshAttendance').addEventListener('click', AttendanceManager.renderList);
        document.getElementById('saveAttendance').addEventListener('click', AttendanceManager.saveDay);
        AttendanceManager.renderList();
    },

    renderList: () => {
        const listContainer = document.getElementById('attendanceUsersList');
        listContainer.innerHTML = '';
        const activeUsers = AppState.users.filter(u => u.status === 'active');
        
        activeUsers.forEach(user => {
            const div = document.createElement('div');
            div.className = 'attendance-user-item';
            div.innerHTML = `
                <div class="attendance-check-container">
                    <input type="checkbox" class="form-check-input attendance-checkbox" data-user-id="${user.id}">
                </div>
                <div class="attendance-user-info">
                    <div class="attendance-user-name">${user.name}</div>
                    <div class="attendance-user-details">${user.classTime} - ${user.affiliationType}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
        document.getElementById('totalUsersCount').textContent = activeUsers.length;
    },

    saveDay: async () => {
        const date = document.getElementById('attendanceDate').value;
        const checkboxes = document.querySelectorAll('.attendance-checkbox:checked');
        
        let count = 0;
        for (const chk of checkboxes) {
            const userId = chk.getAttribute('data-user-id');
            const newAtt = {
                id: Utils.generateId(),
                userId: userId,
                date: date,
                timestamp: new Date().toISOString()
            };
            
            AppState.attendance.push(newAtt);
            // Enviar a Neon uno por uno (o podrías modificar la API para recibir arrays)
            CloudService.saveAttendance(newAtt);
            count++;
        }

        Utils.saveToLocal();
        Utils.showAlert(`Registradas ${count} asistencias`);
        document.querySelectorAll('.attendance-checkbox').forEach(c => c.checked = false);
        Utils.updateDashboardStats();
    }
};

// ==========================================
// 6. MÓDULO DE PAGOS
// ==========================================
const IncomeManager = {
    init: () => {
        IncomeManager.populateUserSelect();
        document.getElementById('incomeForm').addEventListener('submit', IncomeManager.handlePayment);
        IncomeManager.renderHistory(); // Render inicial
    },

    populateUserSelect: () => {
        const select = document.getElementById('incomeUserSelect');
        select.innerHTML = '<option value="">Seleccionar usuario</option>';
        AppState.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name}`;
            select.appendChild(option);
        });
    },

    handlePayment: async (e) => {
        e.preventDefault();
        const payment = {
            id: Utils.generateId(),
            userId: document.getElementById('incomeUserSelect').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            amount: parseFloat(document.getElementById('amount').value),
            method: document.getElementById('paymentMethod').value,
            description: document.getElementById('description').value,
            date: new Date().toISOString()
        };

        AppState.income.push(payment);
        Utils.saveToLocal();
        
        // Enviar a Neon
        await CloudService.saveIncome(payment);

        Utils.showAlert('Pago registrado');
        document.getElementById('incomeForm').reset();
        IncomeManager.renderHistory();
    },
    
    renderHistory: () => {
        const tbody = document.getElementById('incomeList');
        tbody.innerHTML = '';
        // Mostrar últimos 10 pagos
        const recentIncome = AppState.income.slice().reverse().slice(0, 10);
        
        let total = 0;
        recentIncome.forEach(inc => {
            const user = AppState.users.find(u => u.id === inc.userId);
            const userName = user ? user.name : 'Desconocido';
            total += inc.amount;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.formatDate(inc.date)}</td>
                <td>${userName}</td>
                <td>${Utils.formatCurrency(inc.amount)}</td>
                <td>${inc.method}</td>
                <td>${Utils.formatDate(inc.endDate)}</td>
                <td>${inc.description}</td>
                <td></td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('incomeTotal').textContent = Utils.formatCurrency(total);
    }
};
// ==========================================
// 6.5. MÓDULO DE RESPALDO (EXCEL)
// ==========================================
const BackupManager = {
    init: () => {
        const fileInput = document.getElementById('restoreFile');
        const restoreBtn = document.getElementById('restoreData');
        const backupBtn = document.getElementById('backupData');

        // Activar botón cuando se selecciona archivo
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    document.getElementById('selectedFileName').textContent = e.target.files[0].name;
                    restoreBtn.disabled = false;
                }
            });
        }

        if (restoreBtn) restoreBtn.addEventListener('click', BackupManager.restoreFromExcel);
        if (backupBtn) backupBtn.addEventListener('click', BackupManager.exportToExcel);
    },

    exportToExcel: () => {
        const wb = XLSX.utils.book_new();
        
        // Crear hojas
        const wsUsers = XLSX.utils.json_to_sheet(AppState.users);
        const wsAttendance = XLSX.utils.json_to_sheet(AppState.attendance);
        const wsIncome = XLSX.utils.json_to_sheet(AppState.income);

        XLSX.utils.book_append_sheet(wb, wsUsers, "Usuarios");
        XLSX.utils.book_append_sheet(wb, wsAttendance, "Asistencias");
        XLSX.utils.book_append_sheet(wb, wsIncome, "Pagos");

        // Descargar
        const dateStr = new Date().toISOString().slice(0,10);
        XLSX.writeFile(wb, `Respaldo_Antologia_${dateStr}.xlsx`);
    },

    restoreFromExcel: () => {
        const fileInput = document.getElementById('restoreFile');
        const file = fileInput.files[0];
        const replaceData = document.getElementById('replaceData').checked;

        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Función auxiliar para normalizar claves (convierte "Nombre" o "NAME" -> "name")
                const normalizeData = (items) => {
                    return items.map(item => {
                        const newItem = {};
                        Object.keys(item).forEach(key => {
                            // Convertir clave a minúscula para evitar errores de mayúsculas
                            let newKey = key.toLowerCase().trim();
                            // Mapeo de nombres comunes en Excel a variables del sistema
                            if(newKey === 'nombre') newKey = 'name';
                            if(newKey === 'documento') newKey = 'document';
                            if(newKey === 'telefono' || newKey === 'teléfono') newKey = 'phone';
                            if(newKey === 'estado') newKey = 'status';
                            if(newKey === 'fecha') newKey = 'date';
                            // Asignar valor
                            newItem[newKey] = item[key];
                        });
                        // Asegurar que ID exista
                        if (!newItem.id) newItem.id = '_' + Math.random().toString(36).substr(2, 9);
                        return newItem;
                    });
                };

                // 1. LEER USUARIOS
                // Intenta buscar la hoja "Usuarios", si no existe, busca la primera hoja
                const sheetNameUsers = workbook.SheetNames.find(n => n.toLowerCase().includes('usuario')) || workbook.SheetNames[0];
                if (sheetNameUsers) {
                    let rawUsers = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameUsers]);
                    const cleanUsers = normalizeData(rawUsers);
                    
                    if (replaceData) {
                        AppState.users = cleanUsers;
                    } else {
                        cleanUsers.forEach(u => {
                            // Evitar duplicados por Documento o ID
                            if (!AppState.users.some(existing => existing.document === u.document)) {
                                AppState.users.push(u);
                            }
                        });
                    }
                }

                // 2. LEER ASISTENCIAS (Busca hoja que contenga "asistencia")
                const sheetNameAtt = workbook.SheetNames.find(n => n.toLowerCase().includes('asistencia'));
                if (sheetNameAtt) {
                    let rawAtt = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameAtt]);
                    const cleanAtt = normalizeData(rawAtt);
                    
                    if (replaceData) AppState.attendance = cleanAtt;
                    else AppState.attendance = [...AppState.attendance, ...cleanAtt];
                }

                // 3. LEER PAGOS (Busca hoja que contenga "pago" o "income")
                const sheetNameInc = workbook.SheetNames.find(n => n.toLowerCase().includes('pago') || n.toLowerCase().includes('income'));
                if (sheetNameInc) {
                    let rawInc = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameInc]);
                    const cleanInc = normalizeData(rawInc);
                    
                    if (replaceData) AppState.income = cleanInc;
                    else AppState.income = [...AppState.income, ...cleanInc];
                }

                // GUARDAR Y RENDERIZAR
                Utils.saveToLocal();
                
                // Forzar actualización de la vista
                console.log("Datos cargados:", AppState.users.length, "usuarios.");
                UserManager.renderUsers();
                AttendanceManager.renderList();
                IncomeManager.renderHistory();
                Utils.updateDashboardStats();
                
                Utils.showAlert(`Restauración completada. Usuarios: ${AppState.users.length}`);
                
                // Limpiar input
                fileInput.value = '';
                document.getElementById('selectedFileName').textContent = 'Ningún archivo seleccionado';
                document.getElementById('restoreData').disabled = true;

            } catch (error) {
                console.error("Error al restaurar:", error);
                Utils.showAlert('Error leyendo el Excel. Revisa la consola (F12) para más detalles.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
// ==========================================
// 7. MÓDULO WHATSAPP Y AUXILIARES
// ==========================================
const WhatsAppManager = {
    openModal: (phone) => {
        if(!phone) return Utils.showAlert('Usuario sin teléfono', 'error');
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('57')) cleanPhone = cleanPhone.substring(2);
        document.getElementById('whatsappNumber').value = cleanPhone;
        new bootstrap.Modal(document.getElementById('whatsappModal')).show();
        
        document.getElementById('whatsappLink').onclick = () => {
            const msg = document.getElementById('whatsappMessage').value;
            const num = document.getElementById('whatsappNumber').value;
            window.open(`https://wa.me/57${num}?text=${encodeURIComponent(msg)}`, '_blank');
        };
    }
};

Utils.updateDashboardStats = () => {
    document.getElementById('infoUsers').textContent = AppState.users.length;
    document.getElementById('infoAttendance').textContent = AppState.attendance.length;
    document.getElementById('infoIncome').textContent = AppState.income.length;
    
    // Llenar select de pagos si hay usuarios nuevos
    if(document.getElementById('incomeUserSelect')) IncomeManager.populateUserSelect();
};

// ==========================================
// 8. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema Antología Box23 Iniciando...');
    
    // 1. Cargar LocalStorage primero (para velocidad inmediata)
    Utils.loadFromLocal();
    Utils.updateDashboardStats();

    // 2. Inicializar Módulos
    UserManager.init();
    AttendanceManager.init();
    IncomeManager.init();

    // 3. Intentar sincronizar con Neon (Nube)
    // Botones manuales
    document.getElementById('checkCloudStatusBtn').addEventListener('click', CloudService.loadAllFromCloud);
    document.getElementById('restoreCloudBtn').addEventListener('click', async () => {
        if(confirm("Esto reemplazará tus datos locales con los de la nube. ¿Continuar?")){
            await CloudService.loadAllFromCloud();
            Utils.saveToLocal(); // Actualizar local con lo que bajó de la nube
            UserManager.renderUsers();
            AttendanceManager.renderList();
            IncomeManager.renderHistory();
            Utils.showAlert("Datos restaurados desde Neon DB");
        }
    });

    // Sincronización automática al inicio
    await CloudService.loadAllFromCloud();
    // Una vez cargado de la nube, refrescar las tablas
    UserManager.renderUsers();
    IncomeManager.renderHistory();
    BackupManager.init();
    
    // Exponer globalmente
    window.UserManager = UserManager;
    window.WhatsAppManager = WhatsAppManager;
});



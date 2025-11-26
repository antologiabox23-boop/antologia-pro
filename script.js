 /**
 * Antología Box23 - Sistema de Gestión
 * Lógica principal de la aplicación + Conexión a Neon DB + Respaldo Excel Inteligente
 * Versión: 4.0 (Production Ready)
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
    // Detecta si estamos corriendo en web (http/https) o archivo local
    isOnline: () => window.location.protocol.startsWith('http'),

    updateStatus: (text, type) => {
        const statusText = document.getElementById('cloudStatusText');
        const icon = document.getElementById('cloudStatusIcon');
        if (!statusText) return;

        statusText.textContent = text;
        if (type === 'success') {
            statusText.className = 'text-success';
            icon.textContent = '🟢';
        } else if (type === 'info') {
            statusText.className = 'text-primary';
            icon.textContent = '🔵';
        } else if (type === 'error') {
            statusText.className = 'text-danger';
            icon.textContent = '🔴';
        }
    },

    saveUser: async (user) => {
        if (!CloudService.isOnline()) return;
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            CloudService.updateStatus('Usuario guardado en nube', 'success');
        } catch (e) {
            console.error("Error nube:", e);
            CloudService.updateStatus('Error guardando en nube', 'error');
        }
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
            console.log("Modo local/offline: Saltando sincronización de nube.");
            return false;
        }

        CloudService.updateStatus('Sincronizando...', 'info');

        try {
            // 1. Cargar Usuarios
            const resUsers = await fetch('/api/users');
            if (resUsers.ok) {
                const usersDB = await resUsers.json();
                if (Array.isArray(usersDB) && usersDB.length > 0) {
                    AppState.users = CloudService.mapUsersFromDB(usersDB);
                }
            }

            // 2. Cargar Asistencias
            const resAtt = await fetch('/api/attendance');
            if (resAtt.ok) {
                const attDB = await resAtt.json();
                if (Array.isArray(attDB) && attDB.length > 0) {
                    AppState.attendance = CloudService.mapAttendanceFromDB(attDB);
                }
            }

            // 3. Cargar Pagos
            const resInc = await fetch('/api/income');
            if (resInc.ok) {
                const incDB = await resInc.json();
                if (Array.isArray(incDB) && incDB.length > 0) {
                    AppState.income = CloudService.mapIncomeFromDB(incDB);
                }
            }

            CloudService.updateStatus('Conectado a Neon PostgreSQL', 'success');
            const timeEl = document.getElementById('lastCloudSync');
            if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
            
            return true;
        } catch (error) {
            console.error("Error cargando de nube:", error);
            CloudService.updateStatus('Error de conexión', 'error');
            return false;
        }
    },

    // Mappers: Convierten de snake_case (Base de Datos) a camelCase (JavaScript)
    mapUsersFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            document: r.document,
            phone: r.phone,
            birthdate: r.birthdate,
            eps: r.eps,
            rh: r.rh,
            emergencyContact: r.emergency_contact,
            emergencyPhone: r.emergency_phone,
            classTime: r.class_time,
            affiliationType: r.affiliation_type,
            status: r.status
        }));
    },
    mapAttendanceFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            date: r.date,
            timestamp: r.timestamp
        }));
    },
    mapIncomeFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            startDate: r.start_date,
            endDate: r.end_date,
            amount: parseFloat(r.amount),
            method: r.method,
            description: r.description,
            date: r.date
        }));
    }
};

// ==========================================
// 3. MÓDULO DE UTILIDADES (Helpers)
// ==========================================
const Utils = {
    generateId: () => '_' + Math.random().toString(36).substr(2, 9),

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate: (dateString) => {
        if (!dateString) return '';
        // Ajuste de zona horaria para evitar desfase de días
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return adjustedDate.toLocaleDateString('es-ES', options);
    },

    showAlert: (message, type = 'success') => {
        alert(message); // Se puede mejorar con librerías como SweetAlert2
    },

    saveToLocal: () => {
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
    },

    updateDashboardStats: () => {
        // Actualizar contadores del Dashboard
        const elUsers = document.getElementById('infoUsers');
        const elAtt = document.getElementById('infoAttendance');
        const elInc = document.getElementById('infoIncome');
        const elRepUsers = document.getElementById('reportTotalUsers');

        if (elUsers) elUsers.textContent = AppState.users.length;
        if (elAtt) elAtt.textContent = AppState.attendance.length;
        if (elInc) elInc.textContent = AppState.income.length;
        if (elRepUsers) elRepUsers.textContent = AppState.users.filter(u => u.status === 'active').length;

        // Actualizar selects dinámicos si existen
        if (document.getElementById('incomeUserSelect')) IncomeManager.populateUserSelect();
    }
};

// ==========================================
// 4. MÓDULO DE USUARIOS
// ==========================================
const UserManager = {
    init: () => {
        const form = document.getElementById('userForm');
        const searchInput = document.getElementById('searchUserInput');
        
        if (form) form.addEventListener('submit', UserManager.handleAddUser);
        if (searchInput) searchInput.addEventListener('input', UserManager.renderUsers);
        
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

        // Validación de duplicados
        const exists = AppState.users.some(u => u.document === newUser.document);
        if (exists) {
            Utils.showAlert('Ya existe un usuario con este documento', 'error');
            return;
        }

        AppState.users.push(newUser);
        Utils.saveToLocal();
        await CloudService.saveUser(newUser);

        UserManager.renderUsers();
        document.getElementById('userForm').reset();
        Utils.showAlert('Usuario registrado correctamente');
    },

    renderUsers: () => {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        const searchTerm = document.getElementById('searchUserInput')?.value.toLowerCase() || '';
        tbody.innerHTML = '';

        const filteredUsers = AppState.users.filter(user =>
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.document && user.document.includes(searchTerm))
        );

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id.substring(0, 6)}</td>
                <td>${user.name}</td>
                <td>${user.document}</td>
                <td>${user.phone}</td>
                <td><span class="badge bg-info">${user.classTime}</span></td>
                <td><span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                    ${user.status === 'active' ? 'Activo' : 'Inactivo'}
                </span></td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="WhatsAppManager.openModal('${user.phone}')">
                        <i class="fab fa-whatsapp"></i>
                    </button>
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
        const dateInput = document.getElementById('attendanceDate');
        if (dateInput) dateInput.valueAsDate = new Date();

        const refreshBtn = document.getElementById('refreshAttendance');
        const saveBtn = document.getElementById('saveAttendance');

        if (refreshBtn) refreshBtn.addEventListener('click', AttendanceManager.renderList);
        if (saveBtn) saveBtn.addEventListener('click', AttendanceManager.saveDay);

        AttendanceManager.renderList();
    },

    renderList: () => {
        const listContainer = document.getElementById('attendanceUsersList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        const activeUsers = AppState.users.filter(u => u.status === 'active');

        activeUsers.forEach(user => {
            const div = document.createElement('div');
            div.className = 'attendance-user-item';
            div.innerHTML = `
                <div class="attendance-check-container">
                    <input type="checkbox" class="form-check-input attendance-checkbox" 
                           data-user-id="${user.id}" id="att_${user.id}">
                </div>
                <div class="attendance-user-info">
                    <div class="attendance-user-name">${user.name}</div>
                    <div class="attendance-user-details">${user.classTime} - ${user.affiliationType}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
        
        const countEl = document.getElementById('totalUsersCount');
        if (countEl) countEl.textContent = activeUsers.length;
    },

    saveDay: async () => {
        const date = document.getElementById('attendanceDate').value;
        const checkboxes = document.querySelectorAll('.attendance-checkbox:checked');

        let count = 0;
        // Usamos for...of para poder usar await dentro del loop si fuera necesario
        for (const chk of checkboxes) {
            const userId = chk.getAttribute('data-user-id');
            const newAtt = {
                id: Utils.generateId(),
                userId: userId,
                date: date,
                timestamp: new Date().toISOString()
            };

            AppState.attendance.push(newAtt);
            // Enviamos a la nube sin bloquear (fire and forget para velocidad UI, o con await si preferimos seguridad)
            CloudService.saveAttendance(newAtt);
            count++;
        }

        Utils.saveToLocal();
        Utils.showAlert(`Se registraron ${count} asistencias para el día ${date}`);
        
        // Limpiar selección
        document.querySelectorAll('.attendance-checkbox').forEach(c => c.checked = false);
        Utils.updateDashboardStats();
    }
};

// ==========================================
// 6. MÓDULO DE PAGOS (INCOME)
// ==========================================
const IncomeManager = {
    init: () => {
        IncomeManager.populateUserSelect();
        const form = document.getElementById('incomeForm');
        if (form) form.addEventListener('submit', IncomeManager.handlePayment);
        IncomeManager.renderHistory();
    },

    populateUserSelect: () => {
        const select = document.getElementById('incomeUserSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccionar usuario</option>';
        AppState.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.document || 'Sin Doc'})`;
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
        await CloudService.saveIncome(payment);

        Utils.showAlert('Pago registrado correctamente');
        document.getElementById('incomeForm').reset();
        IncomeManager.renderHistory();
    },

    renderHistory: () => {
        const tbody = document.getElementById('incomeList');
        if (!tbody) return;
        
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

        const totalEl = document.getElementById('incomeTotal');
        if (totalEl) totalEl.textContent = Utils.formatCurrency(total);
    }
};

// ==========================================
// 7. MÓDULO DE RESPALDO (EXCEL)
// ==========================================
const BackupManager = {
    init: () => {
        const fileInput = document.getElementById('restoreFile');
        const restoreBtn = document.getElementById('restoreData');
        const backupBtn = document.getElementById('backupData');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const nameDisplay = document.getElementById('selectedFileName');
                    if(nameDisplay) nameDisplay.textContent = e.target.files[0].name;
                    if(restoreBtn) restoreBtn.disabled = false;
                }
            });
        }

        if (restoreBtn) restoreBtn.addEventListener('click', BackupManager.restoreFromExcel);
        if (backupBtn) backupBtn.addEventListener('click', BackupManager.exportToExcel);
    },

    exportToExcel: () => {
        if (typeof XLSX === 'undefined') {
            Utils.showAlert('Error: Librería XLSX no cargada.', 'error');
            return;
        }

        const wb = XLSX.utils.book_new();
        const wsUsers = XLSX.utils.json_to_sheet(AppState.users);
        const wsAttendance = XLSX.utils.json_to_sheet(AppState.attendance);
        const wsIncome = XLSX.utils.json_to_sheet(AppState.income);

        XLSX.utils.book_append_sheet(wb, wsUsers, "Usuarios");
        XLSX.utils.book_append_sheet(wb, wsAttendance, "Asistencias");
        XLSX.utils.book_append_sheet(wb, wsIncome, "Pagos");

        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Respaldo_Antologia_${dateStr}.xlsx`);
    },

    restoreFromExcel: () => {
        const fileInput = document.getElementById('restoreFile');
        const file = fileInput?.files[0];
        const replaceData = document.getElementById('replaceData')?.checked;

        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Función para normalizar nombres de columnas (Evitar errores de mayúsculas/tildes)
                const normalizeData = (items) => {
                    return items.map(item => {
                        const newItem = {};
                        Object.keys(item).forEach(key => {
                            let newKey = key.toLowerCase().trim();
                            // Mapeo inteligente
                            if (newKey === 'nombre' || newKey === 'nombres') newKey = 'name';
                            if (newKey === 'documento' || newKey === 'cedula') newKey = 'document';
                            if (newKey === 'telefono' || newKey === 'teléfono' || newKey === 'celular') newKey = 'phone';
                            if (newKey === 'estado') newKey = 'status';
                            if (newKey === 'fecha') newKey = 'date';
                            if (newKey === 'rh') newKey = 'rh';
                            if (newKey === 'eps') newKey = 'eps';
                            if (newKey === 'clase' || newKey === 'horario') newKey = 'classTime';
                            
                            newItem[newKey] = item[key];
                        });
                        if (!newItem.id) newItem.id = Utils.generateId();
                        // Valores por defecto si faltan
                        if (!newItem.status) newItem.status = 'active';
                        return newItem;
                    });
                };

                // 1. Restaurar Usuarios
                const sheetNameUsers = workbook.SheetNames.find(n => n.toLowerCase().includes('usuario')) || workbook.SheetNames[0];
                if (sheetNameUsers) {
                    const rawUsers = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameUsers]);
                    const cleanUsers = normalizeData(rawUsers);

                    if (replaceData) {
                        AppState.users = cleanUsers;
                    } else {
                        cleanUsers.forEach(u => {
                            if (!AppState.users.some(ex => ex.document == u.document)) {
                                AppState.users.push(u);
                            }
                        });
                    }
                }

                // 2. Restaurar Asistencias
                const sheetNameAtt = workbook.SheetNames.find(n => n.toLowerCase().includes('asistencia'));
                if (sheetNameAtt) {
                    const rawAtt = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameAtt]);
                    const cleanAtt = normalizeData(rawAtt);
                    if (replaceData) AppState.attendance = cleanAtt;
                    else AppState.attendance = [...AppState.attendance, ...cleanAtt];
                }

                // 3. Restaurar Pagos
                const sheetNameInc = workbook.SheetNames.find(n => n.toLowerCase().includes('pago') || n.toLowerCase().includes('income'));
                if (sheetNameInc) {
                    const rawInc = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameInc]);
                    const cleanInc = normalizeData(rawInc);
                    if (replaceData) AppState.income = cleanInc;
                    else AppState.income = [...AppState.income, ...cleanInc];
                }

                // Guardar y Refrescar
                Utils.saveToLocal();
                UserManager.renderUsers();
                AttendanceManager.renderList();
                IncomeManager.renderHistory();
                Utils.updateDashboardStats();

                Utils.showAlert(`Restauración exitosa. Usuarios totales: ${AppState.users.length}`);
                
                // Reset UI
                fileInput.value = '';
                document.getElementById('selectedFileName').textContent = 'Ningún archivo seleccionado';
                if(document.getElementById('restoreData')) document.getElementById('restoreData').disabled = true;

            } catch (error) {
                console.error("Error restauración:", error);
                Utils.showAlert('Error leyendo el archivo Excel. Verifica el formato.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// ==========================================
// 8. MÓDULO WHATSAPP
// ==========================================
const WhatsAppManager = {
    openModal: (phone) => {
        if (!phone) {
            Utils.showAlert('El usuario no tiene teléfono registrado', 'error');
            return;
        }
        let cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.startsWith('57')) cleanPhone = cleanPhone.substring(2);

        const numInput = document.getElementById('whatsappNumber');
        if(numInput) numInput.value = cleanPhone;

        const modalEl = document.getElementById('whatsappModal');
        if (modalEl && window.bootstrap) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            const sendBtn = document.getElementById('whatsappLink');
            if (sendBtn) {
                sendBtn.onclick = () => {
                    const msg = document.getElementById('whatsappMessage').value;
                    const finalNum = document.getElementById('whatsappNumber').value;
                    const url = `https://wa.me/57${finalNum}?text=${encodeURIComponent(msg)}`;
                    window.open(url, '_blank');
                };
            }
        } else {
            // Fallback si Bootstrap no carga
            const msg = prompt("Escribe el mensaje para WhatsApp:");
            if(msg) window.open(`https://wa.me/57${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    }
};

// ==========================================
// 9. INICIALIZACIÓN PRINCIPAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema Antología Box23 Iniciando v4.0...');

    // 1. Carga inicial rápida (Local Storage)
    Utils.loadFromLocal();

    // 2. Inicializar Módulos de la UI
    UserManager.init();
    AttendanceManager.init();
    IncomeManager.init();
    BackupManager.init();

    // 3. Inicializar Tooltips de Bootstrap (si existen)
    if (window.bootstrap) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    // 4. Actualizar Dashboard
    Utils.updateDashboardStats();

    // 5. Configurar Botones de Nube Manuales
    const checkCloudBtn = document.getElementById('checkCloudStatusBtn');
    const restoreCloudBtn = document.getElementById('restoreCloudBtn');
    
    if (checkCloudBtn) checkCloudBtn.addEventListener('click', CloudService.loadAllFromCloud);
    if (restoreCloudBtn) {
        restoreCloudBtn.addEventListener('click', async () => {
            if (confirm("¿Estás seguro? Esto reemplazará tus datos locales con los de la base de datos en la nube.")) {
                const success = await CloudService.loadAllFromCloud();
                if (success) {
                    Utils.saveToLocal(); // Guardar lo nuevo en local
                    UserManager.renderUsers();
                    AttendanceManager.renderList();
                    IncomeManager.renderHistory();
                    Utils.updateDashboardStats();
                    Utils.showAlert("Datos restaurados desde la nube exitosamente.");
                }
            }
        });
    }

    // 6. Sincronización Automática con Nube al inicio
    await CloudService.loadAllFromCloud();
    
    // Volver a renderizar por si llegaron datos nuevos de la nube
    UserManager.renderUsers();
    IncomeManager.renderHistory();
    Utils.updateDashboardStats();

    // 7. Exponer funciones globales para el HTML (onclick)
    window.UserManager = UserManager;
    window.WhatsAppManager = WhatsAppManager;
    window.AppState = AppState; // Para depuración en consola
});

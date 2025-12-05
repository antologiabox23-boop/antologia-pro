/**
 * Antología Box23 - Sistema de Gestión
 * Versión: 5.0 (Con Neon PostgreSQL integrado)
 * Autor: Carlos Alberto Africano Granados
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
        autoBackupInterval: 15 * 60 * 1000,
        lastBackup: null
    },
    dbKeys: {
        USERS: 'antologia_users_v2',
        ATTENDANCE: 'antologia_attendance_v2',
        INCOME: 'antologia_income_v2',
        CLOUD_LAST_SYNC: 'antologia_cloud_sync'
    }
};

// URL de la API (ajusta según tu despliegue)
const API_BASE_URL = window.location.hostname.includes('localhost') 
    ? 'http://localhost:3000' 
    : 'https://antologia-api.vercel.app';

// ==========================================
// 2. MÓDULO DE NUBE (Neon DB Service) CORREGIDO
// ==========================================
const CloudService = {
    isOnline: () => navigator.onLine && window.location.protocol.startsWith('http'),

    updateStatus: (text, type) => {
        const statusText = document.getElementById('cloudStatusText');
        const icon = document.getElementById('cloudStatusIcon');
        if (!statusText) return;

        statusText.textContent = text;
        if (type === 'success') {
            statusText.className = 'text-success';
            icon.textContent = '🟢';
        } else if (type === 'warning') {
            statusText.className = 'text-warning';
            icon.textContent = '🟡';
        } else if (type === 'error') {
            statusText.className = 'text-danger';
            icon.textContent = '🔴';
        } else {
            statusText.className = 'text-info';
            icon.textContent = '🔵';
        }
    },

    saveUser: async (user) => {
        if (!CloudService.isOnline()) return false;
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(user)
            });
            
            if (!response.ok) throw new Error('Error en respuesta del servidor');
            const data = await response.json();
            CloudService.updateStatus('Usuario guardado en nube', 'success');
            return true;
        } catch (error) {
            console.error("Error guardando usuario en nube:", error);
            CloudService.updateStatus('Error guardando en nube', 'error');
            return false;
        }
    },

    saveAttendance: async (attendanceItem) => {
        if (!CloudService.isOnline()) return false;
        try {
            const response = await fetch(`${API_BASE_URL}/api/attendance`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(attendanceItem)
            });
            return response.ok;
        } catch (error) {
            console.error("Error guardando asistencia en nube:", error);
            return false;
        }
    },

    saveIncome: async (incomeItem) => {
        if (!CloudService.isOnline()) return false;
        try {
            const response = await fetch(`${API_BASE_URL}/api/income`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(incomeItem)
            });
            return response.ok;
        } catch (error) {
            console.error("Error guardando pago en nube:", error);
            return false;
        }
    },

    loadAllFromCloud: async () => {
        if (!CloudService.isOnline()) {
            console.log("Modo offline: usando datos locales");
            CloudService.updateStatus('Modo offline', 'warning');
            return false;
        }

        CloudService.updateStatus('Sincronizando con nube...', 'info');

        try {
            // Cargar Usuarios
            const [usersRes, attRes, incRes] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/api/users`),
                fetch(`${API_BASE_URL}/api/attendance`),
                fetch(`${API_BASE_URL}/api/income`)
            ]);

            let cloudData = false;

            // Procesar usuarios
            if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
                const usersDB = await usersRes.value.json();
                if (Array.isArray(usersDB) && usersDB.length > 0) {
                    AppState.users = CloudService.mapUsersFromDB(usersDB);
                    cloudData = true;
                }
            }

            // Procesar asistencias
            if (attRes.status === 'fulfilled' && attRes.value.ok) {
                const attDB = await attRes.value.json();
                if (Array.isArray(attDB) && attDB.length > 0) {
                    AppState.attendance = CloudService.mapAttendanceFromDB(attDB);
                    cloudData = true;
                }
            }

            // Procesar pagos
            if (incRes.status === 'fulfilled' && incRes.value.ok) {
                const incDB = await incRes.value.json();
                if (Array.isArray(incDB) && incDB.length > 0) {
                    AppState.income = CloudService.mapIncomeFromDB(incDB);
                    cloudData = true;
                }
            }

            if (cloudData) {
                localStorage.setItem(AppState.dbKeys.CLOUD_LAST_SYNC, new Date().toISOString());
                Utils.saveToLocal();
                CloudService.updateStatus('Datos sincronizados con Neon PostgreSQL', 'success');
            } else {
                CloudService.updateStatus('No hay datos en la nube', 'warning');
            }

            const timeEl = document.getElementById('lastCloudSync');
            if (timeEl) {
                const lastSync = localStorage.getItem(AppState.dbKeys.CLOUD_LAST_SYNC);
                timeEl.textContent = lastSync ? new Date(lastSync).toLocaleString() : 'Nunca';
            }
            
            return cloudData;
        } catch (error) {
            console.error("Error cargando de nube:", error);
            CloudService.updateStatus('Error de conexión con la nube', 'error');
            return false;
        }
    },

    // Mapear datos desde la base de datos
    mapUsersFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id || Utils.generateId(),
            name: r.name || '',
            document: r.document || '',
            phone: r.phone || '',
            birthdate: r.birthdate || null,
            eps: r.eps || '',
            rh: r.rh || '',
            emergencyContact: r.emergency_contact || '',
            emergencyPhone: r.emergency_phone || '',
            classTime: r.class_time || '',
            affiliationType: r.affiliation_type || '',
            status: r.status || 'active',
            createdAt: r.created_at || new Date().toISOString()
        }));
    },

    mapAttendanceFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id || Utils.generateId(),
            userId: r.user_id || '',
            date: r.date || new Date().toISOString().split('T')[0],
            timestamp: r.timestamp || new Date().toISOString()
        }));
    },

    mapIncomeFromDB: (rows) => {
        return rows.map(r => ({
            id: r.id || Utils.generateId(),
            userId: r.user_id || '',
            startDate: r.start_date || new Date().toISOString().split('T')[0],
            endDate: r.end_date || new Date().toISOString().split('T')[0],
            amount: parseFloat(r.amount) || 0,
            method: r.method || '',
            description: r.description || '',
            date: r.date || new Date().toISOString().split('T')[0]
        }));
    },

    // Backup manual a la nube
    backupToCloud: async () => {
        if (!CloudService.isOnline()) {
            alert('No hay conexión a internet');
            return false;
        }

        try {
            CloudService.updateStatus('Realizando respaldo en la nube...', 'info');
            
            // Enviar todos los usuarios
            const userPromises = AppState.users.map(user => 
                CloudService.saveUser(user).catch(e => {
                    console.error(`Error guardando usuario ${user.id}:`, e);
                    return false;
                })
            );

            // Enviar todas las asistencias
            const attPromises = AppState.attendance.map(att => 
                CloudService.saveAttendance(att).catch(e => {
                    console.error(`Error guardando asistencia ${att.id}:`, e);
                    return false;
                })
            );

            // Enviar todos los pagos
            const incPromises = AppState.income.map(inc => 
                CloudService.saveIncome(inc).catch(e => {
                    console.error(`Error guardando pago ${inc.id}:`, e);
                    return false;
                })
            );

            await Promise.allSettled([...userPromises, ...attPromises, ...incPromises]);
            
            localStorage.setItem(AppState.dbKeys.CLOUD_LAST_SYNC, new Date().toISOString());
            CloudService.updateStatus('Respaldo en nube completado', 'success');
            
            const timeEl = document.getElementById('lastCloudSync');
            if (timeEl) timeEl.textContent = new Date().toLocaleString();
            
            return true;
        } catch (error) {
            console.error("Error en respaldo a nube:", error);
            CloudService.updateStatus('Error en respaldo a nube', 'error');
            return false;
        }
    }
};

// ==========================================
// 3. MÓDULO DE UTILIDADES
// ==========================================
const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate: (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    showAlert: (message, type = 'success', duration = 3000) => {
        // Crear alerta temporal
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-remover después de la duración
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, duration);
    },

    saveToLocal: () => {
        try {
            localStorage.setItem(AppState.dbKeys.USERS, JSON.stringify(AppState.users));
            localStorage.setItem(AppState.dbKeys.ATTENDANCE, JSON.stringify(AppState.attendance));
            localStorage.setItem(AppState.dbKeys.INCOME, JSON.stringify(AppState.income));
            localStorage.setItem('antologia_last_save', new Date().toISOString());
            Utils.updateDashboardStats();
            Utils.showNotification('Datos guardados localmente');
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
            Utils.showAlert('Error guardando datos: ' + error.message, 'error');
        }
    },

    loadFromLocal: () => {
        try {
            const users = localStorage.getItem(AppState.dbKeys.USERS);
            const attendance = localStorage.getItem(AppState.dbKeys.ATTENDANCE);
            const income = localStorage.getItem(AppState.dbKeys.INCOME);

            if (users) AppState.users = JSON.parse(users);
            if (attendance) AppState.attendance = JSON.parse(attendance);
            if (income) AppState.income = JSON.parse(income);
        } catch (error) {
            console.error('Error cargando de localStorage:', error);
            AppState.users = [];
            AppState.attendance = [];
            AppState.income = [];
        }
    },

    updateDashboardStats: () => {
        try {
            const elUsers = document.getElementById('infoUsers');
            const elAtt = document.getElementById('infoAttendance');
            const elInc = document.getElementById('infoIncome');
            const elRepUsers = document.getElementById('reportTotalUsers');

            if (elUsers) elUsers.textContent = AppState.users.length;
            if (elAtt) elAtt.textContent = AppState.attendance.length;
            if (elInc) elInc.textContent = AppState.income.length;
            if (elRepUsers) {
                const activeUsers = AppState.users.filter(u => u.status === 'active').length;
                elRepUsers.textContent = activeUsers;
            }

            // Actualizar última copia
            const lastBackupEl = document.getElementById('infoLastBackup');
            if (lastBackupEl) {
                const lastBackup = localStorage.getItem('antologia_last_backup');
                lastBackupEl.textContent = lastBackup 
                    ? new Date(lastBackup).toLocaleString() 
                    : 'Nunca';
            }
        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    },

    showNotification: (text) => {
        const notification = document.getElementById('backupNotification');
        const textEl = document.getElementById('backupNotificationText');
        if (notification && textEl) {
            textEl.textContent = text;
            notification.style.display = 'flex';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }
    },

    validatePhone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length === 10 && cleaned.startsWith('3');
    }
};

// ==========================================
// 4. MÓDULO DE USUARIOS
// ==========================================
const UserManager = {
    init: () => {
        const form = document.getElementById('userForm');
        const searchInput = document.getElementById('searchUserInput');
        
        if (form) {
            form.addEventListener('submit', UserManager.handleAddUser);
            
            // Validación de teléfono en tiempo real
            const phoneInput = document.getElementById('phone');
            const emergencyPhoneInput = document.getElementById('emergencyPhone');
            
            if (phoneInput) {
                phoneInput.addEventListener('input', UserManager.validatePhoneField);
            }
            if (emergencyPhoneInput) {
                emergencyPhoneInput.addEventListener('input', UserManager.validateEmergencyPhoneField);
            }
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', UserManager.renderUsers);
        }
        
        UserManager.renderUsers();
    },

    validatePhoneField: (e) => {
        const phone = e.target.value;
        const errorEl = document.getElementById('phoneError');
        if (errorEl) {
            if (phone && !Utils.validatePhone(phone)) {
                errorEl.style.display = 'block';
                e.target.classList.add('validation-error');
            } else {
                errorEl.style.display = 'none';
                e.target.classList.remove('validation-error');
            }
        }
    },

    validateEmergencyPhoneField: (e) => {
        const phone = e.target.value;
        const errorEl = document.getElementById('emergencyPhoneError');
        if (errorEl) {
            if (phone && !Utils.validatePhone(phone)) {
                errorEl.style.display = 'block';
                e.target.classList.add('validation-error');
            } else {
                errorEl.style.display = 'none';
                e.target.classList.remove('validation-error');
            }
        }
    },

    handleAddUser: async (e) => {
        e.preventDefault();

        // Validar teléfonos
        const phone = document.getElementById('phone').value;
        const emergencyPhone = document.getElementById('emergencyPhone').value;
        
        if (!Utils.validatePhone(phone)) {
            Utils.showAlert('Teléfono inválido. Debe tener 10 dígitos y comenzar con 3', 'error');
            return;
        }
        
        if (!Utils.validatePhone(emergencyPhone)) {
            Utils.showAlert('Teléfono de emergencia inválido. Debe tener 10 dígitos y comenzar con 3', 'error');
            return;
        }

        const newUser = {
            id: Utils.generateId(),
            name: document.getElementById('name').value.trim(),
            document: document.getElementById('document').value.trim(),
            phone: phone.replace(/\D/g, ''),
            birthdate: document.getElementById('birthdate').value || null,
            eps: document.getElementById('eps').value.trim(),
            rh: document.getElementById('rh').value,
            emergencyContact: document.getElementById('emergencyContact').value.trim(),
            emergencyPhone: emergencyPhone.replace(/\D/g, ''),
            classTime: document.getElementById('classTime').value,
            affiliationType: document.getElementById('affiliationType').value,
            status: document.getElementById('status').value,
            createdAt: new Date().toISOString()
        };

        // Validar campos requeridos
        if (!newUser.name || !newUser.document || !newUser.phone || !newUser.emergencyContact) {
            Utils.showAlert('Por favor complete todos los campos requeridos (*)', 'error');
            return;
        }

        // Verificar duplicado por documento
        const exists = AppState.users.some(u => u.document === newUser.document);
        if (exists) {
            Utils.showAlert('Ya existe un usuario con este número de documento', 'error');
            return;
        }

        AppState.users.push(newUser);
        Utils.saveToLocal();
        
        // Guardar en la nube (en segundo plano)
        CloudService.saveUser(newUser).catch(console.error);

        UserManager.renderUsers();
        document.getElementById('userForm').reset();
        Utils.showAlert('Usuario registrado correctamente');
    },

    renderUsers: () => {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        const searchTerm = document.getElementById('searchUserInput')?.value.toLowerCase() || '';
        tbody.innerHTML = '';

        const filteredUsers = AppState.users.filter(user => {
            if (!searchTerm) return true;
            
            const searchText = `
                ${user.name || ''} 
                ${user.document || ''} 
                ${user.phone || ''} 
                ${user.emergencyContact || ''} 
                ${user.emergencyPhone || ''}
            `.toLowerCase();
            
            return searchText.includes(searchTerm);
        });

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        ${searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                    </td>
                </tr>
            `;
            return;
        }

        filteredUsers.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id.substring(0, 8)}</td>
                <td>${user.name}</td>
                <td>${user.document}</td>
                <td>${user.phone}</td>
                <td><span class="badge bg-info">${user.classTime}</span></td>
                <td>
                    <span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${user.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="WhatsAppManager.openModal('${user.phone}')" title="Enviar WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="UserManager.editUser('${user.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="UserManager.showEmergencyInfo('${user.id}')" title="Info Emergencia">
                        <i class="fas fa-first-aid"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    editUser: (userId) => {
        const user = AppState.users.find(u => u.id === userId);
        if (!user) return;

        // Llenar formulario de edición
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editName').value = user.name;
        document.getElementById('editDocument').value = user.document;
        document.getElementById('editBirthdate').value = user.birthdate || '';
        document.getElementById('editPhone').value = user.phone;
        document.getElementById('editEps').value = user.eps || '';
        document.getElementById('editRh').value = user.rh;
        document.getElementById('editPathology').value = user.pathology || '';
        document.getElementById('editEmergencyContact').value = user.emergencyContact;
        document.getElementById('editEmergencyPhone').value = user.emergencyPhone;
        document.getElementById('editClassTime').value = user.classTime;
        document.getElementById('editAffiliationType').value = user.affiliationType;
        document.getElementById('editStatus').value = user.status;

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();
    },

    showEmergencyInfo: (userId) => {
        const user = AppState.users.find(u => u.id === userId);
        if (!user) return;

        const content = document.getElementById('emergencyInfoContent');
        if (content) {
            content.innerHTML = `
                <div class="emergency-info">
                    <h6>${user.name}</h6>
                    <p><strong>Documento:</strong> ${user.document}</p>
                    <p><strong>EPS:</strong> ${user.eps || 'No registrada'}</p>
                    <p><strong>RH:</strong> ${user.rh}</p>
                    <p><strong>Patología:</strong> ${user.pathology || 'Ninguna'}</p>
                    <hr>
                    <h6><i class="fas fa-exclamation-triangle"></i> Contacto de Emergencia</h6>
                    <p><strong>Nombre:</strong> ${user.emergencyContact}</p>
                    <p><strong>Teléfono:</strong> ${user.emergencyPhone}</p>
                    <a href="tel:${user.emergencyPhone}" class="btn btn-danger mt-2">
                        <i class="fas fa-phone"></i> Llamar a Emergencia
                    </a>
                </div>
            `;
        }

        const modal = new bootstrap.Modal(document.getElementById('emergencyInfoModal'));
        modal.show();
    }
};

// ==========================================
// 5. INICIALIZACIÓN PRINCIPAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema Antología Box23 v5.0 - Iniciando...');

    // Cargar datos locales
    Utils.loadFromLocal();

    // Inicializar módulos
    UserManager.init();
    
    // Configurar botones de nube
    const manualBackupBtn = document.getElementById('manualBackupBtn');
    const restoreCloudBtn = document.getElementById('restoreCloudBtn');
    const checkCloudBtn = document.getElementById('checkCloudStatusBtn');

    if (manualBackupBtn) {
        manualBackupBtn.addEventListener('click', async () => {
            manualBackupBtn.disabled = true;
            const success = await CloudService.backupToCloud();
            manualBackupBtn.disabled = false;
            if (success) {
                Utils.showAlert('Respaldo en la nube completado correctamente');
            }
        });
    }

    if (restoreCloudBtn) {
        restoreCloudBtn.addEventListener('click', async () => {
            if (confirm('¿Está seguro de restaurar desde la nube? Esto reemplazará sus datos locales.')) {
                restoreCloudBtn.disabled = true;
                const success = await CloudService.loadAllFromCloud();
                restoreCloudBtn.disabled = false;
                if (success) {
                    UserManager.renderUsers();
                    Utils.showAlert('Datos restaurados desde la nube correctamente');
                }
            }
        });
    }

    if (checkCloudBtn) {
        checkCloudBtn.addEventListener('click', async () => {
            checkCloudBtn.disabled = true;
            await CloudService.loadAllFromCloud();
            checkCloudBtn.disabled = false;
        });
    }

    // Configurar respaldo automático cada 15 minutos
    const autoBackupCheckbox = document.getElementById('autoBackupCheckbox');
    if (autoBackupCheckbox) {
        // Cargar preferencia guardada
        autoBackupCheckbox.checked = localStorage.getItem('autoBackupEnabled') === 'true';
        
        autoBackupCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('autoBackupEnabled', e.target.checked);
            if (e.target.checked) {
                Utils.showAlert('Respaldo automático activado cada 15 minutos');
            }
        });
    }

    // Iniciar respaldo automático si está activado
    if (localStorage.getItem('autoBackupEnabled') === 'true') {
        setInterval(async () => {
            if (CloudService.isOnline()) {
                await CloudService.backupToCloud();
            }
        }, 15 * 60 * 1000); // 15 minutos
    }

    // Sincronizar con la nube al inicio
    setTimeout(async () => {
        await CloudService.loadAllFromCloud();
        UserManager.renderUsers();
        Utils.updateDashboardStats();
    }, 1000);

    // Exponer funciones globales
    window.UserManager = UserManager;
    window.WhatsAppManager = WhatsAppManager;
    window.CloudService = CloudService;
    window.Utils = Utils;
});

// ==========================================
// 6. MÓDULO WHATSAPP (simplificado)
// ==========================================
const WhatsAppManager = {
    openModal: (phone) => {
        if (!phone) {
            Utils.showAlert('El usuario no tiene teléfono registrado', 'error');
            return;
        }
        
        const cleanPhone = phone.toString().replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            Utils.showAlert('Número de teléfono inválido', 'error');
            return;
        }

        const whatsappUrl = `https://wa.me/57${cleanPhone}`;
        window.open(whatsappUrl, '_blank');
    }
};

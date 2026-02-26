/**
 * Módulo de Gestión de Usuarios — campos ampliados
 */

const Users = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;
    let filteredUsers = [];
    let searchTerm = '';
    let currentStatusFilter = '';
    let currentAffiliationFilter = '';

    // Mapa campo HTML → clave del objeto
    const FIELDS = [
        { id: 'userName',             key: 'name' },
        { id: 'userDocument',         key: 'document' },
        { id: 'userBirthdate',        key: 'birthdate' },
        { id: 'userPhone',            key: 'phone' },
        { id: 'userEps',              key: 'eps' },
        { id: 'userBloodType',        key: 'bloodType' },
        { id: 'userPathology',        key: 'pathology' },
        { id: 'userEmergencyContact', key: 'emergencyContact' },
        { id: 'userEmergencyPhone',   key: 'emergencyPhone' },
        { id: 'userClassTime',        key: 'classTime' },
        { id: 'userAffiliation',      key: 'affiliationType' },
        { id: 'userStatus',           key: 'status' },
    ];

    function initialize() {
        itemsPerPage = Storage.getSetting('itemsPerPage') || 25;
        setupEventListeners();
        Validation.setupRealtimeValidation('userForm', Validation.schemas.user);
        renderUsers();
    }

    function setupEventListeners() {
        document.getElementById('addUserBtn')?.addEventListener('click', () => openUserModal());
        document.getElementById('saveUserBtn')?.addEventListener('click', saveUser);

        document.getElementById('userSearch')?.addEventListener('input',
            Utils.debounce(e => { searchTerm = e.target.value.toLowerCase(); currentPage = 1; renderUsers(); }, 300));

        document.getElementById('statusFilter')?.addEventListener('change', e => {
            currentStatusFilter = e.target.value; currentPage = 1; renderUsers();
        });
        document.getElementById('affiliationFilter')?.addEventListener('change', e => {
            currentAffiliationFilter = e.target.value; currentPage = 1; renderUsers();
        });
        document.getElementById('clearFilters')?.addEventListener('click', () => {
            searchTerm = ''; currentStatusFilter = ''; currentAffiliationFilter = '';
            ['userSearch','statusFilter','affiliationFilter'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            currentPage = 1; renderUsers();
        });

        document.getElementById('quickAddUser')?.addEventListener('click', () => {
            UI.switchTab('users'); setTimeout(() => openUserModal(), 300);
        });

        document.getElementById('userModal')?.addEventListener('hidden.bs.modal', () => {
            const form = document.getElementById('userForm');
            if (form) { form.reset(); Validation.clearFormValidation(form); }
            const uid = document.getElementById('userId'); if (uid) uid.value = '';
        });
    }

    function openUserModal(userId = null) {
        const form      = document.getElementById('userForm');
        const modalTitle = document.getElementById('userModalLabel');
        if (!form || !modalTitle) return;

        form.reset();
        Validation.clearFormValidation(form);
        document.getElementById('userId').value = '';

        if (userId) {
            const user = Storage.getUserById(userId);
            if (!user) { UI.showErrorToast('Usuario no encontrado'); return; }

            modalTitle.innerHTML = '<i class="fas fa-user-edit me-2"></i>Editar Usuario';
            document.getElementById('userId').value = user.id;

            // Llenar cada campo desde el objeto usuario
            FIELDS.forEach(({ id, key }) => {
                const el = document.getElementById(id);
                if (el) el.value = user[key] || '';
            });
        } else {
            modalTitle.innerHTML = '<i class="fas fa-user-plus me-2"></i>Nuevo Usuario';
            const st = document.getElementById('userStatus'); if (st) st.value = 'active';
        }
        UI.showModal('userModal');
    }

    async function saveUser() {
        // Validar
        const validation = Validation.validateForm('userForm', Validation.schemas.user);
        if (!validation.isValid) { UI.showErrorToast('Corrige los errores del formulario'); return; }

        const userId = (document.getElementById('userId').value || '').trim();

        // Construir objeto con todos los campos
        const userData = {};
        FIELDS.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el) return;
            let val = el.value.trim();
            if (key === 'phone' || key === 'emergencyPhone') val = val.replace(/\D/g, '');
            if (key === 'name' || key === 'pathology' || key === 'emergencyContact' || key === 'eps') {
                val = Validation.sanitizeInput(val);
            }
            userData[key] = val;
        });

        // Validar unicidad de documento y teléfono
        const customVal = Validation.validateUserData({
            userDocument: userData.document,
            userPhone:    userData.phone,
            userId
        });
        if (!customVal.isValid) { UI.showErrorToast(customVal.errors.join(' · ')); return; }

        UI.setButtonLoading('saveUserBtn', true);
        try {
            if (userId) {
                await Storage.updateUser(userId, userData);
                UI.showSuccessToast('Usuario actualizado');
            } else {
                await Storage.addUser(userData);
                UI.showSuccessToast('Usuario registrado');
            }
            UI.hideModal('userModal');
            renderUsers();
            if (window.Dashboard) Dashboard.updateStats();
        } catch (err) {
            UI.showErrorToast('Error al guardar: ' + err.message);
        } finally {
            UI.setButtonLoading('saveUserBtn', false);
        }
    }

    function deleteUser(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        UI.showConfirmModal(
            'Eliminar Usuario',
            `¿Eliminar a "${user.name}"? Se borrarán también sus asistencias y pagos.`,
            async () => {
                try {
                    await Storage.deleteUser(userId);
                    UI.showSuccessToast('Usuario eliminado');
                    renderUsers();
                    if (window.Dashboard) Dashboard.updateStats();
                } catch (err) {
                    UI.showErrorToast('Error al eliminar: ' + err.message);
                }
            }, true);
    }

    function renderUsers() {
        const users = Storage.getUsers();
        filteredUsers = users.filter(u => {
            let ok = true;
            if (searchTerm) {
                const txt = `${u.name} ${u.document || ''} ${u.phone}`.toLowerCase();
                ok = ok && txt.includes(searchTerm);
            }
            if (currentStatusFilter)      ok = ok && u.status === currentStatusFilter;
            if (currentAffiliationFilter) ok = ok && u.affiliationType === currentAffiliationFilter;
            return ok;
        }).sort((a, b) => a.name.localeCompare(b.name));

        const start     = (currentPage - 1) * itemsPerPage;
        const paginated = filteredUsers.slice(start, start + itemsPerPage);
        renderUsersList(paginated);
        renderUsersPagination();
    }

    function renderUsersList(users) {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5">
                <i class="fas fa-users fa-3x text-muted d-block mb-3"></i>
                <span class="text-muted">${
                    searchTerm || currentStatusFilter || currentAffiliationFilter
                    ? 'Sin resultados con los filtros aplicados'
                    : 'No hay usuarios. ¡Agrega el primero!'
                }</span></td></tr>`;
            return;
        }

        tbody.innerHTML = users.map((u, i) => {
            const idx    = (currentPage - 1) * itemsPerPage + i + 1;
            const badge  = u.status === 'active'
                ? '<span class="badge bg-success">Activo</span>'
                : '<span class="badge bg-danger">Inactivo</span>';
            return `
            <tr>
                <td class="d-none d-md-table-cell">${idx}</td>
                <td><strong>${Utils.escapeHtml(u.name)}</strong></td>
                <td class="d-none d-lg-table-cell">${Utils.escapeHtml(u.document || '-')}</td>
                <td class="d-none d-md-table-cell">${Utils.formatPhone(u.phone)}</td>
                <td class="d-none d-lg-table-cell">${Utils.escapeHtml(u.eps || '-')}</td>
                <td class="d-none d-lg-table-cell"><span class="badge bg-secondary">${Utils.escapeHtml(u.bloodType || '-')}</span></td>
                <td class="d-none d-lg-table-cell">${Utils.escapeHtml(u.classTime || '-')}</td>
                <td class="d-none d-md-table-cell"><span class="badge bg-primary">${Utils.escapeHtml(u.affiliationType || '-')}</span></td>
                <td>${badge}</td>
                <td>
                    <button class="btn btn-sm btn-info me-1" onclick="Users.editUser('${u.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="Users.deleteUser('${u.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function renderUsersPagination() {
        UI.renderPagination('usersPagination', filteredUsers.length, currentPage, itemsPerPage, page => {
            currentPage = page; renderUsers(); UI.scrollToTop();
        });
    }

    function getAllUsers()        { return Storage.getUsers(); }
    function getActiveUsers()    { return Storage.getUsers().filter(u => u.status === 'active'); }
    function getUsersForSelect() { return getActiveUsers().sort((a, b) => a.name.localeCompare(b.name)); }

    return {
        initialize,
        openUserModal,
        editUser: openUserModal,
        deleteUser,
        renderUsers,
        getAllUsers,
        getActiveUsers,
        getUsersForSelect
    };
})();

window.Users = Users;

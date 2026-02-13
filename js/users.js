/**
 * Módulo de Gestión de Usuarios
 */

const Users = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;
    let filteredUsers = [];
    let searchTerm = '';
    let currentStatusFilter = '';
    let currentAffiliationFilter = '';

    function initialize() {
        itemsPerPage = Storage.getSetting('itemsPerPage') || 25;
        setupEventListeners();
        setupRealtimeValidation();
        renderUsers();
    }

    function setupEventListeners() {
        document.getElementById('addUserBtn')?.addEventListener('click', () => openUserModal());
        document.getElementById('saveUserBtn')?.addEventListener('click', saveUser);

        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', Utils.debounce((e) => {
                searchTerm = e.target.value.toLowerCase();
                currentPage = 1;
                renderUsers();
            }, 300));
        }

        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            currentPage = 1;
            renderUsers();
        });

        document.getElementById('affiliationFilter')?.addEventListener('change', (e) => {
            currentAffiliationFilter = e.target.value;
            currentPage = 1;
            renderUsers();
        });

        document.getElementById('clearFilters')?.addEventListener('click', () => {
            searchTerm = '';
            currentStatusFilter = '';
            currentAffiliationFilter = '';
            const us = document.getElementById('userSearch');
            const sf = document.getElementById('statusFilter');
            const af = document.getElementById('affiliationFilter');
            if (us) us.value = '';
            if (sf) sf.value = '';
            if (af) af.value = '';
            currentPage = 1;
            renderUsers();
        });

        document.getElementById('quickAddUser')?.addEventListener('click', () => {
            UI.switchTab('users');
            setTimeout(() => openUserModal(), 300);
        });

        document.getElementById('userModal')?.addEventListener('hidden.bs.modal', () => {
            const form = document.getElementById('userForm');
            if (form) {
                form.reset();
                Validation.clearFormValidation(form);
                document.getElementById('userId').value = '';
            }
        });
    }

    function setupRealtimeValidation() {
        Validation.setupRealtimeValidation('userForm', Validation.schemas.user);
    }

    function openUserModal(userId = null) {
        const form = document.getElementById('userForm');
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
            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userPhone').value = user.phone;
            document.getElementById('userAffiliation').value = user.affiliationType;
            document.getElementById('userClassTime').value = user.classTime || '';
            document.getElementById('userStatus').value = user.status;
            document.getElementById('userNotes').value = user.notes || '';
        } else {
            modalTitle.innerHTML = '<i class="fas fa-user-plus me-2"></i>Agregar Usuario';
            document.getElementById('userStatus').value = 'active';
        }

        UI.showModal('userModal');
    }

    function saveUser() {
        const validation = Validation.validateForm('userForm', Validation.schemas.user);
        if (!validation.isValid) {
            UI.showErrorToast('Por favor, corrige los errores en el formulario');
            return;
        }

        const userId = document.getElementById('userId').value.trim();
        const userData = {
            name: Validation.sanitizeInput(document.getElementById('userName').value.trim()),
            email: document.getElementById('userEmail').value.trim().toLowerCase(),
            phone: document.getElementById('userPhone').value.replace(/\D/g, ''),
            affiliationType: document.getElementById('userAffiliation').value,
            classTime: document.getElementById('userClassTime').value,
            status: document.getElementById('userStatus').value,
            notes: Validation.sanitizeInput(document.getElementById('userNotes').value.trim())
        };

        // Validación de unicidad: pasar email y phone con las claves correctas
        const customValidation = Validation.validateUserData({
            userEmail: userData.email,
            userPhone: userData.phone,
            userId: userId  // vacío si es nuevo
        });

        if (!customValidation.isValid) {
            UI.showErrorToast(customValidation.errors.join(', '));
            return;
        }

        UI.setButtonLoading('saveUserBtn', true);

        setTimeout(() => {
            try {
                if (userId) {
                    Storage.updateUser(userId, userData);
                    UI.showSuccessToast('Usuario actualizado exitosamente');
                } else {
                    Storage.addUser(userData);
                    UI.showSuccessToast('Usuario agregado exitosamente');
                }
                UI.hideModal('userModal');
                renderUsers();
                if (window.Dashboard) Dashboard.updateStats();
            } catch (error) {
                UI.showErrorToast('Error al guardar usuario: ' + error.message);
            } finally {
                UI.setButtonLoading('saveUserBtn', false);
            }
        }, 400);
    }

    function deleteUser(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;

        UI.showConfirmModal(
            'Eliminar Usuario',
            `¿Estás seguro de eliminar a "${user.name}"? Se eliminarán también todos sus registros de asistencia y pagos.`,
            () => {
                Storage.deleteUser(userId);
                UI.showSuccessToast('Usuario eliminado exitosamente');
                renderUsers();
                if (window.Dashboard) Dashboard.updateStats();
            },
            true
        );
    }

    function renderUsers() {
        const users = Storage.getUsers();

        filteredUsers = users.filter(user => {
            let matches = true;
            if (searchTerm) {
                const text = `${user.name} ${user.email} ${user.phone}`.toLowerCase();
                matches = matches && text.includes(searchTerm);
            }
            if (currentStatusFilter) matches = matches && user.status === currentStatusFilter;
            if (currentAffiliationFilter) matches = matches && user.affiliationType === currentAffiliationFilter;
            return matches;
        });

        filteredUsers.sort((a, b) => a.name.localeCompare(b.name));

        const start = (currentPage - 1) * itemsPerPage;
        const paginated = filteredUsers.slice(start, start + itemsPerPage);

        renderUsersList(paginated);
        renderUsersPagination();
    }

    function renderUsersList(users) {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3 d-block"></i>
                        <p class="text-muted">${
                            searchTerm || currentStatusFilter || currentAffiliationFilter
                                ? 'No se encontraron usuarios con los filtros aplicados'
                                : 'No hay usuarios registrados. ¡Agrega el primero!'
                        }</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = users.map((user, index) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
            const statusBadge = user.status === 'active'
                ? '<span class="badge bg-success">Activo</span>'
                : '<span class="badge bg-danger">Inactivo</span>';
            return `
                <tr>
                    <td>${globalIndex}</td>
                    <td><strong>${Utils.escapeHtml(user.name)}</strong></td>
                    <td>${Utils.escapeHtml(user.email)}</td>
                    <td>${Utils.formatPhone(user.phone)}</td>
                    <td><span class="badge bg-primary">${Utils.escapeHtml(user.affiliationType)}</span></td>
                    <td>${user.classTime || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-info me-1" onclick="Users.editUser('${user.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Users.deleteUser('${user.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    function renderUsersPagination() {
        UI.renderPagination('usersPagination', filteredUsers.length, currentPage, itemsPerPage, (page) => {
            currentPage = page;
            renderUsers();
            UI.scrollToTop();
        });
    }

    function getAllUsers()       { return Storage.getUsers(); }
    function getActiveUsers()   { return Storage.getUsers().filter(u => u.status === 'active'); }
    function getUsersForSelect() {
        return getActiveUsers().sort((a, b) => a.name.localeCompare(b.name));
    }

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

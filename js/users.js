/**
 * Módulo de Gestión de Usuarios
 */

const Users = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;
    let filteredUsers = [];
    let searchTerm = '';
    let statusFilter = '';
    let affiliationFilter = '';

    function initialize() {
        itemsPerPage = Storage.getSetting('itemsPerPage') || 25;
        setupEventListeners();
        setupRealtimeValidation();
        renderUsers();
    }

    function setupEventListeners() {
        // Botón agregar usuario
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => openUserModal());
        }

        // Botón guardar usuario
        const saveUserBtn = document.getElementById('saveUserBtn');
        if (saveUserBtn) {
            saveUserBtn.addEventListener('click', saveUser);
        }

        // Búsqueda
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', Utils.debounce((e) => {
                searchTerm = e.target.value.toLowerCase();
                currentPage = 1;
                renderUsers();
            }, 300));
        }

        // Filtros
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                currentPage = 1;
                renderUsers();
            });
        }

        const affiliationFilter = document.getElementById('affiliationFilter');
        if (affiliationFilter) {
            affiliationFilter.addEventListener('change', (e) => {
                this.affiliationFilter = e.target.value;
                currentPage = 1;
                renderUsers();
            });
        }

        // Limpiar filtros
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                searchTerm = '';
                this.statusFilter = '';
                this.affiliationFilter = '';
                
                document.getElementById('userSearch').value = '';
                document.getElementById('statusFilter').value = '';
                document.getElementById('affiliationFilter').value = '';
                
                currentPage = 1;
                renderUsers();
            });
        }

        // Acción rápida
        const quickAddUser = document.getElementById('quickAddUser');
        if (quickAddUser) {
            quickAddUser.addEventListener('click', () => openUserModal());
        }

        // Reset form cuando se cierra el modal
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.addEventListener('hidden.bs.modal', () => {
                UI.resetModalForm('userModal', 'userForm');
            });
        }
    }

    function setupRealtimeValidation() {
        Validation.setupRealtimeValidation('userForm', Validation.schemas.user);
    }

    function openUserModal(userId = null) {
        const modal = document.getElementById('userModal');
        const modalTitle = document.getElementById('userModalLabel');
        const form = document.getElementById('userForm');

        if (!modal || !modalTitle || !form) return;

        // Limpiar form
        form.reset();
        Validation.clearFormValidation(form);

        if (userId) {
            // Modo edición
            const user = Storage.getUserById(userId);
            if (!user) {
                UI.showErrorToast('Usuario no encontrado');
                return;
            }

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
            // Modo creación
            modalTitle.innerHTML = '<i class="fas fa-user-plus me-2"></i>Agregar Usuario';
            document.getElementById('userStatus').value = 'active';
        }

        UI.showModal('userModal');
    }

    function saveUser() {
        // Validar formulario
        const validation = Validation.validateForm('userForm', Validation.schemas.user);
        
        if (!validation.isValid) {
            UI.showErrorToast('Por favor, corrige los errores en el formulario');
            return;
        }

        const userId = document.getElementById('userId').value;
        const userData = {
            name: Validation.sanitizeInput(document.getElementById('userName').value),
            email: document.getElementById('userEmail').value.toLowerCase(),
            phone: document.getElementById('userPhone').value.replace(/\D/g, ''),
            affiliationType: document.getElementById('userAffiliation').value,
            classTime: document.getElementById('userClassTime').value,
            status: document.getElementById('userStatus').value,
            notes: Validation.sanitizeInput(document.getElementById('userNotes').value)
        };

        // Validación adicional
        const customValidation = Validation.validateUserData({
            ...userData,
            userId
        });

        if (!customValidation.isValid) {
            UI.showErrorToast(customValidation.errors.join(', '));
            return;
        }

        UI.setButtonLoading('saveUserBtn', true);

        setTimeout(() => {
            try {
                if (userId) {
                    // Actualizar
                    Storage.updateUser(userId, userData);
                    UI.showSuccessToast('Usuario actualizado exitosamente');
                } else {
                    // Crear nuevo
                    Storage.addUser(userData);
                    UI.showSuccessToast('Usuario agregado exitosamente');
                }

                UI.hideModal('userModal');
                renderUsers();
                
                // Actualizar dashboard si estamos en esa pestaña
                if (window.Dashboard) {
                    Dashboard.updateStats();
                }
            } catch (error) {
                UI.showErrorToast('Error al guardar usuario: ' + error.message);
            } finally {
                UI.setButtonLoading('saveUserBtn', false);
            }
        }, 500);
    }

    function deleteUser(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;

        UI.showConfirmModal(
            'Eliminar Usuario',
            `¿Estás seguro de eliminar a ${user.name}? Esta acción no se puede deshacer. También se eliminarán todos los registros de asistencia y pagos asociados.`,
            () => {
                UI.showLoading('Eliminando usuario...');
                
                setTimeout(() => {
                    Storage.deleteUser(userId);
                    UI.showSuccessToast('Usuario eliminado exitosamente');
                    renderUsers();
                    
                    if (window.Dashboard) {
                        Dashboard.updateStats();
                    }
                    
                    UI.hideLoading();
                }, 500);
            },
            true
        );
    }

    function renderUsers() {
        const users = Storage.getUsers();
        
        // Aplicar filtros
        filteredUsers = users.filter(user => {
            let matches = true;

            // Filtro de búsqueda
            if (searchTerm) {
                const searchableText = `${user.name} ${user.email} ${user.phone}`.toLowerCase();
                matches = matches && searchableText.includes(searchTerm);
            }

            // Filtro de estado
            if (statusFilter) {
                matches = matches && user.status === statusFilter;
            }

            // Filtro de afiliación
            if (affiliationFilter) {
                matches = matches && user.affiliationType === affiliationFilter;
            }

            return matches;
        });

        // Ordenar por nombre
        filteredUsers.sort((a, b) => a.name.localeCompare(b.name));

        // Paginación
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedUsers = filteredUsers.slice(start, end);

        renderUsersList(paginatedUsers);
        renderUsersPagination();
    }

    function renderUsersList(users) {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        if (users.length === 0) {
            UI.showEmptyState('usersList', 
                searchTerm || statusFilter || affiliationFilter 
                    ? 'No se encontraron usuarios con los filtros aplicados'
                    : 'No hay usuarios registrados. Agrega el primero.',
                'fa-users'
            );
            return;
        }

        tbody.innerHTML = users.map((user, index) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
            const statusBadge = UI.getStatusBadge(user.status);
            
            return `
                <tr>
                    <td>${globalIndex}</td>
                    <td><strong>${Utils.escapeHtml(user.name)}</strong></td>
                    <td>${Utils.escapeHtml(user.email)}</td>
                    <td>${Utils.formatPhone(user.phone)}</td>
                    <td><span class="badge bg-primary">${user.affiliationType}</span></td>
                    <td>${user.classTime || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-info me-1" onclick="Users.editUser('${user.id}')" 
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Users.deleteUser('${user.id}')" 
                                title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderUsersPagination() {
        UI.renderPagination(
            'usersPagination',
            filteredUsers.length,
            currentPage,
            itemsPerPage,
            (page) => {
                currentPage = page;
                renderUsers();
                UI.scrollToTop();
            }
        );
    }

    function getAllUsers() {
        return Storage.getUsers();
    }

    function getActiveUsers() {
        return Storage.getUsers().filter(u => u.status === 'active');
    }

    function getUsersForSelect() {
        const users = getActiveUsers();
        return users.sort((a, b) => a.name.localeCompare(b.name));
    }

    // API Pública
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

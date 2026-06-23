/**
 * Módulo de Interfaz de Usuario
 * Gestión de notificaciones, modales, loading states y feedback visual
 */

const UI = (() => {
    let loadingOverlay = null;
    let confirmCallback = null;

    // Inicializar elementos de UI
    function initialize() {
        loadingOverlay = document.getElementById('loadingOverlay');
        setupConfirmModal();
        setupThemeToggle();
        applyTheme();
    }

    // ===== TOAST NOTIFICATIONS =====

    function showToast(message, type = 'info', duration = 3000) {
        const settings = Storage.getSettings();
        if (!settings.notifications) return;

        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastId = 'toast-' + Date.now();
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const titles = {
            success: 'Éxito',
            error: 'Error',
            warning: 'Advertencia',
            info: 'Información'
        };

        const toastHTML = `
            <div id="${toastId}" class="toast ${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas ${icons[type]} me-2"></i>
                    <strong class="me-auto">${titles[type]}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${Utils.escapeHtml(message)}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const bsToast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: duration
        });

        bsToast.show();

        // Remover del DOM después de ocultarse
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    function showSuccessToast(message) {
        showToast(message, 'success');
    }

    function showErrorToast(message) {
        showToast(message, 'error', 5000);
    }

    function showWarningToast(message) {
        showToast(message, 'warning', 4000);
    }

    function showInfoToast(message) {
        showToast(message, 'info');
    }

    // ===== LOADING STATES =====

    function showLoading(message = 'Cargando...') {
        if (!loadingOverlay) return;
        
        const textElement = loadingOverlay.querySelector('p');
        if (textElement) {
            textElement.textContent = message;
        }
        
        loadingOverlay.classList.remove('hide');
    }

    function hideLoading() {
        if (!loadingOverlay) return;
        
        setTimeout(() => {
            loadingOverlay.classList.add('hide');
        }, 300); // Pequeño delay para suavidad
    }

    // Loading en botones
    function setButtonLoading(buttonId, loading = true) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Procesando...
            `;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    // ===== MODAL DE CONFIRMACIÓN =====

    function setupConfirmModal() {
        const confirmBtn = document.getElementById('confirmActionBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (confirmCallback) {
                    confirmCallback();
                    confirmCallback = null;
                }
                hideConfirmModal();
            });
        }
    }

    function showConfirmModal(title, message, callback, danger = false) {
        const modal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('confirmModalLabel');
        const modalBody = document.getElementById('confirmModalBody');
        const confirmBtn = document.getElementById('confirmActionBtn');
        
        if (!modal || !modalTitle || !modalBody || !confirmBtn) return;

        modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${title}`;
        modalBody.textContent = message;
        
        // Cambiar estilo del botón según el tipo
        if (danger) {
            confirmBtn.className = 'btn btn-danger';
        } else {
            confirmBtn.className = 'btn btn-primary';
        }

        confirmCallback = callback;
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    function hideConfirmModal() {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
    }

    // ===== GESTIÓN DE MODALES =====

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
    }

    // Resetear formulario en modal
    function resetModalForm(modalId, formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            Validation.clearFormValidation(form);
        }
    }

    // ===== GESTIÓN DE TABS =====

    function switchTab(tabId) {
        const tab = document.querySelector(`[data-bs-target="#${tabId}"]`);
        if (tab) {
            const bsTab = new bootstrap.Tab(tab);
            bsTab.show();
        }
    }

    // ===== TEMA (DARK/LIGHT) =====

    function setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeSelect = document.getElementById('themeSelect');

        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                setTheme(e.target.value);
            });
        }
    }

    function toggleTheme() {
        const currentTheme = Storage.getSetting('theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        Storage.updateSettings({ theme });
        
        // Actualizar icono del botón
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }

        // Actualizar select
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    function applyTheme() {
        const theme = Storage.getSetting('theme') || 'dark';
        setTheme(theme);
    }

    // ===== PAGINACIÓN =====

    function renderPagination(containerId, totalItems, currentPage, itemsPerPage, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        
        // Botón anterior
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Páginas
        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        if (startPage > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
            `;
            if (startPage > 2) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>
            `;
        }

        // Botón siguiente
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        container.innerHTML = html;

        // Event listeners
        container.querySelectorAll('a.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    onPageChange(page);
                }
            });
        });
    }

    // ===== ANIMACIONES =====

    function animateElements() {
        const elements = document.querySelectorAll('[data-animate]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });

        elements.forEach(el => {
            el.style.opacity = '0';
            observer.observe(el);
        });
    }

    // ===== BÚSQUEDA Y FILTROS =====

    function highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ===== EMPTY STATES =====

    function showEmptyState(containerId, message, icon = 'fa-inbox') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <tr>
                <td colspan="20" class="text-center py-5">
                    <i class="fas ${icon} fa-3x text-muted mb-3"></i>
                    <p class="text-muted">${message}</p>
                </td>
            </tr>
        `;
    }

    // ===== BADGES Y ESTADOS =====

    function getStatusBadge(status) {
        const badges = {
            active: '<span class="badge bg-success">Activo</span>',
            inactive: '<span class="badge bg-danger">Inactivo</span>',
            presente: '<span class="badge bg-success">Presente</span>',
            ausente: '<span class="badge bg-danger">Ausente</span>'
        };
        return badges[status] || status;
    }

    // ===== COPIAR AL PORTAPAPELES =====

    async function copyToClipboard(text, successMessage = 'Copiado al portapapeles') {
        const success = await Utils.copyToClipboard(text);
        if (success) {
            showSuccessToast(successMessage);
        } else {
            showErrorToast('No se pudo copiar al portapapeles');
        }
    }

    // ===== SCROLL =====

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            Utils.smoothScrollTo(element);
        }
    }

    // ===== ACTUALIZAR CONTADORES =====

    function updateCounter(elementId, value, animated = true) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (animated) {
            const start = parseInt(element.textContent) || 0;
            const end = parseInt(value);
            const duration = 500;
            const steps = 20;
            const stepValue = (end - start) / steps;
            const stepDuration = duration / steps;

            let current = start;
            const timer = setInterval(() => {
                current += stepValue;
                if ((stepValue > 0 && current >= end) || (stepValue < 0 && current <= end)) {
                    element.textContent = end;
                    clearInterval(timer);
                } else {
                    element.textContent = Math.round(current);
                }
            }, stepDuration);
        } else {
            element.textContent = value;
        }
    }

    // API Pública
    return {
        // Inicialización
        initialize,
        
        // Toast
        showToast,
        showSuccessToast,
        showErrorToast,
        showWarningToast,
        showInfoToast,
        
        // Loading
        showLoading,
        hideLoading,
        setButtonLoading,
        
        // Modales
        showModal,
        hideModal,
        resetModalForm,
        showConfirmModal,
        hideConfirmModal,
        
        // Tabs
        switchTab,
        
        // Tema
        toggleTheme,
        setTheme,
        applyTheme,
        
        // Paginación
        renderPagination,
        
        // Animaciones
        animateElements,
        
        // Utilidades
        highlightSearchTerm,
        showEmptyState,
        getStatusBadge,
        copyToClipboard,
        scrollToTop,
        scrollToElement,
        updateCounter
    };
})();

// Exponer globalmente
window.UI = UI;

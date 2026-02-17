/**
 * Módulo de Autenticación
 * Login simple con contraseña almacenada en localStorage
 */
const Auth = (() => {
    const LS_AUTH_KEY = 'box23_auth_session';
    const LS_PASSWORD_KEY = 'box23_password';
    const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 horas en ms
    
    const DEFAULT_PASSWORD = 'box23admin';
    
    let isInitializing = false; // Flag para prevenir doble inicialización

    function initialize() {
        if (isAuthenticated()) {
            showApp();
            // Setup cambio de contraseña después de cargar la app
            setTimeout(() => setupPasswordChange(), 100);
            return true;
        }
        
        showLogin();
        setupLoginListeners();
        return false;
    }

    function setupLoginListeners() {
        const form = document.getElementById('loginForm');
        const input = document.getElementById('loginPassword');
        const btn = document.getElementById('loginBtn');

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            attemptLogin();
        });

        // El botón ya es type="submit" así que dispara el form submit
        // No necesitamos listener adicional en el botón

        input?.focus();
    }

    function setupPasswordChange() {
        const btn = document.getElementById('changePasswordBtn');
        btn?.addEventListener('click', handlePasswordChange);
    }

    function handlePasswordChange() {
        const currentInput  = document.getElementById('currentPassword');
        const newInput      = document.getElementById('newPassword');
        const confirmInput  = document.getElementById('confirmPassword');

        const current  = currentInput?.value || '';
        const newPass  = newInput?.value || '';
        const confirm  = confirmInput?.value || '';

        if (!current || !newPass || !confirm) {
            if (window.UI) UI.showErrorToast('Completa todos los campos');
            return;
        }

        if (newPass.length < 4) {
            if (window.UI) UI.showErrorToast('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        if (newPass !== confirm) {
            if (window.UI) UI.showErrorToast('Las contraseñas no coinciden');
            return;
        }

        const savedPassword = getSavedPassword();
        if (current !== savedPassword) {
            if (window.UI) UI.showErrorToast('Contraseña actual incorrecta');
            return;
        }

        if (changePassword(newPass)) {
            if (window.UI) UI.showSuccessToast('✓ Contraseña actualizada exitosamente');
            if (currentInput)  currentInput.value  = '';
            if (newInput)      newInput.value      = '';
            if (confirmInput)  confirmInput.value  = '';
        }
    }

    function attemptLogin() {
        const input = document.getElementById('loginPassword');
        const password = input?.value || '';
        const errorEl = document.getElementById('loginError');

        if (!password) {
            showError('Ingresa la contraseña');
            return;
        }

        const savedPassword = getSavedPassword();

        if (password === savedPassword) {
            saveSession();
            hideLogin();
            setTimeout(async () => {
                if (isInitializing) {
                    console.log('Auth: Inicialización ya en progreso, ignorando...');
                    return;
                }
                isInitializing = true;
                
                showApp();
                setupPasswordChange();
                
                console.log('Auth: Login exitoso, inicializando app...');
                if (window.App && window.App.initializeApp) {
                    await window.App.initializeApp();
                    console.log('Auth: App inicializada correctamente');
                } else {
                    console.error('Auth: App.initializeApp no disponible');
                }
                
                isInitializing = false;
            }, 300);
            if (errorEl) errorEl.textContent = '';
        } else {
            showError('Contraseña incorrecta');
            input.value = '';
            input.focus();
            const loginBox = document.querySelector('.login-box');
            loginBox?.classList.add('shake');
            setTimeout(() => loginBox?.classList.remove('shake'), 500);
        }
    }

    function showError(message) {
        const errorEl = document.getElementById('loginError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    function getSavedPassword() {
        return localStorage.getItem(LS_PASSWORD_KEY) || DEFAULT_PASSWORD;
    }

    function saveSession() {
        const session = {
            timestamp: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        };
        localStorage.setItem(LS_AUTH_KEY, JSON.stringify(session));
    }

    function isAuthenticated() {
        try {
            const session = JSON.parse(localStorage.getItem(LS_AUTH_KEY));
            if (!session) return false;
            return Date.now() < session.expiresAt;
        } catch {
            return false;
        }
    }

    function showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    function hideLogin() {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => {
                loginScreen.style.display = 'none';
            }, 300);
        }
    }

    function showApp() {
        const appContainer = document.getElementById('appContainer');
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) {
            appContainer.style.display = 'block';
            appContainer.style.opacity = '0';
            setTimeout(() => {
                appContainer.style.opacity = '1';
            }, 50);
        }
    }

    function logout() {
        localStorage.removeItem(LS_AUTH_KEY);
        location.reload();
    }

    function changePassword(newPassword) {
        if (!newPassword || newPassword.length < 4) {
            console.error('La contraseña debe tener al menos 4 caracteres');
            return false;
        }
        localStorage.setItem(LS_PASSWORD_KEY, newPassword);
        console.log('✓ Contraseña actualizada');
        return true;
    }

    function resetPassword() {
        localStorage.removeItem(LS_PASSWORD_KEY);
        console.log(`✓ Contraseña reseteada a: ${DEFAULT_PASSWORD}`);
    }

    return {
        initialize,
        logout,
        changePassword,
        resetPassword,
        isAuthenticated
    };
})();

window.Auth = Auth;

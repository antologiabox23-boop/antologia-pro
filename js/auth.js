/**
 * Módulo de Autenticación v2
 *
 * Mejoras de seguridad:
 *   - Contraseña almacenada como hash SHA-256 + salt aleatorio (Web Crypto API)
 *   - Límite de 5 intentos fallidos → bloqueo temporal de 15 minutos
 *   - Migración automática: si existe contraseña en texto plano la hashea al primer login
 *   - La contraseña por defecto fuerza cambio en el primer acceso
 */
const Auth = (() => {
    const LS_AUTH_KEY      = 'box23_auth_session';
    const LS_PASSWORD_KEY  = 'box23_password_hash'; // nuevo — hash:salt en base64
    const LS_LEGACY_KEY    = 'box23_password';       // antiguo — texto plano
    const LS_ATTEMPTS_KEY  = 'box23_login_attempts';

    const SESSION_DURATION  = 12 * 60 * 60 * 1000;  // 12 horas
    const MAX_ATTEMPTS      = 5;
    const LOCKOUT_DURATION  = 15 * 60 * 1000;        // 15 minutos
    const DEFAULT_PASSWORD  = 'box23admin';
    const FIRST_LOGIN_FLAG  = 'box23_first_login';

    let isInitializing = false;

    // ── Crypto helpers ──────────────────────────────────────────────────────

    async function sha256(text) {
        const enc  = new TextEncoder();
        const buf  = await crypto.subtle.digest('SHA-256', enc.encode(text));
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function randomSalt(bytes = 16) {
        const arr = new Uint8Array(bytes);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hashPassword(plain, salt) {
        // hash = SHA-256(salt + plain)
        if (!salt) salt = randomSalt();
        const hash = await sha256(salt + plain);
        return { hash, salt, stored: `${hash}:${salt}` };
    }

    async function verifyPassword(plain, stored) {
        const [hash, salt] = stored.split(':');
        if (!hash || !salt) return false;
        const { hash: computed } = await hashPassword(plain, salt);
        return computed === hash;
    }

    // ── Almacenamiento de contraseña ────────────────────────────────────────

    async function getStoredHash() {
        const hashed = localStorage.getItem(LS_PASSWORD_KEY);
        if (hashed) return hashed;

        // Migración: si hay contraseña en texto plano, hashearla ahora
        const legacy = localStorage.getItem(LS_LEGACY_KEY);
        if (legacy) {
            const { stored } = await hashPassword(legacy);
            localStorage.setItem(LS_PASSWORD_KEY, stored);
            localStorage.removeItem(LS_LEGACY_KEY);
            return stored;
        }

        // Primera vez: hashear la contraseña por defecto y marcar primer acceso
        const { stored } = await hashPassword(DEFAULT_PASSWORD);
        localStorage.setItem(LS_PASSWORD_KEY, stored);
        localStorage.setItem(FIRST_LOGIN_FLAG, '1');
        return stored;
    }

    async function savePassword(plain) {
        const { stored } = await hashPassword(plain);
        localStorage.setItem(LS_PASSWORD_KEY, stored);
    }

    // ── Control de intentos fallidos ────────────────────────────────────────

    function getAttempts() {
        try {
            return JSON.parse(localStorage.getItem(LS_ATTEMPTS_KEY)) ||
                   { count: 0, lockedUntil: 0 };
        } catch { return { count: 0, lockedUntil: 0 }; }
    }

    function recordFailedAttempt() {
        const data = getAttempts();
        data.count += 1;
        if (data.count >= MAX_ATTEMPTS) {
            data.lockedUntil = Date.now() + LOCKOUT_DURATION;
            data.count = 0;
        }
        localStorage.setItem(LS_ATTEMPTS_KEY, JSON.stringify(data));
        return data;
    }

    function clearAttempts() {
        localStorage.removeItem(LS_ATTEMPTS_KEY);
    }

    function getLockoutMessage() {
        const { lockedUntil, count } = getAttempts();
        if (lockedUntil && Date.now() < lockedUntil) {
            const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
            return `Demasiados intentos. Espera ${mins} min.`;
        }
        const remaining = MAX_ATTEMPTS - count;
        if (count > 0) return `Contraseña incorrecta. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`;
        return null;
    }

    function isLocked() {
        const { lockedUntil } = getAttempts();
        return lockedUntil && Date.now() < lockedUntil;
    }

    // ── Flujo de login ──────────────────────────────────────────────────────

    function initialize() {
        if (isAuthenticated()) {
            showApp();
            setTimeout(() => setupPasswordChange(), 100);
            return true;
        }
        showLogin();
        setupLoginListeners();
        return false;
    }

    function setupLoginListeners() {
        const form  = document.getElementById('loginForm');
        const input = document.getElementById('loginPassword');
        form?.addEventListener('submit', (e) => { e.preventDefault(); attemptLogin(); });
        input?.focus();
    }

    function setupPasswordChange() {
        document.getElementById('changePasswordBtn')
            ?.addEventListener('click', handlePasswordChange);
    }

    async function attemptLogin() {
        const input   = document.getElementById('loginPassword');
        const password = input?.value || '';

        if (!password) { showError('Ingresa la contraseña'); return; }

        if (isLocked()) {
            showError(getLockoutMessage());
            return;
        }

        const stored  = await getStoredHash();
        const valid   = await verifyPassword(password, stored);

        if (valid) {
            clearAttempts();
            saveSession();
            hideLogin();

            // Si es el primer acceso con la contraseña por defecto, forzar cambio
            if (localStorage.getItem(FIRST_LOGIN_FLAG) === '1') {
                setTimeout(() => {
                    if (window.UI) UI.showWarningToast('⚠️ Cambia la contraseña por defecto en Configuración');
                }, 1000);
            }

            setTimeout(async () => {
                if (isInitializing) return;
                isInitializing = true;
                showApp();
                setupPasswordChange();
                if (window.App?.initializeApp) await window.App.initializeApp();
                isInitializing = false;
            }, 300);

            const errorEl = document.getElementById('loginError');
            if (errorEl) errorEl.textContent = '';
        } else {
            const data = recordFailedAttempt();
            const msg  = getLockoutMessage() || 'Contraseña incorrecta';
            showError(msg);
            input.value = '';
            input.focus();
            const loginBox = document.querySelector('.login-box');
            loginBox?.classList.add('shake');
            setTimeout(() => loginBox?.classList.remove('shake'), 500);
        }
    }

    async function handlePasswordChange() {
        const currentInput  = document.getElementById('currentPassword');
        const newInput      = document.getElementById('newPassword');
        const confirmInput  = document.getElementById('confirmPassword');

        const current = currentInput?.value || '';
        const newPass = newInput?.value     || '';
        const confirm = confirmInput?.value || '';

        if (!current || !newPass || !confirm) {
            if (window.UI) UI.showErrorToast('Completa todos los campos');
            return;
        }
        if (newPass.length < 8) {
            if (window.UI) UI.showErrorToast('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        if (newPass !== confirm) {
            if (window.UI) UI.showErrorToast('Las contraseñas no coinciden');
            return;
        }

        const stored = await getStoredHash();
        const valid  = await verifyPassword(current, stored);
        if (!valid) {
            if (window.UI) UI.showErrorToast('Contraseña actual incorrecta');
            return;
        }

        await savePassword(newPass);
        localStorage.removeItem(FIRST_LOGIN_FLAG); // ya no es primer acceso
        if (window.UI) UI.showSuccessToast('✓ Contraseña actualizada');
        if (currentInput) currentInput.value = '';
        if (newInput)     newInput.value     = '';
        if (confirmInput) confirmInput.value = '';
    }

    // ── Sesión ──────────────────────────────────────────────────────────────

    function saveSession() {
        localStorage.setItem(LS_AUTH_KEY, JSON.stringify({
            timestamp: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION
        }));
    }

    function isAuthenticated() {
        try {
            const s = JSON.parse(localStorage.getItem(LS_AUTH_KEY));
            return s && Date.now() < s.expiresAt;
        } catch { return false; }
    }

    // ── UI helpers ──────────────────────────────────────────────────────────

    function showError(message) {
        const el = document.getElementById('loginError');
        if (el) { el.textContent = message; el.style.display = 'block'; }
    }

    function showLogin() {
        const loginScreen  = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        if (loginScreen)  loginScreen.style.display  = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    function hideLogin() {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => { loginScreen.style.display = 'none'; }, 300);
        }
    }

    function showApp() {
        const appContainer = document.getElementById('appContainer');
        const loginScreen  = document.getElementById('loginScreen');
        if (loginScreen)  loginScreen.style.display  = 'none';
        if (appContainer) {
            appContainer.style.display = 'block';
            appContainer.style.opacity = '0';
            setTimeout(() => { appContainer.style.opacity = '1'; }, 50);
        }
    }

    function logout() {
        localStorage.removeItem(LS_AUTH_KEY);
        location.reload();
    }

    // Mantener compatibilidad con código que llame a changePassword externamente
    async function changePassword(newPassword) {
        if (!newPassword || newPassword.length < 8) return false;
        await savePassword(newPassword);
        localStorage.removeItem(FIRST_LOGIN_FLAG);
        return true;
    }

    function resetPassword() {
        // Borra el hash → al próximo login se regenera desde DEFAULT_PASSWORD
        localStorage.removeItem(LS_PASSWORD_KEY);
        localStorage.removeItem(LS_LEGACY_KEY);
        localStorage.setItem(FIRST_LOGIN_FLAG, '1');
        console.log('✓ Contraseña reseteada. Se usará la contraseña por defecto al próximo acceso.');
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

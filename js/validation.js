/**
 * Módulo de Validación - CORRECCIÓN COMPLETA
 */

const Validation = (() => {

    const rules = {
        required:  (v)       => v !== null && v !== undefined && String(v).trim() !== '',
        email:     (v)       => { if (!v) return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
        phone:     (v)       => { if (!v) return true; return /^\d{10}$/.test(String(v).replace(/\D/g,'')); },
        minLength: (v, min)  => { if (!v) return true; return String(v).length >= min; },
        maxLength: (v, max)  => { if (!v) return true; return String(v).length <= max; },
        min:       (v, min)  => { if (!v) return true; return parseFloat(v) >= min; },
        max:       (v, max)  => { if (!v) return true; return parseFloat(v) <= max; },
        number:    (v)       => { if (!v) return true; return !isNaN(parseFloat(v)) && isFinite(v); },
        positive:  (v)       => { if (!v) return true; return parseFloat(v) > 0; },
        pattern:   (v, pat)  => { if (!v) return true; return new RegExp(pat).test(v); },
        date:      (v)       => { if (!v) return true; return !isNaN(new Date(v).getTime()); },
        pastDate:  (v)       => {
            if (!v) return true;
            const d = new Date(v); const t = new Date(); t.setHours(0,0,0,0); return d <= t;
        }
    };

    const errorMessages = {
        required:  'Este campo es obligatorio',
        email:     'Ingresa un email válido (ejemplo@correo.com)',
        phone:     'Ingresa un teléfono de 10 dígitos',
        minLength: 'Debe tener al menos {min} caracteres',
        maxLength: 'No debe exceder {max} caracteres',
        min:       'El valor mínimo es {min}',
        max:       'El valor máximo es {max}',
        number:    'Debe ser un número válido',
        positive:  'Debe ser un número mayor a 0',
        pattern:   'Formato inválido',
        date:      'Fecha inválida',
        pastDate:  'La fecha no puede ser futura'
    };

    // FIX: siempre devuelve string, nunca undefined
    function formatErrorMessage(message, params) {
        const msg = (typeof message === 'string' && message) ? message : 'Valor inválido';
        if (!params || params.length === 0) return msg;
        let out = msg;
        params.forEach((p, i) => { out = out.replace(i === 0 ? '{min}' : '{max}', p); });
        return out;
    }

    function validateField(value, validations) {
        for (const v of validations) {
            const { rule, params, message } = v;
            if (!rules[rule]) continue;
            const ok = params ? rules[rule](value, ...params) : rules[rule](value);
            if (!ok) {
                const raw = message || errorMessages[rule] || `Error: ${rule}`;
                return { isValid: false, errors: [formatErrorMessage(raw, params)] };
            }
        }
        return { isValid: true, errors: [] };
    }

    function markFieldInvalid(field, msg) {
        if (!field) return;
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        let fb = field.parentElement?.querySelector('.invalid-feedback');
        if (!fb) {
            fb = document.createElement('div');
            fb.className = 'invalid-feedback';
            field.parentElement?.appendChild(fb);
        }
        fb.textContent = msg || 'Valor inválido';
        fb.style.display = 'block';
    }

    function markFieldValid(field) {
        if (!field) return;
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        const fb = field.parentElement?.querySelector('.invalid-feedback');
        if (fb) fb.style.display = 'none';
    }

    function clearFieldValidation(field) {
        if (!field) return;
        field.classList.remove('is-invalid', 'is-valid');
        const fb = field.parentElement?.querySelector('.invalid-feedback');
        if (fb) fb.style.display = 'none';
    }

    function clearFormValidation(form) {
        if (!form) return;
        form.querySelectorAll('.form-control, .form-select, textarea')
            .forEach(f => clearFieldValidation(f));
    }

    function validateForm(formId, schema) {
        const form = document.getElementById(formId);
        if (!form) return { isValid: false, errors: {} };
        clearFormValidation(form);
        let isValid = true;
        const errors = {};
        for (const [fieldName, validations] of Object.entries(schema)) {
            const field = form.querySelector(`#${fieldName}`);
            if (!field) continue;
            const result = validateField(field.value, validations);
            if (!result.isValid) {
                isValid = false;
                errors[fieldName] = result.errors;
                markFieldInvalid(field, result.errors[0]);
            } else {
                markFieldValid(field);
            }
        }
        return { isValid, errors };
    }

    function setupRealtimeValidation(formId, schema) {
        const form = document.getElementById(formId);
        if (!form) return;
        for (const [fieldName, validations] of Object.entries(schema)) {
            const field = form.querySelector(`#${fieldName}`);
            if (!field) continue;
            field.addEventListener('blur', () => {
                const r = validateField(field.value, validations);
                if (!r.isValid) markFieldInvalid(field, r.errors[0]);
                else if (field.value) markFieldValid(field);
            });
            field.addEventListener('input', () => {
                if (field.classList.contains('is-invalid')) clearFieldValidation(field);
            });
        }
    }

    // Valida unicidad de documento y teléfono
    function validateUserData({ userDocument, userPhone, userId }) {
        const errors = [];
        const users = Storage.getUsers();
        const currentId  = (userId || '').trim();
        const docNorm    = (userDocument || '').trim();
        const phoneNorm  = (userPhone || '').replace(/\D/g, '');

        if (docNorm && users.some(u => (u.document||'').trim() === docNorm && u.id !== currentId)) {
            errors.push('El documento ya está registrado por otro usuario');
        }
        if (phoneNorm && users.some(u => (u.phone||'').replace(/\D/g,'') === phoneNorm && u.id !== currentId)) {
            errors.push('El teléfono ya está registrado por otro usuario');
        }
        return { isValid: errors.length === 0, errors };
    }

    function validatePaymentData(data) {
        const errors = [];
        if (!data.userId) errors.push('Selecciona un usuario');
        else if (!Storage.getUserById(data.userId)) errors.push('Usuario no encontrado');
        if (isNaN(data.amount) || data.amount <= 0) errors.push('El monto debe ser mayor a 0');
        if (data.amount > 50000000) errors.push('El monto supera $50.000.000. Verifica el valor ingresado.');
        return { isValid: errors.length === 0, errors };
    }

    function sanitizeInput(input) {
        const str = typeof input === 'string' ? input : String(input || '');
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .trim();
    }

    const schemas = {
        user: {
            userName: [
                { rule: 'required' },
                { rule: 'minLength', params: [3], message: 'El nombre debe tener al menos 3 caracteres' },
                { rule: 'maxLength', params: [100], message: 'El nombre es demasiado largo' }
            ],
            userDocument: [
                { rule: 'required', message: 'Ingresa el número de documento' },
                { rule: 'minLength', params: [5], message: 'Documento muy corto' }
            ],
            userBirthdate: [
                { rule: 'required', message: 'Selecciona la fecha de nacimiento' },
                { rule: 'date' }
            ],
            userPhone:            [{ rule: 'required' }, { rule: 'phone' }],
            userEmergencyContact: [{ rule: 'required', message: 'Ingresa el contacto de emergencia' }],
            userEmergencyPhone:   [{ rule: 'required', message: 'Ingresa el teléfono de emergencia' }, { rule: 'phone' }],
            userClassTime:        [{ rule: 'required', message: 'Selecciona un horario' }],
            userAffiliation:      [{ rule: 'required', message: 'Selecciona un tipo de afiliación' }]
        },
        income: {
            incomeUser:   [{ rule: 'required', message: 'Selecciona un usuario' }],
            incomeType:   [{ rule: 'required', message: 'Selecciona un tipo de pago' }],
            incomeAmount: [{ rule: 'required' }, { rule: 'number' }, { rule: 'positive', message: 'El monto debe ser mayor a 0' }],
            incomeMethod: [{ rule: 'required', message: 'Selecciona un método de pago' }],
            incomeDate:   [{ rule: 'required' }, { rule: 'date' }, { rule: 'pastDate' }]
        }
    };

    return {
        validateField, validateForm, validateUserData, validatePaymentData,
        setupRealtimeValidation, clearFieldValidation, clearFormValidation,
        markFieldInvalid, markFieldValid, sanitizeInput, schemas
    };
})();

window.Validation = Validation;

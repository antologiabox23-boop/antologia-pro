/**
 * Módulo de Validación
 * Validación de formularios y datos con feedback visual
 */

const Validation = (() => {
    
    // Reglas de validación
    const rules = {
        required: (value) => {
            return value !== null && value !== undefined && value.toString().trim() !== '';
        },
        
        email: (value) => {
            if (!value) return true; // Solo validar si hay valor
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value);
        },
        
        phone: (value) => {
            if (!value) return true;
            const phoneRegex = /^\d{10}$/;
            const cleaned = value.toString().replace(/\D/g, '');
            return phoneRegex.test(cleaned);
        },
        
        minLength: (value, min) => {
            if (!value) return true;
            return value.toString().length >= min;
        },
        
        maxLength: (value, max) => {
            if (!value) return true;
            return value.toString().length <= max;
        },
        
        min: (value, min) => {
            if (!value) return true;
            return parseFloat(value) >= min;
        },
        
        max: (value, max) => {
            if (!value) return true;
            return parseFloat(value) <= max;
        },
        
        number: (value) => {
            if (!value) return true;
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        
        integer: (value) => {
            if (!value) return true;
            return Number.isInteger(Number(value));
        },
        
        positive: (value) => {
            if (!value) return true;
            return parseFloat(value) > 0;
        },
        
        pattern: (value, pattern) => {
            if (!value) return true;
            const regex = new RegExp(pattern);
            return regex.test(value);
        },
        
        date: (value) => {
            if (!value) return true;
            const date = new Date(value);
            return !isNaN(date.getTime());
        },
        
        futureDate: (value) => {
            if (!value) return true;
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date >= today;
        },
        
        pastDate: (value) => {
            if (!value) return true;
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date <= today;
        }
    };

    // Mensajes de error predeterminados
    const errorMessages = {
        required: 'Este campo es obligatorio',
        email: 'Ingresa un email válido',
        phone: 'Ingresa un teléfono válido de 10 dígitos',
        minLength: 'Debe tener al menos {min} caracteres',
        maxLength: 'No debe exceder {max} caracteres',
        min: 'El valor debe ser al menos {min}',
        max: 'El valor no debe exceder {max}',
        number: 'Debe ser un número válido',
        integer: 'Debe ser un número entero',
        positive: 'Debe ser un número positivo',
        pattern: 'Formato inválido',
        date: 'Fecha inválida',
        futureDate: 'La fecha debe ser futura',
        pastDate: 'La fecha debe ser pasada o actual'
    };

    // Validar un campo individual
    function validateField(value, validations) {
        const errors = [];
        
        for (const validation of validations) {
            const { rule, params, message } = validation;
            
            if (!rules[rule]) {
                console.warn(`Regla de validación '${rule}' no encontrada`);
                continue;
            }
            
            const isValid = params 
                ? rules[rule](value, ...params)
                : rules[rule](value);
            
            if (!isValid) {
                const errorMsg = message || errorMessages[rule];
                const formattedMsg = formatErrorMessage(errorMsg, params);
                errors.push(formattedMsg);
                break; // Solo mostrar el primer error
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Formatear mensaje de error con parámetros
    function formatErrorMessage(message, params) {
        if (!params) return message;
        
        let formatted = message;
        params.forEach((param, index) => {
            const placeholder = index === 0 ? '{min}' : '{max}';
            formatted = formatted.replace(placeholder, param);
        });
        
        return formatted;
    }

    // Validar formulario completo
    function validateForm(formId, validationSchema) {
        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Formulario ${formId} no encontrado`);
            return { isValid: false, errors: {} };
        }
        
        const errors = {};
        let isValid = true;
        
        // Limpiar validaciones previas
        clearFormValidation(form);
        
        // Validar cada campo según el schema
        for (const [fieldName, validations] of Object.entries(validationSchema)) {
            const field = form.querySelector(`#${fieldName}`);
            if (!field) continue;
            
            const value = field.value;
            const result = validateField(value, validations);
            
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

    // Marcar campo como inválido
    function markFieldInvalid(field, message) {
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        
        // Crear o actualizar mensaje de error
        let feedback = field.parentElement.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentElement.appendChild(feedback);
        }
        feedback.textContent = message;
        feedback.style.display = 'block';
    }

    // Marcar campo como válido
    function markFieldValid(field) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        
        const feedback = field.parentElement.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.style.display = 'none';
        }
    }

    // Limpiar validación de campo
    function clearFieldValidation(field) {
        field.classList.remove('is-invalid', 'is-valid');
        const feedback = field.parentElement.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.style.display = 'none';
        }
    }

    // Limpiar validación de formulario completo
    function clearFormValidation(form) {
        const fields = form.querySelectorAll('.form-control, .form-select');
        fields.forEach(field => clearFieldValidation(field));
    }

    // Validación en tiempo real
    function setupRealtimeValidation(formId, validationSchema) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        for (const [fieldName, validations] of Object.entries(validationSchema)) {
            const field = form.querySelector(`#${fieldName}`);
            if (!field) continue;
            
            // Validar al perder foco
            field.addEventListener('blur', () => {
                const value = field.value;
                const result = validateField(value, validations);
                
                if (!result.isValid) {
                    markFieldInvalid(field, result.errors[0]);
                } else if (value) { // Solo marcar como válido si hay valor
                    markFieldValid(field);
                }
            });
            
            // Limpiar validación al empezar a escribir
            field.addEventListener('input', () => {
                if (field.classList.contains('is-invalid')) {
                    clearFieldValidation(field);
                }
            });
        }
    }

    // Schemas de validación predefinidos
    const schemas = {
        user: {
            userName: [
                { rule: 'required' },
                { rule: 'minLength', params: [3], message: 'El nombre debe tener al menos 3 caracteres' },
                { rule: 'maxLength', params: [100] }
            ],
            userEmail: [
                { rule: 'required' },
                { rule: 'email' }
            ],
            userPhone: [
                { rule: 'required' },
                { rule: 'phone' }
            ],
            userAffiliation: [
                { rule: 'required' }
            ],
            userClassTime: [
                { rule: 'required' }
            ]
        },
        
        income: {
            incomeUser: [
                { rule: 'required', message: 'Selecciona un usuario' }
            ],
            incomeType: [
                { rule: 'required', message: 'Selecciona un tipo de pago' }
            ],
            incomeAmount: [
                { rule: 'required' },
                { rule: 'number' },
                { rule: 'positive', message: 'El monto debe ser mayor a 0' }
            ],
            incomeMethod: [
                { rule: 'required', message: 'Selecciona un método de pago' }
            ],
            incomeDate: [
                { rule: 'required' },
                { rule: 'date' },
                { rule: 'pastDate', message: 'La fecha no puede ser futura' }
            ]
        }
    };

    // Validaciones personalizadas para datos específicos
    function validateUserData(userData) {
        const errors = [];
        const users = Storage.getUsers();
        const currentId = userData.userId || '';   // vacío = usuario nuevo

        // Validar email único
        const emailExists = users.some(u =>
            u.email === userData.userEmail && u.id !== currentId
        );
        if (emailExists) errors.push('El email ya está registrado');

        // Validar teléfono único
        const phoneExists = users.some(u =>
            u.phone === userData.userPhone && u.id !== currentId
        );
        if (phoneExists) errors.push('El teléfono ya está registrado');

        return { isValid: errors.length === 0, errors };
    }

    function validatePaymentData(paymentData) {
        const errors = [];
        
        // Validar que el usuario existe
        const user = Storage.getUserById(paymentData.incomeUser);
        if (!user) {
            errors.push('Usuario no encontrado');
        }
        
        // Validar monto razonable (no más de $100,000)
        if (parseFloat(paymentData.incomeAmount) > 100000) {
            errors.push('El monto parece inusualmente alto. Verifica que sea correcto.');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Sanitizar datos de entrada
    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Remover scripts y HTML peligroso
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .trim();
    }

    // API Pública
    return {
        validateField,
        validateForm,
        validateUserData,
        validatePaymentData,
        setupRealtimeValidation,
        clearFieldValidation,
        clearFormValidation,
        markFieldInvalid,
        markFieldValid,
        sanitizeInput,
        schemas
    };
})();

// Exponer globalmente
window.Validation = Validation;

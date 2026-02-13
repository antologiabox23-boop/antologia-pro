/**
 * Utilidades Generales
 * Funciones helper reutilizables en toda la aplicación
 */

// Generador de UUID v4 para IDs únicos
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Formatear fecha para display
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// Formatear fecha y hora
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es-ES', options);
}

// Formatear moneda
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(num);
}

// Obtener fecha actual en formato YYYY-MM-DD
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Obtener fecha y hora actual
function getCurrentDateTime() {
    return new Date().toISOString();
}

// Calcular diferencia de días entre dos fechas
function daysDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Verificar si una fecha está en el pasado
function isPastDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

// Capitalizar primera letra
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Debounce para optimizar búsquedas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle para limitar ejecuciones
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Copiar texto al portapapeles
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Error al copiar:', err);
        return false;
    }
}

// Descargar archivo
function downloadFile(content, filename, contentType = 'application/json') {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Leer archivo como texto
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// Ordenar array de objetos por propiedad
function sortByProperty(arr, prop, ascending = true) {
    return [...arr].sort((a, b) => {
        const aVal = a[prop];
        const bVal = b[prop];
        
        if (typeof aVal === 'string') {
            return ascending 
                ? aVal.localeCompare(bVal) 
                : bVal.localeCompare(aVal);
        }
        
        return ascending ? aVal - bVal : bVal - aVal;
    });
}

// Filtrar array por múltiples criterios
function filterByMultipleCriteria(arr, criteria) {
    return arr.filter(item => {
        return Object.keys(criteria).every(key => {
            if (!criteria[key]) return true;
            const itemValue = String(item[key]).toLowerCase();
            const criteriaValue = String(criteria[key]).toLowerCase();
            return itemValue.includes(criteriaValue);
        });
    });
}

// Agrupar array por propiedad
function groupBy(arr, prop) {
    return arr.reduce((acc, item) => {
        const key = item[prop];
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {});
}

// Calcular porcentaje
function calculatePercentage(value, total) {
    if (!total || total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
}

// Validar email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validar teléfono (10 dígitos)
function isValidPhone(phone) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
}

// Formatear número de teléfono
function formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

// Generar color aleatorio
function getRandomColor() {
    const colors = [
        '#27F9D4', '#FF729F', '#F0F66E', '#7C77B9',
        '#1D8A99', '#F7934C', '#FFB347', '#25D366',
        '#10b981', '#f59e0b', '#ef4444', '#3b82f6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Animación suave de scroll
function smoothScrollTo(element) {
    if (!element) return;
    element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Verificar si elemento está visible en viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Wait/Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Obtener mes actual en formato YYYY-MM
function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Obtener primer y último día del mes
function getMonthRange(monthString) {
    const [year, month] = monthString.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
    };
}

// Exportar funciones
window.Utils = {
    generateUUID,
    formatDate,
    formatDateTime,
    formatCurrency,
    getCurrentDate,
    getCurrentDateTime,
    daysDifference,
    isPastDate,
    capitalize,
    escapeHtml,
    debounce,
    throttle,
    copyToClipboard,
    downloadFile,
    readFileAsText,
    sortByProperty,
    filterByMultipleCriteria,
    groupBy,
    calculatePercentage,
    isValidEmail,
    isValidPhone,
    formatPhone,
    getRandomColor,
    smoothScrollTo,
    isElementInViewport,
    sleep,
    getCurrentMonth,
    getMonthRange
};

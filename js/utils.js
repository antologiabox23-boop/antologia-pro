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
/**
 * Normaliza cualquier string de fecha a YYYY-MM-DD.
 * Maneja los formatos que Google Sheets puede devolver:
 *   - "2026-02-01"              (ISO estándar — ideal)
 *   - "01/02/2026"              (DD/MM/YYYY)
 *   - "Sun Feb 01 2026 00:00:00 GMT+0000" (Date.toString())
 *   - "2026-02-01T00:00:00.000Z"(ISO con hora)
 */
function normalizeDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // Ya es YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // ISO con hora: 2026-02-01T...
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

    // DD/MM/YYYY o DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;

    // MM/DD/YYYY (poco probable desde Sheets en es-CO, pero por si acaso)
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
        // Heurística: si el primer número > 12 es día, no mes
        if (parseInt(mdy[1]) > 12)
            return `${mdy[3]}-${mdy[2].padStart(2,'0')}-${mdy[1].padStart(2,'0')}`;
        return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
    }

    // Date.toString() del motor V8: "Sun Feb 01 2026 00:00:00 GMT..."
    const v8 = s.match(/\w+\s+(\w+)\s+(\d{1,2})\s+(\d{4})/);
    if (v8) {
        const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                        Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
        const m = months[v8[1]];
        if (m) return `${v8[3]}-${m}-${v8[2].padStart(2,'0')}`;
    }

    return null; // no reconocido
}

/**
 * Formatea una fecha para mostrar al usuario (sin problema de zona horaria).
 * Siempre parsea como fecha local, nunca como UTC.
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const iso = normalizeDate(dateString);
    if (!iso) return '-';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d); // local — sin conversión UTC
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const iso = normalizeDate(dateString);
    if (!iso) return '-';
    // Si tiene hora, usarla; si no, solo fecha
    const hasTime = String(dateString).includes('T') || String(dateString).includes(' ');
    if (hasTime) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return formatDate(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    return formatDate(dateString);
}

// Formatear moneda
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
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
    normalizeDate,
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

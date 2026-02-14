/**
 * Módulo WhatsApp
 * Mensajes automáticos: bienvenida, pago, recordatorios, cumpleaños
 */
const WhatsApp = (() => {
    const GYM_NAME = 'Antología Box23';
    const WA_GROUP_LINK = ''; // Pega aquí el enlace de tu grupo de WhatsApp

    function initialize() {
        setupEventListeners();
        checkBirthdays();
    }

    function setupEventListeners() {
        document.getElementById('waBirthdayCheck')?.addEventListener('click', checkBirthdays);
    }

    function buildUrl(phone, message) {
        const clean = (phone || '').replace(/\D/g, '');
        return `https://wa.me/57${clean}?text=${encodeURIComponent(message)}`;
    }

    function openWA(phone, message) {
        window.open(buildUrl(phone, message), '_blank');
    }

    // ── 1. Bienvenida + invitación grupo ────────────────────────────────

    function bienvenida(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const groupText = WA_GROUP_LINK ? `\n\nÚnete a nuestro grupo de WhatsApp: ${WA_GROUP_LINK}` : '';
        const msg = `¡Hola ${nombre}! 🎉\nBienvenido(a) a *${GYM_NAME}*. Nos alegra tenerte con nosotros.\n\nTu afiliación: *${user.affiliationType}*\nHorario: *${user.classTime || 'por confirmar'}*${groupText}\n\n💪 ¡Mucho éxito en tu proceso!`;
        openWA(user.phone, msg);
    }

    // ── 2. Confirmación de pago ─────────────────────────────────────────

    function confirmacionPago(paymentId) {
        const payment = Storage.getIncome().find(p => p.id === paymentId);
        if (!payment) return;
        const user    = Storage.getUserById(payment.userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const vigencia = payment.startDate && payment.endDate
            ? `\n📅 Vigencia: ${Utils.formatDate(payment.startDate)} al ${Utils.formatDate(payment.endDate)}`
            : '';
        const msg = `¡Hola ${nombre}! 👋\nHemos recibido tu pago correctamente. ✅\n\n💰 Monto: *${Utils.formatCurrency(payment.amount)}*\n📌 Tipo: *${payment.paymentType}*\n💳 Método: *${payment.paymentMethod}*${vigencia}\n\n¡Gracias por confiar en *${GYM_NAME}*! 🏋️`;
        openWA(user.phone, msg);
    }

    // ── 3. Recordatorio de pago pendiente ───────────────────────────────

    function recordatorioPago(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre  = user.name.split(' ')[0];
        const payment = Storage.getIncome()
            .filter(p => p.userId === userId && p.endDate)
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        const vencioEl = payment ? ` Tu última vigencia venció el *${Utils.formatDate(payment.endDate)}*.` : '';
        const msg = `¡Hola ${nombre}! 🏋️\nTe recordamos que tienes un pago pendiente en *${GYM_NAME}*.${vencioEl}\n\nPor favor acércate o comunícate con nosotros para renovar tu membresía y seguir disfrutando de tus clases. 💪\n\n¡Te esperamos!`;
        openWA(user.phone, msg);
    }

    // ── 4. Recordatorio inasistencia ────────────────────────────────────

    function recordatorioInasistencia(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const lastAttend = Storage.getAttendanceByUser(userId)
            .filter(a => a.status === 'presente')
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        const lastDate = lastAttend ? Utils.formatDate(lastAttend.date) : 'hace un tiempo';
        const msg = `Hola ${nombre}, ¡te extrañamos en ${GYM_NAME}! 👋\nHemos notado que no hemos tenido el gusto de verte desde el ${lastDate}.\n¿Todo bien? Esperamos que puedas regresar pronto a tus entrenamientos. Si hay algún inconveniente o necesitas ayuda, no dudes en contarnos.\n¡Quedamos atentos a cualquier inquietud!\n💪 El equipo de ${GYM_NAME}`;
        openWA(user.phone, msg);
    }

    // ── 5. Verificador de cumpleaños ────────────────────────────────────

    function checkBirthdays() {
        const today     = Utils.getCurrentDate();
        const todayMMDD = today.slice(5); // MM-DD
        const users     = Users.getActiveUsers();

        const birthdays = users.filter(u => {
            if (!u.birthdate) return false;
            return u.birthdate.slice(5) === todayMMDD;
        });

        const container = document.getElementById('birthdayList');
        if (!container) return;

        if (birthdays.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-3"><i class="fas fa-birthday-cake me-2"></i>Sin cumpleaños hoy</p>';
            return;
        }

        container.innerHTML = birthdays.map(u => {
            const nombre = u.name.split(' ')[0];
            const msg    = `¡Hola ${nombre}! 🎂🎉\nTodo el equipo de *${GYM_NAME}* te desea un feliz cumpleaños. 🎊\n\nEsperamos que este nuevo año de vida esté lleno de salud, energía y muchos logros en tus entrenamientos. 💪\n\n¡Que lo disfrutes mucho!`;
            return `<div class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <span><i class="fas fa-birthday-cake text-warning me-2"></i><strong>${Utils.escapeHtml(u.name)}</strong></span>
                <button class="btn btn-sm btn-success" onclick="WhatsApp.openWA('${u.phone}','${msg.replace(/'/g,"\\'")}')">
                    <i class="fab fa-whatsapp me-1"></i>Saludar
                </button>
            </div>`;
        }).join('');

        // Badge en el nav
        const badge = document.getElementById('birthdayBadge');
        if (badge) { badge.textContent = birthdays.length; badge.style.display = birthdays.length > 0 ? 'inline' : 'none'; }
    }

    // ── Renderizar tabla de usuarios con botones WA ─────────────────────

    function renderWAUsers() {
        const tbody = document.getElementById('waUsersList');
        if (!tbody) return;
        const users = Users.getActiveUsers().filter(u => u.affiliationType !== 'Entrenador(a)');

        tbody.innerHTML = users.map((u, i) => {
            const lastPay = Storage.getIncome()
                .filter(p => p.userId === u.id)
                .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0];
            const payInfo = lastPay ? Utils.formatDate(lastPay.paymentDate) : 'Sin pagos';
            return `<tr>
                <td>${i+1}</td>
                <td><strong>${Utils.escapeHtml(u.name)}</strong></td>
                <td>${Utils.formatPhone(u.phone)}</td>
                <td>${payInfo}</td>
                <td class="d-flex gap-1 flex-wrap">
                    <button class="btn btn-sm btn-success" onclick="WhatsApp.bienvenida('${u.id}')" title="Bienvenida">
                        <i class="fas fa-hand-wave"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="WhatsApp.recordatorioPago('${u.id}')" title="Recordatorio pago">
                        <i class="fas fa-bell"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="WhatsApp.recordatorioInasistencia('${u.id}')" title="Recordatorio asistencia">
                        <i class="fas fa-user-clock"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    return {
        initialize, bienvenida, confirmacionPago, recordatorioPago,
        recordatorioInasistencia, checkBirthdays, renderWAUsers, openWA
    };
})();
window.WhatsApp = WhatsApp;

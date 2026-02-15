/**
 * Módulo WhatsApp
 * Mensajes automáticos: bienvenida, pago, recordatorios, cumpleaños
 */
const WhatsApp = (() => {
    const GYM_NAME   = 'Antología Box23';
    const WA_GROUP   = 'https://chat.whatsapp.com/DSJzYAb6h58FQDA8yEAzwN';
    const FORM_LINK  = 'https://forms.gle/ZHUj1Q7YiDhE5P498';

    function initialize() {
        setupEventListeners();
        checkBirthdays('proximos');
    }

    function setupEventListeners() {
        document.getElementById('waBirthdayProximos')?.addEventListener('click', () => checkBirthdays('proximos'));
        document.getElementById('waBirthdayMes')?.addEventListener('click',      () => checkBirthdays('mes'));
        document.getElementById('enviarNuevoIngresoBtn')?.addEventListener('click', enviarNuevoIngreso);

        // Preview en tiempo real
        document.getElementById('nuevoIngresoNombre')?.addEventListener('input', actualizarPreview);
        document.getElementById('incluirGrupo')?.addEventListener('change', actualizarPreview);

        // Actualizar preview al abrir el modal
        document.getElementById('nuevoIngresoModal')?.addEventListener('shown.bs.modal', () => {
            document.getElementById('nuevoIngresoNombre')?.focus();
            actualizarPreview();
        });
    }

    function buildUrl(phone, message) {
        const clean = (phone || '').replace(/\D/g, '');
        return `https://wa.me/57${clean}?text=${encodeURIComponent(message)}`;
    }

    function openWA(phone, message) {
        window.open(buildUrl(phone, message), '_blank');
    }

    function sendBirthday(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const msg =
`¡Feliz cumpleaños ${nombre}! 🎉🎂 Desde Antología Box23 te deseamos un día maravilloso lleno de alegría, salud y muchas bendiciones. Que este nuevo año de vida esté cargado de éxitos y momentos inolvidables. ¡Esperamos verte pronto en el box para celebrar contigo! 💪 Con cariño, El equipo de Antología Box23`;
        openWA(user.phone, msg);
    }

    // ── 1. Nuevo Ingreso — modal con preview en tiempo real ─────────────

    function openNuevoIngreso() {
        // Limpiar campos
        document.getElementById('nuevoIngresoNombre').value    = '';
        document.getElementById('nuevoIngresoTelefono').value  = '';
        document.getElementById('incluirGrupo').checked        = true;
        actualizarPreview();
        UI.showModal('nuevoIngresoModal');
    }

    function buildMensajeIngreso(nombre, incluirGrupo) {
        const n = (nombre || '[Nombre]').trim();
        const grupoLine = incluirGrupo
            ? `\n\n📲 Únete a nuestro grupo de WhatsApp (opcional):\n${WA_GROUP}`
            : '';
        return `Hola ${n}, bienvenido/a a ${GYM_NAME}. Para completar tu registro, necesitamos los siguientes datos:

1. Nombre completo:
2. Número de documento:
3. Fecha de nacimiento:
4. Tipo de sangre (RH):
5. EPS:
6. Alguna patología o condición médica que debamos conocer:
7. Teléfono de contacto de emergencia:
8. Nombre del contacto de emergencia:

¡Gracias por colaborar!${grupoLine}

📋 O completa nuestro formulario (para que habilite el mensaje contesta el mensaje o guarda el contacto) en línea:
${FORM_LINK}`;
    }

    function actualizarPreview() {
        const nombre      = document.getElementById('nuevoIngresoNombre')?.value || '';
        const incluirGrupo = document.getElementById('incluirGrupo')?.checked ?? true;
        const preview     = document.getElementById('previewMensaje');
        if (preview) preview.textContent = buildMensajeIngreso(nombre, incluirGrupo);
    }

    function enviarNuevoIngreso() {
        const nombre   = document.getElementById('nuevoIngresoNombre')?.value?.trim();
        const telefono = document.getElementById('nuevoIngresoTelefono')?.value?.trim();
        const incluirGrupo = document.getElementById('incluirGrupo')?.checked ?? true;

        if (!nombre) {
            UI.showErrorToast('Ingresa el nombre de pila'); return;
        }
        if (!telefono || telefono.replace(/\D/g,'').length < 7) {
            UI.showErrorToast('Ingresa un número de celular válido'); return;
        }

        const msg = buildMensajeIngreso(nombre, incluirGrupo);
        openWA(telefono, msg);
        UI.hideModal('nuevoIngresoModal');
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

    function checkBirthdays(modo = 'proximos') {
        const today     = Utils.getCurrentDate();
        const todayDate = new Date(today + 'T00:00:00');
        const users     = Users.getActiveUsers();

        // Marcar botón activo
        document.getElementById('waBirthdayProximos')?.classList.toggle('active', modo === 'proximos');
        document.getElementById('waBirthdayMes')?.classList.toggle('active',      modo === 'mes');

        const label = document.getElementById('birthdayRangeLabel');

        let birthdays;

        if (modo === 'mes') {
            // Todos los cumpleaños del mes en curso
            const currentMonth = String(todayDate.getMonth() + 1).padStart(2, '0');
            if (label) label.textContent = 'Mes de ' + todayDate.toLocaleDateString('es-ES', { month: 'long' });

            birthdays = users
                .filter(u => {
                    if (!u.birthdate) return false;
                    const bd = Utils.normalizeDate(u.birthdate);
                    return bd && bd.slice(5, 7) === currentMonth;
                })
                .map(u => {
                    const bd  = Utils.normalizeDate(u.birthdate);
                    const day = parseInt(bd.slice(8, 10));
                    return { user: u, day };
                })
                .sort((a, b) => a.day - b.day);

        } else {
            // Próximos 5 días (incluye hoy)
            if (label) label.textContent = 'Próximos 5 días';

            // Generar las 5 fechas MM-DD a comparar
            const nextDays = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() + i);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                nextDays.push({ mmdd: mm + '-' + dd, date: d });
            }

            birthdays = users
                .filter(u => {
                    if (!u.birthdate) return false;
                    const bd = Utils.normalizeDate(u.birthdate);
                    return bd && nextDays.some(nd => nd.mmdd === bd.slice(5));
                })
                .map(u => {
                    const bd   = Utils.normalizeDate(u.birthdate);
                    const mmdd = bd.slice(5);
                    const nd   = nextDays.find(x => x.mmdd === mmdd);
                    const diff = Math.round((nd.date - todayDate) / 86400000);
                    return { user: u, diff, mmdd };
                })
                .sort((a, b) => a.diff - b.diff);
        }

        const container = document.getElementById('birthdayList');
        if (!container) return;

        const textoVacio = modo === 'mes'
            ? 'Sin cumpleaños este mes'
            : 'Sin cumpleaños en los próximos 5 días';

        if (birthdays.length === 0) {
            container.innerHTML = `<p class="text-muted text-center py-3"><i class="fas fa-birthday-cake me-2"></i>${textoVacio}</p>`;
            const badge = document.getElementById('birthdayBadge');
            if (badge) badge.style.display = 'none';
            return;
        }

        container.innerHTML = birthdays.map(item => {
            const u = item.user || item;
            const nombre = u.name.split(' ')[0];
                        // Etiqueta de cuándo
            let cuandoTag = '';
            if (modo === 'proximos') {
                if (item.diff === 0)
                    cuandoTag = '<span class="badge bg-warning text-dark ms-2">¡Hoy! 🎂</span>';
                else if (item.diff === 1)
                    cuandoTag = '<span class="badge bg-info ms-2">Mañana</span>';
                else
                    cuandoTag = `<span class="badge bg-secondary ms-2">En ${item.diff} días</span>`;
            } else {
                const bd = Utils.normalizeDate(u.birthdate);
                cuandoTag = `<span class="badge bg-secondary ms-2">Día ${parseInt(bd.slice(8, 10))}</span>`;
            }

            return `<div class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <span>
                    <i class="fas fa-birthday-cake text-warning me-2"></i>
                    <strong>${Utils.escapeHtml(u.name)}</strong>
                    ${cuandoTag}
                </span>
                <button class="btn btn-sm btn-success" onclick="WhatsApp.sendBirthday('${u.id}')" title="Enviar saludo de cumpleaños">
                    <i class="fab fa-whatsapp me-1"></i>Saludar
                </button>
            </div>`;
        }).join('');

        // Badge en el nav — solo muestra los de hoy
        const hoy = birthdays.filter(b => b.diff === 0).length;
        const badge = document.getElementById('birthdayBadge');
        if (badge) { badge.textContent = hoy; badge.style.display = hoy > 0 ? 'inline' : 'none'; }
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
        initialize, openNuevoIngreso, confirmacionPago, recordatorioPago,
        recordatorioInasistencia, checkBirthdays, openWA, sendBirthday
    };
})();
window.WhatsApp = WhatsApp;

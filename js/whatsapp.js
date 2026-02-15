/**
 * M\u00F3dulo WhatsApp
 * Mensajes autom\u00E1ticos: bienvenida, pago, recordatorios, cumplea\u00F1os
 */
const WhatsApp = (() => {
    const GYM_NAME   = 'Antolog\u00EDa Box23';
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
        // encodeURIComponent codifica todo incluyendo emojis correctamente como UTF-8
        // WhatsApp requiere que los espacios sean %20 (no +)
        const encoded = encodeURIComponent(message);
        return `https://wa.me/57${clean}?text=${encoded}`;
    }

    function openWA(phone, message) {
        window.open(buildUrl(phone, message), '_blank');
    }

    function sendBirthday(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const msg = '\u00A1Feliz cumplea\u00F1os ' + nombre + '! \uD83C\uDF89\uD83C\uDF82 Desde Antolog\u00EDa Box23 te deseamos un d\u00EDa maravilloso lleno de alegr\u00EDa, salud y muchas bendiciones. Que este nuevo a\u00F1o de vida est\u00E9 cargado de \u00E9xitos y momentos inolvidables. \u00A1Esperamos verte pronto en el box para celebrar contigo! \uD83D\uDCAA Con cari\u00F1o, El equipo de Antolog\u00EDa Box23';
        openWA(user.phone, msg);
    }

    // \u2500\u2500 1. Nuevo Ingreso \u2014 modal con preview en tiempo real \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
            ? `\n\n\uD83D\uDCF2 \u00DAnete a nuestro grupo de WhatsApp (opcional):\n${WA_GROUP}`
            : '';
        return `Hola ${n}, bienvenido/a a ${GYM_NAME}. Para completar tu registro, necesitamos los siguientes datos:

1. Nombre completo:
2. N\u00FAmero de documento:
3. Fecha de nacimiento:
4. Tipo de sangre (RH):
5. EPS:
6. Alguna patolog\u00EDa o condici\u00F3n m\u00E9dica que debamos conocer:
7. Nombre del contacto de emergencia:
8. Tel\u00E9fono de contacto de emergencia:

\u00A1Gracias por colaborar!${grupoLine}

\uD83D\uDCCB O completa nuestro formulario en l\u00EDnea (para que habilite el link contesta el mensaje o guarda el contacto):
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
            UI.showErrorToast('Ingresa un n\u00FAmero de celular v\u00E1lido'); return;
        }

        const msg = buildMensajeIngreso(nombre, incluirGrupo);
        openWA(telefono, msg);
        UI.hideModal('nuevoIngresoModal');
    }

    // \u2500\u2500 2. Confirmaci\u00F3n de pago \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    function confirmacionPago(paymentId) {
        const payment = Storage.getIncome().find(p => p.id === paymentId);
        if (!payment) return;
        const user    = Storage.getUserById(payment.userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const vigencia = payment.startDate && payment.endDate
            ? `\n\uD83D\uDCC5 Vigencia: ${Utils.formatDate(payment.startDate)} al ${Utils.formatDate(payment.endDate)}`
            : '';
        const msg = `\u00A1Hola ${nombre}! \uD83D\uDC4B\n tu pago en Antologia Box23 \u2705\n\n\uD83D\uDCB0 por un valor de *_*${Utils.formatCurrency(payment.amount)}*\n\uD83D\uDCCC _* Tipo: *${payment.paymentType}*\n\uD83D\uDCB3 M\u00E9todo: *${payment.paymentMethod}*_${vigencia}_*_*\n\n\u00A1_* Gracias por confiar en *${GYM_NAME}*! \uD83C\uDFCB\uFE0F`;
        openWA(user.phone, msg);
    }

    // \u2500\u2500 3. Recordatorio de pago pendiente \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    function recordatorioPago(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre  = user.name.split(' ')[0];
        const payment = Storage.getIncome()
            .filter(p => p.userId === userId && p.endDate)
            .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        const vencioEl = payment ? ` Tu \u00FAltima vigencia venci\u00F3 el *${Utils.formatDate(payment.endDate)}*.` : '';
        const msg = `\u00A1Hola ${nombre}! \uD83C\uDFCB\uFE0F\nTe recordamos que tienes un pago pendiente en *${GYM_NAME}*.${vencioEl}\n\nPor favor ac\u00E9rcate o comun\u00EDcate con nosotros para renovar tu membres\u00EDa y seguir disfrutando de tus clases. \uD83D\uDCAA\n\n\u00A1Te esperamos!`;
        openWA(user.phone, msg);
    }

    // \u2500\u2500 4. Recordatorio inasistencia \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    function recordatorioInasistencia(userId) {
        const user = Storage.getUserById(userId);
        if (!user) return;
        const nombre = user.name.split(' ')[0];
        const lastAttend = Storage.getAttendanceByUser(userId)
            .filter(a => a.status === 'presente')
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        const lastDate = lastAttend ? Utils.formatDate(lastAttend.date) : 'hace un tiempo';
        const msg = `Hola ${nombre}, \u00A1te extra\u00F1amos en ${GYM_NAME}! \uD83D\uDC4B\nHemos notado que no hemos tenido el gusto de verte desde el ${lastDate}.\n\u00BFTodo bien? Esperamos que puedas regresar pronto a tus entrenamientos. Si hay alg\u00FAn inconveniente o necesitas ayuda, no dudes en contarnos.\n\u00A1Quedamos atentos a cualquier inquietud!\n\uD83D\uDCAA El equipo de ${GYM_NAME}`;
        openWA(user.phone, msg);
    }

    // \u2500\u2500 5. Verificador de cumplea\u00F1os \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

    function checkBirthdays(modo = 'proximos') {
        const today     = Utils.getCurrentDate();
        const todayDate = new Date(today + 'T00:00:00');
        const users     = Users.getActiveUsers();

        // Marcar bot\u00F3n activo
        document.getElementById('waBirthdayProximos')?.classList.toggle('active', modo === 'proximos');
        document.getElementById('waBirthdayMes')?.classList.toggle('active',      modo === 'mes');

        const label = document.getElementById('birthdayRangeLabel');

        let birthdays;

        if (modo === 'mes') {
            // Todos los cumplea\u00F1os del mes en curso
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
            // Pr\u00F3ximos 5 d\u00EDas (incluye hoy)
            if (label) label.textContent = 'Pr\u00F3ximos 5 d\u00EDas';

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
            ? 'Sin cumplea\u00F1os este mes'
            : 'Sin cumplea\u00F1os en los pr\u00F3ximos 5 d\u00EDas';

        if (birthdays.length === 0) {
            container.innerHTML = `<p class="text-muted text-center py-3"><i class="fas fa-birthday-cake me-2"></i>${textoVacio}</p>`;
            const badge = document.getElementById('birthdayBadge');
            if (badge) badge.style.display = 'none';
            return;
        }

        container.innerHTML = birthdays.map(item => {
            const u = item.user || item;
            const nombre = u.name.split(' ')[0];
                        // Etiqueta de cu\u00E1ndo
            let cuandoTag = '';
            if (modo === 'proximos') {
                if (item.diff === 0)
                    cuandoTag = '<span class="badge bg-warning text-dark ms-2">\u00A1Hoy! \uD83C\uDF82</span>';
                else if (item.diff === 1)
                    cuandoTag = '<span class="badge bg-info ms-2">Ma\u00F1ana</span>';
                else
                    cuandoTag = `<span class="badge bg-secondary ms-2">En ${item.diff} d\u00EDas</span>`;
            } else {
                const bd = Utils.normalizeDate(u.birthdate);
                cuandoTag = `<span class="badge bg-secondary ms-2">D\u00EDa ${parseInt(bd.slice(8, 10))}</span>`;
            }

            return `<div class="d-flex align-items-center justify-content-between p-2 border rounded mb-2">
                <span>
                    <i class="fas fa-birthday-cake text-warning me-2"></i>
                    <strong>${Utils.escapeHtml(u.name)}</strong>
                    ${cuandoTag}
                </span>
                <button class="btn btn-sm btn-success" onclick="WhatsApp.sendBirthday('${u.id}')" title="Enviar saludo de cumplea\u00F1os">
                    <i class="fab fa-whatsapp me-1"></i>Saludar
                </button>
            </div>`;
        }).join('');

        // Badge en el nav \u2014 solo muestra los de hoy
        const hoy = birthdays.filter(b => b.diff === 0).length;
        const badge = document.getElementById('birthdayBadge');
        if (badge) { badge.textContent = hoy; badge.style.display = hoy > 0 ? 'inline' : 'none'; }
    }

    // \u2500\u2500 Renderizar tabla de usuarios con botones WA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

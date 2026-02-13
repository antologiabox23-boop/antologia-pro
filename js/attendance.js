const Attendance = (() => {
    let currentPage = 1;
    let itemsPerPage = 25;
    let currentDate = Utils.getCurrentDate();

    function initialize() {
        itemsPerPage = Storage.getSetting('itemsPerPage') || 25;
        setupEventListeners();
        document.getElementById('attendanceDate').value = currentDate;
        renderAttendance();
    }

    function setupEventListeners() {
        document.getElementById('attendanceDate')?.addEventListener('change', (e) => {
            currentDate = e.target.value;
            renderAttendance();
        });

        document.getElementById('attendanceSearch')?.addEventListener('input', Utils.debounce(() => {
            renderAttendance();
        }, 300));

        document.getElementById('markAllPresent')?.addEventListener('click', markAllPresent);
        document.getElementById('quickAttendance')?.addEventListener('click', () => UI.switchTab('attendance'));
    }

    function markAllPresent() {
        UI.showConfirmModal('Marcar Todos Presente', '¿Marcar a todos los usuarios activos como presentes para hoy?', () => {
            const users = Users.getActiveUsers();
            users.forEach(user => markAttendance(user.id, 'presente'));
            UI.showSuccessToast('Todos marcados como presentes');
            renderAttendance();
        });
    }

    function markAttendance(userId, status) {
        const existing = Storage.getAttendanceByDate(currentDate).find(a => a.userId === userId);
        if (existing) {
            Storage.updateAttendance(existing.id, { status, time: new Date().toLocaleTimeString('es-ES') });
        } else {
            Storage.addAttendance({ userId, date: currentDate, status, time: new Date().toLocaleTimeString('es-ES') });
        }
    }

    function renderAttendance() {
        const users = Users.getActiveUsers();
        const attendance = Storage.getAttendanceByDate(currentDate);
        const searchTerm = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';

        const filtered = users.filter(u => u.name.toLowerCase().includes(searchTerm));
        const start = (currentPage - 1) * itemsPerPage;
        const paginated = filtered.slice(start, start + itemsPerPage);

        const tbody = document.getElementById('attendanceList');
        if (!tbody) return;

        if (paginated.length === 0) {
            UI.showEmptyState('attendanceList', 'No hay usuarios para mostrar', 'fa-clipboard-check');
            return;
        }

        tbody.innerHTML = paginated.map((user, i) => {
            const record = attendance.find(a => a.userId === user.id);
            const status = record?.status || 'ausente';
            const time = record?.time || '-';
            
            return `
                <tr>
                    <td>${start + i + 1}</td>
                    <td><strong>${Utils.escapeHtml(user.name)}</strong></td>
                    <td>${user.classTime || '-'}</td>
                    <td>${UI.getStatusBadge(status)}</td>
                    <td>${time}</td>
                    <td>
                        <button class="btn btn-sm btn-success me-1" onclick="Attendance.mark('${user.id}', 'presente')">
                            <i class="fas fa-check"></i> Presente
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Attendance.mark('${user.id}', 'ausente')">
                            <i class="fas fa-times"></i> Ausente
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        UI.renderPagination('attendancePagination', filtered.length, currentPage, itemsPerPage, (page) => {
            currentPage = page;
            renderAttendance();
        });
    }

    return {
        initialize,
        mark: (userId, status) => {
            markAttendance(userId, status);
            renderAttendance();
            if (window.Dashboard) Dashboard.updateStats();
        },
        renderAttendance
    };
})();
window.Attendance = Attendance;

const Backup = (() => {
    function initialize() {
        setupEventListeners();
        updateLastBackupDisplay();
    }

    function setupEventListeners() {
        document.getElementById('backupBtn')?.addEventListener('click', createBackup);
        document.getElementById('restoreBtn')?.addEventListener('click', () => {
            document.getElementById('backupFileInput').click();
        });
        document.getElementById('manualBackup')?.addEventListener('click', createBackup);
        document.getElementById('importBackup')?.addEventListener('click', () => {
            document.getElementById('backupFileInput').click();
        });
        document.getElementById('backupFileInput')?.addEventListener('change', handleFileSelect);
        document.getElementById('autoBackupToggle')?.addEventListener('change', toggleAutoBackup);
    }

    function createBackup() {
        UI.showLoading('Creando respaldo...');
        setTimeout(() => {
            const success = Storage.exportData();
            UI.hideLoading();
            if (success) {
                UI.showSuccessToast('Respaldo creado exitosamente');
                updateLastBackupDisplay();
            } else {
                UI.showErrorToast('Error al crear respaldo');
            }
        }, 500);
    }

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        UI.showLoading('Restaurando datos...');
        try {
            const content = await Utils.readFileAsText(file);
            const success = Storage.importData(content);
            
            if (success) {
                UI.showSuccessToast('Datos restaurados exitosamente');
                setTimeout(() => location.reload(), 1000);
            } else {
                UI.showErrorToast('Error al restaurar datos. Verifica el archivo.');
            }
        } catch (error) {
            UI.showErrorToast('Error al leer el archivo');
        } finally {
            UI.hideLoading();
            e.target.value = '';
        }
    }

    function toggleAutoBackup(e) {
        const enabled = e.target.checked;
        Storage.updateSettings({ autoBackup: enabled });
        UI.showInfoToast(enabled ? 'Respaldo automático activado' : 'Respaldo automático desactivado');
    }

    function updateLastBackupDisplay() {
        const lastBackup = Storage.getLastBackupDate();
        const element = document.getElementById('lastBackupDate');
        if (element) {
            element.textContent = lastBackup ? Utils.formatDateTime(lastBackup) : 'Nunca';
        }
    }

    function checkAutoBackup() {
        const settings = Storage.getSettings();
        if (!settings.autoBackup) return;

        const lastBackup = Storage.getLastBackupDate();
        if (!lastBackup) return;

        const daysSince = Utils.daysDifference(lastBackup, new Date());
        if (daysSince >= 1) {
            Storage.exportData();
            console.log('Respaldo automático realizado');
        }
    }

    return {
        initialize,
        checkAutoBackup
    };
})();
window.Backup = Backup;

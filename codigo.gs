// Nombre exacto de tu hoja de respuestas
const SHEET_NAME = 'Usuario Antologia';

// Mapeo: columna del Sheets → campo interno de la app
// Basado en tus encabezados actuales (índice 0 = columna A)
//
//  0  Marca temporal
//  1  1. Nombre completo:
//  2  2. Número de documento:
//  3  3. Fecha de nacimiento:
//  4  Column 14  ← omitir (cálculo cumpleaños / respaldo)
//  5  Column 13  ← omitir
//  6  Column 12  ← omitir
//  7  4. Celular
//  8  5. EPS:
//  9  6. Tipo de sangre (RH):
// 10  7. Alguna patología o condición médica...
// 11  8. Nombre del contacto de emergencia:
// 12  9. Teléfono de contacto de emergencia:
// 13  10. Clase a la cual con más frecuencia asistirías

const COL = {
  marca_temporal:   0,
  name:             1,
  document:         2,
  birthdate:        3,
  // 4, 5, 6 → omitir (Column 14, 13, 12)
  phone:            7,
  eps:              8,
  bloodType:        9,
  pathology:        10,
  emergencyContact: 11,
  emergencyPhone:   12,
  classTime:        13,
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — Ejecuta esta para exportar
// ═══════════════════════════════════════════════════════════════════════════
function exportUsersAsJson() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      '❌ No se encontró la hoja "' + SHEET_NAME + '".\n\n' +
      'Verifica que el nombre sea exactamente: Usuario antologia'
    );
    return;
  }

  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('⚠️ La hoja no tiene respuestas todavía.');
    return;
  }

  const users  = [];
  let omitidos = 0;

  // Empezar en fila 1 (fila 0 son encabezados)
  for (let i = 1; i < data.length; i++) {
    const row  = data[i];
    const name = _clean(row[COL.name]);

    // Saltar filas vacías o sin nombre
    if (!name) { omitidos++; continue; }

    const user = {
      id:               'sheets_' + (i) + '_' + _slug(name),
      name:             name,
      document:         _clean(row[COL.document]),
      birthdate:        _formatDate(row[COL.birthdate]),
      phone:            _cleanPhone(row[COL.phone]),
      eps:              _clean(row[COL.eps]),
      bloodType:        _clean(row[COL.bloodType]),
      pathology:        _clean(row[COL.pathology]),
      emergencyContact: _clean(row[COL.emergencyContact]),
      emergencyPhone:   _cleanPhone(row[COL.emergencyPhone]),
      classTime:        _clean(row[COL.classTime]),
      affiliationType:  '',       // Lo define el admin en la app
      status:           'active',
      createdAt:        _isoDate(row[COL.marca_temporal]) || new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    };

    users.push(user);
  }

  // Crear archivo JSON en Google Drive
  const payload  = JSON.stringify({ users: users, exportedAt: new Date().toISOString(), source: 'Google Sheets - Usuario antologia' }, null, 2);
  const fileName = 'antologia_users_' + _dateStamp() + '.json';

  // Eliminar archivo anterior si existe (para no acumular)
  const existing = DriveApp.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);

  const file = DriveApp.createFile(fileName, payload, 'application/json');
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const msg =
    '✅ Exportación exitosa!\n\n' +
    '👤 Usuarios exportados: ' + users.length + '\n' +
    (omitidos > 0 ? '⚠️ Filas omitidas (vacías): ' + omitidos + '\n' : '') +
    '\n📁 Archivo: ' + fileName +
    '\n🔗 URL de descarga:\n' + file.getDownloadUrl() +
    '\n\n➡️ Descarga ese archivo y cárgalo en tu app:\n' +
    'Configuración → "Cargar JSON de Sheets"';

  SpreadsheetApp.getUi().alert(msg);
  Logger.log('Exportados ' + users.length + ' usuarios. Archivo: ' + fileName);
}

// ═══════════════════════════════════════════════════════════════════════════
// OPCIONAL: Trigger automático — cada vez que alguien envía el formulario
// crea/actualiza el JSON automáticamente en Drive.
// Para activarlo, ejecuta setupTrigger() UNA SOLA VEZ.
// ═══════════════════════════════════════════════════════════════════════════
function setupTrigger() {
  // Eliminar triggers anteriores para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onNewFormResponse') {
      ScriptApp.deleteTrigger(t);
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onNewFormResponse')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger activado.\n\n' +
    'A partir de ahora, cada vez que alguien llene el formulario,\n' +
    'el JSON se actualizará automáticamente en tu Drive.'
  );
}

function onNewFormResponse(e) {
  try {
    exportUsersAsJson();
  } catch (err) {
    Logger.log('❌ Error en onNewFormResponse: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

function _clean(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function _cleanPhone(val) {
  return String(val || '').replace(/\D/g, '');
}

// Convierte Date de Sheets o string a YYYY-MM-DD
function _formatDate(val) {
  if (!val) return '';
  try {
    if (val instanceof Date && !isNaN(val)) {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (_) {}
  return String(val).trim();
}

// Convierte fecha/hora de Sheets a ISO string
function _isoDate(val) {
  if (!val) return '';
  try {
    if (val instanceof Date && !isNaN(val)) return val.toISOString();
    const d = new Date(val);
    if (!isNaN(d)) return d.toISOString();
  } catch (_) {}
  return '';
}

// Genera un slug corto del nombre para el ID
function _slug(name) {
  return String(name).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_').slice(0, 15);
}

// Sello de fecha YYYYMMDD para nombre de archivo
function _dateStamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
}

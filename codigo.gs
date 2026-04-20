/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ANTOLOGÍA BOX23 — Google Apps Script Backend  v2          ║
 * ║   Copia TODO este código en script.google.com               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
// Pega aquí el ID de tu Google Spreadsheet (lo ves en la URL de la hoja)
const SPREADSHEET_ID = '1Q3uao_brBssNkaASs3OBFvtW2J3Of9BflTBHFRqqnR4';

const SHEETS = {
  USERS:      'Usuarios',
  ATTENDANCE: 'Asistencia',
  INCOME:     'Ingresos',
  EXPENSES:   'Gastos',
  CLASSES:    'Clases'
};

const COLUMNS = {
  Usuarios:   ['id','name','document','birthdate','phone','eps','bloodType','pathology','emergencyContact','emergencyPhone','classTime','affiliationType','status','createdAt','updatedAt'],
  Asistencia: ['id','userId','date','status','time','createdAt'],
  Ingresos:   ['id','userId','paymentType','amount','paymentMethod','paymentDate','startDate','endDate','notes','createdAt'],
  Gastos:     ['id','date','description','amount','category','account','createdAt'],
  Clases:     ['id','date','hour','trainerId','classType','duration','payment','createdAt']
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

// CORRECCIÓN: En Apps Script TextOutput NO tiene .setHeader().
// Los headers CORS se manejan devolviendo el output directamente.
// Apps Script maneja CORS automáticamente cuando el acceso es "Cualquier usuario".
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ENTRY POINTS ─────────────────────────────────────────────────────────────

// Responde a GET — la app envía todo por GET para evitar CORS preflight
function doGet(e) {
  try {
    if (!e || !e.parameter || !e.parameter.action) {
      return jsonResponse({ ok: true, message: 'Antología Box23 API activa ✓' });
    }

    const action = e.parameter.action;

    // El payload viene en base64 para soportar caracteres especiales
    var payload = {};
    if (e.parameter.payload) {
      try {
        var decoded = Utilities.newBlob(
          Utilities.base64Decode(decodeURIComponent(e.parameter.payload))
        ).getDataAsString();
        payload = JSON.parse(decoded);
      } catch (parseErr) {
        // Si falla el decode, intentar leer directo
        try { payload = JSON.parse(decodeURIComponent(e.parameter.payload)); }
        catch (e2) { payload = {}; }
      }
    }

    var result = dispatch(action, payload);
    return jsonResponse({ data: result });

  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// doPost se mantiene como fallback
function doPost(e) {
  try {
    const action  = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
    const payload = (e && e.postData && e.postData.contents)
      ? JSON.parse(e.postData.contents)
      : {};
    const result = dispatch(action, payload);
    return jsonResponse({ data: result });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── ROUTER ───────────────────────────────────────────────────────────────────

function dispatch(action, payload) {
  switch (action) {
    case 'getUsers':      return getAllRows(SHEETS.USERS);
    case 'getAttendance': return getAllRows(SHEETS.ATTENDANCE);
    case 'getIncome':     return getAllRows(SHEETS.INCOME);
    case 'addRow':        return addRow(payload.sheet, payload.row);
    case 'updateRow':     return updateRow(payload.sheet, payload.id, payload.data);
    case 'deleteRow':     return deleteRow(payload.sheet, payload.id);
    case 'deleteByField': return deleteByField(payload.sheet, payload.field, payload.value);
    case 'importAll':     return importAll(payload);
    case 'getExpenses':   return getAllRows(SHEETS.EXPENSES);
    case 'getClasses':    return getAllRows(SHEETS.CLASSES);
    case 'clearAll':      return clearAll();
    default: throw new Error('Acción desconocida: ' + action);
  }
}

// ── OPERACIONES CRUD ─────────────────────────────────────────────────────────

// Columnas que contienen fechas en cada hoja
var DATE_COLUMNS = {
  Usuarios:   ['birthdate', 'createdAt', 'updatedAt'],
  Asistencia: ['date', 'createdAt'],
  Ingresos:   ['paymentDate', 'startDate', 'endDate', 'createdAt'],
  Gastos:     ['date', 'createdAt'],
  Clases:     ['date', 'createdAt']
};

// Columnas que contienen valores numéricos (NO deben convertirse a fecha)
var NUMERIC_COLUMNS = {
  Ingresos: ['amount'],
  Gastos:   ['amount'],
  Clases:   ['duration', 'payment']
};

/**
 * Serializa una celda de Sheets al tipo correcto.
 * - Si la columna es de fecha → YYYY-MM-DD
 * - Si la columna es numérica → número como string (sin alterar)
 * - Lo demás → string normal
 */
function serializeCell(value, columnName, sheetName) {
  if (value === '' || value === null || value === undefined) return null;

  // ── Caso 1: objeto Date de Google Sheets ──────────────────────────────
  // Sheets devuelve Date para celdas con formato fecha, sea cual sea la columna.
  // Solo convertimos a YYYY-MM-DD si la columna realmente es una fecha.
  if (value instanceof Date) {
    var dateColumns = DATE_COLUMNS[sheetName] || [];
    if (dateColumns.indexOf(columnName) !== -1) {
      var y = value.getFullYear();
      var m = String(value.getMonth() + 1).padStart(2, '0');
      var d = String(value.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    // Si no es columna de fecha, devolver como número (timestamp) o string
    return String(value.getTime());
  }

  // ── Caso 2: número ────────────────────────────────────────────────────
  if (typeof value === 'number') {
    var numericColumns = NUMERIC_COLUMNS[sheetName] || [];
    var dateColumns2   = DATE_COLUMNS[sheetName]    || [];

    // Columna explícitamente numérica → devolver siempre número limpio
    if (numericColumns.indexOf(columnName) !== -1) {
      // Sheets a veces devuelve el número con formato es-CO: 185.000
      // parseFloat("185.000") = 185 (INCORRECTO) → necesitamos quitarlos
      // Pero "185.5" = 185.5 (correcto, solo 2 decimales)
      var numStr = String(value).trim();
      // Si tiene punto y la parte decimal tiene más de 2 dígitos → son separadores de miles
      var dotIdx = numStr.lastIndexOf('.');
      if (dotIdx !== -1 && numStr.length - dotIdx - 1 > 2) {
        numStr = numStr.replace(/\./g, ''); // quitar puntos de miles
      }
      var parsed = parseFloat(numStr);
      return isNaN(parsed) ? '0' : String(parsed);
    }

    // Columna explícitamente de fecha con número serial de Sheets
    // (rango de fechas válidas: 1900-01-01 = 1 a ~2100 = 73050)
    if (dateColumns2.indexOf(columnName) !== -1 && value > 0 && value < 73051) {
      var epoch = new Date(1899, 11, 30);
      var date  = new Date(epoch.getTime() + value * 86400000);
      var y2 = date.getFullYear();
      var m2 = String(date.getMonth() + 1).padStart(2, '0');
      var d2 = String(date.getDate()).padStart(2, '0');
      return y2 + '-' + m2 + '-' + d2;
    }

    // Cualquier otro número → string simple
    return String(value);
  }

  // ── Caso 3: string u otro tipo ────────────────────────────────────────
  return String(value);
}

function getAllRows(sheetName) {
  const sheet = getOrCreateSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = serializeCell(row[i], String(h).trim(), sheetName);
    });
    return obj;
  });
}

/**
 * Diagnóstico: devuelve los tipos reales de las primeras 3 filas de Ingresos.
 * Llama desde Apps Script: testDiagnostico()
 */
function testDiagnostico() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Ingresos');
  if (!sheet) { Logger.log('Hoja Ingresos no encontrada'); return; }
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  Logger.log('Headers: ' + JSON.stringify(headers));
  for (var i = 1; i <= Math.min(3, data.length - 1); i++) {
    var row = data[i];
    row.forEach(function(cell, j) {
      Logger.log('Fila ' + i + ' | ' + headers[j] + ': [' + typeof cell + '] ' + JSON.stringify(String(cell)));
    });
    Logger.log('---');
  }
}

function addRow(sheetName, rowData) {
  const sheet   = getOrCreateSheet(sheetName);
  const headers = COLUMNS[sheetName];
  const numericCols = (NUMERIC_COLUMNS[sheetName] || []);
  const row = headers.map(function(col) {
    var val = rowData[col];
    if (val === undefined || val === null || val === '') return '';
    // Columnas numéricas: guardar siempre como número, nunca como string
    if (numericCols.indexOf(col) !== -1) {
      var n = parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(/\./g, function(m, o, s) {
        // Si hay más de un punto, son separadores de miles en es-CO
        return (s.split('.').length - 1 > 1 || s.indexOf(',') === -1) ? '' : '.';
      }).replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }
    return val;
  });
  sheet.appendRow(row);
  return rowData;
}

function updateRow(sheetName, id, newData) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  if (idCol === -1) throw new Error("Columna 'id' no encontrada en " + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      const updatedRow = headers.map(function(h) {
        return (newData[h] !== undefined && newData[h] !== null) ? newData[h] : data[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return newData;
    }
  }
  throw new Error('Registro ' + id + ' no encontrado en ' + sheetName);
}

function deleteRow(sheetName, id) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  if (idCol === -1) return false;

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function deleteByField(sheetName, field, value) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const col     = headers.indexOf(field);
  if (col === -1) return false;

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
  return true;
}

function importAll(payload) {
  var users      = payload.users      || [];
  var attendance = payload.attendance || [];
  var income     = payload.income     || [];

  overwriteSheet(SHEETS.USERS,      users);
  overwriteSheet(SHEETS.ATTENDANCE, attendance);
  overwriteSheet(SHEETS.INCOME,     income);

  return { imported: { users: users.length, attendance: attendance.length, income: income.length } };
}

function overwriteSheet(sheetName, rows) {
  const sheet   = getOrCreateSheet(sheetName);
  const headers = COLUMNS[sheetName];
  sheet.clearContents();
  sheet.appendRow(headers);
  rows.forEach(function(row) {
    sheet.appendRow(headers.map(function(col) { return row[col] || ''; }));
  });
}

function clearAll() {
  [SHEETS.USERS, SHEETS.ATTENDANCE, SHEETS.INCOME, SHEETS.EXPENSES, SHEETS.CLASSES].forEach(function(name) {
    overwriteSheet(name, []);
  });
  return true;
}

// ── UTILIDADES ───────────────────────────────────────────────────────────────

function getOrCreateSheet(name) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(COLUMNS[name]);
    var headerRange = sheet.getRange(1, 1, 1, COLUMNS[name].length);
    headerRange.setBackground('#273043');
    headerRange.setFontColor('#27F9D4');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // Si la hoja existe, verificar que las columnas estén actualizadas
    syncHeaders(sheet, name);
  }
  return sheet;
}

/**
 * Agrega columnas nuevas al final si el esquema fue actualizado.
 * NUNCA elimina columnas existentes para no perder datos.
 */
function syncHeaders(sheet, name) {
  if (!COLUMNS[name]) return;
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h).trim(); })
    .filter(function(h) { return h !== ''; });

  var expected = COLUMNS[name];
  var toAdd = expected.filter(function(col) { return existing.indexOf(col) === -1; });

  if (toAdd.length === 0) return; // nada que agregar

  // Agregar columnas nuevas al final
  var startCol = existing.length + 1;
  toAdd.forEach(function(col, i) {
    var cell = sheet.getRange(1, startCol + i);
    cell.setValue(col);
    cell.setBackground('#273043');
    cell.setFontColor('#27F9D4');
    cell.setFontWeight('bold');
  });
  Logger.log('Columnas agregadas a ' + name + ': ' + toAdd.join(', '));
}

// ── FUNCIÓN DE PRUEBA ────────────────────────────────────────────────────────
// Ejecútala manualmente desde el editor para verificar antes de desplegar.
// No usa setCorsHeaders — es una prueba directa, no HTTP.
/**
 * Prueba que el decode del payload funciona correctamente
 * Ejecútala antes de desplegar para verificar
 */
function testPayloadDecode() {
  // Simular lo que envía storage.js: btoa(JSON.stringify({sheet:'Usuarios', row:{name:'Test'}}))
  var testPayload = { sheet: 'Usuarios', row: { name: 'Test', id: '123' } };
  var encoded = Utilities.base64Encode(JSON.stringify(testPayload));
  var decoded = Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString();
  var parsed  = JSON.parse(decoded);
  Logger.log('✅ Decode OK: ' + JSON.stringify(parsed));
  Logger.log('   sheet = ' + parsed.sheet);
  Logger.log('   row.name = ' + parsed.row.name);
}

function testConnection() {
  try {
    Logger.log('🔍 Verificando conexión con Spreadsheet...');
    Logger.log('ID configurado: ' + SPREADSHEET_ID);

    if (SPREADSHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_HOJA') {
      Logger.log('⚠️  Debes reemplazar SPREADSHEET_ID con el ID real de tu hoja.');
      return;
    }

    // Intentar abrir la hoja
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ Spreadsheet encontrado: ' + ss.getName());

    // Crear/verificar las 3 pestañas
    var users      = getOrCreateSheet(SHEETS.USERS);
    var attendance = getOrCreateSheet(SHEETS.ATTENDANCE);
    var income     = getOrCreateSheet(SHEETS.INCOME);

    Logger.log('✅ Pestaña Usuarios: ' + (users.getLastRow() - 1) + ' registros');
    Logger.log('✅ Pestaña Asistencia: ' + (attendance.getLastRow() - 1) + ' registros');
    Logger.log('✅ Pestaña Ingresos: ' + (income.getLastRow() - 1) + ' registros');
    var expenses = getOrCreateSheet(SHEETS.EXPENSES);
    var classes  = getOrCreateSheet(SHEETS.CLASSES);
    Logger.log('✅ Pestaña Gastos: ' + (expenses.getLastRow() - 1) + ' registros');
    Logger.log('✅ Pestaña Clases: ' + (classes.getLastRow() - 1) + ' registros');
    Logger.log('');
    Logger.log('🎉 Todo OK. Ya puedes desplegar como Web App.');

  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    Logger.log('→ Verifica que el SPREADSHEET_ID sea correcto y tengas acceso a esa hoja.');
  }
}

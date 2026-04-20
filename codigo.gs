/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ANTOLOGÍA BOX23 — Google Apps Script Backend  v3          ║
 * ║   Copia TODO este código en script.google.com               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1Q3uao_brBssNkaASs3OBFvtW2J3Of9BflTBHFRqqnR4';

const SHEETS = {
  USERS:          'Usuarios',
  ATTENDANCE:     'Asistencia',
  INCOME:         'Ingresos',
  EXPENSES:       'Gastos',
  CLASSES:        'Clases',
  PROGRAMACION:   'Programacion Clases',   // ← nuevo
  MEMBRESIAS:     'Membresias'             // ← nuevo
};

const COLUMNS = {
  Usuarios:            ['id','name','document','birthdate','phone','eps','bloodType','pathology','emergencyContact','emergencyPhone','classTime','affiliationType','status','createdAt','updatedAt'],
  Asistencia:          ['id','userId','date','status','time','createdAt'],
  Ingresos:            ['id','userId','paymentType','amount','paymentMethod','paymentDate','startDate','endDate','notes','createdAt'],
  Gastos:              ['id','date','description','amount','category','account','createdAt'],
  Clases:              ['id','date','hour','trainerId','classType','duration','payment','createdAt'],
  'Programacion Clases': ['ID','userId','userName','userDoc','classType','level','instructor','day','time','classDate','status','cancelReason','createdAt','updatedAt'],
  Membresias:          ['ID','userId','userName','userDoc','tipo','disciplina','vigenciaDesde','vigenciaHasta','clasesTotal','clasesUsadas','estado','notas','createdAt','updatedAt']
};

// Horas mínimas de antelación para cancelar
const CANCEL_HOURS = 18;

// ── HELPERS ──────────────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ENTRY POINTS ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    if (!e || !e.parameter || !e.parameter.action) {
      return jsonResponse({ ok: true, message: 'Antología Box23 API activa ✓' });
    }

    const action = e.parameter.action;

    var payload = {};
    if (e.parameter.payload) {
      try {
        var decoded = Utilities.newBlob(
          Utilities.base64Decode(decodeURIComponent(e.parameter.payload))
        ).getDataAsString();
        payload = JSON.parse(decoded);
      } catch (parseErr) {
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
    // ── Acciones originales ──────────────────────────────────────────────
    case 'getUsers':       return getAllRows(SHEETS.USERS);
    case 'getAttendance':  return getAllRows(SHEETS.ATTENDANCE);
    case 'getIncome':      return getAllRows(SHEETS.INCOME);
    case 'getExpenses':    return getAllRows(SHEETS.EXPENSES);
    case 'getClasses':     return getAllRows(SHEETS.CLASSES);
    case 'addRow':         return addRow(payload.sheet, payload.row);
    case 'updateRow':      return updateRow(payload.sheet, payload.id, payload.data);
    case 'deleteRow':      return deleteRow(payload.sheet, payload.id);
    case 'deleteByField':  return deleteByField(payload.sheet, payload.field, payload.value);
    case 'importAll':      return importAll(payload);
    case 'clearAll':       return clearAll();
    // ── Acciones de programación de clases ──────────────────────────────
    case 'getProgramacion':   return getProgramacion(payload);
    case 'getUserClasses':    return getUserClasses(payload);
    case 'addClass':          return addClass(payload);
    case 'cancelClass':       return cancelClass(payload);
    case 'checkMembership':   return checkMembership(payload);
    case 'markCumplida':      return markCumplida(payload);
    case 'addMembership':     return addMembership(payload);
    case 'getMembresias':     return getAllRows(SHEETS.MEMBRESIAS);
    default: throw new Error('Acción desconocida: ' + action);
  }
}

// ── COLUMNAS DE FECHAS Y NUMÉRICAS ───────────────────────────────────────────
var DATE_COLUMNS = {
  Usuarios:              ['birthdate','createdAt','updatedAt'],
  Asistencia:            ['date','createdAt'],
  Ingresos:              ['paymentDate','startDate','endDate','createdAt'],
  Gastos:                ['date','createdAt'],
  Clases:                ['date','createdAt'],
  'Programacion Clases': ['classDate','createdAt','updatedAt'],
  Membresias:            ['vigenciaDesde','vigenciaHasta','createdAt','updatedAt']
};

var NUMERIC_COLUMNS = {
  Ingresos: ['amount'],
  Gastos:   ['amount'],
  Clases:   ['duration','payment']
};

// ── SERIALIZACIÓN ─────────────────────────────────────────────────────────────
function serializeCell(value, columnName, sheetName) {
  if (value === '' || value === null || value === undefined) return null;

  if (value instanceof Date) {
    var dateColumns = DATE_COLUMNS[sheetName] || [];
    if (dateColumns.indexOf(columnName) !== -1) {
      var y = value.getFullYear();
      var m = String(value.getMonth() + 1).padStart(2, '0');
      var d = String(value.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    return String(value.getTime());
  }

  if (typeof value === 'number') {
    var numericColumns = NUMERIC_COLUMNS[sheetName] || [];
    var dateColumns2   = DATE_COLUMNS[sheetName]    || [];

    if (numericColumns.indexOf(columnName) !== -1) {
      var numStr = String(value).trim();
      var dotIdx = numStr.lastIndexOf('.');
      if (dotIdx !== -1 && numStr.length - dotIdx - 1 > 2) {
        numStr = numStr.replace(/\./g, '');
      }
      var parsed = parseFloat(numStr);
      return isNaN(parsed) ? '0' : String(parsed);
    }

    if (dateColumns2.indexOf(columnName) !== -1 && value > 0 && value < 73051) {
      var epoch = new Date(1899, 11, 30);
      var date  = new Date(epoch.getTime() + value * 86400000);
      var y2 = date.getFullYear();
      var m2 = String(date.getMonth() + 1).padStart(2, '0');
      var d2 = String(date.getDate()).padStart(2, '0');
      return y2 + '-' + m2 + '-' + d2;
    }

    return String(value);
  }

  return String(value);
}

// ── CRUD GENÉRICO (original) ─────────────────────────────────────────────────
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

function addRow(sheetName, rowData) {
  const sheet   = getOrCreateSheet(sheetName);
  const headers = COLUMNS[sheetName];
  const numericCols = (NUMERIC_COLUMNS[sheetName] || []);
  const row = headers.map(function(col) {
    var val = rowData[col];
    if (val === undefined || val === null || val === '') return '';
    if (numericCols.indexOf(col) !== -1) {
      var n = parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(/\./g, function(m, o, s) {
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

// ════════════════════════════════════════════════════════════════════════════
//  PROGRAMACIÓN DE CLASES — lógica nueva
// ════════════════════════════════════════════════════════════════════════════

/**
 * getProgramacion — igual que getClasses pero filtra canceladas para conteo de cupos.
 * payload.classType filtra por disciplina (opcional).
 * payload.includeAll = true devuelve todos los estados (para admin).
 */
function getProgramacion(payload) {
  const sh = getOrCreateSheet(SHEETS.PROGRAMACION);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { success: true, classes: [], data: [] };

  const headers = data[0].map(function(h){ return String(h).trim(); });
  const H = _hmap(headers);
  const list = [];

  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var status = String(row[H['status']] || '').trim();
    // Para conteo de cupos excluir canceladas (a menos que se pida todo)
    if (!payload.includeAll && status === 'cancelada') continue;
    var cls = {};
    headers.forEach(function(h, j){ cls[h] = serializeCell(row[j], h, SHEETS.PROGRAMACION); });
    list.push(cls);
  }

  var out = payload.classType ? list.filter(function(c){ return c.classType === payload.classType; }) : list;
  return { success: true, classes: out, data: out };
}

/**
 * getUserClasses — historial de clases de un usuario con todos los estados.
 */
function getUserClasses(payload) {
  var userId  = payload.userId  || '';
  var userDoc = (payload.userDoc || '').replace(/\D/g, '');

  const sh = getOrCreateSheet(SHEETS.PROGRAMACION);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { success: true, classes: [] };

  const headers = data[0].map(function(h){ return String(h).trim(); });
  const H = _hmap(headers);
  const list = [];

  for (var i = 1; i < data.length; i++) {
    var row     = data[i];
    var rUid    = String(row[H['userId']]  || '').trim();
    var rUdoc   = String(row[H['userDoc']] || '').trim().replace(/\D/g, '');
    var cleanDocU  = (userDoc || '').replace(/\D/g, '');
    var cleanRuidU = rUid.replace(/\D/g, '');
    var match = (userId && rUid === userId)
             || (cleanDocU && rUdoc === cleanDocU)
             || (cleanDocU && cleanRuidU === cleanDocU);
    if (!match) continue;
    var cls = { rowIndex: i + 1 };
    headers.forEach(function(h, j){ cls[h] = serializeCell(row[j], h, SHEETS.PROGRAMACION); });
    list.push(cls);
  }

  list.sort(function(a, b){ return new Date(b.createdAt||0) - new Date(a.createdAt||0); });
  return { success: true, classes: list };
}

/**
 * checkMembership — valida si el usuario puede programar.
 * Retorna { success, canBook, reason, membership }
 */
function checkMembership(payload) {
  var userId  = payload.userId  || '';
  var userDoc = (payload.userDoc || '').replace(/\D/g, '');

  if (!userId && !userDoc) {
    return { success: false, canBook: false, reason: 'Falta userId o userDoc.' };
  }

  var mem = _getActiveMem(userId, userDoc);
  if (!mem) {
    return { success: true, canBook: false, reason: 'No tienes membresía activa ni clases disponibles.', membership: null };
  }

  if (mem.tipo === 'paquete_10') {
    var rest = parseInt(mem.clasesTotal || 10) - parseInt(mem.clasesUsadas || 0);
    if (rest <= 0) {
      return { success: true, canBook: false, reason: 'Has agotado las 10 clases del paquete.', membership: mem };
    }
  }

  return { success: true, canBook: true, reason: _memLabel(mem), membership: mem };
}

/**
 * addClass — crea una nueva reserva.
 * Requiere: userId, userDoc, classType, day, time, classDate, userName
 */
function addClass(payload) {
  var userId    = payload.userId    || '';
  var userDoc   = payload.userDoc   || '';
  var classType = payload.classType || '';
  var day       = payload.day       || '';
  var time      = payload.time      || '';
  var classDate = payload.classDate || '';
  var userName  = payload.userName  || '';
  var level     = payload.level     || '';
  var instructor = payload.instructor || '';

  // 1. Validar membresía
  var memCheck = checkMembership({ userId: userId, userDoc: userDoc });
  if (!memCheck.canBook) {
    return { success: false, message: memCheck.reason };
  }

  var sh   = getOrCreateSheet(SHEETS.PROGRAMACION);
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var H = _hmap(headers);

  // 2. Verificar duplicado activo
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[H['userId']])    === userId    &&
        String(row[H['classType']]) === classType &&
        String(row[H['day']])       === day       &&
        String(row[H['time']])      === time      &&
        String(row[H['status']])    === 'programada') {
      return { success: false, message: 'Ya tienes una reserva programada en ese horario.' };
    }
  }

  var now = new Date().toISOString();
  var id  = 'bk_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);

  var newRow = COLUMNS[SHEETS.PROGRAMACION].map(function(col) {
    var map = {
      'ID': id, 'userId': userId, 'userName': userName, 'userDoc': userDoc,
      'classType': classType, 'level': level, 'instructor': instructor,
      'day': day, 'time': time, 'classDate': classDate,
      'status': 'programada', 'cancelReason': '',
      'createdAt': now, 'updatedAt': now
    };
    return map[col] !== undefined ? map[col] : '';
  });
  sh.appendRow(newRow);

  // 3. Si paquete_10 o clase_unica → incrementar clasesUsadas
  var mem = memCheck.membership;
  if (mem && (mem.tipo === 'paquete_10' || mem.tipo === 'clase_unica')) {
    _incUsadas(mem.rowIndex);
  }

  return { success: true, bookingId: id, message: '¡Reserva confirmada!', membershipInfo: memCheck.reason };
}

/**
 * cancelClass — cancela con validación de ≥18 horas de antelación.
 */
function cancelClass(payload) {
  var bookingId = payload.bookingId || payload.ID || '';
  var reason    = payload.reason    || 'Cancelado por el usuario';

  if (!bookingId) return { success: false, message: 'Falta bookingId.' };

  var sh   = getOrCreateSheet(SHEETS.PROGRAMACION);
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var H = _hmap(headers);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[H['ID']]) !== bookingId) continue;

    var status = String(row[H['status']] || '').trim();
    if (status !== 'programada') {
      return { success: false, message: 'No se puede cancelar (estado: ' + status + ').' };
    }

    // Verificar 18 horas de antelación
    var classDateStr = String(row[H['classDate']] || '');
    var classTime    = String(row[H['time']] || '');
    var dt = _buildDT(classDateStr, classTime);
    if (dt) {
      var hrs = (dt - new Date()) / 3600000;
      if (hrs < CANCEL_HOURS) {
        return {
          success: false,
          message: 'Solo puedes cancelar con mínimo ' + CANCEL_HOURS + ' horas de antelación. Faltan ' + Math.round(hrs) + ' horas.'
        };
      }
    }

    var now = new Date().toISOString();
    sh.getRange(i + 1, H['status'] + 1).setValue('cancelada');
    sh.getRange(i + 1, H['cancelReason'] + 1).setValue(reason);
    sh.getRange(i + 1, H['updatedAt'] + 1).setValue(now);

    // Devolver clase al paquete/única si aplica
    var uid  = String(row[H['userId']]  || '');
    var udoc = String(row[H['userDoc']] || '');
    var mem  = _getActiveMem(uid, udoc);
    if (mem && (mem.tipo === 'paquete_10' || mem.tipo === 'clase_unica')) {
      _decUsadas(mem.rowIndex);
    }

    return { success: true, message: 'Clase cancelada correctamente.' };
  }

  return { success: false, message: 'Reserva no encontrada.' };
}

/**
 * markCumplida — marca manualmente una clase como cumplida.
 */
function markCumplida(payload) {
  var bookingId = payload.bookingId || payload.ID || '';
  if (!bookingId) return { success: false, message: 'Falta bookingId.' };

  var sh   = getOrCreateSheet(SHEETS.PROGRAMACION);
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var H = _hmap(headers);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H['ID']]) !== bookingId) continue;
    var cur = String(data[i][H['status']] || '');
    if (cur === 'cumplida') return { success: true, message: 'Ya estaba marcada como cumplida.' };
    sh.getRange(i + 1, H['status'] + 1).setValue('cumplida');
    sh.getRange(i + 1, H['updatedAt'] + 1).setValue(new Date().toISOString());
    return { success: true, message: 'Clase marcada como cumplida.' };
  }
  return { success: false, message: 'Reserva no encontrada.' };
}

// ── TRIGGER DIARIO — marcar clases pasadas como cumplidas ────────────────────
function autoMarkCumplidas() {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRAMACION);
  if (!sh) return;
  var data    = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var H       = _hmap(headers);
  var now     = new Date();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H['status']] || '') !== 'programada') continue;
    var dt = _buildDT(String(data[i][H['classDate']] || ''), String(data[i][H['time']] || ''));
    if (dt && dt < now) {
      sh.getRange(i + 1, H['status'] + 1).setValue('cumplida');
      sh.getRange(i + 1, H['updatedAt'] + 1).setValue(now.toISOString());
    }
  }
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'autoMarkCumplidas') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoMarkCumplidas').timeBased().everyDays(1).atHour(1).create();
  SpreadsheetApp.getUi().alert('✅ Trigger diario activado. Las clases pasadas se marcan automáticamente como cumplidas.');
}

// ── MEMBRESÍAS — helpers internos ────────────────────────────────────────────

/**
 * addMembership — crea o actualiza una membresía para un usuario.
 * Requiere: userId, userDoc, userName, tipo, vigenciaDesde, vigenciaHasta
 * Opcional: clasesTotal (para paquete_10), estado (default 'activa')
 */
function addMembership(payload) {
  var userId    = payload.userId    || '';
  var userDoc   = (payload.userDoc  || '').replace(/\D/g, '');
  var userName  = payload.userName  || '';
  var tipo      = payload.tipo      || 'membresia_mensual';
  var vigDesde  = payload.vigenciaDesde || '';
  var vigHasta  = payload.vigenciaHasta || '';
  var clasesTotal = (tipo === 'paquete_10') ? (payload.clasesTotal || '10') : '';
  var estado    = payload.estado    || 'activa';

  if (!userDoc && !userId) {
    return { success: false, message: 'Falta userId o userDoc.' };
  }
  if (!vigHasta) {
    return { success: false, message: 'Falta vigenciaHasta.' };
  }

  var id  = 'mem_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  var now = new Date().toISOString();
  var sh  = getOrCreateSheet(SHEETS.MEMBRESIAS);

  var disciplina = payload.disciplina || '';
  var notas      = payload.notas      || '';

  var row = COLUMNS[SHEETS.MEMBRESIAS].map(function(col) {
    var map = {
      'ID':           id,
      'userId':       userId,
      'userName':     userName,
      'userDoc':      userDoc,
      'tipo':         tipo,
      'disciplina':   disciplina,
      'vigenciaDesde':vigDesde,
      'vigenciaHasta':vigHasta,
      'clasesTotal':  clasesTotal,
      'clasesUsadas': '0',
      'estado':       estado,
      'notas':        notas,
      'createdAt':    now,
      'updatedAt':    now
    };
    return map[col] !== undefined ? map[col] : '';
  });
  sh.appendRow(row);
  return { success: true, id: id, message: 'Membresía registrada correctamente.' };
}


function checkMembership(payload) {
  var userId  = payload.userId  || '';
  var userDoc = payload.userDoc || '';
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.MEMBRESIAS);
  if (!sh) return null;
  var data    = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var H       = _hmap(headers);
  var now     = new Date();

  for (var i = 1; i < data.length; i++) {
    var row     = data[i];
    var rUid    = String(row[H['userId']]  || '').trim();
    var rUdoc   = String(row[H['userDoc']] || '').trim().replace(/\D/g, '');
    var estado  = String(row[H['estado']]  || '').trim();
    // Match por ID interno, por cédula en userDoc, O por cédula guardada en userId
    var cleanDoc  = (userDoc || '').replace(/\D/g, '');
    var cleanRuid = rUid.replace(/\D/g, '');
    var match = (userId  && rUid  === userId)           // ID interno exacto
             || (cleanDoc && rUdoc === cleanDoc)         // cédula en userDoc
             || (cleanDoc && cleanRuid === cleanDoc);    // cédula puesta en userId
    if (!match || estado !== 'activa') continue;

    // Parseo robusto de fecha: soporta Date nativa, YYYY-MM-DD y DD/MM/YYYY
    var vigVal = row[H['vigenciaHasta']];
    var vigHasta;
    if (vigVal instanceof Date) {
      vigHasta = vigVal;
    } else {
      var vs = String(vigVal || '').trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(vs)) {
        var vp = vs.split('/');
        vigHasta = new Date(parseInt(vp[2]), parseInt(vp[1]) - 1, parseInt(vp[0]));
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(vs)) {
        var vparts = vs.split('-');
        vigHasta = new Date(parseInt(vparts[0]), parseInt(vparts[1]) - 1, parseInt(vparts[2]));
      } else {
        vigHasta = new Date(vs);
      }
    }
    if (isNaN(vigHasta) || vigHasta < now) continue;

    return {
      rowIndex:     i + 1,
      id:           String(row[H['ID']] || ''),
      userId:       rUid,
      tipo:         String(row[H['tipo']] || ''),
      vigenciaDesde:String(row[H['vigenciaDesde']] || ''),
      vigenciaHasta:String(vigVal || ''),
      clasesTotal:  String(row[H['clasesTotal']]  || ''),
      clasesUsadas: String(row[H['clasesUsadas']] || ''),
      estado:       estado
    };
  }
  return null;
}

function _memLabel(m) {
  var hasta = String(m.vigenciaHasta || '').substring(0, 10);
  if (m.tipo === 'membresia_mensual') return 'Membresía mensual — vigente hasta ' + hasta;
  if (m.tipo === 'paquete_10') {
    var rest = parseInt(m.clasesTotal || 10) - parseInt(m.clasesUsadas || 0);
    return 'Paquete 10 clases — ' + rest + ' disponibles, vigente hasta ' + hasta;
  }
  if (m.tipo === 'clase_unica') return 'Clase única — vigente hasta ' + hasta;
  return 'Plan activo hasta ' + hasta;
}

function _incUsadas(rowIndex) {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.MEMBRESIAS);
  if (!sh) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h){ return String(h).trim(); });
  var col = headers.indexOf('clasesUsadas') + 1;
  if (col < 1) return;
  var cur = parseInt(sh.getRange(rowIndex, col).getValue() || 0);
  sh.getRange(rowIndex, col).setValue(cur + 1);
  var updCol = headers.indexOf('updatedAt') + 1;
  if (updCol > 0) sh.getRange(rowIndex, updCol).setValue(new Date().toISOString());
}

function _decUsadas(rowIndex) {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.MEMBRESIAS);
  if (!sh) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h){ return String(h).trim(); });
  var col = headers.indexOf('clasesUsadas') + 1;
  if (col < 1) return;
  var cur = parseInt(sh.getRange(rowIndex, col).getValue() || 0);
  sh.getRange(rowIndex, col).setValue(Math.max(0, cur - 1));
  var updCol = headers.indexOf('updatedAt') + 1;
  if (updCol > 0) sh.getRange(rowIndex, updCol).setValue(new Date().toISOString());
}

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function _hmap(headers) {
  var H = {};
  headers.forEach(function(h, i){ H[h] = i; });
  return H;
}

function _buildDT(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  try {
    var parts = timeStr.split(':');
    var h = parseInt(parts[0]); var m = parseInt(parts[1] || 0);
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    d.setHours(h, m, 0, 0);
    return d;
  } catch(_) { return null; }
}

// ── INIT — crear hojas nuevas si no existen (ejecutar 1 vez) ─────────────────
function initProgramacionSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  [SHEETS.PROGRAMACION, SHEETS.MEMBRESIAS].forEach(function(name) {
    getOrCreateSheet(name);
  });
  SpreadsheetApp.getUi().alert('✅ Hojas creadas:\n• ' + SHEETS.PROGRAMACION + '\n• ' + SHEETS.MEMBRESIAS + '\n\nYa puedes publicar el script como Web App.');
}

// ── UTILIDADES ORIGINALES ─────────────────────────────────────────────────────
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
    syncHeaders(sheet, name);
  }
  return sheet;
}

function syncHeaders(sheet, name) {
  if (!COLUMNS[name]) return;
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h).trim(); })
    .filter(function(h) { return h !== ''; });

  var expected = COLUMNS[name];
  var toAdd = expected.filter(function(col) { return existing.indexOf(col) === -1; });
  if (toAdd.length === 0) return;

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

// ── FUNCIONES DE PRUEBA ───────────────────────────────────────────────────────
function testMembresia() {
  // Cambia estos valores por los de Daniela u otro usuario a verificar
  var userId  = '';             // ID interno de la hoja Usuarios (ej: 'usr_abc123')
  var userDoc = '1004236226';   // Cédula sin puntos

  Logger.log('🔍 Buscando membresía para userDoc=' + userDoc);
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.MEMBRESIAS);
  if (!sh) { Logger.log('❌ Hoja Membresias no existe'); return; }

  var data    = sh.getDataRange().getValues();
  var headers = data[0].map(function(h){ return String(h).trim(); });
  Logger.log('Columnas en Membresias: ' + JSON.stringify(headers));
  Logger.log('Total filas de datos: ' + (data.length - 1));

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    headers.forEach(function(h, j){ obj[h] = String(row[j] || ''); });
    Logger.log('Fila ' + i + ': ' + JSON.stringify(obj));
  }

  var result = checkMembership({ userId: userId, userDoc: userDoc });
  Logger.log('📋 checkMembership result: ' + JSON.stringify(result));
}


function testIngresos() {
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

function testPayloadDecode() {
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

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ Spreadsheet encontrado: ' + ss.getName());

    var users        = getOrCreateSheet(SHEETS.USERS);
    var attendance   = getOrCreateSheet(SHEETS.ATTENDANCE);
    var income       = getOrCreateSheet(SHEETS.INCOME);
    var expenses     = getOrCreateSheet(SHEETS.EXPENSES);
    var classes      = getOrCreateSheet(SHEETS.CLASSES);
    var programacion = getOrCreateSheet(SHEETS.PROGRAMACION);
    var membresias   = getOrCreateSheet(SHEETS.MEMBRESIAS);

    Logger.log('✅ Usuarios: '            + (users.getLastRow() - 1)        + ' registros');
    Logger.log('✅ Asistencia: '          + (attendance.getLastRow() - 1)   + ' registros');
    Logger.log('✅ Ingresos: '            + (income.getLastRow() - 1)       + ' registros');
    Logger.log('✅ Gastos: '              + (expenses.getLastRow() - 1)     + ' registros');
    Logger.log('✅ Clases: '              + (classes.getLastRow() - 1)      + ' registros');
    Logger.log('✅ Programacion Clases: ' + (programacion.getLastRow() - 1) + ' registros');
    Logger.log('✅ Membresias: '          + (membresias.getLastRow() - 1)   + ' registros');
    Logger.log('');
    Logger.log('🎉 Todo OK. Ya puedes desplegar como Web App.');

  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    Logger.log('→ Verifica que el SPREADSHEET_ID sea correcto y tengas acceso a esa hoja.');
  }
}

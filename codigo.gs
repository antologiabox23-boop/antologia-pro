/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ANTOLOGÍA BOX23 — Google Apps Script Backend  v3          ║
 * ║   Copia TODO este código en script.google.com               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1Q3uao_brBssNkaASs3OBFvtW2J3Of9BflTBHFRqqnR4';

const SHEETS = {
  USERS:              'Usuarios',
  ATTENDANCE:         'Asistencia',
  INCOME:             'Ingresos',
  EXPENSES:           'Gastos',
  CLASSES:            'Clases',
  MEMBRESIAS:         'Membresias',
  PROG_DIANA:         'ProgramacionDiana',
  PROG_POLE:          'ProgramacionPole'
};

const COLUMNS = {
  Usuarios:           ['id','name','document','birthdate','phone','eps','bloodType','pathology','emergencyContact','emergencyPhone','classTime','affiliationType','status','createdAt','updatedAt'],
  Asistencia:         ['id','userId','date','status','time','createdAt'],
  Ingresos:           ['id','userId','paymentType','amount','paymentMethod','paymentDate','startDate','endDate','notes','createdAt'],
  Gastos:             ['id','date','description','amount','category','account','createdAt'],
  Clases:             ['id','date','hour','trainerId','classType','duration','payment','createdAt'],
  Membresias:         ['id','userId','userDoc','userName','tipo','vigenciaDesde','vigenciaHasta','estado','clasesTotal','clasesUsadas','createdAt'],
  ProgramacionDiana:  ['id','userId','userName','userDoc','classType','day','time','classDate','instructor','status','cancelReason','createdAt'],
  ProgramacionPole:   ['id','userId','userName','userDoc','classType','level','day','time','classDate','instructor','status','cancelReason','createdAt']
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeId() {
  return 'id_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 6);
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
        // Intenta JSON plano (frontend actual)
        payload = JSON.parse(decodeURIComponent(e.parameter.payload));
      } catch (e1) {
        try {
          // Fallback: base64 (versiones anteriores)
          var decoded = Utilities.newBlob(
            Utilities.base64Decode(decodeURIComponent(e.parameter.payload))
          ).getDataAsString();
          payload = JSON.parse(decoded);
        } catch (e2) {
          payload = {};
        }
      }
    }
    Logger.log('doGet action=' + action + ' payload=' + JSON.stringify(payload));
    var result = dispatch(action, payload);
    return jsonResponse({ data: result });
  } catch (err) {
    Logger.log('doGet ERROR: ' + err.message);
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
    // Genéricos
    case 'getUsers':          return getAllRows(SHEETS.USERS);
    case 'getAttendance':     return getAllRows(SHEETS.ATTENDANCE);
    case 'getIncome':         return getIncomeEnriched();
    case 'getExpenses':       return getAllRows(SHEETS.EXPENSES);
    case 'getClasses':        return getAllRows(SHEETS.CLASSES);
    case 'addRow':            return addRow(payload.sheet, payload.row);
    case 'updateRow':         return updateRow(payload.sheet, payload.id, payload.data);
    case 'deleteRow':         return deleteRow(payload.sheet, payload.id);
    case 'deleteByField':     return deleteByField(payload.sheet, payload.field, payload.value);
    case 'importAll':         return importAll(payload);
    case 'clearAll':          return clearAll();

    // ── DIANA ──────────────────────────────────────────────────────────
    case 'getProgramacionDiana':  return getProgramacion('ProgramacionDiana', payload);
    case 'addClassDiana':         return addClassProg('ProgramacionDiana', payload);
    case 'getUserClassesDiana':   return getUserClasses('ProgramacionDiana', payload);
    case 'cancelClassDiana':      return cancelClass('ProgramacionDiana', payload);
    case 'updateBookingStatus':   return updateBookingStatus(payload);
    case 'checkIncomeDiana':      return checkIncomeDiana(payload);

    // ── POLE / ACROTELAS ───────────────────────────────────────────────
    case 'getProgramacionPole':   return getProgramacion('ProgramacionPole', payload);
    case 'addClassPole':          return addClassProg('ProgramacionPole', payload);
    case 'getUserClassesPole':    return getUserClasses('ProgramacionPole', payload);
    case 'cancelClassPole':       return cancelClass('ProgramacionPole', payload);
    case 'checkMembership':       return checkMembership(payload);

    // Compatibilidad legacy (pole usaba nombres genéricos)
    case 'getProgramacion':       return getProgramacion('ProgramacionPole', payload);
    case 'addClass':              return addClassProg('ProgramacionPole', payload);
    case 'getUserClasses':        return getUserClasses('ProgramacionPole', payload);
    case 'cancelClass':           return cancelClass('ProgramacionPole', payload);

    default: throw new Error('Acción desconocida: ' + action);
  }
}

// ── PROGRAMACIÓN GENÉRICA ────────────────────────────────────────────────────

/**
 * Devuelve todas las reservas de una hoja de programación.
 * Filtro opcional por classType.
 */
function getProgramacion(sheetName, payload) {
  var rows = getAllRows(sheetName);
  if (payload && payload.classType) {
    rows = rows.filter(function(r) { return r.classType === payload.classType; });
  }
  return rows;
}

/**
 * Agrega una reserva a ProgramacionDiana o ProgramacionPole.
 */
function addClassProg(sheetName, booking) {
  var id = makeId();
  var now = new Date();
  var nowStr = now.getFullYear() + '-' +
    String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0') + 'T' +
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0');

  var row = {};
  var cols = COLUMNS[sheetName];
  cols.forEach(function(c) { row[c] = booking[c] || ''; });
  row.id        = id;
  row.status    = row.status || 'programada';
  row.createdAt = nowStr;

  addRow(sheetName, row);
  return { success: true, bookingId: id };
}

/**
 * Devuelve las reservas de un usuario específico.
 */
function getUserClasses(sheetName, payload) {
  var userId  = payload.userId  || '';
  var userDoc = (payload.userDoc || '').replace(/\D/g,'');
  var rows    = getAllRows(sheetName);
  var classes = rows.filter(function(r) {
    var byId  = userId  && String(r.userId)  === String(userId);
    var byDoc = userDoc && (r.userDoc||'').replace(/\D/g,'') === userDoc;
    return byId || byDoc;
  });
  return { classes: classes };
}

/**
 * Cancela una reserva actualizando su status y cancelReason.
 */
function cancelClass(sheetName, payload) {
  var bookingId = payload.bookingId || payload.id || '';
  var reason    = payload.reason    || 'Cancelado';
  var sheet     = getOrCreateSheet(sheetName);
  var data      = sheet.getDataRange().getValues();
  var headers   = data[0];
  var idCol     = headers.indexOf('id');
  var statusCol = headers.indexOf('status');
  var reasonCol = headers.indexOf('cancelReason');
  if (idCol === -1) throw new Error('Columna id no encontrada en ' + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(bookingId)) {
      if (statusCol !== -1) sheet.getRange(i+1, statusCol+1).setValue('cancelada');
      if (reasonCol !== -1) sheet.getRange(i+1, reasonCol+1).setValue(reason);
      return { success: true };
    }
  }
  throw new Error('Reserva ' + bookingId + ' no encontrada en ' + sheetName);
}


// ── ACTUALIZAR ESTADO DE RESERVA + REGISTRAR ASISTENCIA ────────────────────────
/**
 * Actualiza el status de una reserva en ProgramacionDiana.
 * Si el nuevo status es 'cumplida', registra ademas en la hoja Asistencia.
 * Payload esperado: { bookingId, userId, date, time, status, confirmedBy }
 */
function updateBookingStatus(payload) {
  var bookingId   = String(payload.bookingId   || '').trim();
  var userId      = String(payload.userId      || '').trim();
  var dateStr     = String(payload.date        || '').trim();
  var timeStr     = String(payload.time        || '').trim();
  var newStatus   = String(payload.status      || '').trim();
  var confirmedBy = String(payload.confirmedBy || 'diana').trim();

  if (!newStatus) throw new Error('updateBookingStatus: falta el campo status');
  if (!bookingId && !userId)
    throw new Error('updateBookingStatus: se requiere bookingId o userId');

  // 1. Actualizar la hoja ProgramacionDiana
  var sheet   = getOrCreateSheet('ProgramacionDiana');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol      = headers.indexOf('id');
  var userIdCol  = headers.indexOf('userId');
  var dateCol    = headers.indexOf('classDate');
  var timeCol    = headers.indexOf('time');
  var statusCol  = headers.indexOf('status');

  if (statusCol === -1)
    throw new Error('Columna status no encontrada en ProgramacionDiana');

  var rowUpdated  = false;
  var bookingData = null;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var matchById   = bookingId && idCol !== -1 && String(row[idCol]) === bookingId;
    var matchByUser = !matchById && userId &&
                      userIdCol !== -1 && String(row[userIdCol]) === userId &&
                      dateCol   !== -1 && String(row[dateCol]).substring(0,10) === dateStr &&
                      timeCol   !== -1 && String(row[timeCol]).trim() === timeStr;

    if (matchById || matchByUser) {
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      bookingData = {};
      headers.forEach(function(h, idx) { bookingData[h] = row[idx]; });
      rowUpdated = true;
      break;
    }
  }

  if (!rowUpdated) {
    Logger.log('updateBookingStatus: reserva no encontrada, id=' + bookingId +
               ' userId=' + userId + ' date=' + dateStr + ' time=' + timeStr);
  }

  // 2. Si es 'cumplida', registrar en Asistencia sin duplicar
  if (newStatus === 'cumplida') {
    var asistUserId = userId || (bookingData && (bookingData.userId || '')) || '';

    var asistSheet   = getOrCreateSheet(SHEETS.ATTENDANCE);
    var asistData    = asistSheet.getDataRange().getValues();
    var aHeaders     = asistData[0];
    var aUserIdCol   = aHeaders.indexOf('userId');
    var aDateCol     = aHeaders.indexOf('date');
    var aTimeCol     = aHeaders.indexOf('time');
    var aStatusCol   = aHeaders.indexOf('status');

    var alreadyExists = false;
    for (var j = 1; j < asistData.length; j++) {
      var aRow = asistData[j];
      var sameUser = aUserIdCol !== -1 && String(aRow[aUserIdCol]) === String(asistUserId);
      var sameDate = aDateCol   !== -1 && String(aRow[aDateCol]).substring(0,10) === dateStr;
      var sameTime = aTimeCol   !== -1 && String(aRow[aTimeCol]).trim() === timeStr;
      var sameStat = aStatusCol !== -1 && String(aRow[aStatusCol]) === 'cumplida';
      if (sameUser && sameDate && sameTime && sameStat) {
        alreadyExists = true;
        break;
      }
    }

    if (!alreadyExists) {
      var now = new Date();
      var nowStr = now.getFullYear() + '-' +
        String(now.getMonth()+1).padStart(2,'0') + '-' +
        String(now.getDate()).padStart(2,'0') + 'T' +
        String(now.getHours()).padStart(2,'0') + ':' +
        String(now.getMinutes()).padStart(2,'0');

      var asistRow = {
        id:        makeId(),
        userId:    asistUserId,
        date:      dateStr,
        status:    'cumplida',
        time:      timeStr,
        createdAt: nowStr
      };
      addRow(SHEETS.ATTENDANCE, asistRow);
      Logger.log('Asistencia registrada: userId=' + asistUserId + ' date=' + dateStr + ' time=' + timeStr);
    } else {
      Logger.log('Asistencia ya existia, no se duplica');
    }
  }

  return { success: true, updated: rowUpdated, status: newStatus };
}

// ── VERIFICACIÓN MEMBRESÍA POLE ───────────────────────────────────────────────
/**
 * Verifica si el usuario tiene membresía activa en hoja Membresias.
 */
function checkMembership(payload) {
  var userId  = String(payload.userId  || '').trim();
  var userDoc = String(payload.userDoc || '').replace(/\D/g,'');

  var rows = getAllRows(SHEETS.MEMBRESIAS);
  var today = new Date(); today.setHours(0,0,0,0);

  var found = rows.filter(function(r) {
    var byId  = userId  && String(r.userId)  === String(userId);
    var byDoc = userDoc && (r.userDoc||'').replace(/\D/g,'') === userDoc;
    return (byId || byDoc) && r.estado === 'activa';
  });

  if (!found.length) {
    return { success:true, canBook:false, reason:'Sin membresía activa. Contacta recepción.', membership:null };
  }

  // Buscar vigente
  found.sort(function(a,b){ return new Date(b.vigenciaHasta||'2000-01-01')-new Date(a.vigenciaHasta||'2000-01-01'); });
  var mem = found[0];
  var fin = mem.vigenciaHasta ? new Date(mem.vigenciaHasta + 'T12:00:00') : null;
  var vigente = fin && fin >= today;

  if (!vigente) {
    return { success:true, canBook:false, reason:'Membresía vencida el ' + (mem.vigenciaHasta||'?') + '. Renueva en recepción.', membership:mem };
  }

  return {
    success:true, canBook:true,
    reason:'Membresía activa hasta ' + mem.vigenciaHasta,
    membership: mem
  };
}

// ── VERIFICACIÓN INGRESOS DIANA ───────────────────────────────────────────────
/**
 * Busca el pago más reciente en Ingresos tipo Diana con clases disponibles.
 */
function checkIncomeDiana(payload) {
  var userId  = String(payload.userId  || '').trim();
  var userDoc = String(payload.userDoc || '').replace(/\D/g,'');

  // Palabras clave que identifican un plan Diana en paymentType
  var DIANA_TYPES = [
    'semipersonalizado diana','semipersonalizados diana',
    'personalizado diana','personalizados diana',
    'diana'
  ];

  // ── Resolver todos los userId candidatos para este usuario ──────────────
  // La hoja Ingresos solo tiene userId, no documento.
  // Cruzamos con Usuarios para obtener el id correcto si se pasó documento.
  // Normaliza userId quitando decimales innecesarios ("1.0" → "1")
  // Normaliza userId solo quitando decimales ("1.0" → "1"). NO truncar UUIDs —
  // en este sistema userId en Ingresos === id en Usuarios de forma exacta.
  function normUid(v) {
    return String(v || '').trim().replace(/\.0+$/, '');
  }
  if (userId) candidateIds.push(normUid(userId));

  if (userDoc) {
    try {
      var users = getAllRows(SHEETS.USERS);
      users.forEach(function(u) {
        var uDoc = (u.document || '').replace(/\D/g,'');
        if (uDoc && uDoc === userDoc) {
          var uid = normUid(u.id);
          if (uid && candidateIds.indexOf(uid) === -1) candidateIds.push(uid);
        }
      });
    } catch(e) { /* continúa con lo que hay */ }
  }

  var rows  = getAllRows(SHEETS.INCOME);
  var today = new Date(); today.setHours(0,0,0,0);

  var mios = rows.filter(function(p) {
    var pUid = normUid(p.userId);

    // Match por userId directo o por cualquier id candidato (normalizado)
    var byId = candidateIds.some(function(cid) { return cid && cid === pUid; });

    // Match por columna userDoc en Ingresos (si se guardó al registrar el pago)
    var pDocCol  = (p.userDoc || '').replace(/\D/g,'');
    var byDocCol = userDoc && pDocCol.length >= 3 && pDocCol === userDoc;

    // Fallback: el campo notes podría contener el documento
    var pDocNotes  = (p.notes || '').replace(/\D/g,'');
    var byDocNotes = userDoc && pDocNotes.length >= 6 && pDocNotes === userDoc;

    if (!byId && !byDocCol && !byDocNotes) return false;

    // Verificar que el paymentType corresponde a Diana
    var tipo = (p.paymentType || '').toLowerCase().trim();
    return DIANA_TYPES.some(function(t) { return tipo.indexOf(t) !== -1; });
  });

  // ── Debug log para revisar en Apps Script si sigue fallando ─────────────
  Logger.log('checkIncomeDiana — userId:' + userId + ' userDoc:' + userDoc +
    ' candidateIds (normalizados):' + JSON.stringify(candidateIds) +
    ' totalIngresos:' + rows.length + ' coincidencias:' + mios.length +
    ' ejemploIngreso:' + (rows.length ? JSON.stringify({userId:rows[0].userId, userDoc:rows[0].userDoc, paymentType:rows[0].paymentType}) : 'ninguno'));

  if (!mios.length) {
    return { success:true, canBook:false,
      reason:'Sin plan semipersonalizado activo. Verifica con el administrador.',
      membership:null, debug:{ candidateIds:candidateIds, totalRows:rows.length } };
  }

  mios.sort(function(a,b){
    return new Date(b.endDate||'2000-01-01') - new Date(a.endDate||'2000-01-01');
  });
  var ult     = mios[0];
  var fin     = ult.endDate ? new Date(ult.endDate + 'T12:00:00') : null;
  var vigente = fin && fin >= today;

  if (!ult.endDate) {
    return { success:true, canBook:false,
      reason:'Plan Diana sin fecha de vencimiento. Contacta a Diana.',
      membership:null,
      debug:{ candidateIds:candidateIds, paymentType:ult.paymentType, endDate:ult.endDate, startDate:ult.startDate } };
  }

  if (!vigente) {
    return { success:true, canBook:false,
      reason:'Plan Diana venció el ' + ult.endDate + '. Renueva con Diana.',
      membership:null,
      debug:{ candidateIds:candidateIds, paymentType:ult.paymentType, endDate:ult.endDate } };
  }

  return {
    success:true, canBook:true,
    reason:'Plan Diana vigente hasta ' + ult.endDate,
    membership:{
      tipo: ult.paymentType,
      vigenciaDesde: ult.startDate || ult.paymentDate || '',
      vigenciaHasta: ult.endDate,
      estado: 'activa', fromIncome: true
    },
    debug:{ candidateIds:candidateIds, paymentType:ult.paymentType, endDate:ult.endDate }
  };
}

// ── OPERACIONES CRUD ─────────────────────────────────────────────────────────

var DATE_COLUMNS = {
  Usuarios:           ['birthdate','createdAt','updatedAt'],
  Asistencia:         ['date','createdAt'],
  Ingresos:           ['paymentDate','startDate','endDate','createdAt'],
  Gastos:             ['date','createdAt'],
  Clases:             ['date','createdAt'],
  Membresias:         ['vigenciaDesde','vigenciaHasta','createdAt'],
  ProgramacionDiana:  ['classDate','createdAt'],
  ProgramacionPole:   ['classDate','createdAt']
};

// Columnas que contienen hora (Date de Sheets → 'HH:MM')
var TIME_COLUMNS = {
  ProgramacionDiana: ['time'],
  ProgramacionPole:  ['time'],
  Asistencia:        ['time'],
  Clases:            ['hour']
};

var NUMERIC_COLUMNS = {
  Ingresos: ['amount'],
  Gastos:   ['amount'],
  Clases:   ['duration','payment']
};

function serializeCell(value, columnName, sheetName) {
  if (value === '' || value === null || value === undefined) return null;
  if (value instanceof Date) {
    var dateColumns = DATE_COLUMNS[sheetName] || [];
    var timeColumns = (TIME_COLUMNS[sheetName] || []);
    // Hora como HH:MM
    if (timeColumns.indexOf(columnName) !== -1) {
      var hh = String(value.getHours()).padStart(2,'0');
      var mm = String(value.getMinutes()).padStart(2,'0');
      return hh + ':' + mm;
    }
    // Fecha como YYYY-MM-DD
    if (dateColumns.indexOf(columnName) !== -1) {
      var y = value.getFullYear();
      var m = String(value.getMonth()+1).padStart(2,'0');
      var d = String(value.getDate()).padStart(2,'0');
      return y + '-' + m + '-' + d;
    }
    // Cualquier otro Date: intentar HH:MM si parece solo hora
    // (epoch 1899-12-30 = fecha base de Sheets, hora pura tiene año 1899 o 1900)
    if (value.getFullYear() <= 1900) {
      var hh2 = String(value.getHours()).padStart(2,'0');
      var mm2 = String(value.getMinutes()).padStart(2,'0');
      return hh2 + ':' + mm2;
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
      var m2 = String(date.getMonth()+1).padStart(2,'0');
      var d2 = String(date.getDate()).padStart(2,'0');
      return y2 + '-' + m2 + '-' + d2;
    }
    return String(value);
  }
  return String(value);
}

/**
 * Devuelve todos los ingresos enriquecidos con userDoc y userName del usuario,
 * cruzando por userId con la hoja Usuarios. Esto permite que el frontend pueda
 * identificar el plan Diana activo de un usuario aunque no tenga bookings previos.
 */
function getIncomeEnriched() {
  var income = getAllRows(SHEETS.INCOME);
  var users  = getAllRows(SHEETS.USERS);

  function normUid(v) {
    return String(v || '').trim().replace(/\.0+$/, '');
  }

  // Construir mapa userId → { document, name }
  var userMap = {};
  users.forEach(function(u) {
    var uid = normUid(u.id);
    if (uid) userMap[uid] = { document: u.document || '', name: u.name || '' };
  });

  income.forEach(function(p) {
    var uid = normUid(p.userId);
    var u   = userMap[uid];
    if (u) {
      p.userDoc  = p.userDoc  || u.document;
      p.userName = p.userName || u.name;
    }
  });
  return income;
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

function addRow(sheetName, rowData) {
  const sheet   = getOrCreateSheet(sheetName);
  const headers = COLUMNS[sheetName];
  if (!headers) throw new Error('Hoja desconocida: ' + sheetName);
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
      sheet.getRange(i+1, 1, 1, updatedRow.length).setValues([updatedRow]);
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
      sheet.deleteRow(i+1);
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
      sheet.deleteRow(i+1);
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
    if (COLUMNS[name]) {
      sheet.appendRow(COLUMNS[name]);
      var headerRange = sheet.getRange(1, 1, 1, COLUMNS[name].length);
      headerRange.setBackground('#273043');
      headerRange.setFontColor('#27F9D4');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  } else {
    if (COLUMNS[name]) syncHeaders(sheet, name);
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
}

function testConnection() {
  try {
    Logger.log('ID: ' + SPREADSHEET_ID);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log('✅ Spreadsheet: ' + ss.getName());
    var sheetNames = ['Usuarios','Asistencia','Ingresos','Gastos','Clases','Membresias','ProgramacionDiana','ProgramacionPole'];
    sheetNames.forEach(function(n) {
      var s = getOrCreateSheet(n);
      Logger.log('✅ ' + n + ': ' + (s.getLastRow()-1) + ' registros');
    });
    Logger.log('🎉 Todo OK.');
  } catch(err) {
    Logger.log('❌ Error: ' + err.message);
  }
}

# Exportación de Análisis de Datos - Excel

## 📊 Descripción

Genera un archivo Excel completo con **6 hojas** conteniendo todos los datos de la aplicación, formateados y listos para análisis avanzado en Excel, Power BI, Tableau u otras herramientas de análisis.

## 🚀 Cómo Usar

1. Ve a la pestaña **⚙️ Configuración**
2. En la card de **"Respaldo de Datos"**, al final encontrarás el botón verde:
   ```
   📊 Exportar Análisis Completo (Excel)
   ```
3. Haz clic en el botón
4. El sistema descargará automáticamente un archivo Excel con nombre:
   ```
   Antologia_Box23_Analisis_YYYYMMDD.xlsx
   ```

## 📄 Hojas del Archivo Excel

### 1️⃣ **Usuarios**
Todos los usuarios registrados con información completa:
- Datos personales (nombre, documento, teléfono, email)
- Información médica (EPS, patologías, contacto de emergencia)
- Datos de afiliación (tipo, estado, hora preferida)
- Fecha de creación
- **Cálculo automático de edad** a partir de fecha de nacimiento

**Columnas:** ID, Nombre, Documento, Teléfono, Email, Tipo, Estado, Fecha Nacimiento, Edad, Género, Dirección, EPS, Patologías, Contacto Emergencia, Tel. Emergencia, Hora Preferida, Creado

### 2️⃣ **Asistencia**
Registro histórico completo de asistencia:
- Fecha de cada asistencia
- Usuario y su ID
- Estado (Presente/Ausente)
- Hora de marcado
- Fecha de registro

**Columnas:** Fecha, Usuario, ID Usuario, Estado, Hora, Registrado

### 3️⃣ **Pagos**
Historial completo de ingresos/pagos:
- Fecha de pago y vigencias
- Usuario y tipo de pago
- Montos y métodos de pago
- **Cálculo automático de días de vigencia**

**Columnas:** Fecha Pago, Usuario, ID Usuario, Tipo Pago, Monto, Método, Inicio Vigencia, Fin Vigencia, Días Vigencia, Registrado

### 4️⃣ **Gastos**
Registro de todos los gastos:
- Fecha y descripción
- Monto, categoría y cuenta
- Fecha de registro

**Columnas:** Fecha, Descripción, Monto, Categoría, Cuenta, Registrado

### 5️⃣ **Clases Personal**
Registro de clases dictadas por entrenadores:
- Fecha y hora de cada clase
- Entrenador asignado
- Tipo de clase y duración
- Fecha de registro

**Columnas:** Fecha, Hora, Entrenador, ID Entrenador, Tipo Clase, Duración (h), Registrado

### 6️⃣ **Resumen General**
Dashboard con métricas clave del negocio:

**Usuarios:**
- Usuarios Activos
- Entrenadores
- Total Usuarios

**Financiero (Mes Actual):**
- Total Ingresos
- Total Gastos
- Balance

**Asistencia:**
- Presentes Hoy
- Tasa de Asistencia Hoy (%)

**Metadata:**
- Fecha y hora de generación del reporte

## 💡 Usos Recomendados

### 📈 Análisis en Excel
1. **Tablas Dinámicas**: Crea tablas dinámicas para analizar:
   - Ingresos por mes/tipo de pago
   - Asistencia por usuario/período
   - Gastos por categoría
   - Horas de clases por entrenador

2. **Gráficos**: Genera gráficos automáticos:
   - Tendencia de ingresos vs gastos
   - Curva de asistencia mensual
   - Distribución de tipos de pago
   - Horas trabajadas por entrenador

3. **Fórmulas Avanzadas**: Calcula:
   - Promedio de asistencia por usuario
   - Tasa de retención mensual
   - Ingresos promedio por usuario
   - Costo por hora de entrenador

### 📊 Integración con Power BI / Tableau
1. Importa el archivo Excel como fuente de datos
2. Las hojas están pre-formateadas con columnas limpias
3. Crea dashboards interactivos y reportes visuales

### 🔍 Análisis de Tendencias
- Identifica patrones de asistencia
- Encuentra usuarios con pagos vencidos
- Analiza rentabilidad por tipo de servicio
- Optimiza horarios según asistencia histórica

## 🛠️ Características Técnicas

### Formato Excel
- Archivo `.xlsx` compatible con Excel 2007+
- 6 hojas con nombres descriptivos
- Columnas con anchos optimizados automáticamente
- Datos ordenados cronológicamente (más reciente primero)

### Datos Calculados
El sistema calcula automáticamente:
- **Edad** a partir de fecha de nacimiento
- **Días de vigencia** entre inicio y fin de pago
- **Totales** de ingresos y gastos del mes
- **Tasa de asistencia** del día actual

### Librería Utilizada
- **SheetJS (xlsx.js)** - Se carga automáticamente cuando exportas
- Versión: 0.20.1
- CDN: https://cdn.sheetjs.com

## 📋 Casos de Uso Específicos

### 1. Reporte Mensual para Contabilidad
```
1. Exporta el análisis al cierre del mes
2. Abre la hoja "Resumen General" → Balance del mes
3. Abre "Pagos" → Filtra por mes actual
4. Abre "Gastos" → Filtra por mes actual
5. Entrega el archivo a tu contador
```

### 2. Análisis de Retención de Usuarios
```
1. Abre hoja "Asistencia"
2. Crea tabla dinámica: Usuario vs Mes
3. Identifica usuarios con 0 asistencias en el último mes
4. Cross-reference con hoja "Pagos" para ver vigencias
```

### 3. Optimización de Horarios
```
1. Abre hoja "Asistencia"
2. Filtra por "Presente"
3. Crea gráfico de asistencia por hora del día
4. Identifica horarios pico y bajos
5. Ajusta schedule de entrenadores
```

### 4. Cálculo de Comisiones
```
1. Abre hoja "Clases Personal"
2. Filtra por entrenador y período
3. Suma columna "Duración (h)"
4. Multiplica por tarifa horaria
```

## ⚠️ Consideraciones

### Datos Sensibles
- El archivo contiene información personal y financiera
- Guárdalo de forma segura
- No lo compartas públicamente
- Considera encriptarlo si lo envías por email

### Privacidad
- Los IDs únicos de usuarios están incluidos
- Puedes eliminar columnas sensibles antes de compartir
- Recomendado: Crea copias sin datos personales para análisis externo

### Rendimiento
- Archivos grandes (1000+ registros) pueden tardar 2-3 segundos
- El navegador puede mostrar "No responde" momentáneamente (es normal)
- La descarga inicia automáticamente al finalizar

## 🔧 Solución de Problemas

### El archivo no se descarga
1. Verifica que tu navegador permite descargas automáticas
2. Revisa la carpeta de descargas
3. Intenta en modo incógnito
4. Prueba con otro navegador

### Error al generar el archivo
1. Abre la consola (F12)
2. Reporta el error mostrado
3. Verifica conexión a internet (carga SheetJS del CDN)
4. Recarga la página e intenta nuevamente

### Falta información en alguna hoja
- Algunas hojas pueden estar vacías si no hay datos
- Ejemplo: "Clases Personal" estará vacío si no has registrado clases
- Esto es normal y esperado

## 📞 Soporte

Para reportar problemas o sugerir mejoras en la exportación:
1. Captura de pantalla del error (si lo hay)
2. Número aproximado de registros en cada módulo
3. Navegador y versión utilizada

---

**Versión:** 1.0  
**Última actualización:** Febrero 2026  
**Desarrollado por:** Antología Box23

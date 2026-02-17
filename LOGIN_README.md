# Sistema de Login - Antología Box23

## 🔐 Descripción

Sistema de autenticación simple para proteger el acceso a la aplicación principal de gestión del gimnasio.

## 🚀 Características

- **Login con contraseña** antes de acceder a la aplicación
- **Sesión de 12 horas** - No pide contraseña nuevamente durante ese tiempo
- **Cambio de contraseña** desde el panel de configuración
- **Botón de logout** en el navbar
- **Contraseña de emergencia** recuperable desde consola

## 🔑 Contraseña Predeterminada

```
box23admin
```

Esta es la contraseña inicial. Se recomienda cambiarla inmediatamente después del primer acceso.

## 📝 Cómo Usar

### Primer Acceso

1. Abre la aplicación en el navegador
2. Verás la pantalla de login
3. Ingresa la contraseña predeterminada: `box23admin`
4. Presiona "Ingresar"

### Cambiar Contraseña

1. Una vez dentro de la app, ve a la pestaña **⚙️ Configuración**
2. En la card **Seguridad**, encontrarás:
   - Campo "Contraseña actual"
   - Campo "Nueva contraseña" (mínimo 4 caracteres)
   - Campo "Confirmar nueva contraseña"
3. Completa los campos y presiona **"Cambiar Contraseña"**
4. Verás un mensaje de confirmación

### Cerrar Sesión

- Haz clic en el botón **🚪** (rojo) en la esquina superior derecha del navbar
- Esto te llevará de vuelta a la pantalla de login

### Recuperar Contraseña Olvidada

Si olvidaste tu contraseña, puedes resetearla desde la consola del navegador:

1. Abre la consola de desarrollo (F12)
2. Escribe: `Auth.resetPassword()`
3. Presiona Enter
4. La contraseña volverá a ser `box23admin`
5. Recarga la página y usa la contraseña predeterminada

### Cambiar Contraseña desde Consola (Avanzado)

También puedes cambiar la contraseña directamente desde la consola:

```javascript
Auth.changePassword('tuNuevaContraseña')
```

## 🛡️ Seguridad

### Almacenamiento

- La contraseña se almacena en **localStorage** del navegador
- La sesión es válida por **12 horas** desde el último login
- Los datos están disponibles solo en el navegador donde iniciaste sesión

### Limitaciones

⚠️ **Este es un sistema de login básico para uso local/privado:**

- La contraseña se almacena en texto plano en localStorage
- No hay encriptación de datos
- No hay validación de usuario (solo contraseña)
- No hay recuperación de contraseña por email
- Cualquiera con acceso físico al dispositivo puede ver el localStorage

**Recomendaciones:**
- Usa contraseñas únicas
- No compartas el dispositivo con personas no autorizadas
- Para mayor seguridad, considera implementar un sistema de autenticación completo con backend

## 🔧 Configuración Técnica

### Archivos Modificados

- `/js/auth.js` - Módulo de autenticación
- `/js/app.js` - Integración del login en el bootstrap
- `/index.html` - Pantalla de login y card de configuración
- `/css/styles.css` - Estilos de la pantalla de login

### Constantes Configurables (en `auth.js`)

```javascript
const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 horas
const DEFAULT_PASSWORD = 'box23admin';
```

### Métodos Disponibles (API)

```javascript
Auth.initialize()        // Inicializa el sistema de auth
Auth.logout()           // Cierra sesión
Auth.changePassword(p)  // Cambia la contraseña
Auth.resetPassword()    // Resetea a contraseña predeterminada
Auth.isAuthenticated()  // Verifica si hay sesión activa
```

## 📱 Compatibilidad

El sistema funciona en todos los navegadores modernos que soporten:
- localStorage
- ES6+
- CSS3

## 🐛 Solución de Problemas

### No puedo acceder aunque la contraseña sea correcta

1. Verifica que JavaScript esté habilitado
2. Limpia el caché del navegador
3. Prueba en modo incógnito
4. Resetea la contraseña desde consola

### La sesión expira muy rápido

- La sesión dura 12 horas por defecto
- Si cambias de dispositivo o navegador, debes iniciar sesión nuevamente
- Si limpias el localStorage, perderás la sesión

### Olvidé la contraseña y no puedo acceder a la consola

- Si no puedes acceder a la consola del navegador:
  1. Abre las Herramientas de Desarrollo (F12)
  2. Ve a la pestaña "Application" o "Almacenamiento"
  3. Encuentra localStorage
  4. Elimina la clave `box23_password`
  5. Recarga la página
  6. Usa la contraseña predeterminada `box23admin`

---

**Desarrollado por:** Antología Box23  
**Versión:** 1.0  
**Fecha:** Febrero 2026

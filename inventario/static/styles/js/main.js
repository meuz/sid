// ==========================
//  CONFIG
// ==========================
const API_BASE = "";           // mismo origen donde se sirve Django
const TOKEN_KEY = "sid_token"; // clave para sessionStorage

let accessToken = null;
let html5QrCode = null;
let currentCameraId = null;
let isScanBusy = false;
let lastDecodedText = null;

// Datos del activo actualmente seleccionado (para cambio de estado)
let activoCodigoActual = null;
let activoEstadoActual = null;

// ==========================
//  ELEMENTOS DEL DOM
// ==========================
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");

const loginStatus = document.getElementById("login-status");
const scanStatus = document.getElementById("scan-status");
const manualStatus = document.getElementById("manual-status");

const activoResumenSid = document.getElementById("activo-resumen-sid");
const activoResumenOcs = document.getElementById("activo-resumen-ocs");
const activoJson = document.getElementById("activo-json");

const btnLogin = document.getElementById("btn-login");
const btnStartScan = document.getElementById("btn-start-scan");
const btnStopScan = document.getElementById("btn-stop-scan");
const btnBuscar = document.getElementById("btn-buscar");
const btnLogout = document.getElementById("btn-logout");

const inputUser = document.getElementById("username");
const inputPass = document.getElementById("password");
const inputCodigoManual = document.getElementById("codigo-manual");

const btnGenerarQR = document.getElementById("btn-generar-qr");
const inputCodigoQR = document.getElementById("codigo-qr");
const qrStatus = document.getElementById("qr-status");
const qrPreview = document.getElementById("qr-preview");
const qrDownload = document.getElementById("qr-download");

// Elementos para reporte de activos
const btnDescargarCsv = document.getElementById("btn-descargar-csv");
let ultimoReporteActivos = null; // aquí guardaremos el último reporte obtenido

const btnReporte = document.getElementById("btn-reporte");
const filtroEdificio = document.getElementById("filtro-edificio");
const filtroArea = document.getElementById("filtro-area");
const filtroDepartamento = document.getElementById("filtro-departamento");
const reporteStatus = document.getElementById("reporte-status");
const reporteJson = document.getElementById("reporte-json");
const reporteTabla = document.getElementById("reporte-tabla");
const reporteResumen = document.getElementById("reporte-resumen");


// Elementos para CAMBIO DE ESTADO
const btnEditarEstado   = document.getElementById("btn-editar-estado");
const estadoEditor      = document.getElementById("estado-editor");
const selectEstado      = document.getElementById("select-estado");
const btnGuardarEstado  = document.getElementById("btn-guardar-estado");
const estadoStatus      = document.getElementById("estado-status");

console.log("main.js cargado correctamente ✅");


// ==========================
//  FUNCIONES AUXILIARES
// ==========================
function hacerLogout(mensaje) {
  accessToken = null;
  sessionStorage.removeItem(TOKEN_KEY);

  // Ocultar app, mostrar login
  appSection.classList.add("hidden");
  loginSection.classList.remove("hidden");

  // ------------------------
  // LIMPIAR SECCIONES
  // ------------------------
  scanStatus.textContent = "";
  manualStatus.textContent = "";
  qrStatus.textContent = "";

  // Activo
  if (activoResumenSid) activoResumenSid.innerHTML = "";
  if (activoResumenOcs) activoResumenOcs.innerHTML = "";
  if (activoJson) activoJson.textContent = "Sin datos todavía…";

  // Reporte (ESTO ES LO QUE TE FALTA)
  if (reporteStatus) {
    reporteStatus.textContent = "";
    reporteStatus.className = "status";
  }
  if (reporteResumen) {
    reporteResumen.innerHTML = "";
  }
  if (reporteTabla) {
    reporteTabla.innerHTML = "";
  }
  if (reporteJson) {
    reporteJson.textContent = "Sin datos de reporte todavía…";
  }
  if (btnDescargarCsv) {
    btnDescargarCsv.classList.add("hidden");
  }
  ultimoReporteActivos = null;

  // Reset de estado de activo
  activoCodigoActual = null;
  activoEstadoActual = null;

  if (btnEditarEstado) btnEditarEstado.classList.add("hidden");
  if (estadoEditor) estadoEditor.classList.add("hidden");
  if (estadoStatus) {
    estadoStatus.textContent = "";
    estadoStatus.className = "status";
  }

  // Ocultar botón logout
  btnLogout.classList.add("hidden");

  // Mensaje final
  if (mensaje) {
    loginStatus.textContent = mensaje;
    loginStatus.className = "status error";
  } else {
    loginStatus.textContent = "Sesión cerrada correctamente.";
    loginStatus.className = "status success";
  }
}



// ==========================
//  RESTAURAR TOKEN SI EXISTE (solo mientras la pestaña viva)
// ==========================
const savedToken = sessionStorage.getItem(TOKEN_KEY);
if (savedToken) {
  accessToken = savedToken;
  console.log("🔁 Token restaurado desde sessionStorage");
  loginSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
}


// ==========================
//  LOGIN
// ==========================
btnLogin.addEventListener("click", async () => {
  console.log("➡️ Click en Iniciar sesión");

  loginStatus.textContent = "";
  loginStatus.className = "status";

  const username = inputUser.value.trim();
  const password = inputPass.value;

  if (!username || !password) {
    loginStatus.textContent = "Ingresa usuario y contraseña.";
    loginStatus.classList.add("error");
    return;
  }

  btnLogin.disabled = true;
  loginStatus.textContent = "Iniciando sesión...";

  try {
    const res = await fetch(API_BASE + "/api/auth/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    console.log("➡️ Respuesta login HTTP:", res.status);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg =
        errData.detail || `Error ${res.status}: ${res.statusText}`;
      loginStatus.textContent = msg;
      loginStatus.classList.add("error");
      return;
    }

    const data = await res.json();
    accessToken = data.access;

    // guardar en sessionStorage (solo vive mientras la pestaña esté abierta)
    sessionStorage.setItem(TOKEN_KEY, accessToken);

    console.log("🔑 Token recibido:", accessToken);

    loginStatus.textContent = "Sesión iniciada correctamente.";
    loginStatus.classList.add("success");

    // Mostrar app y ocultar login
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Error real al consultar activo:", err);

    const msg = (err && err.message) ? err.message : String(err);
    manualStatus.textContent = "Error al consultar el activo: " + msg;
    manualStatus.className = "status error";
  } finally {
    btnLogin.disabled = false;
  }
});


// ==========================
//  LOGOUT
// ==========================
btnLogout.addEventListener("click", () => {
  hacerLogout(null);
});


// ==========================
//  CONSULTAR ACTIVO
// ==========================
async function consultarActivo(codigo) {
  if (!accessToken) {
    manualStatus.textContent = "Debes iniciar sesión primero.";
    manualStatus.classList.add("error");
    return;
  }

  scanStatus.textContent = "";
  manualStatus.textContent = "";
  manualStatus.className = "status";

  manualStatus.textContent = `Buscando activo ${codigo}...`;

  try {
    console.log("🔑 Token usado en consulta:", accessToken);

    const res = await fetch(
      API_BASE + `/api/activos/${encodeURIComponent(codigo)}/`,
      {
        headers: {
          Authorization: "Bearer " + accessToken
        }
      }
    );

    console.log("➡️ Respuesta activos HTTP:", res.status);

    // Si el token no es válido o no llegó, el backend responde 401
    if (res.status === 401) {
      const errData = await res.json().catch(() => ({}));
      console.warn("⚠️ No autorizado:", errData);
      hacerLogout("Tu sesión ha expirado o el token no es válido. Inicia sesión nuevamente.");
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg =
        errData.detail || errData.error || `Error ${res.status}: ${res.statusText}`;
      manualStatus.textContent = msg;
      manualStatus.classList.add("error");
      if (activoResumenSid) activoResumenSid.innerHTML = "";
      if (activoResumenOcs) activoResumenOcs.innerHTML = "";
      if (activoJson) activoJson.textContent = "Sin datos…";


      // Reset estado de activo
      activoCodigoActual = null;
      activoEstadoActual = null;
      if (btnEditarEstado) btnEditarEstado.classList.add("hidden");
      if (estadoEditor) estadoEditor.classList.add("hidden");
      if (estadoStatus) {
        estadoStatus.textContent = "";
        estadoStatus.className = "status";
      }

      return;
    }

    const data = await res.json();

    // ==============================
    // Guardar código y estado actual
    // ==============================
    activoCodigoActual = data.qr_valor || data.codigo || codigo;
    activoEstadoActual = data.estado || data.estado_actual || "inactivo";

    if (selectEstado) {
      const validos = ["activo", "inactivo", "en_mantencion", "de_baja"];
      selectEstado.value = validos.includes(activoEstadoActual)
        ? activoEstadoActual
        : "inactivo";
    }

    if (btnEditarEstado) {
      btnEditarEstado.classList.remove("hidden");
    }
    if (estadoEditor) {
      estadoEditor.classList.add("hidden"); // editor plegado por defecto
    }
    if (estadoStatus) {
      estadoStatus.textContent = "";
      estadoStatus.className = "status";
    }

    // --------- Resumen amigable (ficha limpia) ----------
    function addField(partes, label, value) {
      if (value === undefined || value === null || value === "") return;
      partes.push(
        `<div class="field-row">
          <span class="field-label">${label}</span>
          <span class="field-value">${value}</span>
        </div>`
      );
    }

    const ocs = data.ocs || {};

    const codigoActivo = data.qr_valor || data.codigo || codigo;
    const ubicacion = [data.edificio, data.area, data.departamento]
      .filter(Boolean)
      .join(" / ");

    const estadoRaw = activoEstadoActual;
    const estadoFormateado = estadoRaw
      ? estadoRaw.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())
      : null;

    const estadoPropiedad =
      typeof data.propio === "boolean"
        ? (data.propio ? "Propio" : "No propio")
        : null;

    // -------- SID --------
    const sidParts = [];
    addField(sidParts, "Código", codigoActivo);
    addField(sidParts, "Estado actual", estadoFormateado);
    addField(sidParts, "Ubicación", ubicacion);
    addField(sidParts, "Propiedad", estadoPropiedad);
    addField(sidParts, "Fecha instalación", data.fecha_instalacion);
    addField(sidParts, "Año adquisición", data.anio_adquisicion);
    addField(sidParts, "Instalado por", data.instalado_por);
    addField(sidParts, "Observaciones", data.observaciones);

    if (activoResumenSid) {
      activoResumenSid.innerHTML =
        sidParts.join("") || "<span class='muted'>Sin datos SID.</span>";
    }

    // -------- OCS --------
    const ocsParts = [];
    addField(ocsParts, "Nombre equipo", ocs.name);
    addField(ocsParts, "Sistema operativo", [ocs.osname, ocs.osversion].filter(Boolean).join(" "));
    addField(ocsParts, "Último inventario", ocs.lastdate);

    // si los agregas en Flask, aparecerán:
    addField(ocsParts, "IP", ocs.ipaddr);
    addField(ocsParts, "Fabricante", ocs.manufacturer);
    addField(ocsParts, "Modelo", ocs.model);
    addField(ocsParts, "Serial", ocs.serial);

    if (activoResumenOcs) {
      activoResumenOcs.innerHTML =
        ocsParts.join("") || "<span class='muted'>Sin datos OCS para este activo.</span>";
    }

    // JSON técnico (debug)
    if (activoJson) {
      activoJson.textContent = JSON.stringify(data, null, 2);
    }

    manualStatus.textContent = "Activo obtenido correctamente.";
    manualStatus.classList.add("success");
  } catch (err) {
    console.error("❌ Error al consultar activo:", err);
    manualStatus.textContent = "Error de red al consultar el activo.";
    manualStatus.classList.add("error");
  }
}


// ==========================
//  BÚSQUEDA MANUAL
// ==========================
btnBuscar.addEventListener("click", () => {
  const codigo = inputCodigoManual.value.trim();
  if (!codigo) {
    manualStatus.textContent = "Ingresa un código.";
    manualStatus.classList.add("error");
    return;
  }
  consultarActivo(codigo);
});


// ==========================
//  ESCÁNER QR
// ==========================
btnStartScan.addEventListener("click", async () => {
  scanStatus.textContent = "";
  scanStatus.className = "status";

  if (!accessToken) {
    scanStatus.textContent = "Debes iniciar sesión primero.";
    scanStatus.classList.add("error");
    return;
  }

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  try {
    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      scanStatus.textContent =
        "No se encontró ninguna cámara disponible.";
      scanStatus.classList.add("error");
      return;
    }

    currentCameraId = cameras[0].id;

    await html5QrCode.start(
      currentCameraId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async (decodedText) => {
        // Evitar procesar múltiples veces el mismo QR
        if (isScanBusy) return;
        if (decodedText === lastDecodedText) return;

        isScanBusy = true;
        lastDecodedText = decodedText;

        console.log("📷 QR leído:", decodedText);

        scanStatus.textContent = `QR leído: ${decodedText}`;
        scanStatus.classList.add("success");

        try {
          await consultarActivo(decodedText);
        } finally {
          // Cooldown para permitir otra lectura
          setTimeout(() => {
            isScanBusy = false;
          }, 1500);
        }
      },
      (err) => {
        // Errores de escaneo constantes (ruido), no pasa nada
      }
    );

    scanStatus.textContent = "Cámara iniciada. Apunta al QR.";
  } catch (err) {
    console.error("❌ Error al iniciar cámara:", err);

    const msg = String(err);
    if (msg.includes("only supported in secure context")) {
      scanStatus.textContent =
        "La cámara solo se puede usar si la página está en HTTPS o en localhost.";
    } else {
      scanStatus.textContent = "Error al iniciar la cámara: " + err;
    }
    scanStatus.classList.add("error");
  }
});


// ==========================
//  DETENER ESCÁNER
// ==========================
btnStopScan.addEventListener("click", async () => {
  if (!html5QrCode) {
    scanStatus.textContent = "La cámara no está inicializada.";
    scanStatus.classList.add("error");
    return;
  }

  const scanning = html5QrCode.isScanning ?? html5QrCode._isScanning;

  if (!scanning) {
    scanStatus.textContent = "La cámara no está activa.";
    scanStatus.classList.add("error");
    return;
  }

  try {
    await html5QrCode.stop();
    await html5QrCode.clear();
    scanStatus.textContent = "Cámara detenida.";
    scanStatus.classList.add("success");
  } catch (err) {
    console.error("❌ Error al detener cámara:", err);
    scanStatus.textContent = "Error al detener la cámara.";
    scanStatus.classList.add("error");
  }
});


// ==========================
//  GENERAR QR DE UN ACTIVO
// ==========================
btnGenerarQR.addEventListener("click", async () => {
  const codigo = inputCodigoQR.value.trim();

  qrStatus.textContent = "";
  qrStatus.className = "status";
  qrPreview.innerHTML = "";
  qrDownload.style.display = "none";

  if (!accessToken) {
    qrStatus.textContent = "Debes iniciar sesión primero.";
    qrStatus.classList.add("error");
    return;
  }

  if (!codigo) {
    qrStatus.textContent = "Ingresa un código válido.";
    qrStatus.classList.add("error");
    return;
  }

  qrStatus.textContent = "Generando QR…";

  try {
    const urlQR = `/api/activos/${codigo}/qr/`;

    const res = await fetch(urlQR, {
      headers: {
        Authorization: "Bearer " + accessToken
      }
    });

    if (res.status === 401) {
      hacerLogout("Tu sesión ha expirado o el token no es válido. Inicia sesión nuevamente.");
      return;
    }

    if (!res.ok) {
      qrStatus.textContent =
        "No se pudo generar el QR (activo no encontrado).";
      qrStatus.classList.add("error");
      return;
    }

    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);

    qrPreview.innerHTML = `
      <img src="${objectURL}" style="width:200px; border:1px solid #ccc; padding:10px;">
    `;

    qrDownload.href = objectURL;
    qrDownload.download = `qr_${codigo}.png`;
    qrDownload.style.display = "inline-block";

    qrStatus.textContent = "QR generado correctamente.";
    qrStatus.classList.add("success");
  } catch (err) {
    console.error("Error generando QR:", err);
    qrStatus.textContent = "Error al generar QR.";
    qrStatus.classList.add("error");
  }
});


// ==========================
//  UI CAMBIO DE ESTADO
// ==========================
if (btnEditarEstado) {
  btnEditarEstado.addEventListener("click", () => {
    if (!activoCodigoActual) return;
    if (estadoEditor) {
      estadoEditor.classList.toggle("hidden");
    }
    if (estadoStatus) {
      estadoStatus.textContent = "";
      estadoStatus.className = "status";
    }
  });
}

if (btnGuardarEstado) {
  btnGuardarEstado.addEventListener("click", async () => {
    if (!accessToken) {
      estadoStatus.textContent = "Debes iniciar sesión primero.";
      estadoStatus.className = "status error";
      return;
    }

    if (!activoCodigoActual) {
      estadoStatus.textContent = "No hay activo seleccionado.";
      estadoStatus.className = "status error";
      return;
    }

    const nuevoEstado = selectEstado.value;

    estadoStatus.textContent = "Actualizando estado...";
    estadoStatus.className = "status";

    try {
      const res = await fetch(
        API_BASE +
          `/api/activos/${encodeURIComponent(activoCodigoActual)}/estado/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({ estado: nuevoEstado }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        hacerLogout("Tu sesión ha expirado o el token no es válido. Inicia sesión nuevamente.");
        return;
      }

      if (!res.ok) {
        const msg = data.error || data.detail || `Error ${res.status}`;
        estadoStatus.textContent = msg;
        estadoStatus.className = "status error";
        return;
      }

      // OK -> actualizamos estado local y refrescamos la ficha
      activoEstadoActual = nuevoEstado;

      await consultarActivo(activoCodigoActual);

      estadoStatus.textContent = "Estado actualizado correctamente.";
      estadoStatus.className = "status success";
    } catch (err) {
      console.error("❌ Error al actualizar estado:", err);
      estadoStatus.textContent = "Error de red al actualizar el estado.";
      estadoStatus.className = "status error";
    }
  });
}


// ==========================
//  REPORTE DE ACTIVOS + CSV
// ==========================
if (btnReporte) {
  console.log("🧩 Handler de Reporte de Activos activado correctamente.");

  btnReporte.addEventListener("click", async () => {
    console.log("➡️ Click en Ver reporte");

    if (!accessToken) {
      reporteStatus.textContent = "Debes iniciar sesión primero.";
      reporteStatus.className = "status error";
      return;
    }

    // Reset estado
    reporteStatus.textContent = "Obteniendo reporte...";
    reporteStatus.className = "status";
    reporteJson.textContent = "Sin datos de reporte todavía…";
    if (btnDescargarCsv) btnDescargarCsv.classList.add("hidden");
    ultimoReporteActivos = null;

    // Filtros
    const params = new URLSearchParams();
    const edificio = filtroEdificio.value.trim();
    const area = filtroArea.value.trim();
    const departamento = filtroDepartamento.value.trim();

    if (edificio) params.append("edificio", edificio);
    if (area) params.append("area", area);
    if (departamento) params.append("departamento", departamento);

    const url =
      "/api/reportes/activos/" + (params.toString() ? "?" + params.toString() : "");

    console.log("📡 Llamando a:", url);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error("❌ Respuesta no es JSON válido:", e);
        reporteStatus.textContent = "La respuesta no es JSON válido";
        reporteStatus.className = "status error";
        return;
      }

      if (!res.ok) {
        const msg = data.error || data.detail || `Error ${res.status}`;
        console.warn("⚠️ Error desde backend:", msg);
        reporteStatus.textContent = msg;
        reporteStatus.className = "status error";
        reporteJson.textContent = "";
        return;
      }

      // Normalizamos: el backend podría enviar {activos:[...]} o un array directo
      let activos = [];
      if (Array.isArray(data)) {
        activos = data;
      } else if (Array.isArray(data.activos)) {
        activos = data.activos;
      } else if (Array.isArray(data.results)) {
        activos = data.results;
      }

      if (!activos.length) {
        reporteStatus.textContent = "No se encontraron activos para ese filtro.";
        reporteStatus.className = "status success";
        reporteJson.textContent = "Sin datos de reporte…";
        return;
      }

      // Guardamos el último reporte para el CSV
      ultimoReporteActivos = activos;

      // Mostramos el JSON técnico
      reporteJson.textContent = JSON.stringify(activos, null, 2);

      if (reporteResumen) {
        reporteResumen.textContent = `Mostrando ${activos.length} activos.`;
      }

      renderReporteTabla(activos);

      reporteStatus.textContent = `Reporte obtenido correctamente. Activos encontrados: ${activos.length}.`;
      reporteStatus.className = "status success";

      // Mostramos botón de descarga
      if (btnDescargarCsv) {
        btnDescargarCsv.classList.remove("hidden");
      }

      console.log("✅ Reporte recibido:", activos);
    } catch (err) {
      console.error("❌ Error al obtener reporte:", err);
      reporteStatus.textContent = "Error de red al obtener el reporte.";
      reporteStatus.className = "status error";
      reporteJson.textContent = "";
    }
  });

  // Click en "Descargar CSV"
  if (btnDescargarCsv) {
    btnDescargarCsv.addEventListener("click", () => {
      if (!ultimoReporteActivos || !ultimoReporteActivos.length) {
        alert("No hay datos de reporte para exportar.");
        return;
      }
      descargarCsvActivos(ultimoReporteActivos);
    });
  }
} else {
  console.warn("⚠️ btn-reporte no encontrado en el DOM");
}


/**
 * Genera y descarga un CSV con los activos del reporte.
 * Ajusta las columnas según lo que devuelva tu API Flask.
 */
function descargarCsvActivos(activos) {
  // Definimos columnas detalladas: campos de sidbd + datos de OCS
  const columnas = [
    { header: "codigo",            path: "codigo" },
    { header: "id_ocs_hardware",   path: "id_ocs_hardware" },

    { header: "edificio",          path: "edificio" },
    { header: "area",              path: "area" },
    { header: "departamento",      path: "departamento" },

    { header: "propio",            path: "propio" },
    { header: "estado",            path: "estado" },
    { header: "fecha_instalacion", path: "fecha_instalacion" },
    { header: "anio_adquisicion",  path: "anio_adquisicion" },
    { header: "instalado_por",     path: "instalado_por" },
    { header: "observaciones",     path: "observaciones" },

    { header: "fecha_creacion",    path: "fecha_creacion" },
    { header: "fecha_update",      path: "fecha_update" },

    // Campos planos que ya vienen desde tu JOIN en Flask:
    { header: "ocs_id",        path: "id_ocs_hardware" },
    { header: "ocs_name",      path: "nombre_equipo" },
    { header: "ocs_osname",    path: "so" },
    { header: "ocs_osversion", path: "so_version" },
    { header: "ocs_lastdate",  path: "ultimo_contacto" }
  ];


  // Helper para leer propiedades anidadas tipo "ocs.osname"
  function getByPath(obj, path) {
    return path.split(".").reduce((acc, key) => {
      if (acc && acc[key] !== undefined && acc[key] !== null) {
        return acc[key];
      }
      return null;
    }, obj);
  }

  const filas = [];

  // Primera fila: encabezados
  filas.push(columnas.map(c => c.header).join(";"));

  // Filas de datos
  for (const a of activos) {
    const fila = columnas.map((col) => {
      let v = getByPath(a, col.path);

      // Formateo amigable para "propio"
      if (col.path === "propio") {
        if (v === 1 || v === true) v = "Propio";
        else if (v === 0 || v === false) v = "No propio";
      }

      if (v === null || v === undefined) v = "";

      const s = String(v).replace(/"/g, '""'); // escapamos comillas
      return `"${s}"`;
    });

    filas.push(fila.join(";"));
  }

  const csv = filas.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "reporte_activos_detallado.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderReporteTabla(activos) {
  if (!reporteTabla) return;

  if (!activos || !activos.length) {
    reporteTabla.classList.add("hidden");
    return;
  }

  let html = `
    <table class="tabla">
      <thead>
        <tr>
          <th>Código</th>
          <th>Ubicación</th>
          <th>Estado</th>
          <th>Equipo</th>
          <th>SO</th>
          <th>Último inventario</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const a of activos) {
    const ubicacion = [a.edificio, a.area, a.departamento]
      .filter(Boolean)
      .join(" / ");

    const estado = a.estado
      ? a.estado.replace(/_/g, " ")
      : "";

    const so = [a.so, a.so_version].filter(Boolean).join(" ");

    html += `
      <tr>
        <td>
          <a href="#" class="link-activo" data-codigo="${a.codigo}">
            ${a.codigo}
          </a>
        </td>
        <td>${ubicacion}</td>
        <td>${estado}</td>
        <td>${a.nombre_equipo || "-"}</td>
        <td>${so || "-"}</td>
        <td>${a.ultimo_contacto || "-"}</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  reporteTabla.innerHTML = html;
  reporteTabla.classList.remove("hidden");

  // Click en código → abre ficha del activo
  reporteTabla.querySelectorAll(".link-activo").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      consultarActivo(link.dataset.codigo);
    });
  });
}


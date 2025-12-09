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

// ==========================
//  ELEMENTOS DEL DOM
// ==========================
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");

const loginStatus = document.getElementById("login-status");
const scanStatus = document.getElementById("scan-status");
const manualStatus = document.getElementById("manual-status");

const activoResumen = document.getElementById("activo-resumen");
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
const btnReporte = document.getElementById("btn-reporte");
const filtroEdificio = document.getElementById("filtro-edificio");
const filtroArea = document.getElementById("filtro-area");
const filtroDepartamento = document.getElementById("filtro-departamento");
const reporteStatus = document.getElementById("reporte-status");
const reporteJson = document.getElementById("reporte-json");

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

  // Limpiar estados
  scanStatus.textContent = "";
  manualStatus.textContent = "";
  qrStatus.textContent = "";
  activoResumen.textContent = "";
  activoJson.textContent = "Sin datos todavía…";

  // Ocultar botón logout
  btnLogout.classList.add("hidden");

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
    console.error("❌ Error al iniciar sesión:", err);
    loginStatus.textContent = "Error de red al intentar iniciar sesión.";
    loginStatus.classList.add("error");
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
      activoResumen.textContent = "";
      activoJson.textContent = "Sin datos…";
      return;
    }

    const data = await res.json();

    // --------- Resumen amigable ----------
    const partes = [];

    // Nombre
    const nombre = data.nombre || data.title;
    if (nombre) partes.push(`<strong>Nombre:</strong> ${nombre}`);

    // Número de serie
    if (data.numero_serie || data.serial) {
      partes.push(
        `<strong>Número de serie:</strong> ${data.numero_serie || data.serial}`
      );
    }

    // Sistema operativo
    if (data.so) {
      partes.push(`<strong>Sistema operativo:</strong> ${data.so}`);
    }

    // Instalador / responsable
    if (data.instalador) {
      partes.push(`<strong>Instalado por:</strong> ${data.instalador}`);
    }

    // Ubicación física
    if (data.ubicacion) {
      partes.push(`<strong>Ubicación:</strong> ${data.ubicacion}`);
    }

    // Campos originales de FakeStore (por si quieres mostrarlos)
    const descripcion = data.descripcion || data.description;
    if (descripcion) {
      partes.push(`<strong>Descripción:</strong> ${descripcion}`);
    }

    const precio = data.precio !== undefined ? data.precio : data.price;
    if (precio !== undefined) {
      partes.push(`<strong>Precio (referencial):</strong> $${precio}`);
    }

    const categoria = data.categoria || data.category;
    if (categoria) {
      partes.push(`<strong>Categoría:</strong> ${categoria}`);
    }

    activoResumen.innerHTML = partes.join("<br>") || "Sin resumen legible.";
    activoJson.textContent = JSON.stringify(data, null, 2);

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
//  REPORTE DE ACTIVOS
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

    reporteStatus.textContent = "Obteniendo reporte...";
    reporteStatus.className = "status";
    reporteJson.textContent = "";

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

      // OK
      reporteStatus.textContent = "Reporte obtenido correctamente.";
      reporteStatus.className = "status success";
      reporteJson.textContent = JSON.stringify(data, null, 2);

      console.log("✅ Reporte recibido:", data);
    } catch (err) {
      console.error("❌ Error al obtener reporte:", err);
      reporteStatus.textContent = "Error de red al obtener el reporte.";
      reporteStatus.className = "status error";
      reporteJson.textContent = "";
    }
  });
} else {
  console.warn("⚠️ btn-reporte no encontrado en el DOM");
}

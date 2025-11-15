// ==========================
//  CONFIG
// ==========================
const API_BASE = "";  // mismo origen donde se sirve Django

let accessToken = null;
let html5QrCode = null;
let currentCameraId = null;

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

const inputUser = document.getElementById("username");
const inputPass = document.getElementById("password");
const inputCodigoManual = document.getElementById("codigo-manual");

console.log("main.js cargado correctamente ✅");


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

    console.log("🔑 Token recibido:", accessToken);

    loginStatus.textContent = "Sesión iniciada correctamente.";
    loginStatus.classList.add("success");

    // Mostrar app y ocultar login
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Error al iniciar sesión:", err);
    loginStatus.textContent = "Error de red al intentar iniciar sesión.";
    loginStatus.classList.add("error");
  } finally {
    btnLogin.disabled = false;
  }
});


// ==========================
//  CONSULTA DE ACTIVO
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
    const res = await fetch(
      API_BASE + `/api/activos/${encodeURIComponent(codigo)}/`,
      {
        headers: {
          Authorization: "Bearer " + accessToken
        }
      }
    );

    console.log("➡️ Respuesta activos HTTP:", res.status);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.detail || `Error ${res.status}: ${res.statusText}`;
      manualStatus.textContent = msg;
      manualStatus.classList.add("error");
      activoResumen.textContent = "";
      activoJson.textContent = "Sin datos…";
      return;
    }

    const data = await res.json();

    // Resumen amigable
    const partes = [];
    if (data.title) partes.push(`<strong>Nombre:</strong> ${data.title}`);
    if (data.description)
      partes.push(`<strong>Descripción:</strong> ${data.description}`);
    if (data.price !== undefined)
      partes.push(`<strong>Precio:</strong> ${data.price}`);
    if (data.category)
      partes.push(`<strong>Categoría:</strong> ${data.category}`);

    activoResumen.innerHTML =
      partes.join("<br>") || "Sin resumen legible.";
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
//  QR SCANNER
// ==========================
btnStartScan.addEventListener("click", async () => {
  scanStatus.textContent = "";
  scanStatus.className = "status";

  if (!accessToken) {
    scanStatus.textContent = "Debes iniciar sesión primero.";
    scanStatus.classList.add("error");
    return;
  }

  // Crear instancia del scanner si no existe
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");   // ⭐ CORRECTO
  }

  try {
    const cameras = await Html5Qrcode.getCameras();  // ⭐ CORRECTO

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
      (decodedText) => {
        console.log("📷 QR leído:", decodedText);

        scanStatus.textContent = `QR leído: ${decodedText}`;
        scanStatus.classList.add("success");

        consultarActivo(decodedText);
      },
      (err) => {
        // Errores de escaneo constantes (ruido), no pasa nada
      }
    );

    scanStatus.textContent = "Cámara iniciada. Apunta al QR.";
  } catch (err) {
    console.error("❌ Error al iniciar cámara:", err);
    scanStatus.textContent = "Error al iniciar la cámara: " + err;
    scanStatus.classList.add("error");
  }
});


// ==========================
//  DETENER CÁMARA
// ==========================
btnStopScan.addEventListener("click", async () => {
  if (html5QrCode && html5QrCode._isScanning) {
    try {
      await html5QrCode.stop();
      scanStatus.textContent = "Cámara detenida.";
      scanStatus.classList.add("success");
    } catch (err) {
      console.error("❌ Error al detener cámara:", err);
      scanStatus.textContent = "Error al detener la cámara.";
      scanStatus.classList.add("error");
    }
  } else {
    scanStatus.textContent = "La cámara no está activa.";
  }
});

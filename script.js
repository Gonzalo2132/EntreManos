(() => {
  // Mantengo estas variables dentro de una función para no mezclarlas con otros scripts.
  "use strict";

  // Acá indico a qué archivo PHP le pido las tareas de cuenta y sesión.
  const AUTH_ENDPOINT = "api/auth.php";
  // Uso estas claves para encontrar los datos guardados en el navegador.
  const KEYS = {
    tools: "entremanos-tools",
    saved: "entremanos-saved"
  };

  // Muestro estas herramientas de ejemplo cuando todavía no hay publicaciones guardadas.
  const starterTools = [
    { id: "starter-1", name: "Taladro percutor", category: "Herramientas", emoji: "🔧", owner: "Lucía M.", location: "A 2 cuadras · Villa del Parque", description: "Con mechas para madera y pared. ¡Funciona perfecto!" },
    { id: "starter-2", name: "Escalera extensible", category: "Hogar", emoji: "🪜", owner: "Julián C.", location: "A 4 cuadras · Villa del Parque", description: "De aluminio, llega hasta 3 metros. Fácil de transportar." },
    { id: "starter-3", name: "Cortadora de césped", category: "Jardín", emoji: "🌿", owner: "Ana F.", location: "A 3 cuadras · Villa del Parque", description: "Eléctrica, ideal para jardines chicos y medianos." },
    { id: "starter-4", name: "Hidrolavadora", category: "Hogar", emoji: "💦", owner: "Marcos R.", location: "A 5 cuadras · Villa del Parque", description: "Para limpiar el patio, el auto o la vereda." },
    { id: "starter-5", name: "Carpa para 4", category: "Aventura", emoji: "⛺", owner: "Sofi G.", location: "A 2 cuadras · Villa del Parque", description: "La usamos el último verano. Está impecable y limpia." },
    { id: "starter-6", name: "Caja de herramientas", category: "Herramientas", emoji: "🧰", owner: "Diego P.", location: "A 1 cuadra · Villa del Parque", description: "Llaves, pinzas, destornilladores y lo básico para arreglos." }
  ];

  // Guardo referencias a los elementos de la página para poder actualizarlos después.
  const loginScreen = document.querySelector("#login-screen");
  const appScreen = document.querySelector("#app-screen");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const neighborhoodSelect = document.querySelector("#neighborhood-select");
  const toolGrid = document.querySelector("#tool-grid");
  const searchInput = document.querySelector("#search-input");
  const emptyState = document.querySelector("#empty-state");
  const dialog = document.querySelector("#publish-dialog");
  const toast = document.querySelector("#toast");
  // Estos valores recuerdan el filtro elegido y el estado de la cuenta actual.
  let activeCategory = "Todas";
  let toastTimer;
  let currentSession = null;
  let authMode = "login";

  // Leo una lista del almacenamiento local; si no existe o está dañada, uso el valor inicial.
  function leerLista(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch (error) {
      console.error(`No se pudo leer ${key} del almacenamiento local.`, error);
      return fallback;
    }
  }

  function obtenerHerramientas() {
    // Si todavía no publiqué herramientas, devuelvo las que vienen de ejemplo.
    return leerLista(KEYS.tools, starterTools);
  }

  function obtenerSesion() {
    // La sesión actual se obtiene del servidor y se guarda mientras la página está abierta.
    return currentSession;
  }

  // Envío al servidor la acción solicitada y devuelvo su respuesta.
  async function enviarSolicitudDeAutenticacion(action, data = {}) {
    const response = await fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, ...data })
    });
    const result = await response.json();
    // Si el servidor responde con error, lo muestro al formulario que hizo la solicitud.
    if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
    return result;
  }

  function guardarLista(key, value) {
    try {
      // Convierto la lista a texto para poder guardarla en el navegador.
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`No se pudo guardar ${key} en el almacenamiento local.`, error);
      mostrarAviso("No pudimos guardar los cambios. Revisá el almacenamiento del navegador.");
      return false;
    }
  }

  function ingresarALaAplicacion(session) {
    // Al entrar, oculto el formulario y actualizo el perfil con los datos de la cuenta.
    currentSession = session;
    loginScreen.hidden = true;
    appScreen.hidden = false;
    document.querySelector("#profile-name").textContent = session.name;
    document.querySelector("#profile-avatar").textContent = session.name.trim().charAt(0).toUpperCase();
    document.querySelector("#welcome-name").textContent = session.name.split(/\s+/)[0];
    document.querySelector("#community-name").textContent = session.neighborhood_name;
    document.querySelector("#topbar-community-name").textContent = session.neighborhood_name;
    mostrarHerramientas();
  }

  function crearTarjetaDeHerramienta(tool, saved) {
    // Armo cada tarjeta con elementos HTML para mostrar una herramienta y sus acciones.
    const card = document.createElement("article");
    card.className = "tool-card";
    const session = obtenerSesion();
    // Desactivo el pedido de préstamo si la herramienta la publiqué yo.
    const isOwnTool = Boolean(session && tool.ownerId === session.id);
    const art = document.createElement("div");
    art.className = "tool-art";
    const category = document.createElement("span");
    category.className = "tool-category-label";
    // Muestro los datos de la publicación como texto para que el navegador no los interprete como HTML.
    category.textContent = tool.category;
    const emoji = document.createElement("span");
    emoji.className = "tool-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = tool.emoji;
    const saveButton = document.createElement("button");
    saveButton.className = `save-button${saved.includes(tool.id) ? " saved" : ""}`;
    saveButton.type = "button";
    saveButton.setAttribute("aria-label", saved.includes(tool.id) ? "Quitar de guardados" : "Guardar herramienta");
    saveButton.setAttribute("aria-pressed", String(saved.includes(tool.id)));
    saveButton.textContent = saved.includes(tool.id) ? "♥" : "♡";
    // Guardo o quito esta herramienta cuando se presiona el corazón.
    saveButton.addEventListener("click", () => alternarGuardado(tool.id));
    art.append(category, emoji, saveButton);

    const body = document.createElement("div");
    body.className = "tool-body";
    const titleRow = document.createElement("div");
    titleRow.className = "tool-title-row";
    const title = document.createElement("h3");
    title.className = "tool-title";
    title.textContent = tool.name;
    const owner = document.createElement("span");
    owner.className = "tool-owner";
    owner.textContent = `por ${tool.owner}`;
    titleRow.append(title, owner);
    const meta = document.createElement("div");
    meta.className = "tool-meta";
    const location = document.createElement("span");
    location.className = "tool-location";
    location.textContent = `⌖ ${tool.location}`;
    const availability = document.createElement("span");
    availability.className = "availability";
    availability.textContent = "Disponible";
    meta.append(location, availability);
    const description = document.createElement("p");
    description.className = "tool-description";
    description.textContent = tool.description || "Coordiná el préstamo directamente con tu vecino.";
    // Abro WhatsApp con un mensaje listo; no marco la publicación como solicitud enviada.
    const contacto = document.createElement(tool.whatsappPhone && !isOwnTool ? "a" : "span");
    contacto.className = `contact-button${tool.whatsappPhone && !isOwnTool ? "" : " unavailable"}`;
    if (tool.whatsappPhone && !isOwnTool) {
      const mensaje = `Hola ${tool.owner}, me interesa pedir prestado ${tool.name}. ¿Sigue disponible?`;
      contacto.href = `https://wa.me/${tool.whatsappPhone}?text=${encodeURIComponent(mensaje)}`;
      contacto.target = "_blank";
      contacto.rel = "noopener noreferrer";
      contacto.textContent = "Consultar por WhatsApp ↗";
      contacto.setAttribute("aria-label", `Consultar por WhatsApp a ${tool.owner}`);
    } else {
      contacto.textContent = isOwnTool ? "Tu publicación" : "WhatsApp no disponible";
    }
    body.append(titleRow, meta, description, contacto);
    card.append(art, body);
    return card;
  }

  function mostrarHerramientas() {
    // Primero muestro solo las herramientas del vecindario de la persona que inició sesión.
    const session = obtenerSesion();
    const tools = obtenerHerramientas().filter((tool) =>
      tool.communityId === session.neighborhood_id ||
      (!tool.communityId && session.neighborhood_name === "Villa del Parque")
    );
    // Después aplico la búsqueda y los filtros que eligió la persona.
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const saved = leerLista(KEYS.saved, []);
    const filtered = tools.filter((tool) => {
      const matchesCategory = activeCategory === "Todas" || tool.category === activeCategory;
      const searchable = `${tool.name} ${tool.category} ${tool.owner} ${tool.description || ""}`.toLocaleLowerCase("es");
      return matchesCategory && searchable.includes(query);
    });

    // Reemplazo las tarjetas anteriores por las que coinciden con la búsqueda y el filtro.
    toolGrid.replaceChildren(...filtered.map((tool) => crearTarjetaDeHerramienta(tool, saved)));
    emptyState.hidden = filtered.length !== 0;
    document.querySelector("#results-label").textContent = `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`;
    // Actualizo los contadores con los datos del vecindario que estoy viendo.
    document.querySelector("#count-all").textContent = tools.length;
    document.querySelector("#tools-count").textContent = tools.length;
    const neighbors = new Set(tools.map((tool) => tool.owner)).size;
    document.querySelector("#neighbors-count").textContent = neighbors;
  }

  function mostrarAviso(message) {
    // Muestro un aviso temporal y reinicio su reloj si ya había otro visible.
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function alternarGuardado(id) {
    // Si ya estaba guardada la quito; si no, la agrego a la lista.
    const saved = leerLista(KEYS.saved, []);
    const index = saved.indexOf(id);
    if (index >= 0) saved.splice(index, 1);
    else saved.push(id);
    if (!guardarLista(KEYS.saved, saved)) return;
    mostrarHerramientas();
    mostrarAviso(index >= 0 ? "Quitaste la herramienta de tus guardados." : "Guardaste esta herramienta para después.");
  }

  function establecerModoDeAutenticacion(mode) {
    // Uso el mismo formulario para registrarse o iniciar sesión, mostrando los campos necesarios.
    authMode = mode;
    const registering = mode === "register";
    document.querySelector("#name-field").hidden = !registering;
    document.querySelector("#login-name").required = registering;
    document.querySelector("#neighborhood-field").hidden = !registering;
    neighborhoodSelect.required = registering;
    actualizarCampoDeNuevoVecindario();
    document.querySelector("#login-password").autocomplete = registering ? "new-password" : "current-password";
    document.querySelector("#auth-title").textContent = registering ? "Creá tu cuenta" : "Entrá a tu barrio";
    document.querySelector("#auth-intro").textContent = registering
      ? "Registrate para sumarte a la comunidad y compartir con tus vecinos."
      : "Iniciá sesión para ver qué hay cerca.";
    document.querySelector("#auth-submit").innerHTML = registering
      ? "Crear cuenta <span aria-hidden=\"true\">→</span>"
      : "Iniciar sesión <span aria-hidden=\"true\">→</span>";
    document.querySelector("#auth-switch-prompt").textContent = registering ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?";
    document.querySelector("#auth-mode-toggle").textContent = registering ? "Iniciá sesión" : "Registrate";
    document.querySelector("#login-error").textContent = "";
    document.querySelector("#auth-message").hidden = true;
  }

  function actualizarCampoDeNuevoVecindario() {
    // Pido el nombre del vecindario solo cuando se eligió crear uno nuevo.
    const creating = neighborhoodSelect.value === "create";
    document.querySelector("#new-neighborhood-field").hidden = !creating;
    document.querySelector("#neighborhood-name").required = creating && authMode === "register";
  }

  function agregarOpcionDeVecindario(neighborhood) {
    // No repito un vecindario si ya está en la lista desplegable.
    if ([...neighborhoodSelect.options].some((option) => option.value === String(neighborhood.id))) return;
    const option = new Option(neighborhood.name, neighborhood.id);
    const createOption = neighborhoodSelect.querySelector('option[value="create"]');
    neighborhoodSelect.add(option, createOption);
  }

  async function cargarVecindarios() {
    // Cargo desde el servidor los vecindarios disponibles para registrarse.
    const result = await enviarSolicitudDeAutenticacion("neighborhoods");
    neighborhoodSelect.replaceChildren(new Option("Elegí un vecindario", ""));
    result.neighborhoods.forEach(agregarOpcionDeVecindario);
    neighborhoodSelect.add(new Option("＋ Crear un vecindario nuevo", "create"));
  }

  // Actualizo el formulario cuando cambia el vecindario elegido.
  neighborhoodSelect.addEventListener("change", actualizarCampoDeNuevoVecindario);

  // Acá proceso el registro y el inicio de sesión desde el mismo formulario.
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#login-name").value.trim();
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;
    const authMessage = document.querySelector("#auth-message");
    loginError.textContent = "";
    authMessage.hidden = true;
    try {
      if (authMode === "register") {
        // Para el registro envío los datos de la cuenta y el vecindario elegido o creado.
        const neighborhoodId = neighborhoodSelect.value;
        const result = await enviarSolicitudDeAutenticacion("register", {
          name,
          email,
          password,
          neighborhood_id: neighborhoodId,
          neighborhood_name: neighborhoodId === "create"
            ? document.querySelector("#neighborhood-name").value.trim()
            : ""
        });
        agregarOpcionDeVecindario(result.neighborhood);
        establecerModoDeAutenticacion("login");
        loginForm.reset();
        authMessage.textContent = "Cuenta creada. Ahora iniciá sesión con tu correo y contraseña.";
        authMessage.hidden = false;
        return;
      }
      // Para iniciar sesión, el servidor comprueba el correo y la contraseña.
      const result = await enviarSolicitudDeAutenticacion("login", { email, password });
      ingresarALaAplicacion(result.user);
    } catch (error) {
      loginError.textContent = error.message || "No se pudo conectar con el servidor. Intentá nuevamente.";
    }
  });

  // Cambio entre el formulario para entrar y el formulario para crear una cuenta.
  document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
    establecerModoDeAutenticacion(authMode === "login" ? "register" : "login");
  });

  // Uso un solo evento para detectar cuál filtro de categoría se presionó.
  document.querySelector("#filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === button));
    mostrarHerramientas();
  });

  // Actualizo los resultados al escribir o al pedir que se limpien los filtros.
  searchInput.addEventListener("input", mostrarHerramientas);
  // Restablezco la búsqueda y dejo seleccionada la categoría "Todas".
  document.querySelector("#clear-filters").addEventListener("click", () => {
    activeCategory = "Todas";
    searchInput.value = "";
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.category === "Todas"));
    mostrarHerramientas();
  });

  function abrirDialogoDePublicacion() {
    // Abro la ventana donde se completa la nueva publicación.
    dialog.showModal();
  }
  document.querySelector("#open-publish").addEventListener("click", abrirDialogoDePublicacion);
  // El enlace del menú abre el mismo formulario de publicación que el botón principal.
  document.querySelector("#nav-publish").addEventListener("click", (event) => {
    event.preventDefault();
    abrirDialogoDePublicacion();
  });
  // Cierro la ventana desde sus botones o cuando se hace clic en el fondo.
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Al publicar, agrego la herramienta al vecindario de la persona y la guardo en el navegador.
  document.querySelector("#publish-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const session = obtenerSesion();
    if (!session) return;
    // Quito espacios y signos para que WhatsApp reciba solo el número internacional.
    const whatsappPhone = String(formData.get("whatsapp")).replace(/\D/g, "");
    if (whatsappPhone.length < 8 || whatsappPhone.length > 15) {
      document.querySelector("#tool-whatsapp").setCustomValidity("Ingresá el número con código de país, entre 8 y 15 dígitos.");
      document.querySelector("#tool-whatsapp").reportValidity();
      document.querySelector("#tool-whatsapp").setCustomValidity("");
      return;
    }
    const tools = obtenerHerramientas();
    tools.unshift({
      id: `tool-${Date.now()}`,
      name: String(formData.get("name")).trim(),
      category: String(formData.get("category")),
      emoji: String(formData.get("emoji")),
      owner: `${session.name.split(/\s+/)[0]} (vos)`,
      ownerId: session.id,
      communityId: session.neighborhood_id,
      whatsappPhone,
      location: `En tu barrio · ${session.neighborhood_name}`,
      description: String(formData.get("description")).trim()
    });
    if (!guardarLista(KEYS.tools, tools)) return;
    event.currentTarget.reset();
    dialog.close();
    activeCategory = "Todas";
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.category === "Todas"));
    searchInput.value = "";
    mostrarHerramientas();
    mostrarAviso("¡Listo! Tu herramienta ya está en la comunidad.");
  });

  // Cierro la sesión en el servidor antes de volver a mostrar el formulario de acceso.
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await enviarSolicitudDeAutenticacion("logout");
    } catch (error) {
      console.error("No se pudo cerrar la sesión del servidor.", error);
      mostrarAviso("No se pudo cerrar la sesión. Intentá nuevamente.");
      return;
    }
    currentSession = null;
    appScreen.hidden = true;
    loginScreen.hidden = false;
    loginForm.reset();
    loginError.textContent = "";
    establecerModoDeAutenticacion("login");
  });

  // Al abrir la página, cargo vecindarios y reviso si ya había una sesión iniciada.
  cargarVecindarios().catch((error) => {
    console.error("No se pudieron cargar los vecindarios.", error);
    loginError.textContent = "No se pudieron cargar los vecindarios. Revisá que Apache y MySQL estén activos.";
  });

  // Consulto al servidor para recuperar la cuenta si la persona ya había iniciado sesión.
  enviarSolicitudDeAutenticacion("me").then((result) => {
    if (result.user) ingresarALaAplicacion(result.user);
  }).catch((error) => {
    console.error("No se pudo verificar la sesión.", error);
    loginError.textContent = "No se pudo conectar con el servidor. Revisá que Apache y MySQL estén activos.";
  });
})();

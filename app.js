(() => {
  "use strict";

  const AUTH_ENDPOINT = "api/auth.php";
  const KEYS = {
    tools: "entremanos-tools",
    requests: "entremanos-requests",
    saved: "entremanos-saved"
  };

  const starterTools = [
    { id: "starter-1", name: "Taladro percutor", category: "Herramientas", emoji: "🔧", owner: "Lucía M.", location: "A 2 cuadras · Villa del Parque", description: "Con mechas para madera y pared. ¡Funciona perfecto!" },
    { id: "starter-2", name: "Escalera extensible", category: "Hogar", emoji: "🪜", owner: "Julián C.", location: "A 4 cuadras · Villa del Parque", description: "De aluminio, llega hasta 3 metros. Fácil de transportar." },
    { id: "starter-3", name: "Cortadora de césped", category: "Jardín", emoji: "🌿", owner: "Ana F.", location: "A 3 cuadras · Villa del Parque", description: "Eléctrica, ideal para jardines chicos y medianos." },
    { id: "starter-4", name: "Hidrolavadora", category: "Hogar", emoji: "💦", owner: "Marcos R.", location: "A 5 cuadras · Villa del Parque", description: "Para limpiar el patio, el auto o la vereda." },
    { id: "starter-5", name: "Carpa para 4", category: "Aventura", emoji: "⛺", owner: "Sofi G.", location: "A 2 cuadras · Villa del Parque", description: "La usamos el último verano. Está impecable y limpia." },
    { id: "starter-6", name: "Caja de herramientas", category: "Herramientas", emoji: "🧰", owner: "Diego P.", location: "A 1 cuadra · Villa del Parque", description: "Llaves, pinzas, destornilladores y lo básico para arreglos." }
  ];

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
  let activeCategory = "Todas";
  let toastTimer;
  let currentSession = null;
  let authMode = "login";

  function readList(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch (error) {
      console.error(`No se pudo leer ${key} del almacenamiento local.`, error);
      return fallback;
    }
  }

  function getTools() {
    return readList(KEYS.tools, starterTools);
  }

  function getSession() {
    return currentSession;
  }

  async function authRequest(action, data = {}) {
    const response = await fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, ...data })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
    return result;
  }

  function saveList(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`No se pudo guardar ${key} en el almacenamiento local.`, error);
      showToast("No pudimos guardar los cambios. Revisá el almacenamiento del navegador.");
      return false;
    }
  }

  function enterApp(session) {
    currentSession = session;
    loginScreen.hidden = true;
    appScreen.hidden = false;
    document.querySelector("#profile-name").textContent = session.name;
    document.querySelector("#profile-avatar").textContent = session.name.trim().charAt(0).toUpperCase();
    document.querySelector("#welcome-name").textContent = session.name.split(/\s+/)[0];
    document.querySelector("#community-name").textContent = session.neighborhood_name;
    document.querySelector("#topbar-community-name").textContent = session.neighborhood_name;
    renderTools();
  }

  function makeCard(tool, requests, saved) {
    const card = document.createElement("article");
    card.className = "tool-card";
    const session = getSession();
    const isOwnTool = Boolean(session && tool.ownerId === session.id);
    const art = document.createElement("div");
    art.className = "tool-art";
    const category = document.createElement("span");
    category.className = "tool-category-label";
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
    saveButton.addEventListener("click", () => toggleSaved(tool.id));
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
    const requestButton = document.createElement("button");
    requestButton.className = `request-button${requests.includes(tool.id) || isOwnTool ? " requested" : ""}`;
    requestButton.type = "button";
    requestButton.disabled = requests.includes(tool.id) || isOwnTool;
    requestButton.textContent = isOwnTool ? "Tu publicación" : requests.includes(tool.id) ? "✓  Solicitud enviada" : "Pedir prestado  →";
    if (!requests.includes(tool.id) && !isOwnTool) requestButton.addEventListener("click", () => requestTool(tool));
    body.append(titleRow, meta, description, requestButton);
    card.append(art, body);
    return card;
  }

  function renderTools() {
    const session = getSession();
    const tools = getTools().filter((tool) =>
      tool.communityId === session.neighborhood_id ||
      (!tool.communityId && session.neighborhood_name === "Villa del Parque")
    );
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const requests = readList(KEYS.requests, []);
    const saved = readList(KEYS.saved, []);
    const filtered = tools.filter((tool) => {
      const matchesCategory = activeCategory === "Todas" || tool.category === activeCategory;
      const searchable = `${tool.name} ${tool.category} ${tool.owner} ${tool.description || ""}`.toLocaleLowerCase("es");
      return matchesCategory && searchable.includes(query);
    });

    toolGrid.replaceChildren(...filtered.map((tool) => makeCard(tool, requests, saved)));
    emptyState.hidden = filtered.length !== 0;
    document.querySelector("#results-label").textContent = `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`;
    document.querySelector("#count-all").textContent = tools.length;
    document.querySelector("#tools-count").textContent = tools.length;
    const neighbors = new Set(tools.map((tool) => tool.owner)).size;
    document.querySelector("#neighbors-count").textContent = neighbors;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function requestTool(tool) {
    const requests = readList(KEYS.requests, []);
    if (requests.includes(tool.id)) return;
    requests.push(tool.id);
    if (!saveList(KEYS.requests, requests)) return;
    renderTools();
    showToast(`¡Solicitud enviada! Coordiná el préstamo con ${tool.owner}.`);
  }

  function toggleSaved(id) {
    const saved = readList(KEYS.saved, []);
    const index = saved.indexOf(id);
    if (index >= 0) saved.splice(index, 1);
    else saved.push(id);
    if (!saveList(KEYS.saved, saved)) return;
    renderTools();
    showToast(index >= 0 ? "Quitaste la herramienta de tus guardados." : "Guardaste esta herramienta para después.");
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === "register";
    document.querySelector("#name-field").hidden = !registering;
    document.querySelector("#login-name").required = registering;
    document.querySelector("#neighborhood-field").hidden = !registering;
    neighborhoodSelect.required = registering;
    updateNewNeighborhoodField();
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

  function updateNewNeighborhoodField() {
    const creating = neighborhoodSelect.value === "create";
    document.querySelector("#new-neighborhood-field").hidden = !creating;
    document.querySelector("#neighborhood-name").required = creating && authMode === "register";
  }

  function addNeighborhoodOption(neighborhood) {
    if ([...neighborhoodSelect.options].some((option) => option.value === String(neighborhood.id))) return;
    const option = new Option(neighborhood.name, neighborhood.id);
    const createOption = neighborhoodSelect.querySelector('option[value="create"]');
    neighborhoodSelect.add(option, createOption);
  }

  async function loadNeighborhoods() {
    const result = await authRequest("neighborhoods");
    neighborhoodSelect.replaceChildren(new Option("Elegí un vecindario", ""));
    result.neighborhoods.forEach(addNeighborhoodOption);
    neighborhoodSelect.add(new Option("＋ Crear un vecindario nuevo", "create"));
  }

  neighborhoodSelect.addEventListener("change", updateNewNeighborhoodField);

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
        const neighborhoodId = neighborhoodSelect.value;
        const result = await authRequest("register", {
          name,
          email,
          password,
          neighborhood_id: neighborhoodId,
          neighborhood_name: neighborhoodId === "create"
            ? document.querySelector("#neighborhood-name").value.trim()
            : ""
        });
        addNeighborhoodOption(result.neighborhood);
        setAuthMode("login");
        loginForm.reset();
        authMessage.textContent = "Cuenta creada. Ahora iniciá sesión con tu correo y contraseña.";
        authMessage.hidden = false;
        return;
      }
      const result = await authRequest("login", { email, password });
      enterApp(result.user);
    } catch (error) {
      loginError.textContent = error.message || "No se pudo conectar con el servidor. Intentá nuevamente.";
    }
  });

  document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  });

  document.querySelector("#filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === button));
    renderTools();
  });

  searchInput.addEventListener("input", renderTools);
  document.querySelector("#clear-filters").addEventListener("click", () => {
    activeCategory = "Todas";
    searchInput.value = "";
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.category === "Todas"));
    renderTools();
  });

  function openPublishDialog() {
    dialog.showModal();
  }
  document.querySelector("#open-publish").addEventListener("click", openPublishDialog);
  document.querySelector("#nav-publish").addEventListener("click", (event) => {
    event.preventDefault();
    openPublishDialog();
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelector("#publish-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const session = getSession();
    if (!session) return;
    const tools = getTools();
    tools.unshift({
      id: `tool-${Date.now()}`,
      name: String(formData.get("name")).trim(),
      category: String(formData.get("category")),
      emoji: String(formData.get("emoji")),
      owner: `${session.name.split(/\s+/)[0]} (vos)`,
      ownerId: session.id,
      communityId: session.neighborhood_id,
      location: `En tu barrio · ${session.neighborhood_name}`,
      description: String(formData.get("description")).trim()
    });
    if (!saveList(KEYS.tools, tools)) return;
    event.currentTarget.reset();
    dialog.close();
    activeCategory = "Todas";
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip.dataset.category === "Todas"));
    searchInput.value = "";
    renderTools();
    showToast("¡Listo! Tu herramienta ya está en la comunidad.");
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await authRequest("logout");
    } catch (error) {
      console.error("No se pudo cerrar la sesión del servidor.", error);
      showToast("No se pudo cerrar la sesión. Intentá nuevamente.");
      return;
    }
    currentSession = null;
    appScreen.hidden = true;
    loginScreen.hidden = false;
    loginForm.reset();
    loginError.textContent = "";
    setAuthMode("login");
  });

  loadNeighborhoods().catch((error) => {
    console.error("No se pudieron cargar los vecindarios.", error);
    loginError.textContent = "No se pudieron cargar los vecindarios. Revisá que Apache y MySQL estén activos.";
  });

  authRequest("me").then((result) => {
    if (result.user) enterApp(result.user);
  }).catch((error) => {
    console.error("No se pudo verificar la sesión.", error);
    loginError.textContent = "No se pudo conectar con el servidor. Revisá que Apache y MySQL estén activos.";
  });
})();

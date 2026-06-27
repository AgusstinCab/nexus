import {
  obtenerArchivoAPOD,
  formatearFecha,
  clasificarObjeto,
  obtenerDiametroPromedio,
} from "./api.js";

// REFERENCIAS AL DOM

const overlayDeCarga = document.getElementById("loading-overlay");
const textoEstadoCarga = document.getElementById("loading-status-text");
const barraDeCarga = document.getElementById("loading-progress");
const inputBusqueda = document.getElementById("search-input");
const selectorOrden = document.getElementById("sort-select");
const filtroTipo = document.getElementById("filter-media");
const contadorResultados = document.getElementById("results-count");
const botonRecargar = document.getElementById("btn-reload-gallery");
const grillaPrincipal = document.getElementById("gallery-grid");
const grillaFavoritos = document.getElementById("favorites-grid");
const seccionFavoritos = document.getElementById("favorites-section");
const contadorFavoritos = document.getElementById("fav-count");
const botonBorrarFavoritos = document.getElementById("btn-clear-favorites");
const contenedorVerMas = document.getElementById("load-more-container");
const botonVerMas = document.getElementById("btn-load-more");
const tituloSeccion = document.getElementById("gallery-section-title");
const subtituloSeccion = document.getElementById("gallery-section-subtitle");
const ultimaActualizacion = document.getElementById("last-updated");
const dialogo = document.getElementById("apod-dialog");
const tituloDialogo = document.getElementById("dialog-title");
const cuerpoDialogo = document.getElementById("dialog-body");
const botonFavDialogo = document.getElementById("dialog-btn-favorite");
const etiquetaCategoriaDialogo = document.getElementById(
  "dialog-category-label",
);
const pestañasCategorias = document.querySelectorAll(".cat-tab");

// ESTADO

const CLAVE_FAVORITOS = "nexus_favoritos";

let todosLosItems = []; // Items cargados actualmente
let categoriaActual = "apod"; // Categoría seleccionada
let itemActual = null; // Item abierto en el modal
let paginaActual = 0; // Para "Ver más"

// INICIO

async function iniciar() {
  actualizarCarga("Cargando archivo astronómico...", 40);
  mostrarFavoritos();
  await cargarCategoria("apod");

  const ahora = new Date();
  ultimaActualizacion.textContent = `Última actualización: ${ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;

  setTimeout(() => {
    overlayDeCarga.classList.add("hidden");
  }, 300);
}

function actualizarCarga(texto, valor) {
  textoEstadoCarga.textContent = texto;
  barraDeCarga.value = valor;
}

// CARGAR CATEGORÍA

async function cargarCategoria(categoria) {
  categoriaActual = categoria;
  paginaActual = 0;
  todosLosItems = [];

  grillaPrincipal.innerHTML = "";
  contenedorVerMas.style.display = "none";

  // Actualizar pestañas activas
  pestañasCategorias.forEach((pestaña) => {
    pestaña.classList.toggle("active", pestaña.dataset.cat === categoria);
  });

  // Títulos según categoría
  const titulos = {
    apod: {
      titulo: "Imagen Astronómica del Día",
      subtitulo: "Selección aleatoria del archivo histórico de NASA APOD",
    },
    favs: {
      titulo: "Mis Descubrimientos",
      subtitulo: "Tu colección personal de objetos guardados",
    },
  };

  tituloSeccion.textContent = titulos[categoria]?.titulo || "Galería";
  subtituloSeccion.textContent = titulos[categoria]?.subtitulo || "";

  // Si se selecciona "favoritos", mostramos solo esos
  if (categoria === "favs") {
    const favoritos = obtenerFavoritos();
    if (favoritos.length === 0) {
      grillaPrincipal.innerHTML = `
        <div class="favorites-empty" style="grid-column: 1 / -1;">
          <span class="favorites-empty-icon">☆</span>
          <p class="favorites-empty-title">Sin descubrimientos guardados</p>
          <p class="favorites-empty-hint">Hacé clic en la estrella de cualquier imagen para guardarla acá</p>
        </div>`;
    } else {
      todosLosItems = favoritos;
      mostrarGaleria(todosLosItems);
    }
    contadorResultados.textContent = String(favoritos.length);
    return;
  }

  mostrarSkeletons(grillaPrincipal, 12);

  try {
    let items = [];
    const datos = await obtenerArchivoAPOD(12);
    items = datos.map(normalizarAPOD);
    contenedorVerMas.style.display = "flex";

    todosLosItems = items;
    mostrarGaleria(todosLosItems);
  } catch (error) {
    console.error("Error al cargar categoría:", error.message);
    mostrarError(grillaPrincipal);
  }
}

// NORMALIZAR DATOS de cada API al mismo formato

function normalizarAPOD(item) {
  return {
    ...item,
    categoria: "APOD",
    imageUrl: item.media_type === "image" ? item.url : null,
    descripcion: item.explanation ? item.explanation.slice(0, 120) + "..." : "",
  };
}

// MOSTRAR GALERÍA (aplica filtros, búsqueda y orden)

function mostrarGaleria(items) {
  grillaPrincipal.innerHTML = "";

  // 1. Filtrar por tipo de media
  let filtrados = items;
  if (filtroTipo.value !== "all") {
    filtrados = items.filter((item) => item.media_type === filtroTipo.value);
  }

  // 2. Filtrar por búsqueda
  const consulta = inputBusqueda.value.trim().toLowerCase();
  if (consulta) {
    filtrados = filtrados.filter((item) =>
      item.title?.toLowerCase().includes(consulta),
    );
  }

  // 3. Ordenar
  filtrados = ordenarItems(filtrados, selectorOrden.value);
  contadorResultados.textContent = `${filtrados.length} / ${items.length}`;

  if (filtrados.length === 0) {
    grillaPrincipal.innerHTML = `
      <div class="search-empty">
        <p>Sin resultados</p>
        <p style="margin-top: 4px; font-size: .65rem;">Probá con otro término o filtro</p>
      </div>`;
    return;
  }

  filtrados.forEach((item, indice) => {
    const tarjeta = crearTarjeta(item, indice);
    grillaPrincipal.appendChild(tarjeta);
  });
}

// CREAR TARJETA

function crearTarjeta(item, indice) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "archive-card";
  tarjeta.style.animationDelay = `${indice * 0.04}s`;

  const estaGuardado = esFavorito(item.date || item.id);
  const fechaLabel = item.date ? formatearFecha(item.date) : "—";
  const tieneImagen =
    item.imageUrl || (item.media_type === "image" && item.url);
  const srcImagen = item.imageUrl || item.url || "";
  const etiqueta = item.categoria || "APOD";
  const descripcion =
    item.descripcion ||
    (item.explanation ? item.explanation.slice(0, 100) + "..." : "");

  tarjeta.innerHTML = `
    <div class="card-thumb">
      ${
        tieneImagen
          ? `<img src="${srcImagen}" alt="${item.title}" onerror="this.parentElement.innerHTML='<div class=\\'card-thumb-video\\'>🌌</div>'">`
          : `<div class="card-thumb-video">▶</div>`
      }
      <span class="card-media-badge">${etiqueta}</span>
    </div>
    <div class="card-body">
      <time class="card-date">${fechaLabel}</time>
      <h3 class="card-title">${item.title || "—"}</h3>
      ${descripcion ? `<p class="card-desc">${descripcion}</p>` : ""}
    </div>
    <div class="card-footer">
      <span class="card-source">${item.copyright ? `© ${item.copyright.trim()}` : etiqueta}</span>
      <button class="card-btn-fav ${estaGuardado ? "saved" : ""}"
        title="${estaGuardado ? "Quitar de favoritos" : "Guardar en favoritos"}">
        ${estaGuardado ? "★" : "☆"}
      </button>
    </div>`;

  // Click en la tarjeta → abre modal
  tarjeta.addEventListener("click", (evento) => {
    if (evento.target.classList.contains("card-btn-fav")) return;
    abrirModal(item);
  });

  // Click en el botón de favorito
  const botonFav = tarjeta.querySelector(".card-btn-fav");
  botonFav.addEventListener("click", (evento) => {
    evento.stopPropagation();
    alternarFavorito(item);
    mostrarGaleria(todosLosItems);
    mostrarFavoritos();
    if (
      itemActual &&
      (itemActual.date || itemActual.id) === (item.date || item.id)
    ) {
      actualizarBotonFavDialogo(item.date || item.id);
    }
  });

  return tarjeta;
}

// ORDENAR ITEMS

function ordenarItems(items, criterio) {
  const copia = [...items];
  if (criterio === "date-desc")
    return copia.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (criterio === "date-asc")
    return copia.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  if (criterio === "title-asc")
    return copia.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  if (criterio === "title-desc")
    return copia.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
  return copia;
}

// MODAL — Estilo Wikipedia

function abrirModal(item) {
  itemActual = item;

  const tieneImg = item.imageUrl || (item.media_type === "image" && item.url);
  const srcImg = item.imageUrl || item.url || "";
  const id = item.date || item.id;

  tituloDialogo.textContent = item.title || "—";
  etiquetaCategoriaDialogo.textContent = item.categoria || "Archivo";

  cuerpoDialogo.innerHTML = `
    <div class="wiki-body wiki-clearfix">
      ${
        tieneImg
          ? `
        <div class="wiki-infobox">
          <div class="wiki-infobox-title">Ficha del Objeto</div>
          <img src="${srcImg}" alt="${item.title}" onerror="this.style.display='none'"/>
          <table>
            ${item.date ? `<tr><td>Fecha</td><td>${formatearFecha(item.date)}</td></tr>` : ""}
            <tr><td>Fuente</td><td>${item.copyright ? `© ${item.copyright.trim()}` : "NASA"}</td></tr>
            <tr><td>Clasificación</td><td>${clasificarObjeto(item.title)}</td></tr>
          </table>
        </div>`
          : ""
      }

      <h2 class="wiki-title">${item.title || "—"}</h2>
      <p class="wiki-text">${item.explanation || "Sin descripción disponible."}</p>

        <h3 class="wiki-section-title">Sobre esta imagen</h3>
        <p class="wiki-text">
          Esta fotografía fue seleccionada por la NASA como
          <strong>Imagen Astronómica del Día (APOD)</strong> del ${formatearFecha(item.date)}.
          ${
            item.copyright
              ? `Crédito: <strong>${item.copyright.trim()}</strong>.`
              : "Imagen de dominio público producida por NASA."
          }
        </p>
    </div>`;

  // Solo mostramos el botón de favorito si el item tiene fecha (APOD la tienen)
  const puedeGuardarse = !!item.date;
  botonFavDialogo.style.display = puedeGuardarse ? "" : "none";

  if (puedeGuardarse) {
    actualizarBotonFavDialogo(item.date);
    botonFavDialogo.onclick = () => {
      alternarFavorito(item);
      actualizarBotonFavDialogo(item.date);
      mostrarGaleria(todosLosItems);
      mostrarFavoritos();
    };
  }

  dialogo.showModal();
}

function actualizarBotonFavDialogo(id) {
  if (esFavorito(id)) {
    botonFavDialogo.textContent = "★ Guardado";
    botonFavDialogo.classList.add("saved");
  } else {
    botonFavDialogo.textContent = "☆ Guardar en Favoritos";
    botonFavDialogo.classList.remove("saved");
  }
}

dialogo.addEventListener("close", () => {
  itemActual = null;
});

// FAVORITOS

function obtenerFavoritos() {
  const guardados = localStorage.getItem(CLAVE_FAVORITOS);
  if (!guardados) return [];
  return JSON.parse(guardados);
}

function esFavorito(id) {
  return obtenerFavoritos().some((f) => f.id === String(id));
}

function alternarFavorito(item) {
  const lista = obtenerFavoritos();
  const id = String(item.date || item.id);
  const indice = lista.findIndex((f) => f.id === id);

  if (indice >= 0) {
    lista.splice(indice, 1);
  } else {
    lista.push({
      id,
      title: item.title,
      url: item.imageUrl || item.url || null,
      explanation: item.explanation,
      date: item.date || null,
      copyright: item.copyright || null,
      media_type: item.media_type,
      categoria: item.categoria,
    });
  }

  localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(lista));
}

function mostrarFavoritos() {
  const lista = obtenerFavoritos();
  contadorFavoritos.textContent = lista.length;
  seccionFavoritos.style.display = lista.length > 0 ? "block" : "none";
  if (lista.length === 0) return;

  grillaFavoritos.innerHTML = "";
  lista
    .slice()
    .reverse()
    .forEach((favorito, indice) => {
      const tarjeta = crearTarjeta(
        { ...favorito, imageUrl: favorito.url },
        indice,
      );
      grillaFavoritos.appendChild(tarjeta);
    });
}

// SKELETONS (mientras carga)

function mostrarSkeletons(contenedor, cantidad) {
  contenedor.innerHTML = "";
  for (let i = 0; i < cantidad; i++) {
    contenedor.innerHTML += `
      <div class="card-skeleton">
        <div class="card-skeleton-thumb"></div>
        <div class="card-skeleton-line" style="width: 40%; margin-top: 4px;"></div>
        <div class="card-skeleton-line"></div>
        <div class="card-skeleton-line short"></div>
      </div>`;
  }
}

// VER MÁS

botonVerMas.addEventListener("click", async () => {
  botonVerMas.disabled = true;
  botonVerMas.textContent = "Cargando...";
  paginaActual++;

  try {
    let nuevosItems = [];

    const datos = await obtenerArchivoAPOD(12);
    nuevosItems = datos.map(normalizarAPOD);

    todosLosItems = [...todosLosItems, ...nuevosItems];
    mostrarGaleria(todosLosItems);
  } catch (error) {
    console.error("Error al cargar más:", error.message);
  } finally {
    botonVerMas.disabled = false;
    botonVerMas.textContent = "Cargar más →";
  }
});

// EVENTOS DE CONTROLES

inputBusqueda.addEventListener("input", () => mostrarGaleria(todosLosItems));
selectorOrden.addEventListener("change", () => mostrarGaleria(todosLosItems));
filtroTipo.addEventListener("change", () => mostrarGaleria(todosLosItems));

botonRecargar.addEventListener("click", () => cargarCategoria(categoriaActual));

pestañasCategorias.forEach((pestaña) => {
  pestaña.addEventListener("click", () => {
    inputBusqueda.value = "";
    selectorOrden.value = "date-desc";
    filtroTipo.value = "all";
    cargarCategoria(pestaña.dataset.cat);
  });
});

botonBorrarFavoritos.addEventListener("click", () => {
  if (botonBorrarFavoritos.textContent === "¿Confirmar?") {
    localStorage.removeItem(CLAVE_FAVORITOS);
    mostrarFavoritos();
    if (categoriaActual === "favs") cargarCategoria("favs");
    else mostrarGaleria(todosLosItems);
    botonBorrarFavoritos.textContent = "Borrar todo";
    botonBorrarFavoritos.style.color = "";
  } else {
    botonBorrarFavoritos.textContent = "¿Confirmar?";
    botonBorrarFavoritos.style.color = "var(--color-hazard)";
    setTimeout(() => {
      botonBorrarFavoritos.textContent = "Borrar todo";
      botonBorrarFavoritos.style.color = "";
    }, 3000);
  }
});

// ERROR

function mostrarError(contenedor) {
  contenedor.innerHTML = `
    <div class="search-empty" style="grid-column: 1 / -1; padding: 48px 0;">
      <p style="color: var(--color-hazard);">Archivo NASA No Disponible</p>
      <p style="margin-top: 8px; font-size: .65rem;">Verificá tu conexión e intentá de nuevo</p>
      <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">
        Reintentar
      </button>
    </div>`;
}

iniciar();

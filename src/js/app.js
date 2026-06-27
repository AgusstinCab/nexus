import {
  obtenerAPOD,
  obtenerNEO,
  obtenerArchivoAPOD,
  formatearDistancia,
  obtenerDiametroPromedio,
  formatearFecha,
  clasificarObjeto,
} from "./api.js";

// REFERENCIAS AL DOM

const overlayDeCarga = document.getElementById("loading-overlay");
const textoEstadoCarga = document.getElementById("loading-status-text");
const barraDeCarga = document.getElementById("loading-progress");
const fechaEnHeader = document.getElementById("header-date");
const ultimaActualizacion = document.getElementById("last-updated");

// Panel Cosmos Archive
const contenedorMedia = document.getElementById("archive-media-container");
const tituloAPOD = document.getElementById("apod-title");
const fechaBadgeAPOD = document.getElementById("apod-date-badge");
const clasificacionAPOD = document.getElementById("apod-classification");
const fuenteAPOD = document.getElementById("apod-source");
const botonVerDetalle = document.getElementById("btn-apod-detail");
const botonGuardarAPOD = document.getElementById("btn-apod-favorite");

// Panel Discovery
const fondoDiscovery = document.getElementById("discovery-bg");
const tituloDiscovery = document.getElementById("discovery-title");
const extractoDiscovery = document.getElementById("discovery-excerpt");
const fechaDiscovery = document.getElementById("discovery-date");
const botonLeerMas = document.getElementById("btn-discovery-more");

// Panel Threat Monitor
const listaAmenazas = document.getElementById("threat-list");
const contadorNEO = document.getElementById("neo-count");

// Modal
const dialogo = document.getElementById("apod-dialog");
const tituloDialogo = document.getElementById("dialog-title");
const cuerpoDialogo = document.getElementById("dialog-body");
const botonFavDialogo = document.getElementById("dialog-btn-favorite");

// Buscador en el header
const inputBusqueda = document.getElementById("header-search-input");
const dropdownBusqueda = document.getElementById("search-results-dropdown");

// Favoritos en el header
const botonFavs = document.getElementById("btn-favs-toggle");
const dropdownFavs = document.getElementById("favs-dropdown");
const listaDropdownFavs = document.getElementById("favs-dropdown-list");
const contadorFavsBadge = document.getElementById("favs-count-badge");
const botonBorrarFavs = document.getElementById("btn-clear-all-favs");

// ESTADO

const CLAVE_FAVORITOS = "nexus_favoritos";
let apodActual = null;
let archivoBuscador = [];

// INICIO

async function iniciar() {
  mostrarFechaHeader();

  try {
    actualizarCarga("Conectando con NASA APOD...", 30);

    // Primero cargamos el APOD para mostrar contenido rápido
    const apod = await obtenerAPOD();
    actualizarCarga("Procesando imagen del día...", 60);

    apodActual = apod;
    mostrarArchivocosmos(apod);
    mostrarDiscovery(apod);

    actualizarCarga("Cargando asteroides...", 75);

    // Después cargamos los asteroides
    const asteroides = await obtenerNEO();
    mostrarMonitorAmenazas(asteroides);

    actualizarCarga("Listo.", 100);

    const ahora = new Date();
    ultimaActualizacion.textContent = `Última actualización: ${ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;

    setTimeout(() => {
      overlayDeCarga.classList.add("hidden");
    }, 350);

    // Cargamos el archivo para el buscador en segundo plano
    cargarArchivoBuscador();
  } catch (error) {
    console.error("Error al cargar datos de NASA:", error.message);
    actualizarCarga("Datos no disponibles", 100);
    const mensaje =
      error.message.includes("503") || error.message.includes("502")
        ? "Servicio NASA temporalmente no disponible. Recargá en unos segundos."
        : "No se pudo conectar con NASA. Verificá tu conexión.";
    setTimeout(() => {
      overlayDeCarga.classList.add("hidden");
      mostrarErrorGeneral(mensaje);
    }, 600);
  }
}

function actualizarCarga(texto, valor) {
  textoEstadoCarga.textContent = texto;
  barraDeCarga.value = valor;
}

// FECHA EN HEADER

function mostrarFechaHeader() {
  const ahora = new Date();
  fechaEnHeader.textContent = ahora
    .toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

// PANEL: COSMOS ARCHIVE

function mostrarArchivocosmos(apod) {
  fechaBadgeAPOD.textContent = formatearFecha(apod.date);
  tituloAPOD.textContent = apod.title;
  clasificacionAPOD.textContent = clasificarObjeto(apod.title);
  fuenteAPOD.textContent = apod.copyright
    ? `© ${apod.copyright.trim()}`
    : "NASA / Dominio Público";

  contenedorMedia.innerHTML = "";

  if (apod.media_type === "image") {
    const imagen = document.createElement("img");
    imagen.src = apod.url;
    imagen.alt = apod.title;
    imagen.classList.add("fade-in");
    imagen.onerror = () => {
      contenedorMedia.innerHTML =
        '<div class="video-placeholder"><span>🌌</span><p>Imagen no disponible</p></div>';
    };
    contenedorMedia.appendChild(imagen);
  } else {
    contenedorMedia.innerHTML = `
      <div class="video-placeholder fade-in">
        <span>▶</span>
        <p>Contenido de Video</p>
      </div>`;
  }

  actualizarBotonFavorito(botonGuardarAPOD, apod.date);

  botonVerDetalle.onclick = () => abrirModal(apod);
  botonGuardarAPOD.onclick = () => {
    alternarFavorito(apod);
    actualizarBotonFavorito(botonGuardarAPOD, apod.date);
    actualizarBotonFavorito(botonFavDialogo, apod.date);
    mostrarDropdownFavoritos();
  };
}

// PANEL: DISCOVERY OF THE DAY

function mostrarDiscovery(apod) {
  if (apod.media_type === "image") {
    fondoDiscovery.style.backgroundImage = `url('${apod.hdurl || apod.url}')`;
  }

  tituloDiscovery.textContent = apod.title;
  tituloDiscovery.classList.add("fade-in");

  // Mostramos solo las primeras 35 palabras de la explicación
  const palabras = apod.explanation.split(" ");
  const extracto =
    palabras.slice(0, 35).join(" ") + (palabras.length > 35 ? "..." : "");
  extractoDiscovery.textContent = extracto;

  fechaDiscovery.textContent = formatearFecha(apod.date);
  botonLeerMas.onclick = () => abrirModal(apod);
}

// PANEL: THREAT MONITOR

function mostrarMonitorAmenazas(asteroides) {
  listaAmenazas.innerHTML = "";

  if (!asteroides || asteroides.length === 0) {
    listaAmenazas.innerHTML = `
      <li class="state-empty">
        <span class="state-icon">◎</span>
        <p>Sin datos NEO para hoy</p>
      </li>`;
    contadorNEO.textContent = "0";
    return;
  }

  contadorNEO.textContent = asteroides.length;

  // Mostramos los 4 más cercanos
  const masEcercanos = asteroides.slice(0, 4);

  masEcercanos.forEach((asteroide, indice) => {
    const acercamiento = asteroide.close_approach_data[0];
    const distancia = formatearDistancia(
      acercamiento?.miss_distance.kilometers || 0,
    );
    const tamanio = obtenerDiametroPromedio(asteroide) + " km";
    const esPeligroso = asteroide.is_potentially_hazardous_asteroid;

    const elemento = document.createElement("li");
    elemento.className = `threat-item fade-in-delay-${indice + 1}`;
    elemento.style.animationFillMode = "backwards";

    elemento.innerHTML = `
      <div class="threat-item-header">
        <span class="threat-name" title="${asteroide.name}">${asteroide.name}</span>
        <span class="badge ${esPeligroso ? "badge-hazard" : "badge-safe"}">
          ${esPeligroso ? "⚠ Peligroso" : "Paso Seguro"}
        </span>
      </div>
      <div class="threat-data-grid">
        <div class="threat-data-item">
          <span class="text-label">Distancia</span>
          <span class="threat-value">${distancia}</span>
        </div>
        <div class="threat-data-item">
          <span class="text-label">Tamaño</span>
          <span class="threat-value">${tamanio}</span>
        </div>
      </div>`;

    elemento.onclick = () => abrirModalAsteroide(asteroide);
    listaAmenazas.appendChild(elemento);
  });
}

// MODAL — Estilo Wikipedia

function abrirModal(apod) {
  apodActual = apod;

  const autor = apod.copyright
    ? `© ${apod.copyright.trim()}`
    : "NASA / Dominio Público";
  const esImagen = apod.media_type === "image";

  tituloDialogo.textContent = apod.title;

  cuerpoDialogo.innerHTML = `
    <div class="wiki-body wiki-clearfix">
      ${
        esImagen
          ? `
        <div class="wiki-infobox">
          <div class="wiki-infobox-title">Ficha del Objeto</div>
          <img src="${apod.url}" alt="${apod.title}" onerror="this.style.display='none'"/>
          <table>
            <tr><td>Fecha</td><td>${formatearFecha(apod.date)}</td></tr>
            <tr><td>Tipo</td><td>Imagen</td></tr>
            <tr><td>Fuente</td><td>${autor}</td></tr>
            <tr><td>Clasificación</td><td>${clasificarObjeto(apod.title)}</td></tr>
          </table>
        </div>`
          : ""
      }
      <h2 class="wiki-title">${apod.title}</h2>
      <p class="wiki-text">${apod.explanation}</p>
      <h3 class="wiki-section-title">Sobre esta imagen</h3>
      <p class="wiki-text">
        Esta fotografía fue seleccionada por astrónomos de la NASA como la
        <strong>Imagen Astronómica del Día (APOD)</strong> del ${formatearFecha(apod.date)}.
        ${
          apod.copyright
            ? `El crédito de esta imagen pertenece a <strong>${apod.copyright.trim()}</strong>.`
            : "Esta imagen es de dominio público, producida por la NASA."
        }
      </p>
    </div>`;

  botonFavDialogo.style.display = "";
  actualizarBotonFavorito(botonFavDialogo, apod.date);

  botonFavDialogo.onclick = () => {
    alternarFavorito(apod);
    actualizarBotonFavorito(botonFavDialogo, apod.date);
    actualizarBotonFavorito(botonGuardarAPOD, apod.date);
    mostrarDropdownFavoritos();
  };

  dialogo.showModal();
}

function abrirModalAsteroide(asteroide) {
  const acercamiento = asteroide.close_approach_data[0];
  const esPeligroso = asteroide.is_potentially_hazardous_asteroid;
  const distancia = formatearDistancia(
    acercamiento?.miss_distance.kilometers || 0,
  );
  const velocidad = acercamiento?.relative_velocity.kilometers_per_hour
    ? parseFloat(
        acercamiento.relative_velocity.kilometers_per_hour,
      ).toLocaleString("es-AR", { maximumFractionDigits: 0 }) + " km/h"
    : "—";
  const tamanio = obtenerDiametroPromedio(asteroide) + " km";
  const fechaAcercamiento = formatearFecha(
    acercamiento?.close_approach_date || "",
  );

  tituloDialogo.textContent = asteroide.name;

  cuerpoDialogo.innerHTML = `
    <div class="wiki-body wiki-clearfix">
      <div class="wiki-infobox">
        <div class="wiki-infobox-title">Ficha del Asteroide</div>
        <table>
          <tr><td>Distancia</td><td>${distancia}</td></tr>
          <tr><td>Velocidad</td><td>${velocidad}</td></tr>
          <tr><td>Tamaño est.</td><td>${tamanio}</td></tr>
          <tr><td>Magnitud</td><td>${asteroide.absolute_magnitude_h} H</td></tr>
          <tr><td>Estado</td>
            <td style="color:${esPeligroso ? "var(--color-hazard)" : "var(--color-safe)"}">
              ${esPeligroso ? "⚠ Peligroso" : "✓ Seguro"}
            </td>
          </tr>
          <tr><td>Acercamiento</td><td>${fechaAcercamiento}</td></tr>
        </table>
      </div>
      <h2 class="wiki-title">${asteroide.name}</h2>
      <p class="wiki-text">
        ${asteroide.name} es un objeto cercano a la Tierra rastreado por NASA.
        ${
          esPeligroso
            ? "Este asteroide está clasificado como <strong>potencialmente peligroso</strong>."
            : "Este asteroide no representa una amenaza en su órbita actual."
        }
      </p>
      <h3 class="wiki-section-title">Datos Orbitales</h3>
      <p class="wiki-text">
        Diámetro estimado: <strong>${tamanio}</strong>.
        Distancia mínima de paso: <strong>${distancia}</strong>.
        Velocidad relativa: <strong>${velocidad}</strong>.
      </p>
    </div>`;

  // No mostramos botón de favorito para asteroides
  botonFavDialogo.style.display = "none";
  dialogo.showModal();
}

// Cuando se cierra el modal, restauramos el botón de favorito
dialogo.addEventListener("close", () => {
  botonFavDialogo.style.display = "";
  if (apodActual) actualizarBotonFavorito(botonFavDialogo, apodActual.date);
});

// FAVORITOS

function obtenerFavoritos() {
  const guardados = localStorage.getItem(CLAVE_FAVORITOS);
  if (!guardados) return [];
  return JSON.parse(guardados);
}

function esFavorito(id) {
  const lista = obtenerFavoritos();
  return lista.some((favorito) => favorito.id === id);
}

function alternarFavorito(apod) {
  const lista = obtenerFavoritos();
  const indice = lista.findIndex((favorito) => favorito.id === apod.date);

  if (indice >= 0) {
    // Ya existe → lo eliminamos
    lista.splice(indice, 1);
  } else {
    // No existe → lo agregamos
    lista.push({
      id: apod.date,
      title: apod.title,
      url: apod.url || null,
      explanation: apod.explanation,
      date: apod.date,
      copyright: apod.copyright || null,
      media_type: apod.media_type,
    });
  }

  localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(lista));
}

function actualizarBotonFavorito(boton, id) {
  if (!boton) return;
  boton.style.display = "";
  if (esFavorito(id)) {
    boton.textContent = "★ Guardado";
    boton.classList.add("saved");
  } else {
    boton.textContent = "☆ Guardar";
    boton.classList.remove("saved");
  }
}

// DROPDOWN DE FAVORITOS EN HEADER

function mostrarDropdownFavoritos() {
  const lista = obtenerFavoritos();
  contadorFavsBadge.textContent = lista.length;

  if (lista.length === 0) {
    listaDropdownFavs.innerHTML =
      '<div class="favs-empty-msg">Ningún descubrimiento guardado aún</div>';
    return;
  }

  // Mostramos los favoritos del más nuevo al más viejo
  const listaInvertida = lista.slice().reverse();

  listaDropdownFavs.innerHTML = listaInvertida
    .map(
      (favorito) => `
    <div class="fav-item" data-id="${favorito.id}">
      ${
        favorito.url && favorito.media_type === "image"
          ? `<img src="${favorito.url}" alt="${favorito.title}" onerror="this.style.display='none'">`
          : `<div class="fav-item-thumb-placeholder">🌌</div>`
      }
      <div class="fav-item-info">
        <div class="fav-item-title">${favorito.title}</div>
        <div class="fav-item-date">${formatearFecha(favorito.date)}</div>
      </div>
      <button class="fav-item-remove" data-id="${favorito.id}" title="Eliminar">✕</button>
    </div>
  `,
    )
    .join("");

  // Click en un favorito → abre el modal
  listaDropdownFavs.querySelectorAll(".fav-item").forEach((elemento) => {
    elemento.addEventListener("click", (evento) => {
      if (evento.target.classList.contains("fav-item-remove")) return;
      const favorito = lista.find((f) => f.id === elemento.dataset.id);
      if (favorito) {
        abrirModal(favorito);
        dropdownFavs.classList.remove("open");
      }
    });
  });

  // Botón de eliminar individual
  listaDropdownFavs.querySelectorAll(".fav-item-remove").forEach((boton) => {
    boton.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const listaActualizada = obtenerFavoritos().filter(
        (f) => f.id !== boton.dataset.id,
      );
      localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(listaActualizada));
      mostrarDropdownFavoritos();
      if (apodActual)
        actualizarBotonFavorito(botonGuardarAPOD, apodActual.date);
    });
  });
}

// Toggle del dropdown de favoritos
botonFavs.addEventListener("click", () => {
  dropdownFavs.classList.toggle("open");
  if (dropdownFavs.classList.contains("open")) mostrarDropdownFavoritos();
});

// Borrar todos los favoritos
botonBorrarFavs.addEventListener("click", () => {
  localStorage.removeItem(CLAVE_FAVORITOS);
  mostrarDropdownFavoritos();
  if (apodActual) actualizarBotonFavorito(botonGuardarAPOD, apodActual.date);
});

// Cerrar dropdowns al hacer click fuera
document.addEventListener("click", (evento) => {
  if (
    !evento.target.closest("#btn-favs-toggle") &&
    !evento.target.closest("#favs-dropdown")
  ) {
    dropdownFavs.classList.remove("open");
  }
  if (!evento.target.closest(".header-search")) {
    dropdownBusqueda.classList.remove("open");
    dropdownBusqueda.innerHTML = "";
  }
});

// BUSCADOR EN HEADER

let temporizadorBusqueda = null;

inputBusqueda.addEventListener("input", () => {
  clearTimeout(temporizadorBusqueda);
  const consulta = inputBusqueda.value.trim().toLowerCase();

  if (!consulta) {
    dropdownBusqueda.classList.remove("open");
    dropdownBusqueda.innerHTML = "";
    return;
  }

  temporizadorBusqueda = setTimeout(() => buscarEnArchivo(consulta), 250);
});

function buscarEnArchivo(consulta) {
  const resultados = archivoBuscador
    .filter((item) => item.title.toLowerCase().includes(consulta))
    .slice(0, 6);

  if (resultados.length === 0) {
    dropdownBusqueda.innerHTML = `<div class="search-no-results">Sin resultados para "${consulta}"</div>`;
    dropdownBusqueda.classList.add("open");
    return;
  }

  dropdownBusqueda.innerHTML = resultados
    .map(
      (item) => `
    <div class="search-result-item" data-date="${item.date}">
      ${
        item.media_type === "image"
          ? `<img class="search-result-thumb" src="${item.url}" alt="${item.title}" onerror="this.style.display='none'">`
          : `<div class="search-result-thumb" style="background:var(--color-bg-card);display:flex;align-items:center;justify-content:center;">▶</div>`
      }
      <div class="search-result-info">
        <div class="search-result-title">${item.title}</div>
        <div class="search-result-meta">${formatearFecha(item.date)}</div>
      </div>
    </div>
  `,
    )
    .join("");

  dropdownBusqueda
    .querySelectorAll(".search-result-item")
    .forEach((elemento) => {
      elemento.addEventListener("click", () => {
        const encontrado = archivoBuscador.find(
          (i) => i.date === elemento.dataset.date,
        );
        if (encontrado) {
          abrirModal(encontrado);
          dropdownBusqueda.classList.remove("open");
          inputBusqueda.value = "";
        }
      });
    });

  dropdownBusqueda.classList.add("open");
}

// Carga silenciosa del archivo para el buscador
async function cargarArchivoBuscador() {
  await new Promise((resolver) => setTimeout(resolver, 2000));
  try {
    const datos = await obtenerArchivoAPOD(20);
    archivoBuscador = datos;
  } catch (error) {
    console.warn("Archivo del buscador no disponible:", error.message);
  }
}

// ERROR GENERAL

function mostrarErrorGeneral(mensaje) {
  const grilla = document.querySelector(".dashboard-grid");
  if (!grilla) return;
  grilla.innerHTML = `
    <div class="state-error" style="grid-column: 1 / -1;">
      <span class="state-icon">◌</span>
      <p>Datos NASA No Disponibles</p>
      <p style="margin-top: 8px; font-size: .65rem; color: var(--color-text-muted); max-width: 480px; text-align: center;">
        ${mensaje}
      </p>
      <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">
        Reintentar Conexión
      </button>
    </div>`;
}

// ARRANQUE

mostrarDropdownFavoritos();
iniciar();

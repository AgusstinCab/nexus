const NASA_API_KEY = import.meta.env.VITE_NASA_API_KEY;
const URL_BASE = "https://api.nasa.gov";

// APOD — Imagen astronómica del día
async function obtenerAPOD() {
  const respuesta = await fetch(
    `${URL_BASE}/planetary/apod?api_key=${NASA_API_KEY}`,
  );
  if (!respuesta.ok) throw new Error(`APOD ${respuesta.status}`);
  return respuesta.json();
}

// APOD Archivo — N imágenes aleatorias del archivo histórico
async function obtenerArchivoAPOD(cantidad = 12) {
  const respuesta = await fetch(
    `${URL_BASE}/planetary/apod?api_key=${NASA_API_KEY}&count=${cantidad}`,
  );
  if (!respuesta.ok) throw new Error(`Archivo APOD ${respuesta.status}`);
  return respuesta.json();
}

// NEO — Objetos cercanos a la Tierra (asteroides del día)
async function obtenerNEO(fecha) {
  const fechaHoy = fecha || obtenerFechaHoy();
  const respuesta = await fetch(
    `${URL_BASE}/neo/rest/v1/feed?start_date=${fechaHoy}&end_date=${fechaHoy}&api_key=${NASA_API_KEY}`,
  );
  if (!respuesta.ok) throw new Error(`NEO ${respuesta.status}`);

  const datos = await respuesta.json();

  // near_earth_objects es un objeto con fechas como claves
  // Lo convertimos a un array simple
  const listaAsteroides = [];
  const fechas = Object.keys(datos.near_earth_objects);
  for (const fecha of fechas) {
    const asteroidesDeFecha = datos.near_earth_objects[fecha];
    for (const asteroide of asteroidesDeFecha) {
      listaAsteroides.push(asteroide);
    }
  }

  // Ordenamos de más cercano a más lejano
  listaAsteroides.sort((a, b) => {
    const distanciaA = parseFloat(
      a.close_approach_data[0]?.miss_distance.kilometers || Infinity,
    );
    const distanciaB = parseFloat(
      b.close_approach_data[0]?.miss_distance.kilometers || Infinity,
    );
    return distanciaA - distanciaB;
  });

  return listaAsteroides;
}

// UTILIDADES
function obtenerFechaHoy() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${mes}-${dia}`;
}

function formatearDistancia(km) {
  return (
    parseFloat(km).toLocaleString("es-AR", { maximumFractionDigits: 0 }) + " km"
  );
}

function obtenerDiametroPromedio(asteroide) {
  const min =
    asteroide.estimated_diameter?.kilometers?.estimated_diameter_min || 0;
  const max =
    asteroide.estimated_diameter?.kilometers?.estimated_diameter_max || 0;
  return ((min + max) / 2).toFixed(3);
}

function formatearFecha(cadena) {
  if (!cadena) return "—";
  const date = new Date(cadena + "T00:00:00");
  return date
    .toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function clasificarObjeto(titulo) {
  const texto = titulo.toLowerCase();
  if (texto.includes("nebula") || texto.includes("nebulosa")) return "Nebulosa";
  if (texto.includes("galaxy") || texto.includes("galaxia")) return "Galaxia";
  if (texto.includes("supernova")) return "Supernova";
  if (texto.includes("black hole") || texto.includes("agujero"))
    return "Agujero Negro";
  if (texto.includes("comet") || texto.includes("cometa")) return "Cometa";
  if (texto.includes("asteroid") || texto.includes("asteroide"))
    return "Asteroide";
  if (texto.includes("aurora")) return "Aurora";
  if (texto.includes("eclipse")) return "Eclipse";
  if (texto.includes("sun") || texto.includes("solar")) return "Objeto Solar";
  if (texto.includes("moon") || texto.includes("luna"))
    return "Satélite Natural";
  if (texto.includes("mars") || texto.includes("marte")) return "Marte";
  if (texto.includes("jupiter")) return "Júpiter";
  if (texto.includes("saturn") || texto.includes("saturno")) return "Saturno";
  if (texto.includes("star") || texto.includes("estrella"))
    return "Objeto Estelar";
  if (texto.includes("cluster") || texto.includes("cúmulo"))
    return "Cúmulo Estelar";
  if (texto.includes("planet") || texto.includes("planeta"))
    return "Objeto Planetario";
  return "Objeto de Cielo Profundo";
}

export {
  obtenerAPOD,
  obtenerArchivoAPOD,
  obtenerNEO,
  obtenerFechaHoy,
  formatearDistancia,
  obtenerDiametroPromedio,
  formatearFecha,
  clasificarObjeto,
};

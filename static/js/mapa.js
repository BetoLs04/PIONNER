// Inicializar mapa
const map = L.map('map').setView([20, 0], 2);

// Capa base
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { 
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
}).addTo(map);

// Geocoder (buscador de direcciones)
L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Buscar dirección..."
}).addTo(map).on('markgeocode', async function(e) {
    const lat = e.geocode.center.lat;
    const lon = e.geocode.center.lng;

    map.setView([lat, lon], 13);

    await crearMarcador(lat, lon, e.geocode.name);
});

// Función para elegir color según AQI
function colorAQI(aqi) {
    if (aqi === null) return "gray";
    if (aqi <= 50) return "green";
    else if (aqi <= 100) return "orange";
    else return "red";
}

// Función para elegir GIF según AQI
function gifAQI(aqi) {
    if (aqi === null) return "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamk1c2xqejgzbWM2c24wenY2NGdvbXV0ZXlwNHhiOHBoem95MGgzNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KKOMG9EB7VqBq/giphy.gif";
    if (aqi <= 50) return "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif";
    else if (aqi <= 100) return "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2thZHNwMGNkMWxieXd0ejQ3Z2lpcWVham15ZHltb3YzMWF2YjIzcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/UxDUE92tNDyWQ/giphy.gif";
    else return "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXI4Y2xsYTlsMjRpbnBqZjV2dnJjNGJhY3p3YW1jdGl4b3BwZm9qdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rXqENnCtc1UgE/giphy.gif";
}

// Función para generar contenido de popup
function generarPopup(aqi, estado, contaminantes, ultima_actualizacion) {
    let fechaFormateada = "N/A";
    if (ultima_actualizacion) {
        const fecha = new Date(ultima_actualizacion);
        fechaFormateada = fecha.toLocaleString("es-MX", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
    }

    let colorEstado = "gray";
    if (estado === "Buena") colorEstado = "green";
    else if (estado === "Regular") colorEstado = "orange";
    else if (estado === "Mala") colorEstado = "red";

    // Tabla de contaminantes
    let tablaContaminantes = `<table style="width:100%; border-collapse:collapse; margin-top:8px;">`;
    for (const [key, value] of Object.entries(contaminantes)) {
        tablaContaminantes += `
            <tr>
                <td style="border:1px solid #ccc; padding:4px; font-weight:bold;">${key}</td>
                <td style="border:1px solid #ccc; padding:4px; text-align:right;">${value ?? 'N/A'}</td>
            </tr>
        `;
    }
    tablaContaminantes += `</table>`;

    return `
        <div style="text-align:center; max-width:250px;">
            <h3 style="margin:5px 0;">Calidad del Aire</h3>

            <div style="margin:5px 0; font-size:1em;">
                <b>AQI:</b> ${aqi ?? 'N/A'} &nbsp;
                <span style="color:${colorEstado}; font-weight:bold;">${estado}</span>
            </div>

            <div style="display:flex; justify-content:space-around; margin:5px 0; font-size:0.75em;">
                <span style="color:green;">Buena ≤50</span>
                <span style="color:orange;">Regular 51-100</span>
                <span style="color:red;">Mala >100</span>
            </div>

            ${tablaContaminantes}

            <div style="margin-top:5px; font-size:0.7em; color:#555;">
                <b>Última actualización:</b><br>${fechaFormateada}
            </div>

            <div style="margin-top:8px;">
                <img src="${gifAQI(aqi)}" width="100" height="100" style="border-radius:10px;"/>
            </div>
        </div>
    `;
}

// Función para crear marcador
async function crearMarcador(lat, lon, ciudad = null) {
    // Llamar a Python para consultar WAQI
    const resp = await fetch(`/api/waqi?lat=${lat}&lon=${lon}`);
    const result = await resp.json();

    const markerColor = colorAQI(result.aqi);
    const popupContent = generarPopup(result.aqi, result.estado, result.contaminantes, result.ultima_actualizacion);

    const marker = L.circleMarker([lat, lon], {
        radius: 10,
        fillColor: markerColor,
        color: "#000",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(popupContent).openPopup();

    // Actualizar header flotante
    const header = document.getElementById("mapLocationName");
    if (ciudad) header.textContent = ciudad;
    else header.textContent = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
}

// Evento clic en el mapa
map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    await crearMarcador(lat, lon);
});

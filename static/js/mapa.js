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

// --- FUNCIÓN COLOR AQI (criterios SINAICA) ---
function colorAQI(aqi) {
    if (aqi === null) return "gray";
    if (aqi <= 50) return "green";        // Buena
    else if (aqi <= 100) return "yellow"; // Regular
    else if (aqi <= 150) return "orange"; // Mala
    else if (aqi <= 200) return "red";    // Muy mala
    else return "purple";                 // Extremadamente mala
}

function gifAQI(aqi) {
    if (aqi === null) return "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExamk1c2xqejgzbWM2c24wenY2NGdvbXV0ZXlwNHhiOHBoem95MGgzNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KKOMG9EB7VqBq/giphy.gif";
    if (aqi <= 50) return "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif";
    else if (aqi <= 100) return "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzI2NjczNTJpZDNvNzAwaDF5d3dhdDg2YzZrZ3ZpNGx2eXJnOXZsZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/2tQXyCg8c94YsXbCxz/giphy.gif";
    else if (aqi <= 150) return "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2thZHNwMGNkMWxieXd0ejQ3Z2lpcWVham15ZHltb3YzMWF2YjIzcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/UxDUE92tNDyWQ/giphy.gif";
    else if (aqi <= 200) return "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXI4Y2xsYTlsMjRpbnBqZjV2dnJjNGJhY3p3YW1jdGl4b3BwZm9qdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/rXqENnCtc1UgE/giphy.gif";
    else return "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3M3YXVjY2p2cHRwZ3A1ZXdic2pyM253bzR6ajZ5YTIzcHRxNmY2biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/uBFEvFM8kk69lZBntm/giphy.gif";
}

// Conversión µg/m³ -> ppm (simplificado a 25 °C, 1 atm)
function ugm3ToPPM(value, mw) {
    if (!value || value === "N/A") return "N/A";
    return (value * 24.45 / mw).toFixed(3);
}

// Evaluar riesgo por grupo de edad con palabras descriptivas
function riesgoEdad(aqi, grupo) {
    let verde, amarillo;
    switch(grupo) {
        case "Niños":
        case "Adultos mayores":
            verde = 40; amarillo = 70; break;
        case "Adolescentes":
            verde = 50; amarillo = 100; break;
        case "Adultos":
            verde = 60; amarillo = 120; break;
    }

    // Retornar descripción y color
    if (aqi <= verde) return {estado: "Buena", color: "green"};
    else if (aqi <= amarillo) return {estado: "Regular", color: "yellow"};
    else if (aqi <= 150) return {estado: "Mala", color: "orange"};
    else if (aqi <= 200) return {estado: "Muy mala", color: "red"};
    else return {estado: "Extremadamente mala", color: "purple"};
}

// Generar tabla de contaminantes en µg/m³ y ppm
function tablaContaminantes(contaminantes) {
    const pesos = { CO: 28.01, NO2: 46.01, O3: 48, SO2: 64.07 }; 
    let tabla = `<table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <tr><th>Contaminante</th><th>µg/m³</th><th>ppm</th></tr>`;
    for (const [key, val] of Object.entries(contaminantes)) {
        let ppm = (pesos[key]) ? ugm3ToPPM(val, pesos[key]) : "—";
        tabla += `<tr>
            <td style="border:1px solid #ccc; padding:4px;">${key}</td>
            <td style="border:1px solid #ccc; padding:4px; text-align:right;">${val ?? 'N/A'}</td>
            <td style="border:1px solid #ccc; padding:4px; text-align:right;">${ppm}</td>
        </tr>`;
    }
    tabla += `</table>`;
    return tabla;
}

// Generar popup con riesgos por edad y GIF
function generarPopup(aqi, estado, contaminantes, ultima_actualizacion) {
    let fechaFormateada = ultima_actualizacion 
        ? new Date(ultima_actualizacion).toLocaleString("es-MX") 
        : "N/A";

    // Evaluar para cada grupo
    const grupos = ["Niños", "Adolescentes", "Adultos", "Adultos mayores"];
    let riesgosHTML = grupos.map(g => {
        const r = riesgoEdad(aqi, g);
        return `<div style="margin:2px 0;">
            <b>${g}:</b> <span style="color:${r.color}; font-weight:bold;">${r.estado}</span>
        </div>`;
    }).join("");

    const gif = gifAQI(aqi);

    return `
        <div style="text-align:center; max-width:260px;">
            <h3 style="margin:5px 0;">Calidad del Aire</h3>
            <img src="${gif}" alt="gif calidad aire" style="width:100%; border-radius:10px; margin-bottom:5px;">
            <div><b>AQI:</b> ${aqi ?? 'N/A'} (${estado})</div>
            <div style="margin:6px 0; font-size:0.9em; text-align:left;">
                ${riesgosHTML}
            </div>
            ${tablaContaminantes(contaminantes)}
            <div style="margin-top:5px; font-size:0.7em; color:#555;">
                Última actualización:<br>${fechaFormateada}
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

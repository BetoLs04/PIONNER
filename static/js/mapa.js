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

// ---------- crearMarcador (completa y con manejo de errores) ----------
async function crearMarcador(lat, lon, ciudad = null) {
    try {
        // Llamada WAQI
        const resp = await fetch(`/api/waqi?lat=${lat}&lon=${lon}`);
        if (!resp.ok) {
            throw new Error(`WAQI HTTP ${resp.status}`);
        }
        const result = await resp.json();

        // Normalizar valores
        const aqi = (result && ('aqi' in result)) ? result.aqi : null;
        const estado = result && result.estado ? result.estado : "N/A";
        const contaminantes = result && result.contaminantes ? result.contaminantes : {};
        const ultima = result && result.ultima_actualizacion ? result.ultima_actualizacion : null;

        // Color y popup
        const markerColor = colorAQI(aqi);
        const popupContent = generarPopup(aqi, estado, contaminantes, ultima);

        // Crear marcador
        const marker = L.circleMarker([Number(lat), Number(lon)], {
            radius: 10,
            fillColor: markerColor,
            color: "#000",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        marker.bindPopup(popupContent).openPopup();

        // Actualizar encabezado
        const header = document.getElementById("mapLocationName");
        if (header) {
            header.textContent = ciudad || `Lat: ${Number(lat).toFixed(2)}, Lon: ${Number(lon).toFixed(2)}`;
        }

        // Guardar en historial (POST)
        try {
            const postResp = await fetch("/api/historial", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lat: Number(lat),
                    lon: Number(lon),
                    ciudad: ciudad || null,
                    aqi: aqi,
                    estado: estado
                })
            });

            if (!postResp.ok) {
                // No lanzar para que la tabla intente actualizarse igualmente,
                // pero avisamos en consola para debugging.
                console.warn("No se pudo guardar historial. HTTP:", postResp.status);
                // opcional: const errText = await postResp.text();
                // console.warn("Respuesta:", errText);
            } else {
                // leer respuesta JSON si la hay (no obligatorio)
                try { const j = await postResp.json(); console.log("Historial guardado:", j); } catch(e){ /* response vacía */ }
            }
        } catch (postErr) {
            console.error("Error en POST /api/historial:", postErr);
        }

        // Actualizar tabla del historial (mostrarHistorial maneja sus propios errores)
        await mostrarHistorial();

    } catch (error) {
        console.error("Error en crearMarcador:", error);
        // Mensaje al usuario (puedes comentar el alert para no molestar)
        alert("Ocurrió un error al obtener los datos de la ubicación seleccionada. Revisa la consola para más detalles.");
    }
}
// 🔹 Función para mostrar el historial en la tabla
async function mostrarHistorial() {
    try {
        const resp = await fetch("/api/historial");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const historial = await resp.json();

        const tbody = document.querySelector("#tabla-historial tbody");
        if (!tbody) {
            console.warn("No se encontró la tabla del historial (#tabla-historial tbody)");
            return;
        }

        tbody.innerHTML = "";

        if (!Array.isArray(historial) || historial.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Sin registros</td></tr>`;
            return;
        }

        historial.forEach(item => {
            const latText = (item.lat !== null && !isNaN(item.lat)) ? Number(item.lat).toFixed(2) : "N/A";
            const lonText = (item.lon !== null && !isNaN(item.lon)) ? Number(item.lon).toFixed(2) : "N/A";
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${item.fecha_consulta ?? "N/A"}</td>
                <td>${item.ciudad || "Desconocido"}</td>
                <td>${item.aqi ?? "N/A"}</td>
                <td>${item.estado ?? "N/A"}</td>
                <td>${latText}</td>
                <td>${lonText}</td>
            `;
            tbody.appendChild(fila);
        });
    } catch (error) {
        console.error("Error al mostrar historial:", error);
        const tbody = document.querySelector("#tabla-historial tbody");
        if (tbody)
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar historial</td></tr>`;
    }
}


// Evento clic en el mapa
map.on('click', async function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    await crearMarcador(lat, lon);
});
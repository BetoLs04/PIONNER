# 🌎 PIONEER — Monitoreo de Calidad del Aire

**PIONEER** es una aplicación web interactiva que permite consultar la calidad del aire en cualquier ubicación del mundo utilizando datos de la API de **World Air Quality Index (WAQI)**.  
El sistema muestra la información directamente sobre un mapa, junto con indicadores visuales (colores, GIFs y tablas), además de mantener un **historial local** de las ubicaciones consultadas mediante una base de datos SQLite.

---

## 🚀 Cómo iniciar el proyecto

1. **Clona este repositorio:**
   git clone <URL_DEL_REPOSITORIO>
   cd "PIONEER 1.5"

2. **Instala los requerimientos (si aún no los tienes):**
   pip install flask requests

3. **Ejecuta la aplicación:**
   python app.py

   o

   python3 app.py

4. **Abre tu navegador** y entra en:
   http://127.0.0.1:5000/

---

## Estructura del proyecto

PIONEER 1.5/
│
├── app.py                 # Servidor principal Flask (backend)
├── historial.db           # Base de datos SQLite (se crea automáticamente)
├── templates/
│   └── index.html         # Página principal (interfaz web)
│
├── static/
│   ├── js/
│   │   └── mapa.js        # Lógica del mapa (Leaflet + conexión API)
│   └── imagenes/
│       └── Pioneer.png    # Logotipo mostrado en el encabezado
│
└── README.md              # Este archivo

---

## ⚙️ Explicación de los componentes

### `app.py` — Servidor Flask
- Inicia el servidor web y carga la página principal (`index.html`).
- Se conecta a la API **WAQI** para obtener los datos del índice de calidad del aire (AQI).
- Crea automáticamente una base de datos SQLite llamada `historial.db`.
- Guarda cada búsqueda en una tabla llamada `historial` con:
  - Latitud (`lat`)
  - Longitud (`lon`)
  - Ciudad
  - AQI
  - Estado del aire (Buena, Regular, Mala, etc.)
  - Fecha y hora de la consulta
- Rutas principales:
  - `/api/waqi` → obtiene datos de calidad del aire desde la API WAQI.
  - `/api/historial` (POST) → guarda una nueva búsqueda.
  - `/api/historial` (GET) → devuelve el historial guardado (últimas 10 consultas).

---

### `index.html` — Interfaz principal
- Contiene la estructura visual de la aplicación.
- Muestra:
  - El **mapa interactivo** (Leaflet).
  - Un panel de **rangos de calidad del aire** (SINAICA).
  - Un panel de **impacto por grupo de edad**.
  - Una **tabla con el historial de ubicaciones consultadas**.

---

### `static/js/mapa.js` — Lógica del mapa y API
Contiene toda la interacción del usuario:

- Inicializa el mapa usando **Leaflet.js**.  
- Permite buscar direcciones o hacer clic en el mapa para seleccionar un punto.  
- Consulta el backend Flask (`/api/waqi`) para obtener el AQI de esa ubicación.  
- Muestra:
  - Un marcador de color según la calidad del aire.
  - Un popup con:
    - Valor AQI.
    - Riesgos por edad.
    - Tabla de contaminantes (µg/m³ y ppm).
    - GIF ilustrativo del nivel de contaminación.
- Guarda automáticamente la ubicación consultada en el historial (`/api/historial`).
- Actualiza la tabla del historial en tiempo real con los últimos registros.

---

## Base de datos: `historial.db`
SQLite se utiliza para mantener un registro local de las consultas.  
Cada vez que seleccionas una nueva ubicación, se inserta un registro con la información obtenida.

---

## Lógica del color AQI (SINAICA)

| AQI | Color | Estado |
|-----|--------|--------|
| 0 – 50 | 🟢 Verde | Buena |
| 51 – 100 | 🟡 Amarillo | Regular |
| 101 – 150 | 🟠 Naranja | Mala |
| 151 – 200 | 🔴 Rojo | Muy mala |
| > 200 | 🟣 Morado | Extremadamente mala |

---

## 🌐 Dependencias utilizadas

| Librería | Uso |
|-----------|-----|
| **Flask** | Servidor web backend |
| **Requests** | Peticiones HTTP a la API WAQI |
| **Leaflet.js** | Mapa interactivo |
| **Leaflet Control Geocoder** | Buscador de direcciones |
| **SQLite3** | Base de datos local para historial |

---

## 💡 Notas adicionales
- Si el mapa no carga correctamente, revisa tu conexión a internet o la consola del navegador (F12 → Console).
- El historial se guarda localmente en `historial.db`; si deseas limpiar los datos, puedes eliminar ese archivo manualmente.
- Puedes modificar el token de la API WAQI en `app.py` si deseas usar uno propio:
  ```python
  TOKEN_WAQI = "TU_TOKEN_AQUI"
  ```

---

## ✨ Autor
**PIONEER - Monitoreo de Calidad del Aire**  
Desarrollado con Python, Flask y Leaflet.js 🌿  

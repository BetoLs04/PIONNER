from flask import Flask, render_template, request, jsonify
import requests, sqlite3, os
from datetime import datetime

app = Flask(__name__)

TOKEN_WAQI = "d1833bb40680f0d3fbb15b53a7cf55a73c35b1f8"
DB_PATH = "historial.db"

# --- Inicializar base de datos ---
def init_db():
    if not os.path.exists(DB_PATH):
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE historial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lat REAL,
                    lon REAL,
                    ciudad TEXT,
                    aqi INTEGER,
                    estado TEXT,
                    fecha_consulta TEXT
                )
            """)
            conn.commit()

init_db()

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/waqi")
def waqi_api():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "Faltan coordenadas"}), 400

    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={TOKEN_WAQI}"
    resp = requests.get(url)
    data = resp.json()

    if data["status"] != "ok":
        return jsonify({"estado": "Datos no disponibles"}), 404

    aqi = data["data"].get("aqi")
    iaqi = data["data"].get("iaqi", {})
    ultima_actualizacion = data["data"].get("time", {}).get("s")

    contaminantes = {
        "PM25": iaqi.get("pm25", {}).get("v"),
        "PM10": iaqi.get("pm10", {}).get("v"),
        "NO2": iaqi.get("no2", {}).get("v"),
        "O3": iaqi.get("o3", {}).get("v")
    }

    if aqi is None:
        estado = "Datos no disponibles"
    elif aqi <= 50:
        estado = "Buena"
    elif aqi <= 100:
        estado = "Regular"
    else:
        estado = "Mala"

    return jsonify({
        "estado": estado,
        "aqi": aqi,
        "contaminantes": contaminantes,
        "ultima_actualizacion": ultima_actualizacion
    })


# --- Ruta para guardar historial ---
@app.route("/api/historial", methods=["POST"])
def guardar_historial():
    data = request.get_json()
    lat = data.get("lat")
    lon = data.get("lon")
    ciudad = data.get("ciudad", "Desconocido")
    aqi = data.get("aqi")
    estado = data.get("estado")

    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO historial (lat, lon, ciudad, aqi, estado, fecha_consulta) VALUES (?, ?, ?, ?, ?, ?)",
            (lat, lon, ciudad, aqi, estado, fecha)
        )
        conn.commit()

    return jsonify({"mensaje": "Guardado en historial"})


# --- Ruta para consultar historial ---
@app.route("/api/historial", methods=["GET"])
def obtener_historial():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("SELECT * FROM historial ORDER BY id DESC LIMIT 10")
        rows = cursor.fetchall()

    historial = [
        {
            "id": r[0],
            "lat": r[1],
            "lon": r[2],
            "ciudad": r[3],
            "aqi": r[4],
            "estado": r[5],
            "fecha_consulta": r[6]
        } for r in rows
    ]
    return jsonify(historial)


if __name__ == "__main__":
    app.run(debug=True)

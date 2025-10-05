from flask import Flask, render_template, request, jsonify
import requests, sqlite3, os
from datetime import datetime
import statistics
from typing import List, Dict, Any

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
        "O3": iaqi.get("o3", {}).get("v"),
        "CO": iaqi.get("co", {}).get("v"),
        "SO2": iaqi.get("so2", {}).get("v")
    }

    if aqi is None:
        estado = "Datos no disponibles"
    elif aqi <= 50:
        estado = "Buena"
    elif aqi <= 100:
        estado = "Regular"
    elif aqi <= 150:
        estado = "Mala"
    elif aqi <= 200:
        estado = "Muy mala"
    else:
        estado = "Extremadamente mala"

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
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    
    with sqlite3.connect(DB_PATH) as conn:
        if lat and lon:
            # Filtrar por ubicación específica
            cursor = conn.execute(
                "SELECT * FROM historial WHERE lat = ? AND lon = ? ORDER BY fecha_consulta DESC LIMIT 10",
                (float(lat), float(lon))
            )
        else:
            # Todos los registros (para el historial general)
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

# --- NUEVA RUTA PARA PRONÓSTICO ---
@app.route("/api/pronostico", methods=["GET"])
def obtener_pronostico():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    ciudad = request.args.get("ciudad", "Ubicación actual")
    
    try:
        if lat and lon:
            # Pronóstico para ubicación específica
            pronostico = generar_pronostico_ubicacion(float(lat), float(lon), ciudad)
        else:
            # Pronóstico general basado en todo el historial
            pronostico = generar_pronostico_general()
        
        return jsonify(pronostico)
    
    except Exception as e:
        return jsonify({
            "pronostico": "Error en el análisis",
            "tendencia": "desconocida",
            "confianza": 0,
            "error": str(e)
        }), 500

# --- FUNCIONES DE ANÁLISIS DE PRONÓSTICO ---
def generar_pronostico_ubicacion(lat: float, lon: float, ciudad: str) -> Dict[str, Any]:
    """Genera pronóstico para una ubicación específica"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "SELECT aqi, fecha_consulta FROM historial WHERE lat = ? AND lon = ? ORDER BY fecha_consulta DESC LIMIT 7",
            (lat, lon)
        )
        datos = cursor.fetchall()
    
    if not datos:
        return {
            "pronostico": "No hay datos históricos para esta ubicación",
            "tendencia": "desconocida",
            "confianza": 0,
            "datos_analizados": 0,
            "ubicacion": ciudad
        }
    
    return analizar_tendencias([{"aqi": d[0], "fecha_consulta": d[1]} for d in datos], ciudad)

def generar_pronostico_general() -> Dict[str, Any]:
    """Genera pronóstico general basado en todo el historial"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "SELECT aqi, fecha_consulta FROM historial ORDER BY fecha_consulta DESC LIMIT 10"
        )
        datos = cursor.fetchall()
    
    if len(datos) < 3:
        return {
            "pronostico": "Datos insuficientes para pronóstico general",
            "tendencia": "desconocida",
            "confianza": 0,
            "datos_analizados": len(datos)
        }
    
    return analizar_tendencias([{"aqi": d[0], "fecha_consulta": d[1]} for d in datos], "General")

def analizar_tendencias(datos: List[Dict], ubicacion: str) -> Dict[str, Any]:
    """Analiza tendencias en los datos de AQI"""
    # Filtrar datos válidos
    datos_validos = [d for d in datos if d["aqi"] is not None and isinstance(d["aqi"], (int, float))]
    
    if len(datos_validos) < 3:
        return {
            "pronostico": "Se necesitan más datos para análisis",
            "tendencia": "desconocida",
            "confianza": 0,
            "datos_analizados": len(datos_validos),
            "ubicacion": ubicacion
        }
    
    # Ordenar por fecha (más antiguo primero)
    try:
        datos_validos.sort(key=lambda x: datetime.strptime(x["fecha_consulta"], "%Y-%m-%d %H:%M:%S"))
    except:
        datos_validos.sort(key=lambda x: x["fecha_consulta"])
    
    # Calcular tendencia lineal simple
    n = len(datos_validos)
    indices = list(range(n))
    valores_aqi = [d["aqi"] for d in datos_validos]
    
    # Calcular pendiente (tendencia)
    sum_x = sum(indices)
    sum_y = sum(valores_aqi)
    sum_xy = sum(i * valores_aqi[i] for i in indices)
    sum_x2 = sum(i * i for i in indices)
    
    try:
        pendiente = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
    except ZeroDivisionError:
        pendiente = 0
    
    # Determinar tendencia
    if pendiente > 0.5:
        tendencia = "alza"
        direccion = "empeoramiento"
    elif pendiente < -0.5:
        tendencia = "baja"
        direccion = "mejora"
    else:
        tendencia = "estable"
        direccion = "estabilidad"
    
    # 🔹 CORRECCIÓN: Cálculo de confianza mejorado
    try:
        promedio_aqi = statistics.mean(valores_aqi)
        if n > 1:
            desviacion_estandar = statistics.stdev(valores_aqi)
            # Confianza basada en consistencia de datos
            coef_variacion = desviacion_estandar / promedio_aqi if promedio_aqi > 0 else 1
            confianza_base = max(10, 80 - (coef_variacion * 60))  # Máx 80% por consistencia
        else:
            confianza_base = 30
    except:
        confianza_base = 30
    
    # 🔹 CORRECCIÓN: Confianza basada en cantidad de datos y tendencia
    confianza_datos = min(70, (n / 10) * 70)  # Máx 70% por cantidad de datos
    confianza_tendencia = min(30, abs(pendiente) * 20)  # Máx 30% por fuerza de tendencia
    
    # 🔹 CORRECCIÓN: Total limitado al 100%
    confianza_total = min(100, confianza_base + confianza_tendencia)
    
    # Generar pronóstico
    ultimo_aqi = valores_aqi[-1]
    
    if tendencia == "alza":
        pronostico_aqi = min(ultimo_aqi + 5, 500)  # Ajuste conservador
        pronostico_texto = f"Tendencia a {direccion} (AQI estimado: {int(pronostico_aqi)})"
    elif tendencia == "baja":
        pronostico_aqi = max(ultimo_aqi - 5, 0)
        pronostico_texto = f"Tendencia a {direccion} (AQI estimado: {int(pronostico_aqi)})"
    else:
        pronostico_aqi = ultimo_aqi
        pronostico_texto = f"Se mantiene {direccion} (AQI actual: {int(pronostico_aqi)})"
    
    # Análisis de nivel actual
    if ultimo_aqi <= 50:
        nivel_actual = "Buena"
    elif ultimo_aqi <= 100:
        nivel_actual = "Regular"
    elif ultimo_aqi <= 150:
        nivel_actual = "Mala"
    elif ultimo_aqi <= 200:
        nivel_actual = "Muy mala"
    else:
        nivel_actual = "Extremadamente mala"
    
    return {
        "pronostico": pronostico_texto,
        "tendencia": tendencia,
        "confianza": round(confianza_total),
        "ultimo_aqi": ultimo_aqi,
        "pronostico_aqi": round(pronostico_aqi),
        "nivel_actual": nivel_actual,
        "datos_analizados": n,
        "ubicacion": ubicacion,
        "pendiente": round(pendiente, 2)
    }

# --- Ruta para análisis detallado ---
@app.route("/api/analisis", methods=["GET"])
def obtener_analisis_detallado():
    """Endpoint para análisis más detallado del historial"""
    with sqlite3.connect(DB_PATH) as conn:
        # Estadísticas generales
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total_registros,
                AVG(aqi) as promedio_aqi,
                MIN(aqi) as minimo_aqi,
                MAX(aqi) as maximo_aqi,
                COUNT(DISTINCT ciudad) as ubicaciones_unicas
            FROM historial 
            WHERE aqi IS NOT NULL
        """)
        stats = cursor.fetchone()
        
        # Tendencia por ubicación
        cursor = conn.execute("""
            SELECT ciudad, lat, lon, COUNT(*) as registros, AVG(aqi) as promedio
            FROM historial 
            WHERE aqi IS NOT NULL 
            GROUP BY ciudad, lat, lon 
            HAVING COUNT(*) >= 3
            ORDER BY registros DESC
        """)
        ubicaciones = cursor.fetchall()
        
        # Últimas 24 horas
        cursor = conn.execute("""
            SELECT COUNT(*) as registros_24h, 
                   AVG(aqi) as promedio_24h
            FROM historial 
            WHERE fecha_consulta >= datetime('now', '-1 day')
            AND aqi IS NOT NULL
        """)
        stats_24h = cursor.fetchone()

    analisis = {
        "estadisticas_generales": {
            "total_registros": stats[0],
            "promedio_aqi": round(stats[1], 2) if stats[1] else 0,
            "minimo_aqi": stats[2],
            "maximo_aqi": stats[3],
            "ubicaciones_unicas": stats[4]
        },
        "estadisticas_24h": {
            "registros": stats_24h[0],
            "promedio_aqi": round(stats_24h[1], 2) if stats_24h[1] else 0
        },
        "ubicaciones_analizadas": [
            {
                "ciudad": u[0],
                "lat": u[1],
                "lon": u[2],
                "registros": u[3],
                "promedio_aqi": round(u[4], 2)
            } for u in ubicaciones
        ]
    }
    
    return jsonify(analisis)

# --- Ruta para limpiar historial ---
@app.route("/api/limpiar_historial", methods=["DELETE"])
def limpiar_historial():
    """Elimina todos los registros del historial"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM historial")
            conn.commit()
        
        return jsonify({"mensaje": "Historial limpiado correctamente"})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Ruta para estadísticas de salud ---
@app.route("/api/estadisticas_salud", methods=["GET"])
def obtener_estadisticas_salud():
    """Estadísticas específicas para análisis de salud"""
    with sqlite3.connect(DB_PATH) as conn:
        # Porcentaje de tiempo en cada nivel de calidad
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN aqi <= 50 THEN 1 ELSE 0 END) as buena,
                SUM(CASE WHEN aqi > 50 AND aqi <= 100 THEN 1 ELSE 0 END) as regular,
                SUM(CASE WHEN aqi > 100 AND aqi <= 150 THEN 1 ELSE 0 END) as mala,
                SUM(CASE WHEN aqi > 150 AND aqi <= 200 THEN 1 ELSE 0 END) as muy_mala,
                SUM(CASE WHEN aqi > 200 THEN 1 ELSE 0 END) as extremadamente_mala
            FROM historial 
            WHERE aqi IS NOT NULL
        """)
        niveles = cursor.fetchone()
        
        # Tendencia de los últimos 7 días
        cursor = conn.execute("""
            SELECT DATE(fecha_consulta) as fecha, AVG(aqi) as promedio_diario
            FROM historial 
            WHERE fecha_consulta >= datetime('now', '-7 days')
            AND aqi IS NOT NULL
            GROUP BY DATE(fecha_consulta)
            ORDER BY fecha
        """)
        tendencia_7dias = cursor.fetchall()

    total = niveles[0]
    if total > 0:
        porcentajes = {
            "buena": round((niveles[1] / total) * 100, 1),
            "regular": round((niveles[2] / total) * 100, 1),
            "mala": round((niveles[3] / total) * 100, 1),
            "muy_mala": round((niveles[4] / total) * 100, 1),
            "extremadamente_mala": round((niveles[5] / total) * 100, 1)
        }
    else:
        porcentajes = {
            "buena": 0, "regular": 0, "mala": 0, "muy_mala": 0, "extremadamente_mala": 0
        }

    return jsonify({
        "porcentajes_niveles": porcentajes,
        "tendencia_7dias": [
            {"fecha": t[0], "promedio_aqi": round(t[1], 2)} for t in tendencia_7dias
        ],
        "total_registros": total
    })

if __name__ == "__main__":
    app.run(debug=True)
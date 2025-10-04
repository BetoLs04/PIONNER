from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

TOKEN_WAQI = "d1833bb40680f0d3fbb15b53a7cf55a73c35b1f8"  # Tu token WAQI

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/waqi")
def waqi_api():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error":"Faltan coordenadas"}), 400

    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={TOKEN_WAQI}"
    resp = requests.get(url)
    data = resp.json()

    if data["status"] != "ok":
        return jsonify({"estado":"Datos no disponibles"}), 404

    aqi = data["data"].get("aqi")
    iaqi = data["data"].get("iaqi", {})
    ultima_actualizacion = data["data"].get("time", {}).get("s")  # <-- aquí

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
        "ultima_actualizacion": ultima_actualizacion  # <-- agregado
    })

if __name__ == "__main__":
    app.run(debug=True)

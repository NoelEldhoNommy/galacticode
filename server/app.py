import os
import requests

from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

NASA_API_KEY = os.environ.get("NASA_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

NASA_API = "https://api.nasa.gov/neo/rest/v1"
GEMINI_API_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={GEMINI_API_KEY}"

app = Flask(__name__)
CORS(app, origins=os.environ.get("FRONTEND_ORIGIN"))


@app.route("/neo-feed")
def neo_feed():
    start_date = request.args.get("start_date", datetime.now().strftime("%Y-%m-%d"))
    try:
        response = requests.get(
            f"{NASA_API}/feed?start_date={start_date}&api_key={NASA_API_KEY}"
        )
        return jsonify(response.json()), response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/neo-lookup/<id>")
def neo_lookup(id):
    try:
        response = requests.get(f"{NASA_API}/neo/{id}?api_key={NASA_API_KEY}")
        return jsonify(response.json()), response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Asteroid with that id does not exist"}), 404


@app.route("/gemini", methods=["POST"])
def gemini():
    try:
        response = requests.post(
            GEMINI_API_ENDPOINT,
            headers={"Content-Type": "application/json"},
            json=request.json,
        )

        return jsonify(response.json()), response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    app.run(debug=True)

# ══════════════════════════════════════════════════════
#   NovaMind — main.py
#   Serveur Flask : point d'entrée de l'IA locale
#
#   Lancement : python main.py
#   API       : http://localhost:5000
# ══════════════════════════════════════════════════════

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import ai_engine
import config
import updater
import time
import os
import sys

def get_base_path():
    """Détermine le chemin absolu selon si on tourne en script ou via l'exécutable PyInstaller."""
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.abspath(os.path.dirname(__file__))

BASE_PATH = get_base_path()

app = Flask(__name__)

# ── CORS : autorise l'interface HTML à communiquer avec le backend ──
CORS(app, resources={r"/*": {"origins": "*"}})


# ══════════════════════════════════════════════════════
# ROUTES FRONTEND
# ══════════════════════════════════════════════════════
@app.route('/')
def serve_index():
    return send_from_directory(BASE_PATH, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(BASE_PATH, path)):
        return send_from_directory(BASE_PATH, path)
    return jsonify({'error': 'Not found'}), 404

# ══════════════════════════════════════════════════════
# ROUTES API
# ══════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    """Vérifie que le serveur et le moteur IA sont opérationnels."""
    status = ai_engine.get_status()
    return jsonify({
        'status': 'ok',
        'novamind': 'running',
        'backend': status['backend'],
        'model':   status['model'],
        'ready':   status['ready'],
    })


@app.route('/chat', methods=['POST'])
def chat():
    """
    Reçoit un message et retourne la réponse de l'IA.

    Body JSON attendu :
    {
        "message":      "texte utilisateur",
        "history":      [{"role": "user"|"ai", "content": "..."}],
        "system_prompt":"personnalité de l'IA",
        "temperature":  0.7
    }
    """
    try:
        data = request.get_json(force=True)

        # ── Validation ──
        if not data or 'message' not in data:
            return jsonify({'error': 'Champ "message" manquant.'}), 400

        message       = str(data.get('message', '')).strip()
        history       = data.get('history', [])
        system_prompt = data.get('system_prompt', config.DEFAULT_SYSTEM)
        temperature   = float(data.get('temperature', config.DEFAULT_TEMPERATURE))
        temperature   = max(0.0, min(1.0, temperature))  # Clamp [0, 1]

        if not message:
            return jsonify({'error': 'Message vide.'}), 400

        # ── Normalisation de l'historique ──
        # L'interface envoie role="ai", Ollama attend role="assistant"
        normalized_history = []
        for h in history:
            role    = h.get('role', 'user')
            content = h.get('content', '')
            if role == 'ai':
                role = 'assistant'
            if content:
                normalized_history.append({'role': role, 'content': content})

        # ── Génération ──
        t0 = time.time()
        response = ai_engine.generate(
            message       = message,
            history       = normalized_history,
            system_prompt = system_prompt,
            temperature   = temperature,
        )
        elapsed = round(time.time() - t0, 2)

        return jsonify({
            'response':    response,
            'backend':     ai_engine.get_status()['backend'],
            'model':       ai_engine.get_status()['model'],
            'time_seconds': elapsed,
        })

    except Exception as e:
        print(f"[NovaMind] Erreur /chat : {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/models', methods=['GET'])
def models():
    """Liste les modèles Ollama disponibles (si Ollama est actif)."""
    try:
        import requests as req
        r = req.get(f"{config.OLLAMA_URL}/api/tags", timeout=5)
        if r.status_code == 200:
            model_list = [m['name'] for m in r.json().get('models', [])]
            return jsonify({'models': model_list})
        return jsonify({'models': [], 'error': 'Ollama non disponible'})
    except Exception:
        return jsonify({'models': [], 'error': 'Ollama non disponible'})


@app.route('/set_model', methods=['POST'])
def set_model():
    """Change le modèle Ollama utilisé à la volée."""
    data  = request.get_json(force=True)
    model = data.get('model', '').strip()
    if not model:
        return jsonify({'error': 'Modèle non spécifié.'}), 400
    config.OLLAMA_MODEL = model
    return jsonify({'success': True, 'model': model})


@app.route('/update_status', methods=['GET'])
def update_status():
    """Retourne l'état de la mise à jour Git effectuée au lancement."""
    status = updater.get_update_status()
    return jsonify({
        'updated': status['updated'],
        'error': status['error'],
        'version': config.VERSION
    })


# ══════════════════════════════════════════════════════
# DÉMARRAGE
# ══════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 52)
    print(f"   [IA]  NovaMind v{config.VERSION} -- Serveur IA Local")
    print("=" * 52)

    # Vérification des mises à jour sur GitHub
    updater.check_and_update()

    # Détection et initialisation du moteur IA
    ai_engine.detect_backend()

    status = ai_engine.get_status()
    print(f"\n[NovaMind] Backend actif : {status['backend'].upper()}")
    print(f"[NovaMind] Modele        : {status['model']}")
    print(f"\n[NovaMind] Launch: Serveur demarre sur http://localhost:{config.PORT}")
    print("[NovaMind] Ouvrez http://localhost:8765 et allez dans Parametres")
    print("           -> Selectionnez 'Flask local' pour connecter l'IA\n")

    app.run(
        host='0.0.0.0',
        port=config.PORT,
        debug=config.DEBUG,
    )

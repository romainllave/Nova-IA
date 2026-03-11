# ══════════════════════════════════════════════════════
#   NovaMind — Application de bureau (desktop_app.py)
#   Encapsule le serveur Flask dans une fenêtre native Windows
#   
#   Lancement : python desktop_app.py
# ══════════════════════════════════════════════════════

import threading
import time
import webview
from main import app
import ai_engine
import config

def start_flask_server():
    """Démarre le serveur Flask en arrière-plan."""
    print("[NovaMind Desktop] Démarrage du moteur IA...")
    ai_engine.detect_backend()
    # On désactive le reloader pour éviter les erreurs de duplication de port avec pywebview
    app.run(host='127.0.0.1', port=config.PORT, debug=False, use_reloader=False)

if __name__ == '__main__':
    # 1. Lancer Flask dans un thread séparé
    server_thread = threading.Thread(target=start_flask_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Attendre que Flask soit prêt
    time.sleep(1.5)
    
    # 2. Créer la fenêtre de l'application native
    print("[NovaMind Desktop] Lancement de l'interface graphique...")
    window = webview.create_window(
        'NovaMind — IA Personnelle', 
        f'http://127.0.0.1:{config.PORT}',
        width=1200, 
        height=850,
        min_size=(900, 600),
        background_color='#070710'
    )
    
    # 3. Démarrer la boucle d'événements UI (bloquant)
    webview.start()

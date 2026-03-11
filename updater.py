import subprocess
import os

# Status de la dernière vérification
_last_status = {
    "updated": False,
    "error": None,
    "current_version": None
}

def check_and_update():
    """
    Vérifie les mises à jour sur GitHub et met à jour le code local si nécessaire.
    """
    global _last_status
    try:
        print("[NovaMind Updater] Vérification des mises à jour...")
        
        # 1. Récupérer les derniers changements sans fusionner
        subprocess.run(["git", "fetch", "origin", "master"], check=True, capture_output=True, text=True)
        
        # 2. Comparer la branche locale avec la branche distante
        status = subprocess.run(
            ["git", "status", "-uno"], 
            check=True, 
            capture_output=True, 
            text=True
        ).stdout

        if "Your branch is behind" in status:
            print("[NovaMind Updater] Mise à jour trouvée ! Téléchargement...")
            subprocess.run(["git", "pull", "origin", "master"], check=True)
            print("[NovaMind Updater] Mise à jour terminée avec succès.")
            _last_status["updated"] = True
            _last_status["error"] = None
            return True
        else:
            print("[NovaMind Updater] NovaMind est à jour.")
            _last_status["updated"] = False
            _last_status["error"] = None
            return False

    except subprocess.CalledProcessError as e:
        err_msg = e.stderr if e.stderr else str(e)
        print(f"[NovaMind Updater] Erreur lors de la mise à jour : {err_msg}")
        _last_status["updated"] = False
        _last_status["error"] = err_msg
        return False
    except Exception as e:
        print(f"[NovaMind Updater] Erreur inattendue : {e}")
        _last_status["updated"] = False
        _last_status["error"] = str(e)
        return False

def get_update_status():
    """Retourne l'état du dernier check."""
    return _last_status

if __name__ == "__main__":
    # Test manuel
    check_and_update()

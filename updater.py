import subprocess
import os

def check_and_update():
    """
    Vérifie les mises à jour sur GitHub et met à jour le code local si nécessaire.
    """
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
            return True
        else:
            print("[NovaMind Updater] NovaMind est à jour.")
            return False

    except subprocess.CalledProcessError as e:
        print(f"[NovaMind Updater] Erreur lors de la mise à jour : {e.stderr if e.stderr else e}")
        return False
    except Exception as e:
        print(f"[NovaMind Updater] Erreur inattendue : {e}")
        return False

if __name__ == "__main__":
    # Test manuel
    check_and_update()

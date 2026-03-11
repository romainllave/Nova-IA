import ai_engine
import json

def test_intent():
    tests = [
        "Quelle est la météo à Paris ?",
        "Qui est le président de la France ?",
        "Bonjour NovaMind",
        "Prix du Bitcoin aujourd'hui",
        "Comment vas-tu ?"
    ]
    print("--- Test de détection d'intention ---")
    for t in tests:
        intent = ai_engine.detect_search_intent(t)
        print(f"Query: {t} => Intent: {intent}")

def test_search_integration():
    print("\n--- Test d'intégration de recherche ---")
    query = "Dernières actualités IA mars 2026"
    # On simule un appel à generate (sans forcément attendre la réponse complète de l'IA si Ollama n'est pas lancé, 
    # mais on vérifie les logs print du backend)
    print(f"Test avec la requête : {query}")
    try:
        # On appelle une version simplifiée ou on check juste si search_web est appelé
        import web_tools
        res = web_tools.search_web(query)
        if res:
            print("SUCCESS: Des résultats web ont été récupérés.")
            print(f"Premier résultat : {res[0]['title']}")
        else:
            print("FAILURE: Aucun résultat récupéré.")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_intent()
    test_search_integration()

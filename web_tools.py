# ══════════════════════════════════════════════════════
#   NovaMind — web_tools.py
#   Module de recherche web (DuckDuckGo Search)
# ══════════════════════════════════════════════════════

from duckduckgo_search import DDGS
import json

def search_web(query, max_results=5):
    """
    Effectue une recherche sur DuckDuckGo et retourne une liste de résultats.
    """
    results = []
    try:
        print(f"[NovaMind] Recherche Web : {query}...")
        with DDGS() as ddgs:
            ddgs_results = [r for r in ddgs.text(query, max_results=max_results)]
            
            for r in ddgs_results:
                results.append({
                    'title': r.get('title', ''),
                    'href': r.get('href', ''),
                    'body': r.get('body', '')
                })
        
        print(f"[NovaMind] {len(results)} résultats trouvés.")
        return results
    except Exception as e:
        print(f"[NovaMind] Erreur recherche Web : {e}")
        return []

def format_search_results(results):
    """
    Formate les résultats de recherche pour les injecter dans le prompt de l'IA.
    """
    if not results:
        return "Aucun résultat trouvé sur le web."
    
    formatted = "Résultats de recherche Web :\n"
    for i, r in enumerate(results, 1):
        formatted += f"\n[{i}] {r['title']}\nSource: {r['href']}\nContenu: {r['body']}\n"
    
    return formatted

if __name__ == "__main__":
    # Petit test en isolation
    q = "météo Paris aujourd'hui"
    res = search_web(q)
    print(format_search_results(res))

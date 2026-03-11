# ══════════════════════════════════════════════════════
#   NovaMind — ai_engine.py
#   Moteur IA avec détection automatique du backend :
#   1. Ollama (modèle local via API HTTP)
#   2. Transformers HuggingFace (modèle local)
#   3. Réponses intelligentes pré-définies (fallback)
# ══════════════════════════════════════════════════════

import requests
import json
import random
import time
import config
import web_tools

# ─── Détection automatique du backend disponible ───
_backend_mode = None   # 'ollama' | 'transformers' | 'smart_fallback'
_hf_pipeline  = None   # Pipeline HuggingFace si disponible

def detect_backend():
    """Détecte quel backend IA est disponible et l'initialise."""
    global _backend_mode, _hf_pipeline

    print("[NovaMind] Détection du backend IA...")

    # 1. Test Ollama
    try:
        r = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=3)
        if r.status_code == 200:
            models = [m['name'] for m in r.json().get('models', [])]
            print(f"[NovaMind] ✅ Ollama détecté. Modèles disponibles: {models}")
            if models:
                # Choisit le modèle configuré ou le premier disponible
                preferred = config.OLLAMA_MODEL
                chosen = preferred if any(preferred in m for m in models) else models[0]
                config.OLLAMA_MODEL = chosen
                print(f"[NovaMind] 🧠 Modèle sélectionné: {chosen}")
            _backend_mode = 'ollama'
            return
    except Exception as e:
        print(f"[NovaMind] ⚠️  Ollama non disponible: {e}")

    # 2. Test Transformers
    try:
        from transformers import pipeline
        print(f"[NovaMind] 🔄 Chargement du modèle HuggingFace: {config.HF_MODEL} ...")
        _hf_pipeline = pipeline(
            "text-generation",
            model=config.HF_MODEL,
            max_new_tokens=config.DEFAULT_MAX_TOKENS,
            temperature=config.DEFAULT_TEMPERATURE,
        )
        _backend_mode = 'transformers'
        print("[NovaMind] ✅ Transformers chargé avec succès.")
        return
    except Exception as e:
        print(f"[NovaMind] ⚠️  Transformers non disponible: {e}")

    # 3. Fallback intelligent
    _backend_mode = 'smart_fallback'
    print("[NovaMind] 💡 Mode réponses intelligentes activé (aucun modèle local détecté).")
    print("[NovaMind]    → Installez Ollama sur https://ollama.com pour activer l'IA réelle.")


def detect_search_intent(message: str) -> bool:
    """
    Détecte si l'utilisateur demande une information qui nécessite une recherche web.
    """
    m = message.lower()
    keywords = [
        'cherche', 'recherche', 'trouve', 'météo', 'actualité', 'nouvelles', 
        'qui est', 'qu\'est-ce que', 'c\'est quoi', 'prix de', 'score', 
        'match', 'web', 'internet', 'aujourd\'hui', 'en ce moment'
    ]
    return any(k in m for k in keywords)


def get_status():
    """Retourne le statut du backend."""
    return {
        'backend': _backend_mode,
        'model': config.OLLAMA_MODEL if _backend_mode == 'ollama'
                 else config.HF_MODEL if _backend_mode == 'transformers'
                 else 'smart_fallback',
        'ready': _backend_mode is not None,
    }


# ─── GÉNÉRATION DE RÉPONSE ───────────────────────────

def generate(message: str, history: list, system_prompt: str, temperature: float) -> str:
    """Point d'entrée principal — route vers le bon backend."""
    
    # ── Détection d'intention de recherche ──
    search_context = ""
    if detect_search_intent(message):
        try:
            results = web_tools.search_web(message)
            if results:
                search_context = web_tools.format_search_results(results)
                print("[NovaMind] Contexte Web injecté.")
        except Exception as e:
            print(f"[NovaMind] Erreur lors de l'intégration de la recherche : {e}")

    # Injection du contexte web dans le system_prompt si présent
    if search_context:
        system_prompt = f"{system_prompt}\n\nINFORMATIONS RÉCENTES TROUVÉES SUR LE WEB :\n{search_context}\n\nUtilise les informations ci-dessus pour répondre avec précision."

    if _backend_mode == 'ollama':
        return _generate_ollama(message, history, system_prompt, temperature)
    elif _backend_mode == 'transformers':
        return _generate_transformers(message, history, system_prompt, temperature)
    else:
        return _generate_smart_fallback(message, history)


# ─── OLLAMA ──────────────────────────────────────────

def _generate_ollama(message: str, history: list, system_prompt: str, temperature: float) -> str:
    """Génère une réponse via l'API Ollama."""
    try:
        # Construire les messages au format Ollama
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        for h in history[-20:]:  # Limite l'historique à 20 messages
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})

        payload = {
            "model":    config.OLLAMA_MODEL,
            "messages": messages,
            "stream":   False,
            "options": {
                "temperature": temperature,
                "num_predict": config.DEFAULT_MAX_TOKENS,
            }
        }

        r = requests.post(
            f"{config.OLLAMA_URL}/api/chat",
            json=payload,
            timeout=120
        )
        r.raise_for_status()
        data = r.json()
        return data.get("message", {}).get("content", "Désolé, je n'ai pas pu générer de réponse.")

    except requests.exceptions.Timeout:
        return "⏱️ Le modèle met trop de temps à répondre. Essayez avec un modèle plus léger dans `config.py`."
    except Exception as e:
        return f"❌ Erreur Ollama : {str(e)}"


# ─── TRANSFORMERS ─────────────────────────────────────

def _generate_transformers(message: str, history: list, system_prompt: str, temperature: float) -> str:
    """Génère une réponse via HuggingFace Transformers."""
    try:
        # Construire le prompt
        prompt_parts = []
        if system_prompt:
            prompt_parts.append(f"Système: {system_prompt}")
        for h in history[-6:]:
            role_label = "Utilisateur" if h["role"] == "user" else "Assistant"
            prompt_parts.append(f"{role_label}: {h['content']}")
        prompt_parts.append(f"Utilisateur: {message}")
        prompt_parts.append("Assistant:")
        prompt = "\n".join(prompt_parts)

        result = _hf_pipeline(
            prompt,
            max_new_tokens=config.DEFAULT_MAX_TOKENS,
            temperature=temperature,
            do_sample=True,
            pad_token_id=50256,
        )
        generated = result[0]['generated_text']
        # Extraire uniquement la dernière réponse de l'assistant
        if "Assistant:" in generated:
            generated = generated.split("Assistant:")[-1].strip()
        return generated or "Je n'ai pas pu générer de réponse."

    except Exception as e:
        return f"❌ Erreur Transformers : {str(e)}"


# ─── SMART FALLBACK ───────────────────────────────────

# Corpus de réponses intelligentes par catégorie
_KNOWLEDGE = {
    "python": [
        "Python est un langage de programmation polyvalent créé par Guido van Rossum en 1991. Voici un exemple de liste triée :\n```python\nma_liste = [3, 1, 4, 1, 5, 9]\nma_liste.sort()\nprint(ma_liste)  # [1, 1, 3, 4, 5, 9]\n```",
        "Pour créer une fonction en Python :\n```python\ndef saluer(nom):\n    return f\"Bonjour, {nom} !\"\n\nprint(saluer(\"NovaMind\"))  # Bonjour, NovaMind !\n```",
    ],
    "ia": [
        "Un **réseau de neurones artificiels** est inspiré du cerveau humain. Il est composé de couches de neurones connectés :\n- **Couche d'entrée** : reçoit les données\n- **Couches cachées** : transforment les données\n- **Couche de sortie** : produit le résultat\n\nL'apprentissage se fait par **rétropropagation** : on ajuste les poids pour minimiser l'erreur.",
        "Le **Machine Learning** comprend 3 grandes familles :\n1. **Supervisé** : exemples étiquetés (classification, régression)\n2. **Non supervisé** : clustering, réduction de dimension\n3. **Par renforcement** : l'agent apprend par essais/erreurs\n\nDeep Learning = ML avec réseaux de neurones profonds.",
    ],
    "code": [
        "Je peux vous aider avec du code ! Précisez le langage et ce que vous souhaitez faire (algorithme, script, analyse de données...) et je vous fournirai un exemple commenté.",
        "Voici les bonnes pratiques de développement :\n- **Nommage clair** des variables et fonctions\n- **Commentaires** pour le code complexe\n- **Tests unitaires** pour valider le comportement\n- **Git** pour le versionnage",
    ],
    "default": [
        "C'est une excellente question ! En tant qu'IA locale (mode hors-ligne), je peux vous aider sur des sujets comme **Python**, **l'intelligence artificielle**, **le code**, et **les mathématiques**.\n\nPour des réponses plus précises et contextuelles, activez **Ollama** dans les paramètres ⚙️ et installez un modèle sur https://ollama.com",
        "Je comprends votre question. Pour vous donner la meilleure réponse possible, j'aurais besoin d'un vrai modèle de langage. Installez **Ollama** (`ollama pull mistral`) pour transformer NovaMind en IA pleinement fonctionnelle !",
        "Bonne question ! Pour répondre avec précision, je dois avoir accès à un modèle IA local. Vous pouvez :\n1. Installer **Ollama** sur https://ollama.com\n2. Lancer `ollama pull mistral` dans un terminal\n3. Relancer `main.py`\n\nEt NovaMind répondra avec toute son intelligence !",
    ]
}

def _generate_smart_fallback(message: str, history: list) -> str:
    """Réponses intelligentes contextuelles sans modèle IA."""
    msg_lower = message.lower()

    # Détection du thème
    if any(k in msg_lower for k in ['python', 'script', 'code', 'programme', 'fonction', 'variable']):
        category = 'python'
    elif any(k in msg_lower for k in ['ia', 'intelligence', 'neurone', 'machine learning', 'deep learning', 'transformer', 'gpt', 'llm']):
        category = 'ia'
    elif any(k in msg_lower for k in ['développement', 'git', 'bug', 'erreur', 'debug', 'algorithme']):
        category = 'code'
    else:
        category = 'default'

    replies = _KNOWLEDGE.get(category, _KNOWLEDGE['default'])

    # Éviter de répéter la même réponse
    seed = len(history) + hash(message[:20]) % len(replies)
    return replies[seed % len(replies)]

# ══════════════════════════════════════════
#   NovaMind — config.py
# ══════════════════════════════════════════

# Nom du modèle Ollama à utiliser (ex: mistral, llama3.2, phi3, tinyllama)
OLLAMA_MODEL = "mistral"
# Version
VERSION = "1.0.2"

# URL du serveur Ollama (par défaut local)
OLLAMA_URL = "http://localhost:11434"

# Modèle HuggingFace (fallback si Ollama absent)
HF_MODEL = "microsoft/phi-2"

# Paramètres de génération par défaut
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS  = 512
DEFAULT_SYSTEM      = "Tu es NovaMind, une intelligence artificielle locale, intelligente et amicale. Tu réponds toujours en français, de façon claire, concise et utile."

# Port Flask
PORT = 5000
DEBUG = False

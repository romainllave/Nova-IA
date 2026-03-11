/* ══════════════════════════════════════
   NovaMind — app.js  (v2 Brain Layout)
══════════════════════════════════════ */

// ─── CONFIG ───
const CFG = {
  backend:    localStorage.getItem('nm_backend')     || 'local',
  serverUrl:  localStorage.getItem('nm_serverUrl')   || 'http://localhost:5000',
  aiName:     localStorage.getItem('nm_aiName')      || 'NovaMind',
  sysPrompt:  localStorage.getItem('nm_sysPrompt')   || 'Tu es NovaMind, une IA locale, intelligente et amicale. Réponds toujours en français.',
  temperature:parseFloat(localStorage.getItem('nm_temperature') || '0.7'),
};

// ─── DEMO RESPONSES ───
const DEMO_REPLIES = [
  "Je tourne en **mode démo** — sans backend connecté. Pour me donner un vrai cerveau, configurez Flask dans ⚙️ Paramètres.",
  "Excellente question ! Mais je n'ai pas de modèle de langage connecté pour l'instant. Lancez `main.py` puis actualisez la page.",
  "En mode démo, j'invente mes réponses 😅 Pour une vraie IA, connectez un backend Flask sur `http://localhost:5000`.",
  "Comme vous pouvez le voir à gauche, mon cerveau réfléchit ! Mais en ce moment il est en mode démo sans vrai raisonnement.",
];

// ─── STATE ───
let convs      = JSON.parse(localStorage.getItem('nm_convs') || '[]');
let currentId  = null;
let isThinking = false;
let demoIdx    = 0;
let totalMsgs  = 0;
let totalTokens= 0;
let thinkTimer = null;

// ─── VOICE / TTS STATE ───
let isVoiceActive = localStorage.getItem('nm_voice_active') !== 'false';
let isVoiceMuted  = localStorage.getItem('nm_voice_muted') === 'true';
let synth = window.speechSynthesis;
let currentUtterance = null;

// ─── COMPANION MODE (STT) STATE ───
let isCompanionActive = false;
let recognition = null;
let silenceTimer = null;
let speechStartTimeout = null;

// ─── DOM ───
const $ = id => document.getElementById(id);
const brainPanel    = $('brainPanel');
const brain3DContainer = $('brain3DContainer');
const thoughtTokens = $('thoughtTokens');
const statusDot     = $('statusDot');
const statusText    = $('statusText');
const welcomeScreen = $('welcomeScreen');
const messagesArea  = $('messagesArea');
const messagesList  = $('messagesList');
const msgInput      = $('msgInput');
const sendBtn       = $('sendBtn');
const charCnt       = $('charCnt');
const settingsBtn   = $('settingsBtn');
const settingsModal = $('settingsModal');
const closeSettingsBtn=$('closeSettingsBtn');
const themeBtn      = $('themeBtn');
const backendSel    = $('backendSel');
const serverUrlInput= $('serverUrlInput');
const aiNameInput   = $('aiNameInput');
const sysPromptInput= $('sysPromptInput');
const tempRange     = $('tempRange');
const tempDisplay   = $('tempDisplay');
const voiceToggleInput = $('voiceToggleInput');
const voiceMuteBtn  = $('voiceMuteBtn');
const compBtn       = $('compBtn');
const voiceStatus   = $('voiceStatus');
const voiceStatusText = $('voiceStatusText');
const saveSettingsBtn=$('saveSettingsBtn');
const statMessages  = $('statMessages');
const statTokens    = $('statTokens');
const statTemp      = $('statTemp');

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
function init() {
  // Migration mode démo vers local si nécessaire
  if (localStorage.getItem('nm_backend') === 'demo') {
    localStorage.setItem('nm_backend', 'local');
    CFG.backend = 'local';
  }
  
  applyConfig();
  initBrain3D();
  renderConvs();
  checkTheme();
  setupEvents();
  initParticles();
  if (convs.length > 0) loadConv(convs[0].id);
  updateStats();
  checkUpdate();
}

function applyConfig() {
  backendSel.value    = CFG.backend;
  serverUrlInput.value= CFG.serverUrl;
  aiNameInput.value   = CFG.aiName;
  sysPromptInput.value= CFG.sysPrompt;
  tempRange.value     = CFG.temperature;
  tempDisplay.textContent = CFG.temperature;
  statTemp.textContent    = CFG.temperature;
  
  if (voiceToggleInput) voiceToggleInput.checked = isVoiceActive;
  updateVoiceUI();
}

function updateVoiceUI() {
  if (voiceMuteBtn) {
    voiceMuteBtn.classList.toggle('muted', isVoiceMuted);
  }
}

// ════════════════════════════════════════════
// PARTICLES (background canvas)
// ════════════════════════════════════════════
function initParticles() {
  const canvas = $('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let pts      = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    pts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .3,
      vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.5 + .5,
      a: Math.random(),
    });
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(167,139,250,${p.a * .4})`;
      ctx.fill();
    }
    // Draw connections
    for (let i = 0; i < pts.length; i++) {
      for (let j = i+1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(167,139,250,${(.12 * (1 - d/120))})`;
          ctx.lineWidth = .5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
}

// ════════════════════════════════════════════
// THREE.JS 3D BRAIN (Animated Constellation / Plexus)
// ════════════════════════════════════════════
let brainScene, brainCamera, brainRenderer;
let brainGroup, particlesData = [], particleMesh, linesMesh;
let isBrainThinking3D = false;

// Settings
const particleCount = 120; // "plusieurs mais pas trop"
const r = 5.5; // Rayon de la sphère
const maxConnectionDistance = 2.2;

function initBrain3D() {
  if (!brain3DContainer) return;

  const w = brain3DContainer.clientWidth || 300;
  const h = brain3DContainer.clientHeight || 260;

  brainScene = new THREE.Scene();
  brainCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  brainCamera.position.z = 18;

  brainRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  brainRenderer.setSize(w, h);
  brainRenderer.setPixelRatio(window.devicePixelRatio);
  brain3DContainer.appendChild(brainRenderer.domElement);

  brainGroup = new THREE.Group();
  brainScene.add(brainGroup);

  // 1. Les Points (Neurones)
  const pMaterial = new THREE.PointsMaterial({
    color: 0x38bdf8, // Cyan
    size: 0.25,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });

  const positions = new Float32Array(particleCount * 3);
  const pGeometry = new THREE.BufferGeometry();

  for (let i = 0; i < particleCount; i++) {
    // Coordonnées aléatoires dans une sphère
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const radius = Math.cbrt(Math.random()) * r;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Données pour l'animation des lignes
    particlesData.push({
      offset: Math.random() * 1000 // Décalage aléatoire pour le scintillement
    });
  }

  pGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleMesh = new THREE.Points(pGeometry, pMaterial);
  brainGroup.add(particleMesh);

  // 2. Les Lignes (Connexions/Synapses animées)
  // Nombre maximum de lignes possibles = n*(n-1)/2
  const segments = particleCount * particleCount;
  const positionsL = new Float32Array(segments * 3);
  const colorsL = new Float32Array(segments * 3);

  const lGeometry = new THREE.BufferGeometry();
  lGeometry.setAttribute('position', new THREE.BufferAttribute(positionsL, 3).setUsage(THREE.DynamicDrawUsage));
  lGeometry.setAttribute('color', new THREE.BufferAttribute(colorsL, 3).setUsage(THREE.DynamicDrawUsage));

  const lMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });

  linesMesh = new THREE.LineSegments(lGeometry, lMaterial);
  brainGroup.add(linesMesh);

  window.addEventListener('resize', () => {
    if (!brain3DContainer) return;
    const nw = brain3DContainer.clientWidth;
    const nh = brain3DContainer.clientHeight;
    if (nw === 0 || nh === 0) return;
    brainRenderer.setSize(nw, nh);
    brainCamera.aspect = nw / nh;
    brainCamera.updateProjectionMatrix();
  });

  animateBrain3D();
}

function animateBrain3D() {
  requestAnimationFrame(animateBrain3D);
  const time = Date.now() * 0.001;

  if (brainGroup) {
    // Rotation lente de l'ensemble
    brainGroup.rotation.y += isBrainThinking3D ? 0.012 : 0.003;
    brainGroup.rotation.x += isBrainThinking3D ? 0.006 : 0.001;

    const pPositions = particleMesh.geometry.attributes.position.array;
    const lPositions = linesMesh.geometry.attributes.position.array;
    const lColors = linesMesh.geometry.attributes.color.array;

    let vertexpos = 0;
    let colorpos = 0;
    let numConnected = 0;

    // Couleurs de base
    const baseR = 0.2, baseG = 0.1, baseB = 0.6;
    const thinkR = 0.9, thinkG = 0.2, thinkB = 0.9;

    if(isBrainThinking3D) particleMesh.material.color.setHex(0xe879f9);
    else particleMesh.material.color.setHex(0x38bdf8);

    // Les points sont fixes, on recalcule juste les couleurs des lignes pour l'effet électrique
    for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
            const dx = pPositions[i * 3]     - pPositions[j * 3];
            const dy = pPositions[i * 3 + 1] - pPositions[j * 3 + 1];
            const dz = pPositions[i * 3 + 2] - pPositions[j * 3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < maxConnectionDistance) {
                // Effet électrique : scintillement basé sur le temps
                const speed = isBrainThinking3D ? 10.0 : 2.5;
                const pulse = Math.sin(time * speed + (i + j)) * 0.5 + 0.5;
                
                // Transparence de base selon distance
                const distAlpha = 1.0 - (dist / maxConnectionDistance);
                const alpha = distAlpha * (0.2 + pulse * 0.8);

                lPositions[vertexpos++] = pPositions[i * 3];
                lPositions[vertexpos++] = pPositions[i * 3 + 1];
                lPositions[vertexpos++] = pPositions[i * 3 + 2];
                lPositions[vertexpos++] = pPositions[j * 3];
                lPositions[vertexpos++] = pPositions[j * 3 + 1];
                lPositions[vertexpos++] = pPositions[j * 3 + 2];

                const r = isBrainThinking3D ? thinkR : baseR;
                const g = isBrainThinking3D ? thinkG : baseG;
                const b = isBrainThinking3D ? thinkB : baseB;

                lColors[colorpos++] = r * alpha;
                lColors[colorpos++] = g * alpha;
                lColors[colorpos++] = b * alpha;
                lColors[colorpos++] = r * alpha;
                lColors[colorpos++] = g * alpha;
                lColors[colorpos++] = b * alpha;

                numConnected++;
            }
        }
    }

    linesMesh.geometry.setDrawRange(0, numConnected * 2);
    linesMesh.geometry.attributes.position.needsUpdate = true;
    linesMesh.geometry.attributes.color.needsUpdate = true;
  }

  brainRenderer.render(brainScene, brainCamera);
}

// ════════════════════════════════════════════
// BRAIN STATE MACHINE
// ════════════════════════════════════════════
function setBrainThinking(on) {
  isBrainThinking3D = on;
  const bv = $('brainVisual');
  
  if (on) {
    if (bv) bv.classList.add('thinking');
    statusDot.className = 'status-dot thinking';
    statusText.textContent = CFG.aiName + ' réfléchit…';
  } else {
    if (bv) bv.classList.remove('thinking');
    statusDot.className = 'status-dot';
    statusText.textContent = 'Prêt';
  }
}

// ════════════════════════════════════════════
// THOUGHT STREAM (ticker)
// ════════════════════════════════════════════
let tickerInterval = null;

function startThoughtTicker(fullText) {
  thoughtTokens.innerHTML = '<span class="token-stream"></span><span class="cursor-blink"></span>';
  const stream = thoughtTokens.querySelector('.token-stream');
  let idx = 0;
  tickerInterval = setInterval(() => {
    if (idx >= fullText.length) {
      clearInterval(tickerInterval);
      return;
    }
    const chunk = fullText.slice(idx, idx + 3);
    for (const ch of chunk) {
      const sp = document.createElement('span');
      sp.textContent = ch;
      stream.appendChild(sp);
    }
    idx += 3;
    thoughtTokens.scrollTop = thoughtTokens.scrollHeight;
  }, 60);
}

function stopThoughtTicker(finalText) {
  clearInterval(tickerInterval);
  thoughtTokens.innerHTML = '';
  const p = document.createElement('p');
  p.style.cssText = 'font-size:.75rem;color:var(--c-text2);line-height:1.5;font-family:JetBrains Mono,monospace';
  p.textContent = finalText.slice(0,180) + (finalText.length > 180 ? '…' : '');
  thoughtTokens.appendChild(p);
}

function resetThoughtStream() {
  thoughtTokens.innerHTML = '<span class="thought-placeholder">En attente...</span>';
}

// ════════════════════════════════════════════
// CONVERSATIONS
// ════════════════════════════════════════════
function newConv() {
  const id = Date.now().toString();
  convs.unshift({ id, title:'Nouvelle conversation', date:today(), messages:[] });
  saveConvs();
  renderConvs();
  loadConv(id);
}

function today() {
  return new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}

function saveConvs() { localStorage.setItem('nm_convs', JSON.stringify(convs)); }

function getConv(id) { return convs.find(c => c.id === id); }

function loadConv(id) {
  currentId = id;
  const cv  = getConv(id);
  if (!cv) return;

  document.querySelectorAll('.conv-item').forEach(e => e.classList.toggle('active', e.dataset.id === id));
  messagesList.innerHTML = '';

  if (cv.messages.length === 0) {
    welcomeScreen.style.display = 'flex';
    messagesArea.style.display  = 'none';
  } else {
    welcomeScreen.style.display = 'none';
    messagesArea.style.display  = 'flex';
    cv.messages.forEach(m => renderMsg(m.role, m.content, m.time, false));
    scrollBottom();
  }
  resetThoughtStream();
}

function renderConvs() {
  // sidebar removed — nothing to render
}

// ════════════════════════════════════════════
// MESSAGES
// ════════════════════════════════════════════
function renderMsg(role, content, time, animate=true) {
  welcomeScreen.style.display = 'none';
  messagesArea.style.display  = 'flex';

  const t   = time || now();
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (!animate) div.style.animation = 'none';

  const av = role === 'user'
    ? `<div class="msg-av">R</div>`
    : `<div class="msg-av"><svg viewBox="0 0 32 32" fill="none"><path d="M10 16 Q16 6 22 16 Q16 26 10 16Z" fill="url(#mg2)"/><circle cx="16" cy="16" r="3" fill="#a78bfa"/>
        <defs><linearGradient id="mg2" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs></svg></div>`;

  div.innerHTML = `${av}<div class="msg-wrap"><div class="msg-bub">${fmt(content)}</div><span class="msg-time">${t}</span></div>`;
  messagesList.appendChild(div);
  scrollBottom();
}

function showTyping() {
  const d = document.createElement('div');
  d.className = 'msg ai'; d.id = 'typingBub';
  d.innerHTML = `<div class="msg-av"><svg viewBox="0 0 32 32" fill="none"><path d="M10 16 Q16 6 22 16 Q16 26 10 16Z" fill="#a78bfa"/></svg></div>
    <div class="msg-wrap"><div class="msg-bub"><div class="typing-bub"><div class="td"></div><div class="td"></div><div class="td"></div></div></div></div>`;
  messagesList.appendChild(d);
  scrollBottom();
}

function removeTyping() { const e = $('typingBub'); if(e) e.remove(); }

function scrollBottom() { messagesArea.scrollTop = messagesArea.scrollHeight; }

function addToConv(role, content) {
  const cv = getConv(currentId);
  if (!cv) return;
  const t = now();
  cv.messages.push({ role, content, time:t });
  if (role === 'user' && cv.title === 'Nouvelle conversation') {
    cv.title = content.slice(0,42) + (content.length>42?'…':'');
  }
  saveConvs();
  renderConvs();
  return t;
}

// ════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════
async function sendMessage(text) {
  if (isThinking || !text.trim()) return;
  if (!currentId) newConv();

  isThinking = true;
  sendBtn.disabled = true;
  const txt = text.trim();
  msgInput.value = '';
  autoResize();
  charCnt.textContent = '0/4000';

  renderMsg('user', txt);
  addToConv('user', txt);
  totalMsgs++;

  showTyping();
  setBrainThinking(true);

  // Start fake thought stream immediately
  const thoughts = generateThoughtStream(txt);
  startThoughtTicker(thoughts);

  try {
    let reply;
    if (CFG.backend === 'demo') {
      reply = await demoReply(txt);
    } else {
      reply = await fetchBackend(txt);
    }

    removeTyping();
    setBrainThinking(false);
    stopThoughtTicker(reply);

    renderMsg('ai', reply);
    addToConv('ai', reply);
    
    // Vocalise la réponse
    speak(reply);

    totalMsgs++;
    totalTokens += Math.ceil(reply.length / 4);
    updateStats();

  } catch (err) {
    removeTyping();
    setBrainThinking(false);
    resetThoughtStream();
    const errMsg = `⚠️ Erreur : **${err.message}**\n\nVérifiez que le serveur Flask tourne sur \`${CFG.serverUrl}\``;
    renderMsg('ai', errMsg);
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Erreur de connexion';
  }

  isThinking = false;
  sendBtn.disabled = msgInput.value.trim() === '';
}

function generateThoughtStream(userMsg) {
  const m = userMsg.toLowerCase();
  const needsWeb = /cherche|recherche|trouve|météo|actualité|nouvelles|qui est|qu'est-ce que|c'est quoi|prix de|score|match|web|internet|aujourd'hui|en ce moment/i.test(m);
  
  const searchStep = needsWeb ? "Connexion au Web...\nNavigation sur DuckDuckGo...\nExtraction des données pertinentes...\n" : "";

  const templates = [
    `${searchStep}Analyse de la requête: "${userMsg.slice(0,40)}"\nIdentification du contexte...\nRecherche de patterns pertinents...\nConstruction de la réponse optimale...\nVérification de cohérence...\nGénération du texte final...`,
    `${searchStep}Tokenisation: [${userMsg.slice(0,30).split(' ').join('] [')}]\nAttention: calcul des embeddings...\nCouches transformer: 1/12 ... 12/12\nDécodage greedy avec température ${CFG.temperature}\nPost-traitement de la sortie...`,
    `${searchStep}Question reçue.\nAnalyse sémantique en cours...\nContexte conversationnel chargé.\nFormulation de la réponse...\nOptimisation lexicale...\nSortie prête.`,
  ];
  return templates[Math.floor(Math.random()*templates.length)];
}

async function demoReply(msg) {
  await sleep(1200 + Math.random()*1000);
  const r = DEMO_REPLIES[demoIdx % DEMO_REPLIES.length];
  demoIdx++;
  return r;
}

async function fetchBackend(text) {
  const cv = getConv(currentId);
  const context = cv ? cv.messages.map(m => ({ role: m.role, content: m.content })) : [];
  
  // Mode Compagnon : ajoute une consigne d'oralité
  let finalSysPrompt = CFG.sysPrompt;
  if (isCompanionActive) {
    finalSysPrompt += "\nMISSION CRUCIALE : Tu es en mode CONVERSATION ORALE. Réponds de façon TRES COURTE, naturelle et directe (max 2-3 phrases). Évite les listes et le markdown complexe. Parle comme une personne réelle dans une discussion courante.";
  }

  const res = await fetch(`${CFG.serverUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      history: context,
      system_prompt: finalSysPrompt,
      temperature:   CFG.temperature
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(()=>({error:`HTTP ${res.status}`}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.response || data.message || '…';
}

// ════════════════════════════════════════════
// VOICE / TTS
// ════════════════════════════════════════════
function speak(text) {
  if (!isVoiceActive || isVoiceMuted || !synth) return;

  // Stoppe la lecture en cours
  if (synth.speaking) {
    synth.cancel();
  }

  // Nettoie le texte du markdown pour une meilleure lecture
  const cleanText = text.replace(/```[\s\S]*?```/g, 'Code source masqué.')
                        .replace(/`([^`]+)`/g, '$1')
                        .replace(/\*\*(.+?)\*\*/g, '$1')
                        .replace(/\*(.+?)\*/g, '$1')
                        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = 'fr-FR';
  
  // Essaye de trouver une voix française naturelle
  const voices = synth.getVoices();
  const frVoice = voices.find(v => v.lang.startsWith('fr') && v.name.includes('Google')) || 
                  voices.find(v => v.lang.startsWith('fr'));
  if (frVoice) utter.voice = frVoice;

  utter.pitch = 1.0;
  utter.rate  = 1.0;
  
  currentUtterance = utter;
  
  utter.onend = () => {
    currentUtterance = null;
    // Si mode compagnon actif, on relance l'écoute après avoir parlé
    if (isCompanionActive) {
      setTimeout(startListening, 300);
    }
  };

  synth.speak(utter);
}

function toggleVoiceMute() {
  isVoiceMuted = !isVoiceMuted;
  localStorage.setItem('nm_voice_muted', isVoiceMuted);
  if (isVoiceMuted && synth.speaking) {
    synth.cancel();
  }
  updateVoiceUI();
}

// ════════════════════════════════════════════
// COMPANION MODE (STT)
// ════════════════════════════════════════════
function initSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("Speech Recognition non supporté sur ce navigateur.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    if (voiceStatus) voiceStatus.classList.add('active');
    if (voiceStatusText) voiceStatusText.textContent = "Nova vous écoute...";
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    
    if (final) {
      msgInput.value = final;
      recognition.stop();
      sendMessage();
    }
  };

  recognition.onend = () => {
    if (voiceStatus) voiceStatus.classList.remove('active');
    // On ne relance pas ici, c'est speak() ou toggle qui gère
  };

  recognition.onerror = (e) => {
    console.error("STT Error:", e.error);
    if (isCompanionActive) {
      // Relance si erreur de silence
      if (e.error === 'no-speech') {
        setTimeout(startListening, 500);
      } else {
        toggleCompanionMode(); // Off si erreur grave
      }
    }
  };
}

function toggleCompanionMode() {
  if (!recognition) initSTT();
  isCompanionActive = !isCompanionActive;
  
  compBtn.classList.toggle('active', isCompanionActive);
  
  if (isCompanionActive) {
    // Force la voix
    isVoiceActive = true;
    localStorage.setItem('nm_voice_active', true);
    if (voiceToggleInput) voiceToggleInput.checked = true;
    
    startListening();
  } else {
    if (recognition) recognition.stop();
    if (synth.speaking) synth.cancel();
  }
}

function startListening() {
  if (!isCompanionActive || !recognition) return;
  try {
    recognition.start();
  } catch(e) { /* Déjà démarré */ }
}

// ════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════
function updateStats() {
  statMessages.textContent = totalMsgs;
  statTokens.textContent   = totalTokens;
  statTemp.textContent     = CFG.temperature;
  if ($('statVersion')) $('statVersion').textContent = `v${CFG.version || '1.0.1'}`;
}

// ─── UPDATE CHECK ───
async function checkUpdate() {
  try {
    const res = await fetch(`${CFG.serverUrl}/update_status`);
    if (!res.ok) return;
    const data = await res.json();
    
    CFG.version = data.version;
    updateStats();

    if (data.updated) {
      const banner = $('updateBanner');
      const verSpan = $('updateVersion');
      const closeBtn = $('closeUpdateBtn');
      
      if (banner && verSpan) {
        verSpan.textContent = data.version;
        banner.classList.remove('hidden');
        
        if (closeBtn) {
          closeBtn.onclick = () => {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-20px)';
            setTimeout(() => banner.classList.add('hidden'), 300);
          };
        }
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
          if (!banner.classList.contains('hidden')) closeBtn.click();
        }, 10000);
      }
    }
  } catch (err) {
    console.error("Erreur lors de la vérification de mise à jour:", err);
  }
}

// ════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════
function checkTheme() {
  if (localStorage.getItem('nm_theme') === 'light') document.body.classList.add('light');
}
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('nm_theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

// ════════════════════════════════════════════
// TEXTAREA AUTO-RESIZE
// ════════════════════════════════════════════
function autoResize() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 160) + 'px';
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function now() { return new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(text) {
  let h = esc(text);
  h = h.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');
  h = h.replace(/`([^`]+)`/g,'<code>$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h = h.replace(/\n/g,'<br/>');
  return h;
}

// ════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════
function setupEvents() {
  themeBtn.onclick = toggleTheme;
  voiceMuteBtn.onclick = toggleVoiceMute;
  compBtn.onclick = toggleCompanionMode;

  msgInput.addEventListener('input', () => {
    autoResize();
    const len = msgInput.value.length;
    charCnt.textContent = `${len}/4000`;
    sendBtn.disabled = len === 0 || isThinking;
  });
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage(msgInput.value); }
  });
  sendBtn.onclick = () => sendMessage(msgInput.value);

  document.querySelectorAll('.sugg-card').forEach(card => {
    card.onclick = () => {
      if (!currentId) newConv();
      sendMessage(card.dataset.prompt);
    };
  });

  settingsBtn.onclick = () => settingsModal.classList.add('open');
  closeSettingsBtn.onclick = () => settingsModal.classList.remove('open');
  settingsModal.onclick = e => { if(e.target===settingsModal) settingsModal.classList.remove('open'); };

  tempRange.oninput = () => tempDisplay.textContent = tempRange.value;

  saveSettingsBtn.onclick = () => {
    CFG.backend     = backendSel.value;
    CFG.serverUrl   = serverUrlInput.value.trim();
    CFG.aiName      = aiNameInput.value.trim() || 'NovaMind';
    CFG.sysPrompt   = sysPromptInput.value.trim();
    CFG.temperature = parseFloat(tempRange.value);
    localStorage.setItem('nm_backend',    CFG.backend);
    localStorage.setItem('nm_serverUrl',  CFG.serverUrl);
    localStorage.setItem('nm_aiName',     CFG.aiName);
    localStorage.setItem('nm_sysPrompt',  CFG.sysPrompt);
    localStorage.setItem('nm_temperature',CFG.temperature);
    
    isVoiceActive = voiceToggleInput.checked;
    localStorage.setItem('nm_voice_active', isVoiceActive);

    updateStats();
    settingsModal.classList.remove('open');
    saveSettingsBtn.textContent = '✅ Sauvegardé !';
    setTimeout(()=>{ saveSettingsBtn.textContent='💾 Sauvegarder'; },2000);
  };
}

// ════════════════════════════════════════════
// PWA — Service Worker
// ════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    console.log('[NovaMind] Service Worker enregistré');
  }).catch(err => console.warn('[NovaMind] SW échec:', err));
}

// ── START ──
init();

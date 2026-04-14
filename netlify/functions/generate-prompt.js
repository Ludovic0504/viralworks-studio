/**
 * Fonction Netlify pour la génération de prompts vidéo via l'API OpenAI GPT
 * Cette fonction sécurise l'appel API en gardant la clé API côté serveur
 *
 * Limites alignées avec src/bibliotheque/promptGenerationLimits.ts
 */
const PROMPT_GEN_MAX_IDEA_CHARS = 5000;
const PROMPT_GEN_MAX_OUTPUT_CHARS = 1500;
const PROMPT_GEN_MAX_COMPLETION_TOKENS = 480;

exports.handler = async (event) => {
  // Vérifier que c'est une requête POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
    };
  }

  // Gérer les requêtes OPTIONS pour CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    // Récupérer la clé API depuis les variables d'environnement
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('Clé API manquante dans les variables d\'environnement');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Configuration serveur manquante. Veuillez contacter l\'administrateur.' 
        }),
      };
    }

    // Parser le corps de la requête
    const body = JSON.parse(event.body || '{}');
    const { idea, model = 'veo3', format, duration, style, camera, lighting, environment, tone } = body;

    // Validation des paramètres
    const ideaTrim = typeof idea === 'string' ? idea.trim() : '';
    if (!ideaTrim || ideaTrim.length < 8) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'L\'idée est requise et doit contenir au moins 8 caractères.' 
        }),
      };
    }
    if (ideaTrim.length > PROMPT_GEN_MAX_IDEA_CHARS) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Texte trop long (max ${PROMPT_GEN_MAX_IDEA_CHARS} caractères).`,
        }),
      };
    }

    const themeGuard = `
CONTRAINTES DE PÉRIMÈTRE ET DE LONGUEUR (obligatoires) :
- Base-toi UNIQUEMENT sur l'idée utilisateur fournie. N'invente pas de nouveau sujet principal, marque, lieu ou intrigue non suggérés par cette idée.
- Une seule scène cohérente avec l'idée. Pas de suite, pas de version alternative, pas de scènes bonus.
- Pas de préambule, pas de conseils au créateur, pas de hashtags, pas de JSON, pas de markdown hors des balises demandées.
- PLAFOND STRICT : la réponse ENTIÈRE (toutes sections) ne doit PAS dépasser 1500 caractères.
- Alignement style Sora :
  * [SCENE] = sujet + action visible + contexte lieu/ambiance.
  * [SETTINGS] = contraintes techniques (format, durée, style, qualité, caméra).
  * [VIDEO_PROMPT] = mise en scène filmique (mouvement caméra, lumière, look, mood), en phrases courtes.
- Si tu risques de dépasser, raccourcis les phrases plutôt que d'ajouter du contenu hors sujet.`;

    // Définir le prompt système selon le modèle
    const systemPrompts = {
      veo3: `Tu es un expert en création de prompts vidéo pour VEO3 (Google). 
Tu génères des prompts structurés en sections [SCENE], [SETTINGS], et [VIDEO_PROMPT].
Le format doit être précis, cinématique, avec des détails visuels et techniques.
Inclus les paramètres Format et Duration dans [SETTINGS] si fournis.
IMPORTANT : N'utilise JAMAIS de points d'exclamation (!) ni de points d'interrogation (?) dans le prompt généré.
Utilise uniquement des phrases déclaratives.
Réponds UNIQUEMENT avec le prompt structuré, sans commentaires supplémentaires.
${themeGuard}`,

      sora2: `Tu es un expert en création de prompts vidéo pour Sora2 (OpenAI). 
Tu génères des prompts structurés en sections [SCENE], [SETTINGS], et [VIDEO_PROMPT].
Le format doit être détaillé, avec des descriptions visuelles riches et des paramètres techniques.
Inclus les paramètres Format et Duration dans [SETTINGS] si fournis.
IMPORTANT : N'utilise JAMAIS de points d'exclamation (!) ni de points d'interrogation (?) dans le prompt généré.
Utilise uniquement des phrases déclaratives.
Réponds UNIQUEMENT avec le prompt structuré, sans commentaires supplémentaires.
${themeGuard}`,

      hailuo: `Tu es un expert en création de prompts vidéo pour Hailuo (MiniMax).
Tu génères des prompts structurés en sections [SCENE], [SETTINGS], et [VIDEO_PROMPT].
Le format doit être compact, précis et orienté rendu cinématique.
Inclus les paramètres Format et Duration dans [SETTINGS] si fournis.
IMPORTANT : N'utilise JAMAIS de points d'exclamation (!) ni de points d'interrogation (?) dans le prompt généré.
Utilise uniquement des phrases déclaratives.
Réponds UNIQUEMENT avec le prompt structuré, sans commentaires supplémentaires.
${themeGuard}`
    };

    // Construire le prompt utilisateur avec les paramètres spécifiques
    let settingsInfo = '';
    if (format || duration || style || camera || lighting || environment || tone) {
      settingsInfo = '\n\nParamètres spécifiques à inclure :';
      if (format) settingsInfo += `\n- Format: ${format}`;
      if (duration) settingsInfo += `\n- Duration: ${duration}`;
      if (style) settingsInfo += `\n- Style: ${style}`;
      if (camera) settingsInfo += `\n- Camera: ${camera}`;
      if (lighting) settingsInfo += `\n- Lighting: ${lighting}`;
      if (environment) settingsInfo += `\n- Environment: ${environment}`;
      if (tone) settingsInfo += `\n- Tone: ${tone}`;
    }

    // Instructions pour [SCENE]
    let sceneInstructions = "Décris en priorité le sujet, l'action visible immédiate, et le contexte du lieu en 1-2 phrases courtes.";
    if (environment) sceneInstructions += ` L'environnement doit être : ${environment}.`;
    if (tone) sceneInstructions += ` Le ton doit être : ${tone}.`;

    // Instructions pour [SETTINGS]
    let settingsList = [];
    if (format) settingsList.push(`Format: ${format}`);
    if (duration) settingsList.push(`Duration: ${duration}`);
    if (style) settingsList.push(`Style: ${style}`);
    settingsList.push('Quality: Professionnelle');
    if (camera) settingsList.push(`Camera: ${camera}`);
    const settingsString = settingsList.length > 0 ? settingsList.join(', ') : 'Format, Duration, Style, Quality, Camera';

    // Instructions pour [VIDEO_PROMPT]
    let videoPromptInstructions =
      "Décris la mise en scène de façon compacte: mouvement caméra, lumière, style visuel, ambiance; 2-3 phrases courtes maximum.";
    if (lighting) videoPromptInstructions += ` L'éclairage doit être : ${lighting}.`;
    if (camera) videoPromptInstructions += ` La caméra doit utiliser : ${camera}.`;

    const userPrompt = `Crée un prompt vidéo détaillé basé sur cette idée :
"${ideaTrim}"${settingsInfo}

Génère un prompt structuré avec :
- [SCENE] : ${sceneInstructions}
- [SETTINGS] : Paramètres techniques (${settingsString})
- [VIDEO_PROMPT] : ${videoPromptInstructions}

Reste strictement fidèle à l'idée ci-dessus (pas d'éléments non implicites). Priorité à la clarté visuelle et à la concision.
N'utilise JAMAIS de points d'exclamation (!) ni de points d'interrogation (?) dans ta réponse.`;

    // Appel à l'API OpenAI GPT
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modèle rapide et économique
        messages: [
          {
            role: 'system',
            content: systemPrompts[model] || systemPrompts.veo3,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.52,
        max_tokens: PROMPT_GEN_MAX_COMPLETION_TOKENS,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur API OpenAI:', response.status, errorText);
      throw new Error(`Erreur API OpenAI: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      throw new Error('Aucun prompt généré par l\'API');
    }

    let clipped = false;
    generatedPrompt = generatedPrompt.trim();
    if (generatedPrompt.length > PROMPT_GEN_MAX_OUTPUT_CHARS) {
      generatedPrompt =
        generatedPrompt.slice(0, PROMPT_GEN_MAX_OUTPUT_CHARS).trimEnd() +
        '\n\n[… tronqué à la limite serveur …]';
      clipped = true;
    }

    // Retourner le prompt généré
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        prompt: generatedPrompt,
        model: model,
        sections: {
          scene: extractSection(generatedPrompt, 'SCENE'),
          settings: extractSection(generatedPrompt, 'SETTINGS'),
          video_prompt: extractSection(generatedPrompt, 'VIDEO_PROMPT'),
        },
        metadata: {
          format: format || null,
          duration: duration || null,
          clipped,
        },
      }),
    };

  } catch (error) {
    console.error('Erreur lors de la génération du prompt:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: error.message || 'Erreur lors de la génération du prompt',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};

/**
 * Extrait une section spécifique du prompt généré
 */
function extractSection(text, sectionName) {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}


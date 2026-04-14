/**
 * Fonction Netlify pour la génération d'images via l'API OpenAI DALL-E
 * Cette fonction sécurise l'appel API en gardant la clé API côté serveur
 */

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
    const { prompt, ratio, quantity = 1, model = 'dall-e-3', refCharacter } = body;

    // Validation des paramètres
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Le prompt est requis et doit être une chaîne non vide.' }),
      };
    }

    // Limiter la quantité à 4 images maximum
    const numImages = Math.min(Math.max(1, parseInt(quantity) || 1), 4);

    // Mapper les ratios aux tailles DALL-E
    const sizeMap = {
      '16:9': '1792x1024',
      '1:1': '1024x1024',
      '9:16': '1024x1792',
      '4:5': '1024x1280',
    };
    const size = sizeMap[ratio] || '1024x1024';

    // Préparer les requêtes pour générer les images
    const imagePromises = [];
    
    for (let i = 0; i < numImages; i++) {
      const requestBody = {
        model: model === 'Image-01' ? 'dall-e-3' : model,
        prompt: prompt.trim(),
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'url',
      };

      // Si une image de référence est fournie, on pourrait l'ajouter ici
      // Note: DALL-E 3 ne supporte pas directement les images de référence,
      // mais on peut l'inclure dans le prompt si nécessaire
      if (refCharacter) {
        // Optionnel: améliorer le prompt avec l'image de référence
        // requestBody.prompt += ' (style similaire à l\'image de référence)';
      }

      imagePromises.push(
        fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        })
          .then(async (response) => {
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Erreur API OpenAI: ${response.status} - ${errorText}`);
            }
            return response.json();
          })
          .then((data) => {
            // DALL-E 3 retourne un seul objet, pas un tableau
            if (data.data && data.data.length > 0) {
              return data.data[0].url;
            }
            throw new Error('Aucune image retournée par l\'API');
          })
      );
    }

    // Exécuter toutes les requêtes en parallèle
    const imageUrls = await Promise.all(imagePromises);

    // Retourner les URLs des images générées
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        urls: imageUrls,
        count: imageUrls.length,
        model: model,
        ratio: ratio,
      }),
    };

  } catch (error) {
    console.error('Erreur lors de la génération d\'images:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: error.message || 'Erreur lors de la génération d\'images',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};


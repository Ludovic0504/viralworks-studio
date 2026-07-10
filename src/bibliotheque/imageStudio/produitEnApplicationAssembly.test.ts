import { describe, expect, it } from "vitest";
import {
  assembleProduitApplicationObjetPrompt,
  assembleProduitApplicationPromptFromSlots,
  assembleProduitApplicationTexturePrompt,
  isProduitEnApplicationGuideReady,
} from "./produitEnApplicationAssembly";

describe("produitEnApplicationAssembly", () => {
  const fixedRandom = () => 0;

  const textureInput = {
    productTypeId: "texture" as const,
    genderId: "femme" as const,
    bodyZoneId: "visage-joue" as const,
    containerId: "visible" as const,
    textureTypeId: "serum-liquide" as const,
    objectTypeId: null,
    postureId: "debout" as const,
    decorId: "studio" as const,
    lightingId: "naturelle-douce" as const,
    productName: "sérum vitamine C",
    physique: "A 30-year-old woman with natural lean build, refined angular face with high cheekbones",
    randomFn: fixedRandom,
  };

  const objetInput = {
    productTypeId: "objet" as const,
    genderId: "homme" as const,
    bodyZoneId: "genou" as const,
    containerId: "visible" as const,
    textureTypeId: null,
    objectTypeId: "rasoir-jetable" as const,
    postureId: "debout" as const,
    decorId: "studio" as const,
    lightingId: "naturelle-douce" as const,
    productName: "rasoir Gillette",
    physique: "A 40-year-old man with natural average build, mature defined cheekbones and calm expression",
    randomFn: fixedRandom,
  };

  it("assembles texture branch with verbatim template structure", () => {
    const prompt = assembleProduitApplicationTexturePrompt(textureInput);

    expect(prompt).toContain("Photo produit en application");
    expect(prompt).toContain("ECU macro, cadrage serré tiers du visage");
    expect(prompt).toContain("objectif 85mm à f/2");
    expect(prompt).toContain("mise au point nette sur le geste et la texture");
    expect(prompt).toContain("sérum liquide");
    expect(prompt).toContain("transparent à doré translucide");
    expect(prompt).toContain("glossy, très réfléchissant");
    expect(prompt).toContain("goutte qui perle / traînée fine qui coule");
    expect(prompt).toContain("sérum vitamine C");
    expect(prompt).toContain("lumière naturelle diffuse venant de face-haut");
    expect(prompt).toContain("fond studio uni blanc");
    expect(prompt).toContain("ratio 4:5");
    expect(prompt).not.toContain("[");
  });

  it("assembles objet branch with verbatim template structure", () => {
    const prompt = assembleProduitApplicationObjetPrompt(objetInput);

    expect(prompt).toContain("Photo produit en application");
    expect(prompt).toContain("mise au point nette sur l'objet et le point de contact");
    expect(prompt).toContain("rasoir jetable");
    expect(prompt).toContain("fait glisser la lame en un mouvement long et contrôlé");
    expect(prompt).toContain("genou");
    expect(prompt).toContain("ligne nette rasée contrastant avec la mousse restante");
    expect(prompt).toContain("Objet tenu en gros plan");
    expect(prompt).not.toContain("[");
  });

  it("assembles from slots with auto physique when missing", () => {
    const prompt = assembleProduitApplicationPromptFromSlots(
      {
        productTypeId: "texture",
        genderId: "femme",
        bodyZoneId: "cou-decollete",
        containerId: "hors-cadre",
        textureTypeId: "creme-riche",
        postureId: "debout",
        decorId: "environnement",
        lightingId: "studio-dramatique-bicolore",
        productName: "crème hydratante",
      },
      fixedRandom,
    );

    expect(prompt).toContain("crème riche");
    expect(prompt).toContain("aucun packaging visible");
    expect(prompt).toContain("salle de bain moderne");
    expect(prompt).toContain("deux sources contrastées");
    expect(prompt).toContain("éditorial dramatique haut de gamme");
    expect(prompt).toContain("saturée et contrastée");
    expect(prompt).toMatch(/A \d+-year-old woman with/);
  });

  it("validates guide readiness", () => {
    expect(
      isProduitEnApplicationGuideReady({
        productTypeId: "texture",
        genderId: "femme",
        bodyZoneId: "visage-joue",
        textureTypeId: "gel",
        productName: "gel nettoyant",
      }),
    ).toBe(true);

    expect(
      isProduitEnApplicationGuideReady({
        productTypeId: "objet",
        genderId: "homme",
        bodyZoneId: "genou",
        objectTypeId: "",
        productName: "rasoir",
      }),
    ).toBe(false);

    expect(
      isProduitEnApplicationGuideReady({
        productTypeId: "texture",
        genderId: "femme",
        bodyZoneId: "visage-joue",
        textureTypeId: "gel",
        productImageUrl: "data:image/png;base64,abc",
      }),
    ).toBe(true);
  });
});

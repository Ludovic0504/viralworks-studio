/** Télécharge une image distante ou data URL en fichier PNG. */
export async function downloadImageAsPng(
  url: string,
  filename = "viralworks-image.png",
): Promise<void> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Timeout lors du chargement de l'image"));
    }, 30000);

    img.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    img.onerror = () => {
      window.clearTimeout(timeout);
      if (img.crossOrigin) {
        img.crossOrigin = null;
        img.src = url;
      } else {
        reject(new Error("Impossible de charger l'image"));
      }
    };

    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de créer le contexte canvas");

  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Erreur lors de la conversion en PNG"));
      },
      "image/png",
    );
  });

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

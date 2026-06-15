import { getImageStudioModelLogo } from "@/bibliotheque/imageStudio/imageStudioModels";

const SIZE_CLASS = {
  sm: "image-studio-model-icon--sm",
  md: "image-studio-model-icon--md",
  lg: "image-studio-model-icon--lg",
};

const MODEL_MODIFIER = {
  nano_banana_pro: "image-studio-model-icon--banana",
  hailuo: "image-studio-model-icon--hailuo",
  gpt_image_2: "image-studio-model-icon--gpt",
};

export default function ImageStudioModelIcon({ modelId, size = "md", className = "" }) {
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;
  const modelClass = MODEL_MODIFIER[modelId] ?? "";
  const src = getImageStudioModelLogo(modelId);

  if (!src) {
    return (
      <span
        className={`image-studio-model-icon image-studio-model-icon--fallback ${sizeClass}${className ? ` ${className}` : ""}`}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={`image-studio-model-icon image-studio-model-icon--photo ${sizeClass}${modelClass ? ` ${modelClass}` : ""}${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <img src={src} alt="" className="image-studio-model-icon-img" draggable={false} />
    </span>
  );
}

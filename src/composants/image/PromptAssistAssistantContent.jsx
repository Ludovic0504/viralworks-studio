import {
  formatPromptAssistIntro,
  parsePromptAssistAssistantMessage,
  splitPromptForDisplay,
} from "@/bibliotheque/imageStudio/catalog/glossary/parsePromptAssistMessage";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";

function renderTextWithMentions(text) {
  const token = IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
  if (!text.includes(token)) {
    return text;
  }

  const parts = text.split(token);
  return parts.flatMap((part, index) => {
    const nodes = [part];
    if (index < parts.length - 1) {
      nodes.push(
        <span key={`${index}-mention`} className="image-studio-prompt-assist-mention">
          {token}
        </span>,
      );
    }
    return nodes;
  });
}

export default function PromptAssistAssistantContent({ content }) {
  const parsed = parsePromptAssistAssistantMessage(content);

  if (parsed.plain) {
    return (
      <p className="image-studio-prompt-guide-bubble-text image-studio-prompt-assist-message-text">
        {renderTextWithMentions(parsed.plain)}
      </p>
    );
  }

  const promptLines = parsed.prompt ? splitPromptForDisplay(parsed.prompt) : [];
  const intro = formatPromptAssistIntro(parsed.intro, Boolean(parsed.prompt));

  return (
    <div className="image-studio-prompt-assist-reply">
      {intro ? (
        <p className="image-studio-prompt-guide-bubble-text image-studio-prompt-assist-message-text">
          {intro}
        </p>
      ) : null}

      {promptLines.length > 0 ? (
        <p className="image-studio-prompt-guide-bubble-text image-studio-prompt-assist-message-text image-studio-prompt-assist-prompt-body">
          {promptLines.map((line, index) => (
            <span key={line}>
              {index > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      ) : null}

      {parsed.outro ? (
        <p className="image-studio-prompt-guide-bubble-text image-studio-prompt-assist-outro">
          {renderTextWithMentions(parsed.outro)}
        </p>
      ) : null}
    </div>
  );
}

import {
  chatCompletion,
  messageContentToText,
  type ChatMessage,
} from "@/bibliotheque/openai/chatgpt-client";
import {
  collectPromptAssistUserText,
  routePromptAssistIntent,
} from "@/bibliotheque/imageStudio/catalog/templates/intentRouter";
import { buildPromptAssistRoutingContextBlock } from "@/bibliotheque/imageStudio/catalog/templates/routingContext";
import { buildPromptAssistSystemPrompt } from "./systemPrompt";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";

export const PROMPT_ASSIST_OPENAI_MODEL = "gpt-4o-mini";
export const PROMPT_ASSIST_OPENAI_TEMPERATURE = 0.45;
export const PROMPT_ASSIST_OPENAI_MAX_TOKENS = 900;

export type PromptAssistChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

export function buildOpenAiMessagesForPromptAssist(
  messages: PromptAssistChatMessage[],
  systemPrompt: string,
): ChatMessage[] {
  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  if (firstUserIndex === -1) {
    return [{ role: "system", content: systemPrompt }];
  }

  const openAiMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
  const thread = messages.slice(firstUserIndex);

  for (let index = 0; index < thread.length; index += 1) {
    const message = thread[index];
    if (message.role !== "user") {
      openAiMessages.push({ role: message.role, content: message.content });
      continue;
    }

    let content = message.content;
    const conversationText = collectPromptAssistUserText(thread.slice(0, index + 1));
    const route = routePromptAssistIntent(conversationText, {
      hasReferenceImage: Boolean(message.imageUrl),
    });
    const routingBlock = buildPromptAssistRoutingContextBlock(route, conversationText, {
      hasReferenceImage: Boolean(message.imageUrl),
    });

    if (routingBlock) {
      content = `${content}\n\n${routingBlock}`;
    }

    if (message.imageUrl) {
      content = `${content}\n\n[L'utilisateur a joint une image de référence produit — inclure ${IMAGE_STUDIO_PRODUCT_MENTION_TOKEN} dans le prompt final pour qu'Image Studio s'appuie dessus.]`;
    }

    openAiMessages.push({
      role: message.role,
      content,
    });
  }

  return openAiMessages;
}

export async function promptAssistChatCompletion(
  messages: PromptAssistChatMessage[],
  systemPrompt: string = buildPromptAssistSystemPrompt(),
): Promise<string> {
  const openAiMessages = buildOpenAiMessagesForPromptAssist(messages, systemPrompt);
  if (openAiMessages.length <= 1) return "";

  const response = await chatCompletion(openAiMessages, {
    model: PROMPT_ASSIST_OPENAI_MODEL,
    temperature: PROMPT_ASSIST_OPENAI_TEMPERATURE,
    max_tokens: PROMPT_ASSIST_OPENAI_MAX_TOKENS,
  });

  return messageContentToText(response.choices[0]?.message?.content);
}

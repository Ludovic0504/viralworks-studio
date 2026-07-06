import { describe, expect, it } from "vitest";
import { censorMessageText } from "@/bibliotheque/moderation/messageCensor";

describe("censorMessageText", () => {
  const badwords = new Set(["connard", "pute"]);
  const toxic = new Set(["hitler", "staline"]);

  it("laisse passer un message innocent", () => {
    expect(censorMessageText("Salut tout le monde !", badwords, toxic)).toBe(
      "Salut tout le monde !",
    );
  });

  it("censure un mot interdit entier", () => {
    expect(censorMessageText("Tu es un connard", badwords, toxic)).toBe(
      "Tu es un *******",
    );
  });

  it("conserve la ponctuation autour du mot", () => {
    expect(censorMessageText("connard, vraiment ?", badwords, toxic)).toBe(
      "*******, vraiment ?",
    );
  });

  it("détecte le leetspeak", () => {
    expect(censorMessageText("espèce de c0nnard", badwords, toxic)).toBe(
      "espèce de *******",
    );
  });

  it("détecte les accents", () => {
    expect(censorMessageText("espèce de cônnard", badwords, toxic)).toBe(
      "espèce de *******",
    );
  });

  it("censure une personnalité toxique", () => {
    expect(censorMessageText("comme Hitler disait", badwords, toxic)).toBe(
      "comme ****** disait",
    );
  });

  it("censure plusieurs mots dans la même phrase", () => {
    expect(censorMessageText("connard et pute", badwords, toxic)).toBe(
      "******* et ****",
    );
  });
});

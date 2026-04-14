import fs from "fs";
const p = "src/pages/Image.jsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);

const neuLines = [
  "      setItems(await loadImageHistoryForSession(session, uid));",
  "      if (!quiet) {",
  "        alert(",
  "          validationNotice",
  `          ? \`�� Images validées et enregistrées avec succès !\\�️ \${validationNotice}\``,
  `� Images validées et enregistrées avec succès !"`,
  "        );",
  "      }",
  "      setLastGeneratedImages(null);",
  '      setLastGeneratedPrompt("");',
  '      setPrompt("");',
  "      setRefCharDataUrl(null);",
  '      window.dispatchEvent(new Event("onetool:history:changed"));',
  "      onSuccess?.();",
  "    } catch (err) {",
  '      console.error("Erreur validation:", err);',
  '      if (!quiet) alert("Erreur lors de la validation");',
  "    }",
  "  };",
  "",
  "  const reloadIdeaFromScript = () => {",
  "    const fromProp = initialImagePrompt?.trim();",
  "    if (fromProp) {",
  "      setPrompt(fromProp);",
  "      return;",
  "    }",
  "    try {",
  '      const raw = localStorage.getItem("vws_brain_v2_last");',
  "      if (!raw) return;",
  "      const parsed = JSON.parse(raw);",
  "      const cover = parsed?.brain?.coverPrompt;",
  "      if (cover) setPrompt(String(cover));",
  "    } catch (err) {",
  '      console.warn("Impossible de recharger l\'idée depuis le script:", err);',
  "    }",
  "  };",
  "",
  "  const handleUseThisImage = async () => {",
  "    await handleValidate({",
  "      quiet: Boolean(onUseImageAndContinue),",
  "      onSuccess: onUseImageAndContinue,",
  "    });",
  "  };",
];

const out = [...lines.slice(0, 468), ...neuLines, ...lines.slice(484)].join("\n");
fs.writeFileSync(p, out);
console.log("patched");

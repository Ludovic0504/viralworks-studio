import { useState } from "react";

export default function PreviewGate({ children }) {
  const [ok, setOk] = useState(sessionStorage.getItem("preview_ok") === "1");

  if (ok || !import.meta.env.VITE_PREVIEW_PASS) return children;

  const onSubmit = (e) => {
    e.preventDefault();
    const pass = new FormData(e.currentTarget).get("pass");
    if (pass === import.meta.env.VITE_PREVIEW_PASS) {
      sessionStorage.setItem("preview_ok", "1");
      setOk(true);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        maxWidth: 420,
        margin: "10vh auto",
        padding: 24,
        border: "1px solid #ddd",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <h3>Accès ViralWorks Studio (staging)</h3>
      <input
        name="pass"
        type="password"
        placeholder="Mot de passe"
        style={{
          width: "100%",
          padding: 12,
          margin: "12px 0",
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />
      <button style={{ padding: "8px 16px", cursor: "pointer" }}>Entrer</button>
      <p style={{ opacity: 0.7, marginTop: 8, fontSize: 14 }}>
        Ne pas partager publiquement cette URL.
      </p>
    </form>
  );
}

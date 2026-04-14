const tailwindConfig = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      height:   { dvh: "100dvh" },
      minHeight:{ dvh: "100dvh" },

      colors: {
        ink: "#050810",
        surface: "#0b101b",
        card: "#0e1624",
        accent: "#21f3b9",
        muted: "#7d8899",
      },
      boxShadow: {
        glow: "0 0 0.5rem rgba(34,230,184,.4), 0 0 2rem rgba(34,230,184,.25)",
      },
    },
  },
  plugins: [],
};

export default tailwindConfig;

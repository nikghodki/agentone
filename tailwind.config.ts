module.exports = {
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          subtle: "#EEF2FF",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
}

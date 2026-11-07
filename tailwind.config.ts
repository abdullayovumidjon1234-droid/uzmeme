import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#140b24", choc: "#2b1810", neon: "#a855f7" } } }, plugins: [] };
export default config;

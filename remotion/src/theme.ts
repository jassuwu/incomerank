import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// the site's editorial-paper system (src/styles/global.css @theme)
export const C = {
  paper: "#f4f0e7",
  panel: "#eae3d6",
  ink: "#191512",
  inkSoft: "#2c2620",
  muted: "#6d655b",
  faint: "#a59c8e",
  line: "#d8d0c0",
  accent: "#df2f1b",
  accentInk: "#b51f10",
};

export const display = loadBricolage().fontFamily; // Bricolage Grotesque — headings
export const body = loadInter().fontFamily; //       Inter — figures / captions

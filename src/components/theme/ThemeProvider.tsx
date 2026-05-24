import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "system",
  setTheme: () => {},
  toggle: () => {},
});
const KEY = "darkfunnel.theme";

function resolve(t: Theme): "light" | "dark" {
  if (t === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(KEY) as Theme | null;
    return stored ?? "system";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolve(theme) === "dark");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const cb = () => document.documentElement.classList.toggle("dark", mq.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggle: () => setThemeState((t) => (resolve(t) === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

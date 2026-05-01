import Script from "next/script"

export function ThemeInit() {
  return (
    <Script id="theme-init" strategy="beforeInteractive">
      {`
(() => {
  try {
    const stored = localStorage.getItem("nexus:theme");
    const theme = stored === "light" ? "light" : "dark";
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  } catch {}
})();
      `}
    </Script>
  )
}


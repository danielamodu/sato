import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DocContent } from "./components/DocContent";
import { CommandPalette } from "./components/CommandPalette";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync theme with document element
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Sync hash on initial load
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setActiveSection(hash);
    }
  }, []);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Left Sidebar */}
      <Sidebar
        activeId={activeSection}
        onSelect={handleSelectSection}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        <main className="flex-1 overflow-y-auto">
          <DocContent activeSection={activeSection} />
        </main>
      </div>

      {/* ⌘K Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSelectSection}
      />
    </div>
  );
}

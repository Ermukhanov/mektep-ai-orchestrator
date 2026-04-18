import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const LANGS = [
  { code: "kz", label: "Қазақша", sub: "Kazakh", flag: "🇰🇿" },
  { code: "ru", label: "Русский", sub: "Russian", flag: "🇷🇺" },
  { code: "en", label: "English", sub: "English", flag: "🇬🇧" },
];

export default function LanguageSelect() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(i18n.language);

  const confirm = () => {
    i18n.changeLanguage(selected);
    localStorage.setItem("mektep_lang", selected);
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-10">
          <Logo size="md" />
        </div>

        <h1 className="font-display text-3xl font-bold text-center mb-2">{t("selectLanguage")}</h1>
        <p className="text-muted-foreground text-center text-sm mb-10">{t("languageHint")}</p>

        <div className="space-y-3">
          {LANGS.map((l, i) => (
            <motion.button
              key={l.code}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(l.code)}
              className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-smooth text-left ${
                selected === l.code
                  ? "border-accent bg-accent-soft shadow-md"
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <span className="text-3xl">{l.flag}</span>
              <div className="flex-1">
                <div className="font-semibold">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.sub}</div>
              </div>
              {selected === l.code && (
                <div className="h-7 w-7 rounded-full gradient-success flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </motion.button>
          ))}
        </div>

        <Button onClick={confirm} className="w-full mt-8 h-12 gradient-primary text-primary-foreground font-semibold">
          {t("continue")}
        </Button>
      </motion.div>
    </div>
  );
}

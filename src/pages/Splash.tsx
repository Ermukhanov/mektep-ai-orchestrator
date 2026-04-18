import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Splash() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const seenLang = localStorage.getItem("mektep_lang");
    const user = localStorage.getItem("mektep_user");
    const timer = setTimeout(() => {
      if (user) navigate("/app/dashboard");
      else if (seenLang) navigate("/auth");
      else navigate("/language");
    }, 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle at 20% 30%, hsl(var(--accent)) 0%, transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--primary-glow)) 0%, transparent 50%)"
      }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="text-center relative z-10"
      >
        <motion.div
          initial={{ rotate: -10, y: -20 }}
          animate={{ rotate: 0, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mx-auto h-24 w-24 rounded-3xl gradient-success flex items-center justify-center shadow-glow mb-6"
        >
          <GraduationCap className="h-12 w-12 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-display text-5xl sm:text-6xl font-bold text-white mb-3"
        >
          MEKTEP <span className="text-accent">AI</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-white/70 text-sm sm:text-base max-w-xs mx-auto"
        >
          {t("tagline")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-12 flex justify-center"
        >
          <div className="h-1 w-32 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="h-full w-1/2 bg-accent rounded-full"
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

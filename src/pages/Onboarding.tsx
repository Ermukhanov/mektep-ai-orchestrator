import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, GraduationCap, BookOpen, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useApp, UserRole } from "@/store/appStore";
import { SUBJECTS } from "@/lib/mockData";

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("director");
  const [subject, setSubject] = useState("Administration");

  const finish = () => {
    const email = localStorage.getItem("mektep_pending_email") || "user@aqbobek.kz";
    localStorage.removeItem("mektep_pending_email");
    setUser({ name: name || "New User", role, subject, email });
    navigate("/app/dashboard");
  };

  const next = () => (step < 3 ? setStep(step + 1) : finish());
  const back = () => step > 1 && setStep(step - 1);
  const canNext = step === 1 ? name.trim().length > 1 : true;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-center p-6"><Logo size="sm" /></div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full gradient-success"
                  initial={false}
                  animate={{ width: step >= s ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mb-6">{t("onboarding.step", { n: step })}</p>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="bg-card border border-border rounded-3xl shadow-elegant p-8"
            >
              {step === 1 && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-accent-soft flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6 text-accent" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-1">{t("onboarding.profile")}</h2>
                  <p className="text-sm text-muted-foreground mb-6">{t("onboarding.profileSub")}</p>
                  <Label htmlFor="name" className="mb-1.5 block">{t("auth.fullName")}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aizhan Konayeva" autoFocus />
                </>
              )}

              {step === 2 && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-accent-soft flex items-center justify-center mb-4">
                    <Briefcase className="h-6 w-6 text-accent" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-1">{t("onboarding.role")}</h2>
                  <p className="text-sm text-muted-foreground mb-6">{t("onboarding.roleSub")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["director", "teacher"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`p-5 rounded-2xl border-2 transition-smooth text-left ${
                          role === r ? "border-accent bg-accent-soft" : "border-border hover:border-accent/50"
                        }`}
                      >
                        {r === "director" ? <Briefcase className="h-6 w-6 mb-2 text-accent" /> : <GraduationCap className="h-6 w-6 mb-2 text-accent" />}
                        <div className="font-semibold">{t(`onboarding.${r}`)}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-accent-soft flex items-center justify-center mb-4">
                    <GraduationCap className="h-6 w-6 text-accent" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-1">{t("onboarding.subject")}</h2>
                  <p className="text-sm text-muted-foreground mb-6">{t("onboarding.subjectSub")}</p>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto scrollbar-thin pr-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        className={`p-3 rounded-xl border text-sm text-left transition-smooth flex items-center justify-between ${
                          subject === s ? "border-accent bg-accent-soft" : "border-border hover:border-accent/50"
                        }`}
                      >
                        <span>{s}</span>
                        {subject === s && <Check className="h-4 w-4 text-accent" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-8">
                {step > 1 && (
                  <Button variant="outline" onClick={back} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> {t("back")}
                  </Button>
                )}
                <Button onClick={next} disabled={!canNext} className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold gap-2">
                  {step === 3 ? t("onboarding.getStarted") : t("next")}
                  {step < 3 && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

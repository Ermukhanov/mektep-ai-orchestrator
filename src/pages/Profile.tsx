import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, Save, User as UserIcon, Shield, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, profile, role, signOut, refresh } = useApp();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [language, setLanguage] = useState(profile?.language || "ru");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setLanguage(profile?.language || "ru");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, language })
        .eq("user_id", user.id);
      if (error) throw error;
      i18n.changeLanguage(language);
      await refresh();
      toast.success(t("profile.saved", "Профиль обновлён"));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const initials = (fullName || user?.email || "U").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">{t("profile.title", "Профиль")}</h1>
        <p className="text-muted-foreground">{t("profile.subtitle", "Управление личными данными и языком")}</p>
      </div>

      <Card className="overflow-hidden border-0 shadow-elegant">
        <div className="h-24 gradient-primary" />
        <CardContent className="pt-0">
          <div className="flex items-end gap-4 -mt-12 mb-6">
            <div className="h-24 w-24 rounded-2xl bg-card border-4 border-card shadow-soft flex items-center justify-center font-display text-3xl font-bold text-primary">
              {initials}
            </div>
            <div className="pb-2">
              <div className="font-display text-xl font-bold">{fullName || user?.email}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>{role ? t(`roles.${role}`) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-1.5"><UserIcon className="h-3.5 w-3.5" />{t("profile.name", "ФИО")}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван" />
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-1.5"><Globe className="h-3.5 w-3.5" />{t("profile.language", "Язык интерфейса")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="kk">Қазақша</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
                <Save className="h-4 w-4 mr-2" />{saving ? "..." : t("profile.save", "Сохранить")}
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />{t("nav.logout", "Выйти")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("profile.integrations", "Интеграции")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <div className="font-semibold">WhatsApp (GREEN-API)</div>
              <div className="text-xs text-muted-foreground">MEKTEP AI отвечает напрямую в WhatsApp</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/30">подключено</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <div className="font-semibold">Telegram</div>
              <div className="text-xs text-muted-foreground">Бот школы</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">по запросу</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

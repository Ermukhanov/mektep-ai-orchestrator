import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Substitutions() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [period, setPeriod] = useState(1);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-substitute", { body: { absent_teacher_full_name: name, subject, date, period } });
      if (error) throw error;
      setSuggestions(data.suggestions || data || []);
      toast.success("Предложения созданы");
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally { setLoading(false); }
  };

  const confirm = async (subId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("confirm-substitution", { body: { substitution_id: subId, action: "confirm" } });
      if (error) throw error;
      toast.success("Замена подтверждена");
    } catch (e: any) { toast.error(e.message || "Ошибка"); }
  };

  const autoAssign = async (absenceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("quick-reschedule", { body: { absence_id: absenceId, period } });
      if (error) throw error;
      toast.success("Авто-распределение выполнено");
      console.log(data);
    } catch (e: any) { toast.error(e.message || "Ошибка"); }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl">Smart Substitution</h1>
      <p className="text-sm text-muted-foreground">Автоматический подбор замены и подтверждение.</p>

      <div className="grid sm:grid-cols-4 gap-2 max-w-2xl">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО отсутствующего" className="input" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет (english, math)" className="input" />
        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="input" />
        <input value={String(period)} onChange={(e) => setPeriod(Number(e.target.value))} placeholder="Период" className="input" />
      </div>

      <div>
        <Button onClick={run} disabled={loading || !name || !subject}>{loading ? 'Поиск...' : 'Найти замену'}</Button>
      </div>

      <div className="space-y-3 mt-4">
        {suggestions.map((s: any, i: number) => (
          <div key={i} className="p-3 border rounded flex items-center justify-between">
            <div>
              <div className="font-semibold">{s.candidate.full_name}</div>
              <div className="text-xs text-muted-foreground">{s.candidate.subjects?.join?.(', ')}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => confirm(s.substitution.id)}>Подтвердить</Button>
              <Button variant="ghost" onClick={() => autoAssign(s.substitution.absence_id)}>Auto-assign</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

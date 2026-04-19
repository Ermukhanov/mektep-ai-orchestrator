import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Director() {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/daily-report`, {
        method: "POST",
        headers: { apikey: (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "", "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Ошибка генерации отчёта");
      const txt = await res.text();
      setCsv(txt);
      toast.success("Отчёт готов");
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally { setLoading(false); }
  };

  const download = () => {
    if (!csv) return toast.error("Сначала сгенерируйте отчёт");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl">Директор — Утренний отчёт</h1>
      <p className="text-sm text-muted-foreground">Собирает информацию о столовой, посещаемости и статусе учителей.</p>
      <div className="flex gap-2">
        <Button onClick={run} disabled={loading}>{loading ? 'Генерирую...' : 'Собрать отчёт (09:00)'}</Button>
        <Button onClick={download} variant="outline">Скачать CSV</Button>
      </div>
      <pre className="mt-4 p-3 bg-[#0f1720] text-white rounded">{csv}</pre>
    </div>
  );
}

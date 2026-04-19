import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function Nfc() {
  const [uid, setUid] = useState("");
  const [student, setStudent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const send = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfc-scan", { body: { uid, student_id: student || null } });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl">NFC</h1>
      <p className="text-sm text-muted-foreground">Сымитируйте сканирование NFC-карты ученика (тестовый режим).</p>
      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID карты" className="input" />
        <input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="student_id (optional)" className="input" />
      </div>
      <div>
        <Button onClick={send} disabled={loading || !uid}>{loading ? "Отправка..." : "Симулировать скан"}</Button>
      </div>
      {result && (
        <pre className="bg-muted p-3 rounded text-sm">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

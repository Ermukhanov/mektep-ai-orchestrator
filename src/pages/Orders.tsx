import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Orders() {
  const [templates, setTemplates] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("legal-templates");
        // if service returns templates, use them; otherwise fallback to local mock
        if (data && Object.keys(data).length > 0) setTemplates(data);
        else setTemplates({
          '130': { title: 'Приказ №130 (тестовый)', fields: ['fio', 'position', 'date'] },
          'general': { title: 'Общий приказ (тестовый)', fields: ['title', 'body'] },
        });
      } catch (e) {
        console.error(e);
        setTemplates({
          '130': { title: 'Приказ №130 (тестовый)', fields: ['fio', 'position', 'date'] },
          'general': { title: 'Общий приказ (тестовый)', fields: ['title', 'body'] },
        });
      }
    })();
  }, []);

  const generate = async (type: string) => {
    setLoading(true);
    try {
      const body = { prompt: prompt || `Сгенерируй приказ типа ${type}`, order_type: type, language: "ru" };
      const { data, error } = await supabase.functions.invoke("legal-chat", { body });
      if (error) throw error;
      toast.success("Документ сгенерирован");
      } catch (e: any) {
      // fallback: generate a test document for type 130 or generic test document
      console.error('generate error', e);
      if (type === '130') {
        const text = `Приказ №130 (тестовый)\nДата: ${new Date().toLocaleDateString()}\n\nНа основании...\nФИО: ${prompt || 'Иванов И.И.'}\nДолжность: Учитель\n`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `order_130_${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(url);
        toast.success('Тестовый документ приказа 130 сгенерирован и скачан');
      } else {
        const text = `Тестовый приказ (${type})\nЗапрошенные данные: ${prompt || '-'}\n`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `order_${type}_${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(url);
        toast.success('Тестовый документ сгенерирован и скачан');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl">Приказы / Шаблоны</h1>
      <p className="text-sm text-muted-foreground">Выберите шаблон и сгенерируйте приказ через AI.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Доп. информация для приказа" className="w-full p-3 rounded border" />

      <div className="flex gap-2">
        <Button onClick={async () => {
          const { data } = await supabase.functions.invoke("ingest-legal-templates");
          if (data?.count) toast.success(`Загружено ${data.count} шаблонов`);
          else toast('Нечего загружать');
        }}>Импорт шаблонов в БД</Button>
        <Button onClick={async () => {
          const q = prompt || "";
          const { data } = await supabase.functions.invoke("legal-search", { body: { q } });
          console.log(data);
          toast.success(`Найдено: ${data?.results?.length || 0}`);
        }}>Поиск по приказам</Button>
        <Button onClick={async () => {
          const { data } = await supabase.functions.invoke("rag-ingest-legal");
          if (data?.count) toast.success(`RAG: вставлено чанков ${data.count}`);
          else toast('RAG: нечего загружать');
        }}>RAG — Ингестить в векторную БД</Button>
        <Button onClick={async () => {
          const q = prompt || "порядок учебного года";
          const { data } = await supabase.functions.invoke("legal-rag-query", { body: { q } });
          console.log(data);
          toast.success(`RAG: найдено ${data?.top?.length || 0} фрагментов`);
        }}>RAG — Поиск</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        {Object.keys(templates).map((k) => (
          <div key={k} className="p-3 border rounded">
            <div className="font-semibold">{templates[k].title}</div>
            <div className="text-xs text-muted-foreground">Поля: {templates[k].fields.join(", ")}</div>
            <div className="mt-3">
              <Button onClick={() => generate(k)} disabled={loading}>{loading ? "Генерация..." : "Сгенерировать"}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

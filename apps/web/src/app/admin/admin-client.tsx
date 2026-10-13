"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Item = {
  prompt: string;
  language?: string;
  responses: { text: string; source?: string }[];
};

export default function AdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);
  const [minVotes, setMinVotes] = useState(1);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setItems([]);
    setErrors([]);
    setResult("");
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const ok: Item[] = [];
    const bad: string[] = [];

    lines.forEach((line, i) => {
      try {
        const obj = JSON.parse(line);
        if (
          typeof obj.prompt !== "string" ||
          !Array.isArray(obj.responses) ||
          obj.responses.length < 2 ||
          obj.responses.some((r: { text?: unknown }) => typeof r.text !== "string")
        ) {
          bad.push(`خط ${i + 1}: ساختار نادرست (prompt و حداقل دو responses با text لازم است)`);
        } else {
          ok.push(obj);
        }
      } catch {
        bad.push(`خط ${i + 1}: JSON معتبر نیست`);
      }
    });

    setItems(ok);
    setErrors(bad);
  }

  async function upload() {
    if (!items.length || uploading) return;
    setUploading(true);
    setResult("");
    try {
      const res = await fetch(`${API}/admin/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.status === 403) throw new Error("دسترسی ادمین ندارید");
      if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
      const data = await res.json();
      setResult(`✅ ${data.prompts} پرسش و ${data.comparisons} مقایسه اضافه شد.`);
      setItems([]);
    } catch (e) {
      setResult(`❌ ${e instanceof Error ? e.message : "خطای ناشناخته"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>پنل ادمین: آپلود داده</h1>
      <p>فایل JSONL بده؛ هر خط یک پرسش با پاسخ‌هایش.</p>

      <input type="file" accept=".jsonl,.json,.txt" onChange={onFile} />

      {items.length > 0 && <p>{items.length} خط معتبر آماده‌ی آپلود است.</p>}
      {errors.length > 0 && (
        <ul style={{ color: "crimson" }}>
          {errors.slice(0, 10).map((m) => <li key={m}>{m}</li>)}
          {errors.length > 10 && <li>و {errors.length - 10} خطای دیگر...</li>}
        </ul>
      )}

      <button onClick={upload} disabled={!items.length || uploading} style={{ marginTop: 12 }}>
        {uploading ? "در حال آپلود..." : "آپلود"}
      </button>
      {result && <p>{result}</p>}
            <hr style={{ margin: "32px 0" }} />
      <h2>خروجی برای آموزش</h2>
      <label>
        حداقل تعداد رأی برای هر مقایسه:{" "}
        <input
          type="number"
          min={1}
          value={minVotes}
          onChange={(e) => setMinVotes(Math.max(1, Number(e.target.value) || 1))}
          style={{ width: 60 }}
        />
      </label>
      <p>
        <a href={`${API}/admin/export?minVotes=${minVotes}`}>دانلود JSONL (chosen / rejected)</a>
      </p>
    </main>
  );
}
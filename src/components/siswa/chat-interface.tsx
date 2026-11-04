"use client";

// Antarmuka obrolan interaktif dengan Bizzy (Asisten AI Wirausaha Samarinda)
// Mendukung streaming teks SSE secara realtime, saran pertanyaan, & riwayat obrolan

import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat-service";
import {
  Lightbulb,
  FileText,
  MapPin,
  TrendingUp,
  Bot,
  Trash2,
  Rocket,
  Copy,
  Check,
  AlertTriangle,
  Square,
  Send,
} from "lucide-react";

const LOCAL_STORAGE_KEY = "lms_bizzy_chat_v1";

// Pertanyaan pancingan awal seputar wirausaha di Samarinda
const QUICK_PROMPTS = [
  {
    icon: <Lightbulb className="h-5 w-5 text-accent" aria-hidden="true" />,
    title: "Modal Minim < 1 Juta",
    prompt:
      "Bagaimana cara mulai usaha kuliner di Samarinda dengan modal di bawah Rp 1 juta?",
  },
  {
    icon: <FileText className="h-5 w-5 text-accent" aria-hidden="true" />,
    title: "Legalitas & NIB",
    prompt:
      "Apa saja langkah mengurus NIB gratis lewat OSS untuk UMKM di Samarinda?",
  },
  {
    icon: <MapPin className="h-5 w-5 text-accent" aria-hidden="true" />,
    title: "Spot Usaha Samarinda",
    prompt:
      "Di mana lokasi strategis dan ramai untuk jualan kuliner atau minuman di Samarinda?",
  },
  {
    icon: <TrendingUp className="h-5 w-5 text-accent" aria-hidden="true" />,
    title: "Pemasaran Lokal",
    prompt:
      "Strategi pemasaran apa yang paling efektif menarik konsumen anak muda di Samarinda?",
  },
];

/** Parser markdown sederhana & aman untuk merender teks respons asisten */
function formatMarkdown(text: string) {
  // Pecah per baris untuk memproses heading & list
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let listBuffer: string[] = [];

  const flushList = (key: number) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="my-2 ml-5 list-disc space-y-1 text-sm">
          {listBuffer.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  const renderInline = (str: string): React.ReactNode => {
    // Tangani bold **text** dan *italic*
    const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i} className="text-muted">{part.slice(1, -1)}</em>;
      }
      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline hover:opacity-80"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Pemisah horisontal
    if (trimmed === "---") {
      flushList(i);
      elements.push(<hr key={i} className="my-3 border-border" />);
      return;
    }

    // Heading h3 (###)
    if (trimmed.startsWith("### ")) {
      flushList(i);
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    // Heading h2 (##)
    if (trimmed.startsWith("## ")) {
      flushList(i);
      elements.push(
        <h3 key={i} className="mt-4 mb-2 text-lg font-bold text-foreground">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    // List item (- atau *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.slice(2));
      return;
    }

    // Angka list (1. 2. dst)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      flushList(i);
      elements.push(
        <div key={i} className="my-1.5 flex items-start gap-2 text-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {numMatch[1]}
          </span>
          <div className="flex-1">{renderInline(numMatch[2])}</div>
        </div>
      );
      return;
    }

    // Baris kosong
    if (trimmed === "") {
      flushList(i);
      return;
    }

    // Paragraf biasa
    flushList(i);
    elements.push(
      <p key={i} className="my-1.5 text-sm leading-relaxed text-foreground">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList(lines.length);
  return elements;
}

export function ChatInterface({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Muat riwayat dari localStorage saat pertama kali render
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, []);

  // Simpan riwayat obrolan setiap kali messages berubah
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {
      // Abaikan jika quota terlampaui
    }
  }, [messages]);

  // Otomatis scroll ke pesan paling bawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Sesuaikan tinggi textarea secara otomatis
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  };

  // Kirim pesan ke API chat (streaming)
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    setError(null);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Buat placeholder pesan asisten kosong yang akan diisi secara streaming
    const assistantIndex = newMessages.length;
    const initialAssistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages([...newMessages, initialAssistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Gagal menghubungi server (${res.status})`
        );
      }

      if (!res.body) {
        throw new Error("Server tidak mengembalikan respons streaming.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6).trim();

          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                if (updated[assistantIndex]) {
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    content: accumulated,
                  };
                }
                return updated;
              });
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "";
            if (message !== "Unexpected end of JSON input") {
              // Jika parsing gagal, abaikan potongan tak lengkap
            }
          }
        }
      }

      // Pastikan ada teks yang tersimpan
      if (!accumulated.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[assistantIndex]) {
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              content:
                "Maaf, respons kosong diterima dari asisten. Silakan coba ajukan pertanyaan lagi.",
            };
          }
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Pengguna membatalkan sendiri streaming
        return;
      }
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat jawaban.";
      setError(message);
      // Hapus placeholder pesan asisten kosong jika error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  // Batalkan streaming
  const handleStopGenerating = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  // Hapus semua riwayat
  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (confirm("Hapus seluruh riwayat percakapan dengan Bizzy?")) {
      handleStopGenerating();
      setMessages([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setError(null);
    }
  };

  // Salin teks asisten
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Kirim dengan tombol Enter (Shift+Enter untuk baris baru)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px] card overflow-hidden">
      {/* Header Bar Obrolan */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
            <Bot className="h-5 w-5" aria-hidden="true" />
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-green-500"
              title="Online"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Bizzy</h2>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                AI Wirausaha
              </span>
            </div>
            <p className="text-xs text-muted">
              Konsultan Bisnis & Pembelajaran Samarinda
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-red-400 hover:text-red-500 transition-colors"
            title="Bersihkan obrolan"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Hapus Obrolan</span>
          </button>
        )}
      </div>

      {/* Area Pesan Obrolan */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Tampilan awal jika belum ada percakapan */}
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent shadow-inner">
              <Rocket className="h-8 w-8" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">
              Halo, {userName}! Siap mulai usahamu dari nol?
            </h3>
            <p className="mt-1 text-sm text-muted">
              Saya Bizzy, asisten AI yang siap membantumu mencari ide,
              meriset pasar lokal Samarinda, mengurus legalitas, hingga strategi
              pemasaran modal kecil.
            </p>

            {/* Rekomendasi Pertanyaan Cepat */}
            <div className="mt-6 text-left">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Pilih topik untuk memulai:
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {QUICK_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:border-accent hover:bg-accent-soft group"
                  >
                    <div className="rounded-lg bg-accent-soft p-1.5 text-accent">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground group-hover:text-accent">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted line-clamp-2">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Daftar Pesan */}
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  isUser
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent border border-accent/30"
                }`}
              >
                {isUser ? (
                  userName.charAt(0).toUpperCase()
                ) : (
                  <Bot className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              {/* Balon Pesan */}
              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                  isUser
                    ? "bg-accent text-white rounded-tr-none"
                    : "card border border-border bg-surface text-foreground rounded-tl-none shadow-sm"
                }`}
              >
                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                ) : (
                  <div>
                    {msg.content ? (
                      formatMarkdown(msg.content)
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 text-muted">
                        <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                        <span className="text-xs">Bizzy sedang mengetik...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tombol Salin untuk Pesan Asisten */}
                {!isUser && msg.content && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted">
                    <span>Bizzy</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, index)}
                      className="hover:text-accent flex items-center gap-1 transition-colors"
                      title="Salin teks"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Notifikasi Error */}
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="font-semibold underline hover:no-underline"
            >
              Coba lagi
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="border-t border-border bg-surface p-3 sm:p-4">
        {isLoading && (
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
              Menghasilkan jawaban...
            </span>
            <button
              type="button"
              onClick={handleStopGenerating}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent-soft hover:text-accent transition-colors"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Berhenti</span>
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan ide usaha, perizinan, atau materi kursus di Samarinda... (Enter untuk kirim)"
              disabled={isLoading}
              className="input-field resize-none max-h-36 pr-10 text-sm leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0 disabled:opacity-40"
            title="Kirim pesan"
            aria-label="Kirim pesan"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <p className="mt-2 text-center text-[11px] text-muted">
          Bizzy dirancang untuk membimbing ide usahamu. Selalu konfirmasi
          syarat legalitas resmi ke instansi terkait di Samarinda.
        </p>
      </div>
    </div>
  );
}

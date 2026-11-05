// Endpoint API Chatbot AI Bizzy (/api/chat)
// Mendukung Server-Sent Events (SSE) streaming & respons JSON standar

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import {
  ChatMessage,
  sanitizeMessages,
  sanitizeAIOutput,
  getLmsKnowledgeSummary,
  buildSystemPrompt,
  generateLocalFallbackAnswer,
  getChatCompletion,
} from "@/lib/chat-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Verifikasi autentikasi
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Tidak diizinkan. Silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  // 2. Baca payload JSON
  let body: { messages?: ChatMessage[]; stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Payload JSON tidak valid." },
      { status: 400 }
    );
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json(
      { error: "Daftar pesan tidak boleh kosong." },
      { status: 400 }
    );
  }

  const sanitized = sanitizeMessages(rawMessages);
  if (sanitized.length === 0) {
    return NextResponse.json(
      { error: "Pesan tidak valid atau kosong." },
      { status: 400 }
    );
  }

  const lastMsg = sanitized[sanitized.length - 1];
  if (lastMsg.role !== "user" || !lastMsg.content) {
    return NextResponse.json(
      { error: "Pesan terakhir harus berasal dari pengguna." },
      { status: 400 }
    );
  }

  const userName = session.user.name || undefined;
  const wantStream = body.stream !== false;

  // 3. Mode non-streaming (JSON)
  if (!wantStream) {
    try {
      const rawContent = await getChatCompletion({
        messages: sanitized,
        userName,
      });
      return NextResponse.json({
        role: "assistant",
        content: sanitizeAIOutput(rawContent),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan internal pada chat.";
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }
  }

  // 4. Mode Streaming (Server-Sent Events)
  const lmsContext = await getLmsKnowledgeSummary();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper kirim data event SSE
      const sendEvent = (data: { text?: string; error?: string }) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Regex untuk mendeteksi karakter non-Latin (CJK, Thai, Arab, dll.)
      const nonLatinBlockRegex = /[\u2E80-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u31F0-\u31FF\uF900-\uFAFF]+/g;

      try {
        if (apiKey) {
          // Panggil Anthropic API Streaming
          const client = new Anthropic({
            apiKey,
            baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
            timeout: 60000,
            maxRetries: 2,
          });
          const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
          const systemPrompt = buildSystemPrompt(lmsContext, userName);

          const anthropicStream = client.messages.stream({
            model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: sanitized,
          });

          let emittedChars = 0;

          anthropicStream.on("text", (textDelta) => {
            // Bersihkan karakter non-Latin dari setiap potongan streaming
            const cleaned = textDelta.replace(nonLatinBlockRegex, "");
            if (cleaned) {
              emittedChars += cleaned.length;
              sendEvent({ text: cleaned });
            }
          });

          await anthropicStream.finalMessage();

          // Jika upstream selesai tanpa menghasilkan teks jawaban sama sekali (misal hanya thinking atau respons kosong)
          if (emittedChars === 0) {
            throw new Error("Upstream stream emitted zero text content");
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        // Mode lokal / fallback jika API key belum disetel
        const lastUserText = lastMsg.content;
        const answer = generateLocalFallbackAnswer(lastUserText, lmsContext, userName);
        const disclaimer = "\n\n---\n*Catatan: Menjawab via basis pengetahuan lokal Bizzy (Mode Standar).*";
        const fullAnswer = answer + disclaimer;

        // Pecah teks menjadi token/potongan kecil untuk efek ketikan mengalir
        const chunks = fullAnswer.match(/.{1,12}/g) || [fullAnswer];
        for (const chunk of chunks) {
          sendEvent({ text: chunk });
          // jeda mikro simulasi streaming
          await new Promise((r) => setTimeout(r, 12));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err: unknown) {
        // Fallback jika API streaming gagal (misal koneksi jaringan / token error)
        try {
          const lastUserText = lastMsg.content;
          const answer = generateLocalFallbackAnswer(lastUserText, lmsContext, userName);
          const fullAnswer =
            answer +
            "\n\n---\n*Pemberitahuan: Layanan Claude API sementara tidak dapat dihubungi. Menjawab via basis pengetahuan lokal.*";

          const chunks = fullAnswer.match(/.{1,12}/g) || [fullAnswer];
          for (const chunk of chunks) {
            sendEvent({ text: chunk });
            await new Promise((r) => setTimeout(r, 10));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch {
          const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses jawaban.";
          sendEvent({
            error: message,
          });
        } finally {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

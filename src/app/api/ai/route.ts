import { NextRequest, NextResponse } from 'next/server';
import { isStudioRequest } from '@/lib/studio';
import { aiEnv, chatComplete } from '@/lib/brain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/ai — studio-only writing + study assistant.
 * Any OpenAI-compatible provider. Two ways to bring a key:
 *   1. env (Vercel → Settings → Env):
 *        OPENROUTER_API_KEY    → OpenRouter free tier (default model openrouter/free)
 *        OPENAI_API_KEY        → OpenAI or anything compatible via OPENAI_BASE_URL
 *        + optional OPENROUTER_MODEL / OPENROUTER_VISION_MODEL / OPENAI_MODEL /
 *          OPENAI_VISION_MODEL / OPENAI_EMBED_MODEL
 *   2. per-request: the studio UI can send { key } (stored only in the
 *      owner's browser; OpenRouter keys start with "sk-or-").
 * Without any key this answers 503 NO_AI_KEY and the UI degrades gracefully.
 *
 * tasks: draft · polish · tags · summary · slug · ideas   (editor)
 *        flash (flashcards from a note) · describe (bookmark blurb)
 *        voice (clean a voice transcript) · ocr (image → text, vision)
 */
const SYSTEM = 'You are the built-in writing assistant of PSYCH://OS, a terminal-punk personal operating system. Reply with PLAIN markdown only — no explanations, no code fences around the whole answer. Match the owner\'s voice: lowercase-tinted, direct, hand-made.';

const TASKS: Record<string, string> = {
  draft: 'Turn these rough bullet points into a tight markdown post section. Keep the bullets\' facts, add nothing invented:',
  polish: 'Tighten and punch up this markdown text. Same meaning, same voice, shorter where possible:',
  tags: 'Extract 3-6 lowercase tags (single words or hyphenated) from this text. Answer with ONLY the tags as a comma-separated list:',
  summary: 'Write a one-sentence TL;DR in the same voice:',
  slug: 'Propose a short lowercase-hyphenated slug (max 4 words) for this text. Answer with ONLY the slug:',
  ideas: 'Propose 5 short punchy post ideas continuing this theme. One per line, no numbering, no quotes:',
  voice: 'This is a raw voice-recognition transcript. Fix punctuation, capitalization and obvious mis-hearings, keep the meaning and the voice. Return clean markdown:',
  describe: 'Write a 1-2 sentence description of what this bookmark/page is, for a bookmark library. Plain text only:',
  flash: 'Turn this note into 3-6 flashcards for spaced repetition. One per line, format exactly "QUESTION :: ANSWER", no numbering, no extra text:',
};

type Content = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

async function runTask(task: string, text: string, key?: string): Promise<string> {
  const env = aiEnv(key);
  if (task === 'ocr') {
    const messages: { role: 'system' | 'user'; content: Content }[] = [
      { role: 'system', content: 'Transcribe ALL readable text from this image (whiteboards, handwriting, screenshots). Return plain markdown, no commentary.' },
      { role: 'user', content: [
        { type: 'text', text: 'Transcribe every word you can read here.' },
        { type: 'image_url', image_url: { url: text.slice(0, 300000) } },
      ] },
    ];
    const r = await fetch(env.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.key, ...env.extraHeaders },
      body: JSON.stringify({ model: env.visionModel, messages, max_tokens: 1200 }),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) throw new Error('AI_UPSTREAM: ' + (await r.text()).slice(0, 300));
    const j = await r.json() as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content?.trim() || '';
  }
  const prompt = TASKS[task];
  if (!prompt) throw new Error('BAD_TASK');
  return chatComplete([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt + '\n\n' + text.slice(0, 8000) },
  ], { key });
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY' }, { status: 401 });
  try {
    const body = await req.json() as { task?: string; text?: string; key?: string };
    const env = aiEnv(body.key);
    if (!env.hasKey) {
      return NextResponse.json({
        error: 'NO_AI_KEY',
        message: 'No AI key yet. Either paste your key in OS → PLUMBING → AI KEY (this browser only, works instantly), or add OPENROUTER_API_KEY (free models, e.g. openrouter/free) or OPENAI_API_KEY to your Vercel env and redeploy.',
      }, { status: 503 });
    }
    const task = body.task || 'polish';
    if (!TASKS[task] && task !== 'ocr') return NextResponse.json({ error: 'BAD_TASK', message: 'Unknown task.' }, { status: 400 });
    const out = await runTask(task, String(body.text || ''), body.key);
    return NextResponse.json({ ok: true, text: out, provider: env.provider, model: env.model });
  } catch (e) {
    const msg = String(e).replace(/^Error:\s*/, '');
    const status = msg.startsWith('BAD_TASK') ? 400 : msg.startsWith('AI_UPSTREAM') ? 502 : 500;
    return NextResponse.json({ error: 'AI_FAIL', message: msg.slice(0, 300) }, { status });
  }
}

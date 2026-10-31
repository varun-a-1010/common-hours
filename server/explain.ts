import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { EventRecord, Plan } from '../shared/model';

const CHAIN = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-4-argon'];
const TIMEOUT_MS = 8_000;

const system = `You help a workplace organizer compare event plans. For each plan, write one plain sentence, at most 22 words, on why it could suit this team, using only the brief and the plan details given. Never invent prices, availability, names or facts. Never mention anyone's private needs.`;

const output = z.object({
  lines: z.array(z.object({ id: z.string(), line: z.string().max(240) })),
});

type Account = { project?: string; serviceAccount?: string };

function connect(account: Account, location?: string) {
  if (!account.project || !account.serviceAccount) return undefined;
  const raw = account.serviceAccount.trim();
  return new GoogleGenAI({
    vertexai: true,
    project: account.project,
    location: location || 'global',
    googleAuthOptions: {
      credentials: JSON.parse(
        raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'),
      ),
    },
  });
}

/** Gemini adds one plain line to each plan. Anything that fails returns the plans unchanged. */
export function createExplainer(options: Account & { location?: string; backup?: Account }) {
  let clients: GoogleGenAI[] = [];
  try {
    clients = [
      connect(options, options.location),
      connect(options.backup ?? {}, options.location),
    ].filter((c): c is GoogleGenAI => !!c);
  } catch {
    clients = [];
  }
  if (!clients.length) return undefined;
  return async (event: EventRecord, plans: Plan[]): Promise<Plan[]> => {
    if (!plans.length) return plans;
    const contents = JSON.stringify({
      brief: {
        goal: event.brief.goal,
        headcount: event.brief.headcount,
        format: event.brief.format,
        city: event.brief.city,
      },
      plans: plans.map((p) => ({
        id: p.id,
        title: p.title,
        stops: p.blocks.map((b) => b.name),
        reasons: p.reasons,
      })),
    });
    for (const client of clients)
      for (const model of CHAIN) {
        try {
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: system,
              maxOutputTokens: 800,
              responseMimeType: 'application/json',
              responseJsonSchema: z.toJSONSchema(output),
              abortSignal: AbortSignal.timeout(TIMEOUT_MS),
            },
          });
          const lines = new Map(
            output.parse(JSON.parse(response.text ?? '')).lines.map((l) => [l.id, l.line.trim()]),
          );
          return plans.map((p) =>
            lines.get(p.id) ? { ...p, reasons: [`Gemini: ${lines.get(p.id)}`, ...p.reasons] } : p,
          );
        } catch {
          // Try the next model, then the backup project.
        }
      }
    return plans;
  };
}

export type Explainer = NonNullable<ReturnType<typeof createExplainer>>;

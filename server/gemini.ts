import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface ExtractedDocData {
  merchant?: string;
  date?: string;
  amount?: number;
  type?: 'expense' | 'income';
  category?: string;
  confidence?: 'high' | 'review';
  summary?: string;
}

export async function parseDocumentWithAi(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedDocData> {
  const ai = getAiClient();
  if (!ai) {
    return parseDocumentHeuristically(buffer.toString('utf-8'), filename);
  }

  try {
    const isText = mimeType.startsWith('text/') || filename.endsWith('.csv') || filename.endsWith('.txt');
    
    let contents: any[];
    if (isText) {
      const textContent = buffer.toString('utf-8').slice(0, 10000);
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: `You are a financial document parser. Extract the financial transaction from this document.
Filename: "${filename}"
Document text:
${textContent}

Return JSON with this exact structure:
{
  "merchant": string (payee/merchant/source),
  "date": string (ISO YYYY-MM-DD),
  "amount": number (positive magnitude total),
  "type": "expense" or "income",
  "category": string (e.g. Groceries, Utilities, Dining, Subscriptions, Income, Needs review),
  "confidence": "high" or "review" (use "review" if uncertain)
}
Only extract values if grounded in the text. If uncertain about merchant, date, or total, set confidence to "review".`
            }
          ]
        }
      ];
    } else {
      const base64Data = buffer.toString('base64');
      contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: `You are a financial document parser. Extract the single primary transaction or invoice/receipt total from this image or PDF document.
Filename: "${filename}"

Return a JSON object with this exact structure:
{
  "merchant": string (payee/merchant/vendor name),
  "date": string (ISO format YYYY-MM-DD),
  "amount": number (positive magnitude total charge),
  "type": "expense" or "income",
  "category": string (e.g. Groceries, Utilities, Dining, Subscriptions, Income, Needs review),
  "confidence": "high" or "review" (use "review" if merchant, date, or total is uncertain)
}
Never invent fake amounts. If date is not visible, use today's date YYYY-MM-DD and set confidence to "review".`
            }
          ]
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      merchant: parsed.merchant?.trim(),
      date: parsed.date?.trim(),
      amount: typeof parsed.amount === 'number' ? Math.abs(parsed.amount) : undefined,
      type: parsed.type === 'income' ? 'income' : 'expense',
      category: parsed.category || 'Needs review',
      confidence: parsed.confidence === 'review' || !parsed.merchant || !parsed.amount ? 'review' : 'high',
      summary: `${parsed.merchant || 'Document'} - $${(parsed.amount || 0).toFixed(2)}`
    };
  } catch (err) {
    console.warn('AI document parsing error, falling back to heuristic:', err);
    return parseDocumentHeuristically(buffer.toString('utf-8'), filename);
  }
}

export function parseDocumentHeuristically(text: string, filename: string): ExtractedDocData {
  // Simple heuristic extractor
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let merchant = filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  let date = new Date().toISOString().split('T')[0];
  let amount: number | undefined = undefined;

  // Search for date patterns YYYY-MM-DD or MM/DD/YYYY
  const dateMatch = text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    const parsedD = new Date(rawDate);
    if (!isNaN(parsedD.getTime())) {
      date = parsedD.toISOString().split('T')[0];
    }
  }

  // Search for total / amount patterns
  const amountMatch = text.match(/(?:total|amount|due|balance|charge|sum)[\s:$]*([0-9]+\.[0-9]{2})/i) ||
                      text.match(/\$([0-9]+\.[0-9]{2})/);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1]);
  }

  return {
    merchant: merchant.slice(0, 40),
    date,
    amount,
    type: 'expense',
    category: 'Needs review',
    confidence: amount ? 'high' : 'review'
  };
}

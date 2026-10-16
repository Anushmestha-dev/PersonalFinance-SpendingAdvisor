import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getCurrentUser } from '../../../../lib/auth';
import { getGeminiApiKey, generateGeminiContent } from '../../../../lib/gemini';
import { rateLimit } from '../../../../lib/rate-limit';
import { LRUCache } from 'lru-cache';

// In-memory cache for categorization (TTL: 1 hour)
const categorizeCache = new LRUCache<string, { category: string; categoryId: string; reason: string }>({
  max: 500,
  ttl: 60 * 60 * 1000,
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Gemini API Key configuration
    const keyResult = getGeminiApiKey();
    if ('error' in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    // Rate limit per user (30 requests per minute)
    if (!rateLimit(`ai-categorize-${user.id}`, 30)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { description, amount, type = 'EXPENSE' } = body;

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return NextResponse.json({ error: 'Description is required to suggest a category' }, { status: 400 });
    }

    const cacheKey = `${user.id}:${type}:${description.trim().toLowerCase()}`;
    const cached = categorizeCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // Fetch user and system categories matching the transaction type
    const categories = await prisma.category.findMany({
      where: {
        AND: [
          { OR: [{ userId: user.id }, { userId: null }] },
          { type: type },
        ],
      },
    });

    if (categories.length === 0) {
      return NextResponse.json({ error: 'No categories available for this transaction type' }, { status: 404 });
    }

    const categoryNames = categories.map(c => c.name);

    const prompt = `You are an intelligent financial categorization assistant.
Transaction details:
- Description: "${description}"
- Amount: INR ${amount || 'N/A'}
- Type: ${type}

Available categories: [${categoryNames.map(c => `"${c}"`).join(', ')}]

Select the single best category for this transaction from the available categories list.
Respond STRICTLY with a valid JSON object matching:
{
  "category": "Exact Category Name From List",
  "reason": "Brief 1-sentence reason"
}
Do not include any code block formatting like \`\`\`json.`;

    let selectedCategoryName = '';
    let reason = 'AI suggestion based on transaction description';

    try {
      const responseText = await generateGeminiContent(prompt);
      const cleanJson = responseText.replace(/^```json/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.category) {
        selectedCategoryName = parsed.category.trim();
        if (parsed.reason) reason = parsed.reason;
      }
    } catch (e: any) {
      console.warn('Gemini categorize fallback used:', e.message);
    }

    // Match to existing category object in DB
    let matchedCategory = categories.find(
      c => c.name.toLowerCase() === selectedCategoryName.toLowerCase()
    );

    // Rule-based fallback if Gemini did not match an exact category
    if (!matchedCategory) {
      const descLower = description.toLowerCase();
      if (/food|swiggy|zomato|restaurant|cafe|dinner|lunch|breakfast|coffee|starbucks|tea/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Food');
      } else if (/uber|ola|rapido|metro|fuel|petrol|diesel|gas|cab|auto|transport|flight|train/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Transport');
      } else if (/rent|flat|house|landlord|maintenance|society/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Rent');
      } else if (/electricity|water|wifi|broadband|recharge|mobile|bescom|utility|bill/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Utilities');
      } else if (/movie|cinema|netflix|spotify|prime|game|concert|entertainment/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Entertainment');
      } else if (/amazon|flipkart|myntra|zara|cloth|shirt|pant|shopping|mall/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Shopping');
      } else if (/doctor|hospital|pharmacy|medicine|apollo|health|clinic/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Healthcare');
      } else if (/salary|paycheck|payroll|wages/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Salary');
      } else if (/freelance|consulting|contract|client/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Freelance');
      } else if (/dividend|stock|mutual fund|zerodha|groww|investment/i.test(descLower)) {
        matchedCategory = categories.find(c => c.name === 'Investments');
      }

      if (!matchedCategory && categories.length > 0) {
        matchedCategory = categories[0];
      }
    }

    if (!matchedCategory) {
      return NextResponse.json({ error: 'Could not determine category' }, { status: 400 });
    }

    const result = {
      category: matchedCategory.name,
      categoryId: matchedCategory.id,
      reason,
    };

    categorizeCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Categorize error:', error);
    return NextResponse.json({ error: error.message || 'Failed to categorize transaction' }, { status: 500 });
  }
}

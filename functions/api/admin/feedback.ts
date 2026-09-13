import { storedFeedbackSchema, type StoredFeedback } from "../../_core/feedback-schemas";
import { createErrorResponse } from "../../_core/api-utils";
import { ERROR_MESSAGES } from "../../_core/config";
import type { Env } from "../../_core/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const listResult = await context.env.FEEDBACK_STORE.list({ prefix: 'feedback:', limit: 50 });
    
    const items: StoredFeedback[] = [];
    
    // Fetch all values in parallel
    const getPromises = listResult.keys.map(async (keyObj) => {
      const value = await context.env.FEEDBACK_STORE.get(keyObj.name);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const result = storedFeedbackSchema.safeParse(parsed);
          return result.success ? result.data : null;
        } catch {
          return null;
        }
      }
      return null;
    });

    const results = await Promise.all(getPromises);
    
    for (const res of results) {
      if (res) items.push(res);
    }

    return new Response(JSON.stringify({ success: true, items }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store' // Prevent edge caching of sensitive data
      }
    });

  } catch (err: unknown) {
    console.error('Failed to list feedback:', err);
    return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL, 500);
  }
};

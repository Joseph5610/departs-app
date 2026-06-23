import { StoredFeedback } from "../../../src/types/feedback";

interface Env {
  FEEDBACK_STORE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const listResult = await context.env.FEEDBACK_STORE.list({ prefix: 'feedback:', limit: 50 });
    
    const items: StoredFeedback[] = [];
    
    // Fetch all values in parallel
    const getPromises = listResult.keys.map(async (keyObj) => {
      const value = await context.env.FEEDBACK_STORE.get(keyObj.name);
      if (value) {
        try {
          return JSON.parse(value) as StoredFeedback;
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

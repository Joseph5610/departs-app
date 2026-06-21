import { feedbackPayloadSchema } from "../../src/types/feedback";

interface Env {
  FEEDBACK_STORE: KVNamespace;
  TURNSTILE_SECRET_KEY: string;
}

/**
 * Verifies the Cloudflare Turnstile token to ensure the request is from a human.
 * 
 * @param token - The Turnstile token sent from the client
 * @param secret - The Turnstile Secret Key from the environment
 * @param ip - The client's IP address (CF-Connecting-IP)
 * @returns A boolean indicating whether the verification was successful
 */
async function verifyTurnstile(token: string, secret: string, ip: string) {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', ip);

  console.log('Verifying Turnstile:', { secret, token, ip });

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const result = await fetch(url, {
    body: formData,
    method: 'POST',
  });

  const outcome = await result.json() as { success: boolean; "error-codes"?: string[] };
  if (!outcome.success) {
    console.error('Turnstile verification failed:', outcome);
  }
  return outcome.success;
}

/**
 * Handles POST requests to /api/feedback.
 * 
 * This endpoint processes user feedback submitted from the frontend widget.
 * It performs the following operations:
 * 1. Validates the incoming JSON payload using Zod.
 * 2. Implements IP-based rate limiting (max 5 requests per 24 hours).
 * 3. Verifies the Cloudflare Turnstile token for bot protection.
 * 4. Stores the feedback securely in a Cloudflare KV namespace.
 * 
 * @param context - The Cloudflare Pages context containing request, environment variables, etc.
 * @returns A JSON Response indicating success or failure.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.json();
    
    // 1. Validate payload using Zod
    const parsed = feedbackPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid payload', details: parsed.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = parsed.data;

    // 2. Verify Turnstile token
    const clientIp = context.request.headers.get('CF-Connecting-IP') || '';
    
    // 3. Simple Rate Limiting (max 5 feedbacks per IP per 24 hours)
    const rateLimitKey = `ratelimit:${clientIp}`;
    const currentCountStr = await context.env.FEEDBACK_STORE.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    
    if (currentCount >= 5) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use secret key exclusively from the environment (production from CF dashboard, local from .dev.vars)
    // If undefined (e.g. local dev without .dev.vars), fallback to the Cloudflare testing dummy key
    const secretKey = context.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

    const isHuman = await verifyTurnstile(data.turnstileToken, secretKey, clientIp);
    
    if (!isHuman) {
      return new Response(JSON.stringify({ error: 'Turnstile verification failed. Please try again.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Prepare data for KV
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // We omit the turnstileToken since we don't need to store it
    const feedbackData = {
      type: data.type,
      message: data.message,
      email: data.email,
      includeDiagnostics: data.includeDiagnostics,
      diagnostics: data.diagnostics
    };
    
    const kvPayload = {
      id,
      timestamp,
      ipAddress: clientIp, // Useful for spam correlation
      ...feedbackData
    };

    // 5. Store in KV
    // Key format: feedback:<reverse-timestamp>:<id> so it's chronologically sortable (newest first)
    const reverseTimestamp = Number.MAX_SAFE_INTEGER - Date.now();
    const key = `feedback:${reverseTimestamp}:${id}`;
    
    // Write feedback and update rate limit counter in parallel
    await Promise.all([
      context.env.FEEDBACK_STORE.put(key, JSON.stringify(kvPayload)),
      context.env.FEEDBACK_STORE.put(rateLimitKey, (currentCount + 1).toString(), { expirationTtl: 86400 }) // 24 hours TTL
    ]);

    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

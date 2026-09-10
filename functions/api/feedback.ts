import { feedbackPayloadSchema } from "../../src/types/feedback";
import { createErrorResponse } from "../_core/api-utils";
import { ERROR_MESSAGES } from "../_core/config";
import type { Env } from "../_core/types";

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
 * 2. Verifies the Cloudflare Turnstile token for bot protection.
 * 3. Stores the feedback securely in a Cloudflare KV namespace.
 *
 * Request-rate limiting is enforced at the Cloudflare edge, not in this handler.
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
      return createErrorResponse('Invalid payload.', 400);
    }

    const data = parsed.data;

    const clientIp = context.request.headers.get('CF-Connecting-IP') || '';

    // No fallback: the documented dummy key always passes, so a missing binding would disable Turnstile.
    const secretKey = context.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY is not configured; refusing to accept feedback.');
      return createErrorResponse('Feedback is temporarily unavailable. Please try again later.', 503);
    }

    const isHuman = await verifyTurnstile(data.turnstileToken, secretKey, clientIp);
    
    if (!isHuman) {
      return createErrorResponse('Turnstile verification failed. Please try again.', 403);
    }

    // 2. Prepare data for KV
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

    // 3. Store in KV
    // Key format: feedback:<reverse-timestamp>:<id> so it's chronologically sortable (newest first)
    const reverseTimestamp = Number.MAX_SAFE_INTEGER - Date.now();
    const key = `feedback:${reverseTimestamp}:${id}`;
    
    await context.env.FEEDBACK_STORE.put(key, JSON.stringify(kvPayload));

    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: unknown) {
    console.error('Feedback submission failed:', err);
    return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL, 500);
  }
};

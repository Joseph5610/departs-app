import { RIDE_PUSH } from '../config';

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export interface PushTarget {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

/** The application server's VAPID key pair as base64url: the 65-byte public point and the 32-byte private scalar. */
export interface VapidKeys {
    publicKey: string;
    privateKey: string;
    subject: string;
}

export const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

export const toBase64Url = (bytes: Uint8Array): string => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** An uncompressed P-256 point and its private scalar as a JWK, the only form WebCrypto imports a raw private key in. */
const p256Jwk = (publicPoint: Uint8Array, privateScalar: Uint8Array): JsonWebKey => ({
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicPoint.slice(1, 33)),
    y: toBase64Url(publicPoint.slice(33, 65)),
    d: toBase64Url(privateScalar),
});

/** Imports an application server key pair for ECDH, e.g. RFC 8291's example keys. */
export const importServerKeys = async (publicPoint: Uint8Array, privateScalar: Uint8Array): Promise<CryptoKeyPair> => ({
    publicKey: await crypto.subtle.importKey('raw', publicPoint.slice(), { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await crypto.subtle.importKey('jwk', p256Jwk(publicPoint, privateScalar), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
});

const hkdf = async (salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> => {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
};

/**
 * Encrypts a push message for one subscription (RFC 8291, `aes128gcm` content coding) as a single record.
 * `serverKeys` and `salt` are fresh per message; tests pass fixed ones.
 */
export const encryptPayload = async (
    plaintext: Uint8Array,
    uaPublic: Uint8Array<ArrayBuffer>,
    authSecret: Uint8Array<ArrayBuffer>,
    serverKeys?: CryptoKeyPair,
    salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16)),
): Promise<Uint8Array<ArrayBuffer>> => {
    const keys = serverKeys ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey) as ArrayBuffer);
    const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    // workers-types misnames the ECDH peer key `$public`; the runtime reads `public`.
    const ecdh: SubtleCryptoDeriveKeyAlgorithm & { public: CryptoKey } = { name: 'ECDH', public: uaKey };
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdh, keys.privateKey, 256));

    const ikm = await hkdf(authSecret, ecdhSecret, concat(text('WebPush: info\0'), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, concat(text('Content-Encoding: aes128gcm\0')), 16);
    const nonce = await hkdf(salt, ikm, concat(text('Content-Encoding: nonce\0')), 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));

    const header = new Uint8Array(21);
    header.set(salt);
    new DataView(header.buffer).setUint32(16, RIDE_PUSH.RECORD_SIZE);
    header[20] = asPublic.length;
    return concat(header, asPublic, ciphertext);
};

/** The `Authorization` header for a push service (RFC 8292): an ES256 JWT for the endpoint's origin, plus our public key. */
export const vapidAuthorization = async (endpoint: string, vapid: VapidKeys, nowS: number): Promise<string> => {
    const encode = (value: object) => toBase64Url(text(JSON.stringify(value)));
    const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({ aud: new URL(endpoint).origin, exp: nowS + RIDE_PUSH.VAPID_EXP_S, sub: vapid.subject })}`;
    const key = await crypto.subtle.importKey('jwk', p256Jwk(fromBase64Url(vapid.publicKey), fromBase64Url(vapid.privateKey)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(unsigned) as Uint8Array<ArrayBuffer>));
    return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${vapid.publicKey}`;
};

/** Sends one push; returns the push service's status (404/410: the subscription is gone and must be dropped). */
export const sendPush = async (target: PushTarget, payload: string, vapid: VapidKeys, nowS: number): Promise<number> => {
    const body = await encryptPayload(text(payload), fromBase64Url(target.keys.p256dh), fromBase64Url(target.keys.auth));
    const response = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
            Authorization: await vapidAuthorization(target.endpoint, vapid, nowS),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: String(RIDE_PUSH.TTL_S),
            Urgency: 'high',
        },
        body,
    });
    return response.status;
};

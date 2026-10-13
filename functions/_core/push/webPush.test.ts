import { describe, expect, it } from 'vitest';
import { encryptPayload, fromBase64Url, importServerKeys, toBase64Url, vapidAuthorization } from './webPush';

// RFC 8291 Section 5 example and Appendix A inputs.
const RFC = {
    plaintext: 'When I grow up, I want to be a watermelon',
    asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
    message: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

describe('encryptPayload', () => {
    it('produces the RFC 8291 example message from its keys and salt', async () => {
        const serverKeys = await importServerKeys(fromBase64Url(RFC.asPublic), fromBase64Url(RFC.asPrivate));
        const body = await encryptPayload(new TextEncoder().encode(RFC.plaintext), fromBase64Url(RFC.uaPublic), fromBase64Url(RFC.authSecret), serverKeys, fromBase64Url(RFC.salt));
        expect(toBase64Url(body)).toBe(RFC.message);
    });
});

describe('vapidAuthorization', () => {
    it('signs a JWT for the push service origin that our public key verifies', async () => {
        const vapid = { publicKey: RFC.asPublic, privateKey: RFC.asPrivate, subject: 'mailto:info@departs.app' };
        const header = await vapidAuthorization('https://web.push.apple.com/abc?x=1', vapid, 1_000);
        const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? [];
        expect(key).toBe(RFC.asPublic);
        const [head, claims, signature] = token.split('.');
        expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toEqual({ aud: 'https://web.push.apple.com', exp: 1_000 + 12 * 3600, sub: 'mailto:info@departs.app' });

        const verifier = await crypto.subtle.importKey('raw', fromBase64Url(RFC.asPublic), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifier, fromBase64Url(signature), new TextEncoder().encode(`${head}.${claims}`));
        expect(valid).toBe(true);
    });
});

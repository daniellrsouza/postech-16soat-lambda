import { jwtVerify, SignJWT } from "jose";

/** Emissor dos tokens de cliente (esta Lambda), P2. */
export const EMISSOR_CLIENTE = "tech-challenge-auth";
/** Emissor dos tokens de ADMIN/FUNCIONARIO (POST /auth/login da aplicação), D5. */
export const EMISSOR_APLICACAO = "tech-challenge-backend";

export const VALIDADE_SEGUNDOS = 3600;

export interface ClaimsToken {
  sub: string;
  role: string;
  iss: string;
}

function chave(segredo: string): Uint8Array {
  // Mesmos bytes que a aplicação usa (jwtSecret.getBytes() com HS256).
  return new TextEncoder().encode(segredo);
}

export async function emitirTokenCliente(
  clienteId: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(agora.getTime() / 1000);
  return new SignJWT({ role: "CLIENTE" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(clienteId)
    .setIssuer(EMISSOR_CLIENTE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + VALIDADE_SEGUNDOS)
    .sign(chave(segredo));
}

/**
 * Valida assinatura HS256, expiração e emissor. Aceita os tokens desta Lambda
 * (clientes) e os da aplicação (funcionários). Lança erro se inválido.
 */
export async function verificarToken(
  token: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<ClaimsToken> {
  const { payload } = await jwtVerify(token, chave(segredo), {
    algorithms: ["HS256"],
    issuer: [EMISSOR_CLIENTE, EMISSOR_APLICACAO],
    currentDate: agora,
  });
  if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("token sem sub ou role");
  }
  return { sub: payload.sub, role: payload.role, iss: payload.iss as string };
}

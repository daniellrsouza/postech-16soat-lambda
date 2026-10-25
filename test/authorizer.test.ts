import type { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { criarAuthorizer } from "../src/authorizer/handler";
import { emitirTokenCliente } from "../src/shared/jwt";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-bytes!!";
const CLIENTE_ID = "88888888-8888-4888-8888-888888888880";
const authorizer = criarAuthorizer(() => SEGREDO);

function evento(authorization?: string): APIGatewayRequestAuthorizerEventV2 {
  return {
    routeKey: "GET /clientes/{clienteId}/ordens",
    headers: authorization ? { authorization } : {},
    identitySource: authorization ? [authorization] : [],
    requestContext: { requestId: "req-456" },
  } as unknown as APIGatewayRequestAuthorizerEventV2;
}

describe("Lambda Authorizer", () => {
  it("autoriza token de cliente e repassa sub e role", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO);
    await expect(authorizer(evento(`Bearer ${token}`))).resolves.toEqual({
      isAuthorized: true,
      context: { sub: CLIENTE_ID, role: "CLIENTE" },
    });
  });

  it("autoriza token de funcionário emitido pela aplicação", async () => {
    const token = await new SignJWT({ role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin@oficina.com")
      .setIssuer("tech-challenge-backend")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SEGREDO));
    const r = await authorizer(evento(`Bearer ${token}`));
    expect(r).toEqual({ isAuthorized: true, context: { sub: "admin@oficina.com", role: "ADMIN" } });
  });

  it("aceita o esquema Bearer sem diferenciar maiúsculas", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO);
    expect((await authorizer(evento(`bearer ${token}`))).isAuthorized).toBe(true);
  });

  it.each([
    ["sem header", undefined],
    ["esquema diferente de Bearer", "Basic dXNlcjpzZW5oYQ=="],
    ["Bearer sem token", "Bearer"],
    ["token malformado", "Bearer nao-e-um-jwt"],
  ])("nega %s", async (_caso, header) => {
    await expect(authorizer(evento(header))).resolves.toEqual({ isAuthorized: false, context: {} });
  });

  it("nega token assinado com o segredo de outro ambiente", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, "segredo-de-prod-com-pelo-menos-32-bytes!!!");
    expect((await authorizer(evento(`Bearer ${token}`))).isAuthorized).toBe(false);
  });

  it("nega token expirado", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO, new Date(Date.now() - 2 * 3600 * 1000));
    expect((await authorizer(evento(`Bearer ${token}`))).isAuthorized).toBe(false);
  });
});

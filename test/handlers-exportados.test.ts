import type { APIGatewayProxyEventV2, APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitirTokenCliente } from "../src/shared/jwt";

// Handlers exportados (os configurados na Lambda): leem JWT_SECRET do ambiente
// e o auth-cpf usa o repositório real, aqui substituído por um mock.
vi.mock("../src/auth-cpf/repositorio", () => ({
  buscarClientePorCpf: vi.fn().mockResolvedValue({ id: "88888888-8888-4888-8888-888888888880", status: "ATIVO" }),
}));

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-bytes!!";
const eventoAuth = { body: JSON.stringify({ cpf: "52998224725" }), requestContext: {} } as unknown as APIGatewayProxyEventV2;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth-cpf exportado", () => {
  it("emite token com o JWT_SECRET do ambiente e usa fallback de correlationId", async () => {
    vi.stubEnv("JWT_SECRET", SEGREDO);
    const { handler } = await import("../src/auth-cpf/handler");
    const r = await handler(eventoAuth);
    expect(r.statusCode).toBe(200);
    expect(r.headers?.["x-correlation-id"]).toBe("sem-request-id");
  });

  it("falha explicitamente sem JWT_SECRET", async () => {
    vi.stubEnv("JWT_SECRET", "");
    const { handler } = await import("../src/auth-cpf/handler");
    await expect(handler(eventoAuth)).rejects.toThrow("JWT_SECRET");
  });
});

describe("authorizer exportado", () => {
  const eventoAuthz = (authorization: string) =>
    ({ headers: { authorization }, requestContext: {} }) as unknown as APIGatewayRequestAuthorizerEventV2;

  it("valida com o JWT_SECRET do ambiente", async () => {
    vi.stubEnv("JWT_SECRET", SEGREDO);
    const { handler } = await import("../src/authorizer/handler");
    const token = await emitirTokenCliente("cliente-1", SEGREDO);
    expect((await handler(eventoAuthz(`Bearer ${token}`))).isAuthorized).toBe(true);
  });

  it("nega quando JWT_SECRET está ausente", async () => {
    vi.stubEnv("JWT_SECRET", "");
    const { handler } = await import("../src/authorizer/handler");
    const token = await emitirTokenCliente("cliente-1", SEGREDO);
    expect((await handler(eventoAuthz(`Bearer ${token}`))).isAuthorized).toBe(false);
  });

  it("usa identitySource quando não há header", async () => {
    vi.stubEnv("JWT_SECRET", SEGREDO);
    const { handler } = await import("../src/authorizer/handler");
    const token = await emitirTokenCliente("cliente-1", SEGREDO);
    const evento = { identitySource: [`Bearer ${token}`], requestContext: {} } as unknown as APIGatewayRequestAuthorizerEventV2;
    expect((await handler(evento)).isAuthorized).toBe(true);
  });
});

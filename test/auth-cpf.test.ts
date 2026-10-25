import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { decodeJwt } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarHandler, type Dependencias } from "../src/auth-cpf/handler";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-bytes!!";
const CLIENTE_ID = "88888888-8888-4888-8888-888888888880";

function evento(body: string | undefined, isBase64Encoded = false): APIGatewayProxyEventV2 {
  return {
    body,
    isBase64Encoded,
    requestContext: { requestId: "req-123" },
  } as unknown as APIGatewayProxyEventV2;
}

function handlerCom(buscarCliente: Dependencias["buscarCliente"]) {
  return criarHandler({ buscarCliente, segredoJwt: () => SEGREDO });
}

const corpo = (r: APIGatewayProxyStructuredResultV2) => JSON.parse(r.body as string);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /auth/cpf", () => {
  it("200 com accessToken para cliente ATIVO", async () => {
    const buscar = vi.fn().mockResolvedValue({ id: CLIENTE_ID, status: "ATIVO" });
    const r = await handlerCom(buscar)(evento(JSON.stringify({ cpf: "529.982.247-25" })));

    expect(r.statusCode).toBe(200);
    expect(buscar).toHaveBeenCalledWith("52998224725");
    const claims = decodeJwt(corpo(r).accessToken);
    expect(claims).toMatchObject({ sub: CLIENTE_ID, role: "CLIENTE", iss: "tech-challenge-auth" });
    expect(r.headers?.["x-correlation-id"]).toBe("req-123");
  });

  it("aceita corpo em base64", async () => {
    const buscar = vi.fn().mockResolvedValue({ id: CLIENTE_ID, status: "ATIVO" });
    const body = Buffer.from(JSON.stringify({ cpf: "52998224725" })).toString("base64");
    const r = await handlerCom(buscar)(evento(body, true));
    expect(r.statusCode).toBe(200);
  });

  it.each([
    ["CPF com dígito verificador errado", JSON.stringify({ cpf: "52998224724" })],
    ["CPF ausente", JSON.stringify({})],
    ["CPF numérico", JSON.stringify({ cpf: 52998224725 })],
    ["corpo vazio", undefined],
    ["JSON inválido", "{cpf:"],
  ])("400 para %s, sem consultar o banco", async (_caso, body) => {
    const buscar = vi.fn();
    const r = await handlerCom(buscar)(evento(body));
    expect(r.statusCode).toBe(400);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("404 quando o cliente não existe", async () => {
    const r = await handlerCom(vi.fn().mockResolvedValue(null))(evento(JSON.stringify({ cpf: "52998224725" })));
    expect(r.statusCode).toBe(404);
    expect(corpo(r)).toEqual({ message: "Cliente não encontrado" });
  });

  it.each(["INATIVO", "BLOQUEADO"])("403 quando o cliente está %s", async (status) => {
    const buscar = vi.fn().mockResolvedValue({ id: CLIENTE_ID, status });
    const r = await handlerCom(buscar)(evento(JSON.stringify({ cpf: "52998224725" })));
    expect(r.statusCode).toBe(403);
    expect(corpo(r)).not.toHaveProperty("accessToken");
  });

  it("500 e log de erro de integração quando o banco falha", async () => {
    const erroLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const buscar = vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT"));
    const r = await handlerCom(buscar)(evento(JSON.stringify({ cpf: "52998224725" })));

    expect(r.statusCode).toBe(500);
    const linha = JSON.parse(erroLog.mock.calls[0][0] as string);
    expect(linha).toMatchObject({ level: "ERROR", integration: "postgres", correlationId: "req-123" });
  });

  it("não registra o CPF completo nos logs", async () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    await handlerCom(vi.fn().mockResolvedValue(null))(evento(JSON.stringify({ cpf: "52998224725" })));
    const logs = info.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logs).not.toContain("52998224725");
    expect(logs).toContain("*********25");
  });
});

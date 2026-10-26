import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";
import { EMISSOR_APLICACAO, EMISSOR_CLIENTE, emitirTokenCliente, VALIDADE_SEGUNDOS, verificarToken } from "../src/shared/jwt";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-bytes!!";
const CLIENTE_ID = "88888888-8888-4888-8888-888888888880";

async function tokenAplicacao(segredo = SEGREDO, iss = EMISSOR_APLICACAO, expiraEm = "1h") {
  // Mesmo formato do JwtTokenGenerator da aplicação (POST /auth/login).
  return new SignJWT({ role: "FUNCIONARIO" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("mecanico@oficina.com")
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(new TextEncoder().encode(segredo));
}

describe("emitirTokenCliente", () => {
  it("gera JWT HS256 com as claims do P2", async () => {
    const agora = new Date("2026-10-25T12:00:00Z");
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO, agora);

    expect(decodeProtectedHeader(token).alg).toBe("HS256");
    const claims = decodeJwt(token);
    expect(claims.sub).toBe(CLIENTE_ID);
    expect(claims.role).toBe("CLIENTE");
    expect(claims.iss).toBe(EMISSOR_CLIENTE);
    expect(claims.iat).toBe(agora.getTime() / 1000);
    expect(claims.exp).toBe(agora.getTime() / 1000 + VALIDADE_SEGUNDOS);
    expect(claims).not.toHaveProperty("cpf");
  });
});

describe("verificarToken", () => {
  it("aceita o token de cliente emitido pela Lambda", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO);
    await expect(verificarToken(token, SEGREDO)).resolves.toEqual({
      sub: CLIENTE_ID,
      role: "CLIENTE",
      iss: EMISSOR_CLIENTE,
    });
  });

  it("aceita o token de funcionário emitido pela aplicação", async () => {
    const claims = await verificarToken(await tokenAplicacao(), SEGREDO);
    expect(claims).toMatchObject({ role: "FUNCIONARIO", iss: EMISSOR_APLICACAO });
  });

  it("rejeita token assinado com outro segredo (ex.: de outro ambiente)", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, "outro-segredo-com-pelo-menos-32-bytes!!!!");
    await expect(verificarToken(token, SEGREDO)).rejects.toThrow();
  });

  it("rejeita token expirado", async () => {
    const token = await emitirTokenCliente(CLIENTE_ID, SEGREDO, new Date("2026-10-25T10:00:00Z"));
    await expect(verificarToken(token, SEGREDO, new Date("2026-10-25T11:00:01Z"))).rejects.toThrow();
  });

  it("rejeita emissor desconhecido", async () => {
    await expect(verificarToken(await tokenAplicacao(SEGREDO, "outro-emissor"), SEGREDO)).rejects.toThrow();
  });

  it("rejeita token sem assinatura (alg none)", async () => {
    const [cabecalho, corpo] = (await emitirTokenCliente(CLIENTE_ID, SEGREDO)).split(".");
    const semAssinatura = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${corpo}.`;
    expect(cabecalho).toBeTruthy();
    await expect(verificarToken(semAssinatura, SEGREDO)).rejects.toThrow();
  });

  it("rejeita token sem role", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(CLIENTE_ID)
      .setIssuer(EMISSOR_CLIENTE)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SEGREDO));
    await expect(verificarToken(token, SEGREDO)).rejects.toThrow("token sem sub ou role");
  });
});

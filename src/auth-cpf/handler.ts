import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { cpfValido, mascararCpf, normalizarCpf } from "../shared/cpf";
import { emitirTokenCliente } from "../shared/jwt";
import { criarLogger } from "../shared/logger";
import { buscarClientePorCpf, type ClienteAutenticavel } from "./repositorio";

export interface Dependencias {
  buscarCliente: (cpf: string) => Promise<ClienteAutenticavel | null>;
  segredoJwt: () => string;
}

function resposta(
  statusCode: number,
  corpo: Record<string, unknown>,
  correlationId: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
    body: JSON.stringify(corpo),
  };
}

function lerCorpo(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) {
    return undefined;
  }
  const texto = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(texto);
}

/**
 * POST /auth/cpf { "cpf": "..." } → { "accessToken": "..." } (P3).
 * 400 CPF inválido · 404 cliente inexistente · 403 cliente não ativo.
 */
export function criarHandler(deps: Dependencias) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const correlationId = event.requestContext?.requestId ?? "sem-request-id";
    const log = criarLogger("auth-cpf", correlationId);

    let corpo: unknown;
    try {
      corpo = lerCorpo(event);
    } catch {
      log.warn("corpo da requisição não é JSON válido");
      return resposta(400, { message: "Corpo da requisição deve ser um JSON com o campo cpf" }, correlationId);
    }

    const cpf = normalizarCpf((corpo as { cpf?: unknown } | undefined)?.cpf);
    if (!cpf || !cpfValido(cpf)) {
      log.warn("CPF inválido");
      return resposta(400, { message: "CPF inválido" }, correlationId);
    }

    let cliente: ClienteAutenticavel | null;
    try {
      cliente = await deps.buscarCliente(cpf);
    } catch (erro) {
      // Falha de integração com o banco: aparece no log e no dashboard de erros.
      log.error("falha ao consultar o cliente no banco", {
        integration: "postgres",
        error: erro instanceof Error ? erro.message : String(erro),
      });
      return resposta(500, { message: "Erro ao autenticar" }, correlationId);
    }

    if (!cliente) {
      log.info("cliente não encontrado", { cpf: mascararCpf(cpf) });
      return resposta(404, { message: "Cliente não encontrado" }, correlationId);
    }

    if (cliente.status !== "ATIVO") {
      log.info("cliente não está ativo", { cpf: mascararCpf(cpf), clienteId: cliente.id, status: cliente.status });
      return resposta(403, { message: "Cliente não está ativo" }, correlationId);
    }

    const accessToken = await emitirTokenCliente(cliente.id, deps.segredoJwt());
    log.info("token emitido", { clienteId: cliente.id });
    return resposta(200, { accessToken }, correlationId);
  };
}

export const handler = criarHandler({
  buscarCliente: buscarClientePorCpf,
  segredoJwt: () => {
    const segredo = process.env.JWT_SECRET;
    if (!segredo) {
      throw new Error("variável de ambiente ausente: JWT_SECRET");
    }
    return segredo;
  },
});

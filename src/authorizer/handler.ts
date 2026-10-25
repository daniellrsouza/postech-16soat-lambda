import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from "aws-lambda";
import { verificarToken } from "../shared/jwt";
import { criarLogger } from "../shared/logger";

export interface ContextoAutorizado {
  sub: string;
  role: string;
}

type Resultado = APIGatewaySimpleAuthorizerWithContextResult<ContextoAutorizado | Record<string, never>>;

/**
 * Lambda Authorizer do API Gateway (D6), resposta simples do payload 2.0.
 * Valida o JWT (HS256, expiração, emissor da Lambda ou da aplicação) e repassa
 * sub e role no contexto. A autorização por perfil continua na aplicação.
 */
export function criarAuthorizer(segredoJwt: () => string) {
  return async (event: APIGatewayRequestAuthorizerEventV2): Promise<Resultado> => {
    const correlationId = event.requestContext?.requestId ?? "sem-request-id";
    const log = criarLogger("authorizer", correlationId);

    const cabecalho = event.headers?.authorization ?? event.identitySource?.[0] ?? "";
    const [esquema, token] = cabecalho.split(" ");
    if (esquema?.toLowerCase() !== "bearer" || !token) {
      log.warn("requisição sem Bearer token", { routeKey: event.routeKey });
      return { isAuthorized: false, context: {} };
    }

    try {
      const claims = await verificarToken(token, segredoJwt());
      log.info("token aceito", { routeKey: event.routeKey, sub: claims.sub, role: claims.role, iss: claims.iss });
      return { isAuthorized: true, context: { sub: claims.sub, role: claims.role } };
    } catch (erro) {
      log.warn("token rejeitado", {
        routeKey: event.routeKey,
        reason: erro instanceof Error ? erro.name : "desconhecido",
      });
      return { isAuthorized: false, context: {} };
    }
  };
}

export const handler = criarAuthorizer(() => {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error("variável de ambiente ausente: JWT_SECRET");
  }
  return segredo;
});

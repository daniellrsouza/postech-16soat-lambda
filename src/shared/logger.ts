type Nivel = "INFO" | "WARN" | "ERROR";

/**
 * Log estruturado em JSON (uma linha por evento), com o correlationId do
 * API Gateway: o mesmo $context.requestId do access log e do header
 * X-Correlation-Id recebido pela aplicação.
 */
export function criarLogger(servico: string, correlationId: string) {
  const escrever = (nivel: Nivel, mensagem: string, campos: Record<string, unknown> = {}) => {
    const linha = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: nivel,
      service: servico,
      correlationId,
      message: mensagem,
      ...campos,
    });
    if (nivel === "ERROR") {
      console.error(linha);
    } else {
      console.log(linha);
    }
  };
  return {
    info: (mensagem: string, campos?: Record<string, unknown>) => escrever("INFO", mensagem, campos),
    warn: (mensagem: string, campos?: Record<string, unknown>) => escrever("WARN", mensagem, campos),
    error: (mensagem: string, campos?: Record<string, unknown>) => escrever("ERROR", mensagem, campos),
  };
}

export type Logger = ReturnType<typeof criarLogger>;

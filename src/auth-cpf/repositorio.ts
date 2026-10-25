import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export type StatusCliente = "ATIVO" | "INATIVO" | "BLOQUEADO";

export interface ClienteAutenticavel {
  id: string;
  status: StatusCliente;
}

let pool: pg.Pool | undefined;

function variavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`variável de ambiente ausente: ${nome}`);
  }
  return valor;
}

// Pool fora do handler: reaproveitado entre invocações do mesmo container.
function obterPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: variavel("DB_HOST"),
      port: Number(process.env.DB_PORT ?? "5432"),
      database: variavel("DB_NAME"),
      user: variavel("DB_USER"),
      password: variavel("DB_PASSWORD"),
      max: 2,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      // TLS com verificação do certificado do RDS (bundle oficial da AWS,
      // copiado para o pacote no build).
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync(join(__dirname, "rds-global-bundle.pem"), "utf8"),
      },
    });
  }
  return pool;
}

export async function buscarClientePorCpf(cpf: string): Promise<ClienteAutenticavel | null> {
  const resultado = await obterPool().query<ClienteAutenticavel>(
    "SELECT id, status FROM clientes WHERE cpf_cnpj = $1 LIMIT 1",
    [cpf],
  );
  return resultado.rows[0] ?? null;
}

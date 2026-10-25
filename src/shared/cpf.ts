/**
 * Normaliza um CPF recebido do cliente: aceita só dígitos ou a máscara
 * 000.000.000-00. Devolve os 11 dígitos (formato gravado em clientes.cpf_cnpj)
 * ou null quando o formato não é de CPF.
 */
export function normalizarCpf(entrada: unknown): string | null {
  if (typeof entrada !== "string") {
    return null;
  }
  const valor = entrada.trim();
  if (!/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(valor)) {
    return null;
  }
  return valor.replace(/\D/g, "");
}

/** Valida os dois dígitos verificadores de um CPF de 11 dígitos. */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const digitoVerificador = (base: string): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digitoVerificador(cpf.slice(0, 9)) === Number(cpf[9]) &&
    digitoVerificador(cpf.slice(0, 10)) === Number(cpf[10])
  );
}

/** CPF para log (LGPD): mantém só os 2 últimos dígitos. */
export function mascararCpf(cpf: string): string {
  return `*********${cpf.slice(-2)}`;
}

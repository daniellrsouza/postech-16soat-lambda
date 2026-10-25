import { describe, expect, it } from "vitest";
import { cpfValido, mascararCpf, normalizarCpf } from "../src/shared/cpf";

describe("normalizarCpf", () => {
  it("aceita 11 dígitos", () => {
    expect(normalizarCpf("52998224725")).toBe("52998224725");
  });

  it("aceita a máscara 000.000.000-00 e remove a pontuação", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
  });

  it("ignora espaços nas pontas", () => {
    expect(normalizarCpf("  52998224725 ")).toBe("52998224725");
  });

  it.each([undefined, null, 52998224725, "", "5299822472", "529982247250", "529.98224725", "abc.def.ghi-jk", "52998224725a"])(
    "rejeita %s",
    (entrada) => {
      expect(normalizarCpf(entrada)).toBeNull();
    },
  );
});

describe("cpfValido", () => {
  it.each(["52998224725", "11144477735", "39053344705"])("aceita CPF válido %s", (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  // 10387398790 está no seed da aplicação (V13), que só valida o formato: o
  // primeiro dígito verificador correto seria 0.
  it.each(["52998224724", "11144477736", "12345678900", "10387398790"])("rejeita dígito verificador errado em %s", (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  it.each(["00000000000", "11111111111", "99999999999"])("rejeita sequência repetida %s", (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  it("rejeita formato diferente de 11 dígitos", () => {
    expect(cpfValido("529.982.247-25")).toBe(false);
  });
});

describe("mascararCpf", () => {
  it("mantém só os 2 últimos dígitos", () => {
    expect(mascararCpf("52998224725")).toBe("*********25");
  });
});

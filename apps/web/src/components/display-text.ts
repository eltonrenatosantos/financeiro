const DISPLAY_REPLACEMENTS: Record<string, string> = {
  oculos: "Óculos",
  condominio: "Condomínio",
  emprestimo: "Empréstimo",
  salario: "Salário",
  saude: "Saúde",
  educacao: "Educação",
  mes: "Mês",
  agua: "Água",
  energia: "Energia",
  prolabore: "Pró-labore",
  sacolao: "Sacolão",
  almoco: "Almoço",
  conexao: "Conexão",
  variavel: "Variável",
};

export function formatDisplayText(value: string) {
  if (!value) {
    return value;
  }

  const normalized = value
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const replacement = DISPLAY_REPLACEMENTS[part.toLowerCase()];

      if (replacement) {
        return replacement;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");

  return normalized
    .replace(/\bDo\b/g, "do")
    .replace(/\bDa\b/g, "da")
    .replace(/\bDe\b/g, "de")
    .replace(/\bE\b/g, "e");
}


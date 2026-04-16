const text = "Importante Mantenha seu e-mail e telefones sempre atualizados. Acesse claro.com.br/minha-claro";
const suppliers = [
  { nome: "ATUALIZA" },
  { nome: "CLARO" }
];

const normalize = (s) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const results = suppliers.map((s) => {
  const normS = normalize(s.nome);
  const regex = new RegExp(`\\b${normS}\\b`, 'i');
  const hasFullMatch = regex.test(text.toUpperCase());
  let score = hasFullMatch ? normS.length : 0;
  if (hasFullMatch && (normS === 'CLARO' || normS === 'ENERGISA')) score += 1000;
  return { nome: s.nome, score };
});

console.log(JSON.stringify(results, null, 2));

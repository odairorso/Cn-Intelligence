import { sql, SqlQuery } from '../api/_db.js';

// Adicionamos a função sql.join temporariamente para teste local
sql.join = (queries, separator = '') => {
  if (!Array.isArray(queries) || queries.length === 0) {
    return new SqlQuery([''], []);
  }

  const values = [];
  const strings = [''];
  const sep = (separator && separator._isSqlQuery) 
    ? separator 
    : new SqlQuery([String(separator)], []);

  queries.forEach((q, idx) => {
    if (idx > 0) {
      values.push(sep);
      strings.push('');
    }
    values.push(q);
    strings.push('');
  });

  return new SqlQuery(strings, values);
};

const q1 = sql`vencimento = ${'2026-06-24'}`;
const q2 = sql`valor = ${100.50}`;
const q3 = sql`status = ${'PAGO'}`;

const joined = sql.join([q1, q2, q3], sql` OR `);
const joinedStringSep = sql.join([q1, q2, q3], ' AND ');

console.log('--- TEST WITH SqlQuery SEPARATOR ---');
const built1 = joined.build();
console.log('Query:', built1.query);
console.log('Params:', built1.params);

console.log('\n--- TEST WITH STRING SEPARATOR ---');
const built2 = joinedStringSep.build();
console.log('Query:', built2.query);
console.log('Params:', built2.params);

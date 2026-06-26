const excelEpoch = Date.UTC(1899, 11, 30);
const val = 46030;
const dt = new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
console.log(`Val: ${val}`);
console.log(`Date: ${dt.toUTCString()}`);
console.log(`Year: ${dt.getUTCFullYear()}`);
console.log(`Month: ${dt.getUTCMonth() + 1}`);
console.log(`Day: ${dt.getUTCDate()}`);

const fs = require('fs');

function main() {
  const content = fs.readFileSync('scratch/excel_analysis.txt', 'utf16le');
  
  console.log("Searching for Batistote and values in excel_analysis.txt...");
  const lines = content.split('\n');
  
  const searchTerms = ['BATISTOTE', '2036.45', '6119.18', '1600', '1640', '3174', '2368'];
  
  lines.forEach((line, index) => {
    const upperLine = line.toUpperCase();
    if (searchTerms.some(term => upperLine.includes(term))) {
      console.log(`[Line ${index + 1}]`, line.trim());
    }
  });
}

main();

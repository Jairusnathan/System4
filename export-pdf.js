const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

async function main() {
  const targetArg = process.argv[2] || 'ETL_Pipeline_Architecture.md';
  const mdFilename = targetArg.endsWith('.md') ? targetArg : `${targetArg}.md`;
  const pdfFilename = mdFilename.replace(/\.md$/, '.pdf');
  
  console.log(`Starting PDF generation for ${mdFilename}...`);
  try {
    const mdPath = path.join(__dirname, mdFilename);
    const pdfPath = path.join(__dirname, pdfFilename);
    
    if (!fs.existsSync(mdPath)) {
      console.error(`Error: Source file does not exist at ${mdPath}`);
      process.exit(1);
    }
    
    console.log(`Reading from: ${mdPath}`);
    console.log(`Writing to: ${pdfPath}`);
    
    const pdf = await mdToPdf({ path: mdPath });
    
    fs.writeFileSync(pdfPath, pdf.content);
    console.log('✓ PDF generated successfully!');
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    process.exit(1);
  }
}

main();

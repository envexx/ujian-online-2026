const fs = require('fs');
const path = require('path');

// Files with [id] dynamic routes that need fixing
const filesToFix = [
  'src/app/api/guru/ujian/[id]/nilai/route.ts',
  'src/app/api/guru/ujian/[id]/route.ts',
  'src/app/api/siswa/tugas/[id]/route.ts',
  'src/app/api/siswa/ujian/[id]/hasil/route.ts',
  'src/app/api/siswa/ujian/[id]/route.ts',
  'src/app/api/siswa/ujian/[id]/submit/route.ts',
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Fix: { params }: { params: { id: string } } -> { params }: { params: Promise<{ id: string }> }
  content = content.replace(
    /\{ params \}: \{ params: \{ id: string \} \}/g,
    '{ params }: { params: Promise<{ id: string }> }'
  );
  
  // Add await params at the start of function if not already there
  if (content.includes('{ params }: { params: Promise<{ id: string }> }') && !content.includes('const { id } = await params;')) {
    // Find the first try { and add the await params line after it
    content = content.replace(
      /(\{ params \}: \{ params: Promise<\{ id: string \}> \}\s*\)\s*\{\s*try \{)/,
      '$1\n    const { id } = await params;'
    );
  }
  
  // Replace all params.id with id
  content = content.replace(/params\.id/g, 'id');
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✓ Fixed ${filePath}`);
});

console.log('\nAll files fixed!');

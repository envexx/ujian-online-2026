const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all .tsx files in admin directory
const files = glob.sync('src/app/(main)/admin/**/*.tsx', { cwd: __dirname });

files.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Remove error from destructuring
  if (content.includes(', error,')) {
    content = content.replace(/, error,/g, ',');
    modified = true;
  }
  
  // Remove error check blocks
  if (content.includes('if (error)')) {
    content = content.replace(/\n\s*if \(error\) \{[\s\S]*?\n\s*\}\n/g, '\n');
    modified = true;
  }
  
  // Fix .data access with type assertion
  const dataAccessRegex = /const (\w+) = (\w+Data)\?\.data \|\| \[\];/g;
  if (content.match(dataAccessRegex)) {
    content = content.replace(dataAccessRegex, 'const $1 = ($2 as any)?.data || [];');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
  }
});

console.log('\nAll admin files checked!');

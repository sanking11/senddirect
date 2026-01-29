const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, 'js');
const SRC_DIR = path.join(__dirname, 'js-src');

// Backup originals to js-src/ (only if not already backed up)
if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR);
    console.log('Backing up original JS files to js-src/...');
    const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
    files.forEach(file => {
        fs.copyFileSync(path.join(JS_DIR, file), path.join(SRC_DIR, file));
    });
    console.log(`Backed up ${files.length} files`);
}

// Obfuscate each JS file
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));

console.log('Obfuscating JavaScript files...\n');

files.forEach(file => {
    const inputPath = path.join(SRC_DIR, file);
    const outputPath = path.join(JS_DIR, file);
    const code = fs.readFileSync(inputPath, 'utf-8');

    const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    });

    fs.writeFileSync(outputPath, result.getObfuscatedCode());
    const originalSize = (code.length / 1024).toFixed(1);
    const newSize = (result.getObfuscatedCode().length / 1024).toFixed(1);
    console.log(`  ${file}: ${originalSize}KB -> ${newSize}KB`);
});

console.log('\nDone! Original files saved in js-src/');

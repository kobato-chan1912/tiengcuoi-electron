const fs = require('fs');
const path = require('path');

const effectsDir = path.join(__dirname, 'data', 'effects');
const musicsDir = path.join(__dirname, 'data', 'musics');
const outputPath = path.join(__dirname, 'default_database.json');

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getFiles(dir, type) {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
        .filter(file => file.endsWith('.mp3') || file.endsWith('.wav'))
        .map(file => {
            const name = path.parse(file).name;
            return {
                label: capitalize(name),
                type: type,
                path: path.join('data', type === 'effect' ? 'effects' : 'musics', file),
                shortcut: "",
                builtin: true
            };
        });
}

const effects = getFiles(effectsDir, 'effect');
const musics = getFiles(musicsDir, 'music');

const database = [...effects, ...musics];

fs.writeFileSync(outputPath, JSON.stringify(database, null, 2), 'utf8');

console.log(`✅ Đã tạo xong file ${outputPath} với ${database.length} mục.`);

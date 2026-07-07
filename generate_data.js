const fs = require('fs');
const path = require('path');
const http = require('https');

// Paths
const sourceTxt = path.join(__dirname, '..', 'TOPIK-I-1671.txt');
const vocabularyTxt = path.join(__dirname, '..', 'TOPIK_I_Vocabulary.txt');
const outputPath = path.join(__dirname, 'words.js');

console.log(`Reading source file from: ${sourceTxt}`);
if (!fs.existsSync(sourceTxt)) {
    console.error('Error: TOPIK-I-1671.txt not found in workspace root.');
    process.exit(1);
}

const content = fs.readFileSync(sourceTxt, 'utf8');
const lines = content.split(/\r?\n/).map(line => line.trim());

// Stateful header filtering
const filtered = [];
let inHeader = false;
const headers = ['TOPIK I Vocabulary（Beginner）', '한글', 'No.', 'English'];

for (let i = 0; i < lines.length; i++) {
    const text = lines[i].replace(/^\x0c/, '').trim();
    if (text.length === 0) {
        continue;
    }
    
    if (text.includes('TOPIK I Vocabulary')) {
        inHeader = true;
        continue;
    }
    
    if (inHeader) {
        if (text === 'No.' || text === '한글' || text === 'English') {
            continue;
        } else {
            inHeader = false;
        }
    }
    
    filtered.push(text);
}

// Fix anomaly in filtered list
for (let j = 0; j < filtered.length - 7; j++) {
    if (filtered[j] === '1039 여행사' && 
        filtered[j+1] === 'travel agency, travel firm' &&
        filtered[j+2] === 'difficult' &&
        filtered[j+3] === '1040 역' &&
        filtered[j+4] === 'station' &&
        filtered[j+5] === '1000 어렵다' &&
        filtered[j+6] === '1041 역사' &&
        filtered[j+7] === 'history') {
        
        console.log(`Fixing layout anomaly around word 1000...`);
        const temp = [
            '1039 여행사',
            'travel agency, travel firm',
            '1000 어렵다',
            'difficult',
            '1040 역',
            'station',
            '1041 역사',
            'history'
        ];
        for (let k = 0; k < 8; k++) {
            filtered[j+k] = temp[k];
        }
        break;
    }
}

// Parse English base words
const baseWords = [];
let i = 0;
while (i < filtered.length) {
    const current = filtered[i];
    const matchJoined = current.match(/^(\d+)\s+(.+)$/);
    if (matchJoined) {
        baseWords.push({
            id: parseInt(matchJoined[1], 10),
            korean: matchJoined[2],
            english: filtered[i+1]
        });
        i += 2;
        continue;
    }
    const matchNumberOnly = current.match(/^\d+$/);
    if (matchNumberOnly) {
        baseWords.push({
            id: parseInt(current, 10),
            korean: filtered[i+1],
            english: filtered[i+2]
        });
        i += 3;
        continue;
    }
    i++;
}

console.log(`Parsed ${baseWords.length} base English words.`);

// Parse Curated Indonesian translations from TOPIK_I_Vocabulary.txt (mapping by Korean word)
const koreanToIndonesian = {};
if (fs.existsSync(vocabularyTxt)) {
    const vocContent = fs.readFileSync(vocabularyTxt, 'utf8');
    const vocLines = vocContent.split(/\r?\n/).map(line => line.trim());
    const pattern = /^(\d+)\.\s+([^|]+)\|\s+([^|]+)\|\s+([^|]+)\|\s*([^|]*)\|\s*([^|]*)$/;
    
    vocLines.forEach(line => {
        if (line.match(/^\d+\./)) {
            const match = line.match(pattern);
            if (match) {
                const korean = match[2].trim();
                const indonesian = match[4].trim();
                koreanToIndonesian[korean] = indonesian;
            }
        }
    });
    console.log(`Loaded ${Object.keys(koreanToIndonesian).length} curated Indonesian translations by Korean spelling.`);
} else {
    console.warn(`Warning: TOPIK_I_Vocabulary.txt not found. Will translate everything via API.`);
}

// Helper to translate a batch of texts
function translateBatch(texts, callback) {
    const combinedText = texts.join('\n');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(combinedText)}`;
    
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const translation = parsed[0].map(item => item[0]).join('');
                const lines = translation.split('\n').map(l => l.trim());
                callback(null, lines);
            } catch (e) {
                callback(e, null);
            }
        });
    }).on('error', (err) => {
        callback(err, null);
    });
}

// Helper to translate single word (fallback)
function translateSingle(text, callback) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(text)}`;
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const translation = parsed[0].map(item => item[0]).join('');
                callback(null, translation.trim());
            } catch (e) {
                callback(e, null);
            }
        });
    }).on('error', (err) => {
        callback(err, null);
    });
}

// Post-processing to clean duplicate terms and format nicely
function cleanTranslation(text) {
    if (!text) return '';
    const parts = text.split(',').map(p => p.trim().toLowerCase());
    const unique = [...new Set(parts)];
    return unique.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
}

// Map over baseWords, checking if we have curated Indonesian.
const needTranslation = [];
baseWords.forEach((word, idx) => {
    if (koreanToIndonesian[word.korean]) {
        word.indonesian = cleanTranslation(koreanToIndonesian[word.korean]);
    } else {
        needTranslation.push({ wordIdx: idx, english: word.english });
    }
});

console.log(`Need to translate ${needTranslation.length} words via API.`);

// Translate queue in batches of 40
const BATCH_SIZE = 40;
let batchIndex = 0;

function processNextBatch() {
    if (batchIndex * BATCH_SIZE >= needTranslation.length) {
        console.log('All translations completed.');
        saveDatabase();
        return;
    }
    
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, needTranslation.length);
    const slice = needTranslation.slice(start, end);
    const texts = slice.map(item => item.english);
    
    console.log(`Translating batch ${batchIndex + 1}/${Math.ceil(needTranslation.length / BATCH_SIZE)} (words ${start + 1}-${end})...`);
    
    translateBatch(texts, (err, results) => {
        if (err || results.length !== texts.length) {
            console.warn(`Batch ${batchIndex + 1} mismatch or error. Falling back to single translations.`);
            translateSliceSequentially(slice, 0, () => {
                batchIndex++;
                setTimeout(processNextBatch, 300);
            });
        } else {
            slice.forEach((item, idx) => {
                const word = baseWords[item.wordIdx];
                word.indonesian = cleanTranslation(results[idx]);
            });
            batchIndex++;
            setTimeout(processNextBatch, 300); // polite delay
        }
    });
}

function translateSliceSequentially(slice, idx, onComplete) {
    if (idx >= slice.length) {
        onComplete();
        return;
    }
    const item = slice[idx];
    translateSingle(item.english, (err, result) => {
        const word = baseWords[item.wordIdx];
        if (err) {
            console.error(`Error translating single "${item.english}":`, err.message);
            word.indonesian = cleanTranslation(item.english);
        } else {
            word.indonesian = cleanTranslation(result);
        }
        setTimeout(() => translateSliceSequentially(slice, idx + 1, onComplete), 200);
    });
}

function saveDatabase() {
    baseWords.sort((a, b) => a.id - b.id);
    const fileContent = `// Automatically generated with Indonesian translations. Do not edit directly.
window.TOPIK_WORDS = ${JSON.stringify(baseWords, null, 2)};
`;
    fs.writeFileSync(outputPath, fileContent, 'utf8');
    console.log(`Successfully wrote ${baseWords.length} words to ${outputPath}`);
}

// Start translation
processNextBatch();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeString = normalizeString;
exports.normalizeProjectName = normalizeProjectName;
exports.levenshteinDistance = levenshteinDistance;
exports.fuzzyMatchNeighborhood = fuzzyMatchNeighborhood;
function normalizeString(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function normalizeProjectName(name) {
    if (!name)
        return '';
    let normalized = normalizeString(name);
    const genericTerms = ['edificio', 'residencial', 'condominio', 'complexo', 'empreendimento'];
    for (const term of genericTerms) {
        normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'g'), '');
    }
    return normalized.replace(/\s+/g, ' ').trim();
}
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
function fuzzyMatchNeighborhood(input) {
    const normalizedInput = normalizeString(input);
    const neighborhoods = [
        { name: 'Cabo Branco', normalized: normalizeString('Cabo Branco') },
        { name: 'Tambau', normalized: normalizeString('Tambaú') },
        { name: 'Bessa', normalized: normalizeString('Bessa') },
    ];
    let bestMatch = null;
    let bestDistance = Infinity;
    for (const n of neighborhoods) {
        const distance = levenshteinDistance(normalizedInput, n.normalized);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = n.name;
        }
    }
    // Threshold for fuzzy matching
    if (bestDistance <= 3) {
        return bestMatch;
    }
    return null;
}
//# sourceMappingURL=utils.js.map
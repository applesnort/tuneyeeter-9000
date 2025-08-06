/**
 * Normalize strings for comparison - Unicode normalization + aggressive normalization for fuzzy matching
 */
export function normalizeString(str: string): string {
  return str
    // Apply Unicode NFC normalization first (Apple's preferred form)
    .normalize('NFC')
    .toLowerCase()
    .trim()
    // Handle common character variations
    .replace(/&/g, 'and')  // & → and
    .replace(/['']/g, "'") // Smart quotes → regular quotes
    .replace(/[""]/g, '"') // Smart quotes → regular quotes
    .replace(/[–—]/g, '-') // Em/en dash → hyphen
    // Remove ALL punctuation and special characters for fuzzy matching
    .replace(/[^\w\s]/g, ' ')
    // Normalize whitespace (multiple spaces to single)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate normalized string similarity (0-1)
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  
  if (str1 === str2) return 1.0;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}
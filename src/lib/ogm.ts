/**
 * Utility functions for Belgian Structured Communication (OGM/VCS)
 */

/**
 * Generates a valid Belgian Structured Communication (OGM) string.
 * Format: +++XXX/XXXX/XXXXX+++
 * The first 10 digits form the base number. The last 2 digits are the check digits (mod 97).
 * If no baseNumber is provided, a unique 10-digit timestamp-based number is generated.
 * 
 * @param baseNumber Optional 10-digit base number.
 * @returns Formatted OGM string.
 */
export function generateOGM(baseNumber?: number | string): string {
    let baseStr: string;

    if (baseNumber) {
        // Ensure it's exactly 10 digits
        baseStr = String(baseNumber).replace(/\D/g, '').substring(0, 10).padStart(10, '0');
    } else {
        // Generate a 10-digit number. Unix timestamp in seconds works well (e.g. 1717454234)
        // plus a small random jitter to avoid same-second collisions if generated in bulk.
        const ts = Math.floor(Date.now() / 1000);
        const randomPart = Math.floor(Math.random() * 1000);
        // Combine them to get a 10 digit number
        baseStr = String(ts).substring(0, 7) + String(randomPart).padStart(3, '0');
        baseStr = baseStr.padEnd(10, '0').substring(0, 10);
    }

    const baseNum = Number(baseStr);
    let check = baseNum % 97;
    if (check === 0) check = 97;

    const checkStr = String(check).padStart(2, '0');
    const full = baseStr + checkStr; // 12 digits

    return `+++${full.substring(0, 3)}/${full.substring(3, 7)}/${full.substring(7)}+++`;
}

/**
 * Validates a Belgian Structured Communication (OGM) string.
 */
export function validateOGM(ogm: string): boolean {
    const clean = ogm.replace(/\D/g, '');
    if (clean.length !== 12) return false;

    const baseNum = Number(clean.substring(0, 10));
    const checkNum = Number(clean.substring(10, 12));

    let expectedCheck = baseNum % 97;
    if (expectedCheck === 0) expectedCheck = 97;

    return expectedCheck === checkNum;
}

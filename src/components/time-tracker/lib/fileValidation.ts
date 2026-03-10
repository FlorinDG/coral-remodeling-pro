"use client";
// File upload validation utilities
// Prevents malicious file uploads by validating type, size, and content

export const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
] as const;

// 10MB max file size
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Max number of files per upload
export const MAX_FILES_PER_UPLOAD = 10;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file for upload
 * @param file The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  // Check file size is not zero
  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty.`,
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  if (!hasAllowedExtension) {
    return {
      valid: false,
      error: `File "${file.name}" has an unsupported file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType && !ALLOWED_FILE_TYPES.includes(mimeType as typeof ALLOWED_FILE_TYPES[number])) {
    // Allow empty MIME type as some browsers may not set it correctly
    // The extension check above provides primary validation
    if (mimeType !== '' && mimeType !== 'application/octet-stream') {
      return {
        valid: false,
        error: `File "${file.name}" has an unsupported content type: ${mimeType}`,
      };
    }
  }

  // Validate filename for path traversal attacks
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: `File name "${file.name}" contains invalid characters.`,
    };
  }

  // Check for very long filenames that could cause issues
  if (file.name.length > 255) {
    return {
      valid: false,
      error: `File name is too long. Maximum 255 characters.`,
    };
  }

  return { valid: true };
}

/**
 * Validates multiple files for upload
 * @param files Array of files to validate
 * @returns Validation result with error message if any file is invalid
 */
export function validateFiles(files: File[]): FileValidationResult {
  if (files.length === 0) {
    return { valid: true };
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    return {
      valid: false,
      error: `Too many files. Maximum ${MAX_FILES_PER_UPLOAD} files per upload.`,
    };
  }

  // Calculate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSize = MAX_FILE_SIZE * 2; // 20MB total
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      error: `Total file size exceeds ${maxTotalSize / (1024 * 1024)}MB limit.`,
    };
  }

  // Validate each file
  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Gets the sanitized file type for storage
 * Falls back to application/octet-stream if MIME type is suspicious
 */
export function getSafeFileType(file: File): string {
  const mimeType = file.type.toLowerCase();
  
  // If MIME type is in allowed list, use it
  if (ALLOWED_FILE_TYPES.includes(mimeType as typeof ALLOWED_FILE_TYPES[number])) {
    return mimeType;
  }
  
  // Otherwise infer from extension
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.gif')) return 'image/gif';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  if (fileName.endsWith('.doc')) return 'application/msword';
  if (fileName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (fileName.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (fileName.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  
  return 'application/octet-stream';
}

/**
 * Generates a safe file path with sanitized filename
 */
export function generateSafeFilePath(prefix: string, file: File): string {
  // Sanitize filename - remove any potentially dangerous characters
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 100); // Limit length
  
  return `${prefix}/${Date.now()}_${sanitizedName}`;
}

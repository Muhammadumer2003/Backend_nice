const multer = require('multer');
const path = require('path');

// Configure storage to use memory storage
const storage = multer.memoryStorage();

// File filter: allow images, videos, audios, PDFs, DOCX, XLSX, and additional types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff',
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
    '.mp3', '.wav', '.aac', '.flac', '.ogg',
    '.xlsx', '.xls',
    '.txt', '.rtf' // Added for PostJob compatibility
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Supported types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
});

module.exports = upload;
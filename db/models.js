import mongoose from 'mongoose';
// const Schema = mongoose.Schema;

// File Schema
const OCRDataSchema = new mongoose.Schema({
  filename: String,
  fileType: String,
  extractedText: String,
});
export const OCRData = mongoose.model('OCRData', OCRDataSchema);

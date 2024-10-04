import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Grid from 'gridfs-stream';
import { GridFSBucket } from 'mongodb';
import { createReadStream } from 'fs';
import { promisify } from 'util';
import { OCRData }from './db/models.js';
import performOCR from './util/OCR.js';
import { fileTypeFromBuffer } from 'file-type';
import dotenv from 'dotenv';
dotenv.config({path:'./.env'});

// Initialize app
const app = express();
app.use(express.json());

// MongoDB URI
const mongoURI = process.env.CONNECTION_STRING;

// Create MongoDB connection
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Init gfs
let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
  gfs = new GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
});

// Multer storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PDF, and DOCX are allowed.'));
    }
  }
 });


// // Mongoose schema for storing OCR data
// const OCRDataSchema = new mongoose.Schema({
//   filename: String,
//   extractedText: String,
// });
// const OCRData = mongoose.model('OCRData', OCRDataSchema);

// Upload file and perform OCR route
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  try {
    // Using fileTypeFromBuffer instead of fileType.fromBuffer
    const detectedFileType = await fileTypeFromBuffer(req.file.buffer);
    if (!detectedFileType) {
      return res.status(400).send('Unable to detect file type');
    }

    const fileMetadata = {
      originalname: req.file.originalname,
      mimetype: detectedFileType.mime,
      fileType: detectedFileType.ext,
    };

    const writeStream = gfs.openUploadStream(req.file.originalname, {
      metadata: fileMetadata
    });
    writeStream.write(req.file.buffer);
    writeStream.end();

    let extractedText;
    try {
      extractedText = await performOCR(req.file.buffer, detectedFileType.mime);
    } catch (ocrError) {
      console.error('OCR Error:', ocrError);
      return res.status(422).json({ error: 'Error performing OCR on the file' });
    }

    const ocrData = new OCRData({
      filename: req.file.originalname,
      fileType: detectedFileType.ext,
      extractedText,
    });
    await ocrData.save();

    res.status(201).json({
      message: 'File uploaded and OCR completed successfully',
      fileType: detectedFileType.ext,
      extractedText,
    });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get file from GridFS route
app.get('/file/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ err: 'No file exists' });
    }

    const readStream = gfs.createReadStream(file.filename);
    readStream.pipe(res);
  });
});

// Get OCR data by filename
app.get('/ocr/:filename', async (req, res) => {
  const ocrData = await OCRData.findOne({ filename: req.params.filename });
  if (!ocrData) {
    return res.status(404).json({ error: 'No OCR data found for this file' });
  }
  res.json(ocrData);
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));


import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import mammoth from 'mammoth';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.js';

async function performOCR(buffer, mimeType) {
  try {
    console.log('Processing file of type:', mimeType);
    
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return await performImageOCR(buffer);
      
      case 'application/pdf':
        return await performPdfOCR(buffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await performDocxOCR(buffer);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error in performOCR:', error);
    throw error;
  }
}

async function performImageOCR(buffer) {
  const { data: { text } } = await Tesseract.recognize(buffer);
  return text;
}

async function performPdfOCR(buffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({data: buffer});
    const pdf = await loadingTask.promise;
    
    let textContent = '';
    
    // Iterate through all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      textContent += pageText + '\n';
    }
    
    return textContent.trim();
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Failed to process PDF file: ${error.message}`);
  }
}

async function performDocxOCR(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error processing DOCX:', error);
    throw new Error('Failed to process DOCX file');
  }
}

// export default performOCR;
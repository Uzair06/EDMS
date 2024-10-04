import tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import fs from "fs/promises";
import path from "path";
import pdf2img from "pdf-poppler";

async function performOCR(filePath, mimeType) {
  switch (mimeType) {
    case "image/jpg":
    case "image/png":
    case "image/jpeg":
      try {
        const result = await tesseract.recognize(filePath);
        return result.data.text;
      } catch (err) {
        throw new Error("OCR failed: " + err.message);
      }

      case "application/pdf": {
        console.log(`Converting PDF to images: ${filePath}`);
        const opts = {
          format: 'jpeg',
          out_dir: path.dirname(filePath),
          out_prefix: path.basename(filePath, '.pdf'),
          page: null
        };
  
        try {
          await pdf2img.convert(filePath, opts);
          const files = await fs.readdir(opts.out_dir);
          const pdfImages = files.filter(file => file.startsWith(opts.out_prefix) && file.endsWith('.jpg'));
  
          if (pdfImages.length === 0) {
            throw new Error("No images found in the PDF");
          }
  
          let text = "";
          for (const image of pdfImages) {
            const imagePath = path.join(opts.out_dir, image);
            console.log(`Performing OCR on PDF page image: ${imagePath}`);
            const result = await tesseract.recognize(imagePath);
            text += result.data.text + "\n";
  
            // Clean up the temporary image file
            await fs.unlink(imagePath);
          }
          return text;
        } catch (err) {
          throw new Error("PDF processing failed: " + err.message);
        }
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // Extract text directly from DOCX
      const { value } = await mammoth.extractRawText({ path: filePath });
      text = value;
      return text;
      


    default:
      throw new Error("Unsupported file type: " + mimeType);
  }
}

export default performOCR;
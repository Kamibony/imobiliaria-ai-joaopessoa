const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractImagesFromPDF(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data: data });
    const pdfDocument = await loadingTask.promise;

    console.log("Pages:", pdfDocument.numPages);
    const images = [];

    for (let pageNum = 1; pageNum <= Math.min(2, pdfDocument.numPages); pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const ops = await page.getOperatorList();

        for (let i = 0; i < ops.fnArray.length; i++) {
            if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
                const imgName = ops.argsArray[i][0];
                const img = await page.objs.get(imgName);
                if (img) {
                    // Just to see if it works without actually fully parsing it in this short script
                    images.push(`Page ${pageNum} Image: ${img.width}x${img.height}`);
                }
            }
        }
    }
    console.log(images);
}

// create a dummy pdf to test
const { PDFDocument } = require('pdf-lib');
async function createTestPDF() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText('Test Page 1');
    fs.writeFileSync('test.pdf', await pdfDoc.save());
    await extractImagesFromPDF('test.pdf');
}
createTestPDF().catch(console.error);

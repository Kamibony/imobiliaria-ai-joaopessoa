const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function test() {
  const data = new Uint8Array(fs.readFileSync('test.pdf'));
  const loadingTask = pdfjsLib.getDocument({ data: data });
  const pdfDocument = await loadingTask.promise;
  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });

  const { createCanvas } = require('canvas');
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('test_render.png', buffer);
  console.log("Rendered test_render.png");
}
test().catch(console.error);

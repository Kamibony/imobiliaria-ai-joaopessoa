Plan:
1. Update `backend/src/index.ts` to implement Visual Asset Extraction:
   - Install `pdf2pic` in the `backend` folder. The system uses cloud functions, so we can convert the first page to a hero render image using `pdf2pic`.
   - Update `ingestPdf` to:
     - Download the PDF from Firebase Storage to a temporary local file (using `fileBucket.file(filePath).download()`).
     - Convert the first page (or relevant pages) into images using `pdf2pic`.
     - Upload the generated image(s) to Firebase Storage (e.g., `b2b_assets/${fileName}_page1.png`).
     - Save these image URLs (using public URLs or gs:// URLs) into the `assets.hero_images` of the `ProjectSchema`.
2. Update Frontend `App.jsx` to implement the Premium Smart Canvas UI:
   - Rethink `ProjectDetailModal`:
     - Split the modal into a visually rich layout, displaying the extracted visual assets (hero renders, logos).
     - Move from a simple table layout for `Inventory (Units)` to an interactive gallery of units where floor plans (if available) or placeholders are displayed.
     - When hovering/clicking over a unit card, dynamically overlay the unit's price, area, and availability status pulled from the latest Tabela snapshots.
3. Pre-commit check steps.

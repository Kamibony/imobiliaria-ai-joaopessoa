const { fromPath } = require("pdf2pic");

const options = {
  density: 100,
  saveFilename: "test",
  savePath: "./",
  format: "png",
  width: 600,
  height: 600
};

const storeAsImage = fromPath("test.pdf", options);
const pageToConvertAsImage = 1;

storeAsImage(pageToConvertAsImage).then((resolve) => {
  console.log("Page 1 is now converted as image");
  return resolve;
}).catch(console.log);

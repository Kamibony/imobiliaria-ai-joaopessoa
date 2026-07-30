const { createCanvas } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');
ctx.fillText('Hello World!', 50, 50);
console.log(canvas.toDataURL());

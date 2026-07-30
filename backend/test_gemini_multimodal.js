const { VertexAI } = require("@google-cloud/vertexai");

async function run() {
  const vertexAi = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT || 'test', location: 'us-central1' });
  const model = vertexAi.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: "Can you return the base64 of an image?" }] }]
  });
  console.log(result.response.candidates[0].content.parts[0].text);
}
run().catch(console.error);

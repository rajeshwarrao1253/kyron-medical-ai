export async function streamText(text, onChunk, speed = 12) {
  let current = "";
  for (const char of text) {
    current += char;
    onChunk(current);
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

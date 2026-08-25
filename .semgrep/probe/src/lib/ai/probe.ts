export async function klassifiziere(text: string) {
  const antwort = await client.messages.create({ model: "x", messages: [] });
  return antwort.content;
}

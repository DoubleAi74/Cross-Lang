export function parseSseEventBlock(block) {
  const normalizedBlock = block.replace(/\r/g, "").trim();

  if (!normalizedBlock) {
    return null;
  }

  const lines = normalizedBlock.split("\n");
  let event = "message";
  const dataLines = [];

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      return;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  });

  if (!dataLines.length) {
    return null;
  }

  let data = null;

  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    data = { message: dataLines.join("\n") };
  }

  return { event, data };
}

export async function consumeSseStream(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    buffer += decoder
      .decode(value || new Uint8Array(), { stream: !done })
      .replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex >= 0) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const parsedEvent = parseSseEventBlock(chunk);

      if (parsedEvent) {
        await onEvent(parsedEvent);
      }

      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      const parsedEvent = parseSseEventBlock(buffer);

      if (parsedEvent) {
        await onEvent(parsedEvent);
      }

      return;
    }
  }
}

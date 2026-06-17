export type TextSectionMap = Record<string, string>;

export function parseTextSections(source: string): TextSectionMap {
  const sections: TextSectionMap = {};
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const flush = (): void => {
    if (!currentKey) {
      return;
    }

    sections[currentKey] = currentLines.join('\n').trim();
  };

  for (const line of lines) {
    const match = line.match(/^@@([a-zA-Z0-9_.-]+)$/);
    if (match) {
      flush();
      currentKey = match[1];
      currentLines = [];
      continue;
    }

    if (currentKey) {
      currentLines.push(line);
    }
  }

  flush();

  return sections;
}

export function formatText(template: string, values: Record<string, string | number | boolean>): string {
  return template.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? '' : String(value);
  });
}

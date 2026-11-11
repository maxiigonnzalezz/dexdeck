// Lector de CSV propio: RFC 4180 con BOM, comillas escapadas, saltos CRLF y
// detección de delimitador (coma o punto y coma, típico al exportar desde
// hojas de cálculo en español).
//
// Se guarda la línea real de cada registro para que los avisos de importación
// apunten al archivo original, incluso con campos entrecomillados.

export type CsvRecord = {
  /** Línea del archivo donde empieza el registro (1-based). */
  line: number;
  values: string[];
};

export type CsvTable = {
  header: string[];
  records: CsvRecord[];
  delimiter: string;
};

function detectDelimiter(source: string): string {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      if (inQuotes && firstLine[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (char === ',') commas += 1;
    if (char === ';') semicolons += 1;
  }

  return semicolons > commas ? ';' : ',';
}

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);

  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let index = 0;

  const commitField = () => {
    values.push(field);
    field = '';
  };

  const commitRecord = () => {
    commitField();
    if (values.some((value) => value.trim() !== '')) {
      records.push({ line: recordLine, values });
    }
    values = [];
  };

  while (index < source.length) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      if (char === '\n') line += 1;
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === delimiter) {
      commitField();
      index += 1;
      continue;
    }

    if (char === '\r') {
      if (source[index + 1] === '\n') index += 1;
      commitRecord();
      line += 1;
      recordLine = line;
      index += 1;
      continue;
    }

    if (char === '\n') {
      commitRecord();
      line += 1;
      recordLine = line;
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  commitRecord();

  const [headerRecord, ...dataRecords] = records;

  if (!headerRecord) {
    return { header: [], records: [], delimiter };
  }

  return {
    header: headerRecord.values.map((value) => value.trim()),
    records: dataRecords,
    delimiter
  };
}

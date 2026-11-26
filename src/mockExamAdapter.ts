import type { MemoTable } from "./memoTable";
import { validateMemoTable } from "./memoTable";

export type MockExamQuestion = {
  question: string;
  choices: string[];
  answer: number;
  code?: string;
  explanation?: string;
};
export type MockExamPayload = { title: string; questions: MockExamQuestion[] };
export type MockExamColumnMapping = {
  question: string;
  choices: string;
  answer: string;
  code?: string;
  explanation?: string;
};
export type MockExamExportResult =
  | { ok: true; data: MockExamPayload }
  | { ok: false; errors: string[] };

export const MOCK_EXAM_FIELDS = ["question", "choices", "answer", "code", "explanation"] as const;
export type MockExamField = typeof MOCK_EXAM_FIELDS[number];

export const MOCK_EXAM_FIELD_LABELS: Record<MockExamField, string> = {
  question: "問題文", choices: "選択肢", answer: "正解番号", code: "コード", explanation: "解説",
};

const aliases: Record<MockExamField, readonly string[]> = {
  question: ["問題", "問題文", "質問", "question"],
  choices: ["選択肢", "選択肢（改行区切り）", "選択肢(改行区切り)", "choices", "options"],
  answer: ["正解", "正解番号", "answer", "correct"],
  code: ["コード", "code"],
  explanation: ["解説", "説明", "explanation"],
};

// Source contract: Mock Exam app.js at 10a6f2f5268656c712bc5cda88164254c2b816ad,
// validateQuestion / processImportRaw. Lengths use JS String.length like the importer.
export const MOCK_EXAM_LIMITS = {
  question: 500, choicesMin: 2, choicesMax: 8, choice: 200, code: 2000, explanation: 1000,
} as const;

export function createMockExamTable(): MemoTable {
  return { columns: ["問題", "選択肢", "正解番号", "コード", "解説"], rows: [["", "", "", "", ""]] };
}

export function findMockExamColumn(field: MockExamField, names: string[]): string {
  return names.find(name => aliases[field].includes(name.trim().toLowerCase())) ?? "";
}

/** Native import format, deliberately separate from the memo's content, revisions and envelope. */
export function makeMockExamPayload(title: string, table: MemoTable, mapping: MockExamColumnMapping): MockExamExportResult {
  const tableErrors = validateMemoTable(table);
  if (tableErrors.length) return { ok: false, errors: tableErrors };

  const mappingErrors: string[] = [];
  const used = new Set<string>();
  const indices: Partial<Record<MockExamField, number>> = {};
  for (const field of MOCK_EXAM_FIELDS) {
    const name = mapping[field];
    if (!name) {
      if (field !== "code" && field !== "explanation") mappingErrors.push(`${MOCK_EXAM_FIELD_LABELS[field]}の列を選んでください。`);
      continue;
    }
    const index = table.columns.indexOf(name);
    if (index < 0) mappingErrors.push(`${MOCK_EXAM_FIELD_LABELS[field]}の列が存在しません。`);
    else if (used.has(name)) mappingErrors.push(`${MOCK_EXAM_FIELD_LABELS[field]}には別の列を選んでください。`);
    else {
      used.add(name);
      indices[field] = index;
    }
  }
  if (mappingErrors.length) return { ok: false, errors: mappingErrors };

  const questions: MockExamQuestion[] = [];
  const errors: string[] = [];
  const limits = MOCK_EXAM_LIMITS;
  table.rows.forEach((row, index) => {
    const get = (field: MockExamField): string => row[indices[field] ?? -1] ?? "";
    const question = get("question");
    const choiceText = get("choices");
    const answerText = get("answer");
    const code = get("code");
    const explanation = get("explanation");
    if ([question, choiceText, answerText, code, explanation].every(value => !value.trim())) return;

    const rowErrors: string[] = [];
    if (!question.trim()) rowErrors.push("問題文が空です。");
    else if (question.length > limits.question) rowErrors.push(`問題文は${limits.question}文字以内にしてください。`);

    // Do not silently drop blank entries: the original choice positions determine the answer.
    const choices = choiceText.split(/\r\n|\n|\r/).map(value => value.trim());
    if (choices.length < limits.choicesMin || choices.length > limits.choicesMax) {
      rowErrors.push(`選択肢は改行で区切って${limits.choicesMin}〜${limits.choicesMax}個にしてください。`);
    }
    if (choices.some(value => !value)) rowErrors.push("空の選択肢があります。空行は入れないでください。");
    if (new Set(choices).size !== choices.length) rowErrors.push("選択肢が重複しています。");
    if (choices.some(value => value.length > limits.choice)) rowErrors.push(`各選択肢は${limits.choice}文字以内にしてください。`);

    const normalizedAnswer = answerText.replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0)).trim();
    const answer = /^[1-8]$/.test(normalizedAnswer) ? Number(normalizedAnswer) : NaN;
    if (!Number.isInteger(answer) || answer > choices.length) rowErrors.push("正解番号は1から選択肢数までの整数にしてください。");
    if (code.length > limits.code) rowErrors.push(`コードは${limits.code}文字以内にしてください。`);
    if (explanation.length > limits.explanation) rowErrors.push(`解説は${limits.explanation}文字以内にしてください。`);

    if (rowErrors.length) {
      errors.push(...rowErrors.map(error => `${index + 1}行目：${error}`));
      return;
    }
    questions.push({ question, choices, answer, ...(code ? { code } : {}), ...(explanation ? { explanation } : {}) });
  });
  if (!questions.length && !errors.length) errors.push("問題文・選択肢・正解番号のある行を1件以上入力してください。");
  return errors.length ? { ok: false, errors } : { ok: true, data: { title: title.trim() || "無題の問題集", questions } };
}

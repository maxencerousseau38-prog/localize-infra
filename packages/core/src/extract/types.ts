export interface ExtractedString {
  key: string;
  text: string;
  filePath: string;
  componentName: string | null;
  surroundingCode: string;
}

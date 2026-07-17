import { prepareSarifForAdvancedSecurity } from "./sarif.mts";

export function prepareResultsForUpload(
  content: string,
  format: string,
): string {
  switch (format) {
    case "sarif":
      return prepareSarifForAdvancedSecurity(content);
    case "json":
      if (!content.trim()) {
        throw new Error("Invalid JSON results: file is empty");
      }
      try {
        JSON.parse(content);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON results: ${reason}`);
      }
      return content;
    default:
      throw new Error(`Unsupported results format: ${format}`);
  }
}

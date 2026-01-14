"use client";

import React, { useRef, useState } from "react";
import { parseCSV } from "@/lib/csvUtils";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  title: string;
  validateData: (rows: Record<string, string>[]) => {
    valid: any[];
    errors: Array<{ row: number; error: string }>;
  };
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  title,
  validateData,
}: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ row: number; error: string }>
  >([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [importMessage, setImportMessage] = useState<string>("");
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const rows = parseCSV(content);
        setParsedRows(rows);

        const { errors } = validateData(rows);
        setValidationErrors(errors);

        setStep("preview");
      } catch (error) {
        setImportMessage(`Error parsing file: ${(error as Error).message}`);
      }
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    try {
      setStep("importing");
      const { valid } = validateData(parsedRows);

      if (valid.length === 0) {
        setImportMessage("No valid records to import");
        return;
      }

      await onImport(valid);

      setImportSuccess(true);
      setImportMessage(`Successfully imported ${valid.length} records!`);

      setTimeout(() => {
        onClose();
        setStep("upload");
        setParsedRows([]);
        setValidationErrors([]);
        setImportMessage("");
        setImportSuccess(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 2000);
    } catch (error) {
      setImportMessage(`Import failed: ${(error as Error).message}`);
      setStep("preview");
    }
  };

  const { valid } = validateData(parsedRows);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            X
          </button>
        </div>

        <div className="p-6">
          {step === "upload" && (
            <div className="text-center">
              <p className="mb-4 text-gray-600">Upload a CSV file</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Click to select CSV file
                </label>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <h3 className="font-semibold mb-4">
                Preview: {valid.length} valid{" "}
                {valid.length === 1 ? "record" : "records"}
              </h3>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                  <p className="font-semibold text-red-800 mb-2">
                    Errors ({validationErrors.length}):
                  </p>
                  <ul className="text-sm text-red-700 space-y-1 max-h-24 overflow-y-auto">
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {valid.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <p className="font-semibold text-green-800 mb-2">
                    Valid records:
                  </p>
                  <p className="text-sm text-green-700">
                    {valid.length} records ready to import
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="text-center">
              {importSuccess ? (
                <p className="text-lg font-semibold text-green-600">
                  {importMessage}
                </p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-4">Importing...</p>
                  <div className="inline-block animate-spin">...</div>
                </div>
              )}
              {importMessage && !importSuccess && (
                <p className="text-red-600 text-sm mt-4">{importMessage}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50 justify-end">
          <button
            onClick={onClose}
            disabled={step === "importing"}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>

          {step === "preview" && (
            <button
              onClick={handleImport}
              disabled={valid.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Import {valid.length} Records
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

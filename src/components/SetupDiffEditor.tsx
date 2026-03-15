import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useId, useRef } from "react";
import type { editor } from "monaco-editor";

type SetupDiffEditorProps = {
  original: string;
  modified: string;
};

const SetupDiffEditor = ({ original, modified }: SetupDiffEditorProps) => {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const modelId = useId();

  useEffect(
    () => () => {
      const diffEditor = editorRef.current;
      const model = diffEditor?.getModel();

      if (!diffEditor || !model) {
        return;
      }

      diffEditor.setModel(null);
      model.original.dispose();
      model.modified.dispose();
      editorRef.current = null;
    },
    [],
  );

  return (
    <div className="overflow-hidden border bg-background">
      <DiffEditor
        height="420px"
        keepCurrentModifiedModel
        keepCurrentOriginalModel
        language="plaintext"
        modified={modified}
        modifiedModelPath={`inmemory://setup-diff/${modelId}/modified`}
        options={{
          automaticLayout: true,
          diffAlgorithm: "advanced",
          fontFamily: "monospace",
          fontLigatures: false,
          fontSize: 12,
          lineNumbers: "on",
          minimap: { enabled: false },
          readOnly: true,
          renderSideBySide: true,
          scrollBeyondLastLine: false,
          wordWrap: "off",
        }}
        onMount={(diffEditor) => {
          editorRef.current = diffEditor;
        }}
        original={original}
        originalModelPath={`inmemory://setup-diff/${modelId}/original`}
        theme="vs"
      />
    </div>
  );
};

export { SetupDiffEditor };

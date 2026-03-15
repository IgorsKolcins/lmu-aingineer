import { DiffEditor } from "@monaco-editor/react";

type SetupDiffEditorProps = {
  original: string;
  modified: string;
};

const SetupDiffEditor = ({ original, modified }: SetupDiffEditorProps) => {
  return (
    <div className="overflow-hidden border bg-background">
      <DiffEditor
        height="420px"
        language="plaintext"
        modified={modified}
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
        original={original}
        theme="vs"
      />
    </div>
  );
};

export { SetupDiffEditor };

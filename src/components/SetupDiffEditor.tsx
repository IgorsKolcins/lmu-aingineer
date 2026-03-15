import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useId, useRef } from "react";
import type { editor } from "monaco-editor";
import type * as Monaco from "monaco-editor";

const getMonacoTheme = () =>
  document.documentElement.classList.contains("dark") ? "vs-dark" : "vs";

type SetupDiffEditorProps = {
  original: string;
  modified: string;
};

const SetupDiffEditor = ({ original, modified }: SetupDiffEditorProps) => {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const modelId = useId();

  useEffect(() => {
    const monaco = monacoRef.current;

    if (!monaco) {
      return;
    }

    const syncTheme = () => monaco.editor.setTheme(getMonacoTheme());

    syncTheme();

    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

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
        onMount={(diffEditor, monaco) => {
          editorRef.current = diffEditor;
          monacoRef.current = monaco;
        }}
        original={original}
        originalModelPath={`inmemory://setup-diff/${modelId}/original`}
        theme={getMonacoTheme()}
      />
    </div>
  );
};

export { SetupDiffEditor };

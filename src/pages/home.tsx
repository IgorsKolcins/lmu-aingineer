import { useState } from "react";
import { SetupDiffEditor } from "@/components/SetupDiffEditor";
import {
  FileSelectClear,
  FileSelectRoot,
  FileSelectTrigger,
  type SelectedFile,
} from "@/components/ui/FileSelect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askAboutFile, hasAiBridge } from "@/lib/ai/client";
import type { AskAboutFileResponse } from "@/lib/ai/types";
import { openDirectory, saveGeneratedFile } from "@/lib/files/client";
import { useSetting } from "@/lib/settings/client";

const HomePage = () => {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<AskAboutFileResponse | null>(null);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileSaveFolder, setFileSaveFolder] = useSetting("fileSaveFolder");
  const promptValue = prompt.trim();
  const canSubmit = !!file && !!promptValue && hasAiBridge() && !pending;
  const canSave = !!file && !!response?.fileContents && !pending && !saving;

  const clearMessages = () => {
    setError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Select a `.svm` file before sending a prompt.");
      return;
    }

    if (!promptValue) {
      setError("Enter a prompt before submitting.");
      return;
    }

    if (!hasAiBridge()) {
      setError("AI bridge is unavailable in this environment.");
      return;
    }

    setPending(true);
    clearMessages();
    setResponse(null);

    try {
      const nextResponse = await askAboutFile({
        file,
        prompt: promptValue,
      });

      setResponse(nextResponse);
    } catch (submissionError) {
      setResponse(null);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to get a response from Gemini.",
      );
    } finally {
      setPending(false);
    }
  };

  const handleSave = async () => {
    if (!file || !response?.fileContents) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      let targetDirectory = fileSaveFolder;

      if (!targetDirectory) {
        const selectedDirectory = await openDirectory({
          title: "Choose a folder for generated setups",
          buttonLabel: "Use folder",
        });

        if (!selectedDirectory) {
          throw new Error(
            "Choose a save folder before saving the generated setup.",
          );
        }

        const persistedDirectory = await setFileSaveFolder(
          selectedDirectory.path,
        );

        if (!persistedDirectory) {
          throw new Error("Unable to persist the save folder.");
        }

        targetDirectory = persistedDirectory;
      }

      const savedFile = await saveGeneratedFile({
        contents: response.fileContents,
        directory: targetDirectory,
        sourceName: file.name,
      });

      setSaveSuccess(`Saved setup to ${savedFile.path}`);
    } catch (saveActionError) {
      setSaveError(
        saveActionError instanceof Error
          ? saveActionError.message
          : "Unable to save the generated setup.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Le Mans Ultimate Setup Editor</CardTitle>
          <CardDescription>
            Select a `.svm` setup file, describe the handling changes you want,
            and let Gemini generate an updated setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel>Setup file</FieldLabel>
              <FieldContent>
                <FileSelectRoot
                  buttonLabel="Choose `.svm` file"
                  clearable
                  filters={[
                    {
                      name: "Le Mans Ultimate setup",
                      extensions: ["svm"],
                    },
                  ]}
                  onValueChange={(nextFile) => {
                    setFile(nextFile);
                    clearMessages();
                    setResponse(null);
                  }}
                  title="Choose a Le Mans Ultimate setup file"
                  value={file}
                >
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={file?.path ?? ""}
                      disabled
                      placeholder="No `.svm` file selected"
                    />
                    <FileSelectClear />
                    <FileSelectTrigger />
                  </div>
                </FileSelectRoot>
                <FieldDescription>
                  Only `.svm` car setup files are supported. The selected setup
                  is read as UTF-8 plain text and sent with your instructions.
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="file-prompt">Prompt</FieldLabel>
              <FieldContent>
                <Textarea
                  id="file-prompt"
                  name="prompt"
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    clearMessages();
                  }}
                  placeholder="Example: Reduce rear instability on corner exit and soften the front response over curbs."
                  rows={8}
                  value={prompt}
                />
                <FieldDescription>
                  Ask for setup changes in driving terms. Gemini will return a
                  summary plus a full updated `.svm` file.
                </FieldDescription>
              </FieldContent>
            </Field>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit}>
                {pending ? "Submitting..." : "Generate Setup"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Requires a Gemini API key in Settings.
              </span>
            </div>

            <FieldError>{error}</FieldError>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Response</CardTitle>
          <CardDescription>
            {pending
              ? "Gemini is reviewing your setup and generating an updated file."
              : response
                ? "Latest setup response from Gemini."
                : "Submit a prompt to see the AI explanation and generated setup."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {response?.description ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Description of changes
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm/relaxed">
                {response.description}
              </pre>
            </div>
          ) : null}

          {response?.parseError ? (
            <FieldError>{response.parseError}</FieldError>
          ) : null}
          {saveError ? <FieldError>{saveError}</FieldError> : null}
          {saveSuccess ? (
            <p className="text-xs text-muted-foreground">{saveSuccess}</p>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Raw AI message
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-xs/relaxed">
              {response?.text || "No response yet."}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup File Changes</CardTitle>
          <CardDescription>
            {response?.fileContents && response.originalFileContents
              ? "Original setup on the left, generated setup on the right."
              : "A valid `<<<FILE ... FILE` response is required before the generated setup can be previewed or saved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!canSave} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Save Generated Setup"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {fileSaveFolder
                ? `Save folder: ${fileSaveFolder}`
                : "No save folder set. You will be prompted when saving."}
            </span>
          </div>

          {response?.fileContents && response.originalFileContents ? (
            <SetupDiffEditor
              modified={response.fileContents}
              original={response.originalFileContents}
            />
          ) : (
            <div className="border border-dashed p-6 text-sm text-muted-foreground">
              No generated setup preview yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { HomePage };

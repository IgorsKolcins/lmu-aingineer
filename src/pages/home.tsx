import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiChat3Line,
  RiSparklingLine,
} from "@remixicon/react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendChatMessage, useChats } from "@/lib/chats/client";
import type { ChatMessage } from "@/lib/chats/types";
import { openDirectory, saveGeneratedFile } from "@/lib/files/client";
import { useSetting } from "@/lib/settings/client";

const AssistantMessage = ({
  message,
  canSave,
  fileName,
  fileSaveFolder,
  onSave,
  saving,
}: {
  message: ChatMessage;
  canSave: boolean;
  fileName: string | null;
  fileSaveFolder: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
}) => {
  const body = message.description ?? message.text ?? "No response text.";

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
          <RiSparklingLine className="size-4" />
          Assistant
        </div>
        <CardDescription className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {body}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {message.error ? <FieldError>{message.error}</FieldError> : null}
        {message.parseError ? (
          <FieldError>{message.parseError}</FieldError>
        ) : null}

        {message.baseFileContents && message.fileContents ? (
          <Collapsible className="border border-border/70">
            <CollapsibleTrigger asChild>
              <Button
                className="w-full justify-between border-0"
                type="button"
                variant="ghost"
              >
                <span>View setup diff</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <RiArrowRightSLine className="size-4 group-data-[state=open]:hidden" />
                  <RiArrowDownSLine className="hidden size-4 group-data-[state=open]:block" />
                  Monaco
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SetupDiffEditor
                modified={message.fileContents}
                original={message.baseFileContents}
              />
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {canSave && fileName && message.fileContents ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Button
              disabled={saving}
              onClick={() => void onSave()}
              type="button"
            >
              {saving ? "Saving..." : "Save Generated Setup"}
            </Button>
            <span>
              {fileSaveFolder
                ? `Save folder: ${fileSaveFolder}`
                : "No save folder set. You will be prompted when saving."}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const UserMessage = ({ message }: { message: ChatMessage }) => (
  <Card className="border-border/70 bg-muted/30">
    <CardHeader className="gap-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
        <RiChat3Line className="size-4" />
        You
      </div>
      <CardDescription className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {message.text}
      </CardDescription>
    </CardHeader>
  </Card>
);

const HomePage = () => {
  const { activeChat, chats } = useChats();
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileSaveFolder, setFileSaveFolder] = useSetting("fileSaveFolder");

  useEffect(() => {
    setPrompt("");
    setError("");
    setSaveError("");
    setSaveSuccess("");
    setPending(false);
    setSaving(false);
    setFile(activeChat?.file ?? null);
  }, [activeChat?.id, activeChat?.file]);

  const promptValue = prompt.trim();
  const composerFile = activeChat?.fileLocked ? activeChat.file : file;
  const latestSavableMessage = useMemo(
    () =>
      [...(activeChat?.messages ?? [])]
        .reverse()
        .find(
          (message) => message.role === "assistant" && message.fileContents,
        ),
    [activeChat?.messages],
  );
  const canSubmit = !!activeChat && !!composerFile && !!promptValue && !pending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeChat) {
      setError("Create a chat before sending a message.");
      return;
    }

    if (!composerFile) {
      setError("Select a `.svm` file before sending a message.");
      return;
    }

    if (!promptValue) {
      setError("Enter a prompt before submitting.");
      return;
    }

    setPending(true);
    setError("");
    setSaveError("");
    setSaveSuccess("");

    try {
      await sendChatMessage({
        chatId: activeChat.id,
        prompt: promptValue,
        file: activeChat.fileLocked ? undefined : composerFile,
      });
      setPrompt("");
    } catch (submissionError) {
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
    if (!activeChat?.file || !latestSavableMessage?.fileContents) {
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

        targetDirectory = await setFileSaveFolder(selectedDirectory.path);
      }

      if (!targetDirectory) {
        throw new Error("Unable to persist the save folder.");
      }

      const savedFile = await saveGeneratedFile({
        contents: latestSavableMessage.fileContents,
        directory: targetDirectory,
        sourceName: activeChat.file.name,
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

  if (!activeChat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start a chat</CardTitle>
          <CardDescription>
            Create a new chat from the sidebar to select a setup file and start
            iterating with Gemini.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Setup chat</CardTitle>
          <CardDescription>
            {activeChat.fileLocked
              ? `Working against ${activeChat.file?.name ?? "the selected setup"} with full chat history in context.`
              : "Pick a `.svm` file and send your first message to lock the chat to that setup."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {!activeChat.fileLocked ? (
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
                      setError("");
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
                    The first message locks this chat to the selected setup
                    file.
                  </FieldDescription>
                </FieldContent>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Locked setup file</FieldLabel>
                <FieldContent>
                  <Input
                    disabled
                    type="text"
                    value={activeChat.file?.path ?? ""}
                  />
                  <FieldDescription>
                    Follow-up questions keep using this file and the latest
                    generated setup state.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="chat-prompt">
                {activeChat.messageCount === 0 ? "First message" : "Follow-up"}
              </FieldLabel>
              <FieldContent>
                <Textarea
                  id="chat-prompt"
                  name="prompt"
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setError("");
                  }}
                  placeholder="Example: Reduce rear instability on corner exit and soften the front response over curbs."
                  rows={6}
                  value={prompt}
                />
                <FieldDescription>
                  Ask for setup changes in driving terms. The chat keeps the
                  previous context and latest generated file contents.
                </FieldDescription>
              </FieldContent>
            </Field>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit}>
                {pending
                  ? "Sending..."
                  : activeChat.messageCount === 0
                    ? "Start Chat"
                    : "Send Follow-up"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Chat history: {chats.length} conversation
                {chats.length === 1 ? "" : "s"} stored locally in SQLite.
              </span>
            </div>

            <FieldError>{error}</FieldError>
            {saveError ? <FieldError>{saveError}</FieldError> : null}
            {saveSuccess ? (
              <p className="text-xs text-muted-foreground">{saveSuccess}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {activeChat.messages.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No messages yet</CardTitle>
              <CardDescription>
                Your first prompt will appear here with the assistant response
                and diff preview.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          activeChat.messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} message={message} />
            ) : (
              <AssistantMessage
                key={message.id}
                canSave={message.id === latestSavableMessage?.id}
                fileName={activeChat.file?.name ?? null}
                fileSaveFolder={fileSaveFolder}
                message={message}
                onSave={handleSave}
                saving={saving}
              />
            ),
          )
        )}
      </div>
    </div>
  );
};

export { HomePage };

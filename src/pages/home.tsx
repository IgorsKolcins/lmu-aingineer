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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { sendChatMessage, useChats } from "@/lib/chats/client";
import type { ChatMessage } from "@/lib/chats/types";
import { openDirectory, saveGeneratedFile } from "@/lib/files/client";
import { useSetting } from "@/lib/settings/client";

type PendingMessageState = {
  chatId: string;
  prompt: string;
  error: string | null;
};

type RenderedMessage =
  | {
      kind: "user";
      id: string;
      createdAt: string;
      message: ChatMessage;
    }
  | {
      kind: "assistant";
      id: string;
      createdAt: string;
      message: ChatMessage;
    }
  | {
      kind: "pending-assistant";
      id: string;
      createdAt: string;
      error: string | null;
    };

const renderedMessageOrder = {
  user: 0,
  assistant: 1,
  "pending-assistant": 2,
} as const;

const compareByCreatedAt = (left: RenderedMessage, right: RenderedMessage) =>
  left.createdAt.localeCompare(right.createdAt) ||
  renderedMessageOrder[left.kind] - renderedMessageOrder[right.kind] ||
  left.id.localeCompare(right.id);

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

const PendingAssistantMessage = ({ error }: { error?: string | null }) => (
  <Card className="border-border/70 bg-card">
    <CardHeader className="gap-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
        <RiSparklingLine className="size-4" />
        Assistant
      </div>
      {error ? (
        <CardDescription className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {error}
        </CardDescription>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          <span>Thinking...</span>
        </div>
      )}
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
  const [pendingMessage, setPendingMessage] =
    useState<PendingMessageState | null>(null);
  const [fileSaveFolder, setFileSaveFolder] = useSetting("fileSaveFolder");

  useEffect(() => {
    setPrompt("");
    setError("");
    setSaveError("");
    setSaveSuccess("");
    setPending(false);
    setSaving(false);
    setPendingMessage(null);
    setFile(activeChat?.file ?? null);
  }, [activeChat?.id, activeChat?.file]);

  useEffect(() => {
    if (!activeChat || pendingMessage?.chatId !== activeChat.id) {
      return;
    }

    const pendingUserIndex = activeChat.messages.findLastIndex(
      (message) =>
        message.role === "user" && message.text === pendingMessage.prompt,
    );

    if (pendingUserIndex < 0) {
      return;
    }

    if (
      activeChat.messages
        .slice(pendingUserIndex + 1)
        .some((message) => message.role === "assistant")
    ) {
      setPendingMessage(null);
    }
  }, [activeChat, pendingMessage]);

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
  const renderedMessages = useMemo(() => {
    if (!activeChat) {
      return [];
    }

    const nextMessages = activeChat.messages.map(
      (message): RenderedMessage =>
        message.role === "user"
          ? ({
              kind: "user",
              id: message.id,
              createdAt: message.createdAt,
              message,
            } as const)
          : ({
              kind: "assistant",
              id: message.id,
              createdAt: message.createdAt,
              message,
            } as const),
    );

    if (pendingMessage?.chatId !== activeChat.id) {
      return nextMessages.toSorted(compareByCreatedAt);
    }

    const pendingUserIndex = activeChat.messages.findLastIndex(
      (message) =>
        message.role === "user" && message.text === pendingMessage.prompt,
    );

    if (
      pendingUserIndex >= 0 &&
      activeChat.messages
        .slice(pendingUserIndex + 1)
        .some((message) => message.role === "assistant")
    ) {
      return nextMessages.toSorted(compareByCreatedAt);
    }

    const pendingCreatedAt = new Date().toISOString();

    return [
      ...nextMessages,
      {
        kind: "user",
        id: `pending-user-${activeChat.id}`,
        createdAt: pendingCreatedAt,
        message: {
          id: `pending-user-${activeChat.id}`,
          chatId: activeChat.id,
          role: "user",
          text: pendingMessage.prompt,
          createdAt: pendingCreatedAt,
        },
      } as const,
      {
        kind: "pending-assistant",
        id: `pending-assistant-${activeChat.id}`,
        createdAt: pendingCreatedAt,
        error: pendingMessage.error,
      } as const,
    ].toSorted(compareByCreatedAt);
  }, [activeChat, pendingMessage]);
  const canSubmit = !!activeChat && !!composerFile && !!promptValue && !pending;
  const isNewChat = activeChat?.messageCount === 0;

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

    const submittedPrompt = promptValue;

    setPending(true);
    setError("");
    setSaveError("");
    setSaveSuccess("");
    setPrompt("");
    setPendingMessage({
      chatId: activeChat.id,
      prompt: submittedPrompt,
      error: null,
    });

    try {
      await sendChatMessage({
        chatId: activeChat.id,
        prompt: submittedPrompt,
        file: activeChat.fileLocked ? undefined : composerFile,
      });
    } catch (submissionError) {
      const nextError =
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to get a response from Gemini.";

      setPendingMessage((currentPendingMessage) =>
        currentPendingMessage?.chatId === activeChat.id
          ? {
              ...currentPendingMessage,
              error: nextError,
            }
          : currentPendingMessage,
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

  if (isNewChat) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <Card className="w-full max-w-3xl border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="items-center gap-3 text-center">
            <CardTitle className="text-3xl font-semibold tracking-tight">
              This is your personal AI(e)ngineer.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              Select an initial car setup file, then ask your engineer for
              suggestions, explanations, or setup changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <Field>
                <FieldLabel>Initial setup file</FieldLabel>
                <FieldContent>
                  <FileSelectRoot
                    buttonLabel="Select `.svm` file"
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
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="chat-prompt">Prompt</FieldLabel>
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
                </FieldContent>
              </Field>

              <div className="flex justify-center">
                <Button type="submit" disabled={!canSubmit} size="lg">
                  {pending ? "Sending..." : "Send"}
                </Button>
              </div>

              <FieldError>{error}</FieldError>
            </form>
          </CardContent>
        </Card>
      </div>
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
        {renderedMessages.length === 0 ? (
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
          renderedMessages.map((message) => {
            if (message.kind === "user") {
              return <UserMessage key={message.id} message={message.message} />;
            }

            if (message.kind === "assistant") {
              return (
                <AssistantMessage
                  key={message.id}
                  canSave={message.message.id === latestSavableMessage?.id}
                  fileName={activeChat.file?.name ?? null}
                  fileSaveFolder={fileSaveFolder}
                  message={message.message}
                  onSave={handleSave}
                  saving={saving}
                />
              );
            }

            return (
              <PendingAssistantMessage key={message.id} error={message.error} />
            );
          })
        )}
      </div>
    </div>
  );
};

export { HomePage };

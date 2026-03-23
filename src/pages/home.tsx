import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowRightLine,
  RiChat3Line,
  RiFileTextLine,
  RiFolderOpenLine,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  sendChatMessage,
  updateChatOutput,
  useChats,
} from "@/lib/chats/client";
import type { ChatMessage } from "@/lib/chats/types";
import {
  inspectSaveTarget,
  openDirectory,
  saveGeneratedFile,
} from "@/lib/files/client";
import { cn } from "@/lib/utils";

type PendingMessageState = {
  chatId: string;
  createdAt: string;
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

const folderNameFromPath = (value: string | null) =>
  value?.split(/[\\/]/).filter(Boolean).at(-1) ?? "";

const defaultOutputNameBase = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `aingineer-setup-${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
};

const sourceFileFilters = [
  {
    name: "Le Mans Ultimate setup",
    extensions: ["svm"],
  },
];

const PathTooltip = ({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string | null;
}) => {
  if (!path) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{path}</TooltipContent>
    </Tooltip>
  );
};

const AssistantMessage = ({ message }: { message: ChatMessage }) => {
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
        {message.error ? <FieldError>{message.error}</FieldError> : null}
        {message.parseError ? (
          <FieldError>{message.parseError}</FieldError>
        ) : null}
      </CardHeader>

      {message.baseFileContents && message.fileContents ? (
        <div className="px-6 pb-6">
          <Collapsible className="border border-border/70">
            <CollapsibleTrigger asChild>
              <Button
                className="w-full justify-between border-0"
                type="button"
                variant="ghost"
              >
                <span>View setup diff</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <RiArrowRightLine className="size-4 group-data-[state=open]:hidden" />
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
        </div>
      ) : null}
    </Card>
  );
};

const UserMessage = ({
  message,
  sourceFile,
}: {
  message: ChatMessage;
  sourceFile: SelectedFile | null;
}) => (
  <Card className="border-border/70 bg-muted/30">
    <CardHeader className="gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
        <RiChat3Line className="size-4" />
        You
      </div>
      {sourceFile ? (
        <PathTooltip path={sourceFile.path}>
          <div className="inline-flex max-w-full items-center gap-2 text-xs text-muted-foreground">
            <RiFileTextLine className="size-4 shrink-0" />
            <span className="truncate">{sourceFile.name}</span>
          </div>
        </PathTooltip>
      ) : null}
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
  const { activeChat } = useChats();
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingMessage, setPendingMessage] =
    useState<PendingMessageState | null>(null);
  const [pendingOutputDirectory, setPendingOutputDirectory] = useState<
    string | null
  >(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [saveTarget, setSaveTarget] = useState<Awaited<
    ReturnType<typeof inspectSaveTarget>
  > | null>(null);

  useEffect(() => {
    setPrompt("");
    setError("");
    setSaveError("");
    setSaveSuccess("");
    setPending(false);
    setSaving(false);
    setPendingMessage(null);
    setPendingOutputDirectory(null);
    setFile(activeChat?.file ?? null);
    setOutputFileName(activeChat?.outputFileName ?? "");
  }, [activeChat?.file, activeChat?.id, activeChat?.outputFileName]);

  useEffect(() => {
    if (!pendingOutputDirectory) {
      return;
    }

    if (activeChat?.outputDirectory === pendingOutputDirectory) {
      setPendingOutputDirectory(null);
    }
  }, [activeChat?.outputDirectory, pendingOutputDirectory]);

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

  useEffect(() => {
    if (!activeChat) {
      return;
    }

    const trimmedFileName = outputFileName.trim();
    const persistedFileName = activeChat.outputFileName ?? "";

    if (trimmedFileName === persistedFileName) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateChatOutput({
        chatId: activeChat.id,
        outputFileName: trimmedFileName || null,
      }).catch(() => undefined);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeChat, outputFileName]);

  useEffect(() => {
    const sourceFile = activeChat?.file ?? file;
    const outputDirectory = activeChat?.outputDirectory;

    if (
      !activeChat ||
      !sourceFile ||
      !outputDirectory ||
      activeChat.outputFileName
    ) {
      return;
    }

    const baseName = defaultOutputNameBase();

    setOutputFileName((currentValue) => currentValue || baseName);

    let cancelled = false;

    const assignDefaultOutputFileName = async () => {
      let attempt = 1;

      while (!cancelled) {
        const candidate = attempt === 1 ? baseName : `${baseName}-${attempt}`;
        const target = await inspectSaveTarget({
          directory: outputDirectory,
          fileName: candidate,
        });

        if (!target.exists) {
          await updateChatOutput({
            chatId: activeChat.id,
            outputFileName: target.fileName,
          });
          return;
        }

        attempt += 1;
      }
    };

    void assignDefaultOutputFileName().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeChat, file]);

  useEffect(() => {
    const outputDirectory = activeChat?.outputDirectory;
    const trimmedFileName = outputFileName.trim();

    if (!outputDirectory || !trimmedFileName) {
      setSaveTarget(null);
      return;
    }

    let cancelled = false;

    void inspectSaveTarget({
      directory: outputDirectory,
      fileName: trimmedFileName,
    })
      .then((target) => {
        if (!cancelled) {
          setSaveTarget(target);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaveTarget(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChat?.outputDirectory, outputFileName]);

  const promptValue = prompt.trim();
  const composerFile = activeChat?.fileLocked ? activeChat.file : file;
  const outputDirectory = pendingOutputDirectory ?? activeChat?.outputDirectory;
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

    return [
      ...nextMessages,
      {
        kind: "user",
        id: `pending-user-${activeChat.id}`,
        createdAt: pendingMessage.createdAt,
        message: {
          id: `pending-user-${activeChat.id}`,
          chatId: activeChat.id,
          role: "user",
          text: pendingMessage.prompt,
          createdAt: pendingMessage.createdAt,
        },
      } as const,
      {
        kind: "pending-assistant",
        id: `pending-assistant-${activeChat.id}`,
        createdAt: pendingMessage.createdAt,
        error: pendingMessage.error,
      } as const,
    ].toSorted(compareByCreatedAt);
  }, [activeChat, pendingMessage]);
  const firstUserMessageId = useMemo(
    () =>
      renderedMessages.find((message) => message.kind === "user")?.id ?? null,
    [renderedMessages],
  );
  const isEmptyChat =
    renderedMessages.length === 0 && pendingMessage?.chatId !== activeChat?.id;
  const saveButtonLabel = saveTarget?.exists ? "Override" : "Save";
  const canSubmit = !!activeChat && !!composerFile && !!promptValue && !pending;
  const canSave =
    !!outputDirectory &&
    !!outputFileName.trim() &&
    !!latestSavableMessage?.fileContents &&
    !saving;

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
      createdAt: new Date().toISOString(),
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

  const handleChooseOutputFolder = async () => {
    if (!activeChat) {
      return;
    }

    const selectedDirectory = await openDirectory({
      title: "Choose a folder for generated setups",
      buttonLabel: "Use folder",
    });

    if (!selectedDirectory) {
      return;
    }

    setPendingOutputDirectory(selectedDirectory.path);
    setSaveError("");
    setSaveSuccess("");

    await updateChatOutput({
      chatId: activeChat.id,
      outputDirectory: selectedDirectory.path,
    });
  };

  const handleSave = async () => {
    if (
      !activeChat?.outputDirectory ||
      !latestSavableMessage?.fileContents ||
      !outputFileName.trim()
    ) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const savedFile = await saveGeneratedFile({
        contents: latestSavableMessage.fileContents,
        directory: activeChat.outputDirectory,
        fileName: outputFileName,
      });

      setOutputFileName(savedFile.name);
      await updateChatOutput({
        chatId: activeChat.id,
        outputDirectory: savedFile.directory,
        outputFileName: savedFile.name,
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
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden border border-border/70 bg-background">
        {!isEmptyChat ? (
          <div className="shrink-0 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-2">
                <Button
                  onClick={() => void handleChooseOutputFolder()}
                  size="icon-sm"
                  type="button"
                  variant="secondary"
                >
                  <RiFolderOpenLine className="size-4" />
                </Button>
                <PathTooltip path={activeChat.outputDirectory}>
                  <Input
                    className="min-w-0 shrink-0 w-[120px]"
                    disabled
                    placeholder="No output folder selected"
                    type="text"
                    value={folderNameFromPath(outputDirectory ?? null)}
                  />
                </PathTooltip>
                <RiArrowRightLine className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  onChange={(event) => {
                    setOutputFileName(event.target.value);
                    setSaveError("");
                    setSaveSuccess("");
                  }}
                  type="text"
                  value={outputFileName}
                />
                <Button
                  disabled={!canSave}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  {saving ? "Saving..." : saveButtonLabel}
                </Button>
              </div>
            </div>
            {saveError ? <FieldError>{saveError}</FieldError> : null}
            {saveSuccess ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {saveSuccess}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {isEmptyChat ? (
              <div className="flex min-h-full items-center justify-center py-8">
                <Card className="w-full max-w-3xl border-border/70 bg-card/95 shadow-sm">
                  <CardHeader className="items-center gap-3 text-center">
                    <CardTitle className="text-3xl font-semibold tracking-tight">
                      This is your personal AI(e)ngineer.
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                      Select an initial car setup file, then ask your engineer
                      for suggestions, explanations, or setup changes.
                    </CardDescription>
                  </CardHeader>
                  <div className="px-6 pb-6">
                    <form
                      className="flex flex-col gap-6"
                      onSubmit={handleSubmit}
                    >
                      <FileSelectRoot
                        buttonLabel="Choose `.svm` file"
                        clearable
                        filters={sourceFileFilters}
                        onValueChange={(nextFile) => {
                          setFile(nextFile);
                          setError("");
                        }}
                        title="Choose a Le Mans Ultimate setup file"
                        value={file}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <PathTooltip path={file?.path ?? null}>
                              <div className="flex-1">
                                <Input
                                  disabled
                                  placeholder="Select the initial `.svm` file"
                                  type="text"
                                  value={file?.path ?? ""}
                                />
                              </div>
                            </PathTooltip>
                            <FileSelectClear />
                            <FileSelectTrigger />
                          </div>
                          <FieldDescription>
                            The first message locks this chat to the selected
                            setup file.
                          </FieldDescription>
                        </div>
                      </FileSelectRoot>

                      <Textarea
                        className="min-h-32"
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

                      <div className="flex justify-center">
                        <Button disabled={!canSubmit} size="lg" type="submit">
                          {pending ? "Sending..." : "Send"}
                        </Button>
                      </div>
                      {error ? <FieldError>{error}</FieldError> : null}
                    </form>
                  </div>
                </Card>
              </div>
            ) : (
              renderedMessages.map((message) => {
                if (message.kind === "user") {
                  return (
                    <UserMessage
                      key={message.id}
                      message={message.message}
                      sourceFile={
                        message.id === firstUserMessageId
                          ? (activeChat.file ?? composerFile)
                          : null
                      }
                    />
                  );
                }

                if (message.kind === "assistant") {
                  return (
                    <AssistantMessage
                      key={message.id}
                      message={message.message}
                    />
                  );
                }

                return (
                  <PendingAssistantMessage
                    key={message.id}
                    error={message.error}
                  />
                );
              })
            )}
          </div>
        </div>

        {!isEmptyChat ? (
          <div className="shrink-0 border-t border-border/70 bg-card/95 px-4 py-4 backdrop-blur">
            <form
              className="mx-auto flex max-w-4xl flex-col gap-3"
              onSubmit={handleSubmit}
            >
              {!activeChat.fileLocked ? (
                <FileSelectRoot
                  buttonLabel="Choose `.svm` file"
                  clearable
                  filters={sourceFileFilters}
                  onValueChange={(nextFile) => {
                    setFile(nextFile);
                    setError("");
                  }}
                  title="Choose a Le Mans Ultimate setup file"
                  value={file}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <PathTooltip path={file?.path ?? null}>
                        <div className="flex-1">
                          <Input
                            disabled
                            placeholder="Select the initial `.svm` file"
                            type="text"
                            value={file?.path ?? ""}
                          />
                        </div>
                      </PathTooltip>
                      <FileSelectClear />
                      <FileSelectTrigger />
                    </div>
                    <FieldDescription>
                      The first message locks this chat to the selected setup
                      file.
                    </FieldDescription>
                  </div>
                </FileSelectRoot>
              ) : null}

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Textarea
                  className="min-h-24 flex-1"
                  id="chat-prompt"
                  name="prompt"
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setError("");
                  }}
                  placeholder="Example: Reduce rear instability on corner exit and soften the front response over curbs."
                  rows={4}
                  value={prompt}
                />
                <Button
                  className={cn(
                    "md:self-stretch",
                    !activeChat.fileLocked && "md:min-w-28",
                  )}
                  disabled={!canSubmit}
                  type="submit"
                >
                  {pending ? "Sending..." : "Send"}
                </Button>
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
            </form>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
};

export { HomePage };

import * as React from "react";
import { Slot } from "radix-ui";

import { openFile as openNativeFile, hasFilesBridge } from "@/lib/files/client";
import type {
  FileDialogFilter,
  OpenFileOptions,
  SelectedFile,
} from "@/lib/files/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FileSelectContextValue = {
  value: SelectedFile | null;
  disabled: boolean;
  pending: boolean;
  clearable: boolean;
  buttonLabel: string;
  selectFile: () => Promise<void>;
  clearFile: () => void;
};

const FileSelectContext = React.createContext<FileSelectContextValue | null>(
  null,
);

const useFileSelectContext = () => {
  const context = React.useContext(FileSelectContext);

  if (!context) {
    throw new Error("FileSelect components must be used within FileSelectRoot");
  }

  return context;
};

const callHandler = <E extends React.SyntheticEvent>(
  event: E,
  handler?: (event: E) => void,
) => {
  handler?.(event);
};

type FileSelectRootProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange" | "value"
> &
  OpenFileOptions & {
    value?: SelectedFile | null;
    defaultValue?: SelectedFile | null;
    onValueChange?: (file: SelectedFile | null) => void;
    disabled?: boolean;
    clearable?: boolean;
  };

function FileSelectRoot({
  children,
  className,
  value,
  defaultValue = null,
  onValueChange,
  disabled = false,
  clearable = true,
  filters,
  title,
  buttonLabel = "Choose file",
  ...props
}: FileSelectRootProps) {
  const [pending, setPending] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(
    value ?? defaultValue,
  );
  const bridgeAvailable = hasFilesBridge();
  const currentValue = value === undefined ? selectedValue : value;
  const isDisabled = disabled || !bridgeAvailable;

  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  const commitValue = (nextValue: SelectedFile | null) => {
    setSelectedValue(nextValue);
    onValueChange?.(nextValue);
  };

  const selectFile = async () => {
    if (isDisabled || pending) {
      return;
    }

    setPending(true);

    try {
      const nextValue = await openNativeFile({
        filters,
        title,
        buttonLabel,
      });

      if (nextValue) {
        commitValue(nextValue);
      }
    } finally {
      setPending(false);
    }
  };

  const clearFile = () => {
    if (!clearable || !currentValue) {
      return;
    }

    commitValue(null);
  };

  return (
    <FileSelectContext.Provider
      value={{
        value: currentValue,
        disabled: isDisabled,
        pending,
        clearable,
        buttonLabel,
        selectFile,
        clearFile,
      }}
    >
      <div
        data-slot="file-select"
        data-disabled={isDisabled || undefined}
        data-empty={!currentValue || undefined}
        data-pending={pending || undefined}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </FileSelectContext.Provider>
  );
}

type FileSelectTriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "onClick"
> & {
  asChild?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
};

function FileSelectTrigger({
  asChild = false,
  children,
  className,
  disabled,
  onClick,
  type,
  variant,
  size,
  ...props
}: FileSelectTriggerProps) {
  const context = useFileSelectContext();
  const isDisabled = context.disabled || context.pending || disabled;

  if (asChild) {
    return (
      <Slot.Root
        data-slot="file-select-trigger"
        data-pending={context.pending || undefined}
        aria-disabled={isDisabled || undefined}
        className={className}
        onClick={(event) => {
          callHandler(event, onClick);

          if (!event.defaultPrevented && !isDisabled) {
            void context.selectFile();
          }
        }}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <Button
      data-slot="file-select-trigger"
      data-pending={context.pending || undefined}
      className={className}
      disabled={isDisabled}
      onClick={(event) => {
        callHandler(event, onClick);

        if (!event.defaultPrevented) {
          void context.selectFile();
        }
      }}
      size={size}
      type={type ?? "button"}
      variant={variant}
      {...props}
    >
      {children ?? context.buttonLabel}
    </Button>
  );
}

type FileSelectValueProps = Omit<React.ComponentProps<"span">, "children"> & {
  placeholder?: React.ReactNode;
  children?: React.ReactNode | ((file: SelectedFile | null) => React.ReactNode);
};

function FileSelectValue({
  className,
  placeholder = "No file selected",
  children,
  ...props
}: FileSelectValueProps) {
  const { value } = useFileSelectContext();
  const content =
    typeof children === "function"
      ? children(value)
      : (children ?? value?.name ?? placeholder);

  return (
    <span
      data-slot="file-select-value"
      data-empty={!value || undefined}
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    >
      {content}
    </span>
  );
}

type FileSelectClearProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "onClick"
> & {
  asChild?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
};

function FileSelectClear({
  asChild = false,
  children,
  className,
  disabled,
  onClick,
  type,
  variant,
  size,
  ...props
}: FileSelectClearProps) {
  const context = useFileSelectContext();
  const isDisabled =
    context.disabled ||
    context.pending ||
    disabled ||
    !context.clearable ||
    !context.value;

  if (!context.clearable || !context.value) {
    return null;
  }

  if (asChild) {
    return (
      <Slot.Root
        data-slot="file-select-clear"
        aria-disabled={isDisabled || undefined}
        className={className}
        onClick={(event) => {
          callHandler(event, onClick);

          if (!event.defaultPrevented && !isDisabled) {
            context.clearFile();
          }
        }}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <Button
      data-slot="file-select-clear"
      className={className}
      disabled={isDisabled}
      onClick={(event) => {
        callHandler(event, onClick);

        if (!event.defaultPrevented) {
          context.clearFile();
        }
      }}
      size={size}
      type={type ?? "button"}
      variant={variant ?? "outline"}
      {...props}
    >
      {children ?? "Clear"}
    </Button>
  );
}

export {
  FileSelectRoot,
  FileSelectTrigger,
  FileSelectValue,
  FileSelectClear,
  type FileDialogFilter,
  type SelectedFile,
};

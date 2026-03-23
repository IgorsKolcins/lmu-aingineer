import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { openDirectory } from "@/lib/files/client";
import { useSetting } from "@/lib/settings/client";
import { isTheme } from "@/lib/settings/schema";
import { useTheme } from "@/lib/theme";

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export const Route = createFileRoute("/settings")({
  component: RouteComponent,
});

const SettingsGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

const SettingsItem = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex justify-between gap-2">{children}</div>;
};

function RouteComponent() {
  const { theme, setTheme } = useTheme();
  const [fileSaveFolder, setFileSaveFolder] = useSetting("fileSaveFolder");
  const [geminiApiKey, setGeminiApiKey] = useSetting("geminiApiKey");

  const handleChooseFolder = async () => {
    const directory = await openDirectory({
      title: "Choose a folder for generated setups",
      buttonLabel: "Use folder",
    });

    if (directory) {
      await setFileSaveFolder(directory.path);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-4">
      <h1>Settings</h1>
      <SettingsGroup title="Theme">
        <SettingsItem>
          <Label>Color Scheme</Label>
          <Select
            value={theme}
            onValueChange={(value) => {
              if (isTheme(value)) {
                void setTheme(value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </SettingsGroup>

      <SettingsGroup title="AI">
        <Field>
          <FieldLabel htmlFor="gemini-api-key">Gemini API key</FieldLabel>
          <FieldContent>
            <Input
              id="gemini-api-key"
              type="password"
              value={geminiApiKey ?? ""}
              placeholder="Paste your Gemini API key"
              onChange={(event) =>
                void setGeminiApiKey(event.target.value.trim() || null)
              }
            />
            <FieldDescription>
              Required for AI setup generation. Clear the field to remove the
              stored key.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsGroup>

      <SettingsGroup title="Generated setup files">
        <Field>
          <FieldLabel htmlFor="save-folder">File save folder</FieldLabel>
          <FieldContent>
            <div className="flex flex-col gap-3">
              <Input
                id="save-folder"
                type="text"
                value={fileSaveFolder ?? ""}
                disabled
                placeholder="No folder selected"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleChooseFolder()}
                >
                  {fileSaveFolder ? "Change folder" : "Choose folder"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!fileSaveFolder}
                  onClick={() => void setFileSaveFolder(null)}
                >
                  Clear
                </Button>
              </div>
            </div>
            <FieldDescription>
              Generated `.svm` files are saved here. If this is empty, the app
              will ask for a folder the first time you save.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsGroup>
    </div>
  );
}

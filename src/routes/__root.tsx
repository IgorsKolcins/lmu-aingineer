import { useEffect, useRef, useState } from "react";
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiFileTextLine,
  RiSettings3Line,
} from "@remixicon/react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  createChat,
  deleteChat,
  setActiveChat,
  useChats,
} from "@/lib/chats/client";

const RootLayout = () => {
  const { activeChatId, chats } = useChats();
  const [sidebarError, setSidebarError] = useState("");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || chats.length > 0) {
      return;
    }

    initializedRef.current = true;
    void createChat().catch((error) => {
      initializedRef.current = false;
      setSidebarError(
        error instanceof Error ? error.message : "Unable to create a chat.",
      );
    });
  }, [chats.length]);

  const handleCreateChat = async () => {
    setSidebarError("");

    try {
      await createChat();
    } catch (error) {
      setSidebarError(
        error instanceof Error ? error.message : "Unable to create a chat.",
      );
    }
  };

  const handleSelectChat = async (chatId: string) => {
    if (chatId === activeChatId) {
      return;
    }

    setSidebarError("");

    try {
      await setActiveChat({ chatId });
    } catch (error) {
      setSidebarError(
        error instanceof Error ? error.message : "Unable to open the chat.",
      );
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    setSidebarError("");

    try {
      await deleteChat({ chatId });
    } catch (error) {
      setSidebarError(
        error instanceof Error ? error.message : "Unable to delete the chat.",
      );
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SidebarProvider className="min-h-screen items-start">
        <Sidebar className="fixed inset-y-0 left-0 h-svh" collapsible="none">
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <Link
              className="block rounded-none px-1 py-2 text-lg font-semibold tracking-[0.18em] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
              to="/"
            >
              LMU AIngineer
            </Link>
            <Button
              className="w-full justify-start"
              onClick={() => void handleCreateChat()}
            >
              <RiAddLine />
              Create new chat
            </Button>
            {sidebarError ? (
              <p className="text-xs text-destructive">{sidebarError}</p>
            ) : null}
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel>Chats</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {chats.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        isActive={chat.id === activeChatId}
                        onClick={() => void handleSelectChat(chat.id)}
                      >
                        <RiFileTextLine />
                        <span>{chat.title}</span>
                      </SidebarMenuButton>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <SidebarMenuAction
                            aria-label={`Delete ${chat.title}`}
                            onClick={(event) => event.stopPropagation()}
                            showOnHover
                          >
                            <RiDeleteBin6Line />
                          </SidebarMenuAction>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes {chat.title} and its
                              stored SQLite history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => void handleDeleteChat(chat.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <Button asChild className="w-full justify-start" variant="ghost">
              <Link to="/settings">
                <RiSettings3Line />
                Settings
              </Link>
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-screen rounded-none ml-[var(--sidebar-width)]">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
};

export const Route = createRootRoute({
  component: RootLayout,
});

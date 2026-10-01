import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResponseComposer, type ComposerSendVariables } from "@/features/conversation/response-composer";
import { COMPOSER_MODE_META, type ComposerMode } from "@/lib/domain/conversation";

function Harness({
  onSend,
  allowed = true,
}: {
  onSend: (variables: ComposerSendVariables) => Promise<unknown>;
  allowed?: boolean;
}) {
  const [mode, setMode] = useState<ComposerMode>("public");
  return <ResponseComposer mode={mode} onModeChange={setMode} onSend={onSend} allowed={allowed} />;
}

describe("ResponseComposer", () => {
  it("renders the three honest modes", () => {
    render(<Harness onSend={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole("tab", { name: COMPOSER_MODE_META.public.label })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: COMPOSER_MODE_META.private.label })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: COMPOSER_MODE_META.internal_note.label }),
    ).toBeInTheDocument();
  });

  it("sends a public reply and clears the draft on success", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "  Thanks for your patience.  ");
    await user.click(screen.getByRole("button", { name: /send public reply/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({
      kind: "public",
      body: "Thanks for your patience.",
      attachments: [],
    });
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("preserves each mode's draft while switching modes", async () => {
    const user = userEvent.setup();
    render(<Harness onSend={vi.fn().mockResolvedValue(undefined)} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "A public draft");

    await user.click(screen.getByRole("tab", { name: COMPOSER_MODE_META.internal_note.label }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.type(screen.getByRole("textbox"), "An internal note draft");

    await user.click(screen.getByRole("tab", { name: COMPOSER_MODE_META.public.label }));
    expect(screen.getByRole("textbox")).toHaveValue("A public draft");
  });

  it("sends an internal note with the internal kind", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSend={onSend} />);

    await user.click(screen.getByRole("tab", { name: COMPOSER_MODE_META.internal_note.label }));
    await user.type(screen.getByRole("textbox"), "Payments is investigating.");
    await user.click(screen.getByRole("button", { name: /send internal note/i }));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({
        kind: "internal_note",
        body: "Payments is investigating.",
        attachments: [],
      }),
    );
  });

  it("surfaces a send failure and offers a retry", async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error("The message could not be delivered."))
      .mockResolvedValueOnce(undefined);
    render(<Harness onSend={onSend} />);

    await user.type(screen.getByRole("textbox"), "Hello");
    await user.click(screen.getByRole("button", { name: /send public reply/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The message could not be delivered.");

    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
  });

  it("blocks sending when the role cannot reply", () => {
    render(<Harness onSend={vi.fn()} allowed={false} />);
    expect(screen.getByRole("button", { name: /send public reply/i })).toBeDisabled();
    expect(screen.getByText(/cannot send replies/i)).toBeInTheDocument();
  });
});

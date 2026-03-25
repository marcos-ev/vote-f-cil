import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RemoveMemberDialogProps = {
  open: boolean;
  memberLabel: string;
  isRemoving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function RemoveMemberDialog({
  open,
  memberLabel,
  isRemoving,
  onOpenChange,
  onConfirm,
}: RemoveMemberDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const canConfirm = useMemo(() => confirmText.trim().toUpperCase() === "REMOVER", [confirmText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remover usuário</DialogTitle>
          <DialogDescription>
            Você está prestes a remover o usuário <span className="font-semibold text-foreground">"{memberLabel}"</span>{" "}
            da sala de votação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Para confirmar, digite <span className="font-semibold text-foreground">REMOVER</span> abaixo.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite REMOVER"
            className="bg-secondary border-border"
            disabled={isRemoving}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRemoving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={!canConfirm || isRemoving}>
            {isRemoving ? "Removendo..." : "Remover da votação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


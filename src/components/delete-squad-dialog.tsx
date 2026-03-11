import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeleteSquadDialogProps = {
  open: boolean;
  squadName: string;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function DeleteSquadDialog({ open, squadName, isDeleting, onOpenChange, onConfirm }: DeleteSquadDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const canConfirm = useMemo(() => confirmText.trim().toUpperCase() === "APAGAR", [confirmText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apagar squad</DialogTitle>
          <DialogDescription>
            Você está prestes a apagar a squad <span className="font-semibold text-foreground">"{squadName}"</span>. Esta
            ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Para confirmar, digite <span className="font-semibold text-foreground">APAGAR</span> abaixo.</p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite APAGAR"
            className="bg-secondary border-border"
            disabled={isDeleting}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={!canConfirm || isDeleting}>
            {isDeleting ? "Apagando..." : "Apagar squad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

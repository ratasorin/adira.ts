import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, } from "@heroui/modal";
type EmitterCompanyWarningProps = {
    isOpen: boolean;
    currentCompanyName?: string;
    nextCompanyName?: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
};
export function EmitterCompanyWarning({ isOpen, currentCompanyName, nextCompanyName, onConfirm, onOpenChange, }: EmitterCompanyWarningProps) {
    return (<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Switch Emitter Company</ModalHeader>
        <ModalBody className="gap-3 text-sm text-foreground-600">
          <p>
            Changing the emitter from{" "}
            <b>{currentCompanyName || "the current company"}</b> to{" "}
            <b>{nextCompanyName || "the selected company"}</b> is destructive.
          </p>
          <p>
            This resets the invoice state, including selected products,
            modifiers, viewers, receiver details, notes, and any unsaved
            changes.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button color="danger" onPress={onConfirm}>
            Reset Invoice
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>);
}

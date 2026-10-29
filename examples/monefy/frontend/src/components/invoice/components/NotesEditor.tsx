import { Textarea } from "@heroui/react";
import { memo, useEffect, useState } from "react";
type NotesEditorProps = {
    initialValue: string;
    disabled: boolean;
    onCommit: (value: string) => void;
};
const NotesEditor = memo(function NotesEditor({ initialValue, disabled, onCommit, }: NotesEditorProps) {
    const [draftNotes, setDraftNotes] = useState(initialValue);
    useEffect(() => {
        setDraftNotes(initialValue);
    }, [initialValue]);
    useEffect(() => {
        if (draftNotes === initialValue) {
            return;
        }
        const timeout = window.setTimeout(() => {
            onCommit(draftNotes);
        }, 500);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [draftNotes, initialValue, onCommit]);
    return (<Textarea minRows={6} isDisabled={disabled} placeholder="Add invoice notices" value={draftNotes} onValueChange={setDraftNotes}/>);
});
export default NotesEditor;

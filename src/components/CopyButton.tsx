import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
    label: string;
    copiedLabel: string;
    isCopied: boolean;
    onCopy: () => void;
}

/** A small capsule copying something, confirming once it did. */
export const CopyButton = ({ label, copiedLabel, isCopied, onCopy }: CopyButtonProps) => (
    <Button size="sm" variant="secondary" className="shrink-0 gap-1.5 pl-2.5" onClick={onCopy}>
        {isCopied ? <Check className="size-3.75" /> : <Copy className="size-3.75" />}
        {isCopied ? copiedLabel : label}
    </Button>
);

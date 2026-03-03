"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  indeterminate,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { indeterminate?: boolean }) {
  // Use internal state to handle indeterminate visual state
  const [internalState, setInternalState] = React.useState<'checked' | 'unchecked' | 'indeterminate'>('unchecked');

  React.useEffect(() => {
    if (indeterminate) {
      setInternalState('indeterminate');
    } else if (checked) {
      setInternalState('checked');
    } else {
      setInternalState('unchecked');
    }
  }, [checked, indeterminate]);

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={indeterminate ? false : checked}
      onCheckedChange={(value) => {
        if (indeterminate) {
          // When indeterminate, clicking should select all
          onCheckedChange?.(true as any);
        } else {
          onCheckedChange?.(value);
        }
      }}
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        indeterminate && "data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
        forceMount
      >
        {internalState === 'indeterminate' ? (
          <MinusIcon className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

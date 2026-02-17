import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  disabled?: boolean
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled,
  ...props
}: SliderProps) {
  const currentValue = value ?? defaultValue ?? [min]
  const val = currentValue[0] ?? min

  return (
    <div className={cn("relative flex w-full touch-none items-center select-none", disabled && "opacity-50", className)} {...props}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        disabled={disabled}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
      />
    </div>
  )
}

export { Slider }

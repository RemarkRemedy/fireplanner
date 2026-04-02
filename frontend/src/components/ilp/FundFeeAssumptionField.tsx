import { Button } from "@/components/ui/button";
import { PercentInput } from "@/components/shared/PercentInput";
import { cn } from "@/lib/utils";
import { ILP_FUND_FEE_SUGGESTIONS } from "./fundFeeAssumptions";

interface FundFeeAssumptionFieldProps {
  value: number;
  onChange: (value: number) => void;
  note?: string;
  className?: string;
  inputLabelClassName?: string;
}

export function FundFeeAssumptionField({
  value,
  onChange,
  note = "Starts at 1.5% p.a. as a usable default. Adjust it if your fund mix is closer to fixed income, multi-asset, or equity funds, or replace it with the actual fee from the product documents.",
  className,
  inputLabelClassName,
}: FundFeeAssumptionFieldProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <PercentInput
        label="Fund management fee (p.a.)"
        value={value}
        onChange={onChange}
        labelClassName={inputLabelClassName}
        tooltip="Annual fee charged by the fund manager. This affects the fund-fee drag in the ILP fee story. Use the exact rate if you have it, or start from a typical range."
      />
      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div className="space-y-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Typical fund mixes
            </span>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Use one of these as a starting point if you do not have the exact
              fee from your statement yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {ILP_FUND_FEE_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion.label}
              type="button"
              size="sm"
              variant={
                Math.abs(value - suggestion.value) < 0.0005
                  ? "default"
                  : "outline"
              }
              className={cn("h-8 px-3 text-xs")}
              onClick={() => onChange(suggestion.value)}
            >
              {suggestion.label} {`${(suggestion.value * 100).toFixed(1)}%`}
            </Button>
          ))}
          </div>
        </div>
        <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {note}
        </p>
      </div>
    </div>
  );
}

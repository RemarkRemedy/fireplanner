import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FundFeeAssumptionField } from "@/components/ilp/FundFeeAssumptionField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { NumberInput } from "@/components/shared/NumberInput";
import { ProductPickerDialog } from "@/components/ilp/catalog/ProductPickerDialog";
import { CurrentBalanceAttributionCard } from "@/components/ilp/CurrentBalanceAttributionCard";
import { DecisionPanel } from "@/components/ilp/DecisionPanel";
import { FeeBreakdownSection } from "@/components/ilp/FeeBreakdownSection";
import { HeadlineInsight } from "@/components/ilp/HeadlineInsight";
import { IllustrativeChartsGroup } from "@/components/ilp/IllustrationOnlyChartFrame";
import { IlpIllustrativeDisclosureBanner } from "@/components/ilp/IlpIllustrativeDisclosureBanner";
import { OpportunityCostCard } from "@/components/ilp/OpportunityCostCard";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useIlpFeesIllustrativeDisclosure } from "@/hooks/useIlpFeesIllustrativeDisclosure";
import { analyzeIlpPolicy } from "@/lib/calculations/ilp";
import type { IlpPolicyAnalysis, IlpPolicyInput } from "@/lib/calculations/ilp";
import { getIlpCatalog } from "@/lib/ilp-catalog/getIlpCatalog";
import type { IlpPolicySeed } from "@/lib/ilp-catalog/policySeedSchema";
import { templateVariantToPolicySeed } from "@/lib/ilp-catalog/templateToPolicy";
import type {
  IlpCatalogProduct,
  IlpTemplateVariant,
} from "@/lib/ilp-catalog/types";
import { useIlpStore } from "@/stores/useIlpStore";
import {
  DEFAULT_ILP_FUND_FEE,
  scaleFundsToBlendedOcf,
} from "@/components/ilp/fundFeeAssumptions";

// --- Exit Setup Form: extends PolicySetupGate with per-account balances ---

interface ExitSetupFormProps {
  seed: IlpPolicySeed;
  onConfirm: (
    adjustedSeed: IlpPolicySeed,
    accountBalances: Record<string, number>,
  ) => void;
  onCancel: () => void;
}

function ExitSetupForm({ seed, onConfirm, onCancel }: ExitSetupFormProps) {
  const isSinglePremium =
    (seed.initialSinglePremium ?? 0) > 0 || seed.monthlyContribution === 0;
  const [monthlyContribution, setMonthlyContribution] = useState(
    seed.monthlyContribution,
  );
  const [initialSinglePremium, setInitialSinglePremium] = useState(
    seed.initialSinglePremium ?? 0,
  );
  const [currentPolicyYear, setCurrentPolicyYear] = useState(
    seed.currentPolicyYear,
  );
  const [monthsAlreadyPaid, setMonthsAlreadyPaid] = useState(
    seed.monthsAlreadyPaid,
  );
  const [fundFee, setFundFee] = useState(DEFAULT_ILP_FUND_FEE);

  // Per-account balances for existing holders
  const [accountBalances, setAccountBalances] = useState<
    Record<string, number>
  >(() => {
    const balances: Record<string, number> = {};
    for (const account of seed.accounts ?? []) {
      balances[account.id] = 0;
    }
    return balances;
  });
  const hasMultipleAccounts = (seed.accounts?.length ?? 0) > 1;

  function handleConfirm() {
    const adjustedSeed: IlpPolicySeed = {
      ...seed,
      monthlyContribution,
      initialSinglePremium: isSinglePremium
        ? initialSinglePremium
        : seed.initialSinglePremium,
      currentPolicyYear,
      monthsAlreadyPaid,
      funds: scaleFundsToBlendedOcf(seed.funds, fundFee),
    };
    onConfirm(adjustedSeed, accountBalances);
  }

  const horizonYears = Math.max(
    1,
    seed.mipLength != null
      ? seed.mipLength + (seed.postMipYears ?? 0) - (currentPolicyYear - 1)
      : (seed.postMipYears ?? 20),
  );

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{seed.name}</h2>
          <p className="text-sm text-muted-foreground">
            {seed.insurer} · {seed.currency}
            {seed.mipLength != null && ` · MIP ${seed.mipLength} years`}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Your current policy details</p>
          <p className="text-xs text-muted-foreground">
            Enter your current policy year, premiums paid, and account balances
            from your latest policy statement.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isSinglePremium ? (
            <CurrencyInput
              label="Initial Single Premium"
              value={initialSinglePremium}
              onChange={setInitialSinglePremium}
              currency={seed.currency}
            />
          ) : (
            <CurrencyInput
              label="Monthly Premium"
              value={monthlyContribution}
              onChange={setMonthlyContribution}
              currency={seed.currency}
            />
          )}
          <NumberInput
            label="Current Policy Year"
            value={currentPolicyYear}
            onChange={setCurrentPolicyYear}
            integer
            min={1}
          />
          <NumberInput
            label="Months Already Paid"
            value={monthsAlreadyPaid}
            onChange={setMonthsAlreadyPaid}
            integer
            min={0}
          />
          <FundFeeAssumptionField
            value={fundFee}
            onChange={setFundFee}
            note="Starts at 1.5% p.a. as a usable default for current-policy review. Replace it with the fund fee from your policy documents if you have it, or use one of the typical shortcuts as a starting point."
          />
          <div className="flex items-end">
            <div className="space-y-1 text-sm">
              <div className="text-muted-foreground">Projection horizon</div>
              <div className="font-medium">{horizonYears} years</div>
            </div>
          </div>
        </div>

        {/* Per-account balances */}
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {hasMultipleAccounts
                ? "Current account balances"
                : "Current account balance"}
            </p>
            <p className="text-xs text-muted-foreground">
              Find these on your latest policy statement.{" "}
              {hasMultipleAccounts
                ? "EEC (early exit charge) applies only to accounts marked as subject to EEC, so entering accurate per-account values matters for exit calculations."
                : "This is used to calculate your surrender value and exit options."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(seed.accounts ?? []).map((account) => (
              <CurrencyInput
                key={account.id}
                label={`${account.label} balance`}
                value={accountBalances[account.id] ?? 0}
                onChange={(value) =>
                  setAccountBalances((prev) => ({
                    ...prev,
                    [account.id]: value,
                  }))
                }
                currency={seed.currency}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleConfirm} className="gap-2">
            <Calculator className="h-4 w-4" />
            Calculate exit options
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main page ---

export function IlpExitCalculatorPage() {
  usePageMeta({
    title: "ILP Exit Calculator: SG FIRE Planner",
    description: "Calculate exit scenarios for your existing ILP policy.",
    path: "/ilp-fees/exit",
  });

  const addPolicyFromSeed = useIlpStore((state) => state.addPolicyFromSeed);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingSeed, setPendingSeed] = useState<IlpPolicySeed | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<IlpCatalogProduct | null>(null);
  const [exitPolicy, setExitPolicy] = useState<IlpPolicyInput | null>(null);
  const {
    revealed: illustrativeChartsRevealed,
    setRevealed: setIllustrativeChartsRevealed,
  } = useIlpFeesIllustrativeDisclosure();
  const requestedProductId = searchParams.get("productId");
  const requestedVariantId = searchParams.get("variantId");

  const routeSelection = useMemo(() => {
    if (!requestedProductId || !requestedVariantId) {
      return null;
    }

    const { products, manifest } = getIlpCatalog();
    const product = products.find(
      (candidate) => candidate.id === requestedProductId,
    );
    if (!product) {
      return null;
    }

    const variant = product.variants.find(
      (candidate) => candidate.id === requestedVariantId,
    );
    if (!variant) {
      return null;
    }

    return {
      product,
      seed: templateVariantToPolicySeed(product, variant, manifest),
    };
  }, [requestedProductId, requestedVariantId]);

  useEffect(() => {
    if (!routeSelection || pendingSeed || exitPolicy) {
      return;
    }

    setSelectedProduct(routeSelection.product);
    setPendingSeed(routeSelection.seed);
    setPickerOpen(false);
  }, [exitPolicy, pendingSeed, routeSelection]);

  const analysis: IlpPolicyAnalysis | null = useMemo(() => {
    if (!exitPolicy) return null;
    try {
      return analyzeIlpPolicy(exitPolicy);
    } catch {
      return null;
    }
  }, [exitPolicy]);

  function handleCatalogPick(
    product: IlpCatalogProduct,
    variant: IlpTemplateVariant,
  ) {
    const { manifest } = getIlpCatalog();
    const seed = templateVariantToPolicySeed(product, variant, manifest);
    setSelectedProduct(product);
    setPendingSeed(seed);
    setPickerOpen(false);
  }

  function handleExitSetupConfirm(
    adjustedSeed: IlpPolicySeed,
    accountBalances: Record<string, number>,
  ) {
    // Add to store to get a validated IlpPolicyInput, then immediately read it back
    const result = addPolicyFromSeed(adjustedSeed);
    if (!result.success) return;

    // Read the policy once and apply account balances locally (no second store write)
    const policy = useIlpStore
      .getState()
      .policies.find((p) => p.id === result.policyId);
    if (policy) {
      const policyWithBalances: IlpPolicyInput = {
        ...policy,
        accounts: policy.accounts.map((account) => ({
          ...account,
          currentValue: accountBalances[account.id] ?? account.currentValue,
        })),
      };
      setExitPolicy(policyWithBalances);
    }

    setPendingSeed(null);
  }

  // --- Product picker ---
  if (!pendingSeed && !exitPolicy) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">ILP Exit Calculator</h1>
          <p className="text-muted-foreground">
            Compare hold and exit scenarios using your own policy inputs and the
            assumptions in this tool.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Calculator className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Select your ILP product</p>
              <p className="text-sm text-muted-foreground">
                Choose from 92 supported products in the catalog.
              </p>
            </div>
            <Button onClick={() => setPickerOpen(true)} className="gap-2">
              Choose product
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              This tool compares scenarios based on your inputs and standardized
              assumptions. It does not tell you whether you should stay, exit,
              or switch.
            </p>
          </CardContent>
        </Card>

        <ProductPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handleCatalogPick}
        />
      </div>
    );
  }

  // --- Setup form ---
  if (pendingSeed && !exitPolicy && selectedProduct) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">ILP Exit Calculator</h1>
          <p className="text-muted-foreground">
            Enter your current policy details to calculate exit scenarios.
          </p>
        </div>
        <ExitSetupForm
          seed={pendingSeed}
          onConfirm={handleExitSetupConfirm}
          onCancel={() => {
            setPendingSeed(null);
            setSelectedProduct(null);
            if (requestedProductId || requestedVariantId) {
              navigate("/ilp-fees/exit", { replace: true });
            }
          }}
        />
      </div>
    );
  }

  // --- Results ---
  if (exitPolicy && analysis) {
    const isSinglePremium =
      (exitPolicy.initialSinglePremium ?? 0) > 0 ||
      exitPolicy.accounts.every((a) => a.contributionShare === 0);

    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Exit Analysis</h1>
            <Badge variant="outline">{exitPolicy.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {exitPolicy.insurer} · Policy year {exitPolicy.currentPolicyYear} ·{" "}
            {exitPolicy.currency}
          </p>
        </div>

        <IlpIllustrativeDisclosureBanner
          id="exit-analysis-illustrative"
          checked={illustrativeChartsRevealed}
          title="Illustrative charts across ILP Fees"
          description="These charts are modeled illustrations, not policy statements. Acknowledge them once here and the whole ILP Fees section will stay unlocked while each chart keeps a visible `Illustrative` label."
          onCheckedChange={setIllustrativeChartsRevealed}
          scopeLabel="ILP Fees"
        />

        <IllustrativeChartsGroup revealed={illustrativeChartsRevealed}>
          <div className="space-y-6">
            <CurrentBalanceAttributionCard
              policy={exitPolicy}
              analysis={analysis}
            />

            <HeadlineInsight policy={exitPolicy} analysis={analysis} />

            {analysis.mode === "projected" && (
              <FeeBreakdownSection policy={exitPolicy} analysis={analysis} />
            )}
          </div>
        </IllustrativeChartsGroup>

        <DecisionPanel policy={exitPolicy} analysis={analysis} />

        <OpportunityCostCard policy={exitPolicy} analysis={analysis} />

        {/* Premium holiday caveat */}
        {!isSinglePremium && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Premium holiday scenario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Taking a premium holiday (pausing contributions) may affect
                charges and bonus eligibility. Premium holiday impact is not
                fully modelled for all products. Use the full dashboard for
                manual scenario modelling with premium holiday events.
              </p>
              <Link
                to="/ilp-review"
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open full dashboard
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Not financial advice. These calculations are based on your inputs
              and standardized assumptions. Insurance coverage loss is not
              factored into the fee comparison. Consult a licensed financial
              adviser before making policy decisions.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link to="/ilp-review">
            <Button variant="outline" className="gap-2">
              See full details
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              setExitPolicy(null);
              setPendingSeed(null);
              setSelectedProduct(null);
              if (requestedProductId || requestedVariantId) {
                navigate("/ilp-fees/exit", { replace: true });
              }
            }}
          >
            Start over
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

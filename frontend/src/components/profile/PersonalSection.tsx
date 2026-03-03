import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProfileStore } from '@/stores/useProfileStore'
import type { MaritalStatus } from '@/lib/types'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { NumberInput } from '@/components/shared/NumberInput'
import { cn } from '@/lib/utils'

export function PersonalSection() {
  const { currentAge, retirementAge, lifeExpectancy, lifeStage, maritalStatus, residencyStatus, prMonths, setField, validationErrors } =
    useProfileStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personal Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Current Age
              <InfoTooltip text="Your current age in years" />
            </Label>
            <NumberInput
              integer
              value={currentAge}
              onChange={(v) => setField('currentAge', v)}
              min={18}
              max={100}
              className={cn('border-blue-300', validationErrors.currentAge && 'border-destructive')}
            />
            {validationErrors.currentAge && (
              <p className="text-xs text-destructive">{validationErrors.currentAge}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Retirement Age
              <InfoTooltip
                text="The age you plan to stop working and start withdrawing from your portfolio"
              />
            </Label>
            <NumberInput
              integer
              value={retirementAge}
              onChange={(v) => setField('retirementAge', v)}
              min={30}
              max={100}
              className={cn('border-blue-300', validationErrors.retirementAge && 'border-destructive')}
            />
            {validationErrors.retirementAge && (
              <p className="text-xs text-destructive">{validationErrors.retirementAge}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Life Expectancy
              <InfoTooltip text="The age you plan for your portfolio to last until. Higher is more conservative." />
            </Label>
            <NumberInput
              integer
              value={lifeExpectancy}
              onChange={(v) => setField('lifeExpectancy', v)}
              min={50}
              max={120}
              className={cn('border-blue-300', validationErrors.lifeExpectancy && 'border-destructive')}
            />
            {validationErrors.lifeExpectancy && (
              <p className="text-xs text-destructive">{validationErrors.lifeExpectancy}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Life Stage
              <InfoTooltip text="Pre-FIRE: accumulating wealth. Post-FIRE: living off portfolio." />
            </Label>
            <Select
              value={lifeStage}
              onValueChange={(v) => setField('lifeStage', v as 'pre-fire' | 'post-fire')}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre-fire">Pre-FIRE (Accumulating)</SelectItem>
                <SelectItem value="post-fire">Post-FIRE (Withdrawing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Marital Status
              <InfoTooltip text="Affects eligibility for Spouse Relief and Working Mother's Child Relief tax deductions." />
            </Label>
            <Select
              value={maritalStatus}
              onValueChange={(v) => setField('maritalStatus', v as MaritalStatus)}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center">
              Residency Status
              <InfoTooltip text="Sets your residency for CPF contribution rates, SRS caps, and tax calculations. For ABSD on property purchases, residency is set separately in the Property section." />
            </Label>
            <Select
              value={residencyStatus}
              onValueChange={(v) => setField('residencyStatus', v as 'citizen' | 'pr' | 'foreigner')}
            >
              <SelectTrigger className="border-blue-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">Permanent Resident</SelectItem>
                <SelectItem value="foreigner">Foreigner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {residencyStatus === 'pr' && (
            <div className="space-y-1">
              <Label className="text-sm flex items-center">
                Months as PR
                <InfoTooltip text="Months since obtaining PR status. CPF contribution rates are graduated: Year 1 (0-11 months) has 9% total, Year 2 (12-23 months) has 24% total, Year 3+ (24+ months) has full citizen rates." />
              </Label>
              <NumberInput
                integer
                value={prMonths}
                onChange={(v) => setField('prMonths', v)}
                min={0}
                max={600}
                className={cn('border-blue-300', validationErrors.prMonths && 'border-destructive')}
              />
              {validationErrors.prMonths && (
                <p className="text-xs text-destructive">{validationErrors.prMonths}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

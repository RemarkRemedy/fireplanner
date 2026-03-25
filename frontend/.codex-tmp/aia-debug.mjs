import { getIlpCatalog } from '../src/lib/ilp-catalog/getIlpCatalog.ts'
import { templateVariantToPolicySeed } from '../src/lib/ilp-catalog/templateToPolicy.ts'
import { ilpPolicySchema } from '../src/lib/validation/ilpSchema.ts'
import { projectIlpPolicy } from '../src/lib/calculations/ilp.ts'
const { manifest, products } = getIlpCatalog()
const product = products.find((e) => e.id === 'aia-elite-secure-income-5-pay')
const variant = product.variants.find((e) => e.id === 'sgd-mip-5')
const seed = templateVariantToPolicySeed(product, variant, manifest)
const fund={id:'f',name:'f',allocation:1,annualReturnMid:0,annualReturnLow:0,annualReturnHigh:0,ocf:0}
const base = ilpPolicySchema.parse({id:'x',...seed,currentPolicyYear:4,monthsAlreadyPaid:48,postMipYears:6,funds:[fund],accounts:seed.accounts.map((a)=>({...a,currentValue:25000}))})
const gated = ilpPolicySchema.parse({...base,id:'y',policyEvents:[{id:'w',type:'partial-withdrawal',label:'w',startPolicyMonth:73,durationMonths:1,amount:2000,accountId:'policy'}]})
for (const [label, policy] of [['base',base],['gated',gated]]) {
 const result = projectIlpPolicy(policy,'mid')
 console.log(label)
 console.log(JSON.stringify(result.rows.map((r)=>({policyYear:r.policyYear, open:r.accounts.find(a=>a.accountId==='policy')?.open, bonus:r.accounts.find(a=>a.accountId==='policy')?.bonusCredit, fee:r.accounts.find(a=>a.accountId==='policy')?.grossFee, close:r.accounts.find(a=>a.accountId==='policy')?.close, contribution:r.annualContribution})), null, 2))
}

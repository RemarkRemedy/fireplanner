import { HelpCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpPanel } from './HelpPanel'

export function MobileHelpSheet() {
  return (
    <div className="fixed bottom-16 right-4 z-40 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" className="rounded-full shadow-lg h-10 w-10">
            <HelpCircle className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Help</SheetTitle>
          </SheetHeader>
          <HelpPanel mobile />
        </SheetContent>
      </Sheet>
    </div>
  )
}

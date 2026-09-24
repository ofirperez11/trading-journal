import { Table2 } from 'lucide-react'
import { WeeklySummary } from '../components/WeeklySummary'
import { PageTitle } from '../components/PageTitle'

export default function Summary() {
  return (
    <div>
      <PageTitle
        icon={Table2}
        color="#d9730d"
        title="סיכום שבועי"
        subtitle="ביצועים לפי שבוע וחודש: נקודות נטו לכל מכשיר, אחוז הצלחה ו-R. הכל מחושב אוטומטית מהעסקאות, וההערות פתוחות לכתיבה."
      />
      <div className="mt-6">
        <WeeklySummary />
      </div>
    </div>
  )
}

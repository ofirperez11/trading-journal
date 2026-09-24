import { WeeklySummary } from '../components/WeeklySummary'

export default function Summary() {
  // Break out of the app's centered max-width container so the table can use
  // the full page width.
  return (
    <div>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">סיכום שבועי</h1>
          <p className="text-muted">
            פירוט ביצועים לפי שבוע וחודש — נקודות נטו לכל מכשיר, אחוז הצלחה ו-R. העמודות החודשיות ממוזגות
            לכל החודש; הכל מחושב אוטומטית מהעסקאות, וההערות פתוחות לכתיבה.
          </p>
        </div>
        <WeeklySummary />
      </div>
    </div>
  )
}

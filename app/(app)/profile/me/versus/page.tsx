"use client"

import * as React from "react"
import Image from "next/image"
import { ArrowLeft, Calendar, X, Swords, Clock, Trophy, ChevronRight, UserPlus, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// --- Types ---

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD"

type UserStats = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalDrinks: number
  totalCheers: number
  friends: number
  medals: number
  currentStreak: number
  uniqueTypes: number
  avgPerDay: number
  favDrink: string | null
  favDrinkCount: number
}

type Friend = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

type Duel = {
  id: string
  challenger_id: string
  challenged_id: string
  category: "total_drinks" | "drink_types"
  duration: string
  status: "pending" | "active" | "completed" | "declined" | "cancelled"
  start_date: string | null
  end_date: string | null
  challenger_score: number
  challenged_score: number
  winner_id: string | null
  created_at: string
  opponent: Friend
  amChallenger: boolean
}

const ROWS: { label: string; key: keyof UserStats; suffix?: string }[] = [
  { label: "Total Drinks", key: "totalDrinks" },
  { label: "Cheers Received", key: "totalCheers" },
  { label: "Friends", key: "friends" },
  { label: "Medals", key: "medals" },
  { label: "Streak", key: "currentStreak", suffix: "d" },
  { label: "Drink Types", key: "uniqueTypes" },
  { label: "Avg / Day", key: "avgPerDay" },
]

const timeRangeOptions: { key: TimeRange; label: string }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
]

const DUEL_CATEGORIES = [
  { key: "total_drinks", label: "Total Drinks", icon: "🍺" },
  { key: "drink_types", label: "Drink Types", icon: "🎨" },
] as const

const DUEL_DURATIONS = [
  { key: "1D", label: "1 Day" },
  { key: "3D", label: "3 Days" },
  { key: "1W", label: "1 Week" },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  total_drinks: "Total Drinks",
  drink_types: "Drink Types",
}

const CATEGORY_ICONS: Record<string, string> = {
  total_drinks: "🍺",
  drink_types: "🎨",
}

// --- Helpers ---

function getTimeRangeLabel(value: TimeRange): string {
  return timeRangeOptions.find((opt) => opt.key === value)?.label ?? value
}

function getDateRangeStart(timeRange: TimeRange, now: Date): Date {
  let startDate: Date
  switch (timeRange) {
    case "1W": startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); break
    case "1M": startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
    case "3M": startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
    case "6M": startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break
    case "1Y": startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    case "YTD": startDate = new Date(now.getFullYear(), 0, 1); break
    default: startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
  startDate.setHours(0, 0, 0, 0)
  return startDate
}

function fmt(v: number, suffix = "") {
  if (typeof v === "number" && v % 1 !== 0) return v.toFixed(1) + suffix
  return v + suffix
}

function filterLogsByTimeRange(logs: any[], timeRange: TimeRange): any[] {
  const now = new Date()
  const start = getDateRangeStart(timeRange, now)
  return logs.filter((l) => new Date(l.createdAt ?? l.created_at) >= start)
}

function computeStatsFromLogs(logs: any[]) {
  if (!logs.length) return { totalDrinks: 0, uniqueTypes: 0, avgPerDay: 0, currentStreak: 0, favDrink: null as string | null, favDrinkCount: 0 }

  const totalDrinks = logs.length
  const typeSet = new Set(logs.map((l: any) => l.drinkType ?? l.drink_type))
  const uniqueTypes = typeSet.size

  const dates = logs.map((l: any) => new Date(l.createdAt ?? l.created_at).getTime()).filter((t) => !isNaN(t))
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const days = Math.max(1, (maxDate - minDate) / (24 * 60 * 60 * 1000))
  const avgPerDay = Math.round((logs.length / days) * 100) / 100

  const daySet = new Set<string>()
  for (const l of logs) {
    const d = new Date(l.createdAt ?? l.created_at)
    if (!isNaN(d.getTime())) daySet.add(d.toISOString().slice(0, 10))
  }
  const sortedDays = [...daySet].sort().reverse()
  let currentStreak = 0
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
    let checkDate = new Date(sortedDays[0])
    for (const day of sortedDays) {
      if (day === checkDate.toISOString().slice(0, 10)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else break
    }
  }

  const typeCounts: Record<string, number> = {}
  for (const l of logs) {
    const t = l.drinkType ?? l.drink_type ?? "Other"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  let favDrink: string | null = null
  let favDrinkCount = 0
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > favDrinkCount) { favDrink = type; favDrinkCount = count }
  }

  return { totalDrinks, uniqueTypes, avgPerDay, currentStreak, favDrink, favDrinkCount }
}

function timeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return "Ended"
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h left`
  if (hours > 0) return `${hours}h left`
  return `${Math.floor(diff / (1000 * 60))}m left`
}

// --- Shared Components ---

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  return (
    <div ref={menuRef} className="relative">
      <button type="button" onClick={() => setShowMenu(!showMenu)} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium">
        <Calendar className="h-4 w-4" />
        {getTimeRangeLabel(value)}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border bg-background shadow-lg">
          {timeRangeOptions.map((opt) => (
            <button key={opt.key} type="button" onClick={() => { onChange(opt.key); setShowMenu(false) }}
              className={cn("w-full px-4 py-3 text-left text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-foreground/5", value === opt.key ? "font-semibold" : "")}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-sm ring-2 ring-white dark:ring-neutral-800 border border-neutral-100 dark:border-white/[0.06]">
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-neutral-400 dark:text-white/30">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
      </svg>
    </div>
  )
}

function SmallAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <div className="relative h-9 w-9 overflow-hidden rounded-full">
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/[0.08]">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-neutral-400 dark:text-white/30">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="currentColor" />
      </svg>
    </div>
  )
}

function Bar({ myVal, theirVal, animated }: { myVal: number; theirVal: number; animated: boolean }) {
  const bothZero = myVal === 0 && theirVal === 0
  const total = myVal + theirVal || 1
  const myPct = bothZero ? 50 : (myVal / total) * 100
  const tied = myVal === theirVal
  const onlyLeft = theirVal === 0 && myVal > 0
  const onlyRight = myVal === 0 && theirVal > 0

  return (
    <div className="flex h-[6px] w-full gap-[2px] rounded-full overflow-hidden">
      <div className={cn("transition-all duration-700 ease-out", onlyLeft ? "rounded-full" : "rounded-l-full")}
        style={{ width: animated ? `${myPct}%` : "50%", minWidth: bothZero ? 0 : (myVal > 0 ? 6 : 0), backgroundColor: myVal > theirVal && !tied ? "#3478F6" : "#e5e5e5" }} />
      <div className={cn("transition-all duration-700 ease-out", onlyRight ? "rounded-full" : "rounded-r-full")}
        style={{ width: animated ? `${100 - myPct}%` : "50%", minWidth: bothZero ? 0 : (theirVal > 0 ? 6 : 0), backgroundColor: theirVal > myVal && !tied ? "#3478F6" : "#e5e5e5" }} />
    </div>
  )
}

function StatRow({ label, myVal, theirVal, suffix = "", animated, delay }: { label: string; myVal: number; theirVal: number; suffix?: string; animated: boolean; delay: number }) {
  const tied = myVal === theirVal
  return (
    <div style={{ opacity: animated ? 1 : 0, transform: animated ? "translateY(0)" : "translateY(6px)", transition: `all 0.35s ease-out ${delay}ms` }}>
      <div className="relative flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: myVal > theirVal && !tied ? "#3478F6" : "#a3a3a3" }}>{fmt(myVal, suffix)}</span>
        <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: theirVal > myVal && !tied ? "#3478F6" : "#a3a3a3" }}>{fmt(theirVal, suffix)}</span>
      </div>
      <Bar myVal={myVal} theirVal={theirVal} animated={animated} />
    </div>
  )
}

// --- Friend Picker Modal ---

function FriendPickerModal({ open, onClose, friends, onSelect }: { open: boolean; onClose: () => void; friends: Friend[]; onSelect: (f: Friend) => void }) {
  const [search, setSearch] = React.useState("")
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const filtered = friends.filter((f) => f.displayName.toLowerCase().includes(search.toLowerCase()) || f.username.toLowerCase().includes(search.toLowerCase()))

  if (!open) return null

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === backdropRef.current) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 max-h-[70vh] rounded-[1.5rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-[17px] font-bold text-neutral-900 dark:text-white">Choose Opponent</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-colors">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text" placeholder="Search friends…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 dark:border-white/[0.08] bg-neutral-50 dark:bg-white/[0.04] pl-9 pr-4 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-4">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-neutral-400 dark:text-white/30 py-8">No friends found</p>
          ) : (
            filtered.map((f) => (
              <button key={f.id} type="button" onClick={() => { onSelect(f); onClose() }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors">
                <SmallAvatar name={f.displayName} avatarUrl={f.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">{f.displayName}</p>
                  <p className="text-[12px] text-neutral-400 dark:text-white/30">@{f.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// --- Challenge Modal ---

function ChallengeModal({ open, onClose, opponentName, onSend, sending }: { open: boolean; onClose: () => void; opponentName: string; onSend: (cat: string, dur: string) => void; sending: boolean }) {
  const [category, setCategory] = React.useState<string>("total_drinks")
  const [duration, setDuration] = React.useState<string>("1D")
  const backdropRef = React.useRef<HTMLDivElement>(null)
  if (!open) return null

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === backdropRef.current) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-[1.5rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-[17px] font-bold text-neutral-900 dark:text-white">Challenge {opponentName}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-colors"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Category</p>
          <div className="flex gap-2">
            {DUEL_CATEGORIES.map((cat) => (
              <button key={cat.key} type="button" onClick={() => setCategory(cat.key)}
                className={cn("flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition-all border",
                  category === cat.key ? "border-[#3478F6] bg-[#3478F6]/10 text-[#3478F6]" : "border-neutral-200 dark:border-white/[0.08] text-neutral-500 dark:text-white/40 hover:bg-neutral-50 dark:hover:bg-white/[0.04]")}>
                <span>{cat.icon}</span><span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5">
          <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Timeframe</p>
          <div className="flex gap-2">
            {DUEL_DURATIONS.map((dur) => (
              <button key={dur.key} type="button" onClick={() => setDuration(dur.key)}
                className={cn("flex-1 rounded-xl px-3 py-3 text-sm font-medium transition-all border text-center",
                  duration === dur.key ? "border-[#3478F6] bg-[#3478F6]/10 text-[#3478F6]" : "border-neutral-200 dark:border-white/[0.08] text-neutral-500 dark:text-white/40 hover:bg-neutral-50 dark:hover:bg-white/[0.04]")}>
                {dur.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5">
          <button type="button" onClick={() => onSend(category, duration)} disabled={sending}
            className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-all disabled:opacity-50" style={{ backgroundColor: "#3478F6" }}>
            {sending ? "Sending…" : "Send Challenge"}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- My Duels Sheet ---

function MyDuelsSheet({ open, onClose, duels, userId, loading, onAccept, onDecline, accepting }: {
  open: boolean; onClose: () => void; duels: Duel[]; userId: string; loading: boolean; onAccept: (id: string) => void; onDecline: (id: string) => void; accepting: string | null
}) {
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const pendingIncoming = duels.filter((d) => d.status === "pending" && !d.amChallenger)
  const pendingOutgoing = duels.filter((d) => d.status === "pending" && d.amChallenger)
  const active = duels.filter((d) => d.status === "active")
  const completed = duels.filter((d) => d.status === "completed").slice(0, 10)

  if (!open) return null

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === backdropRef.current) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 max-h-[80vh] rounded-[1.5rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white dark:bg-neutral-900 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-neutral-600 dark:text-white/60" />
            <h3 className="text-[17px] font-bold text-neutral-900 dark:text-white">My Duels</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-colors"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 flex-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.08]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-24 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                      <div className="h-2.5 w-32 rounded bg-neutral-100 dark:bg-white/[0.06]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : duels.length === 0 ? (
            <div className="text-center py-12">
              <Swords className="h-10 w-10 text-neutral-200 dark:text-white/10 mx-auto mb-3" />
              <p className="text-sm text-neutral-400 dark:text-white/30">No duels yet</p>
              <p className="text-xs text-neutral-300 dark:text-white/20 mt-1">Challenge a friend from the comparison view!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {pendingIncoming.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Incoming Challenges ({pendingIncoming.length})</p>
                  <div className="space-y-2.5">{pendingIncoming.map((d) => <DuelCard key={d.id} duel={d} userId={userId} onAccept={onAccept} onDecline={onDecline} accepting={accepting} />)}</div>
                </div>
              )}
              {active.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Active ({active.length})</p>
                  <div className="space-y-2.5">{active.map((d) => <DuelCard key={d.id} duel={d} userId={userId} />)}</div>
                </div>
              )}
              {pendingOutgoing.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Sent ({pendingOutgoing.length})</p>
                  <div className="space-y-2.5">{pendingOutgoing.map((d) => <DuelCard key={d.id} duel={d} userId={userId} />)}</div>
                </div>
              )}
              {completed.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide mb-2.5">Completed</p>
                  <div className="space-y-2.5">{completed.map((d) => <DuelCard key={d.id} duel={d} userId={userId} />)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Duel Card ---

function DuelCard({ duel, userId, onAccept, onDecline, accepting }: {
  duel: Duel; userId: string; onAccept?: (id: string) => void; onDecline?: (id: string) => void; accepting?: string | null
}) {
  const myScore = duel.amChallenger ? duel.challenger_score : duel.challenged_score
  const theirScore = duel.amChallenger ? duel.challenged_score : duel.challenger_score
  const isPending = duel.status === "pending"
  const isActive = duel.status === "active"
  const isCompleted = duel.status === "completed"
  const iWon = duel.winner_id === userId
  const needsResponse = isPending && !duel.amChallenger

  return (
    <div className="rounded-2xl border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-md px-4 py-3.5">
      <div className="flex items-center gap-3">
        <SmallAvatar name={duel.opponent.displayName} avatarUrl={duel.opponent.avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">{duel.opponent.displayName}</span>
            <span className="text-[11px] text-neutral-400 dark:text-white/30">@{duel.opponent.username}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px]">{CATEGORY_ICONS[duel.category]}</span>
            <span className="text-[12px] text-neutral-500 dark:text-white/40 font-medium">{CATEGORY_LABELS[duel.category]}</span>
            <span className="text-[10px] text-neutral-300 dark:text-white/15">·</span>
            <span className="text-[12px] text-neutral-400 dark:text-white/30">{duel.duration}</span>
          </div>
        </div>

        {isActive && duel.end_date && (
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold tabular-nums" style={{ color: myScore >= theirScore ? "#3478F6" : "#a3a3a3" }}>{myScore}</span>
              <span className="text-[11px] text-neutral-300 dark:text-white/20">–</span>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: theirScore >= myScore ? "#3478F6" : "#a3a3a3" }}>{theirScore}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 justify-end">
              <Clock className="h-3 w-3 text-neutral-400 dark:text-white/30" />
              <span className="text-[11px] text-neutral-400 dark:text-white/30">{timeLeft(duel.end_date)}</span>
            </div>
          </div>
        )}
        {isCompleted && (
          <div className="shrink-0">
            {iWon ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"><Trophy className="h-3 w-3" /> Won</span>
            ) : duel.winner_id ? (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-white/40">Lost</span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-white/40">Tied</span>
            )}
          </div>
        )}
        {isPending && duel.amChallenger && (
          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</span>
        )}
      </div>

      {needsResponse && onAccept && onDecline && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-white/[0.04]">
          <button type="button" onClick={() => onDecline(duel.id)} className="flex-1 rounded-xl py-2.5 text-[13px] font-medium border border-neutral-200 dark:border-white/[0.08] text-neutral-600 dark:text-white/50 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors">Decline</button>
          <button type="button" onClick={() => onAccept(duel.id)} disabled={accepting === duel.id} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50" style={{ backgroundColor: "#3478F6" }}>{accepting === duel.id ? "Accepting…" : "Accept"}</button>
        </div>
      )}
    </div>
  )
}

// --- Loading Skeleton ---

function LoadingSkeleton() {
  return (
    <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1">
            <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="text-center mt-3 flex flex-col items-center gap-1.5">
              <div className="h-3.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-8 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-center mx-2">
            <div className="-mt-6 h-10 w-24 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="mt-2.5 h-9 w-9 rounded-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-white/[0.08] animate-pulse" />
            <div className="text-center mt-3 flex flex-col items-center gap-1.5">
              <div className="h-3.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-5 h-px bg-black/[0.04] dark:bg-white/[0.04]" />
      <div className="px-5 py-5 flex flex-col gap-5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i}>
            <div className="relative flex items-center justify-between mb-1.5">
              <div className="h-3 w-8 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="absolute left-1/2 -translate-x-1/2 h-2.5 w-16 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-8 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            <div className="flex h-[6px] w-full gap-[2px] rounded-full overflow-hidden">
              <div className="flex-1 rounded-l-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="flex-1 rounded-r-full bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        ))}
        <div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <div className="h-3 w-14 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-5 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 h-2.5 w-14 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex items-baseline gap-1">
              <div className="h-3 w-14 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-2.5 w-5 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Empty Opponent Placeholder ---

function EmptyOpponentAvatar({ onTap }: { onTap: () => void }) {
  return (
    <button type="button" onClick={onTap}
      className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 dark:border-white/[0.15] bg-neutral-100 dark:bg-white/[0.08] ring-2 ring-white dark:ring-neutral-800 shadow-sm transition-all hover:border-[#3478F6] hover:bg-[#3478F6]/5 active:scale-95">
      <UserPlus className="h-8 w-8 text-neutral-300 dark:text-white/15" />
    </button>
  )
}

// --- Main Page ---

export default function MyVersusPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userId, setUserId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M")
  const [animated, setAnimated] = React.useState(false)

  // Data
  const [myProfile, setMyProfile] = React.useState<any>(null)
  const [myLogs, setMyLogs] = React.useState<any[]>([])
  const [myAchievements, setMyAchievements] = React.useState<any[]>([])
  const [myRawJson, setMyRawJson] = React.useState<any>(null)

  const [theirProfile, setTheirProfile] = React.useState<any>(null)
  const [theirLogs, setTheirLogs] = React.useState<any[]>([])
  const [theirAchievements, setTheirAchievements] = React.useState<any[]>([])
  const [theirRawJson, setTheirRawJson] = React.useState<any>(null)

  // Friends list
  const [friends, setFriends] = React.useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = React.useState<Friend | null>(null)
  const [opponentLoading, setOpponentLoading] = React.useState(false)

  // Modals
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [challengeOpen, setChallengeOpen] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [challengeSent, setChallengeSent] = React.useState(false)

  // Duels
  const [duelsOpen, setDuelsOpen] = React.useState(false)
  const [duels, setDuels] = React.useState<Duel[]>([])
  const [duelsLoading, setDuelsLoading] = React.useState(true)
  const [accepting, setAccepting] = React.useState<string | null>(null)
  const pendingCount = duels.filter((d) => d.status === "pending" && !d.amChallenger).length

  // --- Load my profile + friends ---
  React.useEffect(() => {
    async function load() {
      setError(null); setLoading(true)
      try {
        const { data: sessRes } = await supabase.auth.getSession()
        const token = sessRes.session?.access_token
        const uid = sessRes.session?.user.id
        if (!token || !uid) { router.replace("/login"); return }
        setUserId(uid)

        const res = await fetch("/api/profile/me", { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error("Failed to load profile")
        const json = await res.json()
        setMyProfile(json.profile); setMyRawJson(json); setMyLogs(json.logs ?? []); setMyAchievements(json.userAchievements ?? [])

        // Load friends list - try API first, fallback to Supabase direct
        let friendsList: Friend[] = []
        try {
          const friendsRes = await fetch("/api/friends", { headers: { Authorization: `Bearer ${token}` } })
          console.log("[Versus] /api/friends status:", friendsRes.status)
          if (friendsRes.ok) {
            const friendsJson = await friendsRes.json()
            console.log("[Versus] /api/friends response keys:", Object.keys(friendsJson))
            const raw = friendsJson.friends ?? friendsJson.data ?? friendsJson ?? []
            const arr = Array.isArray(raw) ? raw : []
            friendsList = arr.map((f: any) => ({
              id: f.id, username: f.username, displayName: f.displayName ?? f.display_name ?? f.username, avatarUrl: f.avatarUrl ?? f.avatar_url ?? null,
            }))
            console.log("[Versus] friends from API:", friendsList.length)
          }
        } catch (e) {
          console.log("[Versus] /api/friends failed:", e)
        }

        // Fallback: query Supabase directly with multiple table name attempts
        if (friendsList.length === 0) {
          console.log("[Versus] Trying Supabase direct friends query...")
          try {
            const { data, error: qErr } = await supabase
              .from("friendships")
              .select("*")
              .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
              .eq("status", "accepted")
              .limit(50)

            console.log(`[Versus] friendships query:`, { count: data?.length, error: qErr?.message })

            if (data && data.length > 0) {
              const friendIds = data.map((f: any) => f.requester_id === uid ? f.addressee_id : f.requester_id)
              const { data: profiles } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_path")
                .in("id", friendIds)

              if (profiles) {
                for (const p of profiles) {
                  let avatarUrl = null
                  if (p.avatar_path) {
                    const { data: urlData } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 3600)
                    avatarUrl = urlData?.signedUrl ?? null
                  }
                  friendsList.push({ id: p.id, username: p.username, displayName: p.display_name || p.username, avatarUrl })
                }
              }
              console.log(`[Versus] Got ${friendsList.length} friends from friendships`)
            }
          } catch (e) {
            console.error("[Versus] friendships query failed:", e)
          }
        }

        setFriends(friendsList)
        console.log("[Versus] Final friends count:", friendsList.length)

        // Load duels
        await loadDuels(uid)
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  // --- Load opponent data ---
  async function loadOpponent(friend: Friend) {
    setOpponentLoading(true); setAnimated(false)
    try {
      const { data: sessRes } = await supabase.auth.getSession()
      const token = sessRes.session?.access_token
      if (!token) return

      const res = await fetch(`/api/profile/${encodeURIComponent(friend.username)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error("Failed to load opponent")
      const json = await res.json()
      setTheirProfile(json.profile); setTheirRawJson(json); setTheirLogs(json.logs ?? []); setTheirAchievements(json.userAchievements ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load opponent.")
    } finally {
      setOpponentLoading(false)
    }
  }

  function handleSelectFriend(f: Friend) {
    setSelectedFriend(f)
    loadOpponent(f)
  }

  // --- Load duels ---
  async function loadDuels(uid: string) {
    setDuelsLoading(true)
    try {
      const { data, error: err } = await supabase.from("duels").select("*").or(`challenger_id.eq.${uid},challenged_id.eq.${uid}`).order("created_at", { ascending: false })
      if (err) throw err
      const raw = data ?? []

      const oppIds = new Set<string>()
      raw.forEach((d) => oppIds.add(d.challenger_id === uid ? d.challenged_id : d.challenger_id))

      const profileMap: Record<string, Friend> = {}
      if (oppIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_path").in("id", Array.from(oppIds))
        if (profiles) {
          for (const p of profiles) {
            let avatarUrl = null
            if (p.avatar_path) {
              const { data: urlData } = await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 3600)
              avatarUrl = urlData?.signedUrl ?? null
            }
            profileMap[p.id] = { id: p.id, username: p.username, displayName: p.display_name || p.username, avatarUrl }
          }
        }
      }

      setDuels(raw.map((d) => {
        const am = d.challenger_id === uid
        const oppId = am ? d.challenged_id : d.challenger_id
        return { ...d, opponent: profileMap[oppId] ?? { id: oppId, username: "unknown", displayName: "Unknown", avatarUrl: null }, amChallenger: am }
      }))
    } catch (e) { console.error("Failed to load duels:", e) }
    finally { setDuelsLoading(false) }
  }

  async function handleAccept(duelId: string) {
    if (!userId) return
    setAccepting(duelId)
    try {
      const duel = duels.find((d) => d.id === duelId)
      if (!duel) return
      const now = new Date()
      const ms = duel.duration === "3D" ? 3 * 86400000 : duel.duration === "1W" ? 7 * 86400000 : 86400000
      await supabase.from("duels").update({ status: "active", start_date: now.toISOString(), end_date: new Date(now.getTime() + ms).toISOString() }).eq("id", duelId)
      await loadDuels(userId)
    } catch (e) { console.error(e) }
    finally { setAccepting(null) }
  }

  async function handleDecline(duelId: string) {
    if (!userId) return
    await supabase.from("duels").update({ status: "declined" }).eq("id", duelId)
    await loadDuels(userId)
  }

  async function handleSendChallenge(category: string, duration: string) {
    if (!myStats || !theirStats) return
    setSending(true)
    try {
      const { error: err } = await supabase.from("duels").insert({ challenger_id: myStats.id, challenged_id: theirStats.id, category, duration, status: "pending" })
      if (err) throw err
      setChallengeOpen(false); setChallengeSent(true)
      setTimeout(() => setChallengeSent(false), 3000)
      if (userId) await loadDuels(userId)
    } catch (e: any) { console.error(e) }
    finally { setSending(false) }
  }

  // --- Computed stats ---
  const myStats = React.useMemo<UserStats | null>(() => {
    if (!myProfile) return null
    const filtered = filterLogsByTimeRange(myLogs, timeRange)
    const computed = computeStatsFromLogs(filtered)
    const cheers = myProfile.totalCheersReceived ?? myProfile.cheersReceived ?? myProfile.totalCheers ?? myRawJson?.totalCheersReceived ?? myRawJson?.cheersReceived ?? 0
    return {
      id: myProfile.id, username: myProfile.username, displayName: myProfile.displayName, avatarUrl: myProfile.avatarUrl,
      totalDrinks: computed.totalDrinks, totalCheers: cheers, friends: myProfile.friendCount ?? 0, medals: myAchievements.length,
      currentStreak: computed.currentStreak, uniqueTypes: computed.uniqueTypes, avgPerDay: computed.avgPerDay,
      favDrink: computed.favDrink, favDrinkCount: computed.favDrinkCount,
    }
  }, [myProfile, myLogs, myAchievements, myRawJson, timeRange])

  const theirStats = React.useMemo<UserStats | null>(() => {
    if (!theirProfile) return null
    const filtered = filterLogsByTimeRange(theirLogs, timeRange)
    const computed = computeStatsFromLogs(filtered)
    const cheers = theirProfile.totalCheersReceived ?? theirProfile.cheersReceived ?? theirProfile.totalCheers ?? theirRawJson?.totalCheersReceived ?? theirRawJson?.cheersReceived ?? 0
    return {
      id: theirProfile.id, username: theirProfile.username, displayName: theirProfile.displayName, avatarUrl: theirProfile.avatarUrl,
      totalDrinks: computed.totalDrinks, totalCheers: cheers, friends: theirProfile.friendCount ?? 0, medals: theirAchievements.length,
      currentStreak: computed.currentStreak, uniqueTypes: computed.uniqueTypes, avgPerDay: computed.avgPerDay,
      favDrink: computed.favDrink, favDrinkCount: computed.favDrinkCount,
    }
  }, [theirProfile, theirLogs, theirAchievements, theirRawJson, timeRange])

  React.useEffect(() => {
    setAnimated(false)
    if (!loading && !opponentLoading && myStats) {
      const t = setTimeout(() => setAnimated(true), 150)
      return () => clearTimeout(t)
    }
  }, [loading, opponentLoading, myStats, theirStats, timeRange])

  let myWins = 0, theirWins = 0
  if (myStats && theirStats) {
    ROWS.forEach(({ key }) => {
      const m = myStats[key] as number, t = theirStats[key] as number
      if (m > t) myWins++; else if (m < t) theirWins++
    })
  }

  const hasOpponent = selectedFriend && theirStats && !opponentLoading

  return (
    <div className="container max-w-2xl px-0 sm:px-4 py-1.5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] backdrop-blur-sm p-2 transition-all hover:bg-white dark:hover:bg-white/[0.1]" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-white/70" />
          </button>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Versus</h2>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDuelsOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5">
            <Swords className="h-4 w-4" />
            My Duels
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#3478F6" }}>{pendingCount}</span>
            )}
          </button>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-50/50 dark:bg-red-500/10 backdrop-blur-md px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      {challengeSent && (
        <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-50/50 dark:bg-green-500/10 backdrop-blur-md px-4 py-3 text-sm text-green-600 dark:text-green-400">
          Challenge sent to {theirStats?.displayName}!
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="rounded-[2rem] border border-neutral-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] overflow-hidden">
          {/* Header: avatars + score */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between">
              {/* Me */}
              <div className="flex flex-col items-center flex-1">
                <Avatar name={myStats?.displayName ?? ""} avatarUrl={myStats?.avatarUrl ?? null} />
                <div className="text-center mt-3">
                  <div className="text-[14px] font-semibold text-neutral-900 dark:text-white leading-tight">{myStats?.displayName}</div>
                  <div className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">You</div>
                </div>
              </div>

              {/* Center: score pill + challenge button */}
              <div className="flex flex-col items-center mx-2">
                {hasOpponent ? (
                  <>
                    <div className="-mt-6">
                      <div className="flex items-center gap-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-4 py-2">
                        <span className="text-[22px] font-bold tabular-nums" style={{ color: myWins >= theirWins ? "#3478F6" : "#a3a3a3" }}>{myWins}</span>
                        <span className="text-[13px] font-medium text-neutral-300 dark:text-white/20">–</span>
                        <span className="text-[22px] font-bold tabular-nums" style={{ color: theirWins >= myWins ? "#3478F6" : "#a3a3a3" }}>{theirWins}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setChallengeOpen(true)}
                      className="mt-2.5 inline-flex items-center justify-center h-9 w-9 rounded-full border border-neutral-200 dark:border-white/[0.1] bg-white/80 dark:bg-white/[0.06] backdrop-blur-sm transition-all hover:bg-neutral-50 dark:hover:bg-white/[0.1] hover:scale-105 active:scale-95"
                      aria-label="Challenge to duel">
                      <Swords className="h-4 w-4 text-neutral-500 dark:text-white/50" />
                    </button>
                  </>
                ) : (
                  <div className="-mt-6">
                    <div className="flex items-center gap-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-4 py-2">
                      <span className="text-[22px] font-bold tabular-nums text-neutral-200 dark:text-white/10">0</span>
                      <span className="text-[13px] font-medium text-neutral-300 dark:text-white/20">–</span>
                      <span className="text-[22px] font-bold tabular-nums text-neutral-200 dark:text-white/10">0</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Opponent (tappable to switch) */}
              <div className="flex flex-col items-center flex-1">
                {hasOpponent ? (
                  <button type="button" onClick={() => setPickerOpen(true)} className="transition-all hover:scale-105 active:scale-95">
                    <Avatar name={theirStats!.displayName} avatarUrl={theirStats!.avatarUrl} />
                  </button>
                ) : (
                  <EmptyOpponentAvatar onTap={() => setPickerOpen(true)} />
                )}
                <div className="text-center mt-3">
                  {hasOpponent ? (
                    <>
                      <div onClick={() => setPickerOpen(true)} className="text-[14px] font-semibold text-neutral-900 dark:text-white leading-tight cursor-pointer hover:text-[#3478F6] transition-colors">
                        {theirStats!.displayName}
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">@{theirStats!.username}</div>
                    </>
                  ) : opponentLoading ? (
                    <>
                      <div className="h-3.5 w-16 mx-auto rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                      <div className="h-2.5 w-10 mx-auto mt-1.5 rounded bg-neutral-100 dark:bg-white/[0.06] animate-pulse" />
                    </>
                  ) : (
                    <>
                      <div onClick={() => setPickerOpen(true)} className="text-[14px] font-semibold text-neutral-400 dark:text-white/30 leading-tight cursor-pointer hover:text-[#3478F6] transition-colors">
                        Choose friend
                      </div>
                      <div className="text-[11px] text-neutral-300 dark:text-white/15 mt-0.5">Tap to select</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 h-px bg-black/[0.04] dark:bg-white/[0.04]" />

          {/* Stat rows */}
          <div className="px-5 py-5 flex flex-col gap-5">
            {ROWS.map((row, i) => (
              <StatRow key={row.key} label={row.label}
                myVal={(myStats?.[row.key] as number) ?? 0}
                theirVal={hasOpponent ? (theirStats![row.key] as number) : 0}
                suffix={row.suffix ?? ""} animated={animated} delay={200 + i * 70} />
            ))}

            <div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-[13px] font-semibold text-neutral-900 dark:text-white">{myStats?.favDrink ?? "—"}</span>
                  {(myStats?.favDrinkCount ?? 0) > 0 && <span className="text-[11px] text-neutral-300 dark:text-white/20">×{myStats!.favDrinkCount}</span>}
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-400 dark:text-white/30 uppercase tracking-wide">Favorite</span>
                <div className="flex items-baseline gap-1">
                  {hasOpponent ? (
                    <>
                      <span className="text-[13px] font-semibold text-neutral-900 dark:text-white">{theirStats!.favDrink ?? "—"}</span>
                      {theirStats!.favDrinkCount > 0 && <span className="text-[11px] text-neutral-300 dark:text-white/20">×{theirStats!.favDrinkCount}</span>}
                    </>
                  ) : (
                    <span className="text-[13px] font-semibold text-neutral-400 dark:text-white/20">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <FriendPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} friends={friends} onSelect={handleSelectFriend} />
      {theirStats && (
        <ChallengeModal open={challengeOpen} onClose={() => setChallengeOpen(false)} opponentName={theirStats.displayName} onSend={handleSendChallenge} sending={sending} />
      )}
      <MyDuelsSheet open={duelsOpen} onClose={() => setDuelsOpen(false)} duels={duels} userId={userId ?? ""} loading={duelsLoading} onAccept={handleAccept} onDecline={handleDecline} accepting={accepting} />
    </div>
  )
}